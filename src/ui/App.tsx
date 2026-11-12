import { useEffect, useState } from 'react'
import { newGame, step } from '../engine/game'
import { makeRng } from '../engine/rng'
import type { Choice, GameState, Mode } from '../engine/types'
import { loadSun, type SunView } from '../live/sun'
import { browserStore, readJSON, writeJSON } from '../live/store'
import { DataPage } from './DataPage'
import { Base, ChooseMode, ChoosePlace, Complete, Report, Start, Why } from './screens'
import { StormCards, SunScreen } from './sunscreens'

type Screen = 'start' | 'place' | 'mode' | 'play' | 'report' | 'why' | 'end' | 'data' | 'sun' | 'cards'
const OVERLAYS: Screen[] = ['data', 'sun', 'cards']
const CARDS_KEY = 'astra-cards-v1'

/** Storms that really reached the base in this game. */
function stormsMet(g: GameState): string[] {
  const ids = new Set<string>()
  for (const r of g.history) if (r.storm) ids.add(g.storms[r.storm.index]?.stormId ?? '')
  ids.delete('')
  return [...ids]
}

export function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [back, setBack] = useState<Screen>('start')
  const [siteId, setSiteId] = useState('')
  const [game, setGame] = useState<GameState | null>(null)
  const [sun, setSun] = useState<SunView | null>(null)
  const [met, setMet] = useState<string[]>(() => readJSON<string[]>(browserStore(), CARDS_KEY) ?? [])

  useEffect(() => {
    let alive = true
    void loadSun().then((v) => alive && setSun(v))
    return () => {
      alive = false
    }
  }, [])

  const open = (s: Screen) => {
    setBack(screen)
    setScreen(s)
  }

  const begin = (mode: Mode) => {
    setGame(newGame({ mode, siteId, seed: 1 + Math.floor(Math.random() * 1_000_000) }))
    setScreen('play')
  }

  const share = (choice: Choice) => {
    if (!game) return
    const next = step(game, choice, makeRng(game.seed * 31 + game.day))
    setGame(next)
    const now = stormsMet(next)
    if (now.some((id) => !met.includes(id))) {
      const all = [...new Set([...met, ...now])]
      setMet(all)
      writeJSON(browserStore(), CARDS_KEY, all)
    }
    setScreen('report')
  }

  const afterReport = () => {
    if (!game) return
    setScreen(game.status === 'playing' ? 'play' : game.status === 'lost' ? 'why' : 'end')
  }

  const overlay = OVERLAYS.includes(screen)
  // The base screen stays mounted (hidden) under an overlay, so blocks already set are not lost.
  const keepBase = game !== null && (screen === 'play' || (overlay && back === 'play'))

  let other: React.ReactNode = null
  switch (screen) {
    case 'start':
      other = <Start onPlay={() => setScreen('place')} onData={() => open('data')} onSun={() => open('sun')} onCards={() => open('cards')} />
      break
    case 'place':
      other = (
        <ChoosePlace
          onBack={() => setScreen('start')}
          onPick={(id) => {
            setSiteId(id)
            setScreen('mode')
          }}
        />
      )
      break
    case 'mode':
      other = <ChooseMode onBack={() => setScreen('place')} onPick={begin} />
      break
    case 'report':
      other = game ? <Report game={game} onNext={afterReport} /> : null
      break
    case 'why':
      other = game ? <Why game={game} onNext={() => setScreen('end')} onData={() => open('data')} /> : null
      break
    case 'end':
      other = game ? <Complete game={game} onAgain={() => setScreen('start')} onData={() => open('data')} /> : null
      break
    case 'data':
      other = <DataPage onBack={() => setScreen(back)} />
      break
    case 'sun':
      other = <SunScreen sun={sun} onBack={() => setScreen(back)} />
      break
    case 'cards':
      other = <StormCards met={met} onBack={() => setScreen(back)} />
      break
    case 'play':
      break
  }

  return (
    <>
      {keepBase && game && (
        <div hidden={screen !== 'play'}>
          <Base key={game.day} game={game} sun={sun} onShare={share} onData={() => open('data')} onSun={() => open('sun')} />
        </div>
      )}
      {other}
    </>
  )
}
