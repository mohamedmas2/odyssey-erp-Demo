var CONFIG = {
  spreadsheetName: "Odyssey ERP Demo Requests",
  sheetName: "Demo Requests",
  recipients: [
    "mahamedmas89@gmail.com",
    "amrelgebaly2007@gmail.com"
  ],
  headers: [
    "Timestamp",
    "Full Name",
    "Company",
    "Job Title",
    "Email",
    "Phone",
    "Country",
    "Company Size",
    "Industry",
    "Message",
    "Source",
    "Status",
    "Assigned To"
  ],
  defaults: {
    source: "Landing Page",
    status: "New",
    assignedTo: ""
  },
  duplicateWindowMinutes: 5,
  recentRowScanLimit: 200
};

function doGet() {
  return HtmlService.createHtmlOutput("Odyssey ERP lead capture is running.");
}

function doPost(e) {
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    var payload = buildPayload_(e);
    validatePayload_(payload);

    var spreadsheet = findSpreadsheetByName_(CONFIG.spreadsheetName);
    var sheet = getOrCreateSheet_(spreadsheet, CONFIG.sheetName);
    ensureHeaders_(sheet);

    if (isDuplicateSubmission_(sheet, payload)) {
      return buildIframeResponse_("duplicate", "Duplicate submission detected. Please wait before trying again.");
    }

    var timestamp = new Date();
    appendSubmission_(sheet, timestamp, payload);
    sendNotificationEmail_(spreadsheet, timestamp, payload);

    return buildIframeResponse_("success", "Lead captured successfully.");
  } catch (error) {
    console.error("Odyssey ERP lead capture failed", error);
    return buildIframeResponse_("error", safeErrorMessage_(error));
  } finally {
    lock.releaseLock();
  }
}

function buildPayload_(e) {
  var params = (e && e.parameter) || {};

  return {
    fullName: sanitizeText_(params.name, 120),
    company: sanitizeText_(params.company, 120),
    jobTitle: sanitizeText_(params.jobTitle, 120),
    email: sanitizeEmail_(params.email),
    phone: sanitizeText_(params.phone, 60),
    country: sanitizeText_(params.country, 80),
    companySize: sanitizeText_(params.companySize, 80),
    industry: sanitizeText_(params.industry, 80),
    message: sanitizeText_(params.message, 2000),
    source: sanitizeText_(params.source, 80) || CONFIG.defaults.source,
    status: sanitizeText_(params.status, 40) || CONFIG.defaults.status,
    assignedTo: sanitizeText_(params.assignedTo, 120) || CONFIG.defaults.assignedTo,
    honeypot: sanitizeText_(params.website, 200),
    dedupeKey: sanitizeText_(params.dedupeKey, 320)
  };
}

