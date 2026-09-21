import type { TaskStatus } from '../types/task.types'

interface StatusBadgeProps {
  status: TaskStatus
}
export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    Open: 'bg-sky-50 text-sky-700 border-sky-200',
    Assign: 'bg-amber-50 text-amber-700 border-amber-200',
    Done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    QC: 'bg-violet-50 text-violet-700 border-violet-200',
    Reject: 'bg-red-50 text-red-700 border-red-200',
    Reopen: 'bg-orange-50 text-orange-700 border-orange-200',
    Hold: 'bg-slate-100 text-slate-600 border-slate-200',
    'In Progress': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium font-mono ${styles[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {status}
    </span>
  )
}
