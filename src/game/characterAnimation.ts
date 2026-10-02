import { FUTURE_WALK_FRAME_COUNT, type CharacterPose } from './characterStandard'
import type { Direction } from './world'

/** One synchronized pose for every module. Missing walk artwork falls back to idle. */
export function characterPose(direction: Direction, moving: boolean, progress: number): CharacterPose {
  return { direction, state: moving ? 'walk' : 'idle', frame: moving ? Math.min(FUTURE_WALK_FRAME_COUNT-1,Math.max(0,Math.floor(progress*FUTURE_WALK_FRAME_COUNT))) : 0 }
}
