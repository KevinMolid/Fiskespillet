"""Audit actual production hand pixels, separately from the rig's pose labels."""
from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]

def hand_center(image, side=None):
    # Nearest sampling is for measurement only; production assets are not resized.
    a=np.array(image.resize((192,296),Image.Resampling.NEAREST))
    r,g,b=a[:,:,:3].astype(float).transpose(2,0,1)
    yy,xx=np.indices(r.shape)
    start_y=195 if side in ('near-left','near-right') else 172
    mask=(a[:,:,3]>0)&(yy>=start_y)&(yy<245)&(r>170)&(g>90)&(r>g*1.3)&(g>b*1.15)&(g<b*1.8)
    if side=='screen-left':mask &= xx<75
    if side=='screen-right':mask &= xx>120
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
    elif side in ('screen-left','screen-right'):
        # Skin highlights split the forearm/hand into multiple colour islands.
        # Measure their combined centroid rather than whichever island happens
        # to be largest after a stronger swing or projected foreshortening.
        largest=[pixel for component in components if len(component)>5 for pixel in component]
    else:largest=max(components,key=len)
    return np.array(largest).mean(axis=0)

for direction in ['down','up','right','left']:
    poses=[Image.open(ROOT/'src/assets/characters/player'/f'{direction}-walk-{step}.png') for step in [1,2]]
    if direction in ['down','up']:
        projection=1 if direction=='down' else -1
        for side,arm_phase in [('screen-left',1 if direction=='down' else -1),('screen-right',-1 if direction=='down' else 1)]:
            a,b=(hand_center(pose,side) for pose in poses)
            assert (a[1]-b[1])*projection*arm_phase>15,(direction,side,a.tolist(),b.tolist(),'arm/hand swing must exceed three world pixels')
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

# Regression for the reported Right/A defects: visible forward far hand and
# continuous clothing under the swinging near arm and around the hip/knee.
idle=np.array(Image.open(ROOT/'src/assets/characters/player/right.png').convert('RGBA'))
right_a=np.array(Image.open(ROOT/'src/assets/characters/player/right-walk-1.png').convert('RGBA'))
assert np.array_equal(right_a[:520],idle[:520]),'Right/A changed the approved head'
assert hashlib.sha256(right_a[:800].tobytes()).hexdigest()=='4699642e4c80bd2fa2c56466d7ce50aabb9eedbb08d4ccea18cf71167a4f7c9d','Lower-body refinement changed the approved upper body/arms'
for x,y in [(14.5,28.5),(13,36.5),(14,39),(17,40.5),(18,42.5),
            (22.8,41),(23,43.8),(22.5,44.3),(20.5,46.5),(21.5,49.5),(10.8,52.2),(22.4,52.2)]:
    assert right_a[round(y*20),round(x*20),3]==255,(x,y,'Hole in torso/trousers')
r,g,b=right_a[:,:,:3].astype(float).transpose(2,0,1)
yy,xx=np.indices(r.shape)
far_hand=(right_a[:,:,3]>0)&(xx>=28*20)&(xx<33*20)&(yy>=36*20)&(yy<42*20)&(r>170)&(g>90)&(r>g*1.25)&(g>b*1.1)
assert np.count_nonzero(far_hand)>1000,'Far hand is occluded behind the bag'
assert set(np.unique(right_a[:,:,3]))=={0,255}
assert Image.fromarray(right_a).getbbox()[3]==1172
right_pose=rig['right']['poses']['1']['limbs']
rear=right_pose['right']['legJoints'];front=right_pose['left']['legJoints']
hip,knee,ankle=(np.array(rear[j]) for j in ['hip','knee','ankle'])
assert hip[0]-ankle[0]>4,'Trailing leg is not extended behind the hip'
axis=ankle-hip
offset=knee-hip
distance_from_axis=abs(axis[0]*offset[1]-axis[1]*offset[0])/np.linalg.norm(axis)
assert distance_from_axis<1,'Rear knee no longer follows the trailing leg line'
assert rear['bootBounds'][2]<front['bootBounds'][0],'Feet overlap instead of forming a readable stride'
for leg in [rear,front]:
    x0,y0,x1,y1=leg['bootBounds']
    pixels=right_a[y0:y1,x0:x1];opaque=pixels[:,:,3]>0
    cuff=np.where(opaque[:45])[1].mean()
    toe=np.where(opaque[-50:])[1].mean()
    assert toe-cuff>24,'Boot reads as a frontal foot instead of pointing right'
    assert 1<(x1-x0)/(y1-y0)<1.25,'Boot is too long/narrow for the front-view character proportions'
    assert leg['bootAngle']==0,'Right-facing boots must not rotate towards the viewer'
    assert y1==leg['bootBaseline'],'Contact foot does not meet its perspective ground plane'
print('Right/A: shoulder/side/pelvis/ankle coverage, trailing leg line, separated side-profile boots, visible forward hand and unchanged head/ground passed.')

