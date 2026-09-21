# Attachment Storage & Upload Contract

This document defines the architecture, APIs, and user experience flow for uploading, storing, and viewing task attachments (images/screenshots) via Google Drive and Google Apps Script.

---

## 1. Storage Strategy

Google Drive will serve as the blob storage layer. Google Sheets (`Attachments` sheet) acts strictly as a metadata database and will **never** store base64 payloads directly.

### 1.1 Directory Structure
Attachments are stored inside a dedicated root folder in Google Drive. To prevent file clutter, task-specific subfolders are created lazily upon the first attachment upload for a given task.

```text
Root Attachment Folder/
  ├── TASK-000001/
  │   ├── TASK-000001_ATT-000001_error-screen.png
  │   └── TASK-000001_ATT-000002_expected.jpeg
  ├── TASK-000002/
  │   └── TASK-000002_ATT-000003_mockup.webp
```

### 1.2 Configuration
The Root Folder ID is stored securely in **Google Apps Script Properties** (e.g., `ATTACHMENTS_ROOT_FOLDER_ID`). It is **never** exposed to the React frontend or committed to source control via `VITE_*` variables.

---

## 2. Drive Permission Strategy

Attachment images are served through the **Google Apps Script Web App** (the same endpoint that handles the API), not directly from `drive.google.com`. The Web App is deployed with **Execute as: Me** and **Who has access: Anyone**, so it reads the Drive file server-side with owner credentials and streams the image bytes back to the browser.

Direct Drive public-link access is **not** required for rendering, so new uploads are **not** shared as `ANYONE_WITH_LINK`. Files remain private to the Drive account and are only readable through the Apps Script serving endpoint.

### 2.1 Security Implications
- **Viewing**: An image is only reachable via `?action=viewAttachment&attachmentId={ATT_ID}`. The endpoint only serves files that are registered in the `Attachments` sheet. It never accepts an arbitrary Drive file id.
- **Writing**: The React frontend does **not** have Google Drive write credentials. All file creation occurs server-side via the Apps Script Web App (executing as the Spreadsheet Owner).
- **Authentication**: The application currently has no authentication. Anyone who can reach the public Web App URL can also read registered attachment images. It is intended as an internal utility.

---

## 3. Upload Transport

The frontend will use a **Base64 JSON Transport** to send files to the Apps Script backend.

### 3.1 Justification
Google Apps Script handles `multipart/form-data` poorly in CORS contexts. Sending base64 strings within a standard `application/json` POST payload is the most reliable approach for files <= 5 MB.

### 3.2 Constraints
- **Overhead**: Base64 encoding introduces a ~33% payload size overhead.
- **Concurrency**: Files must be uploaded **individually/sequentially** (one request per file) to prevent exceeding Apps Script memory limits and execution timeouts.
- **Size Validation**: The frontend must block files larger than 5 MB before encoding. The backend must strictly validate the decoded byte size.

---

## 4. Attachment API Contract

New actions are added to the existing `?action=` routing system.

### 4.1 POST `?action=uploadAttachment`
Uploads a single image to Google Drive and inserts a metadata row into the `Attachments` sheet.

**Payload (`postData`):**
```json
{
  "taskId": "TASK-000001",
  "fileName": "error-screen.png",
  "mimeType": "image/png",
  "description": "Error shown after saving",
  "contentBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
}
```

**Validation:**
- `taskId` must exist in the `Tasks` sheet.
- `mimeType` must be `image/png`, `image/jpeg`, or `image/webp`.
- Decoded `contentBase64` size must be <= `MAX_ATTACHMENT_BYTES` (e.g., 5 MB).
- Must contain valid base64 payload.

**Response:**
```json
{
  "success": true,
  "data": {
    "attachmentId": "ATT-000004",
    "fileUrl": "{WEB_APP_URL}?action=viewAttachment&attachmentId=ATT-000004"
  }
}
```

### 4.2 POST `?action=deleteAttachment`
Trashes the file in Google Drive and hard-removes the metadata row.

**Payload:**
```json
{
  "attachmentId": "ATT-000004"
}
```

**Response:**
```json
{
  "success": true
}
```

### 4.3 GET `?action=viewAttachment`
Serves the raw image bytes for direct use as an `<img src>` (NOT a JSON envelope). The URL is built by the backend from `attachmentId`; it is returned to the frontend as `fileUrl` in `getTaskAttachments` and `uploadAttachment` responses.

**Query Parameter:**
- `attachmentId` (required, e.g. `ATT-000001`)

**Behavior:**
1. Look up the `Attachments` metadata row by `attachmentId`.
2. Validate the stored `mime_type` against `image/png`, `image/jpeg`, `image/webp`.
3. Read the file via `DriveApp.getFileById(drive_file_id)`.
4. Return the image bytes with the correct `Content-Type`.

**Failure:** Missing metadata, missing/trashed Drive file, unsupported MIME type, or Drive access failure return a non-image error response (never a stack trace). The frontend `<img>` falls back to the "Image unavailable" placeholder.

