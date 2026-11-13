# ASTRA: Moon base trainer

ASTRA is a Moon-base trainer for children 7 to 12. You run a base near the Moon's South Pole, spending power blocks before real solar storms.

**Real data:** a real NASA DONKI flare followed within 72 hours by a radiation storm decides each outcome; LOLA sets site light; BVAD sets needs; radio takes 1.28 s.

**Play:** 1 Pick a place. 2 Give blocks, read the Sun, guess. 3 Tap Next to see what happened.

**Limits:** outcomes are real; storm sizes for 90 of 98 flares are simplified. Cadet takes 2 to 4 minutes. AI: Claude helped build it; the video voices use Kokoro-82M.

ASTRA uses NASA data. It is not made or endorsed by NASA.

**Live:** https://rokonrj403.github.io/astra-game/

---

## How outcomes are decided

- **Flares.** The game uses the 424 flares of class M5 or bigger that NASA DONKI lists from 2010 to 12 Nov 2026. A flare counts as "followed" when DONKI lists a radiation storm (GOES >10 MeV) within 72 hours: 98 of the 424 (23 percent). Each mission deals about half followed and half quiet flares so there is something to learn. In real life most flares bring no rays, and the game says so.
- **Clues.** Flare size, whether it threw a gas cloud, and (Commander) which side of the Sun it came from. The child guesses before the answer is shown. The answer is NASA's record.
- **Storm size.** Eight of the followed flares match a known, published storm with a size and shape. The other 90 get a small storm, and the game says that on screen.
- **Sites.** The nine regions are NASA's candidate landing regions. Sunlight and Earth-in-view use the best spot within about 5 km of each region centre in the LRO LOLA 18.6-year average maps.
- **Radio.** Mission Control answers after the real Earth to Moon radio delay (1.28 s each way).

Nothing in a mission is predicted or invented. Today's Sun is labelled LIVE, SAVED or FROM THE PAST, and test data is never shown as live.

## Data sources

| Source | What ASTRA uses it for | Link |
|---|---|---|
| NASA DONKI | Real flares, radiation storms, magnetic storms; Today's Sun | https://ccmc.gsfc.nasa.gov/DONKI/ |
| NOAA SWPC and GOES | Storm strength (S1 to S5) and shape | https://www.swpc.noaa.gov/noaa-scales-explanation |
| NASA BVAD (2022) | Air, water and food one astronaut uses a day | https://ntrs.nasa.gov/citations/20210024855 |
| NASA candidate landing regions | The nine places to choose | https://ntrs.nasa.gov/citations/20250011660 |
| LRO LOLA maps (PGDA product 69) | Sunlight and Earth in view per region | https://pgda.gsfc.nasa.gov/products/69 |
| NASA OSDR | Real lab findings about space radiation | https://osdr.nasa.gov |
| NASA Moon Fact Sheet | 384,400 km, so 1.28 s radio delay one way | https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html |

Pictures of the crew use Open Peeps by Pablo Stanley (CC0). The game has no NASA logo and shows no real children's names, faces or voices.

## Run it

```
npm install
npm run dev        # play at the address Vite prints
npm run check      # type check, unit tests, production build
npm run e2e        # phone-size (360 x 740) checks, accessibility scan, offline play
```

It works offline after one visit (a service worker caches the game). Source data is rebuilt with `npm run data`.

## Accessibility and AI disclosure

Picture-first screens with at most about 12 visible words, big touch targets, a picture twin for every sound, a Calm setting, and read-aloud with your device's own voice. An automated axe-core scan of every child screen finds no issues. Claude (Anthropic) helped write the code and the text; Kokoro-82M made the voices in the explainer video, not in the game.

## Licence

Apache-2.0. See `LICENSE`.
