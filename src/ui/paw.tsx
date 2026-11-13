import { PawPrint } from 'lucide-react'

/**
 * ORBI's paw: a pulsing paw that points at the next thing to do. No words. It never takes a tap (pointer-events: none),
 * so the thing under it can still be tapped or dragged to. `x` and `y` are a spot on the 360 x 440 scene, as a share of its width and height.
 */
export function Paw({ x, y, left, top, className = '' }: { x?: number; y?: number; left?: string; top?: string; className?: string }) {
  const style = left !== undefined && top !== undefined ? { left, top } : x === undefined || y === undefined ? undefined : { left: `${(x / 360) * 100}%`, top: `${(y / 440) * 100}%` }
  return (
    <span className={`paw ${className}`} style={style} aria-hidden="true" data-paw="yes">
      <PawPrint size={30} color="#0f1a33" fill="#0f1a33" />
    </span>
  )
}

/** The steps of the first-day tour, in order. Each waits for the child to do the thing. */
export type TourStep = 'sun' | 'habitat' | 'dome' | 'guess' | 'next'

export const TOUR_KEY = 'astra-tour-v1'
