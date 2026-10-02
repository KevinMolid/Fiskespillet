"""Validate all 108 production frames and their anatomical pose contract."""
from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
IDS=['player','kevin','mor','far','oda','magnus','bendik','nils','morten']
rig=json.loads((ROOT/'docs/character-rig-measurements.json').read_text())
count=0
for id in IDS:
 config=json.loads((ROOT/'src/game'/('pixel-player-standard.json' if id=='player' else 'pixel-npc-standard.json')).read_text())
 unit=1/config['renderScale'];ground=config['groundAnchor']['y'];center=config['groundAnchor']['x']
 for direction in ['down','right','up','left']:
  path=ROOT/'src/assets/characters'/id/(direction+'.png');idle=np.array(Image.open(path))
  assert hashlib.sha256(path.read_bytes()).hexdigest()==rig[id][direction]['idleSha256'], 'Rig must not rewrite idle'
  for step in [0,1,2]:
   file=ROOT/'src/assets/characters'/id/(direction+('' if not step else '-walk-'+str(step))+'.png')
   image=Image.open(file);assert image.mode=='RGBA'
   assert image.size==(config['canvas']['width'],config['canvas']['height'])
   rgba=np.array(image);alpha=rgba[:,:,3]
   assert set(np.unique(alpha))=={0,255};assert np.all(rgba[alpha==0]==0)
   assert np.all(alpha[0]==0) and np.all(alpha[-1]==0) and np.all(alpha[:,0]==0) and np.all(alpha[:,-1]==0),file
   assert image.getbbox()[3]==ground,file
   if step:
    assert np.array_equal(rgba[:round(32*unit)],idle[:round(32*unit)]), 'Head and shoulders must be exact idle pixels'
    pose=rig[id][direction]['poses'][str(step)]
    assert pose['forwardLeg']==('left' if step==1 else 'right')
    assert pose['forwardArm']==('right' if step==1 else 'left')
    assert all(limb['armBounds'] for limb in pose['limbs'].values()), 'Both arms need explicit controls'
    assert not np.array_equal(rgba,idle), 'Walk must differ from idle'
   count+=1
  poses=rig[id][direction]['poses']
  for limb in ['left','right']:
   a,b=(poses[str(step)]['limbs'][limb] for step in [1,2])
   assert a['legForward']!=b['legForward'] and a['armForward']!=b['armForward']
   assert a['legForward']!=a['armForward'], 'Ipsilateral arm/leg swing is incorrect'
   if direction in ['down','up']:
    # Measure real production boot pixels, independently of rig metadata.
    feet=[]
    for step in [1,2]:
     alpha=np.array(Image.open(path.with_name(direction+'-walk-'+str(step)+'.png')).getchannel('A'))
     halves=[]
     for x0,x1 in [(0,center-round(unit)),(center+round(unit),image.width)]:
      yy,_=np.where(alpha[ground-round(8*unit):ground,x0:x1]>0)
      halves.append(int(yy.max()))
     feet.append(halves)
    assert (feet[0][0]-feet[0][1])*(feet[1][0]-feet[1][1])<0, (id,direction,'same leading foot')
    projection=1 if direction=='down' else -1
    anatomical_phase=1 if limb=='right' else -1
    assert (a['armBounds'][3]-b['armBounds'][3])*projection*anatomical_phase>0, (id,direction,limb,'arm phase')
   else:
    facing=1 if direction=='right' else -1
    leg_phase=1 if limb=='left' else -1
    arm_phase=-leg_phase
    leg_a=(a['legBounds'][0]+a['legBounds'][2])/2;leg_b=(b['legBounds'][0]+b['legBounds'][2])/2
    arm_a=(a['armBounds'][0]+a['armBounds'][2])/2;arm_b=(b['armBounds'][0]+b['armBounds'][2])/2
    assert (leg_a-leg_b)*facing*leg_phase>0,(id,direction,limb,'leg direction')
    assert (arm_a-arm_b)*facing*arm_phase>0,(id,direction,limb,'arm direction')
 print(id+': all four directions, foot/arm alternation, exact head, alpha and ground passed')
# Magnus: fully bare scalp in all views, visibly wider orange torso than Kevin.
for direction in ['down','right','up','left']:
 im=np.array(Image.open(ROOT/'src/assets/characters/magnus'/(direction+'.png')))
 top=np.where(im[:,:,3]>0)[0].min()
 xs=np.where(im[top+5,:,3]>0)[0];mid=round((xs.min()+xs.max())/2)
 core=im[top+3:top+7,mid-2:mid+2,:3]
 assert np.all(core[:,:,0]>145) and np.all(core[:,:,1]>85), 'Magnus scalp must be bare skin'
mag=np.array(Image.open(ROOT/'src/assets/characters/magnus/down.png'))
kev=np.array(Image.open(ROOT/'src/assets/characters/kevin/down.png'))
assert np.count_nonzero(mag[40,:,3])>np.count_nonzero(kev[40,:,3])*1.15, 'Magnus must be clearly heavier'
assert count==108
print('108 production frames and Magnus bald/stocky features passed.')
