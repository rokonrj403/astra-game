import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  BookOpen,
  Check,
  Cloud,
  CloudRain,
  Database,
  Footprints,
  GraduationCap,
  Globe,
  House,
  Info,
  Layers,
  Minus,
  Play,
  Radiation,
  Radio,
  Rocket,
  Settings as SettingsIcon,
  Sparkles,
  Star,
  Sun,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import sites from '../data/sites.json'
import storms from '../data/storms.json'
import { MODE_CARDS, MODES, RADIO_SCIENCE, RADIO_SCIENCE_MAX } from '../engine/constants'
import { badges, explain, radioDelay, score, stormsSurvived } from '../engine/game'
import { flareById } from '../engine/flares'
import type { BadgeId, DayRecord, GameState, Loss, Mode } from '../engine/types'
import { missionFailedGentle } from '../audio'
import { BaseScene, OrbiFace } from './art'
import { METERS } from './base'
import { revealCue } from './cues'
import { Celebrate } from './motion'
import { FlareArt, FlareSun, GuessReveal } from './pictos'
import { sfx } from './sfx'
import { Speak } from './speech'
import { when } from './sunscreens'
import type { SceneState } from './look'

export const NASA_NOTE = 'ASTRA uses NASA data. It is not made or endorsed by NASA.'
const ABOUT = `${NASA_NOTE} Made with help from Claude AI. Read-aloud uses your device’s voice.`
const percent = (x: number) => Math.round(x * 100)

/** A bar made of 5 blocks, filled to a share: the picture version of "28 in every 100". */
function Fill({ value, color, Icon, label }: { value: number; color: string; Icon: LucideIcon; label: string }) {
  const on = Math.max(0, Math.min(5, Math.round(value * 5)))
  return (
    <span className="fill5" role="img" aria-label={`${label}: ${percent(value)} in every 100 days`}>
      <Icon size={20} color={color} aria-hidden="true" />
      <span className="blocks" style={{ ['--c' as string]: color }}>
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} className={i < on ? 'on' : undefined} />
        ))}
      </span>
    </span>
  )
}

/* ---------- Start ---------- */

