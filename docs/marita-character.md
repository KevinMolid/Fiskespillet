# Marita — pixel character design

Adult, slender athletic woman with long chestnut-brown hair, subtly warmer/lightly
tanned skin, white cropped training tank with bare midriff, charcoal leggings and
white sneakers. Friendly, understated face in the existing NPC pixel-art family.

Created with built-in imagegen using Oda's four idle sprites as style references.
Source: `exec-9f888bfb-e4ed-420f-b198-1d32ec88e0ac.png` (1086 × 1448).
The source is preserved at `output/character-review/marita-turnaround.png` for
review, outside the production bundle.

Production assets: `src/assets/characters/marita/{down,right,up,left}.png`.
`tools/prepare-marita-assets.py SOURCE` crops the equal 543 × 724 cells in
front/right/back/left order, applies the existing hard RGBA alpha convention and
one shared nearest-neighbor normalization to 56-pixel body height. Shoe position
controls center X and the soles align at Y=60. All views use the existing NPC
48 × 64 canvas, ground anchor (24,60), render scale 1 and nearest filtering.
No per-direction scale or world-position compensation is used.

`MARITA_CHARACTER` in `src/game/characters.ts` exposes the idle design through
the existing directional sprite format. Character preview includes her first and
supports idle-only designs alongside animated characters.

Marita is registered in `NPC_CHARACTERS` and the existing `NPCS` data. She stands
at (38,20) in Skogstjernet (area 2), directly south of the water at (38,19).
She uses the existing stationary NPC look-around, conversation, tile occupancy,
foot anchoring and ground-Y depth rules. Her two dialogue lines describe a break
from training by the lake. No walking route or walking frames are required.

## Final prompt — built-in imagegen

Use case: stylized-concept.
Asset type: production pixel-art NPC turnaround for the existing fishing game.
Reference images: four existing Oda sprites in front/right/back/left order; references define the game's sharp native pixel scale, adult proportions, top-down slight oblique view, silhouette shading, and mature readable character family. Create a NEW adult woman named Marita using that SAME style and body scale.
Design: attractive slender adult woman, long chestnut brown hair flowing down her back, friendly understated pretty face, subtle warm light-medium tan skin only slightly darker than the reference characters. Slim athletic build with normal adult proportions. White cropped athletic tank top with narrow shoulder straps and a small band of bare midriff at the waist. Dark charcoal fitted athletic leggings, white athletic sneakers with subtle gray soles. Arms naturally resting at sides, relaxed upright idle stance, both feet on ground. No extra accessories or tattoos. No exaggerated curves or baby/chibi proportions.
Create ONE 2x2 directional turnaround sheet: top-left front looking DOWN; top-right profile looking RIGHT; bottom-left BACK looking UP; bottom-right profile looking LEFT. Four views of exactly the same outfit, hair, face and body. Preserve true front/profile/back orientation, shoes and hair consistent. All four share identical actual body height and feet baseline in equal cells. Whole long hair, shoulders, hands and shoes visible with ample transparent space between cells and around them.
Style: crisp low-resolution pixel art designed on a 48x64 pixel canvas per character, native body height about 56 pixels, like the supplied sprites. Display the pixels enlarged as clean solid square blocks for the sheet, with a restricted coherent palette and readable hand-placed shading. Dark pixel outlines, no smooth curves, no tiny subpixel details, no gradients, no smoothing, no 3D or high-resolution illustration, no anatomy redesign across directions. Mature recognizable face rather than giant eyes.
Genuinely transparent RGBA background, no floor/shadows, no scenery, no labels/text/watermark, no grid lines. No walking poses; this sheet is the four idle views.
