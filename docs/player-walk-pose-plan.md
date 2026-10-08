# Player walk: exact pose plan (revision 11, passing C in every direction)

## Left contacts and directional passing frames

Keep the published right A/B/C, all idle artwork, and front/back A/B byte exact.
Only rebuild left A/B and add left/down/up C. All player directions now use
A–C–B–C, one texture per successful tile, with the existing movement timings.

- Left A: anatomical left (far) foot advances left; right (near) foot trails.
  Near right arm advances left, far left arm trails. B reverses both phases.
- Reuse the accepted right contact geometry, continuous cargo trouser panel,
  chunky horizontal profile boots and stepped dark outlines in a reflected
  working coordinate system. Use actual left idle pixels for head, shirt,
  sleeves and stationary bag; never replace left identity with mirrored right art.
  Near right leg retains the palette; far left leg uses 62% material brightness.
  Near baseline 1172, far baseline 1152. Toes point left in both contacts.
- Left C: near right support leg centered below its hip; far left swing leg
  bends and lifts to baseline 1112. Both hands return close to the hips.
- Down C: anatomical left support sole remains at 1172; right swing foot lifts
  30 source pixels (1.5 world pixels). Both shoulder/elbow/hand chains return
  to their neutral positions between the approved opposing contact poses.
- Up C: anatomical right support sole remains at 1172; left swing foot lifts
  30 source pixels. Same neutral arm joints, with actual back-facing artwork.
- Shared 768 × 1184 canvas, anchor (384,1172), scale .05 and nearest filtering.
  No movement, collision, NPC gait, world or fishing pose changes.
- Reproduce with `python tools/player_walk_rig.py --direction left`, then
  `--direction down --step 3` and `--direction up --step 3`.
- Registry `characters.ts` declares A/B/C and passing frame 3 for all four
  player directions. The existing renderer and per-tile phase selection apply.

Validation: sprite anatomy/112-frame format audit, animation timing test,
typecheck and production build passed. Real desktop, mobile DPR3 and Canvas
tests passed for A/C/B/C over four successive tiles in every direction, exact
ground registration, nearest filtering, retained idle facing and unchanged NPC
cadence. Git asset comparison confirms only left A/B change among previously
tracked character images; down/up C and left C are the three new assets.

The older right-only scope/timing notes below record previous revisions;
this section defines the current directional extension.

## Cadence update — one image per tile

After reviewing the published C animation, the user requested one image per
tile on 2026-10-08. This supersedes revision 10's within-tile timing below.

- Advance the animation phase only when a successful tile movement starts.
  Right uses A/C/B/C on four consecutive tiles. Hold each chosen texture through
  its whole tween and settle interval; stopping returns to the facing idle.
- Keep existing movement duration, keyboard/touch repeat, running multiplier,
  collision and NPC cadence unchanged. Other player directions retain A/B per tile.
- The right-character preview uses the existing 145 ms keyboard repeat for each
  image, making its complete loop 580 ms. Other preview characters remain at
  their existing 220 ms per image. Pause and direction switching still work.
- Validate real render samples for all four consecutive tiles on desktop,
  mobile DPR3 and Canvas: each tile must contain exactly its one expected texture.
- No character graphics or sprite registrations change in this cadence update.

## Right C between A and B

Add `player/right-walk-3.png` as the shared passing frame requested by the user.
Approved A and B are byte-identical to the published revision 9.

- C is registered as A -> B: near left leg supports the pelvis, far right leg
  bends forward and lifts while passing under the body. The near hand is between
  A's rearward hand and B's forward hand. Head, bag, palette and outline remain
  from the same immutable right idle/front trouser/boot sources.
- Canvas 768 × 1184, anchor (384,1172), scale .05, nearest filtering. Support boot
  baseline is 1172; far swing boot is 1112 (two world pixels above the far plane).
- Left hip/ankle (17,39.3)/(17,51.8); right hip/ankle before the shared far-depth
  projection (17.5,40.3)/(18.6,51.8). Preserve 7.5/5 thigh/shin lengths when
  solving the lifted right ankle. Record final joints in the measurements JSON.
