/** A recording fake AudioContext for unit tests (jsdom has no Web Audio). Only the tests import this file. */
export class Param {
  value = 0
  calls: Array<{ fn: string; args: number[] }> = []
  private rec(fn: string, args: number[]): this {
    this.calls.push({ fn, args })
    return this
  }
  setValueAtTime(v: number, t: number): this {
    this.value = v
    return this.rec('set', [v, t])
  }
  linearRampToValueAtTime(v: number, t: number): this {
    return this.rec('linear', [v, t])
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    return this.rec('exp', [v, t])
  }
  setTargetAtTime(v: number, t: number, tc: number): this {
    return this.rec('target', [v, t, tc])
  }
  cancelScheduledValues(t: number): this {
    return this.rec('cancel', [t])
  }
  /** Last value asked for with setTargetAtTime / setValueAtTime. */
  get last(): number | undefined {
    return [...this.calls].reverse().find((c) => c.fn === 'target' || c.fn === 'set')?.args[0]
  }
  /** Highest value this param ramps or jumps to. */
  get peak(): number {
    return Math.max(0, ...this.calls.filter((c) => c.fn === 'exp' || c.fn === 'linear' || c.fn === 'set').map((c) => c.args[0] ?? 0))
  }
  /** Latest time this param is scheduled for. */
  get endTime(): number {
    return Math.max(0, ...this.calls.filter((c) => c.fn === 'exp' || c.fn === 'linear').map((c) => c.args[1] ?? 0))
  }
}

export class MockNode {
  type = '' // set below for oscillators (the real default is 'sine')
  loop = false
  buffer: unknown = null
  gain = new Param()
  frequency = new Param()
  Q = new Param()
  pan = new Param()
  threshold = new Param()
  knee = new Param()
  ratio = new Param()
  attack = new Param()
  release = new Param()
  started: number[][] = []
  stopped: number[][] = []
  out: unknown[] = []
  disconnected = false
  constructor(
    public kind: string,
    public ctx: MockAudioContext,
  ) {
    if (kind === 'osc') this.type = 'sine'
  }
  connect<T>(x: T): T {
    this.out.push(x)
    return x
  }
  disconnect(): void {
    this.disconnected = true
  }
  start(...a: number[]): void {
    this.started.push(a)
  }
  stop(...a: number[]): void {
    this.stopped.push(a)
  }
}

export class MockAudioContext {
  static instances: MockAudioContext[] = []
  static get last(): MockAudioContext | undefined {
    return MockAudioContext.instances[MockAudioContext.instances.length - 1]
  }
  currentTime = 0
  state: AudioContextState = 'running'
  sampleRate = 8000
  nodes: MockNode[] = []
  buffers: Array<{ channels: number; length: number; rate: number }> = []
  resumed = 0
  suspended = 0
  destination = new MockNode('destination', this)
  constructor() {
    MockAudioContext.instances.push(this)
  }
  private make(kind: string): MockNode {
    const n = new MockNode(kind, this)
    this.nodes.push(n)
    return n
  }
  createGain() {
    return this.make('gain')
  }
  createOscillator() {
    return this.make('osc')
  }
  createBiquadFilter() {
    return this.make('filter')
  }
  createBufferSource() {
    return this.make('source')
  }
  createDynamicsCompressor() {
    return this.make('compressor')
  }
  createStereoPanner() {
    return this.make('panner')
  }
  createBuffer(channels: number, length: number, rate: number) {
    this.buffers.push({ channels, length, rate })
    return { sampleRate: rate, getChannelData: () => new Float32Array(Math.min(length, 16)) }
  }
  resume() {
    this.resumed++
    this.state = 'running'
    return Promise.resolve()
  }
  suspend() {
    this.suspended++
    this.state = 'suspended'
    return Promise.resolve()
  }
  of(kind: string): MockNode[] {
    return this.nodes.filter((n) => n.kind === kind)
  }
}

export function installAudio(): void {
  MockAudioContext.instances = []
  Object.defineProperty(window, 'AudioContext', { value: MockAudioContext, configurable: true, writable: true })
}
export function removeAudio(): void {
  Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true, writable: true })
}
/** A person taps the page. */
export function tapPage(): void {
  window.dispatchEvent(new Event('click'))
}
