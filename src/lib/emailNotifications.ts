import type { SupabaseClient } from '@supabase/supabase-js'

const REOPENED_FROM_STATUSES = new Set(['Done', 'QC'])
const REOPENED_TO_STATUSES = new Set(['Open', 'Reopen'])

export function isTaskReopened(oldStatus: string, newStatus: string): boolean {
  return REOPENED_FROM_STATUSES.has(oldStatus) && REOPENED_TO_STATUSES.has(newStatus)
}

export async function notifyTaskReopened(
  supabase: SupabaseClient,
  taskId: string,
  oldStatus: string,
  newStatus: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: {
      task_id: taskId,
      action: 'reopen',
      old_status: oldStatus,
      new_status: newStatus,
    },
  })

  if (error) throw error

  if (data?.sent === false) {
    console.warn(`[emailNotifications] Reopen email was not sent for ${taskId}: ${data.reason || 'unknown reason'}`)
  }
}
