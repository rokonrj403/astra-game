import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Database,
  Globe,
  Minus,
  Moon,
  Plus,
  Radiation,
  Radio,
  Rocket,
  Shield,
  Sprout,
  Sun,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import sites from '../data/sites.json'
import storms from '../data/storms.json'
import { BLOCKS, MODES, MODE_CARDS, POWER_PER_BLOCK } from '../engine/constants'
import { activeWarning, badges, currentCard, explain, radioAvailable, radioDelay, score, step, stormsSurvived } from '../engine/game'
import { cards } from '../engine/cards'
import { makeRng } from '../engine/rng'
import type { BadgeId, Choice, GameState, Jobs, Loss, Meters, Mode } from '../engine/types'
import type { SunView } from '../live/sun'
import { SunChip } from './sunscreens'

const NASA_NOTE = 'ASTRA uses NASA data. It is not made or endorsed by NASA.'
const percent = (x: number) => Math.round(x * 100)

/* ---------- Start ---------- */

export function Start({ onPlay, onData, onSun, onCards }: { onPlay: () => void; onData: () => void; onSun: () => void; onCards: () => void }) {
  return (
    <main className="app">
      <div className="hero">
        <div className="sunrise" aria-hidden="true" />
        <h1>ASTRA</h1>
        <p className="tagline">Run a Moon base. Keep the crew safe from real solar storms.</p>
        <button className="primary" onClick={onPlay}>
          Play
        </button>
        <button className="link" onClick={onSun}>
          Today’s Sun
        </button>
        <button className="link" onClick={onCards}>
          My storm cards
        </button>
        <button className="link" onClick={onData}>
          Where the data comes from
        </button>
      </div>
      <p className="fineprint">
        {NASA_NOTE} Made with help from Claude AI. Voices use Kokoro-82M, an AI voice model.
      </p>
    </main>
  )
}

/* ---------- Choose a place ---------- */

function Share({ label, value, color, Icon }: { label: string; value: number; color: string; Icon: LucideIcon }) {
  return (
    <div className="share">
      <Icon size={18} className="icon" aria-hidden="true" />
      <span>
        {label}: {percent(value)} of every 100 days
      </span>
      <span className="track" aria-hidden="true">
        <span className="fill" style={{ width: `${percent(value)}%`, background: color, display: 'block' }} />
      </span>
    </div>
  )
}

export function ChoosePlace({ onPick, onBack }: { onPick: (siteId: string) => void; onBack: () => void }) {
  return (
    <main className="app">
      <button className="link" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        Back
      </button>
      <h2>Choose a place</h2>
      <p className="muted">NASA’s 9 candidate landing regions near the Moon’s South Pole. Sunlight and Earth views come from NASA Moon maps.</p>
      <div className="choices">
        {sites.map((s) => (
          <button key={s.id} className="choice" onClick={() => onPick(s.id)}>
            <span className="name">{s.name}</span>
            <span>{s.kidLine}</span>
            <Share label="Sun" value={s.sunShare.value} color="var(--sun)" Icon={Sun} />
            <Share label="Earth in view" value={s.earthShare.value} color="var(--radio)" Icon={Globe} />
          </button>
        ))}
      </div>
    </main>
  )
}

/* ---------- Choose a mode ---------- */

