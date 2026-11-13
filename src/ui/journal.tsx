import { useState } from 'react'
import { ArrowRight, BadgeCheck, BookOpen, Check, Cloud, CloudOff, CloudRain, ExternalLink, Sun, X } from 'lucide-react'
import { flareById } from '../engine/flares'
import { CLUE_KEYS, hasClue, patternBanner, seededEntries, type ClueKey, type JournalEntry } from '../engine/journal'
import { OrbiFace } from './art'
import { FlareArt } from './pictos'
import { when } from './sunscreens'

const CLUE_WORDS: Record<ClueKey, string> = {
  'cloud-yes': 'Gas cloud',
  'cloud-no': 'No gas cloud',
  'side-west': 'West side',
  'side-east': 'East side',
  'size-big': 'Big flare',
  'size-medium': 'Medium flare',
}

/** One clue as a small picture. */
export function ClueGlyph({ k, size = 34 }: { k: ClueKey; size?: number }) {
  if (k === 'cloud-yes') return <Cloud size={size} color="#E8E6F0" fill="#E8E6F0" aria-hidden="true" />
  if (k === 'cloud-no') return <CloudOff size={size} color="var(--muted)" aria-hidden="true" />
  if (k === 'side-west' || k === 'side-east') {
    const x = k === 'side-west' ? 25 : 7
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="12" fill="#E69F00" />
        <circle cx={x} cy="14" r="5" fill="#D55E00" stroke="#FFD36A" strokeWidth="1.5" />
      </svg>
    )
  }
  const big = k === 'size-big'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r={big ? 14 : 7} fill="#D55E00" stroke="#FFD36A" strokeWidth="1.5" />
      {big && <circle cx="16" cy="16" r="5" fill="#E69F00" />}
    </svg>
  )
}

function Sticker({ e, open, onTap }: { e: JournalEntry; open: boolean; onTap: () => void }) {
  const f = flareById(e.flareId)
  if (!f) return null
  const right = (e.guess === 'yes' && e.followed) || (e.guess === 'no' && !e.followed)
  return (
    <div className="sticker">
      <button onClick={onTap} aria-pressed={open} aria-label={`${f.class} flare, ${e.followed ? 'rays came' : 'no rays'}${e.seed ? ', from ORBI’s old notes' : ''}`}>
        <FlareArt flare={f} />
        <span className="marks" aria-hidden="true">
          <BadgeCheck size={16} />
          {e.seed ? <BookOpen size={16} /> : e.guess === 'yes' || e.guess === 'no' ? right ? <Check size={16} color="var(--plants)" /> : <X size={16} color="var(--muted)" /> : null}
        </span>
      </button>
    </div>
  )
}

export function Journal({ played, onBack }: { played: JournalEntry[]; onBack: () => void }) {
  const [filter, setFilter] = useState<ClueKey | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const all = [...seededEntries(), ...played]
  const shown = all.filter((e) => {
    if (!filter) return true
    const f = flareById(e.flareId)
    return f ? hasClue(f, filter) : false
  })
  const rays = shown.filter((e) => e.followed)
  const quiet = shown.filter((e) => !e.followed)
  const pattern = patternBanner(played.map((e) => ({ ...e, seed: false })))
  const detail = open ? flareById(open) : undefined

  return (
    <main className="app journal">
      <div className="row between">
        <button className="link" onClick={onBack}>
          Back
        </button>
        <span className="row">
          <OrbiFace look="curious" size={44} />
          <h2>Flare Journal</h2>
        </span>
      </div>

      {pattern && (
        <div className="pattern" role="img" aria-label={`${CLUE_WORDS[pattern.clue]}: rays came ${pattern.rays} of ${pattern.n} times. Often, not always.`}>
          <ClueGlyph k={pattern.clue} size={40} />
          <ArrowRight size={24} aria-hidden="true" />
          <CloudRain size={32} color="var(--radiation)" aria-hidden="true" />
          <span className="dots big">
            {Array.from({ length: pattern.n }, (_, i) => (
              <i key={i} className={i < pattern.rays ? 'on' : undefined} />
            ))}
          </span>
        </div>
      )}

      <div className="filters" role="group" aria-label="Look at one clue">
        {CLUE_KEYS.map((k) => (
          <button key={k} aria-label={CLUE_WORDS[k]} aria-pressed={filter === k} onClick={() => setFilter(filter === k ? null : k)} title={CLUE_WORDS[k]}>
            <ClueGlyph k={k} />
          </button>
        ))}
      </div>

      {(
        [
          ['Rays', rays, <CloudRain key="r" size={26} color="var(--radiation)" aria-hidden="true" />],
          ['No rays', quiet, <Sun key="n" size={26} color="var(--sun)" aria-hidden="true" />],
        ] as const
      ).map(([title, list, icon]) => (
        <section key={title} className="shelf" aria-label={title}>
          <h3 className="row">
            {icon}
            {title} <b className="count">{list.length}</b>
          </h3>
          <div className="stickers">
            {list.map((e) => (
              <Sticker key={e.flareId} e={e} open={open === e.flareId} onTap={() => setOpen(open === e.flareId ? null : e.flareId)} />
            ))}
          </div>
        </section>
      ))}

      {detail && (
        <div className="detail" role="status">
          <span>
            {detail.class} · {when(detail.peakTime)}
          </span>
          <a href={detail.followed && detail.sep ? detail.sep.link : detail.link} target="_blank" rel="noreferrer" aria-label="NASA record">
            <BadgeCheck size={22} aria-hidden="true" />
            <ExternalLink size={18} aria-hidden="true" />
          </a>
        </div>
      )}
    </main>
  )
}
