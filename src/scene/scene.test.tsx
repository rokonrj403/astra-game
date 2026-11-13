import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { newGame } from '../engine/game'
import type { DayRecord, GameState } from '../engine/types'
import { SHIELD_LETS_THROUGH } from '../engine/constants'
import {
  AllClear,
  CALM_MODEL,
  CloudLane,
  CrewBubble,
  DomeShield,
  FlareBurst,
  MeterStrip,
  MoonBaseScene,
  NO_BLOCKS,
  OrbiBubble,
  PictureButton,
  PowerTray,
  Rays,
  Sun,
  TimeLapse,
  Walker,
  ZONES,
  clientToScene,
  flareSize,
  hitZone,
  hitsPerSegment,
  leakTint,
  litSegments,
  planRays,
  pointAlong,
  rayCountFor,
  revealFromRecord,
  sceneModelFromGame,
  sunPos,
  walkDuration,
  zoneCenter,
  type SceneModel,
  type SceneHandle,
  type Target,
  WALK_PATH,
} from './index'
import { segmentForX, segmentSpanX, SEGMENTS } from './tokens'
import { createRef } from 'react'

function stubMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
}

beforeEach(() => stubMotion(false))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const model = (o: Partial<SceneModel> = {}): SceneModel => ({ ...CALM_MODEL, ...o })
const inSvg = (node: React.ReactNode) => render(<svg viewBox="0 0 360 440">{node}</svg>)

describe('drop zones and hit logic', () => {
  it('every target is at least 44 x 44 on the board, and big enough to hit on a 360 px phone', () => {
    for (const z of Object.values(ZONES)) {
      expect(z.w, z.id).toBeGreaterThanOrEqual(44)
      expect(z.h, z.id).toBeGreaterThanOrEqual(44)
    }
  })

  it('the smallest zone wins: a block on the habitat is Air, on empty dome it is Shield', () => {
    expect(hitZone(180, 270)).toBe('air')
    expect(hitZone(266, 280)).toBe('plants')
    expect(hitZone(87, 280)).toBe('walk')
    expect(hitZone(330, 270)).toBe('radio')
    expect(hitZone(180, 190)).toBe('shield')
  })

  it('the dome is a half ellipse: its empty corners and the open sky are not targets', () => {
    expect(hitZone(56, 160)).toBeNull()
    expect(hitZone(180, 60)).toBeNull()
    expect(hitZone(180, 380)).toBeNull()
  })

  it('the dish is closed when Earth is hidden: the block goes to the shield (inside the dome) or nowhere', () => {
    expect(hitZone(330, 270, { earth: false })).toBeNull()
    expect(hitZone(305, 270, { earth: true })).toBe('radio')
    expect(hitZone(305, 270, { earth: false })).toBe('shield')
  })

  it('screen pixels convert to board coordinates for any scale', () => {
    expect(clientToScene({ left: 10, top: 20, width: 360, height: 440 }, 190, 240)).toEqual({ x: 180, y: 220 })
    expect(clientToScene({ left: 0, top: 0, width: 720, height: 880 }, 360, 440)).toEqual({ x: 180, y: 220 })
    expect(clientToScene({ left: 0, top: 0, width: 0, height: 0 }, 1, 1)).toBeNull()
  })

  it('a zone centre lands on that zone', () => {
    for (const t of ['air', 'plants', 'radio', 'walk', 'shield'] as Target[]) {
      const c = zoneCenter(t)
      expect(hitZone(c.x, c.y), t).toBe(t)
    }
  })

  it('the scene handle answers jobAt and centerOf from the picture box', () => {
    const ref = createRef<SceneHandle>()
    render(<MoonBaseScene ref={ref} model={model()} />)
    const root = document.querySelector('.sc-root') as HTMLElement
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 440, right: 360, bottom: 440, x: 0, y: 0, toJSON: () => ({}) })
    expect(ref.current?.jobAt(180, 270)).toBe('air')
    expect(ref.current?.jobAt(5, 430)).toBeNull()
    expect(ref.current?.centerOf('air')).toEqual(zoneCenter('air'))
  })
})

