# Odyssey ERP Lead Capture Deployment

## 1. Open the existing spreadsheet

Open the Google Spreadsheet named `Odyssey ERP Demo Requests`.

## 2. Open Apps Script from the spreadsheet

1. In Google Sheets, click `Extensions`.
2. Click `Apps Script`.
3. A new Apps Script project will open and stay attached to this spreadsheet.

## 3. Paste the backend code

1. In the editor, open the default `Code.gs`.
2. Delete its contents.
3. Copy everything from [`apps-script/Code.gs`](F:\ERP\Odyssey-ERP\apps-script\Code.gs).
4. Paste it into the Apps Script editor.
5. Save the project.

## 4. Authorize the project

1. Click `Run`.
2. Run `doGet` once.
3. Approve the required permissions for Sheets, Drive, Mail, and Script services.

## 5. Deploy as a Web App

1. Click `Deploy`.
2. Click `New deployment`.
3. Choose type `Web app`.
4. Set `Description` to `Odyssey ERP Lead Capture`.
5. Set `Execute as` to `Me`.
6. Set `Who has access` to `Anyone`.
7. Click `Deploy`.
8. Copy the generated `Web app URL`.

## 6. Paste the Web App URL into the landing page

Open [`lead-form.config.js`](F:\ERP\Odyssey-ERP\lead-form.config.js) and replace:

`PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE`

with your deployed Apps Script Web App URL.

Example:

```js
window.ODYSSEY_DEMO_CONFIG = {
  webAppUrl: "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec"
};
```

## 7. Redeploy the Apps Script after code changes

If you edit `Code.gs` later:

1. Save the changes in Apps Script.
2. Click `Deploy`.
3. Click `Manage deployments`.
4. Edit the existing Web App deployment.
5. Choose `New version`.
6. Click `Deploy`.

## 8. Expected behavior

After deployment and after updating `lead-form.config.js`:

1. The visitor stays on the same landing page.
2. The form submits silently in the background.
3. The data is written into the `Demo Requests` sheet.
4. HTML email notifications are sent to both recipients.
5. The form resets and shows a success message.
