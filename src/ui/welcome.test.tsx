import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setSoundEnabled } from '../audio'
import { CREW_JOB, JOB_ICON } from '../scene'
import { CREW } from './look'
import { METERS } from './meters'
import { WelcomeIntro, crewOut, lineWords, stepAt, stepsMs, welcomeSteps } from './welcome'

const spoken: string[] = []
beforeEach(() => {
  spoken.length = 0
  setSoundEnabled(true)
  const synth = { cancel: () => undefined, speak: (u: { text: string }) => void spoken.push(u.text) }
  class Utterance {
    lang = ''
    rate = 1
    constructor(public text: string) {}
    onend: (() => void) | null = null
    onerror: (() => void) | null = null
  }
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  // @ts-expect-error remove the fake
  delete window.speechSynthesis
  setSoundEnabled(true)
})

/** Advances the clock in small slices, so each step's timer is set (after React re-renders) before the next slice. */
const run = (ms: number) => {
  for (let t = 0; t < ms; t += 100) act(() => void vi.advanceTimersByTime(Math.min(100, ms - t)))
}
const words = () => (document.querySelector('main')!.textContent ?? '').trim().split(/\s+/).filter(Boolean)

describe('the welcome plan', () => {
  it('part 1 is about 15 seconds and part 2 about 17 (Cadet) or 19 (Commander, with the food beat)', () => {
    const cadet = welcomeSteps('cadet')
    expect(stepsMs(cadet, 1)).toBeGreaterThanOrEqual(14_000)
    expect(stepsMs(cadet, 1)).toBeLessThanOrEqual(17_000)
    expect(stepsMs(cadet, 2)).toBeGreaterThanOrEqual(15_000)
    expect(stepsMs(cadet, 2)).toBeLessThanOrEqual(21_000)
    const cmd = welcomeSteps('commander')
    expect(cmd.map((s) => s.id)).toContain('b-plants')
    expect(cadet.map((s) => s.id)).not.toContain('b-plants')
    expect(stepsMs(cmd)).toBe(stepsMs(cadet) + 2000)
  })

  it('runs in the order: lander, the four crew, ORBI, the buildings, Sun = power, shield, walk = stars', () => {
    expect(welcomeSteps('cadet').map((s) => s.id)).toEqual(['lander', 'crew-safia', 'crew-kofi', 'crew-leo', 'crew-mei', 'orbi', 'b-air', 'b-radio', 'b-shield', 'power', 'rays', 'goal'])
  })

  it('every line, on screen and read aloud, is 3 words or fewer', () => {
    for (const mode of ['cadet', 'commander'] as const) for (const s of welcomeSteps(mode)) expect(lineWords(s), `${s.id}: "${s.caption}" / "${s.say}"`).toBeLessThanOrEqual(3)
  })

  it('a crew caption is the name only, and the last line of part 1 is "Keep them safe"', () => {
    const steps = welcomeSteps('cadet')
    for (const c of CREW) expect(steps.find((s) => s.id === `crew-${c.id}`)?.caption).toBe(c.name)
    const part1 = steps.filter((s) => s.part === 1)
    expect(part1[part1.length - 1]?.caption).toBe('Keep them safe')
  })

  it('stepAt finds the playing step and knows when the tour is over', () => {
    const steps = welcomeSteps('cadet')
    expect(stepAt(steps, 0)).toEqual({ index: 0, done: false })
    expect(stepAt(steps, 2999).index).toBe(0)
    expect(stepAt(steps, 3000).index).toBe(1)
    expect(stepAt(steps, stepsMs(steps) - 1).done).toBe(false)
    expect(stepAt(steps, stepsMs(steps)).done).toBe(true)
  })

  it('the crew step out one at a time and all stay', () => {
    expect(crewOut('lander')).toEqual([])
    expect(crewOut('crew-safia')).toEqual(['safia'])
    expect(crewOut('crew-leo')).toEqual(['safia', 'kofi', 'leo'])
    expect(crewOut('rays')).toHaveLength(4)
  })

  it('each crew member keeps the job of look.ts and the same picture as the matching bar', () => {
    for (const c of CREW) expect(CREW_JOB[c.id]).toBe(c.job.toLowerCase())
    expect(JOB_ICON[CREW_JOB.leo]).toBe(METERS.find((m) => m.key === 'air')!.Icon) // Leo: Air
    expect(JOB_ICON[CREW_JOB.kofi]).toBe(METERS.find((m) => m.key === 'power')!.Icon) // Kofi: Power
  })
})

