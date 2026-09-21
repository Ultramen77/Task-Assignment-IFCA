interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}
export default function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl glass p-8 text-center">
      <h3 className="text-sm font-medium text-slate-800 font-mono">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  )
}
