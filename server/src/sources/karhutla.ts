import { cached } from '../lib/cache.js'
import { fetchJson, round, UpstreamError } from '../lib/http.js'
import { loadVolcanoes, type Volcano } from './volcanoes.js'

export const SIPONGI_API = 'https://opsroom.sipongidata.my.id/api'

export const KARHUTLA_POLICY = { ttl: 900, swr: 1800, sie: 86400 }

export type Place = [village: string, district: string, regency: string, province: string]

export type KarhutlaHotspot = [
  lat: number,
  lon: number,
  confidence: 'l' | 'm' | 'h',
  satellite: 'm' | 's' | 'n',
  time: number,
  place: number,
  detections: number,
  volcano?: string,
]

export interface NearVolcano {
  name: string
  level: number
  lat: number
  lon: number
}

export interface Karhutla {
  places: Place[]
  hotspots: KarhutlaHotspot[]
  volcanoes: Record<string, NearVolcano>
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

const VOLCANO_KM = 4

async function activeVolcanoes(): Promise<Volcano[]> {
  try {
    const { entry } = await cached('volcanoes', { ttl: 1800, swr: 3600, sie: 86400 }, loadVolcanoes)
    return entry.value.filter((v) => v.level >= 2)
  } catch {
    return []
  }
}

function nearVolcano(lat: number, lon: number, volcanoes: Volcano[]): Volcano | undefined {
  const cos = Math.cos((lat * Math.PI) / 180)
  return volcanoes.find((v) => Math.hypot((v.lat - lat) * 111, (v.lon - lon) * 111 * cos) <= VOLCANO_KM)
}

export async function loadKarhutla(): Promise<Karhutla> {
  const [body, volcanoes] = await Promise.all([
    fetchJson<{ features?: SipongiHotspot[] }>('SiPongi', hotspotUrl(), { timeoutMs: 20000 }),
    activeVolcanoes(),
  ])
  if (!Array.isArray(body.features)) throw new UpstreamError('SiPongi', 502)

  const places: Place[] = []
  const placeIndex = new Map<string, number>()
  const hotspots: KarhutlaHotspot[] = []
  const near: Record<string, NearVolcano> = {}

  for (const f of body.features) {
    const p = f.properties
    const lon = Number(f.geometry?.coordinates?.[0])
    const lat = Number(f.geometry?.coordinates?.[1])
    if (!p || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const satellite = satellites[p.sumber ?? '']
    const time = Date.parse(p.date_hotspot_ori ?? '')
    if (!satellite || !Number.isFinite(time)) continue

    const place: Place = [clean(p.desa), clean(p.kecamatan), clean(p.kabkota), clean(p.nama_provinsi).replace(/(Dki|Ikn|Di)/g, (word) => word.toUpperCase())]
    const key = place.join('|')
    let index = placeIndex.get(key)
    if (index === undefined) {
      index = places.push(place) - 1
      placeIndex.set(key, index)
    }

    const hotspot: KarhutlaHotspot = [
      round(lat, 3),
      round(lon, 3),
      confidences[p.confidence_level ?? ''] ?? 'm',
      satellite,
      Math.round(time / 1000),
      index,
      Math.max(1, Number(p.counter) || 1),
    ]
    const volcano = nearVolcano(lat, lon, volcanoes)
    if (volcano) {
      hotspot.push(volcano.code)
      near[volcano.code] = { name: volcano.name, level: volcano.level, lat: volcano.lat, lon: volcano.lon }
    }
    hotspots.push(hotspot)
  }

  hotspots.sort((a, b) => b[4] - a[4])
  return { places, hotspots, volcanoes: near }
}
