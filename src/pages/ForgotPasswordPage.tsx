import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconArrowLeft, IconArrowRight, IconMail } from '@tabler/icons-react'
import { authClient } from '../lib/auth-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}#/reset-password`
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo,
      })

      if (result.error) {
        setError(result.error.message || 'Permintaan reset password gagal.')
        return
      }
      setSubmitted(true)
    } catch (requestError) {
      console.error('[forgot-password] request failed:', requestError)
      setError('Email reset belum bisa dikirim. Hubungi administrator atau gunakan reset dari halaman Admin.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard>
      <div className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Account recovery</p>
        <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Reset password</h1>
        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>Masukkan email kantor. Kami akan mengirim link untuk membuat password baru.</p>
      </div>

      {submitted ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          Kalau email tersebut terdaftar, link reset sudah dikirim. Cek inbox atau hubungi administrator jika belum menerima.
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Email kantor</span>
            <span className="relative block">
              <IconMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={17} style={{ color: 'var(--text-muted)' }} />
              <input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="nama@kantor.com" className="w-full rounded-xl border py-3 pl-10 pr-3 text-sm outline-none" style={{ borderColor: 'var(--input-border)', background: 'var(--input-bg)' }} />
            </span>
          </label>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? 'Mengirim...' : 'Kirim link reset'}
            {!isSubmitting && <IconArrowRight size={17} />}
          </button>
        </form>
      )}

      <Link to="/login" className="mt-8 inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-300"><IconArrowLeft size={15} /> Kembali ke login</Link>
    </AuthCard>
  )
}

export function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const token = new URLSearchParams(window.location.hash.split('?')[1] || '').get('token') || new URLSearchParams(window.location.search).get('token')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!token) {
      setError('Link reset tidak valid atau sudah kedaluwarsa.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password belum sama.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await authClient.resetPassword({ newPassword, token })
      if (result.error) {
        setError(result.error.message || 'Password tidak bisa diubah.')
        return
      }
      setDone(true)
    } catch (requestError) {
      console.error('[reset-password] request failed:', requestError)
      setError('Server reset password belum bisa dihubungi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard>
      <div className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Account recovery</p>
        <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Buat password baru</h1>
        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>Gunakan password minimal 8 karakter.</p>
      </div>
      {done ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">Password berhasil diubah. Silakan login kembali.</div>
          <Link to="/login" className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-300"><IconArrowLeft size={15} /> Ke halaman login</Link>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block"><span className="mb-2 block text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Password baru</span><input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="w-full rounded-xl border px-3 py-3 text-sm outline-none" style={{ borderColor: 'var(--input-border)', background: 'var(--input-bg)' }} /></label>
          <label className="block"><span className="mb-2 block text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Konfirmasi password</span><input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="w-full rounded-xl border px-3 py-3 text-sm outline-none" style={{ borderColor: 'var(--input-border)', background: 'var(--input-bg)' }} /></label>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? 'Menyimpan...' : 'Simpan password'} {!isSubmitting && <IconArrowRight size={17} />}</button>
        </form>
      )}
    </AuthCard>
  )
}

function AuthCard({ children }: { children: React.ReactNode }) {
  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}><div className="pointer-events-none absolute -left-24 -top-28 h-96 w-96 rounded-full bg-blue-200/55 blur-3xl dark:bg-blue-900/30" /><div className="pointer-events-none absolute -bottom-40 -right-20 h-[30rem] w-[30rem] rounded-full bg-cyan-100/60 blur-3xl dark:bg-cyan-900/20" /><section className="relative w-full max-w-lg rounded-[28px] border border-white/70 bg-white/75 p-6 shadow-[0_24px_80px_rgba(45,78,119,0.14)] backdrop-blur-xl sm:p-10 dark:border-white/10 dark:bg-slate-900/70"><div className="mb-10 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-extrabold text-white shadow-lg shadow-blue-600/20">TA</div><div><div className="text-sm font-extrabold tracking-tight">Task Assignment</div><div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Internal work management</div></div></div>{children}</section></main>
}
