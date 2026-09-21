import type { Task } from '../types/task.types'
import { getDeadlineState, formatDeadlineText } from '../lib/dateUtils'

interface DeadlineIndicatorProps {
  task: Task
}
export default function DeadlineIndicator({ task }: DeadlineIndicatorProps) {
  const state = getDeadlineState(task)
  const styles = {
    Overdue: 'bg-red-50 text-red-700 border-red-200 font-semibold',
    'Due Today': 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
    'Near Deadline': 'bg-orange-50 text-orange-700 border-orange-200',
    Safe: 'bg-slate-50 text-slate-500 border-slate-200',
    'No Target': 'bg-slate-50/60 text-slate-400 border-slate-200 italic',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono ${styles[state]}`}>
      {formatDeadlineText(task)}
    </span>
  )
}
