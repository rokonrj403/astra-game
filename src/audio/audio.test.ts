import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUDIO_KEY,
  allClear,
  astraMotif,
  bedRunning,
  blockPlaced,
  cardFlip,
  dayStart,
  duckBed,
  flareSound,
  getVolume,
  lowWarning,
  missionComplete,
  missionFailedGentle,
  moonwalk,
  musicEnabled,
  onTwin,
  orbiChirp,
  orbiHello,
  raysArrive,
  scienceGained,
  setHaptics,
  setMood,
  setMusicEnabled,
  setSoundEnabled,
  setVolume,
  shieldHum,
  shieldHumStop,
  stormRumble,
  tap,
  type TwinEvent,
} from './index'
import { MAX_VOICES, play, resetAudioForTests, tone } from './core'
import { FADE_TC, resetBedForTests, setBedRandom } from './bed'
import { humSettings } from './hum'
import { REVEAL_DUR, REVEAL_PEAK } from './events'
import { installAudio, MockAudioContext, Param, removeAudio, tapPage, type MockNode } from './mockAudio'

const ctx = (): MockAudioContext => {
  const c = MockAudioContext.last
  if (!c) throw new Error('no audio context yet')
  return c
}
const freq = (n: MockNode): number => n.frequency.calls[0]?.args[0] ?? 0
const freqs = (nodes: MockNode[]): number[] => nodes.filter((n) => n.kind === 'osc').map(freq)
const near = (a: number, b: number, tol = 1): boolean => Math.abs(a - b) <= tol
/** Run something and return the nodes it created. */
function nodesOf(fn: () => unknown): MockNode[] {
  const c = ctx()
  c.currentTime += 20 // clear every rate limit
  const before = c.nodes.length
  fn()
  return c.nodes.slice(before)
}
/** Latest scheduled time and highest gain among the gain nodes of a sound. */
function shape(nodes: MockNode[]): { end: number; peak: number } {
  // FM depth / vibrato gains feed a pitch, not the speakers
  const gains = nodes.filter((n) => n.kind === 'gain' && !n.out.some((o) => o instanceof Param))
  const base = ctx().currentTime
  return { end: Math.max(...gains.map((g) => g.gain.endTime)) - base, peak: Math.max(...gains.map((g) => g.gain.peak)) }
}
const unlock = (): void => {
  tapPage()
  ctx().currentTime += 20
}

beforeEach(() => {
  localStorage.clear()
  resetAudioForTests()
  resetBedForTests()
  shieldHumStop()
  installAudio()
  setBedRandom(() => 0.1)
})
afterEach(() => {
  vi.useRealTimers()
  setHaptics(false)
})

describe('audio core: unlock and routing', () => {
  it('a device with no Web Audio does nothing and does not throw', () => {
    removeAudio()
    tapPage()
    expect(() => {
      tap()
      flareSound({ size: 3, cloud: true, side: 'west' })
      shieldHum(3)
      setMood('storm')
      allClear()
    }).not.toThrow()
    expect(MockAudioContext.instances).toHaveLength(0)
  })

  it('nothing is created or played before the first tap', () => {
    expect(tap()).toBe(false)
    expect(missionComplete()).toBe(false)
    expect(flareSound({ size: 1, cloud: false, side: 'center' })).toBe(false)
    setMood('watch')
    expect(MockAudioContext.instances).toHaveLength(0)
  })

  it('the first tap creates the context, plays the full ASTRA motif and the iOS silent buffer', () => {
    tapPage()
    const c = ctx()
    expect(MockAudioContext.instances).toHaveLength(1)
    // iOS trick: a 1-sample buffer is played
    expect(c.buffers.some((b) => b.length === 1)).toBe(true)
    const silent = c.of('source').find((s) => s.started.length > 0 && s.out.includes(c.destination))
    expect(silent).toBeDefined()
    const notes = c.of('osc')
    expect(freqs(notes).map(Math.round)).toEqual([440, 587, 740, 880])
    expect(notes.every((n) => n.type === 'triangle')).toBe(true)
    // 90 ms apart
    const starts = notes.map((n) => n.started[0]?.[0] ?? 0)
    expect(starts[1]! - starts[0]!).toBeCloseTo(0.09, 5)
  })

  it('the first tap click is held back so it does not pile onto the motif', () => {
    tapPage()
    expect(tap()).toBe(false)
    ctx().currentTime += 1
    expect(tap()).toBe(true)
  })

  it('routes sfx / bed / voice buses into a master gain, then a compressor, then the speakers', () => {
    tapPage()
    const c = ctx()
    const comp = c.of('compressor')[0]!
    expect(comp.out).toContain(c.destination)
    const master = c.of('gain').find((g) => g.out.includes(comp))!
    expect(master.gain.calls[0]?.args[0]).toBeCloseTo(0.7)
    const buses = c.of('gain').filter((g) => g.out.includes(master))
    expect(buses).toHaveLength(3)
    // the motif goes through the sfx bus
    const motifGain = c.of('gain').find((g) => g.out.some((o) => buses.includes(o as MockNode)))
    expect(motifGain).toBeDefined()
  })

  it('the voice bus is used for ORBI chirps and the bed bus for the bed', () => {
    unlock()
    const c = ctx()
    const master = c.of('gain').find((g) => g.out.includes(c.of('compressor')[0]!))!
    const [sfxBus, bedBus, voiceBus] = c.of('gain').filter((g) => g.out.includes(master))
    void sfxBus
    const chirp = nodesOf(() => orbiChirp('happy', 3))
    expect(chirp.some((n) => n.out.includes(voiceBus))).toBe(true)
    setMood('calm')
    expect(c.of('gain').some((g) => g.out.includes(bedBus))).toBe(true)
  })

  it('resumes a suspended context on the next tap, and suspends when the page is hidden', () => {
    tapPage()
    const c = ctx()
    c.state = 'suspended'
    tapPage()
    expect(c.resumed).toBeGreaterThan(0)
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(c.suspended).toBe(1)
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(c.state).toBe('running')
  })
})

