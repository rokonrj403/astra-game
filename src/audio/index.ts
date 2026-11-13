/** Public entry for ASTRA audio. Import from 'src/audio' (see README.md for when to call what). */
export { setSoundEnabled, soundEnabled, setVolume, getVolume, setMusicEnabled, musicEnabled, duckBed, AUDIO_KEY } from './core'
export { onTwin, setHaptics, prefersReducedMotion, type TwinEvent } from './twins'
export { astraMotif, orbiHello, dayStart, cardFlip, missionComplete, missionFailedGentle, orbiChirp, NOTE, type ChirpMood } from './motif'
export { tap, blockPlaced, noticeChime, stormRumble, flareSound, raysArrive, allClear, scienceGained, lowWarning, moonwalk, type FlareInfo, type FlareSide } from './events'
export { shieldHum, shieldHumStop } from './hum'
export { setMood, getMood, bedRunning, type Mood } from './bed'
