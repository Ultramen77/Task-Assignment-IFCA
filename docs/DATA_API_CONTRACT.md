# Data Contract & API Design Document

This document defines the schema mapping, API contract, security boundaries, and communication protocols between the React Frontend and the Google Apps Script Web App API layer.

---

## 1. Domain Model Mapping

Google Sheets columns are stored in **snake_case** for database compatibility, while the API payloads and TypeScript code utilize **camelCase** for consistency with modern JavaScript patterns.

### 1.1 Tasks Sheet mapping
*   Sheet Name: `Tasks`
*   Unique Key: `task_id`

| Google Sheets Column | API / TypeScript Field | Type | Required | Nullable | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `task_id` | `taskId` | `string` | Yes | No | Format: `TASK-XXXXXX` |
| `consultant_id` | `consultantId` | `string` | Yes | No | FK to Consultants |
| `type` | `type` | `string` | Yes | No | `"Bugs"` or `"Improvements"` |
| `client_id` | `clientId` | `string` | Yes | No | FK to Clients |
| `screen_report` | `screenReport` | `string` | Yes | No | Name of screen/report |
| `request` | `request` | `string` | Yes | No | Detail requirement text |
| `status` | `status` | `string` | Yes | No | `"Open"`, `"Assign"`, or `"Done"` |
| `programmer_id` | `programmerId` | `string` | No | Yes | FK to Programmers |
| `sql_server` | `sqlServer` | `string` | No | Yes | Target SQL Server instance |
| `database_name` | `databaseName` | `string` | No | Yes | Target Database name |
| `target_date` | `targetDate` | `string` | No | Yes | Format: `YYYY-MM-DD` |
| `notes` | `notes` | `string` | No | Yes | Catatan tambahan |
| `is_archived` | `isArchived` | `boolean` | Yes | No | Stored as `TRUE`/`FALSE` in Sheet |
| `created_at` | `createdAt` | `string` | Yes | No | ISO 8601 Timestamp |
| `updated_at` | `updatedAt` | `string` | Yes | No | ISO 8601 Timestamp |

### 1.2 TaskHistory Sheet mapping
*   Sheet Name: `TaskHistory`
*   Unique Key: `history_id`

| Google Sheets Column | API / TypeScript Field | Type | Required | Nullable | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `history_id` | `historyId` | `string` | Yes | No | Format: `HIST-XXXXXX` |
| `task_id` | `taskId` | `string` | Yes | No | FK to Tasks |
| `action` | `action` | `string` | Yes | No | `"CREATE"`, `"UPDATE"`, `"COMPLETE"`, `"ARCHIVE"` |
| `field_name` | `fieldName` | `string` | No | Yes | Column name changed |
| `old_value` | `oldValue` | `string` | No | Yes | Pre-change value |
| `new_value` | `newValue` | `string` | No | Yes | Post-change value |
| `changed_by` | `changedBy` | `string` | Yes | No | System user identifier |
| `changed_at` | `changedAt` | `string` | Yes | No | ISO 8601 Timestamp |

### 1.3 Attachments Sheet mapping
*   Sheet Name: `Attachments`
*   Unique Key: `attachment_id`

| Google Sheets Column | API / TypeScript Field | Type | Required | Nullable | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `attachment_id` | `attachmentId` | `string` | Yes | No | Format: `ATT-XXXXXX` |
| `task_id` | `taskId` | `string` | Yes | No | FK to Tasks |
| `file_name` | `fileName` | `string` | Yes | No | Original upload filename |
| `drive_file_id` | `driveFileId` | `string` | Yes | No | Google Drive ID reference |
| `drive_url` | `driveUrl` | `string` | Yes | No | Image serving URL (Apps Script `viewAttachment` endpoint) |
| `mime_type` | `mimeType` | `string` | Yes | No | e.g. `image/png`, `image/jpeg` |
| `description` | `description` | `string` | No | Yes | User explanation |
| `uploaded_at` | `uploadedAt` | `string` | Yes | No | ISO 8601 Timestamp |

### 1.4 Master Data & Settings Sheets mapping
*   Sheets Names: `Clients`, `Consultants`, `Programmers`, `Settings`

