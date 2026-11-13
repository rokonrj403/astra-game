import { DOME, HORIZON, W, H } from './tokens'
import type { Target } from './model'

export interface Zone {
  id: Target
  /** The hit rectangle on the 360 x 440 board. Every one is at least 44 x 44. */
  x: number
  y: number
  w: number
  h: number
  /** The most blocks it can hold. */
  max: number
}

/** The drop targets. The dome is the biggest, so a block dropped on a smaller building inside it goes to that building. */
export const ZONES: Record<Target, Zone> = {
  walk: { id: 'walk', x: 60, y: 254, w: 54, h: 48, max: 2 },
  air: { id: 'air', x: 130, y: 236, w: 100, h: 66, max: 6 },
  plants: { id: 'plants', x: 234, y: 250, w: 66, h: 52, max: 6 },
  radio: { id: 'radio', x: 300, y: 232, w: 56, h: 72, max: 6 },
  shield: { id: 'shield', x: DOME.cx - DOME.rx, y: HORIZON - DOME.ry, w: DOME.rx * 2, h: DOME.ry, max: 6 },
}

const area = (z: Zone) => z.w * z.h

function inside(z: Zone, x: number, y: number): boolean {
  if (z.id === 'shield') {
    // The dome is a half ellipse, not a box: its empty corners do not count.
    const nx = (x - DOME.cx) / DOME.rx
    const ny = (HORIZON - y) / DOME.ry
    return y <= HORIZON && nx * nx + ny * ny <= 1
  }
  return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h
}

/**
 * Which target a point on the board lands on, or null. When zones overlap the smallest wins,
 * so a block dropped on the habitat inside the dome is Air, and on empty dome it is Shield.
 * With `earth` false the dish is closed (nothing to send to).
 */
export function hitZone(x: number, y: number, opts: { earth?: boolean; walkOpen?: boolean } = {}): Target | null {
  const { earth = true, walkOpen = true } = opts
  let best: Zone | null = null
  for (const z of Object.values(ZONES)) {
    if (z.id === 'radio' && !earth) continue
    if (z.id === 'walk' && !walkOpen) continue
    if (!inside(z, x, y)) continue
    if (best === null || area(z) < area(best)) best = z
  }
  return best?.id ?? null
}

/** Screen pixels to board coordinates, from the picture's on-screen box. */
export function clientToScene(rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null
  return { x: ((clientX - rect.left) * W) / rect.width, y: ((clientY - rect.top) * H) / rect.height }
}

/** The middle of a target on the board (where a flying block lands). */
export function zoneCenter(t: Target): { x: number; y: number } {
  const z = ZONES[t]
  if (t === 'shield') return { x: DOME.cx, y: HORIZON - DOME.ry * 0.55 }
  return { x: z.x + z.w / 2, y: z.y + z.h / 2 }
}
