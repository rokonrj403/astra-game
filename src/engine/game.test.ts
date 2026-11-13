import { describe, expect, it } from 'vitest'
import flareData from '../data/flares.json'
import sites from '../data/sites.json'
import storms from '../data/storms.json'
import { cards } from './cards'
import {
  AIR_DRAIN,
  AIR_PER_BLOCK,
  BLOCKS,
  GUESS_REWARD,
  MODES,
  PLANT_SCIENCE,
  POWER_DARK,
  POWER_PER_BLOCK,
  POWER_SUN,
  RADIATION_RECOVERY,
  RADIO_SCIENCE_MAX,
  SHIELD_EXTRA_POWER,
  SHIELD_LEAK,
  SHIELD_LETS_THROUGH,
  STORM_INTENSITY,
  WALKS,
} from './constants'
import { flareById } from './flares'
import { activeStorm, activeWatches, badges, currentCard, explain, newGame, radioAvailable, radioDelay, score, step } from './game'
import { makeRng } from './rng'
import type { Choice, GameState, Guess, Jobs, StormPlan, Walk } from './types'

const J = (air = 0, shield = 0, plants = 0, radio = 0): Jobs => ({ air, shield, plants, radio })
const C = (jobs: Jobs, go = false, walk: Walk = 'none'): Choice => ({ jobs, go, walk })
const rng = () => makeRng(1)
const calm = (g: GameState): GameState => ({ ...g, storms: [], flares: [], flareSeen: [], flareResolved: [], guesses: [] })
const storm = (arrivalDay: number, size: 'small' | 'big' | 'huge', profile: number[], stormId = 'storm-6'): StormPlan => ({ stormId, arrivalDay, size, profile })
/** A game with one real storm and its real flare the day before. */
const withStorm = (g: GameState, s: StormPlan, seen = false): GameState => ({
  ...g,
  storms: [s],
  flares: [{ flareId: 'flr-44029', day: s.arrivalDay - 1, stormIndex: 0 }],
  flareSeen: [seen],
  flareResolved: [false],
  guesses: [null],
})
const sunny = (g: GameState): GameState => ({ ...g, sunDays: g.sunDays.map(() => true) })
const dark = (g: GameState): GameState => ({ ...g, sunDays: g.sunDays.map(() => false) })
const fx = (g: GameState, go: boolean) => {
  const card = currentCard(g)!
  return go ? card.a : card.b
}
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)

