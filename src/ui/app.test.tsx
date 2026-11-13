import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { newGame } from '../engine/game'
import { App } from './App'
import { Living } from './living'

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

/** The adult pages sit behind the gear ("More") on the Start screen, so a tap on one opens the gear first. */
const ADULT = /^(Where the data comes from|Today\u2019s Sun|My storm cards|For teachers|Settings)$/
const tap = (name: string | RegExp) => {
  if (typeof name === 'string' && ADULT.test(name) && !screen.queryByRole('button', { name }) && screen.queryByRole('button', { name: 'More' })) fireEvent.click(screen.getByRole('button', { name: 'More' }))
  fireEvent.click(screen.getByRole('button', { name }))
}

function startGame(mode: 'Cadet' | 'Commander') {
  render(<App />)
  tap('Play')
  tap(/Malapert Massif/)
  tap('Go')
  tap(new RegExp(mode))
}


const building = (label: string) => screen.getByRole('button', { name: new RegExp('^' + label + ', [0-9]+ blocks?$') })
/** Put n power blocks on a building (tap the building, then its + sign). */
function give(id: string, label: string, n = 1) {
  for (let i = 0; i < n; i++) {
    if (!screen.queryByRole('button', { name: 'More blocks, ' + id })) fireEvent.click(building(label))
    fireEvent.click(screen.getByRole('button', { name: 'More blocks, ' + id }))
  }
}
const blocksLeft = () => Number(document.querySelector('.sc-tray')!.getAttribute('data-blocks'))
const NEXT = /^(Next day|See what happened|Finish the mission)$/
/** Play one day: set the blocks, press Next, wait for the time-lapse, read the summary, press its button. */
async function playDay(setup?: () => void) {
  setup?.()
  tap('Next day')
  await waitFor(() => expect(document.querySelector('.daysummary')).not.toBeNull(), { timeout: 4000 })
  tap(NEXT)
}
const over = () => screen.queryByRole('group', { name: 'Why it happened' }) || screen.queryByRole('heading', { name: /Mission complete|Rescue ship/ })

