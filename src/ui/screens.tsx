import { useEffect, useState } from 'react'
import { BadgeCheck, Check, Globe, Moon, Radiation, Radio, Sparkles, Sun, type LucideIcon } from 'lucide-react'
import sites from '../data/sites.json'
import storms from '../data/storms.json'
import { MODE_CARDS, RADIO_SCIENCE, RADIO_SCIENCE_MAX } from '../engine/constants'
import { badges, explain, radioDelay, score, stormsSurvived } from '../engine/game'
import { cards } from '../engine/cards'
import { flareById } from '../engine/flares'
import type { BadgeId, DayRecord, GameState, Loss, Mode } from '../engine/types'
import { OrbiFace } from './art'
import { METERS } from './base'
import { FlareSun, GuessReveal } from './pictos'
import { Celebrate, CountUp } from './motion'
import { missionFailedGentle } from '../audio'
import { revealCue } from './cues'
import { sfx } from './sfx'
import { Speak } from './speech'
import { when } from './sunscreens'

export const NASA_NOTE = 'ASTRA uses NASA data. It is not made or endorsed by NASA.'
const percent = (x: number) => Math.round(x * 100)

/* ---------- Start ---------- */

export function Start({
  onPlay,
  onData,
  onSun,
  onCards,
  onSettings,
  onTeachers,
  onJournal,
}: {
  onPlay: () => void
  onData: () => void
  onSun: () => void
  onCards: () => void
  onSettings: () => void
  onTeachers: () => void
  onJournal: () => void
}) {
  return (
    <main className="app">
      <div className="hero">
        <div className="sunrise" aria-hidden="true" />
        <h1>ASTRA</h1>
        <p className="tagline">Run a Moon base. Keep the crew safe from real solar storms.</p>
        <button className="primary" onClick={onPlay}>
          Play
        </button>
        <div className="links">
          <button className="link" onClick={onSun}>
            Today’s Sun
          </button>
          <button className="link" onClick={onCards}>
            My storm cards
          </button>
          <button className="link" onClick={onJournal}>
            Flare Journal
          </button>
          <button className="link" onClick={onSettings}>
            Settings
          </button>
          <button className="link" onClick={onTeachers}>
            For teachers
          </button>
        </div>
        <button className="link" onClick={onData}>
          Where the data comes from
        </button>
      </div>
      <p className="fineprint">{NASA_NOTE} Made with help from Claude AI. Read-aloud uses your device’s voice.</p>
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
      <p className="muted">NASA’s 9 candidate landing regions near the Moon’s South Pole. Sun and Earth views are for the best spot near each region, from NASA Moon maps.</p>
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

/* ---------- Day report ---------- */

function RadioCall({ r }: { r: DayRecord }) {
  const d = radioDelay()
  const [heard, setHeard] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setHeard(true), d.roundTripS * 1000)
    return () => clearTimeout(t)
  }, [d.roundTripS])
  const sent = Math.min(RADIO_SCIENCE_MAX, r.jobs.radio) * RADIO_SCIENCE
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
      ) : (
        <p>
          Mission Control: “Data received. Thank you!” +{sent} science. The answer took {d.roundTripS.toFixed(2)} seconds.
        </p>
      )}
      <p className="fineprint">{d.source}</p>
    </section>
  )
}

/**
 * New flares in the Sun Watch, and what really happened after the flares the child was watching: all pictures.
 * A reveal shows the child's guess next to NASA's record, a check or cross, and the science a good read earned.
 */
function FlareNews({ r, game }: { r: DayRecord; game: GameState }) {
  if (r.reported.length === 0 && r.resolved.length === 0) return null
  const side = game.mode === 'commander'
  return (
    <section className="card stack" aria-label="Flare news">
      {r.reported.map((id) => {
        const f = flareById(id)
        return f ? (
          <div key={`new-${id}`} className="row" role="group" aria-label="A new flare on the Sun">
            <Sparkles size={26} color="var(--sun)" aria-hidden="true" />
            <FlareSun flare={f} showSide={side} width={116} />
          </div>
        ) : null
      })}
      {r.resolved.map(({ flareId, followed, guess, reward }) => {
        const f = flareById(flareId)
        if (!f) return null
        return (
          <div key={`res-${flareId}`} className="row between" role="group" aria-label="What really happened">
            <FlareSun flare={f} showSide={side} width={100} />
            <GuessReveal guess={guess} followed={followed} reward={reward} />
            <a className="iconlink" href={followed && f.sep ? f.sep.link : f.link} target="_blank" rel="noreferrer" aria-label="NASA record">
              <BadgeCheck size={24} aria-hidden="true" />
            </a>
          </div>
        )
      })}
    </section>
  )
}

