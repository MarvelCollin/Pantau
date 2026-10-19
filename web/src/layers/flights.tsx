import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import type { FeatureCollection } from 'geojson'
import { getEnvelope, type Envelope } from '../lib/api'
import { formatCoord, formatNumber } from '../lib/format'
import { useLayerOn, useStore, type ViewState } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { usePalette } from '../map/usePalette'
import { cssVar } from '../theme'
import { useLayerStatus } from './useLayerStatus'
import { DetailHeader, ExternalLink, Facts, Gone, Lead, Section } from '../ui/Detail'

export interface Flight {
  hex: string
  callsign?: string
  reg?: string
  type?: string
  lat: number
  lon: number
  altFt: number | null
  ground: boolean
  speedKt?: number
  track?: number
  vertFpm?: number
  squawk?: string
  emergency?: string
  military: boolean
  seen: number
}

const CELL = 5
const MAX_CELLS = 6
const POLL_MS = 15_000

function cellsFor(view: ViewState | null): { cells: [number, number][]; capped: boolean } {
  if (!view) return { cells: [], capped: false }
  const [w, s, e, n] = view.bounds
  const snap = (v: number) => Math.round(v / CELL) * CELL
  const cells: [number, number][] = []
  for (let lat = snap(s); lat <= snap(n); lat += CELL) {
    for (let lon = snap(w); lon <= snap(e); lon += CELL) {
      if (lat < -85 || lat > 85) continue
      const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180
      cells.push([lat, wrapped])
    }
  }
  const [cx, cy] = view.center
  cells.sort((a, b) => Math.hypot(a[0] - cy, a[1] - cx) - Math.hypot(b[0] - cy, b[1] - cx))
  return { cells: cells.slice(0, MAX_CELLS), capped: cells.length > MAX_CELLS }
}

function flightKey(lat: number, lon: number) {
  return ['flights', lat, lon] as const
}

function project(f: Flight, seconds: number): [number, number] {
  if (f.ground || !f.speedKt || f.track === undefined || seconds <= 0) return [f.lon, f.lat]
  const t = Math.min(seconds, 60)
  const km = f.speedKt * 1.852 * (t / 3600)
  const rad = (f.track * Math.PI) / 180
  const dLat = (km * Math.cos(rad)) / 111.32
  const dLon = (km * Math.sin(rad)) / (111.32 * Math.cos((f.lat * Math.PI) / 180))
  return [f.lon + dLon, f.lat + dLat]
}

export function useFlightsData(on: boolean) {
  const view = useStore((s) => s.view)
  const { cells, capped } = useMemo(() => cellsFor(view), [view])
  const queries = useQueries({
    queries: cells.map(([lat, lon]) => ({
      queryKey: flightKey(lat, lon),
      queryFn: ({ signal }: { signal: AbortSignal }) => getEnvelope<Flight[]>(`/api/flights?lat=${lat}&lon=${lon}`, signal),
      enabled: on,
      staleTime: 10_000,
      refetchInterval: POLL_MS,
      gcTime: 2 * 60_000,
    })),
  })
  return { queries, capped }
}

interface Positioned {
  flight: Flight
  fetchedAt: number
}

function merge(results: (Envelope<Flight[]> | undefined)[]): Map<string, Positioned> {
  const map = new Map<string, Positioned>()
  for (const env of results) {
    if (!env) continue
    for (const f of env.items) {
      const prev = map.get(f.hex)
      const at = env.fetchedAt - f.seen * 1000
      if (!prev || prev.fetchedAt - prev.flight.seen * 1000 < at) map.set(f.hex, { flight: f, fetchedAt: env.fetchedAt })
    }
  }
  return map
}

