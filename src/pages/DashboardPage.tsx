/* eslint-disable react/set-state-in-effect */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTasks } from '../context/TaskContext'
import type { TaskHistory, TaskStatus } from '../types/task.types'
import { getRemainingDays, TODAY_STR } from '../lib/dateUtils'
import StatusBadge from '../components/StatusBadge'
import TaskTypeBadge from '../components/TaskTypeBadge'
import DeadlineIndicator from '../components/DeadlineIndicator'
import { fieldLabel, resolveDisplayValue } from '../lib/historyDisplay'

type FilterMode = 'created' | 'target'

const ALL_STATUSES: TaskStatus[] = ['Open', 'Assign', 'In Progress', 'QC', 'Hold', 'Reopen', 'Reject', 'Done']

const STATUS_CONFIG: Record<TaskStatus, { tint: string; accent: string; dot: string }> = {
  Open:        { tint: 'glass-tint-open',     accent: 'from-sky-400 to-blue-500',     dot: 'bg-sky-400' },
  Assign:      { tint: 'glass-tint-assign',   accent: 'from-amber-400 to-orange-400', dot: 'bg-amber-400' },
  'In Progress': { tint: 'glass-tint-progress', accent: 'from-cyan-400 to-sky-500',    dot: 'bg-cyan-400' },
  QC:          { tint: 'glass-tint-qc',       accent: 'from-violet-400 to-fuchsia-400', dot: 'bg-violet-400' },
  Hold:        { tint: 'glass-tint-hold',     accent: 'from-slate-400 to-slate-500',  dot: 'bg-slate-400' },
  Reopen:      { tint: 'glass-tint-reopen',   accent: 'from-orange-400 to-amber-400', dot: 'bg-orange-400' },
  Reject:      { tint: 'glass-tint-reject',   accent: 'from-red-400 to-rose-400',     dot: 'bg-red-400' },
  Done:        { tint: 'glass-tint-done',     accent: 'from-emerald-400 to-teal-400', dot: 'bg-emerald-400' },
}

