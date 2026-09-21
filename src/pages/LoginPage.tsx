import { FormEvent, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { IconArrowRight, IconEye, IconEyeOff, IconLock, IconMail, IconShieldCheck } from '@tabler/icons-react'
import { authClient } from '../lib/auth-client'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = authClient.useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (session.data) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate, session.data])

  if (session.isPending) {
    return <LoginLoading />
  }

  if (session.data) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
        rememberMe: true,
      })

      if (result.error) {
        setError(result.error.message || 'Email atau password tidak sesuai.')
        setIsSubmitting(false)
        return
      }

      const from = (location.state as { from?: string } | null)?.from || '/dashboard'
      navigate(from, { replace: true })
    } catch (requestError) {
      console.error('[login] Auth server request failed:', requestError)
      setError('Server login belum bisa dihubungi. Pastikan auth server sedang berjalan.')
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-28 h-96 w-96 rounded-full bg-blue-200/55 blur-3xl dark:bg-blue-900/30" />
        <div className="absolute -bottom-40 -right-20 h-[30rem] w-[30rem] rounded-full bg-cyan-100/60 blur-3xl dark:bg-cyan-900/20" />
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'linear-gradient(var(--border-medium) 1px, transparent 1px), linear-gradient(90deg, var(--border-medium) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/70 bg-white/70 shadow-[0_24px_80px_rgba(45,78,119,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/65 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden flex-col justify-between bg-gradient-to-br from-blue-600 via-blue-600 to-cyan-500 p-10 text-white lg:flex xl:p-14">
            <div>
              <div className="mb-10 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-lg font-extrabold shadow-inner ring-1 ring-white/25">TA</div>
                <div>
                  <div className="text-base font-extrabold tracking-tight">Task Assignment</div>
                  <div className="text-xs text-blue-100">Internal work management</div>
                </div>
              </div>
              <p className="max-w-md text-4xl font-extrabold leading-tight tracking-[-0.04em]">Keep every assignment moving forward.</p>
              <p className="mt-5 max-w-md text-sm leading-6 text-blue-100">Satu ruang kerja untuk konsultan dan programmer memantau tugas, komentar, status, serta riwayat perubahan.</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-blue-100">
              <IconShieldCheck size={19} />
              <span>Private workspace untuk tim internal</span>
            </div>
          </section>

          <section className="flex items-center p-6 sm:p-10 lg:p-12 xl:p-16">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-10 lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-extrabold text-white shadow-lg shadow-blue-600/20">TA</div>
                  <div>
                    <div className="text-sm font-extrabold tracking-tight">Task Assignment</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Internal work management</div>
                  </div>
                </div>
              </div>
              <div className="mb-8">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Welcome back</p>
                <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Masuk ke workspace</h1>
                <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>Gunakan akun kantor kamu untuk melanjutkan ke Task Assignment.</p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Email kantor</span>
                  <span className="relative block">
                    <IconMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={17} style={{ color: 'var(--text-muted)' }} />
                    <input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="nama@kantor.com" className="w-full rounded-xl border py-3 pl-10 pr-3 text-sm outline-none" style={{ borderColor: 'var(--input-border)', background: 'var(--input-bg)' }} />
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Password</span>
                  <span className="relative block">
                    <IconLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" size={17} style={{ color: 'var(--text-muted)' }} />
                    <input type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Masukkan password" className="w-full rounded-xl border py-3 pl-10 pr-11 text-sm outline-none" style={{ borderColor: 'var(--input-border)', background: 'var(--input-bg)' }} />
                    <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5" style={{ color: 'var(--text-muted)' }} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
                      {showPassword ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                    </button>
                  </span>
                </label>

                {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

                <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting ? 'Memeriksa akun...' : 'Masuk ke workspace'}
                  {!isSubmitting && <IconArrowRight size={17} />}
                </button>
              </form>

              <div className="mt-5 text-center">
                <a href="#/forgot-password" className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-300">Lupa password?</a>
              </div>

              <p className="mt-8 text-center text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>Akun dibuat oleh administrator internal.<br />Hubungi administrator jika belum punya akses.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function LoginLoading() {
  return <main className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg-primary)' }}><div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" aria-label="Memuat sesi" /></main>
}
