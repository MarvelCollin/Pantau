import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import type { Feature, FeatureCollection } from 'geojson'
import type { GeoJSONSource } from 'maplibre-gl'
import { formatClock, formatCoord, formatNumber } from '../lib/format'
import { useLayerOn } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { useMap } from '../map/context'
import { usePalette } from '../map/usePalette'
import { cssVar } from '../theme'
import { prefersReducedMotion } from '../lib/motion'
import { towns } from '../map/overview'
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

const PLAY_HOURS_PER_SECOND = 2
const FRAME_MS = 40
const PARTICLES = 6
const PARTICLE_LOOP_MS = 7000

function nearestStep(t: number): SmokeHour {
  return smokeHours.reduce((best, h) => (Math.abs(h - t) < Math.abs(best - t) ? h : best), smokeHours[0])
}

interface SmokeClock {
  hour: SmokeHour
  t: number
  playing: boolean
  setHour: (hour: SmokeHour) => void
  togglePlay: () => void
  setT: (t: number) => void
}

export const useSmokeHour = create<SmokeClock>((set) => ({
  hour: 0,
  t: 0,
  playing: false,
  setHour: (hour) => set({ hour, playing: false }),
  togglePlay: () => set((s) => (s.playing ? { playing: false, hour: nearestStep(s.t) } : { playing: true })),
  setT: (t) => set({ t }),
}))

const compassPoints = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']

export function compass(degrees: number) {
  return compassPoints[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]
}

function bearing(from: [number, number], to: [number, number]) {
  const rad = Math.PI / 180
  const y = Math.sin((to[0] - from[0]) * rad) * Math.cos(to[1] * rad)
  const x = Math.cos(from[1] * rad) * Math.sin(to[1] * rad) - Math.sin(from[1] * rad) * Math.cos(to[1] * rad) * Math.cos((to[0] - from[0]) * rad)
  if (x === 0 && y === 0) return 0
  return (Math.atan2(y, x) / rad + 360) % 360
}

export function nearestCity(at: [number, number]) {
  return towns.map(([name, region, lon, lat]) => ({ name, region, km: distanceKm([lon, lat], at) })).sort((a, b) => a.km - b.km)[0]
}

export function positionAt(plume: SmokePlume, hour: number): [number, number] {
  const last = plume.path.length - 1
  const h = Math.max(0, Math.min(hour, last))
  const i = Math.floor(h)
  const f = h - i
  const a = plume.path[i]
  const b = plume.path[Math.min(i + 1, last)]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

export function describeSpot(plume: SmokePlume, hour: number) {
  const at = positionAt(plume, hour)
  const city = nearestCity(at)
  const moved = distanceKm(plume.path[0], at)
  if (moved < 5) return 'Still over the fires'
  if (city && city.km <= 40) return `Over ${city.name}, ${formatNumber(Math.round(moved))} km from the fires`
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

function pmAt(cell: SmokeCell, t: number, step: number) {
  const steps = cell.length - 4
  const x = Math.max(0, Math.min(t / step, steps - 1))
  const i = Math.floor(x)
  const a = cell[4 + i] ?? -1
  const b = cell[4 + Math.min(i + 1, steps - 1)] ?? -1
  if (a < 0 && b < 0) return 0
  if (a < 0) return b
  if (b < 0) return a
  return a + (b - a) * (x - i)
}

export function useSmoke(enabled = true) {
  return useEnvelope<Smoke>({ key: 'smoke', path: '/api/karhutla/smoke', enabled, staleMs: 30 * 60_000, pollMs: 60 * 60_000 })
}

function useSmokeClock(on: boolean) {
  useEffect(() => {
    if (!on) return
    const reduce = prefersReducedMotion()
    let current = useSmokeHour.getState().t
    let last = performance.now()
    let emitted = 0
    let held = 0
    let raf = 0
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const s = useSmokeHour.getState()
      if (s.playing) {
        if (reduce) {
          held += dt
          if (held >= 1.2) {
            held = 0
            current = current >= 24 ? 0 : smokeHours.find((h) => h > current) ?? 0
          }
        } else {
          current += dt * PLAY_HOURS_PER_SECOND
          if (current > 24) current = 0
        }
      } else if (current !== s.hour) {
        const gap = s.hour - current
        current = reduce || Math.abs(gap) < 0.05 ? s.hour : current + gap * Math.min(1, dt * 5)
      }
      const settled = !s.playing && current === s.hour
      if (current !== s.t && (settled || now - emitted >= FRAME_MS)) {
        emitted = now
        s.setT(current)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [on])
}

function useSmokeParticles(on: boolean, plumes: SmokePlume[] | undefined, color: string) {
  const map = useMap()
  useEffect(() => {
    if (!map || !on || !plumes || plumes.length === 0 || prefersReducedMotion()) return
    const tracks = plumes
      .filter((p) => p.path.length > 1)
      .map((p, n) => {
        const lengths = [0]
        for (let i = 1; i < p.path.length; i++) lengths.push(lengths[i - 1] + distanceKm(p.path[i - 1], p.path[i]))
        return { path: p.path, lengths, total: lengths[lengths.length - 1], offset: (n * 0.37) % 1, size: Math.min(1.6, 0.8 + p.hotspots / 600) }
      })
      .filter((t) => t.total > 3)

    map.addSource('smoke-flow', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: 'smoke-flow',
      type: 'circle',
      source: 'smoke-flow',
      metadata: { pantau: 'smoke' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, ['*', ['get', 's'], 2.4], 9, ['*', ['get', 's'], 5]],
        'circle-color': color,
        'circle-opacity': ['get', 'o'],
        'circle-blur': 0.5,
      },
    })
    if (map.getLayer('selection-ring')) map.moveLayer('selection-ring')

    const pointAt = (track: (typeof tracks)[number], d: number): [number, number] => {
      let i = 1
      while (i < track.lengths.length - 1 && track.lengths[i] < d) i++
      const a = track.path[i - 1]
      const b = track.path[i]
      const span = track.lengths[i] - track.lengths[i - 1] || 1
      const f = Math.max(0, Math.min(1, (d - track.lengths[i - 1]) / span))
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
    }

    let raf = 0
    let drawn = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - drawn < FRAME_MS) return
      drawn = now
      const features: Feature[] = []
      for (const track of tracks) {
        for (let k = 0; k < PARTICLES; k++) {
          const phase = (now / PARTICLE_LOOP_MS + track.offset + k / PARTICLES) % 1
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: pointAt(track, phase * track.total) },
            properties: { o: 0.75 * Math.sin(Math.PI * phase), s: track.size * (0.7 + phase * 0.9) },
          })
        }
      }
      ;(map.getSource('smoke-flow') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features })
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      if (map.getLayer('smoke-flow')) map.removeLayer('smoke-flow')
      if (map.getSource('smoke-flow')) map.removeSource('smoke-flow')
    }
  }, [map, on, plumes, color])
}

