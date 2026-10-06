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


def prepare(source):
    sheet = Image.open(source).convert('RGBA')
    width, height = sheet.size
    report = {}
    output = ROOT / 'src/assets/characters/player'
    for direction, column, row in CELLS:
        cell = sheet.crop((column * width // 2, row * height // 2,
                           (column + 1) * width // 2, (row + 1) * height // 2))
        rgba = np.array(cell)
        solid = rgba[:, :, 3] >= 128
        # Same hard-alpha convention as the authoritative player idle assets.
        # Remove faint transparent residue without blending any RGB colors.
        rgba[:, :, 3] = np.where(solid, 255, 0)
        rgba[~solid] = 0
        image = Image.fromarray(rgba).resize(
            (round(cell.width * NORMALIZE), round(cell.height * NORMALIZE)),
            Image.Resampling.NEAREST)
        mask = np.array(image)[:, :, 3] > 0
        ys, _ = np.where(mask)
        sole = int(ys.max() + 1)
        _, boots = np.where(mask[sole - 90:sole])
        center = round((int(boots.min()) + int(boots.max()) + 1) / 2)
        bounds = image.getbbox()
        canvas = Image.new('RGBA', CANVAS)
        canvas.paste(image.crop(bounds), (ANCHOR[0] + bounds[0] - center,
                                          ANCHOR[1] + bounds[1] - sole))
        assert np.count_nonzero(np.array(canvas)[:, :, 3]) == np.count_nonzero(mask), 'Clipped rod or character'
        assert canvas.getbbox()[3] == ANCHOR[1], 'Incorrect sole baseline'
        assert all(value > 0 for value in canvas.getbbox()[:2])
        assert canvas.getbbox()[2] < CANVAS[0]
        canvas.save(output / f'{direction}-cast-aim.png', optimize=True)
        report[direction] = {'sourceCell': [column, row], 'productionBounds': list(canvas.getbbox()),
                             'sourceFootAnchorAfterNormalization': [center, sole]}
    standard = {'canvas': {'width': CANVAS[0], 'height': CANVAS[1]},
                'groundAnchor': {'x': ANCHOR[0], 'y': ANCHOR[1]}}
    (ROOT / 'src/game/player-cast-aim-standard.json').write_text(json.dumps(standard, indent=2) + '\n')
    review = ROOT / 'output/fishing-review'
    review.mkdir(parents=True, exist_ok=True)
    (review / 'cast-aim-measurements.json').write_text(json.dumps(
        {'sourceCanvas': [width, height], 'nearestNormalization': NORMALIZE, **standard, 'directions': report}, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    prepare(sys.argv[1])
