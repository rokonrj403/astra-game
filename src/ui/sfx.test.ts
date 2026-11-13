import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetAudioForTests } from '../audio/core'
import { installAudio, MockAudioContext, removeAudio, tapPage } from '../audio/mockAudio'
import { setSoundEnabled, sfx, soundEnabled } from './sfx'

/** Count what a call made, 20 seconds after the last sound so rate limits are clear. */
function made(fn: () => void): { osc: number; noise: number } {
  const c = MockAudioContext.last!
  c.currentTime += 20
  const before = c.nodes.length
  fn()
  const n = c.nodes.slice(before)
  return { osc: n.filter((x) => x.kind === 'osc').length, noise: n.filter((x) => x.kind === 'source').length }
}

beforeEach(() => {
  resetAudioForTests()
  installAudio()
})
afterEach(() => {
  setSoundEnabled(true)
})

describe('sounds made in code (compat layer for the screens)', () => {
  it('a device with no audio does nothing and does not throw', () => {
    removeAudio()
    tapPage()
    expect(() => {
      sfx.tap()
      sfx.chime()
      sfx.rumble()
      sfx.success()
    }).not.toThrow()
    expect(MockAudioContext.instances).toHaveLength(0)
  })

  it('nothing plays before a person taps', () => {
    sfx.tap()
    sfx.chime()
    sfx.rumble()
    sfx.success()
    expect(MockAudioContext.instances).toHaveLength(0)
  })

  it('Sound Off plays nothing at all', () => {
    setSoundEnabled(false)
    expect(soundEnabled()).toBe(false)
    tapPage()
    sfx.tap()
    sfx.chime()
    sfx.rumble()
    sfx.success()
    expect(MockAudioContext.instances).toHaveLength(0)
  })

  it('after a tap: tap is one soft tone, the chime is two, success is the motif and a held note', () => {
    tapPage()
    expect(made(() => sfx.tap())).toEqual({ osc: 1, noise: 0 })
    expect(made(() => sfx.chime())).toEqual({ osc: 2, noise: 0 })
    expect(made(() => sfx.success())).toEqual({ osc: 5, noise: 0 })
  })

  it('the rumble is filtered noise plus upper tones, so a phone speaker can play it', () => {
    tapPage()
    const r = made(() => sfx.rumble())
    expect(r.noise).toBe(2)
    expect(r.osc).toBe(2)
  })
})
