import { useState } from 'react'
import api, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import useFetch from '../lib/useFetch'
import { INVENTORY_STATUS } from '../lib/format'
import { Button, ErrorBox, Field, inputCls, Modal } from './ui'

/**
 * Ombor mahsulotini yaratish/tahrirlash modal oynasi.
 * `fixedType` berilsa ('car' | 'part'), tur tanlanmaydi.
 */
export default function InventoryForm({ item, fixedType, onClose, onSaved }) {
  const { user } = useAuth()
  const isTop = user.role === 'top_management'
  const { data: branches } = useFetch(isTop ? '/v1/branches/' : null)
  const [form, setForm] = useState(() => ({
    branch: item?.branch ?? '',
    item_type: item?.item_type ?? fixedType ?? 'part',
    name: item?.name ?? '',
    sku_or_vin: item?.sku_or_vin ?? '',
    price: item?.price ?? '',
    stock_quantity: item?.stock_quantity ?? (fixedType === 'car' ? 1 : 10),
    status: item?.status ?? 'available',
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const payload = { ...form, stock_quantity: Number(form.stock_quantity) }
    if (!isTop) delete payload.branch
    try {
      if (item) await api.patch(`/v1/inventory/${item.id}/`, payload)
      else await api.post('/v1/inventory/', payload)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const isCar = form.item_type === 'car'
  return (
    <Modal open title={item ? 'Mahsulotni tahrirlash' : isCar ? 'Yangi avtomobil' : "Yangi mahsulot qo'shish"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={error} />
        <div className="grid grid-cols-2 gap-4">
          {isTop && (
            <Field label="Filial">
              <select className={inputCls} required value={form.branch} onChange={set('branch')}>
                <option value="">Tanlang...</option>
                {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          )}
          {!fixedType && isTop && (
            <Field label="Turi">
              <select className={inputCls} value={form.item_type} onChange={set('item_type')}>
                <option value="part">Ehtiyot qism</option>
                <option value="car">Avtomobil</option>
              </select>
            </Field>
          )}
        </div>
        <Field label="Nomi">
          <input className={inputCls} required value={form.name} onChange={set('name')}
            placeholder={isCar ? 'Lamborghini Revuelto V12' : 'Carbon Ceramic Brake Kit'} />
        </Field>
        <Field label={isCar ? 'VIN raqami' : 'SKU (artikul)'}>
          <input className={inputCls} required value={form.sku_or_vin} onChange={set('sku_or_vin')} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Narxi (USD)">
            <input className={inputCls} required type="number" min="0" step="0.01" value={form.price} onChange={set('price')} />
          </Field>
          <Field label="Qoldiq (dona)">
            <input className={inputCls} required type="number" min="0" value={form.stock_quantity} onChange={set('stock_quantity')} />
          </Field>
        </div>
        {item && (
          <Field label="Holati">
            <select className={inputCls} value={form.status} onChange={set('status')}>
              {Object.entries(INVENTORY_STATUS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</Button>
        </div>
      </form>
    </Modal>
  )
}
