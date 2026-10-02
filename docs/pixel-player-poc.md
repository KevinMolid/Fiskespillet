# Pixel player proof of concept

Historical idle implementation notes. The approved idle PNGs remain unchanged;
player and all NPCs now have walking frames. See
[the current pixel character system](pixel-character-system.md).

The approved PNGs replace only the high-resolution player. Kevin retains his
existing 432 × 640 assets, scale, filtering and behavior.

## Preparation

`tools/prepare-pixel-player-assets.py` maps front/down, right profile/right,
back/up and left profile/left. Sources are 1122 × 1402. Fractional alpha and
nonuniform colored blocks prevent establishing an exact native integer reduction.
No resizing is performed. Retained RGB is copied exactly. Alpha below 128 becomes
zero, remaining alpha becomes 255, and transparent RGB is zero. No interpolation,
generation or repainting. The original references are not imported at runtime.

Every production canvas is 768 × 1184. Boot center (measured in the lower 80 source
rows) is translated to X=384 and the exclusive boot bottom to Y=1172. Preparation
asserts all retained pixels survive without clipping. Source/production bounds
are recorded in `pixel-player-measurements.json`.

## Rendering and positioning

`src/game/pixel-player-standard.json` configures the shared directional scale:
0.05 in both axes on desktop/mobile. Display canvas: 38.4 × 59.2 world pixels.
Actual silhouettes are 55.7–57.4 world pixels tall; small source differences are
preserved without independent directional stretching.

`characters.ts` registers directional images and formats. `characterRendering.ts`
uses NEAREST for player, LINEAR for existing Kevin. Phaser retains pixelArt=true,
antialias=false. Canvas fallback respects texture scale mode. CSS pixelated applies
only to the world canvas; UI and text retain their existing styles. High-DPI backing
resolution and camera zoom/follow are unchanged. Fractional presentation can yield
unequal physical pixel widths, but no smoothing is used.

Image origin is (384/768, 1172/1184). World containers remain at tile center
(tile × 32 + 16); the existing shared ground conversion of +14 world Y is unchanged.
Actual soles therefore match the existing character ground line in every direction.
Depth remains world Y. Collision/occupancy, movement, facing, fishing adjacency,
interactions and transitions are unchanged. Idle facing persists after stopping;
movement uses the same idle frame. No animation is added.

Historical Character Standard v1 measurements describe the former player and are
not the current pixel-player specification.