- Left shoulder/elbow/wrist (14.45,28.2)/(14.05,35.2)/(15.2,40.45);
  right shoulder/elbow/wrist (21.3,28.2)/(20.9,35.2)/(20.8,40.6).
- `characters.ts` maps right A/B/C to walk textures 1/2/3 and declares right
  `walkPassingFrame: 3`. The renderer loads and applies nearest filtering to
  every registered frame rather than assuming exactly two textures.
- Each right tile tween retains its existing duration: contact A or B during
  the first half, C during the second. Consecutive footfalls play A-C-B-C.
  Running uses the same fraction of its existing shorter tween. Other directions
  and NPC cadence are unchanged. Idle still retains facing after the settle time.
- The local character gallery shows Idle/A/B/C and the A-C-B-C loop. Its loop
  remains 440 ms, using 110 ms per right phase instead of doubling its duration.

Reproduce C only with `python tools/player_walk_rig.py --direction right --step 3`.
Sprite/anatomy and animation timing checks, typecheck/build, and the real desktop,
mobile DPR3 and Canvas scene checks passed, including C in single and held steps.
The user approved publication of this revision on 2026-10-08 after local review.


## Visible leading foot in both contacts

Revision 9 changes only the two right walk frames' lower bodies. The upper
regions above source Y=800 and all visible hand pixels remain exact revision-8
pixels. The approved chunky trousers/boots, character proportions and artwork
palette are retained.

- Keep anatomical left as the near leg in both images, and right as the far leg.
  A advances the near left foot; B advances the far right foot. Arm phase stays
  opposed. Never exchange depth identity merely because a foot advances.
- Shade the far trouser and boot materials to 62% of the reference value rather
  than 86%. The near leg keeps its original colours. This makes the advancing
  bright near foot in A and dark far foot in B readable at runtime size.
- Draw the near thigh over the repaired pelvis patch, with an uninterrupted
  dark contour from hip to cuff. Previously the patch hid the thigh's ownership.
- Translate the entire far leg chain up 20 source pixels (one world pixel),
  preserving all segment lengths and knee geometry. Far contact baseline is
  Y=1152 in both images; near contact remains Y=1172. This represents perspective
  inside the sprite; world anchor, rendering offsets and collision do not change.
- Lift the trailing heel by up to 1.2 world pixels while its toe contacts its
  assigned plane. The leading boot's sole stays flat. Both toes still point right.
- Verify the actual boot colour contrast in production pixels and after nearest
  sampling to the 38 × 59 world-size review, as well as both anatomical phases.

Rebuild with `python tools/player_walk_rig.py --direction right`.
Only `right-walk-1.png` and `right-walk-2.png` change; all idle/other directions,
NPCs, renderer, movement and gameplay remain unchanged. The historical registrations
below are superseded by the far-chain perspective translation described here.

## Right/B matches approved Right/A

Revision 8 applies the approved revision-7 trouser/boot panel and outline to
Right/B. Only `right-walk-2.png` is rebuilt; the approved Right/A, all idles,
other directions and NPC assets remain byte-identical.

- Both contacts share the 210-pixel front-reference trouser panel, 198 × 164
  side boots, dark stepped contours, fixed canvas and ground Y=1172.
- B reverses the anatomical phase: near left leg back, far right leg forward;
  near left arm forward, far right arm back. The pelvis rotates through the
  opposing contact instead of mirroring the character, bag or artwork.
- B left hip (15.6,40.3), ankle (10.8,51.8); right hip (18,40.3),
  ankle (22.4,51.8). Both use the same 7.5/5 world-pixel limb lengths as A.
- B left shoulder/elbow/wrist (14.9,28.2)/(17.4,34.8)/(21.6,38.2);
  right shoulder/elbow/wrist (21.1,28.2)/(17.8,34.8)/(17.7,40.1).
- Boot far-side shading is independent of trailing-foot heel lift. In B the
  near foot trails and the far foot leads; toe direction remains horizontal.
- Restore the shirt socket exposed behind B's advancing sleeve, retaining
  full shoulder/collar coverage and correct sleeve movement.