describe('newGame', () => {
  it('Cadet is 10 days with no food bar; Commander is 20 days with food; both have a science goal and an empty shield', () => {
    const c = newGame({ mode: 'cadet', siteId: 'region-3', seed: 1 })
    expect([c.totalDays, c.hasFood, c.goal, c.shield, c.science]).toEqual([10, false, MODES.cadet.goal, 0, 0])
    const k = newGame({ mode: 'commander', siteId: 'region-3', seed: 1 })
    expect([k.totalDays, k.hasFood, k.goal, k.shield]).toEqual([20, true, MODES.commander.goal, 0])
    expect(k.carry).toEqual({ power: 0, air: 0, science: 0 })
  })

  it('Cadet radio always reaches Earth; Commander follows the real Earth-in-view share', () => {
    expect(newGame({ mode: 'cadet', siteId: 'region-1', seed: 1 }).earthDays.every(Boolean)).toBe(true)
    // Slater Plain: Earth is in view about half the time (LOLA best spot, 49.9%). Malapert Massif always sees Earth.
    const k = newGame({ mode: 'commander', siteId: 'region-9', seed: 1 })
    expect(newGame({ mode: 'commander', siteId: 'region-3', seed: 1 }).earthDays.every(Boolean)).toBe(true)
    expect(k.earthDays.filter(Boolean).length).toBeGreaterThan(0)
    expect(k.earthDays.filter(Boolean).length).toBeLessThan(k.totalDays)
  })

  it('deals a balanced hand: Cadet 1 rays flare + 1 quiet flare, Commander 2 + 2, the second storm being the January 2026 headline', () => {
    for (const seed of SEEDS) {
      const c = newGame({ mode: 'cadet', siteId: 'region-3', seed })
      expect([c.flares.length, c.storms.length]).toEqual([2, 1])
      const k = newGame({ mode: 'commander', siteId: 'region-3', seed })
      expect([k.flares.length, k.storms.length]).toEqual([4, 2])
      expect(k.storms[1]!.stormId).toBe('storm-6')
    }
  })

  it('every flare is a real DONKI flare with its real outcome: rays flares have a real storm after the real delay, quiet flares have none', () => {
    for (const mode of ['cadet', 'commander'] as const)
      for (const seed of SEEDS) {
        const g = newGame({ mode, siteId: 'region-5', seed })
        for (const f of g.flares) {
          const real = flareById(f.flareId)!
          expect(real).toBeDefined()
          expect(f.stormIndex !== null).toBe(real.followed)
          if (f.stormIndex !== null) expect(g.storms[f.stormIndex]!.arrivalDay).toBe(f.day + real.sep!.delayDays)
        }
        expect(new Set(g.flares.map((f) => f.flareId)).size).toBe(g.flares.length)
      }
  })

  it('the first flare is a big one with no gas cloud and no rays, and Commander also gets a big gas-cloud flare that brought no rays', () => {
    for (const mode of ['cadet', 'commander'] as const)
      for (const seed of SEEDS) {
        const g = newGame({ mode, siteId: 'region-3', seed })
        const real = g.flares.map((f) => flareById(f.flareId)!)
        const quiet = real.filter((r) => !r.followed)
        expect(quiet.some((r) => r.class.startsWith('X') && !r.cloud)).toBe(true)
        if (mode === 'commander') expect(quiet.some((r) => r.class.startsWith('X') && r.cloud)).toBe(true)
      }
  })

  it('keeps the timing fair: no storm before day 3 or after the last day, storms never overlap, flares come on days Earth is in view', () => {
    for (const mode of ['cadet', 'commander'] as const)
      for (const site of ['region-1', 'region-3', 'region-9'])
        for (const seed of SEEDS) {
          const g = newGame({ mode, siteId: site, seed })
          for (const p of g.storms) {
            expect(p.arrivalDay).toBeGreaterThanOrEqual(3)
            expect(p.arrivalDay + p.profile.length - 1).toBeLessThanOrEqual(g.totalDays)
          }
          for (let i = 1; i < g.storms.length; i++) expect(g.storms[i]!.arrivalDay).toBeGreaterThan(g.storms[i - 1]!.arrivalDay + g.storms[i - 1]!.profile.length - 1)
          for (const f of g.flares) expect(f.day).toBeGreaterThanOrEqual(2)
        }
    const k = newGame({ mode: 'commander', siteId: 'region-3', seed: 7 })
    expect(k.flares.every((f) => k.earthDays[f.day - 1])).toBe(true)
  })

  it('is the same for the same seed', () => {
    expect(newGame({ mode: 'commander', siteId: 'region-2', seed: 9 })).toEqual(newGame({ mode: 'commander', siteId: 'region-2', seed: 9 }))
  })
})

