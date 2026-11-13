import { describe, expect, it } from 'vitest'
import flareData from '../data/flares.json'
import { HIGH_RADIATION, LOW } from '../ui/look'
import { bots, playBot } from './bots'
import { GUESS_REWARD, MODES, TRAINING_DAYS, TRAINING_FLARE_ID, TRAINING_FLOOR, TRAINING_RADIATION_MAX, WATCH_DAYS } from './constants'
import { classValue, flareById } from './flares'
import { activeWatch, newGame, step } from './game'
import { makeRng } from './rng'
import type { Choice, GameState, Jobs, Mode, Walk } from './types'

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1)
const MODE_LIST: Mode[] = ['cadet', 'commander']
const J = (air = 0, shield = 0, plants = 0, radio = 0): Jobs => ({ air, shield, plants, radio })
const C = (jobs: Jobs, go = false, walk: Walk = 'none'): Choice => ({ jobs, go, walk })
const training = (mode: Mode, seed: number, siteId = 'region-3') => newGame({ mode, siteId, seed, training: true })
/** The UI lines for a worried crew (src/ui/look.ts): air < 35, power < 30, food < 35, radiation >= 60. */
const worried = (g: GameState) => g.air < 35 || g.power < 30 || (g.hasFood && g.food < 35) || g.radiation >= 60

/** Every way to share the blocks between Air, Shield and Plants with this walk. */
function allJobs(walk: Walk): Jobs[] {
  const left = 6 - (walk === 'long' ? 2 : walk === 'short' ? 1 : 0)
  const out: Jobs[] = []
  for (let a = 0; a <= left; a++) for (let s = 0; s <= left - a; s++) for (let p = 0; p <= left - a - s; p++) out.push(J(a, s, p, 0))
  return out
}
const WALK_LIST: Walk[] = ['none', 'short', 'long']
/** The choices that hurt most: nothing on anything, everything on the hungry shield, and a long walk into the storm. */
const WORST: Choice[] = [C(J(), false, 'long'), C(J(), true, 'long'), C(J(), false), C(J(0, 6), true), C(J(0, 4), false, 'long'), C(J(0, 0, 6), true)]

