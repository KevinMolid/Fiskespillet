"""Compile the Marita turnaround into the existing NPC format; NEAREST only."""
from pathlib import Path
import json
import shutil
import sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DIRECTIONS = [('down', 0, 0), ('right', 1, 0), ('up', 0, 1), ('left', 1, 1)]


def prepare(source):
    sheet = Image.open(source).convert('RGBA')
    assert sheet.size == (1086, 1448), 'Expected the measured Marita turnaround'
    cells = []
    for direction, column, row in DIRECTIONS:
        rgba = np.array(sheet.crop((column * 543, row * 724, (column + 1) * 543, (row + 1) * 724)))
        rgba[:, :, 3] = np.where(rgba[:, :, 3] >= 128, 255, 0)
        rgba[rgba[:, :, 3] == 0] = 0
        cell = Image.fromarray(rgba)
        box = cell.getbbox()
        assert box[0] > 0 and box[1] > 0 and box[2] < 543 and box[3] < 724, 'Clipped source'
        cells.append((direction, cell, box))
    factor = 56 / max(box[3] - box[1] for _, _, box in cells)
    output = ROOT / 'src/assets/characters/marita'
    output.mkdir(parents=True, exist_ok=True)
    report = {}
    for direction, cell, box in cells:
        mask = np.array(cell.getchannel('A')) > 0
        _, feet = np.where(mask[box[3] - 40:box[3]])
        center = (feet.min() + feet.max() + 1) / 2
        crop = cell.crop(box)
        scaled = crop.resize((round(crop.width * factor), round(crop.height * factor)), Image.Resampling.NEAREST)
        anchor_x = round(24 - (center - box[0]) * factor)
        anchor_y = 60 - scaled.height
        assert anchor_x > 0 and anchor_y > 0 and anchor_x + scaled.width < 48
        image = Image.new('RGBA', (48, 64))
        image.paste(scaled, (anchor_x, anchor_y))
        assert image.getbbox()[3] == 60, 'Incorrect foot baseline'
        assert np.count_nonzero(np.array(image)[:, :, 3]) == np.count_nonzero(np.array(scaled)[:, :, 3]), 'Clipped production sprite'
        image.save(output / f'{direction}.png', optimize=True)
        report[direction] = {'sourceBounds': box, 'productionBounds': image.getbbox()}
    review = ROOT / 'output/character-review'
    review.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, review / 'marita-turnaround.png')
    (review / 'marita-measurements.json').write_text(json.dumps({'nearestNormalization': factor, 'directions': report}, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    prepare(sys.argv[1])
