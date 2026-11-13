/** Shared numbers for the living Moon base scene: one coordinate system, one palette, one easing family. */

/** The scene is drawn on a 360 x 440 board (about 60% of a 360 x 740 phone) and scales up with the screen. */
export const W = 360
export const H = 440
/** Where the Moon's ground starts. Buildings stand on this line. */
export const HORIZON = 300

export const PAL = {
  night: '#0f1a33',
  skyDay: '#2b4f86',
  skyDark: '#16264a',
  line: '#34476e',
  cream: '#F2EFE8',
  moon: '#C9CCD3',
  moonDark: '#AEB2BC',
  sun: '#E69F00',
  amber: '#eaa21a',
  warn: '#D55E00',
  power: '#F0E442',
  air: '#56B4E9',
  plants: '#009E73',
  radio: '#CC79A7',
  dull: '#5b6b8a',
  wilt: '#8a6a3b',
  cloud: '#C5B8E8',
} as const

/** One easing family (expert-motion.md): enter, state change, and a small overshoot for rewards only. */
export const EASE = {
  enter: 'cubic-bezier(.2,.8,.2,1)',
  state: 'cubic-bezier(.4,0,.2,1)',
  reward: 'cubic-bezier(.34,1.56,.64,1)',
} as const

/** Durations in ms: tap, UI, scene, hero. Hard max 2400 (only the gas cloud). */
export const DUR = { tap: 120, ui: 240, scene: 480, hero: 900, fly: 320, max: 2400 } as const

/** The Sun is a disc on an arc across the sky. */
export const SUN_R = 20
const ARC = { cx: 180, cy: 215, rx: 150, ry: 150 }

/** Sun position for a day: it climbs from the left horizon and sets on the right over the mission. */
export function sunPos(day: number, totalDays: number): { x: number; y: number } {
  const total = Math.max(1, totalDays)
  const t = Math.min(0.97, Math.max(0.03, (day - 0.5) / total))
  return { x: ARC.cx - ARC.rx * Math.cos(Math.PI * t), y: ARC.cy - ARC.ry * Math.sin(Math.PI * t) }
}

/** The shield dome: a half ellipse standing on the horizon. */
export const DOME = { cx: 180, cy: HORIZON, rx: 132, ry: 150 } as const
export const SEGMENTS = 6
/** Segments light from the middle outwards, so one block is the crown and six is a closed ring. */
export const LIGHT_ORDER = [2, 3, 1, 4, 0, 5] as const

/** Height of the dome edge above the horizon at x (the horizon itself outside the dome). */
export function domeTopY(x: number): number {
  const k = 1 - ((x - DOME.cx) / DOME.rx) ** 2
  return k <= 0 ? HORIZON : HORIZON - DOME.ry * Math.sqrt(k)
}

/** Which of the 6 segments a given x falls under (0 = far left). */
export function segmentForX(x: number): number {
  const c = Math.max(-1, Math.min(1, (x - DOME.cx) / DOME.rx))
  const theta = Math.acos(c) // pi at the left edge, 0 at the right edge
  return Math.max(0, Math.min(SEGMENTS - 1, Math.floor(((Math.PI - theta) / Math.PI) * SEGMENTS)))
}

/** x-range of a segment at the baseline of the dome. */
export function segmentSpanX(i: number): [number, number] {
  const a = Math.PI - (i / SEGMENTS) * Math.PI
  const b = Math.PI - ((i + 1) / SEGMENTS) * Math.PI
  return [DOME.cx + DOME.rx * Math.cos(a), DOME.cx + DOME.rx * Math.cos(b)]
}

/** SVG arc path of segment i (left to right), a little shorter at each end so the 6 read as separate pieces. */
export function segmentPath(i: number, inset = 0): string {
  const gap = 0.045
  const a = Math.PI - (i / SEGMENTS) * Math.PI - gap
  const b = Math.PI - ((i + 1) / SEGMENTS) * Math.PI + gap
  const rx = DOME.rx - inset
  const ry = DOME.ry - inset
  const p = (t: number) => `${(DOME.cx + rx * Math.cos(t)).toFixed(1)} ${(DOME.cy - ry * Math.sin(t)).toFixed(1)}`
  return `M${p(a)} A${rx} ${ry} 0 0 1 ${p(b)}`
}

/** Mid point of segment i on the dome edge. */
export function segmentMid(i: number): { x: number; y: number } {
  const t = Math.PI - ((i + 0.5) / SEGMENTS) * Math.PI
  return { x: DOME.cx + DOME.rx * Math.cos(t), y: DOME.cy - DOME.ry * Math.sin(t) }
}

/** The end of the gas-cloud lane: the crown of the dome. The cloud arrives here on day 3. */
export const LANE_END = { x: DOME.cx, y: HORIZON - DOME.ry + 6 } as const

/** How many rays a storm draws. Cheap phones get half. */
export const RAYS = 24
