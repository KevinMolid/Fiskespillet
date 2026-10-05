"""User-approved deterministic pixel rig. No AI walk columns are consumed.

Left/right are anatomical. A=left leg/right arm forward; B=opposite.
All sampling is NEAREST; player idle PNGs are read-only inputs.
"""
from pathlib import Path
import json
import hashlib
import numpy as np
from PIL import Image, ImageFilter
from player_walk_rig import rig_player

ROOT = Path(__file__).resolve().parents[1]
IDS = ['player', 'kevin', 'mor', 'far', 'oda', 'magnus', 'bendik', 'nils', 'morten']
DIRECTIONS = ['down', 'right', 'up', 'left']

def largest_component(mask):
    visited = np.zeros(mask.shape, dtype=bool)
    best = []
    for y,x in zip(*np.where(mask)):
        if visited[y,x]:
            continue
        stack=[(int(y),int(x))];visited[y,x]=True;component=[]
        while stack:
            yy,xx=stack.pop();component.append((yy,xx))
            for ny,nx in [(yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)]:
                if 0<=ny<mask.shape[0] and 0<=nx<mask.shape[1] and mask[ny,nx] and not visited[ny,nx]:
                    visited[ny,nx]=True;stack.append((ny,nx))
        if len(component)>len(best):
            best=component
    result=np.zeros(mask.shape,dtype=np.uint8)
    for y,x in best:
        result[y,x]=255
    return result

def extract_arm(image, side, direction, unit, player):
    # Analyze a small proxy, then apply its mask to original-resolution RGB.
    proxy=image.resize((round(image.width/unit),round(image.height/unit)),Image.Resampling.NEAREST)
    rgba=np.array(proxy);r,g,b=rgba[:,:,:3].astype(float).transpose(2,0,1)
    skin=(rgba[:,:,3]>0)&(r>150)&(g>85)&(b>55)&(r>g*(1.38 if player else 1.15))&(g>b*1.1)
    yy,xx=np.indices(skin.shape)
    center=proxy.width/2
    region=(yy>=36)&(yy<49)&((xx<center) if side=='screen-left' else (xx>=center))
    if direction in ('down','up'):
        region&=(xx<center-6) if side=='screen-left' else (xx>center+6)
    seed=largest_component(skin&region)
    if not seed.any():
        return Image.new('RGBA',image.size),None
    mask=Image.fromarray(seed).filter(ImageFilter.MaxFilter(3))
    mask=mask.resize(image.size,Image.Resampling.NEAREST)
    alpha=np.minimum(np.array(mask),np.array(image.getchannel('A')))
    part=image.copy();part.putalpha(Image.fromarray(alpha))
    return part,part.getbbox()

def remove_part(base,part):
    rgba=np.array(base);rgba[np.array(part.getchannel('A'))>0]=0
    return Image.fromarray(rgba)

def transform_part(part,pivot,bottom,dx=0):
    """Pinned hinge; inverse integer nearest sampling changes only this limb."""
    box=part.getbbox()
    if not box:
        return part
    source_length=box[3]-pivot
    target_length=bottom-pivot
    scale=target_length/source_length
    shear=dx/target_length
    return part.transform(part.size,Image.Transform.AFFINE,
        (1,-shear,shear*pivot,0,1/scale,pivot-pivot/scale),resample=Image.Resampling.NEAREST)

