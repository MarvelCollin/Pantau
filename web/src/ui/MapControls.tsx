import type { Map as MapLibre } from 'maplibre-gl'
import { Plus, Minus, Crosshair } from '@phosphor-icons/react'
import styles from './MapControls.module.css'

export function MapControls({ map }: { map: MapLibre }) {
  return (
    <div className={styles.controls} role="group" aria-label="Map controls">
      <button type="button" className={styles.btn} onClick={() => map.zoomIn()} aria-label="Zoom in">
        <Plus size={18} weight="bold" aria-hidden="true" />
      </button>
      <button type="button" className={styles.btn} onClick={() => map.zoomOut()} aria-label="Zoom out">
        <Minus size={18} weight="bold" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={() => map.fitBounds([[94.5, -11.2], [141.5, 6.3]], { padding: 24 })}
        aria-label="Show all of Indonesia"
      >
        <Crosshair size={18} weight="bold" aria-hidden="true" />
      </button>
    </div>
  )
}
