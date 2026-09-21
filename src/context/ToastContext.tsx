import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { IconX } from '@tabler/icons-react'

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; type: ToastType; message: string }
interface ToastContextType { toasts: Toast[]; addToast: (type: ToastType, message: string) => void; removeToast: (id: number) => void }

const ToastContext = createContext<ToastContextType | undefined>(undefined)
let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = useCallback((type: ToastType, message: string) => {
    const id = nextId++
    setToasts(prev => [...prev, { id, type, message }])
    const duration = type === 'error' ? 8000 : 4000
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])
  const removeToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), [])
  const styles: Record<ToastType, string> = {
    success: 'border-emerald-400/20 bg-emerald-500/15 text-emerald-100 glass',
    error: 'border-red-400/20 bg-red-500/15 text-red-100 glass',
    info: 'border-sky-400/20 bg-sky-500/12 text-sky-100 glass',
  }
  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => (
          <div key={toast.id} role="status" className={`rounded-2xl border px-3 py-2.5 text-xs font-mono shadow-xl backdrop-blur-xl flex justify-between items-start gap-3 ${styles[toast.type]}`}>
            <span className="leading-relaxed">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="shrink-0 opacity-60 hover:opacity-100 leading-none p-0.5" aria-label="Dismiss notification"><IconX size={14} stroke={2} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react/only-export-components
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
