import { Client } from 'pg'

const SOURCE_TABLES = [
  { name: 'consultants', primaryKey: 'consultant_id', columns: ['consultant_id', 'consultant_name', 'active', 'consultant_email'] },
  { name: 'clients', primaryKey: 'client_id', columns: ['client_id', 'client_name', 'active'] },
  { name: 'programmers', primaryKey: 'programmer_id', columns: ['programmer_id', 'programmer_name', 'active', 'programmer_email'] },
  { name: 'tasks', primaryKey: 'task_id', columns: ['task_id', 'consultant_id', 'type', 'client_id', 'screen_report', 'request', 'status', 'programmer_id', 'sql_server', 'database_name', 'target_date', 'notes', 'is_archived', 'created_at', 'updated_at'] },
  { name: 'task_history', primaryKey: 'history_id', columns: ['history_id', 'task_id', 'action', 'field_name', 'old_value', 'new_value', 'changed_by', 'changed_at'] },
  { name: 'task_comments', primaryKey: 'comment_id', columns: ['comment_id', 'task_id', 'author_type', 'author_id', 'comment_text', 'created_at'] },
  { name: 'attachments', primaryKey: 'attachment_id', columns: ['attachment_id', 'task_id', 'file_name', 'storage_key', 'mime_type', 'description', 'uploaded_at'] },
]

const SOURCE_URL = process.env.SOURCE_SUPABASE_URL?.replace(/\/$/, '')
const SOURCE_KEY = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY
const TARGET_URL = process.env.TARGET_DATABASE_URL?.replace(/([?&])sslmode=require([&]|$)/, '$1sslmode=disable$2')

if (!SOURCE_URL || !SOURCE_KEY || !TARGET_URL) {
  throw new Error('SOURCE_SUPABASE_URL, SOURCE_SUPABASE_SERVICE_ROLE_KEY, and TARGET_DATABASE_URL are required.')
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`
}

async function fetchAllRows(table) {
  const rows = []
  const pageSize = 500

  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`${SOURCE_URL}/rest/v1/${table.name}`)
    url.searchParams.set('select', table.columns.join(','))
    url.searchParams.set('order', `${table.primaryKey}.asc`)
    url.searchParams.set('limit', String(pageSize))
    url.searchParams.set('offset', String(offset))

    const response = await fetch(url, {
      headers: {
        apikey: SOURCE_KEY,
        Authorization: `Bearer ${SOURCE_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Supabase ${table.name} fetch failed with HTTP ${response.status}.`)
    }

    const page = await response.json()
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

const createStatements = [
  `create table "consultants" (
    "consultant_id" text primary key,
    "consultant_name" text not null,
    "active" boolean not null default true,
    "consultant_email" text
  )`,
  `create table "clients" (
    "client_id" text primary key,
    "client_name" text not null,
    "active" boolean not null default true
  )`,
  `create table "programmers" (
    "programmer_id" text primary key,
    "programmer_name" text not null,
    "active" boolean not null default true,
    "programmer_email" text
  )`,
  `create table "tasks" (
    "task_id" text primary key,
    "consultant_id" text references "consultants"("consultant_id"),
    "type" text not null,
    "client_id" text references "clients"("client_id"),
    "screen_report" text not null,
    "request" text not null,
    "status" text not null,
    "programmer_id" text references "programmers"("programmer_id"),
    "sql_server" text,
    "database_name" text,
    "target_date" date,
    "notes" text,
    "is_archived" boolean not null default false,
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone
  )`,
  `create table "task_history" (
    "history_id" text primary key,
    "task_id" text references "tasks"("task_id") not null,
    "action" text not null,
    "field_name" text,
    "old_value" text,
    "new_value" text,
    "changed_by" text,
    "changed_at" timestamp without time zone
  )`,
  `create table "task_comments" (
    "comment_id" text primary key,
    "task_id" text references "tasks"("task_id") not null,
    "author_type" text not null,
    "author_id" text not null,
    "comment_text" text not null,
    "created_at" timestamp with time zone
  )`,
  `create table "attachments" (
    "attachment_id" text primary key,
    "task_id" text references "tasks"("task_id") not null,
    "file_name" text not null,
    "storage_key" text not null,
    "mime_type" text,
    "description" text,
    "uploaded_at" timestamp without time zone
  )`,
  'create index "tasks_status_idx" on "tasks" ("status")',
  'create index "tasks_target_date_idx" on "tasks" ("target_date")',
  'create index "task_history_task_id_idx" on "task_history" ("task_id")',
  'create index "task_comments_task_created_idx" on "task_comments" ("task_id", "created_at")',
  'create index "attachments_task_id_idx" on "attachments" ("task_id")',
]

async function assertTargetIsEmpty(client) {
  const result = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  `)
  if (result.rows.length > 0) {
    throw new Error(`Target database is not empty: ${result.rows.map(row => row.table_name).join(', ')}`)
  }
}

async function insertRows(client, table, rows) {
  if (rows.length === 0) return

  const identifiers = table.columns.map(quoteIdentifier).join(', ')
  const batchSize = 100
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize)
    const values = []
    const tuples = batch.map(row => {
      const placeholders = table.columns.map(column => {
        values.push(row[column] ?? null)
        return `$${values.length}`
      })
      return `(${placeholders.join(', ')})`
    })
    await client.query(`insert into ${quoteIdentifier(table.name)} (${identifiers}) values ${tuples.join(', ')}`, values)
  }
}

const client = new Client({
  connectionString: TARGET_URL,
  ssl: false,
  connectionTimeoutMillis: 15000,
})

try {
  const sourceRows = new Map()
  for (const table of SOURCE_TABLES) {
    const rows = await fetchAllRows(table)
    sourceRows.set(table.name, rows)
    console.log(`[source] ${table.name}: ${rows.length} rows`)
  }

  await client.connect()
  await client.query('begin')
  await assertTargetIsEmpty(client)

  for (const statement of createStatements) await client.query(statement)
  for (const table of SOURCE_TABLES) {
    const rows = sourceRows.get(table.name) ?? []
    await insertRows(client, table, rows)
    console.log(`[target] ${table.name}: ${rows.length} rows inserted`)
  }

  await client.query('commit')
  console.log('MIGRATION=SUCCESS')
} catch (error) {
  try { await client.query('rollback') } catch { /* connection may not be established */ }
  console.error(`MIGRATION=ROLLED_BACK: ${error instanceof Error ? error.message : 'Unknown error'}`)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
