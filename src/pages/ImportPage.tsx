/* eslint-disable react/set-state-in-effect */
import { useState, useRef } from 'react'
import { useTasks } from '../context/TaskContext'
import { taskService } from '../services/taskService'
import { parseTeamAriFile, downloadTemplate, type ImportParseResult } from '../lib/excelTeamAri'
import type { TaskType, TaskStatus } from '../types/task.types'

export default function ImportPage() {
  const { refreshData } = useTasks()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string>('')
  const [result, setResult] = useState<ImportParseResult | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle'|'preview'|'importing'|'done'>('idle')
  const [progress, setProgress] = useState<{ done: number; total: number; failed: string[] } | null>(null)
  const [doneSummary, setDoneSummary] = useState<{ ok: number; fail: number; failRows: string[] } | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFileName(f.name)
    setParsing(true)
    setParseError(null)
    setResult(null)
    setPhase('idle')
    setDoneSummary(null)
    try {
      const parsed = await parseTeamAriFile(f)
      setResult(parsed)
      setPhase('preview')
    } catch (err: any) {
      setParseError(err.message || 'Gagal membaca file')
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    if (!result) return
    const validRows = result.rows.filter(r => r.isValid)
    if (!validRows.length) return
    setPhase('importing')
    setProgress({ done: 0, total: validRows.length, failed: [] })

    // prefetch masters to auto-create missing
    const [clients, consultants, programmers] = await Promise.all([
      taskService.listClients(),
      taskService.listConsultants(),
      taskService.listProgrammers(),
    ])
    const clientMap = new Map(clients.map(c => [c.name.toLowerCase(), c]))
    const consultantMap = new Map(consultants.map(c => [c.name.toLowerCase(), c]))
    const programmerMap = new Map(programmers.map(p => [p.name.toLowerCase(), p]))

    const ensureClient = async (name: string) => {
      const k = name.toLowerCase()
      if (clientMap.has(k)) return clientMap.get(k)!.id
      await taskService.createClient({ name })
      const fresh = await taskService.listClients()
      fresh.forEach(c => clientMap.set(c.name.toLowerCase(), c))
      return clientMap.get(k)!.id
    }
    const ensureConsultant = async (name: string) => {
      const k = name.toLowerCase()
      if (consultantMap.has(k)) return consultantMap.get(k)!.id
      await taskService.createConsultant({ name })
      const fresh = await taskService.listConsultants()
      fresh.forEach(c => consultantMap.set(c.name.toLowerCase(), c))
      return consultantMap.get(k)!.id
    }
    const ensureProgrammer = async (name: string) => {
      if (!name) return null
      const k = name.toLowerCase()
      if (programmerMap.has(k)) return programmerMap.get(k)!.id
      await taskService.createProgrammer({ name })
      const fresh = await taskService.listProgrammers()
      fresh.forEach(c => programmerMap.set(c.name.toLowerCase(), c))
      return programmerMap.get(k)!.id
    }

    let ok = 0
    const failRows: string[] = []
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i]
      try {
        const clientId = await ensureClient(r.client)
        const consultantId = await ensureConsultant(r.consultant)
        const programmerId = r.programmer ? await ensureProgrammer(r.programmer) : null
        await taskService.createTask({
          consultantId,
          clientId,
          type: r.type as TaskType,
          screenReport: r.screenReport,
          request: r.request,
          status: r.status as TaskStatus,
          programmerId,
          sqlServer: r.sqlServer,
          databaseName: r.database,
          targetDate: r.targetDate,
          notes: r.notes,
        })
        ok++
      } catch (err: any) {
        failRows.push(`R${r.rowNumber}: ${err.message || 'insert failed'}`)
      }
      setProgress({ done: i + 1, total: validRows.length, failed: [...failRows] })
    }

    await refreshData()
    setDoneSummary({ ok, fail: failRows.length, failRows })
    setPhase('done')
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="glass-strong rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-800 font-mono">IMPORT_TEAM_ARI</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Upload file `IFCA KM+.xlsx` sheet <b className="text-slate-600">TEAM ARI</b> — auto validasi + migrasi ke Supabase</p>
        </div>
        <button onClick={() => downloadTemplate()} className="rounded-full glass-subtle border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 shrink-0">Download Template</button>
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()} className="rounded-full bg-white text-slate-900 px-5 py-2 text-xs font-bold hover:bg-white/90">Choose Excel File</button>
          <span className="text-xs font-mono text-slate-400">{fileName || 'Belum ada file — pilih .xlsx TEAM ARI'}</span>
          {parsing && <span className="text-xs font-mono text-slate-500">Parsing...</span>}
        </div>
        {parseError && <div className="rounded-xl bg-red-500/15 border border-red-400/20 px-3 py-2 text-xs font-mono text-red-300">{parseError}</div>}
        <div className="text-[11px] font-mono text-slate-400 leading-relaxed">
          Kolom: A No | B Consultant* | C Bugs/Improvements* | D Client* | E Screen | F Request* | G Status | H Programmer | I Sql Server | J Database | K Target | L Sisa Hari (auto) | M Keterangan — baris A2 freeze, dropdown C/G/H, L = <code className="text-slate-400">IF(K="","No Target",IF(G="Done","",(K-TODAY())))</code> + merah jika &lt;0. Import lewati N-AD.
        </div>
      </div>

      {result && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white/[0.02]">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-500">Preview</span>
              <span className="text-emerald-300 font-semibold">{result.validCount} valid</span>
              {result.invalidCount > 0 && <span className="text-red-300 font-semibold">{result.invalidCount} invalid</span>}
              <span className="text-slate-400">{result.rows.length} baris (skip {result.emptySkipped} kosong)</span>
              {fileName && <span className="text-slate-800/20">· {fileName}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setResult(null); setPhase('idle'); setFileName('') }} className="rounded-full glass-subtle border border-slate-200 px-3 py-1 text-xs text-slate-500">Clear</button>
              <button
                onClick={handleImport}
                disabled={phase==='importing' || result.validCount===0}
                className="rounded-full bg-white text-slate-900 px-4 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-white/90"
              >
                {phase==='importing' ? `Importing ${progress?.done||0}/${progress?.total||0}...` : `Import ${result.validCount} Valid Rows`}
              </button>
            </div>
          </div>

          {phase==='importing' && progress && (
            <div className="px-4 py-3 space-y-2">
              <div className="h-2 rounded-full bg-slate-50 overflow-hidden">
                <div className="h-full bg-violet-500 transition-all" style={{ width: `${Math.round(progress.done/progress.total*100)}%` }} />
              </div>
              <div className="text-xs font-mono text-slate-500">{progress.done}/{progress.total} · {progress.failed.length ? <span className="text-red-300">{progress.failed.length} gagal</span> : <span className="text-emerald-300">sejauh ini OK</span>}</div>
            </div>
          )}

          {phase==='done' && doneSummary && (
            <div className={`mx-4 mt-3 rounded-xl px-3 py-2 text-xs font-mono border ${doneSummary.fail ? 'bg-amber-500/10 border-amber-400/20 text-amber-200' : 'bg-emerald-500/10 border-emerald-400/20 text-emerald-200'}`}>
              Import selesai: <b>{doneSummary.ok} berhasil</b>{doneSummary.fail ? `, ${doneSummary.fail} gagal` : ''} — refresh otomatis sudah jalan.
              {doneSummary.failRows.length>0 && <div className="mt-1 text-[11px] opacity-80 break-all">{doneSummary.failRows.slice(0,5).join(' · ')}{doneSummary.failRows.length>5?' …':''}</div>}
            </div>
          )}

          <div className="overflow-auto max-h-[52vh]">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">R</th>
                  <th className="px-2 py-2 text-left">Consultant</th>
                  <th className="px-2 py-2 text-left">Type</th>
                  <th className="px-2 py-2 text-left">Client</th>
                  <th className="px-2 py-2 text-left">Screen</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Programmer</th>
                  <th className="px-2 py-2 text-left">Target</th>
                  <th className="px-2 py-2 text-left">Valid</th>
                  <th className="px-2 py-2 text-left">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {result.rows.slice(0, 300).map((r, idx) => (
                  <tr key={idx} className={r.isValid ? 'bg-white/[0.01]' : 'bg-red-500/10'}>
                    <td className="px-2 py-1.5 font-mono text-slate-500">{idx+1}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-400">{r.rowNumber}</td>
                    <td className="px-2 py-1.5 text-slate-700 truncate max-w-[110px]">{r.consultant}</td>
                    <td className="px-2 py-1.5 text-slate-500">{r.type}</td>
                    <td className="px-2 py-1.5 text-slate-600 truncate max-w-[160px]">{r.client}</td>
                    <td className="px-2 py-1.5 text-slate-500 truncate max-w-[160px]">{r.screenReport}</td>
                    <td className="px-2 py-1.5">{r.status}</td>
                    <td className="px-2 py-1.5 text-slate-500">{r.programmer || '—'}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-400">{r.targetDate || (r.rawTarget ? String(r.rawTarget).slice(0,10) : '—')}</td>
                    <td className="px-2 py-1.5">{r.isValid ? <span className="rounded-full bg-emerald-500/15 border border-emerald-400/20 px-2 py-0.5 text-[10px] text-emerald-300">valid</span> : <span className="rounded-full bg-red-500/15 border border-red-400/20 px-2 py-0.5 text-[10px] text-red-300">invalid</span>}</td>
                    <td className="px-2 py-1.5 text-[11px] leading-tight">
                      {r.errors.length ? <div className="text-red-300">{r.errors.join(' · ')}</div> : <span className="text-slate-800/20">—</span>}
                      {r.warnings.length ? <div className="text-amber-300/80 mt-0.5">{r.warnings.join(' · ')}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.rows.length>300 && <div className="px-3 py-2 text-xs font-mono text-slate-400">Showing 300 of {result.rows.length} — import tetap memproses semua {result.validCount} valid.</div>}
          </div>
        </div>
      )}

      <div className="glass-subtle rounded-2xl px-4 py-3 text-[11px] font-mono text-slate-400">
        Tips: edit file di Excel — status bebas pakai <code className="text-slate-400">QC/Open/Done/Reject/Reopen/Hold/Assign/In Progress</code>, tanggal <code className="text-slate-400">dd/mm/yyyy</code> (template juga auto-format). Sisa Hari & No auto-formula — tidak perlu diisi. Programmer kosong = Unassigned. Master Consultant/Client/Programmer yang belum ada akan dibuat otomatis saat import.
      </div>
    </div>
  )
}
