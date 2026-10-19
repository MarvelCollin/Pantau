import { fetchText, UpstreamError } from '../lib/http.js'

export interface Volcano {
  code: string
  name: string
  regency: string
  province: string
  elevationM: number
  lat: number
  lon: number
  level: 1 | 2 | 3 | 4
  vona: boolean
  erupting: boolean
  notice?: string
}

interface MagmaMarker {
  ga_code: string
  ga_nama_gapi: string
  ga_kab_gapi: string
  ga_prov_gapi: string
  ga_elev_gapi: number
  ga_lon_gapi: number
  ga_lat_gapi: number
  ga_status: number
  has_vona: boolean
  erupt_icon: boolean
  noticenumber?: string
}

export async function loadVolcanoes(): Promise<Volcano[]> {
  const html = await fetchText('MAGMA', 'https://magma.esdm.go.id/', { timeoutMs: 12000 })
  const match = /markersGunungApi\s*=\s*(\[\{[\s\S]*?\}\])/.exec(html)
  if (!match) throw new UpstreamError('MAGMA', 502)
  let markers: MagmaMarker[]
  try {
    markers = JSON.parse(match[1]) as MagmaMarker[]
  } catch {
    throw new UpstreamError('MAGMA', 502)
  }
  return markers
    .filter((m) => Number.isFinite(m.ga_lat_gapi) && Number.isFinite(m.ga_lon_gapi))
    .map((m) => ({
      code: m.ga_code,
      name: m.ga_nama_gapi,
      regency: m.ga_kab_gapi,
      province: m.ga_prov_gapi,
      elevationM: m.ga_elev_gapi,
      lat: m.ga_lat_gapi,
      lon: m.ga_lon_gapi,
      level: Math.min(4, Math.max(1, m.ga_status)) as Volcano['level'],
      vona: m.has_vona,
      erupting: m.erupt_icon,
      notice: m.noticenumber,
    }))
    .sort((a, b) => b.level - a.level)
}
