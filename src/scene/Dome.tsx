import { letsThrough, particlePlan } from '../ui/look'
import type { Side } from './model'
import { DOME, HORIZON, LIGHT_ORDER, PAL, RAYS, SEGMENTS, domeTopY, segmentForX, segmentMid, segmentPath, segmentSpanX } from './tokens'

/** The segments that are lit for a charge of 0 to 6 (middle first). */
export function litSegments(charge: number): number[] {
  const n = Math.max(0, Math.min(SEGMENTS, Math.round(charge)))
  return LIGHT_ORDER.slice(0, n).slice().sort((a, b) => a - b)
}

const halfEllipse = `M${DOME.cx - DOME.rx} ${HORIZON} A${DOME.rx} ${DOME.ry} 0 0 1 ${DOME.cx + DOME.rx} ${HORIZON}Z`

/**
 * The shield dome: 6 arc segments, one lit per charge. Lit = solid, thick and bright; unlit = thin and dashed (so it is not colour alone).
 * `fresh` of the lit segments are blocks given today (they get a bright inner line and pop in).
 */
export function DomeShield({ charge, fresh = 0, storm = false, hits, hitAt }: { charge: number; fresh?: number; storm?: boolean; hits?: number[]; hitAt?: number[] }) {
  const lit = litSegments(charge)
  const freshSet = new Set<number>(LIGHT_ORDER.slice(Math.max(0, lit.length - Math.max(0, fresh)), lit.length))
  const glow = lit.length === 0 ? 0 : 0.05 + (1 - letsThrough(lit.length)) * 0.3 + (storm ? 0.08 : 0)
  return (
    <g className="sc-dome" data-charge={lit.length}>
      <path className="sc-fade" d={halfEllipse} fill="#FFF3A0" opacity={glow * 0.8} />
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const on = lit.includes(i)
        return (
          <g key={i} className="sc-seg" data-seg={i} data-lit={on ? 'yes' : 'no'}>
            <path className="sc-seg-line" d={segmentPath(i)} fill="none" stroke={on ? PAL.power : PAL.cream} strokeWidth={on ? 7 : 2} strokeDasharray={on ? undefined : '4 6'} strokeLinecap="round" opacity={on ? (storm ? 1 : 0.9) : 0.4} />
            {on && freshSet.has(i) && <path className="sc-seg-fresh" d={segmentPath(i, 0)} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.9" />}
            {on && hits && (hits[i] ?? 0) > 0 && <path className="sc-seg-flash" d={segmentPath(i)} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" style={{ animationDelay: `${hitAt?.[i] ?? FIRST_HIT_MS}ms` }} />}
            {on && hits && (hits[i] ?? 0) >= 3 && <Crack i={i} at={(hitAt?.[i] ?? FIRST_HIT_MS) + 500} />}
          </g>
        )
      })}
    </g>
  )
}

const FIRST_HIT_MS = 450

function Crack({ i, at }: { i: number; at: number }) {
  const m = segmentMid(i)
  return <path className="sc-crack" style={{ animationDelay: `${at}ms` }} d="M-4 -7 L2 -2 L-3 2 L3 8" transform={`translate(${m.x.toFixed(1)} ${m.y.toFixed(1)})`} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
}

export interface Ray {
  id: number
  passes: boolean
  /** Where it ends (a hit on the dome, or the ground inside it). */
  x: number
  y: number
  /** Where it starts, relative to where it ends. */
  sx: number
  sy: number
  delay: number
  dur: number
  seg: number
}

/**
 * Plans the rays of a reveal. How many get through comes from the game's own table (particlePlan), so 3 blocks really stop about 2 in 3.
 * Rays that stop are aimed at the lit segments, rays that get through at the unlit gaps, so the picture is honest about where the holes are.
 */
export function planRays(shield: number, count = RAYS, side: Side | null = null, sunX: number = DOME.cx): Ray[] {
  const plan = particlePlan(shield, count)
  const lit = litSegments(shield)
  const unlit = Array.from({ length: SEGMENTS }, (_, i) => i).filter((i) => !lit.includes(i))
  const stop = plan.filter((p) => !p.passes)
  const pass = plan.filter((p) => p.passes)
  // spread over a segment: the n-th of `total` rays inside [a, b]
  const spread = (a: number, b: number, n: number, total: number) => a + (b - a) * (0.12 + (0.76 * (n + 0.5)) / total)
  const place = (list: number[], k: number, total: number): { x: number; seg: number } => {
    if (list.length === 0) {
      // Shield full: the few that get through slip between two segments.
      const seg = k % (SEGMENTS - 1)
      return { x: segmentSpanX(seg)[1] + (k % 2 === 0 ? 3 : -3), seg }
    }
    const r = k % list.length
    const seg = list[r] as number
    const inSeg = Math.ceil((total - r) / list.length)
    const [a, b] = segmentSpanX(seg)
    return { x: spread(Math.min(a, b), Math.max(a, b), Math.floor(k / list.length), Math.max(1, inSeg)), seg }
  }
  const lean = side === 'west' ? 34 : side === 'east' ? -34 : 0
  const rays: Ray[] = []
  const make = (passes: boolean, k: number, total: number, id: number): Ray => {
    const at = place(passes ? unlit : lit, k, total)
    const x = at.x
    const y = passes ? HORIZON + 6 + (k % 3) * 11 : domeTopY(x) - 1
    const sx = (sunX - x) * 0.28 + lean
    const sy = -14 - y
    const dist = Math.hypot(sx, sy)
    return { id, passes, x, y, sx, sy, delay: (id % 8) * 105 + Math.floor(id / 8) * 40, dur: Math.max(650, Math.min(1000, dist * 2.6)), seg: segmentForX(x) }
  }
  let id = 0
  // interleave stoppers and passers so the shower looks even
  let si = 0
  let pi = 0
  while (si < stop.length || pi < pass.length) {
    const wantPass = pi < pass.length && (si >= stop.length || pi / pass.length <= si / stop.length)
    if (wantPass) rays.push(make(true, pi++, pass.length, id++))
    else rays.push(make(false, si++, stop.length, id++))
  }
  return rays
}

