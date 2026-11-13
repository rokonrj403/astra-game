import { LANE_END, PAL } from './tokens'

export type CloudState = 'creep' | 'pass' | 'arrive'

export interface CloudLaneProps {
  /** The Sun's position (the lane starts there). */
  from: { x: number; y: number }
  /** 1 to 3: days since the flare. The cloud moves one notch a day (1/3 of the way each day). null = no cloud, nothing is drawn. */
  daysSince: number | null
  /**
   * creep: it sits at its notch.
   * pass: all-clear, the cloud slides past the dome and fades.
   * arrive: rays came, the cloud melts at the dome.
   */
  state?: CloudState
}

const NOTCHES = [1, 2, 3]

/** The gas cloud: six overlapping puffs. Its outline and lumpy shape say "cloud" without colour. */
export function CloudBlob() {
  return (
    <g className="sc-cloud-blob" fill={PAL.cloud} stroke="#8E7FC4" strokeWidth="2">
      <circle cx="-12" cy="3" r="8" />
      <circle cx="-3" cy="-4" r="9" />
      <circle cx="8" cy="-3" r="8" />
      <circle cx="14" cy="4" r="6" />
      <circle cx="-2" cy="5" r="8" />
      <circle cx="5" cy="6" r="6.5" />
      <g stroke="none">
        <circle cx="-12" cy="3" r="7" />
        <circle cx="-3" cy="-4" r="8" />
        <circle cx="8" cy="-3" r="7" />
        <circle cx="14" cy="4" r="5" />
        <circle cx="-2" cy="5" r="7" />
        <circle cx="5" cy="6" r="5.5" />
      </g>
    </g>
  )
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/**
 * A lane from the Sun to the dome with three notches, one per day. The gas cloud creeps one notch a day, so the child's own taps are the clock.
 * Positions are transforms, so a day change slides smoothly (and instantly with reduced motion).
 */
export function CloudLane({ from, daysSince, state = 'creep' }: CloudLaneProps) {
  if (daysSince === null) return null
  const d = Math.max(1, Math.min(3, Math.round(daysSince)))
  const to = LANE_END
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  const p = state === 'creep' ? d / 3 : 1
  const cx = lerp(from.x, to.x, p)
  const cy = lerp(from.y, to.y, p)
  const pass = state === 'pass'
  const arrive = state === 'arrive'
  const tx = cx + (pass ? 118 : 0)
  const ty = cy + (pass ? 26 : 0)
  return (
    <g className="sc-lane" data-day={d} data-state={state}>
      <line
        className="sc-move"
        x1="0"
        y1="0"
        x2="1"
        y2="0"
        stroke={PAL.cloud}
        strokeWidth="2"
        strokeDasharray="3 6"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity="0.55"
        style={{ transform: `translate(${from.x}px, ${from.y}px) rotate(${angle}deg) scale(${len}, 1)`, transformOrigin: '0 0' }}
      />
      {NOTCHES.map((n) => (
        <circle
          key={n}
          className="sc-move sc-notch"
          data-on={n <= d ? 'yes' : 'no'}
          r="4"
          fill={n <= d ? PAL.cloud : 'none'}
          stroke={PAL.cloud}
          strokeWidth="2"
          style={{ transform: `translate(${lerp(from.x, to.x, n / 3)}px, ${lerp(from.y, to.y, n / 3)}px)` }}
        />
      ))}
      <g className="sc-move sc-cloud" style={{ transform: `translate(${tx}px, ${ty}px)`, opacity: pass || arrive ? 0 : 1 }}>
        <CloudBlob />
      </g>
    </g>
  )
}
