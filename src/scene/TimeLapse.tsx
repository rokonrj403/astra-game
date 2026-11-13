import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MeterStrip, type MeterValues } from './MeterStrip'
import { MoonBaseScene, type MoonBaseSceneProps } from './MoonBaseScene'
import type { SceneModel } from './model'
import { useReducedMotion } from './motion'
import type { WalkKind, WalkMode } from './Walker'

export interface TimeLapseProps {
  /** The scene as the day was played (blocks on the buildings). */
  before: SceneModel
  /** The scene at the next morning (new day, blocks cleared, new sky). */
  after: SceneModel
  /** Meters before and after, to tick the bars. Optional. */
  meters?: { before: MeterValues; after: MeterValues; hasFood?: boolean }
  /** The moonwalk that happened during this day, played while the sky moves. */
  walk?: { kind: WalkKind; mode?: WalkMode } | null
  /** Total length in ms (default 2400, clamped to 600 to 3000). */
  ms?: number
  /** Called once when the sequence has finished (the walker, if any, is back inside). */
  onDone: () => void
  calm?: boolean
  /** Extra props for the scene (handlers, bubbles...). */
  scene?: Partial<MoonBaseSceneProps>
  children?: ReactNode
}

/**
 * The next-day wait as a 2-3 s sequence inside the scene: the sky dims, the Sun slides along its arc, shadows sweep,
 * the cloud creeps one notch, plants wilt or grow, the bars tick, and any moonwalk goes out and back; then it brightens.
 * Everything is driven by `before` and `after` through CSS transitions on transforms and opacity.
 * With reduced motion it jumps to `after` at once and calls onDone after a short beat.
 */
export function TimeLapse({ before, after, meters, walk = null, ms = 2400, onDone, calm = false, scene, children }: TimeLapseProps) {
  const reduced = useReducedMotion(calm)
  const total = Math.max(600, Math.min(3000, ms))
  const [phase, setPhase] = useState<'before' | 'after'>(reduced ? 'after' : 'before')
  const [dim, setDim] = useState(!reduced)
  const [walking, setWalking] = useState(walk !== null)
  const flags = useRef({ time: false, walk: true, done: false })
  const cb = useRef(onDone)
  cb.current = onDone

  const walkKey = walk ? `${walk.kind}:${walk.mode ?? "run"}` : "none"
  const check = () => {
    const f = flags.current
    if (f.time && f.walk && !f.done) {
      f.done = true
      cb.current()
    }
  }
  const checkRef = useRef(check)
  checkRef.current = check

  useEffect(() => {
    flags.current = { time: false, walk: walk === null, done: false }
    setWalking(walk !== null)
    if (reduced) {
      setPhase('after')
      setDim(false)
      const t = setTimeout(() => {
        flags.current.time = true
        checkRef.current()
      }, 160)
      return () => clearTimeout(t)
    }
    setPhase('before')
    setDim(true)
    const ids = [
      setTimeout(() => setPhase('after'), total * 0.12),
      setTimeout(() => setDim(false), total * 0.62),
      setTimeout(() => {
        flags.current.time = true
        checkRef.current()
      }, total),
    ]
    return () => ids.forEach(clearTimeout)
    // The sequence restarts only on these; mount a new <TimeLapse key={day}> for each day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, total, walkKey])

  const model = phase === 'before' ? before : after
  const mv = meters ? (phase === 'before' ? meters.before : meters.after) : null
  return (
    <>
      <MoonBaseScene
        {...scene}
        model={model}
        dim={dim}
        calm={calm}
        transitionMs={reduced ? 0 : Math.round(total * 0.4)}
        walk={
          walk && walking && phase === 'after'
            ? {
                kind: walk.kind,
                mode: walk.mode,
                key: 'lapse',
                onDone: () => {
                  flags.current.walk = true
                  setWalking(false)
                  checkRef.current()
                },
              }
            : null
        }
      >
        {children}
      </MoonBaseScene>
      {mv && <MeterStrip values={mv} hasFood={meters?.hasFood ?? true} />}
    </>
  )
}
