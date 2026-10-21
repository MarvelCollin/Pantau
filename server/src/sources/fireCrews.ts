import { fetchJson, round, UpstreamError } from '../lib/http.js'
import { SIPONGI_API } from './karhutla.js'

export interface CrewPost {
  id: string
  name: string
  unit: string
  lat: number
  lon: number
}

export interface CrewReport {
  id: string
  kind: 'suppression' | 'groundcheck'
  unit: string
  date: string
  place: string
  note?: string
  burnedHa?: number
  extinguishedHa?: number
  team?: string
  hotspotDate?: string
  satellite?: string
  lat: number
  lon: number
}

export interface FireCrews {
  posts: CrewPost[]
  reports: CrewReport[]
}

interface Feature<P> {
  geometry?: { coordinates?: [number | string, number | string] }
  properties?: P
}

interface PostProps {
  id?: string
  kode_daops?: string
  nama_daops?: string
}

interface ReportProps {
  nama_daops?: string
  tanggal?: string
  tanggal_lpr?: string
  tanggal_hs?: string
  lokasi?: string
  luas_bakar?: string
  luas_padam?: string
  catatan?: string
  tim_petugas?: string
  sumber?: string
}

const DAYS = 30

const satelliteNames: Record<string, string> = {
  'NASA-MODIS': 'Terra or Aqua, MODIS',
  'NASA-SNPP': 'Suomi NPP, VIIRS',
  'NASA-NOAA20': 'NOAA-20, VIIRS',
}

function wibDate(time: number): string {
  return new Date(time + 7 * 3600_000).toISOString().slice(0, 10)
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|[\s/(-])(\p{L})/gu, (_, lead: string, ch: string) => lead + ch.toUpperCase())
    .replace(/\b(Ikn|Dki|Oki|Pt|Rt|Rw|Tn|Khdtk)\b/g, (word) => word.toUpperCase())
}

function text(value: string | null | undefined): string | undefined {
  const t = (value ?? '').replace(/\s+/g, ' ').trim()
  return t && !/^(tes|test|-)$/i.test(t) ? t : undefined
}

function hectares(value: string | undefined): number | undefined {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function fixDate(raw: string | undefined, from: string, to: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw ?? '')
  if (!m) return undefined
  const date = `${m[1]}-${m[2]}-${m[3]}`
  if (date >= from && date <= to) return date
  const swapped = `${m[1]}-${m[3]}-${m[2]}`
  return Number(m[3]) <= 12 && swapped >= from && swapped <= to ? swapped : undefined
}

const MAX_POST_KM = 300
const CHECK_SEA_KM = 40
const elevations = new Map<string, number>()

function distanceKm(a: [number, number], b: [number, number]): number {
  const cos = Math.cos((a[0] * Math.PI) / 180)
  return Math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 111 * cos)
}

async function seaPoints(points: [number, number][]): Promise<Set<string>> {
  const key = (p: [number, number]) => `${p[0]},${p[1]}`
  const missing = [...new Map(points.map((p) => [key(p), p])).values()].filter((p) => !elevations.has(key(p)))
  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100)
    try {
      const url = `https://api.open-meteo.com/v1/elevation?latitude=${batch.map((p) => p[0]).join(',')}&longitude=${batch.map((p) => p[1]).join(',')}`
      const body = await fetchJson<{ elevation?: number[] }>('Open-Meteo', url, { timeoutMs: 8000 })
      batch.forEach((p, n) => {
        const e = body.elevation?.[n]
        if (typeof e === 'number') elevations.set(key(p), e)
      })
    } catch {
      continue
    }
  }
  return new Set(points.filter((p) => elevations.get(key(p)) === 0).map(key))
}