describe('mute, volume and the music switch', () => {
  it('Sound Off before any tap never creates a context', () => {
    setSoundEnabled(false)
    tapPage()
    expect(MockAudioContext.instances).toHaveLength(0)
    expect(tap()).toBe(false)
  })

  it('Sound Off silences and suspends; Sound On brings it back', () => {
    unlock()
    const c = ctx()
    const master = c.of('gain').find((g) => g.out.includes(c.of('compressor')[0]!))!
    setSoundEnabled(false)
    expect(master.gain.last).toBe(0)
    expect(c.suspended).toBe(1)
    const made = nodesOf(() => {
      tap()
      flareSound({ size: 2, cloud: true, side: 'east' })
      stormRumble()
      missionComplete()
    })
    expect(made).toHaveLength(0)
    setSoundEnabled(true)
    expect(master.gain.last).toBeCloseTo(0.7)
    expect(c.resumed).toBeGreaterThan(0)
    expect(nodesOf(() => tap()).length).toBeGreaterThan(0)
  })

  it('volume is clamped, applied to the master and saved on this device', () => {
    unlock()
    const c = ctx()
    const master = c.of('gain').find((g) => g.out.includes(c.of('compressor')[0]!))!
    setVolume(0.3)
    expect(master.gain.last).toBeCloseTo(0.3)
    expect(JSON.parse(localStorage.getItem(AUDIO_KEY) ?? '{}')).toEqual({ volume: 0.3, music: true })
    setVolume(5)
    expect(getVolume()).toBe(1)
    setVolume(-2)
    expect(getVolume()).toBe(0)
    setVolume(Number.NaN)
    expect(getVolume()).toBeCloseTo(0.7)
  })

  it('a saved volume and music choice come back after a restart', () => {
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ volume: 0.4, music: false }))
    expect(getVolume()).toBeCloseTo(0.4)
    expect(musicEnabled()).toBe(false)
  })

  it('a broken or blocked store does not break anything', () => {
    localStorage.setItem(AUDIO_KEY, '{not json')
    expect(getVolume()).toBeCloseTo(0.7)
    expect(() => setVolume(0.5)).not.toThrow()
  })

  it('duckBed lowers the bed by 8 dB and restores it', () => {
    unlock()
    const c = ctx()
    setMood('calm')
    const master = c.of('gain').find((g) => g.out.includes(c.of('compressor')[0]!))!
    const bedBus = c.of('gain').filter((g) => g.out.includes(master))[1]!
    duckBed(true)
    expect(bedBus.gain.last).toBeCloseTo(0.4, 1)
    expect(20 * Math.log10(bedBus.gain.last!)).toBeCloseTo(-8, 0)
    duckBed(false)
    expect(bedBus.gain.last).toBe(1)
  })
})

