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
# Right contacts: the far anatomical leg is on a one-world-pixel deeper
# ground plane and stays visibly shaded throughout both gait phases.
CONTACT_FAR_SHADE = .62
CONTACT_FAR_DEPTH = UNIT
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

def side_boot(image,ankle,trailing=False,far=False):
    """Brown/laced original boot design, drawn in genuine right side profile.

    Front-view source boots cannot be made into a profile by translating them.
    Keep their leather palette/texture, but register shaft, instep, heel and toe
    explicitly along the horizontal travel axis. All edges are hard pixel steps.
    """
    # The authoritative front view supplies the same chunky leather clusters,
    # highlights and colours as the accepted character, rather than a smooth
    # narrow hiking-boot substitute.
    original=np.array(Image.open(ROOT/'src/assets/characters/player/down.png').convert('RGBA'))
    patch=original[round(50*UNIT):GROUND,round(8*UNIT):round(18*UNIT)]
    pr,pg,pb=patch[:,:,:3].astype(float).transpose(2,0,1)
    leather=(patch[:,:,3]>0)&(pr>pg*1.15)&(pg>pb*1.1)&(pr>45)&(pr<190)
    dy,dx=np.where(leather)
    assert len(dx)>100
    width,height=198,164
    pixels=np.zeros((height,width,4),dtype=np.uint8)
    for y in range(0,height,10):
        for x in range(0,width,10):
            sy=min(patch.shape[0]-1,round(y/height*patch.shape[0]))
            sx=min(patch.shape[1]-1,round(x/width*patch.shape[1]))
            if y>=96:
                # Put the front shoe's rounded toe highlights on the profile
                # toe, rather than stretching the dark shaft down over it.
                sy=min(patch.shape[0]-1,round(80+(y-96)*.95))
                sx=min(patch.shape[1]-1,max(0,round((x-30)*1.1)))
            closest=np.argmin((dy-sy)**2+(dx-sx)**2)
            pixels[y:y+10,x:x+10]=patch[dy[closest],dx[closest]]
    # Palette samples remain part of the approved original artwork.
    palette=np.array([original[round(y*UNIT),round(x*UNIT),:3] for x,y in
        [(12,55.5),(14,54.5),(12,57),(12,53),(13,52.5)]],dtype=np.uint8)
    outline=(25,15,12,255);dark=(*palette[2],255);mid=(*palette[0],255)
    highlight=(*palette[1],255);lace=(217,170,103,255)
    boot=Image.fromarray(pixels);mask=Image.new('L',boot.size)
    # Cuff is directly below the leg; heel is left, toe is right.
    shape=[(.5,0),(5.6,0),(5.6,1),(5.4,1.6),(5.7,2.7),(6.1,3.8),
           (7,4.2),(8.4,4.5),(9.2,5),(9.8,5.6),(9.8,7.6),(9.2,8.2),
           (.4,8.2),(0,7.5),(.2,5.8),(.3,1)]
    def coordinates(points):
        return [(round(x*UNIT),round((y-(1.2*max(0,1-x/7) if trailing and y>6 else 0))*UNIT)) for x,y in points]
    ImageDraw.Draw(mask).polygon(coordinates(shape),fill=255)
    # The reference outline is made of visible pixel steps, not thin sloping
    # vector edges. Snap only the new lower-body silhouette to ten-pixel blocks.
    mask=mask.resize((width//10,height//10),Image.Resampling.NEAREST).resize(boot.size,Image.Resampling.NEAREST)
    boot.putalpha(mask)
    draw=ImageDraw.Draw(boot)
    draw.line(coordinates(shape+[shape[0]]),fill=outline,width=10)
    sole_mask=Image.new('L',boot.size)
    ImageDraw.Draw(sole_mask).polygon(coordinates([(.2,7.3),(9.7,7.3),(9.7,7.7),(9.2,8.2),(.4,8.2)]),fill=255)
    sole=np.array(boot)
    for y in range(146,height,10):
        for x in range(0,width,10):
            sample=original[min(GROUND-1,1145+(y-146)),min(340,180+x),:3]
            if sample[0]<25 or sample[0]>140:sample=palette[2]
            sole[y:y+10,x:x+10,:3]=sample
    sole_layer=Image.fromarray(sole);sole_layer.putalpha(sole_mask);boot.alpha_composite(sole_layer)
    draw=ImageDraw.Draw(boot)
    draw.line(coordinates([(.3,7.2),(9.5,7.2)]),fill=mid,width=10)
    draw.rectangle((10,0,100,20),fill=dark)
    draw.rectangle((20,25,35,95),fill=highlight)
    draw.line(coordinates([(4.2,1.6),(4.5,2.5),(4.8,3.4),(5.3,4.2),(6,4.8)]),fill=dark,width=20)
    for x,y in [(4,1.7),(4.3,2.5),(4.6,3.3),(5,4.1)]:
        draw.rectangle((round(x*UNIT),round(y*UNIT),round((x+.8)*UNIT),round((y+.35)*UNIT)),fill=lace)
    draw.line(coordinates([(6.1,5.2),(7.4,5.4)]),fill=highlight,width=15)
    # Match the front reference's dark outer rim, including its toe and sole.
    # Inward erosion keeps the baseline and silhouette fixed and the border
    # uniformly thick around the stepped edge.
    solid=np.array(mask)>0
    padded=Image.new('L',(width+40,height+40));padded.paste(mask,(20,20))
    interior=np.array(padded.filter(ImageFilter.MinFilter(31)))[20:20+height,20:20+width]>0
    # Reapply the silhouette after internal panels; no detached dark pixels.
    a=np.array(boot);a[solid&~interior]=outline;a[~solid]=0
    if far:a[:,:,:3]=np.rint(a[:,:,:3]*CONTACT_FAR_SHADE).astype(np.uint8)
    boot=Image.fromarray(a)
    result=Image.new('RGBA',image.size)
    # A taller, wider cuff overlaps the trousers just like the front boots.
    # Physical ankle, ground registration and overall character height stay fixed.
    result.alpha_composite(boot,(round((ankle[0]-2.9)*UNIT),round((ankle[1]-1.4)*UNIT)))
    return result

def pose_profile_leg(template,direction,limb,step,near,forward,hip_override=None,ankle_override=None,repair_joint=False,boot_source=None,baseline_override=None):
    config=PROFILE_LEG[direction];source_hip,source_knee,source_ankle=config['source']
    hip=np.array(config['hips'][limb]);ankle=np.array(config['ankles'][step if step in (1,2) else 1][limb])
    if hip_override is not None:hip=np.array(hip_override,dtype=float)
    if ankle_override is not None:ankle=np.array(ankle_override,dtype=float)
    if boot_source is not None and limb!=near:
        # Translate the entire far chain together, preserving limb lengths and
        # knee shape. This is perspective within the artwork, not world motion.
        hip=hip-np.array([0,CONTACT_FAR_DEPTH/UNIT])
        ankle=ankle-np.array([0,CONTACT_FAR_DEPTH/UNIT])
    facing=1 if direction=='right' else -1
    if limb!=near:
        shade=CONTACT_FAR_SHADE if boot_source is not None else .86
        a=np.array(template);a[:,:,:3]=np.rint(a[:,:,:3]*shade).astype(np.uint8);template=Image.fromarray(a)
    thigh=slice_layer(template,y1=source_knee[1]+.6)
    shin=slice_layer(template,y0=source_knee[1]-.6,y1=source_ankle[1]+.55)
    boot=slice_layer(template,y0=source_ankle[1]-.3)
    angle=0 if boot_source is not None else (0 if forward else 6*facing)
    posed_boot=side_boot(boot_source,ankle,not forward,limb!=near) if boot_source is not None else segment_pose(boot,source_ankle,np.array(source_ankle)+(0,2),ankle,ankle+rotate_vector((0,2),angle))
    baseline=GROUND-(CONTACT_FAR_DEPTH if limb!=near else 0) if boot_source is not None else (GROUND if limb==near else GROUND-UNIT)
    if baseline_override is not None:baseline=baseline_override
    correction=baseline-posed_boot.getbbox()[3]
    posed_boot=Image.fromarray(shift_rigid(np.array(posed_boot),0,correction))
    # Register the shin to the boot's final ankle, after sole registration.
    # The floor constraint is visual artwork geometry, never a world offset.
    ankle=ankle+np.array([0,correction/UNIT]);knee=knee_for(hip,ankle,facing)
    result=Image.new('RGBA',template.size)
    if repair_joint:
        # One continuous trouser panel registered to all three joints avoids
        # the diagonally cut wedges produced by rotating overlapping slices.
        a=np.array(template);cloth=np.zeros_like(a)
        r,g,b=a[:,:,:3].astype(float).transpose(2,0,1)
        cloth_pixels=(g>=r*.95)&(b<g*1.2)|(np.max(a[:,:,:3],axis=2)<35)
        # The front-reference panel is already isolated as cloth. Reclassifying
        # it after far-leg shading punches holes in borderline colour clusters.
        if boot_source is None:a[~cloth_pixels]=0
        for y in range(round(hip[1]*UNIT),round((ankle[1]+.4)*UNIT)):
            segment=0 if y/UNIT<knee[1] else 1
            s0,s1=(source_hip,source_knee) if segment==0 else (source_knee,source_ankle)
            t0,t1=(hip,knee) if segment==0 else (knee,ankle)
            progress=(y/UNIT-t0[1])/(t1[1]-t0[1])
            source_y=round((s0[1]+(s1[1]-s0[1])*progress)*UNIT)
            source_x=s0[0]+(s1[0]-s0[0])*progress
            target_x=t0[0]+(t1[0]-t0[0])*progress
            # Source artwork uses roughly ten-pixel blocks; retain hard edges.
            dx=round((target_x-source_x)*UNIT/10)*10
            sx0,sx1=max(0,-dx),min(a.shape[1],a.shape[1]-dx)
            cloth[y,sx0+dx:sx1+dx]=a[source_y,sx0:sx1]
        if boot_source is not None:
            # The trouser contour needs the same dark pixel rim as the front
            # artwork. A continuous inward outline cannot detach from the leg
            # or widen collision; it is entirely inside this visual layer.
            mask=Image.fromarray(cloth[:,:,3])
            mask=mask.resize((cloth.shape[1]//10,cloth.shape[0]//10),Image.Resampling.NEAREST).resize(mask.size,Image.Resampling.NEAREST)
            snapped=np.array(mask)>0
            # Fill newly included contour blocks from the closest original
            # fabric sample on that row; never manufacture transparent notches.
            for cy in np.unique(np.where(snapped&(cloth[:,:,3]==0))[0]):
                missing=np.where(snapped[cy]&(cloth[cy,:,3]==0))[0]
                donors=np.where(cloth[cy,:,3]>0)[0]
                if len(donors):
                    nearest=donors[np.argmin(abs(donors[None,:]-missing[:,None]),axis=1)]
                    cloth[cy,missing]=cloth[cy,nearest]
            cloth[~snapped]=0
            solid=cloth[:,:,3]>0
            interior=np.array(mask.filter(ImageFilter.MinFilter(31)))>0
            cloth[solid&~interior]=(24,23,20,255)
            # The approved torso and hands start above the trouser boundary.
            # Hidden far-hip pixels must not protrude around the shirt there.
            cloth[:40*UNIT]=0
        result.alpha_composite(Image.fromarray(cloth))
    else:
        result.alpha_composite(segment_pose(thigh,source_hip,source_knee,hip,knee))
        result.alpha_composite(segment_pose(shin,source_knee,source_ankle,knee,ankle))
    result.alpha_composite(posed_boot)
    return result,{'hip':hip.tolist(),'knee':knee.tolist(),'ankle':ankle.tolist(),'bootAngle':angle,'bootBaseline':baseline,'bootBounds':list(posed_boot.getbbox())}

def restore_cloth(layer, original, region, donors):
    """Reconstruct occluded cloth from exposed pixels on the same source row."""
    a=np.array(layer).copy()
    for y in np.unique(np.where(region)[0]):
        holes=np.where(region[y])[0];samples=np.where(donors[y])[0]
        if not len(samples):
            # A neighbouring source row is allowed only within one pixel block.
            for delta in range(1,2*UNIT+1):
                rows=[v for v in (y-delta,y+delta) if 0<=v<original.shape[0] and donors[v].any()]
                if rows:
                    donor_y=rows[0];samples=np.where(donors[donor_y])[0];break
            else:raise AssertionError(('Missing source clothing',y))
        else:donor_y=y
        nearest=samples[np.argmin(abs(samples[None,:]-holes[:,None]),axis=1)]
        # Restore hidden patches as hard pixel blocks, avoiding one-pixel
        # horizontal streaks when the nearest exposed sample varies per row.
        block_y=(donor_y//10)*10+5
        block_samples=np.where(donors[min(block_y,original.shape[0]-1)])[0]
        if len(block_samples):
            donor_y=block_y
            nearest=block_samples[np.argmin(abs(block_samples[None,:]-holes[:,None]),axis=1)]
        a[y,holes]=original[donor_y,nearest]
    return Image.fromarray(a)

def registered_arm(template,source,target):
    shoulder,elbow,wrist=map(np.array,source)
    target_shoulder,target_elbow,target_wrist=map(np.array,target)
    result=Image.new('RGBA',template.size)
    result.alpha_composite(segment_pose(slice_layer(template,y1=elbow[1]+.65),shoulder,elbow,target_shoulder,target_elbow))
    result.alpha_composite(segment_pose(slice_layer(template,y0=elbow[1]-.65,y1=wrist[1]+.55),elbow,wrist,target_elbow,target_wrist))
    hand_tip=target_wrist+(target_wrist-target_elbow)/np.linalg.norm(target_wrist-target_elbow)*2
    result.alpha_composite(segment_pose(slice_layer(template,y0=wrist[1]-.55),wrist,wrist+(0,2),target_wrist,hand_tip))
    return result,{'shoulder':target_shoulder.tolist(),'elbow':target_elbow.tolist(),'wrist':target_wrist.tolist()}

def right_contact(image,body,arms,template,bag,step):
    """Right contacts share the approved chunky trouser/boot artwork.

    Keep the original head/identity and complete the hidden torso/pelvis before
    articulating the limbs. A/B reverse anatomical arm and leg phases rather
    than mirroring the image, clothing, bag or character identity.
    """
    original=np.array(image);yy,xx=np.indices(original.shape[:2])
    r,g,b=original[:,:,:3].astype(float).transpose(2,0,1)
    visible=original[:,:,3]>0
    trouser=visible&(g>=r*.97)&(b<g*1.15)&(r>30)&(r<150)&(yy>=40*UNIT)&(yy<52*UNIT)&(xx>=12*UNIT)&(xx<23*UNIT)
    # Complete one trouser panel before deformation: no idle hand/boot pixels
    # or cropped ankle gaps are allowed inside the clothing silhouette.
    leg_region=polygon_mask(image.size,[(13.5,40),(21,40),(20.3,43.5),(18.7,47.8),
        (17.5,51.8),(18,52.5),(10.9,52.5),(11.3,49),(11.7,45),(12.5,41)])
    front=np.array(Image.open(ROOT/'src/assets/characters/player/down.png').convert('RGBA'))
    # Transfer complete front-view cargo-trouser clusters as a single panel.
    # Horizontal nearest-donor sampling made the old pants look striped/torn.
    source_panel=Image.fromarray(front[800:1010,208:368]).resize((210,251),Image.Resampling.NEAREST)
    panel=np.array(source_panel);pr,pg,pb=panel[:,:,:3].astype(float).transpose(2,0,1)
    valid=(panel[:,:,3]>0)&(pg>=pr*.95)&(pb<pg*1.2)&(pr>30)&(pr<150)
    donors_y,donors_x=np.where(valid)
    for py,px in zip(*np.where(~valid)):
        same=donors_y==py
        if same.any():
            options=donors_x[same];donor_x=options[np.argmin(abs(options-px))]
            panel[py,px]=panel[py,donor_x]
        else:
            nearest=np.argmin((donors_y-py)**2+(donors_x-px)**2)
            panel[py,px]=panel[donors_y[nearest],donors_x[nearest]]
    clean=Image.new('RGBA',image.size);clean.alpha_composite(Image.fromarray(panel),(215,800))
    template=part(clean,leg_region)
    # Restore the side of the vest exposed when the complete near sleeve moves.
    torso=Image.fromarray(body)
    torso_region=polygon_mask(image.size,[(13.5,26.8),(16,26.8),(21.5,30),(23.2,35),
        (23.5,40),(12.6,40),(12.6,34),(13.2,29)])
    body_a=np.array(torso)
    cloth=visible&(yy>=26.8*UNIT)&(yy<40*UNIT)&(xx>=9*UNIT)&(xx<22*UNIT)&((b>r*1.15)|((xx>=16*UNIT)&(r>140)&(g>95)&(b<g*.85)&(r<g*1.65)))
    torso=restore_cloth(torso,original,torso_region&(body_a[:,:,3]==0),cloth)
    # Fixed shirt sockets overlap moving sleeves instead of leaving white
    # notches at the shoulder. The exposed side below the sleeve is blue shirt.
    blue=(b>r*1.15)&(b>g*1.05)&visible&(yy>=26.8*UNIT)&(yy<40.8*UNIT)
    socket=polygon_mask(image.size,[(13.2,26.8),(15.6,26.8),(16,30),(13.1,31)])
    side=polygon_mask(image.size,[(12.6,32.5),(14.3,33),(14.3,40),(12.6,40)])
    torso=restore_cloth(torso,original,socket|side,blue)
    torso_a=np.array(torso);tr,tg,tb=torso_a[:,:,:3].astype(float).transpose(2,0,1)
    ghost_hand=(xx<16*UNIT)&(yy>=39*UNIT)&(yy<40*UNIT)&(tr>170)&(tr>tg*1.25)&(tg>95)&(tb>70)
    torso=restore_cloth(torso,original,ghost_hand,blue)
    torso_a=np.array(torso);torso_a[yy>=40*UNIT]=0;torso=Image.fromarray(torso_a)
    pelvis_region=polygon_mask(image.size,[(13.5,40),(24,40),(24,43.5),(22.5,45),
        (18.7,43.3),(13,42.6)])
    pelvis=restore_cloth(Image.new('RGBA',image.size),original,pelvis_region,trouser)
    leg_targets={'left':((18,40.3),(22.4,51.8)),'right':((15.6,40.3),(10.8,51.8))}
    arm_targets={'left':((14,28.2),(10.7,34.8),(10.6,40.1)),
                 'right':((21.5,28.2),(24,34.8),(28.2,38.2))}
    forward='left' if step in (1,3) else 'right'
    if step==2:
        # Pelvis rotates through the opposing contact. Swap hip/contact
        # registrations, keeping the same lengths, stride and ground line.
        leg_targets={'left':leg_targets['right'],'right':leg_targets['left']}
        arm_targets={'left':((14.9,28.2),(17.4,34.8),(21.6,38.2)),
                     'right':((21.1,28.2),(17.8,34.8),(17.7,40.1))}
    if step==3:
        # Passing A -> B: left support leg straight under the pelvis; right
        # swing leg bent and lifted. Arms pass close to the hips, not frozen
        # in either contact's extended pose. Do not interpolate whole images.
        leg_targets={'left':((17,39.3),(17,51.8)),
                     'right':((17.5,40.3),(18.6,51.8))}
        arm_targets={'left':((14.45,28.2),(14.05,35.2),(15.2,40.45)),
                     'right':((21.3,28.2),(20.9,35.2),(20.8,40.6))}
    if step in (2,3):
        # Advancing the near sleeve exposes the back of the shoulder that A's
        # backward sleeve covers. Restore that shirt socket beneath the moving
        # arm rather than leaving an empty triangle below the collar.
        back_socket=polygon_mask(image.size,[(12.2,26.8),(14.7,26.8),(16,29),
            (14.8,32),(12.6,34),(11.8,31)])
        torso=restore_cloth(torso,original,back_socket,blue)
        draw=ImageDraw.Draw(torso)
        draw.line([(round(x*UNIT),round(y*UNIT)) for x,y in
                   [(12.2,26.8),(11.8,31),(12.6,34)]],fill=(14,22,43,255),width=12)
    # The mask dilation previously picked up pale vest trim and rotated it
    # with the sleeve, creating the apparent white cut-out at the shoulder.
    clean_arms=[]
    for arm in arms:
        a=np.array(arm).copy();ar,ag,ab=a[:,:,:3].astype(float).transpose(2,0,1)
        vest_trim=(yy<34*UNIT)&(ar>120)&(ag>75)&(ab<ag*.9)
        a[vest_trim]=0;clean_arms.append(Image.fromarray(a))
    legs={};posed_arms={};measurements={}
    for limb,index in [('left',0),('right',1)]:
        hip,ankle=leg_targets[limb]
        lift_baseline=GROUND-CONTACT_FAR_DEPTH-2*UNIT if step==3 and limb=='right' else None
        legs[limb],leg_joints=pose_profile_leg(template,'right',limb,step,'left',limb==forward,hip,ankle,True,image,lift_baseline)
        posed_arms[limb],arm_joints=registered_arm(clean_arms[index],ARM_JOINTS['right'][index],arm_targets[limb])
        measurements[limb]={'legForward':limb==forward,'armForward':limb!=forward,'legBounds':list(legs[limb].getbbox()),'armBounds':list(posed_arms[limb].getbbox()),'legJoints':leg_joints,'armJoints':arm_joints}
        if step==3:
            measurements[limb].update(legForward=False,armForward=False,
                passingRole='support' if limb=='left' else 'swing')
    frame=Image.new('RGBA',image.size)
    # The near thigh must have an uninterrupted contour from hip to boot.
    # Drawing a wide pelvis patch over it hid which leg owned the front foot.
    for layer in [posed_arms['right'],legs['right'],pelvis,legs['left'],torso,bag,posed_arms['left']]:frame.alpha_composite(layer)
    return frame,measurements

def rig_player(direction,steps=(1,2)):
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
    for step in steps:
        forward_leg='left' if step==1 else 'right';forward_arm='right' if step==1 else 'left'
        posed_arms={};posed_legs={};measurements={}
        for limb in ([] if direction=='right' else ['left','right']):
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
        if direction=='right':
            frame,measurements=right_contact(image,body,arms,profile_template,bag,step)
        elif direction=='left':
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
        if step==3:report[str(step)].update(forwardLeg=None,forwardArm=None,phase='passing',between=['1','2'])
    return {'rig':'player-joints-v10-right-passing' if direction=='right' else 'player-joints-v3','idleSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'poses':report}

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--direction',choices=['down','right','up','left'])
    parser.add_argument('--step',type=int,choices=[1,2,3])
    args=parser.parse_args()
    if args.step==3 and args.direction!='right':parser.error('Passing C is registered for right only; pass --direction right --step 3')
    report_path=ROOT/'docs/character-rig-measurements.json'
    report=json.loads(report_path.read_text())
    directions=[args.direction] if args.direction else ['down','right','up','left']
    steps=(args.step,) if args.step else (1,2)
    for direction in directions:
        updated=rig_player(direction,steps)
        existing=report['player'][direction]
        existing['rig']=updated['rig'];existing['idleSha256']=updated['idleSha256']
        existing['poses'].update(updated['poses'])
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    print(f'Rebuilt {len(directions)*len(steps)} player walk poses; idles and all NPC assets unchanged.')
