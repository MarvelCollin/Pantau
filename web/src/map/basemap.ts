import type { Map as MapLibre } from 'maplibre-gl'
import type { BasemapPalette } from '../theme'

export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

type Rule = [RegExp, (p: BasemapPalette) => Record<string, unknown>]

const rules: Rule[] = [
  [/^background$/, (p) => ({ 'background-color': p.land })],
  [/^water$/, (p) => ({ 'fill-color': p.water })],
  [/^waterway/, (p) => ({ 'line-color': p.water })],
  [/^(park|landcover_wood)$/, (p) => ({ 'fill-color': p.park })],
  [/^landcover_(ice_shelf|glacier)$/, (p) => ({ 'fill-color': p.land })],
  [/^landuse_residential$/, (p) => ({ 'fill-color': p.built })],
  [/^building$/, (p) => ({ 'fill-color': p.built, 'fill-outline-color': p.roadCase })],
  [/^(road_area_pier)$/, (p) => ({ 'fill-color': p.land })],
  [/^(road_pier)$/, (p) => ({ 'line-color': p.land })],
  [/^aeroway-area$/, (p) => ({ 'fill-color': p.built })],
  [/casing$/, (p) => ({ 'line-color': p.roadCase })],
  [/subtle$/, (p) => ({ 'line-color': p.roadCase })],
  [/(inner|minor|path|runway|taxiway)$/, (p) => ({ 'line-color': p.road })],
  [/^railway.*dashline$/, (p) => ({ 'line-color': p.land })],
  [/^railway/, (p) => ({ 'line-color': p.roadCase })],
  [/^boundary/, (p) => ({ 'line-color': p.boundary })],
]

const symbolRules: Rule[] = [
  [/^water_name/, (p) => ({ 'text-color': p.waterLabel, 'text-halo-color': p.halo })],
  [/^(waterway_line_label|highway-name|airport)/, (p) => ({ 'text-color': p.labelMuted, 'text-halo-color': p.halo })],
  [/^label_/, (p) => ({ 'text-color': p.label, 'text-halo-color': p.halo })],
]

export function applyBasemap(map: MapLibre, palette: BasemapPalette) {
  const style = map.getStyle()
  for (const layer of style.layers) {
    if (typeof layer.metadata === 'object' && layer.metadata && 'pantau' in layer.metadata) continue
    if (layer.type === 'raster') {
      map.setPaintProperty(layer.id, 'raster-opacity', palette.shade)
      continue
    }
    const list = layer.type === 'symbol' ? symbolRules : rules
    const rule = list.find(([pattern]) => pattern.test(layer.id))
    if (!rule) continue
    for (const [key, value] of Object.entries(rule[1](palette))) {
      try {
        map.setPaintProperty(layer.id, key as never, value as never)
      } catch {
        continue
      }
    }
  }
}

export function firstLabelLayer(map: MapLibre): string | undefined {
  return map.getStyle().layers.find((l) => l.type === 'symbol')?.id
}
