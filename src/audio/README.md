# ASTRA audio

All sound is synthesized in WebAudio: no files, no libraries, works offline. Import from `src/audio` (`index.ts`).
`src/ui/sfx.ts` is a thin wrapper so the old calls (`sfx.tap/chime/rumble/success`, `setSoundEnabled`) keep working.

**How it behaves**
- Nothing is created or played before a tap. The first tap (pointerup / touchend / click / keydown) creates the context, plays the iOS silent buffer and the full ASTRA motif; the tap click that comes with it is held back.
- Graph: `sfx` / `bed` / `voice` buses -> master gain (default 0.7) -> compressor -> speakers.
- Every sound is rate-limited (60 ms by default, `lowWarning` 8 s) and at most 6 sounds overlap.
- The Settings "Sound" switch (`prefs.sound` -> `setSoundEnabled`) silences, suspends the context and stops the bed and hum. Volume and the Music switch are saved under localStorage key `astra.audio.v1`.
- The page hiding suspends the context; coming back resumes it.
- Mix: sfx peaks about 0.1, bed 0.03-0.05 per layer, nothing above 0.25, attacks of 8 ms or more, no one-shot over 1.5 s. Energy stays between 200 Hz and 4 kHz (phone speakers).

**Visual twins.** Every sound calls `emitTwin()` first, even when sound is off or locked, so the screen can always show it. Subscribe once: `const off = onTwin((e) => ...)`. Each event is `{ kind, reducedMotion, muted, ...detail }`. If `reducedMotion` is true show a still caption chip instead of a flash or pulse. `setHaptics(true)` adds an optional `navigator.vibrate(30)` on flare / rays / all clear / mission complete (never with reduced motion).

## Functions

| Function | When the game calls it | Visual twin (`kind`) |
|---|---|---|
| `setSoundEnabled(on)` | Settings switch (already wired in App.tsx) | none |
| `setVolume(0..1)`, `getVolume()` | Settings volume slider (to add) | none |
| `setMusicEnabled(on)`, `musicEnabled()` | Settings "Music" switch (to add) | none |
| `tap()` | Any button press (already wired by sfx.tap) | pressed-button feedback (game's own) |
| `astraMotif()` | Plays by itself on the first tap; can replay on the title screen | `unlock`: logo pulse |
| `orbiHello()` | ORBI greets the child (A-D) | `orbiHello`: ORBI wave/blink |
| `dayStart()` | A new day begins (A-D-F#) | `dayStart`: day banner |
| `cardFlip()` | Surprise card turns over | `cardFlip`: card flip animation |
| `blockPlaced()` | A power block lands on a job | `blockPlaced`: block squash |
| `noticeChime()` | A storm watch / something to notice (old `sfx.chime`) | `notice`: caption chip |
| `stormRumble()` | The storm is here (old `sfx.rumble`, now phone-speaker safe) | `rumble`: screen shake or still caption |
| `flareSound({ size: 1\|2\|3, cloud, side: 'east'\|'west'\|'center' })` | A flare is shown on Sun Watch: pulses = size (C/M/X), low swell = gas cloud, pan = Sun side (west right) | `flare`: size dots, cloud icon, side arrow. Pair with the on-screen label |
| `shieldHum(charge 0..6)` | Each time the number of shield blocks changes; `shieldHumStop()` on leaving the shield step | `shield`: shield outline thickens with `charge` |
| `raysArrive(level)` | Reveal when rays came; `level` = shield charge then (0 = unshielded) | `rays`: dome hit flash or leak tint; `shielded` in detail |
| `allClear()` | Reveal when no rays came; also returns a running bed to calm | `allClear`: green ring |
| `scienceGained()` | Science points added | `science`: +N chip |
| `lowWarning()` | Power or air gets low (at most once every 8 s on its own) | `lowWarning`: icon pulse |
| `moonwalk()` | A moonwalk starts | `moonwalk`: two footprint puffs |
| `missionComplete()` | The mission is won (old `sfx.success`) | `missionComplete`: confetti or still banner |
| `missionFailedGentle()` | The mission is lost; never a buzzer | `missionFailed`: soft dim, ORBI "try again" |
| `orbiChirp('question'\|'warning'\|'happy', wordCount)` | When an ORBI line appears; skipped over 24 words | speech bubble (the words stay on screen) |
| `setMood('calm'\|'watch'\|'storm')` | At each phase: calm = normal day, watch = flare watch, storm = rays arriving. 2 s crossfades. Safe before the first tap; the bed starts at unlock. | `mood`: sky tint |
| `duckBed(on)` | While ORBI speaks or the device reads aloud (-8 dB) | none |
| `onTwin(fn)`, `setHaptics(on)`, `prefersReducedMotion()` | Once at app start | n/a |

`raysArrive()` and `allClear()` are exactly 0.9 s long and peak at the same level, so neither is a "good" or "bad" sound.
