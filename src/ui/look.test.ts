import { describe, expect, it } from 'vitest'
import { newGame } from '../engine/game'
import type { GameState, StormPlan } from '../engine/types'
import { changeLine } from './screens'
import { SHIELD_LETS_THROUGH } from '../engine/constants'
import { crewMoods, domeY, letsThrough, particlePlan, sceneLabel, sceneState } from './look'

const calm = (mode: 'cadet' | 'commander' = 'commander'): GameState => ({ ...newGame({ mode, siteId: 'region-3', seed: 2 }), storms: [], warned: [] })
const plan = (arrivalDay: number): StormPlan => ({ stormId: 'storm-6', arrivalDay, size: 'big', profile: [1] })
const warnedStorm = (g: GameState, arrivalDay: number): GameState => ({ ...g, storms: [plan(arrivalDay)], warned: [true] })

describe('crew faces', () => {
  it('everyone is happy when all bars are fine', () => {
    expect(Object.values(crewMoods(calm())).every((m) => m === 'happy')).toBe(true)
  })

  it('each crew member worries about their own bar only', () => {
    const g = calm()
    expect(crewMoods({ ...g, air: 20 })).toMatchObject({ leo: 'worried', kofi: 'happy', safia: 'happy' })
    expect(crewMoods({ ...g, power: 20 })).toMatchObject({ kofi: 'worried', leo: 'happy' })
    expect(crewMoods({ ...g, radiation: 70 })).toMatchObject({ kofi: 'worried' })
    expect(crewMoods({ ...g, food: 20 })).toMatchObject({ safia: 'worried', leo: 'happy' })
  })

  it('Cadet has no food bar, so Safia never worries about food', () => {
    expect(crewMoods({ ...calm('cadet'), food: 0 }).safia).toBe('happy')
  })

  it('a storm warning beats worry: everyone is surprised', () => {
    const m = crewMoods({ ...warnedStorm(calm(), 3), air: 10, power: 10 })
    expect(Object.values(m).every((x) => x === 'surprised')).toBe(true)
  })

  it('an unwarned storm does not change any face (the game never spoils a surprise)', () => {
    const g: GameState = { ...calm(), storms: [plan(2)], warned: [false] }
    expect(Object.values(crewMoods(g)).every((m) => m === 'happy')).toBe(true)
  })
})

describe('base picture states', () => {
  it('day or night and Earth come from the real game days', () => {
    const g = { ...calm(), sunDays: [true, false], earthDays: [false, true] }
    expect(sceneState(g, 0)).toMatchObject({ sunny: true, earth: false })
    expect(sceneState({ ...g, day: 2 }, 0)).toMatchObject({ sunny: false, earth: true })
  })

  it('the shield follows the blocks given and stays between 0 and 6', () => {
    expect(sceneState(calm(), 3).shield).toBe(3)
    expect(sceneState(calm(), 9).shield).toBe(6)
    expect(sceneState(calm(), -1).shield).toBe(0)
  })

  it('storm coming and storm now only show after a warning', () => {
    const g = calm()
    expect(sceneState({ ...g, storms: [plan(g.day + 2)], warned: [false] }, 0).storm).toBe('none')
    expect(sceneState(warnedStorm(g, g.day + 2), 0).storm).toBe('coming')
    expect(sceneState(warnedStorm(g, g.day), 0).storm).toBe('now')
  })

  it('low battery and sad plants show when the bars are low', () => {
    expect(sceneState({ ...calm(), power: 10 }, 0).powerLow).toBe(true)
    expect(sceneState({ ...calm(), food: 10 }, 0).plantsHappy).toBe(false)
    expect(sceneState({ ...calm('cadet'), air: 10 }, 0).plantsHappy).toBe(false)
    expect(sceneState(calm(), 0).plantsHappy).toBe(true)
  })

  it('the picture has a spoken-word description of its state', () => {
    const label = sceneLabel(sceneState(warnedStorm({ ...calm(), power: 10 }, 3), 4))
    expect(label).toContain('The shield has 4 blocks.')
    expect(label).toContain('A storm is coming.')
    expect(label).toContain('The battery is low.')
  })
})

describe('storm particles match what the Shield really blocks', () => {
  const passing = (blocks: number) => particlePlan(blocks).filter((p) => p.passes).length

  it('with the Shield off every particle lands on the base', () => {
    expect(passing(0)).toBe(10)
  })

  it('the number that get through follows the engine table for every shield level', () => {
    for (let blocks = 0; blocks <= 6; blocks++) expect(passing(blocks)).toBe(Math.round(10 * SHIELD_LETS_THROUGH[blocks]!))
  })

  it('more shield never lets more through', () => {
    for (let blocks = 1; blocks <= 6; blocks++) expect(passing(blocks)).toBeLessThanOrEqual(passing(blocks - 1))
  })

  it('blocked particles stop at the dome edge and the others reach the ground', () => {
    for (const p of particlePlan(3)) expect(p.y1).toBe(p.passes ? 148 : domeY(p.x) - 2)
    expect(domeY(190)).toBe(52)
    expect(domeY(70)).toBe(152)
  })

  it('out-of-range shield values are clamped', () => {
    expect(letsThrough(-3)).toBe(1)
    expect(letsThrough(99)).toBe(SHIELD_LETS_THROUGH[6])
  })
})

describe('changeLine', () => {
  it('says "stayed at" when nothing changed and "went from" when it did', () => {
    expect(changeLine('Air', 100, 100)).toBe('Air stayed at 100.')
    expect(changeLine('Power', 74, 92)).toBe('Power went from 74 to 92.')
  })
})
