/* eslint-disable react/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from 'react'
import type {
  Task,
  TaskHistory,
  Attachment,
  Consultant,
  Programmer,
  Client,
  CreateTaskPayload,
  UploadAttachmentPayload,
  UploadAttachmentResult,
  TaskComment,
  CreateTaskCommentPayload,
} from '../types/task.types'
import { mockTasks, mockHistory, mockAttachments, mockComments, mockConsultants, mockProgrammers, mockClients } from '../data/mockData'
import { postgresTaskService } from '../services/postgresTaskService'

interface TaskContextType {
  tasks: Task[]
  history: TaskHistory[]
  attachments: Attachment[]
  comments: TaskComment[]
  consultants: Consultant[]
  programmers: Programmer[]
  clients: Client[]
  loading: boolean
  refreshing: boolean
  error: string | null
  createTask: (
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'archived'>
  ) => Promise<string>
  updateTask: (taskId: string, updatedFields: Partial<Task>) => Promise<void>
  archiveTask: (taskId: string) => Promise<void>
  fetchTaskHistory: (taskId: string) => Promise<TaskHistory[]>
  fetchTaskAttachments: (taskId: string) => Promise<Attachment[]>
  fetchTaskComments: (taskId: string) => Promise<TaskComment[]>
  createTaskComment: (payload: CreateTaskCommentPayload) => Promise<TaskComment>
  uploadAttachment: (payload: UploadAttachmentPayload) => Promise<UploadAttachmentResult>
  deleteAttachment: (attachmentId: string) => Promise<void>
  fetchRecentHistory: (limit?: number) => Promise<TaskHistory[]>
  refreshData: () => Promise<void>
}

const TaskContext = createContext<TaskContextType | undefined>(undefined)

// Neutral placeholder for mock-mode uploads that have no real Drive URL.
const MOCK_PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#ececec"/><text x="160" y="95" text-anchor="middle" font-family="monospace" font-size="14" fill="#666">mock attachment</text></svg>'
  )

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [history, setHistory] = useState<TaskHistory[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  
  // Master data lists loaded from API or mock
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [programmers, setProgrammers] = useState<Programmer[]>([])
  const [clients, setClients] = useState<Client[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refreshInFlight = useRef(false)

  const isApi = postgresTaskService.isApiMode()
  const taskService = postgresTaskService

  // Helper to map API read model to internal UI Task format
  const mapTaskReadToTask = useCallback((rm: any): Task => {
    return {
      id: rm.taskId,
      consultant: rm.consultant?.name || rm.consultantId || '',
      type: rm.type,
      client: rm.client?.name || rm.clientId || '',
      screenReport: rm.screenReport,
      request: rm.request,
      status: rm.status,
      programmer: rm.programmer?.name || rm.programmerId || '',
      sqlServer: rm.sqlServer || '',
      database: rm.databaseName || '',
      targetDate: rm.targetDate,
      notes: rm.notes || '',
      createdAt: rm.createdAt,
      updatedAt: rm.updatedAt,
      completedAt: rm.completedAt,
      archived: rm.isArchived,
    }
  }, [])

  // Dynamic loader
  const refreshData = useCallback(async () => {
    setError(null)
    if (isApi) {
      try {
        setLoading(true)
        const [apiTasks, apiClients, apiConsultants, apiProgrammers] = await Promise.all([
          taskService.getTasks(true), // Load all tasks (including archived)
          taskService.listClients(),
          taskService.listConsultants(),
          taskService.listProgrammers(),
        ])

        setTasks(apiTasks.map(mapTaskReadToTask))
        setClients(apiClients)
        setConsultants(apiConsultants)
        setProgrammers(apiProgrammers)
      } catch (err: any) {
        setError(err.message || 'Failed to sync database. Running off cached/empty state.')
      } finally {
        setLoading(false)
      }
    } else {
      // Mock mode initialization
      setTasks(mockTasks)
      setHistory(mockHistory)
      setAttachments(mockAttachments)
      setComments(mockComments)
      setConsultants(mockConsultants)
      setProgrammers(mockProgrammers)
      setClients(mockClients)
      setLoading(false)
    }
  }, [isApi, mapTaskReadToTask])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  const refreshTasks = useCallback(async () => {
    if (!isApi || refreshInFlight.current) return

    refreshInFlight.current = true
    setRefreshing(true)
    try {
      const apiTasks = await taskService.getTasks(true)
      setTasks(previousTasks => {
        const previousById = new Map(previousTasks.map(task => [task.id, task]))
        return apiTasks.map(nextTask => {
          const previousTask = previousById.get(nextTask.taskId)
          const mappedTask = mapTaskReadToTask(nextTask)

          // Keep object references for unchanged tasks so an open edit form does not reset.
          if (
            previousTask &&
            JSON.stringify(previousTask) === JSON.stringify(mappedTask)
          ) {
            return previousTask
          }
          return mappedTask
        })
      })
      setError(null)
    } catch (err: any) {
      console.error('Background task refresh failed:', err)
      setError(err.message || 'Could not refresh tasks. Showing the last available data.')
    } finally {
      refreshInFlight.current = false
      setRefreshing(false)
    }
  }, [isApi, mapTaskReadToTask])

  useEffect(() => {
    if (!isApi) return

    const intervalId = window.setInterval(() => { void refreshTasks() }, 15000)
    const handleWindowFocus = () => { void refreshTasks() }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshTasks()
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isApi, refreshTasks])

  // Get task history on demand
  const fetchTaskHistory = async (taskId: string): Promise<TaskHistory[]> => {
    if (isApi) {
      try {
        const list = await taskService.getTaskHistory(taskId)
        return list.map(item => ({
          id: item.id,
          taskId: item.taskId,
          action: item.action,
          field: item.fieldName,
          oldValue: item.oldValue,
          newValue: item.newValue,
          timestamp: item.changedAt.replace('T', ' ').substring(0, 19),
        }))
      } catch (err) {
        console.error('Failed to load task history:', err)
        return []
      }
    } else {
      return history
        .filter(h => h.taskId === taskId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    }
  }

  // Get task attachments on demand
  const fetchTaskAttachments = async (taskId: string): Promise<Attachment[]> => {
    if (isApi) {
      try {
        return await taskService.getTaskAttachments(taskId)
      } catch (err) {
        console.error('Failed to load task attachments:', err)
        return []
      }
    } else {
      return attachments.filter(a => a.taskId === taskId)
    }
  }

  const resolveCommentAuthorName = useCallback((authorType: TaskComment['authorType'], authorId: string) => {
    return authorType === 'Consultant'
      ? consultants.find(person => person.id === authorId)?.name || authorId
      : programmers.find(person => person.id === authorId)?.name || authorId
  }, [consultants, programmers])

  const fetchTaskComments = async (taskId: string): Promise<TaskComment[]> => {
    if (isApi) {
      try {
        const list = await taskService.getTaskComments(taskId)
        return list.map(comment => ({ ...comment, authorName: resolveCommentAuthorName(comment.authorType, comment.authorId) }))
      } catch (err) {
        console.error('Failed to load task comments:', err)
        throw err
      }
    }
    return comments
      .filter(comment => comment.taskId === taskId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  const createTaskComment = async (payload: CreateTaskCommentPayload): Promise<TaskComment> => {
    if (isApi) {
      const comment = await taskService.createTaskComment(payload)
      return { ...comment, authorName: resolveCommentAuthorName(comment.authorType, comment.authorId) }
    }
    const comment: TaskComment = {
      id: `CMT-${Date.now()}`,
      ...payload,
      authorName: resolveCommentAuthorName(payload.authorType, payload.authorId),
      body: payload.body.trim(),
      createdAt: new Date().toISOString(),
    }
    setComments(previous => [...previous, comment])
    return comment
  }

  // Recent activity across all tasks (dashboard)
  const fetchRecentHistory = async (limit: number = 50): Promise<TaskHistory[]> => {
    if (isApi) {
      try {
        const list = await taskService.listRecentHistory(limit)
        return list.map(item => ({
          id: item.id,
          taskId: item.taskId,
          action: item.action,
          field: item.fieldName,
          oldValue: item.oldValue,
          newValue: item.newValue,
          timestamp: item.changedAt.replace('T', ' ').substring(0, 19),
        }))
      } catch (err) {
        console.error('Failed to load recent history:', err)
        return []
      }
    } else {
      return [...history]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit)
    }
  }

  const createTask = async (
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'archived'>
  ): Promise<string> => {
    if (isApi) {
      setLoading(true)
      try {
        // Resolve names into IDs for the relational database schema
        const matchedConsultant = consultants.find(c => c.name === taskData.consultant)
        const matchedClient = clients.find(c => c.name === taskData.client)
        const matchedProgrammer = programmers.find(p => p.name === taskData.programmer)

        const payload: CreateTaskPayload = {
          consultantId: matchedConsultant?.id || '',
          clientId: matchedClient?.id || '',
          type: taskData.type,
          screenReport: taskData.screenReport,
          request: taskData.request,
          status: taskData.status,
          programmerId: matchedProgrammer?.id || null,
          sqlServer: taskData.sqlServer,
          databaseName: taskData.database,
          targetDate: taskData.targetDate,
          notes: taskData.notes,
        }

        const taskId = await taskService.createTask(payload)
        await refreshData()
        return taskId
      } catch (err: any) {
        console.error('Failed to create task:', err)
        throw err
      } finally {
        setLoading(false)
      }
    } else {
      // Mock mutations
      const nextIdNumber = Math.max(...tasks.map(t => parseInt(t.id.replace('TASK-', '')))) + 1
      const newId = `TASK-${String(nextIdNumber).padStart(6, '0')}`
      const now = new Date().toISOString()

      const newTask: Task = {
        ...taskData,
        id: newId,
        createdAt: now,
        updatedAt: now,
        completedAt: taskData.status === 'Done' ? now : null,
        archived: false,
      }

      const newHistId = `HIST-${history.length + 1}`
      const newHistEntry: TaskHistory = {
        id: newHistId,
        taskId: newId,
        action: 'CREATE',
        field: null,
        oldValue: null,
        newValue: null,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      }

      setTasks(prev => [newTask, ...prev])
      setHistory(prev => [newHistEntry, ...prev])

      return newId
    }
  }

  const uploadAttachment = async (payload: UploadAttachmentPayload): Promise<UploadAttachmentResult> => {
    if (isApi) {
      return taskService.uploadAttachment(payload)
    }
    const mockAttachment: Attachment = {
      id: `ATT-${Date.now()}`,
      taskId: payload.taskId,
      fileName: payload.fileName,
      driveFileId: `drive-file-mock-${Date.now()}`,
      fileUrl: MOCK_PLACEHOLDER_IMAGE,
      mimeType: payload.mimeType,
      description: payload.description || '',
      uploadedAt: new Date().toISOString(),
    }
    setAttachments(prev => [...prev, mockAttachment])
    return { attachmentId: mockAttachment.id, fileUrl: mockAttachment.fileUrl }
  }

  const deleteAttachment = async (attachmentId: string): Promise<void> => {
    if (isApi) {
      return taskService.deleteAttachment(attachmentId)
    }
    setAttachments(prev => prev.filter(a => a.id !== attachmentId))
  }

  const updateTask = async (taskId: string, updatedFields: Partial<Task>) => {
    if (isApi) {
      setLoading(true)
      try {
        const payload: Partial<CreateTaskPayload> = {}
        
        if (updatedFields.consultant !== undefined) {
          payload.consultantId = consultants.find(c => c.name === updatedFields.consultant)?.id || ''
        }
        if (updatedFields.client !== undefined) {
          payload.clientId = clients.find(c => c.name === updatedFields.client)?.id || ''
        }
        if (updatedFields.type !== undefined) {
          payload.type = updatedFields.type
        }
        if (updatedFields.screenReport !== undefined) {
          payload.screenReport = updatedFields.screenReport
        }
        if (updatedFields.request !== undefined) {
          payload.request = updatedFields.request
        }
        if (updatedFields.status !== undefined) {
          payload.status = updatedFields.status
        }
        if (updatedFields.programmer !== undefined) {
          payload.programmerId = programmers.find(p => p.name === updatedFields.programmer)?.id || null
        }
        if (updatedFields.sqlServer !== undefined) {
          payload.sqlServer = updatedFields.sqlServer
        }
        if (updatedFields.database !== undefined) {
          payload.databaseName = updatedFields.database
        }
        if (updatedFields.targetDate !== undefined) {
          payload.targetDate = updatedFields.targetDate
        }
        if (updatedFields.notes !== undefined) {
          payload.notes = updatedFields.notes
        }

        await taskService.updateTask(taskId, payload)
        await refreshData()
      } catch (err: any) {
        console.error('Failed to update task:', err)
        throw err
      } finally {
        setLoading(false)
      }
    } else {
      // Mock mutations
      const now = new Date().toISOString()
      const updatedTimestamp = now.replace('T', ' ').substring(0, 19)

      setTasks(prevTasks =>
        prevTasks.map(task => {
          if (task.id !== taskId) return task

          const newHistoryEntries: TaskHistory[] = []
          let idx = history.length + 1

          Object.keys(updatedFields).forEach(key => {
            const typedKey = key as keyof Task
            const oldValue = String(task[typedKey] ?? 'empty')
            const newValue = String(updatedFields[typedKey] ?? 'empty')

            if (oldValue !== newValue) {
              let action: 'UPDATE' | 'COMPLETE' | 'ARCHIVE' = 'UPDATE'
              if (typedKey === 'status' && newValue === 'Done') {
                action = 'COMPLETE'
              }

              newHistoryEntries.push({
                id: `HIST-${idx++}`,
                taskId,
                action,
                field: typedKey,
                oldValue,
                newValue,
                timestamp: updatedTimestamp,
              })
            }
          })

          if (newHistoryEntries.length > 0) {
            setHistory(prevHist => [...newHistoryEntries, ...prevHist])
          }

          const isNowDone = updatedFields.status === 'Done' && task.status !== 'Done'
          const isNowNotDone = updatedFields.status !== 'Done' && task.status === 'Done'

          return {
            ...task,
            ...updatedFields,
            updatedAt: now,
            completedAt: isNowDone ? now : isNowNotDone ? null : task.completedAt,
          }
        })
      )
    }
  }

  const archiveTask = async (taskId: string) => {
    if (isApi) {
      setLoading(true)
      try {
        await taskService.archiveTask(taskId)
        await refreshData()
      } catch (err: any) {
        console.error('Failed to archive task:', err)
        throw err
      } finally {
        setLoading(false)
      }
    } else {
      // Mock mutations
      const now = new Date().toISOString()
      const updatedTimestamp = now.replace('T', ' ').substring(0, 19)

      setTasks(prev =>
        prev.map(task => {
          if (task.id !== taskId) return task
          return { ...task, archived: true, updatedAt: now }
        })
      )

      const newHistEntry: TaskHistory = {
        id: `HIST-${history.length + 1}`,
        taskId,
        action: 'ARCHIVE',
        field: 'archived',
        oldValue: 'false',
        newValue: 'true',
        timestamp: updatedTimestamp,
      }

      setHistory(prev => [newHistEntry, ...prev])
    }
  }

  return (
    <TaskContext.Provider
      value={{
        tasks,
        history,
        attachments,
        comments,
        consultants,
        programmers,
        clients,
        loading,
        refreshing,
        error,
        createTask,
        updateTask,
        archiveTask,
        fetchTaskHistory,
        fetchTaskAttachments,
        fetchTaskComments,
        createTaskComment,
        uploadAttachment,
        deleteAttachment,
        fetchRecentHistory,
        refreshData,
      }}
    >
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const context = useContext(TaskContext)
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider')
  }
  return context
}
