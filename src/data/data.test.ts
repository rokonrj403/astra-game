import { describe, expect, it } from 'vitest'
import consumables from './consumables.json'
import sites from './sites.json'
import storms from './storms.json'
import science from './science.json'
import sources from './sources.json'
import snapshot from './snapshot.json'

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
