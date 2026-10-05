"""Audit actual production hand pixels, separately from the rig's pose labels."""
from pathlib import Path
import json
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]

def hand_center(image, side=None):
    # Nearest sampling is for measurement only; production assets are not resized.
    a=np.array(image.resize((192,296),Image.Resampling.NEAREST))
    r,g,b=a[:,:,:3].astype(float).transpose(2,0,1)
    yy,xx=np.indices(r.shape)
    mask=(a[:,:,3]>0)&(yy>=195)&(yy<235)&(r>170)&(g>90)&(r>g*1.3)&(g>b*1.15)
    if side=='screen-left':mask &= xx<55
    if side=='screen-right':mask &= xx>130
    seen=set();components=[]
    for y,x in zip(*np.where(mask)):
        if (y,x) in seen:continue
        todo=[(y,x)];seen.add((y,x));component=[]
        while todo:
            y,x=todo.pop();component.append((x,y))
            for ny,nx in [(y-1,x),(y+1,x),(y,x-1),(y,x+1)]:
                if 0<=ny<296 and 0<=nx<192 and mask[ny,nx] and (ny,nx) not in seen:
                    seen.add((ny,nx));todo.append((ny,nx))
        components.append(component)
    assert components,'Missing visible hand'
    if side in ('near-left','near-right'):
        # Profiles expose two hands. Select the near anatomical arm by its
        # screen side rather than mistaking the far hand for the larger one.
        substantial=[c for c in components if len(c)>15]
        largest=(min if side=='near-left' else max)(substantial,key=lambda c:np.array(c)[:,0].mean())
    else:largest=max(components,key=len)
    return np.array(largest).mean(axis=0)

for direction in ['down','up','right','left']:
    poses=[Image.open(ROOT/'src/assets/characters/player'/f'{direction}-walk-{step}.png') for step in [1,2]]
    if direction in ['down','up']:
        projection=1 if direction=='down' else -1
        for side,arm_phase in [('screen-left',1 if direction=='down' else -1),('screen-right',-1 if direction=='down' else 1)]:
            a,b=(hand_center(pose,side) for pose in poses)
            assert (a[1]-b[1])*projection*arm_phase>5,(direction,side,a.tolist(),b.tolist(),'hand fails to reverse depth')
    else:
        a,b=(hand_center(pose,'near-left' if direction=='right' else 'near-right') for pose in poses)
        # Near arm is back in right/A and forward in left/A: both project left.
        assert b[0]-a[0]>10,(direction,'near hand does not swing across the two steps')
    print(direction+': actual hand pixels follow the opposing arm/leg gait.')

    # Visible sleeve caps must articulate too, independently of pose labels.
    cap=[]
    for pose in poses:
        rgba=np.array(pose);r,g,b=rgba[:,:,:3].astype(float).transpose(2,0,1)
        yy,xx=np.indices(r.shape)
        blue=(rgba[:,:,3]>0)&(b>r*1.15)&(b>g*1.05)&(yy>=26*20)&(yy<33*20)
        if direction=='right':blue &= (xx>9*20)&(xx<16*20)
        elif direction=='left':blue &= (xx>22*20)&(xx<30*20)
        else:blue &= ((xx>7*20)&(xx<12*20))|((xx>26*20)&(xx<32*20))
        cap.append(blue)
    assert np.count_nonzero(cap[0]^cap[1])>400,(direction,'shoulder caps stay fixed')

# The floor constraint must not disconnect the ankle or bend knees backwards.
rig=json.loads((ROOT/'docs/character-rig-measurements.json').read_text())['player']
for direction in ['right','left']:
    facing=1 if direction=='right' else -1
    for step in ['1','2']:
        for limb,data in rig[direction]['poses'][step]['limbs'].items():
            leg=data['legJoints'];hip,knee,ankle=(np.array(leg[j]) for j in ['hip','knee','ankle'])
            assert abs(np.linalg.norm(knee-hip)-7.5)<.001
            assert abs(np.linalg.norm(ankle-knee)-5)<.001
            axis=ankle-hip;projection=hip+axis*np.dot(knee-hip,axis)/np.dot(axis,axis)
            assert (knee[0]-projection[0])*facing>=0,'Knee bends backwards'
            x0,_,x1,_=leg['bootBounds']
            assert x1-x0>7*20,'Boot was sliced or flattened'
print('Moving shoulder pixels, complete profile boots and forward-bending joint geometry passed.')
