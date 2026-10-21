import { useMemo } from 'react'
import type { FeatureCollection } from 'geojson'
import { formatAgo, formatCoord, formatWib } from '../lib/format'
import { useLayerOn } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { usePalette } from '../map/usePalette'
import { useLayerStatus } from './useLayerStatus'
import { useEnvelope } from './useStaticLayer'
import { DetailHeader, ExternalLink, Facts, Gone, Lead, Section } from '../ui/Detail'
import { distanceKm } from './trails'
import { towns } from '../map/overview'

export type Fire = [lat: number, lon: number, frp: number, confidence: 'l' | 'n' | 'h', time: number, night: 0 | 1]

const confidence = { l: 'Low', n: 'Nominal', h: 'High' }

function fireId(f: Fire) {
  return `${f[0]},${f[1]},${f[4]}`
}

export function useFires(enabled = true) {
  return useEnvelope<Fire[]>({ key: 'fires', path: '/api/fires', enabled, staleMs: 20 * 60_000, pollMs: 30 * 60_000 })
}

function FiresLayer() {
  const on = useLayerOn('fires')
  const query = useFires(on)
  const palette = usePalette()
  const color = palette.color('fires')
  const items = query.data?.items

  const data = useMemo<FeatureCollection | undefined>(
    () =>
      items && {
        type: 'FeatureCollection',
        features: items.map((f) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [f[1], f[0]] },
          properties: { id: fireId(f), frp: f[2], title: `Hotspot, ${f[2]} MW, ${confidence[f[3]]} confidence` },
        })),
      },
    [items],
  )

  const specs = useMemo(
    () => [
      {
        id: 'fires-dot',
        type: 'circle' as const,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['interpolate', ['linear'], ['get', 'frp'], 0, 1.5, 100, 4], 9, ['interpolate', ['linear'], ['get', 'frp'], 0, 4, 100, 10]],
          'circle-color': color,
          'circle-opacity': 0.85,
          'circle-stroke-color': palette.halo,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 9, 1.5],
        },
      },
    ],
    [color, palette.halo],
  )

  useMapLayer({
    owner: 'fires',
    sourceId: 'fires',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, buffer: 32 },
    layers: specs as never,
    data,
    visible: on,
    interactive: ['fires-dot'],
  })

  useLayerStatus('fires', on, query, { count: items?.length, note: 'in 24 hours', staleAfterMs: 4 * 3600_000 })
  return null
}

function FireDetail({ id }: { id: string }) {
  const { data } = useFires()
  const f = data?.items.find((i) => fireId(i) === id)
  if (!f) return <Gone layer="fires" loading={!data} />
  const time = f[4] * 1000
  const here: [number, number] = [f[1], f[0]]
  const cluster = data!.items.filter((o) => Math.abs(o[0] - f[0]) < 0.1 && Math.abs(o[1] - f[1]) < 0.1 && distanceKm([o[1], o[0]], here) <= 10)
  const nearest = towns
    .map(([name, region, lon, lat]) => ({ name, region, km: distanceKm([lon, lat], here) }))
    .sort((a, b) => a.km - b.km)[0]

  return (
    <>
      <DetailHeader layer="fires" title="Fire hotspot" subtitle={`${formatWib(time)}, ${formatAgo(time)}`} />
      <Lead value={f[2]} unit="MW" label="Fire radiative power, a rough measure of how intense the fire is" />
      <Facts
        rows={[
          ['Hotspots within 10 km', `${cluster.length} in the last 24 hours, ${Math.round(cluster.reduce((s, o) => s + o[2], 0))} MW in total`],
          ['Nearest big city', `${nearest.name}, ${Math.round(nearest.km)} km away`],
          ['Confidence', confidence[f[3]]],
          ['Pass', f[5] ? 'Night' : 'Day'],
          ['Satellite', 'Suomi NPP, VIIRS'],
          ['Location', <span className="num">{formatCoord(f[0], f[1])}</span>],
        ]}
      />
      <Section>
        <ExternalLink href={`https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${f[1]},${f[0]},12z`}>Open in NASA FIRMS</ExternalLink>
      </Section>
    </>
  )
}

export const firesModule = { Layer: FiresLayer, Detail: FireDetail }