---

## 5. Attachment Read Model

The `getTaskAttachments` endpoint returns an array of frontend-friendly metadata objects.

```json
{
  "attachmentId": "ATT-000001",
  "taskId": "TASK-000001",
  "fileName": "error-screen.png",
  "fileUrl": "{WEB_APP_URL}?action=viewAttachment&attachmentId=ATT-000001",
  "mimeType": "image/png",
  "description": "Error shown after saving",
  "uploadedAt": "2026-08-19T10:00:00.000Z"
}
```

`fileUrl` always points at the Apps Script serving endpoint keyed by `attachmentId`. The React app renders this URL directly in `<img>` elements and never constructs drive.google.com URLs. `drive_file_id` is excluded from the frontend read model as the React app only needs `fileUrl` to render images.

---

## 6. Identifier Strategy

### 6.1 Attachment ID
Generated safely using `LockService` in Apps Script, prefixed with `ATT-` (e.g., `ATT-000001`). This ensures stability and prevents collisions during concurrent uploads. The system does not rely on `getLastRow() + 1`.

### 6.2 Safe File Naming
Users may upload files with spaces, special characters, or duplicate names. To guarantee uniqueness and safety in Google Drive, the backend will generate a physical filename:
`{TASK_ID}_{ATT_ID}_{SANITIZED_ORIGINAL_NAME}`
*(e.g., `TASK-000001_ATT-000001_error-screen.png`)*

The original, un-sanitized user filename is preserved in the `file_name` column of the `Attachments` metadata sheet for display purposes.

---

## 7. Delete Behavior & Partial Failures

Deleting an attachment is a hard delete from the application's perspective. The backend will:
1. Retrieve the metadata row using `attachmentId`.
2. Locate the file in Google Drive via `drive_file_id` and mark it as `trashed`.
3. Delete the metadata row from the `Attachments` sheet.

**Partial Failure Handling**:
If the Drive file is trashed successfully but deleting the sheet row fails, the server will return an error envelope. The frontend will alert the user. No complex rollback transactions are implemented; the metadata row becomes an orphaned pointer which handles broken images gracefully (see Section 9). After a successful delete, the metadata row is gone, so `viewAttachment` naturally returns not found and the frontend shows the "Image unavailable" fallback.

---

## 8. UX Workflows

### 8.1 Create Task Flow
A `taskId` does not exist until the task is successfully created.
1. User selects local image files in the Task Form.
2. The UI holds File references in local memory.
3. User clicks "Save".
4. The frontend calls `createTask`.
5. Upon successful creation, the frontend receives the new `taskId`.
6. The frontend loops over the selected files and calls `uploadAttachment` **sequentially** for each one.
7. Toast feedback shows progress: "Uploading 1 of 2...", "Uploading 2 of 2...", "Upload complete."
8. If an attachment fails, the task remains successfully created. A toast warns the user: "Failed to upload error-screen.png". The user can retry from the Edit/Detail view later.

### 8.2 Existing Task Flow
1. User clicks "Add Attachment" in the Task Detail view.
2. User selects an image.
3. Upload begins immediately (sequential). Toast shows "Uploading...".
4. Gallery auto-refreshes upon completion.

### 8.3 Delete Flow
1. User clicks "Delete" on an attachment.
2. A `ConfirmDialog` modal warns the user.
3. Upon confirmation, action button becomes "Deleting...".
4. `deleteAttachment` API is called.
5. On success, toast displays "Attachment deleted successfully" and the gallery refreshes.

---

## 9. Image Viewer Graceful Degradation

The existing Lightbox `ImageViewer` uses the Apps Script serving URL returned as `fileUrl`.
If the serving endpoint returns a non-image response (attachment deleted, Drive file missing, unsupported type, or access failure), the standard browser `<img>` `onError` handler must catch the failure and render a graceful fallback placeholder (e.g., "Image unavailable or deleted"). One broken URL must not crash the viewer gallery.

---

## 10. Security Summary

- **No client-side credentials**: Drive credentials belong entirely to the backend.
- **Backend authority**: The server enforces MIME type checks and 5 MB size limits on upload.
- **No arbitrary path traversal**: Files are strictly routed to the root folder ID defined in Apps Script properties.
- **No arbitrary file reads**: `viewAttachment` only serves files registered in the `Attachments` sheet, keyed by `attachmentId` — never by a caller-supplied Drive file id.
- **No public Drive sharing required**: New uploads stay private to the Drive account; images are streamed through the Apps Script Web App (executing as owner). Confidential data must still not be uploaded as this is an internal, unauthenticated utility.

---

## 11. Phase 5 Compatibility

This architecture ensures future compatibility with Phase 5 (Spreadsheet Migration). The backend metadata schema supports manually importing pre-existing Drive URLs as long as `attachment_id` logic accounts for historical numbering.
