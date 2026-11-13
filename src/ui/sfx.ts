/**
 * Compatibility layer: the screens still call sfx.tap / chime / rumble / success and setSoundEnabled.
 * The sounds themselves now live in src/audio (audio core, ASTRA motif, learning-coded sounds, adaptive bed).
 * Nothing plays until a person taps (browsers need that), and "Sound Off" in Settings mutes all of it.
 */
import { missionComplete, noticeChime, setSoundEnabled, soundEnabled, stormRumble, tap } from '../audio'

export { setSoundEnabled, soundEnabled }

export const sfx = {
  /** A soft click for any button. */
  tap(): void {
    tap()
  },
  /** Two gentle notes: something to notice (a storm warning). */
  chime(): void {
    noticeChime()
  },
  /** A low rumble: the storm is here. Now has upper content so phone speakers can play it. */
  rumble(): void {
    stormRumble()
  },
  /** The ASTRA motif and a held high D: the mission is complete. */
  success(): void {
    missionComplete()
  },
}
