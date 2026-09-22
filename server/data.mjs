import { Router } from 'express'
import { db } from './db.mjs'
import { deleteAttachmentFile, downloadAttachmentBuffer, safeAttachmentFileName, uploadAttachmentBuffer } from './ftp.mjs'
import { sendReopenEmail } from './mailer.mjs'

const router = Router()

const TASK_TYPES = new Set(['Bugs', 'Improvements'])
const TASK_STATUSES = new Set(['Open', 'Assign', 'In Progress', 'QC', 'Hold', 'Reopen', 'Reject', 'Done'])

function isReopened(oldStatus, newStatus) {
  return ['Done', 'QC'].includes(oldStatus) && ['Open', 'Reopen'].includes(newStatus)
}

const taskSelect = `
  select
    t.task_id, t.consultant_id, t.type, t.client_id, t.screen_report, t.request,
    t.status, t.programmer_id, t.sql_server, t.database_name, t.target_date,
    t.notes, t.is_archived, t.created_at, t.updated_at,
    c.consultant_name, cl.client_name, p.programmer_name
  from tasks t
  left join consultants c on c.consultant_id = t.consultant_id
  left join clients cl on cl.client_id = t.client_id
  left join programmers p on p.programmer_id = t.programmer_id
`

function success(data) {
  return { success: true, data }
}

function fail(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next)
}

function asIso(value) {
  if (!value) return ''
  return value instanceof Date ? value.toISOString() : String(value)
}

