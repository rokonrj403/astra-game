import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Guess } from '../engine/types'
import { GuessReveal } from './pictos'

afterEach(cleanup)

const tile = (n: 0 | 1) => document.querySelectorAll('.reveal2 .tile')[n] as HTMLElement

describe('the You said / Sun did card', () => {
  it.each<[Guess, boolean]>([
    ['yes', true],
    ['yes', false],
    ['no', true],
    ['no', false],
    ['unsure', true],
  ])('always shows what the child said (%s) and what the Sun did (followed: %s)', (guess, followed) => {
    render(<GuessReveal guess={guess} followed={followed} reward={0} />)
    expect(tile(0).getAttribute('data-guess')).toBe(guess)
    expect(tile(0).querySelector('svg')).not.toBeNull() // a picture, never an empty circle
    expect(tile(1).getAttribute('data-guess')).toBe(followed ? 'yes' : 'no')
    expect(tile(0).textContent).toBe('You said')
    expect(tile(1).textContent).toBe('Sun did')
  })

  it('with no guess shows a clear "no guess" picture, says so for screen readers, and never an empty tile', () => {
    render(<GuessReveal guess={null} followed={true} reward={0} />)
    expect(tile(0).getAttribute('data-guess')).toBe('none')
    expect(tile(0).querySelector('svg')).not.toBeNull()
    expect(document.querySelector('.noguess')).toBeNull()
    expect(screen.getByRole('img', { name: /No guess/ })).toBeTruthy()
  })

  it('a good guess shows the science it earned, a wrong guess does not', () => {
    render(<GuessReveal guess="yes" followed={true} reward={2} />)
    expect(document.querySelector('.reveal2 .plus')?.textContent).toContain('+2')
    cleanup()
    render(<GuessReveal guess="yes" followed={false} reward={0} />)
    expect(document.querySelector('.reveal2 .plus')).toBeNull()
  })
})
