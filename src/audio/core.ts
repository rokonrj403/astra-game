/**
 * Audio core for ASTRA. Everything is synthesized with the Web Audio API: no files, no libraries, works offline.
 *
 * Graph: sfx / bed / voice buses -> master gain -> compressor -> speakers.
 * Rules: nothing is created or played before a tap (gesture), the Settings "Sound" switch (setSoundEnabled)
 * silences and suspends everything, every sound has a rate limit, and at most 6 sounds overlap.
 *
 * Called by: src/ui/sfx.ts (compat layer), src/audio/*.ts. No duplicate exists; no data schema (one small localStorage record).
 */
import { browserStore, readJSON, writeJSON } from '../live/store'

export const AUDIO_KEY = 'astra.audio.v1'
export const MAX_VOICES = 6
export const DEFAULT_GAP = 0.06 // seconds between two plays of the same sound
const MIN_ATTACK = 0.008 // no click-y attacks
const FLOOR = 0.0001

export type BusName = 'sfx' | 'bed' | 'voice'
type CoreEvent = 'start' | 'stop' | 'unlock' | 'music'

interface Graph {
  master: GainNode
  sfx: GainNode
  bed: GainNode
  voice: GainNode
}
/** What a sound's builder gets: the context, "now", and where to connect. */
export interface Voice {
  c: AudioContext
  t: number
  out: AudioNode
  noise: AudioBuffer
}

let enabled = true // the Settings switch
let gestured = false // a person has tapped
let ctx: AudioContext | null = null
let graph: Graph | null = null
let noiseBuf: AudioBuffer | null = null
let volume = 0.7
let music = true
let loaded = false
let unlocked = false
let silentDone = false
const lastPlayed = new Map<string, number>()
let voices: number[] = [] // end times of sounds that are still playing
const listeners: Record<CoreEvent, Array<() => void>> = { start: [], stop: [], unlock: [], music: [] }

type Ctor = typeof AudioContext

function emit(e: CoreEvent): void {
  for (const fn of listeners[e]) {
    try {
      fn()
    } catch {
      /* one broken listener must not stop the others */
    }
  }
}
/** Other audio modules subscribe here. 'start' = audio is running, 'stop' = muted/paused, 'unlock' = first tap, 'music' = Music switch changed. */
export function on(e: CoreEvent, fn: () => void): void {
  listeners[e].push(fn)
}

function load(): void {
  if (loaded) return
  loaded = true
  const s = readJSON<{ volume?: unknown; music?: unknown }>(browserStore(), AUDIO_KEY)
  if (s && typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1) volume = s.volume
  if (s && typeof s.music === 'boolean') music = s.music
}
function save(): void {
  writeJSON(browserStore(), AUDIO_KEY, { volume, music })
}

function safeResume(c: AudioContext): void {
  try {
    void Promise.resolve(c.resume()).catch(() => undefined)
  } catch {
    /* some browsers throw when not allowed yet; the next tap tries again */
  }
}
function safeSuspend(c: AudioContext): void {
  try {
    void Promise.resolve(c.suspend()).catch(() => undefined)
  } catch {
    /* ignore */
  }
}

function build(c: AudioContext): Graph {
  const master = c.createGain()
  master.gain.setValueAtTime(enabled ? volume : 0, c.currentTime)
  const comp = c.createDynamicsCompressor()
  comp.threshold.setValueAtTime(-18, c.currentTime)
  comp.knee.setValueAtTime(24, c.currentTime)
  comp.ratio.setValueAtTime(4, c.currentTime)
  comp.attack.setValueAtTime(0.005, c.currentTime)
  comp.release.setValueAtTime(0.25, c.currentTime)
  master.connect(comp)
  comp.connect(c.destination)
  const bus = (): GainNode => {
    const g = c.createGain()
    g.gain.setValueAtTime(1, c.currentTime)
    g.connect(master)
    return g
  }
  return { master, sfx: bus(), bed: bus(), voice: bus() }
}

