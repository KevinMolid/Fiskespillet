# Tap-controlled retrieval

After choosing depth, retrieval begins immediately with no speed-choice dialog.
Space, E, Enter, the on-screen meter button and the mobile A/action button each
produce one reel pulse. Keyboard auto-repeat and holding a touch button do not
produce extra pulses. The live meter shows speed from stopped to fast.

`tapReel` and `advanceReel` in `src/game/fishing.ts` add momentum per tap, cap it
at 100%, and integrate its decay independently of frame size. Pausing gradually
reduces speed to zero. Faster tapping means higher speed and more distance
retrieved; there is no movement without a pulse or its brief residual momentum.

`WorldScene.setRetrieveProgress` renders a small dark ellipse at the actual hook
position along the cast direction. It begins at the landing tile and approaches
the first water tile next to land. The final center is 0.7 tiles from the player,
keeping the full shadow in water; player's world coordinates/collision never
change. The same geometry works for all four directions and all cast distances.

During active retrieval, bite opportunities are checked repeatedly every ~250
ms using a per-time probability. Fish are not preselected at depth selection.
Failed opportunities/rolls simply continue retrieval, allowing early, middle or
late bites. Species/weight/bite selection reuses existing `rollFish` rules and
profiles with the chosen depth, current hook location and current speed bucket.
The shadow freezes at a bite until the player strikes. Once hooked, tapping
uses the same speed meter; speed affects fight progress and line tension. The
shadow then follows progress toward shore. Pause while the fish pulls to reduce
tension. The two fight bars occupy a compact panel so the water remains visible.

Returning the hook without a bite consumes one bait and reports no bite. Snag,
missed strike and broken line retain existing failure/persistence behavior.
Success retains fish book, rewards and bait accounting. All water graphics and
animation requests are cleaned up on completion, shutdown and map changes.

Verification:

- `tools/check-fishing.mjs`: cadence/distance, frame-size independence, coast and
  stop, shoreline clamp, continuous bite probabilities and dynamic conditions.
- `tools/check-fishing-browser.mjs`: actual Space/mobile taps, auto-repeat, meter
  changes, shadow motion/pause, early/mid/late bites, successful landing, no-bite
  and bottom-snag accounting, directional geometry and cleanup.
- Existing movement, NPC, collision, transition and camera checks stay relevant.
