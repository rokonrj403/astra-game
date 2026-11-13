/**
 * Adaptive ambient bed in one key (D): calm / watch / storm layers, crossfaded over about 2 seconds.
 *  - calm  : a D2 + A2 sine pad (with quiet D3 + A3 on top so small speakers can hear it). Always on while the bed runs.
 *  - watch : adds E3 and a slow lowpassed noise "breath" (cutoff 500 Hz, 0.15 Hz swell).
 *  - storm : adds a lowpassed sawtooth at 147 Hz, opens the breath to 1200 Hz, and sprinkles faint crackle clicks.
 * All layers together stay under -18 dB (0.126). It runs only after a tap, only while Sound and Music are on,
 * and stops completely (no idle CPU) when either is off.
 *
 * Called by: the game, once per phase: setMood('calm' | 'watch' | 'storm'); duckBed(true/false) from core.ts while ORBI speaks.
 * Visual twin: the sky/scene mood change ('mood' event).
 */
import { busNode, musicEnabled, noiseBuffer, on, ready } from './core'
import { emitTwin } from './twins'

export type Mood = 'calm' | 'watch' | 'storm'

/** Crossfade: setTargetAtTime time constant. 0.5 s reaches 98% in 2 s. */
export const FADE_TC = 0.5
const FLOOR = 0.0001
const CRACKLE_EVERY_MS = 300

interface Bed {
  c: AudioContext
  root: GainNode
  watch: GainNode
  storm: GainNode
  breath: BiquadFilterNode
  stopAll: () => void
  timer: ReturnType<typeof setInterval> | null
}

let bed: Bed | null = null
let mood: Mood = 'calm'
let wanted = false // the game has asked for a mood; until then the bed stays silent
let rand: () => number = Math.random

/** Test hook: make the crackle deterministic. */
export function setBedRandom(fn: () => number): void {
  rand = fn
}

function sine(c: AudioContext, freq: number, gain: number, to: AudioNode, type: OscillatorType = 'sine'): OscillatorNode {
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, c.currentTime)
  const g = c.createGain()
  g.gain.setValueAtTime(gain, c.currentTime)
  o.connect(g)
  g.connect(to)
  o.start()
  return o
}

function layer(c: AudioContext, to: AudioNode): GainNode {
  const g = c.createGain()
  g.gain.setValueAtTime(FLOOR, c.currentTime)
  g.connect(to)
  return g
}

function create(c: AudioContext, bus: GainNode): Bed {
  const root = c.createGain()
  root.gain.setValueAtTime(1, c.currentTime)
  root.connect(bus)
  const calm = layer(c, root)
  const watch = layer(c, root)
  const storm = layer(c, root)
  const oscs: OscillatorNode[] = []

  // calm: D2 + A2 pad (+ D3, A3 for phone speakers)
  oscs.push(sine(c, 73.42, 0.028, calm), sine(c, 110, 0.028, calm), sine(c, 146.83, 0.006, calm), sine(c, 220, 0.006, calm))

  // watch: E3 and the breath
  oscs.push(sine(c, 164.81, 0.018, watch))
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  src.loop = true
  const breath = c.createBiquadFilter()
  breath.type = 'lowpass'
  breath.frequency.setValueAtTime(500, c.currentTime)
  const breathGain = c.createGain()
  breathGain.gain.setValueAtTime(0.012, c.currentTime)
  src.connect(breath)
  breath.connect(breathGain)
  breathGain.connect(watch)
  const swell = c.createOscillator()
  swell.frequency.setValueAtTime(0.15, c.currentTime)
  const swellDepth = c.createGain()
  swellDepth.gain.setValueAtTime(0.006, c.currentTime)
  swell.connect(swellDepth)
  swellDepth.connect(breathGain.gain)
  src.start()
  swell.start()

  // storm: a lowpassed saw
  const stormTone = c.createGain()
  stormTone.gain.setValueAtTime(1, c.currentTime)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(400, c.currentTime)
  lp.connect(stormTone)
  stormTone.connect(storm)
  oscs.push(sine(c, 147, 0.018, lp, 'sawtooth'))

  const b: Bed = {
    c,
    root,
    watch,
    storm,
    breath,
    timer: null,
    stopAll: () => {
      for (const o of [...oscs, swell]) {
        try {
          o.stop()
        } catch {
          /* already stopped */
        }
      }
      try {
        src.stop()
      } catch {
        /* already stopped */
      }
    },
  }
  calm.gain.setTargetAtTime(1, c.currentTime, FADE_TC)
  return b
}

function crackle(b: Bed): void {
  if (mood !== 'storm') return
  if (rand() > 0.65) return
  const c = b.c
  const at = c.currentTime + rand() * (CRACKLE_EVERY_MS / 1000)
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.setValueAtTime(1500, at)
  const g = c.createGain()
  g.gain.setValueAtTime(0.02, at)
  g.gain.setValueAtTime(FLOOR, at + 0.02)
  src.connect(hp)
  hp.connect(g)
  g.connect(b.storm)
  src.start(at, rand())
  src.stop(at + 0.03)
}

function levels(b: Bed): void {
  const now = b.c.currentTime
  b.watch.gain.setTargetAtTime(mood === 'calm' ? FLOOR : 1, now, FADE_TC)
  b.storm.gain.setTargetAtTime(mood === 'storm' ? 1 : FLOOR, now, FADE_TC)
  b.breath.frequency.setTargetAtTime(mood === 'storm' ? 1200 : 500, now, FADE_TC)
}

function stop(): void {
  if (!bed) return
  const b = bed
  bed = null
  if (b.timer) clearInterval(b.timer)
  try {
    b.root.disconnect() // silent at once, even if the context is about to be suspended
  } catch {
    /* ignore */
  }
  b.stopAll()
}

function sync(): void {
  if (!wanted || !musicEnabled()) return stop()
  const c = ready()
  const bus = busNode('bed')
  if (!c || !bus) return stop()
  if (!bed) {
    const b = create(c, bus)
    bed = b
    b.timer = setInterval(() => crackle(b), CRACKLE_EVERY_MS)
  }
  levels(bed)
}

/** Change the mood. Safe to call any time (even before the first tap: it starts when sound unlocks). */
export function setMood(m: Mood): void {
  const changed = m !== mood
  mood = m
  wanted = true
  if (changed) emitTwin('mood', { mood: m })
  sync()
}
export function getMood(): Mood {
  return mood
}
/** Is the bed running right now? */
export function bedRunning(): boolean {
  return bed !== null
}

on('start', sync)
on('unlock', sync)
on('music', sync)
on('stop', stop)

/** Test helper. */
export function resetBedForTests(): void {
  stop()
  mood = 'calm'
  wanted = false
  rand = Math.random
}
