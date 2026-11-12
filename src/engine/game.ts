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
  POWER_DARK,
  POWER_PER_BLOCK,
  POWER_SUN,
  RADIATION_RECOVERY,
  RADIO_ONE_WAY_S,
  RADIO_SOURCE,
  SHIELD_LETS_THROUGH,
  START,
  STORM_INTENSITY,
  STORM_SCORE,
} from './constants'
import { cards } from './cards'
import { makeRng, type Rng } from './rng'
import { spreadDays, stormProfile } from './schedule'
import type { BadgeId, Card, Choice, DayRecord, GameState, Loss, Meters, Mode, StormPlan, StormSize } from './types'

export { explain } from './explain'

export interface NewGameOptions {
  mode: Mode
  siteId: string
  seed: number
}

const round2 = (x: number) => Math.round(x * 100) / 100
const meters = (s: Meters): Meters => ({ air: s.air, power: s.power, radiation: s.radiation, food: s.food })

function planStorms(mode: Mode, radioDays: boolean[], rng: Rng): StormPlan[] {
  const cfg = MODES[mode]
  const pool = storms.filter((s) => !s.headline)
  const headline = storms.find((s) => s.headline)
  const first = pool[Math.floor(rng() * pool.length)]
  const picks = mode === 'cadet' ? [first] : [first, headline]
  const plans: StormPlan[] = []
  let earliest = mode === 'cadet' ? 3 : 4
  picks.forEach((pick, i) => {
    if (!pick) throw new Error('storm data missing')
    const size = pick.size as StormSize
    const profile = stormProfile(size, pick.curve?.relative ?? null)
    const latest = Math.min(cfg.days - 2, i === 0 ? (mode === 'cadet' ? 8 : 9) : cfg.days - 2)
    const days: number[] = []
    for (let a = earliest; a <= latest; a++) days.push(a)
    const warnable = days.filter((a) => {
      for (let r = Math.max(1, a - cfg.lookahead); r < a; r++) if (radioDays[r - 1]) return true
      return false
    })
    const options = warnable.length > 0 ? warnable : days.length > 0 ? days : [earliest]
    const arrivalDay = options[Math.floor(rng() * options.length)] ?? earliest
    plans.push({ stormId: pick.id, arrivalDay, size, profile })
    earliest = arrivalDay + profile.length + 2
  })
  return plans
}

export function newGame(o: NewGameOptions): GameState {
  const cfg = MODES[o.mode]
  const site = sites.find((s) => s.id === o.siteId)
  if (!site) throw new Error(`Unknown site ${o.siteId}`)
  const rng = makeRng(o.seed)
  const sunDays = spreadDays(site.sunShare.value, cfg.days, 0.5)
  const earthDays = o.mode === 'cadet' ? Array<boolean>(cfg.days).fill(true) : spreadDays(site.earthShare.value, cfg.days, 0.2)
  const plans = planStorms(o.mode, earthDays, rng)
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
    sunDays,
    earthDays,
    storms: plans,
    warned: plans.map(() => false),
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

export function currentCard(s: GameState): Card | null {
  if (s.status !== 'playing' || hitIndex(s, s.day) >= 0) return null
  return cards[(s.seed * 7 + s.day * 3) % cards.length] ?? null
}

export function activeWarning(s: GameState): { stormIndex: number; daysUntil: number } | null {
  const lastHit = s.history[s.history.length - 1]?.storm?.index
  for (let i = 0; i < s.storms.length; i++) {
    const p = s.storms[i]
    if (!p || s.day >= p.arrivalDay + p.profile.length) continue
    if (s.warned[i] || lastHit === i) return { stormIndex: i, daysUntil: p.arrivalDay - s.day }
  }
  return null
}

export function step(state: GameState, choice: Choice, rng: Rng): GameState {
  if (state.status !== 'playing') throw new Error('The mission is over')
  const j = choice.jobs
  const list = [j.air, j.shield, j.plants, j.radio]
  if (list.some((n) => !Number.isInteger(n) || n < 0)) throw new Error('Blocks must be whole numbers, 0 or more')
  const used = list.reduce((a, b) => a + b, 0)
  if (used > BLOCKS) throw new Error(`Only ${BLOCKS} blocks to share`)
  const d = state.day
  const cfg = MODES[state.mode]
  const earth = state.earthDays[d - 1] === true
  if (j.radio > 0 && !earth) throw new Error('Earth is not in view today, the radio cannot reach it')
  const sunny = state.sunDays[d - 1] === true
  const before = meters(state)

  let air = state.air - AIR_DRAIN + j.air * AIR_PER_BLOCK + j.plants * PLANT_AIR
  let power = state.power + (sunny ? POWER_SUN : POWER_DARK) - used * POWER_PER_BLOCK
  let food = state.hasFood ? state.food - FOOD_DRAIN + j.plants * PLANT_FOOD : state.food
  let radiation = state.radiation

  const idx = hitIndex(state, d)
  let storm: DayRecord['storm'] = null
  if (idx >= 0) {
    const plan = state.storms[idx]!
    const factor = plan.profile[d - plan.arrivalDay] ?? 0
    const shield = Math.min(j.shield, BLOCKS)
    const letsThrough = SHIELD_LETS_THROUGH[shield] ?? 1
    const incoming = round2(STORM_INTENSITY[plan.size] * cfg.stormBoost * factor * letsThrough)
    radiation += incoming
    storm = { index: idx, factor, shield, letsThrough, incoming, warned: state.warned[idx] === true }
  } else {
    radiation = Math.max(0, radiation - RADIATION_RECOVERY)
  }

  const card = idx >= 0 ? null : currentCard(state)
  const went = card !== null && choice.go
  let science = state.science
  if (went && card) {
    science += card.science
    power += card.power
    air += card.air
    radiation += card.radiation
  }

  const warned = [...state.warned]
  if (j.radio > 0) {
    state.storms.forEach((p, i) => {
      if (p.arrivalDay > d && p.arrivalDay <= d + cfg.lookahead) warned[i] = true
    })
  }

  air = round2(Math.min(METER_MAX, Math.max(0, air)))
  power = round2(Math.min(METER_MAX, Math.max(0, power)))
  food = round2(Math.min(METER_MAX, Math.max(0, food)))
  radiation = round2(Math.min(METER_MAX, Math.max(0, radiation)))
  const after: Meters = { air, power, radiation, food }

  let loss: Loss | undefined
  if (radiation >= METER_MAX) loss = 'radiation'
  else if (air <= 0) loss = 'air'
  else if (state.hasFood && food <= 0) loss = 'food'
  else if (power <= 0) loss = 'power'

  const record: DayRecord = {
    day: d,
    jobs: { ...j },
    sunny,
    earthInView: earth,
    radioWorked: j.radio > 0,
    storm,
    cardId: card?.id ?? null,
    went,
    before,
    after,
    flavour: Math.floor(rng() * 1000),
  }

  const next: GameState = {
    ...state,
    ...after,
    science,
    warned,
    history: [...state.history, record],
    status: loss ? 'lost' : d >= state.totalDays ? 'won' : 'playing',
    day: loss || d >= state.totalDays ? d : d + 1,
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
  if (s.warned.some(Boolean)) out.push('radio-hero')
  const safe = s.status === 'lost' ? s.history.slice(0, -1) : s.history
  for (let i = 1; i < safe.length; i++) {
    if (!safe[i]?.sunny && !safe[i - 1]?.sunny) {
      out.push('night-owl')
      break
    }
  }
  return out
}
