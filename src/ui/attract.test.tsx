import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { planRays } from '../scene'
import { App } from './App'
import { ATTRACT_RAYS, CYCLE_MS, PEEKERS, attractModel, attractReveal, phaseAt } from './attract'
import { setCalm } from './motion'
import { Start } from './screens'

const audio = vi.hoisted(() => ({ astraMotif: vi.fn(), setMood: vi.fn(), flareSound: vi.fn(), shieldHum: vi.fn(), shieldHumStop: vi.fn() }))
vi.mock('../audio', async (orig) => ({ ...(await orig<typeof import('../audio')>()), ...audio }))

const realMatchMedia = window.matchMedia
const motionOn = () => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia
}
const noop = () => undefined
const start = (over: Partial<Parameters<typeof Start>[0]> = {}) =>
  render(<Start onPlay={noop} onData={noop} onSun={noop} onCards={noop} onSettings={noop} onTeachers={noop} onJournal={noop} {...over} />)

beforeEach(() => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
  localStorage.clear()
  setCalm(false)
  Object.values(audio).forEach((f) => f.mockClear())
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  window.matchMedia = realMatchMedia
  setCalm(false)
})

describe('the attract loop plan', () => {
  it('repeats every 8 seconds: quiet, flare, rays, a wave, quiet', () => {
    expect(CYCLE_MS).toBe(8000)
    expect(phaseAt(0)).toBe('idle')
    expect(phaseAt(1500)).toBe('flare')
    expect(phaseAt(3000)).toBe('rays')
    expect(phaseAt(5500)).toBe('wave')
    expect(phaseAt(7600)).toBe('idle')
    expect(phaseAt(8000 + 3000)).toBe('rays')
    expect(phaseAt(-1000)).toBe('wave')
  })

  it('shows a flare on the Sun only while it bursts, and the base is lived in', () => {
    expect(attractModel('idle').flare).toBeNull()
    expect(attractModel('flare').flare).not.toBeNull()
    expect(attractModel('rays').flare).not.toBeNull()
    expect(attractModel('wave').flare).toBeNull()
    const m = attractModel('idle')
    expect(m.blocks.air).toBeGreaterThan(0) // lights on
    expect(m.blocks.plants).toBeGreaterThan(0)
    expect(m.plantsHappy).toBe(true)
    expect(m.shield).toBe(6)
  })

  it('rays fall only in the rays phase: 12 to 20 of them, and the full shield blocks nearly all', () => {
    expect(attractReveal('flare', 0)).toBeNull()
    const r = attractReveal('rays', 3)!
    expect(r.kind).toBe('rays')
    expect(r.count).toBeGreaterThanOrEqual(12)
    expect(r.count).toBeLessThanOrEqual(20)
    expect(r.key).not.toBe(attractReveal('rays', 4)!.key) // a new shower each loop
    const rays = planRays(r.shield, ATTRACT_RAYS, 'west')
    expect(rays).toHaveLength(ATTRACT_RAYS)
    expect(rays.filter((x) => x.passes).length).toBeLessThanOrEqual(1) // the game's own table: a full shield lets about 5 in 100 through
  })

  it('has four crew to peek out, one per loop', () => {
    expect(PEEKERS).toHaveLength(4)
  })
})

