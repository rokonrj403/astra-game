import { describe, expect, it } from 'vitest'
import sites from '../data/sites.json'
import { SHORT, pinSpots } from './polemap'

describe('the South Pole map', () => {
  it('has a short name for every region, all different', () => {
    expect(sites.every((s) => SHORT[s.id])).toBe(true)
    expect(new Set(sites.map((s) => SHORT[s.id])).size).toBe(sites.length)
  })
  it('keeps the nine pins from sitting on top of each other, and inside the map', () => {
    const spots = pinSpots()
    const list = Object.values(spots)
    expect(list).toHaveLength(9)
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const apart = Math.abs(list[i]!.x - list[j]!.x) >= 88 || Math.abs(list[i]!.y - list[j]!.y) >= 62
        expect(apart, `pins ${i} and ${j} overlap`).toBe(true)
      }
    for (const p of list) {
      expect(p.x).toBeGreaterThanOrEqual(44)
      expect(p.x).toBeLessThanOrEqual(340 - 44)
    }
  })
})
