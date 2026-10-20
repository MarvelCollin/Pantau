import { useEffect, useMemo } from 'react'
import type { FeatureCollection } from 'geojson'
import { formatAgo, formatCoord, formatNumber, formatWib } from '../lib/format'
import { useLayerOn } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { useMap } from '../map/context'
import { prefersReducedMotion } from '../lib/motion'
import { usePalette } from '../map/usePalette'
import { cssVar } from '../theme'
import { useLayerStatus } from './useLayerStatus'
import { useEnvelope } from './useStaticLayer'
import { DetailHeader, ExternalLink, Facts, Gone, Lead, Section } from '../ui/Detail'

export type Place = [village: string, district: string, regency: string, province: string]

export type KarhutlaHotspot = [
  lat: number,
  lon: number,
  confidence: 'l' | 'm' | 'h',
  satellite: 'm' | 's' | 'n',
  time: number,
  place: number,
  detections: number,
]

export interface Karhutla {
  places: Place[]
  hotspots: KarhutlaHotspot[]
}

export const confidenceNames = { l: 'Low', m: 'Medium', h: 'High' }

const satelliteNames = { m: 'Terra or Aqua, MODIS', s: 'Suomi NPP, VIIRS', n: 'NOAA-20, VIIRS' }

const GLOW_MS = 1400

export function hotspotId(h: KarhutlaHotspot) {
  return `${h[0]},${h[1]},${h[4]}`
}

export function useKarhutla(enabled = true) {
  return useEnvelope<Karhutla>({ key: 'karhutla', path: '/api/karhutla', enabled, staleMs: 15 * 60_000, pollMs: 15 * 60_000 })
}

export function provinceTotals(data: Karhutla, confidence?: KarhutlaHotspot[2]) {
  const totals = new Map<string, { province: string; count: number; lat: number; lon: number }>()
  for (const h of data.hotspots) {
    if (confidence && h[2] !== confidence) continue
    const province = data.places[h[5]]?.[3] || 'Unknown province'
    const row = totals.get(province) ?? { province, count: 0, lat: 0, lon: 0 }
    row.count++
    row.lat += h[0]
    row.lon += h[1]
    totals.set(province, row)
  }
  return [...totals.values()]
    .map((r) => ({ ...r, lat: r.lat / r.count, lon: r.lon / r.count }))
    .sort((a, b) => b.count - a.count)
}

function placeLabel(place: Place | undefined) {
  if (!place) return 'Indonesia'
  return place[0] || place[1] || place[2] || place[3] || 'Indonesia'
}

function KarhutlaLayer() {
  const on = useLayerOn('karhutla')
  const query = useKarhutla(on)
  const palette = usePalette()
  const payload = query.data?.items

  const data = useMemo<FeatureCollection | undefined>(
    () =>
      payload && {
        type: 'FeatureCollection',
        features: payload.hotspots.map((h) => {
          const place = payload.places[h[5]]
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [h[1], h[0]] },
            properties: {
              id: hotspotId(h),
              conf: h[2],
              rank: h[2] === 'h' ? 2 : h[2] === 'm' ? 1 : 0,
              title: `Hotspot in ${placeLabel(place)}${place?.[2] ? `, ${place[2]}` : ''}, ${confidenceNames[h[2]].toLowerCase()} confidence`,
            },
          }
        }),
      },
    [payload],
  )

  const specs = useMemo(() => {
    const color = ['match', ['get', 'conf'], 'h', cssVar('--lvl-4'), 'm', cssVar('--lvl-3'), cssVar('--lvl-2')]
    return [
      {
        id: 'karhutla-glow',
        type: 'circle' as const,
        filter: ['==', ['get', 'conf'], 'h'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 9, 18],
          'circle-color': cssVar('--lvl-4'),
          'circle-blur': 0.9,
          'circle-opacity': 0.12,
          'circle-opacity-transition': { duration: GLOW_MS, delay: 0 },
        },
      },
      {
        id: 'karhutla-dot',
        type: 'circle' as const,
        layout: { 'circle-sort-key': ['get', 'rank'] },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['match', ['get', 'conf'], 'h', 3, 'm', 2.2, 1.6], 9, ['match', ['get', 'conf'], 'h', 8, 'm', 6, 5]],
          'circle-color': color,
          'circle-opacity': 0.9,
          'circle-stroke-color': palette.halo,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 9, 1.5],
        },
      },
    ]
  }, [palette])

  useMapLayer({
    owner: 'karhutla',
    sourceId: 'karhutla',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, buffer: 32 },
    layers: specs as never,
    data,
    visible: on,
    interactive: ['karhutla-dot'],
  })

  const map = useMap()
  useEffect(() => {
    if (!map || !on || prefersReducedMotion()) return
    let bright = false
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || !map.getLayer('karhutla-glow')) return
      bright = !bright
      map.setPaintProperty('karhutla-glow', 'circle-opacity', bright ? 0.5 : 0.12)
    }, GLOW_MS)
    return () => clearInterval(timer)
  }, [map, on])

  const high = useMemo(() => payload?.hotspots.filter((h) => h[2] === 'h').length, [payload])
  useLayerStatus('karhutla', on, query, {
    count: payload?.hotspots.length,
    note: high !== undefined ? `in 24 hours, ${formatNumber(high)} high confidence` : 'in 24 hours',
    staleAfterMs: 2 * 3600_000,
  })
  return null
}

function KarhutlaDetail({ id }: { id: string }) {
  const { data } = useKarhutla()
  const payload = data?.items
  const h = payload?.hotspots.find((i) => hotspotId(i) === id)
  if (!payload || !h) return <Gone layer="karhutla" />
  const place = payload.places[h[5]]
  const time = h[4] * 1000
  const regency = place?.[2]
  const inRegency = regency ? payload.hotspots.filter((o) => payload.places[o[5]]?.[2] === regency) : []
  const highInRegency = inRegency.filter((o) => o[2] === 'h').length

  return (
    <>
      <DetailHeader layer="karhutla" title={`Hotspot in ${placeLabel(place)}`} subtitle={`${formatWib(time)}, ${formatAgo(time)}`} />
      {regency && (
        <Lead
          value={formatNumber(inRegency.length)}
          unit="hotspots"
          label={`in ${regency} over the last 24 hours, ${formatNumber(highInRegency)} of them high confidence`}
        />
      )}
      <Facts
        rows={[
          ['Confidence', confidenceNames[h[2]]],
          ['Village', place?.[0]],
          ['District', place?.[1]],
          ['Regency or city', place?.[2]],
          ['Province', place?.[3]],
          ['Satellite', satelliteNames[h[3]]],
          ['Detections at this spot', h[6] > 1 ? `${h[6]} passes` : undefined],
          ['Location', <span className="num">{formatCoord(h[0], h[1])}</span>],
        ]}
      />
      <Section>
        <ExternalLink href="https://sipongi.gakkum.kehutanan.go.id/peta">Open the SiPongi+ map</ExternalLink>
      </Section>
    </>
  )
}

export const karhutlaModule = { Layer: KarhutlaLayer, Detail: KarhutlaDetail }
