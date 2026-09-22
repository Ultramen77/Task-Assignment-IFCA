import pg from 'pg'

const { Client } = pg

const taskId = process.argv.find(argument => argument.startsWith('--task='))?.slice('--task='.length)
const sourceUrl = process.env.SOURCE_SUPABASE_URL?.replace(/\/$/, '')
const sourceKey = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY
const targetDatabaseUrl = process.env.TARGET_DATABASE_URL?.replace(/([?&])sslmode=require([&]|$)/i, '$1sslmode=disable$2')

if (!taskId || !sourceUrl || !sourceKey || !targetDatabaseUrl) {
  throw new Error('Use --task=TASK-XXXXXX and configure SOURCE_SUPABASE_URL, SOURCE_SUPABASE_SERVICE_ROLE_KEY, and TARGET_DATABASE_URL.')
}

const sourceHeaders = {
  apikey: sourceKey,
  Authorization: `Bearer ${sourceKey}`,
}

async function readTable(table, select) {
  const query = new URLSearchParams({ select, task_id: `eq.${taskId}` })
  const response = await fetch(`${sourceUrl}/rest/v1/${table}?${query}`, { headers: sourceHeaders })
  if (!response.ok) throw new Error(`Supabase ${table} request failed (${response.status}).`)
  return response.json()
}

async function readSource() {
  const [tasks, history, comments, attachments] = await Promise.all([
    readTable('tasks', 'task_id, consultant_id, type, client_id, screen_report, request, status, programmer_id, sql_server, database_name, target_date, notes, is_archived, created_at, updated_at'),
    readTable('task_history', 'history_id, task_id, action, field_name, old_value, new_value, changed_by, changed_at'),
    readTable('task_comments', 'comment_id, task_id, author_type, author_id, comment_text, created_at'),
    readTable('attachments', 'attachment_id, task_id, file_name, storage_key, mime_type, description, uploaded_at'),
  ])

  return {
    task: tasks[0] || null,
    history: history || [],
    comments: comments || [],
    attachments: attachments || [],
  }
}

async function assertForeignKeys(client, task) {
  const checks = [
    ['consultants', 'consultant_id', task.consultant_id],
    ['clients', 'client_id', task.client_id],
    ['programmers', 'programmer_id', task.programmer_id],
  ].filter(([, , id]) => id)

  for (const [table, column, id] of checks) {
    const result = await client.query(`select 1 from ${table} where ${column} = $1`, [id])
    if (!result.rowCount) throw new Error(`Missing target ${table} record ${id}; task sync stopped.`)
  }
}

async function sync() {
  const source = await readSource()
  if (!source.task) throw new Error(`Source task ${taskId} was not found.`)

  const client = new Client({ connectionString: targetDatabaseUrl, ssl: false })
  await client.connect()
  try {
    await client.query('begin')
    await assertForeignKeys(client, source.task)

    const task = source.task
    await client.query(`
      insert into tasks (task_id, consultant_id, type, client_id, screen_report, request, status, programmer_id, sql_server, database_name, target_date, notes, is_archived, created_at, updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      on conflict (task_id) do nothing
    `, [task.task_id, task.consultant_id, task.type, task.client_id, task.screen_report, task.request, task.status, task.programmer_id, task.sql_server, task.database_name, task.target_date, task.notes, task.is_archived, task.created_at, task.updated_at])

    for (const row of source.history) {
      await client.query(`
        insert into task_history (history_id, task_id, action, field_name, old_value, new_value, changed_by, changed_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (history_id) do nothing
      `, [row.history_id, row.task_id, row.action, row.field_name, row.old_value, row.new_value, row.changed_by, row.changed_at])
    }

    for (const row of source.comments) {
      await client.query(`
        insert into task_comments (comment_id, task_id, author_type, author_id, comment_text, created_at)
        values ($1,$2,$3,$4,$5,$6)
        on conflict (comment_id) do nothing
      `, [row.comment_id, row.task_id, row.author_type, row.author_id, row.comment_text, row.created_at])
    }

    for (const row of source.attachments) {
      await client.query(`
        insert into attachments (attachment_id, task_id, file_name, storage_key, mime_type, description, uploaded_at)
        values ($1,$2,$3,$4,$5,$6,$7)
        on conflict (attachment_id) do nothing
      `, [row.attachment_id, row.task_id, row.file_name, row.storage_key, row.mime_type, row.description, row.uploaded_at])
    }

    await client.query('commit')
    console.log(`SYNC=SUCCESS task=${taskId} history=${source.history.length} comments=${source.comments.length} attachments=${source.attachments.length}`)
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.end()
  }
}

sync().catch(error => {
  console.error(`SYNC=FAILED ${error instanceof Error ? error.message : 'Unknown error'}`)
  process.exitCode = 1
})
