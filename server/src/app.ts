import { Hono } from 'hono'
import { etag } from 'hono/etag'
import { registerRoutes } from './routes.js'

const api = new Hono()

api.use('*', etag())

api.get('/health', (c) => {
  c.header('Cache-Control', 'no-store')
  return c.json({ ok: true, time: Date.now() })
})

registerRoutes(api)

const app = new Hono()
app.route('/api', api)
app.route('/pantau/api', api)

app.notFound((c) => c.json({ error: 'not_found' }, 404))

app.onError((error, c) => {
  console.error(JSON.stringify({ event: 'unhandled', path: c.req.path, message: String(error) }))
  return c.json({ error: 'internal' }, 500)
})

export default app
