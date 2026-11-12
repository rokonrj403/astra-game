import { activeWarning, currentCard, newGame, radioAvailable, step, type NewGameOptions } from './game'
import { makeRng } from './rng'
import type { Choice, GameState, Jobs } from './types'

export type Bot = (s: GameState) => Choice

const J = (air = 0, shield = 0, plants = 0, radio = 0): Jobs => ({ air, shield, plants, radio })
const fixed =
  (jobs: Jobs): Bot =>
  () => ({ jobs, go: false })

function careful(useRadio: boolean): Bot {
  return (s) => {
    const w = activeWarning(s)
    const stormToday = w !== null && w.daysUntil <= 0
    if (stormToday) return { jobs: J(2, 4, 0, 0), go: false }
    const radio = useRadio && radioAvailable(s) && w === null ? 1 : 0
    const air = s.air < 70 ? 3 : 2
    const plants = s.hasFood ? (s.food < 55 ? 3 : 2) : 0
    const jobs = J(air, 0, plants, radio)
    const safeToGo = (w === null || w.daysUntil > 1) && s.radiation < 20 && s.power > 40 && s.air > 50 && (!s.hasFood || s.food > 40)
    return { jobs, go: currentCard(s) !== null && safeToGo }
  }
}

export const bots = {
  idle: fixed(J()),
  allAir: fixed(J(6)),
  allShield: fixed(J(0, 6)),
  allPlants: fixed(J(0, 0, 6)),
  allRadio: ((s) => ({ jobs: J(0, 0, 0, radioAvailable(s) ? 6 : 0), go: false })) as Bot,
  smart: careful(true),
  noRadio: careful(false),
}

export function playBot(bot: Bot, o: NewGameOptions): GameState {
  let s = newGame(o)
  const rng = makeRng(o.seed + 1000)
  while (s.status === 'playing') s = step(s, bot(s), rng)
  return s
}
