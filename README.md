# Pantau

A live map of Indonesia built from free public data: flights, ships, satellites, earthquakes, volcano alert levels, fire hotspots, citizen flood reports, rain radar, local weather and public road cameras.

Notes on every data source, with limits and quirks, are in [research.md](research.md).

## Live at https://marvelcollin.com/pantau/



Needs Node 22.

```bash
npm install
cp .env.example .env
npm run dev
```

The web app runs on http://localhost:5173 and the API on http://localhost:8787. Vite forwards `/api` to the API.

Ships need a free key from [aisstream.io](https://aisstream.io) (sign in with GitHub, then create a key). Put it in `.env` as `AISSTREAM_KEY`. Every other layer works without a key.

## Deploy to Vercel (free Hobby plan)

1. Import the GitHub repo in Vercel. Leave the framework as "Other". `vercel.json` already sets the build command, output folder, function and region.
2. Optional: add `AISSTREAM_KEY` under Project Settings, Environment Variables.
3. Deploy. Every push to `main` deploys again.

The function runs in `sin1` (Singapore), the closest region to Indonesia and to most of the upstream sources.

## How it is put together

```
web/      React, TypeScript, Vite, MapLibre GL
server/   Hono API that proxies, trims and caches upstream sources
api/      Vercel entry that loads the built server
```

Sources that allow browser calls (RainViewer, Open-Meteo, CelesTrak, BigDataCloud) are called straight from the browser. That costs nothing on Vercel and spreads the rate limits across visitors. Everything else goes through `/api`, because it either blocks browser calls, needs a hidden key, needs scraping, or is too big to send as is.

Video never passes through the server. The server only finds the stream address, and the browser plays it directly.

## Caching

There are four layers of cache.

1. Vercel CDN. Every API response sends `s-maxage`, `stale-while-revalidate` and `stale-if-error`, so most visitors are served from the edge without running the function.
2. Function memory. Each warm instance keeps results, serves stale data while it refreshes in the background, merges identical requests that arrive together, and falls back to the last good copy when a source is down.
3. Browser HTTP cache through `max-age`, plus ETags on every response.
4. IndexedDB. Slow changing data (volcanoes, fires, cameras, earthquakes, satellite orbits, place names) is saved in the browser, so a returning visitor sees the map at once.

| Endpoint | Fresh for | Served stale for | Kept on errors |
|---|---|---|---|
| `/api/flights` | 10 s | 20 s | 2 min |
| `/api/quakes` | 1 min | 2 min | 1 h |
| `/api/ships` | 1 min | 4 min | 30 min |
| `/api/cameras` | 1 min | 2 min | 1 day |
| `/api/reports` | 2 min | 5 min | 1 h |
| `/api/fires` | 30 min | 1 h | 1 day |
| `/api/volcanoes` | 30 min | 1 h | 1 day |
| `/api/cameras/stream` | 6 h | 6 h | 1 day |

Flights are requested in 5 degree grid cells snapped on the server, so everyone looking at the same area shares one cached response.

## Staying inside the free tier

Hobby allows about 1 million CDN requests a month. The app only polls a layer while it is switched on and the tab is visible. Flights refresh every 15 seconds, and other layers refresh every minute or less often. If the limit is reached, Vercel pauses the project. It does not send a bill.

## Commands

```bash
npm run dev         start web and API
npm run build       build both
npm run typecheck   type check both
```
