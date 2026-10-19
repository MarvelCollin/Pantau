import styles from './Switch.module.css'

export function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span className={styles.track} data-on={on} aria-hidden="true">
      <span className={styles.thumb} />
    </span>
  )
}
