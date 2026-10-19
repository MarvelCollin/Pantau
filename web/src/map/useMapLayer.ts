import { useEffect, useRef } from 'react'
import { useStore } from '../state/store'
import type { GeoJSONSource, LayerSpecification, SourceSpecification } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { useMap, interactiveLayers, firstLabelLayer } from './context'
import type { LayerId } from '../layers/registry'

type DataLayer = Exclude<LayerSpecification, { type: 'background' }>
type LayerSpec = Omit<DataLayer, 'source'>

interface Options {
  owner: LayerId
  sourceId: string
  source: SourceSpecification
  layers: LayerSpec[]
  data?: FeatureCollection
  visible: boolean
  interactive?: string[]
  belowLabels?: boolean
}

export const emptyCollection: FeatureCollection = { type: 'FeatureCollection', features: [] }

export function useMapLayer({ owner, sourceId, source, layers, data, visible, interactive = [], belowLabels }: Options) {
  const map = useMap()
  const sourceRef = useRef(source)
  const layersRef = useRef(layers)
  layersRef.current = layers

  useEffect(() => {
    if (!map) return
    if (!map.getSource(sourceId)) map.addSource(sourceId, sourceRef.current)
    const before = belowLabels ? firstLabelLayer(map) : undefined
    for (const layer of layersRef.current) {
      if (map.getLayer(layer.id)) continue
      map.addLayer({ ...layer, source: sourceId, metadata: { pantau: owner } } as LayerSpecification, before)
    }
    if (map.getLayer('selection-ring')) map.moveLayer('selection-ring')
    for (const id of interactive) interactiveLayers.set(id, owner)
    return () => {
      for (const id of interactive) interactiveLayers.delete(id)
      for (const layer of layersRef.current) if (map.getLayer(layer.id)) map.removeLayer(layer.id)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    }
  }, [map, sourceId, owner, belowLabels, interactive.join(',')])

  useEffect(() => {
    if (!map || !data) return
    const src = map.getSource(sourceId) as GeoJSONSource | undefined
    src?.setData(data)
  }, [map, sourceId, data])

  const selectedId = useStore((s) => (s.selection?.kind === 'item' && s.selection.layer === owner ? s.selection.id : null))

  useEffect(() => {
    if (!map || !selectedId || !data) return
    const feature = data.features.find((f) => String(f.properties?.id) === selectedId)
    const ring = map.getSource('selection') as GeoJSONSource | undefined
    ring?.setData({ type: 'FeatureCollection', features: feature ? [{ ...feature, properties: {} }] : [] })
  }, [map, selectedId, data])

  useEffect(() => {
    if (!map) return
    for (const layer of layersRef.current) {
      if (map.getLayer(layer.id)) map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none')
    }
  }, [map, visible])

  useEffect(() => {
    if (!map) return
    for (const layer of layers) {
      if (!map.getLayer(layer.id) || !('paint' in layer) || !layer.paint) continue
      for (const [key, value] of Object.entries(layer.paint)) {
        map.setPaintProperty(layer.id, key as never, value as never)
      }
    }
  }, [map, layers])
}
