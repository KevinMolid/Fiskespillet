# Forward casting pose and world sequence

Production assets:

- `src/assets/characters/player/down-cast-forward.png`
- `src/assets/characters/player/right-cast-forward.png`
- `src/assets/characters/player/up-cast-forward.png`
- `src/assets/characters/player/left-cast-forward.png`

The built-in imagegen tool generated a transparent directional sheet using the
four existing cast-aim sprites as references. The approved aim/idle/walk assets
are unchanged. Generated source: `exec-979cec0a-1708-4dcf-aac5-8a69082b1958.png`
in this chat's Codex generated-images folder (1254 × 1254).

Preparation: `tools/prepare-player-cast-aim.py SOURCE forward`. One shared 2.18
nearest-neighbor normalization, hard alpha matching player idle, 2048 × 1536
canvas and foot anchor (1024, 1524). The wider canvas contains the forward rod.
Render scale remains 0.05. Foot center uses the two biggest sole spans so the
down-facing rod tip cannot affect horizontal centering. The upper sheet seam
is measured at x=610 to retain the right-facing rear boot. All opaque artwork
fits the production canvases. No original sheet is included in the bundle.

`player-cast-forward-standard.json` records rod-tip attachment pixels for each
direction. `PLAYER_CHARACTER.poses.castForward` maps these alongside its format
and directional PNGs. Attachment pixels are transformed through that format;
no world-position offset is applied to the player.

Sequence:

1. Length meter: existing backswing/aim pose.
2. Commit length: hide the meter and show forward pose immediately.
3. `WorldScene.playCast`: draw line from the rod tip and animate the lure in an
   arc toward the exact tile selected by `castTargets`. Flight duration is
   700 + 140 × number of tiles milliseconds (840–1400 ms).
4. At landing: destroy flight graphics and show the existing 900 ms splash on
   that actual tile. Keep the forward pose until the splash completes.
5. Resolve the sequence promise, restore idle, and start the six-second depth
   meter using a fresh timestamp. Time spent casting cannot cause a bottom snag.

Four-tile example: 1260 ms flight + 900 ms splash = 2160 ms before depth starts.
No separate animation window. Existing fishing controls and input lock prevent
extra casts/movement during the sequence. Scene shutdown, map changes and fishing
finish cancel tweens, destroy graphics and resolve interrupted sequences false.
Delayed completion cannot reopen a depth meter on an unmounted dialog.

On short landscape screens the camera temporarily frames both character and
landing point, zooming out only when necessary. Normal follow/zoom returns when
fishing finishes. World position, collision and ground-based depth are unchanged.

Browser checks cover phase order, both poses in all four directions, actual sole
anchors, line/splash coordinates, locked inputs, cancelled sequences, sinking
timer start, bait consumption, desktop, portrait/landscape mobile and Canvas.

## Generation prompt

Use case: identity-preserve. Asset type: transparent pixel-art game sprite sheet, static forward casting follow-through, four directions. Input images are the authoritative existing player CAST-READY poses: down/front, right profile, up/back, left profile respectively. Create ONE equal-cell 2x2 sheet with top-left DOWN/front, top-right RIGHT/profile, bottom-left UP/back, bottom-right LEFT/profile. No labels or dividers; transparent RGBA background. Change ONLY shoulders, arms and rod orientation to the instant AFTER swinging the fishing rod forward. The rod now points FORWARD along the character's facing, clearly opposite the backswing in references. Both hands grip the same cork handle, arms extended forward from the shoulders, one hand above the reel, other on the handle butt. Plausible elbows, shoulders and wrists; exactly two arms and hands. RIGHT: look right, arms reach to right in front of chest, rod shaft extends FAR to RIGHT and slightly upwards, tip clearly on the right. LEFT: look left, arms reach left, rod extends FAR LEFT and slightly upwards, tip clearly left. DOWN/front: face toward viewer, arms forward at chest/waist height, foreshortened rod goes diagonally forward and down-right toward viewer; tip below the hands, kept to side of legs, not pointing behind/over shoulder. UP/back: show back, arms in front of body, foreshortened rod points forward and up-right away from viewer, tip above hands/head; don't use sideways/backwards backswing. Keep the existing exact straw hat/navy band, brown hair, blue shirt, tan fishing vest, brown diagonal satchel, gray-green cargo pants, brown boots, face, crisp square pixel texture, body proportions, planted stance and boot shapes. DO NOT redesign the player or invent a new outfit. All four have identical body scale, hat-to-foot height and feet baseline inside their equal cells. Keep both boots stationary like the inputs. This is a follow-through freeze-frame, not walking or retrieving. Straight/slightly flexed dark fishing rod with cork grip and one reel; no fish and no second rod. No dangling drawn fishing line: the game will animate the line separately from rod tip. Whole character AND entire forward rod visible, ample transparent margin, no overlap between cells, no clipping. Match coarse sharp pixel art with flat pixel shading; no smooth 3D or painterly rendering, no scenery, no ground/shadows, no blur, no text. Preserve references as closely as possible. Large square sheet.
