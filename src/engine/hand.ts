import { FLARES_FOLLOWED, FLARES_NOT_FOLLOWED, flareBucket, type FlareClues, type FlareRecord } from './flares'

/**
 * How a hand of flares is dealt. Every flare is real and keeps its real outcome; only the MIX is chosen, so that the clues
 * genuinely help inside a hand: flares that brought rays lean towards a gas cloud, the west side and a big size, and the
 * flares that did not are the tricky ones, leaning towards no cloud and the east side. ORBI tells the player this:
 * "In real life most flares bring no rays. We picked tricky ones for your training."
 */
export const raysWeight = (f: FlareRecord) => (f.cloud ? 3 : 1) * (f.side === 'west' ? 2 : 1) * (f.class.startsWith('X') ? 2 : 1)
export const quietWeight = (f: FlareRecord) => (f.cloud ? 1 : 3) * (f.side === 'west' ? 1 : 2) * (f.class.startsWith('X') ? 2 : 1)

type Pred = (f: FlareRecord) => boolean

function fraction(pool: FlareRecord[], weight: (f: FlareRecord) => number, pred: Pred): number {
  let all = 0
  let hit = 0
  for (const f of pool) {
    const w = weight(f)
    all += w
    if (pred(f)) hit += w
  }
  return all === 0 ? 0 : hit / all
}

// Half the storms in a hand are one of our known real storms (dealt evenly), half are other followed flares (dealt with raysWeight).
const knownRays = FLARES_FOLLOWED.filter((f) => f.sizeKnown && f.stormId !== 'storm-6')
const otherRays = FLARES_FOLLOWED.filter((f) => !f.sizeKnown)
const pRays = (pred: Pred) => 0.5 * fraction(knownRays, () => 1, pred) + 0.5 * fraction(otherRays, raysWeight, pred)
const pQuiet = (pred: Pred) => fraction(FLARES_NOT_FOLLOWED, quietWeight, pred)

/**
 * How likely a flare in a hand is to bring rays, for someone who has played a few hands and knows how they are dealt.
 * Starts from "about half bring rays" (prior 0.5) and multiplies the odds by how much more often each clue shows up on
 * rays flares than on quiet ones. No clue decides it alone: the result stays strictly between 0 and 1.
 */
export function riskInHand(c: FlareClues, prior = 0.5): number {
  const eps = 0.02
  const ratio = (pred: Pred) => (pRays(pred) + eps) / (pQuiet(pred) + eps)
  const odds =
    (prior / (1 - prior)) *
    ratio((f) => f.cloud === c.cloud) *
    ratio((f) => (f.side === 'west') === (c.side === 'west')) *
    ratio((f) => flareBucket(f.class) === c.bucket)
  return odds / (1 + odds)
}