const IDLE_SCENE: SceneState = { sunny: true, earth: true, shield: 0, storm: 'none', powerLow: false, plantsHappy: true }

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
  const links: [() => void, LucideIcon, string][] = [
    [onSun, Sun, 'Today’s Sun'],
    [onCards, Layers, 'My storm cards'],
    [onJournal, BookOpen, 'Flare Journal'],
    [onSettings, SettingsIcon, 'Settings'],
    [onTeachers, GraduationCap, 'For teachers'],
    [onData, Database, 'Where the data comes from'],
  ]
  return (
    <main className="app start">
      <BaseScene s={IDLE_SCENE} />
      <h1>ASTRA</h1>
      <button className="primary big" onClick={onPlay}>
        <Play size={26} aria-hidden="true" /> Play
      </button>
      <div className="iconrow">
        {links.map(([go, Icon, label]) => (
          <button key={label} className="iconbtn big" onClick={go} aria-label={label} title={label}>
            <Icon size={26} aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="fineprint" aria-label={ABOUT}>
        Uses NASA data. Not endorsed by NASA.
      </p>
    </main>
  )
}

/* ---------- Choose a place ---------- */

export function ChoosePlace({ onPick, onBack }: { onPick: (siteId: string) => void; onBack: () => void }) {
  const [sel, setSel] = useState<string | null>(null)
  const [info, setInfo] = useState(false)
  const site = sites.find((s) => s.id === sel)
  return (
    <main className="app">
      <div className="row between">
        <button className="link" onClick={onBack}>
          Back
        </button>
        <button className="iconbtn" onClick={() => setInfo((i) => !i)} aria-pressed={info} aria-label="About these places">
          <Info size={22} aria-hidden="true" />
        </button>
      </div>
      {info && (
        <p className="note">
          NASA’s 9 candidate landing regions near the Moon’s South Pole. Sun and Earth views are for the best spot near each region, from NASA Moon maps.
        </p>
      )}
      <div className="places">
        {sites.map((s) => (
          <button key={s.id} className="place" aria-pressed={sel === s.id} aria-label={s.name} title={s.name} onClick={() => setSel(s.id)}>
            <Fill value={s.sunShare.value} color="var(--sun)" Icon={Sun} label="Sun" />
            <Fill value={s.earthShare.value} color="var(--radio)" Icon={Globe} label="Earth in view" />
          </button>
        ))}
      </div>
      {site && (
        <div className="chosen">
          <b>{site.name}</b>
          <button className="primary" onClick={() => onPick(site.id)}>
            <ArrowRight size={22} aria-hidden="true" /> Go
          </button>
        </div>
      )}
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
      <div className="choices">
        {(['cadet', 'commander'] as const).map((m) => {
          const rules = MODES[m]
          return (
            <button key={m} className="choice mode" onClick={() => onPick(m)} aria-label={`${MODE_CARDS[m].name}: ${MODE_CARDS[m].lines.join(', ')}`}>
              <span className="name">{MODE_CARDS[m].name}</span>
              <span className="row" aria-hidden="true">
                <span className="daydots">
                  {Array.from({ length: rules.days }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
              </span>
              <span className="row" aria-hidden="true">
                {Array.from({ length: rules.stormCount }, (_, i) => (
                  <CloudRain key={i} size={28} color="var(--radiation)" />
                ))}
                {m === 'commander' && <ArrowUp size={22} color="var(--radiation)" />}
                <Star size={26} color="var(--sun)" fill="var(--sun)" />
                {rules.hasFood && <Sparkles size={24} color="var(--plants)" />}
              </span>
              {m === 'commander' && <span className="strong">Stronger storms</span>}
            </button>
          )
        })}
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
  const words = heard ? `Mission Control: Data received. Thank you! Plus ${sent} science. The answer took ${d.roundTripS.toFixed(2)} seconds. ${d.source}` : `Radio waves take ${d.oneWayS.toFixed(2)} seconds to reach Earth. Waiting for the answer.`
  return (
    <section className="call" aria-label="Radio call to Earth" aria-live="polite">
      <span className="sr" role="status">
        {words}
      </span>
      <div className="row between" aria-hidden="true">
        <Radio size={26} color="var(--radio)" />
        {!heard ? (
          <>
            <span className="wait">
              <i style={{ ['--t' as string]: `${d.roundTripS}s` }} />
            </span>
            <b>{d.oneWayS.toFixed(2)} s</b>
          </>
        ) : (
          <>
            <Check size={26} color="var(--plants)" />
            <b className="plus">+{sent}</b>
          </>
        )}
      </div>
    </section>
  )
}

/** A real storm, as a picture: the shield charge that met it and what it did to radiation. Facts only on tap. */
function StormPanel({ game, index }: { game: GameState; index: number }) {
  const [open, setOpen] = useState(false)
  const plan = game.storms[index]
  const hit = game.history[game.history.length - 1]?.storm
  const data = storms.find((s) => s.id === plan?.stormId)
  const fe = game.flares.find((f) => f.stormIndex === index)
  const own = fe && flareById(fe.flareId)
  if (!plan || !hit) return null
  const charge = hit.shield
  return (
    <section className="stormcard" aria-label="Real storm">
      <div className="row between">
        <CloudRain size={34} color="var(--radiation)" aria-hidden="true" />
        <span className="dots big" role="img" aria-label={`Shield charge ${charge} of 6`}>
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} className={i < charge ? 'shield on' : 'shield'} />
          ))}
        </span>
        <ArrowUp size={26} color="var(--radiation)" aria-hidden="true" />
        <button className="iconbtn" aria-label="Storm details" aria-pressed={open} onClick={() => setOpen((o) => !o)}>
          <BadgeCheck size={22} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="details">
          {data ? (
            <>
              <b>{data.title}</b>
              <p>
                {data.dates}. NOAA level {data.sLevel}. Peak {data.peakPfu.value.toLocaleString('en-US')} pfu on {data.peakDate}.
              </p>
              <a href={data.records[0]?.url} target="_blank" rel="noreferrer">
                {data.records[0]?.label}
              </a>
            </>
          ) : (
            <>
              <p>NASA recorded a radiation storm after the {own?.class ?? ''} flare on {own ? when(own.peakTime) : 'this day'}. We do not have its size, so the game uses a small storm.</p>
              {own?.sep && (
                <a href={own.sep.link} target="_blank" rel="noreferrer">
                  NASA radiation storm record
                </a>
              )}
            </>
          )}
          <p className="fineprint">{game.mode === 'commander' ? 'In Commander mode the game makes storms stronger. These numbers are the real ones.' : 'These numbers are the real ones.'}</p>
        </div>
      )}
    </section>
  )
}

const LABEL: Record<Loss, string> = { air: 'Air', power: 'Power', radiation: 'Radiation', food: 'Food', science: 'Science' }

