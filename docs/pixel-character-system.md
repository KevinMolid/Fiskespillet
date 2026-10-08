# Pixel character system

The player and all nine NPCs share directional idle plus A/B/C walking assets.
NPCs: Kevin, Mor, Far, Oda, Magnus, Bendik, Nils, Morten and Marita. Each has 16
production PNGs in `src/assets/characters/<id>/`: `<direction>.png` and
`<direction>-walk-{1,2,3}.png`, for down/right/up/left. Player fishing poses use
the separate existing pose registrations.

## Format and identity

NPC canvas: 48 x 64; foot anchor (24,60); render scale 1; nearest filtering.
Player canvas: 768 x 1184; anchor (384,1172); scale .05; nearest filtering.
Both use the existing +14 ground conversion inside their tile-center containers.
All directions of each format share the same scale and origin. Collision remains
one logical tile, independently of image width, arms, hats or hair.

Approved player artwork and all NPC idle PNGs are immutable in this update.
Character identities remain defined by their own idles and the checklist in
`character-pose-contract.md`: Magnus is bald and heavy with a beard and orange
Hawaiian shirt; Bendik is lean/taller; Marita retains brown hair, white cropped
tank, exposed midriff, charcoal leggings and white trainers. Other hair, glasses,
clothing palettes and silhouettes are retained.

## Walking authoring

The user authorized deterministic pixel rigging. `tools/npc_walk_rig.py` derives
108 NPC walking frames from 36 directional idles, with native integer pixels,
binary RGBA alpha and nearest sampling. No AI walking columns are consumed.
`tools/rig-character-walk.py` delegates to this current rig; its optional
`--include-player` flag explicitly also rebuilds the separate player rig.

Source registration includes shoulder, hip and cuff levels per character.
Complete sleeve caps, upper arms, forearms and rigid hands are articulated, with
an inner sleeve socket behind the moving cap. Profiles reconstruct hidden limbs
from the same character and shade them behind the body. Hair is a separate layer;
it must not rotate as a sleeve. Exposed clothing is filled from existing palette
pixels, with an uninterrupted waistband and native dark contour. Magnus retains
his full belly and pelvis; his narrower lateral arm swing fits the wide body in
the shared canvas without changing runtime scale.

A advances the anatomical left leg and right arm; B advances the right leg and
left arm. Down/up reverse the actual shoe-depth projection by five native pixels.
Profiles articulate continuous trouser panels through hip, forward-bending knee
and ankle. `PROFILE_SHOES` registers the original foreground shoe's contour row
by row for each NPC/profile. This excludes the other idle shoe's toe, which a
rectangular sole crop incorrectly carried into both walking legs. Exactly two
copies of this isolated shoe move rigidly on a horizontal toe axis; the farther
shoe is shaded to 80% and one pixel higher. Side/back C returns the arms to neutral,
with one support leg and one bent passing leg lifted three pixels. NPC down C is
the exact original idle, with centered feet; its registry slot points directly
to the idle URL and `down-walk-3.png` is byte-identical for authoring tools. Source shoe
sizes, trouser widths and outlines are retained; Marita's slim leggings are not
widened by her hand pixels. The planted sole stays at Y=60.

Joint targets, anatomical phase, bounds and immutable idle hashes are recorded in
`character-rig-measurements.json`. `output/npc-walk-review/{down,right,up,left}.png`
contains the local idle/A/B/C review sheets, outside the runtime bundle.

## Runtime movement and animation

`characters.ts` registers directional URLs, A/B/C frames and passing frame 3 for
all characters. `characterRendering.ts` validates/preloads the assets and retains
one image object per character. `characterAnimation.ts` selects the shared
A-C-B-C sequence, advancing once per successful tile. Each image is held for that
whole tile; idle returns at rest after a brief 70 ms final-pose settle.

`WorldScene` interpolates actual position each frame and carries fractional frame
time into the next tile. Logical tile positions, collision and interaction checks
remain in the existing world/NPC systems. Ground Y controls depth every frame.
Player keyboard/touch steps take 145/150 ms, halved when running; turn-before-walk
is 50 ms for walking and immediate for running. NPC strolling takes 300 ms per
tile, configured in `npcMovement.ts`. Straight sections chain without a stationary
gap; the existing 1600 ms route pause is retained at changes of direction. Route
occupancy and the player's nearby interaction guard still block further steps.
Active NPC steps finish if UI or fishing temporarily prevents starting the next
step. NPCs can continue while the player walks; collision reserves both the
player's current tile and the destination of an active step, preventing overlap
or head-on swaps. The nearby interaction guard still stops NPCs for conversation.

NPC map positions, routes, dialogue, gifts, stationary look timers and map data
are unchanged. Stationary NPCs have complete walking assets for future use but
continue standing at their existing positions. Player camera follow, controls,
fishing poses, artwork and render scales remain unchanged.

## Review and validation

`/tools/character-preview.html` shows all ten characters with idle/A/B/C and a
live loop. Player preview uses 145 ms per pose; NPCs use their actual 300 ms stroll.
`/tools/game-preview.html` shows the real movement and route behavior.

- `check-character-standard.py`: 160 idle/A/B/C frames, exact heads and idle hashes,
  alpha, dimensions, foot baseline, actual opposite front/back foot pixels,
  anatomical arm/leg phase and Magnus's bald/heavy identity.
- `check-npc-walk.py`: all 108 NPC walking PNGs have connected anatomy, covered
  torsos and whole undistorted horizontal profile shoes. Actual shoe-height pixels
  must match exactly the composited pair of isolated source shoes, detecting any
  extra toe fragments; all nine front C files must match idle byte for byte.
- `check-character-animation.mjs`: shared one-image-per-tile A-C-B-C sequence.
- `check-npc-movement-browser.mjs`: all nine NPCs in four directions, actual
  rendered velocity across four tiles, per-tile frames, turnaround pauses, depth,
  ground, nearest filtering and unchanged stationary positions. Desktop,
  mobile/DPR3 and Canvas.
- `check-character-browser.mjs`: all NPC poses, retained rendering objects,
  player directional gait, NPC gait, Marita interaction and review gallery.
  Also checks NPC down C's idle URL and actual loaded texture pixels on desktop,
  mobile/DPR3 and Canvas.
- `check-continuous-movement.mjs`, `check-turn-before-move.mjs` and existing NPC
  checks: player travel, turns, collision, fishing, map exits and route accessibility.
- TypeScript and production Vite build.

Publication uses GitHub main; no web hosting deployment is configured here.
