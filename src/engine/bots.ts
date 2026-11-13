import sites from '../data/sites.json'
import { BLOCKS, POWER_DARK, POWER_PER_BLOCK, POWER_SUN, WALKS } from './constants'
import { flareClues } from './flares'
import { riskInHand } from './hand'
import { activeStorm, activeWatches, currentCard, newGame, radioAvailable, step, type ActiveWatch, type NewGameOptions } from './game'
import { makeRng } from './rng'
import type { Choice, GameState, Guess, Jobs, Option, Walk } from './types'

export type Bot = (s: GameState) => Choice

const J = (air = 0, shield = 0, plants = 0, radio = 0): Jobs => ({ air, shield, plants, radio })
const fixed =
  (jobs: Jobs, walk: Walk = 'none'): Bot =>
  () => ({ jobs, go: false, walk })

/** How good an option looks today. Radiation is a risk budget: cheap when the meter is low, costly when it is high. */
function optionScore(o: Option, s: GameState): number {
  const budget = s.radiation < 15 ? 0.5 : s.radiation < 30 ? 1 : 2.5
  return (
    o.science * 3 +
    o.power * (s.power < 40 ? 0.7 : 0.3) +
    o.air * (s.air < 60 ? 0.6 : 0.2) +
    (s.hasFood ? o.food * 0.2 : 0) -
    o.radiation * budget +
    (o.carry?.power ?? 0) * 0.25 +
    (o.carry?.science ?? 0) * 2 -
    (o.slowWalk ? 1.5 : 0) -
    (o.slowPlants ? 1 : 0) -
    (o.failChance ? o.failChance * 3 : 0)
  )
}

/** How likely a watched flare is to be followed by space rays, as the player estimates it. */
type RiskReader = (w: ActiveWatch) => number

/** Reads the clues (size, gas cloud, Sun side) the way NASA's real counts say they matter, starting from "about half the flares in a hand bring rays". */
const readClues: RiskReader = (w) => riskInHand(flareClues(w.record))
/** Ignores the clues: every flare is a 50/50 flare. */
const ignoreClues: RiskReader = () => 0.5
/** Treats every flare as certain. */
const alwaysScared: RiskReader = () => 1

/** The shield charge worth having today for a given chance of rays. */
const chargeFor = (p: number) => (p >= 0.85 ? 5 : p >= 0.65 ? 4 : p >= 0.4 ? 3 : p >= 0.2 ? 2 : 0)

function careful(read: RiskReader, opts: { walks?: 'smart' | 'always' | 'never'; shields?: boolean } = {}): Bot {
  const walkMode = opts.walks ?? 'smart'
  return (s) => {
    const watches = activeWatches(s)
    const worst = Math.max(0, ...watches.map(read))
    const stormHere = activeStorm(s) !== null
    const target = opts.shields === false ? 0 : stormHere ? 5 : chargeFor(worst)

    // Walk: a bet. Stay home when rays look likely; otherwise go as far as the science goal needs.
    const daysLeft = s.totalDays - s.day + 1
    const need = (s.goal - s.science) / daysLeft
    let walk: Walk = 'none'
    if (walkMode === 'always') walk = 'long'
    else if (walkMode === 'smart' && !stormHere && worst < 0.2) walk = need > 3.2 ? 'long' : 'short'

    // Budget the power: spread what is stored plus the site's expected income (from its real sunlight) over the days left.
    const share = sites.find((x) => x.id === s.siteId)?.sunShare.value ?? 0.3
    const income = share * POWER_SUN + (1 - share) * POWER_DARK
    const perDay = (s.power - 12 + income * daysLeft) / daysLeft
    const budget = Math.max(2, Math.min(BLOCKS, Math.floor(perDay / POWER_PER_BLOCK)))
    if (walk === 'long' && budget < 4) walk = 'short'
    if (walk === 'short' && budget < 3 && walkMode === 'smart' && need < 3) walk = 'none'

    let left = BLOCKS - WALKS[walk].blocks
    const air = Math.min(left, s.air < 70 ? 3 : 2)
    left -= air
    const shield = Math.min(left, Math.max(0, target - s.shield))
    left -= shield
    // Optional spending (radio, plants) only if the budget allows after the essentials.
    let optional = Math.max(0, Math.min(left, budget - air - shield - WALKS[walk].blocks))
    const radio = radioAvailable(s) && optional > 0 && s.power > 45 ? 1 : 0
    optional -= radio
    const wantPlants = s.hasFood ? (s.food < 55 ? 3 : 2) : 2
    const plants = Math.min(optional, wantPlants)
    const card = currentCard(s)
    const go = card ? optionScore(card.a, s) > optionScore(card.b, s) : false
    // Guess about the newest flare nobody has guessed yet: say yes or no when the clues lean, otherwise "not sure".
    const open = watches.filter((w) => s.guesses[w.index] == null).pop()
    const p = open ? read(open) : 0.5
    const guess: Guess | undefined = open ? (p >= 0.6 ? 'yes' : p <= 0.35 ? 'no' : 'unsure') : undefined
    return { jobs: J(air, shield, plants, radio), go, walk, ...(guess ? { guess } : {}) }
  }
}

/** Random power split, random walk and a coin-flip choice each day. Seeded from the state, so a run can be repeated. */
function randomBot(): Bot {
  return (s) => {
    const rng = makeRng(s.seed * 7919 + s.day * 104729)
    const earth = radioAvailable(s)
    const walks: Walk[] = ['none', 'short', 'long']
    const walk = walks[Math.floor(rng() * 3)]!
    const keys = ['air', 'shield', 'plants', 'radio'] as const
    const jobs = J()
    let blocks = Math.floor(rng() * (BLOCKS - WALKS[walk].blocks + 1))
    while (blocks-- > 0) {
      const k = keys[Math.floor(rng() * keys.length)]!
      if (k === 'radio' && !earth) continue
      jobs[k]++
    }
    return { jobs, go: currentCard(s) !== null && rng() < 0.5, walk }
  }
}

export const bots = {
  idle: fixed(J()),
  allAir: fixed(J(6)),
  allShield: fixed(J(0, 6)),
  allPlants: fixed(J(0, 0, 6)),
  allRadio: ((s) => ({ jobs: J(0, 0, 0, radioAvailable(s) ? 6 : 0), go: false })) as Bot,
  /** Reads each flare's clues and the real odds, charges the shield to match, walks when it looks safe. */
  smart: careful(readClues),
  /** Same play but blind to the clues: every flare looks like an average flare. */
  ignoreClues: careful(ignoreClues),
  /** Charges the full shield for every flare and never walks while one is on. */
  paranoid: careful(alwaysScared),
  /** Never charges the shield, even in a storm it can see. */
  neverShield: careful(readClues, { shields: false }),
  /** Walks a long walk every day, whatever the Sun is doing. */
  alwaysWalk: careful(readClues, { walks: 'always' }),
  random: randomBot(),
}

export function playBot(bot: Bot, o: NewGameOptions): GameState {
  let s = newGame(o)
  const rng = makeRng(o.seed + 1000)
  while (s.status === 'playing') s = step(s, bot(s), rng)
  return s
}
