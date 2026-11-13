import type { ReactNode } from 'react'
import { CREW_POS, ORBI_POS } from './Actors'
import type { CrewId } from './model'
import { H, PAL, W } from './tokens'

/** A picture button: at least 64 x 64 px, named for screen readers, never a word on screen. */
export function PictureButton({ label, onClick, children, pressed, size = 64 }: { label: string; onClick?: () => void; children: ReactNode; pressed?: boolean; size?: number }) {
  return (
    <button type="button" className="sc-pic" aria-label={label} aria-pressed={pressed} style={{ width: size, height: size, minWidth: 64, minHeight: 64 }} onClick={onClick}>
      {children}
    </button>
  )
}

interface BubbleBoxProps {
  /** Where the tail points, on the 360 x 440 board. */
  anchor: { x: number; y: number }
  width?: number
  children: ReactNode
  label: string
  className?: string
}

/** The speech bubble itself: sits above its anchor, kept inside the scene, with a tail that points at the speaker. */
function BubbleBox({ anchor, width = 232, children, label, className }: BubbleBoxProps) {
  const left = Math.max(8, Math.min(W - width - 8, anchor.x - width / 2))
  const tail = Math.max(18, Math.min(width - 18, anchor.x - left))
  return (
    <div
      className={`sc-bubble ${className ?? ''}`}
      role="group"
      aria-label={label}
      style={{ left: `${(left / W) * 100}%`, bottom: `${((H - anchor.y + 22) / H) * 100}%`, width: `${(width / W) * 100}%`, ['--tail' as string]: `${tail}px`, ['--origin' as string]: `${tail}px 100%` }}
    >
      <div className="sc-bubble-body">{children}</div>
      <span className="sc-tail" aria-hidden="true" />
    </div>
  )
}

/** A crew member's speech bubble: put a picture and two PictureButtons in it. Anchored above that crew member. */
export function CrewBubble({ who, sheltered = false, children }: { who: CrewId; sheltered?: boolean; children: ReactNode }) {
  const p = sheltered ? CREW_POS[who].shelter : CREW_POS[who].home
  return (
    <BubbleBox anchor={{ x: p.x, y: p.y + (sheltered ? 8 : 0) - 16 }} label={`${who} says`} className="crew-bubble">
      {children}
    </BubbleBox>
  )
}

export type Guess = 'rays' | 'calm' | 'unsure'

/** Rays raining: a cloud-less sky with three falling streaks. */
export function RaysIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      <circle cx="22" cy="10" r="6" fill={PAL.warn} />
      <g stroke={PAL.sun} strokeWidth="4" strokeLinecap="round">
        <line x1="10" y1="20" x2="14" y2="32" />
        <line x1="22" y1="22" x2="22" y2="38" />
        <line x1="34" y1="20" x2="30" y2="32" />
      </g>
      <path d="M8 40 L36 40" stroke={PAL.cream} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Calm Sun: a round Sun with a gentle smile and a tick, nothing falling. */
export function CalmIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      <circle cx="22" cy="22" r="12" fill={PAL.sun} />
      <g stroke={PAL.sun} strokeWidth="3" strokeLinecap="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1="22" y1="4" x2="22" y2="7.5" transform={`rotate(${a} 22 22)`} />
        ))}
      </g>
      <path d="M15 24 Q22 31 29 24" fill="none" stroke={PAL.night} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="17.5" cy="19" r="1.6" fill={PAL.night} />
      <circle cx="26.5" cy="19" r="1.6" fill={PAL.night} />
    </svg>
  )
}

/** Not sure: a question mark. */
export function UnsureIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      <path d="M14 16 Q14 7 22 7 Q31 7 31 15 Q31 20 25 24 Q22 26 22 30" fill="none" stroke={PAL.cream} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="38" r="3.2" fill={PAL.cream} />
    </svg>
  )
}

/**
 * ORBI asks a question with pictures: space rays raining, a calm Sun, or a question mark. Three 64 px buttons, no words.
 * `picked` shows what was chosen (a ring), so the choice is visible after the tap.
 */
export function OrbiBubble({ onGuess, picked = null }: { onGuess?: (g: Guess) => void; picked?: Guess | null }) {
  const choices: { g: Guess; label: string; icon: ReactNode }[] = [
    { g: 'rays', label: 'Space rays', icon: <RaysIcon /> },
    { g: 'calm', label: 'Calm Sun', icon: <CalmIcon /> },
    { g: 'unsure', label: 'Not sure', icon: <UnsureIcon /> },
  ]
  return (
    <BubbleBox anchor={{ x: ORBI_POS.x + 22, y: ORBI_POS.y - 4 }} label="ORBI asks" className="orbi-bubble" width={236}>
      <div className="sc-choices">
        {choices.map((c) => (
          <PictureButton key={c.g} label={c.label} pressed={picked === null ? undefined : picked === c.g} onClick={() => onGuess?.(c.g)}>
            {c.icon}
          </PictureButton>
        ))}
      </div>
    </BubbleBox>
  )
}
