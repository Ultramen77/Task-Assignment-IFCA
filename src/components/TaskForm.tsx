/* eslint-disable react/set-state-in-effect */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useTasks } from '../context/TaskContext'
import { useToast } from '../context/ToastContext'
import { DATA_SOURCE_LABEL } from '../lib/dataSourceLabel'
import type { TaskStatus, TaskType, TaskComment, CommentAuthorType } from '../types/task.types'
import {
  formatFileSize,
  type PendingAttachmentFile,
  uploadFilesSequentially,
  validateAttachmentFile,
} from '../lib/attachments'

interface TaskFormProps {
  taskId?: string
  onClose: () => void
  onSubmitSuccess: () => void
}

export default function TaskForm({ taskId, onClose, onSubmitSuccess }: TaskFormProps) {
  const { tasks, consultants, programmers, clients, createTask, updateTask, fetchTaskComments, createTaskComment, uploadAttachment } = useTasks()
  const { addToast } = useToast()

  const isEditMode = !!taskId
  const taskToEdit = useMemo(() => tasks.find(t => t.id === taskId), [tasks, taskId])

  // Form Fields State
  const [consultant, setConsultant] = useState('')
  const [type, setType] = useState<TaskType>('Bugs')
  const [client, setClient] = useState('')
  const [screenReport, setScreenReport] = useState('')
  const [request, setRequest] = useState('')
  const [status, setStatus] = useState<TaskStatus>('Open')
  const [programmer, setProgrammer] = useState('')
  const [sqlServer, setSqlServer] = useState('')
  const [database, setDatabase] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [notes, setNotes] = useState('')
  const [taskComments, setTaskComments] = useState<TaskComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentsError, setCommentsError] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentAuthorKey, setCommentAuthorKey] = useState('')
  const [sendingComment, setSendingComment] = useState(false)

  // Submitting and form error states
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Local pending attachment files (held in memory until Save)
  const [pendingFiles, setPendingFiles] = useState<PendingAttachmentFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingFilesRef = useRef<PendingAttachmentFile[]>([])
  const initializedTaskRef = useRef<string | null>(null)
  const commentsTaskIdRef = useRef<string | null>(null)

  // Validation Error State
  const [errors, setErrors] = useState<Record<string, string>>({})

  const authorOptions = useMemo(() => [
    ...consultants.filter(person => person.name === taskToEdit?.consultant).map(person => ({ type: 'Consultant' as const, id: person.id, name: person.name })),
    ...programmers.filter(person => person.name === taskToEdit?.programmer).map(person => ({ type: 'Programmer' as const, id: person.id, name: person.name })),
  ], [consultants, programmers, taskToEdit?.consultant, taskToEdit?.programmer])

  const loadComments = useCallback(async () => {
    if (!isEditMode || !taskId) return
    const isFirstLoadForTask = commentsTaskIdRef.current !== taskId
    commentsTaskIdRef.current = taskId
    if (isFirstLoadForTask) setLoadingComments(true)
    setCommentsError(false)
    try { setTaskComments(await fetchTaskComments(taskId)) } catch { setCommentsError(true) } finally { setLoadingComments(false) }
  }, [fetchTaskComments, isEditMode, taskId])

  useEffect(() => { void loadComments() }, [loadComments])

  useEffect(() => {
    if (!isEditMode || commentAuthorKey) return
    const preferred = authorOptions.find(person => person.name === taskToEdit?.consultant)
      || authorOptions.find(person => person.name === taskToEdit?.programmer)
    if (preferred) setCommentAuthorKey(`${preferred.type}:${preferred.id}`)
  }, [authorOptions, commentAuthorKey, isEditMode, taskToEdit?.consultant, taskToEdit?.programmer])

  useEffect(() => {
    if (!isEditMode) return
    const intervalId = window.setInterval(() => { void loadComments() }, 15000)
    return () => window.clearInterval(intervalId)
  }, [isEditMode, loadComments])

  // Initialize fields in edit/create modes
  useEffect(() => {
    if (isEditMode && taskToEdit) {
      if (initializedTaskRef.current === taskId) return
      initializedTaskRef.current = taskId ?? null
      setConsultant(taskToEdit.consultant)
      setType(taskToEdit.type)
      setClient(taskToEdit.client)
      setScreenReport(taskToEdit.screenReport)
      setRequest(taskToEdit.request)
      setStatus(taskToEdit.status)
      setProgrammer(taskToEdit.programmer)
      setSqlServer(taskToEdit.sqlServer)
      setDatabase(taskToEdit.database)
      setTargetDate(taskToEdit.targetDate || '')
      setNotes(taskToEdit.notes)
    } else {
      initializedTaskRef.current = null
      setConsultant('')
      setType('Bugs')
      setClient('')
      setScreenReport('')
      setRequest('')
      setStatus('Open')
      setProgrammer('')
      setSqlServer('')
      setDatabase('')
      setTargetDate('')
      setNotes('')
    }
  }, [isEditMode, taskId, taskToEdit])

  useEffect(() => {
    pendingFilesRef.current = pendingFiles
  }, [pendingFiles])

  // Revoke object URLs when the form unmounts (close/cancel/submit)
  useEffect(() => {
    return () => {
      pendingFilesRef.current.forEach(p => URL.revokeObjectURL(p.previewUrl))
    }
  }, [])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!consultant) newErrors.consultant = 'Consultant requester is required'
    if (!type) newErrors.type = 'Task type is required'
    if (!client) newErrors.client = 'Client name is required'
    if (!screenReport.trim()) newErrors.screenReport = 'Screen / Report name is required'
    if (!request.trim()) newErrors.request = 'Request description is required'
    if (!status) newErrors.status = 'Initial status is required'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!validate()) return

    setSubmitting(true)
    setSubmitError(null)

    const taskPayload = {
      consultant,
      type,
      client,
      screenReport: screenReport.trim(),
      request: request.trim(),
      status,
      programmer,
      sqlServer: sqlServer.trim(),
      database: database.trim(),
      targetDate: targetDate || null,
      notes: notes.trim(),
    }

    try {
      if (isEditMode && taskId) {
        await updateTask(taskId, taskPayload)
        addToast('success', `Task ${taskId} updated successfully.`)
        onSubmitSuccess()
      } else {
        addToast('info', 'Creating task...')
        const newTaskId = await createTask(taskPayload)

        if (pendingFiles.length > 0) {
          const result = await uploadFilesSequentially(
            pendingFiles,
            newTaskId,
            payload => uploadAttachment(payload),
            (count, total) => addToast('info', `Uploading ${count} of ${total}...`)
          )

          if (result.failed.length > 0) {
            addToast('success', `Task created successfully. ${result.succeeded} of ${pendingFiles.length} attachments uploaded.`)
            addToast('error', `Failed: ${result.failed.join(', ')}`)
          } else {
            addToast('success', `Task created successfully. ${result.succeeded} attachment${result.succeeded === 1 ? '' : 's'} uploaded.`)
          }
        } else {
          addToast('success', 'Task created successfully.')
        }
        onSubmitSuccess()
      }
    } catch (err: any) {
      console.error(err)
      const friendlyMsg = err.message || 'Something went wrong. Please try again.'
      setSubmitError(friendlyMsg)
      addToast('error', isEditMode ? `Unable to update task: ${friendlyMsg}` : `Unable to create task: ${friendlyMsg}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendComment = async () => {
    if (!taskId || sendingComment) return
    const body = commentText.trim()
    const [authorType, authorId] = commentAuthorKey.split(':') as [CommentAuthorType, string]
    if (!body || !authorType || !authorId) return
    setSendingComment(true)
    try {
      const comment = await createTaskComment({ taskId, authorType, authorId, body })
      setTaskComments(previous => [...previous, comment])
      setCommentText('')
      addToast('success', 'Comment added.')
    } catch (err: any) {
      addToast('error', err.message || 'Failed to add comment.')
    } finally { setSendingComment(false) }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    e.target.value = ''

    const accepted: PendingAttachmentFile[] = []
    selected.forEach(file => {
      const errorMsg = validateAttachmentFile(file)
      if (errorMsg) {
        addToast('error', `${file.name}: ${errorMsg}`)
        return
      }
      const isDuplicate = pendingFiles.some(
        p => p.file.name === file.name && p.file.size === file.size && p.file.lastModified === file.lastModified
      )
      if (isDuplicate) {
        addToast('error', `${file.name} is already in the list.`)
        return
      }
      accepted.push({ file, description: '', previewUrl: URL.createObjectURL(file) })
    })

    if (accepted.length > 0) {
      setPendingFiles(prev => [...prev, ...accepted])
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (isEditMode) return
    const items = e.clipboardData?.items
    if (!items) return
    const pasted: File[] = []
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it.type.startsWith('image/')) {
        const f = it.getAsFile()
        if (f) {
          const ext = f.type.split('/')[1] || 'png'
          const name = !f.name || f.name === 'image.png' ? `Screenshot-${Date.now()}-${i}.${ext}` : f.name
          const renamed = f.name === name ? f : new File([f], name, { type: f.type })
          pasted.push(renamed)
        }
      }
    }
    if (!pasted.length) return
    // Do not paste image text into focused input
    e.preventDefault()
    const accepted: PendingAttachmentFile[] = []
    pasted.forEach(file => {
      const msg = validateAttachmentFile(file)
      if (msg) { addToast('error', `${file.name}: ${msg}`); return }
      const dup = pendingFiles.some(p => p.file.name === file.name && p.file.size === file.size)
      if (dup) { addToast('error', `${file.name} is already in the list.`); return }
      accepted.push({ file, description: '', previewUrl: URL.createObjectURL(file) })
    })
    if (accepted.length) {
      setPendingFiles(prev => [...prev, ...accepted])
      addToast('success', `${accepted.length} screenshot pasted (Ctrl+V).`)
    }
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => {
      const next = [...prev]
      const removed = next.splice(index, 1)[0]
      URL.revokeObjectURL(removed.previewUrl)
      return next
    })
  }

  const updateFileDescription = (index: number, description: string) => {
    setPendingFiles(prev => prev.map((p, i) => (i === index ? { ...p, description } : p)))
  }

  return (
    <form onSubmit={handleSubmit} onPaste={handlePaste} className="flex flex-col h-full text-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-3 sm:p-4 shrink-0" style={{ borderColor: 'var(--border-light)' }}>
        <span className="font-semibold text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
          {isEditMode ? `Edit ${taskId}` : 'New Task'}
        </span>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50 min-w-[70px] text-center shadow-lg shadow-black/20 transition-colors"
            style={{ background: 'var(--accent)', color: 'var(--text-on-accent, white)' }}
          >
            {submitting ? (isEditMode ? 'Updating...' : 'Saving...') : 'Save'}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-full glass-subtle border px-3 py-1 text-xs disabled:opacity-50 transition-colors"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Body Scroll */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 space-y-5 sm:space-y-6 overscroll-contain">
        {submitError && (
          <div className="glass rounded-2xl p-3 text-xs font-mono" style={{ background: 'var(--status-error-bg)', color: 'var(--status-error-text)' }}>
            Error: {submitError}
          </div>
        )}
        {/* Section: Assignment */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 font-mono tracking-wider uppercase border-b border-slate-100 pb-1">
            Assignment
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Consultant *
              </label>
              <select
                value={consultant}
                onChange={e => setConsultant(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/20"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: errors.consultant ? 'rgba(239,68,68,0.4)' : 'var(--border-light)' }}
              >
                <option value="">Choose Consultant</option>
                {consultants.filter(c => c.active || c.name === consultant).map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.consultant && <p className="text-[10px] text-red-400 mt-1 font-mono">{errors.consultant}</p>}
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Client *
              </label>
              <select
                value={client}
                onChange={e => setClient(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/20"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: errors.client ? 'rgba(239,68,68,0.4)' : 'var(--border-light)' }}
              >
                <option value="">Choose Client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.client && <p className="text-[10px] text-red-400 mt-1 font-mono">{errors.client}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Type *
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value as TaskType)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/20"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-light)' }}
              >
                <option value="Bugs">Bugs</option>
                <option value="Improvements">Improvements</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Status *
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/20"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-light)' }}
              >
                <option value="QC">QC</option>
                <option value="Open">Open</option>
                <option value="Done">Done</option>
                <option value="Reject">Reject</option>
                <option value="Reopen">Reopen</option>
                <option value="Hold">Hold</option>
                <option value="Assign">Assign</option>
                <option value="In Progress">In Progress</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
              Screen / Report Name *
            </label>
            <textarea
              value={screenReport}
              onChange={e => setScreenReport(e.target.value)}
              placeholder="e.g. Sales Invoice Screen"
              rows={2}
              className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/20"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: errors.screenReport ? 'rgba(239,68,68,0.4)' : 'var(--border-light)' }}
            />
            {errors.screenReport && <p className="text-[10px] text-red-400 mt-1 font-mono">{errors.screenReport}</p>}
          </div>
        </div>

        {/* Section: Request */}
        <div className="space-y-3 sm:space-y-4">
          <h3 className="text-xs font-bold font-mono tracking-wider uppercase border-b pb-1" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-light)' }}>
            Request
          </h3>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
              Request Description *
            </label>
            <textarea
              value={request}
              onChange={e => setRequest(e.target.value)}
              placeholder="Provide detail requirement description..."
              rows={6}
              className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/20 leading-relaxed"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: errors.request ? 'rgba(239,68,68,0.4)' : 'var(--border-light)' }}
            />
            {errors.request && <p className="text-[10px] text-red-400 mt-1 font-mono">{errors.request}</p>}
          </div>
        </div>

        {/* Section: Technical */}
        <div className="space-y-3 sm:space-y-4">
          <h3 className="text-xs font-bold font-mono tracking-wider uppercase border-b pb-1" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-light)' }}>
            Technical
          </h3>
          
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
              Assigned Programmer
            </label>
            <select
              value={programmer}
              onChange={e => setProgrammer(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/20"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-light)' }}
            >
            <option value="">Unassigned</option>
            {programmers.filter(p => p.active || p.name === programmer).map(p => (
              <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                SQL Server
              </label>
              <input
                type="text"
                value={sqlServer}
                onChange={e => setSqlServer(e.target.value)}
                placeholder="SRV-SAP-DB01"
                className="w-full rounded-xl border px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/20"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-light)' }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Database Name
              </label>
              <input
                type="text"
                value={database}
                onChange={e => setDatabase(e.target.value)}
                placeholder="DB_PROD"
                className="w-full rounded-xl border px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/20"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-light)' }}
              />
            </div>
          </div>
        </div>

        {/* Section: Schedule */}
        <div className="space-y-3 sm:space-y-4">
          <h3 className="text-xs font-bold font-mono tracking-wider uppercase border-b pb-1" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-light)' }}>
            Schedule
          </h3>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
              Target Date (Deadline)
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/20"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-light)' }}
            />
          </div>
        </div>

        {/* Section: Additional Information */}
        <div className="space-y-3 sm:space-y-4">
          <h3 className="text-xs font-bold font-mono tracking-wider uppercase border-b pb-1" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-light)' }}>
            Additional Information
          </h3>
          
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes..."
              rows={4}
              className="w-full resize-y rounded-xl glass-subtle border p-2.5 focus:outline-none focus:border-violet-400/50 text-xs leading-relaxed"
              style={{ borderColor: 'var(--border-light)' }}
            />
          </div>

          {/* Local Attachments Section (Create Mode Only) */}
          {!isEditMode && (
            <div className="space-y-3 pt-2">
              <label className="block text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                Attachments ({pendingFiles.length})
              </label>

              {pendingFiles.length > 0 && (
                <div className="space-y-2 glass-subtle p-2.5 border rounded-xl" style={{ borderColor: 'var(--border-light)' }}>
                  {pendingFiles.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <img
                        src={att.previewUrl}
                        alt={att.file.name}
                        className="h-10 w-14 object-cover rounded border glass-subtle shrink-0"
                        style={{ borderColor: 'var(--border-light)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>{att.file.name}</div>
                        <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{formatFileSize(att.file.size)}</div>
                        <input
                          type="text"
                          placeholder="Description (Optional)"
                          value={att.description}
                          onChange={e => updateFileDescription(idx, e.target.value)}
                          className="mt-1 w-full rounded-lg border p-1 focus:outline-none focus:border-violet-400/50 glass-subtle text-[11px]"
                          style={{ borderColor: 'var(--border-light)' }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePendingFile(idx)}
                        className="text-red-400 hover:text-red-300 text-[10px] shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 border rounded-xl p-3 glass-subtle" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--text-muted)' }}>Add Attachment</span>
                  <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>Ctrl+V paste</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
                >
                  Choose images...
                </button>
                <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>PNG, JPEG, or WebP. Max 5 MB. Paste screenshot Ctrl+V.</p>
              </div>
            </div>
          )}
        </div>

        {isEditMode && taskId && (
          <div className="min-h-[180px] space-y-3 rounded-2xl border p-4" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-secondary)' }}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold font-mono tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
                Comments {!loadingComments && `(${taskComments.length})`}
              </h3>
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{DATA_SOURCE_LABEL}</span>
            </div>
            {loadingComments ? <div className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Loading comments…</div>
            : commentsError ? <div className="text-xs italic text-red-500">Failed to load comments. It will retry automatically.</div>
            : (
              <>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {taskComments.map(comment => (
                    <div key={comment.id} className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-primary)' }}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{comment.authorName}</span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{new Date(comment.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                      <div className="mt-1 text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{comment.body}</div>
                      <div className="mt-1.5 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{comment.authorType}</div>
                    </div>
                  ))}
                  {taskComments.length === 0 && <div className="rounded-xl border border-dashed px-3 py-3 text-xs" style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}>Belum ada komentar.</div>}
                </div>
                <div className="border-t pt-3" style={{ borderColor: 'var(--border-light)' }}>
                  <label htmlFor="edit-comment-author" className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Comment as</label>
                  <select id="edit-comment-author" value={commentAuthorKey} onChange={e => setCommentAuthorKey(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-xs" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-light)' }}>
                    <option value="">Choose a name…</option>
                    {authorOptions.map(person => <option key={`${person.type}:${person.id}`} value={`${person.type}:${person.id}`}>{person.name} · {person.type}</option>)}
                  </select>
                  <label htmlFor="edit-task-comment" className="block text-[11px] font-semibold mt-2 mb-1" style={{ color: 'var(--text-muted)' }}>Comment</label>
                  <textarea id="edit-task-comment" rows={3} value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Tulis update atau revisi…" className="w-full resize-y rounded-xl border px-3 py-2 text-xs leading-relaxed" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-light)' }} />
                  <div className="mt-2 flex justify-end">
                    <button type="button" onClick={handleSendComment} disabled={sendingComment || !commentText.trim() || !commentAuthorKey} className="rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{ background: 'var(--accent)' }}>{sendingComment ? 'Sending…' : 'Send comment'}</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </form>
  )
}
