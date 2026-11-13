import { MODES } from '../engine/constants'
import { NASA_NOTE } from './screens'
import { canSpeak, speak, type Prefs } from './speech'

export function Settings({ prefs, onChange, onBack }: { prefs: Prefs; onChange: (p: Prefs) => void; onBack: () => void }) {
  const can = canSpeak()
  return (
    <main className="app">
      <button className="link" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        Back
      </button>
      <h2>Settings</h2>
      <section className="card stack" aria-label="Sound">
        <div className="row between">
          <h3 id="snd-label">Sound</h3>
          <button
            role="switch"
            aria-checked={prefs.sound}
            aria-labelledby="snd-label"
            className={`switch${prefs.sound ? ' on' : ''}`}
            onClick={() => onChange({ ...prefs, sound: !prefs.sound })}
          >
            {prefs.sound ? 'On' : 'Off'}
          </button>
        </div>
        <p>Soft clicks, a chime for storm news and a rumble when a storm hits. They are made on your device. Nothing is downloaded.</p>
      </section>
      <section className="card stack" aria-label="Read aloud">
        <div className="row between">
          <h3 id="ra-label">Read aloud</h3>
          <button
            role="switch"
            aria-checked={prefs.readAloud && can}
            aria-labelledby="ra-label"
            className={`switch${prefs.readAloud && can ? ' on' : ''}`}
            disabled={!can}
            onClick={() => onChange({ ...prefs, readAloud: !prefs.readAloud })}
          >
            {prefs.readAloud && can ? 'On' : 'Off'}
          </button>
        </div>
        <p>When it is On, a speaker button shows next to ORBI’s tips, storm alerts and reports. Tap it to hear the words.</p>
        {can ? (
          <>
            <p className="muted">The voice comes from your device. Nothing is recorded or sent anywhere.</p>
            <button onClick={() => speak('Hello. I can read the words out loud.')}>Hear a sample</button>
          </>
        ) : (
          <p className="muted">This device can not read aloud, so this stays Off.</p>
        )}
      </section>
    </main>
  )
}

function Part({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open}>
      <summary>{title}</summary>
      <div className="stack" style={{ padding: '4px 0 14px' }}>
        {children}
      </div>
    </details>
  )
}

export function Teachers({ onBack, onData }: { onBack: () => void; onData: () => void }) {
  return (
    <main className="app">
      <button className="link" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        Back
      </button>
      <h2>For teachers</h2>
      <p>ASTRA is a Moon base game for children aged 7 to 12. They share power, read the forecast and keep the crew safe from real solar storms.</p>

      <Part title="What children learn" open>
        <p>The game keeps a few science words and explains each one:</p>
        <ul className="plain">
          <li>
            <b>Radiation:</b> invisible space rays that can hurt your body.
          </li>
          <li>
            <b>Solar storm:</b> when the Sun throws out a big burst of energy.
          </li>
          <li>
            <b>Flare:</b> a sudden bright flash on the Sun.
          </li>
          <li>
            <b>Battery:</b> saves power for when it is dark.
          </li>
          <li>
            <b>Mission Control:</b> the team on Earth that helps astronauts.
          </li>
        </ul>
        <p>They also see that a base must balance air, power, food and shielding, and that a message to Earth takes time.</p>
      </Part>

      <Part title="How a game works">
        <p>
          Each day the crew has 6 blocks to share between Air, Shield, Plants and Radio. The arrows show what tomorrow looks like with those blocks. A Cadet mission is {MODES.cadet.days} days with one storm. A Commander mission is {MODES.commander.days} days with two storms and a food bar.
        </p>
        <p>The radio can only reach Earth when Earth is in view. A call takes about 2.6 seconds there and back, because radio waves take time to cross the distance.</p>
        <p>If a bar runs out, a rescue ship takes the crew home and nobody is hurt. A screen called “Why it happened” walks through the cause, step by step.</p>
        <p className="muted">We have not timed a class session with children yet, so we do not give a play time here.</p>
      </Part>

      <Part title="What is real and what is a game">
        <p>The storms are real. Each one is a storm NASA and NOAA recorded in the past, shown with its real dates, NOAA level and peak. Today’s Sun shows real flares from NASA and says clearly if it is LIVE or SAVED.</p>
        <p>
          The game is not a forecast and not a mission tool. In Commander mode the game makes storms stronger ({MODES.commander.stormBoost} times) so the mission stays hard. That changes the game, never the numbers shown on the storm cards. The places are NASA’s 9 candidate landing regions near the Moon’s South Pole. Sunlight and Earth views come from NASA Moon maps.
        </p>
        <button className="link" onClick={onData}>
          See every number and its source
        </button>
      </Part>

      <Part title="Questions to ask">
        <ul className="plain">
          <li>Why did the radio need Earth in view?</li>
          <li>What did the crew do when the forecast showed a storm?</li>
          <li>Why does a dark day give so little power?</li>
          <li>Why do the Moon base and its crew need a shield?</li>
        </ul>
      </Part>

      <Part title="Privacy and access">
        <p>ASTRA has no accounts, no names and no photos of children. It sends nothing about the player anywhere. It saves only your storm cards, your read-aloud choice and the last Today’s Sun copy, on your own device.</p>
        <p>Every bar uses a picture, a word and a number, not colour alone. The game works with taps only. Read-aloud is in Settings.</p>
      </Part>

      <Part title="AI and credits">
        <p>{NASA_NOTE}</p>
        <p>This game was made with help from Claude, an AI assistant. Read-aloud uses your device’s own voice.</p>
        <p className="muted">
          The four crew faces were built from Open Peeps by Pablo Stanley (CC0). ORBI and the Moon base picture were drawn by our team from simple shapes. The faces were first made for our project video and are reused here. Font: Nunito (SIL Open Font License). Icons: Lucide (ISC licence).
        </p>
      </Part>
    </main>
  )
}
