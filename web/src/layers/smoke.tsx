import { useMemo } from 'react'
import { create } from 'zustand'
import type { Feature, FeatureCollection } from 'geojson'
import { formatClock, formatCoord, formatNumber } from '../lib/format'
import { useLayerOn } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { usePalette } from '../map/usePalette'
import { cssVar } from '../theme'
import { cities } from '../map/overview'
import { useLayerStatus } from './useLayerStatus'
import { useEnvelope } from './useStaticLayer'
import { distanceKm } from './trails'
import { DetailHeader, Facts, Gone, Lead } from '../ui/Detail'
import styles from './reports.module.css'

export type SmokeCell = [lat: number, lon: number, windSpeed: number, windFrom: number, ...pm25: number[]]

export interface SmokePlume {
  id: string
  lat: number
  lon: number
  hotspots: number
  high: number
  regency: string
  province: string
  transportKmh: number
  path: [lon: number, lat: number][]
}

export interface Smoke {
  start: number
  pmStepHours: number
  cells: SmokeCell[]
  plumes: SmokePlume[]
}

export const smokeHours = [0, 6, 12, 24] as const
export type SmokeHour = (typeof smokeHours)[number]

export const useSmokeHour = create<{ hour: SmokeHour; setHour: (hour: SmokeHour) => void }>((set) => ({
  hour: 0,
  setHour: (hour) => set({ hour }),
}))

const compassPoints = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']

export function compass(degrees: number) {
  return compassPoints[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]
}

function bearing(from: [number, number], to: [number, number]) {
  const rad = Math.PI / 180
  const y = Math.sin((to[0] - from[0]) * rad) * Math.cos(to[1] * rad)
  const x = Math.cos(from[1] * rad) * Math.sin(to[1] * rad) - Math.sin(from[1] * rad) * Math.cos(to[1] * rad) * Math.cos((to[0] - from[0]) * rad)
  return (Math.atan2(y, x) / rad + 360) % 360
}

export function nearestCity(at: [number, number]) {
  return cities.map(([name, region, lon, lat]) => ({ name, region, km: distanceKm([lon, lat], at) })).sort((a, b) => a.km - b.km)[0]
}

export function positionAt(plume: SmokePlume, hour: number): [number, number] {
  return plume.path[Math.min(hour, plume.path.length - 1)]
}

export function describeSpot(plume: SmokePlume, hour: number) {
  const at = positionAt(plume, hour)
  const city = nearestCity(at)
  const moved = distanceKm(plume.path[0], at)
  if (moved < 5) return 'Still over the fires'
  if (city && city.km <= 40) return `Over ${city.name}, ${formatNumber(Math.round(moved))} km away`
  const way = compass(bearing(plume.path[0], at))
  return `${formatNumber(Math.round(moved))} km ${way}${city ? `, ${Math.round(city.km)} km from ${city.name}` : ''}`
}

export function pmCategory(pm: number) {
  if (pm < 0) return undefined
  if (pm <= 15) return 'good'
  if (pm <= 55) return 'moderate'
  if (pm <= 150) return 'unhealthy'
  if (pm <= 250) return 'very unhealthy'
  return 'hazardous'
}

export function useSmoke(enabled = true) {
  return useEnvelope<Smoke>({ key: 'smoke', path: '/api/karhutla/smoke', enabled, staleMs: 30 * 60_000, pollMs: 60 * 60_000 })
}