describe('rate limits and the 6 voice cap', () => {
  it('the same sound twice within 60 ms plays once', () => {
    unlock()
    expect(tap()).toBe(true)
    expect(tap()).toBe(false)
    ctx().currentTime += 0.07
    expect(tap()).toBe(true)
  })

  it('lowWarning repeats at most every 8 seconds', () => {
    unlock()
    expect(lowWarning()).toBe(true)
    ctx().currentTime += 7.9
    expect(lowWarning()).toBe(false)
    ctx().currentTime += 0.2
    expect(lowWarning()).toBe(true)
  })

  it('no more than 6 sounds play at once', () => {
    unlock()
    const results = Array.from({ length: MAX_VOICES + 2 }, (_, i) => play(`s${i}`, { dur: 5 }, (v) => tone(v, { freq: 400, dur: 1 })))
    expect(results.filter(Boolean)).toHaveLength(MAX_VOICES)
    ctx().currentTime += 6
    expect(play('later', { dur: 1 }, (v) => tone(v, { freq: 400, dur: 1 }))).toBe(true)
  })
})

describe('the ASTRA motif and where it plays', () => {
  it('ORBI hello is A - D, day start is A - D - F#, mission complete is the full motif and a held D6', () => {
    unlock()
    expect(freqs(nodesOf(orbiHello)).map(Math.round)).toEqual([440, 587])
    expect(freqs(nodesOf(dayStart)).map(Math.round)).toEqual([440, 587, 740])
    const done = nodesOf(missionComplete)
    expect(freqs(done.filter((n) => n.kind === 'osc')).map(Math.round)).toEqual([440, 587, 740, 880, 1175])
    expect(shape(done).end).toBeLessThanOrEqual(1.5)
  })

  it('a card flip is a paper tick then A - D', () => {
    unlock()
    const n = nodesOf(cardFlip)
    expect(n.filter((x) => x.kind === 'source')).toHaveLength(1)
    expect(freqs(n.filter((x) => x.kind === 'osc')).map(Math.round)).toEqual([440, 587])
  })

  it('astraMotif can be replayed on purpose', () => {
    unlock()
    expect(nodesOf(astraMotif).filter((x) => x.kind === 'osc')).toHaveLength(4)
  })

  it('gentle failure is F# - D - A, soft sine notes through a 1500 Hz lowpass, then a rising chirp; no buzzer', () => {
    unlock()
    const n = nodesOf(missionFailedGentle)
    const oscs = n.filter((x) => x.kind === 'osc')
    expect(freqs(oscs).slice(0, 3).map(Math.round)).toEqual([740, 587, 440])
    expect(oscs.every((o) => o.type === 'sine')).toBe(true)
    expect(n.filter((x) => x.kind === 'filter').some((f) => freq(f) === 1500)).toBe(true)
    // chirp syllables rise
    const chirp = oscs.slice(3).filter((o) => freq(o) > 800 && freq(o) < 2000)
    expect(chirp.length).toBeGreaterThan(0)
    expect(shape(n).end).toBeLessThanOrEqual(1.5)
    expect(shape(n).peak).toBeLessThanOrEqual(0.06)
  })
})

describe('ORBI chirp', () => {
  it('syllables are words / 3, between 1 and 4; a warning is two falling notes; long lines are skipped', () => {
    unlock()
    // a carrier is an oscillator that glides (the FM modulators and vibrato hold a fixed pitch)
    const carriers = (m: 'question' | 'warning' | 'happy', w: number): number =>
      nodesOf(() => orbiChirp(m, w)).filter((x) => x.kind === 'osc' && x.frequency.calls.some((c) => c.fn === 'exp')).length
    expect(carriers('question', 3)).toBe(1)
    expect(carriers('question', 9)).toBe(3)
    expect(carriers('question', 12)).toBe(4)
    expect(carriers('question', 99)).toBe(0)
    expect(carriers('warning', 12)).toBe(2)
    const w = nodesOf(() => orbiChirp('warning', 6)).filter((x) => x.kind === 'osc' && x.frequency.calls.some((c) => c.fn === 'exp'))
    expect(freq(w[1]!)).toBeLessThan(freq(w[0]!))
    const q = nodesOf(() => orbiChirp('question', 9)).filter((x) => x.kind === 'osc' && x.frequency.calls.some((c) => c.fn === 'exp'))
    expect(freq(q[2]!)).toBeGreaterThan(freq(q[0]!))
  })

  it('uses FM at a 2x ratio, 150 Hz deep, and vibrato for the happy trill', () => {
    unlock()
    const n = nodesOf(() => orbiChirp('happy', 3))
    const carrier = n.find((x) => x.kind === 'osc' && x.frequency.calls.some((c) => c.fn === 'exp'))!
    const mod = n.find((x) => x.kind === 'osc' && x !== carrier && near(freq(x), freq(carrier) * 2, 0.01))!
    expect(mod).toBeDefined()
    expect(mod.out.some((g) => (g as MockNode).kind === 'gain' && (g as MockNode).gain.calls[0]?.args[0] === 150)).toBe(true)
    expect(n.some((x) => x.kind === 'osc' && freq(x) === 12)).toBe(true)
  })
})

