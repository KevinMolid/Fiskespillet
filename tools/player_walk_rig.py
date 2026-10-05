"""Player-only, manually registered limb rig; approved idle artwork is read-only.

Coordinates below are in world pixels (source pixels / 20). Sleeves belong to
arms, shoes/hands are rigid, and anatomical sides are explicit in every view.
All copying/resampling is integer nearest-neighbour with binary alpha.
"""
from pathlib import Path
import math
import hashlib
import json
import io
import time
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
UNIT = 20
GROUND = 1172
# Screen-left/right arm masks include the sleeve, cuff, forearm and hand.
ARMS = {
    'down': [([(12,28),(10,28),(8,31),(7.5,35),(6,40),(7,43),(11,43),(12,36),(12,32)],(11,29)),
             ([(26,28),(28,29),(30,33),(31,37),(32.5,42),(28,43),(26,38),(25,33)],(26,29))],
    'up': [([(12,29),(10,30),(8,33),(7.5,36),(6.5,41),(8,43),(11,42),(12,36),(13,32)],(11.5,30)),
           ([(26,29),(28,30),(30,34),(30.5,38),(32,42),(29,43),(26.5,39),(25,34)],(26.5,30))],
    'right': [([(15,26.5),(12,27),(10.5,28),(9,32),(9,36),(10,39),(10,42),(12,44),(15,43),(15,40),(13.5,38),(13,34),(15,31)],(12.5,29)),
              ([(22,34),(24,35),(25,38),(26,42),(23,43),(21,39)],(23,35))],
    'left': [([(15,35),(13,36),(12.5,39),(10.5,41),(11,43),(14.5,44),(16,40)],(15,36)),
             ([(23,26.5),(25.5,27.5),(28,32),(29,35),(29,38),(30,41),(30,43),(26,44),(24,42),(24,37),(23,33)],(25,30))],
}
ARM_JOINTS = {
    'down': [((12,28),(9.4,34.3),(8.7,39.7)),((26.3,28.5),(28.8,34.6),(29.8,40))],
    'up': [((12,29.5),(9.5,35),(9,40)),((26.4,29.5),(29,35),(30.1,40))],
    'right': [((14.4,28),(11.6,35),(12.3,40)),((22.4,28),(19.6,35),(20.3,40))],
    'left': [((15.6,28.5),(18.3,35.5),(19,40.5)),((23.6,28.5),(26.3,35.5),(27,40.5))],
}
PROFILE_LEG = {
    'right': {'outline':[(14.5,39.5),(20.5,40),(20.3,43),(18.8,46.5),(17.8,49.5),(17.8,51.5),(20.8,54.3),(21,57.5),(20.8,59),(10.5,59),(10.5,54),(12,50),(12.5,46),(13,42)],
              'source':((17,40),(15.6,47.5),(14.3,51.8)), 'hips':{'left':(17,40),'right':(20,39.5)},
              'ankles':{1:{'left':(21,51.8),'right':(15.8,50.8)},2:{'left':(15.5,51.8),'right':(21,50.8)}}},
    'left': {'outline':[(22,39.5),(28,40),(28,46),(27.8,50.8),(29.8,53),(30.5,57),(30.5,59),(19.2,59),(19.2,54),(21.5,52),(22.5,49),(22,45)],
             'source':((23.5,40),(25,47.5),(26,51.8)), 'hips':{'right':(23.5,40),'left':(20.5,39.5)},
             'ankles':{1:{'right':(25,51.8),'left':(18.5,50.8)},2:{'right':(19.5,51.8),'left':(25,50.8)}}},
}
BAGS = {
    'down': [(24,36),(27.7,36),(29,38),(29,43.5),(25.8,44),(24.5,42)],
    'up': [(8,35),(15.8,35),(16,43),(9,44),(8,41)],
    'right': [(23,35),(26.5,35.5),(28,38),(28,43.5),(23.5,43.5)],
    'left': [(27,35.5),(30.5,36),(32.5,39),(32.5,43),(27,44)],
}
# Splits follow trouser seams and shoe outlines, rather than bisecting the image.
SEAMS = {
    'down': [(19.2,40),(19.2,60)],
    'up': [(19.2,40),(19.2,60)],
    'right': [(21,40),(20,44),(18.5,48),(17.5,51),(19.8,53),(20.5,60)],
    'left': [(19.5,40),(20.5,44),(21.5,48),(22,51),(20,53),(19.8,60)],
}

