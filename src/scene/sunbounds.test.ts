import { describe, expect, it } from 'vitest'
import { sunReach } from './Sky'
import { PULSES } from './model'
import { H, W, sunPos } from './tokens'

const sizes = Object.keys(PULSES) as ('small' | 'medium' | 'big')[]

describe('the Sun stays whole inside the scene', () => {
  for (const total of [10, 20]) {
    it(`on every day of a ${total}-day mission: disc, halo, flare burst and rings are all inside the board`, () => {
      for (let day = 1; day <= total; day++) {
        const { x, y } = sunPos(day, total)
        const cases = [
          { flare: null, side: 'east' as const, showSide: false },
          ...sizes.flatMap((size) => [true, false].flatMap((cloud) => [{ flare: { size, cloud }, side: 'east' as const, showSide: true }, { flare: { size, cloud }, side: 'west' as const, showSide: true }, { flare: { size, cloud }, side: 'east' as const, showSide: false }])),
        ]
        for (const c of cases) {
          const r = sunReach(c.flare, c.side, c.showSide)
          const label = `day ${day}/${total} ${JSON.stringify(c)}`
          expect(x - r.left, `${label} left edge`).toBeGreaterThanOrEqual(0)
          expect(x + r.right, `${label} right edge`).toBeLessThanOrEqual(W)
          expect(y - r.up, `${label} top edge`).toBeGreaterThanOrEqual(0)
          expect(y + r.down, `${label} bottom edge`).toBeLessThanOrEqual(H)
        }
      }
    })
  }
})
