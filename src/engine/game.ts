import storms from '../data/storms.json'
import sites from '../data/sites.json'
import {
  AIR_DRAIN,
  AIR_PER_BLOCK,
  BLOCKS,
  FOOD_DRAIN,
  METER_MAX,
  MODES,
  PLANT_AIR,
  PLANT_FOOD,
  PLANT_SCIENCE,
  POWER_DARK,
  POWER_PER_BLOCK,
  POWER_SUN,
  RADIATION_RECOVERY,
  RADIO_ONE_WAY_S,
  RADIO_SCIENCE,
  RADIO_SCIENCE_MAX,
  RADIO_SOURCE,
  SHIELD_EXTRA_POWER,
  SHIELD_LEAK,
  SHIELD_LETS_THROUGH,
  SHIELD_MAX,
  START,
  STORM_INTENSITY,
  STORM_SCORE,
  WALKS,
  WATCH_DAYS,
} from './constants'
import { cards } from './cards'
import { quietWeight, raysWeight } from './hand'
import { FLARES_FOLLOWED, FLARES_NOT_FOLLOWED, flareById, flareForStorm, type FlareRecord } from './flares'
import { makeRng, type Rng } from './rng'
import { spreadDays, stormProfile } from './schedule'
import type { BadgeId, Card, Carry, Choice, DayRecord, FlareEvent, GameState, Loss, Meters, Mode, StormPlan, StormSize } from './types'

export { explain } from './explain'

export interface NewGameOptions {
  mode: Mode
  siteId: string
  seed: number
}

const round2 = (x: number) => Math.round(x * 100) / 100
const meters = (s: Meters): Meters => ({ air: s.air, power: s.power, radiation: s.radiation, food: s.food })
const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, k) => a + k)
const pick = <T>(list: T[], rng: Rng): T | undefined => list[Math.floor(rng() * list.length)]
function pickWeighted<T>(list: T[], weight: (x: T) => number, rng: Rng): T | undefined {
  const total = list.reduce((a, x) => a + weight(x), 0)
  let r = rng() * total
  for (const x of list) {
    r -= weight(x)
    if (r < 0) return x
  }
  return list[list.length - 1]
}

interface Planned {
  flare: FlareRecord
  stormId: string | null
  size: StormSize
  profile: number[]
  /** Days from the flare to the storm (real: from NASA's flare and radiation-storm times). */
  delay: number
}

/**
 * Plans the mission's real flares, in an order that teaches. Each real storm is announced by its own real flare; the other
 * flares are real flares NASA's list shows were NOT followed by space rays. The first flare is a big one with no gas cloud and
 * no rays, so "a big flash always means danger" is tested right away. Commander also has a big flare WITH a gas cloud that
 * brought no rays. Flares happen on days Earth is in view, so Commander's radio can send news.
 */
