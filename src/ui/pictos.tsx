import { useState } from 'react'
import { BadgeCheck, Check, CloudRain, CircleHelp, Sun, X } from 'lucide-react'
import { flareBucket, type FlareRecord } from '../engine/flares'
import type { Guess } from '../engine/types'

/** Flare size as a picture: 1, 2 or 3 pulses (M5 to M9, X1 to X4, X5 and bigger). */
export function sizeLevel(cls: string): 1 | 2 | 3 {
  const b = flareBucket(cls)
  return b === 'm5' ? 1 : b === 'x1' ? 2 : 3
}

type Clues = Pick<FlareRecord, 'class' | 'cloud' | 'side'>

/**
 * A flare drawn on the Sun. Every clue is a picture:
 *  size  = a small, medium or big burst with 1, 2 or 3 pulses;
 *  cloud = a blob of gas leaving the Sun (no blob = no gas cloud);
 *  side  = where the burst sits on the disc (left = east, right = west); hidden (top) when `showSide` is false.
 * Words appear only on tap.
 */
/** Just the picture (no button), so it can sit inside another button. */
export function FlareArt({ flare, showSide = true }: { flare: Clues; showSide?: boolean }) {
  const level = sizeLevel(flare.class)
  const cx = 44
  const cy = 38
  const R = 28
  const angle = !showSide ? -Math.PI / 2 : flare.side === 'west' ? -0.15 : Math.PI + 0.15
  const bx = cx + R * Math.cos(angle)
  const by = cy + R * Math.sin(angle)
  const burst = [8, 13, 18][level - 1]!
  const spikes = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2
    const r = i % 2 === 0 ? burst : burst * 0.5
    return `${bx + r * Math.cos(a)},${by + r * Math.sin(a)}`
  }).join(' ')
  return (
    <svg viewBox="0 0 136 76" role="img" aria-hidden="true" className="flareart">
      <circle cx={cx} cy={cy} r={R + 5} fill="#E69F00" opacity="0.18" />
      <circle cx={cx} cy={cy} r={R} fill="#E69F00" />
      {Array.from({ length: level }, (_, i) => (
        <circle key={i} cx={bx} cy={by} r={burst + 5 + i * 6} fill="none" stroke="#D55E00" strokeWidth="2.5" opacity={0.85 - i * 0.22} />
      ))}
      <polygon points={spikes} fill="#D55E00" stroke="#FFD36A" strokeWidth="1.5" />
      {flare.cloud && (
        <g fill="#E8E6F0">
          <circle cx="104" cy="38" r="10" />
          <circle cx="116" cy="34" r="12" />
          <circle cx="122" cy="44" r="8" />
          <circle cx="92" cy="44" r="3" opacity="0.7" />
          <circle cx="86" cy="40" r="2" opacity="0.5" />
        </g>
      )}
    </svg>
  )
}

export function FlareSun({ flare, showSide = true, width = 128, label = true }: { flare: Clues; showSide?: boolean; width?: number; label?: boolean }) {
  const [words, setWords] = useState(false)
  const level = sizeLevel(flare.class)
  const text = `${flare.class}, ${flare.cloud ? 'gas cloud' : 'no gas cloud'}${showSide ? `, ${flare.side} side` : ''}`
  const accessible = `A flare. Size ${level} of 3. ${flare.cloud ? 'A gas cloud leaves the Sun.' : 'No gas cloud.'}${showSide ? ` On the ${flare.side} side.` : ''}`
  return (
    <button className="flaresun" onClick={() => setWords((w) => !w)} aria-label={accessible} aria-pressed={words} title={text} style={{ width }}>
      <FlareArt flare={flare} showSide={showSide} />
      {label && words && <span className="flaretext">{text}</span>}
    </button>
  )
}

/** Day 1 / 2 / 3 of a flare watch as three dots, not words. */
export function WatchDots({ day }: { day: number }) {
  return (
    <span className="dots" role="img" aria-label={`Day ${day} of 3`}>
      {[1, 2, 3].map((d) => (
        <i key={d} className={d <= day ? 'on' : undefined} />
      ))}
    </span>
  )
}

const GUESS_LABEL: Record<Guess, string> = { yes: 'Space rays: yes', no: 'No space rays', unsure: 'Not sure' }

export function GuessIcon({ guess, size = 40 }: { guess: Guess; size?: number }) {
  if (guess === 'yes') return <CloudRain size={size} color="var(--radiation)" aria-hidden="true" />
  if (guess === 'no') return <Sun size={size} color="var(--sun)" aria-hidden="true" />
  return <CircleHelp size={size} color="var(--muted)" aria-hidden="true" />
}

/** Three big picture buttons: rays raining, a calm Sun, or a question mark. */
export function GuessPicker({ value, onPick }: { value: Guess | null; onPick: (g: Guess) => void }) {
  return (
    <div className="guess" role="group" aria-label="Will space rays come?">
      {(['yes', 'no', 'unsure'] as const).map((g) => (
        <button key={g} aria-label={GUESS_LABEL[g]} aria-pressed={value === g} onClick={() => onPick(g)}>
          <GuessIcon guess={g} size={40} />
        </button>
      ))}
    </div>
  )
}

/** The reveal: what the child guessed next to what NASA's record says, and the science a good read earned. No sentences. */
export function GuessReveal({ guess, followed, reward }: { guess: Guess | null; followed: boolean; reward: number }) {
  const right = (guess === 'yes' && followed) || (guess === 'no' && !followed)
  const words = `${guess ? `You guessed: ${GUESS_LABEL[guess]}.` : 'No guess.'} NASA's record: ${followed ? 'rays came' : 'no rays'}.${reward > 0 ? ` Good read, plus ${reward} science.` : ''}`
  return (
    <span className="reveal" role="img" aria-label={words}>
      {guess ? <GuessIcon guess={guess} size={30} /> : <span className="noguess" />}
      {guess && guess !== 'unsure' ? right ? <Check size={22} color="var(--plants)" aria-hidden="true" /> : <X size={22} color="var(--muted)" aria-hidden="true" /> : null}
      <span className="nasa">
        <BadgeCheck size={20} aria-hidden="true" />
        <GuessIcon guess={followed ? 'yes' : 'no'} size={30} />
      </span>
      {reward > 0 && <b className="plus">+{reward}</b>}
    </span>
  )
}
