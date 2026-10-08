# Character pose contract

Left/right always mean the character's anatomical side, not the viewer's.

| Pose | Forward leg | Back leg | Forward arm | Back arm |
|---|---|---|---|---|
| A | left | right | right | left |
| B | right | left | left | right |
| C | neutral/support | passing swing | neutral | neutral |

NPC down/front C is an explicit exception: use the unchanged original idle,
with both feet neutral and no forward foot. Runtime uses the idle image directly.
For side shoes, isolate ONE foreground shoe using its per-row source contour;
never copy a rectangular crop containing pieces of the second idle shoe.

Projection rules:

- Down/front: anatomical left is viewer right. A has the viewer-right foot forward
  (lower), viewer-left hand forward. B reverses both.
- Up/back: anatomical left is viewer left. A has the viewer-left foot forward
  (farther/higher) and viewer-right hand forward (farther/higher). B reverses both.
- Right profile: near limbs are anatomical left. A: near leg right/forward,
  near arm left/back; far leg left/back, far arm right/forward. B reverses both.
- Left profile: near limbs are anatomical right. A: near leg right/back,
  near arm left/forward; far leg left/forward, far arm right/back. B reverses both.

The foreground/layer order follows near/far anatomy, not a mirrored full sprite.
The head, hip roots, clothing identity, facing and ground registration stay fixed.
Shoulder caps rotate with the upper arm; the inner shirt socket connects them
to the torso. Each tile holds one frame; the shared sequence is A–C–B–C.
All walk poses are derived from the corresponding idle with integer pixel rigging.
AI-generated walking columns are discarded. Skin/limb masks must not include hair,
bags or torso. Check the masks and both poses for each direction individually.

## Identity checklist

| Character | Required features |
|---|---|
| Player | Approved hat, blue shirt, tan vest, bag/strap and brown boots; original idles unchanged |
| Kevin | Sandy brown hair, glasses, stubble, olive T-shirt, charcoal jeans, white shoes |
| Mor | Blonde long hair, glasses, dusty rose top |
| Far | Grey hair, muted grey/olive shirt, reserved expression |
| Oda | Long dark/plum hair, mauve top, readable friendly face |
| Magnus | **Completely bald**, no scalp/side hair; visibly heavier/round belly, beard, orange Hawaiian shirt |
| Bendik | Lean/slightly taller, sandy hair, glasses, beard, green shirt |
| Nils | Blonde hair, blue sports top with light trim, light trainers |
| Morten | Dark hair, green shopkeeper shirt |
| Marita | Slim, long brown hair, lightly tanned skin, white cropped tank/bare midriff, charcoal leggings and white trainers |

NPC names, dialogue, routes and occupancy remain in existing NPC data.
