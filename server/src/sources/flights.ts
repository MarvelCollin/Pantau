import { cached } from '../lib/cache.js'
import { fetchJson, round, UpstreamError } from '../lib/http.js'
import { attachRoutes, type FlightRoute } from './routes.js'

export const CELL_DEG = 5
const RADIUS_NM = 250

export interface Flight {
  hex: string
  callsign?: string
  reg?: string
  type?: string
  lat: number
  lon: number
  altFt: number | null
  ground: boolean
  speedKt?: number
  track?: number
  vertFpm?: number
  squawk?: string
  emergency?: string
  military: boolean
  seen: number
  route?: FlightRoute
}

interface ReadsbAircraft {
  hex: string
  flight?: string
  r?: string
  t?: string
  lat?: number
  lon?: number
  alt_baro?: number | 'ground'
  alt_geom?: number
  gs?: number
  track?: number
  true_heading?: number
  baro_rate?: number
  geom_rate?: number
  squawk?: string
  emergency?: string
  seen_pos?: number
}

interface ReadsbResponse {
  ac?: ReadsbAircraft[]
  aircraft?: ReadsbAircraft[]
  now: number
}

const MAX_PARALLEL = 2
let running = 0
const waiting: (() => void)[] = []

async function limited<T>(job: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve))
  running++
  try {
    return await job()
  } finally {
    running--
    waiting.shift()?.()
  }
}

const LOL_RATE_COOLDOWN_MS = 120_000
const LOL_ERROR_COOLDOWN_MS = 30_000
const LOL_MAX_COOLDOWN_MS = 600_000
let lolBlockedUntil = 0

function lolOpen(): boolean {
  return Date.now() >= lolBlockedUntil
}

function tripLol(error: unknown) {
  const status = error instanceof UpstreamError ? error.status : 504
  const hinted = error instanceof UpstreamError && error.retryAfterSec !== undefined ? error.retryAfterSec * 1000 : undefined
  const base = status === 429 ? LOL_RATE_COOLDOWN_MS : LOL_ERROR_COOLDOWN_MS
  const ms = Math.min(LOL_MAX_COOLDOWN_MS, Math.max(hinted ?? base, status === 429 ? LOL_ERROR_COOLDOWN_MS : 5_000))
  const until = Date.now() + ms
  if (until <= lolBlockedUntil) return
  const wasOpen = lolOpen()
  lolBlockedUntil = until
  if (wasOpen) console.warn(JSON.stringify({ event: 'adsb_lol_cooldown', status, seconds: Math.round(ms / 1000) }))
}

async function fromLol<T>(url: string): Promise<T> {
  if (!lolOpen()) throw new UpstreamError('adsb.lol', 429)
  try {
    return await fetchJson<T>('adsb.lol', url, { timeoutMs: 6000 })
  } catch (error) {
    tripLol(error)
    throw error
  }
}

const FI_GAP_MS = 1100
const FI_RETRY_MAX_MS = 3000
let fiNextAt = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fiTurn() {
  const now = Date.now()
  const at = Math.max(now, fiNextAt)
  fiNextAt = at + FI_GAP_MS
  if (at > now) await sleep(at - now)
}

async function fromFi<T>(url: string): Promise<T> {
  await fiTurn()
  try {
    return await fetchJson<T>('adsb.fi', url, { timeoutMs: 6000 })
  } catch (error) {
    if (!(error instanceof UpstreamError) || error.status !== 429) throw error
    const wait = Math.min(FI_RETRY_MAX_MS, Math.max(FI_GAP_MS, (error.retryAfterSec ?? 2) * 1000))
    fiNextAt = Math.max(fiNextAt, Date.now() + wait)
    await fiTurn()
    return fetchJson<T>('adsb.fi', url, { timeoutMs: 6000 })
  }
}

function point(lat: number, lon: number): Promise<ReadsbResponse> {
  return limited(() => pointDirect(lat, lon))
}

