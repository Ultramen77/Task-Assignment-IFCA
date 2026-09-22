# PostgreSQL API mode

The current IFCA copy uses the Express server as the only browser-facing gateway to the office PostgreSQL database.

```text
React/Vite -> Express + Better Auth -> office PostgreSQL
```

## Local configuration

Keep secrets in `.env.local` or the server environment. The frontend only needs the public API origin:

```ini
VITE_DATA_SOURCE=postgres
VITE_API_URL=http://127.0.0.1:3001/api/data
VITE_AUTH_URL=http://127.0.0.1:3001
```

Run the servers from the project directory:

```powershell
npm run auth:dev
npm run dev
```

The data routes require a valid Better Auth session. Core task reads/writes, task history, master data, and assignment comments now use PostgreSQL. Comment creation is limited to the consultant or programmer assigned to that task.

Existing attachment files have been copied to the office FTP storage using the same relative `storage_key` path. The frontend now reads and writes attachment binaries through the API, which keeps FTP credentials server-side.

Attachment metadata and binary operations now use the office API and FTP:

```text
GET    /api/data/tasks/:taskId/attachments
GET    /api/data/attachments/:attachmentId/file
POST   /api/data/tasks/:taskId/attachments
DELETE /api/data/attachments/:attachmentId
```

FTP credentials are server-only. Set `FTP_HOST`, `FTP_PORT`, `FTP_USER`, `FTP_PASSWORD`, `FTP_ROOT_DIR`, and `FTP_SECURE` on the API server. The browser must never receive these values.