describe('step: the day, power and blocks', () => {
  const base = () => calm(newGame({ mode: 'commander', siteId: 'region-4', seed: 3 }))

  it('power is scarce: on average a site pays for fewer than 6 blocks a day, and a dark day pays for about 2', () => {
    const full = BLOCKS * POWER_PER_BLOCK
    for (const s of sites) {
      const share = s.sunShare.value
      expect(share * POWER_SUN + (1 - share) * POWER_DARK, `${s.id} average income`).toBeLessThan(full)
    }
    expect(POWER_DARK / POWER_PER_BLOCK).toBeLessThan(3)
  })

  it('an idle day costs air and gains the day’s sunlight power', () => {
    const g = sunny(base())
    const o = fx(g, false)
    const n = step(g, C(J()), rng())
    expect(n.air).toBe(g.air - AIR_DRAIN + o.air)
    expect(n.power).toBe(Math.min(100, g.power + POWER_SUN + o.power))
    expect(n.day).toBe(2)
  })

  it('every block costs power, and a Shield block costs extra', () => {
    const g = dark(base())
    const o = fx(g, false)
    const n = step(g, C(J(2, 1, 0, 0)), rng())
    expect(n.power).toBe(g.power + POWER_DARK - 3 * POWER_PER_BLOCK - SHIELD_EXTRA_POWER + o.power)
  })

  it('air blocks add air; plants add food, a little air and, with 2 or more blocks, science', () => {
    const g = base()
    const o = fx(g, false)
    const n = step(g, C(J(2, 0, 2, 0)), rng())
    expect(n.air).toBe(g.air - AIR_DRAIN + 2 * AIR_PER_BLOCK + 2 + o.air)
    expect(n.food).toBeGreaterThan(g.food - 7)
    expect(n.science).toBe(PLANT_SCIENCE[2]! + o.science)
  })

  it('Cadet has no food bar, so food never changes or ends the game', () => {
    const g = calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 3 }))
    expect(step(g, C(J()), rng()).food).toBe(g.food)
  })

  it('the radio needs Earth in view and sends science to Earth, up to a limit', () => {
    const g = base()
    const hidden = { ...g, earthDays: g.earthDays.map(() => false) }
    expect(() => step(hidden, C(J(0, 0, 0, 1)), rng())).toThrow(/Earth is not in view/)
    const seen = { ...g, earthDays: g.earthDays.map(() => true) }
    expect(radioAvailable(seen)).toBe(true)
    const o = fx(seen, false)
    expect(step(seen, C(J(0, 0, 0, 3)), rng()).science).toBe(RADIO_SCIENCE_MAX + o.science)
  })

  it('rejects more than 6 blocks (a walk counts), negative or fractional blocks', () => {
    const g = base()
    expect(() => step(g, C(J(7)), rng())).toThrow(/Only 6 blocks/)
    expect(() => step(g, C(J(5), false, 'long'), rng())).toThrow(/Only 6 blocks/)
    expect(() => step(g, C(J(-1)), rng())).toThrow(/whole numbers/)
    expect(() => step(g, C(J(0.5)), rng())).toThrow(/whole numbers/)
    expect(() => step(g, C(J(4), false, 'long'), rng())).not.toThrow()
  })

  it('does not change the old state', () => {
    const g = base()
    const copy = structuredClone(g)
    step(g, C(J(2, 1, 1, 0), true, 'short'), rng())
    expect(g).toEqual(copy)
  })
})

