import { useEffect, useMemo } from 'react'
import type { FeatureCollection } from 'geojson'
import { formatAgo, formatCoord } from '../lib/format'
import { useLayerOn, useStore } from '../state/store'
import { TrailBook, lineCoords } from './trails'
import { useMapLayer } from '../map/useMapLayer'
import { usePalette } from '../map/usePalette'
import { useLayerStatus } from './useLayerStatus'
import { useEnvelope } from './useStaticLayer'
import { DetailHeader, ExternalLink, Facts, Gone, Lead, Section } from '../ui/Detail'

export interface Ship {
  mmsi: number
  name?: string
  lat: number
  lon: number
  sog?: number
  cog?: number
  heading?: number
  status?: number
  shipType?: number
  destination?: string
  callsign?: string
  time: number
}

const statusNames = [
  'Under way using engine',
  'At anchor',
  'Not under command',
  'Restricted manoeuvrability',
  'Constrained by draught',
  'Moored',
  'Aground',
  'Fishing',
  'Under way sailing',
]

function typeName(code?: number): string | undefined {
  if (code === undefined || code === 0) return undefined
  if (code === 30) return 'Fishing'
  if (code === 31 || code === 32 || code === 52) return 'Tug or towing'
  if (code === 35) return 'Military'
  if (code === 36) return 'Sailing'
  if (code === 37) return 'Pleasure craft'
  if (code >= 40 && code < 50) return 'High speed craft'
  if (code === 50) return 'Pilot vessel'
  if (code === 51) return 'Search and rescue'
  if (code >= 60 && code < 70) return 'Passenger'
  if (code >= 70 && code < 80) return 'Cargo'
  if (code >= 80 && code < 90) return 'Tanker'
  return 'Other'
}

const trails = new TrailBook()

export function useShips(enabled = true) {
  return useEnvelope<Ship[]>({ key: 'ships', path: '/api/ships', enabled, staleMs: 2 * 60_000, pollMs: 2 * 60_000, persist: false })
}

function ShipsLayer() {
  const on = useLayerOn('ships')
  const query = useShips(on)
  const palette = usePalette()
  const color = palette.color('ships')
  const items = query.data?.items
  const env = query.data
  const selected = useStore((s) => (s.selection?.kind === 'item' && s.selection.layer === 'ships' ? s.selection.id : null))

  useEffect(() => {
    if (env) trails.record(env.fetchedAt, env.items.map((s) => ({ id: String(s.mmsi), lon: s.lon, lat: s.lat, t: s.time })))
  }, [env])

  const data = useMemo<FeatureCollection | undefined>(
    () =>
      items && {
        type: 'FeatureCollection',
        features: [
          ...(selected && trails.get(selected).length > 1
            ? [{ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: lineCoords(trails.get(selected)) }, properties: { role: 'trail' } }]
            : []),
          ...items.map((s) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
          properties: {
            id: String(s.mmsi),
            course: s.heading ?? s.cog ?? 0,
            moving: (s.sog ?? 0) > 0.5 ? 1 : 0,
            role: 'ship',
            title: [s.name ?? `MMSI ${s.mmsi}`, typeName(s.shipType), s.sog !== undefined ? `${s.sog} kn` : ''].filter(Boolean).join(', '),
          },
        })),
        ],
      },
    [items, selected],
  )

  const specs = useMemo(
    () => [
      {
        id: 'ships-trail',
        type: 'line' as const,
        filter: ['==', ['get', 'role'], 'trail'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': color, 'line-width': 2.5, 'line-opacity': 0.8 },
      },
      {
        id: 'ships-icon',
        filter: ['==', ['get', 'role'], 'ship'],
        type: 'symbol' as const,
        layout: {
          'icon-image': 'ship',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 10, 0.55],
          'icon-rotate': ['get', 'course'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
        },
        paint: {
          'icon-color': color,
          'icon-opacity': ['case', ['==', ['get', 'moving'], 1], 1, 0.55],
          'icon-halo-color': palette.halo,
          'icon-halo-width': 1.2,
        },
      },
    ],
    [color, palette.halo],
  )

  useMapLayer({
    owner: 'ships',
    sourceId: 'ships',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    layers: specs as never,
    data,
    visible: on,
    interactive: ['ships-icon'],
  })

  useLayerStatus('ships', on, query, {
    count: items?.length,
    note: query.isError && !items ? 'Server needs a free AISSTREAM_KEY, see the README' : 'seen in 45 min',
    staleAfterMs: 10 * 60_000,
  })
  return null
}

function ShipDetail({ id }: { id: string }) {
  const { data } = useShips()
  const s = data?.items.find((i) => String(i.mmsi) === id)
  if (!s) return <Gone layer="ships" loading={!data} />

  return (
    <>
      <DetailHeader layer="ships" title={s.name ?? `MMSI ${s.mmsi}`} subtitle={[typeName(s.shipType), s.callsign].filter(Boolean).join(', ') || 'Vessel'} />
      <Lead value={s.sog !== undefined ? s.sog.toFixed(1) : 'Unknown'} unit={s.sog !== undefined ? 'knots' : undefined} label={s.status !== undefined ? statusNames[s.status] ?? 'Status not given' : 'Speed over ground'} />
      <Facts
        rows={[
          ['Course', s.cog !== undefined ? <span className="num">{Math.round(s.cog)}°</span> : undefined],
          ['Destination', s.destination],
          ['MMSI', <span className="num">{s.mmsi}</span>],
          ['Position', <span className="num">{formatCoord(s.lat, s.lon)}</span>],
          ['Last report', formatAgo(s.time)],
          ['Trail', trails.get(id).length > 1 ? `Line shows ${trails.get(id).length} positions seen by Pantau` : 'Trail builds up while you watch'],
        ]}
      />
      <Section>
        <ExternalLink href={`https://www.marinetraffic.com/en/ais/details/ships/mmsi:${s.mmsi}`}>Vessel on MarineTraffic</ExternalLink>
      </Section>
    </>
  )
}

export const shipsModule = { Layer: ShipsLayer, Detail: ShipDetail }
