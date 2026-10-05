# Player walk: exact pose plan (revision 3)

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
  the published `fisherSprite.ts`. The working copy has a pre-existing unrelated
  missing `fisherPixels` export used by `FisherPortrait.tsx`; it was preserved.
  Build retains its existing large-chunk warning. No lint script is configured.