describe('training: Day 1 uses one fixed real flare', () => {
  it('is the biggest real flare of M5 or more with a gas cloud that a >10 MeV radiation storm followed within 72 hours', () => {
    const rule = flareData.flares
      .filter((f) => classValue(f.class) >= 5e-5 && f.cloud && f.followed && f.sep !== null && f.sep.hoursAfterPeak <= 72 && f.sep.instrument.includes('>10 MeV'))
      .sort((a, b) => classValue(b.class) - classValue(a.class))
    expect(rule.length).toBeGreaterThan(1)
    expect(classValue(rule[0]!.class)).toBeGreaterThan(classValue(rule[1]!.class))
    expect(rule[0]!.id).toBe(TRAINING_FLARE_ID)
    expect(TRAINING_FLARE_ID).toBe('flr-13010')
    expect(rule[0]!.link).toBe('https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/13010/-1')
  })

  it('the flare is in the Sun Watch on the morning of Day 1 and its real storm arrives that day (cadet and commander, every seed)', () => {
    for (const mode of MODE_LIST)
      for (const seed of SEEDS) {
        const g = training(mode, seed)
        expect(g.training).toBe(true)
        expect(g.day).toBe(1)
        expect(g.flares[0]).toEqual({ flareId: TRAINING_FLARE_ID, day: 0, stormIndex: 0 })
        expect(g.flares.filter((f) => f.flareId === TRAINING_FLARE_ID)).toHaveLength(1)
        expect(g.flareSeen).toEqual(g.flares.map((_, i) => i === 0))
        const w = activeWatch(g)!
        expect(w.record).toBe(flareById(TRAINING_FLARE_ID))
        expect([w.index, w.daysSince]).toEqual([0, 1])
        expect(g.storms[0]).toEqual({ stormId: 'storm-1', arrivalDay: 1, size: 'big', profile: [0.6, 1] })
        // The whole storm is inside the assisted days.
        expect(g.storms[0]!.arrivalDay + g.storms[0]!.profile.length - 1).toBe(TRAINING_DAYS)
      }
  })

  it('leaves the real record untouched: same label, and the reveal says rays came', () => {
    const rec = flareById(TRAINING_FLARE_ID)!
    expect(rec).toBe(flareData.flares.find((f) => f.id === TRAINING_FLARE_ID))
    expect([rec.class, rec.cloud, rec.followed, rec.side, rec.stormId]).toEqual(['X9.3', true, true, 'west', 'storm-1'])
    expect(rec.sep).toMatchObject({ hoursAfterPeak: 11.7, delayDays: 1, instrument: 'GOES13: SEM/EPS >10 MeV' })
    for (const guess of ['yes', 'no', 'unsure'] as const) {
      const g = step(training('cadet', 4), { ...C(J(2, 3, 1, 0)), guess }, makeRng(1))
      expect(g.history[0]!.guessed).toBe(TRAINING_FLARE_ID)
      expect(g.history[0]!.resolved).toEqual([{ flareId: TRAINING_FLARE_ID, followed: true, guess, reward: guess === 'yes' ? GUESS_REWARD : 0 }])
      expect(g.history[0]!.storm).toMatchObject({ index: 0, factor: 0.6, warned: true })
      expect(g.flareResolved[0]).toBe(true)
    }
  })

  it('is dealt, timed and revealed exactly as the same flare in a normal game', () => {
    // A normal game that happens to deal the same real storm.
    let found: GameState | null = null
    for (let seed = 1; seed <= 400 && !found; seed++) {
      const n = newGame({ mode: 'cadet', siteId: 'region-3', seed })
      if (n.flares.some((f) => f.flareId === TRAINING_FLARE_ID)) found = n
    }
    expect(found).not.toBeNull()
    let n = found!
    const fe = n.flares.find((f) => f.flareId === TRAINING_FLARE_ID)!
    const t = training('cadet', 4)
    const plan = n.storms[fe.stormIndex!]!
    expect({ ...plan, arrivalDay: 0 }).toEqual({ ...t.storms[0]!, arrivalDay: 0 })
    expect(plan.arrivalDay - fe.day).toBe(t.storms[0]!.arrivalDay - t.flares[0]!.day)
    while (n.day < plan.arrivalDay) n = step(n, C(J(2, 1, 1, 0)), makeRng(1))
    expect(activeWatch(n)!.record).toBe(activeWatch(t)!.record)
    n = step(n, { ...C(J(2, 3, 1, 0)), guess: 'yes' }, makeRng(1))
    const tn = step(t, { ...C(J(2, 3, 1, 0)), guess: 'yes' }, makeRng(1))
    const reveal = n.history[n.history.length - 1]!.resolved.find((r) => r.flareId === TRAINING_FLARE_ID)
    expect(reveal).toEqual(tn.history[0]!.resolved[0])
  })

  it('keeps the mission the same size, every flare real with its real outcome, and nothing new on the assisted days', () => {
    for (const mode of MODE_LIST)
      for (const seed of SEEDS) {
        const n = newGame({ mode, siteId: 'region-3', seed })
        const t = training(mode, seed)
        expect(t.flares).toHaveLength(n.flares.length)
        expect(t.storms).toHaveLength(MODES[mode].stormCount)
        expect([t.totalDays, t.goal, t.sunDays, t.earthDays, t.air, t.power, t.food, t.radiation]).toEqual([n.totalDays, n.goal, n.sunDays, n.earthDays, n.air, n.power, n.food, n.radiation])
        for (const f of t.flares) expect(flareById(f.flareId)!.followed).toBe(f.stormIndex !== null)
        expect(new Set(t.flares.map((f) => f.flareId)).size).toBe(t.flares.length)
        expect(new Set(t.flares.map((f) => f.day)).size).toBe(t.flares.length)
        t.flares.slice(1).forEach((f) => {
          expect(f.day).toBeGreaterThan(TRAINING_DAYS)
          // A flare with no rays is explained before the mission ends.
          if (f.stormIndex === null) expect(f.day + WATCH_DAYS).toBeLessThanOrEqual(t.totalDays)
        })
        for (let i = 1; i < t.storms.length; i++) {
          expect(t.storms[i]!.arrivalDay).toBeGreaterThan(TRAINING_DAYS)
          expect(t.storms[i]!.arrivalDay).toBeGreaterThan(t.storms[i - 1]!.arrivalDay + t.storms[i - 1]!.profile.length - 1)
        }
        for (const p of t.storms) expect(p.arrivalDay + p.profile.length - 1).toBeLessThanOrEqual(t.totalDays)
      }
  })

  it('is repeatable: the same seed gives the same training game', () => {
    for (const mode of MODE_LIST) expect(training(mode, 9)).toEqual(training(mode, 9))
  })
})

