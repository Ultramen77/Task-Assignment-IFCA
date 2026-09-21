# Task Assignment Management System

Internal web application for managing task assignments. Replaces a Google Sheets spreadsheet as the primary UI while keeping Sheets as the database.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend/API:** Google Apps Script Web App
- **Database:** Google Sheets
- **Hosting:** GitHub Pages

## Local Development

```bash
npm install
npm run dev
```

By default, the application runs in `mock` data mode using local fixture data in `src/data/mockData.ts`. No backend connection is required for local UI development.

## Build

```bash
npm run build
```

The production build outputs to `dist/`.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```

## GitHub Pages Deployment

Set the `VITE_BASE_PATH` environment variable to the repository base path before building:

```bash
# Example for a repo named "Task-Assigment"
VITE_BASE_PATH=/Task-Assigment/ npm run build
```

The app uses `HashRouter` so client-side routes work without server-side redirect configuration.

## Data Source Configuration (Phase 2B)

The frontend can operate in two modes controlled by environment variables (see `.env.example`):

```ini
VITE_DATA_SOURCE=mock        # mock | api (default: mock)
VITE_API_URL=                # Deployed Apps Script Web App URL
```

- `mock` mode: uses local fixture data. Safe for offline UI development.
- `api` mode: reads and writes through the Google Apps Script Web App API defined in `docs/DATA_API_CONTRACT.md`.

Create a local `.env.local` file (gitignored) to set your configuration without committing it.

```ini
# .env.local
VITE_DATA_SOURCE=api
VITE_API_URL=https://script.google.com/macros/s/YOUR_EXEC_ID/exec
```

## Backend / Apps Script Setup

The Apps Script backend source is source-controlled under `apps-script/`. This is the version that must be manually copied into the spreadsheet-bound Apps Script editor.

### 1. Google Spreadsheet Requirements

Create (or use the existing) spreadsheet named:

```
Task Assignment Database
```

It must contain exactly these sheets with exact header names in the first row:

| Sheet | Required Columns |
| --- | --- |
| `Tasks` | `task_id`, `consultant_id`, `type`, `client_id`, `screen_report`, `request`, `status`, `programmer_id`, `sql_server`, `database_name`, `target_date`, `notes`, `is_archived`, `created_at`, `updated_at` |
| `TaskHistory` | `history_id`, `task_id`, `action`, `field_name`, `old_value`, `new_value`, `changed_by`, `changed_at` |
| `Attachments` | `attachment_id`, `task_id`, `file_name`, `drive_file_id`, `drive_url`, `mime_type`, `description`, `uploaded_at` |
| `Clients` | `client_id`, `client_name`, `active` |
| `Consultants` | `consultant_id`, `consultant_name`, `active` |
| `Programmers` | `programmer_id`, `programmer_name`, `active` |
| `Settings` | `setting_key`, `setting_value`, `description` |

### 2. Sync Source to Apps Script

1. Open the `Task Assignment Database` spreadsheet in Google Sheets.
2. Go to **Extensions → Apps Script**.
3. Copy the contents of `apps-script/Code.gs` into the Apps Script editor (overwriting the default `Code.gs` file).
4. Save the project.

> Note: OpenCode cannot automatically deploy or sync files into the bound Apps Script project. This step must be performed manually in the Google UI.

### 3b. Phase 3 Behavior

The backend automatically writes audit history to the `TaskHistory` sheet on task create, field update (one row per changed field), and archive. A `listRecentHistory` action feeds the dashboard activity stream. History IDs use the same `LockService` sequence strategy as tasks. The fixed actor placeholder `SYSTEM` is used until authentication exists. The `Tasks` sheet schema is unchanged (no `completed_at` column); completion is derived from `status === "Done"`.

### 3. Deploy as Web App

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Choose type **Web app**.
3. Set **Execute as:** `Me`.
4. Set **Who has access:** `Anyone` (needed for public GitHub Pages frontend calls).
5. Click **Deploy** and copy the generated **Web App URL**.

### 4. Configure Frontend

Paste the copied Web App URL into your `.env.local` as `VITE_API_URL` and set `VITE_DATA_SOURCE=api`.

### 5. Attachment Image Serving (Phase 4B)

Attachment images are served through this same Web App (action `viewAttachment`), so the deployment settings above are also what allow anonymous `<img>` requests:

- **Execute as:** `Me` — required so the Web App can read the private Drive files with owner credentials.
- **Who has access:** `Anyone` — required so anonymous `<img>` GET requests can reach the endpoint.

The backend derives the Web App URL automatically via `ScriptApp.getService().getUrl()`. If it ever cannot (e.g. running outside the deployment context), set the script property `WEB_APP_URL` to the deployed URL as a fallback. No public Drive sharing of attachment files is used.

## Security Notes

- `VITE_*` variables are embedded in the public browser bundle. They must never contain secrets or credentials.
- The Apps Script Web App is publicly callable. Do not store private keys, service-account credentials, or 9router/OpenCode credentials in this codebase.
- Row positions are never used as task identifiers. All lookups use stable `task_id` values.

## Project Structure

```
apps-script/        # Backend source (copy into bound Apps Script project)
docs/               # PRD and API contract documentation
src/
├── components/     # Reusable UI components (badges, detail, form, viewer)
├── context/        # React data context bridging mock and API modes
├── layouts/        # Page layout shells
├── pages/          # Route-level page components
├── services/       # API client and task service layer
├── types/          # Shared TypeScript types
├── data/           # Local mock data fixtures (mock mode only)
├── lib/            # Date utilities and helpers
├── App.tsx         # Route definitions
├── main.tsx        # Entry point
└── index.css       # Tailwind import
```

See `docs/PRD.md` for full product requirements.
See `docs/DATA_API_CONTRACT.md` for the API contract.
