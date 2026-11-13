import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Heart, Shield, SkipForward, Star, ThumbsUp, Zap, type LucideIcon } from 'lucide-react'
import { blockPlaced, flareSound, orbiHello, raysArrive, scienceGained, soundEnabled } from '../audio'
import { MODES } from '../engine/constants'
import type { Mode } from '../engine/types'
import { CALM_MODEL, CREW_JOB, CREW_POS, JOB_COLOR, JOB_ICON, MeterStrip, MoonBaseScene, PowerTray, sunPos, type CrewId, type FlareView, type JobId, type RevealView, type SceneHandle, type SceneModel, type Target } from '../scene'
import { art } from '../scene/motion'
import { PAL } from '../scene/tokens'
import { CREW } from './look'
import { prefersReducedMotion } from './motion'
import { canSpeak, speak } from './speech'

/**
 * The welcome tour, part 1 (meet the crew) and part 2 (meet the base), played in the real Moon base scene.
 * Every caption is 3 words or fewer, shown with one picture, and read aloud by ORBI (the device's own voice, only if sound is on).
 * A Skip button shows from the first second. Reduced motion and Calm play the same steps as still pictures.
 * <WelcomeIntro onDone onSkip /> does not know about saving or about Day 1: the caller decides what happens next.
 */
export type WelcomeStepId = 'lander' | 'crew-safia' | 'crew-kofi' | 'crew-leo' | 'crew-mei' | 'orbi' | 'b-air' | 'b-plants' | 'b-radio' | 'b-shield' | 'power' | 'rays' | 'goal'

export interface WelcomeStep {
  id: WelcomeStepId
  part: 1 | 2
  /** How long the step lasts, in ms. */
  ms: number
  /** The words on screen (3 or fewer; empty = picture only). */
  caption: string
  /** What ORBI reads aloud (also 3 words or fewer). */
  say: string
}

const crew = (id: CrewId): WelcomeStep => {
  const name = CREW.find((c) => c.id === id)?.name ?? id
  return { id: `crew-${id}` as WelcomeStepId, part: 1, ms: 2500, caption: name, say: name }
}

/** The steps in order. Part 1 is about 15 s and part 2 about 17 s (Cadet) or 19 s (Commander, which adds the food beat). */
export function welcomeSteps(mode: Mode): WelcomeStep[] {
  const b = (id: WelcomeStepId, word: string): WelcomeStep => ({ id, part: 2, ms: 2000, caption: word, say: word })
  return [
    { id: 'lander', part: 1, ms: 3000, caption: '', say: '' },
    crew('safia'),
    crew('kofi'),
    crew('leo'),
    crew('mei'),
    { id: 'orbi', part: 1, ms: 2500, caption: 'Keep them safe', say: 'Keep them safe' },
    b('b-air', 'Air'),
    ...(mode === 'commander' ? [b('b-plants', 'Food')] : []),
    b('b-radio', 'Radio'),
    b('b-shield', 'Shield'),
    { id: 'power', part: 2, ms: 3200, caption: 'Sun = power', say: 'Sun gives power' },
    { id: 'rays', part: 2, ms: 3600, caption: 'Shield stops rays', say: 'Shield stops rays' },
    { id: 'goal', part: 2, ms: 5000, caption: 'Walk = stars', say: 'Walk makes stars' },
  ]
}

export const stepsMs = (steps: WelcomeStep[], part?: 1 | 2): number => steps.filter((s) => part === undefined || s.part === part).reduce((n, s) => n + s.ms, 0)

