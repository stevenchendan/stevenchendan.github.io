"""Anatomical reference study using the project's CC0 MakeHuman base mesh."""
import bpy,math,gzip,random
from pathlib import Path
from collections import defaultdict
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1]
# Share only scene/material construction helpers with the previous study.
exec((ROOT/'scripts/create-tennis-player-v2.py').read_text().split('# Natural seven-and-a-half-head')[0])
OUT=ROOT/'output'/'tennis-player-reference';OUT.mkdir(parents=True,exist_ok=True)
random.seed(23)
navy=material('Navy inserts',(.018,.027,.055),.78)
volt=material('Lime seam accents',(.63,.78,.06),.6)
hairmat=material('Chestnut hair',(.042,.025,.014),.57)
hairhi=material('Hair highlights',(.075,.045,.025),.62)
iris=material('Hazel iris',(.075,.055,.028),.34)
pupil=material('Pupil',(.003,.003,.002),.24)
eyewhite=material('Warm sclera',(.66,.62,.55),.35)
skin.node_tree.nodes['Principled BSDF'].inputs['Subsurface Weight'].default_value=.08
img=bpy.data.images.load(str(ROOT/'.astro/skin-diffuse.jpg'));img.pack()
tex=skin.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img
skin.node_tree.links.new(tex.outputs['Color'],skin.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
tone=skin.node_tree.nodes.new('ShaderNodeMixRGB');tone.blend_type='MULTIPLY';tone.inputs[0].default_value=1; tone.inputs[2].default_value=(.72,.60,.49,1)
skin.node_tree.links.new(tex.outputs['Color'],tone.inputs[1]);skin.node_tree.links.new(tone.outputs[0],skin.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
verts=[];uv=[];groups=defaultdict(list);g=''
for line in (ROOT/'.astro/makehuman-base.obj').read_text().splitlines():
    s=line.split()
    if not s:continue
    if s[0]=='v':verts.append(Vector(tuple(map(float,s[1:4]))))
    elif s[0]=='vt':uv.append(tuple(map(float,s[1:3])))
    elif s[0]=='g':g=s[1]
    elif s[0]=='f':groups[g].append([(int(c.split('/')[0])-1,int(c.split('/')[1])-1 if '/' in c else 0) for c in s[1:]])
for name,amount in [('caucasian-male-young',1),('universal-male-young-maxmuscle-averageweight',.60)]:
    for l in gzip.open(ROOT/'.astro'/f'{name}.target.gz','rt'):
        if l and l[0].isdigit():
            i,x,y,z=l.split();verts[int(i)]+=Vector((float(x),float(y),float(z)))*amount
bodyids={i for f in groups['body'] for i,_ in f};low=min(verts[i].y for i in bodyids);high=max(verts[i].y for i in bodyids);scale=1.83/(high-low)
points=[Vector((p.x*scale,-p.z*scale,(p.y-low)*scale+.022)) for p in verts]
def joint(name):
    ids={i for f in groups['joint-'+name] for i,_ in f};return sum((points[i] for i in ids),Vector())/len(ids)
def shell(name,selected,m,offset=0,cloth=False):
    ids=sorted({i for f in selected for i,_ in f});lookup={i:j for j,i in enumerate(ids)}
    o=mesh(name,[points[i] for i in ids],[tuple(lookup[i] for i,_ in f) for f in selected],m,0)
    layer=o.data.uv_layers.new(name='UVMap')
    for poly,f in zip(o.data.polygons,selected):
        for li,(_,ti) in zip(poly.loop_indices,f):layer.data[li].uv=uv[ti]
    o.data.update()
    if offset:
        for v in o.data.vertices:
            p=v.co; wave=.0013*math.sin(p.z*95+p.x*31)*math.sin(p.x*56+p.y*33) if cloth else 0
            v.co+=v.normal*(offset+wave)
    if cloth:
        relax=o.modifiers.new('Relax garment surface','SMOOTH');relax.factor=.8;relax.iterations=9
    sub=o.modifiers.new('Anatomical subdivision','SUBSURF');sub.levels=2
    if cloth:
        sol=o.modifiers.new('Fabric thickness','SOLIDIFY');sol.thickness=.002
    return o
body=shell('Anatomical athlete',groups['body'],skin)
# Clothing follows the base topology, preserving continuous shoulders and crotch.
def shirtface(f):
    p=sum((points[i] for i,_ in f),Vector())/len(f); x=abs(p.x)
    return 1.005<p.z<1.585 and x<.305 and not (p.z>1.55 and x<.060)
shirtobj=shell('White performance shirt',[f for f in groups['body'] if shirtface(f)],white,.011,True)
shirtobj.data.materials.append(navy)
kit=white.copy();kit.name='Interpolated white and navy panels';shirtobj.data.materials[0]=kit
attr=shirtobj.data.color_attributes.new(name='KitColor',type='FLOAT_COLOR',domain='POINT')
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
for ve,c in zip(shirtobj.data.vertices,attr.data):
    x,y,z=ve.co
    shoulder=smooth(1.445,1.475,z)*smooth(.07,.11,abs(x))
    side=smooth(.13,.16,abs(x))*(1-smooth(.045,.075,abs(y)))*(1-smooth(1.36,1.41,z))
    t=max(shoulder,side);c.color=tuple(.84*(1-t)+v*t for v in (.018,.027,.055))+(1,)
    if z<1.08:ve.co.z-=.022*(1-smooth(1.01,1.08,z))
node=kit.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='KitColor'
ramp=kit.node_tree.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.43;ramp.color_ramp.elements[0].color=(.018,.027,.055,1);ramp.color_ramp.elements[1].position=.435;ramp.color_ramp.elements[1].color=(.84,.85,.86,1)
kit.node_tree.links.new(node.outputs['Color'],ramp.inputs[0]);kit.node_tree.links.new(ramp.outputs[0],kit.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
short=shell('White tailored tennis shorts',[f for f in groups['body'] if .735<sum(points[i].z for i,_ in f)/len(f)<1.028 and max(abs(points[i].x) for i,_ in f)<.27],white,.016,True)
for v in short.data.vertices:
    p=v.co
    if p.z>.97:p.z+=.025*smooth(.97,1.025,p.z)
    if p.z<.91:
        center=math.copysign(.135,p.x);p.x=center+(p.x-center)*1.16;p.y=(p.y+.006)*1.16-.006
# Remove covered body faces so cloth cannot reveal an underlying torso on posing.
import bmesh
bm=bmesh.new();bm.from_mesh(body.data)
remove=[]
for f in bm.faces:
    p=f.calc_center_median()
    if p.z<.135 or (.78<p.z<1.54 and ((p.z<1.0) or abs(p.x)<.29)):remove.append(f)
bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(body.data);bm.free()

# Native skeleton and deterministic weights make both preview poses editable.
bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='Tennis player pose rig';bpy.ops.object.mode_set(mode='EDIT');rig.data.edit_bones.remove(rig.data.edit_bones[0])
bones={}
def bone(name,a,b,parent=None):
    eb=rig.data.edit_bones.new(name);eb.head=a;eb.tail=b
    if parent:eb.parent=rig.data.edit_bones[parent]
    bones[name]=(Vector(a),Vector(b))
bone('Torso',(0,0,.94),(0,0,1.48))
bone('Head',(0,0,1.48),(0,0,1.82),'Torso')
for side in ('l','r'):
    shoulder,elbow,hand=[joint(side+'-'+part) for part in ('shoulder','elbow','hand')]
    hip,knee,ankle=[joint(side+'-'+part) for part in ('upper-leg','knee','ankle')]
    bone(side+'UpperArm',shoulder,elbow,'Torso');bone(side+'Forearm',elbow,hand,side+'UpperArm');bone(side+'Hand',hand,joint(side+'-finger-3-1'),side+'Forearm')
    bone(side+'Thigh',hip,knee,'Torso');bone(side+'Shin',knee,ankle,side+'Thigh');bone(side+'Foot',ankle,joint(side+'-foot-1'),side+'Shin')
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
def weights(p):
    x,y,z=p;side='l' if x>=0 else 'r'
    if z>1.57 and abs(x)<.13:return {'Head':1}
    if (z>1.21 and abs(x)>.195) or (z>.90 and abs(x)>.32):
        e=bones[side+'Forearm'][0];h=bones[side+'Hand'][0]
        if abs(x)>abs(h.x)-.015:return {side+'Hand':1}
        t=max(0,min(1,(abs(x)-abs(e.x)+.035)/.07))
        shoulderblend=max(0,min(1,(abs(x)-.195)/.055))
        return {'Torso':1-shoulderblend,side+'UpperArm':(1-t)*shoulderblend,side+'Forearm':t*shoulderblend}
    if z<.99:
        if z>.91:return {'Torso':max(0,(z-.91)/.08),side+'Thigh':min(1,(.99-z)/.08)}
        a=bones[side+'Foot'][0];k=bones[side+'Shin'][0]
        if z<a.z+.035:
            t=max(0,min(1,(z-a.z+.015)/.05));return {side+'Foot':1-t,side+'Shin':t}
        t=max(0,min(1,(z-k.z+.045)/.09));return {side+'Thigh':t,side+'Shin':1-t}
    return {'Torso':1}
def bind(o,rigid=None):
    if o.type=='CURVE':
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o=bpy.context.object
    if o.type!='MESH':return
    for name in bones:o.vertex_groups.new(name=name)
    for ve in o.data.vertices:
        w={rigid:1} if rigid else weights(o.matrix_world@ve.co)
        for name,value in w.items():
            if value>0:o.vertex_groups[name].add([ve.index],value,'REPLACE')
    mod=o.modifiers.new('Pose deformation','ARMATURE');mod.object=rig
    return o
for o in (body,shirtobj,short):bind(o)

# Bind seam welts to the actual garment boundaries, including the crew neckline.
for garment in ():
    counts=defaultdict(int)
    for f in garment.data.polygons:
        ids=list(f.vertices)
        for a,b in zip(ids,ids[1:]+ids[:1]):counts[tuple(sorted((a,b)))]+=1
    adj=defaultdict(list)
    for (a,b),count in counts.items():
        if count==1:adj[a].append(b);adj[b].append(a)
    pending=set(adj)
    while pending:
        start=pending.pop();order=[start];previous=None;current=start
        for _ in range(len(adj)):
            options=[i for i in adj[current] if i!=previous]
            if not options:break
            nxt=options[0]
            if nxt==start:break
            if nxt not in pending:break
            order.append(nxt);pending.discard(nxt);previous,current=current,nxt
        if len(order)<8:continue
        coords=[garment.data.vertices[i].co.copy() for i in order]
        for _ in range(4):coords=[p*.5+(coords[(j-1)%len(coords)]+coords[(j+1)%len(coords)])*.25 for j,p in enumerate(coords)]
        trim=curve('Tailored garment edge',coords,.004,white,True);bind(trim)

# Match the anatomical eye centers; eyelids come from the source mesh.
headparts=[]
for side in ('l','r'):
    e=joint(side+'-eye');r=.0147
    headparts.append(ell('Eyeball',e,(r,r,r),eyewhite))
    headparts.append(ell('Hazel iris',e+Vector((0,-r*.96,0)),(.0055,.0018,.0055),iris))
    headparts.append(ell('Eye pupil',e+Vector((0,-r*1.065,0)),(.0026,.00065,.0026),pupil))
    headparts.append(ell('Catchlight',e+Vector((-.0014,-r*1.1,.0018)),(.0008,.0005,.0008),white))
    s=1 if side=='l' else -1
    headparts.append(curve('Natural eyebrow',[(e.x+s*t,-.153+abs(t)*.12,e.z+.022+.004*math.cos(t*80)) for t in [-.018+i*.036/24 for i in range(25)]],.0027,hairmat))
# Close cropped base and layered wavy locks leave the forehead exposed.
hc=Vector((0,-.045,1.818))
headparts.append(ell('Hair volume',hc,(.09,.104,.068),hairmat))
for j in range(85):
    theta=random.uniform(0,math.tau);phi=random.uniform(.12,1.65)
    pts=[]
    for k in range(18):
        t=k/17;az=theta+.55*t;ph=phi-.32*t
        pts.append(hc+Vector((.094*math.sin(ph)*math.cos(az),.108*math.sin(ph)*math.sin(az),.071*math.cos(ph)))+Vector((0,0,.003*math.sin(t*math.tau*1.5))))
    headparts.append(curve('Wavy hair lock',pts,random.uniform(.002,.004),hairhi if j%5==0 else hairmat))
# Broad white headband with back knot and two tapered fabric tails.
headparts.append(loft('White cloth headband',[((0,-.045,1.779),.09,.100),((0,-.045,1.785),.092,.102),((0,-.045,1.813),.092,.102),((0,-.045,1.819),.09,.1)],white,0,1))
headparts.append(ell('Headband knot',(0,.058,1.795),(.018,.014,.016),white))
for s in (-1,1):
    vs=[(s*.004,.065,1.80),(s*.018,.067,1.796),(s*.033,.067,1.72),(s*.009,.07,1.727)]
    tail=mesh('Headband tie',vs,[(0,1,2,3)],white,1);mod=tail.modifiers.new('Tie thickness','SOLIDIFY');mod.thickness=.002;headparts.append(tail)
for o in headparts:bind(o,'Head')

# Socks, wristbands, and court shoes are separate editable pieces.
for side,s in [('l',1),('r',-1)]:
    wrist=bones[side+'Hand'][0];elbow=bones[side+'Forearm'][0]
    ob=segment('White wristband',wrist.lerp(elbow,.06),wrist.lerp(elbow,.25),[(0,.034,.035),(.05,.036,.037),(.95,.037,.039),(1,.035,.037)],white)
    bind(ob,side+'Forearm')
    ankle=bones[side+'Foot'][0];knee=bones[side+'Shin'][0]
    ob=segment('Crew sock',ankle-Vector((0,0,.025)),ankle.lerp(knee,.28),[(0,.041,.043),(.15,.044,.045),(.92,.046,.047),(1,.045,.046)],white);bind(ob,side+'Shin')
    x=ankle.x;y=ankle.y-.048
    shoeobjs=[]
    shoeobjs.append(loft('Sculpted trainer sole',[((x,y,.027),.053,.122),((x,y,.035),.06,.135),((x,y,.051),.061,.136),((x,y,.063),.057,.13)],sole,0,2))
    # Low forefoot and raised heel: a shoe-shaped surface, not a vertical ellipsoid.
    vs=[];fs=[];N=40
    for j in range(17):
        t=j/16;yy=y-.13+t*.25;rx=.058*math.sin(math.pi*(.08+.85*t))**.45
        h=.036+.04*math.exp(-((t-.75)/.24)**2)
        for k in range(N):
            a=k*math.tau/N;vs.append((x+rx*math.cos(a),yy,.065+h*math.sin(a)))
    for j in range(16):
        for k in range(N):fs.append((j*N+k,j*N+(k+1)%N,(j+1)*N+(k+1)%N,(j+1)*N+k))
    fs.extend([tuple(reversed(range(N))),tuple(16*N+k for k in range(N))]);shoeobjs.append(mesh('White court shoe upper',vs,fs,white,2))
    for j in range(6):
        yy=y-.025+j*.017;zz=.105+.024*math.exp(-((j-4)/3)**2)
        shoeobjs.append(curve('Shoe lace',[(x-.025,yy,zz),(x+.025,yy+.008,zz)],.002,white))
    for ss in (-1,1):
        shoeobjs.append(curve('Navy shoe panel',[(x+ss*.056,y-.06,.08),(x+ss*.055,y+.02,.085),(x+ss*.041,y+.07,.106)],.0035,navy))
        shoeobjs.append(curve('Lime outsole detail',[(x+ss*.057,y-.07,.043),(x+ss*.059,y,.044),(x+ss*.044,y+.08,.045)],.0024,volt))
    for o in shoeobjs:bind(o,side+'Foot')
for s in (-1,1):
    o=curve('Lime shoulder piping',[(s*.075,-.075,1.49),(s*.125,-.093,1.466),(s*.17,-.106,1.43),(s*.19,-.09,1.39)],.0015,volt);bind(o)

# Preserve rest geometry and store two pose keys on the same skeleton.
def setbone(name,a,b):
    a,b=Vector(a),Vector(b);length=(bones[name][1]-bones[name][0]).length
    rig.pose.bones[name].matrix=Matrix.LocRotScale(a,(b-a).to_track_quat('Y','Z'),Vector((1,(b-a).length/length,1)))
def keypose(frame,ready=False):
    bpy.context.scene.frame_set(frame)
    for p in rig.pose.bones:p.matrix_basis.identity()
    bpy.context.view_layer.update()
    for side,s in [('l',1),('r',-1)]:
        sh=bones[side+'UpperArm'][0]
        e=Vector((s*.275,-.035,1.23)) if not ready else Vector((s*.29,-.09,1.20))
        w=Vector((s*.335,-.06,1.005)) if not ready else Vector((s*.08,-.32,1.06))
        setbone(side+'UpperArm',sh,e);bpy.context.view_layer.update();setbone(side+'Forearm',e,w);bpy.context.view_layer.update()
        direction=Vector((s*.016,-.004,-.09)) if not ready else Vector((-s*.035,-.025,.025))
        setbone(side+'Hand',w,w+direction)
    for p in rig.pose.bones:
        p.rotation_mode='QUATERNION';p.keyframe_insert('location',frame=frame);p.keyframe_insert('rotation_quaternion',frame=frame);p.keyframe_insert('scale',frame=frame)
keypose(1);keypose(40,True)
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=40;scene.timeline_markers.new('Neutral reference stance',frame=1);scene.timeline_markers.new('Ready grip study',frame=40);scene.frame_set(1)

# Racket shown only in the ready-pose render.
racket=[];base=Vector((.015,-.355,1.06));axis=Vector((.25,0,.968)).normalized();u=Vector((axis.z,0,-axis.x))
def rp(x,z,d=0):return base+u*x+axis*z+Vector((0,d,0))
racket.append(curve('White racket grip',[rp(0,-.05),rp(0,.14)],.014,white))
for s in (-1,1):racket.append(curve('Racket throat',[rp(0,.14),rp(s*.027,.21),rp(s*.065,.27)],.007,black))
rx=.12;rz=.165;center=.40
pts=[rp(rx*math.cos(t),center+rz*math.sin(t)) for t in [j*math.tau/96 for j in range(96)]]
racket.append(curve('Black graphite racket',pts,.009,black,True))
for j in range(-7,8):
    x=j*.014;ext=rz*math.sqrt(1-(x/rx)**2);racket.append(curve('String main',[rp(x,center-ext),rp(x,center+ext)],.0007,string))
for j in range(-10,11):
    z=j*.014;ext=rx*math.sqrt(1-(z/rz)**2);racket.append(curve('String cross',[rp(-ext,center+z),rp(ext,center+z)],.0007,string))
for o in racket:o.hide_render=True;o.hide_set(True)

# White studio previews matching the supplied turnaround.
floor.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.65,.66,.68,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.017));finish(bpy.context.object,'Studio ground',floor)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,power,size):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,(0,0,1))
light('Soft key',(-3,-4,5),350,3);light('Fill',(3,-3,3),230,3);light('Hair rim',(1,3,4),450,2.5)
scene.world=bpy.data.worlds.new('White studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.68,.73,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
bpy.ops.object.camera_add(location=(2,-6,2.05));cam=bpy.context.object;aim(cam,(0,0,.94));cam.data.type='ORTHO';cam.data.ortho_scale=2.03;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.resolution_x=950;scene.render.resolution_y=1300;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'tennis-player-reference.blend'))
for name,loc in [('three-quarter',(2,-6,2.05)),('front',(0,-6,1.2)),('side',(6,0,1.2)),('back',(0,6,1.2))]:
    cam.location=loc;aim(cam,(0,0,.94));scene.render.filepath=str(OUT/f'player-{name}.png');bpy.ops.render.render(write_still=True)
scene.frame_set(40)
for o in racket:o.hide_render=False;o.hide_set(False)
cam.location=(1,-6,2);aim(cam,(0,-.02,.94));scene.render.filepath=str(OUT/'player-ready.png');bpy.ops.render.render(write_still=True)
print('REFERENCE_PLAYER_COMPLETE')
