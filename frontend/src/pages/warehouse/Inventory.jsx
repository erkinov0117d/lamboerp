import { useState } from 'react'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import useFetch from '../../lib/useFetch'
import { INVENTORY_STATUS, money } from '../../lib/format'
import InventoryForm from '../../components/InventoryForm'
import { Badge, Button, Card, Empty, ErrorBox, Field, inputBase, inputCls, Modal, PageHeader, Spinner } from '../../components/ui'

/** Kirim / chiqim: qoldiqni o'zgartiradi va holatni moslaydi. */
function StockMovement({ item, onClose, onSaved }) {
  const [kind, setKind] = useState('in')
  const [qty, setQty] = useState(1)
  const [error, setError] = useState('')
  const next = item.stock_quantity + (kind === 'in' ? 1 : -1) * Number(qty || 0)

  const submit = async (e) => {
    e.preventDefault()
    if (next < 0) return setError("Chiqim miqdori qoldiqdan ko'p bo'lishi mumkin emas.")
    const status = next > 0 ? 'available' : item.item_type === 'car' ? 'reserved' : 'out_of_stock'
    try {
      await api.patch(`/v1/inventory/${item.id}/`, { stock_quantity: next, status: item.status === 'sold' ? 'sold' : status })
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal open title={`Kirim / chiqim — ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={error} />
        <div className="grid grid-cols-2 gap-2">
          {[['in', '⬇ Kirim'], ['out', '⬆ Chiqim']].map(([k, label]) => (
            <button type="button" key={k} onClick={() => setKind(k)}
              className={`rounded-lg py-2 text-sm font-semibold ring-1 ${kind === k ? 'bg-ink-900 text-gold-400 ring-ink-900' : 'ring-stone-300 hover:bg-stone-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <Field label="Miqdor (dona)">
          <input className={inputCls} type="number" min="1" required value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm">
          Hozirgi qoldiq: <b>{item.stock_quantity}</b> → Yangi qoldiq: <b className={next < 0 ? 'text-red-700' : ''}>{next}</b>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button>Tasdiqlash</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Inventory() {
  const { user } = useAuth()
  const isTop = user.role === 'top_management'
  const canWrite = isTop || user.role === 'warehouse_manager'

  const [filters, setFilters] = useState({ search: '', item_type: '', status: '', low_stock: '' })
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  const { data, loading, error, reload } = useFetch('/v1/inventory/', params)
  const { data: lowStock, reload: reloadLow } = useFetch('/v1/inventory/', { low_stock: 1 })
  const [form, setForm] = useState(null) // null | 'new' | item
  const [movement, setMovement] = useState(null)

  const refresh = () => { reload(); reloadLow() }
  const done = (setter) => () => { setter(null); refresh() }

  const remove = async (item) => {
    if (!confirm(`"${item.name}" o'chirilsinmi?`)) return
    try {
      await api.delete(`/v1/inventory/${item.id}/`)
      refresh()
    } catch (err) {
      alert(errorMessage(err))
    }
  }

  const setF = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })

  return (
    <>
      <PageHeader
        title={user.role === 'service_master' ? 'Ehtiyot qismlar' : 'Ombor qoldiqlari'}
        subtitle={isTop ? 'Barcha filiallar' : user.branch_name}
        actions={canWrite && <Button variant="gold" onClick={() => setForm('new')}>+ Yangi mahsulot</Button>}
      />

      {lowStock?.length > 0 && (
        <div className="mb-6 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <div className="flex items-center gap-2 font-semibold text-amber-900">
            <span aria-hidden>⚠️</span> Kam qolgan detallar: {lowStock.length} ta
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {lowStock.map((i) => (
              <span key={i.id} className="rounded-full bg-white px-3 py-1 text-xs ring-1 ring-amber-200">
                {i.name} {isTop && <span className="text-stone-500">· {i.branch_name}</span>} — <b>{i.stock_quantity === 0 ? 'tugagan' : `${i.stock_quantity} dona`}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input className={`${inputBase} w-64`} placeholder="Nomi yoki SKU/VIN bo'yicha qidirish..." value={filters.search} onChange={setF('search')} />
        {isTop && (
          <select className={`${inputBase} w-44`} value={filters.item_type} onChange={setF('item_type')}>
            <option value="">Barcha turlar</option>
            <option value="car">Avtomobillar</option>
            <option value="part">Ehtiyot qismlar</option>
          </select>
        )}
        <select className={`${inputBase} w-44`} value={filters.status} onChange={setF('status')}>
          <option value="">Barcha holatlar</option>
          {Object.entries(INVENTORY_STATUS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!filters.low_stock} onChange={(e) => setFilters({ ...filters, low_stock: e.target.checked ? '1' : '' })} />
          Faqat kam qolganlar
        </label>
      </div>

      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : !data?.length ? <Empty>Mahsulot topilmadi</Empty> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Nomi</th>
                <th className="px-4 py-3">SKU / VIN</th>
                {isTop && <th className="px-4 py-3">Filial</th>}
                <th className="px-4 py-3 text-right">Narxi</th>
                <th className="px-4 py-3 text-right">Qoldiq</th>
                <th className="px-4 py-3">Holati</th>
                {canWrite && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.map((i) => (
                <tr key={i.id} className={i.is_low_stock ? 'bg-amber-50/40' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{i.name}</div>
                    <div className="text-xs text-stone-500">{i.item_type_display}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{i.sku_or_vin}</td>
                  {isTop && <td className="px-4 py-3">{i.branch_name}</td>}
                  <td className="tabular px-4 py-3 text-right">{money(i.price)}</td>
                  <td className="tabular px-4 py-3 text-right font-semibold">
                    {i.is_low_stock && <span className="mr-1" title="Kam qolgan">⚠️</span>}{i.stock_quantity}
                  </td>
                  <td className="px-4 py-3"><Badge meta={INVENTORY_STATUS[i.status]} /></td>
                  {canWrite && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setMovement(i)}>Kirim/chiqim</Button>
                        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setForm(i)}>Tahrirlash</Button>
                        <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => remove(i)}>✕</Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {form && (
        <InventoryForm
          item={form === 'new' ? null : form}
          fixedType={isTop ? undefined : 'part'}
          onClose={() => setForm(null)}
          onSaved={done(setForm)}
        />
      )}
      {movement && <StockMovement item={movement} onClose={() => setMovement(null)} onSaved={done(setMovement)} />}
    </>
  )
}
