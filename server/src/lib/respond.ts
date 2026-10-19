import type { Context } from 'hono'
import { cached, cacheControl, type CachePolicy } from './cache.js'
import { UpstreamError } from './http.js'

export interface Envelope<T> {
  fetchedAt: number
  items: T
}

export async function serve<T>(c: Context, key: string, policy: CachePolicy, load: () => Promise<T>) {
  try {
    const result = await cached(key, policy, load)
    c.header('Cache-Control', cacheControl(policy, result))
    c.header('X-Cache', result.status)
    return c.json<Envelope<T>>({ fetchedAt: result.entry.fetchedAt, items: result.entry.value })
  } catch (error) {
    const source = error instanceof UpstreamError ? error.source : 'unknown'
    console.error(JSON.stringify({ event: 'upstream_failed', key, source, message: String(error) }))
    c.header('Cache-Control', 'public, max-age=5, s-maxage=15')
    return c.json({ error: 'upstream_unavailable', source }, 502)
  }
}
