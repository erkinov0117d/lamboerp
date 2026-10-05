import { useState } from 'react'
import useFetch from '../../lib/useFetch'
import { INVENTORY_STATUS, money } from '../../lib/format'
import InventoryForm from '../../components/InventoryForm'
import { Badge, Button, Empty, ErrorBox, inputBase, PageHeader, Spinner } from '../../components/ui'
import NewCarOrderModal from './NewCarOrderModal'

export default function CarCatalog() {
  const [filters, setFilters] = useState({ search: '', status: '' })
  const params = { item_type: 'car', ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }
  const { data, loading, error, reload } = useFetch('/v1/inventory/', params)
  const [editing, setEditing] = useState(null) // null | 'new' | car
  const [selling, setSelling] = useState(null)

  return (
    <>
      <PageHeader title="Avtomobillar katalogi" subtitle="Filialdagi avtomobillar inventari"
        actions={<Button variant="gold" onClick={() => setEditing('new')}>+ Avtomobil qo'shish</Button>} />

      <div className="mb-4 flex flex-wrap gap-3">
        <input className={`${inputBase} w-64`} placeholder="Model yoki VIN..." value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <select className={`${inputBase} w-44`} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Barcha holatlar</option>
          {['available', 'reserved', 'sold'].map((k) => <option key={k} value={k}>{INVENTORY_STATUS[k].label}</option>)}
        </select>
      </div>

      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : !data?.length ? <Empty>Avtomobil topilmadi</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((car) => (
            <article key={car.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
              <div className="flex h-32 items-center justify-center bg-gradient-to-br from-ink-900 to-ink-700 text-5xl">🏎️</div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{car.name}</h3>
                  <Badge meta={INVENTORY_STATUS[car.status]} />
                </div>
                <div className="mt-1 font-mono text-xs text-stone-500">VIN: {car.sku_or_vin}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="tabular text-lg font-bold">{money(car.price)}</span>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setEditing(car)}>Tahrirlash</Button>
                    {car.status === 'available' && (
                      <Button className="px-2.5 py-1 text-xs" onClick={() => setSelling(car)}>Sotish</Button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <InventoryForm item={editing === 'new' ? null : editing} fixedType="car"
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
      )}
      {selling && (
        <NewCarOrderModal car={selling} onClose={() => setSelling(null)} onSaved={() => { setSelling(null); reload() }} />
      )}
    </>
  )
}