def polygon_mask(size, points):
    mask = Image.new('L', size)
    ImageDraw.Draw(mask).polygon([(round(x*UNIT),round(y*UNIT)) for x,y in points], fill=255)
    return np.array(mask)>0

def part(image, mask):
    a = np.array(image).copy()
    a[~mask] = 0
    return Image.fromarray(a)

def shift_rigid(a, dx, dy):
    out=np.zeros_like(a)
    h,w=a.shape[:2]
    sx0,sx1=max(0,-dx),min(w,w-dx);sy0,sy1=max(0,-dy),min(h,h-dy)
    out[sy0+dy:sy1+dy,sx0+dx:sx1+dx]=a[sy0:sy1,sx0:sx1]
    return out

def pose_limb(image, root_y, rigid_y, dx, dy):
    """Pinned sleeve/thigh with a bent elbow/knee, rigid hand/boot translation.

    Displacements are quantized in source pixel blocks; no diagonal subpixel
    shearing and no stretching/shrinking of shoes or hands.
    """
    a=np.array(image);out=np.zeros_like(a)
    root=round(root_y*UNIT);rigid=round(rigid_y*UNIT)
    for yy in range(root,rigid+dy):
        y=round(root+(yy-root)*(rigid-root)/max(1,rigid+dy-root))
        y=min(rigid-1,y)
        t=(yy-root)/max(1,rigid+dy-root-1)
        # Knee/elbow bends towards the end of the swing, keeping its root pinned.
        t=t*t*(3-2*t)
        ox=round(dx*t/UNIT)*UNIT
        if 0<=yy<a.shape[0]:
            sx0,sx1=max(0,-ox),min(a.shape[1],a.shape[1]-ox)
            pixels=a[y,sx0:sx1];visible=pixels[:,3]>0
            target=out[yy,sx0+ox:sx1+ox];target[visible]=pixels[visible]
    rigid_part=a.copy();rigid_part[:rigid]=0
    moving=shift_rigid(rigid_part,dx,dy)
    visible=moving[:,:,3]>0;out[visible]=moving[visible]
    return Image.fromarray(out)

def rotate_vector(vector, degrees):
    theta=math.radians(degrees)
    return np.array([[math.cos(theta),-math.sin(theta)],[math.sin(theta),math.cos(theta)]])@np.array(vector)

def segment_pose(image, source_root, source_tip, target_root, target_tip):
    """Rotate a whole joint segment, keeping its transverse thickness intact."""
    s0,s1,t0,t1=map(lambda p:np.array(p,dtype=float)*UNIT,[source_root,source_tip,target_root,target_tip])
    sv=s1-s0;tv=t1-t0;sl=np.linalg.norm(sv);tl=np.linalg.norm(tv)
    sv/=sl;tv/=tl;sp=np.array([-sv[1],sv[0]]);tp=np.array([-tv[1],tv[0]])
    matrix=np.outer(tv,sv)*(tl/sl)+np.outer(tp,sp)
    inv=np.linalg.inv(matrix);translation=s0-inv@t0
    return image.transform(image.size,Image.Transform.AFFINE,
        (inv[0,0],inv[0,1],translation[0],inv[1,0],inv[1,1],translation[1]),resample=Image.Resampling.NEAREST)

def slice_layer(image, y0=-100, y1=100):
    a=np.array(image);yy=np.arange(a.shape[0])[:,None]
    return part(image,np.broadcast_to((yy>=round(y0*UNIT))&(yy<round(y1*UNIT)),a.shape[:2]))

