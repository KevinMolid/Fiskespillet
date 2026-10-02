"""Prepare approved player art without resizing, repainting or interpolation.

Usage: python tools/prepare-pixel-player-assets.py source_directory
The sources already have alpha. Thresholding removes faint background residue;
retained RGB pixels are copied exactly. Foot centers are measured from the lower
80 source rows of the boots, not from the hat/bag or total bounding box.
"""
from pathlib import Path
import json
import sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'down': 'Pikseleventyrer med stråhatt.png',
    'right': 'ChatGPT-bilde 2. okt. 2026, 15_57_31-1.png',
    'up': 'ChatGPT-bilde 2. okt. 2026, 15_57_32-2.png',
    'left': 'ChatGPT-bilde 2. okt. 2026, 15_57_33-3.png',
}

def prepare(directory):
    standard = json.loads((ROOT / 'src/game/pixel-player-standard.json').read_text())
    width, height = standard['canvas'].values()
    anchor = standard['groundAnchor']
    output = ROOT / 'src/assets/characters/player'
    output.mkdir(parents=True, exist_ok=True)
    report = {}
    for direction, filename in SOURCES.items():
        image = Image.open(Path(directory) / filename).convert('RGBA')
        rgba = np.array(image)
        assert rgba[:, :, 3].min() == 0, 'Expected existing source transparency'
        mask = rgba[:, :, 3] >= 128
        ys, xs = np.where(mask)
        foot_y = int(ys.max() + 1)
        _, boot_x = np.where(mask[foot_y - 80:foot_y])
        foot_x = int(np.floor((boot_x.min() + boot_x.max() + 1) / 2 + .5))
        rgba[:, :, 3] = np.where(mask, 255, 0)
        rgba[~mask] = 0
        cutout = Image.fromarray(rgba)
        bounds = cutout.getbbox()
        canvas = Image.new('RGBA', (width, height))
        canvas.paste(cutout.crop(bounds), (
            anchor['x'] + bounds[0] - foot_x,
            anchor['y'] + bounds[1] - foot_y,
        ))
        result = np.array(canvas)
        assert np.count_nonzero(result[:, :, 3]) == np.count_nonzero(mask), 'Clipped artwork'
        assert np.array_equal(result[result[:, :, 3] > 0, :3], rgba[mask, :3]), 'RGB changed'
        assert canvas.getbbox()[3] == anchor['y']
        assert canvas.getbbox()[0] > 0 and canvas.getbbox()[1] > 0
        assert canvas.getbbox()[2] < width and canvas.getbbox()[3] < height
        canvas.save(output / f'{direction}.png', optimize=True)
        report[direction] = {
            'source': filename, 'sourceCanvas': list(image.size),
            'sourceBounds': list(bounds), 'sourceFootAnchor': [foot_x, foot_y],
            'productionBounds': list(canvas.getbbox()),
            'visibleDisplayHeight': (bounds[3] - bounds[1]) * standard['renderScale'],
            'resized': False,
        }
        print(direction, report[direction])
    (ROOT / 'docs/pixel-player-measurements.json').write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

if __name__ == '__main__':
    prepare(sys.argv[1])
