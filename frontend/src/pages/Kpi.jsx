import { useState } from 'react'
import api, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import useFetch from '../lib/useFetch'
import { money } from '../lib/format'
import { ROLE_LABELS } from '../roles'
import { Badge, Button, Card, Empty, ErrorBox, Field, inputBase, inputCls, Modal, PageHeader, Spinner } from '../components/ui'

const RATING = {
  excellent: { label: "A'lo", cls: 'bg-emerald-50 text-emerald-800 ring-emerald-300', bar: 'bg-emerald-500' },
  good: { label: 'Yaxshi', cls: 'bg-sky-50 text-sky-800 ring-sky-300', bar: 'bg-sky-500' },
  fair: { label: 'Qoniqarli', cls: 'bg-amber-50 text-amber-800 ring-amber-300', bar: 'bg-amber-500' },
  low: { label: 'Past', cls: 'bg-red-50 text-red-800 ring-red-300', bar: 'bg-red-500' },
  none: { label: 'Reja yo\'q', cls: 'bg-stone-100 text-stone-600 ring-stone-300', bar: 'bg-stone-400' },
}

const pct = (v) => (v === null || v === undefined ? '—' : `${Math.round(Number(v) * 100)}%`)

function fmt(value, unit) {
  if (unit === 'usd') return money(value)
  if (unit === 'percent') return `${Number(value).toFixed(0)}%`
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 })
}

function ratingOf(ratio) {
  if (ratio === null || ratio === undefined) return 'none'
  const r = Number(ratio)
  return r >= 1 ? 'excellent' : r >= 0.8 ? 'good' : r >= 0.6 ? 'fair' : 'low'
}

