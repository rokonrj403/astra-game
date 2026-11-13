import type { Mode, StormSize } from './types'

export const BLOCKS = 6
export const START = { air: 80, power: 70, radiation: 0, food: 70 } as const
export const METER_MAX = 100

export const SHIELD_LETS_THROUGH = [1, 0.6, 0.35, 0.2, 0.12, 0.08, 0.05] as const
export const STORM_INTENSITY: Record<StormSize, number> = { small: 100, big: 125, huge: 150 }
export const STORM_DEFAULT_PROFILE: Record<StormSize, number[]> = {
  small: [1],
  big: [0.6, 1],
  huge: [0.7, 1, 0.5],
}
export const STORM_MAX_DAYS: Record<StormSize, number> = { small: 2, big: 3, huge: 3 }

export const AIR_DRAIN = 16
export const AIR_PER_BLOCK = 11
export const PLANT_AIR = 1
export const PLANT_FOOD = 10
export const FOOD_DRAIN = 7
// Power is scarce on purpose: a sunny day pays for about 6 blocks, a dark day for about 1, and the average site is dark most days,
// so every block has a price and the site's real sunlight (LRO LOLA) matters.
export const POWER_SUN = 20
export const POWER_DARK = 4
export const POWER_PER_BLOCK = 3
export const RADIATION_RECOVERY = 4

export interface ModeRules {
  days: number
  hasFood: boolean
  /** Makes storms hit harder in the game. The storm numbers shown to players are never scaled. */
  stormBoost: number
  /** Real storms that reach the base: each one is announced by a real flare. */
  stormCount: number
  /** Real flares in the mission that were NOT followed by space rays. */
  decoys: number
  /** Science to collect by the last day to complete the mission. */
  goal: number
}

export const MODES: Record<Mode, ModeRules> = {
  cadet: { days: 10, hasFood: false, stormBoost: 1, stormCount: 1, decoys: 1, goal: 32 },
  commander: { days: 20, hasFood: true, stormBoost: 1.8, stormCount: 2, decoys: 2, goal: 43 },
}

/** A flare watch lasts 3 days from the flare: NASA counted a radiation storm as "following" a flare up to 72 hours later. */
export const WATCH_DAYS = 3
/** The shield is a charge: each block adds 1 (up to 6) and 1 leaks away each day, so it can be built before a storm. */
export const SHIELD_MAX = 6
export const SHIELD_LEAK = 2
/** The shield machine is hungry: each block on the Shield costs this much extra power, on top of the normal block cost. */
export const SHIELD_EXTRA_POWER = 1
/** Science for a good guess (said yes and rays came, or no and they did not). Saying "not sure" or guessing wrong earns nothing and costs nothing. */
export const GUESS_REWARD = 2
/** Radio: send data to Earth. Each block brings science, up to a limit. The reply takes about 2.6 s. Earth must be in view. */
export const RADIO_SCIENCE = 1
export const RADIO_SCIENCE_MAX = 2
/**
 * A moonwalk is a bet. blocks: power blocks it costs. science: what it brings home on a calm day.
 * exposure: the share of a storm's full, unshielded radiation that hits walkers if a storm arrives that day (the shield never protects walkers).
 * background: a little radiation even on a calm day. If a storm hits, the crew is called home and the science is lost.
 */
export const WALKS = {
  none: { blocks: 0, science: 0, exposure: 0, background: 0 },
  short: { blocks: 1, science: 2, exposure: 0.5, background: 2 },
  long: { blocks: 2, science: 4, exposure: 1, background: 4 },
} as const
/** Plants experiments: science for the day from the blocks on Plants. */
export const PLANT_SCIENCE: readonly number[] = [0, 0, 1, 1, 2, 2, 2]

export const RADIO_ONE_WAY_S = 1.28
export const MOON_DISTANCE_KM = 384400
export const RADIO_SOURCE = 'NASA Moon Fact Sheet: mean distance 384,400 km. Radio travels at the speed of light, about 1.28 seconds one way.'

export const STORM_SCORE = 3

/** Words shown on the mode cards. Kept here so a test can check them. */
export const MODE_CARDS: Record<Mode, { name: string; lines: string[] }> = {
  cadet: { name: 'Cadet', lines: [`${MODES.cadet.days} days`, 'One real storm', `Collect ${MODES.cadet.goal} science`, 'No food bar'] },
  commander: { name: 'Commander', lines: [`${MODES.commander.days} days`, 'Two real storms', 'Stronger storms', `Collect ${MODES.commander.goal} science`, 'Food bar'] },
}
