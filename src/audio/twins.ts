/**
 * Visual twins: every sound announces itself here, so the screen can show a flash, glow, caption chip or icon pulse.
 * Events fire even when sound is off or not yet unlocked (the game must be fully playable muted).
 * Each event says whether the child prefers reduced motion; if so, show a still caption instead of a flash or pulse.
 *
 * Called by: every function in events.ts, hum.ts, motif.ts. The game subscribes with onTwin() (e.g. in App.tsx).
 */
import { soundEnabled } from './core'

export interface TwinEvent {
  /** Which sound: 'flare', 'shield', 'rays', 'allClear', 'science', 'lowWarning', 'moonwalk', 'missionComplete', 'missionFailed', 'cardFlip', 'orbiHello', 'dayStart', 'blockPlaced', 'unlock', 'mood'. */
  kind: string
  reducedMotion: boolean
  /** True if the sound itself is off (Settings) so the visual must carry the whole message. */
  muted: boolean
  [detail: string]: unknown
}

const subs = new Set<(e: TwinEvent) => void>()
let haptics = false

export function onTwin(fn: (e: TwinEvent) => void): () => void {
  subs.add(fn)
  return () => {
    subs.delete(fn)
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Optional short buzz (Android) on the events that matter. Off by default. */
export function setHaptics(on: boolean): void {
  haptics = on
}

const BUZZ = new Set(['flare', 'rays', 'allClear', 'missionComplete'])

export function emitTwin(kind: string, detail: Record<string, unknown> = {}): void {
  const e: TwinEvent = { ...detail, kind, reducedMotion: prefersReducedMotion(), muted: !soundEnabled() }
  if (haptics && BUZZ.has(kind) && !e.reducedMotion) {
    try {
      navigator.vibrate?.(30)
    } catch {
      /* not supported */
    }
  }
  for (const fn of [...subs]) {
    try {
      fn(e)
    } catch {
      /* a broken listener must not break the sound */
    }
  }
}