describe('the Start screen', () => {
  it('has Play, the Flare Journal, a sound switch and one gear: no six-icon row, and almost no words', () => {
    start()
    expect(screen.getByRole('button', { name: /Play/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Flare Journal' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sound' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy()
    for (const hidden of ['Today’s Sun', 'My storm cards', 'Where the data comes from', 'For teachers', 'Settings']) {
      expect(screen.queryByRole('button', { name: hidden })).toBeNull()
    }
    const text = (document.querySelector('main')!.textContent ?? '').replace(/\s+/g, '')
    expect(text).toBe('ASTRAPlayUsesNASAdata.NotendorsedbyNASA.')
  })

  it('keeps every adult page reachable from the gear, which opens a labelled sheet and closes with Escape', () => {
    const go = { onSun: vi.fn(), onCards: vi.fn(), onSettings: vi.fn(), onTeachers: vi.fn(), onData: vi.fn() }
    start(go)
    const names: [string, keyof typeof go][] = [
      ['Today’s Sun', 'onSun'],
      ['My storm cards', 'onCards'],
      ['Where the data comes from', 'onData'],
      ['For teachers', 'onTeachers'],
      ['Settings', 'onSettings'],
    ]
    for (const [name, fn] of names) {
      fireEvent.click(screen.getByRole('button', { name: 'More' }))
      expect(screen.getByRole('dialog', { name: 'More' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name }))
      expect(go[fn]).toHaveBeenCalledTimes(1)
    }
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('the Journal button opens the Flare Journal', () => {
    const onJournal = vi.fn()
    start({ onJournal })
    fireEvent.click(screen.getByRole('button', { name: 'Flare Journal' }))
    expect(onJournal).toHaveBeenCalled()
  })

  it('the first tap anywhere plays the ASTRA motif once, then the calm bed starts', () => {
    vi.useFakeTimers()
    start()
    const main = document.querySelector('main')!
    fireEvent.click(main)
    fireEvent.click(main)
    expect(audio.astraMotif).toHaveBeenCalledTimes(1)
    expect(audio.setMood).not.toHaveBeenCalled() // the bed comes in after the motif
    act(() => void vi.advanceTimersByTime(800))
    expect(audio.setMood).toHaveBeenCalledWith('calm')
  })

  it('the sound switch follows the saved setting and saves a mute', () => {
    render(<App />)
    const sw = screen.getByRole('button', { name: 'Sound' })
    expect(sw.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(sw)
    expect(sw.getAttribute('aria-pressed')).toBe('false')
    expect(localStorage.getItem('astra-prefs-v1')).toContain('"sound":false')
    cleanup()
    render(<App />)
    expect(screen.getByRole('button', { name: 'Sound' }).getAttribute('aria-pressed')).toBe('false')
  })
})

describe('the loop on screen', () => {
  it('with motion on it bursts a flare, drops rays on the shield, peeks a crew face, and sounds softly', () => {
    motionOn()
    vi.useFakeTimers()
    start()
    const phase = () => document.querySelector('.attract-scene')!.getAttribute('data-phase')
    expect(phase()).toBe('idle')
    act(() => void vi.advanceTimersByTime(1400))
    expect(phase()).toBe('flare')
    expect(audio.flareSound).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.sc-burst')).not.toBeNull()
    act(() => void vi.advanceTimersByTime(1600))
    expect(phase()).toBe('rays')
    expect(document.querySelector('.sc-rays')?.getAttribute('data-rays')).toBe(String(ATTRACT_RAYS))
    expect(audio.shieldHum).toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(2400))
    expect(phase()).toBe('wave')
    expect(document.querySelector('.peek')).not.toBeNull()
    expect(audio.shieldHumStop).toHaveBeenCalled()
  })

  it('with reduced motion or Calm it stays one still picture: no loop, no particles, no sound', () => {
    vi.useFakeTimers()
    start() // the test setup asks for reduced motion
    act(() => void vi.advanceTimersByTime(CYCLE_MS * 2))
    const scene = document.querySelector('.attract-scene')!
    expect(scene.getAttribute('data-still')).toBe('yes')
    expect(scene.getAttribute('data-phase')).toBe('idle')
    expect(document.querySelector('.sc-rays')).toBeNull()
    expect(document.querySelector('.peek')).toBeNull()
    expect(document.querySelector('[data-paw]')).toBeNull()
    expect(audio.flareSound).not.toHaveBeenCalled()
    cleanup()
    motionOn()
    setCalm(true)
    start()
    expect(document.querySelector('.attract-scene')!.getAttribute('data-still')).toBe('yes')
  })

  it('the picture cannot be tapped or focused, so it never steals a tap or adds tab stops', () => {
    start()
    expect(document.querySelector('.attract-inner')!.hasAttribute('inert')).toBe(true)
    expect(screen.getByRole('img', { name: /Moon base/ })).toBeTruthy()
  })

  it('tapping Play zooms into the base for 600 ms before the next screen, never a hard cut', () => {
    motionOn()
    vi.useFakeTimers()
    const onPlay = vi.fn()
    start({ onPlay })
    fireEvent.click(screen.getByRole('button', { name: /Play/ }))
    expect(document.querySelector('main')!.classList.contains('leaving')).toBe(true)
    expect(onPlay).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(599))
    expect(onPlay).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(2))
    expect(onPlay).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /Play/ })) // a second tap does not play twice
    act(() => void vi.advanceTimersByTime(1000))
    expect(onPlay).toHaveBeenCalledTimes(1)
  })

  it('with reduced motion Play goes straight on', () => {
    const onPlay = vi.fn()
    start({ onPlay })
    fireEvent.click(screen.getByRole('button', { name: /Play/ }))
    expect(onPlay).toHaveBeenCalledTimes(1)
  })
})