describe('sun, flare burst and gas cloud', () => {
  it('flare size is drawn as 1, 2 or 3 pulses', () => {
    for (const [size, n] of [['small', 1], ['medium', 2], ['big', 3]] as const) {
      const { container, unmount } = inSvg(<FlareBurst size={size} cloud side="west" showSide />)
      expect(container.querySelectorAll('.sc-pulse')).toHaveLength(n)
      unmount()
    }
  })

  it('the size comes from the engine buckets', () => {
    expect(flareSize('M5.1')).toBe('small')
    expect(flareSize('X1.9')).toBe('medium')
    expect(flareSize('X9.0')).toBe('big')
  })

  it('the burst sits on the east or west limb only when the side is shown', () => {
    const w = inSvg(<FlareBurst size="big" cloud side="west" showSide />).container.querySelector('.sc-burst') as SVGElement
    const e = inSvg(<FlareBurst size="big" cloud side="east" showSide />).container.querySelectorAll('.sc-burst')[0] as SVGElement
    const hidden = inSvg(<FlareBurst size="big" cloud side="west" showSide={false} />).container.querySelectorAll('.sc-burst')[0] as SVGElement
    expect(w.getAttribute('data-side')).toBe('west')
    expect(w.getAttribute('transform')).toMatch(/translate\(18 /)
    expect(e.getAttribute('transform')).toMatch(/translate\(-18 /)
    expect(hidden.getAttribute('data-side')).toBe('hidden')
    expect(hidden.getAttribute('transform')).toMatch(/translate\(0 -18\)/)
  })

  it('a flare with no gas cloud gets the dashed fizzle ring', () => {
    expect(inSvg(<FlareBurst size="small" cloud={false} side="east" showSide />).container.querySelector('.sc-fizzle')).not.toBeNull()
    cleanup()
    expect(inSvg(<FlareBurst size="small" cloud side="east" showSide />).container.querySelector('.sc-fizzle')).toBeNull()
  })

  it('tapping the Sun (or pressing Enter on it) calls onTap', () => {
    const onTap = vi.fn()
    inSvg(<Sun x={100} y={100} sunny onTap={onTap} flare={{ size: 'big', cloud: true, side: 'west', daysSince: 1 }} showSide />)
    const b = screen.getByRole('button', { name: /Sun/ })
    fireEvent.click(b)
    fireEvent.keyDown(b, { key: 'Enter' })
    expect(onTap).toHaveBeenCalledTimes(2)
  })

  it('the Sun arcs across the sky over the mission and stays on screen', () => {
    const a = sunPos(1, 10)
    const b = sunPos(5, 10)
    const c = sunPos(10, 10)
    expect(a.x).toBeLessThan(b.x)
    expect(b.x).toBeLessThan(c.x)
    expect(b.y).toBeLessThan(a.y)
    expect(b.y).toBeLessThan(c.y)
    for (const p of [a, b, c]) expect(p.x).toBeGreaterThan(0)
  })

  it('no cloud means nothing is drawn; the cloud moves one notch a day', () => {
    expect(inSvg(<CloudLane from={{ x: 100, y: 80 }} daysSince={null} />).container.querySelector('.sc-lane')).toBeNull()
    cleanup()
    const pos = [1, 2, 3].map((d) => {
      const { container, unmount } = inSvg(<CloudLane from={{ x: 100, y: 80 }} daysSince={d} />)
      const lane = container.querySelector('.sc-lane') as SVGElement
      expect(lane.querySelectorAll('.sc-notch[data-on="yes"]')).toHaveLength(d)
      const t = (container.querySelector('.sc-cloud') as HTMLElement).style.transform
      unmount()
      return t
    })
    expect(new Set(pos).size).toBe(3)
  })

  it('at the reveal the cloud passes (all-clear) or arrives (rays) and fades', () => {
    const pass = inSvg(<CloudLane from={{ x: 100, y: 80 }} daysSince={3} state="pass" />).container
    expect((pass.querySelector('.sc-cloud') as HTMLElement).style.opacity).toBe('0')
    expect(pass.querySelector('.sc-lane')?.getAttribute('data-state')).toBe('pass')
  })
})

describe('dome, rays and all-clear', () => {
  it('lights one segment per charge, middle first', () => {
    for (let c = 0; c <= SEGMENTS; c++) expect(litSegments(c)).toHaveLength(c)
    expect(litSegments(1)).toEqual([2])
    expect(litSegments(2)).toEqual([2, 3])
    expect(litSegments(6)).toEqual([0, 1, 2, 3, 4, 5])
    const { container } = inSvg(<DomeShield charge={4} />)
    expect(container.querySelectorAll('[data-lit="yes"]')).toHaveLength(4)
    expect(container.querySelectorAll('[data-lit="no"]')).toHaveLength(2)
  })

  it('lit segments are solid and thick, unlit ones thin and dashed (not colour alone)', () => {
    const { container } = inSvg(<DomeShield charge={1} />)
    const lit = container.querySelector('[data-lit="yes"] .sc-seg-line') as SVGElement
    const off = container.querySelector('[data-lit="no"] .sc-seg-line') as SVGElement
    expect(Number(lit.getAttribute('stroke-width'))).toBeGreaterThan(Number(off.getAttribute('stroke-width')))
    expect(lit.getAttribute('stroke-dasharray')).toBeNull()
    expect(off.getAttribute('stroke-dasharray')).not.toBeNull()
  })

  it('segmentForX agrees with the segment spans', () => {
    for (let i = 0; i < SEGMENTS; i++) {
      const [a, b] = segmentSpanX(i)
      expect(segmentForX((a + b) / 2)).toBe(i)
    }
  })

  it.each([0, 1, 2, 3, 4, 5, 6])('with %i shield blocks the number of rays that get through follows the game table', (shield) => {
    const rays = planRays(shield, 24)
    expect(rays).toHaveLength(24)
    const through = rays.filter((r) => r.passes).length
    expect(through).toBe(Math.round(24 * (SHIELD_LETS_THROUGH[shield] as number)))
  })

  it('rays that stop are aimed at lit segments, rays that get through at the holes', () => {
    const lit = new Set(litSegments(3))
    const rays = planRays(3, 24)
    for (const r of rays) {
      if (r.passes) expect(lit.has(r.seg), 'through a lit segment').toBe(false)
      else expect(lit.has(r.seg), 'stopped on an unlit segment').toBe(true)
    }
    expect(hitsPerSegment(rays).reduce((a, b) => a + b, 0)).toBe(rays.filter((r) => !r.passes).length)
  })

  it('with the shield off every ray gets through; leaks tint the base, a full shield barely does', () => {
    expect(planRays(0, 24).every((r) => r.passes)).toBe(true)
    expect(leakTint(planRays(0, 24))).toBeGreaterThan(leakTint(planRays(3, 24)))
    expect(leakTint(planRays(3, 24))).toBeGreaterThan(leakTint(planRays(6, 24)))
    expect(leakTint(planRays(6, 0 + 12))).toBeLessThan(0.2)
  })

  it('rays lean in from the Sun side', () => {
    const west = planRays(2, 12, 'west', 180)
    const east = planRays(2, 12, 'east', 180)
    const avg = (l: typeof west) => l.reduce((a, r) => a + r.sx, 0) / l.length
    expect(avg(west)).toBeGreaterThan(avg(east))
  })

  it('draws every ray with a spark, and the leak layer only when something got through', () => {
    const a = inSvg(<Rays rays={planRays(0, 12)} />).container
    expect(a.querySelectorAll('.sc-ray')).toHaveLength(12)
    expect(a.querySelector('.sc-leak')).not.toBeNull()
    cleanup()
    const b = inSvg(<Rays rays={planRays(6, 12)} />).container
    expect(b.querySelectorAll('.sc-ray')).toHaveLength(12)
  })

  it('the all-clear is a ring and a tick', () => {
    const { container } = inSvg(<AllClear />)
    expect(container.querySelector('.sc-ping')).not.toBeNull()
    expect(container.querySelector('.sc-tick-pop')).not.toBeNull()
  })

  it('the ray count scales with the storm and halves on cheap phones', () => {
    expect(rayCountFor(undefined)).toBe(24)
    expect(rayCountFor(30)).toBe(12)
    expect(rayCountFor(150)).toBe(24)
    expect(rayCountFor(150, 12)).toBe(12)
    const { container } = render(<MoonBaseScene model={model({ shield: 3 })} reveal={{ kind: 'rays', shield: 3, key: 1 }} lowEnd />)
    expect(container.querySelector('.sc-rays')?.getAttribute('data-rays')).toBe('12')
    cleanup()
    const full = render(<MoonBaseScene model={model({ shield: 3 })} reveal={{ kind: 'rays', shield: 3, key: 1 }} lowEnd={false} />)
    expect(full.container.querySelector('.sc-rays')?.getAttribute('data-rays')).toBe('24')
  })
})

describe('the scene: buildings, blocks, words', () => {
  it('fills each building with its blocks (pips) and lights the segments for the shield charge', () => {
    const { container } = render(<MoonBaseScene model={model({ shield: 3, blocks: { air: 2, shield: 1, plants: 3, radio: 4, walk: 1 } })} />)
    const count = (id: string) => container.querySelector(`[data-building="${id}"]`)?.getAttribute('data-count')
    expect([count('air'), count('plants'), count('radio'), count('walk'), count('shield')]).toEqual(['2', '3', '4', '1', '1'])
    const pips = [...container.querySelectorAll('.sc-pips')].map((p) => p.querySelectorAll('.sc-pip.on').length)
    expect(pips).toEqual([1, 2, 3, 4])
    expect(container.querySelectorAll('[data-lit="yes"]')).toHaveLength(3)
  })

  it('the dish is greyed and closed when Earth is not in view', () => {
    const { container } = render(<MoonBaseScene model={model({ earth: false })} />)
    const dish = container.querySelector('[data-building="radio"]') as SVGElement
    expect(dish.getAttribute('aria-disabled')).toBe('true')
    expect(container.querySelector('.sc-dish')?.getAttribute('data-earth')).toBe('no')
  })

  it('has no words in the picture by default', () => {
    const { container } = render(
      <MoonBaseScene model={model({ storm: 'coming', flare: { size: 'big', cloud: true, side: 'west', daysSince: 2 }, showSide: true, blocks: { air: 2, shield: 1, plants: 1, radio: 1, walk: 1 } })} steppers="always" reveal={{ kind: 'rays', shield: 2, key: 1 }} walk={{ kind: 'long', key: 1 }} />,
    )
    expect((container.textContent ?? '').trim()).toBe('')
    expect(container.querySelectorAll('text')).toHaveLength(0)
    expect(container.querySelectorAll('title')).toHaveLength(0)
  })

  it('words appear only as tiny tags after a tap', () => {
    const { container, rerender } = render(<MoonBaseScene model={model()} clueTags={['Big', 'Cloud']} tagsOpen={false} />)
    expect((container.textContent ?? '').trim()).toBe('')
    rerender(<MoonBaseScene model={model()} clueTags={['Big', 'Cloud']} tagsOpen />)
    expect(container.textContent).toContain('Big')
  })

  it('+/- steppers: tap a building, then add or remove; they obey the blocks left', () => {
    const onAdd = vi.fn()
    const onRemove = vi.fn()
    const { container, rerender } = render(<MoonBaseScene model={model({ blocks: { ...NO_BLOCKS, air: 1 } })} onAdd={onAdd} onRemove={onRemove} />)
    expect(container.querySelector('.sc-stepper')).toBeNull()
    fireEvent.click(container.querySelector('[data-building="air"]') as Element)
    fireEvent.click(screen.getByRole('button', { name: /More blocks/ }))
    fireEvent.click(screen.getByRole('button', { name: /Fewer blocks/ }))
    expect(onAdd).toHaveBeenCalledWith('air')
    expect(onRemove).toHaveBeenCalledWith('air')
    rerender(<MoonBaseScene model={model({ blocks: { ...NO_BLOCKS, air: 1 } })} blocksLeft={0} onAdd={onAdd} onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button', { name: /More blocks/ }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('keyboard: a building can be chosen with Enter', () => {
    const { container } = render(<MoonBaseScene model={model()} />)
    fireEvent.keyDown(container.querySelector('[data-building="plants"]') as Element, { key: 'Enter' })
    expect(container.querySelector('.sc-stepper')?.getAttribute('data-for')).toBe('plants')
  })

  it('plants wilt, lights dim, crew shelter when the storm is here', () => {
    const { container } = render(<MoonBaseScene model={model({ plantsHappy: false, powerLow: true, storm: 'now' })} />)
    expect(container.querySelector('.sc-greenhouse')?.getAttribute('data-happy')).toBe('no')
    expect(container.querySelector('.sc-windows')?.classList.contains('low')).toBe(true)
    const crew = [...container.querySelectorAll('.sc-crew')]
    expect(crew).toHaveLength(4)
    expect(crew.every((c) => c.getAttribute('data-sheltered') === 'yes')).toBe(true)
    cleanup()
    const calm = render(<MoonBaseScene model={model()} />)
    expect([...calm.container.querySelectorAll('.sc-crew')].every((c) => c.getAttribute('data-sheltered') === 'no')).toBe(true)
  })

  it('a day with a flare shows the burst and the lane; no flare shows neither', () => {
    const w = render(<MoonBaseScene model={model({ flare: { size: 'medium', cloud: true, side: 'east', daysSince: 2 } })} />).container
    expect(w.querySelector('.sc-burst')?.getAttribute('data-pulses')).toBe('2')
    expect(w.querySelector('.sc-lane')?.getAttribute('data-day')).toBe('2')
    cleanup()
    const n = render(<MoonBaseScene model={model()} />).container
    expect(n.querySelector('.sc-burst')).toBeNull()
    expect(n.querySelector('.sc-lane')).toBeNull()
  })

  it('a planned moonwalk shows its footprints before it starts', () => {
    const { container } = render(<MoonBaseScene model={model({ blocks: { ...NO_BLOCKS, walk: 2 } })} />)
    expect(container.querySelector('.sc-trail')?.getAttribute('data-walk')).toBe('long')
  })
})

describe('reduced motion and Calm mode', () => {
  it('Calm mode puts the calm class on the scene, whatever the OS says', () => {
    const { container } = render(<MoonBaseScene model={model()} calm />)
    expect(container.querySelector('.sc-root')?.classList.contains('sc-calm')).toBe(true)
  })

  it('reduced motion: the walker does not travel, it shows at the flag and finishes at once', () => {
    stubMotion(true)
    vi.useFakeTimers()
    const done = vi.fn()
    const { container } = inSvg(<Walker kind="long" onDone={done} />)
    const w = container.querySelector('.sc-walker') as SVGElement
    expect(w.getAttribute('data-walking')).toBe('no')
    expect(w.getAttribute('data-u')).toBe('1.00')
    act(() => void vi.advanceTimersByTime(300))
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('reduced motion: a called-home walk stops half way', () => {
    stubMotion(true)
    vi.useFakeTimers()
    const { container } = inSvg(<Walker kind="short" mode="called-home" />)
    expect(container.querySelector('.sc-walker')?.getAttribute('data-u')).toBe('0.55')
  })

  it('the walker walks out and back with motion on, then calls onDone once', () => {
    vi.useFakeTimers()
    const done = vi.fn()
    inSvg(<Walker kind="short" onDone={done} />)
    act(() => void vi.advanceTimersByTime(walkDuration('short', 'run') + 200))
    expect(done).toHaveBeenCalledTimes(1)
    act(() => void vi.advanceTimersByTime(2000))
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('called-home is shorter than a normal walk', () => {
    expect(walkDuration('long', 'called-home')).toBeLessThan(walkDuration('long', 'run'))
  })

  it('the walk path starts at the airlock door and the long one extends the short one', () => {
    expect(pointAlong(WALK_PATH.short, 0)).toMatchObject({ x: 87, y: 303 })
    const end = WALK_PATH.short[WALK_PATH.short.length - 1]
    expect(WALK_PATH.long).toContainEqual(end)
    expect(WALK_PATH.long.length).toBeGreaterThan(WALK_PATH.short.length)
  })

  it('reduced motion: the time-lapse jumps to the new day and finishes after a short beat', () => {
    stubMotion(true)
    vi.useFakeTimers()
    const done = vi.fn()
    const before = model({ day: 2 })
    const after = model({ day: 6 })
    const { container } = render(<TimeLapse before={before} after={after} onDone={done} />)
    expect(Number(container.querySelector('.sc-sun')?.getAttribute('data-sun-x'))).toBe(Math.round(sunPos(6, 10).x))
    expect(done).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(200))
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('the time-lapse runs before -> after -> done inside 2.4 s', () => {
    vi.useFakeTimers()
    const done = vi.fn()
    const { container } = render(<TimeLapse before={model({ day: 2 })} after={model({ day: 3, plantsHappy: false })} walk={{ kind: 'short' }} onDone={done} />)
    const sunX = () => Number(container.querySelector('.sc-sun')?.getAttribute('data-sun-x'))
    expect(sunX()).toBe(Math.round(sunPos(2, 10).x))
    expect(container.querySelector('.sc-dim')?.getAttribute('opacity')).toBe('0.55')
    act(() => void vi.advanceTimersByTime(400))
    expect(sunX()).toBe(Math.round(sunPos(3, 10).x))
    expect(container.querySelector('.sc-greenhouse')?.getAttribute('data-happy')).toBe('no')
    act(() => void vi.advanceTimersByTime(2000))
    expect(container.querySelector('.sc-dim')?.getAttribute('opacity')).toBe('0')
    act(() => void vi.advanceTimersByTime(1500))
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('the time-lapse ticks the bars from before to after', () => {
    vi.useFakeTimers()
    const { container } = render(<TimeLapse before={model()} after={model({ day: 2 })} meters={{ before: { air: 80, power: 70, radiation: 0, food: 70 }, after: { air: 40, power: 70, radiation: 0, food: 70 } }} onDone={() => undefined} />)
    const on = () => container.querySelectorAll('.sc-meter[aria-label="Air"] .sc-segs i.on').length
    expect(on()).toBe(8)
    act(() => void vi.advanceTimersByTime(400))
    expect(on()).toBe(4)
  })
})

describe('the power tray', () => {
  const resolveTo = (t: Target | null) => vi.fn(() => t)

  function drag(block: Element, to: { x: number; y: number }) {
    fireEvent.pointerDown(block, { clientX: 20, clientY: 600, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerMove(block, { clientX: to.x, clientY: to.y, pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerUp(block, { clientX: to.x, clientY: to.y, pointerId: 1, pointerType: 'mouse' })
  }

  it('shows one block per power block left, six slots in all', () => {
    const { container } = render(<PowerTray blocks={4} resolve={resolveTo(null)} onDrop={() => undefined} />)
    expect(container.querySelectorAll('.sc-slot')).toHaveLength(6)
    expect(container.querySelectorAll('.sc-block')).toHaveLength(4)
  })

  it('dropping on a building calls onDrop with it (Calm mode: at once)', () => {
    const onDrop = vi.fn()
    const resolve = resolveTo('air')
    const { container } = render(<PowerTray blocks={6} calm resolve={resolve} onDrop={onDrop} />)
    drag(container.querySelector('.sc-block') as Element, { x: 180, y: 270 })
    expect(onDrop).toHaveBeenCalledWith('air')
    expect(resolve).toHaveBeenCalled()
    expect(container.querySelector('.sc-ghost')).toBeNull()
  })

  it('dropping on nothing does not call onDrop', () => {
    const onDrop = vi.fn()
    const { container } = render(<PowerTray blocks={6} calm resolve={resolveTo(null)} onDrop={onDrop} />)
    drag(container.querySelector('.sc-block') as Element, { x: 5, y: 5 })
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('with motion the block flies for 320 ms and then lands', () => {
    vi.useFakeTimers()
    const onDrop = vi.fn()
    const { container } = render(<PowerTray blocks={6} resolve={resolveTo('plants')} centerOf={() => ({ x: 250, y: 300 })} onDrop={onDrop} />)
    drag(container.querySelector('.sc-block') as Element, { x: 240, y: 290 })
    expect(onDrop).not.toHaveBeenCalled()
    expect(container.querySelector('.sc-ghost')).not.toBeNull()
    act(() => void vi.advanceTimersByTime(319))
    expect(onDrop).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(5))
    expect(onDrop).toHaveBeenCalledWith('plants')
    expect(container.querySelector('.sc-ghost')).toBeNull()
  })

  it('a missed drop flies back and nothing lands', () => {
    vi.useFakeTimers()
    const onDrop = vi.fn()
    const { container } = render(<PowerTray blocks={6} resolve={resolveTo(null)} onDrop={onDrop} />)
    drag(container.querySelector('.sc-block') as Element, { x: 5, y: 5 })
    act(() => void vi.advanceTimersByTime(300))
    expect(onDrop).not.toHaveBeenCalled()
    expect(container.querySelector('.sc-ghost')).toBeNull()
  })

  it('tells the scene which building glows while a block is over it, and clears it on release', () => {
    const onHover = vi.fn()
    const { container } = render(<PowerTray blocks={6} calm resolve={resolveTo('shield')} onHover={onHover} onDrop={() => undefined} />)
    drag(container.querySelector('.sc-block') as Element, { x: 180, y: 190 })
    expect(onHover).toHaveBeenNthCalledWith(1, 'shield')
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('a disabled tray cannot be dragged', () => {
    const onDrop = vi.fn()
    const { container } = render(<PowerTray blocks={6} calm disabled resolve={resolveTo('air')} onDrop={onDrop} />)
    drag(container.querySelector('.sc-block') as Element, { x: 180, y: 270 })
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('on touch the block rides above the finger, and the hit is tested at the block', () => {
    const resolve = vi.fn(() => null as Target | null)
    const { container } = render(<PowerTray blocks={6} calm resolve={resolve} onDrop={() => undefined} />)
    const b = container.querySelector('.sc-block') as Element
    fireEvent.pointerDown(b, { clientX: 20, clientY: 600, pointerId: 1, pointerType: 'touch' })
    fireEvent.pointerMove(b, { clientX: 100, clientY: 400, pointerId: 1, pointerType: 'touch' })
    expect(resolve).toHaveBeenLastCalledWith(100, 356)
  })
})

describe('bubbles and meters', () => {
  it('ORBI asks with three picture buttons of at least 64 px and no words on screen', () => {
    const onGuess = vi.fn()
    const { container } = render(<OrbiBubble onGuess={onGuess} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    for (const b of buttons) {
      expect(parseInt((b as HTMLElement).style.minWidth)).toBeGreaterThanOrEqual(64)
      expect(parseInt((b as HTMLElement).style.minHeight)).toBeGreaterThanOrEqual(64)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Space rays' }))
    fireEvent.click(screen.getByRole('button', { name: 'Calm Sun' }))
    fireEvent.click(screen.getByRole('button', { name: 'Not sure' }))
    expect(onGuess.mock.calls.map((c) => c[0])).toEqual(['rays', 'calm', 'unsure'])
    expect((container.textContent ?? '').trim()).toBe('')
  })

  it('a crew bubble holds a picture and two picture buttons', () => {
    const a = vi.fn()
    const b = vi.fn()
    render(
      <CrewBubble who="kofi">
        <span data-testid="pic" />
        <PictureButton label="Share" onClick={a}>
          <i />
        </PictureButton>
        <PictureButton label="Keep" onClick={b}>
          <i />
        </PictureButton>
      </CrewBubble>,
    )
    expect(screen.getByTestId('pic')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(a).toHaveBeenCalled()
    expect(b).toHaveBeenCalled()
  })

  it('the bubble tail points at its speaker and stays inside the scene', () => {
    const { container } = render(
      <CrewBubble who="mei">
        <i />
      </CrewBubble>,
    )
    const el = container.querySelector('.sc-bubble') as HTMLElement
    const left = parseFloat(el.style.left)
    const width = parseFloat(el.style.width)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left + width).toBeLessThanOrEqual(100)
  })

  it('bars are pictures: a danger bar also gets a warning shape, and there are no numbers or words', () => {
    const { container } = render(<MeterStrip values={{ air: 20, power: 80, radiation: 70, food: 50 }} />)
    expect(container.querySelectorAll('.sc-meter.danger')).toHaveLength(2)
    expect((container.textContent ?? '').trim()).toBe('')
    expect(screen.getByRole('meter', { name: 'Radiation' }).getAttribute('aria-valuetext')).toBe('high')
  })
})

describe('building the scene from the real game', () => {
  const calmGame = (): GameState => ({ ...newGame({ mode: 'commander', siteId: 'region-3', seed: 2 }), storms: [], flares: [], flareSeen: [], flareResolved: [] })
  const watched = (): GameState => ({
    ...calmGame(),
    day: 3,
    storms: [{ stormId: 'storm-6', arrivalDay: 4, size: 'small', profile: [1] }],
    flares: [{ flareId: 'flr-44029', day: 2, stormIndex: 0 }],
    flareSeen: [true],
    flareResolved: [false],
  })

  it('a calm day has no flare; blocks and shield charge come through', () => {
    const m = sceneModelFromGame({ ...calmGame(), shield: 2 }, { shield: 1, air: 2 })
    expect(m.flare).toBeNull()
    expect(m.shield).toBe(3)
    expect(m.blocks).toMatchObject({ shield: 1, air: 2, walk: 0 })
    expect(m.storm).toBe('none')
  })

  it('a flare watch gives the plain clues and never the answer', () => {
    const m = sceneModelFromGame(watched())
    expect(m.flare).toEqual({ size: 'medium', cloud: true, side: 'east', daysSince: 1 })
    expect(m.showSide).toBe(true)
    expect(m.storm).toBe('coming')
    const text = JSON.stringify(m)
    expect(text).not.toMatch(/followed|arrival|stormIndex|sep/i)
  })

  it('Cadet does not show the Sun side', () => {
    expect(sceneModelFromGame({ ...watched(), mode: 'cadet' }).showSide).toBe(false)
  })

  it('the reveal comes from the finished day: rays after a storm, all-clear after a watch with no storm, nothing otherwise', () => {
    const base = { day: 3, resolved: [], shieldAfter: 0 } as unknown as DayRecord
    const rays = revealFromRecord({ ...base, storm: { index: 0, factor: 1, shield: 3, letsThrough: 0.35, incoming: 120, warned: true } }, 'west')
    expect(rays).toMatchObject({ kind: 'rays', shield: 3, side: 'west' })
    expect(rays?.count).toBeGreaterThan(12)
    expect(revealFromRecord({ ...base, storm: null, resolved: [{ flareId: 'x', followed: false, guess: null, reward: 0 }], shieldAfter: 2 })).toMatchObject({ kind: 'clear', shield: 2 })
    expect(revealFromRecord({ ...base, storm: null })).toBeNull()
    expect(revealFromRecord(undefined)).toBeNull()
  })

  it('the finished scene renders from a real game', () => {
    const { container } = render(<MoonBaseScene model={sceneModelFromGame(watched())} />)
    expect(container.querySelector('.sc-burst')).not.toBeNull()
    expect((container.textContent ?? '').trim()).toBe('')
  })
})
