import { references } from '../layers/references'
import { layers } from '../layers/registry'
import styles from './Sources.module.css'

export function Sources() {
  const groups = [
    ...layers.map((l) => ({ key: l.id, label: l.label, refs: references[l.id] })),
    { key: 'point', label: 'Weather here', refs: references.point },
    { key: 'basemap', label: 'Base map', refs: references.basemap },
  ]
  return (
    <details className={styles.sources}>
      <summary className={styles.summary}>Data sources and credits</summary>
      <dl className={styles.list}>
        {groups.map((g) => (
          <div key={g.key} className={styles.row}>
            <dt className={styles.what}>{g.label}</dt>
            <dd>
              {g.refs.map((r, i) => (
                <span key={r.name}>
                  {i > 0 && ', '}
                  <a href={r.url} target="_blank" rel="noreferrer noopener">
                    {r.name}
                  </a>
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.note}>
        Everything here comes from free public sources. Data can be late or wrong. For emergencies follow BMKG, BNPB and local
        authorities.
      </p>
    </details>
  )
}
