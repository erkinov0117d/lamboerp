import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'
import { homePath } from '../roles'

// Ixtiyoriy brend fayllari: frontend/public/brand/ papkasiga qo'yilsa, avtomatik ishlatiladi.
// Bo'lmasa — original emblema va animatsiyali fon ko'rsatiladi.
const BRAND_LOGO = '/brand/logo.svg'
const BRAND_VIDEO = '/brand/login-bg.mp4'

/** Loyihaning o'z emblemasi: olti qirrali oltin qalqon ichida "L". */
function Emblem({ className = '' }) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="emb-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset=".5" stopColor="#ffc824" />
          <stop offset="1" stopColor="#b88a00" />
        </linearGradient>
      </defs>
      <path d="M32 2 60 18v36L32 70 4 54V18Z" fill="#0b0b0b" stroke="url(#emb-gold)" strokeWidth="3" />
      <path d="M32 9 54 21.5v29L32 63 10 50.5v-29Z" fill="none" stroke="url(#emb-gold)" strokeWidth="1" opacity=".55" />
      <path d="M24 20h7v26h13v6H24Z" fill="url(#emb-gold)" />
    </svg>
  )
}

function Logo({ className }) {
  const [ok, setOk] = useState(true)
  return ok
    ? <img src={BRAND_LOGO} alt="" className={className} onError={() => setOk(false)} />
    : <Emblem className={className} />
}

/** Fon: video bo'lsa — video, bo'lmasa (yoki yuklanmasa) — animatsiyali tezlik chiziqlari. */
function Backdrop() {
  const [video, setVideo] = useState(true)
  return (
    <div className="absolute inset-0 overflow-hidden bg-ink-900">
      <div className="login-glow absolute inset-0" />
      <div className="login-grid absolute inset-0 opacity-[0.07]" />
      <div className="absolute inset-0">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className="login-streak"
            style={{ top: `${6 + i * 6.7}%`, animationDelay: `${(i * 0.53) % 3.2}s`,
                     animationDuration: `${2.2 + (i % 4) * 0.6}s`, opacity: 0.25 + (i % 3) * 0.2 }} />
        ))}
      </div>
      {video && (
        <video className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline
          onError={() => setVideo(false)}>
          <source src={BRAND_VIDEO} type="video/mp4" onError={() => setVideo(false)} />
        </video>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-ink-900/75 via-ink-900/20 to-ink-900/75" />
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-ink-900/90 to-transparent" />
    </div>
  )
}

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

  if (user) return <Navigate to={homePath(user.role)} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const u = await login(form.username, form.password)
      navigate(homePath(u.role), { replace: true })
    } catch (err) {
      setError(err.response?.status === 401 ? "Login yoki parol noto'g'ri" : errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-stone-500 ' +
    'outline-none transition focus:border-gold-400 focus:bg-white/10 focus:ring-2 focus:ring-gold-400/30'

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <Backdrop />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center gap-12 px-6 py-10 lg:flex-row lg:justify-between lg:px-12">
        {/* Chap: brend */}
        <section className="login-rise max-w-xl text-center lg:text-left">
          <Logo className="mx-auto mb-6 h-28 w-auto scale-125 drop-shadow-[0_0_30px_rgba(255,200,36,0.35)] sm:h-36 lg:mx-0" />
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.4em] text-gold-400 sm:tracking-[0.5em]">Dealer Network · ERP</p>
          <h1 className="text-4xl font-black uppercase leading-none tracking-[0.06em] drop-shadow-lg sm:text-6xl sm:tracking-[0.12em]">
            Lambor<span className="text-gold-400">ghini</span>
          </h1>
          <p className="mt-5 text-lg text-stone-300">
            Sotuv, ombor, servis va boshqaruv — bitta tizimda.
          </p>
          <div className="mt-8 hidden gap-8 text-sm text-stone-400 sm:flex lg:justify-start">
            {[['3', 'filial'], ['4', 'rol'], ['24/7', 'AWS bulutida']].map(([n, t]) => (
              <div key={t}>
                <div className="text-2xl font-bold text-gold-400">{n}</div>
                <div>{t}</div>
              </div>
            ))}
          </div>
        </section>

        {/* O'ng: forma */}
        <form onSubmit={submit}
          className="login-rise w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900/60 p-8 shadow-2xl backdrop-blur-xl"
          style={{ animationDelay: '.15s' }}>
          <h2 className="text-2xl font-bold">Tizimga kirish</h2>
          <p className="mb-6 mt-1 text-sm text-stone-400">Xodim hisobingiz bilan kiring</p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
          )}

          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-stone-400">Login</span>
            <input className={input} autoFocus required autoComplete="username" placeholder="masalan, ceo"
              value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </label>

          <label className="mb-6 block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-stone-400">Parol</span>
            <div className="relative">
              <input className={`${input} pr-20`} type={show ? 'text' : 'password'} required autoComplete="current-password"
                placeholder="••••••••" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" onClick={() => setShow(!show)}
                className="absolute inset-y-0 right-3 my-auto h-fit text-xs font-medium text-stone-400 hover:text-gold-400">
                {show ? 'Yashirish' : "Ko'rsatish"}
              </button>
            </div>
          </label>

          <button type="submit" disabled={busy}
            className="group relative w-full overflow-hidden rounded-lg bg-gold-400 py-3 font-bold uppercase tracking-widest text-ink-900 transition hover:bg-gold-300 disabled:opacity-60">
            <span className="login-shine absolute inset-y-0 -left-1/2 w-1/2" />
            <span className="relative">{busy ? 'Kirilmoqda...' : 'Kirish'}</span>
          </button>

          <p className="mt-6 text-center text-xs text-stone-500">Lamborghini ERP · o'quv loyihasi</p>
        </form>
      </div>
    </div>
  )
}
