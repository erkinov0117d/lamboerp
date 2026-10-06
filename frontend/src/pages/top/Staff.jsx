import { useState } from 'react'
import api, { errorMessage } from '../../api/client'
import useFetch from '../../lib/useFetch'
import { money } from '../../lib/format'
import { ROLE_LABELS } from '../../roles'
import { Button, Card, Empty, ErrorBox, Field, inputBase, inputCls, Modal, PageHeader, Spinner } from '../../components/ui'

function SalaryModal({ user, onClose, onSaved }) {
  const [salary, setSalary] = useState(user.salary)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.patch(`/v1/users/${user.id}/`, { salary })
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title="Maoshni o'zgartirish" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={error} />
        <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm">
          <div className="font-semibold">{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}</div>
          <div className="text-stone-500">{ROLE_LABELS[user.role]} · {user.branch_name ?? 'Bosh ofis'}</div>
        </div>
        <Field label="Oylik maosh (USD)" hint={`Yiliga: ${money(Number(salary || 0) * 12)}`}>
          <input className={inputCls} type="number" min="0" step="100" required autoFocus
            value={salary} onChange={(e) => setSalary(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Staff() {
  const [filters, setFilters] = useState({ search: '', branch: '', role: '' })
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  const { data, loading, error, reload } = useFetch('/v1/users/', params)
  const { data: branches } = useFetch('/v1/branches/')
  const [editing, setEditing] = useState(null)
  const setF = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })

  const list = data ?? []
  const monthly = list.reduce((s, u) => s + Number(u.salary || 0), 0)

  return (
    <>
      <PageHeader title="Xodimlar va maoshlar" subtitle="Oylik ish haqi fondi, USD" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Xodimlar', list.length],
          ['Oylik fond', money(monthly)],
          ['Yillik fond', money(monthly * 12)],
          ["O'rtacha maosh", money(list.length ? monthly / list.length : 0)],
        ].map(([label, value]) => (
          <Card key={label}>
            <div className="text-sm text-stone-500">{label}</div>
            <div className="mt-2 text-2xl font-bold">{value}</div>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input className={`${inputBase} w-64`} placeholder="Ism yoki login..." value={filters.search} onChange={setF('search')} />
        <select className={`${inputBase} w-52`} value={filters.branch} onChange={setF('branch')}>
          <option value="">Barcha filiallar</option>
          {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className={`${inputBase} w-48`} value={filters.role} onChange={setF('role')}>
          <option value="">Barcha rollar</option>
          {Object.entries(ROLE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : !list.length ? <Empty>Xodim topilmadi</Empty> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Xodim</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Filial</th>
                <th className="px-4 py-3 text-right">Oylik maosh</th>
                <th className="px-4 py-3 text-right">Yillik</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {list.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.username}</div>
                    <div className="text-xs text-stone-500">{u.username}</div>
                  </td>
                  <td className="px-4 py-3">{ROLE_LABELS[u.role]}</td>
                  <td className="px-4 py-3">{u.branch_name ?? <span className="text-stone-500">Bosh ofis</span>}</td>
                  <td className="tabular px-4 py-3 text-right font-semibold">{money(u.salary)}</td>
                  <td className="tabular px-4 py-3 text-right text-stone-600">{money(Number(u.salary) * 12)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setEditing(u)}>Maoshni o'zgartirish</Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="tabular border-t-2 border-stone-200 bg-stone-50 font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={3}>Jami ({list.length} xodim)</td>
                <td className="px-4 py-3 text-right">{money(monthly)}</td>
                <td className="px-4 py-3 text-right">{money(monthly * 12)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {editing && (
        <SalaryModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
      )}
    </>
  )
}
