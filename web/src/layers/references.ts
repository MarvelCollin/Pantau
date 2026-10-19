import type { LayerId } from './registry'

export interface Reference {
  name: string
  what: string
  url: string
}

export const references: Record<LayerId | 'point' | 'basemap', Reference[]> = {
  flights: [
    { name: 'adsb.lol', what: 'Live aircraft positions', url: 'https://api.adsb.lol/docs' },
    { name: 'adsb.fi', what: 'Backup aircraft positions', url: 'https://github.com/adsbfi/opendata' },
    { name: 'VRS standing data', what: 'Routes and airports', url: 'https://github.com/vradarserver/standing-data' },
    { name: 'adsbdb', what: 'Routes not in the standing data', url: 'https://www.adsbdb.com' },
    { name: 'Planespotters', what: 'Aircraft photos', url: 'https://www.planespotters.net/photo/api' },
  ],
  ships: [{ name: 'aisstream.io', what: 'Live AIS ship positions', url: 'https://aisstream.io/documentation' }],
  satellites: [
    { name: 'CelesTrak', what: 'Orbital elements', url: 'https://celestrak.org/NORAD/documentation/gp-data-formats.php' },
    { name: 'satellite.js', what: 'Orbit calculation in your browser', url: 'https://github.com/shashwatak/satellite-js' },
  ],
  quakes: [
    { name: 'BMKG', what: 'Indonesian earthquakes and shake maps', url: 'https://data.bmkg.go.id/gempabumi/' },
    { name: 'USGS', what: 'Worldwide earthquakes', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php' },
  ],
  volcanoes: [{ name: 'MAGMA Indonesia, ESDM', what: 'Alert levels and observation reports', url: 'https://magma.esdm.go.id' }],
  fires: [{ name: 'NASA FIRMS', what: 'VIIRS hotspots, past 24 hours', url: 'https://firms.modaps.eosdis.nasa.gov/active_fire/' }],
  reports: [{ name: 'PetaBencana', what: 'Citizen disaster reports', url: 'https://docs.petabencana.id' }],
  weather: [{ name: 'RainViewer', what: 'Rain radar tiles', url: 'https://www.rainviewer.com/api.html' }],
  cameras: [
    { name: 'Jogja City ATCS', what: 'Yogyakarta city cameras', url: 'https://cctv.jogjakota.go.id' },
    { name: 'Bina Marga, PUPR', what: 'National road cameras', url: 'https://binamarga.pu.go.id' },
    { name: 'LTA via data.gov.sg', what: 'Singapore traffic snapshots', url: 'https://data.gov.sg/datasets/d_6cdb6b405b25aaaacbaf7689bcc6fae0/view' },
  ],
  point: [
    { name: 'Open-Meteo', what: 'Weather and forecast', url: 'https://open-meteo.com/en/docs' },
    { name: 'Open-Meteo Air Quality', what: 'Air quality', url: 'https://open-meteo.com/en/docs/air-quality-api' },
    { name: 'BigDataCloud', what: 'Place names', url: 'https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api' },
  ],
  basemap: [
    { name: 'OpenFreeMap', what: 'Map tiles', url: 'https://openfreemap.org' },
    { name: 'OpenStreetMap contributors', what: 'Map data', url: 'https://www.openstreetmap.org/copyright' },
    { name: 'Natural Earth', what: 'Overview coastlines', url: 'https://www.naturalearthdata.com' },
  ],
}
