import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { getVolume, musicEnabled, onTwin, setMusicEnabled, setVolume, type TwinEvent } from '../audio'
import { resetAudioForTests } from '../audio/core'
import { installAudio } from '../audio/mockAudio'
import { emitTwin } from '../audio/twins'
import { newGame, step } from '../engine/game'
import { makeRng } from '../engine/rng'
import type { GameState } from '../engine/types'
import { Settings } from './pages'
import { flareCue, lowToday, moodFor, revealCue } from './cues'
import { TwinHost } from './twin'

beforeEach(() => {
  resetAudioForTests()
  installAudio()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

const calm = (mode: 'cadet' | 'commander' = 'cadet'): GameState => ({ ...newGame({ mode, siteId: 'region-3', seed: 2 }), storms: [], flares: [], flareSeen: [], flareResolved: [], guesses: [] })
const watched = (): GameState => ({
  ...calm(),
  day: 3,
  storms: [{ stormId: 'storm-6', arrivalDay: 4, size: 'small', profile: [1] }],
  flares: [{ flareId: 'flr-44029', day: 2, stormIndex: 0 }],
  flareSeen: [true],
  flareResolved: [false],
  guesses: [null],
})

describe('every sound has a picture twin', () => {
  it('shows a chip for a meaningful cue, then lets it go', () => {
    render(<TwinHost />)
    expect(screen.queryByRole('status')).toBeNull()
    act(() => emitTwin('rays', { level: 3, shielded: true }))
    expect(screen.getByRole('status', { name: 'Space rays' })).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('stays still under reduced motion, and ignores cues that are the game’s own (taps, mood)', () => {
    render(<TwinHost />)
    act(() => emitTwin('mood', {}))
    act(() => emitTwin('blockPlaced', {}))
    expect(screen.queryByRole('status')).toBeNull()
    const original = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia
    act(() => emitTwin('allClear', {}))
    window.matchMedia = original
    expect(screen.getByRole('status', { name: 'All clear' })).toBeTruthy()
  })
})

describe('cues for the screens', () => {
  const heard: TwinEvent[] = []
  beforeEach(() => {
    heard.length = 0
    onTwin((e) => heard.push(e))
  })

  it('a flare sounds with its size, gas cloud and (Commander only) the side of the Sun', () => {
    flareCue({ class: 'X1.9', cloud: true, side: 'west' }, 'commander')
    flareCue({ class: 'M5.2', cloud: false, side: 'east' }, 'cadet')
    const [a, b] = heard.filter((e) => e.kind === 'flare')
    expect([a!.size, a!.cloud, a!.side]).toEqual([2, true, 'west'])
    expect([b!.size, b!.cloud, b!.side]).toEqual([1, false, 'center'])
  })

  it('the music mood follows the story: calm, watch while a flare is watched, storm while one is here', () => {
    expect(moodFor(calm())).toBe('calm')
    expect(moodFor(watched())).toBe('watch')
    const base = { ...calm(), storms: [{ stormId: 'storm-6', arrivalDay: 2, size: 'small' as const, profile: [1, 1] }], day: 2, shield: 6 }
    const hit = step(base, { jobs: { air: 2, shield: 1, plants: 0, radio: 0 }, go: false }, makeRng(1))
    expect(moodFor(hit)).toBe('storm')
    expect(moodFor({ ...hit, status: 'lost' })).toBe('calm')
  })

  it('a low bar is noticed', () => {
    expect(lowToday(calm())).toBe(false)
    expect(lowToday({ ...calm(), air: 20 })).toBe(true)
    expect(lowToday({ ...calm(), power: 10 })).toBe(true)
  })

  it('the reveal sounds the same length either way: rays that came with the shield charge, or an all-clear', () => {
    const rays = step({ ...watched(), day: 4, storms: [{ stormId: 'storm-6', arrivalDay: 4, size: 'small', profile: [1] }], shield: 4 }, { jobs: { air: 2, shield: 0, plants: 0, radio: 0 }, go: false, guess: 'yes' }, makeRng(1))
    revealCue(rays.history[0]!)
    const hit = heard.find((e) => e.kind === 'rays')!
    expect([hit.level, hit.shielded]).toEqual([4, true])
    expect(heard.some((e) => e.kind === 'science')).toBe(true) // a good guess earned science
    heard.length = 0
    const quiet = { ...calm(), day: 5, flares: [{ flareId: 'flr-29334', day: 2, stormIndex: null }], flareSeen: [true], flareResolved: [false], guesses: [null] }
    revealCue(step(quiet, { jobs: { air: 2, shield: 0, plants: 0, radio: 0 }, go: false }, makeRng(1)).history[0]!)
    expect(heard.some((e) => e.kind === 'allClear')).toBe(true)
  })
})

describe('Settings: volume and music', () => {
  it('has a volume slider that sets the volume, and a Music switch', () => {
    render(<Settings prefs={{ readAloud: false, sound: true }} onChange={() => undefined} onBack={() => undefined} />)
    const slider = screen.getByRole('slider', { name: 'Volume' }) as HTMLInputElement
    fireEvent.change(slider, { target: { value: '40' } })
    expect(getVolume()).toBeCloseTo(0.4, 2)
    setVolume(0.7)
    const sw = screen.getByRole('switch', { name: 'Music' })
    const before = musicEnabled()
    fireEvent.click(sw)
    expect(musicEnabled()).toBe(!before)
    setMusicEnabled(before)
  })
})