describe('screens', () => {
  it('the start screen is a picture and a Play button, says in a few words that ASTRA is not NASA, and discloses AI for screen readers', () => {
    render(<App />)
    const main = document.querySelector('main')!
    const words = (main.textContent ?? '').trim().split(/\s+/).filter(Boolean)
    expect(words.length).toBeLessThanOrEqual(12)
    expect(main.textContent).toContain('Not endorsed by NASA')
    const about = screen.getByText(/Uses NASA data/).getAttribute('aria-label')!
    expect(about).toContain('not made or endorsed by NASA')
    expect(about).toContain('Claude')
    // The game has no Kokoro audio (only the video does), so it must not claim Kokoro voices.
    expect(about).toContain('your device’s voice')
    expect(about).not.toContain('Kokoro')
  })
  it('the place screen is 9 picture tiles; the name shows when one is picked; the NASA wording is behind an info tap', () => {
    render(<App />)
    tap('Play')
    const tiles = document.querySelectorAll('.place')
    expect(tiles).toHaveLength(9)
    const words = (document.querySelector('main')!.textContent ?? '').trim().split(/\s+/).filter(Boolean)
    expect(words.length).toBeLessThanOrEqual(12) // nine short map names and nothing else
    expect(document.body.textContent).toContain('Malapert')
    expect(document.body.textContent).not.toContain('Malapert Massif') // the full name shows once a pin is picked
    tap(/Malapert Massif/)
    expect(screen.getByText('Malapert Massif')).toBeTruthy()
    tap('About these places')
    const text = document.body.textContent ?? ''
    expect(text).toContain('9 candidate landing regions near the Moon')
    expect(text).not.toMatch(/Artemis III will land|NASA picked/i)
  })
  it('the Commander card says "Stronger storms" and the Cadet card does not', () => {
    render(<App />)
    tap('Play')
    tap(/Malapert Massif/)
  tap('Go')
    const cadet = screen.getByRole('button', { name: /Cadet/ })
    const commander = screen.getByRole('button', { name: /Commander/ })
    expect(commander.textContent).toContain('Stronger storms')
    expect(cadet.textContent).not.toContain('Stronger storms')
  })

  it('the base screen is one living scene: 6 blocks in the tray, one leaves when placed', () => {
    startGame('Cadet')
    expect(screen.getByLabelText('Day 1 of 10')).toBeTruthy()
    expect(blocksLeft()).toBe(6)
    give('air', 'Air')
    expect(blocksLeft()).toBe(5)
  })

  it('cannot give out more than 6 blocks', () => {
    startGame('Cadet')
    give('air', 'Air', 2)
    give('plants', 'Plants', 2)
    give('shield', 'Shield', 2)
    expect(blocksLeft()).toBe(0)
    fireEvent.click(building('Air'))
    expect(screen.getByRole('button', { name: 'More blocks, air' }).getAttribute('aria-disabled')).toBe('true')
  })

  it('Plants (air and science) is a job in both modes; only Commander has a food bar', () => {
    startGame('Cadet')
    expect(building('Plants')).toBeTruthy()
    expect(screen.queryByRole('meter', { name: 'Food' })).toBeNull()
    cleanup()
    startGame('Commander')
    expect(building('Plants')).toBeTruthy()
    expect(screen.getByRole('meter', { name: 'Food' })).toBeTruthy()
  })

  it('an idle game ends with the Why picture strip, then the end screen', async () => {
    startGame('Cadet')
    for (let guard = 0; guard < 14 && !over(); guard++) await playDay()
    const strip = screen.getByRole('group', { name: 'Why it happened' })
    expect(strip.querySelectorAll('figure')).toHaveLength(3)
    for (const cap of strip.querySelectorAll('figcaption')) expect(cap.textContent!.trim().split(/\s+/).length).toBeLessThanOrEqual(4)
    expect(document.body.textContent).toMatch(/Rescue ship|Shield|A flare/)
    tap('See my mission')
    expect(screen.getByRole('heading', { name: 'Rescue ship' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play again' })).toBeTruthy()
  }, 30000)

  it('calling Earth shows the radio delay before the answer', async () => {
    startGame('Cadet')
    give('radio', 'Radio')
    tap('Next day')
    await waitFor(() => expect(screen.getByText(/Radio waves take 1\.28 seconds/)).toBeTruthy(), { timeout: 4000 })
    await waitFor(() => expect(screen.getByText(/Mission Control: /)).toBeTruthy(), { timeout: 4000 })
  })

  it('the data page lists every source with a NASA/NOAA label and the AI note', () => {
    render(<App />)
    tap('Where the data comes from')
    const text = document.body.textContent ?? ''
    for (const name of ['NASA DONKI', 'NOAA SWPC', 'BVAD', 'OSDR']) expect(text).toContain(name)
    expect(text).toContain('your device’s own voice')
    expect(text).toContain('Open Peeps by Pablo Stanley (CC0)')
    expect(text).not.toContain('Kokoro')
    expect(text).toContain('never these numbers')
    tap('Back')
    expect(screen.getByRole('heading', { name: 'ASTRA' })).toBeTruthy()
  })

  it("Today's Sun says SAVED with the saved date, and the full explanation is behind an info tap", async () => {
    render(<App />)
    tap("Today’s Sun")
    await waitFor(() => expect(document.querySelector('[data-status="SAVED"]')).not.toBeNull())
    expect(document.querySelector('[data-status="LIVE"]')).toBeNull()
    expect(document.body.textContent).toContain('12 Nov 2026')
    expect(document.body.textContent).not.toContain('does not predict storms')
    tap('About Today’s Sun')
    const text = document.body.textContent ?? ''
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
    give('air', 'Air')
    await waitFor(() => expect(screen.getByRole('button', { name: /Today's Sun, SAVED/ })).toBeTruthy())
    tap(/Today's Sun, SAVED/)
    expect(screen.getByRole('heading', { name: 'Today’s Sun' })).toBeTruthy()
    tap('Back')
    expect(blocksLeft()).toBe(5)
  })

  it('storm cards start locked, are labelled FROM THE PAST, and unlock after a storm reaches the base', async () => {
    render(<App />)
    tap('My storm cards')
    expect(screen.getByText(/0 of 8 real storms/)).toBeTruthy()
    expect(screen.getAllByLabelText('Locked storm card')).toHaveLength(8)
    tap('Back')
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    tap('Play')
    tap(/Malapert Massif/)
    tap('Go')
    tap(/Cadet/)
    // A steady split: 3 blocks Air, 3 blocks Shield, every day, so the storm reaches the base.
    for (let guard = 0; guard < 14 && !over(); guard++) {
      await playDay(() => {
        give('air', 'Air', 3)
        give('shield', 'Shield', 3)
      })
    }
    if (screen.queryByRole('group', { name: 'Why it happened' })) tap('See my mission')
    vi.restoreAllMocks()
    tap('Play again')
    tap('My storm cards')
    expect(screen.getByText(/1 of 8 real storms/)).toBeTruthy()
    expect(document.querySelector('[data-status="PAST"]')).not.toBeNull()
    expect(screen.getAllByLabelText('Locked storm card')).toHaveLength(7)
  }, 30000)

  it('the day summary is arrows and icons; the sentences are for screen readers, and say "stayed at" when a bar does not change', async () => {
    startGame('Cadet')
    tap('Next day')
    await waitFor(() => expect(screen.getByLabelText('Radiation stayed at 0.')).toBeTruthy(), { timeout: 4000 })
    const labels = [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')!)
    expect(labels.some((l) => /went from [0-9]+ to [.]/.test(l))).toBe(false)
    expect(document.querySelectorAll('.summary li svg').length).toBeGreaterThanOrEqual(6)
  })

  it('the base screen has the base picture, 4 crew faces, ORBI and a sticky Next day button', () => {
    startGame('Cadet')
    expect(screen.getByRole('group', { name: /^The Moon base\./ })).toBeTruthy()
    for (const who of ['Safia', 'Kofi', 'Leo', 'Mei']) expect(screen.getAllByRole('img', { name: new RegExp('^' + who + ',') }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('img', { name: /ORBI/ }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Next day' }).parentElement?.className).toContain('sticky-cta')
  })

  it('the base picture follows the shield blocks you give', () => {
    startGame('Cadet')
    expect(screen.getByRole('group', { name: /^The Moon base\./ }).getAttribute('aria-label')).toContain('The shield is off.')
    give('shield', 'Shield', 2)
    expect(screen.getByRole('group', { name: /^The Moon base\./ }).getAttribute('aria-label')).toContain('The shield has 2 blocks.')
  })

  describe('settings and read-aloud', () => {
    const spoken: string[] = []
    const mockSpeech = () => {
      spoken.length = 0
      const synth = { cancel: () => undefined, speak: (u: { text: string }) => void spoken.push(u.text) }
      class Utterance {
        lang = ''
        rate = 1
        constructor(public text: string) {}
      }
      vi.stubGlobal('speechSynthesis', synth)
      vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true })
    }
    const unmockSpeech = () => {
      // @ts-expect-error remove the fake
      delete window.speechSynthesis
      // @ts-expect-error remove the fake
      delete window.SpeechSynthesisUtterance
    }

    it('read-aloud is Off by default: no speaker buttons', () => {
      mockSpeech()
      startGame('Cadet')
      expect(screen.queryByRole('button', { name: 'Read aloud' })).toBeNull()
      unmockSpeech()
    })

    it('turning it On shows speaker buttons, speaks the text when tapped, and is remembered', () => {
      mockSpeech()
      render(<App />)
      tap('Settings')
      const sw = screen.getByRole('switch', { name: 'Read aloud' })
      expect(sw.getAttribute('aria-checked')).toBe('false')
      fireEvent.click(sw)
      expect(sw.getAttribute('aria-checked')).toBe('true')
      expect(localStorage.getItem('astra-prefs-v1')).toContain('"readAloud":true')
      tap('Hear a sample')
      expect(spoken.at(-1)).toMatch(/read the words out loud/)
      tap('Back')
      tap('Play')
      tap(/Malapert Massif/)
  tap('Go')
      tap(/Cadet/)
      fireEvent.click(screen.getAllByRole('button', { name: 'Read aloud' })[0]!)
      expect(spoken.at(-1)).toMatch(/ORBI says: You have 6 blocks/)
      unmockSpeech()
    })

    it('a device that cannot speak keeps read-aloud Off and says so', () => {
      render(<App />)
      tap('Settings')
      const sw = screen.getByRole('switch', { name: 'Read aloud' }) as HTMLButtonElement
      expect(sw.disabled).toBe(true)
      expect(document.body.textContent).toContain('can not read aloud')
    })
  })

  it('the For teachers page explains the game, is honest about play time and credits Open Peeps', () => {
    render(<App />)
    tap('For teachers')
    const text = document.body.textContent ?? ''
    expect(text).toContain('Radiation')
    expect(text).toContain('Mission Control')
    expect(text).toContain('not timed a class session')
    expect(text).not.toMatch(/10\s*[–-]\s*15 minutes/)
    expect(text).toContain('no names and no photos of children')
    expect(text).toContain('Open Peeps by Pablo Stanley (CC0)')
    expect(text).toContain('not made or endorsed by NASA')
    tap('Back')
    expect(screen.getByRole('heading', { name: 'ASTRA' })).toBeTruthy()
  })

  it('the Sound switch is On by default, can be turned Off and is remembered', () => {
    render(<App />)
    tap('Settings')
    const sw = screen.getByRole('switch', { name: 'Sound' })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(localStorage.getItem('astra-prefs-v1')).toContain('"sound":false')
  })

  it('a bar in the danger zone glows and a screen reader hears "low" or "high", not just a colour', () => {
    const g = { ...newGame({ mode: 'commander', siteId: 'region-3', seed: 2 }), storms: [], warned: [], air: 20, radiation: 70 }
    render(<Living game={g} sun={null} onStep={() => g} onOver={() => undefined} onData={() => undefined} onSun={() => undefined} />)
    expect(screen.getByRole('meter', { name: 'Air' }).getAttribute('aria-valuetext')).toBe('low')
    expect(screen.getByRole('meter', { name: 'Radiation' }).getAttribute('aria-valuetext')).toBe('high')
    expect(screen.getByRole('meter', { name: 'Power' }).getAttribute('aria-valuetext')).toBeNull()
    expect(screen.getByRole('meter', { name: 'Air' }).closest('.sc-meter')?.className).toContain('danger')
    expect(screen.getByRole('meter', { name: 'Power' }).closest('.sc-meter')?.className).not.toContain('danger')
  })

  it('uses the kid word rules: "day" not "sol", "tap" not "click"', () => {
    render(<App />)
    tap('Play')
    tap(/Malapert Massif/)
  tap('Go')
    tap(/Cadet/)
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/\bsols?\b/i)
    expect(text).not.toMatch(/\bclick/i)
      })
}, 20000)
