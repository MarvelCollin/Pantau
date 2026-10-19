Pantau research notes

Checked on 19 October 2026 from an Indonesian connection. Every source below is free. Some need a free key, and that is noted where it applies.

Similar projects

World Monitor (github.com/koala73/worldmonitor) is the biggest one. It mixes news feeds, military flights, ships, fires, earthquakes and markets on one map. AGPL licence.
OSIRIS (github.com/simplifaisoul/osiris) puts flights, satellites, cameras, quakes and weather on a 3D globe. Its camera layer is polled JPEG snapshots, not video.
God's Eye View (github.com/bilawalsidhu/gods-eye-view) has the most useful DATA_SOURCES.md file for keyless camera endpoints around the world.
eyevinovasi (github.com/chairulm/eyevinovasi) and RivaelManurung/cctv are the only projects found that collect Indonesian public CCTV. They scrape Medan Dishub, Jogja city and Bina Marga.

Flights

adsb.lol works with no key. The endpoint is https://api.adsb.lol/v2/point/{lat}/{lon}/{radius_nm} and the radius tops out at 250 nautical miles. There is also /v2/mil for military aircraft worldwide. Fields follow readsb: hex, flight, r for registration, t for type, alt_baro in feet (can be the string "ground"), gs in knots, track in degrees. It does not send a CORS header, so the browser has to go through our server.
adsb.fi is the backup with the same field names at https://opendata.adsb.fi/api/v2/lat/{lat}/lon/{lon}/dist/{nm}.
OpenSky answers anonymously with a bounding box but only allows around 400 requests a day, and CORS is locked to its own site.
airplanes.live returns 403 and asks for an email before giving access, so it is not used.

Ships

aisstream.io streams AIS over a WebSocket at wss://stream.aisstream.io/v0/stream. The key is free after signing in with GitHub. The subscription message must arrive within 3 seconds and holds the key, bounding boxes and optional message type filters. Browser connections are known to be unreliable, and the key would leak anyway, so the server keeps one socket open and stores the latest position per ship.

Cameras

Bina Marga (Ministry of Public Works) publishes 80 national road cameras with coordinates through an ArcGIS FeatureServer at https://gisportal.binamarga.pu.go.id/arcgis/rest/services/Hosted/cctv_jalnas_20260408/FeatureServer/0/query. There are three kinds. The "its" ones point to a page that holds an HLS playlist on port 8989. The "apace" ones point to a page that embeds a YouTube live stream. The "ch" ones are HLS behind apps.ptbtu.com:8078, which did not answer during testing.
Singapore LTA gives about 90 traffic snapshots with coordinates at https://api.data.gov.sg/v1/transport/traffic-images. No key, CORS open, images refresh every minute.
MAGMA (the volcano agency) has a page of volcano cameras at magma.esdm.go.id/v1/gunung-api/cctv. The links are signed and expire.
Jakarta Dishub, Jasa Marga toll cameras and Bali Tower have no documented public API. They would need scraping and could break any time.
Windy Webcams v3 needs a free key and its image links expire after 10 to 15 minutes on the free tier.
Private cameras found through Shodan or Insecam are left out on purpose. Showing them breaks UU ITE and UU PDP.

Earthquakes

BMKG is the main source for Indonesia. https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json holds the latest event, gempaterkini.json the last 15 events of M5 and above, gempadirasakan.json the last 15 felt events. The limit is 60 requests per minute per IP. Coordinates arrive as a "lat,lon" string. BMKG returned 403 for a fake browser user agent and 200 for a plain one.
USGS has static GeoJSON feeds such as https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson. No key, CORS open. Coordinates are lon, lat, depth.

Volcanoes

The MAGMA home page at https://magma.esdm.go.id/ embeds a JavaScript array called markersGunungApi with all 69 monitored volcanoes, their coordinates, elevation and alert level from 1 (Normal) to 4 (Awas). There is no JSON endpoint for the list, so the server reads it out of the page.

Fires

NASA FIRMS serves a 24 hour VIIRS hotspot CSV for Southeast Asia with no key at https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv. It is about 1 MB and has no CORS header. The area API needs a free map key.

Floods and crowd reports

PetaBencana at https://data.petabencana.id/reports?geoformat=geojson returns recent citizen reports of floods, fires, haze, quakes, wind and volcanic activity with photos. No key.

Weather

RainViewer radar tiles come from https://api.rainviewer.com/public/weather-maps.json. No key, about 2 hours of past frames, max zoom 7 since January 2026, 100 requests per minute per IP, credit required.
Open-Meteo gives current weather and forecasts with no key for non commercial use. Its air quality API sits on a separate host.
BMKG forecasts go down to village level at https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={code}, but need the village code.

Space

CelesTrak serves orbital elements as JSON at https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=json. Fair use asks for one download per group every two hours, so it is cached for six hours. Positions are worked out in the browser with satellite.js.
NASA GIBS has daily satellite imagery tiles with no key.

Other things that work but are not built yet

GDACS and NASA EONET for global disasters, WAQI air quality with a free token, Blitzortung lightning (strict terms), GDELT news (rate limited, returned 429), Cloudflare Radar internet outages (free token), CoinGecko and Frankfurter for prices and exchange rates.

What this means for the build

A small server is required. It hides keys, gets around missing CORS headers and caches everything, so many visitors cost the same as one. Each source gets its own cache time that matches how often it really changes. Flights refresh every 10 seconds, quakes every minute, fires every 30 minutes, the camera list once a day and satellite elements every 6 hours. Stale data is served while a fresh copy loads, and the last good copy stays on disk so a source outage does not blank the map.
