import { layers } from '../layers/registry'
import styles from './Sources.module.css'

export function Sources() {
  return (
    <details className={styles.sources}>
      <summary className={styles.summary}>Data sources and credits</summary>
      <ul className={styles.list}>
        {layers.map((l) => (
          <li key={l.id}>
            <span className={styles.what}>{l.label}</span>
            <a href={l.sourceUrl} target="_blank" rel="noreferrer noopener">
              {l.source}
            </a>
          </li>
        ))}
        <li>
          <span className={styles.what}>Base map</span>
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer noopener">
            OpenFreeMap, OpenStreetMap contributors
          </a>
        </li>
      </ul>
      <p className={styles.note}>
        Everything here comes from free public sources. Data can be late or wrong. For emergencies follow BMKG, BNPB and local
        authorities.
      </p>
    </details>
  )
}
