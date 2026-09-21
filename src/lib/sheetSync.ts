/**
 * sheetSync — frontend client for Supabase Edge Function `sync-to-sheets`
 * Web → Sheets 1 arah, FULL Sheets API v4 (tanpa Apps Script).
 * Fire-and-forget: Supabase = source of truth, Sheets = mirror.
 * Kalau Edge Function belum deploy / belum ada secret, sync gagal diam-diam + masuk queue.
 */

export type SheetSyncAction = 'create' | 'update' | 'archive'

export interface SheetSyncRow {
  consultant: string
  type: string
  client: string
  screenReport: string
  request: string
  status: string
  programmer: string
  sqlServer: string
  database: string
  targetDate: string | null
  notes: string
}

export interface SheetSyncPayload {
  action: SheetSyncAction
  taskId: string
  row?: SheetSyncRow
  status?: string
}

const QUEUE_KEY = 'sheets_sync_queue'
const MAX_QUEUE = 50

function getSupabaseUrl(): string {
  return (import.meta as any).env?.VITE_SUPABASE_URL || ''
}
function getAnonKey(): string {
  return (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''
}
function getSyncToken(): string {
  return (import.meta as any).env?.VITE_SHEETS_SYNC_TOKEN || ''
}

function getFunctionUrl(): string {
  const custom = (import.meta as any).env?.VITE_SHEETS_SYNC_URL || ''
  if (custom) return custom.replace(/\/$/, '')
  const base = getSupabaseUrl().replace(/\/$/, '')
  if (!base) return ''
  return `${base}/functions/v1/sync-to-sheets`
}

function loadQueue(): SheetSyncPayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}
function saveQueue(q: SheetSyncPayload[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(0, MAX_QUEUE))) } catch {}
}

async function postToEdge(payload: SheetSyncPayload): Promise<void> {
  const url = getFunctionUrl()
  if (!url) {
    console.warn('[sheetSync] no function URL (VITE_SUPABASE_URL missing)')
    throw new Error('no url')
  }
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    apikey: getAnonKey(),
    Authorization: `Bearer ${getAnonKey()}`,
  }
  const token = getSyncToken()
  if (token) headers['x-sheets-sync-token'] = token

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`sheets sync ${res.status}: ${txt.slice(0, 400)}`)
  }
}

export async function syncToSheets(payload: SheetSyncPayload): Promise<void> {
  try {
    await postToEdge(payload)
    // on success, try flush queued items
    const q = loadQueue()
    if (q.length) {
      const remaining: SheetSyncPayload[] = []
      for (const item of q) {
        try { await postToEdge(item) } catch { remaining.push(item) }
      }
      saveQueue(remaining)
    }
  } catch (e) {
    console.warn('[sheetSync] failed, queued for retry', payload.taskId, e)
    const q = loadQueue()
    q.push(payload)
    saveQueue(q)
    // don't throw — caller is fire-and-forget
  }
}

/** Fire-and-forget helper — never throws */
export function notifySheets(payload: SheetSyncPayload): void {
  void syncToSheets(payload)
}

/** Try to flush queue on app start (call once) */
export function flushSheetsQueue(): void {
  const q = loadQueue()
  if (!q.length) return
  void (async () => {
    const remaining: SheetSyncPayload[] = []
    for (const item of q) {
      try { await postToEdge(item) } catch { remaining.push(item) }
    }
    saveQueue(remaining)
    if (remaining.length) console.warn(`[sheetSync] ${remaining.length} items still queued`)
    else console.log('[sheetSync] queue flushed')
  })()
}
