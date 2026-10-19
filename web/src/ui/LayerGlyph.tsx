import { AirplaneTilt, Boat, Planet, Pulse, Mountains, Fire, FireSimple, FireTruck, Drop, CloudRain, VideoCamera, Wind } from '@phosphor-icons/react'
import type { LayerId } from '../layers/registry'

const glyphs = {
  flights: AirplaneTilt,
  ships: Boat,
  satellites: Planet,
  quakes: Pulse,
  volcanoes: Mountains,
  fires: Fire,
  karhutla: FireSimple,
  firecrews: FireTruck,
  reports: Drop,
  weather: CloudRain,
  air: Wind,
  cameras: VideoCamera,
} satisfies Record<LayerId, unknown>

export function LayerGlyph({ id, size = 18 }: { id: LayerId; size?: number }) {
  const Icon = glyphs[id]
  return <Icon size={size} weight="bold" color={`var(--c-${id})`} aria-hidden="true" />
}
