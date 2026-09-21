import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  loadingLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  loadingLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open && cancelRef.current) {
      cancelRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open || loading) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, loading, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={loading ? undefined : onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative glass-strong rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-5 space-y-4"
      >
        <h3 id="confirm-title" className="text-sm font-semibold text-slate-800 font-mono">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-full bg-white border border-slate-200 px-4 py-1.5 text-xs text-slate-600 hover:text-slate-800 disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold min-w-[100px] text-center disabled:opacity-70 ${
              destructive
                ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                : 'border-transparent bg-violet-600 text-white hover:bg-violet-700'
            }`}
          >
            {loading ? (loadingLabel ?? (destructive ? 'Archiving...' : 'Processing...')) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
