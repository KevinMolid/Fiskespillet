# Player casting-ready pose

The four `src/assets/characters/player/*-cast-aim.png` assets show the existing
player holding a rod behind the shoulder, ready to cast. They are static poses.
Idle and walk assets are unchanged.

Production files:

- `src/assets/characters/player/down-cast-aim.png`
- `src/assets/characters/player/right-cast-aim.png`
- `src/assets/characters/player/up-cast-aim.png`
- `src/assets/characters/player/left-cast-aim.png`

The pose is enabled after the rod/bait/zone checks succeed, when the length meter
opens. Committing the cast switches to the forward pose during line flight and
the world splash; idle returns when the depth meter opens. See
`player-cast-sequence.md` for the forward assets and phase timing.
Cancelling or finishing fishing also restores idle. The player's
world position, collision, facing, depth and movement remain unchanged.

Directional mapping and preloading use the existing character registry and
renderer. `PLAYER_CHARACTER.poses.castAim` maps down/right/up/left to the matching
PNG; `WorldScene.setCastAim` selects it. No separate fishing character exists.

All four PNGs use a 1536 × 1536 transparent canvas and ground anchor (768, 1524).
The larger canvas accommodates the rod; the body uses the existing player's
0.05 render scale and nearest-neighbor filtering. Both formats use the existing
14-world-pixel tile-center-to-feet conversion. Changing textures also changes
the origin to the selected format, keeping the soles on exactly the same line.

The built-in imagegen tool produced one 1223 × 1286 transparent sheet.
`tools/prepare-player-cast-aim.py` splits its four equal cells, applies the same
2.25 nearest-neighbor normalization to every cell (~510 source pixels from hat
to sole versus ~1148 in idle), and aligns the measured boot base rather than the
whole rod bounding box. Hard alpha uses the same threshold as player idle.
RGB colors are not repainted. No source sheet is shipped in the runtime bundle.

Source: `exec-f4fc439c-1a2d-446f-8ffe-9310fff76b16.png` in this chat's
Codex generated-images folder. The input references were player down, right,
up, and left, in that order.

## Generation prompt

Use case: identity-preserve. Asset type: transparent pixel-art game sprite sheet, a static casting-ready pose, four directions. Use the four input PNG sprites as the authoritative edit/reference targets: image1 front/down, image2 right profile, image3 back/up, image4 left profile. Produce ONE clean 2x2 sprite sheet, top-left DOWN (front), top-right RIGHT, bottom-left UP (back), bottom-right LEFT. No lettering or dividers. Each quadrant has one whole full-body character on genuinely transparent RGBA background, generous transparent margin including around the complete rod. All four characters must have IDENTICAL body scale and feet baseline within their quadrants. Keep the existing character's exact straw hat with navy band, brown hair, blue shirt, tan pocket vest, brown diagonal satchel, gray-green cargo trousers, brown boots, face, proportions and coarse crisp square pixel texture. This is the same game character, NOT a redesign, NOT smooth illustration, NOT 3D. Preserve the head, hat, legs and boots as closely as possible; feet planted in the idle stance. Change ONLY shoulders/arms to a readable cast-ready backswing: both hands gripping a cork fishing-rod handle near and behind the rear shoulder, elbows bent, torso subtly rotated, holding a simple dark fishing rod drawn BACK behind the character ready to cast FORWARD along their facing. The rod TIP must lean behind the direction of facing, not point forward like active fishing. For RIGHT-facing the rod tip goes up-left behind him; for LEFT-facing up-right. For FRONT/down-facing, raised hands and rod are drawn behind/right of head above shoulder, rod recedes behind him; for BACK/up-facing hands/rod are over shoulder and rod recedes toward viewer, consistent same grip and cast direction. One rod, two attached anatomically credible hands, reel at the grip, no extra arms, no bent/disconnected joints, no dangling detached pieces. Fishing rod and thin line sharp pixel art too. A clear freeze-frame immediately before forward cast, NOT walking, NOT retrieving, NOT a caught fish. Feet remain anchored and body height consistent with references. Entire hat, boots and fishing rod visible with no clipping. Large output sheet for clean production cropping; equal-sized cells, isolated silhouettes with no overlap. Transparent background, no shadows, no floor, no scenery, no text, no blur, no antialiasing.

## Validation

`tools/check-fishing-browser.mjs` checks all four pose textures, actual PNG soles,
shared scale, nearest filtering, unchanged world coordinates, and restoration
after casting, cancellation and failure on desktop, mobile and Canvas rendering.
