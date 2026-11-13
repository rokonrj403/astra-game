import { useMemo } from 'react'
import { Check, Rocket, type LucideIcon } from 'lucide-react'
import { CloudLane, CrewToken, DomeShield, Ground, Habitat, Rays, Sky, Sun, flareSize, hitTimes, hitsPerSegment, planRays, rayCountFor, sunPos, type FlareView, type Side } from '../scene'

/** What the three panels need to know about the storm that ended the mission. */
export interface RaysStory {
  /** The flare's class, e.g. "X1.9" (size is drawn from it). */
  cls: string
  cloud: boolean
  /** Which limb of the Sun the flare came from (Commander only draws it). */
  side: Side | null
  /** Shield charge that met the storm, 0 to 6. */
  shield: number
  /** How strong the storm was, as the engine measured it. */
  incoming: number
}

/**
 * The three pictures of "why", drawn with the same parts as the living base scene so the child sees the same Sun, cloud and dome again:
 *   1 a flare bursts on the Sun, 2 the gas cloud travels the lane, 3 the rays meet the dome (lit segments stop them, dark ones let them in).
 * Each panel is a cropped window onto the 360 x 440 scene. With reduced motion the animations rest on their final picture.
 */
const SUN = sunPos(5, 10)

function flareView(story: RaysStory, daysSince: number): FlareView {
  return { size: flareSize(story.cls), cloud: story.cloud, side: story.side ?? 'east', daysSince }
}

export function FlarePanelArt({ story, showSide }: { story: RaysStory; showSide: boolean }) {
  return (
    <svg className="whyart" viewBox="0 8 360 156" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <Sky sunny={false} earth={false} />
      <Sun x={SUN.x} y={SUN.y} sunny warn flare={flareView(story, 1)} showSide={showSide} />
    </svg>
  )
}

export function CloudPanelArt({ story }: { story: RaysStory }) {
  return (
    <svg className="whyart" viewBox="0 20 360 156" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <Sky sunny={false} earth={false} />
      <Sun x={SUN.x} y={SUN.y} sunny warn flare={flareView(story, 2)} />
      <CloudLane from={SUN} daysSince={2} state="arrive" />
    </svg>
  )
}

export function RaysPanelArt({ story }: { story: RaysStory }) {
  const rays = useMemo(() => planRays(story.shield, rayCountFor(story.incoming, 24), story.side, SUN.x), [story])
  const hits = useMemo(() => hitsPerSegment(rays), [rays])
  const hitAt = useMemo(() => hitTimes(rays), [rays])
  return (
    <svg className="whyart" viewBox="0 100 360 210" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <Sky sunny={false} earth={false} />
      <Ground sunX={SUN.x} sunny={false} />
      <Habitat count={0} powerLow={false} />
      <DomeShield charge={story.shield} storm hits={hits} hitAt={hitAt} />
      <Rays rays={rays} />
    </svg>
  )
}

/** Panel 1 of a story that is not about rays: the base with a dull habitat and the bar that ran out drawn big over it. */
export function RanOutArt({ Icon, color }: { Icon: LucideIcon; color: string }) {
  return (
    <svg className="whyart" viewBox="0 160 360 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <Sky sunny={false} earth={false} />
      <Ground sunX={SUN.x} sunny={false} />
      <Habitat count={0} powerLow />
      <Icon x={118} y={178} width={110} height={110} color={color} strokeWidth={2.4} />
    </svg>
  )
}

/** Panel 2: the rescue ship comes down to the base. */
export function ShipArt() {
  return (
    <svg className="whyart" viewBox="0 160 360 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <Sky sunny={false} earth />
      <Ground sunX={SUN.x} sunny={false} />
      <Habitat count={0} powerLow={false} />
      <g className="ship-down">
        <Rocket x={252} y={206} width={70} height={70} color="#F0A900" strokeWidth={2.4} />
      </g>
    </svg>
  )
}

/** Panel 3: the whole crew, safe, with a tick. */
export function SafeArt() {
  return (
    <svg className="whyart" viewBox="0 160 360 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <Sky sunny earth />
      <Ground sunX={SUN.x} sunny />
      <Habitat count={0} powerLow={false} />
      {(['safia', 'kofi', 'leo', 'mei'] as const).map((id) => (
        <CrewToken key={id} id={id} mood="happy" />
      ))}
      <Check x={14} y={176} width={56} height={56} color="#009E73" strokeWidth={3.4} />
    </svg>
  )
}
