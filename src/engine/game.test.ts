import { describe, expect, it } from 'vitest'
import { makeRng } from './rng'
import { activeWarning, badges, currentCard, explain, newGame, radioAvailable, radioDelay, score, step } from './game'
import { BLOCKS } from './constants'
import type { Choice, GameState, Jobs, StormPlan } from './types'

const J = (air = 0, shield = 0, plants = 0, radio = 0): Jobs => ({ air, shield, plants, radio })
const C = (jobs: Jobs, go = false): Choice => ({ jobs, go })
const rng = () => makeRng(1)
const calm = (g: GameState): GameState => ({ ...g, storms: [], warned: [] })
const storm = (arrivalDay: number, size: 'small' | 'big' | 'huge', profile: number[]): StormPlan => ({
  stormId: 'storm-6',
  arrivalDay,
  size,
  profile,
})
const withStorms = (g: GameState, ...s: StormPlan[]): GameState => ({ ...g, storms: s, warned: s.map(() => false) })

describe('newGame', () => {
  it('Cadet is 10 days with no food bar; Commander is 20 days with food', () => {
    const c = newGame({ mode: 'cadet', siteId: 'region-3', seed: 1 })
    const k = newGame({ mode: 'commander', siteId: 'region-3', seed: 1 })
    expect(c.totalDays).toBe(10)
    expect(c.hasFood).toBe(false)
    expect(k.totalDays).toBe(20)
    expect(k.hasFood).toBe(true)
    expect([c.air, c.power, c.radiation, c.food]).toEqual([80, 70, 0, 70])
    expect(c.day).toBe(1)
    expect(c.status).toBe('playing')
  })

  it('Cadet radio always reaches Earth; Commander follows the real Earth-in-view share', () => {
    const c = newGame({ mode: 'cadet', siteId: 'region-6', seed: 1 })
    expect(c.earthDays.every(Boolean)).toBe(true)
    const k = newGame({ mode: 'commander', siteId: 'region-4', seed: 1 })
    const n = k.earthDays.filter(Boolean).length
    expect(Math.abs(n - 0.683 * 20)).toBeLessThanOrEqual(1)
  })

  it('plans 1 storm in Cadet and 2 in Commander, the second being the January 2026 headline', () => {
    const c = newGame({ mode: 'cadet', siteId: 'region-3', seed: 5 })
    const k = newGame({ mode: 'commander', siteId: 'region-3', seed: 5 })
    expect(c.storms).toHaveLength(1)
    expect(c.storms[0]?.stormId).not.toBe('storm-6')
    expect(k.storms).toHaveLength(2)
    expect(k.storms[1]?.stormId).toBe('storm-6')
  })

  it('never puts a storm before day 3, and leaves a chance to be warned first', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const mode of ['cadet', 'commander'] as const) {
        const g = newGame({ mode, siteId: 'region-6', seed })
        const look = mode === 'cadet' ? 3 : 2
        for (const s of g.storms) {
          expect(s.arrivalDay).toBeGreaterThanOrEqual(3)
          let chance = false
          for (let r = Math.max(1, s.arrivalDay - look); r < s.arrivalDay; r++) if (g.earthDays[r - 1]) chance = true
          expect(chance).toBe(true)
        }
      }
    }
  })

  it('is the same for the same seed', () => {
    expect(newGame({ mode: 'commander', siteId: 'region-2', seed: 9 })).toEqual(
      newGame({ mode: 'commander', siteId: 'region-2', seed: 9 }),
    )
  })
})