/** Which step is playing `ms` after the start, and whether the tour is over. */
export function stepAt(steps: WelcomeStep[], ms: number): { index: number; done: boolean } {
  let t = 0
  for (let i = 0; i < steps.length; i++) {
    t += (steps[i] as WelcomeStep).ms
    if (ms < t) return { index: i, done: false }
  }
  return { index: steps.length - 1, done: true }
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
export const lineWords = (s: WelcomeStep): number => Math.max(wordCount(s.caption), wordCount(s.say))

/** Which building each tour step lights up, and which bar it feeds (the labels of the Base bars). */
const BUILDING: Partial<Record<WelcomeStepId, { target: Target; job: JobId; meter: string }>> = {
  'b-air': { target: 'air', job: 'air', meter: 'Air' },
  'b-plants': { target: 'plants', job: 'plants', meter: 'Food' },
  'b-radio': { target: 'radio', job: 'radio', meter: 'Science goal' },
  'b-shield': { target: 'shield', job: 'shield', meter: 'Radiation' },
}

const CREW_ORDER: CrewId[] = ['safia', 'kofi', 'leo', 'mei']
/** The crew on the ground at each step. */
export function crewOut(id: WelcomeStepId): CrewId[] {
  if (id === 'lander') return []
  const i = CREW_ORDER.findIndex((c) => `crew-${c}` === id)
  return i >= 0 ? CREW_ORDER.slice(0, i + 1) : CREW_ORDER
}

const HATCH = { x: 180, y: 352 } as const
/** Where ORBI stands at each step (top left of its 44 px picture on the 360 x 440 board). */
const ORBI_AT: Partial<Record<WelcomeStepId, { x: number; y: number }>> = {
  orbi: { x: 24, y: 350 },
  'b-air': { x: 150, y: 326 },
  'b-plants': { x: 258, y: 326 },
  'b-radio': { x: 300, y: 330 },
  'b-shield': { x: 196, y: 330 },
  power: { x: 24, y: 350 },
  rays: { x: 196, y: 330 },
  goal: { x: 72, y: 326 },
}

const CAPTION_ICON: Partial<Record<WelcomeStepId, { Icon: LucideIcon; color: string }>> = {
  'crew-safia': { Icon: JOB_ICON[CREW_JOB.safia], color: JOB_COLOR[CREW_JOB.safia] },
  'crew-kofi': { Icon: JOB_ICON[CREW_JOB.kofi], color: JOB_COLOR[CREW_JOB.kofi] },
  'crew-leo': { Icon: JOB_ICON[CREW_JOB.leo], color: JOB_COLOR[CREW_JOB.leo] },
  'crew-mei': { Icon: JOB_ICON[CREW_JOB.mei], color: JOB_COLOR[CREW_JOB.mei] },
  orbi: { Icon: Heart, color: 'var(--radiation, #D55E00)' },
  'b-air': { Icon: JOB_ICON.air, color: JOB_COLOR.air },
  'b-plants': { Icon: JOB_ICON.plants, color: JOB_COLOR.plants },
  'b-radio': { Icon: JOB_ICON.radio, color: JOB_COLOR.radio },
  'b-shield': { Icon: JOB_ICON.shield, color: JOB_COLOR.shield },
  power: { Icon: Zap, color: 'var(--power, #F0E442)' },
  rays: { Icon: Shield, color: 'var(--power, #F0E442)' },
  goal: { Icon: Star, color: 'var(--sun, #E69F00)' },
}

interface Flyer {
  id: string
  Icon: LucideIcon
  color: string
  x: number
  y: number
  dx: number
  dy: number
  delay: number
}

const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
const pct = (x: number, y: number) => ({ left: `${(x / 360) * 100}%`, top: `${(y / 440) * 100}%` })

function Lander({ open, landed }: { open: boolean; landed: boolean }) {
  return (
    <g transform={`translate(${HATCH.x} ${HATCH.y})`} data-lander={open ? 'open' : 'closed'}>
      <g className="wl-drop">
        <path d="M-24 16 L-34 34 M24 16 L34 34" stroke={PAL.line} strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M-24 16 L-18 -26 Q0 -40 18 -26 L24 16Z" fill="#dfe3ea" stroke={PAL.line} strokeWidth="2" strokeLinejoin="round" />
        <circle cx="0" cy="-16" r="6" fill={PAL.air} stroke={PAL.line} strokeWidth="1.5" />
        <rect x="-9" y="-4" width="18" height="20" rx="4" fill={open ? '#27324f' : '#9aa3b5'} stroke={PAL.line} strokeWidth="1.5" />
      </g>
      {landed && (
        <g className="wl-dust" fill="#cfd3dc" opacity="0.8">
          <circle cx="-30" cy="34" r="7" />
          <circle cx="0" cy="38" r="9" />
          <circle cx="30" cy="34" r="7" />
        </g>
      )}
    </g>
  )
}

export interface WelcomeIntroProps {
  mode?: Mode
  /** The tour ran to the end. */
  onDone: () => void
  /** The child tapped Skip. */
  onSkip: () => void
}

export function WelcomeIntro({ mode = 'cadet', onDone, onSkip }: WelcomeIntroProps): ReactNode {
  const steps = useMemo(() => welcomeSteps(mode), [mode])
  const [index, setIndex] = useState(0)
  const step = steps[index] as WelcomeStep
  const still = prefersReducedMotion()
  const scene = useRef<SceneHandle>(null)
  const strip = useRef<HTMLDivElement>(null)
  const tray = useRef<HTMLDivElement>(null)
  const done = useRef(onDone)
  done.current = onDone
  const finished = useRef(false)
  const [fly, setFly] = useState<Flyer[]>([])
  const [pulse, setPulse] = useState<string | null>(null)
  const [trayLeft, setTrayLeft] = useState(0)
  const [walkOn, setWalkOn] = useState(false)
  const [walked, setWalked] = useState(false)

  const total = MODES[mode].days
  const goal = MODES[mode].goal
  const reached = (id: WelcomeStepId) => {
    const at = steps.findIndex((s) => s.id === id)
    return at >= 0 && index >= at
  }

  // Move on when the step's time is up.
  useEffect(() => {
    const t = setTimeout(() => {
      if (index + 1 < steps.length) setIndex(index + 1)
      else if (!finished.current) {
        finished.current = true
        done.current()
      }
    }, step.ms)
    return () => clearTimeout(t)
  }, [index, step.ms, steps.length])

  // ORBI reads each line, in the device's own voice, only when sound is on and a person has already tapped.
  useEffect(() => {
    if (step.say && soundEnabled()) speak(step.say)
  }, [step])
  useEffect(
    () => () => {
      if (canSpeak()) window.speechSynthesis.cancel()
    },
    [],
  )

  // What happens inside each step.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))
    setFly([])
    setPulse(null)
    const b = BUILDING[step.id]
    if (b) {
      const from = scene.current?.centerOf(b.target)
      const to = strip.current?.querySelector(`[aria-label="${b.meter}"]`)?.getBoundingClientRect()
      if (!still && from && to) {
        const c = centre(to)
        setFly([{ id: step.id, Icon: JOB_ICON[b.job], color: JOB_COLOR[b.job], x: from.x, y: from.y, dx: c.x - from.x, dy: c.y - from.y, delay: 300 }])
        later(1000, () => setPulse(b.meter))
      } else setPulse(b.meter)
    }
    if (step.id === 'orbi') orbiHello()
    if (step.id === 'power') {
      const rect = scene.current?.rect()
      const sun = sunPos(Math.round(total / 2), total)
      const to = tray.current?.getBoundingClientRect()
      for (let i = 0; i < 6; i++) {
        later(500 + i * 380, () => {
          blockPlaced()
          setTrayLeft(i + 1)
        })
      }
      if (!still && rect && to) {
        const from = { x: rect.left + (sun.x * rect.width) / 360, y: rect.top + (sun.y * rect.height) / 440 }
        const c = centre(to)
        setFly(Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, Icon: Zap, color: 'var(--power, #F0E442)', x: from.x, y: from.y, dx: c.x - 120 + i * 48 - from.x, dy: c.y - from.y, delay: 200 + i * 380 })))
      } else setTrayLeft(6)
    }
    if (step.id === 'rays') {
      flareSound({ size: 2, cloud: false, side: 'center' })
      later(1500, () => void raysArrive(6))
    }
    if (step.id === 'goal') {
      setPulse('Science goal')
      later(1400, () => setWalkOn(true))
    }
    return () => timers.forEach(clearTimeout)
  }, [step.id, still, total])

  const model: SceneModel = useMemo(() => {
    const flare: FlareView | null = step.id === 'rays' ? { size: 'medium', cloud: false, side: 'west', daysSince: 0 } : null
    return { ...CALM_MODEL, day: Math.round(total / 2), totalDays: total, shield: reached('rays') ? 6 : 0, flare, showSide: false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total])
  const reveal: RevealView | null = step.id === 'rays' ? { kind: 'rays', shield: 6, count: 14, fromSun: true, key: 'wl-rays' } : null
  const hot: Target | null = BUILDING[step.id]?.target ?? (step.id === 'rays' ? 'shield' : step.id === 'goal' ? 'walk' : null)
  const orbiAt = ORBI_AT[step.id] ?? (reached('orbi') ? ORBI_AT.goal : undefined)
  const out = crewOut(step.id)
  const shown = CAPTION_ICON[step.id]
  const Icon = shown?.Icon

  const layers = (
    <>
      <Lander open={reached('crew-safia')} landed={!still && step.id === 'lander'} />
      {orbiAt && reached('orbi') && (
        <g className="wl-orbi-pos" style={{ transform: `translate(${orbiAt.x}px, ${orbiAt.y}px)` }}>
          <g className="wl-hop" style={{ ['--dx' as string]: `${HATCH.x - orbiAt.x}px`, ['--dy' as string]: `${HATCH.y - orbiAt.y}px` }}>
            <image className="wl-wag" href={art('orbi/orbi-open.webp')} width="44" height="44" aria-hidden="true" />
          </g>
        </g>
      )}
    </>
  )

  return (
    <main className={`app living welcome${still ? ' still' : ' motion'}`} data-step={step.id} data-part={step.part}>
      <div className="livetop">
        <span className="wl-dots" role="img" aria-label={`Part ${step.part} of 2`}>
          <i className={step.part === 1 ? 'on' : undefined} />
          <i className={step.part === 2 ? 'on' : undefined} />
        </span>
        <button type="button" className="iconbtn wl-skip" onClick={onSkip} aria-label="Skip" title="Skip">
          <SkipForward size={24} aria-hidden="true" />
        </button>
      </div>
      <MoonBaseScene
        ref={scene}
        model={model}
        reveal={reveal}
        calm={still}
        hideOrbi
        crew={out}
        crewFrom={HATCH}
        hot={hot}
        steppers="never"
        lowEnd={false}
        transitionMs={still ? 0 : 480}
        layers={layers}
        walk={
          walkOn
            ? {
                kind: 'short',
                mode: 'run',
                key: 'wl-walk',
                onDone: () => {
                  setWalked(true)
                  scienceGained()
                },
              }
            : null
        }
      >
        {out.map((id) => {
          const job = CREW_JOB[id]
          const J = JOB_ICON[job]
          const home = CREW_POS[id].home
          return (
            <span key={id} className={`wl-bubble${step.id === `crew-${id}` ? ' pop' : ''}`} style={pct(home.x, home.y - 40)} data-job={job}>
              <J size={20} color={JOB_COLOR[job]} aria-hidden="true" />
            </span>
          )
        })}
        {step.id === 'rays' && (
          <span className="wl-bubble pop thumbs" style={pct((orbiAt?.x ?? 196) + 30, (orbiAt?.y ?? 330) - 10)}>
            <ThumbsUp size={20} color="var(--plants, #009E73)" aria-hidden="true" />
          </span>
        )}
        {walked && (
          <span className="wl-bubble pop star" style={pct(87, 244)}>
            <Star size={22} color="var(--sun, #E69F00)" fill="var(--sun, #E69F00)" aria-hidden="true" />
          </span>
        )}
      </MoonBaseScene>
      <div className="wl-strip" ref={strip} data-pulse={pulse ?? ''}>
        <MeterStrip values={{ air: 80, power: 75, radiation: 10, food: 70 }} hasFood={mode === 'commander'} science={{ value: walked ? 6 : 0, goal }} />
      </div>
      <div ref={tray}>
        <PowerTray blocks={trayLeft} calm={still} disabled resolve={() => null} onDrop={() => undefined} />
      </div>
      <div className="wl-caption" role="status" aria-live="polite">
        {Icon && <Icon key={step.id} size={40} color={shown?.color} aria-hidden="true" className="wl-fade" />}
        {step.caption && (
          <b key={`${step.id}-c`} className="wl-fade">
            {step.caption}
          </b>
        )}
      </div>
      {fly.map((f) => (
        <span key={f.id} className="wl-fly" aria-hidden="true" style={{ left: f.x, top: f.y, ['--dx' as string]: `${f.dx}px`, ['--dy' as string]: `${f.dy}px`, animationDelay: `${f.delay}ms` }}>
          <f.Icon size={22} color={f.color} />
        </span>
      ))}
    </main>
  )
}
