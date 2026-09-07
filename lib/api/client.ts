import useSWR, { mutate } from 'swr'

const API_BASE = '/api'

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    throw error
  }
  return res.json()
}

export function useApi<T>(path: string | null, refreshInterval?: number) {
  const url = path ? (path.startsWith('http') ? path : `${API_BASE}${path}`) : null
  return useSWR<T>(url, url ? fetcher : null, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
    ...(refreshInterval ? { refreshInterval } : {}),
  })
}

export { mutate, fetcher }
