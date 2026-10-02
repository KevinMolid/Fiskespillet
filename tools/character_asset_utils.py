"""Deterministic canvas/scale normalization; never generate or redesign artwork."""
from pathlib import Path
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STANDARD = json.loads((ROOT / 'src/game/character-standard-v1.json').read_text())

def opaque_bounds(image):
    y, x = np.where(np.array(image.getchannel('A')) >= STANDARD['alphaThreshold'])
    if not y.size:
        raise ValueError('Character has no opaque silhouette')
    return int(x.min()), int(y.min()), int(x.max()+1), int(y.max()+1)

def standardize(image, foot_x, foot_y, factor=1):
    canvas, anchor = STANDARD['canvas'], STANDARD['groundAnchor']
    size = (canvas['width'], canvas['height'])
    if factor == 1:
        result = Image.new('RGBA', size)
        result.paste(image, (anchor['x']-foot_x, anchor['y']-foot_y))
    else:
        # Premultiplied alpha prevents dark halos when resampling transparent edges.
        result = image.convert('RGBa').transform(size, Image.Transform.AFFINE,
            (1/factor, 0, foot_x-anchor['x']/factor,
             0, 1/factor, foot_y-anchor['y']/factor),
            resample=Image.Resampling.BICUBIC).convert('RGBA')
    # Correct the asset's raster rounding, never the runtime/world coordinates.
    correction = anchor['y'] - opaque_bounds(result)[3]
    if correction:
        aligned = Image.new('RGBA', size)
        aligned.paste(result, (0, correction))
        result = aligned
    if result.getbbox()[0] == 0 or result.getbbox()[1] == 0 or result.getbbox()[2] == size[0] or result.getbbox()[3] == size[1]:
        raise ValueError('Character exceeds the standard canvas; do not silently clip')
    return result