function SmokeLayer() {
  const on = useLayerOn('smoke')
  const query = useSmoke(on)
  const hour = useSmokeHour((s) => s.hour)
  const palette = usePalette()
  const payload = query.data?.items

  const data = useMemo<FeatureCollection | undefined>(() => {
    if (!payload) return undefined
    const pmIndex = 4 + Math.round(hour / payload.pmStepHours)
    const shown = hour === 0 ? 24 : hour
    const features: Feature[] = []
    for (const p of payload.plumes) {
      const title = `Smoke from ${p.regency || 'fires'}, ${formatNumber(p.hotspots)} hotspots`
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { id: p.id, kind: 'source', hotspots: p.hotspots, title } })
    }
    for (const p of payload.plumes) {
      if (p.path.length < 2) continue
      const title = `Smoke from ${p.regency || 'fires'}, ${formatNumber(p.hotspots)} hotspots`
      const until = Math.min(shown, p.path.length - 1)
      const head = p.path[until]
      const prev = p.path[Math.max(0, until - 1)]
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: p.path }, properties: { id: p.id, kind: 'ahead', title } })
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: p.path.slice(0, until + 1) }, properties: { id: p.id, kind: 'path', hotspots: p.hotspots, title } })
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: head }, properties: { id: p.id, kind: 'head', rot: bearing(prev, head), hotspots: p.hotspots, title } })
    }
    for (const c of payload.cells) {
      const pm = c[pmIndex] ?? -1
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c[1], c[0]] },
        properties: { kind: 'cell', pm: Math.max(0, pm), wind: c[2], rot: (c[3] + 180) % 360 },
      })
    }
    return { type: 'FeatureCollection', features }
  }, [payload, hour])

  const specs = useMemo(() => {
    const color = cssVar('--c-smoke')
    const width = ['interpolate', ['linear'], ['get', 'hotspots'], 4, 1.5, 300, 3.5, 1000, 5]
    return [
      {
        id: 'smoke-haze',
        type: 'heatmap' as const,
        filter: ['==', ['get', 'kind'], 'cell'],
        maxzoom: 9,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'pm'], 0, 0, 15, 0.05, 55, 0.3, 150, 0.7, 300, 1],
          'heatmap-intensity': 0.7,
          'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 3, 16, 6, 128, 8, 512],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0,0,0,0)',
            0.15,
            'rgba(176,164,140,0.22)',
            0.4,
            'rgba(160,122,82,0.42)',
            0.7,
            'rgba(150,72,48,0.56)',
            1,
            'rgba(112,32,64,0.68)',
          ],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 9, 0.4],
        },
      },
      {
        id: 'smoke-wind',
        type: 'symbol' as const,
        filter: ['==', ['get', 'kind'], 'cell'],
        minzoom: 4.5,
        layout: {
          'icon-image': 'arrow',
          'icon-size': ['interpolate', ['linear'], ['get', 'wind'], 0, 0.22, 8, 0.45],
          'icon-rotate': ['get', 'rot'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-color': cssVar('--muted'), 'icon-opacity': 0.55 },
      },
      {
        id: 'smoke-ahead',
        type: 'line' as const,
        filter: ['==', ['get', 'kind'], 'ahead'],
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': color, 'line-width': 1.2, 'line-opacity': 0.45, 'line-dasharray': [1.5, 2] },
      },
      {
        id: 'smoke-path',
        type: 'line' as const,
        filter: ['==', ['get', 'kind'], 'path'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': color, 'line-width': width, 'line-opacity': 0.9 },
      },
      {
        id: 'smoke-source',
        type: 'circle' as const,
        filter: ['==', ['get', 'kind'], 'source'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'hotspots'], 4, 4, 300, 7, 1000, 10],
          'circle-color': cssVar('--lvl-4'),
          'circle-stroke-color': palette.halo,
          'circle-stroke-width': 2,
        },
      },
      {
        id: 'smoke-head',
        type: 'symbol' as const,
        filter: ['==', ['get', 'kind'], 'head'],
        layout: {
          'icon-image': 'arrow',
          'icon-size': ['interpolate', ['linear'], ['get', 'hotspots'], 4, 0.45, 1000, 0.7],
          'icon-rotate': ['get', 'rot'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
        },
        paint: { 'icon-color': color, 'icon-halo-color': palette.halo, 'icon-halo-width': 1.5 },
      },
    ]
  }, [palette])

  useMapLayer({
    owner: 'smoke',
    sourceId: 'smoke',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    layers: specs as never,
    data,
    visible: on,
    interactive: ['smoke-source', 'smoke-head', 'smoke-path'],
  })

  useLayerStatus('smoke', on, query, {
    count: payload?.plumes.length,
    note: 'fire clusters, smoke paths for 24 hours',
    staleAfterMs: 4 * 3600_000,
  })
  return null
}

function SmokeDetail({ id }: { id: string }) {
  const { data } = useSmoke()
  const payload = data?.items
  const p = payload?.plumes.find((i) => i.id === id)
  if (!payload || !p) return <Gone layer="smoke" />
  const start = payload.start * 1000
  const end = p.path[p.path.length - 1]
  const travelled = distanceKm(p.path[0], end)
  const cell = payload.cells
    .map((c) => ({ c, km: distanceKm([c[1], c[0]], [p.lon, p.lat]) }))
    .sort((a, b) => a.km - b.km)[0]?.c
  const pmNow = cell?.[4] ?? -1
  const steps = [6, 12, 24].filter((h) => h < p.path.length)

  return (
    <>
      <DetailHeader layer="smoke" title={`Smoke from ${p.regency || 'a fire cluster'}`} subtitle={`${formatNumber(p.hotspots)} hotspots, ${p.province || 'Indonesia'}`} />
      <Lead
        value={formatNumber(Math.round(travelled))}
        unit="km"
        label={`${compass(bearing(p.path[0], end))} in ${p.path.length - 1} hours, carried at about ${Math.round(p.transportKmh)} km/h`}
      />
      <Facts
        rows={[
          ...steps.map((h): [string, string] => [`At ${formatClock(start + h * 3600_000)} WIB, +${h} h`, describeSpot(p, h)]),
          ['Wind at the fires now', cell ? `${Math.round(cell[2] * 3.6)} km/h from the ${compass(cell[3])}` : undefined],
          ['PM2.5 at the fires now', pmNow >= 0 ? `${pmNow} µg/m³, ${pmCategory(pmNow)}` : undefined],
          ['High confidence hotspots', formatNumber(p.high)],
          ['Fire cluster', <span className="num">{formatCoord(p.lat, p.lon)}</span>],
        ]}
      />
      <p className={styles.text}>
        The line follows forecast wind about 750 m up, where peat smoke usually travels. Real haze spreads wider than one line, so read the shaded cloud for how far it reaches.
      </p>
    </>
  )
}

export const smokeModule = { Layer: SmokeLayer, Detail: SmokeDetail }
