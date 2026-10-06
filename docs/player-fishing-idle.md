# Relaxed fishing pose

Built-in imagegen generated a transparent four-direction sheet from the existing
cast-forward assets. Source: `exec-181e0018-9781-419d-b2cc-487bb7a35fe0.png`
(1448 × 1086). Original idle, walk, aim and forward-cast artwork is unchanged.

Production assets live in `src/assets/characters/player/`:
`down-fishing-idle.png`, `right-fishing-idle.png`, `up-fishing-idle.png`,
`left-fishing-idle.png`. Mapping is `PLAYER_CHARACTER.poses.fishingIdle`
in `src/game/characters.ts`.

Preparation: `tools/prepare-player-fishing-idle.py SOURCE`. Equal 724 × 543 cells
map down/right/up/left in reading order. One 2.25 nearest-neighbor normalization,
2048 × 1536 canvas, hard RGBA alpha (0/255), and ground anchor (1024, 1524).
Boots alone determine center X, so rod length cannot shift the feet. Preparation
asserts that every opaque pixel fits, and that soles end at Y=1524. Body heights
are 1125/1114/1141/1139 pixels, displayed at 56.25/55.7/57.05/56.95 world pixels.
Render scale remains the player's shared 0.05, with nearest texture filtering.
No original reference sheet is included in the production bundle.

At actual lure landing, `showCastSplash()` switches the pose before drawing the
splash. It remains active during splash, depth, retrieve, hook, fight and outcome
saving. `finishFishing()` resets it on completion, cancellation or failure;
map rebuild and shutdown clear the sequence too. Flight retains the existing
forward-cast pose and rod-tip attachment. No movement, collision, camera,
interaction, fishing rules or phase durations change.

Browser tests verify the landing boundary, persistent pose through every fishing
phase, four-direction mapping, real PNG foot baselines, hard alpha, shared scale,
nearest filtering, unchanged world coordinates, and normal idle restoration after
success/no-bite/snag/cancel/interrupted flight. Modes: desktop, portrait mobile
DPR 3, landscape mobile DPR 3 and Canvas fallback.

## Final generation prompt (built-in imagegen)

Use case: precise-object-edit.
Asset type: four-direction game sprite sheet for relaxed fishing idle.
Input images 1-4: current cast-forward pose references in order down, right, up, left. Preserve this EXACT character, costume, proportions, palette and crisp coarse pixel-art style. Change only the pose to calm fishing AFTER the lure has landed.
Produce ONE transparent RGBA sprite sheet in a 2 by 2 grid: top-left FRONT facing DOWN; top-right profile facing RIGHT; bottom-left BACK facing UP; bottom-right profile facing LEFT. No labels. Equal square cells with generous empty gutters; whole hat, boots and entire rod visible within each cell. Character bodies have identical hat-to-sole height and soles at the same height in each cell.
Pose: upright relaxed planted idle stance, legs comfortably straight, no cast lunging. Shoulders lowered, elbows bent and kept near waist/body, hands comfortably holding the cork handle and reel in front at belly/waist height. One hand grips rod, the other rests at reel crank. Fishing rod points FORWARD along facing at a gentle slight upward angle, NOT overhead, NOT drawn back, NOT arms fully extended. RIGHT rod points right gently upward; LEFT rod points left gently upward. DOWN rod extends towards lower-right foreground with foreshortening; UP rod extends upper-right away, held low with lowered shoulders. One rod and reel, two plausible attached arms and hands.
Keep straw hat/navy band, brown hair, blue shirt, tan pocket vest, diagonal satchel, gray-green cargo pants, brown boots and blue eyes exactly as references. Keep same face and mature game sprite proportions. Render like existing sharp square pixel sprites, not smooth/chibi/3D. Transparent background, no floor/shadow/scenery/text/water/fish/line overlay, no clipping.
