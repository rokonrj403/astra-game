import { useEffect, useState } from 'react'

function osReduced(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** True when the OS asks for less motion, or the game's own Calm mode (`calm`) is on. Then every state change is instant. */
export function useReducedMotion(calm = false): boolean {
  const [os, setOs] = useState(osReduced)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setOs(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return calm || os
}

/** Cheap phone: little memory or few cores. Halves the particles. */
export function isLowEnd(): boolean {
  if (typeof navigator === 'undefined') return false
  const n = navigator as Navigator & { deviceMemory?: number }
  return (n.deviceMemory !== undefined && n.deviceMemory <= 2) || (typeof n.hardwareConcurrency === 'number' && n.hardwareConcurrency <= 4)
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const easeOut = (k: number) => 1 - Math.pow(1 - clamp(k, 0, 1), 3)
export const easeInOut = (k: number) => {
  const t = clamp(k, 0, 1)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** The art folder in public/ (same base as the rest of the game). */
export const art = (path: string) => `${import.meta.env.BASE_URL}art/${path}`