Reproduce B only with `python tools/player_walk_rig.py --direction right --step 2`.
The preview compares front/A/B and includes the two-frame right walk loop.


## Fuller trousers and reference-style outline

Revision 7 responds to the remaining narrow trousers/boots and missing outline.
Only Right/A's lower-body artwork changes; all approved RGBA pixels above Y=800
and the hands are identical to revision 6. Hip, knee, ankle and ground coordinates
remain unchanged.

- Widen the source trouser texture panel from 180 to 210 source pixels and expand
  the continuous leg silhouette about its registered joints. Preserve the cargo
  fabric clusters from the front reference.
- Add a dark 15-source-pixel inward contour to the trousers and boots. The edges
  use hard ten-pixel steps, matching the front artwork's visible pixel contours;
  no antialiasing or smooth diagonal outer edges.
- Widen the side boot template from 178 to 198 source pixels, keeping its height
  at 164. Widen the shaft and raise the toe volume without lengthening the leg or
  moving its ground contact. Retain the source leather texture, laces and sole.
- Pad the boot mask before outlining so the lower sole has the same full dark
  rim as the toe, shaft and heel, even at the template's bottom canvas edge.

The v7 comparison uses the immutable front idle and Right/A at the same scale.
Other frames and all gameplay/rendering configuration remain unchanged.

## Front-view style and proportion correction

The user approved the revision-5 upper body and arms. Revision 6 changes only
the lower body of Right/A, preserving all RGBA pixels above source Y=800 and
both visible hands. The approved upper-region SHA-256 is
`4699642e4c80bd2fa2c56466d7ce50aabb9eedbb08d4ccea18cf71167a4f7c9d`.

- Use actual cargo-trouser pixel clusters from the front `down.png` reference
  instead of horizontal nearest-donor stripes from the profile source. Transfer
  a complete panel with nearest sampling, then apply the same approved joints.
- Do not reclassify cloth colours after far-leg shading: rounding borderline
  colours punched transparent speckles into otherwise complete fabric.
- Profile boots use the front-view leather colours and texture. Their template
  changes from 200 × 136 to 178 × 164 source px: shorter toe projection, wider
  shaft, rounded chunky toe and thicker sole, matching the front character's
  compact boots. The upper cuff overlaps the trousers by 28 source px.
- Keep toe direction, rear-leg extension, arm phase and foot ground line.
  No canvas, rendering-scale, movement or collision changes.
- The actual boot silhouette aspect ratio must stay between 1 and 1.25;
  cuff-to-toe projection still has to point right. This prevents retaining the
  previous long/narrow proportions merely to satisfy a direction test.

Reproduce with `python tools/player_walk_rig.py --direction right --step 1`.
The preview compares the unchanged front idle and corrected Right/A at the same
canvas size and baseline. Other directional frames remain unchanged.

## Right/A correction — 2026-10-08

Only `player/right-walk-1.png` is corrected in this revision. The idle, other
seven walk frames, fishing poses, NPCs, canvas, anchor and renderer are unchanged.
The older Right/A coordinates below are superseded by these registrations:

- Near anatomical left leg goes forward: hip (18,40.3), ankle (22.4,51.8).
- Far right leg extends behind the hip along the user's sketched line:
  hip (15.6,40.3), ankle (10.8,51.8), with less than one world pixel of knee
  deviation from the hip-to-ankle axis. Both contacts meet source ground Y=1172.
- Near left arm swings back: shoulder (14,28.2), elbow (10.7,34.8), wrist (10.6,40.1).
- Far right arm swings forward with a bent elbow: shoulder (21.5,28.2),
  elbow (24,34.8), wrist (28.2,38.2). Its hand emerges beyond the bag.
- Reconstruct the exposed vest side, hidden trousers and pelvis from the same
  immutable idle PNG. Sample restored patches in hard blocks to avoid thin
  horizontal streaks. No generated artwork or antialiasing.
- Close the actual shoulder socket, shirt side, pelvis-to-bag seam and both
  ankle/cuff junctions. The sleeve mask excludes pale vest trim: this previously
  rotated with the shoulder and looked like a white cut-out.
