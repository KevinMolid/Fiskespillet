"""Native-pixel NPC rig: complete arms, rigid shoes, continuous trouser panels.

Approved directional idles are immutable. A = left leg/right arm forward,
B = the opposite; profile C = support/passing legs. Down C is exact idle.
No generated artwork, smoothing, world offsets or per-character render scales.
"""
from pathlib import Path
import hashlib
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
IDS = ['kevin', 'mor', 'far', 'oda', 'magnus', 'bendik', 'nils', 'morten', 'marita']
DIRECTIONS = ['down', 'right', 'up', 'left']
GROUND = 60
# Explicit anatomical registration, in native pixels. The heavier and athletic
# bodies retain their own shoulder, hip and cuff proportions from the idles.
REGISTRATION = {
    'kevin': (32, 43, 53), 'mor': (32, 43, 55), 'far': (32, 43, 54),
    'oda': (31, 43, 54), 'magnus': (27, 44, 53), 'bendik': (31, 43, 53),
    'nils': (31, 43, 53), 'morten': (32, 43, 54), 'marita': (26, 34, 54),
}

# Foreground shoe contours registered on the ORIGINAL profiles, one limit per
# source row (right: exclusive toe X, left: inclusive toe X). A rectangle around
# the sole also contains the second shoe's toe above it, so it is not a limb.
# The heel outline is retained from the original alpha. These are asset-space
# masks, never runtime offsets or scales. Marita's profile already has one shoe.
PROFILE_SHOES = {
    'kevin': {'right': (53, [26,26,27,28,28,28,27], 20),
              'left': (53, [22,21,20,19,19,19,20], 27)},
    'mor': {'right': (54, [26,27,28,28,28,28], 20),
            'left': (54, [21,20,19,19,19,19], 27)},
    'far': {'right': (54, [27,28,29,29,29,29], 21),
            'left': (54, [21,20,19,19,19,20], 27)},
    'oda': {'right': (51, [25,24,25,26,25,25,25,26,25], 20),
            'left': (51, [23,23,24,23,22,21,21,21,22], 27)},
    'magnus': {'right': (53, [27,28,29,29,29,29,27], 19),
               'left': (53, [20,21,18,18,19,18,20], 29)},
    'bendik': {'right': (52, [24,24,25,26,26,27,27,26], 19),
               'left': (52, [23,23,21,20,19,19,19,20], 28)},
    'nils': {'right': (53, [25,26,27,28,28,28,27], 20),
             'left': (53, [22,21,20,19,19,19,20], 28)},
    'morten': {'right': (52, [25,25,26,26,27,27,28,27], 20),
               'left': (52, [24,23,22,21,21,21,21,21], 28)},
    'marita': {'right': (54, [48]*6, 22),
               'left': (54, [0]*6, 26)},
}

def profile_shoe(a, id, direction):
    top, contour, ankle_x = PROFILE_SHOES[id][direction]
    mask = np.zeros(a.shape[:2], dtype=bool)
    assert len(contour) == GROUND-top
    for y, toe in enumerate(contour, top):
        if direction == 'right': mask[y, :toe] = True
        else: mask[y, toe:] = True
    # Source seam pixels form the outline; no foreign toe can survive the mask.
    return layer(a, mask), top, ankle_x

def layer(a, mask):
    out = a.copy()
    out[~mask] = 0
    return Image.fromarray(out)

def shift(image, dx, dy):
    result = Image.new('RGBA', image.size)
    result.paste(image, (round(dx), round(dy)))
    return result

def shade(image, factor):
    a = np.array(image)
    a[:, :, :3] = np.rint(a[:, :, :3] * factor).astype('uint8')
    return Image.fromarray(a)

def rotate(v, angle):
    t = math.radians(angle)
    return np.array([[math.cos(t), -math.sin(t)], [math.sin(t), math.cos(t)]]) @ v

