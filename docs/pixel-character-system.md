# Character Standard v1 — native 48×48

This replaces the generated high-resolution characters and their derived walk
artwork. It implements the standard and modular architecture from the latest
post in “Forbedre Fiskebokdesign”, while the user's direct request additionally
requires rebuilding **all nine characters**. Only four-direction idle artwork
is active in this first modular version. The user approved this version for
publication on 2 October 2026.

## Pixel geometry and assets

`src/game/characterStandard.ts` is the single runtime standard:

| Guide | Source pixels |
|---|---|
| Frame | 48 × 48 |
| Center / ground point | (24, 42) |
| Hair top | about 6; fisher hat extends to 4 |
| Eye / nose / mouth / chin | 14 / 16 / 18 / 20 |
| Shoulders / elbows / resting hands | 22 / 28 / 31 |
| Hip / knees / shoe top / sole boundary | 32 / 37 / about 40 / 42 |
| World scale | 1 native pixel = 1 world pixel |

The actual last opaque sole row is 41, so its lower boundary is Y=42. The
horizontal sole bounds are centered at X=24 in every view, including profiles.
Sprites have binary alpha and a transparent border. Exact per-direction bounds
and definitions are exported to `character-48-measurements.json`.

Adults share the same body geometry. Magnus uses the explicit `stockyAdult`
module variant to preserve his larger belly/body and is completely bald in all
views. Bendik uses `tallAdult` to preserve the existing tall identity. Those
variants alter authored pixels within the same frame, never render scale or
world offsets. Kevin retains dark-blond hair, glasses, light stubble, green top,
charcoal jeans and white sneakers. Other identities match existing NPC data.

## Modular artwork

`characterArt.ts` is editable, deterministic source artwork: integer pixel
clusters and palette-slot indices on a fixed native grid. It is **not** a
downsample of generated illustrations. `characterModule` caches geometry by
body variant and module ID. It exposes direction frames and state/frame arrays.
`appearanceModules` assembles the selected parts and rejects missing registered
state/frame artwork clearly.

Layer order is centralized:

1. body
2. hairBack
3. bottom
4. shoes
5. top
6. outerwear
7. hairFront
8. faceDetails
9. headwear
10. accessories

Parts include three body variants, three hairstyles plus bald, shirts/T-shirts/
sports/Hawaiian tops, cargo/jeans, boots/sneakers, vest, hat, satchel, glasses,
stubble and beard. They are reusable across player and NPC definitions.

`node tools/export-character-assets.mjs` deterministically exports the same
source into transparent PNGs:

- `src/assets/characters/<id>/{down,right,up,left}.png`: 36 complete 48×48
  default characters for inspection/export.
- `src/assets/characters/modules/<body>/<part>/idle.png`: 32 reusable 48×192
  source-palette sheets. Direction rows are **down, right, up, left**.

The pixel definitions are the source of truth. Modify those and re-export;
editing an exported PNG alone does not modify runtime art. Runtime consumes the
same indexed modules directly, so it needs no image downloads or readback and
uses exactly the pixels exported to PNG. Original generated sheets and obsolete
walk PNGs/preparation scripts were removed. Historical designs remain in Git
history.

## Palettes and definitions

`characterPalettes.ts` defines exact eight-slot ramps: transparent, outline,
deep shadow, shadow, base, highlight, accent and light. Skin supports light,
medium, dark and a fourth legacy deep tone; hair supports blond, darkBlond,
brown, darkBrown, black, red and grey. Clothes use reusable ramps as well.
Recoloring replaces each slot with its chosen RGB value, without interpolation,
HSL tinting, antialiasing or changing pixel geometry. The fisher hat band uses
the same clothing palette as the top.

`CharacterAppearance` separates visual choices from NPC identity/gameplay.
`characters.ts` registers default player and all eight NPC appearances; `NPCS`
continues owning names, routes, facing, occupancy, interactions and dialogue.
To add an NPC, add identity/gameplay to `NPCS` and a module combination to
`NPC_CHARACTERS`; no new renderer is needed. A new clothing item or hairstyle
requires one registered pixel module, all four direction rows, palette slots,
the corresponding typed selection and an appearance entry. Shared proportions
and guides prevent arbitrary character-specific adjustments.

