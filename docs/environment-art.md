# Environment art — native 32 px

The environment now uses one world pixel per authored pixel, replacing the
previous 16 px outdoor drawings enlarged by 2. Logical tiles remain 32 × 32.
The existing player and NPC assets, sizes and animation frames are unchanged.

## Art direction

- Warm timber, parchment and terracotta beside muted olive foliage and blue water.
- Shared material ramps and an upper-left light source, defined in
  `src/game/environmentPixels.ts`.
- Integer rectangles and small pixel clusters only: no gradients, antialiasing
  or external generated artwork. The existing Phaser nearest-neighbour settings
  remain in use; UI and text rendering are untouched.
- Sparse grass tufts and gravel, layered foliage, bark, roof seams, window
  reflections, board grain, metal fittings, cloth folds and readable silhouettes.
- Coordinate-based variations are stable across map changes and sessions.

## Coverage and source

`src/game/outdoorTiles.ts`: grass, paths, water, shorelines (including diagonal
corners), trees, roofs, facades, windows, doors, pier boards, soil, signs, fences,
rocks, flowers, reeds, benches, barrels, lamps, chimney and shop sign.

`src/game/indoorTiles.ts`: connected floor boards, walls, windows, doors, stairs,
rugs, cabinets, kitchen counters, stove, shop register, tables, sofa, bed,
wardrobe, shelves, fireplace and chest. Neighbour checks join rugs, tables,
beds and counters without changing map data.

Artwork remains code-native, as in the existing renderer. Run
`node tools/export-tiles.mjs` to export the 36-design catalogue to
`docs/art/fiskespillet-tiles.svg`. This uses the same drawing functions as the
game, including full tree crowns and all indoor objects.

## Ground, depth and collision

Ground and building planes use the existing terrain layer. Trees, signs,
fences, rocks, furniture, benches, barrels and lamps have separate graphics
objects. Their depth is `tileY * TILE_SIZE + 16`, the same tile-centre Y that
the player and NPC containers use. The corresponding visible character foot
line remains at tile-local Y=30. Object bases stay inside the existing tile;
tree crowns reach upward to local Y=-48 and extend horizontally to [-10, 42].
This is a visual envelope, **not** a new collision footprint.

`WorldScene.drawMap()` owns and destroys the environment object group whenever
a map changes. It does not change movement, collision, facing, fishing,
interactions, entrances, camera following, mobile controls or map coordinates.
Buildings keep their previous background-layer behaviour.

## Preview and validation

- `tools/art-preview.html`: full overview and playable view of all five maps.
- `tools/check-environment.mjs`: all 4,224 tiles, 675 raised objects and 42
  decorations; native integer geometry, ground bounds, larger visual envelopes,
  deterministic artwork and no map mutations.
- `tools/check-environment-browser.mjs`: desktop, high-DPI mobile and Phaser
  Canvas fallback; all maps, repeated map changes and cleanup, camera following,
  pixel filtering, front/behind depth and portrait/landscape overflow checks.
  `PREVIEW_URL` optionally selects another local server. Screenshots and results
  are written to `output/environment-review/`.
- Existing world, NPC, fishing, controls and player browser checks passed.
- Typecheck and Vite production build passed against the published baseline
  with the environment changes applied. The build retains its existing bundle
  size warning. There is no configured lint script.

The workspace already had an unrelated uncommitted `fisherSprite.ts` change
without the `fisherPixels` export expected by `FisherPortrait.tsx`. It is
preserved. Validation and the review server use an isolated copy containing
the published version of that file, so this pre-existing portrait issue is not
included in the environment changes.
