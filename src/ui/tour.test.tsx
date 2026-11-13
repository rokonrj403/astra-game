import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { newGame } from '../engine/game'
import type { GameState } from '../engine/types'
import { App } from './App'
import { Living } from './living'
import { prefersReducedMotion, setCalm } from './motion'
import { TOUR_KEY } from './paw'

beforeEach(() => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
  localStorage.clear()
  setCalm(false)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setCalm(false)
})

const calmGame = (day = 1): GameState => ({ ...newGame({ mode: 'cadet', siteId: 'region-3', seed: 2 }), day, storms: [], flares: [], flareSeen: [], flareResolved: [], guesses: [] })
const watched = (): GameState => ({
  ...calmGame(),
  flares: [{ flareId: 'flr-44029', day: 0, stormIndex: 0 }],
  storms: [{ stormId: 'storm-6', arrivalDay: 3, size: 'small', profile: [1] }],
  flareSeen: [true],
  flareResolved: [false],
  guesses: [null],
})
const live = (g: GameState) => render(<Living game={g} sun={null} onStep={() => g} onOver={() => undefined} onData={() => undefined} onSun={() => undefined} />)
const paws = () => document.querySelectorAll('[data-paw]').length
const giveTo = (label: string, id: string) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp('^' + label + ', [0-9]+ blocks?$') }))
  fireEvent.click(screen.getByRole('button', { name: 'More blocks, ' + id }))
}

describe("ORBI's paw on day 1", () => {
  it('points at the habitat, then the dome, then Next, and each step waits for the action', () => {
    live(calmGame())
    expect(paws()).toBe(1)
    expect(document.querySelector('.paw.next')).toBeNull() // step 1: the habitat
    giveTo('Air', 'air')
    expect(paws()).toBe(1)
    expect(document.querySelector('.paw.next')).toBeNull() // step 2: the dome
    giveTo('Shield', 'shield')
    expect(document.querySelector('.paw.next')).not.toBeNull() // step 3: Next
  })

  it('starts with the Sun when a flare is on it, and asks for the guess before Next', () => {
    live(watched())
    expect(paws()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Sun, flare clues' })) // step 1 done
    giveTo('Air', 'air')
    giveTo('Shield', 'shield')
    expect(document.querySelector('.paw.next')).toBeNull() // step 4: the guess buttons
    fireEvent.click(screen.getByRole('button', { name: 'Calm Sun' }))
    expect(document.querySelector('.paw.next')).not.toBeNull()
  })

  it('has no words, can be skipped, and is remembered', () => {
    live(calmGame())
    expect(document.querySelector('.paw')?.textContent).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
    expect(paws()).toBe(0)
    expect(localStorage.getItem(TOUR_KEY)).toBe('true')
    cleanup()
    live(calmGame())
    expect(paws()).toBe(0)
  })

  it('finishing the first day with Next also ends the tour', () => {
    live(calmGame())
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(localStorage.getItem(TOUR_KEY)).toBe('true')
  })

  it('never appears after day 1', () => {
    live(calmGame(2))
    expect(paws()).toBe(0)
  })
})

describe('the place screen', () => {
  it('pulses a paw on one pin until a place is tapped, then shows its bars, and points with a paw before that', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(paws()).toBe(1)
    expect(document.querySelector('.bars2')).toBeNull()
    expect(screen.getByRole('img', { name: 'Tap a place on the map' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Malapert Massif/ }))
    expect(paws()).toBe(0)
    expect(document.querySelector('.bars2')).not.toBeNull()
    expect(screen.getByRole('img', { name: /Sunlight: 85 percent/ })).toBeTruthy()
  })
})

describe('tap ORBI to hear', () => {
  const mockSpeech = () => {
    const spoken: { text: string; rate: number }[] = []
    const synth = { cancel: () => undefined, speak: (u: { text: string; rate: number }) => void spoken.push({ text: u.text, rate: u.rate }) }
    class Utterance {
      lang = ''
      rate = 1
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true })
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
    return spoken
  }
  const unmock = () => {
    // @ts-expect-error remove the fake
    delete window.speechSynthesis
    // @ts-expect-error remove the fake
    delete window.SpeechSynthesisUtterance
  }

  it('reads the line aloud at a gentle speed, with no new audio files', () => {
    const spoken = mockSpeech()
    live(calmGame())
    fireEvent.click(screen.getByRole('button', { name: 'Hear ORBI' }))
    expect(spoken.at(-1)!.text).toMatch(/You have 6 blocks/)
    expect(spoken.at(-1)!.text).toContain('most flares bring no rays')
    expect(spoken.at(-1)!.rate).toBeCloseTo(0.9, 2)
    unmock()
  })

  it('is silent and hidden when the device cannot speak', () => {
    live(calmGame())
    expect(screen.queryByRole('button', { name: 'Hear ORBI' })).toBeNull()
  })
})

describe('the Calm setting', () => {
  it('is Off by default, turns on from Settings, and is remembered', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const sw = screen.getByRole('switch', { name: 'Calm' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(document.documentElement.classList.contains('calm')).toBe(false)
    fireEvent.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect(localStorage.getItem('astra-prefs-v1')).toContain('"calm":true')
    expect(document.documentElement.classList.contains('calm')).toBe(true)
  })

  it('setCalm alone makes the app calm, even where the phone setting is off', () => {
    const original = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia
    expect(prefersReducedMotion()).toBe(false)
    setCalm(true)
    expect(prefersReducedMotion()).toBe(true)
    window.matchMedia = original
  })
})
