import { describe, expect, it } from 'vitest'
import storms from '../data/storms.json'
import sites from '../data/sites.json'
import { MODES, MODE_CARDS } from './constants'
import { bots, playBot } from './bots'
import { explain } from './game'

const SIZE_OF_LEVEL: Record<string, string> = { S2: 'small', S3: 'big', S4: 'huge' }

/** The part of a storm the player sees: label, NOAA level, dates, peak and flare. */
const shown = () =>
  storms.map((s) => ({
    id: s.id,
    title: s.title,
    dates: s.dates,
    sLevel: s.sLevel,
    size: s.size,
    peakPfu: s.peakPfu.value,
    peakDate: s.peakDate,
    flare: s.flare.value,
    geomagnetic: s.geomagnetic,
  }))

describe('the storm multiplier changes the game, never the displayed data', () => {
  it('storm data is identical before and after playing Commander games', () => {
    const before = structuredClone(shown())
    const rawBefore = structuredClone(storms)
    for (const site of sites) {
      for (let seed = 1; seed <= 10; seed++) {
        for (const bot of [bots.smart, bots.idle]) playBot(bot, { mode: 'commander', siteId: site.id, seed })
      }
    }
    expect(shown()).toEqual(before)
    expect(storms).toEqual(rawBefore)
  })

  it('NOAA levels still match the storm size, so the multiplier is not baked into the data', () => {
    for (const s of storms) expect(SIZE_OF_LEVEL[s.sLevel]).toBe(s.size)
  })

  it('peaks are the sourced NOAA values, not scaled by the Commander multiplier', () => {
    const boost = MODES.commander.stormBoost
    const peaks = new Map(storms.map((s) => [s.id, s.peakPfu.value]))
    expect(peaks.get('storm-6')).toBe(36976)
    for (const s of storms) {
      expect(s.peakPfu.source).toMatch(/NOAA|GOES/i)
      for (const other of storms) expect(s.peakPfu.value).not.toBe(Math.round(other.peakPfu.value * boost))
    }
  })

  it('the Why-it-happened text shows the real label, dates and flare, with no scaled numbers', () => {
    const boost = MODES.commander.stormBoost
    let checked = 0
    for (const site of sites) {
      for (let seed = 1; seed <= 40; seed++) {
        const g = playBot(bots.idle, { mode: 'commander', siteId: site.id, seed })
        if (g.status !== 'lost' || g.loss !== 'radiation') continue
        const data = storms.find((s) => s.id === g.storms[g.history[g.history.length - 1]!.storm!.index]!.stormId)!
        const text = explain(g).steps.map((x) => x.text).join(' ')
        expect(text).toContain(data.title)
        expect(text).toContain(data.dates)
        expect(text).toContain(data.flare.value)
        expect(text).not.toContain(String(Math.round(data.peakPfu.value * boost)))
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe('mode cards', () => {
  it('the Commander card says "Stronger storms" and Cadet does not', () => {
    expect(MODE_CARDS.commander.lines).toContain('Stronger storms')
    expect(MODE_CARDS.cadet.lines).not.toContain('Stronger storms')
  })
  it('card lines match the real settings', () => {
    expect(MODES.commander.stormBoost).toBeGreaterThan(MODES.cadet.stormBoost)
    expect(MODE_CARDS.commander.lines).toContain(`${MODES.commander.days} days`)
    expect(MODE_CARDS.commander.lines).toContain('Two storms')
  })
})