def segment(image, s0, s1, t0, t1):
    s0, s1, t0, t1 = map(lambda p: np.array(p, dtype=float), (s0, s1, t0, t1))
    sv, tv = s1-s0, t1-t0
    sl, tl = np.linalg.norm(sv), np.linalg.norm(tv)
    sv, tv = sv/sl, tv/tl
    matrix = np.outer(tv, sv)*(tl/sl) + np.outer([-tv[1],tv[0]], [-sv[1],sv[0]])
    inv = np.linalg.inv(matrix)
    offset = s0-inv@t0
    return image.transform(image.size, Image.Transform.AFFINE,
        (*inv[0], offset[0], *inv[1], offset[1]), resample=Image.Resampling.NEAREST)

def largest(mask):
    seen = set(); best = []
    for y, x in zip(*np.where(mask)):
        if (y,x) in seen: continue
        queue = [(int(y),int(x))]; seen.add((y,x)); component=[]
        while queue:
            yy,xx=queue.pop();component.append((yy,xx))
            for ny,nx in [(yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)]:
                if 0<=ny<64 and 0<=nx<48 and mask[ny,nx] and (ny,nx) not in seen:
                    seen.add((ny,nx));queue.append((ny,nx))
        if len(component)>len(best):best=component
    assert best, 'Missing registered skin component'
    ys,xs=zip(*best)
    return min(xs),min(ys),max(xs)+1,max(ys)+1

def arm_templates(a, id, direction):
    root_y, hip, _ = REGISTRATION[id]
    yy,xx=np.indices(a.shape[:2]);r,g,b=a[:,:,:3].astype(float).transpose(2,0,1)
    skin=(a[:,:,3]>0)&(r>150)&(g>85)&(b>65)&(r>g*1.15)&(g>b*1.12)&(r<g*2.2)
    profile=direction in ('right','left')
    sources=[]; joints=[]; masks=[]
    regions=[xx<24,xx>=24] if not profile else [np.ones(xx.shape,dtype=bool)]
    for region in regions:
        seed=skin&region&(yy>=root_y+5)&(yy<hip+5)
        x0,y0,x1,y1=largest(seed)
        cx=(x0+x1-1)/2
        # Sleeves and their cap are part of the arm, not stationary torso pixels.
        width=x1-x0+4
        if id=='marita':width=max(4,width)
        shoulder_x=cx if profile else cx+(1 if cx<24 else -1)
        shoulder=(shoulder_x,root_y+1)
        elbow=(cx,(root_y+y1-3)/2)
        wrist=(cx,y1-3)
        mask=(yy>=root_y)&(yy<y1+2)&(xx>=round(cx-width/2))&(xx<round(cx+width/2)+1)&region&(a[:,:,3]>0)
        # Include the full dark hand outline but never take trousers with it.
        lower=yy>=hip
        rim=np.array(Image.fromarray((skin*255).astype('uint8')).filter(ImageFilter.MaxFilter(3)))>0
        mask &= ~lower|rim
        sources.append(layer(a,mask));joints.append((shoulder,elbow,wrist));masks.append(mask)
    if profile:
        near='left' if direction=='right' else 'right'
        far='right' if near=='left' else 'left'
        # Reconstruct the hidden far limb from the same character's whole arm.
        offset=3 if direction=='right' else -3
        sources={near:sources[0],far:shade(shift(sources[0],offset,-1),.72)}
        joints={near:joints[0],far:tuple((x+offset,y-1) for x,y in joints[0])}
    else:
        sides=['right','left'] if direction=='down' else ['left','right']
        sources=dict(zip(sides,sources));joints=dict(zip(sides,joints))
    return sources,joints,np.logical_or.reduce(masks),skin

