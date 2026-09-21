export default function GuidePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="glass-strong rounded-2xl p-5 md:p-6">
        <h1 className="text-lg font-bold tracking-tight text-slate-800 font-mono">Panduan Penggunaan Task Assignment</h1>
        <p className="text-xs text-slate-400 font-mono mt-1">Untuk Konsultan — Simpel & Langsung Pakai</p>
      </div>

      {/* 1. Bikin Task Baru */}
      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 font-mono">➕ 1. Buat Task Baru</h2>
        <div className="mt-4 space-y-3 text-sm text-slate-600 font-mono">
          <div className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-bold">1</span>
            <div>
              <div className="font-semibold">Klik "New Task" di halaman Tasks</div>
              <div className="text-xs text-slate-500 mt-0.5">Atau tekan tombol + di pojok kanan atas</div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-bold">2</span>
            <div>
              <div className="font-semibold">Isi field wajib (berbintang):</div>
              <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-0.5">
                <li><b>Consultant</b> — pilih nama kamu</li>
                <li><b>Type</b> — Bugs atau Improvements</li>
                <li><b>Client</b> — pilih client</li>
                <li><b>Request</b> — tulis deskripsi tugas/masalah</li>
              </ul>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-bold">3</span>
            <div>
              <div className="font-semibold">Isi opsional (bisa dikosongin):</div>
              <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-0.5">
                <li>Screen/Report — nama layar atau laporan</li>
                <li>Assign Programmer — siapa yang kerjain</li>
                <li>SQL Server & Database — kalau perlu</li>
                <li><b>Target Date</b> — deadline (format: 03/09/2026)</li>
                <li>Keterangan — catatan tambahan</li>
              </ul>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-bold">4</span>
            <div>
              <div className="font-semibold">Klik "Save" — selesai!</div>
              <div className="text-xs text-slate-500 mt-0.5">Task langsung muncul di list. Data otomatis ke-sync ke Google Sheet TEAM ARI.</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Screenshot / Lampiran */}
      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 font-mono">📎 2. Tambah Screenshot / File</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-600 font-mono">
          <p><b>Cara paling cepat:</b> Screenshot (PrtSc / Win+Shift+S) → buka form New Task / Task Detail → tekan <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs border">Ctrl+V</kbd> → langsung masuk!</p>
          <p><b>Atau:</b> Klik "Choose images..." di form → pilih file (PNG/JPG/WebP, max 5MB per file)</p>
          <p className="text-xs text-amber-600">⚠ Di mode Edit nggak bisa paste. Buka Task Detail (klik baris task) baru paste/attach.</p>
        </div>
      </section>

      {/* 3. Ubah Status */}
      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 font-mono">🔄 3. Ubah Status Task</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-600 font-mono">
          <p>Klik baris task → klik "Edit" → ganti Status → Save.</p>
          <div className="flex flex-wrap gap-1.5">
            {['Open','Assign','In Progress','QC','Done','Hold','Reopen','Reject'].map(s => (
              <span key={s} className="inline-flex items-center glass-subtle rounded-full px-2 py-0.5 text-[11px] text-slate-500 border border-slate-200">{s}</span>
            ))}
          </div>
          <p className="text-xs text-slate-500">Semua perubahan status otomatis ke-history dan ke-sync ke Sheet.</p>
        </div>
      </section>

      {/* 4. Filter & Cari */}
      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 font-mono">🔍 4. Cari & Filter Task</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-600 font-mono">
          <ul className="space-y-1">
            <li>• <b>Search box:</b> ketik kata kunci (Request, Screen, Client, Programmer, dll)</li>
            <li>• <b>Filter Type:</b> Bugs / Improvements</li>
            <li>• <b>Filter Status:</b> 8 status di atas</li>
            <li>• <b>Filter Overdue:</b> cek "Overdue only" buat liat yang lewat deadline</li>
            <li>• <b>Sidebar kiri:</b> klik "QC", "Open", "Done", dll buat filter cepat per status</li>
          </ul>
        </div>
      </section>

      {/* 5. Deadline & Sisa Hari */}
      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 font-mono">⏰ 5. Deadline & Sisa Hari</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-600 font-mono">
          <p><b>Kolom "Sisa Hari" (L di Sheet) otomatis hitung:</b> Target Date − Hari Ini</p>
          <ul className="list-disc list-inside text-xs text-slate-500 space-y-0.5">
            <li><b className="text-red-600">Merah (minus):</b> LEWAT deadline &mdash; butuh perhatian!</li>
            <li><b className="text-amber-600">Kuning (0):</b> HARI INI deadline</li>
            <li><b className="text-emerald-600">Hijau (1-3):</b> Dekat deadline</li>
            <li><b className="text-slate-500">Abu {'>'}3:</b> Masih aman</li>
            <li><b>"No Target":</b> kalau Target Date kosong</li>
            <li><b>Kosong:</b> kalau status = Done</li>
          </ul>
          <p className="text-xs text-slate-500">Dashboard (halaman utama) nampilin ringkasan: Overdue, Due Today, Due in 3 Days.</p>
        </div>
      </section>

      {/* 6. Master Data (Client/Consultant/Programmer) */}
      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 font-mono">👥 6. Kelola Master Data</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-600 font-mono">
          <p>Menu: <b>Master Data → Clients / Consultants / Programmers</b></p>
          <ul className="list-disc list-inside text-xs text-slate-500 space-y-1">
            <li>Tambah baru: klik "+ Tambah [Nama]" (icon plus) → isi nama (+ email untuk Consultant/Programmer) → Save</li>
            <li>Edit: klik icon pensil di baris tabel</li>
            <li>Nonaktifkan: klik "Off" (icon pause) → jadi "Inactive" (nggak dihapus, cuma disembunyiin dari dropdown)</li>
            <li>Aktifkan lagi: klik "On" (icon play)</li>
          </ul>
          <p className="text-xs text-emerald-600">✓ Data baru LANGSUNG muncul di dropdown Task Form — nggak perlu refresh!</p>
        </div>
      </section>

      {/* 7. Export ke Excel */}
      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 font-mono">📊 7. Export ke Excel (Format TEAM ARI)</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-600 font-mono">
          <p>Di halaman Tasks, header kanan ada tombol:</p>
          <ul className="list-disc list-inside text-xs text-slate-500 space-y-1">
            <li><b>Export Filter (n):</b> export semua task yang ter-filter sekarang</li>
            <li><b>Export Pilihan (n):</b> centang checkbox di kiri baris → export yang dipilih aja</li>
          </ul>
          <p className="text-xs text-slate-500">File: <code>TEAM ARI - Export YYYY-MM-DD.xlsx</code> — format pas sama template Sheet.</p>
        </div>
      </section>

      {/* 8. Import dari Excel */}
      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 font-mono">📥 8. Import dari Excel (Migrasi Data Lama)</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-600 font-mono">
          <p>Menu: <b>Data → Import (TEAM ARI)</b></p>
          <ol className="list-decimal list-inside text-xs text-slate-500 space-y-1">
            <li>Pilih file .xlsx (format TEAM ARI)</li>
            <li>Sistem baca preview — hijau = valid, merah = error</li>
            <li>Cek error (mis: Consultant kosong, Type salah, Client kosong)</li>
            <li>Klik "Import Valid (n)" → tunggu progress bar selesai</li>
            <li>Selesai! Data masuk ke sistem & ke Sheet otomatis</li>
          </ol>
          <p className="text-xs text-amber-600">⚠ Import HANYA untuk migrasi awal. Buat task baru pakai "New Task" aja.</p>
        </div>
      </section>

      {/* 9. Trouble Shooting Singkat */}
      <section className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 font-mono">🛠 9. Kalau Ada Masalah</h2>
        <div className="mt-4 space-y-3 text-sm text-slate-600 font-mono">
          <div className="glass-subtle rounded-xl p-3 border border-slate-200">
            <div className="font-semibold text-slate-700">Task baru nggak muncul?</div>
            <div className="text-xs text-slate-500 mt-1">Data diperbarui otomatis tiap 15 detik dan saat tab aktif lagi. Kalau masih nggak: tekan <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs border">Ctrl+Shift+R</kbd></div>
          </div>
          <div className="glass-subtle rounded-xl p-3 border border-slate-200">
            <div className="font-semibold text-slate-700">Error "violates check constraint tasks_status_check"?</div>
            <div className="text-xs text-slate-500 mt-1">Minta ke admin jalanin SQL di Supabase (sekali aja). Status 8 opsi butuh update DB.</div>
          </div>
          <div className="glass-subtle rounded-xl p-3 border border-slate-200">
            <div className="font-semibold text-slate-700">Sync ke Sheet gagal / CORS error?</div>
            <div className="text-xs text-slate-500 mt-1">Data aman di Supabase. Queue otomatis dikirim ulang pas buka web lagi. Cek Console → Local Storage → <code>sheets_sync_queue</code></div>
          </div>
          <div className="glass-subtle rounded-xl p-3 border border-slate-200">
            <div className="font-semibold text-slate-700">Dropdown teks nyaru / Save nggak keliatan?</div>
            <div className="text-xs text-slate-500 mt-1">Sudah diperbaiki. Hard refresh <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs border">Ctrl+Shift+R</kbd></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="glass rounded-2xl p-4 text-center">
        <p className="text-xs font-mono text-slate-400">Butuh bantuan? Tanya ke Sawi / IT Support</p>
        <p className="text-[10px] font-mono text-slate-400 mt-1">Task Assignment System · GitHub Pages + Supabase · Sync ke Google Sheet TEAM ARI</p>
      </div>
    </div>
  )
}
