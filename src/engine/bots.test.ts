import { describe, expect, it } from 'vitest'
import sites from '../data/sites.json'
import { bots, playBot } from './bots'
import type { Mode } from './types'

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)
const MODES: Mode[] = ['cadet', 'commander']

function winRate(botName: keyof typeof bots, mode: Mode): number {
  let wins = 0
  let games = 0
  for (const site of sites) {
    for (const seed of SEEDS) {
      games++
      if (playBot(bots[botName], { mode, siteId: site.id, seed }).status === 'won') wins++
    }
  }
  return wins / games
}

describe('bot balance: lazy play never wins', () => {
  for (const mode of MODES) {
    for (const name of ['idle', 'allAir', 'allShield', 'allPlants', 'allRadio'] as const) {
      it(`${name} never wins in ${mode}`, () => {
        expect(winRate(name, mode)).toBe(0)
      })
    }
  }
})

describe('bot balance: careful play wins', () => {
  for (const mode of MODES) {
    it(`the smart bot wins at least 80% in ${mode}`, () => {
      expect(winRate('smart', mode)).toBeGreaterThanOrEqual(0.8)
    })
  }
  it('the smart bot does not win every game in commander mode', () => {
    expect(winRate('smart', 'commander')).toBeLessThan(1)
  })
  it('never calling the radio is clearly worse than using it', () => {
    for (const mode of MODES) expect(winRate('noRadio', mode)).toBeLessThan(winRate('smart', mode) - 0.15)
  })
})
