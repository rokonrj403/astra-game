import type { DayRecord, GameState, Walk } from '../engine/types'
import { activeStorm, activeWatch } from '../engine/game'
import { flareBucket } from '../engine/flares'
import { sceneState } from '../ui/look'
import type { CrewId, Mood } from '../ui/look'

export type { CrewId, Mood }
/** A drop target: the four jobs plus the airlock (moonwalk). */
export type Target = 'air' | 'shield' | 'plants' | 'radio' | 'walk'
export const TARGETS: readonly Target[] = ['air', 'shield', 'plants', 'radio', 'walk']
export type Side = 'east' | 'west'
/** Flare size as the picture shows it: C/M/X is small/medium/big, drawn as a burst with 1/2/3 pulses. */
export type FlareSize = 'small' | 'medium' | 'big'

export const PULSES: Record<FlareSize, 1 | 2 | 3> = { small: 1, medium: 2, big: 3 }

/** The flare's size from its class (M5 up to X1 is small, X1 to X5 medium, X5 and more big), from the engine's own buckets. */
export function flareSize(cls: string): FlareSize {
  const b = flareBucket(cls)
  return b === 'x5' ? 'big' : b === 'x1' ? 'medium' : 'small'
}

/** What a flare watch shows. Plain clues only: nothing here says whether space rays will come. */
export interface FlareView {
  size: FlareSize
  /** A gas cloud was seen leaving the Sun. */
  cloud: boolean
  /** Which limb of the Sun it erupted from. */
  side: Side
  /** 1 to 3: days since the flare. The cloud creeps one notch a day. */
  daysSince: number
}

/** The reveal moment on the dome: rays fall (rays), or the cloud slides past and a green ring shows (clear). */
export interface RevealView {
  kind: 'rays' | 'clear'
  /** Shield charge that met the storm (0 to 6). */
  shield: number
  /** How many rays to draw (default RAYS, halved on cheap phones). */
  count?: number
  /** Rays lean in from this side of the Sun. */
  side?: Side | null
  /** Rays leave the Sun and fan out to the dome (the Start screen's show). The game's own reveal leaves this off. */
  fromSun?: boolean
  /** Change this to replay the reveal. */
  key: string | number
}

export interface SceneModel {
  day: number
  totalDays: number
  sunny: boolean
  /** Earth in view: the dish works. */
  earth: boolean
  /** Shield charge shown as lit segments (carried charge plus today's blocks), 0 to 6. */
  shield: number
  /** Blocks given today to each building (the airlock holds the moonwalk's blocks, 0 to 2). */
  blocks: Record<Target, number>
  storm: 'none' | 'coming' | 'now'
  flare: FlareView | null
  /** Commander: the burst shows the Sun side. */
  showSide: boolean
  powerLow: boolean
  plantsHappy: boolean
  moods: Record<CrewId, Mood>
}

export const NO_BLOCKS: Record<Target, number> = { air: 0, shield: 0, plants: 0, radio: 0, walk: 0 }

export const CALM_MODEL: SceneModel = {
  day: 1,
  totalDays: 10,
  sunny: true,
  earth: true,
  shield: 0,
  blocks: NO_BLOCKS,
  storm: 'none',
  flare: null,
  showSide: false,
  powerLow: false,
  plantsHappy: true,
  moods: { safia: 'happy', kofi: 'happy', leo: 'happy', mei: 'happy' },
}

export function walkBlocks(w: Walk): number {
  return w === 'long' ? 2 : w === 'short' ? 1 : 0
}

/**
 * Builds the scene from the real game. It reads only what the player may know today: the Sun's clues (class, cloud, side)
 * of a flare already shown in the Sun Watch, never whether that flare was followed by a storm.
 */
export function sceneModelFromGame(g: GameState, blocks: Partial<Record<Target, number>> = {}): SceneModel {
  const given = { ...NO_BLOCKS, ...blocks }
  const s = sceneState(g, given.shield)
  const w = activeWatch(g)
  const st = activeStorm(g)
  const playing = g.status === 'playing'
  const flare: FlareView | null = w
    ? { size: flareSize(w.record.class), cloud: w.record.cloud, side: w.record.side === 'west' ? 'west' : 'east', daysSince: w.daysSince }
    : null
  const moods: Record<CrewId, Mood> =
    playing && (w !== null || st !== null)
      ? { safia: 'surprised', kofi: 'surprised', leo: 'surprised', mei: 'surprised' }
      : { safia: s.plantsHappy ? 'happy' : 'worried', kofi: s.powerLow ? 'worried' : 'happy', leo: 'happy', mei: 'happy' }
  return {
    day: g.day,
    totalDays: g.totalDays,
    sunny: s.sunny,
    earth: s.earth,
    shield: s.shield,
    blocks: given,
    storm: s.storm,
    flare,
    showSide: g.mode === 'commander',
    powerLow: s.powerLow,
    plantsHappy: s.plantsHappy,
    moods,
  }
}

/** How many rays to draw for a storm: its real size scales the count from half to all of `max`. */
export function rayCountFor(incoming: number | undefined, max = 24): number {
  if (incoming === undefined) return max
  const k = Math.max(0, Math.min(1, (incoming - 30) / 120))
  return Math.round(max / 2 + (max / 2) * k)
}

/**
 * The reveal for the day that just ended (the last DayRecord): rays if a storm hit, the all-clear if a flare watch ended with no storm.
 * Call it only after the day is over, so it never leaks a watch that is still running.
 */
export function revealFromRecord(rec: DayRecord | undefined, side: Side | null = null, max = 24): RevealView | null {
  if (!rec) return null
  if (rec.storm) return { kind: 'rays', shield: rec.storm.shield, count: rayCountFor(rec.storm.incoming, max), side, key: `d${rec.day}` }
  if (rec.resolved.some((r) => !r.followed)) return { kind: 'clear', shield: rec.shieldAfter, side, key: `d${rec.day}` }
  return null
}
