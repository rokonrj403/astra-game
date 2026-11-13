/**
 * Game sounds. Some are plain feedback (tap, notice, storm rumble); the rest are learning-coded:
 * the sound itself tells the child something true about the Sun, and always has a visual twin (see twins.ts).
 *
 *   flare size      -> 1 / 2 / 3 rising whoosh pulses (C / M / X class)
 *   gas cloud (CME) -> an extra low swell under the pulses
 *   Sun side        -> stereo pan (west = right, east = left, center = middle)
 *   rays vs clear   -> the same length and loudness, so neither one is a "good" or "bad" buzzer
 *
 * Mix rules: sfx peaks about 0.1, nothing over 0.25 (-12 dBFS), attacks of 8 ms or more, no sound over 1.5 s.
 * Everything keeps its energy between 200 Hz and 4 kHz so cheap phone speakers can play it.
 * Called by: the game screens (see src/audio/README.md); src/ui/sfx.ts for tap / chime / rumble.
 */
import { bedRunning, setMood } from './bed'
import { noiseHit, play, tone } from './core'
import { NOTE } from './motif'
import { emitTwin } from './twins'

export type FlareSide = 'east' | 'west' | 'center'
export interface FlareInfo {
  size: 1 | 2 | 3
  cloud: boolean
  side: FlareSide
}

/** Same for rays arriving and the all-clear, so they are equally long and loud. */
export const REVEAL_DUR = 0.9
export const REVEAL_PEAK = 0.07

const PULSE_STEP = 0.3
const PULSE_DUR = 0.25
const PAN = { east: -0.7, west: 0.7, center: 0 } as const

/** A soft click for any button: 620 Hz sine, 40 ms. */
export function tap(): boolean {
  return play('tap', { dur: 0.05 }, (v) => tone(v, { freq: 620, dur: 0.04, peak: 0.06 }))
}

/** A power block lands on a job: a tock plus a small high note. */
export function blockPlaced(): boolean {
  emitTwin('blockPlaced')
  return play('blockPlaced', { dur: 0.1 }, (v) => {
    tone(v, { freq: 523, dur: 0.07, type: 'triangle', peak: 0.07 })
    tone(v, { freq: 784, at: 0.03, dur: 0.07, peak: 0.05 })
  })
}

/** Something to notice (a storm watch begins): two soft rising notes. */
export function noticeChime(): boolean {
  emitTwin('notice')
  return play('notice', { dur: 0.5, gap: 0.5 }, (v) => {
    tone(v, { freq: NOTE.D5, dur: 0.2, peak: 0.07 })
    tone(v, { freq: NOTE.A5, at: 0.14, dur: 0.3, peak: 0.07 })
  })
}

/**
 * The storm is here. Old version was noise under 160 Hz, which cheap phone speakers cannot play.
 * Now: a short low noise body, plus upper content (bandpass noise near 450 Hz, a sawtooth at 110 Hz whose
 * 2nd to 6th harmonics are in the audible range, and a 165 Hz triangle), so it still reads as a low rumble on a phone.
 */
export function stormRumble(): boolean {
  emitTwin('rumble')
  return play('rumble', { dur: 0.9, gap: 1 }, (v) => {
    noiseHit(v, { dur: 0.9, peak: 0.1, attack: 0.25, filter: 'lowpass', f0: 240 })
    noiseHit(v, { dur: 0.9, peak: 0.07, attack: 0.25, filter: 'bandpass', f0: 450, f1: 380, q: 0.8 })
    tone(v, { freq: 110, to: 96, dur: 0.9, type: 'sawtooth', peak: 0.035, attack: 0.25, lp: 700 })
    tone(v, { freq: 165, dur: 0.9, type: 'triangle', peak: 0.05, attack: 0.25, lp: 1400 })
  })
}

