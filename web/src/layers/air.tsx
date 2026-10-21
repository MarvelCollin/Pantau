import { useMemo } from 'react'
import type { FeatureCollection } from 'geojson'
import { formatAgo, formatCoord, formatWib } from '../lib/format'
import { useLayerOn } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { usePalette } from '../map/usePalette'
import { cssVar } from '../theme'
import { useLayerStatus } from './useLayerStatus'
import { useEnvelope } from './useStaticLayer'
import { distanceKm } from './trails'
import { DetailHeader, ExternalLink, Facts, Gone, Lead, Section } from '../ui/Detail'
import styles from './reports.module.css'

export type AirCategory = 'good' | 'moderate' | 'unhealthy' | 'very_unhealthy' | 'hazardous'

export interface AirStation {
  id: string
  city: string
  province: string
  address: string
  time: number
  ispu: number
  category: AirCategory
  lat: number
  lon: number
}

export const airCategories: Record<AirCategory, { en: string; id: string; color: string; advice: string }> = {
  good: { en: 'Good', id: 'Baik', color: '--lvl-1', advice: 'Air is clean. Outdoor activity is fine for everyone.' },
  moderate: { en: 'Moderate', id: 'Sedang', color: '--c-reports', advice: 'Air is acceptable. People sensitive to smoke may want to cut long outdoor exertion.' },
  unhealthy: { en: 'Unhealthy', id: 'Tidak Sehat', color: '--lvl-2', advice: 'Cut long or heavy outdoor activity. Children, older people and people with asthma or heart disease should stay inside more.' },
  very_unhealthy: { en: 'Very unhealthy', id: 'Sangat Tidak Sehat', color: '--lvl-4', advice: 'Avoid outdoor activity. Wear an N95 or KF94 mask if you must go out and keep windows closed.' },
  hazardous: { en: 'Hazardous', id: 'Berbahaya', color: '--ink', advice: 'Stay indoors with windows shut and an air purifier if you have one. Follow local health office and BPBD advice.' },
}

export function useAir(enabled = true) {
  return useEnvelope<AirStation[]>({ key: 'air', path: '/api/air', enabled, staleMs: 15 * 60_000, pollMs: 15 * 60_000 })
}

function AirLayer() {
  const on = useLayerOn('air')
  const query = useAir(on)
  const palette = usePalette()
  const items = query.data?.items

  const data = useMemo<FeatureCollection | undefined>(
    () =>
      items && {
        type: 'FeatureCollection',
        features: items.map((s) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
          properties: {
            id: s.id,
            cat: s.category,
            ispu: s.ispu,
            title: `${s.city}, ISPU ${s.ispu} ${airCategories[s.category].en.toLowerCase()}`,
          },
        })),
      },
    [items],
  )

  const specs = useMemo(() => {
    const color = ['match', ['get', 'cat'], ...Object.entries(airCategories).flatMap(([k, v]) => [k, cssVar(v.color)]), cssVar('--muted')]
    return [
      {
        id: 'air-dot',
        type: 'circle' as const,
        layout: { 'circle-sort-key': ['get', 'ispu'] },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 6, 9, 13],
          'circle-color': color,
          'circle-opacity': 0.9,
          'circle-stroke-color': palette.halo,
          'circle-stroke-width': 1.5,
        },
      },
      {
        id: 'air-value',
        type: 'symbol' as const,
        minzoom: 6,
        layout: {
          'text-field': ['to-string', ['get', 'ispu']],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': color, 'text-halo-color': palette.halo, 'text-halo-width': 1.5 },
      },
    ]
  }, [palette])

  useMapLayer({
    owner: 'air',
    sourceId: 'air',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    layers: specs as never,
    data,
    visible: on,
    interactive: ['air-dot'],
  })

  const bad = items?.filter((s) => s.ispu > 100).length
  useLayerStatus('air', on, query, { count: items?.length, note: bad ? `stations, ${bad} unhealthy or worse` : 'stations', staleAfterMs: 3 * 3600_000 })
  return null
}

function AirDetail({ id }: { id: string }) {
  const { data } = useAir()
  const s = data?.items.find((i) => i.id === id)
  if (!s) return <Gone layer="air" loading={!data} />
  const cat = airCategories[s.category]
  const here: [number, number] = [s.lon, s.lat]
  const near = data!.items
    .filter((o) => o.id !== s.id)
    .map((o) => ({ o, km: distanceKm([o.lon, o.lat], here) }))
    .sort((a, b) => a.km - b.km)[0]

  return (
    <>
      <DetailHeader layer="air" title={s.city} subtitle={`${formatWib(s.time)}, ${formatAgo(s.time)}`} />
      <Lead value={s.ispu} unit="ISPU" label={`${cat.en}, ${cat.id}`} />
      <p className={styles.text}>{cat.advice}</p>
      <Facts
        rows={[
          ['Station', s.address],
          ['Province', s.province],
          ['Nearest other station', near ? `${near.o.city}, ISPU ${near.o.ispu}, ${Math.round(near.km)} km away` : undefined],
          ['Scale', '0 to 50 good, 51 to 100 moderate, 101 to 200 unhealthy, 201 to 300 very unhealthy, above 300 hazardous'],
          ['Location', <span className="num">{formatCoord(s.lat, s.lon)}</span>],
        ]}
      />
      <Section>
        <ExternalLink href="https://sipongi.gakkum.kehutanan.go.id/peta">Open the SiPongi+ map</ExternalLink>
      </Section>
    </>
  )
}

export const airModule = { Layer: AirLayer, Detail: AirDetail }
