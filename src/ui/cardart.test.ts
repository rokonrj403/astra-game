import { describe, expect, it } from 'vitest'
import { cards } from '../engine/cards'
import { CARD_ART } from './cardart'

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

describe('every crew card is drawn for a child who reads little', () => {
  it('has a picture and words for each of the 10 cards, and for both choices', () => {
    expect(cards).toHaveLength(10)
    for (const c of cards) expect(CARD_ART[c.id], `card ${c.id} has art`).toBeDefined()
  })
  it('keeps the situation to 3 words and each choice to 2 words, so a day stays inside the 12-word budget', () => {
    for (const c of cards) {
      const art = CARD_ART[c.id]!
      expect(words(art.q), `${c.id} question`).toBeLessThanOrEqual(3)
      expect(words(art.a.word), `${c.id} A`).toBeLessThanOrEqual(2)
      expect(words(art.b.word), `${c.id} B`).toBeLessThanOrEqual(2)
      expect(art.a.word).not.toBe(art.b.word)
    }
  })
})
