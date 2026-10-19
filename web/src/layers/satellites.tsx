import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { FeatureCollection } from 'geojson'
import type { OMMJsonObject } from 'satellite.js'
import { getJson } from '../lib/api'
import { formatCoord, formatNumber } from '../lib/format'
import { useLayerOn, useStore } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { usePalette } from '../map/usePalette'
import { useLayerStatus } from './useLayerStatus'
import { DetailHeader, ExternalLink, Facts, Gone, Lead, Section } from '../ui/Detail'
import type { SatPosition, WorkerIn, WorkerOut } from '../workers/satellites.worker'

const GROUPS = ['stations', 'visual']
const TICK_MS = 2000

async function fetchGroups(signal: AbortSignal) {
  const lists = await Promise.all(
    GROUPS.map((g) => getJson<OMMJsonObject[]>(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=json`, signal)),
  )
  const seen = new Set<string>()
  const items = lists.flat().filter((o) => {
    const id = String(o.NORAD_CAT_ID)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  return { fetchedAt: Date.now(), items }
}

function useElements(enabled: boolean) {
  return useQuery({
    queryKey: ['satellites', GROUPS.join(',')],
    queryFn: ({ signal }) => fetchGroups(signal),
    enabled,
    staleTime: 6 * 3600_000,
    gcTime: 24 * 3600_000,
    meta: { persist: true },
  })
}

let latest: SatPosition[] = []
const listeners = new Set<() => void>()
let track: { id: string; lines: [number, number][][] } | null = null

function useSatPositions() {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force((n) => n + 1)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])
  return latest
}

function SatellitesLayer() {
  const on = useLayerOn('satellites')
  const query = useElements(on)
  const palette = usePalette()
  const color = palette.color('satellites')
  const worker = useRef<Worker | null>(null)
  const positions = useSatPositions()
  const selected = useStore((s) => (s.selection?.kind === 'item' && s.selection.layer === 'satellites' ? s.selection.id : null))

  useEffect(() => {
    if (!on) return
    const w = new Worker(new URL('../workers/satellites.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      if (e.data.type === 'positions') latest = e.data.items
      else track = { id: e.data.id, lines: e.data.lines }
      listeners.forEach((fn) => fn())
    }
    return () => {
      w.terminate()
      worker.current = null
      latest = []
      track = null
    }
  }, [on])

  const items = query.data?.items
  useEffect(() => {
    const w = worker.current
    if (!w || !items) return
    w.postMessage({ type: 'load', omm: items } satisfies WorkerIn)
    const tick = () => {
      if (document.visibilityState === 'visible') w.postMessage({ type: 'tick', time: Date.now() } satisfies WorkerIn)
    }
    tick()
    const timer = setInterval(tick, TICK_MS)
    return () => clearInterval(timer)
  }, [items, on])

  useEffect(() => {
    const w = worker.current
    if (!w || !selected || !items) return
    const ask = () => w.postMessage({ type: 'track', id: selected, time: Date.now() } satisfies WorkerIn)
    ask()
    const timer = setInterval(ask, 60_000)
    return () => clearInterval(timer)
  }, [selected, items, on])

  const data = useMemo<FeatureCollection>(() => {
    const features: FeatureCollection['features'] = positions.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { id: p.id, kind: 'sat', label: p.name, title: `${p.name}, ${formatNumber(Math.round(p.altKm))} km up` },
    }))
    if (track && track.id === selected) {
      features.push({
        type: 'Feature',
        geometry: { type: 'MultiLineString', coordinates: track.lines },
        properties: { kind: 'track' },
      })
    }
    return { type: 'FeatureCollection', features }
  }, [positions, selected])

  const specs = useMemo(
    () => [
      {
        id: 'satellites-track',
        type: 'line' as const,
        filter: ['==', ['get', 'kind'], 'track'],
        paint: { 'line-color': color, 'line-width': 1.5, 'line-dasharray': [2, 2], 'line-opacity': 0.8 },
      },
      {
        id: 'satellites-icon',
        type: 'symbol' as const,
        filter: ['==', ['get', 'kind'], 'sat'],
        layout: {
          'icon-image': 'diamond',
          'icon-size': 0.32,
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 5, ['get', 'label']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'icon-color': color,
          'icon-halo-color': palette.halo,
          'icon-halo-width': 1.5,
          'text-color': color,
          'text-halo-color': palette.halo,
          'text-halo-width': 1.5,
        },
      },
    ],
    [color, palette.halo],
  )

  useMapLayer({
    owner: 'satellites',
    sourceId: 'satellites',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    layers: specs as never,
    data,
    visible: on,
    interactive: ['satellites-icon'],
  })

  const view = useStore((s) => s.view)
  const overhead = useMemo(() => {
    if (!view) return positions.length
    const [w, s, e, n] = view.bounds
    return positions.filter((p) => p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= e).length
  }, [positions, view])

  useLayerStatus('satellites', on, query, {
    count: positions.length ? overhead : undefined,
    note: `over this view of ${positions.length}`,
    staleAfterMs: 48 * 3600_000,
  })
  return null
}

function SatelliteDetail({ id }: { id: string }) {
  const positions = useSatPositions()
  const p = positions.find((s) => s.id === id)
  if (!p) return positions.length ? <Gone layer="satellites" /> : <DetailHeader layer="satellites" title="Working out position" />

  return (
    <>
      <DetailHeader layer="satellites" title={p.name} subtitle={`NORAD ${p.id}`} />
      <Lead value={formatNumber(Math.round(p.altKm))} unit="km" label="Height above the earth" />
      <Facts
        rows={[
          ['Speed', <span className="num">{p.speedKms.toFixed(2)} km/s, {formatNumber(Math.round(p.speedKms * 3600))} km/h</span>],
          ['Above', <span className="num">{formatCoord(p.lat, p.lon)}</span>],
          ['Path', 'Dashed line shows the next 100 minutes'],
        ]}
      />
      <Section>
        <ExternalLink href={`https://celestrak.org/satcat/table-satcat.php?CATNR=${p.id}`}>Catalog entry on CelesTrak</ExternalLink>
        <ExternalLink href={`https://www.n2yo.com/satellite/?s=${p.id}`}>Pass predictions on N2YO</ExternalLink>
      </Section>
    </>
  )
}

export const satellitesModule = { Layer: SatellitesLayer, Detail: SatelliteDetail }
