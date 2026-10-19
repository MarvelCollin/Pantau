import { fetchJson, round, UpstreamError } from '../lib/http.js'

export const SIPONGI_API = 'https://opsroom.sipongidata.my.id/api'

export type Place = [village: string, district: string, regency: string, province: string]

export type KarhutlaHotspot = [
  lat: number,
  lon: number,
  confidence: 'l' | 'm' | 'h',
  satellite: 'm' | 's' | 'n',
  time: number,
  place: number,
  detections: number,
]

export interface Karhutla {
  places: Place[]
  hotspots: KarhutlaHotspot[]
}

interface SipongiHotspot {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    date_hotspot_ori?: string
    sumber?: string
    confidence_level?: string
    counter?: number
    desa?: string | null
    kecamatan?: string | null
    kabkota?: string | null
    nama_provinsi?: string | null
  }
}

const satellites: Record<string, KarhutlaHotspot[3]> = { 'NASA-MODIS': 'm', 'NASA-SNPP': 's', 'NASA-NOAA20': 'n' }
const confidences: Record<string, KarhutlaHotspot[2]> = { low: 'l', medium: 'm', high: 'h' }

function hotspotUrl(): string {
  const params = new URLSearchParams({ wilayah: 'IN', filterperiode: 'false', late: '24', provinsi: '', kabkota: '' })
  for (const s of Object.keys(satellites)) params.append('satelit[]', s)
  for (const c of Object.keys(confidences)) params.append('confidence[]', c)
  return `${SIPONGI_API}/opsroom/indoHotspot?${params}`
}

const clean = (value: string | null | undefined) => (value ?? '').trim()

export async function loadKarhutla(): Promise<Karhutla> {
  const body = await fetchJson<{ features?: SipongiHotspot[] }>('SiPongi', hotspotUrl(), { timeoutMs: 20000 })
  if (!Array.isArray(body.features)) throw new UpstreamError('SiPongi', 502)

  const places: Place[] = []
  const placeIndex = new Map<string, number>()
  const hotspots: KarhutlaHotspot[] = []

  for (const f of body.features) {
    const p = f.properties
    const lon = Number(f.geometry?.coordinates?.[0])
    const lat = Number(f.geometry?.coordinates?.[1])
    if (!p || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const satellite = satellites[p.sumber ?? '']
    const time = Date.parse(p.date_hotspot_ori ?? '')
    if (!satellite || !Number.isFinite(time)) continue

    const place: Place = [clean(p.desa), clean(p.kecamatan), clean(p.kabkota), clean(p.nama_provinsi)]
    const key = place.join('|')
    let index = placeIndex.get(key)
    if (index === undefined) {
      index = places.push(place) - 1
      placeIndex.set(key, index)
    }

    hotspots.push([
      round(lat, 3),
      round(lon, 3),
      confidences[p.confidence_level ?? ''] ?? 'm',
      satellite,
      Math.round(time / 1000),
      index,
      Math.max(1, Number(p.counter) || 1),
    ])
  }

  hotspots.sort((a, b) => b[4] - a[4])
  return { places, hotspots }
}
