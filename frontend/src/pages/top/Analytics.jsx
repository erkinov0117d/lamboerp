import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import useFetch from '../../lib/useFetch'
import { money, moneyCompact, ORDER_STATUS } from '../../lib/format'
import { Badge, Card, ErrorBox, inputBase, PageHeader, Spinner } from '../../components/ui'

// Rang entity'ga bog'langan va barcha grafiklarda bir xil. Avtomobil sotuvi servisdan
// ~50 baravar katta, shuning uchun ular bitta o'qda emas — alohida grafiklarda.
const SERIES = [
  { key: 'car_sales', label: 'Avtomobil sotuvi', color: 'var(--color-series-1)' },
  { key: 'service', label: 'Servis', color: 'var(--color-series-2)' },
]
const AXIS = { fontSize: 12, fill: 'var(--color-chart-muted)' }

/** So'nggi 12 oyni to'liq qaytaradi (bo'sh oylar 0 bilan). */
function fillMonths(rows) {
  const byMonth = Object.fromEntries(rows.map((m) => [m.month, m]))
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return {
      month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      car_sales: Number(byMonth[key]?.car_sales ?? 0),
      service: Number(byMonth[key]?.service ?? 0),
    }
  })
}

function StatTile({ label, value, hint }) {
  return (
    <Card>
      <div className="text-sm text-stone-500">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </Card>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-black/10">
      <div className="mb-1 font-semibold">{label}</div>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
        <span className="text-stone-600">{p.name}</span>
        <span className="tabular ml-auto pl-4 font-medium">{money(p.value)}</span>
      </div>
    </div>
  )
}

/** Bitta seriyali ustunli grafik — sarlavha seriyani nomlaydi, legenda shart emas. */
function SeriesBarChart({ data, xKey, series, height = 200 }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-stone-700">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: series.color }} />
        {series.label}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} interval="preserveStartEnd" />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={moneyCompact} width={56} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
          <Bar dataKey={series.key} name={series.label} fill={series.color} radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function Analytics() {
  const [branch, setBranch] = useState('')
  const { data: branches } = useFetch('/v1/branches/')
  const { data, loading, error } = useFetch('/v1/analytics/', branch ? { branch } : undefined)

  const byBranch = (data?.by_branch ?? []).map((b) => ({
    name: b.branch_name.replace('Lamborghini ', ''),
    car_sales: Number(b.car_sales_revenue),
    service: Number(b.service_revenue),
  }))
  const monthly = fillMonths(data?.monthly_revenue ?? [])

  return (
    <>
      <PageHeader
        title="Analitika"
        subtitle="Filiallar kesimidagi daromad, ombor va servis statistikasi"
        actions={
          <select className={`${inputBase} w-56`} value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">Barcha filiallar</option>
            {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        }
      />
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            <StatTile label="Umumiy daromad" value={money(data.sales.total_revenue)} hint="Bajarilgan buyurtmalar" />
            <StatTile label="Avtomobil sotuvi" value={money(data.sales.car_sales_revenue)} />
            <StatTile label="Servis daromadi" value={money(data.sales.service_revenue)} />
            <StatTile label="Ombor qiymati" value={money(data.inventory.total_value)}
              hint={`${data.inventory.cars_available} ta avto · ${data.inventory.parts_units} dona qism`} />
            <StatTile label="Oylik ish haqi fondi" value={money(data.payroll.monthly)}
              hint={`${data.payroll.staff_count} xodim · yiliga ${money(data.payroll.yearly)}`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <h2 className="font-semibold">Filiallar bo'yicha daromad</h2>
              <p className="mb-4 text-xs text-stone-500">Bajarilgan buyurtmalar, USD</p>
              <div className="grid gap-6 sm:grid-cols-2">
                {SERIES.map((s) => <SeriesBarChart key={s.key} data={byBranch} xKey="name" series={s} height={240} />)}
              </div>
            </Card>
            <Card>
              <h2 className="font-semibold">Oylik daromad</h2>
              <p className="mb-4 text-xs text-stone-500">So'nggi 12 oy, USD</p>
              <div className="space-y-4">
                {SERIES.map((s) => <SeriesBarChart key={s.key} data={monthly} xKey="month" series={s} height={110} />)}
              </div>
            </Card>
          </div>

          <Card className="overflow-x-auto p-0">
            <h2 className="px-5 pt-5 font-semibold">Filiallar jadvali</h2>
            <table className="mt-3 w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-5 py-2">Filial</th>
                  <th className="px-5 py-2 text-right">Daromad</th>
                  <th className="px-5 py-2 text-right">Avto sotuvi</th>
                  <th className="px-5 py-2 text-right">Servis</th>
                  <th className="px-5 py-2 text-right">Sotilgan avto</th>
                  <th className="px-5 py-2 text-right">Faol buyurtmalar</th>
                  <th className="px-5 py-2 text-right">Ombor qiymati</th>
                  <th className="px-5 py-2 text-right">Xodimlar</th>
                  <th className="px-5 py-2 text-right">Oylik fond</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-stone-100">
                {data.by_branch.map((b) => (
                  <tr key={b.branch_id}>
                    <td className="px-5 py-2.5 font-medium">{b.branch_name}</td>
                    <td className="px-5 py-2.5 text-right font-semibold">{money(b.revenue)}</td>
                    <td className="px-5 py-2.5 text-right">{money(b.car_sales_revenue)}</td>
                    <td className="px-5 py-2.5 text-right">{money(b.service_revenue)}</td>
                    <td className="px-5 py-2.5 text-right">{b.cars_sold}</td>
                    <td className="px-5 py-2.5 text-right">{b.orders_active}</td>
                    <td className="px-5 py-2.5 text-right">{money(b.inventory_value)}</td>
                    <td className="px-5 py-2.5 text-right">{b.staff_count}</td>
                    <td className="px-5 py-2.5 text-right">{money(b.payroll_monthly)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <h2 className="mb-3 font-semibold">Buyurtmalar holati</h2>
              <ul className="space-y-2 text-sm">
                {Object.entries(ORDER_STATUS).map(([key, meta]) => (
                  <li key={key} className="flex items-center justify-between">
                    <Badge meta={meta} />
                    <span className="tabular font-semibold">{data.sales.orders_by_status[key] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h2 className="mb-3 font-semibold">Servis</h2>
              <div className="mb-3 flex gap-6 text-sm">
                <div><div className="text-2xl font-bold">{data.service.active}</div><div className="text-stone-500">faol</div></div>
                <div><div className="text-2xl font-bold">{data.service.completed}</div><div className="text-stone-500">bajarilgan</div></div>
              </div>
              <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Ko'p ishlatilgan qismlar</div>
              <ul className="mt-2 space-y-1 text-sm">
                {data.service.top_parts_used.map((p) => (
                  <li key={p.name} className="flex justify-between"><span className="truncate pr-2">{p.name}</span><span className="tabular font-medium">{p.used}</span></li>
                ))}
              </ul>
            </Card>
            <Card>
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <span aria-hidden>⚠️</span> Kam qolgan detallar
                <span className="ml-auto text-sm font-normal text-stone-500">{data.inventory.low_stock.length} ta</span>
              </h2>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto text-sm">
                {data.inventory.low_stock.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{i.name}<span className="block text-xs text-stone-500">{i.branch_name}</span></span>
                    <Badge meta={{ cls: i.stock_quantity === 0 ? 'bg-red-50 text-red-800 ring-red-300' : 'bg-amber-50 text-amber-800 ring-amber-300' }}>
                      {i.stock_quantity === 0 ? 'Tugagan' : `${i.stock_quantity} dona`}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