## Composition, rendering and cache

`characterCompositor.ts` composites all layers into one RGBA image per
direction/state/frame. Its canonical key includes all appearance choices plus
state/frame. A 32-entry LRU cache lets matching looks share pixels.

`characterRendering.ts` creates cached Phaser canvas textures with NEAREST
filtering and smoothing disabled. It reference-counts appearances, evicts unused
textures at a 32-appearance limit, pins active textures and clears owned textures
when the scene shuts down. Two NPCs with matching appearance share textures.
Each resident/player retains one Image object. Ordinary updates only select
the cached pose; wardrobe changes regenerate only a changed appearance.

Images use origin (24/48, 42/48), scale 1, and the unchanged shared +14 conversion
from existing tile-center containers to the ground line. Collision still uses
tile occupancy, not the 48×48 artwork. Coordinates, 32px tiles, movement tweens,
camera following, transitions, mobile controls and fishing facing are unchanged.
Depth still uses the character's container/world Y. The game canvas and character
portraits use nearest/pixelated rendering; other DOM text/UI is unchanged.

## States and future animation

`CharacterPose` holds one direction/state/frame for the whole composite, making
independent layer drift impossible. States already include idle, walk, fishCast,
fishWait, fishHook, fishFight, dig and interact. Only idle has artwork/frame count
registered. Other states fall back **as a whole** to idle, never layer by layer.

`characterAnimation.ts` exposes synchronized four-frame walk timing using the
unchanged 115ms player / 300ms NPC tween progress. To enable actual walking,
author four frames per direction **for every selected module**, register the
state arrays and `CHARACTER_FRAME_COUNTS.walk=4`, then validate them. No movement
or rendering rewrite is needed. A four-column/four-row module walk sheet would
be 192×192, using the same 48×48 frame/anchor.

## Wardrobe and save compatibility

The existing wardrobe still owns player state, preview/cancel/save and Firestore
calls. Existing numeric `shirt`, `hair`, `skin` retain their indices and meanings.
The renderer maps them to controlled palettes; optional `outfit` and `hairstyle`
add three module-based outfits and four hair choices. Missing fields default to
fisher and playerHair. No migration or destructive write is needed.

`FisherPortrait` uses the same compositor as the world. Wardrobe previews update
the existing image, cancelling restores the prior saved look, and persistence
continues using `characterLooks/{uid}` with `saveAppearance`/`loadAppearance`.
There are no Firestore reads in the renderer/update loop. `firestore.rules`
backward-compatibly allow the two optional fields while rejecting unknown
values and unauthorized writes. Publish these rules before enabling the new
wardrobe choices in production; old clients can still write their old fields.

## Review and verification

Local review: `/tools/character-preview.html`, with all 36 views and selectable
modules/palettes/states. State selections without artwork show the documented
idle fallback. World preview: `/tools/game-preview.html`.

Verification tools:

- `check-character-standard.py`: 36 48×48 RGBA assets, sole boundary and source
  palette/dimensions of all 32 module sheets.
- `check-character-modules.mjs`: geometry/alpha, sole centering, layer order,
  identities, immutable geometry under recolor, six hair palettes, cache reuse,
  wardrobe compatibility, state/frame fallback.
- `check-character-animation.mjs`: four-frame timing and idle reset.
- `check-character-firestore.mjs`: real local emulator, old saves/writes,
  all 12 outfit/hairstyle combinations, invalid and unauthorized rejection.
- `check-character-browser.mjs`: 128 NPC pose/state checks, exact rendered pixels,
  shared textures, 120 appearance changes, bounded cache across map changes and
  local gallery; desktop, mobile DPR3 and Canvas renderer.
- `check-player-browser.mjs`: movement, keyboard/mobile hold, facing, same-row
  player/NPC soles, collision, depth, camera, doors/stairs/map transitions,
  interactions, fishing and responsive layout in those three modes.
- TypeScript, production build and existing world/NPC/control/fishing checks.

The Firestore test uses the existing test runtime through `FIREBASE_TEST_RUNTIME`
and a local emulator at 127.0.0.1:8188 for `demo-fiskespillet`. No production
accounts or data are used by these tests.
