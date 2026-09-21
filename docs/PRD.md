# Product Requirements Document (PRD)
## Internal Task & Assignment Management System

**Version:** 1.0  
**Status:** Draft / MVP  
**Primary user:** Internal team  
**Frontend hosting:** GitHub Pages  
**Database:** Google Sheets  
**Backend/API:** Google Apps Script  
**Development workflow:** OpenCode CLI + 9router  

---

## 1. Product Overview

Internal Task & Assignment Management System adalah aplikasi web untuk mencatat, mengelola, memonitor, dan menyimpan historical seluruh assignment pekerjaan.

Aplikasi akan menggantikan Google Spreadsheet sebagai interface utama, namun Google Sheets tetap digunakan sebagai database agar data tetap mudah diperiksa, diedit, dan dibackup secara manual.

Website harus memudahkan user untuk:

- Melihat task aktif.
- Membuat dan mengubah task.
- Assign task ke programmer.
- Memantau deadline dan overdue.
- Menyimpan historical task.
- Mencari pekerjaan lama.
- Menambahkan screenshot/gambar pendukung pada assignment.
- Melihat statistik pekerjaan.

---

## 2. Goals

1. Memusatkan seluruh assignment dalam satu aplikasi.
2. Menyimpan historical assignment jangka panjang.
3. Mempermudah monitoring berdasarkan consultant, programmer, client, status, dan deadline.
4. Mempermudah pencarian task lama.
5. Memberikan interface yang lebih nyaman daripada spreadsheet.
6. Memberikan visual deadline dan overdue yang jelas.
7. Mendukung multiple image attachment untuk task.
8. Menggunakan layanan gratis sebanyak mungkin.
9. Menjaga data tetap dapat diakses langsung melalui Google Sheets.

---

## 3. High-Level Architecture

```text
OpenCode CLI
    |
    v
9router -> AI model
    |
    v
Source Code
    |
    v
GitHub Repository
    |
    v
GitHub Pages
    |
    v
Frontend Web App
    |
    v
Google Apps Script API
    |
    +------> Google Sheets
    |
    +------> Google Drive (attachments)
```

### Responsibilities

- **OpenCode CLI**: development assistant untuk membangun dan mengubah source code.
- **9router**: model router untuk OpenCode.
- **GitHub**: source control.
- **GitHub Pages**: static frontend hosting.
- **Google Apps Script**: API/backend layer.
- **Google Sheets**: task database.
- **Google Drive**: file/image attachment storage.

---

## 4. Technology Stack

### Frontend

Recommended:

- React
- Vite
- TypeScript
- Tailwind CSS

### Backend

Google Apps Script sebagai API layer.

Frontend tidak boleh menyimpan credential Google atau credential sensitif lainnya.

### Database

Google Sheets.

### Attachment Storage

Google Drive.

Google Sheets hanya menyimpan metadata dan referensi file.

---

## 5. Existing Spreadsheet Mapping

Data existing menggunakan kolom:

| Existing Column | New Field |
|---|---|
| No | Legacy_No / optional |
| Consultant | Consultant |
| Bugs / Improvements | Type |
| Client | Client |
| Nama Screen / report | Screen_Report |
| Request | Request |
| Status | Status |
| Assign Programmer | Programmer |
| Sql Server | SQL_Server |
| Database | Database |
| Target | Target_Date |
| Sisa Hari | Calculated, not stored |
| Keterangan | Notes |

`Sisa Hari` dihitung otomatis oleh aplikasi berdasarkan `Target_Date`.

---

## 6. Data Model

### 6.1 TASKS

Sheet: `TASKS`

| Field | Description |
|---|---|
| ID | Unique task ID |
| Consultant | Consultant pemegang/requester assignment |
| Type | Bugs / Improvements |
| Client | Nama client |
| Screen_Report | Nama screen/report/program |
| Request | Detail requirement |
| Status | Status task |
| Programmer | Programmer assigned |
| SQL_Server | SQL server terkait |
| Database | Database terkait |
| Target_Date | Deadline |
| Notes | Catatan tambahan |
| Created_At | Timestamp dibuat |
| Updated_At | Timestamp terakhir diubah |
| Completed_At | Timestamp selesai |
| Archived | TRUE/FALSE |

Task ID format:

```text
TASK-000001
TASK-000002
...
```

---

### 6.2 TASK_HISTORY

Sheet: `TASK_HISTORY`

| Field | Description |
|---|---|
| ID | History ID |
| Task_ID | Related Task |
| Action | CREATE / UPDATE / COMPLETE / ARCHIVE |
| Field | Field yang berubah |
| Old_Value | Nilai sebelumnya |
| New_Value | Nilai baru |
| Timestamp | Waktu perubahan |

Example:

```text
TASK-000027
10:14 - Task created
10:20 - Programmer: empty -> Faisal
10:20 - Status: Open -> Assign
15:47 - Status: Assign -> Done
```

---

### 6.3 ATTACHMENTS

Sheet: `ATTACHMENTS`

| Field | Description |
|---|---|
| ID | Attachment ID |
| Task_ID | Related task |
| File_Name | Original filename |
| Drive_File_ID | Google Drive File ID |
| File_URL | File URL |
| Mime_Type | MIME type |
| Description | Optional description |
| Uploaded_At | Timestamp upload |

Relationship:

```text
TASKS 1 -> N ATTACHMENTS
```

Satu task dapat memiliki banyak gambar.

Use case:

- Screenshot bug.
- Screenshot expected result.
- Screenshot error.
- Mockup.
- Before/after.
- Visual explanation.

Supported MVP format:

- PNG
- JPG
- JPEG
- WEBP

Recommended max size:

`5 MB / image`

---

### 6.4 CONSULTANTS

Sheet: `CONSULTANTS`

| Field | Description |
|---|---|
| ID | Unique ID |
| Name | Consultant name |
| Active | TRUE/FALSE |

---

### 6.5 PROGRAMMERS

Sheet: `PROGRAMMERS`

| Field | Description |
|---|---|
| ID | Unique ID |
| Name | Programmer name |
| Active | TRUE/FALSE |

---

### 6.6 CLIENTS

Sheet: `CLIENTS`

| Field | Description |
|---|---|
| ID | Unique ID |
| Name | Client name |
| Active | TRUE/FALSE |

---

### 6.7 SETTINGS

Sheet: `SETTINGS`

Digunakan untuk configurable values seperti:

- Allowed task types.
- Allowed statuses.
- Deadline warning threshold.
- Attachment limit.
- App configuration.

---

## 7. Task Types

Initial types:

- Bugs
- Improvements

Type harus configurable dan tidak di-hardcode secara permanen pada UI.

---

## 8. Task Status

Initial statuses:

- Open
- Assign
- Done

### Meaning

**Open**  
Task belum atau baru masuk.

**Assign**  
Task sudah diberikan kepada programmer.

**Done**  
Task selesai.

Status divisualisasikan sebagai badge.

---

## 9. Deadline & Remaining Days

`Remaining Days` dihitung oleh frontend/backend:

```text
Target_Date - Current_Date
```

Categories:

- Safe
- Near Deadline
- Due Today
- Overdue
- No Target

Example:

```text
5 days
1 day
Today
-3 days
No Target
```

Task berstatus `Done` tidak dianggap overdue.

---

## 10. Dashboard

Dashboard menampilkan summary:

- Total Active Tasks
- Open
- Assigned
- Overdue
- Due Today
- Completed This Month

Sections:

### Current Tasks

Task aktif terbaru.

### Overdue Tasks

Task yang melewati deadline.

### Upcoming Deadline

Task dengan deadline terdekat.

### Recent Activity

Perubahan task terbaru.

---

## 11. Task List

Halaman `Tasks` menampilkan active tasks.

Default columns:

| Column |
|---|
| No |
| Consultant |
| Type |
| Client |
| Screen / Report |
| Status |
| Programmer |
| Target |
| Remaining Days |
| Action |

`Request` tidak harus ditampilkan penuh pada table karena dapat panjang.

Klik row membuka Task Detail.

Features:

- Search
- Sort
- Filter
- Pagination
- Sticky header
- Responsive columns

---

## 12. Filtering

Filters:

- Consultant
- Type
- Client
- Programmer
- Status
- Target Date
- Overdue
- Database
- SQL Server

Filter dapat dikombinasikan.

---

## 13. Search

Global search mencari:

- Task ID
- Client
- Screen / Report
- Request
- Consultant
- Programmer
- Database
- Notes

Search case-insensitive.

---

## 14. Create Task

Button:

`+ New Task`

### Required

- Consultant
- Type
- Client
- Screen / Report
- Request
- Status

### Optional

- Programmer
- SQL Server
- Database
- Target Date
- Notes
- Attachments

After submit:

1. Generate Task ID.
2. Set `Created_At`.
3. Set `Updated_At`.
4. Save task ke Google Sheets.
5. Create history entry.
6. Upload attachments jika ada.
7. Refresh UI.

---

## 15. Task Detail

Task detail menampilkan:

### Header

- Task ID
- Client
- Type
- Status

### Assignment Information

- Consultant
- Programmer
- Screen / Report
- Target Date
- Remaining Days

### Request

Full requirement text.

### Technical Information

- SQL Server
- Database

### Notes

Catatan tambahan.

### Attachments

Thumbnail gambar/file.

### Activity History

