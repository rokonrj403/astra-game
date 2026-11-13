/**
 * The ASTRA motif: A4 - D5 - F#5 - A5 (440, 587, 740, 880 Hz), triangle, 90 ms apart. Everything stays in D pentatonic (D E F# A B).
 * It recurs: first tap (full), ORBI hello (A-D), day start (A-D-F#), surprise card flip (tick + A-D),
 * mission complete (full + held D6), gentle failure (reversed, slow, soft, then ORBI's "try again" chirp).
 *
 * Called by: src/audio/index.ts re-exports; src/ui/sfx.ts (success -> missionComplete); the game for the rest.
 */
import { holdOff, on, play, tone, noiseHit, type Voice } from './core'
import { emitTwin } from './twins'

export const NOTE = { D4: 293.66, A4: 440, D5: 587.33, E5: 659.25, Fs5: 739.99, A5: 880, D6: 1174.66, Fs6: 1479.98 } as const
const STEP = 0.09

function notes(v: Voice, freqs: number[], o: { peak?: number; dur?: number; step?: number; type?: OscillatorType; at?: number } = {}): void {
  freqs.forEach((f, i) => tone(v, { freq: f, at: (o.at ?? 0) + i * (o.step ?? STEP), dur: o.dur ?? 0.28, type: o.type ?? 'triangle', peak: o.peak ?? 0.07 }))
}

/** The full motif. Plays by itself on the very first tap. */
export function astraMotif(): boolean {
  return play('motif', { dur: 0.6, gap: 0.5 }, (v) => notes(v, [NOTE.A4, NOTE.D5, NOTE.Fs5, NOTE.A5]))
}

/** ORBI says hello: A - D. */
export function orbiHello(): boolean {
  emitTwin('orbiHello')
  return play('orbiHello', { dur: 0.4, gap: 0.3 }, (v) => notes(v, [NOTE.A4, NOTE.D5]))
}

/** A new day begins: A - D - F#. */
export function dayStart(): boolean {
  emitTwin('dayStart')
  return play('dayStart', { dur: 0.5, gap: 0.3 }, (v) => notes(v, [NOTE.A4, NOTE.D5, NOTE.Fs5]))
}

/** Surprise card turns over: a paper tick, then A - D. */
export function cardFlip(): boolean {
  emitTwin('cardFlip')
  return play('cardFlip', { dur: 0.45, gap: 0.3 }, (v) => {
    noiseHit(v, { dur: 0.05, peak: 0.05, f0: 3200, q: 1.5, attack: 0.008 })
    notes(v, [NOTE.A4, NOTE.D5], { at: 0.06, peak: 0.06 })
  })
}

/** Mission complete: the full motif and a held D6. About 1.4 s. */
export function missionComplete(): boolean {
  emitTwin('missionComplete')
  return play('missionComplete', { dur: 1.4, gap: 1 }, (v) => {
    notes(v, [NOTE.A4, NOTE.D5, NOTE.Fs5, NOTE.A5], { peak: 0.07 })
    tone(v, { freq: NOTE.D6, at: 4 * STEP, dur: 1.0, type: 'triangle', peak: 0.06, attack: 0.03 })
  })
}

export type ChirpMood = 'question' | 'warning' | 'happy'
const LONG_LINE = 24 // words: a long line is read, not chirped

/** One ORBI syllable: a sine carrier with FM (2x ratio, 150 Hz deep), 60-90 ms. */
function syllable(v: Voice, freq: number, to: number, at: number, dur: number, vibrato: boolean): void {
  const { c } = v
  const t = v.t + at
  const osc = tone(v, { freq, to, at, dur, peak: 0.05, out: v.out })
  const mod = c.createOscillator()
  mod.frequency.setValueAtTime(freq * 2, t)
  const depth = c.createGain()
  depth.gain.setValueAtTime(150, t)
  mod.connect(depth)
  depth.connect(osc.frequency)
  mod.start(t)
  mod.stop(t + dur + 0.03)
  if (vibrato) {
    const lfo = c.createOscillator()
    lfo.frequency.setValueAtTime(12, t)
    const d = c.createGain()
    d.gain.setValueAtTime(25, t)
    lfo.connect(d)
    d.connect(osc.frequency)
    lfo.start(t)
    lfo.stop(t + dur + 0.03)
  }
}

function chirp(v: Voice, mood: ChirpMood, syllables: number, at = 0): void {
  for (let i = 0; i < syllables; i++) {
    const k = syllables === 1 ? 0 : i / (syllables - 1)
    const [from, to] = mood === 'warning' ? [1500 - k * 450, 1300 - k * 450] : mood === 'question' ? [900 + k * 500, 1100 + k * 500] : [1000 + k * 450, 1250 + k * 450]
    syllable(v, from, to, at + i * 0.09, 0.075, mood === 'happy')
  }
}

/** ORBI's chirp. Mood carries the feeling, the real words stay on screen. Skipped for long lines. Syllables = words / 3 (1 to 4); a warning is two falling notes. */
export function orbiChirp(mood: ChirpMood, words = 3): boolean {
  if (words > LONG_LINE) return false
  const n = mood === 'warning' ? 2 : Math.min(4, Math.max(1, Math.round(words / 3)))
  return play('orbiChirp', { dur: 0.1 * n + 0.1, gap: 0.4, bus: 'voice' }, (v) => chirp(v, mood, n))
}

/** Gentle failure: F#5 - D5 - A4, sine, soft, lowpassed, then ORBI's rising "try again" chirp. Never a buzzer, never a minor sting. */
export function missionFailedGentle(): boolean {
  emitTwin('missionFailed')
  return play('missionFailed', { dur: 1.4, gap: 1 }, (v) => {
    ;[NOTE.Fs5, NOTE.D5, NOTE.A4].forEach((f, i) => tone(v, { freq: f, at: i * 0.32, dur: 0.5, attack: 0.03, peak: 0.05, lp: 1500 }))
    chirp(v, 'question', 2, 1.05)
  })
}

// The first tap plays the full motif; the tap click that comes with it is held back so they do not pile up.
on('unlock', () => {
  emitTwin('unlock')
  if (astraMotif()) holdOff('tap', 0.6)
})
