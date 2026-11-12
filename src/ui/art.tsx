import { CREW, sceneLabel, type CrewId, type Mood, type SceneState } from './look'

const art = (path: string) => `${import.meta.env.BASE_URL}art/${path}`

/** A crew face on its cream plate (the plate and the crew-colour ring are part of the picture). */
export function CrewFace({ id, mood, size = 56 }: { id: CrewId; mood: Mood; size?: number }) {
  const who = CREW.find((c) => c.id === id)
  return <img className="face" src={art(`crew/${id}-${mood}.webp`)} width={size} height={size} alt={`${who?.name ?? id}, ${mood}`} />
}

export function OrbiFace({ look = 'open', size = 48 }: { look?: 'open' | 'curious' | 'blink'; size?: number }) {
  return <img className="face" src={art(`orbi/orbi-${look}.webp`)} width={size} height={size} alt="ORBI, the robot dog" />
}

export function CrewStrip({ moods }: { moods: Record<CrewId, Mood> }) {
  return (
    <ul className="crew" aria-label="The crew">
      {CREW.map((c) => (
        <li key={c.id}>
          <CrewFace id={c.id} mood={moods[c.id]} />
          <span>{c.name}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The Moon base, one side-view picture made of simple shapes (360 x 200, horizon at y=150).
 * Every part is a named group, and each real game state changes one of them.
 */
export function BaseScene({ s }: { s: SceneState }) {
  const warn = s.storm !== 'none'
  const sun = warn ? '#D55E00' : '#E69F00'
  const glow = s.shield === 0 ? 0 : 0.08 + s.shield * 0.03 + (s.storm === 'now' ? 0.2 : 0)
  const window = s.powerLow ? '#5b6b8a' : '#F0E442'
  return (
    <svg className="scene" viewBox="0 0 360 200" role="img" aria-label={sceneLabel(s)}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0F1B33" />
          <stop offset="1" stopColor={s.sunny ? '#2b4f86' : '#16264a'} />
        </linearGradient>
        <clipPath id="scene-clip">
          <rect width="360" height="200" rx="16" />
        </clipPath>
      </defs>
      <g clipPath="url(#scene-clip)">
        <rect id="sky-bg" width="360" height="200" fill="url(#sky)" />

        {!s.sunny && (
          <g id="stars" fill="#F2EFE8">
            {[
              [30, 24], [96, 40], [150, 18], [214, 34], [262, 20], [330, 82], [22, 90], [120, 78], [240, 76], [190, 60],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />
            ))}
          </g>
        )}

        {s.sunny ? (
          <g id="sun" className={warn ? 'pulse' : undefined}>
            <circle cx="56" cy="54" r="32" fill={sun} opacity="0.22" />
            <circle cx="56" cy="54" r="17" fill={sun} />
            {warn &&
              [0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                <line key={a} x1="56" y1="26" x2="56" y2="16" stroke={sun} strokeWidth="3" strokeLinecap="round" transform={`rotate(${a} 56 54)`} />
              ))}
          </g>
        ) : (
          <g id="sun-glow" className={warn ? 'pulse' : undefined}>
            <circle cx="56" cy="150" r="36" fill={sun} opacity="0.2" />
            <circle cx="56" cy="150" r="19" fill={sun} opacity="0.6" />
          </g>
        )}

        {s.earth && (
          <g id="earth">
            <circle cx="306" cy="44" r="15" fill="#56B4E9" />
            <path d="M298 40 q7 -7 11 0 q-3 9 -9 6z" fill="#009E73" />
            <path d="M310 50 q6 2 4 8 q-6 0 -4 -8z" fill="#009E73" />
          </g>
        )}

        <path id="ground" d="M0 150 Q180 142 360 150 L360 200 L0 200Z" fill="#C9CCD3" />
        <g id="craters" fill="#AEB2BC">
          <ellipse cx="40" cy="178" rx="20" ry="5" />
          <ellipse cx="250" cy="186" rx="26" ry="5" />
          <ellipse cx="336" cy="172" rx="14" ry="4" />
          <ellipse cx="130" cy="190" rx="16" ry="4" />
        </g>

        <g id="solar-panels" stroke="#F2EFE8" strokeWidth="1.5">
          <path d="M80 140 L110 134 L116 148 L86 154Z" fill={s.sunny ? '#56B4E9' : '#26436f'} />
          <path d="M116 135 L144 130 L150 144 L122 149Z" fill={s.sunny ? '#56B4E9' : '#26436f'} />
          <line x1="100" y1="146" x2="100" y2="158" />
          <line x1="133" y1="142" x2="133" y2="156" />
        </g>

        <g id="habitat">
          <path d="M156 152 A34 34 0 0 1 224 152Z" fill="#F2EFE8" stroke="#34476e" strokeWidth="2" />
          <g id="windows" fill={window} opacity={s.powerLow ? 0.7 : 1}>
            <circle cx="176" cy="138" r="4.5" />
            <circle cx="190" cy="131" r="4.5" />
            <circle cx="204" cy="138" r="4.5" />
          </g>
          <rect x="184" y="144" width="12" height="8" rx="2" fill="#34476e" />
        </g>

        <g id="greenhouse">
          <path d="M228 152 A24 24 0 0 1 276 152Z" fill="#bfe8d8" stroke="#34476e" strokeWidth="2" />
          {s.plantsHappy ? (
            <g id="plants-happy" stroke="#009E73" strokeWidth="3" strokeLinecap="round" fill="none">
              <path d="M240 150 L240 138" />
              <path d="M252 150 L252 132" />
              <path d="M264 150 L264 139" />
              <circle cx="240" cy="136" r="3.5" fill="#009E73" />
              <circle cx="252" cy="130" r="3.5" fill="#009E73" />
              <circle cx="264" cy="137" r="3.5" fill="#009E73" />
            </g>
          ) : (
            <g id="plants-sad" stroke="#8a6a3b" strokeWidth="3" strokeLinecap="round" fill="none">
              <path d="M240 150 Q240 140 246 144" />
              <path d="M252 150 Q252 138 259 143" />
              <path d="M264 150 Q264 141 269 146" />
            </g>
          )}
        </g>

        <g id="radio-dish">
          <line x1="318" y1="152" x2="318" y2="130" stroke="#34476e" strokeWidth="3" />
          <g transform={`rotate(${s.earth ? -35 : 20} 318 130)`}>
            <path d="M306 126 Q318 144 330 126" fill="none" stroke="#CC79A7" strokeWidth="4" strokeLinecap="round" />
            <circle cx="318" cy="123" r="2.5" fill="#CC79A7" />
          </g>
        </g>

        <g id="shield-dome">
          <path
            d="M70 152 A120 100 0 0 1 310 152Z"
            fill="#F0E442"
            fillOpacity={glow}
            stroke="#F0E442"
            strokeOpacity={s.shield === 0 ? 0 : s.storm === 'now' ? 1 : 0.7}
            strokeWidth={s.storm === 'now' ? 4 : 2.5}
          />
        </g>
      </g>
    </svg>
  )
}
