export type TaskStatus = 'Open' | 'Assign' | 'Done' | 'QC' | 'Reject' | 'Reopen' | 'Hold' | 'In Progress'
export type TaskType = 'Bugs' | 'Improvements'

export interface Task {
  id: string
  consultant: string
  type: TaskType
  client: string
  screenReport: string
  request: string
  status: TaskStatus
  programmer: string
  sqlServer: string
  database: string
  targetDate: string | null // YYYY-MM-DD
  notes: string
  createdAt: string // ISO string or format
  updatedAt: string // ISO string or format
  completedAt: string | null // ISO string or format
  archived: boolean
}

// API Denormalized Read Model
export interface TaskReadModel {
  taskId: string
  type: TaskType
  screenReport: string
  request: string
  status: TaskStatus
  sqlServer: string
  databaseName: string
  targetDate: string | null
  notes: string
  isArchived: boolean
  createdAt: string
  updatedAt: string
  completedAt: string | null
  consultant: {
    id: string
    name: string
  }
  client: {
    id: string
    name: string
  }
  programmer: {
    id: string
    name: string
  } | null
}

export interface CreateTaskPayload {
  consultantId: string
  clientId: string
  type: TaskType
  screenReport: string
  request: string
  status: TaskStatus
  programmerId: string | null
  sqlServer: string
  databaseName: string
  targetDate: string | null
  notes: string
}

export type HistoryAction = 'CREATE' | 'UPDATE' | 'COMPLETE' | 'ARCHIVE'

export interface TaskHistory {
  id: string
  taskId: string
  action: HistoryAction
  field: string | null
  oldValue: string | null
  newValue: string | null
  timestamp: string // YYYY-MM-DD HH:mm:ss or ISO
}

// API History Model
export interface TaskHistoryReadModel {
  id: string
  taskId: string
  action: HistoryAction
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  changedBy: string
  changedAt: string
}

export type CommentAuthorType = 'Consultant' | 'Programmer'

export interface TaskComment {
  id: string
  taskId: string
  authorType: CommentAuthorType
  authorId: string
  authorName: string
  body: string
  createdAt: string
}

export interface CreateTaskCommentPayload {
  taskId: string
  authorType: CommentAuthorType
  authorId: string
  body: string
}

export interface Attachment {
  id: string
  taskId: string
  fileName: string
  driveFileId: string
  fileUrl: string
  mimeType: string
  description: string
  uploadedAt: string
}

// API read model (excludes driveFileId per contract)
export interface AttachmentReadModel {
  id: string
  taskId: string
  fileName: string
  fileUrl: string
  mimeType: string
  description: string
  uploadedAt: string
}

export interface UploadAttachmentPayload {
  taskId: string
  fileName: string
  mimeType: string
  description?: string
  contentBase64: string
}

export interface UploadAttachmentResult {
  attachmentId: string
  fileUrl: string
}

export interface Consultant {
  id: string
  name: string
  email: string
  active: boolean
}

export interface Programmer {
  id: string
  name: string
  email: string
  active: boolean
}

export interface Client {
  id: string
  name: string
  active: boolean
}

export interface Settings {
  taskTypes: TaskType[]
  statuses: TaskStatus[]
  deadlineWarningThresholdDays: number
  attachmentLimitMb: number
}