def pose_arm(template, joints, direction, forward, id):
    shoulder,elbow,wrist=map(lambda p:np.array(p,dtype=float),joints)
    profile=direction in ('right','left')
    sign=1 if direction in ('right','down') else -1
    if forward is None:
        angle=0;shoulder_delta=np.array([0.,0.]);depth=0
    elif profile:
        angle=(-19 if forward else 19)*sign
        shoulder_delta=np.array([(.5 if forward else -.5)*sign,0.])
        depth=0
    else:
        inward=1 if shoulder[0]<24 else -1
        amplitude=5 if id=='magnus' else 10
        angle=(-amplitude if forward else amplitude)*inward
        lateral=0 if id=='magnus' else (.5 if forward else -.5)*inward
        shoulder_delta=np.array([lateral,(1 if forward else -1)*sign])
        depth=(2 if forward else -2)*sign
    ts=shoulder+shoulder_delta
    te=ts+rotate(elbow-shoulder,angle)
    fore_angle=angle-(6*sign if profile and forward is not None else 0)
    tw=te+rotate(wrist-elbow,fore_angle)+[0,depth]
    a=np.array(template);yy=np.indices(a.shape[:2])[0]
    result=Image.new('RGBA',template.size)
    result.alpha_composite(segment(layer(a,yy<elbow[1]+1),shoulder,elbow,ts,te))
    result.alpha_composite(segment(layer(a,(yy>=elbow[1]-1)&(yy<wrist[1]+1)),elbow,wrist,te,tw))
    result.alpha_composite(segment(layer(a,yy>=wrist[1]-1),wrist,wrist+[0,2],tw,tw+rotate(np.array([0,2]),fore_angle)))
    return result,{'shoulder':ts.tolist(),'elbow':te.tolist(),'wrist':tw.tolist()}

