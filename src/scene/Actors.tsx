import type { CrewId, Mood } from './model'
import { art } from './motion'
import { PAL } from './tokens'

/** Where each crew member stands, and where they go when a storm is here (inside the dome, near the habitat). */
export const CREW_POS: Record<CrewId, { home: { x: number; y: number }; shelter: { x: number; y: number } }> = {
  safia: { home: { x: 266, y: 228 }, shelter: { x: 236, y: 236 } },
  kofi: { home: { x: 87, y: 238 }, shelter: { x: 150, y: 226 } },
  leo: { home: { x: 180, y: 214 }, shelter: { x: 180, y: 214 } },
  mei: { home: { x: 328, y: 208 }, shelter: { x: 212, y: 226 } },
}
export const ORBI_POS = { x: 8, y: 350 } as const
export const CREW_SIZE = 34

const NAME: Record<CrewId, string> = { safia: 'Safia', kofi: 'Kofi', leo: 'Leo', mei: 'Mei' }

/** Small roof glyph over a sheltering crew member. */
function Roof() {
  return <path d="M-11 -2 L0 -11 L11 -2" fill="none" stroke={PAL.cream} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
}

export interface CrewTokenProps {
  id: CrewId
  mood: Mood
  /** A storm is here: the crew drops into the dome behind a roof glyph. */
  sheltered?: boolean
  /** This one is outside in the storm: it shakes. */
  unsafe?: boolean
  /** Nudge to show the crew is alive. Off with reduced motion by CSS. */
  bob?: boolean
}

/** A crew face (the existing art, with its cream plate) at its post. */
export function CrewToken({ id, mood, sheltered = false, unsafe = false, bob = true }: CrewTokenProps) {
  const p = CREW_POS[id]
  const at = sheltered ? p.shelter : p.home
  const drop = sheltered ? 8 : 0
  return (
    <g className="sc-move sc-crew" data-crew={id} data-mood={mood} data-sheltered={sheltered ? 'yes' : 'no'} style={{ transform: `translate(${at.x}px, ${at.y + drop}px)` }}>
      <g className={`${bob && !sheltered ? 'sc-bob' : ''}${unsafe ? ' sc-shake' : ''}`} style={{ animationDelay: `${(id.length * 170) % 600}ms` }}>
        <image href={art(`crew/${id}-${mood}.webp`)} x={-CREW_SIZE / 2} y={-CREW_SIZE / 2} width={CREW_SIZE} height={CREW_SIZE} role="img" aria-label={`${NAME[id]}, ${mood}`} />
      </g>
      <g className="sc-fade" opacity={sheltered ? 1 : 0} transform={`translate(0 ${-CREW_SIZE / 2 - 1})`}>
        <Roof />
      </g>
    </g>
  )
}

/** ORBI the robot dog (existing art, unchanged). Its head tilts when something is going on, and it blinks now and then. */
export function OrbiToken({ alert = false, look = 'open', size = 44 }: { alert?: boolean; look?: 'open' | 'curious'; size?: number }) {
  return (
    <g className="sc-orbi" data-alert={alert ? 'yes' : 'no'} transform={`translate(${ORBI_POS.x} ${ORBI_POS.y})`}>
      <g className="sc-move sc-orbi-tilt" style={{ transform: `rotate(${alert ? -6 : 0}deg)`, transformOrigin: `${size / 2}px ${size}px` }}>
        <image href={art(`orbi/orbi-${alert ? 'curious' : look}.webp`)} width={size} height={size} role="img" aria-label="ORBI, the robot dog" />
        <image className="sc-orbi-blink" href={art('orbi/orbi-blink.webp')} width={size} height={size} aria-hidden="true" />
      </g>
    </g>
  )
}
