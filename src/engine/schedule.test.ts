import { describe, expect, it } from 'vitest'
import { makeRng } from './rng'
import { spreadDays, stormProfile } from './schedule'

describe('rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = makeRng(7)
    const b = makeRng(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('gives different sequences for different seeds', () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)())
  })
  it('stays in [0, 1)', () => {
    const r = makeRng(99)
    for (let i = 0; i < 500; i++) {
      const x = r()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe('spreadDays', () => {
  it('matches the share of sunny days within one day', () => {
    for (const share of [0.27, 0.33, 0.39, 0.5, 0.68]) {
      for (const n of [10, 20]) {
        const count = spreadDays(share, n, 0.5).filter(Boolean).length
        expect(Math.abs(count - share * n)).toBeLessThanOrEqual(1)
      }
    }
  })
  it('spreads days evenly: no run of dark days longer than 4 at 27%', () => {
    const days = spreadDays(0.27, 20, 0.5)
    let run = 0
    let longest = 0
    for (const d of days) {
      run = d ? 0 : run + 1
      longest = Math.max(longest, run)
    }
    expect(longest).toBeLessThanOrEqual(4)
  })
})

describe('stormProfile', () => {
  it('peaks at 1 on its biggest day and lasts at most 3 days', () => {
    const relative = [...Array(30).fill(0.2), 0.6, 1, 0.9, ...Array(50).fill(0.4)]
    const p = stormProfile('big', relative)
    expect(Math.max(...p)).toBe(1)
    expect(p.length).toBeGreaterThanOrEqual(1)
    expect(p.length).toBeLessThanOrEqual(3)
  })
  it('falls back to a plain shape when there is no curve', () => {
    expect(stormProfile('small', null)).toEqual([1])
    expect(Math.max(...stormProfile('huge', null))).toBe(1)
  })
})
