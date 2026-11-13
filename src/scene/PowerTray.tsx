import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Target } from './model'
import { useReducedMotion } from './motion'
import { DUR, EASE } from './tokens'

export interface PowerTrayProps {
  /** Blocks left in the tray (0 to `total`). */
  blocks: number
  /** Slots shown (the 6 daily blocks). */
  total?: number
  /** Which building is under this screen point (the scene's `jobAt`). null = none. */
  resolve: (clientX: number, clientY: number) => Target | null
  /** The screen centre of a building, where the block lands (the scene's `centerOf`). */
  centerOf?: (t: Target) => { x: number; y: number } | null
  /** The block landed on a building. Subtract it from the tray and add it to the building here. */
  onDrop: (t: Target) => void
  /** The building under the block while it is dragged (for the glow), or null. */
  onHover?: (t: Target | null) => void
  disabled?: boolean
  calm?: boolean
}

interface Drag {
  slot: number
  x: number
  y: number
}

const LIFT = 44 // a finger hides the block, so the block rides above it on touch

/**
 * The six glowing power blocks under the scene. Drag one onto a building (pointer events, so touch works):
 * it follows the finger, and on release flies to the building in 320 ms and lands (the building squashes a little).
 * Dropped nowhere, it flies back in 240 ms. With reduced motion it lands at once.
 */
export function PowerTray({ blocks, total = 6, resolve, centerOf, onDrop, onHover, disabled = false, calm = false }: PowerTrayProps) {
  const reduced = useReducedMotion(calm)
  const [drag, setDrag] = useState<Drag | null>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const slots = useRef<(HTMLElement | null)[]>([])
  const hover = useRef<Target | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const flying = useRef(false)
  const lift = useRef(0)
  const pos = useRef({ x: 0, y: 0 })

  useEffect(() => () => clearTimeout(timer.current), [])

  useLayoutEffect(() => {
    if (drag) move(pos.current.x, pos.current.y)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag])

  const setHover = useCallback(
    (t: Target | null) => {
      if (hover.current !== t) {
        hover.current = t
        onHover?.(t)
      }
    },
    [onHover],
  )

  const move = (x: number, y: number) => {
    pos.current = { x, y }
    const g = ghost.current
    if (g) g.style.transform = `translate(${x - 24}px, ${y - 24 - lift.current}px)`
  }

  const down = (slot: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || flying.current) return
    lift.current = e.pointerType === 'touch' ? LIFT : 0
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* some browsers refuse capture on a synthetic pointer */
    }
    setDrag({ slot, x: e.clientX, y: e.clientY })
    pos.current = { x: e.clientX, y: e.clientY }
  }

  const moveEv = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || flying.current) return
    move(e.clientX, e.clientY)
    setHover(resolve(e.clientX, e.clientY - lift.current))
  }

  const finish = (target: Target | null, e: { clientX: number; clientY: number }) => {
    const g = ghost.current
    setHover(null)
    const done = (hit: Target | null) => {
      flying.current = false
      setDrag(null)
      if (hit) onDrop(hit)
    }
    if (reduced || !g) {
      done(target)
      return
    }
    flying.current = true
    if (target) {
      const c = centerOf?.(target) ?? { x: e.clientX, y: e.clientY - lift.current }
      g.style.transition = `transform ${DUR.fly}ms ${EASE.enter}`
      g.style.transform = `translate(${c.x - 24}px, ${c.y - 24}px) scale(.8)`
      timer.current = setTimeout(() => done(target), DUR.fly)
    } else {
      const s = drag ? slots.current[drag.slot]?.getBoundingClientRect() : undefined
      g.style.transition = `transform ${DUR.ui}ms ${EASE.state}`
      if (s) g.style.transform = `translate(${s.left + s.width / 2 - 24}px, ${s.top + s.height / 2 - 24}px)`
      timer.current = setTimeout(() => done(null), DUR.ui)
    }
  }

  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || flying.current) return
    finish(resolve(e.clientX, e.clientY - lift.current), e)
  }

  const cancel = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || flying.current) return
    finish(null, e)
  }

  return (
    <div className="sc-tray" role="group" aria-label="Power blocks" data-blocks={blocks}>
      {Array.from({ length: total }, (_, i) => {
        const has = i < blocks
        return (
          <span key={i} className="sc-slot" ref={(el) => void (slots.current[i] = el)}>
            {has && (
              <button
                type="button"
                className={`sc-block${drag?.slot === i ? ' lifted' : ''}`}
                aria-label="Power block"
                disabled={disabled}
                onPointerDown={down(i)}
                onPointerMove={moveEv}
                onPointerUp={up}
                onPointerCancel={cancel}
              >
                <i aria-hidden="true" />
              </button>
            )}
          </span>
        )
      })}
      {drag && (
        <div ref={ghost} className="sc-ghost" aria-hidden="true">
          <i />
        </div>
      )}
    </div>
  )
}