describe('training: Days 1 and 2 cannot be lost', () => {
  it('uses the same worried lines as the crew faces in the UI (src/ui/look.ts)', () => {
    expect(TRAINING_DAYS).toBe(2)
    expect(TRAINING_FLOOR).toEqual(LOW)
    expect(TRAINING_RADIATION_MAX).toBeLessThan(HIGH_RADIATION)
    expect([TRAINING_FLOOR.air, TRAINING_FLOOR.power, TRAINING_FLOOR.food, TRAINING_RADIATION_MAX]).toEqual([35, 30, 35, 59])
  })

  it('the worst choices on both days leave nobody worried, on every seed, site and mode', () => {
    for (const mode of MODE_LIST)
      for (const siteId of ['region-1', 'region-3', 'region-9'])
        for (const seed of SEEDS)
          for (const first of WORST)
            for (const second of WORST) {
              const d1 = step(training(mode, seed, siteId), first, makeRng(1))
              expect([d1.status, d1.day, worried(d1)]).toEqual(['playing', 2, false])
              const d2 = step(d1, second, makeRng(1))
              expect([d2.status, d2.day, worried(d2)]).toEqual(['playing', 3, false])
            }
  })

  it('no choice at all (every job split, every walk, both card options, sunny or dark) can worry the crew on Day 1 or Day 2', () => {
    for (const mode of MODE_LIST) {
      const g0 = training(mode, 5)
      // Day 2 from the worst place Day 1 can leave the base: every meter on its line, the shield empty.
      const worstDay2: GameState = { ...step(g0, C(J(), false, 'long'), makeRng(1)), ...TRAINING_FLOOR, radiation: TRAINING_RADIATION_MAX, shield: 0, carry: { power: -20, air: -15, science: 0 } }
      expect(worstDay2.day).toBe(2)
      for (const g of [g0, worstDay2])
        for (const sun of [true, false])
          for (const walk of WALK_LIST)
            for (const go of [true, false])
              for (const jobs of allJobs(walk)) {
                const n = step({ ...g, sunDays: g.sunDays.map(() => sun) }, C(jobs, go, walk), makeRng(1))
                expect(n.status).toBe('playing')
                expect(worried(n)).toBe(false)
              }
    }
  })

  it('holds a meter exactly on its line when the day would push it past, and says which', () => {
    const g: GameState = { ...training('commander', 5), air: 36, power: 31, food: 36, radiation: 58 }
    const n = step(g, C(J(0, 4, 0, 0), true, 'long'), makeRng(1))
    expect([n.air, n.power, n.food, n.radiation]).toEqual([35, 30, 35, 59])
    expect(n.history[0]!.after).toEqual({ air: 35, power: 30, radiation: 59, food: 35 })
    expect(n.history[0]!.held).toEqual(['air', 'power', 'food', 'radiation'])
    expect(n.status).toBe('playing')
  })

  it('the storm itself is not changed: the record keeps the real rays that came in', () => {
    const t = training('cadet', 4)
    const n = step(t, C(J(), false, 'long'), makeRng(1))
    // Big storm 125, first day 0.6, no shield: 75 comes in, and the walkers take the same again.
    expect(n.history[0]!.storm).toMatchObject({ factor: 0.6, shield: 0, letsThrough: 1, incoming: 75 })
    expect(n.history[0]!.calledHome).toBe(true)
    expect(n.radiation).toBe(59)
    expect(n.history[0]!.held).toEqual(['radiation'])
    // Cadet has no food bar, so food is never held.
    expect(n.food).toBe(t.food)
  })

  it('a day that stays clear of the lines is left alone, with no "held" note', () => {
    const t = training('commander', 3)
    const choice = C(J(2, 3, 1, 0))
    const n = step(t, choice, makeRng(1))
    const plain: GameState = { ...t }
    delete plain.training
    const { training: _flag, ...rest } = n
    expect(rest).toEqual(step(plain, choice, makeRng(1)))
    expect('held' in n.history[0]!).toBe(false)
  })

  it('a base that would be lost on Day 1 or Day 2 in a normal game is kept safe in training', () => {
    for (const day of [1, 2]) {
      const base: GameState = { ...newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 }), day, air: 10, power: 5 }
      expect(step(base, C(J(), false, 'long'), makeRng(1)).status).toBe('lost')
      const n = step({ ...base, training: true }, C(J(), false, 'long'), makeRng(1))
      expect(n.status).toBe('playing')
      expect(worried(n)).toBe(false)
    }
  })
})

