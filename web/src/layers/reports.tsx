import { useMemo } from 'react'
import type { FeatureCollection } from 'geojson'
import { formatAgo, formatCoord, formatWib } from '../lib/format'
import { useLayerOn } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { usePalette } from '../map/usePalette'
import { useLayerStatus } from './useLayerStatus'
import { useEnvelope } from './useStaticLayer'
import { DetailHeader, ExternalLink, Facts, Gone, Section } from '../ui/Detail'
import styles from './reports.module.css'

export interface Report {
  id: string
  type: string
  lat: number
  lon: number
  time: number
  text?: string
  image?: string
  city?: string
  floodDepthCm?: number
  link: string
}

const typeNames: Record<string, string> = {
  flood: 'Flood',
  fire: 'Forest or land fire',
  haze: 'Haze',
  volcano: 'Volcanic activity',
  earthquake: 'Earthquake',
  wind: 'Strong wind',
}

const typeIcons: Record<string, string> = { flood: 'drop', haze: 'drop', fire: 'diamond', volcano: 'triangle', earthquake: 'diamond', wind: 'diamond' }

export function useReports(enabled = true) {
  return useEnvelope<Report[]>({ key: 'reports', path: '/api/reports', enabled, staleMs: 2 * 60_000, pollMs: 3 * 60_000 })
}

function ReportsLayer() {
  const on = useLayerOn('reports')
  const query = useReports(on)
  const palette = usePalette()
  const color = palette.color('reports')
  const items = query.data?.items

  const data = useMemo<FeatureCollection | undefined>(
    () =>
      items && {
        type: 'FeatureCollection',
        features: items.map((r) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
          properties: {
            id: r.id,
            icon: typeIcons[r.type] ?? 'drop',
            title: `${typeNames[r.type] ?? r.type} report${r.city ? `, ${r.city}` : ''}`,
          },
        })),
      },
    [items],
  )

  const specs = useMemo(
    () => [
      {
        id: 'reports-icon',
        type: 'symbol' as const,
        layout: { 'icon-image': ['get', 'icon'], 'icon-size': 0.45, 'icon-allow-overlap': true },
        paint: { 'icon-color': color, 'icon-halo-color': palette.halo, 'icon-halo-width': 1.5 },
      },
    ],
    [color, palette.halo],
  )

  useMapLayer({
    owner: 'reports',
    sourceId: 'reports',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    layers: specs as never,
    data,
    visible: on,
    interactive: ['reports-icon'],
  })

  useLayerStatus('reports', on, query, { count: items?.length, note: 'in 3 days', staleAfterMs: 15 * 60_000 })
  return null
}

function ReportDetail({ id }: { id: string }) {
  const { data } = useReports()
  const r = data?.items.find((i) => i.id === id)
  if (!r) return <Gone layer="reports" />

  return (
    <>
      <DetailHeader layer="reports" title={typeNames[r.type] ?? r.type} subtitle={`${formatWib(r.time)}, ${formatAgo(r.time)}`} />
      {r.image && <img className={styles.photo} src={r.image} alt={`Photo sent with the ${typeNames[r.type] ?? r.type} report`} width={640} height={480} loading="lazy" />}
      {r.text && <p className={styles.text}>{r.text}</p>}
      <Facts
        rows={[
          ['Flood depth', r.floodDepthCm !== undefined ? <span className="num">{r.floodDepthCm} cm</span> : undefined],
          ['Area', r.city],
          ['Location', <span className="num">{formatCoord(r.lat, r.lon)}</span>],
          ['Sent through', 'PetaBencana, checked by its team'],
        ]}
      />
      <Section>
        <ExternalLink href={r.link}>Report on PetaBencana</ExternalLink>
      </Section>
    </>
  )
}

export const reportsModule = { Layer: ReportsLayer, Detail: ReportDetail }
