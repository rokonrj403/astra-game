import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, Database, Footprints, Radiation, Sparkles, Sprout, TriangleAlert, Wind, Zap, type LucideIcon } from 'lucide-react'
import { blockPlaced, cardFlip, dayStart, moonwalk, shieldHum, shieldHumStop } from '../audio'
import { BLOCKS } from '../engine/constants'
import { flareById } from '../engine/flares'
import { activeStorm, activeWatch, currentCard, radioAvailable } from '../engine/game'
import type { Choice, GameState, Guess, Jobs, Option, Walk } from '../engine/types'
import type { SunView } from '../live/sun'
import {
  CrewBubble,
  flareSize,
  MeterStrip,
  MoonBaseScene,
  NO_BLOCKS,
  OrbiBubble,
  PictureButton,
  PowerTray,
  revealFromRecord,
  sceneModelFromGame,
  TimeLapse,
  ZONES,
  type FlareView,
  type Guess as SceneGuess,
  type SceneHandle,
  type Target,
} from '../scene'
import { flareCue, lowToday, lowWarning, moodFor, setMood } from './cues'
import { prefersReducedMotion } from './motion'
import { DaySummary, NextButton } from './screens'
import { sfx } from './sfx'
import { Speak } from './speech'
import { SunChip } from './sunscreens'

type Blocks = Record<Target, number>
const used = (b: Blocks) => b.air + b.shield + b.plants + b.radio + b.walk
const toGuess = (g: SceneGuess): Guess => (g === 'rays' ? 'yes' : g === 'calm' ? 'no' : 'unsure')
const toScene = (g: Guess): SceneGuess => (g === 'yes' ? 'rays' : g === 'no' ? 'calm' : 'unsure')
const meters = (g: GameState) => ({ air: g.air, power: g.power, radiation: g.radiation, food: g.food })

/** What a choice does, as pictures: a small icon with an up or down arrow for each thing it changes. No words. */
function Effects({ o }: { o: Option }) {
  const chips: { Icon: LucideIcon; up: boolean; color: string }[] = []
  if (o.science) chips.push({ Icon: Sparkles, up: o.science > 0, color: 'var(--sun)' })
  if (o.power) chips.push({ Icon: Zap, up: o.power > 0, color: 'var(--power)' })
  if (o.air) chips.push({ Icon: Wind, up: o.air > 0, color: 'var(--air)' })
  if (o.food) chips.push({ Icon: Sprout, up: o.food > 0, color: 'var(--plants)' })
  if (o.radiation) chips.push({ Icon: Radiation, up: o.radiation > 0, color: 'var(--radiation)' })
  if (o.slowWalk) chips.push({ Icon: Footprints, up: false, color: 'var(--muted)' })
  if (o.slowPlants) chips.push({ Icon: Sprout, up: false, color: 'var(--muted)' })
  if (o.failChance) chips.push({ Icon: TriangleAlert, up: true, color: 'var(--radiation)' })
  if (chips.length === 0) chips.push({ Icon: ArrowRight, up: true, color: 'var(--muted)' })
  return (
    <span className="fx" aria-hidden="true">
      {chips.slice(0, 4).map(({ Icon, up, color }, i) => (
        <span key={i}>
          <Icon size={18} color={color} />
          {up ? <ArrowUp size={14} color={color} /> : <ArrowDown size={14} color={color} />}
        </span>
      ))}
    </span>
  )
}

export interface LivingProps {
  game: GameState
  sun: SunView | null
  /** Plays the day in the engine and returns the new state (the app keeps it, the journal and the storm cards). */
  onStep: (c: Choice) => GameState
  /** The mission is over (won or lost): go to the end screens. */
  onOver: () => void
  onData: () => void
  onSun: () => void
}

/**
 * Daily play, all in one living scene: power blocks go onto the buildings, a flare is read on the Sun, ORBI asks for a guess,
 * a crew member offers two choices, the airlock is the moonwalk. "Next" plays a short time-lapse in the same scene, then a
 * summary sheet shows what the day did. No page changes during a day, and almost no words.
 */
