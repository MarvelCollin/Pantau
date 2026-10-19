import type { ReactNode } from 'react'
import type { LayerId } from '../layers/registry'
import styles from './Legend.module.css'

type Shape = 'plane' | 'ship' | 'triangle' | 'square' | 'diamond' | 'drop' | 'circle' | 'ring' | 'dash'

const paths: Record<Exclude<Shape, 'circle' | 'ring' | 'dash'>, string> = {
  plane: 'M8 1l1 4.5 5.5 3.5v1.3L9 8.5 8.8 12.5l2 1.5v1L8 14.2 5.2 15v-1l2-1.5L7 8.5 1.5 10.3V9L7 5.5z',
  ship: 'M8 1.5l4 11.5-4-2-4 2z',
  triangle: 'M8 2l6.5 11.5h-13z',
  square: 'M3 4h10v8H3zM4.5 5.5v5h7v-5z',
  diamond: 'M8 2l6 6-6 6-6-6z',
  drop: 'M8 1.5C8 1.5 13 7.5 13 10a5 5 0 0 1-10 0c0-2.5 5-8.5 5-8.5z',
}

function Glyph({ shape, color, size = 12, faded }: { shape: Shape; color: string; size?: number; faded?: boolean }) {
  const opacity = faded ? 0.45 : 1
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ opacity, flex: 'none' }}>
      {shape === 'circle' && <circle cx="8" cy="8" r="6" fill={color} fillOpacity="0.5" stroke={color} strokeWidth="1.6" />}
      {shape === 'ring' && <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="1.4" />}
      {shape === 'dash' && <path d="M1 8h14" stroke={color} strokeWidth="2" strokeDasharray="3 2" />}
      {shape !== 'circle' && shape !== 'ring' && shape !== 'dash' && <path d={paths[shape]} fill={color} />}
    </svg>
  )
}

interface Item {
  shape: Shape
  color: string
  label: string
  size?: number
  faded?: boolean
}

const c = (id: string) => `var(--c-${id})`

const legends: Partial<Record<LayerId, Item[]>> = {
  flights: [
    { shape: 'plane', color: c('flights'), label: 'Airborne' },
    { shape: 'plane', color: 'var(--accent-strong)', label: 'Military' },
    { shape: 'plane', color: 'var(--danger)', label: 'Emergency' },
    { shape: 'plane', color: 'var(--muted)', label: 'On ground' },
  ],
  ships: [
    { shape: 'ship', color: c('ships'), label: 'Moving' },
    { shape: 'ship', color: c('ships'), label: 'Stopped', faded: true },
  ],
  satellites: [
    { shape: 'diamond', color: c('satellites'), label: 'Satellite' },
    { shape: 'dash', color: c('satellites'), label: 'Path of the selected one' },
  ],
  quakes: [
    { shape: 'circle', color: c('quakes'), label: 'M3', size: 8 },
    { shape: 'circle', color: c('quakes'), label: 'M5', size: 12 },
    { shape: 'circle', color: c('quakes'), label: 'M7', size: 16 },
    { shape: 'ring', color: c('quakes'), label: 'Older than a day', size: 12 },
  ],
  volcanoes: [
    { shape: 'triangle', color: 'var(--lvl-1)', label: 'I Normal' },
    { shape: 'triangle', color: 'var(--lvl-2)', label: 'II Advisory' },
    { shape: 'triangle', color: 'var(--lvl-3)', label: 'III Watch' },
    { shape: 'triangle', color: 'var(--lvl-4)', label: 'IV Warning' },
  ],
  fires: [
    { shape: 'circle', color: c('fires'), label: 'Small', size: 7 },
    { shape: 'circle', color: c('fires'), label: 'Intense', size: 13 },
  ],
  karhutla: [
    { shape: 'circle', color: 'var(--lvl-2)', label: 'Low', size: 8 },
    { shape: 'circle', color: 'var(--lvl-3)', label: 'Medium', size: 10 },
    { shape: 'circle', color: 'var(--lvl-4)', label: 'High confidence', size: 12 },
  ],
  reports: [
    { shape: 'drop', color: c('reports'), label: 'Flood or haze' },
    { shape: 'diamond', color: c('reports'), label: 'Fire' },
    { shape: 'triangle', color: c('reports'), label: 'Volcanic' },
  ],
  cameras: [
    { shape: 'square', color: c('cameras'), label: 'Online' },
    { shape: 'square', color: c('cameras'), label: 'Offline', faded: true },
  ],
}

export function Legend({ id, label }: { id: LayerId; label: string }): ReactNode {
  if (id === 'weather') {
    return (
      <div className={styles.legend} aria-label={`${label} key`}>
        <span className={styles.scale} aria-hidden="true" />
        <span className={styles.scaleLabels}>
          <span>Light rain</span>
          <span>Heavy rain</span>
        </span>
      </div>
    )
  }
  const items = legends[id]
  if (!items) return null
  return (
    <ul className={styles.legend} aria-label={`${label} key`}>
      {items.map((item) => (
        <li key={item.label} className={styles.item}>
          <Glyph shape={item.shape} color={item.color} size={item.size} faded={item.faded} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