# B must match the approved A artwork while actually reversing the contact.
right_b=np.array(Image.open(ROOT/'src/assets/characters/player/right-walk-2.png').convert('RGBA'))
assert np.array_equal(right_b[:520],idle[:520]),'Right/B changed the character head'
assert set(np.unique(right_b[:,:,3]))=={0,255}
b_pose=rig['right']['poses']['2']['limbs']
assert b_pose['left']['legJoints']['ankle'][0]<b_pose['right']['legJoints']['ankle'][0],'B repeats A leading leg'
assert b_pose['left']['armJoints']['wrist'][0]>right_pose['left']['armJoints']['wrist'][0],'B near arm does not swing forward'
for limb in ['left','right']:
    leg=b_pose[limb]['legJoints'];x0,y0,x1,y1=leg['bootBounds']
    a_leg=right_pose[limb]['legJoints'];ax0,ay0,ax1,ay1=a_leg['bootBounds']
    assert (x1-x0,y1-y0)==(ax1-ax0,ay1-ay0),'A/B boot sizes differ'
    pixels=right_b[y0:y1,x0:x1];opaque=pixels[:,:,3]>0
    assert np.where(opaque[-50:])[1].mean()-np.where(opaque[:45])[1].mean()>24,'B boot points toward viewer'
    assert leg['bootAngle']==0 and y1==a_leg['bootBaseline'],'B boot angle/depth differs from A'
for x,y in [(12.8,27.5),(13,30),(13,36.5),(17,40.5),(18,42.5),
            (10.8,52.2),(22.4,52.2)]:
    assert right_b[round(y*20),round(x*20),3]==255,(x,y,'Gap in B shoulder/cloth/cuff')
print('Right/B: opposing contact, matching whole side boots, shoulder/cloth/cuff coverage and exact head/ground passed.')

# Readability must exist in actual pixels, not only anatomical pose labels.
# Left is always the near leg, right the far leg; their leading phase reverses.
for step,rgba in [('1',right_a),('2',right_b)]:
    pose=rig['right']['poses'][step]['limbs'];brightness={}
    for limb,baseline in [('left',1172),('right',1152)]:
        leg=pose[limb]['legJoints'];x0,y0,x1,y1=leg['bootBounds']
        assert y1==baseline,'Near/far foot perspective changes between contacts'
        pixels=rgba[y0:y1,x0:x1];opaque=pixels[:,:,3]>0
        brightness[limb]=pixels[:,:,:3][opaque].mean()
    assert brightness['left']>brightness['right']*1.4,'Near/far boots cannot be distinguished by shade'
    assert Image.fromarray(rgba).getbbox()[3]==1172,'Global ground anchor changed'
    # The enlarged native samples should keep the same difference as production.
    native=np.array(Image.fromarray(rgba).resize((38,59),Image.Resampling.NEAREST))
    sampled={}
    for limb in ['left','right']:
        x0,y0,x1,y1=pose[limb]['legJoints']['bootBounds']
        shoe=native[round((y0+50)/1184*59):round(y1/1184*59),
                    round(x0/768*38):round(x1/768*38)]
        sampled[limb]=shoe[:,:,:3][shoe[:,:,3]>0].mean()
    assert sampled['left']>sampled['right']*1.3,'Foot depth is lost at runtime pixel size'
print('Right A/B: actual near/far boot contrast survives runtime sampling; perspective and ground are stable.')

# C is a passing pose, with a planted near leg and a lifted far swing leg.
c_path=ROOT/'src/assets/characters/player/right-walk-3.png'
if c_path.exists():
    c=Image.open(c_path).convert('RGBA');rgba=np.array(c)
    assert c.size==(768,1184) and c.getbbox()[3]==1172
    assert set(np.unique(rgba[:,:,3]))=={0,255} and np.all(rgba[rgba[:,:,3]==0]==0)
    assert np.array_equal(rgba[:520],idle[:520]),'C changes approved head'
    passing=rig['right']['poses']['3']
    assert passing['phase']=='passing' and passing['between']==['1','2']
    left,right=(passing['limbs'][side]['legJoints'] for side in ['left','right'])
    assert left['bootBaseline']==1172 and right['bootBaseline']==1112,'Swing foot is not lifted above support plane'
    assert abs(left['hip'][0]-left['ankle'][0])<.1,'Support leg is not centered under hip'
    assert abs(left['ankle'][0]-right['ankle'][0])<2,'Passing feet remain in a wide contact stance'
    near_wrist=passing['limbs']['left']['armJoints']['wrist'][0]
    assert right_pose['left']['armJoints']['wrist'][0]<near_wrist<b_pose['left']['armJoints']['wrist'][0]
    for data in passing['limbs'].values():
        leg=data['legJoints'];hip,knee,ankle=(np.array(leg[j]) for j in ['hip','knee','ankle'])
        assert abs(np.linalg.norm(knee-hip)-7.5)<.001 and abs(np.linalg.norm(ankle-knee)-5)<.001
    print('Right C: exact head/format/ground, centered support leg, lifted swing leg and centered arm passed.')

