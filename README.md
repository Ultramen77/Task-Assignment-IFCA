# Task Assignment IFCA

Internal task and assignment management system for the IFCA team.

## Architecture

```text
React/Vite frontend (GitHub Pages or office web server)
        |
        v
Express + Better Auth API
        |
        +--> Office PostgreSQL
        +--> Office FTP (attachments)
        +--> SMTP (password reset and reopen notifications)
```

Supabase is no longer part of the production runtime. Remaining Supabase variables and scripts are migration-only and can be removed after final cutover acceptance.

## Local development

Install dependencies and create `.env.local` from `.env.example`. Keep secrets in `.env.local`; it is gitignored.

```powershell
npm install
npm run auth:dev       # Express API on AUTH_PORT
npm run dev            # Vite frontend
```

For PostgreSQL mode:

```ini
VITE_DATA_SOURCE=postgres
VITE_API_URL=http://127.0.0.1:3001/api/data
VITE_AUTH_URL=http://127.0.0.1:3001
```

The API server also needs PostgreSQL, Better Auth, SMTP, and FTP settings. See `.env.example`, [docs/POSTGRES_API.md](docs/POSTGRES_API.md), and [docs/FTP_ATTACHMENTS.md](docs/FTP_ATTACHMENTS.md).

## Validation

```powershell
npm run lint
npm run typecheck
npm run build
```

The frontend uses `HashRouter`, so it remains compatible with GitHub Pages. Set `VITE_BASE_PATH` to the repository path when deploying from a project subpath.

## Production deployment checklist

1. Back up the source Supabase data.
2. Freeze writes, run the final task/attachment delta migration, and verify row/file counts.
3. Set production `DATABASE_URL`, `BETTER_AUTH_SECRET`, `CORS_ORIGIN`, `PUBLIC_API_URL`, SMTP, and FTP variables on the API server.
4. Rotate the local test admin password and create the real admin account.
5. Test login, password reset, task CRUD, comments, reopen email, and attachment upload/preview/delete.

The frontend is static, but PostgreSQL, Better Auth, FTP, and SMTP credentials must stay on the API server. Use HTTPS and configure a reverse proxy or an allowed CORS origin for the frontend domain.

## Repository structure

```text
server/                 Express API, Better Auth, PostgreSQL, FTP, mailer
src/                    React frontend and PostgreSQL API client
scripts/                One-time migration and validation scripts
docs/                   PRD and deployment notes
```