/** "Air went from 80 to 64." or, when nothing changed, "Air stayed at 100." (read aloud and by screen readers) */
export function changeLine(label: string, a: number, b: number): string {
  return a === b ? `${label} stayed at ${a}.` : `${label} went from ${a} to ${b}.`
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

/** The day, as pictures: every bar with an up, down or same arrow, a walk result, science earned. The sentences are for screen readers and reading aloud. */
export function DaySummary({ game }: { game: GameState }) {
  const r = game.history[game.history.length - 1]
  const stormToday = r?.storm != null
  const reportDay = r?.day
  useEffect(() => {
    if (stormToday) sfx.rumble()
    if (r) revealCue(r)
  }, [stormToday, reportDay])
  if (!r) return null
  const rows = METERS.filter((m) => m.key !== 'food' || game.hasFood).map((m) => {
    const a = Math.round(r.before[m.key])
    const b = Math.round(r.after[m.key])
    return { ...m, a, b, line: changeLine(m.label, a, b) }
  })
  const sentences = rows.map((x) => x.line).join(' ')
  return (
    <div className="daysummary">
      <div className="row between">
        <h2>Day {r.day}</h2>
        <span className="row">
          {r.sunny ? <Sun size={26} color="var(--sun)" aria-label="Sunny day" /> : <span className="moon" aria-label="Dark day" />}
          <Speak text={`Day ${r.day}. ${sentences}`} />
        </span>
      </div>

      {r.storm && <StormPanel game={game} index={r.storm.index} />}
      <FlareNews r={r} game={game} />
      {r.radioWorked && <RadioCall r={r} />}

      <ul className="summary" aria-label="What changed">
        {rows.map(({ key, Icon, color, a, b, line }) => (
          <li key={key} aria-label={line}>
            <Icon size={34} color={color} aria-hidden="true" />
            {b > a ? <ArrowUp size={30} color={key === 'radiation' ? 'var(--radiation)' : 'var(--plants)'} aria-hidden="true" /> : b < a ? <ArrowDown size={30} color={key === 'radiation' ? 'var(--plants)' : 'var(--radiation)'} aria-hidden="true" /> : <Minus size={30} color="var(--muted)" aria-hidden="true" />}
          </li>
        ))}
      </ul>

      <div className="row chips">
        {r.walk !== 'none' && (
          <span className="chip" role="img" aria-label={r.calledHome ? 'A storm called the walkers home. The walk’s science was lost.' : `The ${r.walk} walk brought home ${r.walkScience} science.`}>
            {r.calledHome ? <House size={22} aria-hidden="true" /> : <Footprints size={22} aria-hidden="true" />}
          </span>
        )}
        {r.scienceGain > 0 && (
          <span className="chip plus" role="img" aria-label={`Science earned today: ${r.scienceGain}`}>
            <Sparkles size={22} color="var(--sun)" aria-hidden="true" />+{r.scienceGain}
          </span>
        )}
      </div>

    </div>
  )
}

/** The day report as a page: the summary and a Next button. */
export function Report({ game, onNext }: { game: GameState; onNext: () => void }) {
  return (
    <main className="app report">
      <DaySummary game={game} />
      <NextButton game={game} onNext={onNext} />
    </main>
  )
}

/** One big Next button. Named for what it does: next day, see what happened, or finish the mission. */
export function NextButton({ game, onNext }: { game: GameState; onNext: () => void }) {
  return (
    <button className="primary big" onClick={onNext} aria-label={game.status === 'won' ? 'Finish the mission' : game.status === 'lost' ? 'See what happened' : 'Next day'}>
      <ArrowRight size={26} aria-hidden="true" /> Next
    </button>
  )
}

/* ---------- Why it happened ---------- */

function Panel({ n, words, children }: { n: number; words: string; children: React.ReactNode }) {
  return (
    <figure className="panel" style={{ ['--i' as string]: n }}>
      <div className="art">{children}</div>
      <figcaption>{words}</figcaption>
    </figure>
  )
}

/** Why the mission ended, as a 3-panel picture strip (4 words or fewer a panel). The long version is for screen readers; ORBI's tip is behind a tap. */
export function Why({ game, onNext, onData }: { game: GameState; onNext: () => void; onData: () => void }) {
  const why = explain(game)
  const [tip, setTip] = useState(false)
  const last = game.history[game.history.length - 1]
  const hit = last?.storm
  const fe = hit ? game.flares.find((f) => f.stormIndex === hit.index) : undefined
  const own = fe && flareById(fe.flareId)
  const meter = METERS.find((m) => m.key === why.loss)
  const Icon = meter?.Icon ?? Star
  const color = meter?.color ?? 'var(--sun)'
  const storyRays = why.loss === 'radiation' && hit
  const long = why.steps.map((s) => s.text).join(' ')
  return (
    <main className="app why">
      <div className="row between">
        <span className="sr" role="status">
          {long}
        </span>
        <Speak text={`${long} ${why.tip}`} />
        <button className="iconbtn" aria-label="ORBI’s tip" aria-pressed={tip} onClick={() => setTip((t) => !t)}>
          <OrbiFace look="open" size={44} />
        </button>
      </div>

      <div className="strip" role="group" aria-label="Why it happened">
        {storyRays ? (
          <>
            <Panel n={1} words="A flare">
              {own ? <FlareArt flare={own} showSide={game.mode === 'commander'} /> : <Radiation size={56} color="var(--radiation)" />}
            </Panel>
            <Panel n={2} words="Rays travel">
              <span className="travel" aria-hidden="true">
                <Cloud size={44} color="#E8E6F0" />
                <ArrowRight size={34} />
                <Globe size={44} color="var(--air)" />
              </span>
            </Panel>
            <Panel n={3} words={`Shield ${hit.shield}`}>
              <span className="dots big" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <i key={i} className={i < hit.shield ? 'shield on' : 'shield'} />
                ))}
              </span>
              <CloudRain size={44} color="var(--radiation)" aria-hidden="true" />
            </Panel>
          </>
        ) : (
          <>
            <Panel n={1} words={why.loss === 'science' ? 'Goal missed' : `${LABEL[why.loss]} ran out`}>
              <Icon size={60} color={color} aria-hidden="true" />
            </Panel>
            <Panel n={2} words="Rescue ship">
              <Rocket size={60} color="var(--sun)" aria-hidden="true" />
            </Panel>
            <Panel n={3} words="Nobody hurt">
              <Check size={60} color="var(--plants)" aria-hidden="true" />
            </Panel>
          </>
        )}
      </div>

      {tip && (
        <div className="orbi">
          <p>{why.tip}</p>
        </div>
      )}
      <div className="row between">
        {why.record ? (
          <a className="iconlink" href={why.record.url} target="_blank" rel="noreferrer" aria-label="NASA record">
            <BadgeCheck size={24} aria-hidden="true" />
          </a>
        ) : (
          <button className="iconbtn" onClick={onData} aria-label="Where the data comes from">
            <Database size={22} aria-hidden="true" />
          </button>
        )}
        <button className="primary big" onClick={onNext} aria-label="See my mission">
          <ArrowRight size={26} aria-hidden="true" /> Next
        </button>
      </div>
    </main>
  )
}

