import { fetchJson, round } from '../lib/http.js'

export interface Quake {
  id: string
  source: 'BMKG' | 'USGS'
  time: number
  lat: number
  lon: number
  mag: number
  depthKm: number
  place: string
  felt?: string
  tsunami?: string
  shakemap?: string
  url?: string
}

interface BmkgQuake {
  DateTime: string
  Coordinates: string
  Magnitude: string
  Kedalaman: string
  Wilayah: string
  Potensi?: string
  Dirasakan?: string
  Shakemap?: string
}

interface BmkgFeed {
  Infogempa: { gempa: BmkgQuake | BmkgQuake[] }
}

interface UsgsFeed {
  features: {
    id: string
    properties: { mag: number | null; place: string | null; time: number; url: string; tsunami: number; felt: number | null }
    geometry: { coordinates: [number, number, number] }
  }[]
}

const BMKG = 'https://data.bmkg.go.id/DataMKG/TEWS/'
const REGION = { south: -20, north: 15, west: 85, east: 155 }

const directions: Record<string, string> = {
  utara: 'north',
  selatan: 'south',
  barat: 'west',
  timur: 'east',
  baratlaut: 'north-west',
  baratdaya: 'south-west',
  timurlaut: 'north-east',
  tenggara: 'south-east',
}

const keepUpper = new Set(['NTT', 'NTB', 'DIY', 'DKI'])

function placeName(raw: string): string {
  return raw
    .replace(/^KAB-/, 'KAB. ')
    .split('-')
    .map((part) =>
      keepUpper.has(part)
        ? part
        : part
            .toLowerCase()
            .replace(/^kep\./, 'kep. ')
            .replace(/(^|[\s.])(\p{L})/gu, (_, lead: string, ch: string) => lead + ch.toUpperCase()),
    )
    .join(', ')
}

function englishPlace(wilayah: string): string {
  const text = wilayah.trim()
  const m = /^(?:pusat gempa berada di (laut|darat) )?(\d+(?:[.,]\d+)?)\s*km\s+(barat\s*laut|barat\s*daya|timur\s*laut|tenggara|utara|selatan|barat|timur)\s+(.+)$/i.exec(text)
  if (!m) return text
  const where = m[1] ? (m[1].toLowerCase() === 'laut' ? 'At sea, ' : 'On land, ') : ''
  const direction = directions[m[3].toLowerCase().replace(/\s+/g, '')]
  const place = /^[A-Z0-9.\s-]+$/.test(m[4]) ? placeName(m[4]) : m[4]
  return `${where}${m[2]} km ${direction} of ${place}`
}

function englishTsunami(potensi?: string): string | undefined {
  if (!potensi) return undefined
  const t = potensi.trim().toLowerCase()
  if (t.startsWith('tidak berpotensi tsunami')) return 'No tsunami threat'
  if (t.startsWith('berpotensi tsunami')) return 'Tsunami possible, follow BMKG and local authorities'
  if (t.startsWith('gempa ini dirasakan')) return 'Felt by people, shared by BMKG as information'
  return potensi
}

function fromBmkg(q: BmkgQuake): Quake | null {
  const [lat, lon] = q.Coordinates.split(',').map(Number)
  const time = Date.parse(q.DateTime)
  const mag = Number(q.Magnitude)
  if (![lat, lon, time, mag].every(Number.isFinite)) return null
  return {
    id: `bmkg-${time / 1000}`,
    source: 'BMKG',
    time,
    lat,
    lon,
    mag,
    depthKm: Number.parseFloat(q.Kedalaman) || 0,
    place: englishPlace(q.Wilayah),
    felt: q.Dirasakan,
    tsunami: englishTsunami(q.Potensi),
    shakemap: q.Shakemap ? BMKG + q.Shakemap : undefined,
  }
}

async function bmkgFile(name: string): Promise<Quake[]> {
  const feed = await fetchJson<BmkgFeed>('BMKG', BMKG + name)
  const list = Array.isArray(feed.Infogempa.gempa) ? feed.Infogempa.gempa : [feed.Infogempa.gempa]
  return list.map(fromBmkg).filter((q): q is Quake => q !== null)
}

async function usgs(): Promise<Quake[]> {
  const feed = await fetchJson<UsgsFeed>('USGS', 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson')
  return feed.features
    .filter((f) => f.properties.mag !== null)
    .map((f) => ({
      id: `usgs-${f.id}`,
      source: 'USGS' as const,
      time: f.properties.time,
      lat: round(f.geometry.coordinates[1]),
      lon: round(f.geometry.coordinates[0]),
      mag: round(f.properties.mag ?? 0, 1),
      depthKm: round(f.geometry.coordinates[2], 1),
      place: f.properties.place ?? 'Unknown area',
      tsunami: f.properties.tsunami ? 'Tsunami flag raised by USGS' : undefined,
      url: f.properties.url,
    }))
}

function distanceKm(a: Quake, b: Quake): number {
  const r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r
  const dLon = (b.lon - a.lon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

export async function loadQuakes(): Promise<Quake[]> {
  const results = await Promise.allSettled([
    bmkgFile('autogempa.json'),
    bmkgFile('gempaterkini.json'),
    bmkgFile('gempadirasakan.json'),
    usgs(),
  ])
  const ok = results.filter((r): r is PromiseFulfilledResult<Quake[]> => r.status === 'fulfilled')
  if (ok.length === 0) throw (results[0] as PromiseRejectedResult).reason

  const bmkg = new Map<string, Quake>()
  for (const r of ok) {
    for (const q of r.value) {
      if (q.source !== 'BMKG') continue
      const prev = bmkg.get(q.id)
      bmkg.set(q.id, { ...prev, ...q, felt: q.felt ?? prev?.felt, shakemap: q.shakemap ?? prev?.shakemap, tsunami: q.tsunami ?? prev?.tsunami })
    }
  }
  const usgsList = (results[3].status === 'fulfilled' ? results[3].value : []).filter(
    (u) => u.lat >= REGION.south && u.lat <= REGION.north && u.lon >= REGION.west && u.lon <= REGION.east,
  )
  const local = [...bmkg.values()]
  const merged = [
    ...local,
    ...usgsList.filter((u) => !local.some((b) => Math.abs(b.time - u.time) < 120_000 && distanceKm(b, u) < 150)),
  ]
  return merged.sort((a, b) => b.time - a.time)
}
