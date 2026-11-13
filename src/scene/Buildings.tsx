import { useId, type KeyboardEvent, type ReactNode } from 'react'
import type { Target } from './model'
import { ZONES, zoneCenter } from './zones'
import { DOME, HORIZON, PAL } from './tokens'

const press = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

const halfEllipse = `M${DOME.cx - DOME.rx} ${HORIZON} A${DOME.rx} ${DOME.ry} 0 0 1 ${DOME.cx + DOME.rx} ${HORIZON}Z`

/** The moon ground, craters and the soft shadows the buildings throw. The shadows slide with the Sun. */
export function Ground({ sunX, sunny }: { sunX: number; sunny: boolean }) {
  const off = (sunX - 180) / 150 // -1 (Sun on the left) to 1 (Sun on the right)
  return (
    <g className="sc-ground">
      <path d="M0 300 Q180 292 360 300 L360 440 L0 440Z" fill={PAL.moon} />
      <g fill={PAL.moonDark}>
        <ellipse cx="40" cy="372" rx="26" ry="6" />
        <ellipse cx="250" cy="420" rx="30" ry="6" />
        <ellipse cx="338" cy="360" rx="16" ry="4" />
        <ellipse cx="120" cy="418" rx="20" ry="5" />
        <ellipse cx="330" cy="326" rx="14" ry="3.5" />
      </g>
      <g className="sc-move sc-shadows" data-sun={sunny ? 'yes' : 'no'} fill="#0f1a33" style={{ transform: `translateX(${(-off * 20).toFixed(1)}px) scaleX(${(1 + Math.abs(off) * 0.9).toFixed(2)})`, transformOrigin: '180px 304px', opacity: sunny ? 0.22 : 0 }}>
        <ellipse cx="87" cy="304" rx="26" ry="4" />
        <ellipse cx="180" cy="304" rx="46" ry="4.5" />
        <ellipse cx="266" cy="304" rx="32" ry="4" />
        <ellipse cx="330" cy="306" rx="14" ry="3" />
      </g>
    </g>
  )
}

/** Six little slots under a building. Lit = amber block with a shine, empty = dashed outline. */
export function Pips({ cx, y, count, max = 6 }: { cx: number; y: number; count: number; max?: number }) {
  const w = max * 9 - 2
  return (
    <g className="sc-pips" data-count={count} aria-hidden="true">
      <rect x={cx - w / 2 - 4} y={y - 3} width={w + 8} height={13} rx={6.5} fill={PAL.night} opacity="0.62" />
      {Array.from({ length: max }, (_, i) => {
        const on = i < count
        return (
          <g key={i} transform={`translate(${(cx - w / 2 + i * 9).toFixed(1)} ${y})`}>
            <rect className={`sc-pip${on ? ' on' : ''}`} width="7" height="7" rx="2" fill={on ? PAL.amber : 'none'} stroke={on ? '#fff3c4' : PAL.cream} strokeWidth={on ? 1 : 1.2} opacity={on ? 1 : 0.5} />
          </g>
        )
      })}
    </g>
  )
}

interface BuildingProps {
  count: number
}

export function Habitat({ count, powerLow }: BuildingProps & { powerLow: boolean }) {
  const id = useId()
  const lit = powerLow ? PAL.dull : '#F0E442'
  return (
    <g className="sc-habitat">
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d="M138 300 L138 280 A42 40 0 0 1 222 280 L222 300Z" />
        </clipPath>
      </defs>
      <rect x="110" y="288" width="30" height="10" fill={PAL.cream} stroke={PAL.line} strokeWidth="2" />
      <path d="M138 300 L138 280 A42 40 0 0 1 222 280 L222 300Z" fill={PAL.cream} stroke={PAL.line} strokeWidth="2" />
      <g clipPath={`url(#${id}-clip)`}>
        <rect className="sc-fill" x="138" y="240" width="84" height="60" fill={PAL.air} opacity="0.55" style={{ transform: `scaleY(${count / 6})` }} data-fill={count} />
      </g>
      <g className={`sc-windows${powerLow ? ' low' : ''}`} fill={lit} stroke={PAL.line} strokeWidth="1.5">
        <circle cx="158" cy="277" r="5.5" />
        <circle cx="180" cy="266" r="5.5" />
        <circle cx="202" cy="277" r="5.5" />
      </g>
      <rect x="174" y="284" width="12" height="16" rx="2" fill={PAL.line} />
    </g>
  )
}

