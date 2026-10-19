import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Map as MapLibre, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapContext, interactiveLayers } from './context'
import { applyBasemap, BASEMAP_STYLE } from './basemap'
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

function initialCamera(): { center: [number, number]; zoom: number } {
  const match = /view=([\d.]+)\/(-?[\d.]+)\/(-?[\d.]+)/.exec(location.hash)
  if (match) {
    const [zoom, lat, lon] = match.slice(1).map(Number)
    if ([zoom, lat, lon].every(Number.isFinite)) return { center: [lon, lat], zoom }
  }
  return { center: [118, -2.5], zoom: 4.2 }
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
      style: BASEMAP_STYLE,
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
      applyBasemap(instance, basemapPalettes[useStore.getState().theme])
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
          return
        }
      }
      if (enabled.includes('weather')) select({ kind: 'point', lat: e.lngLat.lat, lon: e.lngLat.lng })
      else select(null)
    })

    return () => {
      setMap(null)
      instance.remove()
    }
  }, [])

  useEffect(() => {
    if (!map) return
    applyBasemap(map, basemapPalettes[theme])
    map.setPaintProperty('selection-ring', 'circle-stroke-color', cssVar('--ink'))
  }, [map, theme])

  const hasSelection = useStore((s) => s.selection?.kind === 'item')
  useEffect(() => {
    if (!map || hasSelection) return
    ;(map.getSource('selection') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] })
  }, [map, hasSelection])

  useEffect(() => {
    if (!map || !flyTo) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    map.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: flyTo.zoom ?? Math.max(map.getZoom(), 7), animate: !reduce, duration: 900 })
  }, [map, flyTo])

  return (
    <div className={styles.wrap}>
      <div ref={container} className={styles.map} role="region" aria-label="Map of Indonesia" />
      {!map && <div className={styles.loading} aria-live="polite">Loading map</div>}
      <MapContext.Provider value={map}>
        {children}
        {map && <MapControls map={map} />}
      </MapContext.Provider>
      {tooltip && <MapTooltip {...tooltip} />}
    </div>
  )
}
