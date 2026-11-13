import { useEffect, useRef } from 'react'
import { clamp, easeInOut, useReducedMotion } from './motion'
import { PAL } from './tokens'

export type WalkKind = 'short' | 'long'
export type WalkMode = 'run' | 'called-home'

type Pt = { x: number; y: number }

/** Footprints trail: from the airlock door across the front ground. The long walk goes on past the end of the short one. */
export const WALK_PATH: Record<WalkKind, Pt[]> = {
  short: [
    { x: 87, y: 303 },
    { x: 84, y: 328 },
    { x: 122, y: 356 },
    { x: 166, y: 372 },
  ],
  long: [
    { x: 87, y: 303 },
    { x: 84, y: 328 },
    { x: 122, y: 356 },
    { x: 166, y: 372 },
    { x: 226, y: 392 },
    { x: 290, y: 410 },
    { x: 322, y: 420 },
  ],
}

function lengths(path: Pt[]): number[] {
  const out = [0]
  for (let i = 1; i < path.length; i++) out.push((out[i - 1] as number) + Math.hypot((path[i] as Pt).x - (path[i - 1] as Pt).x, (path[i] as Pt).y - (path[i - 1] as Pt).y))
  return out
}

/** The point at fraction u (0 to 1) along a path, plus the direction of travel in x. */
export function pointAlong(path: Pt[], u: number): { x: number; y: number; dir: 1 | -1 } {
  const ls = lengths(path)
  const total = ls[ls.length - 1] as number
  const d = clamp(u, 0, 1) * total
  for (let i = 1; i < path.length; i++) {
    const a = ls[i - 1] as number
    const b = ls[i] as number
    if (d <= b) {
      const k = b === a ? 0 : (d - a) / (b - a)
      const p0 = path[i - 1] as Pt
      const p1 = path[i] as Pt
      return { x: p0.x + (p1.x - p0.x) * k, y: p0.y + (p1.y - p0.y) * k, dir: p1.x >= p0.x ? 1 : -1 }
    }
  }
  const last = path[path.length - 1] as Pt
  return { ...last, dir: 1 }
}

const polyline = (p: Pt[]) => p.map((q) => `${q.x},${q.y}`).join(' ')

/** The footprints and the sample flag, drawn while a walk is planned or running. */
export function WalkTrail({ kind }: { kind: WalkKind }) {
  const path = WALK_PATH[kind]
  const end = path[path.length - 1] as Pt
  return (
    <g className="sc-trail" data-walk={kind}>
      <polyline points={polyline(path)} fill="none" stroke={PAL.cream} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="0.1 8" opacity="0.8" />
      <g transform={`translate(${end.x} ${end.y})`}>
        <line x1="0" y1="0" x2="0" y2="-20" stroke={PAL.cream} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M0 -20 L13 -15 L0 -10Z" fill={PAL.amber} stroke={PAL.cream} strokeWidth="1.2" />
        <ellipse cx="0" cy="1" rx="8" ry="2.5" fill={PAL.moonDark} />
      </g>
    </g>
  )
}

/** The astronaut, standing on its feet at (0,0). */
function Astronaut() {
  return (
    <g>
      <ellipse cx="0" cy="1" rx="10" ry="3" fill="#0f1a33" opacity="0.25" />
      <g className="sc-leg l">
        <rect x="-6.5" y="-12" width="5.5" height="12" rx="2.5" fill={PAL.cream} stroke={PAL.line} strokeWidth="1.2" />
      </g>
      <g className="sc-leg r">
        <rect x="1" y="-12" width="5.5" height="12" rx="2.5" fill={PAL.cream} stroke={PAL.line} strokeWidth="1.2" />
      </g>
      <rect x="-12" y="-33" width="7" height="16" rx="3" fill="#9aa3b5" stroke={PAL.line} strokeWidth="1.2" />
      <rect x="-8" y="-31" width="16" height="21" rx="6" fill={PAL.cream} stroke={PAL.line} strokeWidth="1.4" />
      <rect x="-3" y="-25" width="6" height="5" rx="1.5" fill={PAL.amber} />
      <circle cx="0" cy="-38" r="9.5" fill={PAL.cream} stroke={PAL.line} strokeWidth="1.4" />
      <ellipse cx="2.5" cy="-38" rx="6" ry="5.5" fill={PAL.air} stroke={PAL.line} strokeWidth="1.2" />
      <ellipse cx="4.5" cy="-40" rx="1.8" ry="1.3" fill="#fff" opacity="0.8" />
    </g>
  )
}

