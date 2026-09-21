import type { Task, TaskHistory, Attachment, Consultant, Programmer, Client, TaskComment } from '../types/task.types'

export const mockConsultants: Consultant[] = [
  { id: 'CON-1', name: 'Andi', email: 'andi@company.com', active: true },
  { id: 'CON-2', name: 'Budi', email: 'budi@company.com', active: true },
  { id: 'CON-3', name: 'Citra', email: 'citra@company.com', active: true },
  { id: 'CON-4', name: 'Dewi', email: 'dewi@company.com', active: false },
]

export const mockProgrammers: Programmer[] = [
  { id: 'PROG-1', name: 'Faisal', email: 'faisal@company.com', active: true },
  { id: 'PROG-2', name: 'Gunawan', email: 'gunawan@company.com', active: true },
  { id: 'PROG-3', name: 'Hendra', email: 'hendra@company.com', active: true },
  { id: 'PROG-4', name: 'Irwan', email: 'irwan@company.com', active: false },
]

export const mockClients: Client[] = [
  { id: 'CLI-1', name: 'Pabrik Kertas A', active: true },
  { id: 'CLI-2', name: 'Distributor Sembako B', active: true },
  { id: 'CLI-3', name: 'Toko Ritel C', active: true },
  { id: 'CLI-4', name: 'Logistik D', active: true },
]

// Target dates relative to today (Wed Aug 19 2026)
// Overdue (older than 2026-08-19)
// Due today (2026-08-19)
// Near deadline (next 2-3 days: 2026-08-20, 2026-08-21)
// Safe (far future or none)
export const mockTasks: Task[] = [
  {
    id: 'TASK-000001',
    consultant: 'Andi',
    type: 'Bugs',
    client: 'Pabrik Kertas A',
    screenReport: 'Sales Order Entry',
    request: 'Error runtime saat menekan tombol Save di modul Sales Order Entry. SQL Server connection timeout. Mohon dicek index table.',
    status: 'Assign',
    programmer: 'Faisal',
    sqlServer: 'SRV-SAP-DB01',
    database: 'DB_SALES_PROD',
    targetDate: '2026-08-15', // Overdue
    notes: 'Klien butuh cepat karena order terhambat.',
    createdAt: '2026-08-10T08:00:00Z',
    updatedAt: '2026-08-12T10:20:00Z',
    completedAt: null,
    archived: false,
  },
  {
    id: 'TASK-000002',
    consultant: 'Budi',
    type: 'Improvements',
    client: 'Distributor Sembako B',
    screenReport: 'Delivery Order Report',
    request: 'Tambahkan kolom no kendaraan pada Delivery Order Report dan filter berdasarkan driver.',
    status: 'Assign',
    programmer: 'Gunawan',
    sqlServer: 'SRV-LOCAL-01',
    database: 'DB_SEMBAKO_REPORTS',
    targetDate: '2026-08-19', // Due Today
    notes: 'Sudah dikoordinasikan dengan driver senior.',
    createdAt: '2026-08-12T09:30:00Z',
    updatedAt: '2026-08-12T09:30:00Z',
    completedAt: null,
    archived: false,
  },
  {
    id: 'TASK-000003',
    consultant: 'Citra',
    type: 'Bugs',
    client: 'Toko Ritel C',
    screenReport: 'POS Cashier Screen',
    request: 'Struk print tidak memotong kertas otomatis. Pengaturan laci kasir juga tidak terbuka otomatis saat checkout tunai.',
    status: 'Open',
    programmer: '',
    sqlServer: 'SRV-RETAIL-POS',
    database: 'DB_POS_CASH',
    targetDate: '2026-08-21', // Near Deadline (2 days remaining)
    notes: 'Mungkin isu driver printer Epson.',
    createdAt: '2026-08-18T14:00:00Z',
    updatedAt: '2026-08-18T14:00:00Z',
    completedAt: null,
    archived: false,
  },
  {
    id: 'TASK-000004',
    consultant: 'Andi',
    type: 'Improvements',
    client: 'Logistik D',
    screenReport: 'Driver Mobile API',
    request: 'Buat API endpoint baru untuk update GPS coordinate driver secara async (setiap 5 menit). Optimalkan payload ukuran agar minimal.',
    status: 'Done',
    programmer: 'Hendra',
    sqlServer: 'SRV-LOGISTICS-APP',
    database: 'DB_LOGISTICS',
    targetDate: '2026-08-18', // Completed on time
    notes: 'Sudah dideploy ke sandbox.',
    createdAt: '2026-08-14T11:00:00Z',
    updatedAt: '2026-08-18T16:00:00Z',
    completedAt: '2026-08-18T16:00:00Z',
    archived: false,
  },
  {
    id: 'TASK-000005',
    consultant: 'Citra',
    type: 'Bugs',
    client: 'Pabrik Kertas A',
    screenReport: 'Inventory Stock Sheet',
    request: 'Perhitungan sisa stok bahan baku pulp tidak cocok di akhir bulan. Ada deviasi input dari waste warehouse.',
    status: 'Open',
    programmer: '',
    sqlServer: 'SRV-SAP-DB01',
    database: 'DB_SAP_INV',
    targetDate: null, // No target
    notes: 'Investigasi awal membutuhkan dump log 3 bulan terakhir.',
    createdAt: '2026-08-19T06:00:00Z',
    updatedAt: '2026-08-19T06:00:00Z',
    completedAt: null,
    archived: false,
  },
  {
    id: 'TASK-000006',
    consultant: 'Budi',
    type: 'Improvements',
    client: 'Toko Ritel C',
    screenReport: 'Customer Loyalty Module',
    request: 'Sistem point reward baru berdasarkan total belanja. Member gold dapat 2x point, silver 1.5x.',
    status: 'Done',
    programmer: 'Faisal',
    sqlServer: 'SRV-RETAIL-POS',
    database: 'DB_RETAIL_CRM',
    targetDate: '2026-08-10', // Completed earlier
    notes: 'Klien sangat senang dengan hasilnya.',
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-09T17:00:00Z',
    completedAt: '2026-08-09T17:00:00Z',
    archived: false,
  },
  {
    id: 'TASK-000007',
    consultant: 'Citra',
    type: 'Bugs',
    client: 'Logistik D',
    screenReport: 'Manifest Export',
    request: 'Export manifest ke PDF blank page untuk data di atas 100 row. Kemungkinan memory limit di pdf generator library.',
    status: 'Assign',
    programmer: 'Hendra',
    sqlServer: 'SRV-LOGISTICS-APP',
    database: 'DB_LOGISTICS',
    targetDate: '2026-08-28', // Safe (future deadline)
    notes: 'Perlu coba streaming PDF generator.',
    createdAt: '2026-08-18T10:00:00Z',
    updatedAt: '2026-08-18T10:15:00Z',
    completedAt: null,
    archived: false,
  },
  {
    id: 'TASK-000008',
    consultant: 'Andi',
    type: 'Bugs',
    client: 'Distributor Sembako B',
    screenReport: 'Invoice Printing',
    request: 'Spasi footer terlalu renggang sehingga cetakan meluber ke halaman 2. Rapatkan jarak antara subtotal dan ttd.',
    status: 'Assign',
    programmer: 'Gunawan',
    sqlServer: 'SRV-LOCAL-01',
    database: 'DB_SEMBAKO_PROD',
    targetDate: '2026-08-14', // Overdue (Assigned and not Done)
    notes: 'Gunakan template cetakan ringkas.',
    createdAt: '2026-08-05T09:00:00Z',
    updatedAt: '2026-08-05T09:10:00Z',
    completedAt: null,
    archived: true, // Archived
  },
]

