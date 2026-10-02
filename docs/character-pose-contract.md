# Character pose contract

Historical gait guidance for future 48×48 walk artwork. The active modular
system currently provides idle only; see `pixel-character-system.md`.

Left/right always mean the character's anatomical side, not the viewer's.

| Pose | Forward leg | Back leg | Forward arm | Back arm |
|---|---|---|---|---|
| A | left | right | right | left |
| B | right | left | left | right |

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
Shoulders, hip roots, head, clothing, facing and ground registration stay fixed.
All walk poses are derived from the corresponding idle with integer pixel rigging.
AI-generated walking columns are discarded. Skin/limb masks must not include hair,
bags or torso. Check the masks and both poses for each direction individually.

## Identity checklist

| Character | Required features |
|---|---|
| Player | Straw hat, blue shirt, tan vest, bag/strap and brown boots in the common native 48×48 module standard |
| Kevin | Sandy brown hair, glasses, stubble, olive T-shirt, charcoal jeans, white shoes |
| Mor | Blonde long hair, glasses, dusty rose top |
| Far | Grey hair, muted grey/olive shirt, reserved expression |
| Oda | Long dark/plum hair, mauve top, readable friendly face |
| Magnus | **Completely bald**, no scalp/side hair; visibly heavier/round belly, beard, orange Hawaiian shirt |
| Bendik | Lean/slightly taller, sandy hair, glasses, beard, green shirt |
| Nils | Blonde hair, blue sports top with light trim, light trainers |
| Morten | Dark hair, green shopkeeper shirt |

NPC names, dialogue, routes and occupancy remain in existing NPC data.