export function Greenhouse({ count, happy }: BuildingProps & { happy: boolean }) {
  const grow = 0.6 + (count / 6) * 0.45
  const stems = [250, 266, 282]
  return (
    <g className="sc-greenhouse" data-happy={happy ? 'yes' : 'no'}>
      <path d="M238 300 A28 40 0 0 1 294 300Z" fill="#bfe8d8" stroke={PAL.line} strokeWidth="2" />
      <g className="sc-move sc-plants-ok" style={{ opacity: happy ? 1 : 0, transform: `scaleY(${grow.toFixed(2)})` }} stroke={PAL.plants} strokeWidth="3.5" strokeLinecap="round" fill="none" data-grow={grow.toFixed(2)}>
        {stems.map((x, i) => (
          <g key={x}>
            <path d={`M${x} 298 L${x} ${280 - (i === 1 ? 6 : 0)}`} />
            <circle cx={x} cy={277 - (i === 1 ? 6 : 0)} r="4.5" fill={PAL.plants} />
            <path d={`M${x} 290 q${i === 1 ? 8 : -8} -3 ${i === 1 ? 10 : -10} -9`} strokeWidth="2.5" />
          </g>
        ))}
      </g>
      <g className="sc-move sc-plants-sad" style={{ opacity: happy ? 0 : 1 }} stroke={PAL.wilt} strokeWidth="3.5" strokeLinecap="round" fill="none">
        {stems.map((x) => (
          <g key={x}>
            <path d={`M${x} 298 Q${x} 284 ${x + 8} 290`} />
            <path d={`M${x + 8} 290 q4 2 3 7`} strokeWidth="2.5" />
          </g>
        ))}
      </g>
    </g>
  )
}

export function Dish({ count, earth }: BuildingProps & { earth: boolean }) {
  const arcs = Math.ceil(count / 2)
  const tone = earth ? PAL.radio : '#6b7488'
  return (
    <g className="sc-dish" data-earth={earth ? 'yes' : 'no'}>
      <line x1="330" y1="302" x2="330" y2="272" stroke={PAL.line} strokeWidth="4" strokeLinecap="round" />
      <rect x="322" y="298" width="16" height="5" rx="2" fill={PAL.line} />
      <g className="sc-move sc-dish-head" style={{ transform: `rotate(${earth ? -38 : 24}deg)`, transformOrigin: '330px 270px' }}>
        <path d="M314 262 Q330 288 346 262" fill="none" stroke={tone} strokeWidth="5.5" strokeLinecap="round" strokeDasharray={earth ? undefined : '7 5'} />
        <circle cx="330" cy="256" r="3" fill={tone} />
      </g>
      {earth && (
        <g fill="none" stroke={PAL.radio} strokeWidth="3" strokeLinecap="round">
          {[1, 2, 3].map((n) => (
            <path key={n} className={`sc-wave${n <= arcs ? ' on' : ''}`} d={`M${330 - 6 - n * 7} ${244 - n * 3} Q330 ${238 - n * 11} ${330 + 6 + n * 7} ${244 - n * 3}`} opacity={n <= arcs ? 1 : 0.2} style={{ animationDelay: `${n * 180}ms` }} />
          ))}
        </g>
      )}
    </g>
  )
}

export function Airlock({ count, open }: BuildingProps & { open: boolean }) {
  return (
    <g className="sc-airlock" data-open={open ? 'yes' : 'no'}>
      <path d="M64 300 L64 272 Q64 262 74 262 L100 262 Q110 262 110 272 L110 300Z" fill="#dfe3ea" stroke={PAL.line} strokeWidth="2" />
      <path d="M78 300 L78 284 A9 9 0 0 1 96 284 L96 300Z" fill={count > 0 || open ? PAL.amber : PAL.line} opacity={count > 0 || open ? 0.9 : 1} />
      <g className="sc-move sc-door" style={{ transform: `scaleX(${open ? 0.12 : 1})`, transformOrigin: '78px 292px' }}>
        <path d="M78 300 L78 284 A9 9 0 0 1 96 284 L96 300Z" fill="#9aa3b5" stroke={PAL.line} strokeWidth="1.5" />
      </g>
      <circle cx="87" cy="266" r="3" fill={count > 0 ? PAL.amber : PAL.dull} />
    </g>
  )
}

/** Solar panels on the front ground. When blocks are placed, small amber dots run along the wire to the base. */
export function SolarPanels({ sunny, wired }: { sunny: boolean; wired: boolean }) {
  return (
    <g className="sc-panels">
      <path d="M234 336 L258 330 L264 346 L240 352Z" fill={sunny ? PAL.air : '#26436f'} stroke={PAL.cream} strokeWidth="1.5" />
      <path d="M262 329 L286 323 L292 339 L268 345Z" fill={sunny ? PAL.air : '#26436f'} stroke={PAL.cream} strokeWidth="1.5" />
      <line x1="250" y1="350" x2="250" y2="360" stroke={PAL.cream} strokeWidth="1.5" />
      <line x1="278" y1="344" x2="278" y2="354" stroke={PAL.cream} strokeWidth="1.5" />
      <path d="M236 334 Q214 330 204 304" fill="none" stroke={PAL.line} strokeWidth="2.5" strokeLinecap="round" />
      {wired && (
        <g className="sc-wire-dots" fill={PAL.amber}>
          {[0, 1, 2].map((i) => (
            <circle key={i} className="sc-wire-dot" r="2.8" cx="236" cy="334" style={{ animationDelay: `${i * 400}ms` }} />
          ))}
        </g>
      )}
    </g>
  )
}

