import { Fragment, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import InvoiceButton from '../components/InvoiceButton'
import useFetch from '../lib/useFetch'
import { date, money, ORDER_STATUS } from '../lib/format'
import { Badge, Card, Empty, ErrorBox, inputBase, PageHeader, Spinner } from '../components/ui'

/** Buyurtmalar ro'yxati (Top Management — hammasi, Omborchi — o'z filiali, faqat o'qish). */
export default function Orders() {
  const { user } = useAuth()
  const isTop = user.role === 'top_management'
  const [filters, setFilters] = useState({ search: '', order_type: '', status: '' })
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  const { data, loading, error } = useFetch('/v1/orders/', params)
  const [expanded, setExpanded] = useState(null)
  const setF = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })

  return (
    <>
      <PageHeader title="Buyurtmalar" subtitle={isTop ? 'Barcha filiallar' : user.branch_name} />
      <div className="mb-4 flex flex-wrap gap-3">
        <input className={`${inputBase} w-64`} placeholder="Mijoz ismi yoki telefoni..." value={filters.search} onChange={setF('search')} />
        <select className={`${inputBase} w-48`} value={filters.order_type} onChange={setF('order_type')}>
          <option value="">Barcha turlar</option>
          <option value="car_sale">Avtomobil sotuvi</option>
          <option value="service">Texnik xizmat</option>
        </select>
        <select className={`${inputBase} w-44`} value={filters.status} onChange={setF('status')}>
          <option value="">Barcha holatlar</option>
          {Object.entries(ORDER_STATUS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
      </div>

      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : !data?.length ? <Empty>Buyurtma topilmadi</Empty> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Mijoz</th>
                <th className="px-4 py-3">Turi</th>
                {isTop && <th className="px-4 py-3">Filial</th>}
                <th className="px-4 py-3">Mas'ul</th>
                <th className="px-4 py-3 text-right">Summa</th>
                <th className="px-4 py-3">Holati</th>
                <th className="px-4 py-3">Sana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.map((o) => (
                <Fragment key={o.id}>
                  <tr className="cursor-pointer hover:bg-stone-50" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    <td className="px-4 py-3 text-stone-400">{o.id}</td>
                    <td className="px-4 py-3"><div className="font-medium">{o.customer_name}</div><div className="text-xs text-stone-500">{o.customer_phone}</div></td>
                    <td className="px-4 py-3">{o.order_type === 'car_sale' ? '🏎️' : '🔧'} {o.order_type_display}</td>
                    {isTop && <td className="px-4 py-3">{o.branch_name}</td>}
                    <td className="px-4 py-3">{o.assigned_to_name ?? '—'}</td>
                    <td className="tabular px-4 py-3 text-right font-semibold">{money(o.total_price)}</td>
                    <td className="px-4 py-3"><Badge meta={ORDER_STATUS[o.status]} /></td>
                    <td className="px-4 py-3 text-stone-500">{date(o.created_at)}</td>
                  </tr>
                  {expanded === o.id && (
                    <tr className="bg-stone-50/60">
                      <td />
                      <td colSpan={isTop ? 7 : 6} className="px-4 py-3">
                        <ul className="space-y-1">
                          {o.items.map((i) => (
                            <li key={i.id} className="flex gap-4">
                              <span className="flex-1">{i.inventory_name} <span className="font-mono text-xs text-stone-500">{i.sku_or_vin}</span></span>
                              <span className="tabular">{i.quantity} × {money(i.unit_price)}</span>
                              <span className="tabular w-28 text-right font-medium">{money(i.subtotal)}</span>
                            </li>
                          ))}
                        </ul>
                        {isTop && <div className="mt-2 text-right"><InvoiceButton order={o} /></div>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}
