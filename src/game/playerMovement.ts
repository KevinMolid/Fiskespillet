// Shared cadence for keyboard, touch and the existing one-tile movement tween.
export const PLAYER_RUN_MULTIPLIER = 2
export const PLAYER_MOVE_DURATION_MS = 115
export const PLAYER_KEY_REPEAT_MS = 145
export const PLAYER_TOUCH_REPEAT_MS = 150
export const PLAYER_TURN_DELAY_MS = 50

export function playerMovementTiming(running: boolean) {
  const speed = running ? PLAYER_RUN_MULTIPLIER : 1
  return { duration: PLAYER_MOVE_DURATION_MS / speed, keyboardRepeat: PLAYER_KEY_REPEAT_MS / speed,
    touchRepeat: PLAYER_TOUCH_REPEAT_MS / speed, turnDelay: running ? 0 : PLAYER_TURN_DELAY_MS }
}
