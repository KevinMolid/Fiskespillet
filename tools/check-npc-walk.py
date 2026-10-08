"""Audit actual native NPC pixels: connected anatomy, covered torso, rigid shoes."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from npc_walk_rig import profile_shoe, shift, shade
ROOT=Path(__file__).resolve().parents[1]
report=json.loads((ROOT/'docs/character-rig-measurements.json').read_text())
ids=['kevin','mor','far','oda','magnus','bendik','nils','morten','marita']

def components(mask):
    seen=set();result=[]
    for y,x in zip(*np.where(mask)):
        if (y,x) in seen:continue
        queue=[(int(y),int(x))];seen.add((y,x));part=[]
        while queue:
            yy,xx=queue.pop();part.append((yy,xx))
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    ny,nx=yy+dy,xx+dx
                    if 0<=ny<mask.shape[0] and 0<=nx<mask.shape[1] and mask[ny,nx] and (ny,nx) not in seen:
                        seen.add((ny,nx));queue.append((ny,nx))
        result.append(part)
    return sorted(result,key=len,reverse=True)

for id in ids:
    for direction in ['down','right','up','left']:
        directory=ROOT/'src/assets/characters'/id
        source=np.array(Image.open(directory/f'{direction}.png'))
        data=report[id][direction]
        fixed=data['fixedHeadRows']
        for step in (1,2,3):
            a=np.array(Image.open(directory/f'{direction}-walk-{step}.png'))
            for part in components(a[:,:,3]>0)[1:]:
                assert all(y<fixed for y,x in part),(id,direction,step,'detached limb/outline',part)
            hip=round(data['poses'][str(step)]['limbs']['left']['legJoints']['hip'][1])
            original=source[fixed+5:hip,23:26,3]>0
            actual=a[fixed+5:hip,23:26,3]>0
            assert not np.any(original&~actual),(id,direction,step,'transparent torso hole')
        if direction in ('right','left'):
            near='left' if direction=='right' else 'right'
            far='right' if near=='left' else 'left'
            boot,top,_=profile_shoe(source,id,direction)
            # At shoe height only two registered, rigid source shoes may exist.
            # Check the actual composited pixels, not just A/B agreement (two
            # copies of the SAME faulty double-shoe crop also agreed before).
            for step in (1,2,3):
                a=np.array(Image.open(directory/f'{direction}-walk-{step}.png'))
                expected=Image.new('RGBA',(48,64))
                for limb in (far,near):
                    info=data['poses'][str(step)]['limbs'][limb]['legJoints']
                    assert info['bootSource']=='isolated-idle-foreground'
                    assert info['bootSourceBounds']==list(boot.getbbox())
                    shoe=shift(boot,*info['bootTranslation'])
                    expected.alpha_composite(shade(shoe,info['bootShade']))
                reference=np.array(expected)
                assert np.array_equal(a[top+2:60],reference[top+2:60]),(id,direction,step,'extra/missing/distorted shoe pixels')
            # The complete near shoe has identical dimensions/pixels in A/B;
            # its toe axis stays horizontal. No flattened/rotated replacement.
            samples=[]
            for step in (1,2):
                a=np.array(Image.open(directory/f'{direction}-walk-{step}.png'))
                joints=data['poses'][str(step)]['limbs'][near]['legJoints']
                assert joints['bootAngle']==0
                x0,y0,x1,y1=joints['bootBounds']
                samples.append(a[y0:y1,x0:x1])
            assert samples[0].shape==samples[1].shape,(id,direction,'shoe resized')
            visible=(samples[0][:,:,3]>0)&(samples[1][:,:,3]>0)
            identical=np.all(samples[0]==samples[1],axis=2)
            assert np.count_nonzero(identical&visible)/np.count_nonzero(visible)>.9,(id,direction,'shoe texture distorted')
    assert (directory/'down-walk-3.png').read_bytes()==(directory/'down.png').read_bytes(),(id,'front C differs from idle')
    print(id+': connected anatomy, exactly two isolated source shoes per profile and idle front C passed')
print('108 native NPC walk frames audited.')
