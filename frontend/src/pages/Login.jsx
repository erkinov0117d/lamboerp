import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'
import { Button, ErrorBox, Field, inputCls } from '../components/ui'
import { homePath } from '../roles'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gold-400 text-2xl font-black text-ink-900">L</div>
          <h1 className="text-xl font-bold tracking-[0.25em] text-gold-400">LAMBORGHINI</h1>
          <p className="mt-1 text-sm text-stone-400">ERP tizimiga kirish</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <ErrorBox message={error} />
          <Field label="Login">
            <input className={inputCls} autoFocus required value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </Field>
          <Field label="Parol">
            <input className={inputCls} type="password" required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Button variant="primary" className="w-full py-2.5" disabled={busy}>
            {busy ? 'Kirilmoqda...' : 'Kirish'}
          </Button>
        </form>
      </div>
    </div>
  )
}