def pose_arm(image, direction, index, forward):
    shoulder,elbow,wrist=map(lambda p:np.array(p,dtype=float),ARM_JOINTS[direction][index])
    profile=direction in ('left','right')
    if profile:
        facing=1 if direction=='right' else -1
        upper_angle=(-14 if forward else 14)*facing
        fore_angle=upper_angle-8*facing
        target_shoulder=shoulder+np.array([(.45 if forward else -.45)*facing,-.25 if forward else .25])
        depth=0
    else:
        inward=1 if index==0 else -1
        projection=1 if direction=='down' else -1
        upper_angle=(-6 if forward else 6)*inward
        fore_angle=upper_angle
        target_shoulder=shoulder+np.array([(.5 if forward else -.5)*inward,(.5 if forward else -.5)*projection])
        depth=(1.5 if forward else -1.5)*projection
    target_elbow=target_shoulder+rotate_vector(elbow-shoulder,upper_angle)
    target_wrist=target_elbow+rotate_vector(wrist-elbow,fore_angle)+np.array([0,depth])
    upper=slice_layer(image,y1=elbow[1]+.55)
    fore=slice_layer(image,y0=elbow[1]-.55,y1=wrist[1]+.55)
    hand=slice_layer(image,y0=wrist[1]-.55)
    result=Image.new('RGBA',image.size)
    result.alpha_composite(segment_pose(upper,shoulder,elbow,target_shoulder,target_elbow))
    result.alpha_composite(segment_pose(fore,elbow,wrist,target_elbow,target_wrist))
    # The hand rotates as a rigid part; depth projection only affects the arm.
    hand_tip=wrist+np.array([0,2])
    result.alpha_composite(segment_pose(hand,wrist,hand_tip,target_wrist,target_wrist+rotate_vector((0,2),fore_angle)))
    return result,{'shoulder':target_shoulder.tolist(),'elbow':target_elbow.tolist(),'wrist':target_wrist.tolist(),'upperAngle':upper_angle,'foreAngle':fore_angle}

def knee_for(hip,ankle,facing):
    hip=np.array(hip,dtype=float);ankle=np.array(ankle,dtype=float)
    vector=ankle-hip;distance=np.linalg.norm(vector);direction=vector/distance
    thigh,shin=7.5,5.0
    assert abs(thigh-shin)<distance<=thigh+shin
    along=(thigh*thigh-shin*shin+distance*distance)/(2*distance)
    offset=math.sqrt(max(0,thigh*thigh-along*along))
    # In screen coordinates this perpendicular points toward the facing side.
    perp=np.array([direction[1],-direction[0]])*facing
    return hip+direction*along+perp*offset

def pose_profile_leg(template,direction,limb,step,near,forward):
    config=PROFILE_LEG[direction];source_hip,source_knee,source_ankle=config['source']
    hip=np.array(config['hips'][limb]);ankle=np.array(config['ankles'][step][limb])
    facing=1 if direction=='right' else -1
    if limb!=near:
        a=np.array(template);a[:,:,:3]=np.rint(a[:,:,:3]*.86).astype(np.uint8);template=Image.fromarray(a)
    thigh=slice_layer(template,y1=source_knee[1]+.6)
    shin=slice_layer(template,y0=source_knee[1]-.6,y1=source_ankle[1]+.55)
    boot=slice_layer(template,y0=source_ankle[1]-.3)
    angle=0 if forward else 6*facing
    posed_boot=segment_pose(boot,source_ankle,np.array(source_ankle)+(0,2),ankle,ankle+rotate_vector((0,2),angle))
    baseline=GROUND if limb==near else GROUND-UNIT
    correction=baseline-posed_boot.getbbox()[3]
    posed_boot=Image.fromarray(shift_rigid(np.array(posed_boot),0,correction))
    # Register the shin to the boot's final ankle, after sole registration.
    # The floor constraint is visual artwork geometry, never a world offset.
    ankle=ankle+np.array([0,correction/UNIT]);knee=knee_for(hip,ankle,facing)
    result=Image.new('RGBA',template.size)
    result.alpha_composite(segment_pose(thigh,source_hip,source_knee,hip,knee))
    result.alpha_composite(segment_pose(shin,source_knee,source_ankle,knee,ankle))
    result.alpha_composite(posed_boot)
    return result,{'hip':hip.tolist(),'knee':knee.tolist(),'ankle':ankle.tolist(),'bootAngle':angle,'bootBaseline':baseline,'bootBounds':list(posed_boot.getbbox())}