describe('learning-coded flare sound', () => {
  const whooshes = (n: MockNode[]): MockNode[] => n.filter((x) => x.kind === 'source')

  it('flare size is the number of pulses: 1, 2 or 3', () => {
    unlock()
    for (const size of [1, 2, 3] as const) expect(whooshes(nodesOf(() => flareSound({ size, cloud: false, side: 'center' })))).toHaveLength(size)
  })

  it('each pulse is a bandpass noise sweep 800 to 2400 Hz, Q 2, 250 ms with a 120 ms attack', () => {
    unlock()
    const n = nodesOf(() => flareSound({ size: 1, cloud: false, side: 'center' }))
    const f = n.find((x) => x.kind === 'filter')!
    expect(f.type).toBe('bandpass')
    expect(f.Q.value).toBe(2)
    expect(f.frequency.calls[0]?.args[0]).toBe(800)
    expect(f.frequency.calls[1]?.args[0]).toBe(2400)
    const g = n.find((x) => x.kind === 'gain')!
    expect(g.gain.calls[1]?.args[1]! - g.gain.calls[0]?.args[1]!).toBeCloseTo(0.12, 5)
    expect(g.gain.peak).toBeLessThanOrEqual(0.1)
  })

  it('pulses are spaced apart and rise a little in pitch', () => {
    unlock()
    const n = nodesOf(() => flareSound({ size: 3, cloud: false, side: 'center' }))
    const starts = whooshes(n).map((s) => s.started[0]![0]! - ctx().currentTime)
    expect(starts[1]! - starts[0]!).toBeGreaterThan(0.25)
    const sweeps = n.filter((x) => x.kind === 'filter').map(freq)
    expect(sweeps[2]!).toBeGreaterThan(sweeps[0]!)
  })

  it('a gas cloud adds a low swell (220 Hz triangle plus a 440 Hz helper); no cloud, no swell', () => {
    unlock()
    const withCloud = nodesOf(() => flareSound({ size: 2, cloud: true, side: 'center' }))
    expect(withCloud.some((x) => x.kind === 'osc' && x.type === 'triangle' && freq(x) === 220)).toBe(true)
    expect(withCloud.some((x) => x.kind === 'osc' && freq(x) === 440)).toBe(true)
    const without = nodesOf(() => flareSound({ size: 2, cloud: false, side: 'center' }))
    expect(without.filter((x) => x.kind === 'osc')).toHaveLength(0)
  })

  it('the Sun side pans the sound: west to the right, east to the left, center not at all', () => {
    unlock()
    const pan = (side: 'east' | 'west' | 'center'): number[] =>
      nodesOf(() => flareSound({ size: 1, cloud: false, side }))
        .filter((x) => x.kind === 'panner')
        .map((p) => p.pan.calls[0]!.args[0]!)
    expect(pan('west')[0]).toBeGreaterThan(0.5)
    expect(pan('east')[0]).toBeLessThan(-0.5)
    expect(pan('center')).toEqual([])
  })

  it('still plays, unpanned, where StereoPannerNode does not exist (old Safari)', () => {
    unlock()
    const proto = MockAudioContext.prototype as unknown as { createStereoPanner?: unknown }
    const saved = proto.createStereoPanner
    proto.createStereoPanner = undefined
    try {
      expect(nodesOf(() => flareSound({ size: 1, cloud: false, side: 'west' })).some((x) => x.kind === 'source')).toBe(true)
    } finally {
      proto.createStereoPanner = saved
    }
  })

  it('a silly size is clamped to 1..3', () => {
    unlock()
    expect(whooshes(nodesOf(() => flareSound({ size: 9 as 3, cloud: false, side: 'center' })))).toHaveLength(3)
    expect(whooshes(nodesOf(() => flareSound({ size: 0 as 1, cloud: false, side: 'center' })))).toHaveLength(1)
  })
})