function asDateOnly(value) {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

function mapTask(row) {
  return {
    taskId: row.task_id,
    type: row.type,
    screenReport: row.screen_report,
    request: row.request,
    status: row.status,
    sqlServer: row.sql_server || '',
    databaseName: row.database_name || '',
    targetDate: asDateOnly(row.target_date),
    notes: row.notes || '',
    isArchived: Boolean(row.is_archived),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
    completedAt: row.status === 'Done' ? asIso(row.updated_at) : null,
    consultant: { id: row.consultant_id || '', name: row.consultant_name || '' },
    client: { id: row.client_id || '', name: row.client_name || '' },
    programmer: row.programmer_id
      ? { id: row.programmer_id, name: row.programmer_name || '' }
      : null,
  }
}

function mapHistory(row) {
  return {
    id: row.history_id,
    taskId: row.task_id,
    action: row.action,
    fieldName: row.field_name || '',
    oldValue: row.old_value || '',
    newValue: row.new_value || '',
    changedBy: row.changed_by || 'SYSTEM',
    changedAt: asIso(row.changed_at),
  }
}

function mapComment(row) {
  return {
    id: row.comment_id,
    taskId: row.task_id,
    authorType: row.author_type,
    authorId: row.author_id,
    authorName: row.author_name || row.author_id,
    body: row.comment_text || '',
    createdAt: asIso(row.created_at),
  }
}

function mapAttachment(row) {
  return {
    id: row.attachment_id,
    taskId: row.task_id,
    fileName: row.file_name,
    fileUrl: row.file_url || '',
    mimeType: row.mime_type || '',
    description: row.description || '',
    uploadedAt: asIso(row.uploaded_at),
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw fail('BAD_REQUEST', `${field} is required.`)
  return value.trim()
}

function validateTaskPayload(payload, partial = false) {
  if (!partial || payload.consultantId !== undefined) requiredText(payload.consultantId, 'consultantId')
  if (!partial || payload.clientId !== undefined) requiredText(payload.clientId, 'clientId')
  if (!partial || payload.screenReport !== undefined) requiredText(payload.screenReport, 'screenReport')
  if (!partial || payload.request !== undefined) requiredText(payload.request, 'request')
  if (!partial || payload.type !== undefined) {
    if (!TASK_TYPES.has(payload.type)) throw fail('BAD_REQUEST', 'Invalid task type.')
  }
  if (!partial || payload.status !== undefined) {
    if (!TASK_STATUSES.has(payload.status)) throw fail('BAD_REQUEST', 'Invalid task status.')
  }
  if (payload.targetDate !== undefined && payload.targetDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(payload.targetDate)) {
    throw fail('BAD_REQUEST', 'targetDate must use YYYY-MM-DD format.')
  }
}

async function nextId(client, kind) {
  const config = {
    task: { table: 'tasks', column: 'task_id', prefix: 'TASK-', start: 6 },
    history: { table: 'task_history', column: 'history_id', prefix: 'HIST-', start: 6 },
    comment: { table: 'task_comments', column: 'comment_id', prefix: 'CMT-', start: 5 },
    attachment: { table: 'attachments', column: 'attachment_id', prefix: 'ATT-', start: 5 },
    client: { table: 'clients', column: 'client_id', prefix: 'CLI-', start: 5 },
    consultant: { table: 'consultants', column: 'consultant_id', prefix: 'CON-', start: 5 },
    programmer: { table: 'programmers', column: 'programmer_id', prefix: 'PROG-', start: 6 },
  }[kind]

  if (!config) throw new Error(`Unknown ID kind: ${kind}`)
  await client.query('select pg_advisory_xact_lock(hashtext($1))', [`task-assignment:${kind}-id`])
  const result = await client.query(
    `select coalesce(max(case when ${config.column} ~ $1 then cast(substring(${config.column} from ${config.start}) as bigint) else 0 end), 0) as max_id from ${config.table}`,
    [`^${config.prefix}[0-9]+$`],
  )
  return `${config.prefix}${String(Number(result.rows[0].max_id) + 1).padStart(6, '0')}`
}

async function getTaskRow(client, taskId, forUpdate = false) {
  const result = await client.query(`${taskSelect} where t.task_id = $1`, [taskId])
  if (!result.rows[0]) throw fail('NOT_FOUND', `Task ${taskId} was not found.`)
  if (forUpdate) await client.query('select task_id from tasks where task_id = $1 for update', [taskId])
  return result.rows[0]
}

async function listMaster(table, idColumn, nameColumn, emailColumn = null) {
  const columns = emailColumn ? `${idColumn}, ${nameColumn}, ${emailColumn}, active` : `${idColumn}, ${nameColumn}, active`
  const result = await db.query(`select ${columns} from ${table} order by ${nameColumn}`)
  return result.rows.map(row => ({
    id: row[idColumn],
    name: row[nameColumn],
    ...(emailColumn ? { email: row[emailColumn] || '' } : {}),
    active: Boolean(row.active),
  }))
}

router.get('/tasks', asyncRoute(async (request, response) => {
  const includeArchived = request.query.includeArchived === 'true'
  const result = await db.query(`${taskSelect}${includeArchived ? '' : ' where t.is_archived = false'} order by t.updated_at desc nulls last, t.task_id desc`)
  response.json(success(result.rows.map(mapTask)))
}))

router.get('/tasks/:taskId', asyncRoute(async (request, response) => {
  response.json(success(mapTask(await getTaskRow(db, request.params.taskId))))
}))

router.post('/tasks', asyncRoute(async (request, response) => {
  const payload = request.body || {}
  validateTaskPayload(payload)
  const client = await db.connect()
  try {
    await client.query('begin')
    const taskId = await nextId(client, 'task')
    const now = new Date()
    await client.query(`
      insert into tasks (task_id, consultant_id, type, client_id, screen_report, request, status, programmer_id, sql_server, database_name, target_date, notes, is_archived, created_at, updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,$13,$13)
    `, [taskId, payload.consultantId, payload.type, payload.clientId, payload.screenReport.trim(), payload.request.trim(), payload.status, payload.programmerId || null, payload.sqlServer || '', payload.databaseName || '', payload.targetDate || null, payload.notes || '', now])
    const historyId = await nextId(client, 'history')
    await client.query(`insert into task_history (history_id, task_id, action, field_name, old_value, new_value, changed_by, changed_at) values ($1,$2,'CREATE','','','Task created','SYSTEM',$3)`, [historyId, taskId, now])
    await client.query('commit')
    response.status(201).json(success({ taskId }))
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}))

const taskColumnMap = {
  consultantId: 'consultant_id', clientId: 'client_id', type: 'type', screenReport: 'screen_report',
  request: 'request', status: 'status', programmerId: 'programmer_id', sqlServer: 'sql_server',
  databaseName: 'database_name', targetDate: 'target_date', notes: 'notes',
}

router.patch('/tasks/:taskId', asyncRoute(async (request, response) => {
  const payload = request.body || {}
  validateTaskPayload(payload, true)
  const client = await db.connect()
  try {
    await client.query('begin')
    const oldRow = await getTaskRow(client, request.params.taskId, true)
    const changes = Object.entries(taskColumnMap)
      .filter(([key]) => payload[key] !== undefined)
      .map(([key, column]) => ({ key, column, value: payload[key] === '' && ['programmerId', 'targetDate'].includes(key) ? null : payload[key] }))
      .filter(change => String(oldRow[change.column] ?? '') !== String(change.value ?? ''))

    if (changes.length > 0) {
      const values = changes.map(change => change.value)
      const assignments = changes.map((change, index) => `${change.column} = $${index + 1}`)
      values.push(new Date(), request.params.taskId)
      await client.query(`update tasks set ${assignments.join(', ')}, updated_at = $${values.length - 1} where task_id = $${values.length}`, values)

      for (const change of changes) {
        const historyId = await nextId(client, 'history')
        const action = change.key === 'status' && change.value === 'Done' && oldRow.status !== 'Done' ? 'COMPLETE' : 'UPDATE'
        await client.query(`insert into task_history (history_id, task_id, action, field_name, old_value, new_value, changed_by, changed_at) values ($1,$2,$3,$4,$5,$6,'SYSTEM',$7)`, [historyId, request.params.taskId, action, change.column, oldRow[change.column] ?? '', change.value ?? '', new Date()])
      }
    }
    await client.query('commit')

    const statusChange = changes.find(change => change.key === 'status')
    if (statusChange && isReopened(oldRow.status, statusChange.value)) {
      const programmer = await db.query(`
        select p.programmer_email
        from tasks t
        left join programmers p on p.programmer_id = t.programmer_id
        where t.task_id = $1
      `, [request.params.taskId])
      const programmerEmail = programmer.rows[0]?.programmer_email || ''
      try {
        const result = await sendReopenEmail({
          to: programmerEmail,
          taskId: request.params.taskId,
          oldStatus: oldRow.status,
          newStatus: statusChange.value,
        })
        if (!result.sent) console.warn(`[data-api] Reopen email not sent for ${request.params.taskId}: ${result.reason}`)
      } catch (error) {
        console.error(`[data-api] Reopen email failed for ${request.params.taskId}:`, error)
      }
    }
    response.json(success({ updated: changes.length > 0 }))
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}))

router.post('/tasks/:taskId/archive', asyncRoute(async (request, response) => {
  const client = await db.connect()
  try {
    await client.query('begin')
    const oldRow = await getTaskRow(client, request.params.taskId, true)
    if (!oldRow.is_archived) {
      const now = new Date()
      await client.query('update tasks set is_archived = true, updated_at = $1 where task_id = $2', [now, request.params.taskId])
      const historyId = await nextId(client, 'history')
      await client.query(`insert into task_history (history_id, task_id, action, field_name, old_value, new_value, changed_by, changed_at) values ($1,$2,'ARCHIVE','is_archived','FALSE','TRUE','SYSTEM',$3)`, [historyId, request.params.taskId, now])
    }
    await client.query('commit')
    response.json(success({ archived: true }))
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}))

router.get('/clients', asyncRoute(async (_request, response) => response.json(success(await listMaster('clients', 'client_id', 'client_name')))))
router.get('/consultants', asyncRoute(async (_request, response) => response.json(success(await listMaster('consultants', 'consultant_id', 'consultant_name', 'consultant_email')))))
router.get('/programmers', asyncRoute(async (_request, response) => response.json(success(await listMaster('programmers', 'programmer_id', 'programmer_name', 'programmer_email')))))

async function createMaster(request, response, kind, table, idColumn, nameColumn, emailColumn = null) {
  const name = requiredText(request.body?.name, 'name')
  const email = emailColumn ? String(request.body?.email || '').trim() : undefined
  const client = await db.connect()
  try {
    await client.query('begin')
    const id = await nextId(client, kind)
    const columns = [idColumn, nameColumn, ...(emailColumn ? [emailColumn] : []), 'active']
    const values = [id, name, ...(emailColumn ? [email] : []), true]
    await client.query(`insert into ${table} (${columns.join(', ')}) values (${values.map((_, index) => `$${index + 1}`).join(', ')})`, values)
    await client.query('commit')
    response.status(201).json(success({ id }))
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

router.post('/clients', asyncRoute((request, response) => createMaster(request, response, 'client', 'clients', 'client_id', 'client_name')))
router.post('/consultants', asyncRoute((request, response) => createMaster(request, response, 'consultant', 'consultants', 'consultant_id', 'consultant_name', 'consultant_email')))
router.post('/programmers', asyncRoute((request, response) => createMaster(request, response, 'programmer', 'programmers', 'programmer_id', 'programmer_name', 'programmer_email')))

async function updateMaster(request, response, table, idColumn, nameColumn, emailColumn = null) {
  const fields = []
  const values = []
  if (request.body?.name !== undefined) { fields.push(`${nameColumn} = $${values.length + 1}`); values.push(requiredText(request.body.name, 'name')) }
  if (emailColumn && request.body?.email !== undefined) { fields.push(`${emailColumn} = $${values.length + 1}`); values.push(String(request.body.email || '').trim()) }
  if (request.body?.active !== undefined) { fields.push(`active = $${values.length + 1}`); values.push(Boolean(request.body.active)) }
  if (!fields.length) throw fail('BAD_REQUEST', 'No fields to update.')
  values.push(request.params.id)
  const result = await db.query(`update ${table} set ${fields.join(', ')} where ${idColumn} = $${values.length}`, values)
  if (!result.rowCount) throw fail('NOT_FOUND', 'Master data record was not found.')
  response.json(success({ updated: true }))
}

router.patch('/clients/:id', asyncRoute((request, response) => updateMaster(request, response, 'clients', 'client_id', 'client_name')))
router.patch('/consultants/:id', asyncRoute((request, response) => updateMaster(request, response, 'consultants', 'consultant_id', 'consultant_name', 'consultant_email')))
router.patch('/programmers/:id', asyncRoute((request, response) => updateMaster(request, response, 'programmers', 'programmer_id', 'programmer_name', 'programmer_email')))

router.get('/tasks/:taskId/history', asyncRoute(async (request, response) => {
  const result = await db.query('select * from task_history where task_id = $1 order by changed_at desc nulls last, history_id desc', [request.params.taskId])
  response.json(success(result.rows.map(mapHistory)))
}))

router.get('/history/recent', asyncRoute(async (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit || 50), 1), 200)
  const result = await db.query('select * from task_history order by changed_at desc nulls last, history_id desc limit $1', [limit])
  response.json(success(result.rows.map(mapHistory)))
}))

const commentSelect = `
  select c.comment_id, c.task_id, c.author_type, c.author_id, c.comment_text, c.created_at,
    case when c.author_type = 'Consultant' then co.consultant_name
         when c.author_type = 'Programmer' then pr.programmer_name
         else null end as author_name
  from task_comments c
  left join consultants co on c.author_type = 'Consultant' and co.consultant_id = c.author_id
  left join programmers pr on c.author_type = 'Programmer' and pr.programmer_id = c.author_id
`

router.get('/tasks/:taskId/comments', asyncRoute(async (request, response) => {
  const result = await db.query(`${commentSelect} where c.task_id = $1 order by c.created_at asc, c.comment_id asc`, [request.params.taskId])
  response.json(success(result.rows.map(mapComment)))
}))

router.post('/tasks/:taskId/comments', asyncRoute(async (request, response) => {
  const authorType = request.body?.authorType
  const authorId = requiredText(request.body?.authorId, 'authorId')
  const body = requiredText(request.body?.body, 'body')
  if (!['Consultant', 'Programmer'].includes(authorType)) throw fail('BAD_REQUEST', 'Invalid comment author type.')
  const task = await db.query('select consultant_id, programmer_id from tasks where task_id = $1', [request.params.taskId])
  if (!task.rows[0]) throw fail('NOT_FOUND', 'Task was not found.')
  const allowedId = authorType === 'Consultant' ? task.rows[0].consultant_id : task.rows[0].programmer_id
  if (!allowedId || allowedId !== authorId) throw fail('FORBIDDEN', 'Comment author must be assigned to this task.')
  const client = await db.connect()
  try {
    await client.query('begin')
    const commentId = await nextId(client, 'comment')
    await client.query('insert into task_comments (comment_id, task_id, author_type, author_id, comment_text, created_at) values ($1,$2,$3,$4,$5,$6)', [commentId, request.params.taskId, authorType, authorId, body, new Date()])
    await client.query('commit')
    const result = await db.query(`${commentSelect} where c.comment_id = $1`, [commentId])
    response.status(201).json(success(mapComment(result.rows[0])))
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}))

router.get('/tasks/:taskId/attachments', asyncRoute(async (request, response) => {
  const result = await db.query(`select attachment_id, task_id, file_name, mime_type, description, uploaded_at from attachments where task_id = $1 order by uploaded_at desc nulls last`, [request.params.taskId])
  const apiOrigin = (process.env.PUBLIC_API_URL || process.env.BETTER_AUTH_URL || '').replace(/\/$/, '')
  response.json(success(result.rows.map(row => mapAttachment({
    ...row,
    file_url: `${apiOrigin}/api/data/attachments/${encodeURIComponent(row.attachment_id)}/file`,
  }))))
}))

router.get('/attachments/:attachmentId/file', asyncRoute(async (request, response) => {
  const result = await db.query('select storage_key, mime_type, file_name from attachments where attachment_id = $1', [request.params.attachmentId])
  if (!result.rows[0]) throw fail('NOT_FOUND', 'Attachment was not found.')
  const bytes = await downloadAttachmentBuffer(result.rows[0].storage_key)
  response.set({
    'Content-Type': result.rows[0].mime_type || 'application/octet-stream',
    'Content-Length': String(bytes.length),
    'Content-Disposition': `inline; filename="${String(result.rows[0].file_name).replace(/["]+/g, '')}"`,
    'Cache-Control': 'private, no-store',
  })
  response.send(bytes)
}))

router.post('/tasks/:taskId/attachments', asyncRoute(async (request, response) => {
  const payload = request.body || {}
  const fileName = safeAttachmentFileName(payload.fileName)
  const mimeType = requiredText(payload.mimeType, 'mimeType')
  const contentBase64 = requiredText(payload.contentBase64, 'contentBase64')
  const bytes = Buffer.from(contentBase64, 'base64')
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw fail('BAD_REQUEST', 'Attachment must be between 1 byte and 5 MB.')

  const client = await db.connect()
  let storageKey = ''
  let uploaded = false
  try {
    await client.query('begin')
    await getTaskRow(client, request.params.taskId)
    const attachmentId = await nextId(client, 'attachment')
    storageKey = `${request.params.taskId}/${attachmentId}_${fileName}`
    const now = new Date()
    await client.query(`insert into attachments (attachment_id, task_id, file_name, storage_key, mime_type, description, uploaded_at) values ($1,$2,$3,$4,$5,$6,$7)`, [attachmentId, request.params.taskId, fileName, storageKey, mimeType, String(payload.description || '').trim(), now])
    await uploadAttachmentBuffer(storageKey, bytes)
    uploaded = true
    await client.query('commit')
    const apiOrigin = (process.env.PUBLIC_API_URL || process.env.BETTER_AUTH_URL || '').replace(/\/$/, '')
    response.status(201).json(success({
      attachmentId,
      fileUrl: `${apiOrigin}/api/data/attachments/${encodeURIComponent(attachmentId)}/file`,
    }))
  } catch (error) {
    await client.query('rollback')
    if (uploaded && storageKey) await deleteAttachmentFile(storageKey).catch(() => {})
    throw error
  } finally {
    client.release()
  }
}))

router.delete('/attachments/:attachmentId', asyncRoute(async (request, response) => {
  const result = await db.query('select storage_key from attachments where attachment_id = $1', [request.params.attachmentId])
  if (!result.rows[0]) throw fail('NOT_FOUND', 'Attachment was not found.')
  await deleteAttachmentFile(result.rows[0].storage_key)
  await db.query('delete from attachments where attachment_id = $1', [request.params.attachmentId])
  response.json(success({ deleted: true }))
}))

export const dataRouter = router
