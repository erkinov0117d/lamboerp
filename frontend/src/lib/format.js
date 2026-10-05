const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usdCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })

export const money = (v) => usd.format(Number(v || 0))
export const moneyCompact = (v) => usdCompact.format(Number(v || 0))

export const date = (v) =>
  v ? new Date(v).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export const ORDER_STATUS = {
  pending: { label: 'Kutilmoqda', cls: 'bg-stone-100 text-stone-700 ring-stone-300' },
  in_progress: { label: 'Jarayonda', cls: 'bg-sky-50 text-sky-800 ring-sky-300' },
  completed: { label: 'Bajarildi', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-300' },
  cancelled: { label: 'Bekor qilindi', cls: 'bg-red-50 text-red-800 ring-red-300' },
}

export const INVENTORY_STATUS = {
  available: { label: 'Mavjud', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-300' },
  reserved: { label: 'Band qilingan', cls: 'bg-amber-50 text-amber-800 ring-amber-300' },
  sold: { label: 'Sotilgan', cls: 'bg-stone-100 text-stone-600 ring-stone-300' },
  out_of_stock: { label: 'Tugagan', cls: 'bg-red-50 text-red-800 ring-red-300' },
}
