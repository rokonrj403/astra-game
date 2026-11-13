import { useEffect, useState } from 'react'
import { newGame, step } from '../engine/game'
import { makeRng } from '../engine/rng'
import type { Choice, GameState, Mode } from '../engine/types'
import { addPlayed, type JournalEntry } from '../engine/journal'
import { loadSun, type SunView } from '../live/sun'
import { browserStore, readJSON, writeJSON } from '../live/store'
import { Living } from './living'
import { DataPage } from './DataPage'
import { Journal } from './journal'
import { Settings, Teachers } from './pages'
import { setSoundEnabled, sfx } from './sfx'
import { ChooseMode, ChoosePlace, Complete, Start, Why } from './screens'
import { setCalm } from './motion'
import { loadPrefs, PrefsContext, savePrefs, type Prefs } from './speech'
import { StormCards, SunScreen } from './sunscreens'
import { TwinHost } from './twin'
import { WelcomeIntro } from './welcome'

type Screen = 'start' | 'place' | 'mode' | 'play' | 'why' | 'end' | 'data' | 'sun' | 'cards' | 'settings' | 'teachers' | 'journal'
const OVERLAYS: Screen[] = ['data', 'sun', 'cards', 'settings', 'teachers', 'journal']
const CARDS_KEY = 'astra-cards-v1'
const JOURNAL_KEY = 'astra-journal-v1'

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
  // Preview hook: ?welcome (or ?welcome=commander) plays the welcome tour on its own. The real flow is wired in by the onboarding branch.
  const [preview, setPreview] = useState<Mode | null>(() => {
    const p = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('welcome')
    return p === null ? null : p === 'commander' ? 'commander' : 'cadet'
  })
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  setCalm(prefs.calm === true) // idempotent: a flag and a class on the page, set before the screens read it
  const [journal, setJournal] = useState<JournalEntry[]>(() => readJSON<JournalEntry[]>(browserStore(), JOURNAL_KEY) ?? [])

  useEffect(() => {
    setSoundEnabled(prefs.sound)
  }, [prefs.sound])

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

  const changePrefs = (p: Prefs) => {
    setPrefs(p)
    savePrefs(p)
  }

  const begin = (mode: Mode) => {
    setGame(newGame({ mode, siteId, seed: 1 + Math.floor(Math.random() * 1_000_000) }))
    setScreen('play')
  }

  const share = (choice: Choice): GameState => {
    if (!game) throw new Error('no game')
    const next = step(game, choice, makeRng(game.seed * 31 + game.day))
    setGame(next)
    // What the child just learned goes into the Flare Journal, with their guess.
    const learned = next.history[next.history.length - 1]?.resolved ?? []
    if (learned.length > 0) {
      const all = addPlayed(journal, learned)
      setJournal(all)
      writeJSON(browserStore(), JOURNAL_KEY, all)
    }
    const now = stormsMet(next)
    if (now.some((id) => !met.includes(id))) {
      const all = [...new Set([...met, ...now])]
      setMet(all)
      writeJSON(browserStore(), CARDS_KEY, all)
    }
    return next
  }

  const over = () => {
    if (!game) return
    setScreen(game.status === 'lost' ? 'why' : 'end')
  }

  const overlay = OVERLAYS.includes(screen)
  // The base screen stays mounted (hidden) under an overlay, so blocks already set are not lost.
  const keepBase = game !== null && (screen === 'play' || (overlay && back === 'play'))

  let other: React.ReactNode = null
  switch (screen) {
    case 'start':
      other = (
        <Start
          onPlay={() => setScreen('place')}
          onData={() => open('data')}
          onSun={() => open('sun')}
          onCards={() => open('cards')}
          onSettings={() => open('settings')}
          onTeachers={() => open('teachers')}
          onJournal={() => open('journal')}
          sound={prefs.sound}
          onSound={(on) => changePrefs({ ...prefs, sound: on })}
        />
      )
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
    case 'settings':
      other = <Settings prefs={prefs} onChange={changePrefs} onBack={() => setScreen(back)} />
      break
    case 'journal':
      other = <Journal played={journal} onBack={() => setScreen(back)} />
      break
    case 'teachers':
      other = <Teachers onBack={() => setScreen(back)} onData={() => open('data')} />
      break
    case 'play':
      break
  }

  if (preview) return <WelcomeIntro mode={preview} onDone={() => setPreview(null)} onSkip={() => setPreview(null)} />

  return (
    <PrefsContext.Provider value={prefs}>
      <TwinHost />
      {/* One soft tap sound for every button (mute it in Settings). */}
      <div onClickCapture={(e) => (e.target as HTMLElement).closest('button') && sfx.tap()}>
        {keepBase && game && (
          <div hidden={screen !== 'play'}>
            <Living key={game.seed} game={game} sun={sun} onStep={share} onOver={over} onData={() => open('data')} onSun={() => open('sun')} />
          </div>
        )}
        {other}
      </div>
    </PrefsContext.Provider>
  )
}
