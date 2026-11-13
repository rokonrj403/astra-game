import { flareById, type FlareRecord } from './flares'
import type { Guess } from './types'

/**
 * ORBI's old notes: 8 real past flares from NASA's list, picked by a fixed rule (the middle one of each kind) to show different
 * clues: four that brought rays and four that did not, across size, gas cloud and Sun side. They are NOT typical: in real life
 * most flares bring no rays. They are labelled real and past, and they never count in the child's own pattern.
 */
export const SEED_FLARE_IDS = ['flr-30601', 'flr-26048', 'flr-29708', 'flr-30553', 'flr-29334', 'flr-31158', 'flr-29824', 'flr-29833'] as const

export interface JournalEntry {
  flareId: string
  /** What really happened (NASA record). */
  followed: boolean
  /** What the child guessed, if they did. */
  guess: Guess | null
  /** true = one of ORBI's old notes, false = a flare the child really met. */
  seed: boolean
}

export function seededEntries(): JournalEntry[] {
  return SEED_FLARE_IDS.map((id) => ({ flareId: id, followed: flareById(id)?.followed === true, guess: null, seed: true }))
}

/** Adds what the child just learned, keeping one entry per flare (the newest wins). */
export function addPlayed(list: JournalEntry[], add: { flareId: string; followed: boolean; guess: Guess | null }[]): JournalEntry[] {
  const out = list.filter((e) => !add.some((a) => a.flareId === e.flareId))
  for (const a of add) out.push({ flareId: a.flareId, followed: a.followed, guess: a.guess, seed: false })
  return out
}

export type ClueKey = 'cloud-yes' | 'cloud-no' | 'side-east' | 'side-west' | 'size-big' | 'size-medium'
export const CLUE_KEYS: ClueKey[] = ['cloud-yes', 'cloud-no', 'side-west', 'side-east', 'size-big', 'size-medium']

export function hasClue(f: Pick<FlareRecord, 'cloud' | 'side' | 'class'>, k: ClueKey): boolean {
  switch (k) {
    case 'cloud-yes':
      return f.cloud
    case 'cloud-no':
      return !f.cloud
    case 'side-east':
      return f.side === 'east'
    case 'side-west':
      return f.side === 'west'
    case 'size-big':
      return f.class.startsWith('X')
    case 'size-medium':
      return f.class.startsWith('M')
  }
}

export interface Pattern {
  clue: ClueKey
  /** Of the flares with this clue that the child met, how many brought rays. */
  rays: number
  n: number
}

/**
 * The pattern banner, built ONLY from flares the child really met (never ORBI's old notes): the clue whose flares stand out most
 * from the child's overall result, with at least 3 flares. It says "often", never "always", and it can be null.
 */
export function patternBanner(entries: JournalEntry[]): Pattern | null {
  const mine = entries.filter((e) => !e.seed)
  if (mine.length < 3) return null
  const overall = mine.filter((e) => e.followed).length / mine.length
  let best: (Pattern & { score: number }) | null = null
  for (const clue of CLUE_KEYS) {
    const group = mine.filter((e) => {
      const f = flareById(e.flareId)
      return f ? hasClue(f, clue) : false
    })
    if (group.length < 3) continue
    const rays = group.filter((e) => e.followed).length
    const gap = Math.abs(rays / group.length - overall)
    const score = gap * Math.sqrt(group.length)
    if (gap >= 0.2 && (!best || score > best.score)) best = { clue, rays, n: group.length, score }
  }
  return best ? { clue: best.clue, rays: best.rays, n: best.n } : null
}
