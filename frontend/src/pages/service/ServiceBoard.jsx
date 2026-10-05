import { useState } from 'react'
import api, { errorMessage } from '../../api/client'
import useFetch from '../../lib/useFetch'
import { date, money, ORDER_STATUS } from '../../lib/format'
import { Badge, Button, Empty, ErrorBox, Field, inputBase, inputCls, Modal, PageHeader, Spinner } from '../../components/ui'

/** Ishlatilgan ehtiyot qismlarni hisobga olish shakli. */
function PartsEditor({ rows, setRows, parts, reservedByOrder = {} }) {
  const available = (id) => {
    const p = parts?.find((x) => x.id === Number(id))
    return p ? p.stock_quantity + (reservedByOrder[p.id] ?? 0) : 0
  }
  const update = (idx, patch) => setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const total = rows.reduce((s, r) => {
    const p = parts?.find((x) => x.id === Number(r.inventory_item))
    return s + (p ? Number(p.price) * Number(r.quantity || 0) : 0)
  }, 0)

  return (
    <div className="space-y-2">
      {rows.map((r, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <select className={`${inputBase} flex-1`} required value={r.inventory_item}
            onChange={(e) => update(idx, { inventory_item: e.target.value })}>
            <option value="">Ehtiyot qismni tanlang...</option>
            {parts?.map((p) => {
              const avail = available(p.id)
              return (
                <option key={p.id} value={p.id} disabled={avail < 1}>
                  {p.name} — {money(p.price)} (mavjud: {avail})
                </option>
              )
            })}
          </select>
          <input className={`${inputBase} w-20`} type="number" min="1" required
            max={r.inventory_item ? available(r.inventory_item) : undefined}
            value={r.quantity} onChange={(e) => update(idx, { quantity: e.target.value })} aria-label="Miqdor" />
          <button type="button" className="rounded p-2 text-stone-400 hover:text-red-600" aria-label="O'chirish"
            onClick={() => setRows(rows.filter((_, i) => i !== idx))}>✕</button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <Button type="button" variant="ghost" className="px-2.5 py-1 text-xs"
          onClick={() => setRows([...rows, { inventory_item: '', quantity: 1 }])}>+ Qism qo'shish</Button>
        <span className="text-sm">Jami: <b className="tabular">{money(total)}</b></span>
      </div>
    </div>
  )
}

function RepairModal({ order, parts, onClose, onSaved }) {
  const [form, setForm] = useState({ customer_name: '', customer_phone: '' })
  const [rows, setRows] = useState(
    order ? order.items.map((i) => ({ inventory_item: String(i.inventory_item), quantity: i.quantity })) : [{ inventory_item: '', quantity: 1 }],
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const reserved = Object.fromEntries(order?.items.map((i) => [i.inventory_item, i.quantity]) ?? [])

  const submit = async (e) => {
    e.preventDefault()
    if (!rows.length) return setError("Kamida bitta ehtiyot qism qo'shing.")
    setBusy(true)
    const items = rows.map((r) => ({ inventory_item: Number(r.inventory_item), quantity: Number(r.quantity) }))
    try {
      if (order) await api.patch(`/v1/orders/${order.id}/`, { items })
      else await api.post('/v1/orders/', { order_type: 'service', ...form, items })
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open wide title={order ? `#${order.id} — ishlatilgan qismlar` : "Yangi ta'mirlash kartochkasi"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={error} />
        {!order && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mijoz ismi">
              <input className={inputCls} required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </Field>
            <Field label="Telefon">
              <input className={inputCls} required value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            </Field>
          </div>
        )}
        <div>
          <div className="mb-2 text-sm font-medium text-stone-700">Ishlatilgan ehtiyot qismlar</div>
          <PartsEditor rows={rows} setRows={setRows} parts={parts} reservedByOrder={reserved} />
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</Button>
        </div>
      </form>
    </Modal>
  )
}

const NEXT_ACTION = {
  pending: { to: 'in_progress', label: "▶ Ishni boshlash" },
  in_progress: { to: 'completed', label: '✓ Yakunlash' },
}

function RepairCard({ order, onStatus, onEditParts }) {
  const action = NEXT_ACTION[order.status]
  const editable = order.status === 'pending' || order.status === 'in_progress'
  return (
    <article className="flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-stone-400">Karta #{order.id} · {date(order.created_at)}</div>
          <h3 className="font-semibold">{order.customer_name}</h3>
          <div className="text-xs text-stone-500">{order.customer_phone}</div>
        </div>
        <Badge meta={ORDER_STATUS[order.status]} />
      </header>
      <ul className="mt-3 flex-1 space-y-1 border-t border-stone-100 pt-3 text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-2">
            <span className="truncate">🔩 {i.inventory_name} <span className="text-stone-500">× {i.quantity}</span></span>
            <span className="tabular text-stone-600">{money(i.subtotal)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
        <span className="tabular font-bold">{money(order.total_price)}</span>
        {order.assigned_to_name && <span className="text-xs text-stone-500">👤 {order.assigned_to_name}</span>}
      </div>
      {editable && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {action && <Button className="px-2.5 py-1 text-xs" onClick={() => onStatus(order, action.to)}>{action.label}</Button>}
          <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => onEditParts(order)}>Qismlar</Button>
          <Button variant="danger" className="ml-auto px-2.5 py-1 text-xs" onClick={() => onStatus(order, 'cancelled')}>Bekor</Button>
        </div>
      )}
    </article>
  )
}

const TABS = [
  { key: 'active', label: 'Faol', match: (o) => o.status === 'pending' || o.status === 'in_progress' },
  { key: 'completed', label: 'Bajarilgan', match: (o) => o.status === 'completed' },
  { key: 'cancelled', label: 'Bekor qilingan', match: (o) => o.status === 'cancelled' },
]

export default function ServiceBoard() {
  const { data, loading, error, reload } = useFetch('/v1/orders/', { order_type: 'service' })
  const { data: parts, reload: reloadParts } = useFetch('/v1/inventory/', { item_type: 'part' })
  const [tab, setTab] = useState('active')
  const [modal, setModal] = useState(null) // null | 'new' | order
  const [actionError, setActionError] = useState('')

  const refresh = () => { reload(); reloadParts() }

  const setStatus = async (order, status) => {
    if (status === 'cancelled' && !confirm(`#${order.id} kartani bekor qilasizmi? Qismlar omborga qaytariladi.`)) return
    setActionError('')
    try {
      await api.patch(`/v1/orders/${order.id}/`, { status })
      refresh()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  const current = TABS.find((t) => t.key === tab)
  const list = data?.filter(current.match) ?? []

  return (
    <>
      <PageHeader title="Ta'mirlash kartochkalari" subtitle="Texnik xizmat buyurtmalari va ishlatilgan ehtiyot qismlar"
        actions={<Button variant="gold" onClick={() => setModal('new')}>+ Yangi kartochka</Button>} />

      <div className="mb-5 inline-flex rounded-lg bg-stone-200/60 p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === t.key ? 'bg-white shadow-sm' : 'text-stone-600 hover:text-ink-900'}`}>
            {t.label} <span className="ml-1 text-xs text-stone-500">{data?.filter(t.match).length ?? 0}</span>
          </button>
        ))}
      </div>

      <ErrorBox message={error || actionError} />
      {loading && !data ? <Spinner /> : !list.length ? <Empty>Kartochkalar yo'q</Empty> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((o) => <RepairCard key={o.id} order={o} onStatus={setStatus} onEditParts={setModal} />)}
        </div>
      )}

      {modal && (
        <RepairModal order={modal === 'new' ? null : modal} parts={parts}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh() }} />
      )}
    </>
  )
}
