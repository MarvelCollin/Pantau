import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Map as MapLibre, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapContext, interactiveLayers } from './context'
import { applyBasemap, buildStyle } from './basemap'
import { registerIcons } from './icons'
import { useStore } from '../state/store'
import { basemapPalettes, cssVar } from '../theme'
import { MapTooltip, type TooltipState } from '../ui/MapTooltip'
import { MapControls } from '../ui/MapControls'
import styles from './MapView.module.css'

const HIT = 10

setWorkerUrl(workerUrl)

function hitFeature(map: MapLibre, e: MapMouseEvent) {
  const ids = [...interactiveLayers.keys()].filter((id) => map.getLayer(id))
  if (ids.length === 0) return undefined
  const { x, y } = e.point
  const features = map.queryRenderedFeatures(
    [
      [x - HIT, y - HIT],
      [x + HIT, y + HIT],
    ],
    { layers: ids },
  )
  return features[0]
}

type Camera = { center: [number, number]; zoom: number } | { bounds: [[number, number], [number, number]]; fitBoundsOptions: { padding: number } }

function initialCamera(): Camera {
  const match = /view=([\d.]+)\/(-?[\d.]+)\/(-?[\d.]+)/.exec(location.hash)
  if (match) {
    const [zoom, lat, lon] = match.slice(1).map(Number)
    if ([zoom, lat, lon].every(Number.isFinite)) return { center: [lon, lat], zoom }
  }
  return { bounds: [[94.5, -11.2], [141.5, 6.3]], fitBoundsOptions: { padding: 16 } }
}

const SHEET_QUERY = '(max-width: 900px)'

function revealUnderPanel(map: MapLibre, e: MapMouseEvent) {
  const canvas = map.getCanvas()
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const sheet = matchMedia(SHEET_QUERY).matches
  const covered = sheet ? e.point.y > height * 0.3 : e.point.x > width - 420
  if (!covered) return
  const target = sheet ? { x: width / 2, y: height * 0.18 } : { x: (width - 400) / 2, y: height / 2 }
  map.panBy([e.point.x - target.x, e.point.y - target.y], { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400 })
}

function addSelectionLayer(map: MapLibre) {
  map.addSource('selection', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'selection-ring',
    type: 'circle',
    source: 'selection',
    metadata: { pantau: 'selection' },
    paint: {
      'circle-radius': 16,
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-width': 2.5,
      'circle-stroke-color': cssVar('--ink'),
    },
  })
}

export function MapPlaceholder() {
  return <div className={styles.placeholder} aria-hidden="true" />
}

export function MapView({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null)
  const camera = useRef(initialCamera())
  const [map, setMap] = useState<MapLibre | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const theme = useStore((s) => s.theme)
  const flyTo = useStore((s) => s.flyTo)

  useEffect(() => {
    if (!container.current) return
    const instance = new MapLibre({
      container: container.current,
      style: buildStyle(basemapPalettes[useStore.getState().theme]),
      ...camera.current,
      minZoom: 2,
      maxZoom: 17,
      hash: 'view',
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      fadeDuration: 0,
    })
    instance.touchZoomRotate.disableRotation()

    const publishView = () => {
      const b = instance.getBounds()
      const c = instance.getCenter()
      useStore.getState().setView({
        center: [c.lng, c.lat],
        zoom: instance.getZoom(),
        bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      })
    }

    instance.once('load', () => {
      registerIcons(instance)
      addSelectionLayer(instance)
      publishView()
      setMap(instance)
    })

    instance.on('moveend', publishView)

    instance.on('mousemove', (e: MapMouseEvent) => {
      const feature = hitFeature(instance, e)
      instance.getCanvas().style.cursor = feature ? 'pointer' : ''
      const title = feature?.properties?.title
      setTooltip(feature && title ? { x: e.point.x, y: e.point.y, text: String(title) } : null)
    })

    instance.on('mouseout', () => setTooltip(null))

    instance.on('click', (e: MapMouseEvent) => {
      const feature = hitFeature(instance, e)
      const { select, enabled } = useStore.getState()
      if (feature) {
        const owner = interactiveLayers.get(feature.layer.id)
        const id = feature.properties?.id
        if (owner && id !== undefined) {
          select({ kind: 'item', layer: owner, id: String(id) })
          revealUnderPanel(instance, e)
          return
        }
      }
      if (enabled.includes('weather')) {
        select({ kind: 'point', lat: e.lngLat.lat, lon: e.lngLat.lng })
        revealUnderPanel(instance, e)
      } else select(null)
    })

    return () => {
      setMap(null)
      instance.remove()
    }
  }, [])

  const appliedTheme = useRef(theme)
  useEffect(() => {
    if (!map) return
    if (appliedTheme.current !== theme) applyBasemap(map, basemapPalettes[theme])
    appliedTheme.current = theme
    map.setPaintProperty('selection-ring', 'circle-stroke-color', cssVar('--ink'))
  }, [map, theme])

  const selection = useStore((s) => s.selection)
  useEffect(() => {
    if (!map || selection?.kind === 'item') return
    const source = map.getSource('selection') as GeoJSONSource | undefined
    source?.setData({
      type: 'FeatureCollection',
      features:
        selection?.kind === 'point'
          ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [selection.lon, selection.lat] }, properties: {} }]
          : [],
    })
  }, [map, selection])

  useEffect(() => {
    if (!map || !flyTo) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    map.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: flyTo.zoom ?? Math.max(map.getZoom(), 7), animate: !reduce, duration: 900 })
  }, [map, flyTo])

  return (
    <div className={styles.wrap}>
      <div ref={container} className={styles.map} role="region" aria-label="Map of Indonesia" />
      {!map && <MapPlaceholder />}
      <MapContext.Provider value={map}>
        {children}
        {map && <MapControls map={map} />}
      </MapContext.Provider>
      {tooltip && <MapTooltip {...tooltip} />}
    </div>
  )
}
