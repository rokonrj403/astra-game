import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import consumables from './consumables.json'
import sites from './sites.json'
import storms from './storms.json'
import science from './science.json'
import sources from './sources.json'
import snapshot from './snapshot.json'
import flareSet from './flares.json'
import flareStats from './flareStats.json'

type Sourced = { value: unknown; source: string }
const isSourced = (x: unknown): x is Sourced =>
  typeof x === 'object' && x !== null && 'value' in x && 'source' in x

function collectSourced(node: unknown, out: Sourced[] = []): Sourced[] {
  if (isSourced(node)) out.push(node)
  if (typeof node === 'object' && node !== null) Object.values(node).forEach((v) => collectSourced(v, out))
  return out
}

describe('real data files', () => {
  it('every sourced value names its source', () => {
    for (const file of [consumables, sites, storms]) {
      const all = collectSourced(file)
      expect(all.length).toBeGreaterThan(0)
      for (const s of all) expect(s.source.length).toBeGreaterThan(10)
    }
  })

  it('uses the NASA BVAD values the plan fixed', () => {
    expect(consumables.o2KgPerPersonDay.value).toBe(0.895)
    expect(consumables.foodKgPerPersonDay.value).toBe(0.8)
    expect(consumables.waterKgPerPersonDay.value).toBe(3.217)
  })

  it('has NASA’s 9 regions with sun and Earth shares between 0 and 1', () => {
    expect(sites).toHaveLength(9)
    for (const s of sites) {
      expect(s.sunShare.value).toBeGreaterThanOrEqual(0)
      expect(s.sunShare.value).toBeLessThanOrEqual(1)
      expect(s.earthShare.value).toBeGreaterThanOrEqual(0)
      expect(s.earthShare.value).toBeLessThanOrEqual(1)
    }
  })

  it('has 8 storms with one headline', () => {
    expect(storms).toHaveLength(8)
    expect(storms.filter((s) => s.headline)).toHaveLength(1)
  })

  it('January 2026 links DONKI record 44041, never the model run 44054', () => {
    const jan = storms.find((s) => s.headline)!
    const urls = jan.records.map((r) => r.url)
    expect(urls.some((u) => u.endsWith('/SEP/44041/-1'))).toBe(true)
    expect(urls.some((u) => u.includes('44054'))).toBe(false)
    expect(jan.sepModelRecordsNotShown).toContain('44054')
  })

  it('no storm links a model-run SEP record', () => {
    for (const s of storms)
      for (const id of s.sepModelRecordsNotShown) for (const r of s.records) expect(r.url).not.toContain(`/SEP/${id}/`)
  })

  it('size matches the NOAA S-level', () => {
    for (const s of storms) {
      const expected = s.sLevel === 'S3' ? 'big' : s.sLevel === 'S1' || s.sLevel === 'S2' ? 'small' : 'huge'
      expect(s.size).toBe(expected)
    }
  })

  it('storm curves are shape-only, normalised to 1', () => {
    for (const s of storms) {
      if (!s.curve) continue
      expect(Math.max(...s.curve.relative)).toBe(1)
      expect(s.curve.source).toContain('shape only')
    }
  })

  it('science facts say yeast or mice, never astronauts', () => {
    for (const f of science) {
      expect(f.kidLine + f.learnMore).toMatch(/yeast|mouse|mice/i)
      expect(f.kidLine + f.learnMore).not.toMatch(/astronaut/i)
    }
  })

  it('lists 6 datasets with a note each', () => {
    expect(sources).toHaveLength(6)
    for (const s of sources) expect(s.note.length).toBeGreaterThan(0)
  })

  it('snapshot says what period it covers and uses real fields', () => {
    expect(snapshot.savedThrough).toBe('2026-11-12')
    expect(snapshot.source).toContain('DONKI')
    for (const g of snapshot.magneticStorms) expect(g.kp).toBeGreaterThan(0)
  })
})

