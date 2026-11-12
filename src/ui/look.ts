import { activeWarning } from '../engine/game'
import type { GameState } from '../engine/types'

export type CrewId = 'safia' | 'kofi' | 'leo' | 'mei'
export type Mood = 'happy' | 'worried' | 'surprised'

export const CREW: { id: CrewId; name: string; job: string }[] = [
  { id: 'safia', name: 'Safia', job: 'Plants' },
  { id: 'kofi', name: 'Kofi', job: 'Power' },
  { id: 'leo', name: 'Leo', job: 'Air' },
  { id: 'mei', name: 'Mei', job: 'Radio' },
]

/** Below these a crew member looks worried. */
export const LOW = { air: 35, power: 30, food: 35 } as const
export const HIGH_RADIATION = 60

/**
 * One face at a time: an event today (a storm warning) beats a low bar, and a low bar beats happy.
 * Safia watches Food, Kofi watches Power and Radiation, Leo watches Air. Mei is the radio officer, so only events change her.
 */
export function crewMoods(g: GameState): Record<CrewId, Mood> {
  if (g.status === 'playing' && activeWarning(g) !== null) return { safia: 'surprised', kofi: 'surprised', leo: 'surprised', mei: 'surprised' }
  return {
    safia: g.hasFood && g.food < LOW.food ? 'worried' : 'happy',
    kofi: g.power < LOW.power || g.radiation >= HIGH_RADIATION ? 'worried' : 'happy',
    leo: g.air < LOW.air ? 'worried' : 'happy',
    mei: 'happy',
  }
}

export type StormLook = 'none' | 'coming' | 'now'

export interface SceneState {
  sunny: boolean
  earth: boolean
  /** 0 = shield off, up to 6 blocks; shows as a glowing dome. */
  shield: number
  storm: StormLook
  powerLow: boolean
  plantsHappy: boolean
}

export function sceneState(g: GameState, shieldBlocks: number): SceneState {
  const warn = g.status === 'playing' ? activeWarning(g) : null
  return {
    sunny: g.sunDays[g.day - 1] === true,
    earth: g.earthDays[g.day - 1] === true,
    shield: Math.max(0, Math.min(6, shieldBlocks)),
    storm: warn === null ? 'none' : warn.daysUntil <= 0 ? 'now' : 'coming',
    powerLow: g.power < LOW.power,
    plantsHappy: g.hasFood ? g.food >= LOW.food : g.air >= LOW.air,
  }
}

export function sceneLabel(s: SceneState): string {
  const parts = [
    s.sunny ? 'It is a sunny day.' : 'It is a dark day.',
    s.earth ? 'Earth is in view.' : 'Earth is hidden.',
    s.shield > 0 ? `The shield has ${s.shield} ${s.shield === 1 ? 'block' : 'blocks'}.` : 'The shield is off.',
    s.storm === 'now' ? 'A storm is here.' : s.storm === 'coming' ? 'A storm is coming.' : '',
    s.powerLow ? 'The battery is low.' : '',
    s.plantsHappy ? 'The plants look happy.' : 'The plants look sad.',
  ]
  return `The Moon base. ${parts.filter(Boolean).join(' ')}`
}
