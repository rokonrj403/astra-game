import consumables from '../data/consumables.json'
import science from '../data/science.json'
import sites from '../data/sites.json'
import flareStats from '../data/flareStats.json'
import sources from '../data/sources.json'
import storms from '../data/storms.json'
import { MODES, RADIO_SOURCE } from '../engine/constants'

const words = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())

function Datum({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="datum">
      <span>
        <b>{label}:</b> {value}
      </span>
      <span className="src">Source: {source}</span>
    </div>
  )
}

export function DataPage({ onBack }: { onBack: () => void }) {
  return (
    <main className="app">
      <button className="link" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        Back
      </button>
      <h2>Where the data comes from</h2>
      <p>Every number in ASTRA comes from a NASA or NOAA file. Open a part to see each number and its source.</p>

      <details open>
        <summary>Our NASA sources</summary>
        {sources.map((s) => (
          <div className="datum" key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.name}
            </a>
            <span>{s.gives}</span>
            <span className="src">
              {s.licence}. {s.note}
            </span>
          </div>
        ))}
      </details>

      <details>
        <summary>The 8 real storms</summary>
        {storms.map((s) => (
          <div className="datum" key={s.id}>
            <b>{s.title}</b>
            <span>
              {s.dates}. NOAA level {s.sLevel}. Peak {s.peakPfu.value.toLocaleString('en-US')} pfu on {s.peakDate}. Flare {s.flare.value}.
            </span>
            <span className="src">Source: {s.peakPfu.source}</span>
            <a href={s.records[0]?.url} target="_blank" rel="noreferrer">
              {s.records[0]?.label}
            </a>
          </div>
        ))}
        <p className="fineprint" style={{ padding: '8px 0 12px' }}>
          Storm numbers are shown as NASA and NOAA recorded them. In Commander mode the game makes storms stronger ({MODES.commander.stormBoost} times). That changes the game, never these numbers.
        </p>
      </details>

      <details>
        <summary>How often flares bring space rays</summary>
        <div className="datum">
          <span>
            In real life most flares bring no rays: {flareStats.total.followed} of {flareStats.total.n} big flares (M5 or bigger) were followed by space rays within 3 days. In the game each hand has about half of each, so you can practise.
          </span>
          <span className="src">Rule: {flareStats.rule}</span>
          <span className="src">Source: {flareStats.source}</span>
        </div>
        {[...flareStats.buckets, ...flareStats.clues].map((b) => (
          <Datum key={b.id} label={b.label} value={`${b.followed} of ${b.n} (${b.percent}%)`} source="NASA DONKI archive, counted by us" />
        ))}
      </details>

      <details>
        <summary>The 9 places</summary>
        <p className="fineprint" style={{ padding: '4px 0 8px' }}>
          Best-lit spot within 5 km of each region (LRO LOLA, 18.6-year average).
        </p>
        {sites.map((s) => (
          <div key={s.id}>
            <Datum label={`${s.name}, sunlight`} value={`${(s.sunShare.value * 100).toFixed(1)}% of days`} source={s.sunShare.source} />
            <Datum label={`${s.name}, Earth in view`} value={`${(s.earthShare.value * 100).toFixed(1)}% of days`} source={s.earthShare.source} />
          </div>
        ))}
      </details>

      <details>
        <summary>Air, food and water</summary>
        {Object.entries(consumables).map(([k, v]) => (
          <Datum key={k} label={words(k)} value={String(v.value)} source={v.source} />
        ))}
      </details>

      <details>
        <summary>Radio to Earth</summary>
        <Datum label="Radio delay, one way" value="1.28 seconds" source={RADIO_SOURCE} />
      </details>

      <details>
        <summary>Space science facts</summary>
        {science.map((f) => (
          <div className="datum" key={f.id}>
            <span>{f.learnMore}</span>
            <span className="src">Source: {f.source}</span>
            <a href={f.url} target="_blank" rel="noreferrer">
              NASA OSDR study
            </a>
          </div>
        ))}
      </details>

      <p className="fineprint">
        ASTRA uses NASA data. It is not made or endorsed by NASA. The game was made with help from Claude AI. Read-aloud uses your device’s own voice. This is a game, not a real mission tool.
        <br />
        Crew faces: built from Open Peeps by Pablo Stanley (CC0). ORBI and the Moon base picture: drawn by our team from simple shapes. Font: Nunito (SIL Open Font License). Icons: Lucide (ISC licence).
      </p>
    </main>
  )
}
