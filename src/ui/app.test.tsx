import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from './App'

afterEach(cleanup)

const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

function startGame(mode: 'Cadet' | 'Commander') {
  render(<App />)
  tap('Play')
  tap(/Malapert Massif/)
  tap(new RegExp(mode))
}

describe('screens', () => {
  it('start screen says ASTRA is not NASA and discloses AI', () => {
    render(<App />)
    const text = document.body.textContent ?? ''
    expect(text).toContain('not made or endorsed by NASA')
    expect(text).toContain('Claude')
    expect(text).toContain('Kokoro-82M')
  })

  it('the place screen names the 9 candidate regions without promising a landing', () => {
    render(<App />)
    tap('Play')
    const text = document.body.textContent ?? ''
    expect(text).toContain('9 candidate landing regions near the Moon')
    expect(text).not.toMatch(/Artemis III will land|NASA picked/i)
    expect(screen.getAllByRole('button').filter((b) => b.className.includes('choice'))).toHaveLength(9)
  })

  it('the Commander card says "Stronger storms" and the Cadet card does not', () => {
    render(<App />)
    tap('Play')
    tap(/Malapert Massif/)
    const cadet = screen.getByRole('button', { name: /Cadet/ })
    const commander = screen.getByRole('button', { name: /Commander/ })
    expect(commander.textContent).toContain('Stronger storms')
    expect(cadet.textContent).not.toContain('Stronger storms')
  })

  it('the base screen shows the forecast and the 6 blocks before sharing power', () => {
    startGame('Cadet')
    expect(screen.getByText(/Day 1 of 10/)).toBeTruthy()
    expect(screen.getAllByText(/Forecast|Stays the same/).length).toBeGreaterThan(0)
    expect(screen.getByText('6 left')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'More blocks for Air' }))
    expect(screen.getByText('5 left')).toBeTruthy()
  })

  it('cannot give out more than 6 blocks', () => {
    startGame('Cadet')
    const more = screen.getByRole('button', { name: 'More blocks for Air' })
    for (let i = 0; i < 8; i++) fireEvent.click(more)
    expect((more as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('0 left')).toBeTruthy()
  })

  it('Cadet has no Plants job or food bar; Commander has both', () => {
    startGame('Cadet')
    expect(screen.queryByRole('button', { name: 'More blocks for Plants' })).toBeNull()
    expect(screen.queryByRole('meter', { name: 'Food' })).toBeNull()
    cleanup()
    startGame('Commander')
    expect(screen.getByRole('button', { name: 'More blocks for Plants' })).toBeTruthy()
    expect(screen.getByRole('meter', { name: 'Food' })).toBeTruthy()
  })

  it('an idle game ends with Why it happened, a real cause chain and the end screen', () => {
    startGame('Cadet')
    for (let guard = 0; guard < 12; guard++) {
      if (screen.queryByRole('heading', { name: 'Why it happened' }) || screen.queryByRole('heading', { name: /Mission complete/ })) break
      if (screen.queryByRole('button', { name: 'Next day' }) && screen.queryByText(/Share power/)) tap('Next day')
      else if (screen.queryByRole('button', { name: 'See what happened' })) tap('See what happened')
      else if (screen.queryByRole('button', { name: 'Next day' })) tap('Next day')
    }
    expect(screen.getByRole('heading', { name: 'Why it happened' })).toBeTruthy()
    expect(document.body.textContent).toMatch(/rescue ship/)
    tap('See my mission')
    expect(screen.getByRole('heading', { name: 'The rescue ship is here' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play again' })).toBeTruthy()
  })

  it('calling Earth shows the radio delay before the answer', async () => {
    startGame('Cadet')
    fireEvent.click(screen.getByRole('button', { name: 'More blocks for Radio' }))
    tap('Next day')
    expect(screen.getByText(/Radio waves take 1\.28 seconds/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/Mission Control: /)).toBeTruthy(), { timeout: 4000 })
  })

  it('the data page lists every source with a NASA/NOAA label and the AI note', () => {
    render(<App />)
    tap('Where the data comes from')
    const text = document.body.textContent ?? ''
    for (const name of ['NASA DONKI', 'NOAA SWPC', 'BVAD', 'OSDR']) expect(text).toContain(name)
    expect(text).toContain('Kokoro-82M')
    expect(text).toContain('never these numbers')
    tap('Back')
    expect(screen.getByRole('heading', { name: 'ASTRA' })).toBeTruthy()
  })

  it('uses the kid word rules: "day" not "sol", "tap" not "click"', () => {
    render(<App />)
    tap('Play')
    tap(/Malapert Massif/)
    tap(/Cadet/)
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/\bsols?\b/i)
    expect(text).not.toMatch(/\bclick/i)
    expect(text).toMatch(/Tap \+/)
  })
}, 20000)
