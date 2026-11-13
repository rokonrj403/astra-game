import { useState } from 'react'
import { BadgeCheck, Check, ExternalLink, History, Info, Lock, Save, Sun, Wifi, type LucideIcon } from 'lucide-react'
import storms from '../data/storms.json'
import type { SunStatus, SunView } from '../live/sun'
import { BurstArt } from './pictos'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-11-12" -> "12 Nov 2026"; a full time -> "12 Nov 2026, 14:30 UTC". All times are UTC, as NASA lists them. */
export function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const date = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  if (iso.length <= 10) return date
  return `${date}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`
}

type Label = SunStatus | 'PAST' | 'LOADING'
const LABELS: Record<Label, { word: string; Icon: LucideIcon; color: string }> = {
  LIVE: { word: 'LIVE', Icon: Wifi, color: 'var(--plants)' },
  SAVED: { word: 'SAVED', Icon: Save, color: 'var(--sun)' },
  PAST: { word: 'FROM THE PAST', Icon: History, color: 'var(--air)' },
  LOADING: { word: 'ASKING NASA', Icon: Wifi, color: 'var(--muted)' },
}

export function StatusBadge({ label }: { label: Label }) {
  const { word, Icon, color } = LABELS[label]
  return (
    <span className="chip" style={{ borderColor: color }} data-status={label}>
      <Icon size={18} color={color} aria-hidden="true" />
      {word}
    </span>
  )
}

/** The small chip on the base screen's top strip. Tap it to open Today's Sun. */
export function SunChip({ sun, onTap }: { sun: SunView | null; onTap: () => void }) {
  const label: Label = sun ? sun.status : 'LOADING'
  const { word, color } = LABELS[label]
  return (
    <button className="chip sunchip" onClick={onTap} aria-label={`Today's Sun, ${word}`}>
      <Sun size={18} color={color} aria-hidden="true" />
      {word}
    </button>
  )
}

export function SunScreen({ sun, onBack }: { sun: SunView | null; onBack: () => void }) {
  const [info, setInfo] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const flares = sun ? sun.flares.slice(0, 8) : []
  const picked = flares.find((f) => f.link === open)
  const sentence =
    !sun
      ? 'Asking NASA what the Sun did lately.'
      : sun.status === 'LIVE'
        ? `NASA answered just now (${when(sun.asOf)}). These are real flares from NASA’s list.`
        : `We could not get a fresh answer from NASA, so this is a saved copy from ${when(sun.asOf)}. It is real NASA data, but it is not live.`
  return (
    <main className="app">
      <div className="row between">
        <button className="link" onClick={onBack}>
          Back
        </button>
        <button className="iconbtn" onClick={() => setInfo((i) => !i)} aria-pressed={info} aria-label="About Today’s Sun">
          <Info size={22} aria-hidden="true" />
        </button>
      </div>
      <h2 className="sr">Today’s Sun</h2>
      <div className="row between">
        <StatusBadge label={sun ? sun.status : 'LOADING'} />
        {sun && <span className="asof">{when(sun.asOf)}</span>}
      </div>
      <span className="sr" role="status">
        {sentence}
      </span>

      {sun && (
        <>
          <section className="shelf" aria-label="Flares">
            {flares.length === 0 ? (
              <span className="calm" role="img" aria-label="No flares in this time. The Sun was quiet.">
                <Sun size={40} color="var(--sun)" aria-hidden="true" />
                <Check size={30} color="var(--plants)" aria-hidden="true" />
              </span>
            ) : (
              <div className="stickers">
                {flares.map((f) => (
                  <div className="sticker" key={f.link + f.peakTime}>
                    <button onClick={() => setOpen(open === f.link ? null : f.link)} aria-pressed={open === f.link} aria-label={`${f.class} flare, ${when(f.peakTime)}`}>
                      <BurstArt cls={f.class} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
          {picked && (
            <div className="detail" role="status">
              <span>
                {picked.class} · {when(picked.peakTime)}
              </span>
              <a href={picked.link} target="_blank" rel="noreferrer" aria-label="NASA record">
                <BadgeCheck size={22} aria-hidden="true" />
                <ExternalLink size={18} aria-hidden="true" />
              </a>
            </div>
          )}
          <section className="shelf" aria-label="Magnetic storm">
            {sun.magneticStorm ? (
              <div className="row between" role="group" aria-label={`Latest magnetic storm: Kp ${sun.magneticStorm.kp} on ${when(sun.magneticStorm.time)}`}>
                <span className="dots big" role="img" aria-label={`Kp ${sun.magneticStorm.kp} of 9`}>
                  {Array.from({ length: 9 }, (_, i) => (
                    <i key={i} className={i < sun.magneticStorm!.kp ? 'on' : undefined} />
                  ))}
                </span>
                <a className="iconlink" href={sun.magneticStorm.link} target="_blank" rel="noreferrer" aria-label="NASA record">
                  <BadgeCheck size={22} aria-hidden="true" />
                </a>
              </div>
            ) : (
              <span className="calm" role="img" aria-label="No magnetic storm in the last 30 days.">
                <Check size={30} color="var(--plants)" aria-hidden="true" />
              </span>
            )}
          </section>
        </>
      )}

      {info && (
        <div className="note stack">
          <p>{sentence}</p>
          <p>A flare is a sudden bright flash on the Sun. Letters show strength: C is small, M is medium, X is big. Kp goes from 0 to 9. A 5 or more is a magnetic storm. It can make auroras.</p>
          <p className="fineprint">
            NASA lists flares after they happen. ASTRA does not predict storms. The storms in the game are real storms from the past.
            {sun ? ` Source: ${sun.source}` : ''}
          </p>
        </div>
      )}
    </main>
  )
}

export function StormCards({ met, onBack }: { met: string[]; onBack: () => void }) {
  const have = storms.filter((s) => met.includes(s.id)).length
  return (
    <main className="app">
      <button className="link" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        Back
      </button>
      <h2>My storm cards</h2>
      <p>
        You have met {have} of {storms.length} real storms. Play to meet more.
      </p>
      <div className="choices">
        {storms.map((s) =>
          met.includes(s.id) ? (
            <article key={s.id} className="stormcard flip" aria-label={s.title}>
              <div className="chips">
                <StatusBadge label="PAST" />
              </div>
              <p className="big">{s.title}</p>
              <p>{s.kidSentence}</p>
              <p>
                {s.dates}. NOAA level {s.sLevel}. Peak {s.peakPfu.value.toLocaleString('en-US')} pfu on {s.peakDate}. Flare {s.flare.value}.
              </p>
              <a href={s.records[0]?.url} target="_blank" rel="noreferrer">
                {s.records[0]?.label}
              </a>
            </article>
          ) : (
            <article key={s.id} className="card row" aria-label="Locked storm card">
              <Lock size={22} aria-hidden="true" className="icon" />
              <span>Locked. Play to meet this storm.</span>
            </article>
          ),
        )}
      </div>
      <p className="fineprint">pfu counts space-ray particles. Numbers are the ones NASA and NOAA recorded. Every card is a storm from the past.</p>
    </main>
  )
}
