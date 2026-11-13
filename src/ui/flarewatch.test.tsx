import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from './App'
import { Living } from './living'
import { Report } from './screens'
import { newGame, step } from '../engine/game'
import { makeRng } from '../engine/rng'
import type { Choice, GameState } from '../engine/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const calmGame = (mode: 'cadet' | 'commander' = 'cadet'): GameState => ({ ...newGame({ mode, siteId: 'region-3', seed: 2 }), storms: [], flares: [], flareSeen: [], flareResolved: [], guesses: [] })

/** Day 3, a real flare (X1.9, gas cloud, east side) was seen on day 2. A storm follows, hidden: it arrives tomorrow or, if `today`, today. */
const watchedGame = (mode: 'cadet' | 'commander' = 'cadet', today = false): GameState => ({
  ...calmGame(mode),
  day: 3,
  storms: [{ stormId: 'storm-6', arrivalDay: today ? 3 : 4, size: 'small', profile: [1] }],
  flares: [{ flareId: 'flr-44029', day: 2, stormIndex: 0 }],
  flareSeen: [true],
  flareResolved: [false],
  guesses: [null],
})


describe('the living screen: the guess', () => {
  const live = (g: GameState, onStep: (c: Choice) => GameState = () => g) => render(<Living game={g} sun={null} onStep={onStep} onOver={() => undefined} onData={() => undefined} onSun={() => undefined} />)

  it('a guess left empty is not sent', () => {
    const sent: Choice[] = []
    const g = watchedGame()
    live(g, (c) => {
      sent.push(c)
      return g
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(sent[0]!.guess).toBeUndefined()
  })

  it('a guess is picked with a big picture button and sent with the day', () => {
    const sent: Choice[] = []
    const g = watchedGame()
    live(g, (c) => {
      sent.push(c)
      return g
    })
    fireEvent.click(screen.getByRole('button', { name: 'Space rays' }))
    expect(screen.queryByRole('group', { name: 'ORBI asks' })).toBeNull() // answered: the question goes away
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(sent[0]!.guess).toBe('yes')
  })

  it('three picture buttons, each at least 64 px, and no words on them', () => {
    live(watchedGame())
    const ask = screen.getByRole('group', { name: 'ORBI asks' })
    expect(ask.querySelectorAll('button')).toHaveLength(3)
    expect((ask.textContent ?? '').trim()).toBe('')
  })

  it('a flare you already guessed about does not ask again', () => {
    live({ ...watchedGame(), guesses: ['no'] })
    expect(screen.queryByRole('group', { name: 'ORBI asks' })).toBeNull()
  })

  it('with a flare nobody has seen yet, ORBI asks nothing', () => {
    live({ ...watchedGame(), flareSeen: [false] })
    expect(screen.queryByRole('group', { name: 'ORBI asks' })).toBeNull()
  })

  it('shows the science goal bar and how far the crew is', () => {
    live({ ...calmGame(), science: 7 })
    expect(screen.getByRole('meter', { name: 'Science goal' }).getAttribute('aria-valuenow')).toBe('7')
  })
})

describe('the day report: flare news and results', () => {
  const wholeMission = (seed: number) => {
    let g = newGame({ mode: 'cadet', siteId: 'region-3', seed })
    const r = makeRng(1)
    const days: GameState[] = []
    while (g.status === 'playing') {
      g = step(g, { jobs: { air: 2, shield: 3, plants: 0, radio: 0 }, go: false }, r)
      days.push(g)
    }
    return days
  }

  it('the morning after a flare, the report shows the new flare drawn on the Sun', () => {
    const day = wholeMission(5).find((g) => g.history[g.history.length - 1]!.reported.length > 0)!
    render(<Report game={day} onNext={() => undefined} />)
    const news = screen.getByLabelText('Flare news')
    expect(news.querySelector('.flaresun')!.getAttribute('aria-label')).toMatch(/^A flare\. Size \d of 3/)
    expect((news.textContent ?? '').trim()).toBe('')
  })

  it('when a watch ends, the reveal shows your guess next to the NASA record, as pictures, with the NASA link', () => {
    const day = wholeMission(5).find((g) => g.history[g.history.length - 1]!.resolved.length > 0)
    expect(day).toBeDefined()
    render(<Report game={day!} onNext={() => undefined} />)
    const news = screen.getByLabelText('Flare news')
    const reveal = news.querySelector('.reveal')!
    expect(reveal.getAttribute('aria-label')).toMatch(/NASA's record: (rays came|no rays)/)
    expect(news.querySelector('a')?.getAttribute('href')).toMatch(/ccmc\.gsfc\.nasa\.gov\/DONKI\/view\/(FLR|SEP)\//)
    expect((news.textContent ?? '').trim().split(/\s+/).length).toBeLessThanOrEqual(5) // "You said", "Sun did" and a +2
  })

  it('a good guess shows a check and the science it earned; a wrong guess or "not sure" shows no reward', () => {
    const guessing = (seed: number, guess: 'yes' | 'no' | 'unsure') => {
      let g = newGame({ mode: 'cadet', siteId: 'region-3', seed })
      const r = makeRng(1)
      while (g.status === 'playing') {
        g = step(g, { jobs: { air: 2, shield: 3, plants: 0, radio: 0 }, go: false, guess }, r)
        if (g.history[g.history.length - 1]!.resolved.some((x) => x.followed)) return g
      }
      return g
    }
    const rightGame = guessing(5, 'yes')
    render(<Report game={rightGame} onNext={() => undefined} />)
    const right = screen.getByLabelText('Flare news').querySelector('.reveal')!
    expect(right.getAttribute('aria-label')).toContain('Good read, plus 2 science')
    expect(screen.getByLabelText('Flare news').textContent).toContain('+2')
    cleanup()
    const unsure = guessing(5, 'unsure')
    render(<Report game={unsure} onNext={() => undefined} />)
    expect(screen.getByLabelText('Flare news').querySelector('.reveal')!.getAttribute('aria-label')).not.toContain('plus')
  })

  it('a walk that a storm cut short says so, and the science was lost', () => {
    const base = { ...calmGame(), storms: [{ stormId: 'storm-6', arrivalDay: 1, size: 'small' as const, profile: [1] }], shield: 6 }
    const after = step(base, { jobs: { air: 2, shield: 0, plants: 0, radio: 0 }, go: false, walk: 'short' }, makeRng(1))
    render(<Report game={after} onNext={() => undefined} />)
    expect(screen.getByRole('img', { name: /A storm called the walkers home/ })).toBeTruthy()
  })
})

describe('the data page', () => {
  it('shows the real base rates and where the site numbers come from', () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(screen.getByRole('button', { name: 'Where the data comes from' }))
    const text = document.body.textContent ?? ''
    expect(text).toContain('How often flares bring space rays')
    expect(text).toContain('98 of 424')
    expect(text).toMatch(/In real life most flares bring no rays/)
    expect(text).toContain('Best-lit spot within 5 km of each region (LRO LOLA, 18.6-year average)')
  })
})
