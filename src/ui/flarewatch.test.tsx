import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from './App'
import { Base } from './base'
import { Report } from './screens'
import { newGame, step } from '../engine/game'
import { makeRng } from '../engine/rng'
import type { GameState } from '../engine/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const calmGame = (mode: 'cadet' | 'commander' = 'cadet'): GameState => ({ ...newGame({ mode, siteId: 'region-3', seed: 2 }), storms: [], flares: [], flareSeen: [], flareResolved: [] })

/** Day 3, a real flare (X1.9, gas cloud, east side) was seen on day 2. A storm follows, hidden: it arrives tomorrow or, if `today`, today. */
const watchedGame = (mode: 'cadet' | 'commander' = 'cadet', today = false): GameState => ({
  ...calmGame(mode),
  day: 3,
  storms: [{ stormId: 'storm-6', arrivalDay: today ? 3 : 4, size: 'small', profile: [1] }],
  flares: [{ flareId: 'flr-44029', day: 2, stormIndex: 0 }],
  flareSeen: [true],
  flareResolved: [false],
})

const show = (g: GameState) => render(<Base game={g} sun={null} onShare={() => undefined} onData={() => undefined} onSun={() => undefined} />)

describe('the base screen', () => {
  it('shows the real flare with its clues, and never says whether rays will come', () => {
    show(watchedGame())
    const watch = screen.getByLabelText('Flare watch')
    expect(watch.textContent).toContain('day 1 of 3')
    expect(watch.textContent).toContain('X1.9')
    expect(watch.textContent).toContain('Gas cloud: yes')
    expect(watch.textContent).toContain('or not at all')
    expect(watch.textContent).toMatch(/98 of 424 big flares/)
    expect(watch.textContent).not.toMatch(/danger|safe|will come|is coming/i)
    expect(watch.querySelector('a')?.getAttribute('href')).toMatch(/ccmc\.gsfc\.nasa\.gov\/DONKI\/view\/FLR\//)
  })

  it('Cadet shows size and gas cloud; Commander adds which side of the Sun', () => {
    show(watchedGame('cadet'))
    expect(screen.getByLabelText('Flare watch').textContent).not.toMatch(/East side|West side/)
    cleanup()
    show(watchedGame('commander'))
    expect(screen.getByLabelText('Flare watch').textContent).toContain('East side')
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
    expect(screen.getByText(/Science: 7 of 28/)).toBeTruthy()
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

  it('the morning after a flare, the report says a real flare showed up in the Sun Watch', () => {
    const day = wholeMission(5).find((g) => g.history[g.history.length - 1]!.reported.length > 0)!
    render(<Report game={day} onNext={() => undefined} />)
    expect(screen.getByLabelText('Flare news').textContent).toMatch(/New in the Sun Watch: a real [XM]\d/)
    expect(screen.getByLabelText('Flare news').textContent).toMatch(/gas cloud/i)
  })

  it('when a watch ends, the report says what really happened, with the NASA record', () => {
    const day = wholeMission(5).find((g) => g.history[g.history.length - 1]!.resolved.length > 0)
    expect(day).toBeDefined()
    render(<Report game={day!} onNext={() => undefined} />)
    const news = screen.getByLabelText('Flare news')
    expect(news.textContent).toMatch(/did (not )?bring space rays/)
    expect(news.querySelector('a')?.getAttribute('href')).toMatch(/ccmc\.gsfc\.nasa\.gov\/DONKI\/view\/(FLR|SEP)\//)
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
