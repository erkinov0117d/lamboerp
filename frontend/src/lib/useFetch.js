import { useCallback, useEffect, useState } from 'react'
import api, { errorMessage } from '../api/client'

/** GET so'rov uchun oddiy hook: { data, loading, error, reload }. `url` null bo'lsa so'rov yuborilmaydi. */
export default function useFetch(url, params) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(!!url)
  const [error, setError] = useState('')
  const key = JSON.stringify(params ?? {})

  const reload = useCallback(() => {
    if (!url) return Promise.resolve()
    setLoading(true)
    return api.get(url, { params: JSON.parse(key) })
      .then((r) => { setData(r.data); setError('') })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [url, key])

  useEffect(() => { reload() }, [reload])

  return { data, loading, error, reload, setData }
}