def rig(id,direction):
    if id == 'player':
        return rig_player(direction)
    directory=ROOT/'src/assets/characters'/id
    path=directory/f'{direction}.png'
    image=Image.open(path).convert('RGBA')
    player=id=='player'
    config=json.loads((ROOT/'src/game'/('pixel-player-standard.json' if player else 'pixel-npc-standard.json')).read_text())
    unit=1/config['renderScale'];ground=config['groundAnchor']['y'];center=config['groundAnchor']['x']
    hip=round((41 if player else 43)*unit)
    a=np.array(image);alpha=a[:,:,3]
    _,foot_x=np.where(alpha[max(hip,ground-round(6*unit)):ground]>0)
    leg_left,leg_right=int(foot_x.min()),int(foot_x.max()+1)
    split=round((leg_left+leg_right)/2)
    screen_arms={}
    body=image.copy()
    for side in ['screen-left','screen-right']:
        part,box=extract_arm(image,side,direction,unit,player)
        screen_arms[side]=part
        body=remove_part(body,part)
    # Only the leg column is articulated; hats, bags and outer long hair remain.
    legs={}
    for side,x0,x1 in [('screen-left',leg_left,split),('screen-right',split,leg_right)]:
        mask=Image.new('L',image.size)
        region=body.getchannel('A').crop((x0,hip,x1,ground))
        mask.paste(region,(x0,hip))
        part=body.copy();part.putalpha(mask)
        assert part.getbbox(), (id,direction,side,'empty leg')
        legs[side]=part;body=remove_part(body,part)
    # Label projections anatomically, so right/left are never guessed from pixels.
    if direction=='down':
        anatomical={'left':'screen-right','right':'screen-left'}
    else:
        anatomical={'left':'screen-left','right':'screen-right'}
    if direction=='left':
        anatomical={'left':'screen-left','right':'screen-right'}
    # Profiles: near left when facing right, near right when facing left.
    near='left' if direction=='right' else 'right'
    if direction in ('right','left'):
        # A mostly occluded far forearm cannot be sheared as a disconnected hand.
        # Reconstruct it from the same character's near forearm, then let the
        # unchanged torso/hair occlude it. Near/far anatomy is explicit.
        far='right' if near=='left' else 'left'
        near_part=screen_arms[anatomical[near]]
        assert near_part.getbbox(), (id,direction,'missing near arm')
        dark=np.array(near_part)
        dark[:,:,:3]=np.rint(dark[:,:,:3].astype(float)*.86).astype('uint8')
        far_part=Image.new('RGBA',image.size)
        far_part.paste(Image.fromarray(dark),(round((3 if direction=='right' else -3)*unit),0))
        screen_arms[anatomical[far]]=far_part
    report={}
    for step in [1,2]:
        forward_leg='left' if step==1 else 'right'
        forward_arm='right' if step==1 else 'left'
        posed_legs={};posed_arms={};measurements={}
        for limb in ['left','right']:
            leg=legs[anatomical[limb]]
            arm=screen_arms[anatomical[limb]]
            leg_forward=limb==forward_leg;arm_forward=limb==forward_arm
            if direction in ('down','up'):
                farther=(not leg_forward) if direction=='down' else leg_forward
                bottom=ground-round(3*unit) if farther else ground
                posed_legs[limb]=transform_part(leg,hip,bottom)
                box=arm.getbbox()
                if box:
                    projection=1 if direction=='down' else -1
                    extent=(2 if arm_forward else -2)*projection*unit
                    posed_arms[limb]=transform_part(arm,box[1],round(box[3]+extent))
            else:
                sign=1 if direction=='right' else -1
                foot_alpha=np.array(leg.getchannel('A'))
                _,xs=np.where(foot_alpha[max(hip,ground-round(6*unit)):ground]>0)
                rest_foot_center=(xs.min()+xs.max()+1)/2
                # Both phases use the same stride extent. Subtract idle foot
                # offset, otherwise one phase collapses and the other splays.
                extent=(6 if player else 7)*unit
                leg_dx=round(center+(extent if leg_forward else -extent)*sign-rest_foot_center)
                posed_legs[limb]=transform_part(leg,hip,ground-(round(unit) if limb!=near else 0),leg_dx)
                box=arm.getbbox()
                if box:
                    arm_dx=round((4 if arm_forward else -4)*sign*unit)
                    posed_arms[limb]=transform_part(arm,box[1],box[3],arm_dx)
            measurements[limb]={
                'legForward':leg_forward,'armForward':arm_forward,
                'legBounds':list(posed_legs[limb].getbbox()),
                'armBounds':list(posed_arms[limb].getbbox()) if limb in posed_arms else None,
            }
        frame=Image.new('RGBA',image.size)
        if direction in ('right','left'):
            far='right' if near=='left' else 'left'
            for group in [posed_arms,posed_legs]:
                if far in group:frame.alpha_composite(group[far])
            frame.alpha_composite(body)
            frame.alpha_composite(posed_legs[near])
            if near in posed_arms:frame.alpha_composite(posed_arms[near])
        else:
            for part in posed_legs.values():frame.alpha_composite(part)
            frame.alpha_composite(body)
            for part in posed_arms.values():frame.alpha_composite(part)
        # Preserve Oda's long hair in front of her arm, wherever it overlaps.
        if id=='oda':
            r,g,b=a[:,:,:3].astype(float).transpose(2,0,1)
            yy,_=np.indices(alpha.shape)
            hair=(alpha>0)&(yy<hip)&(b>r*.9)&(g<r*.9)&(r<140)
            restored=np.array(frame);restored[hair]=a[hair];frame=Image.fromarray(restored)
        assert frame.getbbox()[3]==ground,(id,direction,step,'ground')
        out=np.array(frame)
        assert np.array_equal(out[:round(32*unit)],a[:round(32*unit)]),(id,direction,'head/shoulders changed')
        assert set(np.unique(out[:,:,3]))=={0,255}
        frame.save(directory/f'{direction}-walk-{step}.png',optimize=True)
        report[str(step)]={'forwardLeg':forward_leg,'forwardArm':forward_arm,'limbs':measurements}
    return {'idleSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'poses':report}

if __name__=='__main__':
    report={id:{direction:rig(id,direction) for direction in DIRECTIONS} for id in IDS}
    (ROOT/'docs/character-rig-measurements.json').write_text(json.dumps(report,indent=2)+'\n')
    print('Rigged 72 walk frames from 36 unchanged idles.')