def rig_player(direction):
    config=json.loads((ROOT/'src/game/pixel-player-standard.json').read_text())
    assert config['renderScale']==1/UNIT and config['groundAnchor']=={'x':384,'y':GROUND}, 'Re-register the manual rig if the player standard changes'
    directory=ROOT/'src/assets/characters/player'
    path=directory/f'{direction}.png'
    image=Image.open(path).convert('RGBA');original=np.array(image)
    alpha=original[:,:,3]>0
    body=original.copy();arms=[]
    yy,xx=np.indices(alpha.shape)
    rgb=original[:,:,:3].astype(float);r,g,b=rgb.transpose(2,0,1)
    skin=(r>120)&(g>65)&(b>40)&(r>g*1.25)&(g>b*1.1)
    blue=(b>r*1.15)&(b>g*1.05)
    bag_region=polygon_mask(image.size,BAGS[direction])
    for arm_index,(points,_pivot) in enumerate(ARMS[direction]):
        # In the right-facing idle the far arm is fully occluded. Its old
        # guessed region actually contains vest/bag pixels, not a visible limb.
        if direction=='right' and arm_index==1:
            arms.append(Image.new('RGBA',image.size));continue
        region=polygon_mask(image.size,points)&alpha
        # Outside leather keep the hand's darker skin/outline too. Within
        # leather only the bright skin is a reliable hand color discriminator.
        arm_skin=skin&(~bag_region|((r>170)&(g>100)&(b>80)))
        colors=region&((blue&(yy<36*UNIT))|(arm_skin&(yy>=34*UNIT)))
        # Include the dark contour around skin/sleeves, including pixels just
        # outside the registration polygon. Otherwise the old hand outline
        # remains on the torso when the complete arm rotates away.
        outline=np.array(Image.fromarray((colors*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(31)))>0
        mask=alpha&outline&(yy>=26.8*UNIT)
        rim_region=np.array(Image.fromarray((region*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15)))>0
        dark_hand_rim=rim_region&alpha&(yy>=36*UNIT)&~bag_region&((r>g*1.1)|((r<35)&(g<35)&(b<35)))
        mask |= dark_hand_rim
        if direction=='down' and arm_index==1:
            # The source hand's neutral dark outer edge extends beyond the
            # skin-color polygon, clear of the trouser/bag silhouette.
            mask |= alpha&(xx>=30.5*UNIT)&(xx<34.5*UNIT)&(yy>=36*UNIT)&(yy<44.5*UNIT)
        arms.append(part(image,mask));body[mask]=0
    original_arms=list(arms)
    # Source shirt pixels at the inner shoulder are the fixed socket, drawn
    # behind the moving sleeve cap. This reconnects it to the unchanged collar.
    for index,(shoulder,_,_) in enumerate(ARM_JOINTS[direction]):
        if direction=='right' and index!=0:continue
        if direction=='left' and index!=1:continue
        sx,sy=shoulder
        socket=blue&alpha&(yy>=(sy-.6)*UNIT)&(yy<(sy+2.2)*UNIT)&(xx>(sx-1)*UNIT)&(xx<(sx+1)*UNIT)
        body[socket]=original[socket]
    near='left' if direction=='right' else 'right'
    anatomy={'left':1,'right':0} if direction=='down' else {'left':0,'right':1}
    # A visible near arm is the complete template for the occluded far arm.
    if direction in ('right','left'):
        far='right' if near=='left' else 'left'
        far_a=np.array(arms[anatomy[near]]).copy()
        far_a[:,:,:3]=np.rint(far_a[:,:,:3]*.86).astype(np.uint8)
        far_a=shift_rigid(far_a,(8 if direction=='right' else -8)*UNIT,0)
        arms[anatomy[far]]=Image.fromarray(far_a)

    # Preserve the complete leather silhouette, not only its warm interior.
    # An idle hand occludes part of the bag in the left/down views: fill that
    # hidden leather from exposed source leather on the same row. Do not carry
    # the original skin or its black hand contour into the stationary bag.
    bag_mask=bag_region&alpha
    hand_pixels=skin&(r>170)&(g>100)&(b>80)&(yy>=35*UNIT)
    hand_rim=np.array(Image.fromarray((hand_pixels*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(25)))>0
    leather=bag_mask&~hand_rim&~blue
    bag_a=np.array(part(image,bag_mask))
    valid_y,valid_x=np.where(leather)
    holes_y,holes_x=np.where(bag_mask&~leather)
    for y in np.unique(holes_y):
        row_holes=holes_x[holes_y==y]
        same_row=valid_x[valid_y==y]
        if len(same_row):
            donors=same_row[np.argmin(abs(same_row[None,:]-row_holes[:,None]),axis=1)]
            bag_a[y,row_holes]=original[y,donors]
        else:
            for x in row_holes:
                nearest=np.argmin((valid_x-x)**2+(valid_y-y)**2)
                bag_a[y,x]=original[valid_y[nearest],valid_x[nearest]]
    bag=Image.fromarray(bag_a)
    body[bag_mask]=0
    seam=SEAMS[direction]
    split=polygon_mask(image.size,[(0,40),*seam,(0,60)])
    lower=(yy>=40*UNIT)&(yy<GROUND)
    legs=[]
    for side in [split,~split]:
        mask=lower&side
        a=body.copy();a[~mask]=0
        legs.append(Image.fromarray(a))
    body[lower]=0
    # Duplicate hidden trouser pixels from the exposed panel at the same Y.
    # This fills the region uncovered by a swinging hand without inventing colors.
    for index in [0,1]:
        a=np.array(legs[index]);old_arm=np.array(original_arms[index])[:,:,3]>0
        for y in range(40*UNIT,44*UNIT):
            row=a[y];valid=np.where((row[:,3]>0)&(row[:,1]>=row[:,0]*.96)&(row[:,0]>30))[0]
            if not len(valid): continue
            holes=np.where(old_arm[y]&lower[y]&(split[y] if index==0 else ~split[y]))[0]
            for x in holes:
                nearest=valid[np.argmin(abs(valid-x))]
                if abs(nearest-x)<=2*UNIT:a[y,x]=row[nearest]
        legs[index]=Image.fromarray(a)

    profile_template=None
    if direction in ('right','left'):
        leg_body=Image.alpha_composite(legs[0],legs[1])
        profile_template=part(leg_body,polygon_mask(image.size,PROFILE_LEG[direction]['outline']))

    report={}
    for step in [1,2]:
        forward_leg='left' if step==1 else 'right';forward_arm='right' if step==1 else 'left'
        posed_arms={};posed_legs={};measurements={}
        for limb in ['left','right']:
            index=anatomy[limb];leg_forward=limb==forward_leg;arm_forward=limb==forward_arm
            leg_joints={}
            if direction in ('down','up'):
                projection=1 if direction=='down' else -1
                leg_dx=0
                leg_dy=0 if leg_forward==(direction=='down') else -3*UNIT
                posed_legs[limb]=pose_limb(legs[index],40,52,leg_dx,leg_dy)
            else:
                posed_legs[limb],leg_joints=pose_profile_leg(profile_template,direction,limb,step,near,leg_forward)
            posed_arms[limb],arm_joints=pose_arm(arms[index],direction,index,arm_forward)
            measurements[limb]={'legForward':leg_forward,'armForward':arm_forward,'legBounds':list(posed_legs[limb].getbbox()),'armBounds':list(posed_arms[limb].getbbox()),'legJoints':leg_joints,'armJoints':arm_joints}
        frame=Image.new('RGBA',image.size)
        if direction in ('right','left'):
            far='right' if near=='left' else 'left'
            frame.alpha_composite(posed_arms[far]);frame.alpha_composite(posed_legs[far])
            frame.alpha_composite(Image.fromarray(body));frame.alpha_composite(posed_legs[near])
            frame.alpha_composite(bag);frame.alpha_composite(posed_arms[near])
        else:
            for leg in posed_legs.values():frame.alpha_composite(leg)
            frame.alpha_composite(Image.fromarray(body));frame.alpha_composite(bag)
            for arm in posed_arms.values():frame.alpha_composite(arm)
        result=np.array(frame);result[result[:,:,3]==0]=0;frame=Image.fromarray(result)
        assert np.array_equal(result[:26*UNIT],original[:26*UNIT]),(direction,'head changed')
        assert frame.getbbox()[3]==GROUND,(direction,step,'baseline')
        encoded=io.BytesIO();frame.save(encoded,format='PNG',optimize=True)
        destination=directory/f'{direction}-walk-{step}.png'
        pending=destination.with_suffix('.pending')
        pending.write_bytes(encoded.getvalue())
        # Cloud-synced folders can briefly lock an existing PNG while indexing.
        for attempt in range(20):
            try:
                pending.replace(destination);break
            except PermissionError:
                if attempt==19:raise
                time.sleep(.2)
        report[str(step)]={'forwardLeg':forward_leg,'forwardArm':forward_arm,'limbs':measurements}
    return {'rig':'player-joints-v3','idleSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'poses':report}

if __name__=='__main__':
    report_path=ROOT/'docs/character-rig-measurements.json'
    report=json.loads(report_path.read_text())
    report['player']={direction:rig_player(direction) for direction in ['down','right','up','left']}
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    print('Rebuilt eight player walk poses; idles and all NPC assets unchanged.')
