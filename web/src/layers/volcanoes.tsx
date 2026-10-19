import { useMemo } from 'react'
import type { FeatureCollection } from 'geojson'
import { formatCoord, formatNumber } from '../lib/format'
import { useLayerOn } from '../state/store'
import { useMapLayer } from '../map/useMapLayer'
import { usePalette } from '../map/usePalette'
import { cssVar } from '../theme'
import { useLayerStatus } from './useLayerStatus'
import { getEnvelope } from '../lib/api'
import { useQuery } from '@tanstack/react-query'
import styles from './volcanoes.module.css'
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
  return useEnvelope<Volcano[]>({ key: 'volcanoes', path: '/api/volcanoes', enabled, staleMs: 30 * 60_000, pollMs: 30 * 60_000 })
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
    const levelColor = ['match', ['get', 'level'], 4, cssVar('--lvl-4'), 3, cssVar('--lvl-3'), 2, cssVar('--lvl-2'), cssVar('--lvl-1')]
    return [
      {
        id: 'volcanoes-icon',
        type: 'symbol' as const,
        layout: {
          'icon-image': 'triangle',
          'icon-size': ['match', ['get', 'level'], 4, 0.85, 3, 0.75, 2, 0.6, 0.48],
          'icon-allow-overlap': true,
          'symbol-sort-key': ['-', 0, ['get', 'level']],
          'text-field': ['step', ['zoom'], ['case', ['>=', ['get', 'level'], 3], ['get', 'roman'], ''], 7, ['case', ['>=', ['get', 'level'], 2], ['get', 'roman'], '']],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'icon-color': levelColor,
          'icon-opacity': 1,
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

interface VolcanoReport {
  period: string
  author?: string
  visual?: string
  photo?: string
  weather?: string
  seismic: string[]
  seismicChart?: string
  advice?: string
}

function Report({ code, name }: { code: string; name: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['volcano-report', code],
    queryFn: ({ signal }) => getEnvelope<VolcanoReport>(`/api/volcanoes/report?code=${code}`, signal),
    staleTime: 30 * 60_000,
    meta: { persist: true },
  })
  if (isPending)
    return (
      <Section>
        <span className="skeleton" style={{ width: '100%', aspectRatio: '4 / 3' }} aria-label="Loading the latest report" />
      </Section>
    )
  if (isError || !data) return null
  const r = data.items
  return (
    <Section>
      <h3 className={styles.heading}>Latest observation report</h3>
      <p className={styles.meta}>
        {r.period}
        {r.author ? `, by ${r.author}` : ''}. Written in Indonesian by MAGMA.
      </p>
      {r.photo && <img className={styles.photo} src={r.photo} alt={`Observation photo of ${name} from the MAGMA report`} width={640} height={480} loading="lazy" />}
      {r.visual && (
        <div>
          <h4 className={styles.sub}>Visual</h4>
          <p lang="id">{r.visual}</p>
        </div>
      )}
      {r.seismic.length > 0 && (
        <div>
          <h4 className={styles.sub}>Seismic activity</h4>
          <ul className={styles.list} lang="id">
            {r.seismic.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {r.weather && (
        <div>
          <h4 className={styles.sub}>Weather at the post</h4>
          <p lang="id">{r.weather}</p>
        </div>
      )}
      {r.advice && (
        <div>
          <h4 className={styles.sub}>Advice from MAGMA</h4>
          <p className={styles.advice} lang="id">
            {r.advice}
          </p>
        </div>
      )}
      {r.seismicChart && (
        <img className={styles.chart} src={r.seismicChart} alt={`Daily earthquake count chart for ${name} from MAGMA`} loading="lazy" />
      )}
    </Section>
  )
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
      <Report code={v.code} name={v.name} />
      <Section>
        <ExternalLink href={`https://magma.esdm.go.id/v1/gunung-api/cctv/${v.code}`}>Volcano cameras on MAGMA</ExternalLink>
        <ExternalLink href="https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas">All alert levels on MAGMA</ExternalLink>
      </Section>
    </>
  )
}

export const volcanoesModule = { Layer: VolcanoesLayer, Detail: VolcanoDetail }
