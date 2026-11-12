export type Mode = 'cadet' | 'commander'
export type Job = 'air' | 'shield' | 'plants' | 'radio'
export type Jobs = Record<Job, number>
export type StormSize = 'small' | 'big' | 'huge'
export type Loss = 'air' | 'power' | 'radiation' | 'food'
export type BadgeId = 'first-day' | 'storm-survivor' | 'green-thumb' | 'radio-hero' | 'night-owl'

export interface Choice {
  jobs: Jobs
  go: boolean
}

export interface StormPlan {
  stormId: string
  arrivalDay: number
  size: StormSize
  profile: number[]
}

export interface Meters {
  air: number
  power: number
  radiation: number
  food: number
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
    shield: number
    letsThrough: number
    incoming: number
    warned: boolean
  } | null
  cardId: string | null
  went: boolean
  before: Meters
  after: Meters
  flavour: number
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
  sunDays: boolean[]
  earthDays: boolean[]
  storms: StormPlan[]
  warned: boolean[]
  history: DayRecord[]
}

export interface Card {
  id: string
  question: string
  go: string
  stay: string
  science: number
  power: number
  air: number
  radiation: number
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
