/**
 * ASTRA living Moon base scene.
 * <MoonBaseScene model reveal walk hot ... /> + <PowerTray ... /> + <TimeLapse ... />, with CrewBubble / OrbiBubble as children of the scene.
 * See the wiring notes in the commit message and scene/README in the hand-over report.
 */
export { MoonBaseScene, type MoonBaseSceneProps, type SceneHandle } from './MoonBaseScene'
export { PowerTray, type PowerTrayProps } from './PowerTray'
export { TimeLapse, type TimeLapseProps } from './TimeLapse'
export { CrewBubble, OrbiBubble, PictureButton, RaysIcon, CalmIcon, UnsureIcon, type Guess } from './Bubbles'
export { MeterStrip, type MeterValues } from './MeterStrip'
export { Sky, Sun, FlareBurst, ClueTags, burstSpot, sunReach, type SunProps } from './Sky'
export { CloudLane, CloudBlob, type CloudLaneProps, type CloudState } from './CloudLane'
export { DomeShield, Rays, AllClear, planRays, litSegments, hitsPerSegment, hitTimes, leakTint, type Ray } from './Dome'
export { Habitat, Greenhouse, Dish, Airlock, SolarPanels, Ground, Pips, Stepper, BuildingTarget, DomeTarget } from './Buildings'
export { Walker, WalkTrail, WALK_PATH, walkDuration, pointAlong, type WalkKind, type WalkMode, type WalkerProps } from './Walker'
export { CrewToken, OrbiToken, CREW_POS, ORBI_POS } from './Actors'
export { ZONES, hitZone, clientToScene, zoneCenter, type Zone } from './zones'
export { useReducedMotion, isLowEnd } from './motion'
export {
  CALM_MODEL,
  NO_BLOCKS,
  PULSES,
  TARGETS,
  flareSize,
  rayCountFor,
  revealFromRecord,
  sceneModelFromGame,
  walkBlocks,
  type CrewId,
  type FlareSize,
  type FlareView,
  type Mood,
  type RevealView,
  type SceneModel,
  type Side,
  type Target,
} from './model'
export { W as SCENE_W, H as SCENE_H, sunPos } from './tokens'
