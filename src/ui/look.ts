import { SHIELD_LETS_THROUGH } from '../engine/constants'
import { activeStorm, activeWatch } from '../engine/game'
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
  if (g.status === 'playing' && (activeWatch(g) !== null || activeStorm(g) !== null)) return { safia: 'surprised', kofi: 'surprised', leo: 'surprised', mei: 'surprised' }
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

/** The base picture. The shield is the charge carried over from before plus the blocks being given today (0 to 6). */
export function sceneState(g: GameState, shieldBlocks: number): SceneState {
  const playing = g.status === 'playing'
  return {
    sunny: g.sunDays[g.day - 1] === true,
    earth: g.earthDays[g.day - 1] === true,
    shield: Math.max(0, Math.min(6, g.shield + shieldBlocks)),
    storm: !playing ? 'none' : activeStorm(g) !== null ? 'now' : activeWatch(g) !== null ? 'coming' : 'none',
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

/** The share of space rays the Shield lets in, from the engine's own table (1 = shield off, nothing blocked). */
export function letsThrough(shieldBlocks: number): number {
  return SHIELD_LETS_THROUGH[Math.max(0, Math.min(6, Math.round(shieldBlocks)))] ?? 1
}

/** Height of the shield dome's edge above the ground at a given x (the dome is 240 wide and 100 high, centred at x=190). */
export function domeY(x: number): number {
  const k = Math.max(0, 1 - ((x - 190) / 120) ** 2)
  return 152 - 100 * Math.sqrt(k)
}

export interface Particle {
  x: number
  y0: number
  y1: number
  delay: number
  /** true: this storm particle gets past the shield and lands on the ground. */
  passes: boolean
}

/**
 * Storm particles for the base picture. Out of 10, round(10 x lets-through) get past the shield; the rest stop at the dome.
 * With the Shield off all 10 land on the base; with 6 blocks about 1 in 20 would, so none are drawn.
 */
export function particlePlan(shieldBlocks: number, count = 10): Particle[] {
  const through = Math.round(count * letsThrough(shieldBlocks))
  return Array.from({ length: count }, (_, i) => {
    const x = 84 + ((i * 53) % 230)
    // spread the "passes" evenly instead of bunching them at the start
    const passes = Math.floor(((i + 1) * through) / count) > Math.floor((i * through) / count)
    return { x, y0: 8, y1: passes ? 148 : domeY(x) - 2, delay: (i % 5) * 0.28, passes }
  })
}
