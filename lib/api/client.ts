import useSWR, { mutate } from 'swr'

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    throw error
  }
  return res.json()
}

export function useApi<T>(path: string | null, refreshInterval?: number) {
  let url: string | null = null
  if (path) {
    if (path.startsWith('http')) {
      url = path
    } else {
      url = `/api${path}`
    }
  }
  return useSWR<T>(url, url ? fetcher : null, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
    ...(refreshInterval ? { refreshInterval } : {}),
  })
}

export async function apiClient(path: string, options?: RequestInit): Promise<Response> {
  const url = path.startsWith('http') ? path : `/api${path}`
  return fetch(url, options)
}

export { mutate, fetcher }
