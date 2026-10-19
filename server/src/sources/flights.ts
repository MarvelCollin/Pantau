import { cached } from '../lib/cache.js'
import { fetchJson, round } from '../lib/http.js'

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

function point(lat: number, lon: number): Promise<ReadsbResponse> {
  return limited(() => pointDirect(lat, lon))
}

async function pointDirect(lat: number, lon: number): Promise<ReadsbResponse> {
  try {
    return await fetchJson<ReadsbResponse>('adsb.lol', `https://api.adsb.lol/v2/point/${lat}/${lon}/${RADIUS_NM}`, { timeoutMs: 6000 })
  } catch {
    return fetchJson<ReadsbResponse>('adsb.fi', `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${RADIUS_NM}`, { timeoutMs: 6000 })
  }
}

async function militaryHexes(): Promise<Set<string>> {
  try {
    const { entry } = await cached('flights:mil', { ttl: 120, swr: 600, sie: 3600 }, async () => {
      const res = await fetchJson<ReadsbResponse>('adsb.lol', 'https://api.adsb.lol/v2/mil', { timeoutMs: 6000 })
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
  return out
}