export function ChooseMode({ onPick, onBack }: { onPick: (m: Mode) => void; onBack: () => void }) {
  return (
    <main className="app">
      <button className="link" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        Back
      </button>
      <h2>Choose a mode</h2>
      <div className="choices">
        {(['cadet', 'commander'] as const).map((m) => (
          <button key={m} className="choice" onClick={() => onPick(m)}>
            <span className="name">{MODE_CARDS[m].name}</span>
            <ul className="mode-lines">
              {MODE_CARDS[m].lines.map((line) => (
                <li key={line} className={line === 'Stronger storms' ? 'strong' : undefined}>
                  {line === 'Stronger storms' ? <Radiation size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </main>
  )
}

/* ---------- Bars ---------- */

const METERS: { key: Loss; label: string; Icon: LucideIcon; color: string }[] = [
  { key: 'air', label: 'Air', Icon: Wind, color: 'var(--air)' },
  { key: 'power', label: 'Power', Icon: Zap, color: 'var(--power)' },
  { key: 'radiation', label: 'Radiation', Icon: Radiation, color: 'var(--radiation)' },
  { key: 'food', label: 'Food', Icon: Sprout, color: 'var(--plants)' },
]

function Bars({ game, forecast }: { game: GameState; forecast: Meters | null }) {
  return (
    <section className="meters" aria-label="Base bars">
      {METERS.filter((m) => m.key !== 'food' || game.hasFood).map(({ key, label, Icon, color }) => {
        const v = game[key]
        const on = Math.round(v / 10)
        const delta = forecast ? Math.round(forecast[key] - v) : 0
        const bad = key === 'radiation' ? delta > 0 : delta < 0
        return (
          <div key={key} className="meter">
            <Icon size={26} color={color} className="icon" aria-hidden="true" />
            <span className="label">{label}</span>
            <span className="value">{Math.round(v)}</span>
            <div className="segments" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} style={{ ['--c' as string]: color }}>
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} className={i < on ? 'on' : undefined} />
              ))}
            </div>
            {forecast && (
              <span className={`delta${bad ? ' bad' : ''}`}>
                {delta === 0 ? <Minus size={14} aria-hidden="true" /> : delta > 0 ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />}
                {delta === 0 ? 'Stays the same' : `Forecast ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}`}
              </span>
            )}
          </div>
        )
      })}
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

/* ---------- Base: forecast, share power, choice card ---------- */

const JOB_ROWS: { key: keyof Jobs; label: string; hint: string; Icon: LucideIcon; color: string }[] = [
  { key: 'air', label: 'Air', hint: 'Makes fresh air', Icon: Wind, color: 'var(--air)' },
  { key: 'shield', label: 'Shield', hint: 'Blocks space rays', Icon: Shield, color: 'var(--power)' },
  { key: 'plants', label: 'Plants', hint: 'Makes food and a little air', Icon: Sprout, color: 'var(--plants)' },
  { key: 'radio', label: 'Radio', hint: 'Calls Earth for storm news', Icon: Radio, color: 'var(--radio)' },
]

function warningText(daysUntil: number): string {
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

  const bump = (k: keyof Jobs, by: number) => setJobs((j) => ({ ...j, [k]: Math.max(0, j[k] + by) }))

  return (
    <main className="app">
      <div className="top">
        <span className="day">
          Day {game.day} of {game.totalDays}
        </span>
        <button className="link" onClick={onData}>
          <Database size={16} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Data
        </button>
      </div>

      <div className="chips">
        <span className="chip">
          {sunny ? <Sun size={18} color="var(--sun)" aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          {sunny ? 'Sunny day' : 'Dark day'}
        </span>
        <span className="chip">
          <Globe size={18} color={earth ? 'var(--radio)' : undefined} aria-hidden="true" />
          {earth ? 'Earth in view' : 'Earth hidden'}
        </span>
        <SunChip sun={sun} onTap={onSun} />
      </div>

      {warn && (
        <div className="alert" role="alert">
          <Radiation size={26} color="var(--radiation)" className="icon" aria-hidden="true" />
          <span>{warningText(warn.daysUntil)}</span>
        </div>
      )}

      {game.day === 1 && (
        <div className="orbi">
          <Rocket size={22} color="var(--sun)" className="icon" aria-hidden="true" />
          <p>
            <b>ORBI:</b> You have {BLOCKS} blocks each day. Tap + to give them to a job. Check the forecast first.
          </p>
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
                <Icon size={26} color={color} className="icon" aria-hidden="true" />
                <span className="what">
                  <b>{label}</b>
                  <small>{blocked ? 'Earth is hidden today' : hint}</small>
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

      <button className="primary" onClick={() => onShare({ jobs, go: card !== null && go })}>
        Next day
      </button>
    </main>
  )
}

/* ---------- Day report ---------- */

function RadioCall({ game, day }: { game: GameState; day: number }) {
  const d = radioDelay()
  const [heard, setHeard] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setHeard(true), d.roundTripS * 1000)
    return () => clearTimeout(t)
  }, [d.roundTripS])
  const look = MODES[game.mode].lookahead
  const coming = game.storms.filter((p) => p.arrivalDay > day && p.arrivalDay <= day + look)
  return (
    <section className="call" aria-label="Radio call to Earth" aria-live="polite">
      <div className="row">
        <Radio size={24} color="var(--radio)" aria-hidden="true" />
        <h3>Call to Mission Control</h3>
      </div>
      {!heard ? (
        <>
          <p>Radio waves take {d.oneWayS.toFixed(2)} seconds to reach Earth. Waiting for the answer...</p>
          <div className="wait" aria-hidden="true">
            <i style={{ ['--t' as string]: `${d.roundTripS}s` }} />
          </div>
        </>
      ) : coming.length > 0 ? (
        <p>
          Mission Control: “A storm is coming on day {coming[0]?.arrivalDay}.” The answer took {d.roundTripS.toFixed(2)} seconds.
        </p>
      ) : (
        <p>
          Mission Control: “No storm in the next {look} days.” The answer took {d.roundTripS.toFixed(2)} seconds.
        </p>
      )}
      <p className="fineprint">{d.source}</p>
    </section>
  )
}

function StormPanel({ game, index }: { game: GameState; index: number }) {
  const plan = game.storms[index]
  const data = storms.find((s) => s.id === plan?.stormId)
  if (!plan || !data) return null
  return (
    <section className="stormcard" aria-label="Real storm">
      <span className="row">
        <Radiation size={22} color="var(--radiation)" aria-hidden="true" />
        <b>A real storm from NASA’s records</b>
      </span>
      <p className="big">{data.title}</p>
      <p>
        {data.dates}. NOAA level {data.sLevel}. Peak {data.peakPfu.value.toLocaleString('en-US')} pfu on {data.peakDate}.
      </p>
      <p className="fineprint">
        pfu counts space-ray particles. {game.mode === 'commander' ? 'In Commander mode the game makes storms stronger. These numbers are the real ones.' : 'These numbers are the real ones.'}
      </p>
      <a href={data.records[0]?.url} target="_blank" rel="noreferrer">
        {data.records[0]?.label}
      </a>
    </section>
  )
}

const LABEL: Record<Loss, string> = { air: 'Air', power: 'Power', radiation: 'Radiation', food: 'Food' }

export function Report({ game, onNext }: { game: GameState; onNext: () => void }) {
  const r = game.history[game.history.length - 1]
  if (!r) return null
  const card = cards.find((c) => c.id === r.cardId)
  const over = game.status !== 'playing'
  const next = game.status === 'won' ? 'Finish the mission' : game.status === 'lost' ? 'See what happened' : 'Next day'
  return (
    <main className="app">
      <h2>Day {r.day} report</h2>
      <div className="chips">
        <span className="chip">
          {r.sunny ? <Sun size={18} color="var(--sun)" aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          {r.sunny ? 'Sunny day' : 'Dark day'}
        </span>
      </div>
      {r.storm && <StormPanel game={game} index={r.storm.index} />}
      {r.radioWorked && <RadioCall game={game} day={r.day} />}
      <ul className="list">
        {METERS.filter((m) => m.key !== 'food' || game.hasFood).map(({ key, label, Icon, color }) => {
          const a = Math.round(r.before[key])
          const b = Math.round(r.after[key])
          return (
            <li key={key} className="change">
              <Icon size={24} color={color} aria-hidden="true" />
              <span>
                {label} went from {a} to {b}.
              </span>
            </li>
          )
        })}
      </ul>
      {card && r.went && (
        <p>
          You went out: {card.question.replace(/\?$/, '')}. {card.science > 0 ? `+${card.science} science.` : ''}
        </p>
      )}
      {card && !r.went && <p className="muted">You stayed in. The crew is safe.</p>}
      <button className="primary" onClick={onNext}>
        {next}
      </button>
      {over && game.status === 'lost' && <p className="muted">A rescue ship takes the crew home. Nobody is hurt.</p>}
    </main>
  )
}

/* ---------- Why it happened ---------- */

export function Why({ game, onNext, onData }: { game: GameState; onNext: () => void; onData: () => void }) {
  const why = explain(game)
  return (
    <main className="app">
      <h2>Why it happened</h2>
      <p>The {LABEL[why.loss].toLowerCase()} bar ran out. Here is the chain.</p>
      <div className="stack">
        {why.steps.map((s, i) => (
          <div className="step" key={i}>
            <span className="num" aria-hidden="true">
              {i + 1}
            </span>
            <p>{s.text}</p>
          </div>
        ))}
      </div>
      <div className="orbi">
        <Rocket size={22} color="var(--sun)" className="icon" aria-hidden="true" />
        <p>
          <b>ORBI:</b> {why.tip}
        </p>
      </div>
      {why.record && (
        <a href={why.record.url} target="_blank" rel="noreferrer">
          {why.record.label}
        </a>
      )}
      <button className="link" onClick={onData}>
        Where the data comes from
      </button>
      <button className="primary" onClick={onNext}>
        See my mission
      </button>
    </main>
  )
}

/* ---------- Mission complete ---------- */

const BADGE: Record<BadgeId, string> = {
  'first-day': 'First day',
  'storm-survivor': 'Storm survivor',
  'green-thumb': 'Green thumb',
  'radio-hero': 'Radio hero',
  'night-owl': 'Night owl',
}

export function Complete({ game, onAgain, onData }: { game: GameState; onAgain: () => void; onData: () => void }) {
  const won = game.status === 'won'
  const site = sites.find((s) => s.id === game.siteId)
  return (
    <main className="app">
      <h2>{won ? 'Mission complete!' : 'The rescue ship is here'}</h2>
      <p>
        {won
          ? `The crew stayed safe for all ${game.totalDays} days at ${site?.name ?? 'the base'}.`
          : `The crew got home safe after ${game.history.length} ${game.history.length === 1 ? 'day' : 'days'}. Try again!`}
      </p>
      <div className="stats">
        <div className="stat">
          <b>{score(game)}</b>Score
        </div>
        <div className="stat">
          <b>{game.science}</b>Science
        </div>
        <div className="stat">
          <b>
            {stormsSurvived(game)} of {game.storms.length}
          </b>
          Storms survived
        </div>
        <div className="stat">
          <b>{game.history.length}</b>Days played
        </div>
      </div>
      <div className="badges">
        {badges(game).map((b) => (
          <span className="chip" key={b}>
            <Check size={16} aria-hidden="true" />
            {BADGE[b]}
          </span>
        ))}
      </div>
      <button className="primary" onClick={onAgain}>
        Play again
      </button>
      <button className="link" onClick={onData}>
        Where the data comes from
      </button>
      <p className="fineprint">{NASA_NOTE}</p>
    </main>
  )
}