```text
Clients:      client_id -> clientId, client_name -> clientName, active -> active
Consultants:  consultant_id -> consultantId, consultant_name -> consultantName, active -> active
Programmers:  programmer_id -> programmerId, programmer_name -> programmerName, active -> active
Settings:     setting_key -> settingKey, setting_value -> settingValue, description -> description
```

---

## 2. Core Task & Business Rules

1.  **Stable Task IDs**: The `taskId` must be generated once on creation (e.g. `TASK-000001`) and remain immutable. The spreadsheet row index MUST never be used as a record identifier.
2.  **Date Serialization**:
    *   **Deadlines/Target Dates**: Date-only fields must use the unambiguous string format `YYYY-MM-DD` (e.g., `2026-08-19`).
    *   **Timestamps**: Operation timestamps (`createdAt`, `updatedAt`, `changedAt`, `uploadedAt`) must use ISO 8601 format: `YYYY-MM-DDTHH:mm:ss.sssZ`.
3.  **Derived Calculations**: The `remainingDays` attribute is a computed runtime value:
    $$\text{remainingDays} = \text{targetDate} - \text{currentSystemDate}$$
    It is never stored in Google Sheets. Tasks with status `Done` are business-defined as non-overdue, returning `Safe` or remaining days omitted from urgency alerting.
4.  **Archive Policy**: Archiving sets `is_archived` to `TRUE`. Archived tasks are permanently stored in Google Sheets but are excluded from active list endpoints by default.
5.  **Optional Technical Attributes**: In initial request logging phases, fields such as `programmerId`, `sqlServer`, `databaseName`, `targetDate`, and `notes` can remain `null` or empty string.

---

## 3. ID Generation Strategy

To prevent concurrent record writing from generating identical task IDs, the Google Apps Script backend must execute a lock safety routine.

1.  **Prefix Sequence Pattern**:
    *   Tasks: `TASK-` followed by a 6-digit zero-padded integer sequence (e.g., `TASK-000001`).
    *   History: `HIST-` followed by 6-digit zero-padded integer (e.g., `HIST-000001`).
    *   Attachments: `ATT-` followed by 6-digit zero-padded integer (e.g., `ATT-000001`).
2.  **Lock Safety in Apps Script**:
    The ID lookup and row insert routine must acquire a public Lock:
    ```javascript
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000); // 10 seconds timeout limit
      // 1. Read last task ID sequence from target metadata or column scan
      // 2. Increment value and generate new ID
      // 3. Write row
    } finally {
      lock.releaseLock();
    }
    ```

---

## 4. API Response Envelope

All API endpoints must return a standardized JSON envelope structure.

### 4.1 Success Envelope
```json
{
  "success": true,
  "data": {} 
}
```
*   `data` can be an object, array, or null depending on the action.

