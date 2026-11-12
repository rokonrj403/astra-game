import { useState } from 'react'
import { newGame, step } from '../engine/game'
import { makeRng } from '../engine/rng'
import type { Choice, GameState, Mode } from '../engine/types'
import { DataPage } from './DataPage'
import { Base, ChooseMode, ChoosePlace, Complete, Report, Start, Why } from './screens'

type Screen = 'start' | 'place' | 'mode' | 'play' | 'report' | 'why' | 'end' | 'data'

export function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [back, setBack] = useState<Screen>('start')
  const [siteId, setSiteId] = useState('')
  const [game, setGame] = useState<GameState | null>(null)

  const openData = () => {
    setBack(screen)
    setScreen('data')
  }

  const begin = (mode: Mode) => {
    setGame(newGame({ mode, siteId, seed: 1 + Math.floor(Math.random() * 1_000_000) }))
    setScreen('play')
  }

  const share = (choice: Choice) => {
    if (!game) return
    setGame(step(game, choice, makeRng(game.seed * 31 + game.day)))
    setScreen('report')
  }

  const afterReport = () => {
    if (!game) return
    setScreen(game.status === 'playing' ? 'play' : game.status === 'lost' ? 'why' : 'end')
  }

  switch (screen) {
    case 'start':
      return <Start onPlay={() => setScreen('place')} onData={openData} />
    case 'place':
      return (
        <ChoosePlace
          onBack={() => setScreen('start')}
          onPick={(id) => {
            setSiteId(id)
            setScreen('mode')
          }}
        />
      )
    case 'mode':
      return <ChooseMode onBack={() => setScreen('place')} onPick={begin} />
    case 'play':
      return game ? <Base key={game.day} game={game} onShare={share} onData={openData} /> : null
    case 'report':
      return game ? <Report game={game} onNext={afterReport} /> : null
    case 'why':
      return game ? <Why game={game} onNext={() => setScreen('end')} onData={openData} /> : null
    case 'end':
      return game ? <Complete game={game} onAgain={() => setScreen('start')} onData={openData} /> : null
    case 'data':
      return <DataPage onBack={() => setScreen(back)} />
  }
}