export function Living({ game, sun, onStep, onOver, onData, onSun }: LivingProps) {
  const [phase, setPhase] = useState<'play' | 'lapse' | 'summary'>('play')
  const [blocks, setBlocks] = useState<Blocks>(NO_BLOCKS)
  const [hot, setHot] = useState<Target | null>(null)
  const [tags, setTags] = useState(false)
  const [guess, setGuess] = useState<Guess | null>(null)
  const [go, setGo] = useState<boolean | null>(null)
  const [snap, setSnap] = useState<{ before: GameState; blocks: Blocks; walk: Walk } | null>(null)
  const scene = useRef<SceneHandle>(null)
  const calm = prefersReducedMotion()

  const card = currentCard(game)
  const watch = activeWatch(game)
  const storm = activeStorm(game)
  const locked = watch ? (game.guesses[watch.index] ?? null) : null
  const left = BLOCKS - used(blocks)
  const stage = phase === 'play' && watch && locked === null && guess === null ? 'guess' : phase === 'play' && card ? 'card' : 'none'

  // A new day: the mood of the music, the day sound, today's card turning over, and a warning if a bar is low.
  useEffect(() => {
    if (phase !== 'play') return
    setMood(moodFor(game))
    dayStart()
    if (card) cardFlip()
    if (lowToday(game)) lowWarning()
  }, [game.day, phase])
  // A flare appears on the Sun: pulses = size, a low swell = gas cloud, the side it came from. A storm still here chimes.
  const watchKey = watch ? `${watch.index}:${watch.daysSince}` : storm ? `storm:${storm.index}` : ''
  useEffect(() => {
    if (phase !== 'play') return
    if (watch) flareCue(watch.record, game.mode)
    else if (storm) sfx.chime()
  }, [watchKey, phase])
  // The shield hums louder as its charge grows, and stops when no shield blocks are given.
  useEffect(() => {
    if (blocks.shield > 0) shieldHum(Math.min(6, game.shield + blocks.shield))
    else shieldHumStop()
  }, [blocks.shield])
  useEffect(() => () => shieldHumStop(), [])

  const canAdd = (t: Target) => used(blocks) < BLOCKS && blocks[t] < ZONES[t].max && (t !== 'radio' || radioAvailable(game))
  const add = (t: Target) => {
    if (!canAdd(t)) return
    blockPlaced()
    if (t === 'walk') moonwalk()
    setBlocks((b) => ({ ...b, [t]: b[t] + 1 }))
  }
  const remove = (t: Target) => setBlocks((b) => (b[t] > 0 ? { ...b, [t]: b[t] - 1 } : b))

  const model = useMemo(() => sceneModelFromGame(game, blocks), [game, blocks])
  const tagWords = watch ? [watch.record.class, watch.record.cloud ? 'Gas cloud' : 'No gas cloud', ...(game.mode === 'commander' ? [watch.record.side === 'west' ? 'West' : 'East'] : [])] : []

  const next = () => {
    const jobs: Jobs = { air: blocks.air, shield: blocks.shield, plants: blocks.plants, radio: blocks.radio }
    const walk: Walk = blocks.walk >= 2 ? 'long' : blocks.walk === 1 ? 'short' : 'none'
    const choice: Choice = { jobs, go: card !== null && go === true, walk, ...(guess && locked === null ? { guess } : {}) }
    setSnap({ before: game, blocks, walk })
    onStep(choice)
    setPhase('lapse')
  }

  const finishDay = () => {
    if (game.status !== 'playing') {
      onOver()
      return
    }
    setBlocks(NO_BLOCKS)
    setGuess(null)
    setGo(null)
    setTags(false)
    setSnap(null)
    setPhase('play')
  }

  // For read-aloud (Settings): the picture's words, spoken. Off by default.
  const aloud =
    `ORBI says: You have ${left} blocks to share.` +
    (watch ? ` A real ${watch.record.class} flare. ${watch.record.cloud ? 'It sent out a gas cloud.' : 'No gas cloud was seen.'} Will space rays come?` : '') +
    (card ? ` ${card.question} One: ${card.a.label}. Two: ${card.b.label}.` : '')

  const shownDay = phase === 'summary' ? (game.history[game.history.length - 1]?.day ?? game.day) : game.day
  const dayOnly = (
    <div className="livetop">
      <b className="daynum" aria-label={`Day ${shownDay} of ${game.totalDays}`}>
        {shownDay}/{game.totalDays}
      </b>
    </div>
  )

  const header = (
    <div className="livetop">
      <b className="daynum" aria-label={`Day ${game.day} of ${game.totalDays}`}>
        {game.day}/{game.totalDays}
      </b>
      <span className="row" style={{ gap: 4 }}>
        {phase === 'play' && <Speak text={aloud} />}
        <SunChip sun={sun} onTap={onSun} />
        <button className="iconbtn" onClick={onData} aria-label="Data" title="Where the data comes from">
          <Database size={20} aria-hidden="true" />
        </button>
      </span>
    </div>
  )

  if (phase === 'lapse' && snap) {
    const last = game.history[game.history.length - 1]
    return (
      <main className="app living">
        {header}
        <TimeLapse
          key={snap.before.day}
          calm={calm}
          before={sceneModelFromGame(snap.before, snap.blocks)}
          after={sceneModelFromGame(game, {})}
          meters={{ before: meters(snap.before), after: meters(game), hasFood: game.hasFood }}
          walk={snap.walk !== 'none' ? { kind: snap.walk, mode: last?.calledHome ? 'called-home' : undefined } : null}
          onDone={() => setPhase('summary')}
        />
      </main>
    )
  }

  if (phase === 'summary') {
    const last = game.history[game.history.length - 1]
    const done = last?.resolved[0] && flareById(last.resolved[0].flareId)
    // The flare that was just explained, drawn as it was on its third day, so the cloud arrives or slides past.
    const flare: FlareView | null = done ? { size: flareSize(done.class), cloud: done.cloud, side: done.side === 'west' ? 'west' : 'east', daysSince: 3 } : null
    const side = game.mode === 'commander' && done ? (done.side === 'west' ? 'west' : 'east') : null
    return (
      <main className="app living">
        {dayOnly}
        <MoonBaseScene model={{ ...sceneModelFromGame(game, {}), flare: flare ?? sceneModelFromGame(game, {}).flare }} reveal={revealFromRecord(last, side)} calm={calm} />
        <MeterStrip values={meters(game)} hasFood={game.hasFood} science={{ value: game.science, goal: game.goal }} />
        <div className="sheet">
          <DaySummary game={game} />
          <NextButton game={game} onNext={finishDay} />
        </div>
      </main>
    )
  }

  return (
    <main className="app living">
      {header}
      <MoonBaseScene
        ref={scene}
        model={model}
        calm={calm}
        hot={hot}
        blocksLeft={left}
        onAdd={add}
        onRemove={remove}
        onSunTap={() => setTags((t) => !t)}
        tagsOpen={tags}
        clueTags={tagWords}
      >
        {stage === 'guess' && <OrbiBubble picked={guess ? toScene(guess) : null} onGuess={(g) => setGuess(toGuess(g))} />}
        {stage === 'card' && card && (
          <CrewBubble who={card.who[0]!}>
            <span className="cap">{card.question}</span>
            <PictureButton label={card.a.label} pressed={go === true} onClick={() => setGo(true)}>
              <Effects o={card.a} />
            </PictureButton>
            <PictureButton label={card.b.label} pressed={go === false} onClick={() => setGo(false)}>
              <Effects o={card.b} />
            </PictureButton>
          </CrewBubble>
        )}
      </MoonBaseScene>
      <MeterStrip values={meters(game)} hasFood={game.hasFood} science={{ value: game.science, goal: game.goal }} />
      <PowerTray blocks={left} calm={calm} resolve={(x, y) => scene.current?.jobAt(x, y) ?? null} centerOf={(t) => scene.current?.centerOf(t) ?? null} onDrop={add} onHover={setHot} />
      <div className="sticky-cta">
        <button className="primary big" onClick={next} aria-label="Next day">
          <ArrowRight size={26} aria-hidden="true" /> Next
        </button>
      </div>
    </main>
  )
}