describe('step: the day', () => {
  const base = (): GameState => calm(newGame({ mode: 'commander', siteId: 'region-4', seed: 3 }))

  it('an idle day costs air and gains sunlight power', () => {
    const g = { ...base(), sunDays: base().sunDays.map(() => true) }
    const n = step(g, C(J()), rng())
    expect(n.air).toBe(80 - 16)
    expect(n.power).toBe(100)
    expect(n.day).toBe(2)
  })

  it('a dark day gives much less power', () => {
    const g = { ...base(), sunDays: base().sunDays.map(() => false) }
    expect(step(g, C(J()), rng()).power).toBe(70 + 4)
  })

  it('every block costs power', () => {
    const g = { ...base(), sunDays: base().sunDays.map(() => false), power: 50 }
    expect(step(g, C(J(2, 0, 1, 0)), rng()).power).toBe(50 + 4 - 2 * 3)
  })

  it('air blocks add air; plants add food and a little air', () => {
    const g = base()
    const n = step(g, C(J(2, 0, 1, 0)), rng())
    expect(n.air).toBe(80 - 16 + 2 * 9 + 1)
    expect(n.food).toBe(70 - 7 + 8)
  })

  it('Cadet has no food bar, so food never changes or ends the game', () => {
    const g = calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 3 }))
    expect(step(g, C(J(2)), rng()).food).toBe(70)
  })

  it('rejects more than 6 blocks, negative or fractional blocks', () => {
    const g = base()
    expect(() => step(g, C(J(4, 3)), rng())).toThrow()
    expect(() => step(g, C(J(-1, 2)), rng())).toThrow()
    expect(() => step(g, C(J(1.5)), rng())).toThrow()
    expect(BLOCKS).toBe(6)
  })

  it('Commander radio needs Earth in view that day', () => {
    const g = base()
    const dark = { ...g, earthDays: g.earthDays.map(() => false) }
    expect(radioAvailable(dark)).toBe(false)
    expect(() => step(dark, C(J(0, 0, 0, 1)), rng())).toThrow()
    const lit = { ...g, earthDays: g.earthDays.map(() => true) }
    expect(radioAvailable(lit)).toBe(true)
    expect(() => step(lit, C(J(0, 0, 0, 1)), rng())).not.toThrow()
  })

  it('does not change the old state', () => {
    const g = base()
    const copy = JSON.parse(JSON.stringify(g))
    step(g, C(J(2)), rng())
    expect(g).toEqual(copy)
  })
})

describe('step: storms', () => {
  const cadet = (s: StormPlan): GameState => withStorms(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 }), s)

  it('the shield decides how many space rays get in', () => {
    const s = storm(1, 'small', [1])
    const bare = step(cadet(s), C(J(2)), rng())
    const some = step(cadet(s), C(J(0, 2)), rng())
    const shielded = step(cadet(s), C(J(0, 6)), rng())
    expect(bare.radiation).toBe(100)
    expect(bare.loss).toBe('radiation')
    expect(some.radiation).toBeCloseTo(100 * 0.35, 5)
    expect(shielded.radiation).toBeCloseTo(100 * 0.05, 5)
  })

  it('a huge storm with no shield ends the mission with radiation as the cause', () => {
    const n = step(cadet(storm(1, 'huge', [1])), C(J(2)), rng())
    expect(n.status).toBe('lost')
    expect(n.loss).toBe('radiation')
  })

  it('Commander storms are stronger than Cadet storms', () => {
    const k = withStorms(newGame({ mode: 'commander', siteId: 'region-3', seed: 2 }), storm(1, 'small', [1]))
    expect(step(k, C(J(0, 2)), rng()).radiation).toBeCloseTo(100 * 1.15 * 0.35, 5)
  })

  it('radiation drains away on a calm day', () => {
    const g = { ...calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })), radiation: 30 }
    expect(step(g, C(J(2)), rng()).radiation).toBe(26)
  })

  it('a radio call warns about a storm 3 days away in Cadet but not 4', () => {
    const near = step(cadet(storm(4, 'small', [1])), C(J(2, 0, 0, 1)), rng())
    expect(near.warned).toEqual([true])
    const far = step(cadet(storm(5, 'small', [1])), C(J(2, 0, 0, 1)), rng())
    expect(far.warned).toEqual([false])
  })

  it('without a radio call there is no warning, and the day report says so', () => {
    const g = cadet(storm(2, 'small', [1]))
    const d1 = step(g, C(J(2)), rng())
    expect(d1.warned).toEqual([false])
    const d2 = step(d1, C(J(2, 2)), rng())
    expect(d2.history[1]?.storm?.warned).toBe(false)
  })

  it('shows an active warning once the radio has heard of the storm', () => {
    const g = cadet(storm(3, 'big', [1]))
    expect(activeWarning(g)).toBeNull()
    const n = step(g, C(J(2, 0, 0, 1)), rng())
    expect(activeWarning(n)).toEqual({ stormIndex: 0, daysUntil: 1 })
  })

  it('multi-day storms use each day of the profile', () => {
    let g = cadet(storm(1, 'big', [0.5, 1]))
    g = step(g, C(J(2, 4)), rng())
    g = step(g, C(J(2, 4)), rng())
    expect(g.history[1]?.storm?.incoming).toBeGreaterThan(g.history[0]?.storm?.incoming ?? 0)
  })

  it('there is no choice card on a storm day: the crew stays inside', () => {
    expect(currentCard(cadet(storm(1, 'small', [1])))).toBeNull()
    expect(currentCard(calm(cadet(storm(1, 'small', [1]))))).not.toBeNull()
  })
})

