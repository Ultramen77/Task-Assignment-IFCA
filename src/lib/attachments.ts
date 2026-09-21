import type { UploadAttachmentPayload, UploadAttachmentResult } from '../types/task.types'

export const SUPPORTED_ATTACHMENT_MIME_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp']

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

export interface PendingAttachmentFile {
  file: File
  description: string
  previewUrl: string
}

export function validateAttachmentFile(file: File): string | null {
  if (!SUPPORTED_ATTACHMENT_MIME_TYPES.includes(file.type)) {
    return 'Only PNG, JPEG, and WebP images are supported.'
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return 'Image must be 5 MB or smaller.'
  }
  return null
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface UploadSummary {
  succeeded: number
  failed: string[]
}

// Sequential upload: one File -> base64 conversion immediately before its request.
// Never fire uploads in parallel (Apps Script memory/timeout limits).
export async function uploadFilesSequentially(
  files: PendingAttachmentFile[],
  taskId: string,
  uploadFn: (payload: UploadAttachmentPayload) => Promise<UploadAttachmentResult>,
  onProgress: (uploadedCount: number, total: number) => void,
): Promise<UploadSummary> {
  let succeeded = 0
  const failed: string[] = []

  for (let i = 0; i < files.length; i++) {
    const pending = files[i]
    onProgress(i + 1, files.length)
    try {
      const contentBase64 = await fileToBase64(pending.file)
      await uploadFn({
        taskId,
        fileName: pending.file.name,
        mimeType: pending.file.type || 'image/png',
        description: pending.description || undefined,
        contentBase64,
      })
      succeeded++
    } catch (err) {
      console.error(`Failed to upload ${pending.file.name}:`, err)
      failed.push(pending.file.name)
    }
  }

  return { succeeded, failed }
}