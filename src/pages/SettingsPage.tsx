import FontPicker from '../components/FontPicker'
import { DATA_SOURCE_LABEL } from '../lib/dataSourceLabel'

export default function SettingsPage() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="glass-strong rounded-2xl px-5 py-4">
        <h2 className="text-sm font-semibold tracking-tight text-slate-800 font-mono">SYSTEM_SETTINGS</h2>
        <p className="text-xs text-slate-400 font-mono mt-0.5">Thresholds &amp; constants · soft utility workspace · {DATA_SOURCE_LABEL}</p>
      </div>
      <div className="glass rounded-2xl p-5">
        <FontPicker />
      </div>
      <div className="glass rounded-2xl p-4 space-y-0 font-mono text-xs divide-y divide-white/5">
        <div className="flex justify-between items-center py-3">
          <span className="font-semibold text-slate-500">DATABASE_PROVIDER</span>
          <span className="text-slate-700">{DATA_SOURCE_LABEL}</span>
        </div>
        <div className="flex justify-between items-center py-3">
          <span className="font-semibold text-slate-500">ATTACHMENT_STORAGE</span>
          <span className="text-slate-700">Office FTP (via API)</span>
        </div>
        <div className="flex justify-between items-center py-3">
          <span className="font-semibold text-slate-500">DEADLINE_WARNING_THRESHOLD</span>
          <span className="text-slate-700">3 Days</span>
        </div>
        <div className="flex justify-between items-center py-3">
          <span className="font-semibold text-slate-500">MAX_ATTACHMENT_SIZE</span>
          <span className="text-slate-700">5 MB</span>
        </div>
        <div className="flex justify-between items-center py-3">
          <span className="font-semibold text-slate-500">ALLOWED_TASK_TYPES</span>
          <span className="text-slate-700">Bugs, Improvements</span>
        </div>
        <div className="flex justify-between items-center py-2 pt-3">
          <span className="font-semibold text-slate-400 text-[11px]">UI_VARIANT</span>
          <span className="glass-subtle rounded-full px-2.5 py-1 text-[11px] text-slate-500 border border-slate-200">Soft Utility · blue workspace</span>
        </div>
      </div>
    </div>
  )
}
