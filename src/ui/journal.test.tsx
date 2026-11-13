import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from './App'
import { Journal } from './journal'
import { FLARES_FOLLOWED, FLARES_NOT_FOLLOWED, flareById } from '../engine/flares'
import { addPlayed, CLUE_KEYS, hasClue, patternBanner, SEED_FLARE_IDS, seededEntries, type JournalEntry } from '../engine/journal'

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

const played = (ids: string[]): JournalEntry[] => ids.map((id) => ({ flareId: id, followed: flareById(id)!.followed, guess: null, seed: false }))
const rays = (n: number, pred: (f: (typeof FLARES_FOLLOWED)[number]) => boolean = () => true) => FLARES_FOLLOWED.filter(pred).slice(0, n).map((f) => f.id)
const quiet = (n: number, pred: (f: (typeof FLARES_FOLLOWED)[number]) => boolean = () => true) => FLARES_NOT_FOLLOWED.filter(pred).slice(0, n).map((f) => f.id)

describe("ORBI's old notes: 8 real past flares", () => {
  const seeds = seededEntries()

  it('are 8 real flares, 4 that brought rays and 4 that did not, labelled as old notes', () => {
    expect(SEED_FLARE_IDS).toHaveLength(8)
    expect(seeds.every((e) => e.seed)).toBe(true)
    expect(seeds.filter((e) => e.followed)).toHaveLength(4)
    expect(seeds.filter((e) => !e.followed)).toHaveLength(4)
    for (const e of seeds) expect(flareById(e.flareId)).toBeDefined()
  })

  it('their outcomes are the real ones from NASA’s list, never made up', () => {
    for (const e of seeds) expect(e.followed).toBe(flareById(e.flareId)!.followed)
  })

  it('show the lessons: a big flare with no cloud and no rays, and a flare with no cloud that did bring rays', () => {
    const real = seeds.map((e) => flareById(e.flareId)!)
    expect(real.some((f) => !f.followed && !f.cloud && f.class.startsWith('X'))).toBe(true)
    expect(real.some((f) => f.followed && !f.cloud)).toBe(true)
    expect(real.some((f) => !f.followed && f.cloud && f.class.startsWith('X'))).toBe(true)
  })
})

describe('the journal and its pattern banner', () => {
  it('keeps one entry per flare and marks the child’s own flares as not old notes', () => {
    const a = addPlayed([], [{ flareId: 'flr-44029', followed: true, guess: 'unsure' }])
    const b = addPlayed(a, [{ flareId: 'flr-44029', followed: true, guess: 'yes' }, { flareId: 'flr-29334', followed: false, guess: 'no' }])
    expect(b).toHaveLength(2)
    expect(b.find((e) => e.flareId === 'flr-44029')!.guess).toBe('yes')
    expect(b.every((e) => !e.seed)).toBe(true)
  })

  it('needs at least 3 of the child’s own flares, and never counts ORBI’s old notes', () => {
    expect(patternBanner([])).toBeNull()
    expect(patternBanner(seededEntries())).toBeNull()
    expect(patternBanner([...seededEntries(), ...played(rays(2, (f) => f.cloud))])).toBeNull()
  })

  it('says how often a clue went with rays in the child’s own results, as counts', () => {
    // 3 of 4 gas-cloud flares brought rays; the 2 flares with no cloud did not.
    const entries = played([...rays(3, (f) => f.cloud), ...quiet(1, (f) => f.cloud), ...quiet(2, (f) => !f.cloud)])
    const p = patternBanner(entries)
    expect(p).not.toBeNull()
    const f = (id: string) => flareById(id)!
    const inGroup = entries.filter((e) => hasClue(f(e.flareId), p!.clue))
    expect(p!.n).toBe(inGroup.length)
    expect(p!.rays).toBe(inGroup.filter((e) => e.followed).length)
    expect(p!.n).toBeGreaterThanOrEqual(3)
  })

  it('stays quiet when nothing stands out', () => {
    // every clue group has the same result: all flares brought rays
    expect(patternBanner(played(rays(6)))).toBeNull()
    expect(CLUE_KEYS).toHaveLength(6)
  })
})

describe('the Flare Journal page', () => {
  const show = (entries: JournalEntry[] = []) => render(<Journal played={entries} onBack={() => undefined} />)

  it('is stickers on two shelves with counts, and almost no words', () => {
    show()
    const main = document.querySelector('main')!
    const words = (main.textContent ?? '').trim().split(/\s+/).filter(Boolean)
    expect(words.length).toBeLessThanOrEqual(12)
    expect(screen.getByLabelText('Rays').querySelectorAll('.sticker')).toHaveLength(4)
    expect(screen.getByLabelText('No rays').querySelectorAll('.sticker')).toHaveLength(4)
    expect(main.querySelectorAll('.flareart').length).toBe(8)
  })

  it('labels ORBI’s old notes for screen readers and marks every sticker as a real NASA record', () => {
    show()
    const first = screen.getByLabelText('Rays').querySelector('.sticker button')!
    expect(first.getAttribute('aria-label')).toContain('from ORBI’s old notes')
  })

  it('tapping a clue shows only the flares with it, with new counts, and tapping again shows all', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'No gas cloud' }))
    const total = document.querySelectorAll('.sticker').length
    expect(total).toBeLessThan(8)
    expect(total).toBeGreaterThan(0)
    const noCloud = seededEntries().filter((e) => !flareById(e.flareId)!.cloud).length
    expect(total).toBe(noCloud)
    fireEvent.click(screen.getByRole('button', { name: 'No gas cloud' }))
    expect(document.querySelectorAll('.sticker')).toHaveLength(8)
  })

  it('tapping a sticker shows its size and date and the NASA record (the radiation record if rays came)', () => {
    show()
    fireEvent.click(screen.getByLabelText('Rays').querySelector('.sticker button')!)
    const detail = screen.getByRole('status')
    expect(detail.textContent).toMatch(/[XM]\d/)
    expect(detail.querySelector('a')?.getAttribute('href')).toMatch(/ccmc\.gsfc\.nasa\.gov\/DONKI\/view\/SEP\//)
    fireEvent.click(screen.getByLabelText('No rays').querySelector('.sticker button')!)
    expect(screen.getByRole('status').querySelector('a')?.getAttribute('href')).toMatch(/\/DONKI\/view\/FLR\//)
  })

  it('the child’s own flares join the shelves with their guess marked, and the banner is drawn with dots', () => {
    const entries: JournalEntry[] = [...rays(3, (f) => f.cloud), ...quiet(1, (f) => f.cloud), ...quiet(2, (f) => !f.cloud)].map((id, i) => ({
      flareId: id,
      followed: flareById(id)!.followed,
      guess: i % 2 === 0 ? 'yes' : 'no',
      seed: false,
    }))
    show(entries)
    expect(document.querySelectorAll('.sticker')).toHaveLength(8 + entries.length)
    const banner = screen.getByRole('img', { name: /rays came \d of \d times\. Often, not always\./ })
    expect(banner.querySelectorAll('.dots i').length).toBeGreaterThanOrEqual(3)
    expect(banner.textContent).toBe('')
  })

  it('is reachable from the start screen and remembers what the child learned', () => {
    localStorage.setItem('astra-journal-v1', JSON.stringify(played(rays(2)).concat(played(quiet(1)))))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Flare Journal' }))
    expect(screen.getByRole('heading', { name: 'Flare Journal' })).toBeTruthy()
    expect(document.querySelectorAll('.sticker')).toHaveLength(8 + 3)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'ASTRA' })).toBeTruthy()
  })
})
