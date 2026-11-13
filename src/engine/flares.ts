import flareData from '../data/flares.json'
import flareStats from '../data/flareStats.json'

export type FlareRecord = (typeof flareData.flares)[number]
export type FlareBucketId = 'm5' | 'x1' | 'x5'

/** Real flares that were NOT followed by space rays, and the real flare for each of our 8 storms. */
export const FLARES_NOT_FOLLOWED: FlareRecord[] = flareData.flares.filter((f) => !f.followed)
/** Real flares NASA followed with a radiation storm. 8 are our real storms with a known size; for the rest the size is not in our data. */
export const FLARES_FOLLOWED: FlareRecord[] = flareData.flares.filter((f) => f.followed)
const byId = new Map<string, FlareRecord>(flareData.flares.map((f) => [f.id, f]))
const byStorm = new Map<string, FlareRecord>(flareData.flares.filter((f) => f.followed && f.stormId).map((f) => [f.stormId as string, f]))

export function flareById(id: string): FlareRecord | undefined {
  return byId.get(id)
}
export function flareForStorm(stormId: string): FlareRecord | undefined {
  return byStorm.get(stormId)
}

const LETTER: Record<string, number> = { M: 1e-5, X: 1e-4 }
/** Flare class as a number (X1 = 1e-4), so M9.9 < X1. */
export function classValue(c: string): number {
  return (LETTER[c[0] ?? ''] ?? 0) * Number(c.slice(1))
}

export function flareBucket(cls: string): FlareBucketId {
  const v = classValue(cls)
  return v >= 5e-4 ? 'x5' : v >= 1e-4 ? 'x1' : 'm5'
}

export interface FlareOdds {
  bucket: FlareBucketId
  label: string
  /** Flares this big in NASA's list. */
  n: number
  /** How many of them were followed by space rays within 72 hours. */
  followed: number
  percent: number
}

/** The real chance, from the DONKI archive, that a flare this big was followed by space rays. */
export function flareOdds(cls: string): FlareOdds {
  const bucket = flareBucket(cls)
  const b = flareStats.buckets.find((x) => x.id === bucket)!
  return { bucket, label: b.label, n: b.n, followed: b.followed, percent: b.percent }
}

export interface FlareClues {
  bucket: FlareBucketId
  cloud: boolean
  side: 'east' | 'west'
}

export function flareClues(f: Pick<FlareRecord, 'class' | 'cloud' | 'side'>): FlareClues {
  return { bucket: flareBucket(f.class), cloud: f.cloud, side: f.side === 'west' ? 'west' : 'east' }
}

const clueRate = (id: string): number => (flareStats.clues.find((c) => c.id === id)?.percent ?? flareStats.total.percent) / 100

/**
 * A reasonable chance (0 to 1) that a flare is followed by space rays, read from its clues using only the real counts in NASA's list:
 * the rate for its cloud-and-side group, scaled by how much more or less likely its size is than the average flare.
 * It is a guide, never a promise: the best groups are still well under 50%.
 */
export function riskFromClues(c: FlareClues): number {
  const group = clueRate(`${c.cloud ? 'cloud' : 'nocloud'}-${c.side}`)
  const size = (flareStats.buckets.find((b) => b.id === c.bucket)?.percent ?? flareStats.total.percent) / flareStats.total.percent
  return Math.min(0.95, Math.max(0.02, group * size))
}

export const FLARE_TOTAL = flareStats.total
export const FLARE_RULE = flareStats.rule
