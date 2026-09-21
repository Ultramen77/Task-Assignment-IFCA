import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { notifySheets } from '../lib/sheetSync'
import { isTaskReopened, notifyTaskReopened } from '../lib/emailNotifications'
import type {
  TaskReadModel,
  CreateTaskPayload,
  Client,
  Consultant,
  Programmer,
  TaskHistoryReadModel,
  Attachment,
  TaskComment,
  CreateTaskCommentPayload,
  UploadAttachmentPayload,
  UploadAttachmentResult,
} from '../types/task.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
// Keep module initialization safe when the app is running in mock mode. The
// client is never called unless isApiMode() is true and real credentials exist.
const supabase: SupabaseClient = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseKey || 'mock-anon-key',
)

export const taskService = {
  isApiMode(): boolean {
    return import.meta.env.VITE_DATA_SOURCE === 'supabase' && Boolean(supabaseUrl && supabaseKey)
  },

  async getTasks(includeArchived = false): Promise<TaskReadModel[]> {
    let query = supabase.from('tasks').select(`
      *,
      consultant:consultants(*),
      client:clients(*),
      programmer:programmers(*)
    `)

    if (!includeArchived) {
      query = query.eq('is_archived', false)
    }

    const { data, error } = await query
    if (error) throw error

    return (data || []).map((t: any) => ({
      taskId: t.task_id,
      type: t.type,
      screenReport: t.screen_report,
      request: t.request,
      status: t.status,
      sqlServer: t.sql_server || '',
      databaseName: t.database_name || '',
      targetDate: t.target_date || null,
      notes: t.notes || '',
      isArchived: t.is_archived,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      completedAt: t.status === 'Done' ? t.updated_at : null,
      consultant: t.consultant
        ? { id: t.consultant.consultant_id, name: t.consultant.consultant_name }
        : { id: t.consultant_id, name: '' },
      client: t.client
        ? { id: t.client.client_id, name: t.client.client_name }
        : { id: t.client_id, name: '' },
      programmer: t.programmer
        ? { id: t.programmer.programmer_id, name: t.programmer.programmer_name }
        : null,
    }))
  },

  async getTask(taskId: string): Promise<TaskReadModel> {
    const { data, error } = await supabase
      .from('tasks')
      .select(`*, consultant:consultants(*), client:clients(*), programmer:programmers(*)`)
      .eq('task_id', taskId)
      .single()

    if (error) throw error
    const t = data
    return {
      taskId: t.task_id,
      type: t.type,
      screenReport: t.screen_report,
      request: t.request,
      status: t.status,
      sqlServer: t.sql_server || '',
      databaseName: t.database_name || '',
      targetDate: t.target_date || null,
      notes: t.notes || '',
      isArchived: t.is_archived,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      completedAt: t.status === 'Done' ? t.updated_at : null,
      consultant: t.consultant
        ? { id: t.consultant.consultant_id, name: t.consultant.consultant_name }
        : { id: t.consultant_id, name: '' },
      client: t.client
        ? { id: t.client.client_id, name: t.client.client_name }
        : { id: t.client_id, name: '' },
      programmer: t.programmer
        ? { id: t.programmer.programmer_id, name: t.programmer.programmer_name }
        : null,
    }
  },

  async createTask(payload: CreateTaskPayload): Promise<string> {
    const now = new Date().toISOString()
    const { data } = await supabase.rpc('generate_task_id').select().single()
    const taskId = (data as any)?.generate_task_id || `TASK-${Date.now()}`

    const { error: insertError } = await supabase.from('tasks').insert({
      task_id: taskId,
      consultant_id: payload.consultantId,
      type: payload.type,
      client_id: payload.clientId,
      screen_report: payload.screenReport,
      request: payload.request,
      status: payload.status,
      programmer_id: payload.programmerId,
      sql_server: payload.sqlServer,
      database_name: payload.databaseName,
      target_date: payload.targetDate,
      notes: payload.notes,
      is_archived: false,
      created_at: now,
      updated_at: now,
    })

    if (insertError) throw insertError

    // Sheets mirror (fire-and-forget, 1 arah Web -> Sheets FULL API)
    notifySheets({
      action: 'create',
      taskId,
      row: {
        consultant: payload.consultantId
          ? await Promise.resolve(supabase.from('consultants').select('consultant_name').eq('consultant_id', payload.consultantId).single())
              .then(r => (r.data as any)?.consultant_name ?? '')
              .catch(() => '')
          : '',
        type: payload.type,
        client: payload.clientId
          ? await Promise.resolve(supabase.from('clients').select('client_name').eq('client_id', payload.clientId).single())
              .then(r => (r.data as any)?.client_name ?? '')
              .catch(() => '')
          : '',
        screenReport: payload.screenReport,
        request: payload.request,
        status: payload.status,
        programmer: payload.programmerId
          ? await Promise.resolve(supabase.from('programmers').select('programmer_name').eq('programmer_id', payload.programmerId).single())
              .then(r => (r.data as any)?.programmer_name ?? '')
              .catch(() => '')
          : '',
        sqlServer: payload.sqlServer,
        database: payload.databaseName,
        targetDate: payload.targetDate,
        notes: payload.notes,
      },
    })

    // Write history
    await supabase.from('task_history').insert({
      history_id: await this._nextHistoryId(),
      task_id: taskId,
      action: 'CREATE',
      field_name: '',
      old_value: '',
      new_value: 'Task created',
      changed_by: 'SYSTEM',
      changed_at: now,
    })

    return taskId
  },

  async updateTask(taskId: string, updatedFields: Partial<CreateTaskPayload>): Promise<void> {
    const now = new Date().toISOString()
    const fields: any = {}

    if (updatedFields.consultantId !== undefined) fields.consultant_id = updatedFields.consultantId
    if (updatedFields.clientId !== undefined) fields.client_id = updatedFields.clientId
    if (updatedFields.type !== undefined) fields.type = updatedFields.type
    if (updatedFields.screenReport !== undefined) fields.screen_report = updatedFields.screenReport
    if (updatedFields.request !== undefined) fields.request = updatedFields.request
    if (updatedFields.status !== undefined) fields.status = updatedFields.status
    if (updatedFields.programmerId !== undefined) fields.programmer_id = updatedFields.programmerId
    if (updatedFields.sqlServer !== undefined) fields.sql_server = updatedFields.sqlServer
    if (updatedFields.databaseName !== undefined) fields.database_name = updatedFields.databaseName
    if (updatedFields.targetDate !== undefined) fields.target_date = updatedFields.targetDate
    if (updatedFields.notes !== undefined) fields.notes = updatedFields.notes
    fields.updated_at = now

    const oldTask = await this.getTask(taskId)

    const { error } = await supabase.from('tasks').update(fields).eq('task_id', taskId)
    if (error) throw error

    // Re-notify the assigned programmer when a completed/reviewed task is opened again.
    if (updatedFields.status && isTaskReopened(oldTask.status, updatedFields.status)) {
      try {
        await notifyTaskReopened(supabase, taskId, oldTask.status, updatedFields.status)
      } catch (emailError) {
        // The task update already succeeded. Keep that result, but leave a diagnostic for retry/ops.
        console.error(`[taskService] Failed to send reopen email for ${taskId}:`, emailError)
      }
    }

    // Sheets mirror (fire-and-forget) — build row from merged task
    try {
      const cur = await this.getTask(taskId)
      notifySheets({
        action: 'update',
        taskId,
        row: {
          consultant: cur.consultant.name || (updatedFields.consultantId as string) || '',
          type: (updatedFields.type as string) || cur.type,
          client: cur.client.name || (updatedFields.clientId as string) || '',
          screenReport: (updatedFields.screenReport as string) ?? cur.screenReport,
          request: (updatedFields.request as string) ?? cur.request,
          status: (updatedFields.status as string) || cur.status,
          programmer: cur.programmer?.name || '',
          sqlServer: (updatedFields.sqlServer as string) ?? cur.sqlServer,
          database: (updatedFields.databaseName as string) ?? cur.databaseName,
          targetDate: (updatedFields.targetDate !== undefined ? (updatedFields.targetDate as string | null) : cur.targetDate) as string | null,
          notes: (updatedFields.notes as string) ?? cur.notes,
        },
      })
    } catch {}

    // Track history
    const historyEntries: any[] = []
    Object.entries(updatedFields).forEach(([key, newValue]) => {
      if (key === 'status' && newValue === 'Done' && oldTask.status !== 'Done') {
        historyEntries.push({
          history_id: '', // will fix below
          task_id: taskId,
          action: 'COMPLETE',
          field_name: key,
          old_value: oldTask[key as keyof TaskReadModel] as string,
          new_value: newValue as string,
          changed_by: 'SYSTEM',
          changed_at: now,
        })
      } else if (oldTask[key.toLowerCase() as keyof TaskReadModel] !== newValue) {
        historyEntries.push({
          history_id: '', // will fix below
          task_id: taskId,
          action: 'UPDATE',
          field_name: key,
          old_value: oldTask[key.toLowerCase() as keyof TaskReadModel] as string,
          new_value: newValue as string,
          changed_by: 'SYSTEM',
          changed_at: now,
        })
      }
    })

    for (const entry of historyEntries) {
      entry.history_id = await this._nextHistoryId()
      await supabase.from('task_history').insert(entry)
    }
  },

  async archiveTask(taskId: string): Promise<void> {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('tasks')
      .update({ is_archived: true, updated_at: now })
      .eq('task_id', taskId)
    if (error) throw error

    notifySheets({ action: 'archive', taskId })

    await supabase.from('task_history').insert({
      history_id: await this._nextHistoryId(),
      task_id: taskId,
      action: 'ARCHIVE',
      field_name: 'is_archived',
      old_value: 'FALSE',
      new_value: 'TRUE',
      changed_by: 'SYSTEM',
      changed_at: now,
    })
  },

  async listClients(): Promise<Client[]> {
    const { data, error } = await supabase.from('clients').select('*').order('client_name')
    if (error) throw error
    return (data || []).map((c: any) => ({
      id: c.client_id,
      name: c.client_name,
      active: c.active,
    }))
  },

  async createClient(payload: { name: string }): Promise<void> {
    const clientId = await this._nextClientId()
    const { error } = await supabase.from('clients').insert({
      client_id: clientId,
      client_name: payload.name,
      active: true,
    })
    if (error) throw error
  },

  async updateClient(id: string, payload: { name: string; active?: boolean }): Promise<void> {
    const fields: any = { client_name: payload.name }
    if (payload.active !== undefined) fields.active = payload.active
    const { error } = await supabase.from('clients').update(fields).eq('client_id', id)
    if (error) throw error
  },

  async deleteClient(id: string): Promise<void> {
    // Soft delete: set active = false (per contract)
    const { error } = await supabase.from('clients').update({ active: false }).eq('client_id', id)
    if (error) throw error
  },

  async listConsultants(): Promise<Consultant[]> {
    const { data, error } = await supabase.from('consultants').select('*').order('consultant_name')
    if (error) throw error
    return (data || []).map((c: any) => ({
      id: c.consultant_id,
      name: c.consultant_name,
      email: c.consultant_email || '',
      active: c.active,
    }))
  },

  async createConsultant(payload: { name: string; email?: string }): Promise<void> {
    const consultantId = await this._nextConsultantId()
    const { error } = await supabase.from('consultants').insert({
      consultant_id: consultantId,
      consultant_name: payload.name,
      consultant_email: payload.email || '',
      active: true,
    })
    if (error) throw error
  },

  async updateConsultant(id: string, payload: { name: string; email?: string; active?: boolean }): Promise<void> {
    const fields: any = { consultant_name: payload.name }
    if (payload.email !== undefined) fields.consultant_email = payload.email
    if (payload.active !== undefined) fields.active = payload.active
    const { error } = await supabase.from('consultants').update(fields).eq('consultant_id', id)
    if (error) throw error
  },

  async deleteConsultant(id: string): Promise<void> {
    const { error } = await supabase.from('consultants').update({ active: false }).eq('consultant_id', id)
    if (error) throw error
  },

  async listProgrammers(): Promise<Programmer[]> {
    const { data, error } = await supabase.from('programmers').select('*').order('programmer_name')
    if (error) throw error
    return (data || []).map((p: any) => ({
      id: p.programmer_id,
      name: p.programmer_name,
      email: p.programmer_email || '',
      active: p.active,
    }))
  },

  async createProgrammer(payload: { name: string; email?: string }): Promise<void> {
    const programmerId = await this._nextProgrammerId()
    const { error } = await supabase.from('programmers').insert({
      programmer_id: programmerId,
      programmer_name: payload.name,
      programmer_email: payload.email || '',
      active: true,
    })
    if (error) throw error
  },

  async updateProgrammer(id: string, payload: { name: string; email?: string; active?: boolean }): Promise<void> {
    const fields: any = { programmer_name: payload.name }
    if (payload.email !== undefined) fields.programmer_email = payload.email
    if (payload.active !== undefined) fields.active = payload.active
    const { error } = await supabase.from('programmers').update(fields).eq('programmer_id', id)
    if (error) throw error
  },

  async deleteProgrammer(id: string): Promise<void> {
    const { error } = await supabase.from('programmers').update({ active: false }).eq('programmer_id', id)
    if (error) throw error
  },

  async getTaskHistory(taskId: string): Promise<TaskHistoryReadModel[]> {
    const { data, error } = await supabase
      .from('task_history')
      .select('*')
      .eq('task_id', taskId)
      .order('changed_at', { ascending: false })
    if (error) throw error
    return (data || []).map((h: any) => ({
      id: h.history_id,
      taskId: h.task_id,
      action: h.action,
      fieldName: h.field_name || '',
      oldValue: h.old_value || '',
      newValue: h.new_value || '',
      changedBy: h.changed_by || 'SYSTEM',
      changedAt: h.changed_at,
    }))
  },

  async listRecentHistory(limit = 50): Promise<TaskHistoryReadModel[]> {
    const { data, error } = await supabase
      .from('task_history')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data || []).map((h: any) => ({
      id: h.history_id,
      taskId: h.task_id,
      action: h.action,
      fieldName: h.field_name || '',
      oldValue: h.old_value || '',
      newValue: h.new_value || '',
      changedBy: h.changed_by || 'SYSTEM',
      changedAt: h.changed_at,
    }))
  },

  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    const { data, error } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map((comment: any) => ({
      id: comment.comment_id,
      taskId: comment.task_id,
      authorType: comment.author_type,
      authorId: comment.author_id,
      authorName: '',
      body: comment.comment_text || '',
      createdAt: comment.created_at,
    }))
  },

  async createTaskComment(payload: CreateTaskCommentPayload): Promise<TaskComment> {
    const { data, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: payload.taskId,
        author_type: payload.authorType,
        author_id: payload.authorId,
        comment_text: payload.body.trim(),
      })
      .select('*')
      .single()
    if (error) throw error
    return {
      id: data.comment_id,
      taskId: data.task_id,
      authorType: data.author_type,
      authorId: data.author_id,
      authorName: '',
      body: data.comment_text,
      createdAt: data.created_at,
    }
  },

  async getTaskAttachments(taskId: string): Promise<Attachment[]> {
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('uploaded_at', { ascending: false })
    if (error) throw error
    return (data || []).map((a: any) => ({
      id: a.attachment_id,
      taskId: a.task_id,
      fileName: a.file_name,
      driveFileId: a.storage_key,
      fileUrl: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/attachments/${a.storage_key}`,
      mimeType: a.mime_type,
      description: a.description || '',
      uploadedAt: a.uploaded_at,
    }))
  },

  async uploadAttachment(payload: UploadAttachmentPayload): Promise<UploadAttachmentResult> {
    const now = new Date().toISOString()
    const attachmentId = await this._nextAttachmentId()
    const safeName = `${payload.taskId}_${attachmentId}_${payload.fileName}`
    const ext = payload.mimeType.split('/')[1] // e.g. "png"
    const storageKey = `${payload.taskId}/${attachmentId}_${safeName}.${ext}`

    // Decode base64 → binary Uint8Array
    const binaryData = Uint8Array.from(atob(payload.contentBase64), c => c.charCodeAt(0))

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(storageKey, binaryData, {
        contentType: payload.mimeType,
        upsert: false,
      })

    if (uploadError) throw uploadError

    // Store metadata
    const { error: metaError } = await supabase.from('attachments').insert({
      attachment_id: attachmentId,
      task_id: payload.taskId,
      file_name: payload.fileName,
      storage_key: storageKey,
      mime_type: payload.mimeType,
      description: payload.description || '',
      uploaded_at: now,
    })

    if (metaError) throw metaError

    const fileUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/attachments/${storageKey}`
    return { attachmentId, fileUrl }
  },

  async deleteAttachment(attachmentId: string): Promise<void> {
    const { data: attachments, error: findError } = await supabase
      .from('attachments')
      .select('storage_key')
      .eq('attachment_id', attachmentId)
      .single()

    if (findError) throw findError

    const storageKey = attachments?.storage_key

    if (storageKey) {
      const { error: removeError } = await supabase.storage
        .from('attachments')
        .remove([storageKey])
      if (removeError) throw removeError
    }

    await supabase.from('attachments').delete().eq('attachment_id', attachmentId)
  },

  // === PRIVATE HELPERS ===
  _nextHistoryId: async function (): Promise<string> {
    const { data, error } = await supabase.rpc('generate_history_id').select().single()
    if (error) throw error
    return (data as any)?.generate_history_id || `HIST-${Date.now()}`
  },

  _nextAttachmentId: async function (): Promise<string> {
    const { data, error } = await supabase.rpc('generate_attachment_id').select().single()
    if (error) throw error
    return (data as any)?.generate_attachment_id || `ATT-${Date.now()}`
  },

  _nextClientId: async function (): Promise<string> {
    const { data, error } = await supabase.rpc('generate_client_id').select().single()
    if (error) throw error
    return (data as any)?.generate_client_id || `CLI-${Date.now()}`
  },

  _nextConsultantId: async function (): Promise<string> {
    const { data, error } = await supabase.rpc('generate_consultant_id').select().single()
    if (error) throw error
    return (data as any)?.generate_consultant_id || `CON-${Date.now()}`
  },

  _nextProgrammerId: async function (): Promise<string> {
    const { data, error } = await supabase.rpc('generate_programmer_id').select().single()
    if (error) throw error
    return (data as any)?.generate_programmer_id || `PROG-${Date.now()}`
  },
}