### 4.2 Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "User-friendly description of error context"
  }
}
```

### 4.3 Standard Error Codes

| Code | HTTP Equivalent | Description |
| :--- | :--- | :--- |
| `BAD_REQUEST` | 400 | Missing parameters, validation errors, invalid JSON payload |
| `UNAUTHORIZED` | 401 | Missing or invalid request token |
| `NOT_FOUND` | 404 | Target resource (task, client, programmer) not found |
| `CONFLICT` | 409 | ID already exists or sequence mismatch |
| `LOCK_TIMEOUT` | 503 | Server failed to acquire lock in timely manner |
| `SERVER_ERROR` | 500 | Unhandled internal exception (Stacktrace is logged in Apps Script execution console, NEVER returned to frontend) |

---

## 5. API Endpoints (Action-Based Routing)

Google Apps Script `webapps` deploy to a single endpoint URL. Web apps process inbound requests inside `doGet(e)` (for reads) and `doPost(e)` (for writes/updates).
We use query parameter `?action=ACTION_NAME` to route requests.

### 5.1 Overview of Actions

| HTTP Method | Action Route (`?action=`) | Purpose | Payload Location |
| :--- | :--- | :--- | :--- |
| `GET` | `listTasks` | Fetch all active (or completed) tasks | Query Params |
| `GET` | `getTask` | Fetch details of a single task | Query Params |
| `POST` | `createTask` | Insert a new task | JSON Body (`postData`) |
| `POST` | `updateTask` | Update values of a task | JSON Body (`postData`) |
| `POST` | `archiveTask` | Mark task as archived | JSON Body (`postData`) |
| `GET` | `listClients` | Fetch clients master list | Query Params |
| `GET` | `listConsultants` | Fetch consultants master list | Query Params |
| `GET` | `listProgrammers` | Fetch programmers master list | Query Params |
| `GET` | `getTaskHistory` | Fetch history logs for a task | Query Params |
| `GET` | `listRecentHistory` | Fetch latest global history entries (dashboard feed) | Query Params (`limit`) |
| `GET` | `getTaskAttachments` | Fetch attachments metadata for a task | Query Params |
| `GET` | `viewAttachment` | Serve an attachment image as raw bytes (usable as `<img src>`) | Query Params |
| `POST` | `uploadAttachment` | Upload single base64 attachment to Google Drive | JSON Body (`postData`) |
| `POST` | `deleteAttachment` | Trash file in Drive and remove sheet metadata row | JSON Body (`postData`) |

---

### 5.2 Endpoint Details

#### GET `?action=listTasks`
*   **Query Parameters**:
    *   `includeArchived` (boolean, optional, default `false`)
*   **Response `data`**: Array of `TaskReadModel` records.

#### GET `?action=getTask`
*   **Query Parameters**:
    *   `taskId` (string, required)
*   **Response `data`**: Single `TaskReadModel` object.

#### POST `?action=createTask`
*   **Payload `postData`**:
    ```json
    {
      "consultantId": "CON-1",
      "type": "Bugs",
      "clientId": "CLI-1",
      "screenReport": "Purchase Form",
      "request": "Fix timeout error",
      "status": "Open",
      "programmerId": null,
      "sqlServer": "SRV-TEST",
      "databaseName": "DB_TEST",
      "targetDate": "2026-08-25",
      "notes": "",
      "attachments": [
        {
          "fileName": "screenshot.png",
          "mimeType": "image/png",
          "base64Payload": "..." // Upload design detail delegated to Phase 4
        }
      ]
    }
    ```
*   **Response `data`**: `{"taskId": "TASK-000009"}`

#### POST `?action=updateTask`
*   **Payload `postData`**:
    ```json
    {
      "taskId": "TASK-000001",
      "updatedFields": {
        "status": "Assign",
        "programmerId": "PROG-2",
        "targetDate": "2026-08-20"
      }
    }
    ```
*   **Response `data`**: `{"success": true}`

#### POST `?action=archiveTask`
*   **Payload `postData`**:
    ```json
    {
      "taskId": "TASK-000001"
    }
    ```
*   **Response `data`**: `{"success": true}`

#### POST `?action=uploadAttachment`
*   **Payload `postData`**: Refer to `docs/ATTACHMENT_CONTRACT.md` Section 4.1.
*   **Response `data`**: `{"attachmentId": "ATT-000004", "fileUrl": "{WEB_APP_URL}?action=viewAttachment&attachmentId=ATT-000004"}`

#### GET `?action=viewAttachment`
*   **Query Parameters**:
    *   `attachmentId` (string, required)
*   **Response**: Raw image bytes with the correct MIME type (not a JSON envelope). Lookups go through the `Attachments` sheet (`attachmentId` → `drive_file_id`), and bytes are read via `DriveApp`. Only registered attachment ids are served. Failure returns a non-image error response; the frontend `onError` fallback shows "Image unavailable".

#### POST `?action=deleteAttachment`
*   **Payload `postData`**: Refer to `docs/ATTACHMENT_CONTRACT.md` Section 4.2.
*   **Response `data`**: `{"success": true}`

---

## 6. Task Read Model (Denormalized API Response)

To prevent the React frontend from having to execute nested lookup requests or manual client-side joins (matching `consultantId` to fetch consultant name, etc.), the backend `listTasks` and `getTask` endpoints return a denormalized **Read Model**.

### 6.1 TaskReadModel Structure
```json
{
  "taskId": "TASK-000001",
  "type": "Bugs",
  "screenReport": "Sales Order Entry",
  "request": "Error runtime saat menekan tombol Save...",
  "status": "Assign",
  "sqlServer": "SRV-SAP-DB01",
  "databaseName": "DB_SALES_PROD",
  "targetDate": "2026-08-15",
  "notes": "Klien butuh cepat karena order terhambat.",
  "isArchived": false,
  "createdAt": "2026-08-10T08:00:00.000Z",
  "updatedAt": "2026-08-12T10:20:00.000Z",
  "completedAt": null,
  
  "consultant": {
    "id": "CON-1",
    "name": "Andi"
  },
  "client": {
    "id": "CLI-1",
    "name": "Pabrik Kertas A"
  },
  "programmer": {
    "id": "PROG-1",
    "name": "Faisal"
  } // Can be null if unassigned
}
```

---

## 7. Write Payloads & Relational IDs

When executing a `createTask` or `updateTask` request, the frontend sends relational references as foreign key identifiers (`consultantId`, `clientId`, `programmerId`). Display names are never used as identifiers on write payloads.

### 7.1 Required Fields for Task Creation
*   `consultantId`
*   `clientId`
*   `type`
*   `screenReport` (non-empty string)
*   `request` (non-empty string)
*   `status`

All other columns (`programmerId`, `sqlServer`, `databaseName`, `targetDate`, `notes`) are optional.

---

## 8. Backend Validation Matrix

The Apps Script Web App must validate inbound parameters prior to spreadsheet writes:

1.  **Required Presence**: Fail with `BAD_REQUEST` if required values are missing or blank.
2.  **Type Validation**: Reject values that do not match `"Bugs"` or `"Improvements"`.
3.  **Status Validation**: Reject values that do not match `"Open"`, `"Assign"`, or `"Done"`.
4.  **Date Validation**: Ensure `targetDate` conforms to `YYYY-MM-DD` regex or is null.
5.  **Referential Integrity**: Validate that `consultantId`, `clientId`, and `programmerId` exist as active keys in their respective master sheets.

---

## 9. Frontend Service Boundary

To keep components clean and free from direct REST/fetch code, the frontend organizes data-access within a dedicated service layer.

### 9.1 Boundary Architecture
```text
UI Component (TasksPage)
    |
    v
