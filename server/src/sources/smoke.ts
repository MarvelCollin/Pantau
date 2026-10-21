import { cached } from '../lib/cache.js'
import { fetchJson, round, UpstreamError } from '../lib/http.js'
import { KARHUTLA_POLICY, loadKarhutla } from './karhutla.js'

export type SmokeCell = [lat: number, lon: number, windSpeed: number, windFrom: number, ...pm25: number[]]

export interface SmokePlume {
  id: string
  lat: number
  lon: number
  hotspots: number
  high: number
  regency: string
  province: string
  transportKmh: number
  path: [lon: number, lat: number][]
}

export interface Smoke {
  start: number
  pmStepHours: number
  cells: SmokeCell[]
  plumes: SmokePlume[]
}

interface Forecast {
  latitude: number
  longitude: number
  hourly: Record<string, (number | null)[]> & { time: number[] }
}

const HOURS = 24
const PM_STEP = 3
const BIN = 0.5
const MIN_HOTSPOTS = 4
const MAX_PLUMES = 30
const REACH = 3
const MAX_CELLS = 220
const BATCH = 110
const BOX = { south: -11, north: 6, west: 94, east: 141 }

interface Cluster {
  key: string
  lat: number
  lon: number
  count: number
  high: number
  regencies: Map<string, { count: number; province: string }>
}

function clusters(data: Awaited<ReturnType<typeof loadKarhutla>>): Cluster[] {
  const bins = new Map<string, Cluster>()
  for (const h of data.hotspots) {
    if (h[2] === 'l' || h[7]) continue
    const key = `${Math.floor(h[0] / BIN) * BIN},${Math.floor(h[1] / BIN) * BIN}`
    const c = bins.get(key) ?? { key, lat: 0, lon: 0, count: 0, high: 0, regencies: new Map() }
    c.lat += h[0]
    c.lon += h[1]
    c.count++
    if (h[2] === 'h') c.high++
    const place = data.places[h[5]]
    if (place?.[2]) {
      const r = c.regencies.get(place[2]) ?? { count: 0, province: place[3] }
      r.count++
      c.regencies.set(place[2], r)
    }
    bins.set(key, c)
  }

  const sorted = [...bins.values()]
    .filter((c) => c.count >= MIN_HOTSPOTS)
    .map((c) => ({ ...c, lat: c.lat / c.count, lon: c.lon / c.count }))
    .sort((a, b) => b.count - a.count)

  const kept: Cluster[] = []
  for (const c of sorted) {
    const near = kept.find((k) => Math.abs(k.lat - c.lat) < 0.75 && Math.abs(k.lon - c.lon) < 0.75)
    if (near) {
      near.count += c.count
      near.high += c.high
      for (const [name, r] of c.regencies) {
        const into = near.regencies.get(name) ?? { count: 0, province: r.province }
        into.count += r.count
        near.regencies.set(name, into)
      }
      continue
    }
    if (kept.length < MAX_PLUMES) kept.push(c)
  }
  return kept
}

function gridAround(sources: Cluster[]): [number, number][] {
  const cells = new Map<string, { lat: number; lon: number; d: number }>()
  for (const s of sources) {
    for (let lat = Math.floor(s.lat) - REACH; lat <= Math.ceil(s.lat) + REACH; lat++) {
      for (let lon = Math.floor(s.lon) - REACH; lon <= Math.ceil(s.lon) + REACH; lon++) {
        if (lat < BOX.south || lat > BOX.north || lon < BOX.west || lon > BOX.east) continue
        const d = Math.hypot(lat - s.lat, lon - s.lon)
        const key = `${lat},${lon}`
        const prev = cells.get(key)
        if (!prev || d < prev.d) cells.set(key, { lat, lon, d })
      }
    }
  }
  return [...cells.values()]
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_CELLS)
    .map((c) => [c.lat, c.lon])
}

async function forecast(source: string, base: string, vars: string, points: [number, number][]): Promise<Forecast[]> {
  const batches: [number, number][][] = []
  for (let i = 0; i < points.length; i += BATCH) batches.push(points.slice(i, i + BATCH))
  const results = await Promise.all(
    batches.map(async (batch) => {
      const url =
        `${base}?latitude=${batch.map((p) => p[0]).join(',')}&longitude=${batch.map((p) => p[1]).join(',')}` +
        `&hourly=${vars}&forecast_hours=${HOURS + 1}&timezone=GMT&timeformat=unixtime&wind_speed_unit=ms`
      const body = await fetchJson<Forecast | Forecast[]>(source, url, { timeoutMs: 15000 })
      const list = Array.isArray(body) ? body : [body]
      if (list.length !== batch.length) throw new UpstreamError(source, 502)
      return list
    }),
  )
  return results.flat()
}