/* ---------- Mission complete ---------- */

const BADGE: Record<BadgeId, { label: string; Icon: LucideIcon }> = {
  'first-day': { label: 'First day', Icon: Sun },
  'storm-survivor': { label: 'Storm survivor', Icon: CloudRain },
  'green-thumb': { label: 'Green thumb', Icon: Sparkles },
  'radio-hero': { label: 'Radio hero', Icon: Radio },
  'night-owl': { label: 'Night owl', Icon: Star },
}

export function Complete({ game, onAgain, onData }: { game: GameState; onAgain: () => void; onData: () => void }) {
  const won = game.status === 'won'
  const site = sites.find((s) => s.id === game.siteId)
  useEffect(() => {
    if (won) sfx.success()
    else missionFailedGentle()
  }, [won])
  const stats: [LucideIcon, string, string][] = [
    [Star, `${score(game)}`, 'Score'],
    [Sparkles, `${game.science}/${game.goal}`, 'Science and goal'],
    [CloudRain, `${stormsSurvived(game)}/${game.storms.length}`, 'Storms survived'],
    [Sun, `${game.history.length}`, 'Days played'],
  ]
  return (
    <main className="app end" aria-label={won ? `Mission complete at ${site?.name ?? 'the base'}` : 'The rescue ship is here'}>
      {won && <Celebrate />}
      <div className="trophy" aria-hidden="true">
        {won ? <Trophy size={96} color="var(--sun)" /> : <Rocket size={96} color="var(--sun)" />}
      </div>
      <h2>{won ? 'Mission complete' : 'Rescue ship'}</h2>
      <div className="stats">
        {stats.map(([Icon, value, label]) => (
          <div key={label} className="stat" role="img" aria-label={`${label}: ${value}`}>
            <Icon size={26} aria-hidden="true" />
            <b>{value}</b>
          </div>
        ))}
      </div>
      <div className="badges">
        {badges(game).map((b, i) => {
          const { label, Icon } = BADGE[b]
          return (
            <span className="chip pop" key={b} role="img" aria-label={label} style={{ animationDelay: `${0.25 + i * 0.15}s` }}>
              <Icon size={24} aria-hidden="true" />
            </span>
          )
        })}
      </div>
      <button className="primary big" onClick={onAgain} aria-label="Play again">
        <Play size={26} aria-hidden="true" /> Again
      </button>
      <button className="iconbtn" onClick={onData} aria-label="Where the data comes from">
        <Database size={22} aria-hidden="true" />
      </button>
    </main>
  )
}
