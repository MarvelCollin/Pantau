const USER_AGENT = 'pantau/1.0 (+https://github.com/MarvelCollin/Pantau)'

export class UpstreamError extends Error {
  constructor(
    readonly source: string,
    readonly status: number,
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
  if (!res.ok) throw new UpstreamError(source, res.status)
  return res.text()
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
