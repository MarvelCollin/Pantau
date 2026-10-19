import { useMemo } from 'react'
import type { FeatureCollection } from 'geojson'
import { formatCoord } from '../lib/format'
import { useLayerOn } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { usePalette } from '../map/usePalette'
import { useLayerStatus } from './useLayerStatus'
import { useEnvelope } from './useStaticLayer'
import { DetailHeader, ExternalLink, Facts, Gone, Section } from '../ui/Detail'
import { CameraPlayer } from '../ui/CameraPlayer'

export interface Camera {
  id: string
  source: 'Bina Marga' | 'LTA Singapore'
  name: string
  area?: string
  lat: number
  lon: number
  kind: 'hls' | 'youtube' | 'image'
  online: boolean
  image?: string
  page?: string
}

export function useCameras(enabled = true) {
  return useEnvelope<Camera[]>({ key: 'cameras', path: '/api/cameras', enabled, staleMs: 60_000, pollMs: 60_000 })
}

function CamerasLayer() {
  const on = useLayerOn('cameras')
  const query = useCameras(on)
  const palette = usePalette()
  const color = palette.color('cameras')
  const items = query.data?.items

  const data = useMemo<FeatureCollection | undefined>(
    () =>
      items && {
        type: 'FeatureCollection',
        features: items.map((c) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
          properties: { id: c.id, online: c.online ? 1 : 0, title: `${c.name}${c.online ? '' : ', listed as offline'}` },
        })),
      },
    [items],
  )

  const specs = useMemo(
    () => [
      {
        id: 'cameras-icon',
        type: 'symbol' as const,
        layout: { 'icon-image': 'square', 'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 10, 0.6], 'icon-allow-overlap': true },
        paint: {
          'icon-color': color,
          'icon-opacity': ['case', ['==', ['get', 'online'], 1], 1, 0.4],
          'icon-halo-color': palette.halo,
          'icon-halo-width': 1.5,
        },
      },
    ],
    [color, palette.halo],
  )

  useMapLayer({
    owner: 'cameras',
    sourceId: 'cameras',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    layers: specs as never,
    data,
    visible: on,
    interactive: ['cameras-icon'],
  })

  const online = items?.filter((c) => c.online).length
  useLayerStatus('cameras', on, query, { count: online, note: 'online', staleAfterMs: 10 * 60_000 })
  return null
}

function CameraDetail({ id }: { id: string }) {
  const { data } = useCameras()
  const c = data?.items.find((i) => i.id === id)
  if (!c) return <Gone layer="cameras" />

  return (
    <>
      <DetailHeader layer="cameras" title={c.name} subtitle={[c.area, c.source].filter(Boolean).join(', ')} />
      <CameraPlayer id={c.id} title={c.name} image={c.image} page={c.page} />
      <Facts
        rows={[
          ['Status', c.online ? 'Listed as online' : 'Listed as offline by the operator'],
          ['Operator', c.source === 'Bina Marga' ? 'Ministry of Public Works, Bina Marga' : 'Land Transport Authority, Singapore'],
          ['Location', <span className="num">{formatCoord(c.lat, c.lon)}</span>],
        ]}
      />
      {c.page && (
        <Section>
          <ExternalLink href={c.page}>Operator page</ExternalLink>
        </Section>
      )}
    </>
  )
}

export const camerasModule = { Layer: CamerasLayer, Detail: CameraDetail }
