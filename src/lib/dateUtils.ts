import type { Task } from '../types/task.types'

// Centralized definition of the system "today"
// In API mode we use the actual current date; in mock mode we keep a fixed
// baseline so the UI/prototype behavior is deterministic.
export const MOCK_TODAY_STR = '2026-08-19'
export const USE_REAL_TODAY = import.meta.env.VITE_DATA_SOURCE === 'supabase' || import.meta.env.VITE_DATA_SOURCE === 'api'

export function getCurrentDate(): Date {
  if (USE_REAL_TODAY) {
    return new Date()
  }
  return new Date(MOCK_TODAY_STR)
}

export function getCurrentDateString(): string {
  if (USE_REAL_TODAY) {
    const d = new Date()
    return d.toISOString().split('T')[0]
  }
  return MOCK_TODAY_STR
}

export const TODAY_STR = getCurrentDateString()

export function getRemainingDays(targetDate: string | null): number | null {
  if (!targetDate) return null
  const target = new Date(targetDate)
  const today = getCurrentDate()
  
  // reset hours to calculate correct difference in full days
  target.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  
  const diffTime = target.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export type DeadlineState = 'Safe' | 'Near Deadline' | 'Due Today' | 'Overdue' | 'No Target'

export function getDeadlineState(task: Task): DeadlineState {
  if (task.status === 'Done') return 'Safe'
  if (!task.targetDate) return 'No Target'
  
  const remaining = getRemainingDays(task.targetDate)
  if (remaining === null) return 'No Target'
  if (remaining < 0) return 'Overdue'
  if (remaining === 0) return 'Due Today'
  if (remaining > 0 && remaining <= 3) return 'Near Deadline'
  return 'Safe'
}

export function formatDeadlineText(task: Task): string {
  if (!task.targetDate) return 'No Target'
  const remaining = getRemainingDays(task.targetDate)
  if (remaining === null) return 'No Target'
  if (task.status === 'Done') {
    return 'Completed'
  }
  if (remaining < 0) {
    return `${Math.abs(remaining)} day${Math.abs(remaining) > 1 ? 's' : ''} overdue`
  }
  if (remaining === 0) {
    return 'Due Today'
  }
  return `${remaining} day${remaining > 1 ? 's' : ''} left`
}

export function isInDateRange(dateStr: string, from: string, to: string): boolean {
  if (!from && !to) return true
  // dateStr may be ISO (2026-09-03T...) or YYYY-MM-DD — compare YYYY-MM-DD slice
  const d = dateStr.slice(0, 10)
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}