export const mockAttachments: Attachment[] = [
  {
    id: 'ATT-001',
    taskId: 'TASK-000001',
    fileName: 'timeout-error-stack.png',
    driveFileId: 'drive-file-111',
    fileUrl: 'https://placehold.co/600x400/ececec/333333?text=Timeout+Error+Stacktrace',
    mimeType: 'image/png',
    description: 'Screenshot stacktrace error saat save Sales Order.',
    uploadedAt: '2026-08-10T08:05:00Z',
  },
  {
    id: 'ATT-002',
    taskId: 'TASK-000001',
    fileName: 'sales-order-layout.png',
    driveFileId: 'drive-file-222',
    fileUrl: 'https://placehold.co/600x400/ececec/333333?text=Sales+Order+Layout',
    mimeType: 'image/png',
    description: 'Layout screen tempat error terjadi.',
    uploadedAt: '2026-08-10T08:06:00Z',
  },
  {
    id: 'ATT-003',
    taskId: 'TASK-000003',
    fileName: 'pos-receipt-problem.jpg',
    driveFileId: 'drive-file-333',
    fileUrl: 'https://placehold.co/600x400/ececec/333333?text=POS+Receipt+Paper+Cut',
    mimeType: 'image/jpeg',
    description: 'Foto struk printer Epson yang terpotong salah.',
    uploadedAt: '2026-08-18T14:10:00Z',
  },
]

export const mockHistory: TaskHistory[] = [
  {
    id: 'HIST-001',
    taskId: 'TASK-000001',
    action: 'CREATE',
    field: null,
    oldValue: null,
    newValue: null,
    timestamp: '2026-08-10 08:00:00',
  },
  {
    id: 'HIST-002',
    taskId: 'TASK-000001',
    action: 'UPDATE',
    field: 'Programmer',
    oldValue: 'empty',
    newValue: 'Faisal',
    timestamp: '2026-08-12 10:20:00',
  },
  {
    id: 'HIST-003',
    taskId: 'TASK-000001',
    action: 'UPDATE',
    field: 'Status',
    oldValue: 'Open',
    newValue: 'Assign',
    timestamp: '2026-08-12 10:20:00',
  },
  {
    id: 'HIST-004',
    taskId: 'TASK-000002',
    action: 'CREATE',
    field: null,
    oldValue: null,
    newValue: null,
    timestamp: '2026-08-12 09:30:00',
  },
  {
    id: 'HIST-005',
    taskId: 'TASK-000003',
    action: 'CREATE',
    field: null,
    oldValue: null,
    newValue: null,
    timestamp: '2026-08-18 14:00:00',
  },
  {
    id: 'HIST-006',
    taskId: 'TASK-000004',
    action: 'CREATE',
    field: null,
    oldValue: null,
    newValue: null,
    timestamp: '2026-08-14 11:00:00',
  },
  {
    id: 'HIST-007',
    taskId: 'TASK-000004',
    action: 'COMPLETE',
    field: 'Status',
    oldValue: 'Assign',
    newValue: 'Done',
    timestamp: '2026-08-18 16:00:00',
  },
]

export const mockComments: TaskComment[] = [
  {
    id: 'CMT-001', taskId: 'TASK-000001', authorType: 'Consultant', authorId: 'CON-1', authorName: 'Andi',
    body: 'Mohon dicek juga kemungkinan timeout dari koneksi VPN client.', createdAt: '2026-08-12T11:00:00Z',
  },
  {
    id: 'CMT-002', taskId: 'TASK-000001', authorType: 'Programmer', authorId: 'PROG-1', authorName: 'Faisal',
    body: 'Siap, saya cek dari sisi query dan koneksi. Update lagi setelah ada hasil.', createdAt: '2026-08-12T11:18:00Z',
  },
]
