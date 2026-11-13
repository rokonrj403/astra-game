import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { BookOpen, Database, GraduationCap, Hand, Layers, Settings as SettingsIcon, SlidersHorizontal, Star, Sun, Volume2, VolumeX, X } from 'lucide-react'
import { flareSound, shieldHum, shieldHumStop } from '../audio'
import { CALM_MODEL, MoonBaseScene, type CrewId, type FlareView, type RevealView, type SceneModel } from '../scene'
import { art } from '../scene/motion'

/**
 * The Start screen's attract loop: a short picture story that repeats, with no words.
 * Every 8 seconds a flare bursts on the Sun, rays streak toward the base, the shield lights up and blocks them,
 * then one crew face peeks out of the habitat and waves. Built from the real MoonBaseScene, so it looks like the game.
 */
export const CYCLE_MS = 8000
export type AttractPhase = 'idle' | 'flare' | 'rays' | 'wave'

/** Where in the 8-second loop we are. Pure, so it can be tested. */
export function phaseAt(ms: number): AttractPhase {
  const t = ((ms % CYCLE_MS) + CYCLE_MS) % CYCLE_MS
  if (t < 1000) return 'idle'
  if (t < 2200) return 'flare'
  if (t < 4600) return 'rays'
  if (t < 7200) return 'wave'
  return 'idle'
}

export const PEEKERS: CrewId[] = ['kofi', 'safia', 'leo', 'mei']
/** Rays in one shower. 14 is inside the brief's 12 to 20, and with a full shield the game's own table lets at most 1 in 14 slip through (a faint dot on the ground, not a flash). */
export const ATTRACT_RAYS = 14
/** Day 5 of 10 puts the Sun high in the sky, well above the dome, so the rays have a long way to fall. */
export const ATTRACT_DAY = 5

/** The scene the attract loop draws for a phase: the base is lived in (lights on, plants, shield charged) and the Sun shows a flare while it bursts. */
export function attractModel(phase: AttractPhase): SceneModel {
  const flare: FlareView | null = phase === 'flare' || phase === 'rays' ? { size: 'medium', cloud: false, side: 'west', daysSince: 0 } : null
  return {
    ...CALM_MODEL,
    day: ATTRACT_DAY,
    shield: 6,
    blocks: { air: 2, shield: 0, plants: 2, radio: 1, walk: 0 },
    flare,
    moods: { safia: 'happy', kofi: 'happy', leo: 'happy', mei: 'happy' },
  }
}

export function attractReveal(phase: AttractPhase, cycle: number): RevealView | null {
  return phase === 'rays' ? { kind: 'rays', shield: 6, count: ATTRACT_RAYS, side: 'west', fromSun: true, key: `attract-${cycle}` } : null
}

/** Runs the loop. With `still` (reduced motion or Calm) nothing ever changes: one calm picture. */
export function useAttract(still: boolean): { phase: AttractPhase; cycle: number } {
  const [s, setS] = useState<{ phase: AttractPhase; cycle: number }>({ phase: 'idle', cycle: 0 })
  useEffect(() => {
    if (still) return
    const t0 = Date.now()
    const id = setInterval(() => {
      const ms = Date.now() - t0
      const next = { phase: phaseAt(ms), cycle: Math.floor(ms / CYCLE_MS) }
      setS((p) => (p.phase === next.phase && p.cycle === next.cycle ? p : next))
    }, 200)
    return () => clearInterval(id)
  }, [still])
  return s
}

/** Quiet sounds for the loop: a soft whoosh when the flare bursts, a gentle hum while the shield takes the rays. Nothing plays before a first tap or while muted. */
export function useAttractSound(phase: AttractPhase, still: boolean): void {
  useEffect(() => {
    if (still) return
    if (phase === 'flare') flareSound({ size: 1, cloud: false, side: 'center' })
    else if (phase === 'rays') shieldHum(3)
    else shieldHumStop()
  }, [phase, still])
  useEffect(() => () => shieldHumStop(), [])
}

/** The base, the Sun and the loop. The picture is for looking only: nothing in it can be tapped (a tap goes to the screen behind it). */
/** Memoised, so a tap on Play (which re-renders the Start screen) does not redraw the whole scene in the middle of the zoom. */
export const AttractScene = memo(function AttractScene({ still }: { still: boolean }) {
  const { phase, cycle } = useAttract(still)
  useAttractSound(phase, still)
  const peeker = PEEKERS[cycle % PEEKERS.length] as CrewId
  return (
    <div className="attract-scene" role="img" aria-label="The Moon base. A flare bursts on the Sun and the shield blocks the rays." data-phase={phase} data-still={still ? 'yes' : 'no'}>
      <div className="attract-inner" inert>
        <MoonBaseScene model={attractModel(phase)} reveal={attractReveal(phase, cycle)} steppers="never" calm={still} lowEnd={false} hideOrbi crew={[]} noShelter transitionMs={still ? 0 : 480}>
          {phase === 'wave' && !still && (
            <span className="peek" key={cycle} aria-hidden="true">
              <img src={art(`crew/${peeker}-happy.webp`)} alt="" width={30} height={30} />
              <Hand size={15} className="peek-hand" />
            </span>
          )}
        </MoonBaseScene>
      </div>
    </div>
  )
})

/** What is ahead, as pictures only: 10 days, the 4 crew, the science star. */
export function AheadRow() {
  return (
    <div className="ahead" role="img" aria-label="10 days, 4 crew, one science goal">
      <span className="ahead-days" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      <span className="ahead-crew" aria-hidden="true">
        {PEEKERS.map((id) => (
          <img key={id} src={art(`crew/${id}-happy.webp`)} alt="" width={26} height={26} />
        ))}
      </span>
      <Star size={26} color="var(--sun)" fill="var(--sun)" aria-hidden="true" className="ahead-star" />
    </div>
  )
}

export function SoundButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const Icon = on ? Volume2 : VolumeX
  return (
    <button type="button" className="iconbtn corner" onClick={onToggle} aria-pressed={on} aria-label="Sound">
      <Icon size={24} aria-hidden="true" />
    </button>
  )
}

/** The adult pages, behind one small gear. */
export function GearSheet({
  onSun,
  onCards,
  onData,
  onTeachers,
  onSettings,
}: {
  onSun: () => void
  onCards: () => void
  onData: () => void
  onTeachers: () => void
  onSettings: () => void
}): ReactNode {
  const [open, setOpen] = useState(false)
  const gear = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        gear.current?.focus()
      }
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open])
  const items: [() => void, typeof Sun, string][] = [
    [onSun, Sun, 'Today’s Sun'],
    [onCards, Layers, 'My storm cards'],
    [onData, Database, 'Where the data comes from'],
    [onTeachers, GraduationCap, 'For teachers'],
    [onSettings, SettingsIcon, 'Settings'],
  ]
  return (
    <>
      <button ref={gear} type="button" className="iconbtn corner" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-label="More">
        <SlidersHorizontal size={22} aria-hidden="true" />
      </button>
      {open && (
        <div className="sheet-scrim" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="More" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-top">
              <button type="button" className="iconbtn sheet-close" onClick={() => setOpen(false)} aria-label="Close">
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <div className="sheet-grid">
              {items.map(([go, Icon, label]) => (
                <button key={label} type="button" className="iconbtn big" onClick={go} aria-label={label} title={label}>
                  <Icon size={26} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function JournalButton({ onJournal }: { onJournal: () => void }) {
  return (
    <button type="button" className="iconbtn journalbtn" onClick={onJournal} aria-label="Flare Journal" title="Flare Journal">
      <BookOpen size={30} aria-hidden="true" />
    </button>
  )
}