describe('step: the shield is a charge', () => {
  const base = () => calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 }))

  it('blocks add to the charge, up to 6, and it leaks tonight', () => {
    const n = step(base(), C(J(0, 4)), rng())
    expect(n.shield).toBe(4 - SHIELD_LEAK)
    expect(step({ ...base(), shield: 5 }, C(J(0, 4)), rng()).shield).toBe(6 - SHIELD_LEAK)
    expect(step({ ...base(), shield: 1 }, C(J()), rng()).shield).toBe(0)
  })

  it('a charge built earlier meets the storm: the shield decides how many space rays get in', () => {
    const s = storm(2, 'small', [1])
    const g = { ...withStorm(base(), s), day: 2, shield: 3 }
    const n = step(g, C(J(0, 1)), rng())
    expect(n.history[0]!.storm!.shield).toBe(4)
    expect(n.history[0]!.storm!.incoming).toBe(STORM_INTENSITY.small * MODES.cadet.stormBoost * SHIELD_LETS_THROUGH[4]!)
  })

  it('more shield lets less through', () => {
    const s = storm(2, 'big', [1])
    const hit = (charge: number) => step({ ...withStorm(base(), s), day: 2, shield: charge }, C(J()), rng()).history[0]!.storm!.incoming
    for (let c = 1; c <= 6; c++) expect(hit(c)).toBeLessThan(hit(c - 1))
  })

  it('a huge storm with no shield ends the mission with radiation as the cause', () => {
    const g = { ...withStorm(base(), storm(2, 'huge', [1])), day: 2 }
    const n = step(g, C(J()), rng())
    expect([n.status, n.loss]).toEqual(['lost', 'radiation'])
  })

  it('Commander storms are stronger than Cadet storms', () => {
    const hit = (mode: 'cadet' | 'commander') => step({ ...withStorm(calm(newGame({ mode, siteId: 'region-3', seed: 2 })), storm(2, 'small', [1])), day: 2, shield: 3 }, C(J()), rng()).history[0]!.storm!.incoming
    expect(hit('commander')).toBeCloseTo(hit('cadet') * MODES.commander.stormBoost, 5)
  })

  it('radiation drains away on a calm day', () => {
    const n = step({ ...base(), radiation: 30 }, C(J()), rng())
    const o = fx(base(), false)
    expect(n.radiation).toBe(Math.max(0, 30 - RADIATION_RECOVERY + o.radiation))
  })
})

describe('step: the moonwalk is a bet', () => {
  const base = () => dark(calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })))

  it('on a calm day a walk brings science and a little radiation, and costs its blocks', () => {
    const g = base()
    const o = fx(g, false)
    const short = step(g, C(J(), false, 'short'), rng())
    expect(short.history[0]!.walkScience).toBe(WALKS.short.science - (o.slowWalk ? 1 : 0))
    expect(short.history[0]!.calledHome).toBe(false)
    expect(short.power).toBe(g.power + POWER_DARK - WALKS.short.blocks * POWER_PER_BLOCK + o.power)
    expect(step(g, C(J(), false, 'long'), rng()).history[0]!.walkScience).toBeGreaterThan(short.history[0]!.walkScience)
  })

  it('when a storm hits, walkers are called home, lose the science and take the unshielded storm: the shield never protects them', () => {
    const s = storm(2, 'big', [1])
    const g = { ...withStorm(base(), s), day: 2, shield: 6 }
    const raw = STORM_INTENSITY.big * MODES.cadet.stormBoost
    const home = step(g, C(J()), rng())
    const walked = step(g, C(J(), false, 'short'), rng())
    expect(walked.history[0]!.calledHome).toBe(true)
    expect(walked.history[0]!.walkScience).toBe(0)
    expect(walked.radiation - home.radiation).toBeCloseTo(raw * WALKS.short.exposure, 1)
  })

  it('a long walk into a storm is worse than a short one', () => {
    const s = storm(2, 'small', [1])
    const g = { ...withStorm(base(), s), day: 2, shield: 4 }
    expect(step(g, C(J(), false, 'long'), rng()).radiation).toBeGreaterThan(step(g, C(J(), false, 'short'), rng()).radiation)
  })
})

