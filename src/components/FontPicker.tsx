import { useEffect, useState } from 'react'
import { FONT_OPTIONS, FONT_STORAGE_KEY, applyFont, getFontById } from '../lib/fonts'

export default function FontPicker({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState<string>(() => {
    try { return localStorage.getItem(FONT_STORAGE_KEY) || '' } catch { return '' }
  })

  useEffect(() => {
    // sync if another tab changed
    const h = () => {
      try { setSelected(localStorage.getItem(FONT_STORAGE_KEY) || '') } catch {}
    }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  const onChange = (id: string) => {
    setSelected(id)
    applyFont(id)
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="hidden sm:inline text-[10px] font-mono text-slate-400">FONT</span>
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          className="glass-subtle rounded-full px-2.5 py-1 text-[11px] font-mono text-slate-700 border border-slate-200 outline-none focus:border-slate-300 max-w-[160px]"
          title="Pilih font — kesimpen di browser kamu aja"
        >
          <option value="">Default (Manrope)</option>
          {FONT_OPTIONS.map((f) => (
            <option key={f.id} value={f.id}>{f.label} {f.source === 'google' ? '· G' : f.source === 'system' ? '· S' : '· L'}</option>
          ))}
        </select>
      </div>
    )
  }

  const current = selected ? getFontById(selected) : undefined

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-800 font-mono">FONT_PREFERENCES</div>
        <span className="text-[11px] font-mono text-slate-400">Per-browser · localStorage</span>
      </div>

      <div className="grid gap-3">
        <label className="block">
          <div className="text-[11px] font-mono text-slate-500 mb-1.5">Pilih Font</div>
          <select
            value={selected}
            onChange={(e) => onChange(e.target.value)}
            className="w-full glass-subtle rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800/90 border border-slate-200 outline-none focus:border-violet-400/30"
          >
            <option value="">Default — Manrope (bawaan)</option>
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id} style={{ fontFamily: f.cssFamily }}>
                {f.label} {f.source === 'google' ? '(Google)' : f.source === 'system' ? '(System)' : '(Local)'}
              </option>
            ))}
          </select>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="text-[10px] font-mono text-slate-400">Source:</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-500">G = Google Fonts (auto load)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-500">S = System (OS)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-500">L = Local (butuh install .otf)</span>
          </div>
        </label>

        <div className="glass-subtle rounded-xl p-3 border border-slate-200">
          <div className="text-[11px] font-mono text-slate-400 mb-1">Preview — {current ? current.label : 'Manrope (Default)'} </div>
          <div className="text-sm leading-6 text-slate-800" style={{ fontFamily: current ? current.cssFamily : undefined }}>
            The quick brown fox jumps over the lazy dog — 0123456789
          </div>
          <div className="text-xs leading-5 text-slate-500 mt-1" style={{ fontFamily: current ? current.cssFamily : undefined }}>
            Pack my box with five dozen liquor jugs. — Task Assignment System (Soft Utility · blue workspace)
          </div>
          {current?.note && (
            <div className="mt-2 text-[11px] font-mono text-amber-200/70 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
              ⚠️ {current.note}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={() => onChange('')} className="glass-subtle rounded-full px-3 py-1.5 text-xs font-mono text-slate-500 border border-slate-200 hover:text-slate-800 hover:bg-slate-50">
            Reset ke Default
          </button>
          <span className="text-[11px] font-mono text-slate-400 self-center">
            Aktif: <b className="text-slate-500">{current ? current.label : 'Manrope'}</b> · kesimpen di browser ini aja
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-2 pt-1">
        {FONT_OPTIONS.map((f) => (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={`text-left rounded-xl px-3 py-2 border transition-colors ${selected === f.id ? 'bg-white text-slate-900 border-white shadow' : 'glass-subtle border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
          >
            <div className="text-xs font-semibold" style={{ fontFamily: f.cssFamily }}>{f.label}</div>
            <div className="text-[11px] opacity-60 truncate" style={{ fontFamily: f.cssFamily }}>Ag — {f.source === 'google' ? 'Google' : f.source === 'system' ? 'System' : 'Local'} · The quick brown fox</div>
          </button>
        ))}
      </div>
    </div>
  )
}
