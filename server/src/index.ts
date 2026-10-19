import { serve } from '@hono/node-server'
import app from './app.js'

const port = Number(process.env.PORT ?? 8787)

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`pantau api on http://localhost:${info.port}`)
})

function shutdown() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
