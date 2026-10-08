"""Extract generated female poses; shared nearest-only scale, measured foot anchors.

The approved male sprites are read-only references. No runtime offsets/scales
are introduced: output uses their idle and fishing canvas conventions.
"""
from pathlib import Path
import json
import sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DIRECTIONS = ['down', 'right', 'up', 'left']
SUFFIXES = ['', '-walk-1', '-walk-3', '-walk-2', '-cast-aim', '-cast-forward', '-fishing-idle']

def prepare(source):
    sheet = Image.open(source).convert('RGBA')
    base = json.loads((ROOT / 'src/game/pixel-player-standard.json').read_text())
    formats = {'': base}
    for suffix in SUFFIXES[4:]:
        formats[suffix] = json.loads((ROOT / f'src/game/player{suffix}-standard.json').read_text())
    cells = {}
    # Measured gutters in the generated sheet. The model's row baselines are
    # slightly below a perfect quarter grid; cutting quarters would clip boots.
    rows = [0, 218, 427, 635, 821]
    columns = [0, 277, 554, 833, 1111, 1388, 1666, 1915]
    assert sheet.size == (1915, 821), 'Re-measure gutters for a different generated sheet'
    for row, direction in enumerate(DIRECTIONS):
        for col, suffix in enumerate(SUFFIXES):
            region = (columns[col], rows[row], columns[col + 1], rows[row + 1])
            rgba = np.array(sheet.crop(region))
            # Binary alpha removes faint background flecks and preserves sharp edges.
            solid = rgba[:, :, 3] >= 128
            rgba[:, :, 3] = np.where(solid, 255, 0)
            rgba[~solid] = 0
            cells[direction, suffix] = Image.fromarray(rgba)
    male = Image.open(ROOT / 'src/assets/characters/player/down.png').getbbox()
    female = cells['down', ''].getbbox()
    factor = (male[3] - male[1]) / (female[3] - female[1])
    tallest = max(im.getbbox()[3] - im.getbbox()[1] for (d, suffix), im in cells.items() if suffix in SUFFIXES[:4])
    factor = min(factor, (base['groundAnchor']['y'] - 12) / tallest)
    destination = ROOT / 'src/assets/characters/player-female'
    destination.mkdir(parents=True, exist_ok=True)
    report = {}; tips = {}
    for (direction, suffix), raw in cells.items():
        image = raw.resize((round(raw.width * factor), round(raw.height * factor)), Image.Resampling.NEAREST)
        alpha = np.array(image)[:, :, 3] > 0
        # Footwear is always in the bottom third. Ignore the forward/down rod,
        # which can extend to the ground well to the right of the actual boots.
        yy, xx = np.indices(alpha.shape)
        feet = alpha & (yy > image.height * .78) & (xx > image.width * .31) & (xx < image.width * .68)
        fy, fx = np.where(feet)
        sole = int(fy.max() + 1)
        # Include both whole boots, including a lifted trailing foot. Centering
        # only the bottom few pixels incorrectly centers on the leading shoe.
        band = feet & (yy >= sole - round(27 * factor))
        _, boots = np.where(band)
        center = round((int(boots.min()) + int(boots.max()) + 1) / 2)
        fmt = formats.get(suffix, base)
        canvas = Image.new('RGBA', (fmt['canvas']['width'], fmt['canvas']['height']))
        anchor = fmt['groundAnchor']
        dx, dy = anchor['x'] - center, anchor['y'] - sole
        canvas.paste(image, (dx, dy))
        assert np.count_nonzero(np.array(canvas)[:, :, 3]) == np.count_nonzero(alpha), f'Clipped {direction}{suffix}: {image.getbbox()}, shift={dx,dy}, scale={factor}'
        bounds = canvas.getbbox()
        assert bounds[0] > 0 and bounds[1] > 0 and bounds[2] < canvas.width and bounds[3] < canvas.height, (direction, suffix, bounds)
        canvas.save(destination / f'{direction}{suffix}.png', optimize=True)
        report[f'{direction}{suffix}'] = {'bounds': bounds, 'footAnchor': [anchor['x'], anchor['y']], 'scale': factor}
        if suffix == '-cast-forward':
            # Distal rod end lies furthest out on the facing side; the boot band
            # does not contribute because it is close to the character center.
            ys, xs = np.where(alpha)
            extreme = xs.min() if direction == 'left' else xs.max()
            end_y = int(np.median(ys[xs == extreme]))
            tips[direction] = {'x': int(extreme + dx), 'y': int(end_y + dy)}
    (ROOT / 'src/game/player-female-rod-tips.json').write_text(json.dumps(tips, indent=2) + '\n')
    (ROOT / 'output/female-player-review/measurements.json').write_text(json.dumps({'source': str(source), 'factor': factor, 'assets': report}, indent=2) + '\n')
    gallery = Image.new('RGBA', (7 * 256, 4 * 192))
    for row, direction in enumerate(DIRECTIONS):
        for col, suffix in enumerate(SUFFIXES):
            fmt = formats.get(suffix, base); anchor = fmt['groundAnchor']
            image = Image.open(destination / f'{direction}{suffix}.png')
            cell = Image.new('RGBA', (2048, 1536))
            cell.paste(image, (1024 - anchor['x'], 1524 - anchor['y']))
            gallery.paste(cell.resize((256, 192), Image.Resampling.NEAREST), (col * 256, row * 192))
    gallery.save(ROOT / 'output/female-player-review/production-sheet.png')
    print(f'Prepared {len(report)} RGBA assets. Shared normalization: {factor:.5f}; runtime scale: {base["renderScale"]}')

if __name__ == '__main__':
    prepare(sys.argv[1])