# Left uses its own head/clothing and the same readable side-contact geometry.
left_idle=np.array(Image.open(ROOT/'src/assets/characters/player/left.png').convert('RGBA'))
for step in ['1','2','3']:
    rgba=np.array(Image.open(ROOT/f'src/assets/characters/player/left-walk-{step}.png').convert('RGBA'))
    assert np.array_equal(rgba[:520],left_idle[:520]),'Left pose changed its approved head'
    pose=rig['left']['poses'][step]['limbs']
    for x,y in [(15,29),(22,30),(24,34),(24.7,38),(25.5,40),(27,39),(22,40.5),(20,42)]:
        assert rgba[round(y*20),round(x*20),3]==255,(step,x,y,'Missing left shoulder/vest/strap/pelvis')
    brightness={}
    for limb in ['left','right']:
        leg=pose[limb]['legJoints'];x0,y0,x1,y1=leg['bootBounds']
        assert leg['bootAngle']==0 and 1<(x1-x0)/(y1-y0)<1.25
        assert y1==leg['bootBaseline']
        shoe=rgba[y0:y1,x0:x1];opaque=shoe[:,:,3]>0
        if step!='3':
            # In production pixels, the wide toe projects left of the cuff.
            assert np.where(opaque[:45])[1].mean()-np.where(opaque[-50:])[1].mean()>24
            heel=np.where(opaque[:,160:180])[0].max()
            toe=np.where(opaque[:,25:60])[0].max()
            assert abs(heel-toe)<=10,'Left contact sole tilts instead of following horizontal travel'
            brightness[limb]=shoe[:,:,:3][opaque].mean()
    if step!='3':
        assert brightness['right']>brightness['left']*1.4,'Left near/far feet lack contrast'
        left,right=(pose[side]['legJoints'] for side in ['left','right'])
        assert left['bootBounds'][2]<right['bootBounds'][0] if step=='1' else right['bootBounds'][2]<left['bootBounds'][0]
    else:
        assert pose['right']['legJoints']['bootBaseline']==1172
        assert pose['left']['legJoints']['bootBaseline']==1112
        support=pose['right']['legJoints']
        assert abs(support['hip'][0]-support['ankle'][0])<.1
        swing=pose['left']['legJoints']
        assert 1<swing['ankle'][0]-support['ankle'][0]<2,'Left C swing heel must trail the support foot'
        assert 0<swing['hip'][0]-swing['knee'][0]<2.5,'Left C knee folds too far outside the body'
        for x,y in [(290,710),(290,750),(290,785),(307,796)]:
            assert tuple(rgba[y,x])==(30,22,18,255),'Missing continuous C abdominal outline'
        hip,knee,ankle=(np.array(swing[joint]) for joint in ['hip','knee','ankle'])
        assert abs(np.linalg.norm(knee-hip)-7.5)<.001 and abs(np.linalg.norm(ankle-knee)-5)<.001
        wrist=pose['right']['armJoints']['wrist'][0]
        contacts=[rig['left']['poses'][s]['limbs']['right']['armJoints']['wrist'][0] for s in ['1','2']]
        assert min(contacts)<wrist<max(contacts)
print('Left A/B/C: exact head, opposed contacts, whole left-pointing boots, near/far contrast and lifted passing foot passed.')

for direction,support in [('down','left'),('up','right')]:
    idle=np.array(Image.open(ROOT/f'src/assets/characters/player/{direction}.png').convert('RGBA'))
    c=Image.open(ROOT/f'src/assets/characters/player/{direction}-walk-3.png').convert('RGBA')
    rgba=np.array(c)
    assert c.size==(768,1184) and c.getbbox()[3]==1172
    assert np.array_equal(rgba[:520],idle[:520])
    assert set(np.unique(rgba[:,:,3]))=={0,255} and np.all(rgba[rgba[:,:,3]==0]==0)
    pose=rig[direction]['poses']['3']['limbs']
    assert pose[support]['legBounds'][3]==1172
    swing='right' if support=='left' else 'left'
    assert pose[swing]['legBounds'][3]==1142
    contacts=[Image.open(ROOT/f'src/assets/characters/player/{direction}-walk-{s}.png') for s in [1,2]]
    for contact in contacts:
        alpha=np.array(contact.getchannel('A'))
        soles=[np.where(alpha[1000:1172,x0:x1]>0)[0].max()+1000 for x0,x1 in [(0,364),(404,768)]]
        assert abs(soles[0]-soles[1])>=100,'Front/back contacts must show the increased five-world-pixel stride'
    for side in ['screen-left','screen-right']:
        ys=[hand_center(contact,side)[1] for contact in contacts]
        assert min(ys)<=hand_center(c,side)[1]<=max(ys),'Passing hand must lie between its contact positions'
    assert not any(np.array_equal(rgba,np.array(contact)) for contact in contacts),'C duplicates a contact'
print('Down/up C: neutral hands between A/B, lifted swing sole, fixed support/head/ground passed.')
