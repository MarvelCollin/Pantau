import { cached } from '../lib/cache.js'
import { fetchJson, fetchText, round, UpstreamError } from '../lib/http.js'

export interface Camera {
  id: string
  source: 'Bina Marga' | 'LTA Singapore'
  name: string
  area?: string
  lat: number
  lon: number
  kind: 'hls' | 'youtube' | 'image'
  online: boolean
  image?: string
  page?: string
}

export interface Stream {
  kind: 'hls' | 'youtube' | 'image' | 'page'
  url: string
}

interface ArcgisResponse {
  features: {
    attributes: { code: string; ruas: string; kota: string; source: string; url_stream: string; status: number; lat: number; lon: number }
  }[]
}

interface LtaResponse {
  items: { cameras: { camera_id: string; image: string; location: { latitude: number; longitude: number } }[] }[]
}

const BINAMARGA =
  'https://gisportal.binamarga.pu.go.id/arcgis/rest/services/Hosted/cctv_jalnas_20260408/FeatureServer/0/query?where=1%3D1&outFields=code,ruas,kota,source,url_stream,status,lat,lon&returnGeometry=false&f=json'

function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
}

interface BinamargaCamera extends Camera {
  stream: string
  feed: string
}

async function binamarga(): Promise<BinamargaCamera[]> {
  const { entry } = await cached('cameras:binamarga', { ttl: 6 * 3600, swr: 18 * 3600, sie: 7 * 86400 }, async () => {
    const res = await fetchJson<ArcgisResponse>('Bina Marga', BINAMARGA, { timeoutMs: 12000 })
    return res.features
      .map(({ attributes: a }) => ({
        id: `bm-${a.code}`,
        source: 'Bina Marga' as const,
        name: titleCase(a.ruas),
        area: a.kota,
        lat: round(a.lat),
        lon: round(a.lon),
        kind: (a.source === 'apace' ? 'youtube' : 'hls') as Camera['kind'],
        online: a.status === 1,
        page: a.url_stream,
        stream: a.url_stream,
        feed: a.source,
      }))
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon))
  })
  return entry.value
}

async function singapore(): Promise<Camera[]> {
  const res = await fetchJson<LtaResponse>('LTA Singapore', 'https://api.data.gov.sg/v1/transport/traffic-images', { timeoutMs: 8000 })
  return (res.items[0]?.cameras ?? []).map((c) => ({
    id: `sg-${c.camera_id}`,
    source: 'LTA Singapore' as const,
    name: `Traffic camera ${c.camera_id}`,
    area: 'Singapore',
    lat: round(c.location.latitude),
    lon: round(c.location.longitude),
    kind: 'image' as const,
    online: true,
    image: c.image,
  }))
}

export async function loadCameras(): Promise<Camera[]> {
  const [bm, sg] = await Promise.allSettled([binamarga(), singapore()])
  if (bm.status === 'rejected' && sg.status === 'rejected') throw bm.reason
  const list: Camera[] = []
  if (bm.status === 'fulfilled') list.push(...bm.value.map(({ stream: _s, feed: _f, ...camera }) => camera))
  if (sg.status === 'fulfilled') list.push(...sg.value)
  return list
}

export async function resolveStream(id: string): Promise<Stream> {
  const camera = (await binamarga()).find((c) => c.id === id)
  if (!camera) throw new UpstreamError('Bina Marga', 404)

  if (camera.feed === 'ch' || camera.stream.endsWith('.m3u8')) return { kind: 'hls', url: camera.stream }

  const html = await fetchText('Bina Marga', camera.stream, { timeoutMs: 8000 })
  if (camera.feed === 'apace') {
    const yt = /youtube\.com\/embed\/([\w-]{6,})/.exec(html)
    if (yt) return { kind: 'youtube', url: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&mute=1&playsinline=1` }
  }
  const hls = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/.exec(html)
  if (hls) return { kind: 'hls', url: hls[0] }
  return { kind: 'page', url: camera.stream }
}
