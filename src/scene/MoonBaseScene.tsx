import { useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import { sceneLabel } from '../ui/look'
import { CrewToken, OrbiToken } from './Actors'
import { Airlock, BuildingTarget, DomeTarget, Dish, Greenhouse, Ground, Habitat, PIP_SPOTS, Pips, SolarPanels, Stepper } from './Buildings'
import { CloudLane, type CloudState } from './CloudLane'
import { AllClear, DomeShield, Rays, hitTimes, hitsPerSegment, planRays } from './Dome'
import type { CrewId, FlareView, RevealView, SceneModel, Target } from './model'
import { TARGETS } from './model'
import { isLowEnd } from './motion'
import { ClueTags, Sky, Sun } from './Sky'
import { H, RAYS, W, sunPos } from './tokens'
import { Walker, WalkTrail, type WalkKind, type WalkMode } from './Walker'
import { clientToScene, hitZone, zoneCenter, ZONES } from './zones'
import './scene.css'

/** What a parent can ask the scene: which building is under a finger, and where a building is on screen. */
export interface SceneHandle {
  /** The building under a screen point, or null. Closed buildings (the dish when Earth is hidden) are skipped. */
  jobAt: (clientX: number, clientY: number) => Target | null
  /** The middle of a building in screen pixels (where a flying block lands), or null if the scene is not on screen. */
  centerOf: (t: Target) => { x: number; y: number } | null
  /** The scene's box on screen. */
  rect: () => DOMRect | null
}

export interface MoonBaseSceneProps {
  model: SceneModel
  /** The reveal moment: rays fall on the dome, or the all-clear. Pass the flare (daysSince 3) too, if it had a gas cloud, so the cloud arrives or slides past. */
  reveal?: RevealView | null
  /** An astronaut walking now (out and back). Give a new `key` for each walk. */
  walk?: { kind: WalkKind; mode?: WalkMode; key: string | number; onDone?: () => void } | null
  /** A building the player is dragging a block over (it glows). */
  hot?: Target | null
  /** Blocks still free to give today. Default: 6 minus the blocks already placed. */
  blocksLeft?: number
  /** +/- buttons: under the chosen building (default), under all of them, or never. */
  steppers?: 'selected' | 'always' | 'never'
  /** Vertical centre of the +/- buttons on the 360 x 440 board (default 330). Raised while a bubble sits in the ground band. */
  stepperY?: number
  onAdd?: (t: Target) => void
  onRemove?: (t: Target) => void
  onSunTap?: () => void
  /** Optional tiny labels shown on tap or long-press (default none: the scene has no words). */
  clueTags?: string[]
  tagsOpen?: boolean
  /** Dim the sky (the "next day" wait). */
  dim?: boolean
  /** How long a state change takes, in ms (the time-lapse uses 900). */
  transitionMs?: number
  /** Crew who are outside in a storm (they shake). */
  unsafe?: CrewId[]
  /** Calm mode: instant state changes, no loops, whatever the OS says. */
  calm?: boolean
  /** Fewer particles. Default: detected. */
  lowEnd?: boolean
  /** Bubbles and other HTML laid over the picture (CrewBubble, OrbiBubble). */
  children?: ReactNode
  ref?: Ref<SceneHandle>
}

const PLANNED: Record<number, WalkKind | undefined> = { 1: 'short', 2: 'long' }

/**
 * The living Moon base, one 360 x 440 SVG (scales to the screen) with HTML bubbles laid over it.
 * Props in, picture out: nothing here reads the game or knows how a flare ends. There are no words in the picture.
 */
export function MoonBaseScene({ model, reveal = null, walk = null, hot = null, blocksLeft, steppers = 'selected', stepperY, onAdd, onRemove, onSunTap, clueTags = [], tagsOpen = false, dim = false, transitionMs = 480, unsafe = [], calm = false, lowEnd, children, ref }: MoonBaseSceneProps) {
  const root = useRef<HTMLDivElement>(null)
  const latest = useRef(model)
  latest.current = model
  const [selected, setSelected] = useState<Target | null>(null)
  const [cheap] = useState(() => lowEnd ?? isLowEnd())
  const cheapNow = lowEnd ?? cheap

  useImperativeHandle(
    ref,
    () => ({
      jobAt: (cx, cy) => {
        const r = root.current?.getBoundingClientRect()
        const p = r ? clientToScene(r, cx, cy) : null
        return p ? hitZone(p.x, p.y, { earth: latest.current.earth }) : null
      },
      centerOf: (t) => {
        const r = root.current?.getBoundingClientRect()
        if (!r || r.width <= 0) return null
        const c = zoneCenter(t)
        return { x: r.left + (c.x * r.width) / W, y: r.top + (c.y * r.height) / H }
      },
      rect: () => root.current?.getBoundingClientRect() ?? null,
    }),
    [],
  )

  const sun = sunPos(model.day, model.totalDays)
  const warn = model.storm !== 'none' || model.flare !== null
  const total = model.blocks.air + model.blocks.shield + model.blocks.plants + model.blocks.radio + model.blocks.walk
  const left = blocksLeft ?? Math.max(0, 6 - total)
  const sheltered = model.storm === 'now' || reveal?.kind === 'rays'

  // The cloud: creeping while a watch runs; at the reveal it arrives (rays) or slides past (all-clear).
  const cloudFlare: FlareView | null = model.flare
  const cloudDay = cloudFlare && cloudFlare.cloud ? (reveal ? 3 : cloudFlare.daysSince) : null
  const cloudState: CloudState = reveal ? (reveal.kind === 'clear' ? 'pass' : 'arrive') : 'creep'

  const count = reveal?.count ?? (cheapNow ? Math.round(RAYS / 2) : RAYS)
  const rays = useMemo(() => (reveal?.kind === 'rays' ? planRays(reveal.shield, count, reveal.side ?? null, sun.x) : []), [reveal, count, sun.x])
  const hits = useMemo(() => hitsPerSegment(rays), [rays])
  const hitAt = useMemo(() => hitTimes(rays), [rays])
  const charge = reveal ? reveal.shield : model.shield

  const planned = PLANNED[model.blocks.walk]
  const label = sceneLabel({ sunny: model.sunny, earth: model.earth, shield: model.shield, storm: model.storm, powerLow: model.powerLow, plantsHappy: model.plantsHappy })

  const pick = (t: Target) => setSelected((s) => (s === t ? null : t))
  const stepTargets: Target[] = steppers === 'always' ? [...TARGETS] : steppers === 'selected' && selected ? [selected] : []
  const landing = (n: number) => (n > 0 ? (n % 2 === 1 ? 'sc-land-a' : 'sc-land-b') : undefined)
  const blocks = model.blocks

  return (
    <div ref={root} className={`sc-root${calm ? ' sc-calm' : ''}`} style={{ ['--sc-t' as string]: `${transitionMs}ms` }} data-storm={model.storm} data-reveal={reveal?.kind ?? 'none'}>
      <svg className="sc-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={label} focusable="false">
        <Sky sunny={model.sunny} earth={model.earth} />
        <rect width={W} height="300" fill="transparent" onClick={() => setSelected(null)} />
        <CloudLane from={sun} daysSince={cloudDay} state={cloudState} />
        <Sun x={sun.x} y={sun.y} sunny={model.sunny} warn={warn} flare={model.flare} showSide={model.showSide} onTap={onSunTap} />
        <Ground sunX={sun.x} sunny={model.sunny} />
        <SolarPanels sunny={model.sunny} wired={total > 0} />
        <DomeTarget count={blocks.shield} hot={hot === 'shield'} selected={selected === 'shield'} onSelect={pick} />

        <BuildingTarget id="walk" label="Airlock" count={blocks.walk} hot={hot === 'walk'} selected={selected === 'walk'} onSelect={pick}>
          <g className={landing(blocks.walk)}>
            <Airlock count={blocks.walk} open={walk !== null} />
          </g>
        </BuildingTarget>
        <BuildingTarget id="air" label="Air" count={blocks.air} hot={hot === 'air'} selected={selected === 'air'} onSelect={pick}>
          <g className={landing(blocks.air)}>
            <Habitat count={blocks.air} powerLow={model.powerLow} />
          </g>
        </BuildingTarget>
        <BuildingTarget id="plants" label="Plants" count={blocks.plants} hot={hot === 'plants'} selected={selected === 'plants'} onSelect={pick}>
          <g className={landing(blocks.plants)}>
            <Greenhouse count={blocks.plants} happy={model.plantsHappy} />
          </g>
        </BuildingTarget>
        <BuildingTarget id="radio" label="Radio" count={blocks.radio} hot={hot === 'radio'} selected={selected === 'radio'} disabled={!model.earth} onSelect={pick}>
          <g className={landing(blocks.radio)}>
            <Dish count={blocks.radio} earth={model.earth} />
          </g>
        </BuildingTarget>
        {(['walk', 'air', 'plants', 'radio'] as const).map((t) => (
          <Pips key={t} cx={PIP_SPOTS[t].cx} y={PIP_SPOTS[t].y} count={blocks[t]} max={PIP_SPOTS[t].max} />
        ))}

        <g className="sc-ground-layer" style={{ pointerEvents: 'none' }}>
          {planned && !walk && <WalkTrail kind={planned} />}
          <OrbiToken alert={model.storm !== 'none' || model.flare !== null} />
          {(['safia', 'kofi', 'leo', 'mei'] as const).map((id) => (
            <CrewToken key={id} id={id} mood={model.moods[id]} sheltered={sheltered} unsafe={unsafe.includes(id)} />
          ))}
          {walk && <Walker key={walk.key} kind={walk.kind} mode={walk.mode} playKey={walk.key} onDone={walk.onDone} calm={calm} />}
          <DomeShield charge={charge} fresh={reveal ? 0 : blocks.shield} storm={model.storm === 'now' || reveal !== null} hits={reveal?.kind === 'rays' ? hits : undefined} hitAt={hitAt} />
          {reveal?.kind === 'rays' && <Rays key={reveal.key} rays={rays} />}
          {reveal?.kind === 'clear' && <AllClear key={reveal.key} />}
        </g>

        {stepTargets.map((t) => (
          <Stepper key={t} target={t} y={stepperY} count={blocks[t]} canAdd={left > 0 && (t !== 'radio' || model.earth)} onAdd={onAdd} onRemove={onRemove} />
        ))}
        <ClueTags tags={clueTags} open={tagsOpen} x={sun.x} y={sun.y + 48} />
        <rect className="sc-dim sc-fade" width={W} height={H} fill="#0f1a33" opacity={dim ? 0.55 : 0} style={{ pointerEvents: 'none' }} />
      </svg>
      <div className="sc-overlay">{children}</div>
    </div>
  )
}

export { ZONES }
