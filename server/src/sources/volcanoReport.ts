import { cached } from '../lib/cache.js'
import { UpstreamError } from '../lib/http.js'

export interface VolcanoReport {
  period: string
  author?: string
  visual?: string
  photo?: string
  weather?: string
  seismic: string[]
  seismicChart?: string
  advice?: string
}

interface Session {
  cookie: string
  token: string
  url: string
}

const UA = 'pantau/1.0 (+https://marvelcollin.com/pantau/)'

function clean(value?: string): string | undefined {
  if (!value) return undefined
  const text = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&deg;/g, '°')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
  return text || undefined
}

async function session(): Promise<Session> {
  const { entry } = await cached('magma:session', { ttl: 600, swr: 0, sie: 0 }, async () => {
    let res: Response
    try {
      res = await fetch('https://magma.esdm.go.id/', { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10000) })
    } catch {
      throw new UpstreamError('MAGMA', 504)
    }
    const html = await res.text()
    const token = /name="csrf-token" content="([^"]+)"/.exec(html)?.[1]
    const url = /https:\/\/magma\.esdm\.go\.id\/v1\/json\/var\?signature=[a-f0-9]+/.exec(html)?.[0]
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
    if (!token || !url || !cookie) throw new UpstreamError('MAGMA', 502)
    return { cookie, token, url }
  })
  return entry.value
}

interface MagmaVar {
  data?: {
    laporan?: { tanggal?: string; pembuat?: string }
    visual?: { deskripsi?: string; foto?: string }
    klimatologi?: { deskripsi?: string }
    gempa?: { deskripsi?: string[]; grafik?: string }
    rekomendasi?: string
  }
}

export async function loadVolcanoReport(code: string): Promise<VolcanoReport> {
  const s = await session()
  let res: Response
  try {
    res = await fetch(s.url, {
      method: 'POST',
      headers: {
        'user-agent': UA,
        cookie: s.cookie,
        'x-csrf-token': s.token,
        'x-requested-with': 'XMLHttpRequest',
        referer: 'https://magma.esdm.go.id/',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: `ga_code=${encodeURIComponent(code)}`,
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    throw new UpstreamError('MAGMA', 504)
  }
  if (!res.ok) throw new UpstreamError('MAGMA', res.status)
  const json = (await res.json()) as MagmaVar
  const d = json.data
  if (!d) throw new UpstreamError('MAGMA', 404)
  return {
    period: clean(d.laporan?.tanggal) ?? 'Latest report',
    author: clean(d.laporan?.pembuat),
    visual: clean(d.visual?.deskripsi),
    photo: d.visual?.foto,
    weather: clean(d.klimatologi?.deskripsi),
    seismic: (d.gempa?.deskripsi ?? []).map((x) => clean(x)).filter((x): x is string => !!x),
    seismicChart: d.gempa?.grafik,
    advice: clean(d.rekomendasi),
  }
}