def body_layer(a, arms_mask, skin, id, direction, joints):
    _,hip,_=REGISTRATION[id]
    yy,xx=np.indices(a.shape[:2]);body=a.copy()
    body[arms_mask|(yy>=hip)]=0
    # The inner sleeve socket stays under the moving shoulder cap. Only its
    # inner half is fixed; the outer cap rotates with the complete arm.
    for shoulder,_,_ in joints.values():
        inner=xx>=round(shoulder[0]) if shoulder[0]<24 else xx<=round(shoulder[0])
        socket=arms_mask&inner&~skin&(yy>=REGISTRATION[id][0])&(yy<REGISTRATION[id][0]+4)
        body[socket]=a[socket]
    # Restore the solid clothing behind the sleeve from exposed pixels on the
    # same source row. Keep the outer contour outlined, not transparent.
    profile=direction in ('right','left')
    for y in range(REGISTRATION[id][0],hip):
        visible=np.where(a[y,:,3]>0)[0]
        if not len(visible):continue
        if profile:
            torso_lo,torso_hi=(20,29) if direction=='right' else (19,28)
            if id=='magnus':torso_lo,torso_hi=(19,33) if direction=='right' else (15,29)
            if id=='marita':torso_lo,torso_hi=(22,28) if direction=='right' else (20,26)
        else:
            torso_lo,torso_hi=(17,31) if id!='magnus' else (12,36)
            if id=='marita':torso_lo,torso_hi=18,30
        donors=np.where((a[y,:,3]>0)&~skin[y]&~arms_mask[y]&(xx[y]>=torso_lo)&(xx[y]<torso_hi))[0]
        if not len(donors):continue
        for x in range(torso_lo,torso_hi):
            if not body[y,x,3]:body[y,x]=a[y,donors[np.argmin(abs(donors-x))]]
        # Dark native outline on the newly exposed profile abdomen.
        if profile and y>=REGISTRATION[id][0]+4:
            edge=torso_hi-1 if direction=='right' else torso_lo
            body[y,edge]=(24,22,23,255)
    # Preserve the whole waistband/pelvis behind the articulated thighs. In
    # particular Magnus's broad belly must meet a broad waist, not float above
    # a narrow leg template. Skin/old hands are never copied into this layer.
    pant_x=np.where(a[(hip+REGISTRATION[id][2])//2,:,3]>0)[0]
    pelvis=(yy>=hip)&(yy<hip+3)&(xx>=pant_x.min())&(xx<=pant_x.max())&~arms_mask&~skin
    body[pelvis]=a[pelvis]
    # Original long hair is an independent foreground layer below the fixed head.
    hair=np.zeros(yy.shape,dtype=bool)
    r,g,b=a[:,:,:3].astype(float).transpose(2,0,1)
    if id in ('oda','marita'):
        hair_color=(r<150)&(g<r*.85)&((b>r*.65) if id=='oda' else (b<g*.95))
        back=(xx<20) if direction=='right' else (xx>=28) if direction=='left' else (xx<17)|(xx>=31)
        if direction=='up':back=np.ones(xx.shape,dtype=bool)
        hair=(a[:,:,3]>0)&hair_color&back&(yy<(hip if id=='oda' else 39))
    return Image.fromarray(body),layer(a,hair)

def front_leg(a, limb, direction, forward, passing, id, arm_mask):
    _,hip,boot_y=REGISTRATION[id]
    yy,xx=np.indices(a.shape[:2])
    screen_left=(limb=='right') if direction=='down' else (limb=='left')
    mask=(xx<24 if screen_left else xx>=24)&(yy>=hip)&(yy<GROUND)&~arm_mask
    pant_x=np.where(a[(hip+boot_y)//2,:,3]>0)[0]
    mask &= (yy>=boot_y)|((xx>=pant_x.min())&(xx<=pant_x.max()))
    source=layer(a,mask);pixels=np.array(source)
    # Contact A/B reverses the actual sole baseline; shoes keep all their pixels.
    projection=1 if direction=='down' else -1
    dy=(-3 if passing else 0) if forward is None else (0 if forward== (projection==1) else -5)
    foot=layer(pixels,yy>=boot_y)
    frame=Image.new('RGBA',source.size)
    # Pinned hip -> shorter depth-projected leg, but never shrink the shoe.
    for y in range(hip,boot_y+dy+1):
        sy=round(hip+(y-hip)*(boot_y-hip)/max(1,boot_y+dy-hip))
        frame.paste(source.crop((0,sy,48,sy+1)),(0,y))
    frame.alpha_composite(shift(foot,0,dy))
    return frame,{'hip':[24,hip],'ankle':[24,boot_y+dy],'bootBaseline':GROUND+dy,'bootBounds':list(shift(foot,0,dy).getbbox())}

def profile_leg(a, down, id, direction, limb, forward, passing):
    _,hip,_=REGISTRATION[id]
    facing=1 if direction=='right' else -1
    near='left' if direction=='right' else 'right'
    is_near=limb==near
    boot,boot_y,source_ankle=profile_shoe(a,id,direction)
    stride=5 if id!='marita' else 4
    dx=0 if forward is None else (stride if forward else -stride)*facing
    lift=3 if passing else (0 if is_near else 1)
    if passing:dx=-2*facing
    posed_boot=shift(boot,dx,-lift)
    ankle=np.array([source_ankle+dx,boot_y+1-lift],dtype=float)
    root=np.array([source_ankle,hip],dtype=float)
    # Forward bending knee, with a straight support leg in the passing frame.
    knee=root+(ankle-root)*.53
    if forward is not None:knee[0]+=1.5*facing
    elif passing:knee[0]+=2.5*facing
    # Native trouser width/palette comes from the matching front-view leg.
    row=(hip+boot_y)//2
    side_x=np.arange(24,48) if limb=='left' else np.arange(0,24)
    px=side_x[down[row,side_x,3]>0]
    width=min(10,max(4,int(px.max()-px.min()+1)))
    donor_center=(px.min()+px.max())/2
    cloth=np.zeros_like(a)
    for y in range(hip,round(ankle[1])+1):
        t=(y-hip)/max(1,ankle[1]-hip)
        if y<knee[1]:cx=root[0]+(knee[0]-root[0])*(y-hip)/max(1,knee[1]-hip)
        else:cx=knee[0]+(ankle[0]-knee[0])*(y-knee[1])/max(1,ankle[1]-knee[1])
        sy=min(boot_y-1,round(hip+t*(boot_y-hip-1)))
        for x in range(round(cx-width/2),round(cx+width/2)+1):
            if not 0<x<47:continue
            sx=int(np.clip(round(donor_center+x-cx),px.min(),px.max()))
            color=down[sy,sx].copy()
            if not color[3]:
                donors=side_x[down[sy,side_x,3]>0]
                color=down[sy,donors[np.argmin(abs(donors-sx))]].copy()
            cloth[y,x]=color
        lo,hi=round(cx-width/2),round(cx+width/2)
        cloth[y,lo]=cloth[y,hi]=(24,22,23,255)
    frame=Image.fromarray(cloth)
    if not is_near:frame=shade(frame,.65)
    frame.alpha_composite(posed_boot if is_near else shade(posed_boot,.8))
    return frame,{'hip':root.tolist(),'knee':knee.tolist(),'ankle':ankle.tolist(),'bootAngle':0,
        'bootBaseline':GROUND-lift,'bootBounds':list(posed_boot.getbbox()),
        'bootSourceBounds':list(boot.getbbox()), 'bootTranslation':[dx,-lift],
        'bootShade':1 if is_near else .8, 'bootSource':'isolated-idle-foreground'}

def rig_npc(id,direction):
    directory=ROOT/'src/assets/characters'/id
    path=directory/f'{direction}.png'
    original=Image.open(path).convert('RGBA');a=np.array(original)
    down=np.array(Image.open(directory/'down.png').convert('RGBA'))
    arms,joints,arm_mask,skin=arm_templates(a,id,direction)
    body,hair=body_layer(a,arm_mask,skin,id,direction,joints)
    if id=='oda':
        # Hair is not a sleeve: it must not produce detached moving locks.
        hair_mask=np.array(hair.getchannel('A'))>0
        for limb in arms:
            pixels=np.array(arms[limb]);pixels[hair_mask]=0
            arms[limb]=Image.fromarray(pixels)
    profile=direction in ('right','left');near='left' if direction=='right' else 'right'
    report={}
    for step in (1,2,3):
        forward_leg=None if step==3 else ('left' if step==1 else 'right')
        forward_arm=None if step==3 else ('right' if step==1 else 'left')
        posed_legs={};posed_arms={};limbs={}
        support=near if profile else ('left' if direction=='down' else 'right')
        for limb in ('left','right'):
            lf=None if step==3 else limb==forward_leg
            af=None if step==3 else limb==forward_arm
            passing=step==3 and limb!=support
            if profile:leg,leg_joints=profile_leg(a,down,id,direction,limb,lf,passing)
            else:leg,leg_joints=front_leg(a,limb,direction,lf,passing,id,arm_mask)
            arm,arm_joints=pose_arm(arms[limb],joints[limb],direction,af,id)
            posed_legs[limb]=leg;posed_arms[limb]=arm
            limbs[limb]={'legForward':lf,'armForward':af,'legBounds':list(leg.getbbox()),'armBounds':list(arm.getbbox()),
                'legJoints':leg_joints,'armJoints':arm_joints}
            if step==3:limbs[limb]['passingRole']='support' if limb==support else 'swing'
        frame=Image.new('RGBA',original.size)
        if profile:
            far='right' if near=='left' else 'left'
            frame.alpha_composite(posed_arms[far]);frame.alpha_composite(posed_legs[far])
            frame.alpha_composite(body);frame.alpha_composite(posed_legs[near]);frame.alpha_composite(posed_arms[near])
        else:
            for leg in posed_legs.values():frame.alpha_composite(leg)
            frame.alpha_composite(body)
            for arm in posed_arms.values():frame.alpha_composite(arm)
        frame.alpha_composite(hair)
        # The complete head stays pixel-identical; no shoulder motion reaches it.
        pixels=np.array(frame);fixed=REGISTRATION[id][0]-1
        pixels[:fixed]=a[:fixed]
        if id=='magnus':
            yy,xx=np.indices(pixels.shape[:2])
            beard=(yy<31)&((xx>=19)&(xx<33) if direction=='right' else (xx>=14)&(xx<29) if direction=='left' else (xx>=12)&(xx<36))
            pixels[beard]=a[beard]
        # Single orphan pixels from the old neutral hand contour are not limbs.
        alpha=pixels[:,:,3]>0
        neighbours=np.zeros(alpha.shape,dtype=int)
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                if dx or dy:neighbours+=np.roll(np.roll(alpha,dy,axis=0),dx,axis=1)
        pixels[alpha&(neighbours==0)&(np.indices(alpha.shape)[0]>=fixed)]=0
        pixels[pixels[:,:,3]==0]=0
        frame=Image.fromarray(pixels)
        # Front idle already has the centered neutral feet and arms requested
        # for the transition. Do not rig or advance either of its shoes.
        if direction=='down' and step==3:
            frame=original.copy()
            yy,xx=np.indices(a.shape[:2])
            for limb in ('left','right'):
                region=xx>=24 if limb=='left' else xx<24
                leg=layer(a,region&(yy>=REGISTRATION[id][1])&~arm_mask)
                boot=layer(a,region&(yy>=REGISTRATION[id][2]))
                limbs[limb]['legBounds']=list(leg.getbbox())
                limbs[limb]['armBounds']=list(arms[limb].getbbox())
                limbs[limb]['armJoints']=dict(zip(('shoulder','elbow','wrist'),
                    [list(joint) for joint in joints[limb]]))
                limbs[limb]['passingRole']='neutral'
                limbs[limb]['legJoints']={'hip':[24,REGISTRATION[id][1]],
                    'ankle':[24,REGISTRATION[id][2]],'bootBaseline':GROUND,
                    'bootBounds':list(boot.getbbox())}
        assert frame.getbbox()[3]==GROUND,(id,direction,step,frame.getbbox())
        assert not np.any(pixels[:,[0,-1],3]),(id,direction,step,'canvas clipping')
        frame.save(directory/f'{direction}-walk-{step}.png',optimize=True)
        report[str(step)]={'forwardLeg':forward_leg,'forwardArm':forward_arm,'limbs':limbs}
        if step==3:report['3'].update(phase='passing',between=['1','2'])
        if direction=='down' and step==3:
            # Keep the duplicate production frame byte-identical for asset tools;
            # runtime also maps this slot directly to the original idle URL.
            (directory/'down-walk-3.png').write_bytes(path.read_bytes())
            report['3'].update(phase='idle-transition',usesIdle=True)
    return {'rig':'native-joints-v1','fixedHeadRows':REGISTRATION[id][0]-1,
        'idleSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'poses':report}

def gallery():
    directory=ROOT/'output/npc-walk-review';directory.mkdir(parents=True,exist_ok=True)
    for direction in DIRECTIONS:
        sheet=Image.new('RGB',(4*250,9*340),'#73926b');draw=ImageDraw.Draw(sheet)
        for row,id in enumerate(IDS):
            for col,step in enumerate((0,1,2,3)):
                file=ROOT/'src/assets/characters'/id/f'{direction}{"-walk-"+str(step) if step else ""}.png'
                im=Image.open(file).resize((240,320),Image.Resampling.NEAREST)
                ox,oy=col*250,row*340+18
                sheet.paste(im,(ox,oy),im);draw.text((ox,oy-15),f'{id} / {"idle" if not step else "ABC"[step-1]}',fill='white')
                draw.line((ox,oy+GROUND*5,ox+240,oy+GROUND*5),fill='#eed79a')
        sheet.save(directory/f'{direction}.png')

if __name__=='__main__':
    report_path=ROOT/'docs/character-rig-measurements.json'
    report=json.loads(report_path.read_text())
    for id in IDS:report[id]={direction:rig_npc(id,direction) for direction in DIRECTIONS}
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    gallery()
    print('Rebuilt 108 NPC A/B/C frames from 36 unchanged idles.')
