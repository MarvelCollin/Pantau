import { useMemo } from 'react'
import type { FeatureCollection } from 'geojson'
import { formatCoord } from '../lib/format'
import { useLayerOn } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { usePalette } from '../map/usePalette'
import { cssVar } from '../theme'
import { useLayerStatus } from './useLayerStatus'
import { useEnvelope } from './useStaticLayer'
import { distanceKm } from './trails'
import { DetailHeader, ExternalLink, Facts, Gone, Lead, Section } from '../ui/Detail'
import styles from './reports.module.css'

export interface CrewPost {
  id: string
  name: string
  unit: string
  lat: number
  lon: number
}

export interface CrewReport {
  id: string
  kind: 'suppression' | 'groundcheck'
  unit: string
  date: string
  place: string
  note?: string
  burnedHa?: number
  extinguishedHa?: number
  team?: string
  hotspotDate?: string
  satellite?: string
  lat: number
  lon: number
}

export interface FireCrews {
  posts: CrewPost[]
  reports: CrewReport[]
}

const kindNames = { suppression: 'Firefighting', groundcheck: 'Ground check' }

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function formatDay(date: string) {
  return day.format(new Date(`${date}T00:00:00Z`))
}

function hectares(value: number) {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ha`
}

export function useFireCrews(enabled = true) {
  return useEnvelope<FireCrews>({ key: 'firecrews', path: '/api/karhutla/crews', enabled, staleMs: 30 * 60_000, pollMs: 30 * 60_000 })
}

function FireCrewsLayer() {
  const on = useLayerOn('firecrews')
  const query = useFireCrews(on)
  const palette = usePalette()
  const payload = query.data?.items

  const data = useMemo<FeatureCollection | undefined>(
    () =>
      payload && {
        type: 'FeatureCollection',
        features: [
          ...payload.posts.map((p) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
            properties: { id: `post:${p.id}`, kind: 'post', title: `${p.name}, Manggala Agni post of ${p.unit}` },
          })),
          ...payload.reports.map((r) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [r.lon, r.lat] },
            properties: { id: r.id, kind: r.kind, title: `${kindNames[r.kind]} by ${r.unit}, ${formatDay(r.date)}` },
          })),
        ],
      },
    [payload],
  )

  const specs = useMemo(() => {
    const color = cssVar('--c-firecrews')
    return [
      {
        id: 'firecrews-post',
        type: 'circle' as const,
        filter: ['==', ['get', 'kind'], 'post'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 10, 8],
          'circle-color': palette.halo,
          'circle-stroke-color': color,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 2, 10, 3],
        },
      },
      {
        id: 'firecrews-report',
        type: 'circle' as const,
        filter: ['!=', ['get', 'kind'], 'post'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, ['match', ['get', 'kind'], 'suppression', 3.5, 2.5], 10, ['match', ['get', 'kind'], 'suppression', 8, 6]],
          'circle-color': ['match', ['get', 'kind'], 'suppression', color, cssVar('--muted')],
          'circle-stroke-color': palette.halo,
          'circle-stroke-width': 1.5,
        },
      },
    ]
  }, [palette])

  useMapLayer({
    owner: 'firecrews',
    sourceId: 'firecrews',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    layers: specs as never,
    data,
    visible: on,
    interactive: ['firecrews-post', 'firecrews-report'],
  })

  useLayerStatus('firecrews', on, query, {
    count: payload?.reports.length,
    note: `reports in 30 days, ${payload?.posts.length ?? 0} posts`,
    staleAfterMs: 4 * 3600_000,
  })
  return null
}

function PostDetail({ post, reports }: { post: CrewPost; reports: CrewReport[] }) {
  const here: [number, number] = [post.lon, post.lat]
  const nearby = reports.filter((r) => distanceKm([r.lon, r.lat], here) <= 50)
  const fromUnit = reports.filter((r) => r.unit === post.unit)
  const latest = fromUnit[0]

  return (
    <>
      <DetailHeader layer="firecrews" title={post.name} subtitle={`Manggala Agni field post, ${post.unit}`} />
      <Lead value={nearby.length} unit="reports" label="within 50 km in the past 30 days" />
      <Facts
        rows={[
          ['Operations area', post.unit],
          ['Reports from this area', `${fromUnit.length} in 30 days`],
          ['Latest report', latest ? `${kindNames[latest.kind]} on ${formatDay(latest.date)}, ${latest.place}` : undefined],
          ['Location', <span className="num">{formatCoord(post.lat, post.lon)}</span>],
        ]}
      />
      <Section>
        <ExternalLink href="https://sipongi.gakkum.kehutanan.go.id/hard-manggala-agni">About Manggala Agni</ExternalLink>
      </Section>
    </>
  )
}

function ReportDetail({ report: r }: { report: CrewReport }) {
  return (
    <>
      <DetailHeader layer="firecrews" kind={kindNames[r.kind]} title={r.place} subtitle={`${formatDay(r.date)}, ${r.unit}`} />
      {r.extinguishedHa !== undefined && (
        <Lead value={hectares(r.extinguishedHa)} label={r.burnedHa !== undefined ? `put out, of ${hectares(r.burnedHa)} burned` : 'put out'} />
      )}
      {r.note && (
        <p className={styles.text} lang="id">
          {r.note}
        </p>
      )}
      <Facts
        rows={[
          ['Burned area', r.extinguishedHa === undefined && r.burnedHa !== undefined ? hectares(r.burnedHa) : undefined],
          ['Team', r.team],
          ['Hotspot seen on', r.hotspotDate ? formatDay(r.hotspotDate) : undefined],
          ['Hotspot satellite', r.satellite],
          ['Reported by', `Manggala Agni, ${r.unit}`],
          ['Location', <span className="num">{formatCoord(r.lat, r.lon)}</span>],
        ]}
      />
      <Section>
        <ExternalLink href="https://sipongi.gakkum.kehutanan.go.id/peta">Open the SiPongi+ map</ExternalLink>
      </Section>
    </>
  )
}

function FireCrewDetail({ id }: { id: string }) {
  const { data } = useFireCrews()
  const payload = data?.items
  if (!payload) return <Gone layer="firecrews" loading />
  if (id.startsWith('post:')) {
    const post = payload.posts.find((p) => `post:${p.id}` === id)
    return post ? <PostDetail post={post} reports={payload.reports} /> : <Gone layer="firecrews" />
  }
  const report = payload.reports.find((r) => r.id === id)
  return report ? <ReportDetail report={report} /> : <Gone layer="firecrews" />
}

export const fireCrewsModule = { Layer: FireCrewsLayer, Detail: FireCrewDetail }
