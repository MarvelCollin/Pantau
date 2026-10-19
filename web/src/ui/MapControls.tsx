import { useState } from 'react'
import type { Map as MapLibre } from 'maplibre-gl'
import { CornersOut, GpsFix, Minus, Plus } from '@phosphor-icons/react'
import { useStore } from '../state/store'
import styles from './MapControls.module.css'

export function MapControls({ map }: { map: MapLibre }) {
  const [message, setMessage] = useState('')
  const [locating, setLocating] = useState(false)

  const say = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 5000)
  }

  const locate = () => {
    if (!('geolocation' in navigator)) return say('This browser cannot share your location.')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const { latitude: lat, longitude: lon } = pos.coords
        useStore.getState().requestFly(lon, lat, 10)
        useStore.getState().select({ kind: 'point', lat, lon })
      },
      (err) => {
        setLocating(false)
        say(err.code === err.PERMISSION_DENIED ? 'Location is blocked. Allow it in your browser settings to use this.' : 'Could not find your location. Try again in a moment.')
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }

  return (
    <>
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
          <CornersOut size={18} weight="bold" aria-hidden="true" />
        </button>
        <button type="button" className={styles.btn} onClick={locate} aria-label="Show my location and its weather" aria-busy={locating} data-busy={locating}>
          <GpsFix size={18} weight="bold" aria-hidden="true" />
        </button>
      </div>
      <p className={styles.message} role="status" aria-live="polite" data-show={!!message}>
        {message}
      </p>
    </>
  )
}
