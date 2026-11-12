import { createContext, useContext } from 'react'
import { Volume2 } from 'lucide-react'
import { browserStore, readJSON, writeJSON } from '../live/store'

/** Read-aloud uses the device's own voice (the Web Speech API). It never plays on its own: a kid taps the speaker. */
export interface Prefs {
  readAloud: boolean
}
export const DEFAULT_PREFS: Prefs = { readAloud: false }
const PREFS_KEY = 'astra-prefs-v1'

export const PrefsContext = createContext<Prefs>(DEFAULT_PREFS)

export function loadPrefs(): Prefs {
  const p = readJSON<Partial<Prefs>>(browserStore(), PREFS_KEY)
  return { readAloud: p?.readAloud === true }
}
export function savePrefs(p: Prefs): void {
  writeJSON(browserStore(), PREFS_KEY, p)
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function speak(text: string): void {
  if (!canSpeak()) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 0.95
  window.speechSynthesis.speak(u)
}

/** A speaker button. It shows only when read-aloud is On and the device can speak. */
export function Speak({ text, label = 'Read aloud' }: { text: string; label?: string }) {
  const { readAloud } = useContext(PrefsContext)
  if (!readAloud || !canSpeak()) return null
  return (
    <button className="speak" aria-label={label} title={label} onClick={() => speak(text)}>
      <Volume2 size={22} aria-hidden="true" />
    </button>
  )
}