function StormPanel({ game, index }: { game: GameState; index: number }) {
  const plan = game.storms[index]
  const data = storms.find((s) => s.id === plan?.stormId)
  if (!plan) return null
  if (!data) {
    // A real storm whose size is not in our data: show only what NASA recorded.
    const fe = game.flares.find((f) => f.stormIndex === index)
    const own = fe && flareById(fe.flareId)
    return (
      <section className="stormcard" aria-label="Real storm">
        <span className="row">
          <Radiation size={22} color="var(--radiation)" aria-hidden="true" />
          <b>A real storm from NASA’s records</b>
        </span>
        <p className="big">Space rays after a {own?.class ?? ''} flare</p>
        <p>NASA recorded a radiation storm after the flare on {own ? when(own.peakTime) : 'this day'}.</p>
        <p className="fineprint">We do not have this storm’s size, so the game uses a small storm.</p>
        {own?.sep && (
          <a href={own.sep.link} target="_blank" rel="noreferrer">
            NASA radiation storm record
          </a>
        )}
      </section>
    )
  }
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

const LABEL: Record<Loss, string> = { air: 'Air', power: 'Power', radiation: 'Radiation', food: 'Food', science: 'Science' }

/** "Air went from 80 to 64." or, when nothing changed, "Air stayed at 100." */
export function changeLine(label: string, a: number, b: number): string {
  return a === b ? `${label} stayed at ${a}.` : `${label} went from ${a} to ${b}.`
}

export function Report({ game, onNext }: { game: GameState; onNext: () => void }) {
  const r = game.history[game.history.length - 1]
  const stormToday = r?.storm != null
  const reportDay = r?.day
  useEffect(() => {
    if (stormToday) sfx.rumble()
    if (r) revealCue(r)
  }, [stormToday, reportDay])
  if (!r) return null
  const card = cards.find((c) => c.id === r.cardId)
  const over = game.status !== 'playing'
  const next = game.status === 'won' ? 'Finish the mission' : game.status === 'lost' ? 'See what happened' : 'Next day'
  const lines = METERS.filter((m) => m.key !== 'food' || game.hasFood).map((m) => changeLine(m.label, Math.round(r.before[m.key]), Math.round(r.after[m.key])))
  return (
    <main className="app">
      <div className="row between">
        <h2>Day {r.day} report</h2>
        <Speak text={`Day ${r.day} report. ${lines.join(' ')}`} />
      </div>
      <div className="chips">
        <span className="chip">
          {r.sunny ? <Sun size={18} color="var(--sun)" aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          {r.sunny ? 'Sunny day' : 'Dark day'}
        </span>
      </div>
      {r.storm && <StormPanel game={game} index={r.storm.index} />}
      <FlareNews r={r} game={game} />
      {r.radioWorked && <RadioCall r={r} />}
      {r.walk !== 'none' && (
        <p>
          {r.calledHome ? 'A storm called the walkers home. The walk’s science was lost.' : `The ${r.walk} walk brought home ${r.walkScience} science.`}
        </p>
      )}
      <ul className="list">
        {METERS.filter((m) => m.key !== 'food' || game.hasFood).map(({ key, Icon, color }, i) => (
          <li key={key} className="change">
            <Icon size={24} color={color} aria-hidden="true" />
            <span className="grow">{lines[i]}</span>
            {/* The number counts up for the eye; the sentence beside it is always right for a screen reader. */}
            <b className="now" aria-hidden="true">
              <CountUp from={Math.round(r.before[key])} to={Math.round(r.after[key])} />
            </b>
          </li>
        ))}
      </ul>
      {card && (
        <p>
          You chose: {(r.went ? card.a : card.b).label}
        </p>
      )}
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
      <div className="row between">
        <h2>Why it happened</h2>
        <Speak text={`${why.steps.map((s) => s.text).join(' ')} ${why.tip}`} />
      </div>
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
        <OrbiFace look="open" size={48} />
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
  useEffect(() => {
    if (won) sfx.success()
    else missionFailedGentle()
  }, [won])
  return (
    <main className="app">
      {won && <Celebrate />}
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
        {badges(game).map((b, i) => (
          <span className="chip pop" key={b} style={{ animationDelay: `${0.25 + i * 0.15}s` }}>
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