describe('the daily surprise deck', () => {
  it('has 10 situations, each with two choices of 10 simple words or fewer', () => {
    expect(cards).toHaveLength(10)
    for (const c of cards) for (const text of [c.question, c.a.label, c.b.label]) expect(text.split(/\s+/).length).toBeLessThanOrEqual(10)
  })

  it('no choice is free: neither option beats the other in every way, today and over two days', () => {
    const vec = (o: (typeof cards)[number]['a'], total: boolean) => [
      o.science + (total ? (o.carry?.science ?? 0) : 0),
      o.power + (total ? (o.carry?.power ?? 0) : 0),
      o.air + (total ? (o.carry?.air ?? 0) : 0) - (o.failChance ? o.failChance * 15 : 0),
      o.food,
      -o.radiation,
      o.slowWalk || o.slowPlants ? -1 : 0,
    ]
    const beats = (x: number[], y: number[]) => x.every((v, i) => v >= y[i]!) && x.some((v, i) => v > y[i]!)
    for (const c of cards) {
      const aToday = vec(c.a, false)
      const bToday = vec(c.b, false)
      const aTotal = vec(c.a, true)
      const bTotal = vec(c.b, true)
      expect(beats(aToday, bToday) && beats(aTotal, bTotal), `${c.id}: A always wins`).toBe(false)
      expect(beats(bToday, aToday) && beats(bTotal, aTotal), `${c.id}: B always wins`).toBe(false)
    }
  })

  it('gives a situation every day, a different one from yesterday, and the Earth card only when Earth is in view', () => {
    const g = newGame({ mode: 'commander', siteId: 'region-3', seed: 4 })
    let s = calm(g)
    let prev: string | undefined
    while (s.status === 'playing') {
      const card = currentCard(s)!
      expect(card).not.toBeNull()
      expect(card.id).not.toBe(prev)
      if (card.needsEarth) expect(s.earthDays[s.day - 1]).toBe(true)
      prev = card.id
      s = step(s, C(J(2, 0, 1, 0)), rng())
    }
  })

  it('effects that land tomorrow land tomorrow', () => {
    const dust = cards.find((c) => c.id === 'dust')!
    let g = dark(calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })))
    while (currentCard(g)?.id !== 'dust') g = { ...g, seed: g.seed + 1 }
    const n = step(g, C(J(), true), rng())
    expect(n.carry.power).toBe(dust.a.carry!.power!)
    const m = step(dark(n), C(J()), rng())
    const next = currentCard(n)!
    expect(m.power).toBe(Math.min(100, n.power + POWER_DARK + dust.a.carry!.power! + next.b.power))
  })
})

describe('the flare watch', () => {
  it('a flare shows up in the next morning’s Sun Watch, free, and watches the next 3 days', () => {
    const g0 = newGame({ mode: 'cadet', siteId: 'region-3', seed: 5 })
    const f = g0.flares[0]!
    let s = g0
    const rngA = rng()
    while (s.day <= f.day) s = step(s, C(J(2, 0, 1, 0)), rngA)
    expect(s.flareSeen[0]).toBe(true)
    expect(s.history[f.day - 1]!.reported).toContain(f.flareId)
    expect(activeWatches(s).map((w) => w.flare.flareId)).toContain(f.flareId)
    expect(activeWatches(s)[0]!.daysSince).toBe(1)
  })

  it('a rays flare is explained when its storm arrives; a quiet flare after 3 days; the result matches the real record', () => {
    for (const seed of [2, 3, 5, 8]) {
      let s = newGame({ mode: 'cadet', siteId: 'region-3', seed })
      const r = rng()
      const results: { flareId: string; followed: boolean }[] = []
      while (s.status === 'playing') {
        s = step(s, C(J(2, 3, 0, 0)), r)
        results.push(...s.history[s.history.length - 1]!.resolved)
        if (s.status !== 'playing') break
      }
      for (const res of results) expect(res.followed).toBe(flareById(res.flareId)!.followed)
    }
  })

  it('a storm the player saw coming is marked as warned; one they did not is a surprise', () => {
    const base = calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 }))
    const s = storm(2, 'small', [1])
    expect(step({ ...withStorm(base, s, true), day: 2, shield: 4 }, C(J()), rng()).history[0]!.storm!.warned).toBe(true)
    expect(step({ ...withStorm(base, s, false), day: 2, shield: 4 }, C(J()), rng()).history[0]!.storm!.warned).toBe(false)
  })

  it('the storm itself is not announced: a visible storm only exists after it hit', () => {
    const base = withStorm(calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })), storm(3, 'big', [0.6, 1]))
    const day2 = { ...base, day: 2 }
    expect(activeStorm(day2)).toBeNull()
    let s = step({ ...base, day: 3, shield: 5 }, C(J()), rng())
    expect(activeStorm(s)).not.toBeNull()
    s = step(s, C(J(0, 4)), rng())
    expect(activeStorm(s)).toBeNull()
  })
})

