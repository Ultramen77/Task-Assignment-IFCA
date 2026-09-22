# Office FTP attachment migration

Attachment files are stored under the configured FTP root using their existing PostgreSQL `storage_key` path:

```text
/task-assignment/attachments/<task_id>/<stored-file-name>
```

The migration command copies files from Supabase without deleting the source. It verifies the uploaded FTP file size before continuing.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\migrate-supabase-attachments-to-ftp.ps1
```

For a safe single-file verification run:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\migrate-supabase-attachments-to-ftp.ps1 -Limit 1
```

Required server-only variables in `.env.local` or the deployment environment:

```ini
FTP_HOST=
FTP_PORT=21
FTP_USER=
FTP_PASSWORD=
FTP_ROOT_DIR=/task-assignment/attachments
FTP_SECURE=false
```

Never expose FTP credentials to the frontend. Attachment upload, download, and delete are proxied through the authenticated Express API.