/** A drop target: focusable, named for screen readers, tappable (select) and highlighted while a block hovers over it. */
export function BuildingTarget({ id, label, count, hot, selected, disabled, onSelect, children }: { id: Target; label: string; count: number; hot: boolean; selected: boolean; disabled?: boolean; onSelect?: (t: Target) => void; children?: ReactNode }) {
  const z = ZONES[id]
  const pick = () => onSelect?.(id)
  return (
    <g
      className={`sc-building${hot ? ' hot' : ''}${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
      data-building={id}
      data-count={count}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${label}, ${count} ${count === 1 ? 'block' : 'blocks'}`}
      aria-disabled={disabled ? true : undefined}
      onClick={disabled ? undefined : pick}
      onKeyDown={disabled ? undefined : press(pick)}
    >
      {children}
      {id !== 'shield' && <rect className="sc-zone" x={z.x} y={z.y} width={z.w} height={z.h} rx="10" fill="transparent" />}
      {(hot || selected) && id !== 'shield' && <rect className="sc-hot" x={z.x - 2} y={z.y - 2} width={z.w + 4} height={z.h + 4} rx="12" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray={hot ? undefined : '6 4'} />}
    </g>
  )
}

/** The dome as a target: the whole half ellipse, behind the buildings. Its glow ring shows while a block hovers over it. */
export function DomeTarget({ count, hot, selected, onSelect }: { count: number; hot: boolean; selected: boolean; onSelect?: (t: Target) => void }) {
  const pick = () => onSelect?.('shield')
  return (
    <g className={`sc-building${hot ? ' hot' : ''}${selected ? ' selected' : ''}`} data-building="shield" data-count={count} role="button" tabIndex={0} aria-label={`Shield, ${count} ${count === 1 ? 'block' : 'blocks'}`} onClick={pick} onKeyDown={press(pick)}>
      <path className="sc-zone" d={halfEllipse} fill="transparent" />
      {(hot || selected) && <path className="sc-hot" d={halfEllipse} fill="#ffffff" fillOpacity="0.1" stroke="#fff" strokeWidth="3" strokeDasharray={hot ? undefined : '6 4'} />}
    </g>
  )
}

/** The +/- fallback for kids who do not drag: two 44 px round buttons under the chosen building. */
export function Stepper({ target, count, canAdd, onAdd, onRemove, y }: { target: Target; count: number; canAdd: boolean; onAdd?: (t: Target) => void; onRemove?: (t: Target) => void; y?: number }) {
  const c = zoneCenter(target)
  const cx = Math.max(50, Math.min(310, c.x))
  const cy = y ?? (target === 'shield' ? 332 : 330)
  const max = ZONES[target].max
  const canRemove = count > 0
  const addOk = canAdd && count < max
  return (
    <g className="sc-stepper" data-for={target}>
      <g className={`sc-step minus${canRemove ? '' : ' off'}`} role="button" tabIndex={canRemove ? 0 : -1} aria-label={`Fewer blocks, ${target}`} aria-disabled={canRemove ? undefined : true} onClick={canRemove ? () => onRemove?.(target) : undefined} onKeyDown={canRemove ? press(() => onRemove?.(target)) : undefined}>
        <circle cx={cx - 26} cy={cy} r="22" fill={PAL.night} stroke={PAL.cream} strokeWidth="2.5" />
        <line x1={cx - 35} y1={cy} x2={cx - 17} y2={cy} stroke={PAL.cream} strokeWidth="4.5" strokeLinecap="round" />
      </g>
      <g className={`sc-step plus${addOk ? '' : ' off'}`} role="button" tabIndex={addOk ? 0 : -1} aria-label={`More blocks, ${target}`} aria-disabled={addOk ? undefined : true} onClick={addOk ? () => onAdd?.(target) : undefined} onKeyDown={addOk ? press(() => onAdd?.(target)) : undefined}>
        <circle cx={cx + 26} cy={cy} r="22" fill={PAL.amber} stroke="#fff3c4" strokeWidth="2.5" />
        <line x1={cx + 17} y1={cy} x2={cx + 35} y2={cy} stroke={PAL.night} strokeWidth="4.5" strokeLinecap="round" />
        <line x1={cx + 26} y1={cy - 9} x2={cx + 26} y2={cy + 9} stroke={PAL.night} strokeWidth="4.5" strokeLinecap="round" />
      </g>
    </g>
  )
}

export const PIP_SPOTS: Record<Exclude<Target, 'shield'>, { cx: number; y: number; max: number }> = {
  walk: { cx: 87, y: 305, max: 2 },
  air: { cx: 180, y: 305, max: 6 },
  plants: { cx: 266, y: 305, max: 6 },
  radio: { cx: 324, y: 307, max: 6 },
}
