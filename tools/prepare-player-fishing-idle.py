"""Split the relaxed fishing sheet without repainting or smoothing artwork."""
from pathlib import Path
import json
import sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CANVAS = (2048, 1536)
ANCHOR = (1024, 1524)
# One normalization for all directions, measured against idle hat-to-sole height.
NORMALIZE = 2.25
CELLS = [('down', 0, 0), ('right', 1, 0), ('up', 0, 1), ('left', 1, 1)]


def prepare(source):
    sheet = Image.open(source).convert('RGBA')
    assert sheet.size == (1448, 1086), 'Expected the measured relaxed fishing sheet'
    report = {}
    for direction, column, row in CELLS:
        region = (column * 724, row * 543, (column + 1) * 724, (row + 1) * 543)
        rgba = np.array(sheet.crop(region))
        solid = rgba[:, :, 3] >= 128
        rgba[:, :, 3] = np.where(solid, 255, 0)
        rgba[~solid] = 0
        image = Image.fromarray(rgba).resize((round(724 * NORMALIZE), round(543 * NORMALIZE)), Image.Resampling.NEAREST)
        mask = np.array(image)[:, :, 3] > 0
        ys, _ = np.where(mask)
        sole = int(ys.max() + 1)
        # Only the boot band controls centering; the long rod never contributes.
        _, boots = np.where(mask[sole - 35:sole])
        center = round((int(boots.min()) + int(boots.max()) + 1) / 2)
        bounds = image.getbbox()
        canvas = Image.new('RGBA', CANVAS)
        canvas.paste(image.crop(bounds), (ANCHOR[0] + bounds[0] - center,
                                          ANCHOR[1] + bounds[1] - sole))
        assert np.count_nonzero(np.array(canvas)[:, :, 3]) == np.count_nonzero(mask), 'Clipped artwork'
        assert canvas.getbbox()[3] == ANCHOR[1], 'Sole baseline changed'
        assert canvas.getbbox()[0] > 0 and canvas.getbbox()[1] > 0
        assert canvas.getbbox()[2] < CANVAS[0]
        canvas.save(ROOT / f'src/assets/characters/player/{direction}-fishing-idle.png', optimize=True)
        report[direction] = {'sourceRegion': region, 'productionBounds': canvas.getbbox(),
                             'sourceFootAnchorAfterNormalization': [center, sole],
                             'hatToSolePixels': canvas.getbbox()[3] - canvas.getbbox()[1]}
    standard = {'canvas': {'width': CANVAS[0], 'height': CANVAS[1]},
                'groundAnchor': {'x': ANCHOR[0], 'y': ANCHOR[1]}}
    (ROOT / 'src/game/player-fishing-idle-standard.json').write_text(json.dumps(standard, indent=2) + '\n')
    (ROOT / 'output/fishing-review/fishing-idle-measurements.json').write_text(json.dumps(
        {'sourceCanvas': sheet.size, 'nearestNormalization': NORMALIZE, **standard, 'directions': report}, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    prepare(sys.argv[1])
