"""Validate exported native character PNGs and reusable source-palette sheets."""
from pathlib import Path
import json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'docs/character-48-measurements.json').read_text())
count=0
for character,definition in data['characters'].items():
    directory=ROOT/'src/assets/characters'/character
    assert len(list(directory.glob('*.png')))==4
    for direction,bounds in definition['directions'].items():
        image=Image.open(directory/(direction+'.png'))
        assert image.mode=='RGBA' and image.size==(48,48)
        assert image.getbbox()==tuple(bounds['bounds'])
        assert image.getbbox()[3]==42
        assert all(p[3] in (0,255) and (p[3] or p==(0,0,0,0)) for p in image.get_flattened_data())
        count+=1
slots={(0x21,0x23,0x2a),(0x45,0x44,0x54),(0x6b,0x69,0x78),(0x99,0x97,0xa2),(0xc5,0xc1,0xcb),(0xf3,0x74,0xbc),(0xf1,0xed,0xf3)}
for module in data['modules']:
    sheet=Image.open(ROOT/module['sheet'])
    assert sheet.mode=='RGBA' and sheet.size==(48,192)
    assert all(p==(0,0,0,0) or (p[3]==255 and p[:3] in slots) for p in sheet.get_flattened_data())
assert data['characters']['magnus']['appearance']['hair']=='bald'
print(f'{count} native 48x48 characters and {len(data["modules"])} 48x192 source-palette modules validated.')
