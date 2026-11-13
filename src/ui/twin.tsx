import { useEffect, useState } from 'react'
import { Bell, CloudRain, Footprints, Radiation, Rocket, ShieldCheck, Sparkles, Trophy, TriangleAlert, Zap, type LucideIcon } from 'lucide-react'
import { onTwin } from '../audio'

/**
 * Every sound has a picture twin: a short icon chip, so a child with the sound off (or on a quiet classroom phone) gets the same cue.
 * Only the cues that carry meaning show a chip. With reduced motion the chip appears without moving.
 */
const ICONS: Record<string, { Icon: LucideIcon; label: string }> = {
  flare: { Icon: Zap, label: 'A flare' },
  rays: { Icon: CloudRain, label: 'Space rays' },
  allClear: { Icon: ShieldCheck, label: 'All clear' },
  science: { Icon: Sparkles, label: 'Science' },
  lowWarning: { Icon: TriangleAlert, label: 'Low' },
  moonwalk: { Icon: Footprints, label: 'Moonwalk' },
  missionComplete: { Icon: Trophy, label: 'Mission complete' },
  missionFailed: { Icon: Rocket, label: 'Rescue' },
  notice: { Icon: Bell, label: 'Look' },
  rumble: { Icon: Radiation, label: 'Storm' },
}

export function TwinHost() {
  const [chip, setChip] = useState<{ kind: string; id: number; still: boolean } | null>(null)
  useEffect(
    () =>
      onTwin((e) => {
        if (ICONS[e.kind]) setChip({ kind: e.kind, id: Date.now() + Math.random(), still: e.reducedMotion })
      }),
    [],
  )
  useEffect(() => {
    if (!chip) return
    const t = setTimeout(() => setChip(null), 1400)
    return () => clearTimeout(t)
  }, [chip])
  if (!chip) return null
  const { Icon, label } = ICONS[chip.kind]!
  return (
    <div key={chip.id} className={`twin${chip.still ? ' still' : ''}`} role="status" aria-label={label}>
      <Icon size={28} aria-hidden="true" />
    </div>
  )
}
