import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BatteryCharging,
  Bed,
  Cake,
  Camera,
  Clock,
  Flame,
  Footprints,
  Hammer,
  Apple,
  Hand,
  House,
  Lightbulb,
  LightbulbOff,
  MapPin,
  Package,
  Paintbrush,
  Pickaxe,
  Radiation,
  Shirt,
  SkipForward,
  Sparkles,
  Sprout,
  Sunrise,
  TriangleAlert,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { Option } from '../engine/types'

/**
 * Each crew card, drawn for a child who reads little: a 3-4 word line for the situation and, for each choice, a picture of the action
 * and one or two words. The full sentences stay on the buttons as accessible names (screen readers and read-aloud use them).
 */
interface Pic {
  Icon: LucideIcon
  word: string
}
export const CARD_ART: Record<string, { q: string; a: Pic; b: Pic }> = {
  dust: { q: 'Dusty solar panels', a: { Icon: Paintbrush, word: 'Clean it' }, b: { Icon: Hand, word: 'Leave it' } },
  cough: { q: 'Leo coughs', a: { Icon: Bed, word: 'Rest' }, b: { Icon: Footprints, word: 'Keep going' } },
  pump: { q: 'Squeaky air pump', a: { Icon: Wrench, word: 'Fix it' }, b: { Icon: Clock, word: 'Wait' } },
  supply: { q: 'Supply box!', a: { Icon: Package, word: 'Fetch it' }, b: { Icon: House, word: 'Stay in' } },
  earth: { q: 'Earth is bright', a: { Icon: Camera, word: 'Send photo' }, b: { Icon: SkipForward, word: 'Skip' } },
  cold: { q: 'Cold night', a: { Icon: Flame, word: 'Heat up' }, b: { Icon: Shirt, word: 'Coats' } },
  hatch: { q: 'Stuck hatch', a: { Icon: Hammer, word: 'Force it' }, b: { Icon: Wrench, word: 'Mend it' } },
  rock: { q: 'Shiny rock!', a: { Icon: Pickaxe, word: 'Dig now' }, b: { Icon: MapPin, word: 'Dig later' } },
  lamp: { q: 'Flickering lamp', a: { Icon: BatteryCharging, word: 'New battery' }, b: { Icon: LightbulbOff, word: 'Stay dim' } },
  birthday: { q: 'Safia’s birthday', a: { Icon: Cake, word: 'Treat' }, b: { Icon: SkipForward, word: 'Skip' } },
}
// Kept so a card without art (a future one) still shows something sensible.
export const FALLBACK: Pic = { Icon: Lightbulb, word: 'Choose' }

/** What a choice does, as small pictures: a gain is an arrow up, a cost an arrow down. A sunrise in front means "tomorrow". */
export function Effects({ o }: { o: Option }) {
  const chips: { Icon: LucideIcon; up: boolean; color: string; later?: boolean }[] = []
  if (o.science) chips.push({ Icon: Sparkles, up: o.science > 0, color: 'var(--sun)' })
  if (o.power) chips.push({ Icon: Zap, up: o.power > 0, color: 'var(--power)' })
  if (o.air) chips.push({ Icon: Wind, up: o.air > 0, color: 'var(--air)' })
  if (o.food) chips.push({ Icon: Apple, up: o.food > 0, color: 'var(--plants)' })
  if (o.radiation) chips.push({ Icon: Radiation, up: o.radiation > 0, color: 'var(--radiation)' })
  if (o.slowWalk) chips.push({ Icon: Footprints, up: false, color: 'var(--muted)' })
  if (o.slowPlants) chips.push({ Icon: Sprout, up: false, color: 'var(--muted)' })
  if (o.failChance) chips.push({ Icon: TriangleAlert, up: true, color: 'var(--radiation)', later: true })
  if (o.carry?.power) chips.push({ Icon: Zap, up: o.carry.power > 0, color: 'var(--power)', later: true })
  if (o.carry?.science) chips.push({ Icon: Sparkles, up: o.carry.science > 0, color: 'var(--sun)', later: true })
  if (chips.length === 0) chips.push({ Icon: ArrowRight, up: true, color: 'var(--muted)' })
  return (
    <span className="fx" aria-hidden="true">
      {chips.slice(0, 4).map(({ Icon, up, color, later }, i) => (
        <span key={i}>
          {later && <Sunrise size={13} color="var(--muted)" />}
          <Icon size={16} color={color} />
          {up ? <ArrowUp size={13} color={color} /> : <ArrowDown size={13} color={color} />}
        </span>
      ))}
    </span>
  )
}

/** One choice: a picture of the action, one or two words, and what it costs or gives. At least 64 px tall. */
export function OptionButton({ pic, option, pressed, onClick }: { pic: Pic; option: Option; pressed: boolean; onClick: () => void }) {
  const { Icon, word } = pic
  return (
    <button type="button" className="optbtn" aria-label={`${word}. ${option.label}`} aria-pressed={pressed} onClick={onClick}>
      <span className="optrow">
        <Icon size={30} aria-hidden="true" />
        <span className="optword">{word}</span>
      </span>
      <Effects o={option} />
    </button>
  )
}
