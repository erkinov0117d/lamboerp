import { useState } from 'react'
import api, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import useFetch from '../lib/useFetch'
import { date } from '../lib/format'
import { DOCUMENT_KINDS, downloadDocument, fileSize } from '../lib/documents'
import { Badge, Button, Card, Empty, ErrorBox, Field, inputBase, inputCls, Modal, PageHeader, Spinner } from '../components/ui'

function UploadModal({ isTop, onClose, onSaved }) {
  const { data: branches } = useFetch(isTop ? '/v1/branches/' : null)
  const [form, setForm] = useState({ title: '', kind: 'contract', order: '', branch: '' })
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const body = new FormData()
    body.append('file', file)
    body.append('title', form.title || file.name)
    body.append('kind', form.kind)
    if (form.order) body.append('order', form.order)
    if (isTop) body.append('branch', form.branch)
    try {
      await api.post('/v1/documents/', body)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title="Hujjat yuklash" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={error} />
        <Field label="Fayl" hint="PDF, rasm, Word, Excel, CSV yoki TXT — 10 MB gacha">
          <input className={inputCls} type="file" required accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt"
            onChange={(e) => setFile(e.target.files[0] ?? null)} />
        </Field>
        <Field label="Nomi">
          <input className={inputCls} value={form.title} onChange={set('title')} placeholder={file?.name ?? 'Masalan: Oldi-sotdi shartnomasi'} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Turi">
            <select className={inputCls} value={form.kind} onChange={set('kind')}>
              {Object.entries(DOCUMENT_KINDS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Buyurtma № (ixtiyoriy)">
            <input className={inputCls} type="number" min="1" value={form.order} onChange={set('order')} />
          </Field>
        </div>
        {isTop && (
          <Field label="Filial">
            <select className={inputCls} required value={form.branch} onChange={set('branch')}>
              <option value="">Tanlang...</option>
              {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button disabled={busy || !file}>{busy ? 'Yuklanmoqda...' : 'Yuklash'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Documents() {
  const { user } = useAuth()
  const isTop = user.role === 'top_management'
  const [filters, setFilters] = useState({ search: '', kind: '' })
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  const { data, loading, error, reload } = useFetch('/v1/documents/', params)
  const { data: health } = useFetch('/health/')
  const [uploading, setUploading] = useState(false)
  const [actionError, setActionError] = useState('')
  const setF = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })

  const download = (doc) => downloadDocument(doc).catch((err) => setActionError(errorMessage(err)))
  const remove = async (doc) => {
    if (!confirm(`"${doc.title}" o'chirilsinmi? Fayl bulut omboridan ham o'chiriladi.`)) return
    try {
      await api.delete(`/v1/documents/${doc.id}/`)
      reload()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  const storage = health?.checks?.storage
  return (
    <>
      <PageHeader
        title="Hujjatlar"
        subtitle={<>Invoice, shartnoma va hisobotlar · Saqlash joyi: <b>{storage?.backend ?? '...'}</b>{storage && !storage.ok && ' (xato!)'}</>}
        actions={<Button variant="gold" onClick={() => setUploading(true)}>+ Hujjat yuklash</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input className={`${inputBase} w-64`} placeholder="Nomi yoki mijoz..." value={filters.search} onChange={setF('search')} />
        <select className={`${inputBase} w-44`} value={filters.kind} onChange={setF('kind')}>
          <option value="">Barcha turlar</option>
          {Object.entries(DOCUMENT_KINDS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
      </div>

      <ErrorBox message={error || actionError} />
      {loading && !data ? <Spinner /> : !data?.length ? (
        <Empty>Hujjatlar yo'q. Buyurtma kartochkasidagi "Invoice" tugmasi yoki "Hujjat yuklash" orqali qo'shing.</Empty>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Hujjat</th>
                <th className="px-4 py-3">Turi</th>
                {isTop && <th className="px-4 py-3">Filial</th>}
                <th className="px-4 py-3">Buyurtma</th>
                <th className="px-4 py-3">Yukladi</th>
                <th className="px-4 py-3 text-right">Hajmi</th>
                <th className="px-4 py-3">Sana</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{d.title}</div>
                    <div className="font-mono text-xs text-stone-500">{d.filename}</div>
                  </td>
                  <td className="px-4 py-3"><Badge meta={DOCUMENT_KINDS[d.kind]} /></td>
                  {isTop && <td className="px-4 py-3">{d.branch_name}</td>}
                  <td className="px-4 py-3">{d.order ? `#${d.order}` : '—'}</td>
                  <td className="px-4 py-3">{d.uploaded_by_name ?? '—'}</td>
                  <td className="tabular px-4 py-3 text-right">{fileSize(d.size)}</td>
                  <td className="px-4 py-3 text-stone-500">{date(d.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => download(d)}>⬇ Yuklab olish</Button>
                      {(isTop || d.uploaded_by === user.id) && (
                        <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => remove(d)}>✕</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {uploading && <UploadModal isTop={isTop} onClose={() => setUploading(false)} onSaved={() => { setUploading(false); reload() }} />}
    </>
  )
}
