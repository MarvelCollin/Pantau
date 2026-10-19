import { waitUntil } from '@vercel/functions'

export interface CachePolicy {
  ttl: number
  swr: number
  sie: number
  browser?: number
}

export interface CacheEntry<T> {
  value: T
  fetchedAt: number
}

export type CacheStatus = 'HIT' | 'STALE' | 'MISS' | 'ERROR-STALE'

export interface CacheResult<T> {
  entry: CacheEntry<T>
  status: CacheStatus
}

const MAX_ENTRIES = 400
const store = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<CacheEntry<unknown>>>()

function remember<T>(key: string, entry: CacheEntry<T>) {
  store.delete(key)
  store.set(key, entry)
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}

function refresh<T>(key: string, load: () => Promise<T>): Promise<CacheEntry<T>> {
  const running = inflight.get(key)
  if (running) return running as Promise<CacheEntry<T>>
  const job = load()
    .then((value) => {
      const entry = { value, fetchedAt: Date.now() }
      remember(key, entry)
      return entry
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, job)
  return job
}

export async function cached<T>(key: string, policy: CachePolicy, load: () => Promise<T>): Promise<CacheResult<T>> {
  const entry = store.get(key) as CacheEntry<T> | undefined
  const age = entry ? (Date.now() - entry.fetchedAt) / 1000 : Infinity

  if (entry && age < policy.ttl) return { entry, status: 'HIT' }

  if (entry && age < policy.ttl + policy.swr) {
    waitUntil(refresh(key, load).catch(() => undefined))
    return { entry, status: 'STALE' }
  }

  try {
    return { entry: await refresh(key, load), status: 'MISS' }
  } catch (error) {
    if (entry && age < policy.ttl + policy.sie) return { entry, status: 'ERROR-STALE' }
    throw error
  }
}

export function cacheControl(policy: CachePolicy, result: CacheResult<unknown>): string {
  const age = Math.floor((Date.now() - result.entry.fetchedAt) / 1000)
  const fresh = Math.max(1, policy.ttl - age)
  const edge = result.status === 'ERROR-STALE' ? Math.min(30, policy.ttl) : result.status === 'STALE' ? 1 : fresh
  const browser = Math.min(policy.browser ?? fresh, fresh)
  return `public, max-age=${browser}, s-maxage=${edge}, stale-while-revalidate=${policy.swr}, stale-if-error=${policy.sie}`
}