describe('rays and all clear are equally long and loud', () => {
  it('same duration and same peak, shielded or not', () => {
    unlock()
    const clear = shape(nodesOf(allClear))
    const shielded = shape(nodesOf(() => raysArrive(4)))
    const bare = shape(nodesOf(() => raysArrive(0)))
    for (const s of [clear, shielded, bare]) {
      expect(s.end).toBeCloseTo(REVEAL_DUR, 5)
      expect(s.peak).toBeCloseTo(REVEAL_PEAK, 5)
    }
  })

  it('rays: a noise sweep from 3000 down to 600 Hz; shielded adds a D4 + A4 bloom, unshielded a soft 440 to 392 slide', () => {
    unlock()
    const s = nodesOf(() => raysArrive(3))
    const f = s.find((x) => x.kind === 'filter')!
    expect([f.frequency.calls[0]?.args[0], f.frequency.calls[1]?.args[0]]).toEqual([3000, 600])
    expect(freqs(s.filter((x) => x.kind === 'osc')).map(Math.round)).toEqual([294, 440])
    const u = nodesOf(() => raysArrive(0))
    const slide = u.find((x) => x.kind === 'osc')!
    expect([freq(slide), slide.frequency.calls[1]?.args[0]]).toEqual([440, 392])
  })

  it('all clear: triangle D5 - A5 - F#6 and a lowpass exhale 400 -> 2000 -> 300 Hz', () => {
    unlock()
    const s = nodesOf(allClear)
    const o = s.filter((x) => x.kind === 'osc')
    expect(o.every((x) => x.type === 'triangle')).toBe(true)
    expect(freqs(o).map(Math.round)).toEqual([587, 880, 1480])
    const f = s.find((x) => x.kind === 'filter')!
    expect(f.type).toBe('lowpass')
    expect(f.frequency.calls.map((c) => c.args[0])).toEqual([400, 2000, 300])
  })

  it('all clear brings a running bed back to calm, but does not start a bed by itself', () => {
    unlock()
    allClear()
    expect(bedRunning()).toBe(false)
    setMood('storm')
    ctx().currentTime += 20
    allClear()
    const targets = ctx().of('gain').filter((g) => g.gain.calls.some((x) => x.fn === 'target' && x.args[2] === FADE_TC))
    expect(targets[2]?.gain.last).toBe(0.0001)
  })
})

describe('other game sounds', () => {
  it('science gained is a D - F# - A sparkle', () => {
    unlock()
    expect(freqs(nodesOf(scienceGained)).slice(0, 3).map(Math.round)).toEqual([587, 740, 880])
  })

  it('low warning is one soft 330 Hz double pulse', () => {
    unlock()
    const n = nodesOf(lowWarning).filter((x) => x.kind === 'osc')
    expect(n.filter((x) => freq(x) === 330)).toHaveLength(2)
  })

  it('moonwalk is two noise puffs 400 ms apart, each with a low bounce', () => {
    unlock()
    const n = nodesOf(moonwalk)
    const puffs = n.filter((x) => x.kind === 'source').map((s) => s.started[0]![0]!)
    expect(puffs[1]! - puffs[0]!).toBeCloseTo(0.4, 5)
    expect(n.filter((x) => x.kind === 'osc')).toHaveLength(2)
    expect(n.find((x) => x.kind === 'filter')!.type).toBe('bandpass')
  })

  it('block placed is a tock and a small high note', () => {
    unlock()
    expect(freqs(nodesOf(blockPlaced)).map(Math.round)).toEqual([523, 784])
  })

  it('tap is one 620 Hz sine of 40 ms', () => {
    unlock()
    const n = nodesOf(tap).filter((x) => x.kind === 'osc')
    expect(n).toHaveLength(1)
    expect(freq(n[0]!)).toBe(620)
  })
})

describe('the storm rumble works on a cheap phone speaker', () => {
  it('has body above 200 Hz: bandpass noise near 450 Hz and harmonic-rich oscillators, not only a 160 Hz lowpass', () => {
    unlock()
    const n = nodesOf(stormRumble)
    expect(n.filter((x) => x.kind === 'source').length).toBeGreaterThanOrEqual(2)
    const filters = n.filter((x) => x.kind === 'filter')
    expect(filters.some((f) => f.type === 'bandpass' && freq(f) >= 400)).toBe(true)
    expect(filters.every((f) => f.type !== 'lowpass' || freq(f) >= 200)).toBe(true)
    const osc = n.filter((x) => x.kind === 'osc')
    expect(osc.some((o) => o.type === 'sawtooth')).toBe(true)
    expect(osc.some((o) => o.type === 'triangle' && freq(o) >= 150)).toBe(true)
  })

  it('stays under -12 dBFS and under 1.5 s', () => {
    unlock()
    const s = shape(nodesOf(stormRumble))
    expect(s.end).toBeLessThanOrEqual(1.5)
    expect(s.peak).toBeLessThanOrEqual(0.25)
  })
})

