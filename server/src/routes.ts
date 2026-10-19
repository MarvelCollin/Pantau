import type { Hono } from 'hono'
import { serve } from './lib/respond.js'
import { loadQuakes } from './sources/quakes.js'

export function registerRoutes(app: Hono) {
  app.get('/quakes', (c) => serve(c, 'quakes', { ttl: 60, swr: 120, sie: 3600 }, loadQuakes))
}
