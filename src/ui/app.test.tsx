import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from './App'

// No test touches the real network: NASA is "offline", so Today's Sun is SAVED.
beforeEach(() => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

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

  it("Today's Sun says SAVED, with the saved date, when NASA cannot be reached", async () => {
    render(<App />)
    tap("Today’s Sun")
    await waitFor(() => expect(document.querySelector('[data-status="SAVED"]')).not.toBeNull())
    expect(document.querySelector('[data-status="LIVE"]')).toBeNull()
    const text = document.body.textContent ?? ''
    expect(text).toContain('12 Nov 2026')
    expect(text).toContain('not live')
    expect(text).toContain('does not predict storms')
  })

  it("Today's Sun says LIVE only after NASA really answers", async () => {
    const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response
    vi.stubGlobal('fetch', (url: string) =>
      Promise.resolve(ok(String(url).includes('/FLR?') ? [{ classType: 'M1.0', peakTime: new Date(Date.now() - 3_600_000).toISOString(), link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/1/-1' }] : [])),
    )
    render(<App />)
    tap("Today’s Sun")
    await waitFor(() => expect(document.querySelector('[data-status="LIVE"]')).not.toBeNull())
    expect(document.querySelector('[data-status="SAVED"]')).toBeNull()
  })

  it("the base screen has a Today's Sun chip that shows its label and keeps the blocks you set", async () => {
    startGame('Cadet')
    fireEvent.click(screen.getByRole('button', { name: 'More blocks for Air' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Today's Sun, SAVED/ })).toBeTruthy())
    tap(/Today's Sun, SAVED/)
    expect(screen.getByRole('heading', { name: 'Today’s Sun' })).toBeTruthy()
    tap('Back')
    expect(screen.getByText('5 left')).toBeTruthy()
  })

  it('storm cards start locked, are labelled FROM THE PAST, and unlock after a storm reaches the base', () => {
    render(<App />)
    tap('My storm cards')
    expect(screen.getByText(/0 of 8 real storms/)).toBeTruthy()
    expect(screen.getAllByLabelText('Locked storm card')).toHaveLength(8)
    tap('Back')
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    tap('Play')
    tap(/Malapert Massif/)
    tap(/Cadet/)
    // A steady split: 3 blocks Air, 3 blocks Shield, every day, so the storm reaches the base.
    for (let guard = 0; guard < 40; guard++) {
      if (screen.queryByRole('heading', { name: /Mission complete|The rescue ship is here/ })) break
      if (screen.queryByRole('heading', { name: 'Why it happened' })) tap('See my mission')
      else if (screen.queryByRole('button', { name: 'See what happened' })) tap('See what happened')
      else if (screen.queryByRole('button', { name: 'Finish the mission' })) tap('Finish the mission')
      else if (screen.queryByText(/Share power/)) {
        for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'More blocks for Air' }))
        for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'More blocks for Shield' }))
        tap('Next day')
      } else tap('Next day')
    }
    vi.restoreAllMocks()
    tap('Play again')
    tap('My storm cards')
    expect(screen.getByText(/1 of 8 real storms/)).toBeTruthy()
    expect(document.querySelector('[data-status="PAST"]')).not.toBeNull()
    expect(screen.getAllByLabelText('Locked storm card')).toHaveLength(7)
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
