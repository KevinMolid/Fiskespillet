# Utility control and hold-to-run

Mobile has a separate blue **B** utility button, showing a shoe icon.
Inside menus, the same button shows a back arrow and returns one level;
it works even without running shoes. The Menu button opens/closes the whole
menu, including from a child panel. Desktop uses B/Escape for Back and Enter
for Menu; E/Space selects. No inline back/close buttons remain in game menus.
The controller has no captions below Menu/A/B or visible A/B letters.
`ControlIcon.tsx` maps contextual actions to sharp SVG icons: shovel for digging,
speech bubble for talking, glasses for reading, rod for fishing, reel for reeling,
chest/clothes/shop for their interactions, check for selection and arrow for continue.
Menu always shows its menu icon. Descriptive accessible names remain on all buttons;
decorative SVGs ignore pointer input, so tapping the icon uses the whole button.
Desktop uses **Shift** (left or right). Hold the utility control together with a
direction to run; releasing it restores walking. Utility alone never moves.
Short walking taps turn in place; run taps turn and step immediately.
Collision/occupancy, one-tile transitions, facing,
camera follow, interactions and alternating walk frames remain in use.

Shared timings in `src/game/playerMovement.ts`:

| Input | Walking | Running |
|---|---:|---:|
| Tile tween (keyboard / touch) | 145 / 150 ms | 72.5 / 75 ms |
| Keyboard repeat | 145 ms | 72.5 ms |
| Touch repeat | 150 ms | 75 ms |
| Initial turn delay | 50 ms | 0 ms |

`PLAYER_TURN_DELAY_MS = 50` is separate from step duration and repeat cadence.
Releasing a walking direction within that window keeps the turn without walking.
Holding continues with a step after 50ms. Holding utility removes the turn-only
phase entirely; pressing utility during an existing turn window also removes
the remaining wait. Normal repeat cadence applies after the first step.

`PLAYER_RUN_MULTIPLIER = 2` controls the new visual/movement cadence. Menu
navigation still repeats at the original cadence. The existing step artwork
is played faster; no new animations or gameplay systems are introduced.

`useGameInput` tracks utility hold separately from action, with independent
keyboard keys and touch source. `GamePage` maps the generic utility callback to
`WorldScene.setUtilityHeld`. Future utility behaviours can use the same callback.
The mobile dpad, utility and action keep separate pointer ownership, so lifting
one finger does not release the other control. Held touch movement repeats on
the same Phaser frame loop as the keyboard, avoiding timer calls dropped during
a movement tween. Menu navigation keeps the existing 150 ms `HoldRepeater`.

Utility is cleared on key/pointer release, cancellation, capture loss, blur,
visibility change, context changes, blocked UI and unmount. The running action is
disabled during menus, messages and fishing; B uses the separate back callback
there. Saves/pending operations lock both Back and Menu. Active committed
fishing retains its existing cancellation restrictions. Old held inputs do
not re-arm when a menu closes.
The two Shift keys and pointer hold can coexist; releasing one source does not
cancel another still-held source.

Verification: `check-controls.mjs` tests menu repeat cadence and cancellation;
`check-utility-browser.mjs` checks actual keyboard/multitouch holds, speed changes,
walking turn-only taps, immediate run turns, release/cancel/blur/menu/fishing reset, collision/NPC occupancy,
map transition, camera follow and 320px/390px/landscape layouts. Existing
`check-turn-before-move.mjs` covers the unchanged walking controls.