function planEvents(mode: Mode, earthDays: boolean[], rng: Rng): { storms: StormPlan[]; flares: FlareEvent[] } {
  const cfg = MODES[mode]
  const known = storms.filter((s) => !s.headline)
  const headline = storms.find((s) => s.headline)
  // A real storm we know in full (size and curve from NOAA GOES) ...
  const real = (p: (typeof storms)[number] | undefined): Planned => {
    if (!p) throw new Error('storm data missing')
    const flare = flareForStorm(p.id)
    if (!flare?.sep) throw new Error(`no real flare for ${p.id}`)
    return { flare, stormId: p.id, size: p.size as StormSize, profile: stormProfile(p.size as StormSize, p.curve?.relative ?? null), delay: flare.sep.delayDays }
  }
  // ... or another real flare NASA followed with a radiation storm. Its outcome is real, its size is not in our data, so it is a small storm.
  const other = (): Planned => {
    const f = pickWeighted(FLARES_FOLLOWED.filter((x) => !x.sizeKnown), raysWeight, rng)
    if (!f?.sep) throw new Error('no followed flare')
    return { flare: f, stormId: `flare:${f.id}`, size: 'small', profile: stormProfile('small', null), delay: f.sep.delayDays }
  }
  // A balanced hand: half the flares really brought rays, half did not. About half of the rays-flares are one of our 8 real storms.
  const firstYes = rng() < 0.5 ? real(pick(known, rng)) : other()
  const yes: Planned[] = mode === 'cadet' ? [firstYes] : [firstYes, real(headline)]

  const bigNoCloud = FLARES_NOT_FOLLOWED.filter((f) => f.class.startsWith('X') && !f.cloud)
  const bigCloud = FLARES_NOT_FOLLOWED.filter((f) => f.class.startsWith('X') && f.cloud)
  const taken = new Set<string>()
  const decoy = (list: FlareRecord[]): Planned => {
    let f = pickWeighted(list, quietWeight, rng)
    for (let i = 0; i < 50 && f && taken.has(f.id); i++) f = pickWeighted(list, quietWeight, rng)
    if (!f) throw new Error('no decoy flare')
    taken.add(f.id)
    return { flare: f, stormId: null, size: 'small', profile: [], delay: 0 }
  }
  const decoys: Planned[] = [decoy(bigNoCloud)]
  if (cfg.decoys >= 2) decoys.push(decoy(bigCloud))
  while (decoys.length < cfg.decoys) decoys.push(decoy(FLARES_NOT_FOLLOWED))

  // Cadet: [misleading big flare, the storm]. Commander: [misleading big flare, storm, cloud flare with no rays, storm, ...].
  const events: Planned[] = []
  const d = decoys.slice()
  const y = yes.slice()
  while (d.length || y.length) {
    const nextDecoy = d.shift()
    if (nextDecoy) events.push(nextDecoy)
    const nextYes = y.shift()
    if (nextYes) events.push(nextYes)
  }

  // Place them over the mission: one slot each, on Earth-view days, storms kept apart, nothing after the last day.
  const n = events.length
  const lo = 2
  const hi = cfg.days - 2
  const used = new Set<number>()
  let stormFree = 0
  const placed = events.map((p, i) => {
    const maxDay = p.stormId ? Math.min(hi, cfg.days - 1 - p.delay) : hi
    const minDay = Math.max(lo, p.stormId ? stormFree - p.delay : lo)
    const start = lo + Math.floor((i * (hi - lo + 1)) / n)
    const end = lo + Math.floor(((i + 1) * (hi - lo + 1)) / n) - 1
    const ok = (day: number) => day >= minDay && day <= maxDay && !used.has(day)
    const earth = (day: number) => earthDays[day - 1] === true
    let cands = range(start, end).filter((day) => ok(day) && earth(day))
    if (!cands.length) cands = range(minDay, maxDay).filter((day) => ok(day) && earth(day))
    if (!cands.length) cands = range(minDay, maxDay).filter(ok)
    if (!cands.length) cands = range(lo, hi).filter((day) => !used.has(day))
    const day = cands[Math.floor(rng() * cands.length)] ?? lo
    used.add(day)
    if (p.stormId) stormFree = day + p.delay + p.profile.length
    return { p, day }
  })
  placed.sort((a, b) => a.day - b.day)

  const stormPlans: StormPlan[] = []
  const flares: FlareEvent[] = placed.map(({ p, day }) => {
    let stormIndex: number | null = null
    if (p.stormId) {
      stormIndex = stormPlans.length
      stormPlans.push({ stormId: p.stormId, arrivalDay: day + p.delay, size: p.size, profile: p.profile })
    }
    return { flareId: p.flare.id, day, stormIndex }
  })
  return { storms: stormPlans, flares }
}