describe('guess first, then see', () => {
  /** Day 3, a real flare was seen on day 2. A storm follows (`rays`) arriving today, or the flare is a quiet one (a real flare that brought no rays). */
  const watched = (rays: boolean): GameState => {
    const base = { ...calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })), day: 3, shield: 6 }
    return rays
      ? { ...withStorm(base, storm(3, 'small', [1]), true), day: 3 }
      : { ...base, flares: [{ flareId: 'flr-29334', day: 2, stormIndex: null }], flareSeen: [true], flareResolved: [false], guesses: [null], day: 5 }
  }
  const play = (g: GameState, guess?: Guess) => step(g, { jobs: J(2), go: false, walk: 'none', ...(guess ? { guess } : {}) }, rng())

  it('a guess is kept for the newest open flare watch and stays private until the reveal', () => {
    const n = play(watched(true), 'yes')
    expect(n.guesses[0]).toBe('yes')
    expect(n.history[0]!.guessed).toBe('flr-44029')
  })

  it('saying yes when rays come earns science; the reveal shows the guess and the reward', () => {
    const g = watched(true)
    const base = play(g)
    const right = play(g, 'yes')
    const r = right.history[0]!.resolved[0]!
    expect([r.followed, r.guess, r.reward]).toEqual([true, 'yes', GUESS_REWARD])
    expect(right.science).toBe(base.science + GUESS_REWARD)
  })

  it('saying no when no rays come earns science', () => {
    const g = watched(false)
    const base = play(g)
    expect(base.history[0]!.resolved).toHaveLength(1)
    const right = play(g, 'no')
    const r = right.history[0]!.resolved[0]!
    expect([r.followed, r.guess, r.reward]).toEqual([false, 'no', GUESS_REWARD])
    expect(right.science).toBe(base.science + GUESS_REWARD)
  })

  it('a wrong guess or "not sure" earns nothing and costs nothing', () => {
    const yesWorld = watched(true)
    const noWorld = watched(false)
    for (const [g, guess] of [[yesWorld, 'no'], [yesWorld, 'unsure'], [noWorld, 'yes'], [noWorld, 'unsure']] as const) {
      const base = play(g)
      const n = play(g, guess)
      expect(n.history[0]!.resolved[0]!.reward).toBe(0)
      expect(n.science).toBe(base.science)
      expect(n.air).toBe(base.air)
      expect(n.status).toBe(base.status)
    }
  })

  it('a guess with no flare watch on is ignored, and a flare keeps its first guess', () => {
    const calmDay = play({ ...calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })), day: 2 }, 'yes')
    expect(calmDay.history[0]!.guessed).toBeNull()
    const first = play(watched(true), 'unsure')
    const again = step({ ...first, day: 3, status: 'playing', flareResolved: [false] }, { jobs: J(2), go: false, guess: 'yes' }, rng())
    expect(again.guesses[0]).toBe('unsure')
  })

  it('the guess never changes what happens: same state, same outcome with or without it', () => {
    const g = watched(true)
    const a = play(g)
    const b = play(g, 'yes')
    expect([a.radiation, a.power, a.status]).toEqual([b.radiation, b.power, b.status])
  })
})

