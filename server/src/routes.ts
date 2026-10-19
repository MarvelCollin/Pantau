import type { Hono } from 'hono'
import { z } from 'zod'
import { serve } from './lib/respond.js'
import { loadQuakes } from './sources/quakes.js'
import { loadFlights, snapCell } from './sources/flights.js'

const cellQuery = z.object({
  lat: z.coerce.number().min(-85).max(85),
  lon: z.coerce.number().min(-180).max(180),
})

export function registerRoutes(app: Hono) {
  app.get('/quakes', (c) => serve(c, 'quakes', { ttl: 60, swr: 120, sie: 3600 }, loadQuakes))

  app.get('/flights', (c) => {
    const parsed = cellQuery.safeParse(c.req.query())
    if (!parsed.success) return c.json({ error: 'invalid_query' }, 400)
    const { lat, lon } = parsed.data
    if (snapCell(lat) !== lat || snapCell(lon) !== lon) return c.json({ error: 'cell_not_snapped' }, 400)
    return serve(c, `flights:${lat}:${lon}`, { ttl: 10, swr: 20, sie: 120 }, () => loadFlights(lat, lon))
  })
}