export default function DashboardPage() {
  const { tasks, consultants, clients, programmers, loading, error } = useTasks()
  const [recentActivity] = useState<TaskHistory[]>([])
  const [loadingActivity] = useState(true)
  const [activityError] = useState<string | null>(null)
  const masters = useMemo(() => ({ consultants, clients, programmers }), [consultants, clients, programmers])
  const activeTasksList = useMemo(() => tasks.filter(t => !t.archived), [tasks])
  // Tanpa filter tanggal, gunakan semua tugas aktif
  const filteredByDate = activeTasksList
  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {}
    ALL_STATUSES.forEach(s => { byStatus[s] = filteredByDate.filter(t => t.status === s).length })
    const total = filteredByDate.length
    const overdue = filteredByDate.filter(t => { if (t.status === 'Done' || !t.targetDate) return false; const r = getRemainingDays(t.targetDate); return r !== null && r < 0 }).length
    const dueToday = filteredByDate.filter(t => { if (t.status === 'Done' || !t.targetDate) return false; return getRemainingDays(t.targetDate) === 0 }).length
    const dueSoon = filteredByDate.filter(t => { if (t.status === 'Done' || !t.targetDate) return false; const r = getRemainingDays(t.targetDate); return r !== null && r >= 1 && r <= 3 }).length
    return { total, byStatus, overdue, dueToday, dueSoon }
  }, [filteredByDate])
  const overdueTasks = useMemo(() => filteredByDate.filter(t => { if (t.status === 'Done' || !t.targetDate) return false; const r = getRemainingDays(t.targetDate); return r !== null && r < 0 }).slice(0, 5), [filteredByDate])
  const upcomingDeadlines = useMemo(() => filteredByDate.filter(t => { if (t.status === 'Done' || !t.targetDate) return false; const r = getRemainingDays(t.targetDate); return r !== null && r >= 0 && r <= 3 }).sort((a,b) => (getRemainingDays(a.targetDate) ?? 999) - (getRemainingDays(b.targetDate) ?? 999)).slice(0, 5), [filteredByDate])
  const currentTasks = useMemo(() => filteredByDate.filter(t => t.status !== 'Done').slice(0, 5), [filteredByDate])

  return (
    <div className="space-y-4">
      {error && (
        <div className="glass rounded-2xl border-red-300 bg-red-50 p-3 text-xs font-mono text-red-600 flex justify-between items-center">
          <span>Error: {error}</span>
          <button onClick={() => window.location.reload()} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">[Retry]</button>
        </div>
      )}
      {loading ? (
        <div role="status" aria-label="Loading dashboard" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl p-4 space-y-3">
                <div className="skeleton h-2.5 w-14" />
                <div className="skeleton h-6 w-10" />
                <div className="skeleton h-3 w-16" />
                <div className="skeleton h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl p-3.5 flex items-center justify-between">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-6 w-8" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="glass-strong rounded-2xl px-5 py-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-800">Dashboard</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Overview relative to {TODAY_STR} · Supabase · {activeTasksList.length} active tasks
                
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-2 glass-subtle rounded-full px-3 py-1 text-[11px] font-mono text-slate-500">soft pastel · light</span>
          </div>


          {/* Per-status cards: Total + 8 statuses */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
            <Link to="/tasks?filter=all" className="glass glass-tint-total rounded-2xl p-4 relative overflow-hidden hover:scale-[1.015] transition-transform">
              <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl opacity-20 bg-gradient-to-br from-violet-400 to-cyan-400" />
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono">Total</span>
              </div>
              <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-800">{stats.total}</div>
              <div className="text-[11px] font-mono text-slate-400 truncate">active</div>
              <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400" style={{ width: `${Math.min(100, Math.max(12, stats.total * 4))}%` }} /></div>
            </Link>
            {ALL_STATUSES.map(s => {
              const cfg = STATUS_CONFIG[s]
              const v = stats.byStatus[s] ?? 0
              return (
                <Link key={s} to={`/tasks?status=${encodeURIComponent(s)}`} className={`glass ${cfg.tint} rounded-2xl p-4 relative overflow-hidden hover:scale-[1.015] transition-transform`}>
                  <div className={`absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl opacity-20 bg-gradient-to-br ${cfg.accent}`} />
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase font-mono truncate">{s}</span>
                  </div>
                  <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-800">{v}</div>
                  <div className="text-[11px] font-mono text-slate-400 truncate">{v === 0 ? '—' : v === 1 ? '1 task' : `${v} tasks`}</div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full bg-gradient-to-r ${cfg.accent}`} style={{ width: `${v === 0 ? 8 : Math.min(100, Math.max(14, v * 12))}%` }} /></div>
                </Link>
              )
            })}
          </div>

          {/* Alert row: Overdue / Due Today / Due Soon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="glass glass-tint-overdue rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Overdue</div>
                <div className="text-lg font-semibold font-mono text-slate-800">{stats.overdue}</div>
              </div>
              <span className={`text-[11px] font-mono px-2.5 py-1 rounded-full border ${stats.overdue > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>{stats.overdue > 0 ? 'needs attention' : 'all clear'}</span>
            </div>
            <div className="glass glass-tint-assign rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Due Today</div>
                <div className="text-lg font-semibold font-mono text-slate-800">{stats.dueToday}</div>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full glass-subtle border border-slate-200 text-slate-500">{stats.dueToday > 0 ? 'due today' : '—'}</span>
            </div>
            <div className="glass glass-tint-progress rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Due in 3 Days</div>
                <div className="text-lg font-semibold font-mono text-slate-800">{stats.dueSoon}</div>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full glass-subtle border border-slate-200 text-slate-500">{stats.dueSoon > 0 ? 'upcoming' : '—'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider font-mono">Overdue ({stats.overdue})</span>
                <Link to="/tasks?filter=overdue" className="text-[10px] text-slate-400 font-mono hover:text-slate-600">[View All]</Link>
              </div>
              {overdueTasks.length === 0 ? <div className="text-xs text-slate-400 font-mono italic py-2">No overdue tasks.</div> : (
                <div className="divide-y divide-slate-100">
                  {overdueTasks.map(task => (
                    <div key={task.id} className="py-2.5 space-y-1 font-mono text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <Link to={`/tasks?id=${task.id}`} className="font-semibold text-slate-800 hover:text-violet-600">{task.id}</Link>
                        <DeadlineIndicator task={task} />
                      </div>
                      <div className="text-slate-400 truncate text-[11px]">{task.client} // {task.screenReport}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider font-mono">Upcoming Deadlines</span>
                <Link to="/tasks?filter=assigned" className="text-[10px] text-slate-400 font-mono hover:text-slate-600">[View All]</Link>
              </div>
              {upcomingDeadlines.length === 0 ? <div className="text-xs text-slate-400 font-mono italic py-2">No tasks due in 3 days.</div> : (
                <div className="divide-y divide-slate-100">
                  {upcomingDeadlines.map(task => (
                    <div key={task.id} className="py-2.5 space-y-1 font-mono text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <Link to={`/tasks?id=${task.id}`} className="font-semibold text-slate-800 hover:text-violet-600">{task.id}</Link>
                        <DeadlineIndicator task={task} />
                      </div>
                      <div className="text-slate-400 truncate text-[11px]">{task.client} // {task.screenReport}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">Active Assignments</span>
                <Link to="/tasks?filter=all" className="text-[10px] text-slate-400 font-mono hover:text-slate-600">[View All]</Link>
              </div>
              {currentTasks.length === 0 ? <div className="text-xs text-slate-400 font-mono italic py-2">No active assignments.</div> : (
                <div className="divide-y divide-slate-100">
                  {currentTasks.map(task => (
                    <div key={task.id} className="py-2.5 space-y-1 font-mono text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <Link to={`/tasks?id=${task.id}`} className="font-semibold text-slate-800 hover:text-violet-600">{task.id}</Link>
                        <div className="flex gap-1.5 shrink-0"><StatusBadge status={task.status} /><TaskTypeBadge type={task.type} /></div>
                      </div>
                      <div className="text-slate-400 truncate text-[11px]">{task.client} // {task.screenReport}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <h3 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Recent Activity · task_history</h3>
            <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 divide-y divide-slate-100">
              {loadingActivity ? <div className="p-4 text-slate-400 font-mono italic text-center text-xs">Loading activity...</div>
              : activityError ? <div className="p-4 text-red-500 font-mono italic text-center text-xs">Failed to load activity.</div>
              : recentActivity.length === 0 ? <div className="p-4 text-slate-400 font-mono italic text-center text-xs">No recent activity.</div>
              : recentActivity.map((log) => (
                  <div key={log.id} className="p-3 flex flex-col sm:flex-row sm:justify-between gap-2 hover:bg-slate-50">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <Link to={`/tasks?id=${log.taskId}`} className="font-semibold font-mono text-slate-800 hover:text-violet-600">{log.taskId}</Link>
                      <span className="text-slate-300 font-mono">|</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold font-mono border ${log.action === 'CREATE' ? 'bg-sky-50 text-sky-600 border-sky-200' : log.action === 'COMPLETE' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : log.action === 'ARCHIVE' ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>{log.action}</span>
                      <span className="text-slate-500">
                        {log.action === 'CREATE' && 'Task created'}
                        {log.action === 'COMPLETE' && 'Task marked Done'}
                        {log.action === 'ARCHIVE' && 'Task archived'}
                        {log.action === 'UPDATE' && <span>Changed <span className="font-semibold text-slate-800">{fieldLabel(log.field)}</span>: <span className="text-slate-400 line-through">{resolveDisplayValue(log.field, log.oldValue, masters)}</span> → <span className="text-slate-800">{resolveDisplayValue(log.field, log.newValue, masters)}</span></span>}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[10px] font-mono whitespace-nowrap self-start sm:self-center">{log.timestamp}</div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
