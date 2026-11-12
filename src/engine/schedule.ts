import { STORM_DEFAULT_PROFILE, STORM_MAX_DAYS } from './constants'
import type { StormSize } from './types'

export function spreadDays(share: number, n: number, phase: number): boolean[] {
  return Array.from({ length: n }, (_, i) => Math.floor((i + 1) * share + phase) > Math.floor(i * share + phase))
}

// Turns an hourly storm shape (relative to its own peak) into daily strengths, peak day = 1.
export function stormProfile(size: StormSize, relative: number[] | null): number[] {
  if (!relative || relative.length < 24) return [...STORM_DEFAULT_PROFILE[size]]
  const peak = relative.indexOf(Math.max(...relative))
  const start = Math.max(0, peak - 12)
  const days: number[] = []
  for (let d = 0; d < STORM_MAX_DAYS[size]; d++) {
    const chunk = relative.slice(start + d * 24, start + (d + 1) * 24)
    if (chunk.length === 0) break
    const m = Math.max(...chunk)
    if (d > 0 && m < 0.1) break
    days.push(Math.round(m * 100) / 100)
  }
  return days.length > 0 ? days : [...STORM_DEFAULT_PROFILE[size]]
}