React Context / Custom Hook (useTasks)
    |
    v
Service Class (taskService)
    |
    v
HTTP Client (fetch client requesting VITE_API_URL?action=...)
```

### 9.2 Suggested `taskService` Interface
```typescript
export interface TaskService {
  getTasks(includeArchived?: boolean): Promise<TaskReadModel[]>;
  getTaskById(taskId: string): Promise<TaskReadModel>;
  createTask(payload: CreateTaskPayload): Promise<string>; // returns taskId
  updateTask(taskId: string, payload: Partial<CreateTaskPayload>): Promise<void>;
  archiveTask(taskId: string): Promise<void>;
  
  getClients(): Promise<Client[]>;
  getConsultants(): Promise<Consultant[]>;
  getProgrammers(): Promise<Programmer[]>;
  getHistory(taskId: string): Promise<TaskHistory[]>;
  getAttachments(taskId: string): Promise<Attachment[]>;
}
```

---

## 10. Environment Configuration

1.  **Vite Variable**: The frontend reads the endpoint URL via `import.meta.env.VITE_API_URL`.
2.  **Local Dev Override**: A `.env.local` file is created locally (and gitignored) to point to the local or test Google Apps Script Web App deploy.
3.  **Example Template**: `.env.example` provides documentation without disclosing production URLs:
    ```ini
    # Public URL of the Google Apps Script Web App deployment
    VITE_API_URL=https://script.google.com/macros/s/EXEC_ID/exec
    ```

---

## 11. CORS & Google Apps Script Considerations

Calling Google Apps Script directly from a static site on GitHub Pages introduces specific constraints:

1.  **Redirection Protocol**:
    Apps Script web apps redirect all successful responses using HTTP 302/307 to temporary URLs hosted at `script-usercontent.google.com`.
    *   **Frontend Impact**: The browser's native `fetch()` handles this redirect automatically. However, custom HTTP clients must be configured to follow redirects.
2.  **CORS Handling**:
    To bypass cross-origin browser blocks, the Google Apps Script code must return responses wrapped using the `HtmlService` or return string JSON wrapped in `ContentService` with headers:
    ```javascript
    return ContentService.createTextOutput(JSON.stringify(envelope))
      .setMimeType(ContentService.MimeType.JSON);
    ```
    Apps Script automatically adds appropriate CORS headers (`Access-Control-Allow-Origin: *`) to the redirected `script-usercontent.google.com` output.
3.  **Method Limitations**:
    Google Apps Script Web Apps do not support `PUT`, `PATCH`, or `DELETE` natively in CORS-fetch operations. Therefore:
    *   All write/modification requests must route through `POST` requests.
    *   Reads route through `GET`.

---

## 12. Future Proofing (Phases 3-5)

1.  **Automatic History Logging (Phase 3)**:
    The `updateTask` backend logic is designed to automatically compare incoming keys against the current row values in Sheets and append corresponding changes to the `TaskHistory` sheet.
2.  **Google Drive Attachments (Phase 4)**:
    `createTask` accepts attachment records containing binary payloads. Apps Script will save files directly in designated Google Drive folders, and only write metadata URLs into the `Attachments` Sheet.
3.  **Existing Data Migration (Phase 5)**:
    Primary keys (`consultant_id`, `client_id`, `programmer_id`) in Sheets map cleanly to the migration mappings schema defined in the migration strategy.

---

## 13. Phase 3 Addendum — History, Audit Trail & Completion

### 13.1 Automatic History Creation

The backend (`apps-script/Code.gs`) writes to `TaskHistory` automatically:

*   **createTask** → one `CREATE` row (`field_name=null`, `new_value="Task created"`).
*   **updateTask** → one `UPDATE` (or `COMPLETE` when `status` becomes `Done`) row **per changed field**. Unchanged fields produce no history entry. Comparison is normalized so `null`/`""` are treated as equal.
*   **archiveTask** → one `ARCHIVE` row (`field_name=is_archived`, `old_value=FALSE`, `new_value=TRUE`). Idempotent: re-archiving an already-archived task does not duplicate history.

Field names stored are the canonical snake_case sheet columns (`consultant_id`, `client_id`, `status`, `programmer_id`, `target_date`, etc.).

### 13.2 History ID Generation

`history_id` uses the same `LockService.getScriptLock()` sequence strategy as task IDs, prefixed `HIST-` (e.g. `HIST-000001`). No reliance on `getLastRow()+1` alone.

### 13.3 Changed-By Placeholder

Authentication is not implemented. All history rows use a fixed actor:

```javascript
const CHANGED_BY = "SYSTEM";
```

This is centralized and easy to replace when authentication is added.

### 13.4 Completion Behavior

The `Tasks` sheet schema has **no `completed_at` column**. Per Phase 3 constraints, the schema is NOT modified. Completion is therefore derived:

*   `TaskReadModel.completedAt` is set server-side to `updated_at` when `status === "Done"`.
*   `Done` tasks are never reported as Overdue by the frontend deadline logic.

If a `completed_at` column is added later, the backend should stamp it on the status→Done transition and clear it on transition away from `Done`.

### 13.5 History Read Ordering

*   `getTaskHistory` returns rows **newest-first** (by `changed_at` descending).
*   `listRecentHistory` returns the latest `N` entries (default 50, override via `?limit=`) **newest-first**, for the dashboard activity feed. It is a single backend call (no per-task fetching).

### 13.6 History Write Failure Strategy

Apps Script has no distributed transaction. If a task row update succeeds but history append fails, the action returns `SERVER_ERROR` with a message indicating partial success ("Task updated but history logging failed"). The UI surfaces the error rather than claiming silent success.

### 13.7 Frontend History Display

The frontend resolves relational IDs to display names at render time using master-data lists (no extra API calls), and maps canonical `field_name` values to human labels (e.g. `programmer_id` → "Programmer"). Storage remains canonical.