function FlightsLayer() {
  const on = useLayerOn('flights')
  const { queries, capped } = useFlightsData(on)
  const palette = usePalette()
  const color = palette.color('flights')
  const view = useStore((s) => s.view)
  const [tick, setTick] = useState(() => Date.now())

  const results = queries.map((q) => q.data)
  const stamp = results.map((r) => r?.fetchedAt ?? 0).join(',')
  const merged = useMemo(() => merge(results), [stamp])

  useEffect(() => {
    if (!on) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setTick(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [on])

  const data = useMemo<FeatureCollection>(() => {
    const features: FeatureCollection['features'] = []
    for (const { flight: f, fetchedAt } of merged.values()) {
      const coords = project(f, (tick - fetchedAt) / 1000 + f.seen)
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: {
          id: f.hex,
          track: f.track ?? 0,
          kind: f.emergency ? 'emergency' : f.military ? 'military' : f.ground ? 'ground' : 'air',
          label: f.callsign ?? f.reg ?? f.hex,
          title: [f.callsign ?? f.hex, f.type, f.altFt ? `${formatNumber(f.altFt)} ft` : f.ground ? 'on ground' : ''].filter(Boolean).join(', '),
        },
      })
    }
    return { type: 'FeatureCollection', features }
  }, [merged, tick])

  const military = cssVar('--accent-strong')
  const specs = useMemo(
    () => [
      {
        id: 'flights-icon',
        type: 'symbol' as const,
        layout: {
          'icon-image': 'plane',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.42, 8, 0.62, 12, 0.8],
          'icon-rotate': ['get', 'track'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'text-field': ['step', ['zoom'], '', 8, ['get', 'label']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'icon-color': [
            'match',
            ['get', 'kind'],
            'emergency',
            palette.danger,
            'military',
            military,
            'ground',
            cssVar('--muted'),
            color,
          ],
          'icon-halo-color': palette.halo,
          'icon-halo-width': 1.5,
          'text-color': color,
          'text-halo-color': palette.halo,
          'text-halo-width': 1.5,
        },
      },
    ],
    [color, palette, military],
  )

  useMapLayer({
    owner: 'flights',
    sourceId: 'flights',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    layers: specs as never,
    data,
    visible: on,
    interactive: ['flights-icon'],
  })

  const inView = useMemo(() => {
    if (!view) return merged.size
    const [w, s, e, n] = view.bounds
    let count = 0
    for (const { flight } of merged.values()) if (flight.lat >= s && flight.lat <= n && flight.lon >= w && flight.lon <= e) count++
    return count
  }, [merged, view])

  const lead = queries.find((q) => q.data) ?? queries[0]
  const source = {
    data: lead?.data,
    isError: queries.length > 0 && queries.every((q) => q.isError),
    error: lead?.error,
  }
  useLayerStatus('flights', on, source, {
    count: inView,
    note: 'in view',
    staleAfterMs: 90_000,
    override: capped && lead?.data ? 'zoom_in' : undefined,
  })
  return null
}

function useFlight(hex: string): Flight | undefined {
  const client = useQueryClient()
  const [, force] = useState(0)
  useEffect(() => {
    const unsub = client.getQueryCache().subscribe(() => force((n) => n + 1))
    return unsub
  }, [client])
  let best: Positioned | undefined
  for (const q of client.getQueryCache().findAll({ queryKey: ['flights'] })) {
    const env = q.state.data as Envelope<Flight[]> | undefined
    const f = env?.items.find((i) => i.hex === hex)
    if (f && env && (!best || env.fetchedAt > best.fetchedAt)) best = { flight: f, fetchedAt: env.fetchedAt }
  }
  return best?.flight
}

function FlightDetail({ id }: { id: string }) {
  const f = useFlight(id)
  if (!f) return <Gone layer="flights" />
  const title = f.callsign ?? f.reg ?? f.hex.toUpperCase()
  const km = f.speedKt ? Math.round(f.speedKt * 1.852) : undefined
  const altM = f.altFt ? Math.round(f.altFt * 0.3048) : undefined

  return (
    <>
      <DetailHeader layer="flights" title={title} subtitle={[f.type, f.reg].filter(Boolean).join(', ') || 'Unknown aircraft'} />
      {f.emergency && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>Emergency squawk: {f.emergency}</p>}
      <Lead
        value={f.ground ? 'Ground' : f.altFt !== null ? formatNumber(f.altFt) : 'Unknown'}
        unit={f.ground || f.altFt === null ? undefined : 'ft'}
        label={altM ? `${formatNumber(altM)} m above sea level` : 'Altitude'}
      />
      <Facts
        rows={[
          ['Speed', f.speedKt !== undefined ? <span className="num">{f.speedKt} kt, {km} km/h</span> : undefined],
          ['Heading', f.track !== undefined ? <span className="num">{Math.round(f.track)}°</span> : undefined],
          ['Climb rate', f.vertFpm ? <span className="num">{f.vertFpm > 0 ? '+' : ''}{formatNumber(f.vertFpm)} ft/min</span> : undefined],
          ['Squawk', f.squawk],
          ['Operator type', f.military ? 'Military' : undefined],
          ['ICAO address', <span className="num">{f.hex.toUpperCase()}</span>],
          ['Position', <span className="num">{formatCoord(f.lat, f.lon)}</span>],
          ['Last signal', `${f.seen}s before the update`],
        ]}
      />
      <Section>
        <ExternalLink href={`https://adsb.lol/?icao=${f.hex}`}>Track on adsb.lol</ExternalLink>
        {f.callsign && <ExternalLink href={`https://www.flightaware.com/live/flight/${encodeURIComponent(f.callsign)}`}>Flight on FlightAware</ExternalLink>}
      </Section>
    </>
  )
}

export const flightsModule = { Layer: FlightsLayer, Detail: FlightDetail }