describe('mix rules hold for every one-shot sound', () => {
  it('attack of 8 ms or more, peaks under 0.25, nothing longer than 1.5 s', () => {
    unlock()
    const all: Array<() => unknown> = [
      tap,
      blockPlaced,
      astraMotif,
      orbiHello,
      dayStart,
      cardFlip,
      missionComplete,
      missionFailedGentle,
      scienceGained,
      lowWarning,
      moonwalk,
      stormRumble,
      allClear,
      () => raysArrive(2),
      () => flareSound({ size: 3, cloud: true, side: 'west' }),
      () => orbiChirp('happy', 12),
    ]
    for (const fn of all) {
      const n = nodesOf(fn)
      const s = shape(n)
      expect(s.peak).toBeLessThanOrEqual(0.25)
      expect(s.end).toBeLessThanOrEqual(1.5)
      for (const g of n.filter((x) => x.kind === 'gain')) {
        const c = g.gain.calls
        if (c.length === 3 && c[1]?.fn === 'exp') expect(c[1].args[1]! - c[0]!.args[1]!).toBeGreaterThanOrEqual(0.0079)
      }
    }
  })
})

describe('shield hum', () => {
  it('maps charge to the recipe: 147 Hz always, 220 from 2 blocks, 294 from 4, cutoff 300 + 150b, wobble 0.5 down to 0.1', () => {
    expect(humSettings(0).g147).toBe(0)
    expect(humSettings(1)).toMatchObject({ g220: 0, g294: 0, cutoff: 450 })
    expect(humSettings(2).g220).toBeCloseTo(0.024)
    expect(humSettings(3).g294).toBe(0)
    expect(humSettings(4).g294).toBeCloseTo(0.048)
    expect(humSettings(6)).toMatchObject({ cutoff: 1200 })
    expect(humSettings(1).wobble).toBeCloseTo(0.5)
    expect(humSettings(6).wobble).toBeCloseTo(0.1)
    expect(humSettings(6).g147).toBeCloseTo(0.072)
  })

  it('builds the hum once and glides to each new charge (0.3 s time constant)', () => {
    unlock()
    const c = ctx()
    expect(shieldHum(2)).toBe(true)
    const hum = (): MockNode[] => c.of('osc').filter((o) => [147, 220, 294, 441, 4].includes(freq(o)))
    expect(hum()).toHaveLength(5) // 147, 220, 294, 441 and the 4 Hz wobble
    shieldHum(5)
    expect(hum()).toHaveLength(5)
    const lp = c.of('filter').find((f) => f.type === 'lowpass')!
    const t = lp.frequency.calls.filter((x) => x.fn === 'target')
    expect(t.map((x) => x.args[0])).toEqual([600, 1050])
    expect(t.every((x) => x.args[2] === 0.3)).toBe(true)
  })

  it('a bigger charge is a steadier hum: wobble depth shrinks', () => {
    unlock()
    const c = ctx()
    shieldHum(1)
    const trem = c.of('gain').filter((g) => g.gain.calls.some((x) => x.fn === 'target' && x.args[0]! > 0.7 && x.args[0]! < 1))
    expect(trem.length).toBeGreaterThan(0)
    const first = trem[0]!.gain.last!
    shieldHum(6)
    expect(trem[0]!.gain.last!).toBeGreaterThan(first)
  })

  it('adding a block clicks (an 80 ms glide up a step); removing one does not', () => {
    unlock()
    const up = nodesOf(() => shieldHum(1)).filter((x) => x.kind === 'osc' && x.frequency.calls.some((c) => c.fn === 'exp'))
    expect(up).toHaveLength(1)
    expect([freq(up[0]!), up[0]!.frequency.calls[1]?.args[0]]).toEqual([440, 494])
    const down = nodesOf(() => shieldHum(0)).filter((x) => x.kind === 'osc')
    expect(down).toHaveLength(0)
  })

  it('zero blocks fades the hum to silence and leaves a faint crackle (once)', () => {
    unlock()
    const c = ctx()
    shieldHum(3)
    const n = nodesOf(() => shieldHum(0))
    expect(n.filter((x) => x.kind === 'source')).toHaveLength(3)
    expect(shape(n).peak).toBeLessThanOrEqual(0.02)
    const g147 = c.of('gain').find((g) => g.gain.calls.some((x) => x.fn === 'target' && Math.abs(x.args[0]! - 0.036) < 1e-9))!
    expect(g147.gain.last).toBeCloseTo(0.0001)
    expect(nodesOf(() => shieldHum(0)).filter((x) => x.kind === 'source')).toHaveLength(0)
  })

  it('stops completely when sound is switched off and comes back at the last charge', () => {
    unlock()
    const c = ctx()
    shieldHum(4)
    const oscs = c.of('osc').filter((o) => [147, 220, 294, 441, 4].includes(freq(o)))
    expect(oscs).toHaveLength(5)
    setSoundEnabled(false)
    expect(oscs.every((o) => o.stopped.length > 0)).toBe(true)
    const before = c.of('osc').length
    setSoundEnabled(true)
    expect(c.of('osc').length - before).toBe(5)
  })

  it('shieldHumStop ends the hum', () => {
    unlock()
    shieldHum(2)
    const oscs = ctx().of('osc').filter((o) => [147, 4].includes(freq(o)))
    shieldHumStop()
    expect(oscs.every((o) => o.stopped.length > 0)).toBe(true)
  })

  it('clamps and rounds odd input', () => {
    unlock()
    expect(() => {
      shieldHum(99)
      shieldHum(-4)
      shieldHum(Number.NaN)
    }).not.toThrow()
  })
})