Timeline perubahan.

---

## 16. Image Viewer

Klik attachment membuka preview.

Viewer MVP:

- Full image preview.
- File name.
- Description.
- Previous image.
- Next image.
- Open original.
- Close.

---

## 17. Edit Task

Editable fields:

- Consultant
- Type
- Client
- Screen / Report
- Request
- Status
- Programmer
- SQL Server
- Database
- Target
- Notes

Setiap save memperbarui:

`Updated_At`

Perubahan penting dicatat ke `TASK_HISTORY`.

Jika status berubah ke `Done`, set:

`Completed_At`

---

## 18. Completed Tasks

Task `Done` tetap tersimpan.

Completed tasks dapat dicari berdasarkan:

- Client
- Programmer
- Consultant
- Screen/report
- Date
- Keyword

Completed history menjadi knowledge base pekerjaan lama.

---

## 19. Archive

Archive bukan delete.

Archived tasks:

- Tidak muncul di active list.
- Tetap searchable.
- Tetap menyimpan history.
- Tetap menyimpan attachments.

---

## 20. Delete Policy

Hard delete tidak menjadi fitur utama MVP.

Gunakan Archive.

Jika hard delete ditambahkan kemudian, harus memiliki explicit confirmation.

---

## 21. Google Apps Script API

Conceptual API:

```text
GET    tasks
GET    task/:id
POST   task
PUT    task/:id

GET    history/:taskId

POST   attachment
DELETE attachment/:id

GET    consultants
GET    programmers
GET    clients
```

Jika REST-style routing terlalu rumit di Apps Script, boleh menggunakan action-based endpoint, misalnya:

```text
?action=listTasks
?action=getTask&id=TASK-000001
?action=createTask
?action=updateTask
```

Response standard:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

---

## 22. Security

Frontend tidak boleh berisi:

- Google API credentials.
- Service account credentials.
- 9router credentials.
- AI provider API keys.
- Secret tokens.

Secrets tidak boleh di-commit ke GitHub.

Apps Script harus melakukan:

- Request validation.
- Input sanitization.
- Allowed file validation.
- Size validation untuk attachments.

---

## 23. UI Direction

Style:

- Modern internal productivity tool.
- Clean.
- Dense but readable.
- Fast.
- Minimal unnecessary animation.
- Deadline/status mudah terlihat.

Recommended sidebar:

```text
Dashboard

Tasks
  All Tasks
  Open
  Assigned
  Overdue

History
  Completed
  Archived

Master Data
  Clients
  Consultants
  Programmers

Settings
```

Desktop adalah primary target.

Mobile/tablet tetap usable.

---

## 24. Migration Existing Spreadsheet

Existing data akan dimigrasikan ke schema baru.

Migration process:

1. Backup spreadsheet existing.
2. Buat sheet schema baru.
3. Map existing columns.
4. Generate Task ID untuk historical rows.
5. Normalize status/type/programmer/client.
6. Convert dates.
7. Leave `Remaining Days` as calculated value.
8. Validate migrated row count.
9. Spot-check representative records.

Tidak perlu input ulang manual jika data existing dapat dimapping.

---

## 25. MVP Scope

MVP wajib memiliki:

- Dashboard.
- Task list.
- Create task.
- Edit task.
- Task detail.
- Search.
- Filters.
- Deadline calculation.
- Overdue indicator.
- Status management.
- Programmer assignment.
- Multiple image attachments.
- Image preview.
- Completed task history.
- Activity history.
- Archive.
- Google Sheets integration.
- Google Apps Script API.
- GitHub Pages deployment.
- Existing spreadsheet migration.

---

## 26. Out of Scope for MVP

Belum diperlukan:

- AI assistant dalam website.
- Chat.
- Push notification.
- Email notification.
- Complex permission/role system.
- Native mobile app.
- WebSocket/realtime system.
- Complex workflow automation.

---

## 27. Success Criteria

MVP berhasil jika user dapat:

1. Membuka website melalui GitHub Pages.
2. Melihat seluruh active task.
3. Membuat assignment.
4. Mengubah assignment.
5. Assign programmer.
6. Menentukan target date.
7. Melihat overdue otomatis.
8. Upload multiple screenshots ke task.
9. Preview screenshot dari Task Detail.
10. Menandai task Done.
11. Mencari task lama.
12. Melihat historical perubahan task.
13. Archive task.
14. Melihat underlying data di Google Sheets.
15. Menggunakan website tanpa exposed credential sensitif.

---

# 28. Development Phases

Development dilakukan per phase. Jangan implement semua fitur sekaligus.

## Phase 0 - Project Foundation

Goal: project siap dikembangkan secara konsisten.

Deliverables:

