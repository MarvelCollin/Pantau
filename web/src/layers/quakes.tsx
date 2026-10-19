import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { FeatureCollection } from 'geojson'
import { getEnvelope } from '../lib/api'
import { formatAgo, formatCoord, formatWib } from '../lib/format'
import { useLayerOn } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { mapHooks, useMap } from '../map/context'
import { usePalette } from '../map/usePalette'
import { useLayerStatus } from './useLayerStatus'
import { DetailHeader, ExternalLink, Facts, Gone, Lead, Section } from '../ui/Detail'
import styles from './quakes.module.css'
import { Nearby } from '../ui/Nearby'
import { distanceKm } from './trails'

export interface Quake {
  id: string
  source: 'BMKG' | 'USGS'
  time: number
  lat: number
  lon: number
  mag: number
  depthKm: number
  place: string
  felt?: string
  tsunami?: string
  shakemap?: string
  url?: string
}

export function useQuakes(enabled = true) {
  return useQuery({
    queryKey: ['quakes'],
    queryFn: ({ signal }) => getEnvelope<Quake[]>('/api/quakes', signal),
    enabled,
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
    meta: { persist: true },
  })
}

function toGeoJson(items: Quake[]): FeatureCollection {
  const now = Date.now()
  return {
    type: 'FeatureCollection',
    features: items.map((q) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [q.lon, q.lat] },
      properties: {
        id: q.id,
        mag: q.mag,
        recent: now - q.time < 24 * 3600_000 ? 1 : 0,
        title: `M${q.mag.toFixed(1)} ${q.place}`,
      },
    })),
  }
}

function QuakesLayer() {
  const on = useLayerOn('quakes')
  const query = useQuakes(on)
  const palette = usePalette()
  const color = palette.color('quakes')
  const items = query.data?.items
  const data = useMemo(() => (items ? toGeoJson(items) : undefined), [items])

  const specs = useMemo(
    () => [
      {
        id: 'quakes-circle',
        type: 'circle' as const,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 3, 5, 8, 7, 18],
          'circle-color': color,
          'circle-opacity': ['case', ['==', ['get', 'recent'], 1], 0.55, 0],
          'circle-stroke-color': color,
          'circle-stroke-width': ['case', ['==', ['get', 'recent'], 1], 2, 1.5],
          'circle-stroke-opacity': ['case', ['==', ['get', 'recent'], 1], 1, 0.75],
        },
      },
      {
        id: 'quakes-label',
        type: 'symbol' as const,
        filter: ['>=', ['get', 'mag'], 5],
        layout: {
          'text-field': ['number-format', ['get', 'mag'], { 'min-fraction-digits': 1, 'max-fraction-digits': 1 }],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-offset': [0, 1.6],
          'text-allow-overlap': false,
        },
        paint: { 'text-color': color, 'text-halo-color': palette.halo, 'text-halo-width': 1.5 },
      },
    ],
    [color, palette.halo],
  )

  useMapLayer({
    owner: 'quakes',
    sourceId: 'quakes',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    layers: specs as never,
    data,
    visible: on,
    interactive: ['quakes-circle'],
  })

  const map = useMap()
  useEffect(() => {
    if (!map) return
    const fresh = on && items ? items.filter((q) => Date.now() - q.time < 3 * 3600_000 && q.mag >= 3).map((q) => [q.lon, q.lat] as [number, number]) : []
    mapHooks.pulses('quake', fresh)
    return () => mapHooks.pulses('quake', [])
  }, [map, on, items])

  useLayerStatus('quakes', on, query, { count: items?.length, note: 'recent', staleAfterMs: 5 * 60_000 })
  return null
}

function QuakeDetail({ id }: { id: string }) {
  const { data } = useQuakes()
  const q = data?.items.find((i) => i.id === id)
  if (!q) return <Gone layer="quakes" />

  return (
    <>
      <DetailHeader layer="quakes" title={q.place} subtitle={`${formatWib(q.time)}, ${formatAgo(q.time)}`} />
      <Lead value={q.mag.toFixed(1)} unit="magnitude" label={`Depth ${q.depthKm} km`} />
      {q.tsunami && (
        <p className={styles.tsunami} data-risk={/berpotensi tsunami/i.test(q.tsunami) && !/tidak/i.test(q.tsunami)}>
          {q.tsunami}
        </p>
      )}
      <Facts
        rows={[
          ['Felt in', q.felt],
          ['Location', <span className="num">{formatCoord(q.lat, q.lon)}</span>],
          ['Reported by', q.source],
        ]}
      />
      {q.shakemap && (
        <Section>
          <img className={styles.shakemap} src={q.shakemap} alt={`BMKG shake intensity map for the earthquake near ${q.place}`} width={640} height={640} loading="lazy" />
        </Section>
      )}
      <Nearby
        title="Other recent earthquakes within 150 km"
        layer="quakes"
        empty="No other recent earthquakes recorded nearby."
        items={(data?.items ?? [])
          .filter((o) => o.id !== q.id && distanceKm([o.lon, o.lat], [q.lon, q.lat]) <= 150)
          .slice(0, 8)
          .map((o) => ({
            id: o.id,
            lon: o.lon,
            lat: o.lat,
            label: `M${o.mag.toFixed(1)}, ${Math.round(distanceKm([o.lon, o.lat], [q.lon, q.lat]))} km away`,
            sub: formatAgo(o.time),
          }))}
      />
      <Section>
        {q.url ? (
          <ExternalLink href={q.url}>Event page on USGS</ExternalLink>
        ) : (
          <ExternalLink href="https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg">Latest earthquakes on BMKG</ExternalLink>
        )}
      </Section>
    </>
  )
}

export const quakesModule = { Layer: QuakesLayer, Detail: QuakeDetail }
