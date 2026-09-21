# Sheets Sync — 1 arah Web → Sheets (FULL API tanpa Apps Script)

Status: **Frontend scaffold DONE & deployed** — Edge Function tinggal deploy + isi secret lalu live.

---

## Yang sudah Sawi kerjain (jalur A — tanpa butuh akses Google lu)

1. **Edge Function** `supabase/functions/sync-to-sheets/index.ts` — Deno:
   - JWT `RS256` pakai `GOOGLE_SERVICE_ACCOUNT_JSON` → `oauth2.googleapis.com/token` → `sheets.googleapis.com/v4`
   - `POST {action, taskId, row}` → handler `create` (append ke `TEAM ARI!A:M`, `L` formula `=IF(K...TODAY())`), `update` (find row by `Keterangan` tag `[TASK-...]` lalu `values.update`), `archive` (append `[ARCHIVED]` ke M)
   - Env: `SPREADSHEET_ID`, `SHEET_NAME` (default `TEAM ARI`), `GOOGLE_SERVICE_ACCOUNT_JSON`, optional `SHEETS_SYNC_TOKEN` (cek header `x-sheets-sync-token`)
   - CORS + idempotent via tag `[TASK-000123]` di kolom `Keterangan` (kol M)

2. **Frontend client** `src/lib/sheetSync.ts`:
   - `notifySheets(payload)` fire-and-forget → `POST <SUPABASE_URL>/functions/v1/sync-to-sheets` dengan `apikey` + `Authorization: Bearer <anon>`
   - Queue di `localStorage` (`sheets_sync_queue`, max 50) + retry tiap success + `flushSheetsQueue()` on app start
   - Env: `VITE_SHEETS_SYNC_URL` (custom override), `VITE_SHEETS_SYNC_TOKEN`, `VITE_SUPABASE_URL/ANON_KEY`

3. **Wiring** `src/services/taskService.ts`:
   - `createTask` → `notifySheets({action:'create', taskId, row:{consultant,type,client,screenReport,request,status,programmer,sqlServer,database,targetDate,notes}})` — best-effort, tidak nge-block insert
   - `updateTask` → `getTask(taskId)` merge lalu `notifySheets({action:'update',...})`
   - `archiveTask` → `notifySheets({action:'archive', taskId})`

4. **App** `src/App.tsx` → `flushSheetsQueue()` on mount

5. **Config** `supabase/config.toml` + `.env.example` (docs untuk `VITE_SHEETS_SYNC_*`)

6. **Build & deploy** → `main 5a02f7d` · `gh-pages bab5514` · `index-BR4ET2r4.js` — live di https://faisalFakhri.github.io/task-assignment-system/ — Varian C tetap, **belum nge-push ke Sheets** sampai Edge Function di-deploy (queue dulu).

---

## Yang perlu lu lakuin (jalur B — 5 menit, klik-per-klik)

> Buka di tab lain pakai `boy.fachruri@ifcagroup.com`

### B1. Bikin Service Account (kalau belum)
1. https://console.cloud.google.com/ → pilih / bikin Project `task-assignment-sync`
2. Enable: https://console.cloud.google.com/apis/library/sheets.googleapis.com → Enable
3. Enable: https://console.cloud.google.com/apis/library/drive.googleapis.com → Enable
4. https://console.cloud.google.com/iam-admin/serviceaccounts → `+ Create Service Account` → `task-sheets-sync` → Done (no role) → klik akun → `Keys` → `Add Key` → `Create new key` → `JSON` → download — catat `client_email` kayak `task-...@....iam.gserviceaccount.com`

### B2. Share Sheet
1. Buka https://docs.google.com/spreadsheets/d/1lULEI2kQTIKIgkVbGReRsBPDHxcn-GjYjLUKNSvotyI/edit
2. `Share` → paste `client_email` → `Editor` → **uncheck Notify** → `Share`
3. Kalau error `can't share outside org` → IT Workspace `ifcagroup.com` nge-block — minta whitelist `iam.gserviceaccount.com` atau kabarin Sawi (switch ke OAuth).

### B3. Deploy Edge Function — butuh Sawi / lu
Butuh `supabase` CLI login. Dari `E:/Project/Task-Assigment`:

```powershell
# login sekali (buka browser)
npx supabase login

# link project (project_id = ntbylafxutwemwmdputg)
npx supabase link --project-ref ntbylafxutwemwmdputg

# set secrets — paste 1 baris (JSON perlu di-escape / base64 tidak perlu)
# Opsi A: raw JSON string (paste langsung, wrap dengan ' ')
npx supabase secrets set --project-ref ntbylafxutwemwmdputg SPREADSHEET_ID=1lULEI2kQTIKIgkVbGReRsBPDHxcn-GjYjLUKNSvotyI SHEET_NAME="TEAM ARI" GOOGLE_SERVICE_ACCOUNT_JSON='<paste isi file json>'

# Optional shared secret (kalau mau kencengin)
# npx supabase secrets set --project-ref ntbylafxutwemwmdputg SHEETS_SYNC_TOKEN=isiRandomString

# deploy
npx supabase functions deploy sync-to-sheets --project-ref ntbylafxutwemwmdputg

# tes (pakai anon key dari .env.local)
curl -X POST "https://ntbylafxutwemwmdputg.supabase.co/functions/v1/sync-to-sheets" \
  -H "apikey: <VITE_SUPABASE_ANON_KEY>" -H "Authorization: Bearer <VITE_SUPABASE_ANON_KEY>" \
  -H "content-type: application/json" \
  -d '{"action":"create","taskId":"TASK-TEST","row":{"consultant":"Test Cons","type":"Bugs","client":"Test Client","screenReport":"Test Screen","request":"Test req","status":"Open","programmer":"","sqlServer":"","database":"","targetDate":"2026-09-03","notes":"hello from edge [TASK-TEST]"}}'
```

Cek Sheet → harus nambah 1 baris di `TEAM ARI` dengan `Keterangan` ada `[TASK-TEST]`.

### (Opsional) VITE env di frontend
- Default `VITE_SHEETS_SYNC_URL` kosong → pakai `<SUPABASE_URL>/functions/v1/sync-to-sheets` otomatis.
- Jika self-host lain, isi `VITE_SHEETS_SYNC_URL=https://.../sync-to-sheets`.
- Jika set `SHEETS_SYNC_TOKEN` di Edge, isi juga `VITE_SHEETS_SYNC_TOKEN=sama` di `.env.local` lalu rebuild.

---

## Flow akhir (1 arah)

```
User Save di Web (GitHub Pages)
  → taskService.createTask() → Supabase (tasks) — must succeed
  → notifySheets({action:'create', ...}) → Edge Function → Sheets API append → TEAM ARI +1 row
  └─ gagal? → queue localStorage → flush next open

User Edit Status di Web → notifySheets({action:'update', taskId, row}) → find row by [TASK-...] → values.update
User Archive → notifySheets({action:'archive'}) → M += [ARCHIVED]
```

Supabase = source of truth, Sheets = mirror. Gagal mirror tidak nge-block UI.