const OUT = { short: 760, long: 1250 } as const
const BACK = { short: 640, long: 1000 } as const
const PAUSE = 300

export interface WalkerProps {
  kind: WalkKind
  /** run: out and back. called-home: a storm hits, so it turns round half way and runs back fast, shaking. */
  mode?: WalkMode
  /** Starts each time `playKey` changes. */
  playKey?: string | number
  onDone?: () => void
  calm?: boolean
}

/** Total time of the animation in ms (so a caller can plan around it). */
export function walkDuration(kind: WalkKind, mode: WalkMode): number {
  return mode === 'called-home' ? Math.round(OUT[kind] * 0.55 + (OUT[kind] * 0.55) / 2) : OUT[kind] + PAUSE + BACK[kind]
}

/**
 * The astronaut walks out of the airlock along the footprints and back (rAF, one transform write a frame).
 * With reduced motion it simply stands at the flag for a moment, then is gone: no travel.
 */
export function Walker({ kind, mode = 'run', playKey, onDone, calm = false }: WalkerProps) {
  const reduced = useReducedMotion(calm)
  const ref = useRef<SVGGElement>(null)
  const done = useRef(onDone)
  done.current = onDone
  const path = WALK_PATH[kind]
  const trail = kind
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const place = (u: number, shake = 0, walking = true) => {
      const p = pointAlong(path, u)
      const s = 0.72 + ((p.y - 300) / 130) * 0.5
      el.setAttribute('transform', `translate(${(p.x + shake).toFixed(1)} ${p.y.toFixed(1)}) scale(${(p.dir * s).toFixed(3)} ${s.toFixed(3)})`)
      el.setAttribute('data-walking', walking ? 'yes' : 'no')
      el.setAttribute('data-u', u.toFixed(2))
    }
    if (reduced) {
      place(mode === 'called-home' ? 0.55 : 1, 0, false)
      const t = setTimeout(() => done.current?.(), 220)
      return () => clearTimeout(t)
    }
    const out = mode === 'called-home' ? OUT[kind] * 0.55 : OUT[kind]
    const peak = mode === 'called-home' ? 0.55 : 1
    const back = mode === 'called-home' ? out / 2 : BACK[kind]
    const pause = mode === 'called-home' ? 0 : PAUSE
    const total = out + pause + back
    let raf = 0
    let t0: number | null = null
    let finished = false
    place(0)
    const tick = (now: number) => {
      if (t0 === null) t0 = now
      const t = now - t0
      if (t < out) place(peak * easeInOut(t / out))
      else if (t < out + pause) place(peak, 0, false)
      else if (t < total) place(peak * (1 - easeInOut((t - out - pause) / back)), mode === 'called-home' ? Math.sin(t / 22) * 1.6 : 0)
      else {
        if (!finished) {
          finished = true
          el.setAttribute('transform', 'translate(87 303) scale(0)')
          done.current?.()
        }
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [kind, mode, playKey, reduced, path])
  return (
    <g className="sc-walker-layer" data-walk={trail} data-mode={mode}>
      <WalkTrail kind={kind} />
      <g ref={ref} className="sc-walker" transform="translate(87 303) scale(0.72)">
        <Astronaut />
      </g>
    </g>
  )
}
