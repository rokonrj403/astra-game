import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Cloud, CloudOff, Compass, Database, Footprints, Globe, Minus, Moon, Plus, Radiation, Radio, Shield, Sprout, Sun, Wind, Zap, type LucideIcon } from 'lucide-react'
import { BLOCKS, POWER_PER_BLOCK, RADIO_SCIENCE, SHIELD_EXTRA_POWER, SHIELD_LEAK, SHIELD_MAX, WALKS } from '../engine/constants'
import { FLARE_TOTAL } from '../engine/flares'
import { activeWatch, activeStorm, currentCard, radioAvailable, step, type ActiveWatch } from '../engine/game'
import { makeRng } from '../engine/rng'
import type { Choice, GameState, Jobs, Meters, Mode, Walk } from '../engine/types'
import type { SunView } from '../live/sun'
import { BaseScene, CrewFace, CrewStrip, OrbiFace } from './art'
import { crewMoods, HIGH_RADIATION, LOW, sceneState } from './look'
import { sfx } from './sfx'
import { Speak } from './speech'
import { SunChip, when } from './sunscreens'

export const METERS: { key: keyof Meters; label: string; Icon: LucideIcon; color: string }[] = [
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
        const k = key
        const v = game[k]
        const on = Math.round(v / 10)
        const delta = forecast ? Math.round(forecast[k] - v) : 0
        const bad = k === 'radiation' ? delta > 0 : delta < 0
        const words = delta === 0 ? 'Forecast stays the same' : `Forecast ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}`
        // A bar in the danger zone glows and pulses once; a screen reader hears "low" or "high" too, so it is not colour alone.
        const danger = k === 'radiation' ? v >= HIGH_RADIATION : v < LOW[k]
        return (
          <div key={key} className={`meter${danger ? ' danger' : ''}`}>
            <Icon size={22} color={color} className="icon" aria-hidden="true" />
            <span className="label">{label}</span>
            <div
              className="segments"
              role="meter"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(v)}
              aria-valuetext={danger ? `${Math.round(v)}, ${k === 'radiation' ? 'high' : 'low'}` : undefined}
              style={{ ['--c' as string]: color }}
            >
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

/** What the bars would do tomorrow with these jobs. Storms are always hidden: the forecast never says what the Sun will do. */
function forecastFor(g: GameState, jobs: Jobs, walk: Walk): Meters | null {
  const hidden: GameState = { ...g, storms: g.storms.map((p) => ({ ...p, arrivalDay: 9999 })) }
  try {
    const n = step(hidden, { jobs, go: false, walk }, makeRng(1))
    return { air: n.air, power: n.power, radiation: n.radiation, food: n.food }
  } catch {
    return null
  }
}

const JOB_ROWS: { key: keyof Jobs; label: string; hint: string; Icon: LucideIcon; color: string }[] = [
  { key: 'air', label: 'Air', hint: 'Fresh air', Icon: Wind, color: 'var(--air)' },
  { key: 'shield', label: 'Shield', hint: 'Charges the dome', Icon: Shield, color: 'var(--power)' },
  { key: 'plants', label: 'Plants', hint: 'Food, air, science', Icon: Sprout, color: 'var(--plants)' },
  { key: 'radio', label: 'Radio', hint: 'Send data to Earth', Icon: Radio, color: 'var(--radio)' },
]

/** A real flare from NASA's list, with the clues a child can read: size, gas cloud, and (in Commander) which side of the Sun. */
export function FlareWatch({ w, mode }: { w: ActiveWatch; mode: Mode }) {
  const r = w.record
  const text = `Flare watch, day ${w.daysSince} of 3. A real ${r.class} flare on ${when(r.peakTime)}. ${r.cloud ? 'It sent out a gas cloud.' : 'No gas cloud was seen.'} Space rays may come in the next days, or not at all.`
  return (
    <section className="watch" aria-label="Flare watch" role="alert">
      <div className="row between">
        <span className="row">
          <Radiation size={24} color="var(--radiation)" className="icon" aria-hidden="true" />
          <b>Flare watch: day {w.daysSince} of 3</b>
        </span>
        <Speak text={text} />
      </div>
      <p>
        A real flare from NASA’s list: <b>{r.class}</b> on {when(r.peakTime)}.
      </p>
      <div className="chips">
        <span className="chip">
          <Zap size={16} aria-hidden="true" />
          Size {r.class}
        </span>
        <span className="chip">
          {r.cloud ? <Cloud size={16} aria-hidden="true" /> : <CloudOff size={16} aria-hidden="true" />}
          {r.cloud ? 'Gas cloud: yes' : 'Gas cloud: no'}
        </span>
        {mode === 'commander' && (
          <span className="chip">
            <Compass size={16} aria-hidden="true" />
            {r.side === 'west' ? 'West side' : 'East side'}
          </span>
        )}
      </div>
      <p className="muted">
        Space rays may come in 1 to 3 days, or not at all. Over the years, {FLARE_TOTAL.followed} of {FLARE_TOTAL.n} big flares were followed by space rays. <a href={r.link} target="_blank" rel="noreferrer">NASA record</a>
      </p>
    </section>
  )
}

export function Base({ game, sun, onShare, onData, onSun }: { game: GameState; sun: SunView | null; onShare: (c: Choice) => void; onData: () => void; onSun: () => void }) {
  const [jobs, setJobs] = useState<Jobs>({ air: 0, shield: 0, plants: 0, radio: 0 })
  const [walk, setWalk] = useState<Walk>('none')
  const [go, setGo] = useState(false)
  const card = currentCard(game)
  const watch = activeWatch(game)
  const storm = activeStorm(game)
  const earth = radioAvailable(game)
  const sunny = game.sunDays[game.day - 1] === true
  const jobBlocks = jobs.air + jobs.shield + jobs.plants + jobs.radio
  const left = BLOCKS - jobBlocks - WALKS[walk].blocks
  const forecast = forecastFor(game, jobs, walk)
  const charge = Math.min(SHIELD_MAX, game.shield + jobs.shield)
  const tip = `You have ${BLOCKS} blocks each day. Tap + to give them to a job. Power is short, so every block counts. Read each flare, then choose. In real life most flares bring no rays. We picked tricky ones for your training.`
  const watchKey = watch ? `${watch.index}:${watch.daysSince}` : storm ? `storm:${storm.index}` : ''
  useEffect(() => {
    if (watchKey) sfx.chime()
  }, [watchKey])

  const bump = (k: keyof Jobs, by: number) => setJobs((j) => ({ ...j, [k]: Math.max(0, j[k] + by) }))
  const walkOptions: { key: Walk; label: string; hint: string }[] = [
    { key: 'none', label: 'Stay home', hint: 'Safe' },
    { key: 'short', label: 'Short walk', hint: `${WALKS.short.blocks} block, +${WALKS.short.science} science` },
    { key: 'long', label: 'Long walk', hint: `${WALKS.long.blocks} blocks, +${WALKS.long.science} science` },
  ]
  const goalPct = Math.min(100, Math.round((100 * game.science) / game.goal))

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

      <section className="goal" aria-label="Science goal">
        <div className="row between">
          <b>Science: {game.science} of {game.goal}</b>
          <span className="muted">Reach it by Day {game.totalDays}</span>
        </div>
        <div className="goalbar" role="meter" aria-label="Science goal" aria-valuemin={0} aria-valuemax={game.goal} aria-valuenow={Math.min(game.science, game.goal)}>
          <i style={{ width: `${goalPct}%` }} />
        </div>
      </section>

      {storm && (
        <div className="alert" role="alert">
          <Radiation size={26} color="var(--radiation)" className="icon" aria-hidden="true" />
          <span>The storm is still here. Keep the shield charged and stay home.</span>
        </div>
      )}
      {watch && !storm && <FlareWatch w={watch} mode={game.mode} />}

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
        <p className="muted">
          Each block uses {POWER_PER_BLOCK} power. The Shield uses {SHIELD_EXTRA_POWER} more.
        </p>
        <div className="jobs">
          {JOB_ROWS.map(({ key, label, hint, Icon, color }) => {
            const blocked = key === 'radio' && !earth
            const text = blocked ? 'Earth is hidden' : key === 'shield' ? `Charge ${charge} of ${SHIELD_MAX}. Leaks ${SHIELD_LEAK} a day.` : key === 'radio' ? `${hint}: +${RADIO_SCIENCE} science` : game.hasFood || key !== 'plants' ? hint : 'Air and science'
            return (
              <div className="job" key={key}>
                <Icon size={24} color={color} className="icon" aria-hidden="true" />
                <span className="what">
                  <b>{label}</b>
                  <small>{text}</small>
                </span>
                <span className="counter">
                  <button aria-label={`Fewer blocks for ${label}`} disabled={jobs[key] === 0} onClick={() => bump(key, -1)}>
                    <Minus size={22} aria-hidden="true" />
                  </button>
                  <output key={jobs[key]} className="pop" aria-label={`${label} blocks`}>
                    {jobs[key]}
                  </output>
                  <button aria-label={`More blocks for ${label}`} disabled={blocked || left === 0} onClick={() => bump(key, 1)}>
                    <Plus size={22} aria-hidden="true" />
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="stack" aria-label="Moonwalk">
        <div className="row between">
          <h3>
            <Footprints size={20} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Moonwalk
          </h3>
        </div>
        <p className="muted">A walk brings science. The shield does not protect walkers. A storm calls them home.</p>
        <div className="walks">
          {walkOptions.map((o) => {
            const need = WALKS[o.key].blocks
            const cannot = o.key !== walk && jobBlocks + need > BLOCKS
            return (
              <button key={o.key} aria-pressed={walk === o.key} disabled={cannot} onClick={() => setWalk(o.key)}>
                {o.label}
                <small>{o.hint}</small>
              </button>
            )
          })}
        </div>
      </section>

      {card && (
        <section className="card stack" aria-label="Choice card">
          <div className="row">
            {card.who.map((w) => (
              <CrewFace key={w} id={w} mood="surprised" size={40} />
            ))}
            <h3>{card.question}</h3>
          </div>
          <div className="toggle">
            <button aria-pressed={go} onClick={() => setGo(true)}>
              {card.a.label}
            </button>
            <button aria-pressed={!go} onClick={() => setGo(false)}>
              {card.b.label}
            </button>
          </div>
        </section>
      )}

      <div className="sticky-cta">
        <button className="primary" onClick={() => onShare({ jobs, go: card !== null && go, walk })}>
          Next day
        </button>
      </div>
    </main>
  )
}
