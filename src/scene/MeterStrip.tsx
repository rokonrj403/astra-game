import { AlertTriangle, Apple, Radiation, Sparkles, Wind, Zap, type LucideIcon } from 'lucide-react'
import { HIGH_RADIATION, LOW } from '../ui/look'

export interface MeterValues {
  air: number
  power: number
  radiation: number
  food: number
}

const ROWS: { key: keyof MeterValues; Icon: LucideIcon; color: string; label: string }[] = [
  { key: 'air', Icon: Wind, color: 'var(--air, #56B4E9)', label: 'Air' },
  { key: 'power', Icon: Zap, color: 'var(--power, #F0E442)', label: 'Power' },
  { key: 'radiation', Icon: Radiation, color: 'var(--radiation, #D55E00)', label: 'Radiation' },
  { key: 'food', Icon: Apple, color: 'var(--plants, #009E73)', label: 'Food' },
]

/**
 * The four bars as pictures: an icon and ten small segments, no numbers and no words.
 * A bar in the danger zone also gets a warning triangle, so danger is a shape and not only a colour.
 * Segments switch on and off with a short stagger, so a day change "ticks".
 */
export function MeterStrip({ values, hasFood = true, science }: { values: MeterValues; hasFood?: boolean; science?: { value: number; goal: number } }) {
  return (
    <div className="sc-meters" role="group" aria-label="Base bars">
      {ROWS.filter((r) => r.key !== 'food' || hasFood).map(({ key, Icon, color, label }) => {
        const v = values[key]
        const on = Math.round(v / 10)
        const danger = key === 'radiation' ? v >= HIGH_RADIATION : v < LOW[key]
        return (
          <div key={key} className={`sc-meter${danger ? ' danger' : ''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-valuetext={danger ? (key === 'radiation' ? 'high' : 'low') : undefined}>
            <Icon size={20} color={color} aria-hidden="true" />
            <span className="sc-segs" style={{ ['--c' as string]: color }}>
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} className={i < on ? 'on' : undefined} style={{ transitionDelay: `${i * 22}ms` }} />
              ))}
            </span>
            <AlertTriangle size={16} aria-hidden="true" className="sc-warn" />
          </div>
        )
      })}
      {science && (
        <div className="sc-meter sc-science" role="meter" aria-label="Science goal" aria-valuemin={0} aria-valuemax={science.goal} aria-valuenow={science.value} aria-valuetext={`${science.value} of ${science.goal}`}>
          <Sparkles size={20} color="var(--sun, #E69F00)" aria-hidden="true" />
          <span className="sc-segs" style={{ ['--c' as string]: 'var(--sun, #E69F00)' }}>
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className={i < Math.floor((10 * science.value) / science.goal) ? 'on' : undefined} />
            ))}
          </span>
        </div>
      )}
    </div>
  )
}