function SmokeLayer() {
  const on = useLayerOn('smoke')
  const query = useSmoke(on)
  const t = useSmokeHour((s) => s.t)
  const palette = usePalette()
  const payload = query.data?.items
  const color = useMemo(() => cssVar('--c-smoke'), [palette])

  useSmokeClock(on)

  const haze = useMemo<FeatureCollection | undefined>(() => {
    if (!payload) return undefined
    return {
      type: 'FeatureCollection',
      features: payload.cells.map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c[1], c[0]] },
        properties: { pm: pmAt(c, t, payload.pmStepHours), wind: c[2], rot: (c[3] + 180) % 360 },
      })),
    }
  }, [payload, t])

  const plumes = useMemo<FeatureCollection | undefined>(() => {
    if (!payload) return undefined
    const features: Feature[] = []
    const title = (p: SmokePlume) => `Smoke from ${p.regency || 'fires'}, ${formatNumber(p.hotspots)} hotspots`
    for (const p of payload.plumes) {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { id: p.id, kind: 'source', hotspots: p.hotspots, title: title(p) } })
    }
    for (const p of payload.plumes) {
      if (p.path.length < 2) continue
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: p.path }, properties: { id: p.id, kind: 'ahead', title: title(p) } })
      if (t < 0.05) continue
      const head = positionAt(p, t)
      const tail = positionAt(p, Math.max(0, t - 1))
      const travelled = [...p.path.slice(0, Math.min(Math.floor(t), p.path.length - 1) + 1), head]
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: travelled }, properties: { id: p.id, kind: 'path', hotspots: p.hotspots, title: title(p) } })
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: head }, properties: { id: p.id, kind: 'head', rot: bearing(tail, head), hotspots: p.hotspots, title: title(p) } })
    }
    return { type: 'FeatureCollection', features }
  }, [payload, t])

  const hazeSpecs = useMemo(
    () => [
      {
        id: 'smoke-haze',
        type: 'heatmap' as const,
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
    ],
    [palette],
  )

  const plumeSpecs = useMemo(() => {
    const width = ['interpolate', ['linear'], ['get', 'hotspots'], 4, 1.5, 300, 3.5, 1000, 5]
    return [
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
          'icon-ignore-placement': true,
        },
        paint: { 'icon-color': color, 'icon-halo-color': palette.halo, 'icon-halo-width': 1.5 },
      },
    ]
  }, [palette, color])

  useMapLayer({
    owner: 'smoke',
    sourceId: 'smoke-haze',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    layers: hazeSpecs as never,
    data: haze,
    visible: on,
    belowLabels: true,
    selectable: false,
  })

  useMapLayer({
    owner: 'smoke',
    sourceId: 'smoke',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    layers: plumeSpecs as never,
    data: plumes,
    visible: on,
    interactive: ['smoke-source', 'smoke-head', 'smoke-path'],
  })

  useSmokeParticles(on, payload?.plumes, color)

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
  if (!payload || !p) return <Gone layer="smoke" loading={!payload} />
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
