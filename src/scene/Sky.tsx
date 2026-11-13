import { useId, type KeyboardEvent } from 'react'
import type { FlareSize, FlareView, Side } from './model'
import { PULSES } from './model'
import { H, HORIZON, PAL, SUN_R, W } from './tokens'

/** The scene has no words. These attributes are for screen readers and tests only. */
const key = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

/** Sky, stars and (when Earth is in view) the Earth. Sunny days are lighter; dark days show stars. */
export function Sky({ sunny, earth }: { sunny: boolean; earth: boolean }) {
  const id = useId()
  return (
    <g className="sc-sky" data-sunny={sunny ? 'yes' : 'no'}>
      <defs>
        <linearGradient id={`${id}-day`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#17306a" />
          <stop offset="1" stopColor="#6aaee6" />
        </linearGradient>
        <linearGradient id={`${id}-dark`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PAL.night} />
          <stop offset="1" stopColor={PAL.skyDark} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={PAL.night} />
      <rect width={W} height={HORIZON + 8} fill={`url(#${id}-dark)`} />
      <rect className="sc-fade" width={W} height={HORIZON + 8} fill={`url(#${id}-day)`} opacity={sunny ? 1 : 0} />
      <g fill={PAL.cream} className="sc-stars" opacity={sunny ? 0.25 : 1}>
        {STARS.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
      <g className="sc-earth sc-fade" opacity={earth ? 1 : 0} data-earth={earth ? 'yes' : 'no'}>
        <circle cx="324" cy="48" r="15" fill={PAL.air} />
        <path d="M316 44 q7 -7 11 0 q-3 9 -9 6z" fill={PAL.plants} />
        <path d="M328 54 q6 2 4 8 q-6 0 -4 -8z" fill={PAL.plants} />
      </g>
    </g>
  )
}

const STARS: [number, number, number][] = [
  [26, 26, 1.4], [92, 44, 1.2], [140, 16, 1.6], [214, 30, 1.2], [268, 16, 1.4], [336, 96, 1.2], [18, 100, 1.2], [118, 92, 1.2], [238, 82, 1.4], [196, 58, 1.1], [60, 150, 1.2], [300, 140, 1.2],
]

function starPath(n: number, outer: number, inner: number): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI * i) / n - Math.PI / 2
    pts.push(`${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`)
  }
  return `M${pts.join(' L')}Z`
}

const BURST_R: Record<FlareSize, number> = { small: 12, medium: 17, big: 23 }

/** Where on the Sun the burst erupts, in the Sun's own coordinates (0,0 is the middle of the disc). */
export function burstSpot(side: Side, showSide: boolean): { x: number; y: number } {
  // Seen from Earth with north up, solar west is on the right. With no side clue (Cadet) the burst is on top.
  return showSide ? { x: side === 'west' ? SUN_R - 2 : -(SUN_R - 2), y: -4 } : { x: 0, y: -(SUN_R - 2) }
}

/**
 * A flare as a picture. Size = the burst's reach plus 1, 2 or 3 rings (small, medium, big).
 * A flare with no gas cloud also gets a dashed, fizzling ring. Positioned at the Sun limb (east/west) when `showSide`.
 * Origin is the Sun's centre; draw it inside the Sun group.
 */
