import { useState } from 'react'
import api, { errorMessage } from '../../api/client'
import useFetch from '../../lib/useFetch'
import { date, money, ORDER_STATUS } from '../../lib/format'
import { Button, ErrorBox, PageHeader, Spinner } from '../../components/ui'
import NewCarOrderModal from './NewCarOrderModal'

const COLUMNS = ['pending', 'in_progress', 'completed', 'cancelled']
const ACCENT = {
  pending: 'border-t-stone-400',
  in_progress: 'border-t-sky-500',
  completed: 'border-t-emerald-500',
  cancelled: 'border-t-red-400',
}

function OrderCard({ order, onMove }) {
  const idx = COLUMNS.indexOf(order.status)
  const locked = order.status === 'cancelled'
  const prev = idx > 0 && idx < 3 ? COLUMNS[idx - 1] : null
  const next = idx < 2 ? COLUMNS[idx + 1] : null
  return (
    <div
      draggable={!locked}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(order.id))}
      className={`rounded-lg bg-white p-3 shadow-sm ring-1 ring-black/5 ${locked ? 'opacity-70' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold">{order.customer_name}</div>
        <span className="text-xs text-stone-400">#{order.id}</span>
      </div>
      <div className="text-xs text-stone-500">{order.customer_phone}</div>
      <div className="mt-2 space-y-0.5 text-sm">
        {order.items.map((i) => <div key={i.id} className="truncate">🏎️ {i.inventory_name}</div>)}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="tabular text-sm font-bold">{money(order.total_price)}</span>
        <span className="text-stone-500">{date(order.created_at)}</span>
      </div>
      {order.assigned_to_name && <div className="mt-1 text-xs text-stone-500">👤 {order.assigned_to_name}</div>}
      {!locked && (
        <div className="mt-2 flex gap-1 border-t border-stone-100 pt-2">
          {prev && <button className="rounded px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-100" onClick={() => onMove(order, prev)}>← {ORDER_STATUS[prev].label}</button>}
          {next && <button className="ml-auto rounded px-2 py-0.5 text-xs font-medium text-ink-900 hover:bg-gold-300/40" onClick={() => onMove(order, next)}>{ORDER_STATUS[next].label} →</button>}
          {order.status !== 'completed' && (
            <button className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50" onClick={() => onMove(order, 'cancelled')} title="Bekor qilish">✕</button>
          )}
        </div>
      )}
    </div>
  )
}

export default function SalesKanban() {
  const { data, loading, error, reload, setData } = useFetch('/v1/orders/', { order_type: 'car_sale' })
  const [creating, setCreating] = useState(false)
  const [moveError, setMoveError] = useState('')
  const [over, setOver] = useState(null)

  const move = async (order, status) => {
    if (order.status === status) return
    if (status === 'cancelled' && !confirm(`#${order.id} buyurtmani bekor qilasizmi? Avtomobil omborga qaytariladi.`)) return
    setMoveError('')
    setData((list) => list.map((o) => (o.id === order.id ? { ...o, status } : o))) // optimistik yangilash
    try {
      await api.patch(`/v1/orders/${order.id}/`, { status })
    } catch (err) {
      setMoveError(errorMessage(err))
    }
    reload()
  }

  const onDrop = (status) => (e) => {
    e.preventDefault()
    setOver(null)
    const order = data?.find((o) => String(o.id) === e.dataTransfer.getData('text/plain'))
    if (order && order.status !== 'cancelled') move(order, status)
  }

  return (
    <>
      <PageHeader title="Sotuv pipeline" subtitle="Kartochkalarni ustunlar orasida sudrab o'tkazing"
        actions={<Button variant="gold" onClick={() => setCreating(true)}>+ Yangi buyurtma</Button>} />
      <ErrorBox message={error || moveError} />
      {loading && !data ? <Spinner /> : (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((status) => {
            const orders = data?.filter((o) => o.status === status) ?? []
            const total = orders.reduce((s, o) => s + Number(o.total_price), 0)
            return (
              <section
                key={status}
                onDragOver={(e) => { e.preventDefault(); setOver(status) }}
                onDragLeave={() => setOver(null)}
                onDrop={onDrop(status)}
                className={`flex min-h-[60vh] flex-col rounded-xl border-t-4 bg-stone-200/50 p-3 transition ${ACCENT[status]} ${over === status ? 'ring-2 ring-gold-400' : ''}`}
              >
                <header className="mb-3 flex items-center justify-between px-1">
                  <h2 className="font-semibold">{ORDER_STATUS[status].label}</h2>
                  <span className="rounded-full bg-white px-2 text-xs font-semibold">{orders.length}</span>
                </header>
                <div className="tabular mb-3 px-1 text-xs text-stone-500">{money(total)}</div>
                <div className="flex-1 space-y-3">
                  {orders.map((o) => <OrderCard key={o.id} order={o} onMove={move} />)}
                </div>
              </section>
            )
          })}
        </div>
      )}
      {creating && <NewCarOrderModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload() }} />}
    </>
  )
}
