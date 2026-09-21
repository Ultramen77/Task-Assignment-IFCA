import { useState } from 'react'
import { useMasterData, type MasterEntityType } from '../hooks/useMasterData'
import { IconPlus, IconPlayerPause, IconPlayerPlay, IconPencil, IconTrash } from '@tabler/icons-react'

interface Props {
  entity: MasterEntityType
  title: string
  entityLabel: string
}

export default function MasterDataTable({ entity, title, entityLabel }: Props) {
  const { data, loading, error, create, update, remove } = useMasterData(entity)
  const hasEmail = entity === 'consultants' || entity === 'programmers'

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<{ id: string; name: string; email?: string; active: boolean } | null>(null)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = data.filter(
    (r) =>
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.email && r.email.toLowerCase().includes(search.toLowerCase()))
  )

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setFormEmail('')
    setModalOpen(true)
  }
  const openEdit = (item: { id: string; name: string; email?: string; active: boolean }) => {
    setEditing(item)
    setFormName(item.name)
    setFormEmail(item.email || '')
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!formName.trim()) {
      alert('Nama tidak boleh kosong')
      return
    }
    setSubmitting(true)
    try {
      if (editing) await update(editing.id, formName.trim(), formEmail.trim() || undefined, editing.active)
      else await create(formName.trim(), formEmail.trim() || undefined)
      setModalOpen(false)
      setFormName('')
      setFormEmail('')
      setEditing(null)
    } catch (e: any) {
      alert(e?.message || 'Gagal menyimpan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (item: { id: string; name: string; email?: string; active: boolean }) => {
    if (!confirm(`${item.active ? 'Nonaktifkan' : 'Aktifkan'} ${entityLabel} "${item.name}"?`)) return
    try {
      await update(item.id, item.name, item.email, !item.active)
    } catch (e: any) {
      alert(e?.message || 'Gagal mengubah status')
    }
  }

  const handleDelete = async (item: { id: string; name: string; email?: string }) => {
    if (!confirm(`Nonaktifkan ${entityLabel} "${item.name}"? (soft delete)`)) return
    try {
      await remove(item.id)
    } catch (e: any) {
      alert(e?.message || 'Gagal menghapus')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl" role="status" aria-label={`Loading ${title}`}>
        <div className="glass-strong rounded-2xl px-4 py-3">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-3 w-40 mt-2" />
        </div>
        <div className="glass rounded-2xl p-3">
          <div className="skeleton h-8 w-full max-w-sm" />
        </div>
        <div className="glass rounded-2xl p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton h-3 w-16 shrink-0" />
              <div className="skeleton h-3 w-32 shrink-0" />
              {hasEmail && <div className="skeleton h-3 w-40 shrink-0" />}
              <div className="skeleton h-4 w-14 shrink-0 rounded-full" />
              <div className="skeleton h-3 w-24 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (error) return <div className="p-6 text-sm font-mono text-red-300">Error: {error}</div>

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="glass-strong rounded-2xl px-4 py-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-800 font-mono">{title}</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {filtered.length} / {data.length} {entityLabel.toLowerCase()}s · termasuk non-aktif
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90 font-mono shrink-0"
        >
          <IconPlus size={14} stroke={2} /> Tambah {entityLabel}
        </button>
      </div>

      <div className="glass rounded-2xl p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Cari ID / nama / email ${entityLabel.toLowerCase()}...`}
          className="w-full max-w-sm rounded-xl glass-subtle px-3 py-2 text-xs font-mono placeholder:text-slate-400 text-slate-800 border border-slate-100 focus:outline-none focus:border-slate-200"
        />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="min-w-full divide-y divide-white/5 text-left text-xs font-mono">
          <thead className="bg-slate-50 backdrop-blur">
            <tr className="text-slate-400">
              <th className="px-4 py-2.5 font-medium">ID</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              {hasEmail && <th className="px-4 py-2.5 font-medium">Email</th>}
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={hasEmail ? 5 : 4} className="px-4 py-10 text-center text-slate-400">
                  Tidak ada data{search ? ` untuk "${search}"` : ''}.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className={`hover:bg-white/[0.04] ${!row.active ? 'opacity-55' : ''}`}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-800 font-semibold">{row.id}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.name}</td>
                  {hasEmail && <td className="px-4 py-2.5 text-slate-500 truncate max-w-xs">{row.email || '-'}</td>}
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                        row.active
                          ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/20'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      {row.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right space-x-1">
                    <button
                      onClick={() => handleToggle(row)}
                      title={row.active ? 'Nonaktifkan' : 'Aktifkan'}
                      className="rounded-full glass-subtle px-2.5 py-1 text-[11px] text-slate-600 hover:text-slate-800 border border-slate-200 inline-flex items-center gap-1"
                    >
                      {row.active ? <><IconPlayerPause size={12} stroke={2} /> Off</> : <><IconPlayerPlay size={12} stroke={2} /> On</>}
                    </button>
                    <button
                      onClick={() => openEdit(row)}
                      title="Edit"
                      className="rounded-full glass-subtle px-2.5 py-1 text-[11px] text-slate-600 hover:text-slate-800 border border-slate-200 inline-flex items-center gap-1"
                    >
                      <IconPencil size={12} stroke={2} /> Edit
                    </button>
                    {row.active && (
                      <button
                        onClick={() => handleDelete(row)}
                        title="Nonaktifkan (soft delete)"
                        className="rounded-full bg-red-500/15 border border-red-400/20 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/20 inline-flex items-center gap-1"
                      >
                        <IconTrash size={12} stroke={2} /> Hapus
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl glass-strong p-5 shadow-2xl">
            <h3 className="text-sm font-semibold font-mono text-slate-800">
              {editing ? `Edit ${entityLabel}` : `Tambah ${entityLabel} Baru`}
            </h3>
            <p className="mt-1 text-xs font-mono text-slate-400">
              {editing ? `ID: ${editing.id}` : 'ID akan digenerate otomatis (CLI-/CON-/PROG- prefix).'}
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-mono text-slate-500">Nama *</span>
              <input
                autoFocus
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder={`Nama ${entityLabel.toLowerCase()}`}
                className="mt-1 w-full rounded-xl glass-subtle px-3 py-2.5 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-200 border border-slate-200"
              />
            </label>
            {hasEmail && (
              <label className="mt-4 block">
                <span className="text-xs font-mono text-slate-500">Email</span>
                <input
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder={`Email ${entityLabel.toLowerCase()}`}
                  type="email"
                  className="mt-1 w-full rounded-xl glass-subtle px-3 py-2.5 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-200 border border-slate-200"
                />
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-full glass-subtle px-4 py-1.5 text-xs font-mono text-slate-600 hover:text-slate-800 border border-slate-200"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formName.trim()}
                className="rounded-full bg-white px-4 py-1.5 text-xs font-mono font-semibold text-slate-900 hover:bg-white/90 disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : editing ? 'Simpan' : 'Tambah'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
