import { useEffect, useMemo, useRef, useState } from 'react'
import { CrewBubble, OrbiBubble, PictureButton, CalmIcon, RaysIcon } from './Bubbles'
import { MeterStrip, type MeterValues } from './MeterStrip'
import { MoonBaseScene, type MoonBaseSceneProps, type SceneHandle } from './MoonBaseScene'
import { CALM_MODEL, NO_BLOCKS, type FlareView, type RevealView, type SceneModel, type Target } from './model'
import { PowerTray } from './PowerTray'
import { TimeLapse } from './TimeLapse'
import { ZONES } from './zones'

/**
 * Demo harness for the lead: open scene-demo.html (or mount <SceneDemo/> on ?scene=1).
 *   ?state=<name>   show one state     ?auto=1  cycle through all of them     ?chrome=0  hide the demo buttons
 *   ?calm=1         force Calm mode (no motion)
 * Everything the scene shows comes from the props below, exactly as the main build will pass them.
 */

const meters = (o: Partial<MeterValues> = {}): MeterValues => ({ air: 78, power: 62, radiation: 8, food: 70, ...o })
const watch = (daysSince: number, o: Partial<FlareView> = {}): FlareView => ({ size: 'big', cloud: true, side: 'west', daysSince, ...o })
const base = (o: Partial<SceneModel> = {}): SceneModel => ({ ...CALM_MODEL, day: 4, ...o })
const SURPRISED = { safia: 'surprised', kofi: 'surprised', leo: 'surprised', mei: 'surprised' } as const

interface DemoState {
  name: string
  render: (key: number, calm: boolean) => React.ReactNode
}

function Frame({ model, calm, extra, children, m = meters() }: { model: SceneModel; calm: boolean; extra?: Partial<MoonBaseSceneProps>; children?: React.ReactNode; m?: MeterValues }) {
  return (
    <>
      <MoonBaseScene model={model} calm={calm} {...extra}>
        {children}
      </MoonBaseScene>
      <MeterStrip values={m} />
    </>
  )
}

const reveal = (kind: 'rays' | 'clear', shield: number, key: number, side: RevealView['side'] = 'west'): RevealView => ({ kind, shield, side, key })

export const STATES: DemoState[] = [
  { name: 'calm', render: (_k, calm) => <Frame model={base()} calm={calm} /> },
  { name: 'dark', render: (_k, calm) => <Frame model={base({ sunny: false, earth: false, powerLow: true })} calm={calm} /> },
  { name: 'watch1', render: (_k, calm) => <Frame model={base({ storm: 'coming', flare: watch(1), showSide: true, shield: 2, moods: SURPRISED })} calm={calm} /> },
  { name: 'watch2', render: (_k, calm) => <Frame model={base({ storm: 'coming', flare: watch(2), showSide: true, shield: 3, moods: SURPRISED })} calm={calm} /> },
  { name: 'watch3', render: (_k, calm) => <Frame model={base({ storm: 'coming', flare: watch(3), showSide: true, shield: 4, moods: SURPRISED })} calm={calm} /> },
  { name: 'watch-small-nocloud', render: (_k, calm) => <Frame model={base({ storm: 'coming', flare: watch(1, { size: 'small', cloud: false, side: 'east' }), shield: 1, moods: SURPRISED })} calm={calm} /> },
  { name: 'storm0', render: (k, calm) => <Frame model={base({ storm: 'now', flare: watch(3), showSide: true, shield: 0, moods: SURPRISED })} calm={calm} extra={{ reveal: reveal('rays', 0, k) }} /> },
  { name: 'storm3', render: (k, calm) => <Frame model={base({ storm: 'now', flare: watch(3), showSide: true, shield: 3, moods: SURPRISED })} calm={calm} extra={{ reveal: reveal('rays', 3, k) }} m={meters({ radiation: 34 })} /> },
  { name: 'storm6', render: (k, calm) => <Frame model={base({ storm: 'now', flare: watch(3), showSide: true, shield: 6, moods: SURPRISED })} calm={calm} extra={{ reveal: reveal('rays', 6, k) }} /> },
  { name: 'allclear', render: (k, calm) => <Frame model={base({ storm: 'coming', flare: watch(3), showSide: true, shield: 2 })} calm={calm} extra={{ reveal: reveal('clear', 2, k) }} /> },
  { name: 'walk-short', render: (k, calm) => <Frame model={base({ blocks: { ...NO_BLOCKS, walk: 1, air: 2, plants: 2 } })} calm={calm} extra={{ walk: { kind: 'short', key: k } }} /> },
  { name: 'walk-long', render: (k, calm) => <Frame model={base({ blocks: { ...NO_BLOCKS, walk: 2, air: 2, plants: 1 } })} calm={calm} extra={{ walk: { kind: 'long', key: k } }} /> },
  { name: 'walk-called-home', render: (k, calm) => <Frame model={base({ storm: 'now', flare: watch(3), shield: 1, moods: SURPRISED, blocks: { ...NO_BLOCKS, walk: 2 } })} calm={calm} extra={{ walk: { kind: 'long', mode: 'called-home', key: k }, unsafe: ['mei'] }} /> },
  { name: 'wilt', render: (_k, calm) => <Frame model={base({ plantsHappy: false, powerLow: true, moods: { ...CALM_MODEL.moods, safia: 'worried', kofi: 'worried' } })} calm={calm} m={meters({ power: 18, food: 22, air: 30 })} /> },
  {
    name: 'timelapse',
    render: (k, calm) => (
      <TimeLapse
        key={k}
        calm={calm}
        before={base({ day: 4, storm: 'coming', flare: watch(1), showSide: true, shield: 3, blocks: { ...NO_BLOCKS, air: 2, shield: 1, plants: 2, walk: 1 }, moods: SURPRISED })}
        after={base({ day: 5, storm: 'coming', flare: watch(2), showSide: true, shield: 2, plantsHappy: false, powerLow: true, moods: SURPRISED })}
        meters={{ before: meters(), after: meters({ air: 70, power: 28, food: 44 }) }}
        walk={{ kind: 'short' }}
        onDone={() => undefined}
      />
    ),
  },
  {
    name: 'bubble-crew',
    render: (_k, calm) => (
      <Frame model={base({ storm: 'coming', flare: watch(2), showSide: true, moods: SURPRISED })} calm={calm}>
        <CrewBubble who="kofi">
          <RaysIcon size={40} />
          <PictureButton label="Share">
            <CalmIcon />
          </PictureButton>
          <PictureButton label="Keep">
            <RaysIcon />
          </PictureButton>
        </CrewBubble>
      </Frame>
    ),
  },
  {
    name: 'bubble-orbi',
    render: (_k, calm) => (
      <Frame model={base({ storm: 'coming', flare: watch(1), showSide: true, moods: SURPRISED })} calm={calm}>
        <OrbiBubble />
      </Frame>
    ),
  },
  { name: 'play', render: (_k, calm) => <Play calm={calm} /> },
]