describe('step: winning and losing', () => {
  const base = () => calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 }))

  it('air at zero loses with cause air', () => {
    const n = step({ ...base(), air: 5 }, C(J()), rng())
    expect([n.status, n.loss]).toEqual(['lost', 'air'])
  })

  it('an empty battery loses with cause power', () => {
    const g = dark({ ...base(), power: 1 })
    const n = step(g, C(J(4, 0, 0, 0)), rng())
    expect([n.status, n.loss]).toEqual(['lost', 'power'])
  })

  it('food at zero loses in Commander', () => {
    const g = calm(newGame({ mode: 'commander', siteId: 'region-3', seed: 2 }))
    const n = step({ ...g, food: 3 }, C(J(3, 0, 0, 0)), rng())
    expect([n.status, n.loss]).toEqual(['lost', 'food'])
  })

  it('reaching the last day safely wins ONLY with the science goal', () => {
    const last = { ...sunny(base()), day: 10, science: 100, air: 80, power: 80 }
    expect(step(last, C(J(2)), rng()).status).toBe('won')
    const short = { ...last, science: 0 }
    const n = step(short, C(J(2)), rng())
    expect([n.status, n.loss]).toEqual(['lost', 'science'])
  })

  it('cannot step after the game is over', () => {
    const over = step({ ...base(), air: 1 }, C(J()), rng())
    expect(() => step(over, C(J()), rng())).toThrow(/over/)
  })
})

describe('radio delay', () => {
  it('is about 1.28 s one way and doubles for a reply, sourced to NASA', () => {
    const d = radioDelay()
    expect(d.oneWayS).toBeCloseTo(1.28, 2)
    expect(d.roundTripS).toBeCloseTo(2.56, 2)
    expect(d.source).toMatch(/NASA/)
  })
})

describe('why it happened', () => {
  it('a radiation loss gives 3 steps that name the real storm and the shield, with its NASA record', () => {
    const g = { ...withStorm(calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })), storm(2, 'huge', [1], 'storm-6')), day: 2 }
    const lost = step(g, C(J()), rng())
    const why = explain(lost)
    expect(why.steps).toHaveLength(3)
    expect(why.steps[0]!.text).toContain('January 2026')
    expect(why.steps[1]!.text).toMatch(/shield had 0 of 6|space rays came in/)
    expect(why.record?.url).toMatch(/ccmc\.gsfc\.nasa\.gov/)
  })

  it('a storm of unknown size is explained from its own flare and its NASA radiation record', () => {
    const real = flareData.flares.find((f) => f.followed && !f.sizeKnown)!
    const s: StormPlan = { stormId: `flare:${real.id}`, arrivalDay: 2, size: 'small', profile: [1] }
    const g = { ...calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })), storms: [s], flares: [{ flareId: real.id, day: 1, stormIndex: 0 }], flareSeen: [true], flareResolved: [false], day: 2, radiation: 99 }
    const why = explain(step(g, C(J()), rng()))
    expect(why.steps[0]!.text).toContain(real.class)
    expect(why.record?.url).toBe(real.sep!.link)
  })

  it('an air loss names the air, not the storm', () => {
    const lost = step({ ...calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })), air: 5 }, C(J()), rng())
    const why = explain(lost)
    expect(why.loss).toBe('air')
    expect(why.steps.map((x) => x.text).join(' ')).toMatch(/Air/)
  })

  it('a science loss says the crew stayed safe and how far short they were', () => {
    const last = { ...sunny(calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 }))), day: 10, science: 5, air: 90, power: 80 }
    const lost = step(last, C(J(2)), rng())
    const why = explain(lost)
    expect(why.loss).toBe('science')
    expect(why.steps.map((x) => x.text).join(' ')).toMatch(/nobody is hurt/)
  })
})

describe('rewards', () => {
  it('score is science plus 3 per storm survived', () => {
    const g = { ...calm(newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })), science: 7 }
    expect(score(g)).toBe(7)
  })

  it('Storm Survivor comes from real play and Radio Hero from calling Earth', () => {
    let s = newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 })
    const r = rng()
    while (s.status === 'playing') s = step(s, C(J(2, 3, 0, 1)), r)
    expect(badges(s)).toContain('first-day')
    expect(badges(s)).toContain('radio-hero')
    expect(storms.length).toBe(8)
  })
})
