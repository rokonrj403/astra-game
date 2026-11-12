import snapshot from '../data/snapshot.json'
import { browserStore, readJSON, writeJSON, type KeyValue } from './store'

/**
 * Today's Sun.
 *  LIVE  = NASA DONKI answered a request made just now and the answer passed checks.
 *  SAVED = we could not get a fresh answer, so this is an older copy (kept on this device, or bundled with the game).
 * Storm cards are labelled PAST in the UI; they never go through this loader.
 * Nothing here ever returns LIVE for bundled, cached or made-up data.
 */
export type SunStatus = 'LIVE' | 'SAVED'

export interface SunFlare {
  class: string
  peakTime: string
  link: string
}
export interface SunStorm {
  time: string
  kp: number
  link: string
}
export interface SunView {
  status: SunStatus
  /** LIVE: the moment we asked NASA. SAVED: the day (or moment) the copy was made. */
  asOf: string
  windowDays: number
  flares: SunFlare[]
  magneticStorm: SunStorm | null
  source: string
}

export const DONKI = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get'
export const DONKI_VIEW = 'https://ccmc.gsfc.nasa.gov/DONKI/view/'
const CACHE_KEY = 'astra-sun-v1'
const FLARE_DAYS = 7
const STORM_DAYS = 30
const TIMEOUT_MS = 6000
const DAY = 86_400_000

export interface LoadOptions {
  fetchFn?: typeof fetch
  now?: Date
  store?: KeyValue | null
}

const day = (d: Date) => d.toISOString().slice(0, 10)
const okLink = (s: unknown): s is string => typeof s === 'string' && s.startsWith(DONKI_VIEW)

function parseFlares(raw: unknown, now: Date): SunFlare[] {
  if (!Array.isArray(raw)) throw new Error('flares: not a list')
  const out: SunFlare[] = []
  for (const r of raw as Record<string, unknown>[]) {
    const cls = r?.classType
    const peak = r?.peakTime
    if (typeof cls !== 'string' || !/^[ABCMX]\d(\.\d)?$/.test(cls)) throw new Error('flares: bad class')
    if (typeof peak !== 'string' || Number.isNaN(Date.parse(peak))) throw new Error('flares: bad time')
    if (Date.parse(peak) > now.getTime() + 3_600_000) throw new Error('flares: time in the future')
    if (!okLink(r.link)) throw new Error('flares: bad link')
    out.push({ class: cls, peakTime: peak, link: r.link })
  }
  return out.sort((a, b) => Date.parse(b.peakTime) - Date.parse(a.peakTime))
}

function parseStorm(raw: unknown, now: Date): SunStorm | null {
  if (!Array.isArray(raw)) throw new Error('storms: not a list')
  let best: SunStorm | null = null
  for (const r of raw as Record<string, unknown>[]) {
    const start = r?.startTime
    const kps = r?.allKpIndex
    if (typeof start !== 'string' || Number.isNaN(Date.parse(start)) || Date.parse(start) > now.getTime() + 3_600_000) throw new Error('storms: bad time')
    if (!Array.isArray(kps) || !okLink(r.link)) throw new Error('storms: bad record')
    const kp = Math.max(...kps.map((k: { kpIndex?: unknown }) => (typeof k?.kpIndex === 'number' ? k.kpIndex : NaN)))
    if (!Number.isFinite(kp) || kp < 0 || kp > 9) throw new Error('storms: bad kp')
    if (!best || Date.parse(start) > Date.parse(best.time)) best = { time: start, kp, link: r.link }
  }
  return best
}

async function getJSON(fetchFn: typeof fetch, url: string): Promise<unknown> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetchFn(url, { signal: ctl.signal })
    if (!res.ok) throw new Error(`NASA answered ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** The copy bundled with the game. Always SAVED. */
export function bundledSun(): SunView {
  const flares = [...snapshot.flares].sort((a, b) => Date.parse(b.peakTime) - Date.parse(a.peakTime))
  const storms = snapshot.magneticStorms
  const last = storms[storms.length - 1]
  return {
    status: 'SAVED',
    asOf: snapshot.savedThrough,
    windowDays: 30,
    flares,
    magneticStorm: last ? { time: last.time, kp: last.kp, link: last.link } : null,
    source: snapshot.source,
  }
}

export async function loadSun(o: LoadOptions = {}): Promise<SunView> {
  const now = o.now ?? new Date()
  const store = o.store === undefined ? browserStore() : o.store
  const fetchFn = o.fetchFn ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined)
  try {
    if (!fetchFn) throw new Error('no network')
    const from = day(new Date(now.getTime() - FLARE_DAYS * DAY))
    const fromStorm = day(new Date(now.getTime() - STORM_DAYS * DAY))
    const [rawFlares, rawStorms] = await Promise.all([
      getJSON(fetchFn, `${DONKI}/FLR?startDate=${from}&endDate=${day(now)}`),
      getJSON(fetchFn, `${DONKI}/GST?startDate=${fromStorm}&endDate=${day(now)}`),
    ])
    const view: SunView = {
      status: 'LIVE',
      asOf: now.toISOString(),
      windowDays: FLARE_DAYS,
      flares: parseFlares(rawFlares, now),
      magneticStorm: parseStorm(rawStorms, now),
      source: `NASA DONKI live request (${DONKI}/FLR and /GST)`,
    }
    writeJSON(store, CACHE_KEY, view)
    return view
  } catch {
    const bundled = bundledSun()
    const cached = readJSON<SunView>(store, CACHE_KEY)
    const newer = cached && cached.status === 'LIVE' && Date.parse(cached.asOf) > Date.parse(bundled.asOf)
    // An older live copy is still real NASA data, but it is not live any more.
    return newer ? { ...cached, status: 'SAVED' } : bundled
  }
}