/** The real thing: drag the power blocks onto the buildings, or tap a building and use + / -. */
function Play({ calm }: { calm: boolean }) {
  const [blocks, setBlocks] = useState<Record<Target, number>>(NO_BLOCKS)
  const [hot, setHot] = useState<Target | null>(null)
  const [tags, setTags] = useState(false)
  const scene = useRef<SceneHandle>(null)
  const used = blocks.air + blocks.shield + blocks.plants + blocks.radio + blocks.walk
  const left = 6 - used
  const add = (t: Target) => setBlocks((b) => (b.air + b.shield + b.plants + b.radio + b.walk >= 6 || b[t] >= ZONES[t].max ? b : { ...b, [t]: b[t] + 1 }))
  const remove = (t: Target) => setBlocks((b) => (b[t] > 0 ? { ...b, [t]: b[t] - 1 } : b))
  const model = useMemo(() => base({ storm: 'coming', flare: watch(1), showSide: true, shield: 2 + blocks.shield, blocks, moods: SURPRISED }), [blocks])
  return (
    <>
      <MoonBaseScene ref={scene} model={model} calm={calm} hot={hot} blocksLeft={left} onAdd={add} onRemove={remove} onSunTap={() => setTags((t) => !t)} tagsOpen={tags} clueTags={['Big', 'Gas cloud', 'West']} />
      <PowerTray blocks={left} calm={calm} resolve={(x, y) => scene.current?.jobAt(x, y) ?? null} centerOf={(t) => scene.current?.centerOf(t) ?? null} onDrop={add} onHover={setHot} />
    </>
  )
}

export function SceneDemo() {
  const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search)
  const start = Math.max(0, STATES.findIndex((s) => s.name === params.get('state')))
  const [i, setI] = useState(start)
  const [key, setKey] = useState(1)
  const calm = params.get('calm') === '1'
  const auto = params.get('auto') === '1'
  const chrome = params.get('chrome') !== '0'
  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => {
      setI((n) => (n + 1) % STATES.length)
      setKey((k) => k + 1)
    }, 5200)
    return () => clearInterval(t)
  }, [auto])
  const s = STATES[i] as DemoState
  return (
    <div className="demo" data-state={s.name}>
      {chrome && (
        <div className="demo-bar">
          <button onClick={() => (setI((n) => (n + STATES.length - 1) % STATES.length), setKey((k) => k + 1))}>{'<'}</button>
          <b>{s.name}</b>
          <button onClick={() => (setI((n) => (n + 1) % STATES.length), setKey((k) => k + 1))}>{'>'}</button>
          <button onClick={() => setKey((k) => k + 1)}>replay</button>
        </div>
      )}
      <div key={`${s.name}-${key}`}>{s.render(key, calm)}</div>
    </div>
  )
}
