import type { Hono } from 'hono'
import { z } from 'zod'
import { serve } from './lib/respond.js'
import { loadQuakes } from './sources/quakes.js'
import { loadFlights, snapCell } from './sources/flights.js'
import { loadVolcanoes } from './sources/volcanoes.js'
import { loadFires } from './sources/fires.js'
import { loadReports } from './sources/reports.js'
import { loadCameras, resolveStream } from './sources/cameras.js'
import { loadShips } from './sources/ships.js'

const cellQuery = z.object({
  lat: z.coerce.number().min(-85).max(85),
  lon: z.coerce.number().min(-180).max(180),
})

export function registerRoutes(app: Hono) {
  app.get('/quakes', (c) => serve(c, 'quakes', { ttl: 60, swr: 120, sie: 3600 }, loadQuakes))

  app.get('/volcanoes', (c) => serve(c, 'volcanoes', { ttl: 1800, swr: 3600, sie: 86400 }, loadVolcanoes))

  app.get('/fires', (c) => serve(c, 'fires', { ttl: 1800, swr: 3600, sie: 86400 }, loadFires))

  app.get('/reports', (c) => serve(c, 'reports', { ttl: 120, swr: 300, sie: 3600 }, loadReports))

  app.get('/ships', (c) => {
    if (!process.env.AISSTREAM_KEY) {
      c.header('Cache-Control', 'public, max-age=300, s-maxage=300')
      return c.json({ error: 'needs_key' }, 503)
    }
    return serve(c, 'ships', { ttl: 60, swr: 240, sie: 1800 }, loadShips)
  })

  app.get('/cameras', (c) => serve(c, 'cameras', { ttl: 60, swr: 120, sie: 86400 }, loadCameras))

  app.get('/cameras/stream', (c) => {
    const id = c.req.query('id') ?? ''
    if (!/^bm-[A-Za-z0-9_-]{2,24}$/.test(id)) return c.json({ error: 'invalid_query' }, 400)
    return serve(c, `stream:${id}`, { ttl: 6 * 3600, swr: 6 * 3600, sie: 86400 }, () => resolveStream(id))
  })

  app.get('/flights', (c) => {
    const parsed = cellQuery.safeParse(c.req.query())
    if (!parsed.success) return c.json({ error: 'invalid_query' }, 400)
    const { lat, lon } = parsed.data
    if (snapCell(lat) !== lat || snapCell(lon) !== lon) return c.json({ error: 'cell_not_snapped' }, 400)
    return serve(c, `flights:${lat}:${lon}`, { ttl: 10, swr: 20, sie: 120 }, () => loadFlights(lat, lon))
  })
}
