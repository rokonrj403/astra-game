import { describe, expect, it } from 'vitest'
import sites from '../data/sites.json'
import { bots, playBot } from './bots'
import { flareClues } from './flares'
import { raysWeight, quietWeight, riskInHand } from './hand'
import { FLARES_FOLLOWED, FLARES_NOT_FOLLOWED } from './flares'
import type { GameState, Mode } from './types'

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)
const MODES: Mode[] = ['cadet', 'commander']

const cache = new Map<string, GameState[]>()
function games(botName: keyof typeof bots, mode: Mode): GameState[] {
  const key = `${botName}/${mode}`
  let out = cache.get(key)
  if (!out) {
    out = []
    for (const site of sites) for (const seed of SEEDS) out.push(playBot(bots[botName], { mode, siteId: site.id, seed }))
    cache.set(key, out)
  }
  return out
}
const winRate = (botName: keyof typeof bots, mode: Mode) => games(botName, mode).filter((g) => g.status === 'won').length / games(botName, mode).length

describe('bot balance: lazy play never wins', () => {
  for (const mode of MODES)
    for (const name of ['idle', 'allAir', 'allShield', 'allPlants', 'allRadio'] as const)
      it(`${name} never wins in ${mode}`, () => {
        expect(winRate(name, mode)).toBe(0)
      })
})

describe('bot balance: careful play wins, careless play does not', () => {
  for (const mode of MODES) {
    it(`the careful bot (reads the clues, budgets power) wins 80 to 95% in ${mode}`, () => {
      const r = winRate('smart', mode)
      expect(r).toBeGreaterThanOrEqual(0.8)
      expect(r).toBeLessThanOrEqual(0.95)
    })
    it(`random play (random split, walk and choice) wins under 15% in ${mode}`, () => {
      expect(winRate('random', mode)).toBeLessThan(0.15)
    })
    it(`never charging the shield is clearly worse than careful play in ${mode}`, () => {
      expect(winRate('neverShield', mode)).toBeLessThan(winRate('smart', mode) - 0.4)
    })
    it(`charging the shield for every flare is clearly worse than careful play in ${mode}`, () => {
      expect(winRate('paranoid', mode)).toBeLessThan(winRate('smart', mode) - 0.15)
    })
    it(`walking a long walk every day is clearly worse than careful play in ${mode}`, () => {
      expect(winRate('alwaysWalk', mode)).toBeLessThan(winRate('smart', mode) - 0.4)
    })
    it(`reading the clues beats ignoring them in ${mode}`, () => {
      expect(winRate('ignoreClues', mode)).toBeLessThan(winRate('smart', mode) - 0.1)
    })
    it(`careful wins are close calls about as often as not in ${mode} (35 to 65% end with a bar under 30)`, () => {
      // The careful bot spends its power down to a small reserve, so this reads a little high; the point is that wins are not easy.
      const wins = games('smart', mode).filter((g) => g.status === 'won')
      const tense = wins.filter((g) => Math.min(g.air, g.power, g.hasFood ? g.food : 100) < 30).length / wins.length
      expect(tense).toBeGreaterThanOrEqual(0.35)
      expect(tense).toBeLessThanOrEqual(0.65)
    })
    it(`no single day ends more than 20% of careful runs in ${mode}`, () => {
      const all = games('smart', mode)
      const byDay: Record<number, number> = {}
      for (const g of all) if (g.status === 'lost') byDay[g.history.length] = (byDay[g.history.length] ?? 0) + 1
      for (const n of Object.values(byDay)) expect(n / all.length).toBeLessThan(0.2)
    })
  }

  it('the two modes are both winnable on every site (careful play wins at least a third on the hardest one)', () => {
    for (const mode of MODES)
      for (const site of sites) {
        const g = SEEDS.map((seed) => playBot(bots.smart, { mode, siteId: site.id, seed }))
        expect(g.filter((x) => x.status === 'won').length / g.length, `${mode} ${site.id}`).toBeGreaterThanOrEqual(0.33)
      }
  })
})

describe('the clues really help inside a hand', () => {
  const share = (pool: typeof FLARES_FOLLOWED, w: (f: (typeof FLARES_FOLLOWED)[number]) => number, pred: (f: (typeof FLARES_FOLLOWED)[number]) => boolean) => {
    const all = pool.reduce((a, f) => a + w(f), 0)
    return pool.filter(pred).reduce((a, f) => a + w(f), 0) / all
  }

  it('flares that bring rays lean to a gas cloud and the west; quiet ones lean to no cloud and the east', () => {
    const others = FLARES_FOLLOWED.filter((f) => !f.sizeKnown)
    expect(share(others, raysWeight, (f) => f.cloud)).toBeGreaterThan(share(FLARES_NOT_FOLLOWED, quietWeight, (f) => f.cloud) + 0.2)
    expect(share(others, raysWeight, (f) => f.side === 'west')).toBeGreaterThan(share(FLARES_NOT_FOLLOWED, quietWeight, (f) => f.side === 'west') + 0.1)
  })

  it('the careful bot’s chance estimate rises with each clue and never reaches 0 or 1', () => {
    const base = { bucket: 'm5', cloud: false, side: 'east' } as const
    const low = riskInHand(base)
    expect(riskInHand({ ...base, cloud: true })).toBeGreaterThan(low)
    expect(riskInHand({ ...base, side: 'west' })).toBeGreaterThan(low)
    expect(riskInHand({ ...base, bucket: 'x1' })).toBeGreaterThan(low)
    const high = riskInHand({ bucket: 'x5', cloud: true, side: 'west' })
    expect(high).toBeGreaterThan(low)
    for (const p of [low, high]) {
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThan(1)
    }
  })

  it('reads the clues of a real flare from the data', () => {
    const f = FLARES_FOLLOWED[0]!
    expect(riskInHand(flareClues(f))).toBeGreaterThan(0)
  })
})