describe('training: from Day 3 the game is normal', () => {
  it('every day from Day 3 steps exactly as it would without the training flag', () => {
    for (const mode of MODE_LIST)
      for (const seed of SEEDS) {
        let a = step(step(training(mode, seed), C(J(), false, 'long'), makeRng(1)), C(J(), true, 'long'), makeRng(1))
        expect(a.day).toBe(3)
        const rngA = makeRng(seed)
        const rngB = makeRng(seed)
        let i = 0
        while (a.status === 'playing') {
          const b: GameState = { ...a }
          delete b.training
          const choice = i % 3 === 0 ? C(J(2, 1, 1, 0)) : i % 3 === 1 ? C(J(1, 0, 2, 0), true, 'short') : C(J(0, 0, 0, 0), true, 'long')
          const nb = step(b, choice, rngB)
          a = step(a, choice, rngA)
          const { training: _flag, ...rest } = a
          expect(rest).toEqual(nb)
          expect('held' in a.history[a.history.length - 1]!).toBe(false)
          i++
        }
      }
  })

  it('Day 3 gets no help: the meters go past the worried lines, and the mission can be lost', () => {
    const d3 = step(step(training('commander', 3), C(J(), false, 'long'), makeRng(1)), C(J(), false, 'long'), makeRng(1))
    expect([d3.day, d3.status, worried(d3)]).toEqual([3, 'playing', false])
    const hurt = step(d3, C(J(0, 6, 0, 0)), makeRng(1))
    expect(worried(hurt)).toBe(true)
    const lost = step({ ...d3, air: 5 }, C(J()), makeRng(1))
    expect([lost.status, lost.loss]).toEqual(['lost', 'air'])
  })
})

describe('normal mode is unchanged', () => {
  it('has no training key, and training: false is the same as leaving it out', () => {
    for (const mode of MODE_LIST) {
      const g = newGame({ mode, siteId: 'region-3', seed: 7 })
      expect('training' in g).toBe(false)
      expect(g.flareSeen.every((x) => !x)).toBe(true)
      expect(g.flares.every((f) => f.day >= 2)).toBe(true)
      expect(newGame({ mode, siteId: 'region-3', seed: 7, training: false })).toEqual(g)
      expect(JSON.stringify(newGame({ mode, siteId: 'region-3', seed: 7, training: false }))).toBe(JSON.stringify(g))
      expect('training' in step(g, C(J(2, 2, 1, 0)), makeRng(1))).toBe(false)
    }
  })

  it('a normal game gets no help on Day 1 or Day 2', () => {
    const base: GameState = { ...newGame({ mode: 'commander', siteId: 'region-3', seed: 2 }), air: 40, power: 34 }
    const n = step(base, C(J(0, 6, 0, 0)), makeRng(1))
    expect(worried(n)).toBe(true)
    expect('held' in n.history[0]!).toBe(false)
  })

  it('the bots never play a training game', () => {
    for (const name of ['smart', 'random', 'idle'] as const)
      for (const mode of MODE_LIST) {
        const g = playBot(bots[name], { mode, siteId: 'region-3', seed: 3 })
        expect('training' in g).toBe(false)
        expect(g.flares.every((f) => f.day >= 2)).toBe(true)
        expect(g.history.every((r) => !('held' in r))).toBe(true)
      }
  })

  // FNV-1a of every new game and a scripted play-through, recorded from the code before the training option existed (commit 8d55f3d).
  const fnv = (text: string) => {
    let h = 0x811c9dc5
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0
    return h
  }
  function played(mode: Mode, siteId: string, seed: number): string {
    let g = newGame({ mode, siteId, seed })
    const parts = [JSON.stringify(g)]
    const rng = makeRng(seed + 1000)
    let i = 0
    while (g.status === 'playing') {
      const walk: Walk = i % 3 === 0 ? 'short' : i % 5 === 0 ? 'long' : 'none'
      const jobs = i % 2 === 0 ? J(1, 1, 1, 0) : J(1, 0, 2, 0)
      g = step(g, { jobs, go: i % 2 === 0, walk, guess: i % 4 === 1 ? 'yes' : i % 4 === 3 ? 'no' : 'unsure' }, rng)
      parts.push(JSON.stringify(g))
      i++
    }
    return parts.join('|')
  }

  it('gives byte-identical new games and play-throughs for the same seeds', () => {
    const all: string[] = []
    for (const mode of MODE_LIST) for (const siteId of ['region-1', 'region-3', 'region-9']) for (const seed of [1, 2, 3, 7, 11, 25, 40]) all.push(played(mode, siteId, seed))
    expect(fnv(all.join('#'))).toBe(1022899630)
  })
})
