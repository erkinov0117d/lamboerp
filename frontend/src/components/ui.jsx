import { useEffect } from 'react'

export function Button({ variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-ink-900 text-gold-400 hover:bg-ink-700',
    gold: 'bg-gold-400 text-ink-900 hover:bg-gold-500',
    ghost: 'bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50',
    danger: 'bg-white text-red-700 ring-1 ring-red-300 hover:bg-red-50',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Badge({ meta, children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta?.cls ?? 'bg-stone-100 text-stone-700 ring-stone-300'}`}>
      {children ?? meta?.label}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ className = '', children }) {
  return <div className={`rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5 ${className}`}>{children}</div>
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  )
}

/** Kenglik berilmagan input uslubi — filtrlar qatorida o'z kengligi bilan ishlatiladi. */
export const inputBase =
  'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-300/60'

export const inputCls = `w-full ${inputBase}`

export function Modal({ open, title, onClose, children, wide = false }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16" onMouseDown={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl bg-white shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-stone-400 hover:text-stone-700" aria-label="Yopish">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export function ErrorBox({ message }) {
  if (!message) return null
  return <div className="mb-4 whitespace-pre-line rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">{message}</div>
}

export function Spinner({ label = 'Yuklanmoqda...' }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-stone-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-gold-500" />
      {label}
    </div>
  )
}

export function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-sm text-stone-500">{children}</div>
}
