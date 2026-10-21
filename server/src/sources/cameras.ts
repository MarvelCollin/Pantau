import { waitUntil } from '@vercel/functions'
import { cached } from '../lib/cache.js'
import { fetchJson, fetchText, round, UpstreamError } from '../lib/http.js'

export interface Camera {
  id: string
  source: 'Bina Marga' | 'LTA Singapore' | 'Jogja City'
  name: string
  area?: string
  lat: number
  lon: number
  kind: 'hls' | 'youtube' | 'image'
  online: boolean
  image?: string
  page?: string
  stream?: string
  note?: string
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

function safeUrl(value: string): string {
  return value.includes('%') ? value : encodeURI(value)
}

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

interface JogjaCamera {
  cctv_id: string
  cctv_title: string
  cctv_link: string
  cctv_latitude: string
  cctv_longitude: string
  cctv_status: string
}

async function jogja(): Promise<Camera[]> {
  const { entry } = await cached('cameras:jogja', { ttl: 6 * 3600, swr: 18 * 3600, sie: 7 * 86400 }, async () => {
    const list = await fetchJson<JogjaCamera[]>('Jogja City', 'https://cctv.jogjakota.go.id/home/getdata', {
      timeoutMs: 12000,
      headers: { 'x-requested-with': 'XMLHttpRequest', referer: 'https://cctv.jogjakota.go.id/' },
    })
    const seen = new Set<string>()
    return list
      .map((c) => ({
        id: `jg-${c.cctv_id}`,
        source: 'Jogja City' as const,
        name: c.cctv_title.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim(),
        area: 'Yogyakarta',
        lat: round(Number(c.cctv_latitude)),
        lon: round(Number(c.cctv_longitude)),
        kind: 'hls' as const,
        online: c.cctv_status === '0' && c.cctv_link.startsWith('https://'),
        stream: safeUrl(c.cctv_link.trim()),
        page: 'https://cctv.jogjakota.go.id/',
      }))
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon) && c.lat !== 0)
      .filter((c) => {
        const keys = [`stream:${c.stream}`, `place:${c.name.toLowerCase()}|${c.lat}|${c.lon}`]
        if (keys.some((k) => seen.has(k))) return false
        for (const k of keys) seen.add(k)
        return true
      })
  })
  return entry.value
}

const PROBE_FRESH = 1800_000
const PROBE_KEEP = 3 * 3600_000
const PROBE_LIMIT = 8
const probes = new Map<string, { problem: string; at: number }>()
const probing = new Map<string, Promise<string>>()
const waiting: (() => void)[] = []
let active = 0

async function limited<T>(job: () => Promise<T>): Promise<T> {
  if (active < PROBE_LIMIT) active++
  else await new Promise<void>((resolve) => waiting.push(resolve))
  try {
    return await job()
  } finally {
    const next = waiting.shift()
    if (next) next()
    else active--
  }
}

function probeError(error: unknown): string {
  const code = (error as { cause?: { code?: string } }).cause?.code ?? ''
  if (code.includes('CERT')) return 'The camera server certificate has expired, so browsers block it'
  return 'The camera server is not reachable right now'
}

async function checkPlaylist(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
  if (!res.ok) return `The camera server answers with an error (${res.status})`
  const text = await res.text()
  return text.includes('#EXTM3U') ? '' : 'The camera server sends no video'
}

async function checkPage(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
  if (!res.ok) return `The camera server answers with an error (${res.status})`
  const playlist = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/.exec(await res.text())
  return playlist ? checkPlaylist(playlist[0]) : 'The camera server sends no video'
}

function probe(url: string, check: (url: string) => Promise<string>): Promise<string> {
  const hit = probes.get(url)
  const age = hit ? Date.now() - hit.at : Infinity
  if (hit && age < PROBE_FRESH) return Promise.resolve(hit.problem)
  let job = probing.get(url)
  if (!job) {
    job = limited(() => check(url).catch(probeError))
      .then((problem) => {
        probes.set(url, { problem, at: Date.now() })
        return problem
      })
      .finally(() => probing.delete(url))
    probing.set(url, job)
  }
  if (hit && age < PROBE_KEEP) {
    waitUntil(job)
    return Promise.resolve(hit.problem)
  }
  return job
}

export async function loadCameras(): Promise<Camera[]> {
  const [bm, sg, jg] = await Promise.allSettled([binamarga(), singapore(), jogja()])
  if (bm.status === 'rejected' && sg.status === 'rejected' && jg.status === 'rejected') throw bm.reason
  const [bmList, jgList] = await Promise.all([
    bm.status === 'fulfilled'
      ? Promise.all(
          bm.value.map(async ({ stream, feed, ...camera }): Promise<Camera> => {
            const direct = feed !== 'apace' && stream.endsWith('.m3u8')
            const problem = direct ? await probe(stream, checkPlaylist) : feed === 'its' ? await probe(stream, checkPage) : ''
            return { ...camera, stream: direct ? stream : undefined, online: camera.online && !problem, note: problem || undefined }
          }),
        )
      : [],
    jg.status === 'fulfilled'
      ? Promise.all(
          jg.value.map(async (camera): Promise<Camera> => {
            const { stream } = camera
            if (!camera.online || !stream) return camera
            const problem = await probe(stream, checkPlaylist)
            return { ...camera, online: !problem, note: problem || undefined }
          }),
        )
      : [],
  ])
  return [...bmList, ...jgList, ...(sg.status === 'fulfilled' ? sg.value : [])]
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