- Use a continuous trouser panel through hip/knee/ankle instead of rotated
  horizontal slices that create diagonal wedges and missing cloth at the joints.
  Add cuff overlap so extracting the boot cannot leave a transparent ankle gap.
- Draw genuine side-profile boots with the original leather palette/texture,
  laces and cuff. Heel is left, toe is right; no frontal shoe panel or diagonal
  outward orientation. Rear heel lifts slightly while its toe remains on the
  same ground line. Both boot angles are zero; depth comes from far-limb shading.
- Composite far arm, far leg, near leg, pelvis, torso, bag, near arm. Keep all
  pixels above source Y=520 identical to the original idle.

Reproduce only this pose with `python tools/player_walk_rig.py --direction right --step 1`.
Actual joint registrations are recorded in `character-rig-measurements.json`.
The pixel audit checks the marked shoulder/side/hip/ankle locations, trailing
leg line, separation of the feet, actual cuff-to-toe pixel projection and the
visible forward far hand. Inspect transparency on both light and dark backgrounds.

### Reference study

Studied the actual directional sheet in the [LPC style guide](https://lpc.opengameart.org/static/LPC-Style-Guide/build/assets.html),
the [RUNED walk cycle by Raymond Schlitter](https://www.slynyrd.com/blog/2015/9/29/runed-formerly-remnant-devlog-3)
and [Pedro Medeiros's Simple Walk Cycle](https://www.patreon.com/posts/simple-walk-14234033).
Applied their readable opposing arm/leg contacts, extended trailing leg,
directional foot silhouettes and complete overlapping clothing. The references
are only for pose analysis; no reference artwork is included in production.

All left/right labels are anatomical. A = left leg + right arm forward;
B = right leg + left arm forward. Eight production poses, using the original
four idle PNGs as immutable sources. No NPC changes or generated artwork.

## Registration and fixed parts

- Canvas 768 × 1184 source px; render scale .05; one world pixel = 20 source px.
- Ground anchor (384,1172) source px = (19.2,58.6) world px.
- Hat, face, hair and neck remain exactly registered. No full-image mirroring,
  global stretching, frame-specific render offsets or world-position changes.
- Keep the accepted down/up leg poses. Their shoe pixels from world Y=46
  downwards must remain identical to revision 2.
- Shirt/vest, strap and bag retain the design. The shoulder caps are moving
  parts. Reconstruct only clothing hidden underneath the arms from this source.

## Every pose

| View / pose | Near leg / arm | Far leg / arm | Shoulder / arm projection |
|---|---|---|---|
| Down A | Viewer-right left leg forward; left arm back | Viewer-left right leg back; right arm forward | Right shoulder .5 px lower/inward; left .5 px higher/outward |
| Down B | Viewer-right left leg back; left arm forward | Viewer-left right leg forward; right arm back | Reverse A's shoulder and elbow movement |
| Up A | Viewer-left left leg forward/away; left arm back | Viewer-right right leg back; right arm forward/away | Right shoulder .5 px higher/inward; left .5 px lower/outward |
| Up B | Viewer-left left leg back; left arm forward/away | Viewer-right right leg forward/away; right arm back | Reverse A's shoulder and elbow movement |
| Right A | Left leg forward; left arm back | Right leg back; right arm forward | Near shoulder goes back; upper arm +14°, forearm +6° |
| Right B | Left leg back; left arm forward | Right leg forward; right arm back | Near shoulder goes forward; upper arm −14°, forearm −22° |
| Left A | Right leg back; right arm forward | Left leg forward; left arm back | Near shoulder goes forward; upper arm +14°, forearm +22° |
| Left B | Right leg forward; right arm back | Left leg back; left arm forward | Near shoulder goes back; upper arm −14°, forearm −6° |

Angles are in screen space (positive clockwise, Y down), measured relative to
the corresponding idle segment. Far arms reverse the near arm's phase.

## Profile legs: explicit joints, not scanline shears

Extract one continuous near trouser/shoe silhouette per profile, including the
entire toe and heel. Use the same silhouette with depth shading for the occluded
leg. Each thigh and shin turns independently around its joint with nearest
sampling. Thigh length 7.5 world px; shin length 5 world px. Solve the knee on
the facing side of the hip-to-ankle line; neither knee bends backwards.

Coordinates below are world-pixel coordinates within the sprite canvas:

| View / pose | Near hip → ankle | Far hip → ankle |
|---|---|---|
| Right A | (17,40) → (21,51.8) | (20,39.5) → (15.8,50.8) |
| Right B | (17,40) → (15.5,51.8) | (20,39.5) → (21,50.8) |
| Left A | (23.5,40) → (25,51.8) | (20.5,39.5) → (18.5,50.8) |
| Left B | (23.5,40) → (19.5,51.8) | (20.5,39.5) → (25,50.8) |

Front boots are flat. Rear boots tilt 6° and register their lowest sole point
to the ground, raising the heel. The ankle is registered to the resulting boot
before solving the knee, keeping the shin connected.
The near boot's lowest sole stays at Y=58.6, the far boot at Y=57.6 for depth.
The boot is a rigid piece; never flatten or slice it to achieve the ground line.
Thigh/shin/boot layers overlap at the joints to avoid transparent cracks.

## Shoulders and arms in all views

- Separate complete sleeve/shoulder cap, upper arm and forearm/hand.
- Source near shoulder/elbow: right (14.4,28)/(11.6,35), left
  (23.6,28.5)/(26.3,35.5). Far joints are behind the torso; the visible near
  limb is the source for the hidden segment, without duplicating idle hands.
- Profiles: shoulder moves .45 px in the arm's swing direction and .25 px
  upward when forward / downward when back. Rotate upper arm by ±14° and
  bend forearm an extra 8° toward the facing direction.
- Front/back: shoulder moves .5 px inward when forward, outward when back,
  and .5 px along the direction's depth projection. Rotate sleeve/upper arm
  ±6°; project the arm's length ±1.5 px in depth, keeping the hand rigid.
- A small shirt socket behind each moving cap maintains the connection to the
  fixed collar. The cap itself must visibly change between A and B.
- Profiles: far arm + far leg → torso → near leg → bag → near arm.
  Front/back: legs → torso → bag → arms. The bag excludes original hand pixels.
- Keep the full bag contour separately. Where an idle hand hid the leather,
  reconstruct only that occluded patch from the same source bag's exposed pixels.
  Treating the right-view hidden arm as a visible source mask would cut out the
  bag instead; its animated far arm must be derived from the near arm.

## Acceptance checks

1. Inspect idle/A/B and the loop for all four views at world size and enlarged.
2. Measure actual shoulder and hand pixels; labels alone are insufficient.
3. Verify knee direction, two whole boots, alternating front foot and consistent
   sole baseline; no trouser stripes, detached limbs or duplicate hands.
4. Check exact idle/head preservation and unchanged down/up boot pixels.
5. Run character asset checks, real scene animations on desktop/mobile/Canvas,
   player gameplay regression checks, typecheck and build. Keep existing cadence,
   movement speed, collision, camera, layering, maps and NPCs unchanged.

## Verified 2026-10-05

- All eight production poses inspected enlarged and in the four-direction loop.
- Actual hand/shoulder pixel checks and forward-knee/whole-boot checks passed.
- All 108 character assets passed transparency, anchor and anatomy validation.
- Accepted down/up lower legs and boots (source Y >= 920) are byte-identical
  in RGBA pixel data to revision 2. All four idle files remain unchanged.
- Real scene animation and continuous keyboard gait passed on desktop, mobile
  DPR 3 and Canvas; gameplay checks passed controls, collision, camera, map/door/
  stair transitions, interaction/fishing direction, NPC dialogue and layout.
- TypeScript, Vite build and gait tests passed in the isolated review copy with
  the published `fisherSprite.ts`. At this checkpoint the working copy had an
  unrelated missing `fisherPixels` export used by `FisherPortrait.tsx`.
  On 2026-10-06 the unused local canvas draft was backed up and the published
  palette implementation restored; typecheck/build now pass in the workspace too.
  Build retains its existing large-chunk warning. No lint script is configured.
