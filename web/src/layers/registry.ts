export type LayerId =
  | 'flights'
  | 'ships'
  | 'satellites'
  | 'quakes'
  | 'volcanoes'
  | 'fires'
  | 'karhutla'
  | 'reports'
  | 'weather'
  | 'cameras'

export type LayerGroup = 'Moving' | 'Hazards' | 'Weather and cameras'

export interface LayerInfo {
  id: LayerId
  label: string
  group: LayerGroup
  hint: string
  source: string
  sourceUrl: string
}

export const layers: LayerInfo[] = [
  { id: 'flights', label: 'Flights', group: 'Moving', hint: 'Aircraft broadcasting ADS-B', source: 'adsb.lol', sourceUrl: 'https://adsb.lol' },
  { id: 'ships', label: 'Ships', group: 'Moving', hint: 'Vessels broadcasting AIS', source: 'aisstream.io', sourceUrl: 'https://aisstream.io' },
  { id: 'satellites', label: 'Satellites', group: 'Moving', hint: 'Space stations and bright satellites', source: 'CelesTrak', sourceUrl: 'https://celestrak.org' },
  { id: 'quakes', label: 'Earthquakes', group: 'Hazards', hint: 'BMKG and USGS, recent', source: 'BMKG, USGS', sourceUrl: 'https://data.bmkg.go.id/gempabumi/' },
  { id: 'volcanoes', label: 'Volcanoes', group: 'Hazards', hint: 'Alert level of 69 monitored volcanoes', source: 'MAGMA ESDM', sourceUrl: 'https://magma.esdm.go.id' },
  { id: 'fires', label: 'Fire hotspots', group: 'Hazards', hint: 'VIIRS satellite detections, past 24 hours', source: 'NASA FIRMS', sourceUrl: 'https://firms.modaps.eosdis.nasa.gov' },
  { id: 'karhutla', label: 'Karhutla', group: 'Hazards', hint: 'Forest and land fire hotspots with village names, past 24 hours', source: 'SiPongi+ Kemenhut', sourceUrl: 'https://sipongi.gakkum.kehutanan.go.id' },
  { id: 'reports', label: 'Citizen reports', group: 'Hazards', hint: 'Flood, haze and fire reports, past 3 days', source: 'PetaBencana', sourceUrl: 'https://petabencana.id' },
  { id: 'weather', label: 'Rain radar', group: 'Weather and cameras', hint: 'Radar loop over Indonesia', source: 'RainViewer, Open-Meteo', sourceUrl: 'https://www.rainviewer.com' },
  { id: 'cameras', label: 'Cameras', group: 'Weather and cameras', hint: 'Live public cameras in Yogyakarta, national roads and Singapore', source: 'Jogja City, Bina Marga, LTA', sourceUrl: 'https://binamarga.pu.go.id' },
]

export const layerIds = layers.map((l) => l.id)

export const defaultLayers: LayerId[] = ['flights', 'quakes', 'volcanoes']

export function layerInfo(id: LayerId): LayerInfo {
  return layers.find((l) => l.id === id)!
}