- Repository structure.
- React + Vite + TypeScript.
- Tailwind CSS.
- GitHub Pages configuration.
- Environment/config structure.
- Basic routing/layout.
- README.
- PRD disimpan di `docs/PRD.md`.
- Coding conventions.
- Mock data untuk development.

Acceptance criteria:

- `npm install` berhasil.
- `npm run dev` berhasil.
- `npm run build` berhasil.
- Basic app tampil.
- Build compatible dengan GitHub Pages.

---

## Phase 1 - UI Prototype with Mock Data

Goal: menyelesaikan user experience sebelum integrasi database.

Deliverables:

- Sidebar/navigation.
- Dashboard.
- Task table.
- Search UI.
- Filter UI.
- Status/type badges.
- Deadline indicators.
- Create Task form.
- Edit Task form.
- Task Detail.
- Attachment section menggunakan dummy image.
- Responsive basic layout.

Database belum digunakan.

Acceptance criteria:

- User dapat melihat seluruh flow dengan mock data.
- User dapat create/edit task di local state.
- Task Detail readable untuk request panjang.
- UI cocok digunakan sebagai pengganti spreadsheet.

---

## Phase 2 - Google Sheets Data Layer

Goal: mengganti mock data dengan data Google Sheets.

Deliverables:

- Google Sheets schema.
- Apps Script project.
- Task list API.
- Task detail API.
- Create task API.
- Update task API.
- Master data API.
- Frontend API service.
- Error/loading states.

Acceptance criteria:

- Website dapat membaca task dari Google Sheets.
- Create/Edit pada website mengubah Google Sheets.
- Tidak ada Google credential di frontend.

---

## Phase 3 - History & Deadline Logic

Goal: historical tracking berjalan.

Deliverables:

- `TASK_HISTORY`.
- Automatic history creation.
- Completed timestamp.
- Remaining days logic.
- Overdue logic.
- Completed page.
- Archive page.
- Recent Activity dashboard.

Acceptance criteria:

- Perubahan task mempunyai audit history.
- Task Done tetap searchable.
- Overdue dihitung otomatis.
- Archived task tidak muncul di active list.

---

## Phase 4 - Image Attachments

Goal: task dapat menyimpan visual explanation.

Deliverables:

- Google Drive attachment folder.
- Attachment upload API.
- Attachment metadata sheet.
- Multi-image upload.
- File validation.
- Thumbnail display.
- Image viewer.
- Delete attachment.

Acceptance criteria:

- Satu task dapat memiliki multiple images.
- File tersimpan di Drive.
- Metadata tersimpan di `ATTACHMENTS`.
- User dapat preview gambar dari Task Detail.

---

## Phase 5 - Migration Existing Data

Goal: historical spreadsheet masuk ke application database.

Deliverables:

- Migration script.
- Column mapping.
- Data normalization.
- Task ID generation.
- Date conversion.
- Migration validation report.

Acceptance criteria:

- Existing rows berhasil dimigrasi.
- Jumlah data sesuai.
- Sample records diverifikasi.
- Existing history tidak hilang.

---

## Phase 6 - Production Hardening & Deployment

Goal: aplikasi layak digunakan harian.

Deliverables:

- Validation.
- Error handling.
- Loading/empty states.
- Performance review.
- Mobile sanity check.
- Security review.
- GitHub Pages production deployment.
- Apps Script production deployment.
- Setup/deployment documentation.
- Backup instructions.

Acceptance criteria:

- Production URL dapat digunakan.
- CRUD stabil.
- No secrets exposed.
- Critical flows diuji.
- Dokumentasi setup tersedia.

---

## 29. Development Rules for OpenCode

PRD ini menjadi source of truth.

OpenCode harus:

1. Mengerjakan hanya phase yang sedang aktif.
2. Tidak melompati phase tanpa approval user.
3. Membaca `docs/PRD.md` sebelum implementasi.
4. Tidak menambahkan fitur besar di luar PRD tanpa approval.
5. Memisahkan UI, business logic, dan data access.
6. Menggunakan reusable components.
7. Tidak hardcode master data jika nantinya berasal dari Sheets.
8. Menjaga compatibility GitHub Pages.
9. Tidak menyimpan secret di repository.
10. Menjalankan build/test setelah perubahan penting.
11. Memperbarui dokumentasi jika architecture berubah.
12. Menjelaskan perubahan sebelum berpindah phase.

---

## 30. Reference Material

Simpan screenshot spreadsheet existing pada repository sebagai reference, misalnya:

```text
docs/
├── PRD.md
└── reference/
    └── current-task-spreadsheet.png
```

Screenshot reference hanya digunakan untuk memahami existing workflow dan UI/data structure. Spreadsheet tetap menjadi sumber data migration yang sebenarnya.
