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
    place: q.Wilayah,
    felt: q.Dirasakan,
    tsunami: q.Potensi,
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
  const usgsList = results[3].status === 'fulfilled' ? results[3].value : []
  const local = [...bmkg.values()]
  const merged = [
    ...local,
    ...usgsList.filter((u) => !local.some((b) => Math.abs(b.time - u.time) < 120_000 && distanceKm(b, u) < 150)),
  ]
  return merged.sort((a, b) => b.time - a.time)
}
