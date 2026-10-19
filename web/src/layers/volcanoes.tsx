import { useMemo } from 'react'
import type { FeatureCollection } from 'geojson'
import { formatCoord, formatNumber } from '../lib/format'
import { useLayerOn } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { usePalette } from '../map/usePalette'
import { cssVar } from '../theme'
import { useLayerStatus } from './useLayerStatus'
import { useEnvelope } from './useStaticLayer'
import { DetailHeader, ExternalLink, Facts, Gone, Lead, Section } from '../ui/Detail'

export interface Volcano {
  code: string
  name: string
  regency: string
  province: string
  elevationM: number
  lat: number
  lon: number
  level: 1 | 2 | 3 | 4
  vona: boolean
  erupting: boolean
  notice?: string
}

export const levelNames: Record<Volcano['level'], { id: string; en: string; roman: string }> = {
  1: { id: 'Normal', en: 'Normal', roman: 'I' },
  2: { id: 'Waspada', en: 'Advisory', roman: 'II' },
  3: { id: 'Siaga', en: 'Watch', roman: 'III' },
  4: { id: 'Awas', en: 'Warning', roman: 'IV' },
}

export function useVolcanoes(enabled = true) {
  return useEnvelope<Volcano[]>({ key: 'volcanoes', path: '/api/volcanoes', enabled, staleMs: 15 * 60_000, pollMs: 15 * 60_000 })
}

function VolcanoesLayer() {
  const on = useLayerOn('volcanoes')
  const query = useVolcanoes(on)
  const palette = usePalette()
  const items = query.data?.items

  const data = useMemo<FeatureCollection | undefined>(
    () =>
      items && {
        type: 'FeatureCollection',
        features: items.map((v) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
          properties: {
            id: v.code,
            level: v.level,
            roman: levelNames[v.level].roman,
            title: `${v.name}, level ${levelNames[v.level].roman} ${levelNames[v.level].id}`,
          },
        })),
      },
    [items],
  )

  const specs = useMemo(() => {
    const levelColor = ['match', ['get', 'level'], 4, palette.danger, 3, cssVar('--accent-strong'), 2, palette.warning, palette.color('volcanoes')]
    return [
      {
        id: 'volcanoes-icon',
        type: 'symbol' as const,
        layout: {
          'icon-image': 'triangle',
          'icon-size': ['match', ['get', 'level'], 4, 0.85, 3, 0.75, 2, 0.6, 0.48],
          'icon-allow-overlap': true,
          'symbol-sort-key': ['-', 0, ['get', 'level']],
          'text-field': ['case', ['>=', ['get', 'level'], 2], ['get', 'roman'], ''],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'icon-color': levelColor,
          'icon-opacity': ['case', ['==', ['get', 'level'], 1], 0.6, 1],
          'icon-halo-color': palette.halo,
          'icon-halo-width': 1.5,
          'text-color': levelColor,
          'text-halo-color': palette.halo,
          'text-halo-width': 1.5,
        },
      },
    ]
  }, [palette])

  useMapLayer({
    owner: 'volcanoes',
    sourceId: 'volcanoes',
    source: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    layers: specs as never,
    data,
    visible: on,
    interactive: ['volcanoes-icon'],
  })

  const alerts = items?.filter((v) => v.level >= 2).length
  useLayerStatus('volcanoes', on, query, {
    count: alerts,
    note: `above normal of ${items?.length ?? 0}`,
    staleAfterMs: 2 * 3600_000,
  })
  return null
}

function VolcanoDetail({ id }: { id: string }) {
  const { data } = useVolcanoes()
  const v = data?.items.find((i) => i.code === id)
  if (!v) return <Gone layer="volcanoes" />
  const level = levelNames[v.level]

  return (
    <>
      <DetailHeader layer="volcanoes" title={v.name} subtitle={`${v.regency}, ${v.province}`} />
      <Lead value={`Level ${level.roman}`} label={`${level.id}, meaning ${level.en.toLowerCase()} in English`} />
      {v.erupting && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>Recent eruption reported by MAGMA</p>}
      <Facts
        rows={[
          ['Elevation', <span className="num">{formatNumber(v.elevationM)} m</span>],
          ['Aviation notice', v.vona ? `VONA issued${v.notice ? `, ${v.notice}` : ''}` : 'None'],
          ['Location', <span className="num">{formatCoord(v.lat, v.lon)}</span>],
          ['Code', v.code],
        ]}
      />
      <Section>
        <ExternalLink href={`https://magma.esdm.go.id/v1/gunung-api/cctv/${v.code}`}>Volcano cameras on MAGMA</ExternalLink>
        <ExternalLink href="https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas">All alert levels on MAGMA</ExternalLink>
      </Section>
    </>
  )
}

export const volcanoesModule = { Layer: VolcanoesLayer, Detail: VolcanoDetail }