export function newGame(o: NewGameOptions): GameState {
  const cfg = MODES[o.mode]
  const site = sites.find((s) => s.id === o.siteId)
  if (!site) throw new Error(`Unknown site ${o.siteId}`)
  const rng = makeRng(o.seed)
  const sunDays = spreadDays(site.sunShare.value, cfg.days, 0.5)
  const earthDays = o.mode === 'cadet' ? Array<boolean>(cfg.days).fill(true) : spreadDays(site.earthShare.value, cfg.days, 0.2)
  const plan = planEvents(o.mode, earthDays, rng)
  return {
    mode: o.mode,
    siteId: o.siteId,
    seed: o.seed,
    totalDays: cfg.days,
    hasFood: cfg.hasFood,
    day: 1,
    status: 'playing',
    ...START,
    science: 0,
    goal: cfg.goal,
    shield: 0,
    carry: { power: 0, air: 0, science: 0 },
    sunDays,
    earthDays,
    storms: plan.storms,
    flares: plan.flares,
    flareSeen: plan.flares.map(() => false),
    flareResolved: plan.flares.map(() => false),
    history: [],
  }
}

export function radioAvailable(s: GameState): boolean {
  return s.status === 'playing' && s.earthDays[s.day - 1] === true
}

export function radioDelay() {
  return { oneWayS: RADIO_ONE_WAY_S, roundTripS: RADIO_ONE_WAY_S * 2, source: RADIO_SOURCE }
}

function hitIndex(s: GameState, day: number): number {
  return s.storms.findIndex((p) => day >= p.arrivalDay && day < p.arrivalDay + p.profile.length)
}

/** Index of the flare watch the player knows about on this day (shown in the Sun Watch, not yet explained, within 3 days of the flare), or -1. */
export function watchedFlare(s: GameState, day = s.day): number {
  return s.flares.findIndex((f, i) => s.flareSeen[i] === true && !s.flareResolved[i] && day > f.day && day <= f.day + WATCH_DAYS)
}

export interface ActiveWatch {
  index: number
  flare: FlareEvent
  record: FlareRecord
  /** Days since the flare (1 = yesterday). */
  daysSince: number
  /** Days of the 3-day watch still to come, counting today. */
  daysLeft: number
}

/** Every flare watch on today (watches can overlap). None of them says whether space rays will really come. */
export function activeWatches(s: GameState): ActiveWatch[] {
  if (s.status !== 'playing') return []
  const out: ActiveWatch[] = []
  s.flares.forEach((flare, index) => {
    const record = flareById(flare.flareId)
    if (!record || s.flareSeen[index] !== true || s.flareResolved[index]) return
    if (s.day > flare.day && s.day <= flare.day + WATCH_DAYS) out.push({ index, flare, record, daysSince: s.day - flare.day, daysLeft: flare.day + WATCH_DAYS - s.day + 1 })
  })
  return out
}

/** The newest flare watch today, or null. */
export function activeWatch(s: GameState): ActiveWatch | null {
  const all = activeWatches(s)
  return all[all.length - 1] ?? null
}

/** A storm the player can see is here: it hit yesterday and its profile still has days to run. */
export function activeStorm(s: GameState): { index: number; daysLeft: number } | null {
  if (s.status !== 'playing') return null
  const index = s.history[s.history.length - 1]?.storm?.index
  const plan = index === undefined ? undefined : s.storms[index]
  if (index === undefined || !plan) return null
  const lastDay = plan.arrivalDay + plan.profile.length - 1
  return s.day <= lastDay ? { index, daysLeft: lastDay - s.day + 1 } : null
}

/** Today's situation: a different one each day, and one that needs Earth only when Earth is in view. */
export function currentCard(s: GameState): Card | null {
  if (s.status !== 'playing') return null
  const earth = s.earthDays[s.day - 1] === true
  const previous = s.history[s.history.length - 1]?.cardId
  const deck = cards.filter((c) => (earth || !c.needsEarth) && c.id !== previous)
  return deck[(s.seed * 7 + s.day * 3) % deck.length] ?? null
}

