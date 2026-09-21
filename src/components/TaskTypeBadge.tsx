import type { TaskType } from '../types/task.types'

interface TaskTypeBadgeProps {
  type: TaskType
}
export default function TaskTypeBadge({ type }: TaskTypeBadgeProps) {
  const styles = {
    Bugs: 'bg-rose-50 text-rose-600 border-rose-200',
    Improvements: 'bg-violet-50 text-violet-700 border-violet-200',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium font-mono ${styles[type]}`}>
      {type === 'Bugs' ? 'Bug' : 'Improvement'}
    </span>
  )
}