function MetricBar({ metric, compact = false }) {
  const ratio = metric.ratio === null ? 0 : Number(metric.ratio)
  return (
    <div>
      <div className={`flex items-baseline justify-between gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="text-stone-600">{metric.label}{!compact && Number(metric.weight) < 1 && <span className="text-stone-400"> · vazni {pct(metric.weight)}</span>}</span>
        <span className="tabular whitespace-nowrap">
          <b>{fmt(metric.actual, metric.unit)}</b>
          <span className="text-stone-500"> / {fmt(metric.target, metric.unit)}</span>
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className={`flex-1 overflow-hidden rounded-full bg-stone-200 ${compact ? 'h-1.5' : 'h-2.5'}`}>
          <div className={`h-full rounded-full ${RATING[ratingOf(metric.ratio)].bar}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
        </div>
        <span className="tabular w-11 text-right text-xs font-semibold">{pct(metric.ratio)}</span>
      </div>
    </div>
  )
}

function TargetModal({ row, period, onClose, onSaved }) {
  const isWarehouse = row.role === 'warehouse_manager'
  const [form, setForm] = useState({
    monthly_revenue_target: row.targets.monthly_revenue,
    monthly_orders_target: row.targets.monthly_orders,
    availability_target: row.targets.availability,
    bonus_rate: row.bonus_rate,
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.patch(`/v1/kpi/${row.user_id}/target/`, form, { params: { period } })
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title="KPI rejasini o'zgartirish" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={error} />
        <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm">
          <div className="font-semibold">{row.full_name}</div>
          <div className="text-stone-500">{ROLE_LABELS[row.role]} · {row.branch_name}</div>
        </div>
        {isWarehouse ? (
          <Field label="Yetarli qoldiqdagi qismlar ulushi (%)" hint="Qoldig'i 5 donadan ko'p bo'lgan ehtiyot qismlar foizi">
            <input className={inputCls} type="number" min="0" max="100" required value={form.availability_target} onChange={set('availability_target')} />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Oylik daromad rejasi (USD)">
              <input className={inputCls} type="number" min="0" step="100" required value={form.monthly_revenue_target} onChange={set('monthly_revenue_target')} />
            </Field>
            <Field label={row.role === 'sales_manager' ? 'Oyiga avtomobillar' : 'Oyiga servislar'} hint="Kasr bo'lishi mumkin: 0.5 = 2 oyda 1 ta">
              <input className={inputCls} type="number" min="0" step="0.1" required value={form.monthly_orders_target} onChange={set('monthly_orders_target')} />
            </Field>
          </div>
        )}
        <Field label="Bonus stavkasi (maoshga nisbatan %)" hint="Bonus = maosh × stavka × bajarilish (70% dan past bo'lsa — bonus yo'q, eng ko'pi 150%)">
          <input className={inputCls} type="number" min="0" max="100" required value={form.bonus_rate} onChange={set('bonus_rate')} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function PeriodSwitch({ periods, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-stone-200/60 p-1">
      {Object.entries(periods ?? {}).map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${value === key ? 'bg-white shadow-sm' : 'text-stone-600 hover:text-ink-900'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** Xodimning o'z KPI'si. */
function MyKpi({ row, periodLabel }) {
  if (!row) return <Empty>Sizning rolingiz uchun KPI belgilanmagan</Empty>
  const meta = RATING[row.rating]
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="flex flex-col items-center justify-center py-8 text-center">
        <div className="text-sm text-stone-500">Rejaning bajarilishi · {periodLabel}</div>
        <div className="my-3 text-6xl font-black tracking-tight">{pct(row.score)}</div>
        <Badge meta={meta} />
      </Card>
      <Card className="lg:col-span-2">
        <h2 className="mb-4 font-semibold">Ko'rsatkichlar</h2>
        <div className="space-y-5">
          {row.metrics.map((m) => <MetricBar key={m.key} metric={m} />)}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 pt-4">
          <div>
            <div className="text-sm text-stone-500">Hisoblangan bonus</div>
            <div className="text-2xl font-bold">{money(row.bonus)}</div>
          </div>
          <p className="max-w-md text-xs text-stone-500">
            Bonus = maosh × {row.months} oy × {row.bonus_rate}% × bajarilish foizi. Bajarilish 70% dan past bo'lsa bonus hisoblanmaydi.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default function Kpi() {
  const { user } = useAuth()
  const isTop = user.role === 'top_management'
  const [period, setPeriod] = useState('quarter')
  const [filters, setFilters] = useState({ branch: '', role: '' })
  const params = { period, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }
  const { data, loading, error, reload } = useFetch('/v1/kpi/', params)
  const { data: branches } = useFetch(isTop ? '/v1/branches/' : null)
  const [editing, setEditing] = useState(null)
  const setF = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })

  const header = (
    <PageHeader
      title={isTop ? 'KPI — xodimlar samaradorligi' : "Mening KPI'im"}
      subtitle={isTop ? 'Reja, haqiqiy natija va bonuslar' : `${user.branch_name} · ${ROLE_LABELS[user.role]}`}
      actions={<PeriodSwitch periods={data?.periods} value={period} onChange={setPeriod} />}
    />
  )

  if (!isTop) {
    return (
      <>
        {header}
        <ErrorBox message={error} />
        {loading && !data ? <Spinner /> : data && <MyKpi row={data.results[0]} periodLabel={data.period_label} />}
      </>
    )
  }

  const totals = data?.totals
  return (
    <>
      {header}
      {totals && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ['Xodimlar', totals.staff_count],
            ["O'rtacha bajarilish", pct(totals.avg_score)],
            ['Rejani bajarganlar', `${totals.above_target} / ${totals.staff_count}`],
            ['Bonus fondi', money(totals.bonus)],
          ].map(([label, value]) => (
            <Card key={label}>
              <div className="text-sm text-stone-500">{label}</div>
              <div className="mt-2 text-2xl font-bold">{value}</div>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <select className={`${inputBase} w-52`} value={filters.branch} onChange={setF('branch')}>
          <option value="">Barcha filiallar</option>
          {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className={`${inputBase} w-48`} value={filters.role} onChange={setF('role')}>
          <option value="">Barcha rollar</option>
          {['sales_manager', 'service_master', 'warehouse_manager'].map((k) => <option key={k} value={k}>{ROLE_LABELS[k]}</option>)}
        </select>
      </div>

      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : !data?.results.length ? <Empty>Xodim topilmadi</Empty> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Xodim</th>
                <th className="w-[38%] px-4 py-3">Ko'rsatkichlar (haqiqiy / reja)</th>
                <th className="px-4 py-3 text-right">Bajarilish</th>
                <th className="px-4 py-3 text-right">Bonus</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.results.map((r, i) => (
                <tr key={r.user_id}>
                  <td className="px-4 py-3 text-stone-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-stone-500">{ROLE_LABELS[r.role]} · {r.branch_name}</div>
                  </td>
                  <td className="space-y-2 px-4 py-3">
                    {r.metrics.map((m) => <MetricBar key={m.key} metric={m} compact />)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="tabular text-lg font-bold">{pct(r.score)}</div>
                    <Badge meta={RATING[r.rating]} />
                  </td>
                  <td className="tabular px-4 py-3 text-right font-semibold">{money(r.bonus)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" className="whitespace-nowrap px-2.5 py-1 text-xs" onClick={() => setEditing(r)}>Reja</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editing && (
        <TargetModal row={editing} period={period} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
      )}
    </>
  )
}
