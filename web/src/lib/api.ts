export interface Envelope<T> {
  fetchedAt: number
  items: T
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const target = url.startsWith('/api/') ? API_BASE + url : url
  let res: Response
  try {
    res = await fetch(target, { signal, headers: { accept: 'application/json' } })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError(0, 'offline')
  }
  if (!res.ok) {
    let code = 'http_' + res.status
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) code = body.error
    } catch {
      code = 'http_' + res.status
    }
    throw new ApiError(res.status, code)
  }
  return (await res.json()) as T
}

export function getEnvelope<T>(path: string, signal?: AbortSignal): Promise<Envelope<T>> {
  return getJson<Envelope<T>>(path, signal)
}
