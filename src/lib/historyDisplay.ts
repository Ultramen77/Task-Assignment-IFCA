import type { Consultant, Programmer, Client } from '../types/task.types'

export const FIELD_LABELS: Record<string, string> = {
  consultant_id: 'Consultant',
  client_id: 'Client',
  type: 'Type',
  screen_report: 'Screen / Report',
  request: 'Request',
  status: 'Status',
  programmer_id: 'Programmer',
  sql_server: 'SQL Server',
  database_name: 'Database',
  target_date: 'Target Date',
  notes: 'Notes',
  is_archived: 'Archived',
}

interface Masters {
  consultants: Consultant[]
  clients: Client[]
  programmers: Programmer[]
}

// Resolve a stored relational ID to its display name when practical,
// otherwise return the raw value. Keeps storage canonical.
export function resolveDisplayValue(
  fieldName: string | null,
  value: string | null,
  masters: Masters
): string {
  if (value == null) return 'empty'
  if (fieldName === 'consultant_id') {
    return masters.consultants.find(c => c.id === value)?.name ?? value
  }
  if (fieldName === 'client_id') {
    return masters.clients.find(c => c.id === value)?.name ?? value
  }
  if (fieldName === 'programmer_id') {
    return masters.programmers.find(p => p.id === value)?.name ?? value
  }
  return value
}

export function fieldLabel(fieldName: string | null): string {
  if (!fieldName) return ''
  return FIELD_LABELS[fieldName] ?? fieldName
}