function validatePayload_(payload) {
  if (payload.honeypot) {
    throw new Error("Spam rejected.");
  }

  if (!payload.fullName || !payload.company || !payload.email || !payload.phone) {
    throw new Error("Missing required fields.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(payload.email)) {
    throw new Error("Invalid email address.");
  }
}

function findSpreadsheetByName_(name) {
  var files = DriveApp.getFilesByName(name);
  if (!files.hasNext()) {
    throw new Error('Spreadsheet "' + name + '" was not found.');
  }

  return SpreadsheetApp.open(files.next());
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  return sheet || spreadsheet.insertSheet(sheetName);
}

function ensureHeaders_(sheet) {
  var firstRow = sheet.getRange(1, 1, 1, CONFIG.headers.length).getValues()[0];
  var isEmpty = firstRow.join("").trim() === "";

  if (isEmpty) {
    sheet.getRange(1, 1, 1, CONFIG.headers.length).setValues([CONFIG.headers]);
    sheet.setFrozenRows(1);
  }
}

function isDuplicateSubmission_(sheet, payload) {
  var dedupeKey = payload.dedupeKey || buildDedupeKey_(payload);
  var cache = CacheService.getScriptCache();
  var cacheKey = "lead:" + dedupeKey;

  if (cache.get(cacheKey)) {
    return true;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    cache.put(cacheKey, "1", CONFIG.duplicateWindowMinutes * 60);
    return false;
  }

  var rowCount = Math.min(CONFIG.recentRowScanLimit, lastRow - 1);
  var startRow = lastRow - rowCount + 1;
  var values = sheet.getRange(startRow, 1, rowCount, CONFIG.headers.length).getValues();
  var now = new Date().getTime();
  var windowMs = CONFIG.duplicateWindowMinutes * 60 * 1000;

  for (var i = values.length - 1; i >= 0; i -= 1) {
    var row = values[i];
    var rowTimestamp = row[0];
    var rowPayload = {
      fullName: row[1],
      company: row[2],
      email: row[4],
      phone: row[5]
    };

    if (buildDedupeKey_(rowPayload) !== dedupeKey) {
      continue;
    }

    if (rowTimestamp instanceof Date && now - rowTimestamp.getTime() < windowMs) {
      return true;
    }
  }

  cache.put(cacheKey, "1", CONFIG.duplicateWindowMinutes * 60);
  return false;
}

function appendSubmission_(sheet, timestamp, payload) {
  sheet.appendRow([
    timestamp,
    payload.fullName,
    payload.company,
    payload.jobTitle,
    payload.email,
    payload.phone,
    payload.country,
    payload.companySize,
    payload.industry,
    payload.message,
    payload.source,
    payload.status,
    payload.assignedTo
  ]);
}

function sendNotificationEmail_(spreadsheet, timestamp, payload) {
  var subject = "\uD83D\uDE80 New Odyssey ERP Demo Request";
  var sheetUrl = spreadsheet.getUrl();
  var replyUrl = "mailto:" + encodeURIComponent(payload.email) +
    "?subject=" + encodeURIComponent("Re: Your Odyssey ERP demo request");

  var rows = [
    ["Submission Time", formatTimestamp_(timestamp)],
    ["Full Name", payload.fullName],
    ["Company", payload.company],
    ["Job Title", payload.jobTitle],
    ["Email", payload.email],
    ["Phone", payload.phone],
    ["Country", payload.country],
    ["Company Size", payload.companySize],
    ["Industry", payload.industry],
    ["Message", payload.message],
    ["Status", payload.status],
    ["Source", payload.source]
  ];

  var detailsHtml = rows.map(function (row) {
    return (
      '<tr>' +
        '<td style="padding:12px 14px;border-bottom:1px solid #e7eef8;color:#55708f;font-weight:700;width:180px;">' + escapeHtml_(row[0]) + "</td>" +
        '<td style="padding:12px 14px;border-bottom:1px solid #e7eef8;color:#10213e;">' + escapeHtml_(row[1] || "-") + "</td>" +
      "</tr>"
    );
  }).join("");

  var htmlBody =
    '<div style="margin:0;padding:32px;background:#eef4ff;font-family:Arial,sans-serif;color:#10213e;">' +
      '<div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(16,33,62,0.12);">' +
        '<div style="padding:32px;background:linear-gradient(135deg,#1565f0,#20c4da);color:#ffffff;">' +
          '<div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;">Odyssey ERP</div>' +
          '<h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">New demo request received</h1>' +
          '<p style="margin:12px 0 0;font-size:15px;line-height:1.7;opacity:0.95;">A new lead has been submitted from the Odyssey ERP landing page.</p>' +
        "</div>" +
        '<div style="padding:28px 28px 8px;">' +
          '<table style="width:100%;border-collapse:collapse;background:#fbfdff;border:1px solid #e7eef8;border-radius:18px;overflow:hidden;">' +
            detailsHtml +
          "</table>" +
          '<div style="padding:28px 0 20px;">' +
            '<a href="' + escapeHtml_(sheetUrl) + '" style="display:inline-block;margin-right:12px;padding:14px 22px;border-radius:999px;background:#1565f0;color:#ffffff;text-decoration:none;font-weight:700;">Open Google Sheet</a>' +
            '<a href="' + escapeHtml_(replyUrl) + '" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#eef4ff;color:#1565f0;text-decoration:none;font-weight:700;">Reply to Customer</a>' +
          "</div>" +
        "</div>" +
      "</div>" +
    "</div>";

  MailApp.sendEmail({
    to: CONFIG.recipients.join(","),
    subject: subject,
    htmlBody: htmlBody,
    name: "Odyssey ERP Demo Requests"
  });
}

function buildIframeResponse_(status, message) {
  var payload = JSON.stringify({
    type: "odyssey-demo-response",
    status: status,
    message: message
  });

  var html =
    "<!DOCTYPE html>" +
    '<html><body><script>' +
    "window.top.postMessage(" + JSON.stringify(payload) + ", '*');" +
    "</script></body></html>";

  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function sanitizeText_(value, maxLength) {
  var clean = String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (maxLength && clean.length > maxLength) {
    return clean.slice(0, maxLength);
  }

  return clean;
}

function sanitizeEmail_(value) {
  return sanitizeText_(value, 160).toLowerCase();
}

function buildDedupeKey_(payload) {
  return [
    sanitizeText_(payload.fullName || payload.name || "", 120).toLowerCase(),
    sanitizeText_(payload.company || "", 120).toLowerCase(),
    sanitizeEmail_(payload.email || ""),
    sanitizeText_(payload.phone || "", 60).toLowerCase()
  ].join("|");
}

function formatTimestamp_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeErrorMessage_(error) {
  var message = error && error.message ? error.message : "Unexpected error.";
  if (/Spreadsheet/.test(message) || /Missing required/.test(message) || /Invalid email/.test(message) || /Spam/.test(message)) {
    return message;
  }
  return "Unexpected error.";
}
