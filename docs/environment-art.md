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
`node tools/export-tiles.mjs` to export the environment catalogue and all 16 fence connection variants to
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
- `tools/check-environment.mjs`: all 4,224 tiles, 678 raised objects and 42
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

## Connected fence revision

`src/game/fenceArt.ts` chooses north/east/south/west arms from adjacent fence
tiles. Horizontal pickets have a uniform 16 px spacing, including tile seams.
Boundary half-pickets are clipped to their own tile and meet without duplicated
shadows. Vertical runs use one 5 px edge-on row with visible pointed board tops.
Four matching corners and T/cross connections share a single junction post;
rails extend only along connected arms.

Bryggehavn uses south/east at (3,3) and north/east at (3,13). The latter replaces
one grass tile to join the previously disconnected lower run. The entrance gap
and existing interaction/transition positions are retained. Fence collision
still comes from the existing blocking `fence` tile, including the added corner.

`node tools/check-fences.mjs` checks all 16 masks, cross-tile spacing, the narrow
vertical envelope and board tips, rail continuity, both installed corners and
the house entrance. The isolated typecheck/build, environment tests and browser
checks for desktop, high-DPI mobile and Canvas fallback pass.

## Larger doors and joined windows

`src/game/buildingOpenings.ts` owns the shared opening artwork. `DOOR_STANDARD`
defines a 30 px wide, 64 px high frame, close to the player's approximately
59 px visible height. Its threshold remains at tile-local Y=30. The frame
extends upward to Y=-34; the door's logical tile and transition stay unchanged.
Outdoor doors have an upper glazed panel. Interior exits use the separate
`INDOOR_DOOR_STANDARD`: a 30×30 px timber panel plus its 2 px threshold, fitting
inside one 32×32 tile.

`WorldScene.drawMap()` and the art overview call `drawBuildingDoors()` after
all ground tiles have been painted. Exterior doors remain background building
artwork, so adjacent cells cannot cover their upper half. Interior exits are
separate foreground objects; see the interior revision below. Collision and
camera logic are unaffected.

Adjacent `window` cells form a rectangular block. `windowRegion()` finds the
block and `drawWindow()` clips one complete frame, glass, mullions and sill
into the individual cells. Internal tile boundaries share mullions instead
of repeating outer borders. Add a rectangular block of existing `window`
tiles in map data to create larger windows; leave a facade cell between
separate windows. Nonrectangular blocks fail explicitly rather than producing
ambiguous frames.

- Bryggehavn home: two 2×2 windows, four tiles each.
- Bryggehavn shop: two 3×2 windows, six tiles each. The decorative shop sign
  moves above the door to leave the glazing clear; its interaction is unchanged.
- Interior walls: two adjoining 2×1 windows at home and upstairs, and 3×1
  windows in the shop. The existing one-tile wall depth and floor remain intact.

All enlarged windows replace already-blocking facade/wall cells. Comparison
against published HEAD confirms identical walkability for every cell on all
five maps, plus identical entrance destinations, signs, NPCs and fishing zones.

`node tools/check-building-openings.mjs` checks seam pixels and tile order for
1×1, 2×1, 3×1, 2×2 and 3×2 blocks, installed window sizes, all four doors and
the original threshold/transition positions. Typecheck, production build,
environment/world/NPC/controls/fishing checks and the desktop, mobile and Canvas
browser checks pass in the isolated published-baseline copy described above.
`node tools/export-tiles.mjs` also exports `docs/art/building-openings.svg`,
showing complete four- and six-tile windows beside the taller doors.


## Interior wall, door and staircase revision

`src/game/indoorArchitecture.ts` draws wall boards with a continuous six-world-
pixel rhythm. Only the lowest block in a connected vertical wall/window run
has a bottom skirting board, including runs ending at the map boundary. There
is no trim on the sides or top, and connected blocks have no repeated baseboards.

Interior doors belong to the existing environment object group. Their depth
is the front boundary of their tile, `(row + 1) * TILE_SIZE`; ordinary objects
retain the existing tile-centre Y depth. This keeps the door panel in front of
the player throughout the exit tween, including its last frames. The home and
shop exit positions and exterior destinations stay unchanged. Exterior doors
retain their 64 px height and background rendering.

`HOME_STAIRS` in `src/game/world.ts` describes the upper-right corner staircase
on both home floors: column 22, free floor at row 1, three connected stair tiles
at rows 2–4, and free floor at row 5. Rails and an eight-pixel tread rhythm join
across all three tiles. The former single stair tiles at (19,4) and (19,11)
become ordinary floor. Going up triggers at the first-floor upper landing and
arrives at the second-floor upper landing; going down triggers at the second-
floor lower landing and arrives at the first-floor lower landing. Arrival
landings never immediately trigger the reverse transition. Movement code and
NPC routes are unchanged; every map cell retains its previous walkability.

`tools/check-indoor-architecture.mjs` checks actual wall seam pixels, bottom-only
trim on the lowest block and at map boundaries, bounded one-tile doors, foreground depth, the five-cell corridor and
safe landing destinations. `tools/check-indoor-browser.mjs` freezes the normal
exit tween to verify actual display order, then resumes it and traverses the
complete staircase up and down. Both tests pass, as do typecheck, build, map
and existing environment/player checks. Browser coverage includes desktop,
DPR-3 mobile and Phaser Canvas. Review images go to `output/indoor-review/`.


Vertical kitchen worktops join above/below as well as left/right. Only the
lowest tile of each run draws a cabinet front, handle, front lip and floor
shadow. Upper tiles show a full-depth worktop and adjoining cells meet at
Y=32/Y=0. This applies to the existing counter/stove/shop-counter family,
retaining stove-top and register details. The three-cell kitchen run at
(2,5)–(2,7) is covered by the indoor architecture raster check. Map data,
collision and depth are unchanged.
