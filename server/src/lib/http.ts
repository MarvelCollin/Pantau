const USER_AGENT = 'pantau/1.0 (+https://github.com/MarvelCollin/Pantau)'

export class UpstreamError extends Error {
  constructor(
    readonly source: string,
    readonly status: number,
    readonly retryAfterSec?: number,
  ) {
    super(`${source} responded ${status}`)
  }
}

interface FetchOptions {
  timeoutMs?: number
  headers?: Record<string, string>
}

export async function fetchText(source: string, url: string, options: FetchOptions = {}): Promise<string> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: '*/*', ...options.headers },
      signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
    })
  } catch {
    throw new UpstreamError(source, 504)
  }
  if (!res.ok) throw new UpstreamError(source, res.status, retryAfter(res.headers.get('retry-after')) ?? rateLimitReset(res))
  try {
    return await res.text()
  } catch {
    throw new UpstreamError(source, 504)
  }
}

function retryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds)
  const at = Date.parse(value)
  return Number.isNaN(at) ? undefined : Math.max(0, (at - Date.now()) / 1000)
}

function rateLimitReset(res: Response): number | undefined {
  if (res.status !== 429) return undefined
  const seconds = Number(res.headers.get('x-ratelimit-reset'))
  return Number.isFinite(seconds) && seconds > 0 && seconds < 1e9 ? seconds : undefined
}

export async function fetchJson<T>(source: string, url: string, options: FetchOptions = {}): Promise<T> {
  const text = await fetchText(source, url, { ...options, headers: { accept: 'application/json', ...options.headers } })
  try {
    return JSON.parse(text) as T
  } catch {
    throw new UpstreamError(source, 502)
  }
}

export function round(value: number, digits = 4): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}
