import { useState } from 'react'
import api, { errorMessage } from '../../api/client'
import useFetch from '../../lib/useFetch'
import { date } from '../../lib/format'
import { Button, Card, ErrorBox, Field, inputCls, Modal, PageHeader, Spinner } from '../../components/ui'

const EMPTY = { name: '', location: '', phone: '' }

export default function Branches() {
  const { data, loading, error, reload } = useFetch('/v1/branches/')
  const [editing, setEditing] = useState(null) // null | {} (yangi) | branch
  const [form, setForm] = useState(EMPTY)
  const [formError, setFormError] = useState('')

  const open = (branch) => {
    setEditing(branch ?? {})
    setForm(branch ? { name: branch.name, location: branch.location, phone: branch.phone } : EMPTY)
    setFormError('')
  }

  const save = async (e) => {
    e.preventDefault()
    try {
      if (editing.id) await api.put(`/v1/branches/${editing.id}/`, form)
      else await api.post('/v1/branches/', form)
      setEditing(null)
      reload()
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  const remove = async (branch) => {
    if (!confirm(`"${branch.name}" filialini o'chirasizmi? Uning ombori va buyurtmalari ham o'chadi.`)) return
    try {
      await api.delete(`/v1/branches/${branch.id}/`)
      reload()
    } catch (err) {
      alert(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader title="Filiallar" subtitle="Dilerlik markazlari"
        actions={<Button variant="gold" onClick={() => open(null)}>+ Yangi filial</Button>} />
      <ErrorBox message={error} />
      {loading && !data ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((b) => (
            <Card key={b.id}>
              <div className="text-lg font-semibold">{b.name}</div>
              <div className="mt-1 text-sm text-stone-600">📍 {b.location}</div>
              <div className="text-sm text-stone-600">📞 {b.phone}</div>
              <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                <span>{b.staff_count} xodim · {date(b.created_at)}</span>
                <span className="flex gap-2">
                  <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => open(b)}>Tahrirlash</Button>
                  <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => remove(b)}>O'chirish</Button>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editing} title={editing?.id ? 'Filialni tahrirlash' : 'Yangi filial'} onClose={() => setEditing(null)}>
        <form onSubmit={save} className="space-y-4">
          <ErrorBox message={formError} />
          <Field label="Nomi"><input className={inputCls} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lamborghini Tashkent" /></Field>
          <Field label="Manzil"><input className={inputCls} required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="Telefon"><input className={inputCls} required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Bekor qilish</Button>
            <Button>Saqlash</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
