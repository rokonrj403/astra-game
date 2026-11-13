import { useMemo } from 'react'
import { Globe, Sun } from 'lucide-react'
import sites from '../data/sites.json'

/** One or two words for the map; the full real name is the button's label for screen readers and shows once a place is picked. */
export const SHORT: Record<string, string> = {
  'region-1': 'Cabeus',
  'region-2': 'Haworth',
  'region-3': 'Malapert',
  'region-4': 'Plateau',
  'region-5': 'Mouton',
  'region-6': 'Nobile 1',
  'region-7': 'Nobile 2',
  'region-8': 'Gerlache',
  'region-9': 'Slater',
}

const BOX_W = 340
const BOX_H = 400
const CX = BOX_W / 2
const CY = BOX_H / 2 - 4
const REACH = 160 // pixels from the pole to the farthest region
const PIN_W = 88
const PIN_H = 62

/**
 * Where each region sits on a stylised map of the South Pole: distance from the pole = its latitude, direction = its longitude (0 degrees at the top).
 * Each pin is snapped to the nearest free cell of a grid so none sit on top of each other: this is a picture, not a survey. The real numbers (Sun and Earth shares) are on the pins.
 */
export function pinSpots(): Record<string, { x: number; y: number }> {
  const farthest = Math.max(...sites.map((s) => 90 + s.latDeg.value))
  const pts = sites.map((s) => {
    const r = ((90 + s.latDeg.value) / farthest) * REACH
    const a = (s.lonDegEast.value * Math.PI) / 180
    return { id: s.id, x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) }
  })
  // Snap each pin to the nearest free cell of a 3 x 4 grid (closest pairs first), so no two pins can overlap.
  const cells: { x: number; y: number }[] = []
  for (const cy of [1, 3, 5, 7]) for (const cx of [1, 3, 5]) cells.push({ x: (BOX_W / 6) * cx, y: (BOX_H / 8) * cy })
  const pairs = pts.flatMap((p, i) => cells.map((c, j) => ({ i, j, d: Math.hypot(p.x - c.x, p.y - c.y) })))
  pairs.sort((u, v) => u.d - v.d)
  const usedPin = new Set<number>()
  const usedCell = new Set<number>()
  for (const { i, j } of pairs) {
    if (usedPin.has(i) || usedCell.has(j)) continue
    usedPin.add(i)
    usedCell.add(j)
    pts[i]!.x = cells[j]!.x
    pts[i]!.y = cells[j]!.y
  }
  return Object.fromEntries(pts.map((p) => [p.id, { x: p.x, y: p.y }]))
}

/** The ground of the map: rings of latitude, a few stylised craters, the pole at the centre. No words. */
function Terrain() {
  return (
    <svg className="polemap-art" viewBox={`0 0 ${BOX_W} ${BOX_H}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="pm-ground" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#5b6478" />
          <stop offset="0.7" stopColor="#8d94a3" />
          <stop offset="1" stopColor="#b7bcc6" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={BOX_W / 2 - 2} fill="url(#pm-ground)" stroke="#34476e" strokeWidth="3" />
      {[0.34, 0.67].map((k) => (
        <circle key={k} cx={CX} cy={CY} r={(BOX_W / 2 - 2) * k} fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="4 6" />
      ))}
      {/* Craters: a shaded bowl with a bright rim on the lit side. Their places are for the picture only. */}
      {[
        { x: 118, y: 150, r: 46 },
        { x: 232, y: 214, r: 34 },
        { x: 70, y: 232, r: 26 },
        { x: 250, y: 96, r: 24 },
        { x: 172, y: 262, r: 22 },
        { x: 196, y: 118, r: 18 },
        { x: 290, y: 176, r: 16 },
      ].map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={c.r} fill="#3f475a" opacity="0.55" />
          <path d={`M ${c.x - c.r} ${c.y} A ${c.r} ${c.r} 0 0 1 ${c.x + c.r} ${c.y}`} fill="none" stroke="#e6e9f0" strokeOpacity="0.7" strokeWidth="3" />
        </g>
      ))}
      <circle cx={CX} cy={CY} r="5" fill="#0f1a33" />
    </svg>
  )
}

/**
 * A little landscape for the chosen place: where the Sun hangs and whether the ground is lit.
 * A bright ridge has the Sun high and a lit slope; a dark crater floor has the Sun low and shade. Earth hangs in view in proportion to how often it is seen there.
 * Both are the real LOLA shares for the best spot near the region, drawn as a picture.
 */
export function Landscape({ sun, earth }: { sun: number; earth: number }) {
  const lit = sun >= 0.7
  const sunY = 72 - sun * 52
  return (
    <svg className="landscape" viewBox="0 0 340 100" role="img" aria-label={`${Math.round(sun * 100)} percent sunlight, Earth in view ${Math.round(earth * 100)} percent of the time`}>
      <defs>
        <linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f1a33" />
          <stop offset="1" stopColor={lit ? '#2d4a86' : '#16264a'} />
        </linearGradient>
      </defs>
      <rect width="340" height="100" rx="14" fill="url(#ls-sky)" />
      <circle cx="268" cy="26" r="11" fill="#56b4e9" opacity={0.25 + earth * 0.75} />
      <circle cx="268" cy="26" r="11" fill="none" stroke="#56b4e9" strokeWidth="1.5" strokeDasharray={earth >= 0.97 ? undefined : '3 3'} />
      <circle cx="70" cy={sunY} r={sun >= 0.7 ? 14 : 10} fill="#f0a900" opacity={0.35 + sun * 0.65} />
      {lit ? (
        <path d="M0 100 L0 74 Q70 40 150 62 Q230 82 340 56 L340 100 Z" fill="#e3c77a" />
      ) : (
        <>
          <path d="M0 100 L0 56 Q40 52 80 78 Q170 94 260 78 Q300 54 340 58 L340 100 Z" fill="#3a4258" />
          <path d="M0 56 Q40 52 80 78 L0 78 Z" fill="#c9b074" />
        </>
      )}
    </svg>
  )
}

/** A bar for the pin: a small icon and a fill whose length is the real share. */
function Mini({ value, color, Icon }: { value: number; color: string; Icon: typeof Sun }) {
  return (
    <span className="mini" aria-hidden="true">
      <Icon size={14} color={color} />
      <span className="bar">
        <i style={{ width: `${Math.round(value * 100)}%`, background: color }} />
      </span>
    </span>
  )
}

export function PoleMap({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const spots = useMemo(pinSpots, [])
  return (
    <div className="polemap" style={{ aspectRatio: `${BOX_W} / ${BOX_H}` }}>
      <Terrain />
      {sites.map((s) => {
        const p = spots[s.id]!
        return (
          <button
            key={s.id}
            className="place pin"
            aria-pressed={selected === s.id}
            aria-label={s.name}
            title={s.name}
            style={{ left: `${((p.x - PIN_W / 2) / BOX_W) * 100}%`, top: `${((p.y - PIN_H / 2) / BOX_H) * 100}%`, width: `${(PIN_W / BOX_W) * 100}%`, height: `${(PIN_H / BOX_H) * 100}%` }}
            onClick={() => onSelect(s.id)}
          >
            <Mini value={s.sunShare.value} color="var(--sun)" Icon={Sun} />
            <Mini value={s.earthShare.value} color="var(--air)" Icon={Globe} />
            <span className="pinname">{SHORT[s.id]}</span>
          </button>
        )
      })}
    </div>
  )
}