/** A flare is seen. Pulses = size, an extra low swell for a gas cloud, panned to the side of the Sun it came from. */
export function flareSound(f: FlareInfo): boolean {
  const size = Math.min(3, Math.max(1, Math.round(f.size))) as 1 | 2 | 3
  emitTwin('flare', { size, cloud: f.cloud, side: f.side })
  const pan = PAN[f.side] ?? 0
  const dur = Math.max(PULSE_STEP * (size - 1) + PULSE_DUR, f.cloud ? 0.6 : 0)
  return play('flare', { dur, gap: 0.5 }, (v) => {
    for (let i = 0; i < size; i++) {
      noiseHit(v, {
        at: i * PULSE_STEP,
        dur: PULSE_DUR,
        attack: 0.12,
        peak: 0.06 + i * 0.01,
        f0: 800 * (1 + 0.15 * i),
        f1: 2400 * (1 + 0.1 * i),
        q: 2,
        pan,
      })
    }
    if (f.cloud) {
      // 220 Hz triangle is the "whomp"; a 440 Hz sine on top keeps it audible on small speakers.
      tone(v, { freq: 220, dur: 0.6, type: 'triangle', peak: 0.05, attack: 0.25, lp: 900 })
      tone(v, { freq: 440, dur: 0.6, peak: 0.02, attack: 0.25 })
    }
  })
}

/**
 * Space rays reach the Moon. `level` is the shield charge (0..6) at that moment.
 * Shielded: noise sweep 3000 -> 600 Hz plus a soft D4 + A4 "bloom". Unshielded: the same sweep and a soft 440 -> 392 Hz slide.
 * Exactly as long and as loud as allClear().
 */
export function raysArrive(level: number): boolean {
  const shielded = level > 0
  emitTwin('rays', { level, shielded })
  return play('reveal', { dur: REVEAL_DUR, gap: 1 }, (v) => {
    noiseHit(v, { dur: REVEAL_DUR, peak: REVEAL_PEAK, attack: 0.12, f0: 3000, f1: 600, q: 1.2 })
    if (shielded) {
      tone(v, { freq: NOTE.D4, at: 0.45, dur: 0.4, peak: 0.05 })
      tone(v, { freq: NOTE.A4, at: 0.45, dur: 0.4, peak: 0.05 })
    } else {
      tone(v, { freq: 440, to: 392, at: 0.3, dur: 0.6, peak: 0.05 })
    }
  })
}

/** No rays this time. Triangle D5 - A5 - F#6 swell with a noise exhale, and the bed (if it is running) returns to calm. Same length and loudness as raysArrive(). */
export function allClear(): boolean {
  emitTwin('allClear')
  if (bedRunning()) setMood('calm')
  return play('reveal', { dur: REVEAL_DUR, gap: 1 }, (v) => {
    ;[NOTE.D5, NOTE.A5, NOTE.Fs6].forEach((f, i) => tone(v, { freq: f, at: i * 0.15, dur: REVEAL_DUR - i * 0.15, type: 'triangle', peak: 0.05, attack: 0.1 }))
    noiseHit(v, { at: 0.2, dur: REVEAL_DUR - 0.2, peak: REVEAL_PEAK, attack: 0.12, filter: 'lowpass', f0: 400, via: 2000, f1: 300 })
  })
}

/** Science points earned: a D - F# - A sparkle. */
export function scienceGained(): boolean {
  emitTwin('science')
  return play('science', { dur: 0.45, gap: 0.2 }, (v) => {
    ;[NOTE.D5, NOTE.Fs5, NOTE.A5].forEach((f, i) => tone(v, { freq: f, at: i * 0.07, dur: 0.16, peak: 0.06 }))
    tone(v, { freq: 1760, at: 0.21, dur: 0.2, peak: 0.025 })
  })
}

/** Power or air is running low: one soft 330 Hz double pulse. At most once every 8 seconds. */
export function lowWarning(): boolean {
  emitTwin('lowWarning')
  return play('lowWarning', { dur: 0.35, gap: 8 }, (v) => {
    for (const at of [0, 0.18]) {
      tone(v, { freq: 330, at, dur: 0.12, peak: 0.06 })
      tone(v, { freq: 660, at, dur: 0.12, type: 'triangle', peak: 0.02 })
    }
  })
}

/** A moonwalk: airy two-step, bandpassed noise puffs 400 ms apart with a low bounce each. */
export function moonwalk(): boolean {
  emitTwin('moonwalk')
  return play('moonwalk', { dur: 0.6, gap: 0.8 }, (v) => {
    ;[0, 0.4].forEach((at, i) => {
      noiseHit(v, { at, dur: 0.18, peak: 0.05 - i * 0.01, attack: 0.04, f0: 700, q: 1.2 })
      tone(v, { freq: 260, to: 150, at, dur: 0.12, type: 'triangle', peak: 0.04 - i * 0.008 })
    })
  })
}
