"""Split the generated casting sheet; normalize all views with nearest-neighbor.

No painting or pose synthesis: RGB comes directly from the generated sheet.
Usage: python tools/prepare-player-cast-aim.py path/to/sheet.png
"""
from pathlib import Path
import json
import sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CELLS = [('down', 0, 0), ('right', 1, 0), ('up', 0, 1), ('left', 1, 1)]
# Measured hat-to-sole height is ~510 source px, versus ~1148 in player idle.
# ONE factor for every direction; never fit independently to a whole rod bbox.
NORMALIZE = 2.25
CANVAS = (1536, 1536)
ANCHOR = (768, 1524)


def prepare(source, pose='aim'):
    sheet = Image.open(source).convert('RGBA')
    width, height = sheet.size
    report = {}
    output = ROOT / 'src/assets/characters/player'
    forward = pose == 'forward'
    normalize = 2.18 if forward else NORMALIZE
    canvas_size = (2048, 1536) if forward else CANVAS
    anchor = (1024, 1524) if forward else ANCHOR
    # Forward sheet has a narrow gap at x=610 on its top row. Cutting exactly
    # at half-width would remove the right-facing player's rear boot.
    forward_cells = {'down': (0, 0, 610, 627), 'right': (610, 0, 1254, 627),
                     'up': (0, 627, 627, 1254), 'left': (627, 627, 1254, 1254)}
    source_tips = {'down': (584, 566), 'right': (1234, 186),
                   'up': (589, 658), 'left': (641, 737)}
    rod_tips = {}
    if forward:
        assert sheet.size == (1254, 1254), 'Expected the measured forward-pose sheet'
    for direction, column, row in CELLS:
        region = forward_cells[direction] if forward else (column * width // 2, row * height // 2,
                                                          (column + 1) * width // 2, (row + 1) * height // 2)
        cell = sheet.crop(region)
        rgba = np.array(cell)
        solid = rgba[:, :, 3] >= 128
        # Same hard-alpha convention as the authoritative player idle assets.
        # Remove faint transparent residue without blending any RGB colors.
        rgba[:, :, 3] = np.where(solid, 255, 0)
        rgba[~solid] = 0
        image = Image.fromarray(rgba).resize(
            (round(cell.width * normalize), round(cell.height * normalize)),
            Image.Resampling.NEAREST)
        mask = np.array(image)[:, :, 3] > 0
        ys, _ = np.where(mask)
        sole = int(ys.max() + 1)
        if forward:
            # The front rod tip nearly reaches the ground. Find the two largest
            # opaque spans in the sole band (boots), excluding the thin rod tip.
            columns = mask[sole - 30:sole].sum(axis=0)
            starts = np.where(np.diff(np.r_[False, columns > 0, False].astype(int)) == 1)[0]
            ends = np.where(np.diff(np.r_[False, columns > 0, False].astype(int)) == -1)[0]
            spans = sorted(zip(starts, ends), key=lambda span: columns[span[0]:span[1]].sum(), reverse=True)[:2]
            center = round((min(start for start, _ in spans) + max(end for _, end in spans)) / 2)
        else:
            _, boots = np.where(mask[sole - 90:sole])
            center = round((int(boots.min()) + int(boots.max()) + 1) / 2)
        bounds = image.getbbox()
        canvas = Image.new('RGBA', canvas_size)
        canvas.paste(image.crop(bounds), (anchor[0] + bounds[0] - center,
                                          anchor[1] + bounds[1] - sole))
        assert np.count_nonzero(np.array(canvas)[:, :, 3]) == np.count_nonzero(mask), 'Clipped rod or character'
        assert canvas.getbbox()[3] == anchor[1], 'Incorrect sole baseline'
        assert all(value > 0 for value in canvas.getbbox()[:2])
        assert canvas.getbbox()[2] < canvas_size[0]
        canvas.save(output / f'{direction}-cast-{pose}.png', optimize=True)
        if forward:
            tip = source_tips[direction]
            rod_tips[direction] = {'x': anchor[0] + round((tip[0] - region[0]) * normalize) - center,
                                   'y': anchor[1] + round((tip[1] - region[1]) * normalize) - sole}
        report[direction] = {'sourceCell': [column, row], 'productionBounds': list(canvas.getbbox()),
                             'sourceFootAnchorAfterNormalization': [center, sole]}
    standard = {'canvas': {'width': canvas_size[0], 'height': canvas_size[1]},
                'groundAnchor': {'x': anchor[0], 'y': anchor[1]}}
    if forward:
        standard['rodTip'] = rod_tips
    (ROOT / f'src/game/player-cast-{pose}-standard.json').write_text(json.dumps(standard, indent=2) + '\n')
    review = ROOT / 'output/fishing-review'
    review.mkdir(parents=True, exist_ok=True)
    (review / f'cast-{pose}-measurements.json').write_text(json.dumps(
        {'sourceCanvas': [width, height], 'nearestNormalization': normalize, **standard, 'directions': report}, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    prepare(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'aim')
