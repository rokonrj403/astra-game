import storms from '../data/storms.json'
import { BLOCKS } from './constants'
import type { DayRecord, GameState, Loss, Why, WhyStep } from './types'

const TIPS: Record<Loss, string> = {
  radiation: 'The shield is what blocks space rays. When a storm is near, give it 3 or 4 blocks, and use the radio to hear about storms early.',
  air: 'The crew breathes every day. Keep at least 2 blocks on Air, even on busy days.',
  power: 'Every block costs power, and dark days give very little. On dark days, use fewer blocks and keep the battery up.',
  food: 'Plants make the food. Give the plants 1 or 2 blocks every day so the food bar never runs out.',
}

const METER_WORD: Record<Loss, string> = { radiation: 'Radiation', air: 'Air', power: 'Power', food: 'Food' }

const plural = (n: number) => `${n} block${n === 1 ? '' : 's'}`

function change(r: DayRecord, m: Loss): string {
  const a = Math.round(r.before[m])
  const b = Math.round(r.after[m])
  return `${METER_WORD[m]} went from ${a} to ${b}.`
}

function dayLine(r: DayRecord, m: Loss): string {
  const j = r.jobs
  if (m === 'air') return `Day ${r.day}: ${plural(j.air)} of ${BLOCKS} went to Air. ${change(r, m)}`
  if (m === 'food') return `Day ${r.day}: ${plural(j.plants)} of ${BLOCKS} went to Plants. ${change(r, m)}`
  const used = j.air + j.shield + j.plants + j.radio
  const sun = r.sunny ? 'It was a sunny day.' : 'It was a dark day, so the panels gave little power.'
  return `Day ${r.day}: ${sun} The crew used ${plural(used)}. ${change(r, m)}`
}

export function explain(state: GameState): Why {
  const loss = state.loss
  if (state.status !== 'lost' || !loss) throw new Error('Nothing to explain: the mission was not lost')
  const last = state.history[state.history.length - 1]
  if (!last) throw new Error('No days played')

  if (loss === 'radiation' && last.storm) {
    const plan = state.storms[last.storm.index]
    const data = storms.find((s) => s.id === plan?.stormId)
    const flare = data ? `It began with a ${data.flare.value} flare on the Sun (${data.title}, ${data.dates}).` : 'It began with a flare on the Sun.'
    const warning = last.storm.warned ? 'The radio had warned you, but too few blocks were on the shield.' : 'The radio had not heard a warning, so the shield was not ready.'
    const steps: WhyStep[] = [
      { day: plan?.arrivalDay ?? last.day, text: `Day ${plan?.arrivalDay ?? last.day}: A real storm from NASA's records reached the base. ${flare}` },
      { day: last.day, text: `Day ${last.day}: The shield had ${last.storm.shield} of ${BLOCKS} blocks, so ${Math.round(last.storm.letsThrough * 100)} out of every 100 space rays came in. ${warning}` },
      { day: last.day, text: `Day ${last.day}: Radiation went from ${Math.round(last.before.radiation)} to full, so a rescue ship takes the crew home.` },
    ]
    const rec = data?.records.find((r) => /radiation storm/i.test(r.label)) ?? data?.records[0] ?? null
    return { loss, steps, tip: TIPS[loss], record: rec ? { label: rec.label, url: rec.url } : null }
  }

  const recent = state.history.slice(-2)
  const steps: WhyStep[] = recent.map((r) => ({ day: r.day, text: dayLine(r, loss) }))
  if (steps.length < 2) steps.unshift({ day: last.day, text: `Every day the crew uses up ${METER_WORD[loss].toLowerCase()}, so it has to be topped up.` })
  steps.push({ day: last.day, text: `${METER_WORD[loss]} ran out, so a rescue ship takes the crew home. Nobody is hurt.` })
  return { loss, steps, tip: TIPS[loss], record: null }
}