describe('step: choice cards', () => {
  it('Go earns science and has a cost; Stay is safe and earns none', () => {
    const g = calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 }))
    const card = currentCard(g)!
    const go = step(g, C(J(2), true), rng())
    const stay = step(g, C(J(2), false), rng())
    expect(go.science).toBeGreaterThan(0)
    expect(stay.science).toBe(0)
    const worse = go.power < stay.power || go.radiation > stay.radiation || go.air < stay.air
    expect(worse).toBe(true)
    expect(card.question.length).toBeGreaterThan(5)
  })
})

describe('step: winning and losing', () => {
  it('air at zero loses with cause air', () => {
    const g = { ...calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })), air: 10 }
    const n = step(g, C(J()), rng())
    expect(n.status).toBe('lost')
    expect(n.loss).toBe('air')
  })

  it('an empty battery loses with cause power', () => {
    const g = {
      ...calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })),
      power: 5,
      sunDays: Array(10).fill(false) as boolean[],
    }
    const n = step(g, C(J(2, 2, 2)), rng())
    expect(n.status).toBe('lost')
    expect(n.loss).toBe('power')
  })

  it('food at zero loses in Commander', () => {
    const g = { ...calm(newGame({ mode: 'commander', siteId: 'region-3', seed: 2 })), food: 5 }
    const n = step(g, C(J(2)), rng())
    expect(n.loss).toBe('food')
  })

  it('reaching the last day safely wins', () => {
    let g: GameState = { ...calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })), sunDays: Array(10).fill(true) as boolean[] }
    for (let i = 0; i < 10; i++) g = step(g, C(J(2, 0, 0, 0)), rng())
    expect(g.status).toBe('won')
    expect(g.history).toHaveLength(10)
  })

  it('cannot step after the game is over', () => {
    const g = { ...calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })), air: 10 }
    const lost = step(g, C(J()), rng())
    expect(() => step(lost, C(J(2)), rng())).toThrow()
  })
})

describe('radio delay', () => {
  it('is about 1.28 s one way and doubles for a reply, sourced to NASA', () => {
    const d = radioDelay()
    expect(d.oneWayS).toBe(1.28)
    expect(d.roundTripS).toBeCloseTo(2.56, 5)
    expect(d.source).toContain('384,400')
  })
})

describe('why it happened', () => {
  it('a radiation loss gives 3 steps that name the storm record and the shield', () => {
    const g = withStorms(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 }), storm(1, 'huge', [1]))
    const lost = step(g, C(J(2)), rng())
    expect(lost.loss).toBe('radiation')
    const why = explain(lost)
    expect(why.steps).toHaveLength(3)
    expect(why.steps.map((s) => s.text).join(' ')).toMatch(/shield/i)
    expect(why.tip.length).toBeGreaterThan(10)
    expect(why.record?.url).toContain('/SEP/44041/')
  })

  it('an air loss names the air, not the storm', () => {
    const g = { ...calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })), air: 10 }
    const why = explain(step(g, C(J()), rng()))
    expect(why.steps).toHaveLength(3)
    expect(why.steps.map((s) => s.text).join(' ')).toMatch(/air/i)
    expect(why.record).toBeNull()
  })
})

describe('rewards', () => {
  it('score is science plus 3 per storm survived', () => {
    const g = withStorms(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 }), storm(1, 'small', [1]))
    const n = step(g, C(J(2, 4)), rng())
    expect(score(n)).toBe(n.science + 3)
  })

  it('Storm Survivor and Radio Hero come from real play', () => {
    const g = withStorms(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 }), storm(3, 'small', [1]))
    let n = step(g, C(J(2, 0, 0, 1)), rng())
    expect(badges(n)).toContain('radio-hero')
    n = step(n, C(J(2, 0, 0, 0)), rng())
    n = step(n, C(J(2, 4)), rng())
    expect(badges(n)).toContain('storm-survivor')
    expect(badges(n)).toContain('first-day')
  })
})