function ensure(): AudioContext | null {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  try {
    const C: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
    if (!C) return null
    load()
    ctx = new C()
    graph = build(ctx)
    emit('start')
    return ctx
  } catch {
    ctx = null
    graph = null
    return null
  }
}

/** The audio context, but only if sound is on and a person has already tapped. Otherwise null (so nothing ever plays by itself). */
export function ready(): AudioContext | null {
  if (!enabled || !gestured) return null
  const c = ensure()
  if (c && c.state !== 'running') safeResume(c)
  return c
}

/** A tap anywhere: create the context inside the gesture, wake it, and (iOS) play a 1-sample silent buffer. */
function onGesture(): void {
  gestured = true
  if (!enabled) return
  const c = ensure()
  if (!c) return
  if (c.state !== 'running') safeResume(c)
  if (!silentDone) {
    silentDone = true
    try {
      const s = c.createBufferSource()
      s.buffer = c.createBuffer(1, 1, 22050)
      s.connect(c.destination)
      s.start(0)
    } catch {
      /* not fatal */
    }
  }
  if (!unlocked) {
    unlocked = true
    emit('unlock')
  }
}

function onVisibility(): void {
  if (!ctx) return
  if (document.hidden) safeSuspend(ctx)
  else if (enabled && gestured) safeResume(ctx)
}

if (typeof window !== 'undefined') {
  for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, onGesture, { capture: true, passive: true })
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
}

// ---------- settings: Sound switch, volume, Music switch ----------

/** The Settings "Sound" switch. Off = silent and suspended (saves battery); the game stays fully playable. */
export function setSoundEnabled(on: boolean): void {
  if (on === enabled) return
  enabled = on
  if (!ctx || !graph) return
  const now = ctx.currentTime
  graph.master.gain.cancelScheduledValues(now)
  if (on) {
    graph.master.gain.setTargetAtTime(volume, now, 0.03)
    if (gestured) safeResume(ctx)
    emit('start')
  } else {
    graph.master.gain.setTargetAtTime(0, now, 0.01)
    emit('stop')
    safeSuspend(ctx)
  }
}
export function soundEnabled(): boolean {
  return enabled
}

/** Master volume 0..1 (default 0.7), saved on this device. */
export function setVolume(v: number): void {
  load()
  volume = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.7))
  save()
  if (ctx && graph && enabled) graph.master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05)
}
export function getVolume(): number {
  load()
  return volume
}

/** The separate Music switch: turns the ambient bed off and on without touching the sound effects. */
export function setMusicEnabled(on: boolean): void {
  load()
  if (on === music) return
  music = on
  save()
  emit('music')
}
export function musicEnabled(): boolean {
  load()
  return music
}

// ---------- playing ----------

export interface PlayOpts {
  /** How long this sound lasts (seconds); used for the 6-voice limit. */
  dur: number
  /** Minimum seconds between two plays of this same sound. Default 0.06. */
  gap?: number
  bus?: BusName
}

/** Start a sound if allowed: sound on, after a tap, not too soon after itself, fewer than 6 sounds playing. */
export function play(name: string, o: PlayOpts, make: (v: Voice) => void): boolean {
  const c = ready()
  if (!c || !graph) return false
  const t = c.currentTime
  const last = lastPlayed.get(name)
  if (last !== undefined && t - last < (o.gap ?? DEFAULT_GAP)) return false
  voices = voices.filter((end) => end > t)
  if (voices.length >= MAX_VOICES) return false
  lastPlayed.set(name, t)
  voices.push(t + o.dur)
  make({ c, t, out: graph[o.bus ?? 'sfx'], noise: noiseBuffer(c) })
  return true
}

/** Block a sound for a while (so the first-tap motif is not followed straight away by the tap click). */
export function holdOff(name: string, seconds: number): void {
  if (ctx) lastPlayed.set(name, ctx.currentTime + seconds)
}

/** The shared 2 second white-noise buffer. */
export function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf
  const len = Math.floor(c.sampleRate * 2)
  const b = c.createBuffer(1, len, c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  noiseBuf = b
  return b
}

export function busNode(name: BusName): GainNode | null {
  return graph ? graph[name] : null
}

