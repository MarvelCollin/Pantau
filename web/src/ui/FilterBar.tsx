import { X } from '@phosphor-icons/react'
import { useStore } from '../state/store'
import { LayerGlyph } from './LayerGlyph'
import styles from './FilterBar.module.css'

export function FilterBar() {
  const filter = useStore((s) => s.airportFilter)
  const clear = useStore((s) => s.setAirportFilter)
  const on = useStore((s) => s.enabled.includes('flights'))
  if (!filter || !on) return null

  return (
    <div className={styles.bar} role="status">
      <LayerGlyph id="flights" size={16} />
      <span className={styles.text}>
        Showing flights to or from <strong>{filter.label}</strong>
      </span>
      <button type="button" className={styles.clear} onClick={() => clear(null)}>
        <X size={14} weight="bold" aria-hidden="true" />
        Show all flights
      </button>
    </div>
  )
}
