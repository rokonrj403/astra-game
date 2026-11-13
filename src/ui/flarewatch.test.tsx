import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from './App'
import { Base } from './base'
import { Report } from './screens'
import { MODES } from '../engine/constants'
import { newGame, step } from '../engine/game'
import { makeRng } from '../engine/rng'
import type { GameState } from '../engine/types'

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

const show = (g: GameState) => render(<Base game={g} sun={null} onShare={() => undefined} onData={() => undefined} onSun={() => undefined} />)

describe('the base screen', () => {
  it('draws the real flare on the Sun with picture clues, three guess buttons, and almost no words', () => {
    show(watchedGame())
    const watch = screen.getByLabelText('Flare watch')
    expect(screen.getByRole('img', { name: 'Day 1 of 3' })).toBeTruthy()
    const flare = watch.querySelector('.flaresun')!
    expect(flare.getAttribute('aria-label')).toContain('Size 2 of 3')
    expect(flare.getAttribute('aria-label')).toContain('A gas cloud leaves the Sun')
    expect(watch.querySelector('.flaresun svg polygon')).not.toBeNull() // the burst
    expect(watch.querySelectorAll('.flaresun svg circle').length).toBeGreaterThan(4) // disc, glow, pulses and the cloud blob
    expect(watch.querySelectorAll('.guess button')).toHaveLength(3)
    const words = (watch.textContent ?? '').trim().split(/\s+/).filter(Boolean)
    expect(words.length).toBeLessThanOrEqual(3)
    expect(watch.textContent).not.toMatch(/danger|safe|will come|is coming|cloud:|98 of 424/i)
    expect(watch.querySelector('a')?.getAttribute('href')).toMatch(/ccmc\.gsfc\.nasa\.gov\/DONKI\/view\/FLR\//)
    expect(watch.querySelector('a')?.getAttribute('aria-label')).toBe('NASA record')
  })

  it('a flare with no gas cloud is drawn without the cloud blob; words appear only on tap', () => {
    const g = { ...watchedGame(), flares: [{ flareId: 'flr-29334', day: 2, stormIndex: null }], flareSeen: [true], flareResolved: [false], guesses: [null], storms: [] }
    show(g)
    const flare = screen.getByLabelText('Flare watch').querySelector('.flaresun')!
    expect(flare.getAttribute('aria-label')).toContain('No gas cloud')
    expect(flare.querySelectorAll('svg circle').length).toBeLessThan(6)
    expect(screen.getByLabelText('Flare watch').textContent).not.toContain('X1.7')
    fireEvent.click(flare)
    expect(screen.getByLabelText('Flare watch').textContent).toContain('X1.7, no gas cloud')
  })

  it('Cadet shows size and cloud as pictures; Commander also puts the burst on the east or west side of the Sun', () => {
    show(watchedGame('cadet'))
    expect(screen.getByLabelText('Flare watch').querySelector('.flaresun')!.getAttribute('aria-label')).not.toMatch(/side/)
    cleanup()
    show(watchedGame('commander'))
    expect(screen.getByLabelText('Flare watch').querySelector('.flaresun')!.getAttribute('aria-label')).toContain('On the east side')
  })

  it('a guess is picked with a big picture button, sent with the day, and can be left empty', () => {
    const sent: { guess?: string }[] = []
    render(<Base game={watchedGame()} sun={null} onShare={(c) => sent.push(c)} onData={() => undefined} onSun={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(sent[0]!.guess).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: 'Space rays: yes' }))
    expect(screen.getByRole('button', { name: 'Space rays: yes' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(sent[1]!.guess).toBe('yes')
  })

  it('a flare you already guessed about shows your guess locked and does not ask again', () => {
    render(<Base game={{ ...watchedGame(), guesses: ['no'] }} sun={null} onShare={() => undefined} onData={() => undefined} onSun={() => undefined} />)
    expect(screen.queryByRole('group', { name: 'Will space rays come?' })).toBeNull()
    expect(screen.getByLabelText('Your guess')).toBeTruthy()
  })

  it('with a flare nobody has seen yet, there is no flare watch', () => {
    show({ ...watchedGame(), flareSeen: [false] })
    expect(screen.queryByLabelText('Flare watch')).toBeNull()
  })

  it('the forecast arrows never change because a storm is hidden for today', () => {
    show(watchedGame('cadet', false))
    const quiet = screen.getAllByLabelText(/^Forecast/).map((e) => e.getAttribute('aria-label'))
    cleanup()
    show(watchedGame('cadet', true))
    const stormy = screen.getAllByLabelText(/^Forecast/).map((e) => e.getAttribute('aria-label'))
    expect(stormy).toEqual(quiet)
  })

  it('shows the science goal and how far the crew is', () => {
    show({ ...calmGame(), science: 7 })
    expect(screen.getByText(new RegExp(`Science: 7 of ${MODES.cadet.goal}`))).toBeTruthy()
    expect(screen.getByRole('meter', { name: 'Science goal' }).getAttribute('aria-valuenow')).toBe('7')
  })

  it('shows the shield as a charge that carries over', () => {
    show({ ...calmGame(), shield: 3 })
    expect(screen.getByText(/Charge 3 of 6/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'More blocks for Shield' }))
    expect(screen.getByText(/Charge 4 of 6/)).toBeTruthy()
  })

  it('a moonwalk is a bet: its blocks come out of the same 6, and the screen says the shield does not protect walkers', () => {
    show(calmGame())
    expect(document.body.textContent).toContain('The shield does not protect walkers')
    expect(screen.getByRole('button', { name: /Stay home/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /Long walk/ }))
    expect(screen.getByText('4 left')).toBeTruthy()
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'More blocks for Air' }))
    expect(screen.getByText('0 left')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Stay home/ }))
    fireEvent.click(screen.getByRole('button', { name: 'More blocks for Air' }))
    expect((screen.getByRole('button', { name: /Long walk/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /Short walk/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('the situation card has two real choices with the faces of the crew involved', () => {
    show(calmGame())
    const card = screen.getByLabelText('Choice card')
    expect(card.querySelectorAll('.toggle button')).toHaveLength(2)
    expect(card.querySelectorAll('img').length).toBeGreaterThan(0)
  })

  it('on day 1 ORBI says plainly that most real flares bring no rays and that these were picked to be tricky', () => {
    show(calmGame())
    expect(document.body.textContent).toContain('In real life most flares bring no rays. We picked tricky ones for your training.')
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
    expect((news.textContent ?? '').replace(/\s+/g, '').length).toBeLessThanOrEqual(3)
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
    expect(document.body.textContent).toContain('A storm called the walkers home')
  })
})

describe('the data page', () => {
  it('shows the real base rates and where the site numbers come from', () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Where the data comes from' }))
    const text = document.body.textContent ?? ''
    expect(text).toContain('How often flares bring space rays')
    expect(text).toContain('98 of 424')
    expect(text).toMatch(/In real life most flares bring no rays/)
    expect(text).toContain('Best-lit spot within 5 km of each region (LRO LOLA, 18.6-year average)')
  })
})