export function FlareBurst({ size, cloud, side, showSide }: { size: FlareSize; cloud: boolean; side: Side; showSide: boolean }) {
  const spot = burstSpot(side, showSide)
  const pulses = PULSES[size]
  const r = BURST_R[size]
  return (
    <g className="sc-burst" data-size={size} data-pulses={pulses} data-side={showSide ? side : 'hidden'} transform={`translate(${spot.x} ${spot.y})`}>
      <g className="sc-burst-star">
        <path d={starPath(8, r, r * 0.45)} fill="#FFF3C4" stroke={PAL.warn} strokeWidth="2" strokeLinejoin="round" />
        <circle r={r * 0.28} fill={PAL.warn} />
      </g>
      {Array.from({ length: pulses }, (_, i) => (
        <circle key={i} className="sc-pulse" data-pulse={i + 1} r={r + 6 + i * 8} fill="none" stroke={PAL.warn} strokeWidth="2.5" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
      {!cloud && <circle className="sc-fizzle" r={r + 6 + pulses * 8} fill="none" stroke={PAL.cream} strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />}
    </g>
  )
}

/** How far the Sun picture reaches from its centre: the halo, and a flare's burst with its rings (and the fizzle ring when there is no gas cloud). */
export function sunReach(flare: { size: FlareSize; cloud: boolean } | null, side: Side, showSide: boolean): { left: number; right: number; up: number; down: number } {
  const halo = SUN_R + 14
  if (!flare) return { left: halo, right: halo, up: halo, down: halo }
  const spot = burstSpot(side, showSide)
  const r = BURST_R[flare.size]
  const rings = r + 6 + PULSES[flare.size] * 8 // the outer fizzle ring; the pulse rings are smaller
  const reach = flare.cloud ? r + 6 + (PULSES[flare.size] - 1) * 8 : rings
  return { left: Math.max(halo, reach - spot.x), right: Math.max(halo, reach + spot.x), up: Math.max(halo, reach - spot.y), down: Math.max(halo, reach + spot.y) }
}

export interface SunProps {
  x: number
  y: number
  sunny: boolean
  /** A flare watch or storm is on: the Sun turns orange. */
  warn?: boolean
  flare?: FlareView | null
  showSide?: boolean
  /** Tap the Sun to see the clues. */
  onTap?: () => void
}

/** The Sun on its arc. It slides with a transform transition, so a time-lapse can move it. */
export function Sun({ x, y, sunny, warn = false, flare = null, showSide = false, onTap }: SunProps) {
  const fill = warn || flare ? PAL.warn : PAL.sun
  const body = (
    <>
      <circle className="sc-breathe" r={SUN_R + 14} fill="#F0A900" opacity={sunny ? 0.28 : 0.1} />
      <circle r={SUN_R} fill={fill} opacity={sunny ? 1 : 0.55} />
      {!sunny && (
        // A dim Sun is also marked by stripes across it, not by colour alone.
        <g stroke={PAL.night} strokeWidth="3" strokeLinecap="round" opacity="0.55">
          <line x1={-SUN_R + 4} y1="-6" x2={SUN_R - 4} y2="-6" />
          <line x1={-SUN_R + 2} y1="3" x2={SUN_R - 2} y2="3" />
          <line x1={-SUN_R + 6} y1="12" x2={SUN_R - 6} y2="12" />
        </g>
      )}
      {flare && <FlareBurst size={flare.size} cloud={flare.cloud} side={flare.side} showSide={showSide} />}
    </>
  )
  return (
    <g className="sc-move sc-sun" data-sun-x={Math.round(x)} data-sun-y={Math.round(y)} style={{ transform: `translate(${x}px, ${y}px)` }}>
      {onTap ? (
        <g className="sc-hit" role="button" tabIndex={0} aria-label={flare ? 'Sun, flare clues' : 'Sun'} onClick={onTap} onKeyDown={key(onTap)}>
          {body}
          <circle r="34" fill="transparent" />
        </g>
      ) : (
        body
      )}
    </g>
  )
}

/** Tiny optional labels, shown only after a tap or long-press. With no tags (the default) the scene has no words at all. */
export function ClueTags({ tags, open, x, y }: { tags: string[]; open: boolean; x: number; y: number }) {
  if (!open || tags.length === 0) return null
  const isSide = (t: string) => t === 'West' || t === 'East'
  const words = tags.filter((t) => !isSide(t))
  const wide = 8 * Math.max(0, ...words.map((t) => t.length)) + 16
  const left = Math.max(6, Math.min(W - wide - 6, x - wide / 2))
  return (
    <g className="sc-tags" data-tags="open">
      {tags.map((t, i) => (
        <g key={t} transform={`translate(${left} ${y + i * 24})`}>
          {isSide(t) ? (
            // The side the flare came from: a Sun disc with that half lit (West is the right half), so it needs no word.
            <g role="img" aria-label={`${t} side of the Sun`}>
              <rect width="44" height="22" rx="11" fill={PAL.night} stroke={PAL.line} strokeWidth="1.5" opacity="0.95" />
              <circle cx="22" cy="11" r="8" fill="none" stroke={PAL.cream} strokeWidth="1.5" />
              <path d={t === 'West' ? 'M22 3 A8 8 0 0 1 22 19 Z' : 'M22 3 A8 8 0 0 0 22 19 Z'} fill={PAL.warn} />
            </g>
          ) : (
            <>
              <rect width={wide} height="19" rx="9.5" fill={PAL.night} stroke={PAL.line} strokeWidth="1.5" opacity="0.95" />
              <text x={wide / 2} y="13.5" textAnchor="middle" fontSize="12" fontWeight="700" fill={PAL.cream}>
                {t}
              </text>
            </>
          )}
        </g>
      ))}
    </g>
  )
}
