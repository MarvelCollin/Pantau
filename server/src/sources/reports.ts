import { fetchJson, round } from '../lib/http.js'

export interface Report {
  id: string
  type: string
  lat: number
  lon: number
  time: number
  text?: string
  image?: string
  city?: string
  floodDepthCm?: number
  link: string
}

interface PetaBencanaResponse {
  result: {
    features: {
      geometry: { coordinates: [number, number] }
      properties: {
        pkey: string
        created_at: string
        url: string
        image_url?: string | null
        disaster_type: string
        text?: string | null
        report_data?: { flood_depth?: number } | null
        tags?: { city?: string | null } | null
      }
    }[]
  }
}

export async function loadReports(): Promise<Report[]> {
  const res = await fetchJson<PetaBencanaResponse>('PetaBencana', 'https://data.petabencana.id/reports?geoformat=geojson&timeperiod=259200', {
    timeoutMs: 20000,
  })
  return res.result.features
    .map((f) => {
      const p = f.properties
      return {
        id: p.pkey,
        type: p.disaster_type,
        lat: round(f.geometry.coordinates[1]),
        lon: round(f.geometry.coordinates[0]),
        time: Date.parse(p.created_at),
        text: p.text?.trim() || undefined,
        image: p.image_url ?? undefined,
        city: p.tags?.city ?? undefined,
        floodDepthCm: p.report_data?.flood_depth,
        link: `https://petabencana.id/map/?report=${encodeURIComponent(p.url)}`,
      }
    })
    .sort((a, b) => b.time - a.time)
}