describe('adaptive bed', () => {
  const layerTargets = (): { watch: number | undefined; storm: number | undefined } => {
    const c = ctx()
    const targets = c.of('gain').filter((g) => g.gain.calls.some((x) => x.fn === 'target' && x.args[2] === FADE_TC))
    // layers in creation order: calm, watch, storm
    return { watch: targets[1]?.gain.last, storm: targets[2]?.gain.last }
  }

  it('stays silent until the game asks for a mood, and until the first tap', () => {
    setMood('watch')
    expect(bedRunning()).toBe(false)
    expect(MockAudioContext.instances).toHaveLength(0)
    tapPage()
    expect(bedRunning()).toBe(true)
  })

  it('does not start by itself after a tap if no mood was ever set', () => {
    unlock()
    expect(bedRunning()).toBe(false)
  })

  it('calm: only the pad. watch adds E3 and the breath. storm adds the saw and opens the breath to 1200 Hz', () => {
    unlock()
    const c = ctx()
    setMood('calm')
    const oscs = c.of('osc')
    expect([73, 110, 147, 220, 165].every((f) => oscs.some((o) => near(freq(o), f, 0.5)))).toBe(true)
    expect(layerTargets()).toEqual({ watch: 0.0001, storm: 0.0001 })
    setMood('watch')
    expect(layerTargets()).toEqual({ watch: 1, storm: 0.0001 })
    const breath = c.of('filter').find((f) => f.type === 'lowpass' && freq(f) === 500)!
    expect(breath.frequency.last).toBe(500)
    setMood('storm')
    expect(layerTargets()).toEqual({ watch: 1, storm: 1 })
    expect(breath.frequency.last).toBe(1200)
    expect(oscs.some((o) => o.type === 'sawtooth' && freq(o) === 147)).toBe(true)
    setMood('calm')
    expect(layerTargets()).toEqual({ watch: 0.0001, storm: 0.0001 })
  })

  it('crossfades take about 2 seconds (time constant 0.5 s, 98% by 2 s)', () => {
    expect(1 - Math.exp(-2 / FADE_TC)).toBeGreaterThan(0.97)
  })

  it('the whole bed in storm stays under -18 dB (0.126)', () => {
    unlock()
    setMood('storm')
    const sum = ctx()
      .of('gain')
      .map((g) => g.gain.calls[0]?.args[0] ?? 0)
      .filter((v) => v > 0.0001 && v < 0.05)
      .reduce((a, b) => a + b, 0)
    expect(sum).toBeLessThanOrEqual(0.126)
  })

  it('setting the same mood twice does not rebuild the bed', () => {
    unlock()
    setMood('watch')
    const n = ctx().nodes.length
    setMood('watch')
    expect(ctx().nodes.length).toBe(n)
  })

  it('crackle clicks only happen in a storm', () => {
    vi.useFakeTimers()
    unlock()
    setMood('watch')
    const before = ctx().of('source').length
    vi.advanceTimersByTime(3000)
    expect(ctx().of('source').length).toBe(before)
    setMood('storm')
    vi.advanceTimersByTime(3000)
    const clicks = ctx().of('source').length - before
    expect(clicks).toBeGreaterThanOrEqual(5)
    const click = ctx().of('source').at(-1)!
    expect(click.stopped[0]![0]! - click.started[0]![0]!).toBeLessThanOrEqual(0.05)
  })

  it('the Music switch stops and restarts the bed without touching sound effects', () => {
    unlock()
    setMood('watch')
    expect(bedRunning()).toBe(true)
    const oscs = ctx().of('osc')
    setMusicEnabled(false)
    expect(bedRunning()).toBe(false)
    expect(oscs.every((o) => o.stopped.length > 0)).toBe(true)
    expect(nodesOf(tap).length).toBeGreaterThan(0)
    setMusicEnabled(true)
    expect(bedRunning()).toBe(true)
  })

  it('Sound Off stops the bed at once; Sound On starts it again in the same mood', () => {
    unlock()
    setMood('storm')
    setSoundEnabled(false)
    expect(bedRunning()).toBe(false)
    setSoundEnabled(true)
    expect(bedRunning()).toBe(true)
  })

  it('Music off from a saved setting keeps the bed away', () => {
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ volume: 0.7, music: false }))
    unlock()
    setMood('calm')
    expect(bedRunning()).toBe(false)
  })
})

