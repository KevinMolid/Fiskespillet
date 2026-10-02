"""Compile NPC idle designs; player idles are never touched. NEAREST only."""
from pathlib import Path
import json
import sys
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
DIRECTIONS = ['down', 'right', 'up', 'left']
def prepare(spec):
    sheet = Image.open(ROOT / spec['source']).convert('RGBA')
    rgba = np.array(sheet)
    assert rgba[:, :, 3].min() == 0
    rgba[:, :, 3] = np.where(rgba[:, :, 3] >= 128, 255, 0)
    rgba[rgba[:, :, 3] == 0] = 0
    sheet = Image.fromarray(rgba)
    # Detect real blank gutters; generated rows need not sit on exact quarter boundaries.
    horizontal = spec.get('layout') == 'idle-strip'
    region = sheet if horizontal else sheet.crop((0, 0, round(sheet.width/3), sheet.height))
    occupied = np.where((np.array(region.getchannel('A')) > 0).any(axis=0 if horizontal else 1))[0]
    segments = []
    for value in occupied:
        if not segments or value > segments[-1][1]+1:
            segments.append([int(value),int(value)])
        else:
            segments[-1][1]=int(value)
    assert len(segments)==4, (spec['id'], 'expected four separate idle silhouettes', segments)
    cells = [region.crop((max(0,a-3),0,min(region.width,b+4),region.height) if horizontal else
        (0,max(0,a-3),region.width,min(region.height,b+4))) for a,b in segments]
    b = cells[0].getbbox()
    target_height = 58 if spec['id'] == 'bendik' else 56
    factor = target_height / max(c.getbbox()[3]-c.getbbox()[1] for c in cells)
    out = ROOT / 'src/assets/characters' / spec['id']
    out.mkdir(parents=True, exist_ok=True)
    report = {}
    for direction, cell in zip(DIRECTIONS, cells):
        box = cell.getbbox()
        assert box and box[0]>0 and box[1]>0 and box[2]<cell.width and box[3]<cell.height, (spec['id'], direction, 'clipping')
        mask = np.array(cell.getchannel('A'))>0
        _,xs = np.where(mask[box[3]-round((b[3]-b[1])*.18):box[3]])
        foot_x = (xs.min()+xs.max()+1)/2
        crop = cell.crop(box)
        scaled = crop.resize((round(crop.width*factor),round(crop.height*factor)),Image.Resampling.NEAREST)
        image = Image.new('RGBA',(48,64))
        offset = (round(24-(foot_x-box[0])*factor),60-scaled.height)
        assert offset[0]>0 and offset[1]>0 and offset[0]+scaled.width<48
        image.paste(scaled,offset)
        correction=60-image.getbbox()[3]
        if correction:
            aligned=Image.new('RGBA',(48,64));aligned.paste(image,(0,correction));image=aligned
        assert image.getbbox()[3]==60
        image.save(out/f'{direction}.png',optimize=True)
        report[direction]={'bounds':list(image.getbbox()),'factor':factor}
    return report
if __name__=='__main__':
    manifest=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    report={s['id']:prepare(s) for s in manifest['characters']}
    (ROOT/'docs/character-walk-measurements.json').write_text(json.dumps(report,indent=2)+'\n')
    print('NPC idle assets prepared:',', '.join(report))