describe('site sunlight and Earth view: the best spot within 5 km of each region (LRO LOLA, 18.6-year average)', () => {
  const site = (id: string) => sites.find((s) => s.id === id)!

  it('pins the values the lead chose: Malapert Massif sun about 85% and Earth 100%, Slater Plain Earth about 49.9%', () => {
    expect(site('region-3').name).toBe('Malapert Massif')
    expect(site('region-3').sunShare.value).toBeCloseTo(0.845, 3)
    expect(site('region-3').earthShare.value).toBe(1)
    expect(site('region-9').name).toBe('Slater Plain')
    expect(site('region-9').earthShare.value).toBeCloseTo(0.499, 3)
  })

  it('names the column and the 18.6-year average in every source string', () => {
    for (const s of sites) {
      expect(s.sunShare.source).toContain('sun_max_5km')
      expect(s.earthShare.source).toContain('earth_max_5km')
      expect(s.sunShare.source).toContain('18.6-year average')
      expect(s.earthShare.source).toContain('18.6-year average')
    }
  })

  const csv = join(import.meta.dirname, '../../../nasa-space-apps-2026/data/raw/lola/regions_lola.csv')
  it.skipIf(!existsSync(csv))('matches the LOLA csv in the prep repo, column by column', () => {
    const [head, ...rows] = readFileSync(csv, 'utf8').trim().split(/\r?\n/)
    const cols = head!.split(',')
    for (const line of rows) {
      const cells = line.split(',')
      const row = Object.fromEntries(cols.map((c, i) => [c, cells[i]]))
      const s = site(`region-${row.id}`)
      expect(s.sunShare.value).toBe(Number(row.sun_max_5km))
      expect(s.earthShare.value).toBe(Number(row.earth_max_5km))
    }
  })
})