function point(f: Feature<unknown>): [number, number] | undefined {
  const lon = Number(f.geometry?.coordinates?.[0])
  const lat = Number(f.geometry?.coordinates?.[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return undefined
  return [round(lat, 5), round(lon, 5)]
}

async function features<P>(path: string): Promise<Feature<P>[]> {
  const body = await fetchJson<{ data?: { features?: Feature<P>[] } | Feature<P>[] }>('SiPongi', `${SIPONGI_API}${path}`, { timeoutMs: 15000 })
  const data = body.data
  const list = Array.isArray(data) ? data : data?.features
  if (!Array.isArray(list)) throw new UpstreamError('SiPongi', 502)
  return list
}

export async function loadFireCrews(): Promise<FireCrews> {
  const now = Date.now()
  const from = wibDate(now - DAYS * 86400_000)
  const to = wibDate(now)
  const range = `from=${from}&to=${to}`

  const [ponja, daops, suppression, groundcheck] = await Promise.allSettled([
    features<PostProps>('/daops/pondok-kerja'),
    features<PostProps>('/daops/all'),
    features<ReportProps>(`/daops/pemadaman?${range}`),
    features<ReportProps>(`/daops/groundcheck?${range}`),
  ])
  if (ponja.status === 'rejected' && suppression.status === 'rejected') throw ponja.reason

  const posts: CrewPost[] = []
  const seenPosts = new Set<string>()
  for (const result of [daops, ponja]) {
    if (result.status !== 'fulfilled') continue
    for (const f of result.value) {
      const at = point(f)
      const p = f.properties
      const name = text(p?.nama_daops) ?? text(p?.kode_daops)
      if (!at || !p || !name) continue
      const id = p.id ?? `${at[0]},${at[1]}`
      if (seenPosts.has(id)) continue
      seenPosts.add(id)
      posts.push({ id, name: titleCase(name), unit: titleCase(text(p.kode_daops) ?? name), lat: at[0], lon: at[1] })
    }
  }

  const reports: CrewReport[] = []
  const seenReports = new Map<string, number>()
  const add = (kind: CrewReport['kind'], list: Feature<ReportProps>[]) => {
    for (const f of list) {
      const at = point(f)
      const p = f.properties
      const date = fixDate(kind === 'suppression' ? p?.tanggal : (p?.tanggal_lpr ?? p?.tanggal_hs), from, to)
      if (!at || !p || !date || /^tes(t)?$/i.test((p.catatan ?? '').trim())) continue
      const base = `${kind === 'suppression' ? 's' : 'g'}-${date}-${at[0]},${at[1]}`
      const n = seenReports.get(base) ?? 0
      seenReports.set(base, n + 1)
      reports.push({
        id: n ? `${base}-${n}` : base,
        kind,
        unit: titleCase(text(p.nama_daops) ?? 'Manggala Agni'),
        date,
        place: text(p.lokasi) ?? 'Location not given',
        note: text(p.catatan),
        burnedHa: hectares(p.luas_bakar),
        extinguishedHa: hectares(p.luas_padam),
        team: text(p.tim_petugas)?.replace(/^-\s*/, ''),
        hotspotDate: kind === 'groundcheck' ? fixDate(p.tanggal_hs, from, to) : undefined,
        satellite: p.sumber ? (satelliteNames[p.sumber] ?? p.sumber) : undefined,
        lat: at[0],
        lon: at[1],
      })
    }
  }
  if (suppression.status === 'fulfilled') add('suppression', suppression.value)
  if (groundcheck.status === 'fulfilled') add('groundcheck', groundcheck.value)

  const postsByUnit = new Map<string, CrewPost[]>()
  for (const p of posts) postsByUnit.set(p.unit, [...(postsByUnit.get(p.unit) ?? []), p])
  const fromPost = (r: CrewReport) => {
    const own = postsByUnit.get(r.unit)
    return own ? Math.min(...own.map((p) => distanceKm([r.lat, r.lon], [p.lat, p.lon]))) : undefined
  }
  const nearPosts = reports.filter((r) => (fromPost(r) ?? 0) <= MAX_POST_KM)
  const sea = await seaPoints(nearPosts.filter((r) => (fromPost(r) ?? CHECK_SEA_KM + 1) > CHECK_SEA_KM).map((r) => [r.lat, r.lon]))
  const placed = nearPosts.filter((r) => !sea.has(`${r.lat},${r.lon}`))

  placed.sort((a, b) => b.date.localeCompare(a.date))
  return { posts, reports: placed }
}
