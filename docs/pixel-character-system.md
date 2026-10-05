# Pixel character system

Nine characters: the approved player plus Mor, Far, Kevin, Oda, Magnus, Bendik,
Nils and Morten. Each has down/right/up/left idle and two anatomical walk poses.
108 runtime PNGs live under `src/assets/characters/<id>/`:
`down.png`, `down-walk-1.png`, `down-walk-2.png`, and the equivalent other views.

## Standards and identity

NPC canvas is 48 × 64, origin (24,60), scale 1, NEAREST. Their authored proportions
match the detailed pixel player. Bendik's modest extra height is retained in his
asset because existing NPC data explicitly identifies him as tall. Magnus has a
round belly/wider torso, beard and Hawaiian shirt and is **completely bald** in
every view. Other identifying traits are listed in `character-pose-contract.md`.
No character/direction-specific runtime offsets or scales exist for NPCs.

Player original idle canvases remain 768 × 1184, origin (384,1172), scale 0.05.
They have not been rewritten or redesigned. Their original-resolution source
needs a different asset-to-world scale to maintain its approved visual size.
Both formats use the same existing +14 world-Y ground conversion from tile-center
containers. Logical position, collision, camera following and depth are unchanged.

## Production workflow

Built-in imagegen created the NPC design sheets from the approved pixel-player
style and existing identity descriptions. Source sheets and prompts are stored in
`output/imagegen/manifest.json` and sibling PNGs, outside the runtime asset tree.
Their generated walking columns are discarded, not used in the game.
`tools/prepare-npc-idle-assets.py` extracts only the four idle designs,
detects real transparent gutters, uses nearest resizing and aligns the boots.
Run it with `output/imagegen/manifest.json` to rebuild NPC idles.

The user authorized deterministic pixel rigging for all walking frames.
`tools/rig-character-walk.py` derives 72 frames from the 36 corresponding idles.
Player poses now delegate to `tools/player_walk_rig.py`: manually registered
sleeve/arm and trouser/shoe masks for each view, explicit shoulder/elbow/wrist
and hip/knee/ankle joints, and rigid hands/boots. The bag excludes the old
hand masks, preventing a second stationary hand behind the moving hand. Only
the player's eight walk PNGs are rebuilt; the four idles and all NPCs stay intact.
Profile legs use two joint segments with forward-bending knees and whole boots;
the accepted front/back legs retain their existing depth projection. All four
views articulate complete shoulder caps, upper arms and forearms. A small source
shirt socket keeps each sleeve attached to the collar. The exact eight-pose plan
and numerical joint targets are in `player-walk-pose-plan.md`.
Anatomical left/right are mapped per
view; right profile's near limb is left, left profile's near limb is right.
A is left leg/right arm forward; B is the opposite. Front and back use opposite
depth projections. Occluded profile limbs are derived from the same character's
near limb, shaded and drawn behind the body. Player heads remain fixed while
shoulders move. The separate NPC rig is unchanged, including Oda's hair.
No generative walking images or global body scaling are used.
All operations use nearest sampling and binary alpha. Rig metadata and idle
hashes are in `character-rig-measurements.json`.

## Runtime

`characters.ts` maps IDs to directional idle/walk URLs and format. Vite resolves
hashed/inline production assets. `characterRendering.ts` preloads and validates
every frame and maintains one image object per character. `characterAnimation.ts`
selects A in the first half of the NPC tile tween and B in the second half,
then idle on completion. For the player, each successful tile move is one
alternating footfall: A→B→A→B. `PLAYER_WALK_SETTLE_MS` (70 ms) holds the final
pose across the existing 30 ms keyboard gap, then returns to idle. Opening a UI,
fishing and map transitions clear this visual continuation. Movement still uses
the original 115 ms tween and 145 ms keyboard cadence.

`WorldScene.ts` uses existing player 115 ms / NPC 300 ms movement tweens and existing
NPC routes/look timers. Stationary NPCs still stand still, but all have complete
walking assets for future routes. No collision/map/dialogue/gameplay data changed.
The world canvas remains pixelated, without applying this style to DOM UI/text.

## Review and validation

`/tools/character-preview.html` shows all nine figures: idle, A, B and live loop.
Choose a view to inspect feet/arms against a common baseline. World preview is at
`/tools/game-preview.html`. These are local review tools, not runtime UI additions.
Screenshots are in `output/character-review/`.

Validation:

- TypeScript and Vite build.
- `check-character-standard.py`: 108 PNGs, alpha, ground, unchanged idle/head,
  actual alternating boot pixels, anatomical forearm projection, Magnus traits.
- `check-character-animation.mjs`: gait phases, idle reset and consecutive steps.
- `check-player-walk.py`: actual hand and shoulder pixels articulate in every
  view; profile knees bend forward, segment lengths stay fixed and boots stay whole.
- `check-character-browser.mjs`: all NPC views/poses, retained objects, actual
  player/NPC tween animations, preview gallery, desktop/mobile DPR3/Canvas.
- `check-player-browser.mjs`: controls, facing, collision, camera, transitions,
  signs/fishing/dialogue and layout in those same three browser modes.
- Existing world, NPC, controls and fishing checks.

The user approved publication on 2026-10-02 with “Implementer karakterene i spillet
og publiser.” The project uses GitHub `main` for publication. No web hosting
deployment is configured in this repository.