describe('flare watch data (real flares and what followed them)', () => {
  const flares = flareSet.flares
  const yes = flares.filter((f) => f.followed)
  const no = flares.filter((f) => !f.followed)

  it('states its labelling rule and where the data comes from', () => {
    expect(flareSet.rule).toMatch(/72 hours/)
    expect(flareSet.rule).toMatch(/GOES >10 MeV/)
    expect(flareSet.rule).toMatch(/not model/)
    expect(flareSet.source).toContain('NASA DONKI')
    expect(flareStats.rule).toBe(flareSet.rule)
  })

  it('every flare is a real DONKI flare of class M5 or bigger, with a NASA record link, in the archive period', () => {
    for (const f of flares) {
      expect(f.link).toMatch(/^https:\/\/ccmc\.gsfc\.nasa\.gov\/DONKI\/view\/FLR\/\d+\/-1$/)
      expect(f.class).toMatch(/^(X\d+(\.\d)?|M([5-9])(\.\d)?)$/)
      expect(f.peakTime >= '2010' && f.peakTime <= '2026-11-12T23:59Z').toBe(true)
      expect(f.id).toBe(`flr-${f.link.match(/FLR\/(\d+)\//)![1]}`)
    }
    expect(new Set(flares.map((f) => f.id)).size).toBe(flares.length)
  })

  it('every flare followed by space rays has its own NASA radiation record; exactly 8 of them are our real storms with a known size', () => {
    expect(yes).toHaveLength(98)
    const known = yes.filter((f) => f.sizeKnown)
    expect(known.map((f) => f.stormId).sort()).toEqual(storms.map((s) => s.id).sort())
    for (const f of yes.filter((x) => !x.sizeKnown)) expect(f.stormId).toBeNull()
    for (const f of known) {
      const storm = storms.find((s) => s.id === f.stormId)!
      expect(storm.flare.value).toBe(f.class)
      expect(storm.records.some((r) => r.url === f.link)).toBe(true)
    }
    for (const f of yes) {
      expect(f.sep).not.toBeNull()
      expect(f.sep!.link).toMatch(/^https:\/\/ccmc\.gsfc\.nasa\.gov\/DONKI\/view\/SEP\/\d+\/-1$/)
      expect(f.sep!.instrument).toMatch(/GOES.*>10 MeV/)
      expect(f.sep!.instrument).not.toMatch(/MODEL/)
    }
  })

  it('the rule holds for every followed flare: the radiation record starts 0 to 72 hours after the peak, and the game delay is 1 to 3 days', () => {
    for (const f of yes) {
      const hours = (Date.parse(f.sep!.time) - Date.parse(f.peakTime)) / 3_600_000
      expect(hours).toBeGreaterThanOrEqual(0)
      expect(hours).toBeLessThanOrEqual(72)
      expect(Math.abs(hours - f.sep!.hoursAfterPeak)).toBeLessThan(0.06)
      expect(f.sep!.delayDays).toBe(Math.max(1, Math.ceil(f.sep!.hoursAfterPeak / 24)))
      expect(f.sep!.delayDays).toBeGreaterThanOrEqual(1)
      expect(f.sep!.delayDays).toBeLessThanOrEqual(3)
    }
  })

  it('flares that were not followed carry no outcome record and no storm', () => {
    expect(no.length).toBeGreaterThan(100)
    for (const f of no) {
      expect(f.sep).toBeNull()
      expect(f.stormId).toBeNull()
    }
  })

  it('the base rates match an independent count of the DONKI archive (424 flares of M5 or bigger, 98 followed)', () => {
    const b = Object.fromEntries(flareStats.buckets.map((x) => [x.id, x]))
    expect([b.m5!.n, b.m5!.followed]).toEqual([268, 47])
    expect([b.x1!.n, b.x1!.followed]).toEqual([144, 44])
    expect([b.x5!.n, b.x5!.followed]).toEqual([12, 7])
    expect([flareStats.total.n, flareStats.total.followed]).toEqual([424, 98])
    for (const x of [...flareStats.buckets, flareStats.total]) expect(x.percent).toBe(Math.round((100 * x.followed) / x.n))
    // Bigger flares are more likely to bring space rays, but none is certain: that is the lesson of the game.
    expect(b.m5!.percent).toBeLessThan(b.x1!.percent)
    expect(b.x1!.percent).toBeLessThan(b.x5!.percent)
    expect(b.x5!.percent).toBeLessThan(100)
  })

  it('the pool keeps every real flare of M5 or bigger, and the note says how many storms have an unknown size', () => {
    expect(no.length + yes.length).toBe(flareStats.total.n)
    expect(yes.length).toBe(flareStats.total.followed)
    expect(flareSet.note).toContain('for the other 90')
    expect(flareSet.note).toContain('small storm')
  })

  it('every flare carries real clues: size, gas cloud (a linked CME) and Sun side, with its DONKI source location', () => {
    for (const f of flares) {
      expect(typeof f.cloud).toBe('boolean')
      expect(['east', 'west']).toContain(f.side)
      expect(f.location).toMatch(/^[NS]\d+[EW]\d+$/)
      expect(f.side).toBe(f.location!.includes('W') ? 'west' : 'east')
    }
    for (const f of yes.filter((x) => x.sizeKnown)) expect(f.cloud).toBe(true) // all 8 real storms came with a real gas cloud
    expect(yes.some((f) => !f.cloud)).toBe(true) // but some real flares with no cloud also brought rays: clues help, they do not decide
  })

  it('the clue statistics match an independent count of the DONKI archive', () => {
    const c = Object.fromEntries(flareStats.clues.map((x) => [x.id, x]))
    const counts = (id: string) => [c[id]!.followed, c[id]!.n]
    expect(counts('cloud-yes')).toEqual([78, 263])
    expect(counts('cloud-no')).toEqual([20, 161])
    expect(counts('side-west')).toEqual([65, 229])
    expect(counts('side-east')).toEqual([33, 195])
    expect(counts('cloud-west')).toEqual([53, 152])
    expect(counts('nocloud-east')).toEqual([8, 84])
    for (const x of flareStats.clues) expect(x.percent).toBe(Math.round((100 * x.followed) / x.n))
  })

  it('the clues really do help in NASA\'s records, but never decide it', () => {
    const c = Object.fromEntries(flareStats.clues.map((x) => [x.id, x.percent]))
    expect(c['cloud-yes']!).toBeGreaterThan(c['cloud-no']!)
    expect(c['side-west']!).toBeGreaterThan(c['side-east']!)
    expect(c['cloud-west']!).toBeGreaterThan(c['nocloud-east']!)
    for (const x of flareStats.clues) {
      expect(x.percent).toBeLessThan(50) // even the best clue combination is far from certain
      expect(x.percent).toBeGreaterThan(0)
    }
  })

  it('there are real big flares with no gas cloud and no space rays, for the "big flash is not always danger" lesson', () => {
    expect(no.filter((f) => !f.cloud && f.class.startsWith('X')).length).toBeGreaterThanOrEqual(20)
  })
})
