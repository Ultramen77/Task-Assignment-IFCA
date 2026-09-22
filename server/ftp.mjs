import { Client } from 'basic-ftp'
import { Readable, Writable } from 'node:stream'
import { requiredEnv } from './env.mjs'

function ftpConfig() {
  return {
    host: requiredEnv('FTP_HOST'),
    port: Number(process.env.FTP_PORT || 21),
    user: requiredEnv('FTP_USER'),
    password: requiredEnv('FTP_PASSWORD'),
    secure: process.env.FTP_SECURE === 'true',
    root: (process.env.FTP_ROOT_DIR || '/task-assignment/attachments').replace(/^\/+|\/+$/g, ''),
  }
}

function assertSafeSegment(value, label) {
  if (!value || value === '.' || value === '..' || /[\\/\r\n]/.test(value)) {
    throw new Error(`Unsafe FTP ${label}.`)
  }
}

export function safeAttachmentFileName(fileName) {
  const baseName = String(fileName || '').split(/[\\/]/).pop() || ''
  assertSafeSegment(baseName, 'file name')
  return baseName.replace(/[\r\n]/g, '_')
}

export function attachmentRemotePath(storageKey) {
  const parts = String(storageKey || '').split('/')
  if (parts.length !== 2) throw new Error('Attachment storage key must contain task folder and file name.')
  assertSafeSegment(parts[0], 'task folder')
  assertSafeSegment(parts[1], 'file name')
  return parts.join('/')
}

async function withFtp(callback) {
  const config = ftpConfig()
  const client = new Client()
  client.ftp.verbose = false
  try {
    await client.access({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      secure: config.secure,
    })
    await client.ensureDir(config.root)
    return await callback(client, config)
  } finally {
    client.close()
  }
}

export async function uploadAttachmentBuffer(storageKey, buffer) {
  const remotePath = attachmentRemotePath(storageKey)
  return withFtp(async (client, _config) => {
    const [taskFolder, fileName] = remotePath.split('/')
    await client.ensureDir(taskFolder)
    await client.uploadFrom(Readable.from(buffer), fileName)
  })
}

export async function downloadAttachmentBuffer(storageKey) {
  const remotePath = attachmentRemotePath(storageKey)
  return withFtp(async (client, _config) => {
    const [taskFolder, fileName] = remotePath.split('/')
    await client.ensureDir(taskFolder)
    const chunks = []
    const output = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk))
        callback()
      },
    })
    await client.downloadTo(output, fileName)
    return Buffer.concat(chunks)
  })
}

export async function deleteAttachmentFile(storageKey) {
  const remotePath = attachmentRemotePath(storageKey)
  return withFtp(async (client, _config) => {
    const [taskFolder, fileName] = remotePath.split('/')
    await client.ensureDir(taskFolder)
    try {
      await client.remove(fileName)
    } catch (error) {
      if (error?.code !== 550) throw error
    }
  })
}
