import type { ReactNode } from 'react'
import { useStore } from '../state/store'
import type { LayerId } from '../layers/registry'
import { Section } from './Detail'
import styles from './Nearby.module.css'

export interface NearbyItem {
  id: string
  label: ReactNode
  sub: ReactNode
  lon: number
  lat: number
}

export function Nearby({ title, layer, items, empty }: { title: string; layer: LayerId; items: NearbyItem[]; empty?: string }) {
  const select = useStore((s) => s.select)
  const fly = useStore((s) => s.requestFly)
  if (items.length === 0 && !empty) return null
  return (
    <Section>
      <h3 className={styles.title}>{title}</h3>
      {items.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.item}
                onClick={() => {
                  select({ kind: 'item', layer, id: item.id })
                  fly(item.lon, item.lat)
                }}
              >
                <span className={styles.label}>{item.label}</span>
                <span className={styles.sub}>{item.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
