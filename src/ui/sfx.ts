/**
 * Small sounds made in code with the Web Audio API: no files to download, nothing to credit, works offline.
 * They are quiet, short and gentle. Nothing plays until a person taps (browsers need that), and "Sound Off" in Settings mutes all of it.
 */
let enabled = true
let ctx: AudioContext | null = null

export function setSoundEnabled(on: boolean): void {
  enabled = on
}
export function soundEnabled(): boolean {
  return enabled
}

type Ctor = typeof AudioContext

function audio(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null
  try {
    const C: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
    if (!C) return null
    ctx ??= new C()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = 'sine', peak = 0.07): void {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, c.currentTime + at)
  g.gain.exponentialRampToValueAtTime(peak, c.currentTime + at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur)
  o.connect(g).connect(c.destination)
  o.start(c.currentTime + at)
  o.stop(c.currentTime + at + dur + 0.02)
}

export const sfx = {
  /** A soft click for any button. */
  tap(): void {
    const c = audio()
    if (c) tone(c, 620, 0, 0.05, 'sine', 0.05)
  },
  /** Two gentle notes: something to notice (a storm warning). */
  chime(): void {
    const c = audio()
    if (!c) return
    tone(c, 660, 0, 0.18, 'sine', 0.07)
    tone(c, 880, 0.14, 0.28, 'sine', 0.07)
  },
  /** A low rumble: the storm is here. Filtered noise, not scary. */
  rumble(): void {
    const c = audio()
    if (!c) return
    const len = Math.floor(c.sampleRate * 0.9)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buf
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 160
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + 0.25)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.9)
    src.connect(lp).connect(g).connect(c.destination)
    src.start()
  },
  /** A rising arpeggio: the mission is complete. */
  success(): void {
    const c = audio()
    if (!c) return
    ;[523, 659, 784, 1047].forEach((f, i) => tone(c, f, i * 0.12, 0.3, 'triangle', 0.07))
  },
}