/** A repeatable 0..1 roll for today (so "may break tomorrow" is the same every time the same game is replayed). */
const roll = (seed: number, day: number) => (((seed * 2654435761 + day * 40503) >>> 0) % 1000) / 1000

export function step(state: GameState, choice: Choice, rng: Rng): GameState {
  if (state.status !== 'playing') throw new Error('The mission is over')
  const j = choice.jobs
  const walk = choice.walk ?? 'none'
  const W = WALKS[walk]
  const list = [j.air, j.shield, j.plants, j.radio]
  if (list.some((n) => !Number.isInteger(n) || n < 0)) throw new Error('Blocks must be whole numbers, 0 or more')
  const used = list.reduce((a, b) => a + b, 0) + W.blocks
  if (used > BLOCKS) throw new Error(`Only ${BLOCKS} blocks to share`)
  const d = state.day
  const cfg = MODES[state.mode]
  const earth = state.earthDays[d - 1] === true
  if (j.radio > 0 && !earth) throw new Error('Earth is not in view today, the radio cannot reach it')
  const sunny = state.sunDays[d - 1] === true
  const before = meters(state)

  const card = currentCard(state)
  const picked = card ? (choice.go ? card.a : card.b) : null

  // Yesterday's choices land this morning.
  let air = state.air - AIR_DRAIN + j.air * AIR_PER_BLOCK + j.plants * PLANT_AIR + state.carry.air
  let power = state.power + (sunny ? POWER_SUN : POWER_DARK) - used * POWER_PER_BLOCK - j.shield * SHIELD_EXTRA_POWER + state.carry.power
  let food = state.hasFood ? state.food - FOOD_DRAIN + j.plants * PLANT_FOOD : state.food
  let radiation = state.radiation
  const plantScience = Math.max(0, (PLANT_SCIENCE[Math.min(j.plants, 6)] ?? 0) - (picked?.slowPlants ? 1 : 0))
  const radioScience = Math.min(RADIO_SCIENCE_MAX, j.radio) * RADIO_SCIENCE
  let science = state.science + state.carry.science + plantScience + radioScience

  // The shield is a charge: today's blocks add to what is left from before, and 1 leaks away tonight.
  const charge = Math.min(SHIELD_MAX, state.shield + j.shield)

  const idx = hitIndex(state, d)
  let storm: DayRecord['storm'] = null
  let calledHome = false
  let walkScience = 0
  if (idx >= 0) {
    const plan = state.storms[idx]!
    const factor = plan.profile[d - plan.arrivalDay] ?? 0
    const letsThrough = SHIELD_LETS_THROUGH[charge] ?? 1
    const raw = STORM_INTENSITY[plan.size] * cfg.stormBoost * factor
    const incoming = round2(raw * letsThrough)
    radiation += incoming
    // The shield never protects walkers: they take their share of the unshielded storm, and are called home.
    if (walk !== 'none') {
      radiation += raw * W.exposure
      calledHome = true
    }
    const flareIndex = state.flares.findIndex((f) => f.stormIndex === idx)
    storm = { index: idx, factor, shield: charge, letsThrough, incoming, warned: state.flareSeen[flareIndex] === true }
  } else {
    radiation = Math.max(0, radiation - RADIATION_RECOVERY)
    if (walk !== 'none') {
      walkScience = Math.max(0, W.science - (picked?.slowWalk ? 1 : 0))
      radiation += W.background
    }
  }
  science += walkScience

  // Today's situation. Some costs land tomorrow.
  const nextCarry: Carry = { power: 0, air: 0, science: 0 }
  if (picked) {
    science += picked.science
    power += picked.power
    air += picked.air
    radiation += picked.radiation
    if (state.hasFood) food += picked.food
    nextCarry.power += picked.carry?.power ?? 0
    nextCarry.air += picked.carry?.air ?? 0
    nextCarry.science += picked.carry?.science ?? 0
    if (picked.failChance && roll(state.seed, d) < picked.failChance) nextCarry.air -= 15
  }

  const watching = watchedFlare(state, d) >= 0

  // A flare shows up in the next morning's Sun Watch, free. (Radio is for sending science to Earth.)
  const flareSeen = [...state.flareSeen]
  const reported: string[] = []
  state.flares.forEach((f, i) => {
    if (!flareSeen[i] && f.day <= d) {
      flareSeen[i] = true
      reported.push(f.flareId)
    }
  })

  // A flare is explained when its storm arrives, or when its 3-day watch ends with nothing.
  const flareResolved = [...state.flareResolved]
  const resolved: DayRecord['resolved'] = []
  state.flares.forEach((f, i) => {
    if (flareResolved[i] || !flareSeen[i]) return
    const own = f.stormIndex === null ? undefined : state.storms[f.stormIndex]
    if (own && own.arrivalDay === d) {
      flareResolved[i] = true
      resolved.push({ flareId: f.flareId, followed: true })
    } else if (f.stormIndex === null && d >= f.day + WATCH_DAYS) {
      flareResolved[i] = true
      resolved.push({ flareId: f.flareId, followed: false })
    }
  })

  air = round2(Math.min(METER_MAX, Math.max(0, air)))
  power = round2(Math.min(METER_MAX, Math.max(0, power)))
  food = round2(Math.min(METER_MAX, Math.max(0, food)))
  radiation = round2(Math.min(METER_MAX, Math.max(0, radiation)))
  const after: Meters = { air, power, radiation, food }

  const lastDay = d >= state.totalDays
  let loss: Loss | undefined
  if (radiation >= METER_MAX) loss = 'radiation'
  else if (air <= 0) loss = 'air'
  else if (state.hasFood && food <= 0) loss = 'food'
  else if (power <= 0) loss = 'power'
  else if (lastDay && science < state.goal) loss = 'science'

  const shieldAfter = Math.max(0, charge - SHIELD_LEAK)
  const record: DayRecord = {
    day: d,
    jobs: { ...j },
    sunny,
    earthInView: earth,
    radioWorked: j.radio > 0,
    storm,
    cardId: card?.id ?? null,
    went: card !== null && choice.go,
    walk,
    walkScience,
    calledHome,
    watching,
    reported,
    resolved,
    shieldAfter,
    before,
    after,
    flavour: Math.floor(rng() * 1000),
  }

  const next: GameState = {
    ...state,
    ...after,
    science,
    shield: shieldAfter,
    carry: nextCarry,
    flareSeen,
    flareResolved,
    history: [...state.history, record],
    status: loss ? 'lost' : lastDay ? 'won' : 'playing',
    day: loss || lastDay ? d : d + 1,
  }
  if (loss) next.loss = loss
  return next
}

export function stormsSurvived(s: GameState): number {
  const played = s.history.length
  return s.storms.filter((p) => {
    const lastHitDay = p.arrivalDay + p.profile.length - 1
    if (s.status === 'won') return p.arrivalDay <= played
    return lastHitDay < played || (lastHitDay === played && s.status === 'playing')
  }).length
}

export function score(s: GameState): number {
  return s.science + STORM_SCORE * stormsSurvived(s)
}

export function badges(s: GameState): BadgeId[] {
  const out: BadgeId[] = []
  const played = s.history.length
  if (played >= 1 && !(s.status === 'lost' && played === 1)) out.push('first-day')
  if (stormsSurvived(s) > 0) out.push('storm-survivor')
  if (s.history.filter((r) => r.jobs.plants >= 1).length >= 5) out.push('green-thumb')
  if (s.history.some((r) => r.radioWorked)) out.push('radio-hero')
  const safe = s.status === 'lost' ? s.history.slice(0, -1) : s.history
  for (let i = 1; i < safe.length; i++) {
    if (!safe[i]?.sunny && !safe[i - 1]?.sunny) {
      out.push('night-owl')
      break
    }
  }
  return out
}
