import type {
  TaskReadModel,
  CreateTaskPayload,
  Client,
  Consultant,
  Programmer,
  TaskHistoryReadModel,
  TaskComment,
  CreateTaskCommentPayload,
  Attachment,
  UploadAttachmentPayload,
  UploadAttachmentResult,
} from '../types/task.types'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new Error('PostgreSQL API URL is not configured.')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const envelope = await response.json().catch(() => null)
  if (!response.ok || !envelope?.success) {
    throw new Error(envelope?.error?.message || `API request failed (${response.status}).`)
  }
  return envelope.data as T
}

export const postgresTaskService = {
  isApiMode() {
    return import.meta.env.VITE_DATA_SOURCE === 'postgres' && Boolean(API_URL)
  },

  getTasks(includeArchived = false) {
    return request<TaskReadModel[]>(`/tasks?includeArchived=${includeArchived}`)
  },

  getTask(taskId: string) {
    return request<TaskReadModel>(`/tasks/${encodeURIComponent(taskId)}`)
  },

  async createTask(payload: CreateTaskPayload) {
    const result = await request<{ taskId: string }>('/tasks', { method: 'POST', body: JSON.stringify(payload) })
    return result.taskId
  },

  updateTask(taskId: string, updatedFields: Partial<CreateTaskPayload>) {
    return request<{ updated: boolean }>(`/tasks/${encodeURIComponent(taskId)}`, { method: 'PATCH', body: JSON.stringify(updatedFields) }).then(() => undefined)
  },

  archiveTask(taskId: string) {
    return request<{ archived: boolean }>(`/tasks/${encodeURIComponent(taskId)}/archive`, { method: 'POST', body: '{}' }).then(() => undefined)
  },

  listClients() { return request<Client[]>('/clients') },
  listConsultants() { return request<Consultant[]>('/consultants') },
  listProgrammers() { return request<Programmer[]>('/programmers') },

  createClient(payload: { name: string }) { return request('/clients', { method: 'POST', body: JSON.stringify(payload) }).then(() => undefined) },
  updateClient(id: string, payload: { name: string; active?: boolean }) { return request(`/clients/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }).then(() => undefined) },
  deleteClient(id: string) { return request(`/clients/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ active: false }) }).then(() => undefined) },
  createConsultant(payload: { name: string; email?: string }) { return request('/consultants', { method: 'POST', body: JSON.stringify(payload) }).then(() => undefined) },
  updateConsultant(id: string, payload: { name: string; email?: string; active?: boolean }) { return request(`/consultants/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }).then(() => undefined) },
  deleteConsultant(id: string) { return request(`/consultants/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ active: false }) }).then(() => undefined) },
  createProgrammer(payload: { name: string; email?: string }) { return request('/programmers', { method: 'POST', body: JSON.stringify(payload) }).then(() => undefined) },
  updateProgrammer(id: string, payload: { name: string; email?: string; active?: boolean }) { return request(`/programmers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }).then(() => undefined) },
  deleteProgrammer(id: string) { return request(`/programmers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ active: false }) }).then(() => undefined) },

  getTaskHistory(taskId: string) { return request<TaskHistoryReadModel[]>(`/tasks/${encodeURIComponent(taskId)}/history`) },
  listRecentHistory(limit = 50) { return request<TaskHistoryReadModel[]>(`/history/recent?limit=${limit}`) },
  getTaskComments(taskId: string) { return request<TaskComment[]>(`/tasks/${encodeURIComponent(taskId)}/comments`) },
  createTaskComment(payload: CreateTaskCommentPayload) { return request<TaskComment>(`/tasks/${encodeURIComponent(payload.taskId)}/comments`, { method: 'POST', body: JSON.stringify(payload) }) },

  getTaskAttachments(taskId: string) { return request<Attachment[]>(`/tasks/${encodeURIComponent(taskId)}/attachments`) },
  uploadAttachment(payload: UploadAttachmentPayload) {
    return request<UploadAttachmentResult>(`/tasks/${encodeURIComponent(payload.taskId)}/attachments`, { method: 'POST', body: JSON.stringify(payload) })
  },
  deleteAttachment(attachmentId: string) {
    return request(`/attachments/${encodeURIComponent(attachmentId)}`, { method: 'DELETE' }).then(() => undefined)
  },
}
