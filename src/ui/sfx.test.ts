import { afterEach, describe, expect, it } from 'vitest'
import { setSoundEnabled, sfx, soundEnabled } from './sfx'

const made = { contexts: 0, tones: 0, noise: 0 }

class FakeAudioContext {
  currentTime = 0
  state = 'running'
  sampleRate = 8000
  destination = {}
  constructor() {
    made.contexts++
  }
  createOscillator() {
    made.tones++
    return { type: '', frequency: { value: 0 }, connect: <T,>(x: T) => x, start: () => undefined, stop: () => undefined }
  }
  createGain() {
    return { gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }, connect: <T,>(x: T) => x }
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(10) }
  }
  createBufferSource() {
    made.noise++
    return { buffer: null, connect: <T,>(x: T) => x, start: () => undefined }
  }
  createBiquadFilter() {
    return { type: '', frequency: { value: 0 }, connect: <T,>(x: T) => x }
  }
  resume() {
    return Promise.resolve()
  }
}

const install = () => Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true })
afterEach(() => {
  made.contexts = made.tones = made.noise = 0
  setSoundEnabled(true)
})

describe('sounds made in code', () => {
  it('a device with no audio does nothing and does not throw', () => {
    setSoundEnabled(true)
    expect(() => {
      sfx.tap()
      sfx.chime()
      sfx.rumble()
      sfx.success()
    }).not.toThrow()
    expect(made.contexts).toBe(0)
  })

  it('Sound Off plays nothing at all', () => {
    install()
    setSoundEnabled(false)
    expect(soundEnabled()).toBe(false)
    sfx.tap()
    sfx.chime()
    sfx.rumble()
    sfx.success()
    expect(made).toEqual({ contexts: 0, tones: 0, noise: 0 })
  })

  it('tap is one soft tone, the chime is two, success is four', () => {
    install()
    setSoundEnabled(true)
    sfx.tap()
    expect(made.tones).toBe(1)
    sfx.chime()
    expect(made.tones).toBe(3)
    sfx.success()
    expect(made.tones).toBe(7)
  })

  it('the rumble is filtered noise, not a tone', () => {
    install()
    setSoundEnabled(true)
    sfx.rumble()
    expect(made.noise).toBe(1)
    expect(made.tones).toBe(0)
  })
})
