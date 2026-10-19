import { fetchJson, round, UpstreamError } from '../lib/http.js'
import { SIPONGI_API } from './karhutla.js'

export type AirCategory = 'good' | 'moderate' | 'unhealthy' | 'very_unhealthy' | 'hazardous'

export interface AirStation {
  id: string
  city: string
  province: string
  address: string
  time: number
  ispu: number
  category: AirCategory
  lat: number
  lon: number
}

interface AqmsFeature {
  geometry?: { coordinates?: [number | string, number | string] }
  properties?: {
    alamat?: string
    kota?: string
    provinsi?: string
    waktu?: string
    nilai?: string | number
    val?: string | number
    cat?: string
  }
}

const categories: Record<string, AirCategory> = {
  BAIK: 'good',
  SEDANG: 'moderate',
  'TIDAK SEHAT': 'unhealthy',
  'SANGAT TIDAK SEHAT': 'very_unhealthy',
  BERBAHAYA: 'hazardous',
}

function categoryFor(ispu: number): AirCategory {
  if (ispu <= 50) return 'good'
  if (ispu <= 100) return 'moderate'
  if (ispu <= 200) return 'unhealthy'
  if (ispu <= 300) return 'very_unhealthy'
  return 'hazardous'
}

export async function loadAir(): Promise<AirStation[]> {
  const body = await fetchJson<{ features?: AqmsFeature[] }>('SiPongi AQMS', `${SIPONGI_API}/aqms`, { timeoutMs: 15000 })
  if (!Array.isArray(body.features)) throw new UpstreamError('SiPongi AQMS', 502)

  const out: AirStation[] = []
  const seen = new Set<string>()
  for (const f of body.features) {
    const p = f.properties
    const lon = Number(f.geometry?.coordinates?.[0])
    const lat = Number(f.geometry?.coordinates?.[1])
    const ispu = Number(p?.nilai ?? p?.val)
    const time = Date.parse(`${(p?.waktu ?? '').trim().replace(' ', 'T')}+07:00`)
    if (!p || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(ispu) || ispu < 0 || !Number.isFinite(time)) continue
    const id = `${round(lat, 4)},${round(lon, 4)}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      city: (p.kota ?? '').trim() || 'Unknown city',
      province: (p.provinsi ?? '').trim(),
      address: (p.alamat ?? '').trim(),
      time,
      ispu: Math.round(ispu),
      category: categories[(p.cat ?? '').trim().toUpperCase()] ?? categoryFor(ispu),
      lat: round(lat, 5),
      lon: round(lon, 5),
    })
  }
  return out.sort((a, b) => b.ispu - a.ispu)
}
