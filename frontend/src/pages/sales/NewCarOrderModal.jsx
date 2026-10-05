import { useState } from 'react'
import api, { errorMessage } from '../../api/client'
import useFetch from '../../lib/useFetch'
import { money } from '../../lib/format'
import { Button, ErrorBox, Field, inputCls, Modal } from '../../components/ui'

export default function NewCarOrderModal({ car, onClose, onSaved }) {
  const { data: cars } = useFetch('/v1/inventory/', { item_type: 'car', status: 'available' })
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', car: car?.id ?? '', unit_price: car?.price ?? '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const pickCar = (id) => {
    const c = cars?.find((x) => String(x.id) === String(id))
    setForm({ ...form, car: id, unit_price: c?.price ?? '' })
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/v1/orders/', {
        order_type: 'car_sale',
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        items: [{ inventory_item: Number(form.car), quantity: 1, unit_price: form.unit_price }],
      })
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const options = car && !cars?.some((c) => c.id === car.id) ? [car, ...(cars ?? [])] : cars ?? []

  return (
    <Modal open title="Yangi sotuv buyurtmasi" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={error} />
        <Field label="Avtomobil">
          <select className={inputCls} required value={form.car} onChange={(e) => pickCar(e.target.value)}>
            <option value="">Tanlang...</option>
            {options.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.sku_or_vin} ({money(c.price)})</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Mijoz ismi">
            <input className={inputCls} required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          </Field>
          <Field label="Telefon">
            <input className={inputCls} required value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="+998 90 123 45 67" />
          </Field>
        </div>
        <Field label="Sotuv narxi (USD)" hint="Katalog narxidan farq qilishi mumkin (chegirma)">
          <input className={inputCls} required type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Buyurtma yaratish'}</Button>
        </div>
      </form>
    </Modal>
  )
}