/** Duck (or restore) the ambient bed by 8 dB, e.g. while ORBI speaks or a voice line plays. */
export function duckBed(on: boolean): void {
  if (!ctx || !graph) return
  graph.bed.gain.setTargetAtTime(on ? 0.4 : 1, ctx.currentTime, 0.1)
}

// ---------- building blocks ----------

export interface ToneOpts {
  freq: number
  /** Glide to this frequency over the sound. */
  to?: number
  at?: number
  dur: number
  type?: OscillatorType
  peak?: number
  attack?: number
  /** Optional lowpass cutoff in Hz. */
  lp?: number
  pan?: number
  out?: AudioNode
}

function panner(c: AudioContext, p: number | undefined): StereoPannerNode | null {
  if (!p || typeof c.createStereoPanner !== 'function') return null
  const n = c.createStereoPanner()
  n.pan.setValueAtTime(Math.max(-1, Math.min(1, p)), c.currentTime)
  return n
}

function chain(from: AudioNode, to: AudioNode, mids: Array<AudioNode | null>): void {
  let cur = from
  for (const m of mids) {
    if (m) {
      cur.connect(m)
      cur = m
    }
  }
  cur.connect(to)
}

/** One oscillator note with a soft attack and exponential decay. */
export function tone(v: Voice, o: ToneOpts): OscillatorNode {
  const { c } = v
  const at = v.t + (o.at ?? 0)
  const attack = Math.max(MIN_ATTACK, o.attack ?? 0.012)
  const osc = c.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, at)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + o.dur)
  const g = c.createGain()
  g.gain.setValueAtTime(FLOOR, at)
  g.gain.exponentialRampToValueAtTime(o.peak ?? 0.08, at + Math.min(attack, o.dur * 0.5))
  g.gain.exponentialRampToValueAtTime(FLOOR, at + o.dur)
  let lp: BiquadFilterNode | null = null
  if (o.lp) {
    lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(o.lp, at)
  }
  osc.connect(g)
  chain(g, o.out ?? v.out, [lp, panner(c, o.pan)])
  osc.start(at)
  osc.stop(at + o.dur + 0.03)
  return osc
}

export interface NoiseOpts {
  at?: number
  dur: number
  peak?: number
  attack?: number
  filter?: BiquadFilterType
  /** Filter start and end frequency in Hz (a sweep when they differ); `via` is hit half way (up then down). */
  f0: number
  via?: number
  f1?: number
  q?: number
  pan?: number
  out?: AudioNode
}

/** A burst of filtered noise (whoosh, puff, breath, tick). */
export function noiseHit(v: Voice, o: NoiseOpts): void {
  const { c } = v
  const at = v.t + (o.at ?? 0)
  const attack = Math.max(MIN_ATTACK, o.attack ?? 0.02)
  const src = c.createBufferSource()
  src.buffer = v.noise
  const f = c.createBiquadFilter()
  f.type = o.filter ?? 'bandpass'
  f.Q.setValueAtTime(o.q ?? 1, at)
  f.frequency.setValueAtTime(o.f0, at)
  if (o.via) f.frequency.exponentialRampToValueAtTime(o.via, at + o.dur / 2)
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, at + o.dur)
  const g = c.createGain()
  g.gain.setValueAtTime(FLOOR, at)
  g.gain.exponentialRampToValueAtTime(o.peak ?? 0.06, at + Math.min(attack, o.dur * 0.6))
  g.gain.exponentialRampToValueAtTime(FLOOR, at + o.dur)
  src.connect(f)
  chain(f, o.out ?? v.out, [g, panner(c, o.pan)])
  src.start(at, Math.random() * 1.5)
  src.stop(at + o.dur + 0.03)
}

/** Test helper: forget everything (the tap listeners and module listeners stay). */
export function resetAudioForTests(): void {
  enabled = true
  gestured = false
  ctx = null
  graph = null
  noiseBuf = null
  volume = 0.7
  music = true
  loaded = false
  unlocked = false
  silentDone = false
  lastPlayed.clear()
  voices = []
}