describe('visual twins', () => {
  const collect = (): { events: TwinEvent[]; off: () => void } => {
    const events: TwinEvent[] = []
    return { events, off: onTwin((e) => events.push(e)) }
  }

  it('fire for every sound, even before a tap and even when muted', () => {
    const { events, off } = collect()
    flareSound({ size: 2, cloud: true, side: 'west' })
    expect(events[0]).toMatchObject({ kind: 'flare', size: 2, cloud: true, side: 'west', muted: false })
    setSoundEnabled(false)
    allClear()
    raysArrive(3)
    scienceGained()
    shieldHum(2)
    missionFailedGentle()
    expect(events.slice(1).map((e) => e.kind)).toEqual(['allClear', 'rays', 'science', 'shield', 'missionFailed'])
    expect(events.slice(1).every((e) => e.muted)).toBe(true)
    off()
  })

  it('say whether the child prefers reduced motion, so the screen can show a still caption instead of a flash', () => {
    const { events, off } = collect()
    const mm = vi.fn().mockReturnValue({ matches: true })
    Object.defineProperty(window, 'matchMedia', { value: mm, configurable: true, writable: true })
    lowWarning()
    expect(mm).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
    expect(events[0]?.reducedMotion).toBe(true)
    Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false }), configurable: true, writable: true })
    moonwalk()
    expect(events[1]?.reducedMotion).toBe(false)
    off()
  })

  it('unsubscribing stops the events; a throwing listener does not break the sound', () => {
    const { events, off } = collect()
    const bad = onTwin(() => {
      throw new Error('boom')
    })
    off()
    unlock()
    expect(() => tap()).not.toThrow()
    expect(() => scienceGained()).not.toThrow()
    expect(events).toHaveLength(0)
    bad()
  })

  it('vibrates only if haptics are on and motion is not reduced', () => {
    const vib = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vib, configurable: true, writable: true })
    Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false }), configurable: true, writable: true })
    flareSound({ size: 1, cloud: false, side: 'center' })
    expect(vib).not.toHaveBeenCalled()
    setHaptics(true)
    flareSound({ size: 1, cloud: false, side: 'center' })
    expect(vib).toHaveBeenCalledWith(30)
    Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: true }), configurable: true, writable: true })
    vib.mockClear()
    flareSound({ size: 1, cloud: false, side: 'center' })
    expect(vib).not.toHaveBeenCalled()
  })

  it('the mood change is announced once per change', () => {
    const { events, off } = collect()
    setMood('watch')
    setMood('watch')
    setMood('storm')
    expect(events.filter((e) => e.kind === 'mood').map((e) => e.mood)).toEqual(['watch', 'storm'])
    off()
  })
})

describe('music switch default', () => {
  it('is on by default', () => {
    expect(musicEnabled()).toBe(true)
  })
})
