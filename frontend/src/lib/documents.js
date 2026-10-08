import api from '../api/client'

export const DOCUMENT_KINDS = {
  invoice: { label: 'Invoice', cls: 'bg-amber-50 text-amber-800 ring-amber-300' },
  contract: { label: 'Shartnoma', cls: 'bg-sky-50 text-sky-800 ring-sky-300' },
  report: { label: 'Hisobot', cls: 'bg-violet-50 text-violet-800 ring-violet-300' },
  other: { label: 'Boshqa', cls: 'bg-stone-100 text-stone-700 ring-stone-300' },
}

export function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Faylni JWT bilan yuklab olib, brauzerda saqlaydi (S3 bucket yopiq — to'g'ridan-to'g'ri havola yo'q). */
export async function downloadDocument(doc) {
  const res = await api.get(`/v1/documents/${doc.id}/download/`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = doc.filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Buyurtma uchun invoice PDF yaratadi (S3'ga saqlanadi) va darhol yuklab beradi. */
export async function createInvoice(orderId) {
  const { data } = await api.post(`/v1/orders/${orderId}/invoice/`)
  await downloadDocument(data)
  return data
}
