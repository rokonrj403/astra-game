import { useState } from 'react'
import { ArrowDown, ArrowUp, Database, Globe, Minus, Moon, Plus, Radiation, Radio, Shield, Sprout, Sun, Wind, Zap, type LucideIcon } from 'lucide-react'
import { BLOCKS, POWER_PER_BLOCK } from '../engine/constants'
import { activeWarning, currentCard, radioAvailable, step } from '../engine/game'
import { makeRng } from '../engine/rng'
import type { Choice, GameState, Jobs, Loss, Meters } from '../engine/types'
import type { SunView } from '../live/sun'
import { BaseScene, CrewStrip, OrbiFace } from './art'
import { crewMoods, sceneState } from './look'
import { Speak } from './speech'
import { SunChip } from './sunscreens'

export const METERS: { key: Loss; label: string; Icon: LucideIcon; color: string }[] = [
  { key: 'air', label: 'Air', Icon: Wind, color: 'var(--air)' },
  { key: 'power', label: 'Power', Icon: Zap, color: 'var(--power)' },
  { key: 'radiation', label: 'Radiation', Icon: Radiation, color: 'var(--radiation)' },
  { key: 'food', label: 'Food', Icon: Sprout, color: 'var(--plants)' },
]

/** One line per bar: picture, word, ten blocks, the number, and the forecast arrow for tomorrow. */
function Bars({ game, forecast }: { game: GameState; forecast: Meters | null }) {
  return (
    <section className="meters" aria-label="Base bars">
      {METERS.filter((m) => m.key !== 'food' || game.hasFood).map(({ key, label, Icon, color }) => {
        const v = game[key]
        const on = Math.round(v / 10)
        const delta = forecast ? Math.round(forecast[key] - v) : 0
        const bad = key === 'radiation' ? delta > 0 : delta < 0
        const words = delta === 0 ? 'Forecast stays the same' : `Forecast ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}`
        return (
          <div key={key} className="meter">
            <Icon size={22} color={color} className="icon" aria-hidden="true" />
            <span className="label">{label}</span>
            <div className="segments" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} style={{ ['--c' as string]: color }}>
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} className={i < on ? 'on' : undefined} />
              ))}
            </div>
            <span className="value">{Math.round(v)}</span>
            {forecast && (
              <span className={`delta${bad ? ' bad' : ''}`} aria-label={words} title={words}>
                {delta === 0 ? <Minus size={14} aria-hidden="true" /> : delta > 0 ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />}
                {delta === 0 ? 'same' : Math.abs(delta)}
              </span>
            )}
          </div>
        )
      })}
      <p className="muted">Arrows: tomorrow, with these blocks.</p>
    </section>
  )
}

/** What the bars would do tomorrow with these jobs. Storms nobody has warned about stay hidden. */
function forecastFor(g: GameState, jobs: Jobs): Meters | null {
  const hidden: GameState = { ...g, storms: g.storms.map((p, i) => (g.warned[i] ? p : { ...p, arrivalDay: 9999 })) }
  try {
    const n = step(hidden, { jobs, go: false }, makeRng(1))
    return { air: n.air, power: n.power, radiation: n.radiation, food: n.food }
  } catch {
    return null
  }
}

const JOB_ROWS: { key: keyof Jobs; label: string; hint: string; Icon: LucideIcon; color: string }[] = [
  { key: 'air', label: 'Air', hint: 'Fresh air', Icon: Wind, color: 'var(--air)' },
  { key: 'shield', label: 'Shield', hint: 'Blocks space rays', Icon: Shield, color: 'var(--power)' },
  { key: 'plants', label: 'Plants', hint: 'Food and air', Icon: Sprout, color: 'var(--plants)' },
  { key: 'radio', label: 'Radio', hint: 'Calls Earth', Icon: Radio, color: 'var(--radio)' },
]

export function warningText(daysUntil: number): string {
  if (daysUntil < 0) return 'The storm is still here. Keep the shield up.'
  if (daysUntil === 0) return 'Storm today! Put blocks on the Shield.'
  if (daysUntil === 1) return 'A storm comes tomorrow. Get the Shield ready.'
  return `A storm comes in ${daysUntil} days.`
}

