import { AirplaneTilt, Boat, Planet, Pulse, Mountains, Fire, Drop, CloudRain, VideoCamera } from '@phosphor-icons/react'
import type { LayerId } from '../layers/registry'

const glyphs = {
  flights: AirplaneTilt,
  ships: Boat,
  satellites: Planet,
  quakes: Pulse,
  volcanoes: Mountains,
  fires: Fire,
  reports: Drop,
  weather: CloudRain,
  cameras: VideoCamera,
} satisfies Record<LayerId, unknown>

export function LayerGlyph({ id, size = 18 }: { id: LayerId; size?: number }) {
  const Icon = glyphs[id]
  return <Icon size={size} weight="bold" color={`var(--c-${id})`} aria-hidden="true" />
}
