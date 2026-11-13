import { Radio, Shield, Sprout, Wind, Zap, type LucideIcon } from 'lucide-react'
import type { CrewId } from './model'

/**
 * One picture for each job, used wherever a job is shown (a crew member's bubble, a building, the caption), so a child learns one picture per idea.
 * Air, Power and Shield use the same icons as the Base bars and the power tray; Plants is the sprout, Radio the radio waves.
 */
export type JobId = 'air' | 'power' | 'plants' | 'radio' | 'shield'

export const JOB_ICON: Record<JobId, LucideIcon> = { air: Wind, power: Zap, plants: Sprout, radio: Radio, shield: Shield }
export const JOB_COLOR: Record<JobId, string> = {
  air: 'var(--air, #56B4E9)',
  power: 'var(--power, #F0E442)',
  plants: 'var(--plants, #009E73)',
  radio: 'var(--sun, #E69F00)',
  shield: 'var(--power, #F0E442)',
}

/** Who looks after what (the same pairs as CREW in ui/look.ts, which a test checks). */
export const CREW_JOB: Record<CrewId, JobId> = { safia: 'plants', kofi: 'power', leo: 'air', mei: 'radio' }
