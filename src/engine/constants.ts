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
export const AIR_PER_BLOCK = 9
export const PLANT_AIR = 1
export const PLANT_FOOD = 8
export const FOOD_DRAIN = 7
export const POWER_SUN = 30
export const POWER_DARK = 4
export const POWER_PER_BLOCK = 2
export const RADIATION_RECOVERY = 4

export const MODES: Record<Mode, { days: number; hasFood: boolean; stormBoost: number; lookahead: number; stormCount: number }> = {
  cadet: { days: 10, hasFood: false, stormBoost: 1, lookahead: 3, stormCount: 1 },
  commander: { days: 20, hasFood: true, stormBoost: 2.6, lookahead: 2, stormCount: 2 },
}

export const RADIO_ONE_WAY_S = 1.28
export const MOON_DISTANCE_KM = 384400
export const RADIO_SOURCE = 'NASA Moon Fact Sheet: mean distance 384,400 km. Radio travels at the speed of light, about 1.28 seconds one way.'

export const STORM_SCORE = 3

/** Words shown on the mode cards. Kept here so a test can check them. */
export const MODE_CARDS: Record<Mode, { name: string; lines: string[] }> = {
  cadet: { name: 'Cadet', lines: ['10 days', 'One storm', 'No food bar'] },
  commander: { name: 'Commander', lines: ['20 days', 'Two storms', 'Stronger storms', 'Food bar'] },
}
