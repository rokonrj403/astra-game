/**
 * Shield hum = a gauge you can hear. shieldHum(charge) with charge 0..6 (the number of shield blocks).
 * More charge = a fuller, brighter hum and a steadier one (the 4 Hz wobble shrinks: steadier = safer).
 * Three tones (147, 220, 294 Hz) join as the charge grows, plus a 441 Hz partial so a phone speaker can hear it.
 * Zero charge = silence plus a faint crackle. Raising the charge adds a short 80 ms glide up a step.
 *
 * Called by: the game's shield step each time the charge changes (and shieldHumStop() when leaving the screen).
 * Visual twin: the shield outline thickens ('shield' event, detail.charge).
 */
import { busNode, on, play, ready, noiseHit, tone } from './core'
import { emitTwin } from './twins'

export const MAX_CHARGE = 6
const TC = 0.3 // seconds: how slowly the hum follows the charge

interface Hum {
  c: AudioContext
  out: GainNode
  g147: GainNode
  g220: GainNode
  g294: GainNode
  g441: GainNode
  lp: BiquadFilterNode
  trem: GainNode
  depth: GainNode
  oscs: OscillatorNode[]
}

let hum: Hum | null = null
let charge = 0 // last charge the game asked for

/** Pure mapping from charge to the hum's settings (exported for tests). */
export function humSettings(b: number): { g147: number; g220: number; g294: number; g441: number; cutoff: number; wobble: number } {
  return {
    g147: b * 0.012,
    g220: b >= 2 ? b * 0.012 : 0,
    g294: b >= 4 ? b * 0.012 : 0,
    g441: b * 0.004,
    cutoff: 300 + 150 * b,
    wobble: b < 1 ? 0 : 0.5 - (b - 1) * 0.08, // 0.5 at 1 block, 0.1 at 6
  }
}

function osc(c: AudioContext, type: OscillatorType, freq: number, to: AudioNode): OscillatorNode {
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, c.currentTime)
  o.connect(to)
  o.start()
  return o
}

function create(c: AudioContext, bus: GainNode): Hum {
  const now = c.currentTime
  const out = c.createGain()
  out.gain.setValueAtTime(0.6, now)
  const trem = c.createGain()
  trem.gain.setValueAtTime(1, now)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(450, now)
  lp.connect(trem)
  trem.connect(out)
  out.connect(bus)
  const part = (): GainNode => {
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.connect(lp)
    return g
  }
  const g147 = part()
  const g220 = part()
  const g294 = part()
  const g441 = part()
  const depth = c.createGain()
  depth.gain.setValueAtTime(0, now)
  depth.connect(trem.gain)
  const oscs = [osc(c, 'triangle', 147, g147), osc(c, 'sine', 220, g220), osc(c, 'sine', 294, g294), osc(c, 'sine', 441, g441), osc(c, 'sine', 4, depth)]
  return { c, out, g147, g220, g294, g441, lp, trem, depth, oscs }
}

function apply(h: Hum, b: number): void {
  const now = h.c.currentTime
  const s = humSettings(b)
  h.g147.gain.setTargetAtTime(Math.max(s.g147, 0.0001), now, TC)
  h.g220.gain.setTargetAtTime(Math.max(s.g220, 0.0001), now, TC)
  h.g294.gain.setTargetAtTime(Math.max(s.g294, 0.0001), now, TC)
  h.g441.gain.setTargetAtTime(Math.max(s.g441, 0.0001), now, TC)
  h.lp.frequency.setTargetAtTime(s.cutoff, now, TC)
  h.trem.gain.setTargetAtTime(1 - s.wobble / 2, now, TC)
  h.depth.gain.setTargetAtTime(s.wobble / 2, now, TC)
}

function teardown(): void {
  if (!hum) return
  for (const o of hum.oscs) {
    try {
      o.stop()
    } catch {
      /* already stopped */
    }
  }
  try {
    hum.out.disconnect()
  } catch {
    /* ignore */
  }
  hum = null
}

/** Set the shield charge (0..6). Call it whenever the number of shield blocks changes. Returns true if the hum is audible. */
export function shieldHum(level: number): boolean {
  const b = Math.min(MAX_CHARGE, Math.max(0, Math.round(Number.isFinite(level) ? level : 0)))
  const before = charge
  charge = b
  emitTwin('shield', { charge: b })
  const c = ready()
  const bus = busNode('sfx')
  if (!c || !bus) return false
  if (b > before) {
    // a block clicks in: 80 ms glide up one step
    play('shieldClick', { dur: 0.1, gap: 0.08 }, (v) => tone(v, { freq: 440, to: 494, dur: 0.08, peak: 0.05 }))
  }
  if (b === 0) {
    if (hum) apply(hum, 0)
    if (before > 0) {
      // the shield is gone: a faint crackle, no alarm
      play('crackle', { dur: 0.3, gap: 2 }, (v) => [0, 0.07, 0.15].forEach((at) => noiseHit(v, { at, dur: 0.02, peak: 0.02, attack: 0.008, f0: 2500, q: 1 })))
    }
    return false
  }
  hum ??= create(c, bus)
  apply(hum, b)
  return true
}

/** Silence the hum completely (leaving the shield screen). */
export function shieldHumStop(): void {
  charge = 0
  teardown()
}

// Sound switched off: stop the oscillators. Switched back on: pick the hum up again at the last charge.
on('stop', teardown)
on('start', () => {
  if (charge > 0 && !hum) {
    const c = ready()
    const bus = busNode('sfx')
    if (c && bus) {
      hum = create(c, bus)
      apply(hum, charge)
    }
  }
})