/** How many rays hit each segment. */
export function hitsPerSegment(rays: Ray[]): number[] {
  const hits = Array.from({ length: SEGMENTS }, () => 0)
  for (const r of rays) if (!r.passes) hits[r.seg] = (hits[r.seg] ?? 0) + 1
  return hits
}

/** When each segment is first hit (ms after the shower starts). */
export function hitTimes(rays: Ray[]): number[] {
  const at = Array.from({ length: SEGMENTS }, () => Infinity)
  for (const r of rays) if (!r.passes) at[r.seg] = Math.min(at[r.seg] ?? Infinity, r.delay + r.dur)
  return at.map((v) => (Number.isFinite(v) ? Math.round(v) : 0))
}

/** Leak tint strength (0 to 0.55) from the share of rays that got through. */
export function leakTint(rays: Ray[]): number {
  const through = rays.filter((r) => r.passes).length
  return through === 0 ? 0 : Math.min(0.42, 0.08 + (through / Math.max(1, rays.length)) * 0.6)
}

/**
 * The shower: streaks fall toward the dome, spark and vanish on lit segments, and the ones that get through hit the ground and tint the base red.
 * Moves only by transform and opacity. With reduced motion the streaks stay drawn at their end point and the segments show their cracks.
 */
export function Rays({ rays }: { rays: Ray[] }) {
  const tint = leakTint(rays)
  const lastLand = rays.filter((r) => r.passes).reduce((m, r) => Math.max(m, r.delay + r.dur), 0)
  return (
    <g className="sc-rays" data-rays={rays.length} data-through={rays.filter((r) => r.passes).length}>
      {tint > 0 && <path className="sc-leak" d={halfEllipse} fill="#E0391F" style={{ opacity: tint, animationDelay: `${Math.max(0, lastLand - 200)}ms` }} data-tint={tint.toFixed(2)} />}
      {rays.map((r) => {
        const L = Math.hypot(r.sx, r.sy) || 1
        const tail = { x: (r.sx / L) * 15, y: (r.sy / L) * 15 }
        return (
          <g key={r.id} transform={`translate(${r.x.toFixed(1)} ${r.y.toFixed(1)})`} className={`sc-ray ${r.passes ? 'through' : 'stop'}`} data-seg={r.seg}>
            <g className="sc-ray-move" style={{ ['--sx' as string]: `${r.sx.toFixed(1)}px`, ['--sy' as string]: `${r.sy.toFixed(1)}px`, animationDelay: `${r.delay}ms`, animationDuration: `${r.dur}ms` }}>
              <line x2={tail.x.toFixed(1)} y2={tail.y.toFixed(1)} stroke={r.passes ? PAL.warn : PAL.sun} strokeWidth={r.passes ? 4.5 : 3} strokeLinecap="round" />
              {r.passes && <path d="M-4 -5 L0 2 L4 -5Z" fill={PAL.warn} transform={`rotate(${((Math.atan2(r.sy, r.sx) * 180) / Math.PI + 90).toFixed(0)})`} />}
            </g>
            <g className="sc-spark" style={{ animationDelay: `${r.delay + r.dur - 60}ms` }}>
              {r.passes ? <ellipse rx="7" ry="3" fill={PAL.warn} /> : <path d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6Z" fill="#fff" />}
            </g>
          </g>
        )
      })}
    </g>
  )
}

/** All-clear: a green ring around the dome and a tick on top. Ring plus tick, so it is not colour alone. */
export function AllClear() {
  return (
    <g className="sc-clear" data-clear="yes">
      <path className="sc-ping" d={halfEllipse} fill="none" stroke={PAL.plants} strokeWidth="6" />
      <g transform={`translate(${DOME.cx} ${HORIZON - DOME.ry - 22})`}>
        <circle className="sc-tick-pop" r="15" fill={PAL.plants} stroke={PAL.cream} strokeWidth="2.5" />
        <path d="M-7 0 L-2 6 L8 -6" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  )
}
