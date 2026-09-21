import { FormEvent, useCallback, useEffect, useState } from 'react'
import { IconKey, IconRefresh, IconShieldLock, IconUserPlus, IconUsers } from '@tabler/icons-react'
import { authClient } from '../lib/auth-client'

type AdminUser = {
  id: string
  name: string
  email: string
  role?: string | null
  banned?: boolean | null
  createdAt: Date | string
}
type UserRole = 'user' | 'admin'

export default function AdminPage() {
  const session = authClient.useSession()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [newUser, setNewUser] = useState<{ name: string; email: string; password: string; role: UserRole }>({ name: '', email: '', password: '', role: 'user' })
  const [resetUserId, setResetUserId] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const isAdmin = session.data?.user.role === 'admin'

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await authClient.admin.listUsers({ query: { limit: 100, sortBy: 'createdAt', sortDirection: 'desc' } })
    if (result.error) setError(result.error.message || 'Daftar user tidak bisa dimuat.')
    else setUsers((result.data?.users || []) as AdminUser[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isAdmin) void loadUsers()
  }, [isAdmin, loadUsers])

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    const result = await authClient.admin.createUser(newUser)
    if (result.error) {
      setError(result.error.message || 'User tidak bisa dibuat.')
      return
    }
    setNotice(`User ${newUser.email} berhasil dibuat.`)
    setNewUser({ name: '', email: '', password: '', role: 'user' })
    await loadUsers()
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    const result = await authClient.admin.setUserPassword({ userId: resetUserId, newPassword })
    if (result.error) {
      setError(result.error.message || 'Password tidak bisa diubah.')
      return
    }
    setNotice('Password user berhasil di-reset. Sampaikan password baru lewat kanal internal yang aman.')
    setResetUserId('')
    setNewPassword('')
  }

  if (!isAdmin) return <div className="glass-strong mx-auto max-w-2xl rounded-2xl p-8 text-center"><IconShieldLock className="mx-auto mb-3 text-amber-500" size={34} /><h1 className="text-xl font-bold">Akses admin diperlukan</h1><p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Halaman ini hanya bisa dibuka oleh user dengan role admin.</p></div>

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-xs uppercase tracking-widest text-blue-600 dark:text-blue-300">Administration</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">User & access</h1><p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Buat akun internal dan bantu reset password tanpa membuka akses database.</p></div><button type="button" onClick={() => void loadUsers()} className="glass inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold" disabled={loading}><IconRefresh size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button></div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="glass-strong rounded-2xl p-5"><div className="mb-5 flex items-center gap-2"><IconUserPlus size={19} className="text-blue-600" /><h2 className="font-bold">Buat user</h2></div><form className="space-y-4" onSubmit={handleCreateUser}><Field label="Nama" value={newUser.name} onChange={value => setNewUser(current => ({ ...current, name: value }))} required /><Field label="Email" type="email" value={newUser.email} onChange={value => setNewUser(current => ({ ...current, email: value }))} required /><Field label="Password sementara" type="password" value={newUser.password} onChange={value => setNewUser(current => ({ ...current, password: value }))} required minLength={8} /><label className="block"><span className="mb-1.5 block text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Role</span><select value={newUser.role} onChange={event => setNewUser(current => ({ ...current, role: event.target.value as UserRole }))} className="w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: 'var(--input-border)' }}><option value="user">User</option><option value="admin">Admin</option></select></label><button type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Buat user</button></form></section>
        <section className="glass-strong rounded-2xl p-5"><div className="mb-5 flex items-center gap-2"><IconKey size={19} className="text-amber-600" /><h2 className="font-bold">Reset password user</h2></div><form className="space-y-4" onSubmit={handleResetPassword}><label className="block"><span className="mb-1.5 block text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Pilih user</span><select required value={resetUserId} onChange={event => setResetUserId(event.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: 'var(--input-border)' }}><option value="">Pilih akun...</option>{users.map(user => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select></label><Field label="Password baru" type="password" value={newPassword} onChange={setNewPassword} required minLength={8} /><button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Reset password</button><p className="text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>Password baru tidak dikirim otomatis lewat email. Sampaikan lewat kanal kantor yang aman.</p></form></section>
      </div>
      <section className="glass-strong overflow-hidden rounded-2xl"><div className="flex items-center gap-2 border-b p-5" style={{ borderColor: 'var(--border-light)' }}><IconUsers size={19} className="text-blue-600" /><h2 className="font-bold">Registered users ({users.length})</h2></div><div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>{users.map(user => <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><div className="truncate text-sm font-bold">{user.name}</div><div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{user.email}</div></div><div className="flex items-center gap-2 text-[11px] font-bold"><span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">{user.role || 'user'}</span>{user.banned && <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">banned</span>}</div></div>)}</div></section>
    </div>
  )
}

function Field({ label, type = 'text', value, onChange, required = false, minLength }: { label: string; type?: string; value: string; onChange: (value: string) => void; required?: boolean; minLength?: number }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{label}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} required={required} minLength={minLength} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ borderColor: 'var(--input-border)', background: 'var(--input-bg)' }} /></label>
}
