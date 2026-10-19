import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

let lastPath = ''

function onePerPage(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url)
  if (event.type === 'pageview') {
    if (url.pathname === lastPath) return null
    lastPath = url.pathname
  }
  return { ...event, url: `${url.origin}${url.pathname}` }
}

export function Telemetry() {
  return (
    <>
      <Analytics beforeSend={onePerPage} />
      <SpeedInsights sampleRate={0.5} />
    </>
  )
}
