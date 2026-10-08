import { useState } from 'react'
import { errorMessage } from '../api/client'
import { createInvoice } from '../lib/documents'

/** Invoice PDF yaratadi (S3'ga saqlanadi, "Hujjatlar"da ko'rinadi) va yuklab beradi. */
export default function InvoiceButton({ order, className = '' }) {
  const [busy, setBusy] = useState(false)
  if (order.status === 'cancelled') return null

  const click = async (e) => {
    e.stopPropagation()
    setBusy(true)
    try {
      await createInvoice(order.id)
    } catch (err) {
      alert(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={click} disabled={busy} title="Invoice PDF yaratish"
      className={`rounded px-2 py-0.5 text-xs font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50 disabled:opacity-50 ${className}`}>
      {busy ? '...' : '📄 Invoice'}
    </button>
  )
}