async function pointDirect(lat: number, lon: number): Promise<ReadsbResponse> {
  if (lolOpen()) {
    const res = await fromLol<ReadsbResponse>(`https://api.adsb.lol/v2/point/${lat}/${lon}/${RADIUS_NM}`).catch(() => null)
    if (res) return res
  }
  return fromFi<ReadsbResponse>(`https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${RADIUS_NM}`)
}

async function militaryHexes(): Promise<Set<string>> {
  try {
    const { entry } = await cached('flights:mil', { ttl: 120, swr: 600, sie: 3600 }, async () => {
      const res = await fromLol<ReadsbResponse>('https://api.adsb.lol/v2/mil')
      return (res.ac ?? []).map((a) => a.hex)
    })
    return new Set(entry.value)
  } catch {
    return new Set()
  }
}

export function snapCell(value: number): number {
  return Math.round(value / CELL_DEG) * CELL_DEG
}

const OVERVIEW_POINTS: [number, number][] = [
  [-6.5, 107],
  [-7.6, 112.4],
  [-8.4, 116.2],
  [-2.8, 104.6],
  [1.2, 104],
  [3.4, 98.6],
  [-1.4, 116.6],
  [-4.8, 120],
  [1.2, 124.6],
  [-3.4, 128.6],
  [-2.6, 138.6],
]

export async function loadOverview(): Promise<Flight[]> {
  const results = await Promise.allSettled(
    OVERVIEW_POINTS.map(([lat, lon]) =>
      cached(`flights:point:${lat}:${lon}`, { ttl: 40, swr: 80, sie: 300 }, () => loadFlights(lat, lon)).then((r) => r.entry.value),
    ),
  )
  const ok = results.filter((r): r is PromiseFulfilledResult<Flight[]> => r.status === 'fulfilled')
  if (ok.length === 0) throw (results[0] as PromiseRejectedResult).reason
  const merged = new Map<string, Flight>()
  for (const r of ok) for (const f of r.value) if (!merged.has(f.hex) || merged.get(f.hex)!.seen > f.seen) merged.set(f.hex, f)
  return attachRoutes([...merged.values()])
}

export interface AircraftPhoto {
  src: string
  width: number
  height: number
  link: string
  photographer: string
}

interface PlanespottersResponse {
  photos?: { thumbnail_large?: { src: string; size: { width: number; height: number } }; link: string; photographer: string }[]
}

export async function loadPhoto(hex: string): Promise<AircraftPhoto | null> {
  const res = await fetchJson<PlanespottersResponse>('Planespotters', `https://api.planespotters.net/pub/photos/hex/${hex}`, {
    timeoutMs: 6000,
    headers: { 'user-agent': 'pantau/1.0 (+https://marvelcollin.com/pantau/)' },
  })
  const p = res.photos?.[0]
  if (!p?.thumbnail_large) return null
  return { src: p.thumbnail_large.src, width: p.thumbnail_large.size.width, height: p.thumbnail_large.size.height, link: p.link, photographer: p.photographer }
}

export async function loadFlights(lat: number, lon: number): Promise<Flight[]> {
  const [res, mil] = await Promise.all([point(lat, lon), militaryHexes()])
  const list = res.ac ?? res.aircraft ?? []
  const out: Flight[] = []
  for (const a of list) {
    if (a.lat === undefined || a.lon === undefined) continue
    if ((a.seen_pos ?? 0) > 60) continue
    const ground = a.alt_baro === 'ground'
    const alt = typeof a.alt_baro === 'number' ? a.alt_baro : (a.alt_geom ?? null)
    out.push({
      hex: a.hex,
      callsign: a.flight?.trim() || undefined,
      reg: a.r,
      type: a.t,
      lat: round(a.lat),
      lon: round(a.lon),
      altFt: ground ? 0 : alt,
      ground,
      speedKt: a.gs !== undefined ? Math.round(a.gs) : undefined,
      track: a.track ?? a.true_heading,
      vertFpm: a.baro_rate ?? a.geom_rate,
      squawk: a.squawk,
      emergency: a.emergency && a.emergency !== 'none' ? a.emergency : undefined,
      military: mil.has(a.hex),
      seen: Math.round(a.seen_pos ?? 0),
    })
  }
  return attachRoutes(out)
}
