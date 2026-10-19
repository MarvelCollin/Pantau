import { useState } from 'react'
import { X } from '@phosphor-icons/react'
import styles from './FirstTip.module.css'

const KEY = 'pantau-tip-v1'

export function FirstTip() {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== 'seen' && !new URLSearchParams(location.search).has('focus')
    } catch {
      return false
    }
  })
  if (!show) return null
  const close = () => {
    try {
      localStorage.setItem(KEY, 'seen')
    } catch {
      setShow(false)
    }
    setShow(false)
  }

  return (
    <aside className={styles.tip} aria-labelledby="tip-title">
      <h2 id="tip-title" className={styles.title}>
        Welcome to Pantau
      </h2>
      <ul className={styles.list}>
        <li>Tap any plane, volcano or circle on the map to see its details.</li>
        <li>Search a flight number, airline, city or volcano at the top.</li>
        <li>Tap an empty spot on the map for the weather there.</li>
        <li>Turn layers on or off in the panel to choose what you see.</li>
      </ul>
      <button type="button" className={styles.ok} onClick={close}>
        Got it
      </button>
      <button type="button" className={styles.close} onClick={close} aria-label="Close tips">
        <X size={16} weight="bold" aria-hidden="true" />
      </button>
    </aside>
  )
}
