export type Mode = 'cadet' | 'commander'
export type Job = 'air' | 'shield' | 'plants' | 'radio'
export type Jobs = Record<Job, number>
export type StormSize = 'small' | 'big' | 'huge'
/** Why a mission ended badly. 'science' means the crew stayed safe but did not reach the science goal. */
export type Loss = 'air' | 'power' | 'radiation' | 'food' | 'science'
export type BadgeId = 'first-day' | 'storm-survivor' | 'green-thumb' | 'radio-hero' | 'night-owl'
export type CrewName = 'safia' | 'kofi' | 'leo' | 'mei'
/** A moonwalk is a bet: science if the day is calm, radiation if a storm hits while the crew is outside. The shield never protects walkers. */
export type Walk = 'none' | 'short' | 'long'
/** The child's guess for a flare: will space rays come? Asked before the answer is known; a wrong guess costs nothing. */
export type Guess = 'yes' | 'no' | 'unsure'

export interface Choice {
  jobs: Jobs
  /** true = take the first option of today's situation, false = the second. */
  go: boolean
  /** Moonwalk today. Costs blocks from the same 6. Default none. */
  walk?: Walk
  /** A guess for the newest flare watch that has no guess yet. Optional. */
  guess?: Guess
}

export interface StormPlan {
  stormId: string
  arrivalDay: number
  size: StormSize
  profile: number[]
}

/**
 * A real flare the Sun Watch shows. If `stormIndex` is a number, this real flare was followed by that real storm
 * (it arrives `arrivalDay - day` days later). If it is null, the real flare was NOT followed by space rays (NASA DONKI).
 */
export interface FlareEvent {
  flareId: string
  /**
   * The day the flare happens. It shows up in the next morning's Sun Watch.
   * In a training game the first flare has day 0: it happened the day before the mission, so it is in the Sun Watch on the morning of Day 1.
   */
  day: number
  stormIndex: number | null
}

export interface Meters {
  air: number
  power: number
  radiation: number
  food: number
}

/** Effects of yesterday's choices that land today. */
export interface Carry {
  power: number
  air: number
  science: number
}

export interface DayRecord {
  day: number
  jobs: Jobs
  sunny: boolean
  earthInView: boolean
  radioWorked: boolean
  storm: {
    index: number
    factor: number
    /** Shield charge that met the storm (0 to 6). */
    shield: number
    letsThrough: number
    incoming: number
    /** The player had seen the flare before this storm (Sun Watch), so it was not a complete surprise. */
    warned: boolean
  } | null
  cardId: string | null
  /** true = took the first option of the situation. */
  went: boolean
  walk: Walk
  /** Science the walk really brought home (0 if a storm called the crew back). */
  walkScience: number
  /** A storm hit while the crew was outside: the walk's science was lost. */
  calledHome: boolean
  /** A flare watch the player knew about was on today. */
  watching: boolean
  /** Flares that showed up in this morning's Sun Watch. */
  reported: string[]
  /** The flare the player guessed about today, if any. */
  guessed: string | null
  /** Flares whose watch ended today, with what really happened (shown with the NASA record), the guess, and the science a good guess earned. */
  resolved: { flareId: string; followed: boolean; guess: Guess | null; reward: number }[]
  /** Shield charge at the end of the day, after it leaked. */
  shieldAfter: number
  /** Science this day added (walk, plants, radio, a good guess, the card). */
  scienceGain: number
  before: Meters
  after: Meters
  flavour: number
  /** Training only: the meters that were held at the crew's worried line today (see TRAINING_FLOOR). Absent when none was, and in every normal game. */
  held?: (keyof Meters)[]
}

export interface GameState extends Meters {
  mode: Mode
  siteId: string
  seed: number
  totalDays: number
  hasFood: boolean
  day: number
  status: 'playing' | 'won' | 'lost'
  loss?: Loss
  science: number
  /** Science needed by the last day to complete the mission. */
  goal: number
  /** Shield charge: +1 per block, leaks 1 each day, 0 to 6. It carries over, so it can be built before a storm. */
  shield: number
  carry: Carry
  sunDays: boolean[]
  earthDays: boolean[]
  storms: StormPlan[]
  flares: FlareEvent[]
  /** Which flares have shown up in the Sun Watch. */
  flareSeen: boolean[]
  /** Which flares have already been explained ("this flare did / did not bring space rays"). */
  flareResolved: boolean[]
  /** The guess for each flare, or null. Private until the reveal. */
  guesses: (Guess | null)[]
  history: DayRecord[]
  /** true only in a training game (newGame option `training`): Days 1 and 2 are assisted. Absent in every normal game. */
  training?: boolean
}

export interface Option {
  /** The button text, 10 simple words or fewer. */
  label: string
  science: number
  power: number
  air: number
  radiation: number
  food: number
  /** Lands tomorrow. */
  carry?: Partial<Carry>
  /** Today's moonwalk brings 1 less science. */
  slowWalk?: boolean
  /** Today's plant experiments bring 1 less science. */
  slowPlants?: boolean
  /** Chance that tomorrow the air machine fails (air -15). */
  failChance?: number
}

/** One situation a day, two choices, each with a real cost. */
export interface Card {
  id: string
  question: string
  /** Who is involved: their faces show next to the question. */
  who: CrewName[]
  a: Option
  b: Option
  /** Only offered on days Earth is in view. */
  needsEarth?: boolean
}

export interface WhyStep {
  day: number
  text: string
}

export interface Why {
  loss: Loss
  steps: WhyStep[]
  tip: string
  record: { label: string; url: string } | null
}
