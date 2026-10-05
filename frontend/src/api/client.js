import axios from 'axios'

const ACCESS_KEY = 'lambo_access'
const REFRESH_KEY = 'lambo_refresh'

export const tokens = {
  get access() { return localStorage.getItem(ACCESS_KEY) },
  get refresh() { return localStorage.getItem(REFRESH_KEY) },
  set({ access, refresh }) {
    if (access) localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  if (tokens.access) config.headers.Authorization = `Bearer ${tokens.access}`
  return config
})

// Access token muddati tugasa — refresh token bilan bir marta yangilab, so'rovni qaytaramiz.
let refreshing = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const isAuthCall = original?.url?.startsWith('/auth/token')
    if (error.response?.status !== 401 || original._retry || isAuthCall || !tokens.refresh) {
      if (error.response?.status === 401 && !isAuthCall) {
        tokens.clear()
        window.dispatchEvent(new Event('auth:logout'))
      }
      return Promise.reject(error)
    }
    original._retry = true
    try {
      refreshing ??= axios
        .post('/api/auth/token/refresh/', { refresh: tokens.refresh })
        .then((r) => tokens.set(r.data))
        .finally(() => { refreshing = null })
      await refreshing
      return api(original)
    } catch (e) {
      tokens.clear()
      window.dispatchEvent(new Event('auth:logout'))
      return Promise.reject(e)
    }
  },
)

/** DRF xatolik javobini o'qiladigan matnga aylantiradi. */
export function errorMessage(error) {
  const data = error?.response?.data
  if (!data) return error?.message || "Server bilan bog'lanib bo'lmadi"
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  return Object.entries(data)
    .map(([field, msg]) => {
      const text = Array.isArray(msg) ? msg.map((m) => (typeof m === 'object' ? JSON.stringify(m) : m)).join(' ') : msg
      return field === 'non_field_errors' ? text : `${field}: ${text}`
    })
    .join('\n')
}

export default api
