import useSWR, { mutate } from 'swr'

const ARRAY_FIELDS = [
  'articles', 'topics', 'entities', 'sweeps', 'posts', 'stocks',
  'data', 'sources', 'rows', 'cols', 'nodes', 'links', 'pipeline_stages',
  'top_entities', 'indices', 'sectors',
]

function normalize<T>(obj: unknown): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj as T
  if (Array.isArray(obj)) return obj.map((v) => normalize(v)) as T
  const record = obj as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (ARRAY_FIELDS.includes(key) && record[key] == null) {
      record[key] = []
    } else if (typeof record[key] === 'object' && record[key] !== null) {
      record[key] = normalize(record[key])
    }
  }
  return record as T
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    throw error
  }
  const raw = await res.json()
  return normalize<T>(raw)
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
    dedupingInterval: 30000,
    ...(refreshInterval ? { refreshInterval } : {}),
  })
}

export async function apiClient(path: string, options?: RequestInit): Promise<Response> {
  const url = path.startsWith('http') ? path : `/api${path}`
  return fetch(url, options)
}

export { mutate, fetcher }