type Field = Map<string, { u: number[]; v: number[] }>

function windAt(field: Field, lat: number, lon: number, hour: number): [number, number] | undefined {
  const lat0 = Math.floor(lat)
  const lon0 = Math.floor(lon)
  let u = 0
  let v = 0
  let w = 0
  for (const [dy, dx] of [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ]) {
    const cell = field.get(`${lat0 + dy},${lon0 + dx}`)
    const cu = cell?.u[hour]
    const cv = cell?.v[hour]
    if (cu === undefined || cv === undefined || !Number.isFinite(cu) || !Number.isFinite(cv)) continue
    const weight = (1 - Math.abs(lat - (lat0 + dy))) * (1 - Math.abs(lon - (lon0 + dx))) + 1e-6
    u += cu * weight
    v += cv * weight
    w += weight
  }
  return w > 0 ? [u / w, v / w] : undefined
}

function components(speed: number | null | undefined, from: number | null | undefined): [number, number] {
  if (speed == null || from == null) return [NaN, NaN]
  const rad = (from * Math.PI) / 180
  return [-speed * Math.sin(rad), -speed * Math.cos(rad)]
}

function trace(field: Field, lat: number, lon: number): { path: [number, number][]; meanSpeed: number } {
  const path: [number, number][] = [[round(lon, 3), round(lat, 3)]]
  let speedSum = 0
  for (let hour = 0; hour < HOURS; hour++) {
    const wind = windAt(field, lat, lon, hour)
    if (!wind) break
    const [u, v] = wind
    speedSum += Math.hypot(u, v)
    lat += (v * 3600) / 111_320
    lon += (u * 3600) / (111_320 * Math.cos((lat * Math.PI) / 180))
    path.push([round(lon, 3), round(lat, 3)])
  }
  const steps = path.length - 1
  return { path, meanSpeed: steps ? speedSum / steps : 0 }
}

export async function loadSmoke(): Promise<Smoke> {
  const { entry } = await cached('karhutla', KARHUTLA_POLICY, loadKarhutla)
  const sources = clusters(entry.value)
  if (sources.length === 0) return { start: Math.floor(Date.now() / 3600_000) * 3600, pmStepHours: PM_STEP, cells: [], plumes: [] }

  const points = gridAround(sources)
  const [winds, air] = await Promise.all([
    forecast('Open-Meteo', 'https://api.open-meteo.com/v1/forecast', 'wind_speed_10m,wind_direction_10m,wind_speed_925hPa,wind_direction_925hPa', points),
    forecast('Open-Meteo Air Quality', 'https://air-quality-api.open-meteo.com/v1/air-quality', 'pm2_5', points).catch(() => undefined),
  ])

  const start = winds[0]?.hourly.time[0]
  if (!start) throw new UpstreamError('Open-Meteo', 502)

  const field: Field = new Map()
  const cells: SmokeCell[] = []
  points.forEach(([lat, lon], i) => {
    const h = winds[i].hourly
    const u: number[] = []
    const v: number[] = []
    for (let t = 0; t <= HOURS; t++) {
      const [cu, cv] = components(h.wind_speed_925hPa?.[t], h.wind_direction_925hPa?.[t])
      u.push(cu)
      v.push(cv)
    }
    field.set(`${lat},${lon}`, { u, v })

    const pm = air?.[i]?.hourly.pm2_5 ?? []
    const offset = air?.[i] ? Math.round((air[i].hourly.time[0] - start) / 3600) : 0
    const pmSteps: number[] = []
    for (let t = 0; t <= HOURS; t += PM_STEP) pmSteps.push(Math.round(pm[t - offset] ?? -1))
    cells.push([lat, lon, round(h.wind_speed_10m?.[0] ?? 0, 1), Math.round(h.wind_direction_10m?.[0] ?? 0), ...pmSteps])
  })

  const plumes: SmokePlume[] = sources.map((s) => {
    const { path, meanSpeed } = trace(field, s.lat, s.lon)
    const [regency, info] = [...s.regencies.entries()].sort((a, b) => b[1].count - a[1].count)[0] ?? ['', { province: '' }]
    return {
      id: s.key,
      lat: round(s.lat, 3),
      lon: round(s.lon, 3),
      hotspots: s.count,
      high: s.high,
      regency,
      province: info.province,
      transportKmh: round(meanSpeed * 3.6, 1),
      path,
    }
  })

  return { start, pmStepHours: PM_STEP, cells, plumes }
}