export function Base({ game, sun, onShare, onData, onSun }: { game: GameState; sun: SunView | null; onShare: (c: Choice) => void; onData: () => void; onSun: () => void }) {
  const [jobs, setJobs] = useState<Jobs>({ air: 0, shield: 0, plants: 0, radio: 0 })
  const [go, setGo] = useState(false)
  const card = currentCard(game)
  const warn = activeWarning(game)
  const earth = radioAvailable(game)
  const sunny = game.sunDays[game.day - 1] === true
  const used = jobs.air + jobs.shield + jobs.plants + jobs.radio
  const left = BLOCKS - used
  const rows = JOB_ROWS.filter((r) => r.key !== 'plants' || game.hasFood)
  const forecast = forecastFor(game, jobs)
  const tip = `You have ${BLOCKS} blocks each day. Tap + to give them to a job. Check the arrows first.`

  const bump = (k: keyof Jobs, by: number) => setJobs((j) => ({ ...j, [k]: Math.max(0, j[k] + by) }))

  return (
    <main className="app base">
      <div className="top">
        <span className="day">
          Day {game.day} of {game.totalDays}
        </span>
        <span className="row" style={{ gap: 4 }}>
          <SunChip sun={sun} onTap={onSun} />
          <button className="iconbtn" onClick={onData} aria-label="Data" title="Where the data comes from">
            <Database size={20} aria-hidden="true" />
          </button>
        </span>
      </div>

      <BaseScene s={sceneState(game, jobs.shield)} />

      <div className="chips">
        <span className="chip">
          {sunny ? <Sun size={18} color="var(--sun)" aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          {sunny ? 'Sunny day' : 'Dark day'}
        </span>
        <span className="chip">
          <Globe size={18} color={earth ? 'var(--radio)' : undefined} aria-hidden="true" />
          {earth ? 'Earth in view' : 'Earth hidden'}
        </span>
      </div>

      <CrewStrip moods={crewMoods(game)} />

      {warn && (
        <div className="alert" role="alert">
          <Radiation size={26} color="var(--radiation)" className="icon" aria-hidden="true" />
          <span>{warningText(warn.daysUntil)}</span>
          <Speak text={warningText(warn.daysUntil)} />
        </div>
      )}

      {game.day === 1 && (
        <div className="orbi">
          <OrbiFace look="curious" size={48} />
          <p>
            <b>ORBI:</b> {tip}
          </p>
          <Speak text={`ORBI says: ${tip}`} />
        </div>
      )}

      <Bars game={game} forecast={forecast} />

      <section className="stack" aria-label="Share power">
        <div className="row between">
          <h3>Share power</h3>
          <span className="pips" aria-label={`${left} blocks left`}>
            {Array.from({ length: BLOCKS }, (_, i) => (
              <i key={i} className={i < left ? 'on' : undefined} />
            ))}
            <span className="muted">{left} left</span>
          </span>
        </div>
        <p className="muted">Each block uses {POWER_PER_BLOCK} power.</p>
        <div className="jobs">
          {rows.map(({ key, label, hint, Icon, color }) => {
            const blocked = key === 'radio' && !earth
            return (
              <div className="job" key={key}>
                <Icon size={24} color={color} className="icon" aria-hidden="true" />
                <span className="what">
                  <b>{label}</b>
                  <small>{blocked ? 'Earth is hidden' : hint}</small>
                </span>
                <span className="counter">
                  <button aria-label={`Fewer blocks for ${label}`} disabled={jobs[key] === 0} onClick={() => bump(key, -1)}>
                    <Minus size={22} aria-hidden="true" />
                  </button>
                  <output aria-label={`${label} blocks`}>{jobs[key]}</output>
                  <button aria-label={`More blocks for ${label}`} disabled={blocked || left === 0} onClick={() => bump(key, 1)}>
                    <Plus size={22} aria-hidden="true" />
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {card && (
        <section className="card stack" aria-label="Choice card">
          <h3>{card.question}</h3>
          <div className="toggle">
            <button aria-pressed={go} onClick={() => setGo(true)}>
              Go
              <small>{card.go.replace(/^Go: /, '')}</small>
            </button>
            <button aria-pressed={!go} onClick={() => setGo(false)}>
              Stay
              <small>{card.stay.replace(/^Stay: /, '')}</small>
            </button>
          </div>
        </section>
      )}

      <div className="sticky-cta">
        <button className="primary" onClick={() => onShare({ jobs, go: card !== null && go })}>
          Next day
        </button>
      </div>
    </main>
  )
}