describe('<WelcomeIntro />', () => {
  it('shows Skip from the first second, and Skip calls onSkip without finishing the tour', () => {
    const onDone = vi.fn()
    const onSkip = vi.fn()
    render(<WelcomeIntro onDone={onDone} onSkip={onSkip} />)
    const skip = screen.getByRole('button', { name: 'Skip' })
    expect(skip).toBeTruthy()
    fireEvent.click(skip)
    expect(onSkip).toHaveBeenCalledTimes(1)
    cleanup() // the parent leaves the tour
    run(60_000)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('plays every step in turn, shows only the 3-word line, and calls onDone once at the end', () => {
    const onDone = vi.fn()
    render(<WelcomeIntro onDone={onDone} onSkip={() => undefined} />)
    const steps = welcomeSteps('cadet')
    let t = 0
    for (const s of steps) {
      expect(document.querySelector('main')!.getAttribute('data-step'), `at ${t} ms`).toBe(s.id)
      expect(words().length, `${s.id} shows ${words().join(' ')}`).toBeLessThanOrEqual(3)
      if (s.caption) expect(document.querySelector('.wl-caption')!.textContent).toBe(s.caption)
      run(s.ms)
      t += s.ms
    }
    expect(onDone).toHaveBeenCalledTimes(1)
    run(10_000)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('Commander gets the food beat, with the Food bar on screen', () => {
    render(<WelcomeIntro mode="commander" onDone={() => undefined} onSkip={() => undefined} />)
    expect(screen.getByRole('meter', { name: 'Food' })).toBeTruthy()
    const ms = welcomeSteps('commander')
    const food = ms.findIndex((s) => s.id === 'b-plants')
    run(ms.slice(0, food).reduce((n, s) => n + s.ms, 0))
    expect(document.querySelector('main')!.getAttribute('data-step')).toBe('b-plants')
  })

  it('ORBI reads each line aloud once, and nothing when sound is off', () => {
    render(<WelcomeIntro onDone={() => undefined} onSkip={() => undefined} />)
    const steps = welcomeSteps('cadet')
    run(stepsMs(steps) - 1)
    expect(spoken).toEqual(steps.map((s) => s.say).filter(Boolean))
    cleanup()
    spoken.length = 0
    setSoundEnabled(false)
    render(<WelcomeIntro onDone={() => undefined} onSkip={() => undefined} />)
    run(stepsMs(steps) - 1)
    expect(spoken).toEqual([])
  })

  it('with reduced motion it plays the same steps as still pictures (no motion class)', () => {
    render(<WelcomeIntro onDone={() => undefined} onSkip={() => undefined} />) // the test setup asks for reduced motion
    expect(document.querySelector('main')!.classList.contains('still')).toBe(true)
    expect(document.querySelector('main')!.classList.contains('motion')).toBe(false)
    expect(document.querySelectorAll('.wl-fly')).toHaveLength(0)
  })

  it('the crew bubbles use the job picture, and arrive one by one', () => {
    render(<WelcomeIntro onDone={() => undefined} onSkip={() => undefined} />)
    expect(document.querySelectorAll('.wl-bubble')).toHaveLength(0)
    run(3000)
    expect(document.querySelectorAll('.wl-bubble')).toHaveLength(1)
    expect(document.querySelector('.wl-bubble')!.getAttribute('data-job')).toBe('plants')
    run(2500 * 3)
    expect([...document.querySelectorAll('.wl-bubble')].map((b) => b.getAttribute('data-job'))).toEqual(['plants', 'power', 'air', 'radio'])
  })
})
