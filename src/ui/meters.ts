import { Radiation, Sprout, Wind, Zap, type LucideIcon } from 'lucide-react'
import type { Meters } from '../engine/types'

/** The four bars: key, name for screen readers, icon and colour. */
export const METERS: { key: keyof Meters; label: string; Icon: LucideIcon; color: string }[] = [
  { key: 'air', label: 'Air', Icon: Wind, color: 'var(--air)' },
  { key: 'power', label: 'Power', Icon: Zap, color: 'var(--power)' },
  { key: 'radiation', label: 'Radiation', Icon: Radiation, color: 'var(--radiation)' },
  { key: 'food', label: 'Food', Icon: Sprout, color: 'var(--plants)' },
]
