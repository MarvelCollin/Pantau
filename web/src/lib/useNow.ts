import { useEffect, useState } from 'react'

export function useNow(intervalMs = 5000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }, intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
