import { allClear, flareSound, lowWarning, raysArrive, scienceGained, setMood, type Mood } from '../audio'
import { LOW } from './look'
import { activeStorm, activeWatch } from '../engine/game'
import type { FlareRecord } from '../engine/flares'
import type { DayRecord, GameState, Mode } from '../engine/types'
import { sizeLevel } from './pictos'

/** The sound that goes with a flare appearing on the Sun: pulses = size, a low swell = gas cloud, left or right = Sun side (Commander). */
export function flareCue(f: Pick<FlareRecord, 'class' | 'cloud' | 'side'>, mode: Mode): void {
  flareSound({ size: sizeLevel(f.class), cloud: f.cloud, side: mode === 'commander' ? (f.side === 'west' ? 'west' : 'east') : 'center' })
}

/** Calm on a normal day, watch while a flare is being watched, storm while a storm the crew can see is here. */
export function moodFor(g: GameState): Mood {
  if (g.status !== 'playing') return 'calm'
  if (activeStorm(g)) return 'storm'
  if (activeWatch(g)) return 'watch'
  return 'calm'
}

/** True when a bar is in the danger zone, so a low-warning sound and picture are due. */
export function lowToday(g: GameState): boolean {
  return g.air < LOW.air || g.power < LOW.power || (g.hasFood && g.food < LOW.food)
}

/**
 * The reveal sounds for a day: rays that came sound as rays hitting the dome (how loud the shield was is passed along),
 * a flare that brought nothing sounds as an all-clear. Both last the same time and are equally loud, so neither is "bad".
 */
export function revealCue(r: DayRecord): void {
  for (const res of r.resolved) {
    if (res.followed) raysArrive(r.storm?.shield ?? 0)
    else allClear()
  }
  if (r.scienceGain > 0) scienceGained()
}

export { lowWarning }
export { setMood }
