/* eslint-disable react/set-state-in-effect */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useTasks } from '../context/TaskContext'
import { useToast } from '../context/ToastContext'
import { DATA_SOURCE_LABEL } from '../lib/dataSourceLabel'
import type { TaskHistory, Attachment, TaskComment, CommentAuthorType } from '../types/task.types'
import StatusBadge from './StatusBadge'
import TaskTypeBadge from './TaskTypeBadge'
import DeadlineIndicator from './DeadlineIndicator'
import ImageViewer from './ImageViewer'
import ConfirmDialog from './ConfirmDialog'
import { fieldLabel, resolveDisplayValue } from '../lib/historyDisplay'
import { uploadFilesSequentially, validateAttachmentFile } from '../lib/attachments'
import { IconPencil, IconArchive, IconX, IconTrash, IconUpload, IconClipboardText, IconHistory, IconMessageCircle, IconSend } from '@tabler/icons-react'

interface TaskDetailProps {
  taskId: string
  onClose: () => void
  onEdit: (taskId: string) => void
}

function Field({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[11px] text-slate-400 mb-0.5">{label}</div>
      <div className="text-[13px] text-slate-800">{value}</div>
    </div>
  )
}

export default function TaskDetail({ taskId, onClose, onEdit }: TaskDetailProps) {
  const { tasks, consultants, clients, programmers, archiveTask, fetchTaskHistory, fetchTaskAttachments, fetchTaskComments, createTaskComment, uploadAttachment, deleteAttachment } = useTasks()
  const { addToast } = useToast()
  const [activeImageIndex, setActiveImageIndex] = useState<number>(-1)
  const [taskHistory, setTaskHistory] = useState<TaskHistory[]>([])
  const [taskAttachments, setTaskAttachments] = useState<Attachment[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingAttachments, setLoadingAttachments] = useState(true)
  const [historyError, setHistoryError] = useState(false)
  const [attachmentsError, setAttachmentsError] = useState(false)
  const [taskComments, setTaskComments] = useState<TaskComment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentsError, setCommentsError] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentAuthorKey, setCommentAuthorKey] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const addFilesRef = useRef<HTMLInputElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null)
  const [deleting, setDeleting] = useState(false)
  const task = useMemo(() => tasks.find(t => t.id === taskId), [tasks, taskId])
  const masters = useMemo(() => ({ consultants, clients, programmers }), [consultants, clients, programmers])
  const authorOptions = useMemo(() => [
    ...consultants.filter(person => person.name === task?.consultant).map(person => ({ type: 'Consultant' as const, id: person.id, name: person.name })),
    ...programmers.filter(person => person.name === task?.programmer).map(person => ({ type: 'Programmer' as const, id: person.id, name: person.name })),
  ], [consultants, programmers, task?.consultant, task?.programmer])
  const loadComments = useCallback(async () => {
    setLoadingComments(true); setCommentsError(false)
    try { setTaskComments(await fetchTaskComments(taskId)) } catch { setCommentsError(true) } finally { setLoadingComments(false) }
  }, [taskId, fetchTaskComments])
  const loadDetails = useCallback(async () => {
    setLoadingHistory(true); setLoadingAttachments(true); setHistoryError(false); setAttachmentsError(false); setBrokenImages(new Set())
    try { const hist = await fetchTaskHistory(taskId); setTaskHistory(hist) } catch { setHistoryError(true) } finally { setLoadingHistory(false) }
    try { const atts = await fetchTaskAttachments(taskId); setTaskAttachments(atts) } catch { setAttachmentsError(true) } finally { setLoadingAttachments(false) }
    await loadComments()
  }, [taskId, fetchTaskHistory, fetchTaskAttachments, loadComments])
  useEffect(() => { loadDetails() }, [loadDetails])
  useEffect(() => {
    if (!commentAuthorKey) {
      const preferred = authorOptions.find(person => person.name === task?.consultant)
        || authorOptions.find(person => person.name === task?.programmer)
      if (preferred) setCommentAuthorKey(`${preferred.type}:${preferred.id}`)
    }
  }, [authorOptions, commentAuthorKey, task?.consultant, task?.programmer])
  useEffect(() => {
    const intervalId = window.setInterval(() => { void loadComments() }, 15000)
    return () => window.clearInterval(intervalId)
  }, [loadComments])
  if (!task) return <div className="p-4 font-mono text-xs text-slate-400">Task not found: {taskId}</div>
  const handleArchive = async () => {
    setArchiving(true)
    try { await archiveTask(task.id); addToast('success', `Task ${task.id} archived.`); setShowArchiveConfirm(false); onClose() }
    catch (err: any) { addToast('error', err.message || 'Archive failed'); setArchiving(false) }
  }
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = commentText.trim()
    const [authorType, authorId] = commentAuthorKey.split(':') as [CommentAuthorType, string]
    if (!body || !authorType || !authorId || sendingComment) return
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
  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []); e.target.value = ''; if (!selected.length) return
    const pending = selected.filter(f => { const m = validateAttachmentFile(f); if (m) { addToast('error', `${f.name}: ${m}`); return false } return true }).map(file => ({ file, description: '', previewUrl: URL.createObjectURL(file) }))
    if (!pending.length) return; setUploading(true)
    try {
      const result = await uploadFilesSequentially(pending, taskId, p => uploadAttachment(p), (c,t) => addToast('info', `Uploading ${c} of ${t}...`))
      if (result.failed.length) { addToast('success', `${result.succeeded} of ${pending.length} uploaded.`); addToast('error', `Failed: ${result.failed.join(', ')}`) }
      else addToast('success', `Attachment${pending.length===1?'':'s'} uploaded.`)
    } finally { pending.forEach(p => URL.revokeObjectURL(p.previewUrl)); setUploading(false); await loadDetails() }
  }
  const handlePasteUpload = async (e: React.ClipboardEvent) => {
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
    e.preventDefault()
    const pending = pasted.filter(f => { const m = validateAttachmentFile(f); if (m) { addToast('error', `${f.name}: ${m}`); return false } return true }).map(file => ({ file, description: '', previewUrl: URL.createObjectURL(file) }))
    if (!pending.length) return
    addToast('info', `Pasting ${pending.length} screenshot...`)
    setUploading(true)
    try {
      const result = await uploadFilesSequentially(pending, taskId, p => uploadAttachment(p), (c,t) => addToast('info', `Uploading ${c} of ${t}...`))
      if (result.failed.length) { addToast('success', `${result.succeeded} of ${pending.length} uploaded.`); addToast('error', `Failed: ${result.failed.join(', ')}`) }
      else addToast('success', `${pending.length} screenshot pasted & uploaded.`)
    } finally { pending.forEach(p => URL.revokeObjectURL(p.previewUrl)); setUploading(false); await loadDetails() }
  }
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return; setDeleting(true)
    try { await deleteAttachment(deleteTarget.id); addToast('success', 'Attachment deleted.'); setDeleteTarget(null); await loadDetails() }
    catch (err: any) { addToast('error', err.message || 'Delete failed') } finally { setDeleting(false) }
  }
  return (
    <div className="flex flex-col h-full text-sm" onPaste={handlePasteUpload}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-slate-600">{task.id}</span>
            <StatusBadge status={task.status} />
            <TaskTypeBadge type={task.type} />
          </div>
          <h2 className="mt-1.5 text-lg font-semibold text-slate-900 leading-tight truncate">{task.client}</h2>
          <p className="text-xs text-slate-500 font-mono truncate">{task.screenReport}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onEdit(task.id)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors"
            style={{ background: 'var(--accent)' }}
          >
            <IconPencil size={13} stroke={2} /> Edit
          </button>
          {!task.archived && (
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50"
            >
              <IconArchive size={13} stroke={2} /> Archive
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close task detail"
            className="rounded-lg p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <IconX size={18} stroke={1.75} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 divide-y divide-slate-100">
        {/* Key facts */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Consultant" value={task.consultant} />
          <Field label="Programmer" value={task.programmer || <span className="italic text-slate-400">Unassigned</span>} />
          <Field label="Target date" value={<span className="font-mono">{task.targetDate || 'No target'}</span>} />
          <div>
            <div className="text-[11px] text-slate-400 mb-1">Deadline</div>
            <DeadlineIndicator task={task} />
          </div>
          <Field label="SQL Server" value={<span className="font-mono text-slate-600">{task.sqlServer || '—'}</span>} />
          <Field label="Database" value={<span className="font-mono text-slate-600">{task.database || '—'}</span>} />
        </div>

        {/* Request */}
        <div className="pt-5">
          <div className="flex items-center gap-1.5 mb-2 text-[13px] font-semibold text-slate-700">
            <IconClipboardText size={14} stroke={1.75} /> Request details
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed border border-slate-100">{task.request}</div>
        </div>

        {/* Notes */}
        {task.notes && (
          <div className="pt-5">
            <div className="text-[13px] font-semibold text-slate-700 mb-2">Additional notes</div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap border border-slate-100">{task.notes}</div>
          </div>
        )}

        {/* Attachments */}
        <div className="pt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-semibold text-slate-700">
              Attachments {!loadingAttachments && `(${taskAttachments.length})`}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">Ctrl+V paste</span>
              <button
                type="button"
                onClick={() => addFilesRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                <IconUpload size={13} stroke={2} /> {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
          <input ref={addFilesRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleAddFiles} />
          {loadingAttachments ? <div className="text-xs text-slate-400 italic">Loading attachments…</div>
          : attachmentsError ? <div className="text-xs text-red-500 italic">Failed to load attachments.</div>
          : taskAttachments.length === 0 ? <div className="text-xs text-slate-400 italic">No attachments yet.</div>
          : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {taskAttachments.map((att, idx) => (
                <div key={att.id} onClick={() => setActiveImageIndex(idx)} className="group relative cursor-pointer rounded-xl overflow-hidden border border-slate-200 hover:border-slate-300">
                  {brokenImages.has(att.id) ? <div className="h-24 grid place-items-center bg-slate-50 text-[11px] text-slate-400 font-mono">Image unavailable</div>
                  : <img src={att.fileUrl} alt={att.description || att.fileName} onError={() => setBrokenImages(s => new Set(s).add(att.id))} className="h-24 w-full object-cover" />}
                  <div className="px-2 py-1 text-[10px] font-mono text-slate-500 truncate border-t border-slate-100">{att.fileName}</div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(att) }}
                    aria-label={`Delete ${att.fileName}`}
                    className="absolute top-1.5 right-1.5 rounded-lg bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity"
                  >
                    <IconTrash size={12} stroke={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="pt-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
              <IconMessageCircle size={14} stroke={1.75} /> Comments {!loadingComments && `(${taskComments.length})`}
            </div>
            <span className="text-[10px] font-mono text-slate-400">{DATA_SOURCE_LABEL}</span>
          </div>
          {loadingComments ? <div className="text-xs text-slate-400 italic">Loading comments…</div>
          : commentsError ? <div className="text-xs text-red-500 italic">Failed to load comments. It will retry automatically.</div>
          : (
            <>
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {taskComments.map(comment => (
                  <div key={comment.id} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <div className="text-[12px] font-semibold text-slate-800">{comment.authorName}</div>
                      <div className="text-[10px] font-mono text-slate-400 shrink-0">{new Date(comment.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    </div>
                    <div className="text-[12px] text-slate-600 whitespace-pre-wrap leading-relaxed">{comment.body}</div>
                    <div className="mt-2 text-[10px] font-mono text-slate-400">{comment.authorType}</div>
                  </div>
                ))}
                {taskComments.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-xs text-slate-400">Belum ada komentar. Tambahkan konteks pertama untuk assignment ini.</div>}
              </div>
              <form onSubmit={handleSendComment} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label htmlFor="comment-author" className="block text-[11px] font-semibold text-slate-500 mb-1.5">Comment as</label>
                <select id="comment-author" value={commentAuthorKey} onChange={e => setCommentAuthorKey(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-200">
                  <option value="">Choose a name…</option>
                  {authorOptions.map(person => <option key={`${person.type}:${person.id}`} value={`${person.type}:${person.id}`}>{person.name} · {person.type}</option>)}
                </select>
                <label htmlFor="task-comment" className="block text-[11px] font-semibold text-slate-500 mt-3 mb-1.5">Comment</label>
                <textarea id="task-comment" rows={4} value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Tulis update, pertanyaan, atau revisi yang dibutuhkan…" className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-200" />
                <div className="mt-2 flex justify-end">
                  <button type="submit" disabled={sendingComment || !commentText.trim() || !commentAuthorKey} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{ background: 'var(--accent)' }}>
                    <IconSend size={13} stroke={2} /> {sendingComment ? 'Sending…' : 'Send comment'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Activity */}
        <div className="pt-5">
          <div className="flex items-center gap-1.5 mb-3 text-[13px] font-semibold text-slate-700">
            <IconHistory size={14} stroke={1.75} /> Activity
          </div>
          {loadingHistory ? <div className="text-xs text-slate-400 italic">Loading activity…</div>
          : historyError ? <div className="text-xs text-red-500 italic">Failed to load activity.</div>
          : (
            <div className="space-y-4">
              {taskHistory.map(log => (
                <div key={log.id} className="relative pl-4 border-l border-slate-200">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[11px] font-mono font-bold text-slate-500">{log.action}</span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">{log.timestamp}</span>
                  </div>
                  <div className="text-[12px] text-slate-600 mt-0.5">
                    {log.action === 'CREATE' && 'Task created'}
                    {log.action === 'COMPLETE' && 'Task marked Done'}
                    {log.action === 'ARCHIVE' && 'Task archived'}
                    {log.action === 'UPDATE' && <span>Changed <span className="font-semibold text-slate-800">{fieldLabel(log.field)}</span>: <span className="line-through text-slate-400">{resolveDisplayValue(log.field, log.oldValue, masters)}</span> → <span className="font-semibold text-slate-800">{resolveDisplayValue(log.field, log.newValue, masters)}</span></span>}
                  </div>
                </div>
              ))}
              {taskHistory.length === 0 && <div className="text-xs text-slate-400 italic">No activity yet.</div>}
            </div>
          )}
        </div>
      </div>

      {activeImageIndex >= 0 && <ImageViewer key={activeImageIndex} images={taskAttachments} currentIndex={activeImageIndex} onIndexChange={setActiveImageIndex} onClose={() => setActiveImageIndex(-1)} />}
      <ConfirmDialog open={showArchiveConfirm} title="Archive task?" message={`Task ${task.id} will be moved to Archived.`} confirmLabel="Archive Task" destructive loading={archiving} onConfirm={handleArchive} onCancel={() => setShowArchiveConfirm(false)} />
      <ConfirmDialog open={deleteTarget !== null} title="Delete attachment?" message="This attachment will be removed." confirmLabel="Delete Attachment" destructive loadingLabel="Deleting..." loading={deleting} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}
