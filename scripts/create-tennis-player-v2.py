"""Reference-led mannequin study, generated entirely through Blender CLI."""
import bpy, math
from pathlib import Path
from mathutils import Vector

OUT=Path(__file__).resolve().parents[1]/'output'/'tennis-player-v2'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name,c,rough=.6):
    m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1); p.inputs['Roughness'].default_value=rough
    return m
purple=material('Aubergine performance fabric',(.105,.015,.155))
dark=material('Deep purple seams',(.047,.008,.07))
white=material('Ivory technical fabric',(.84,.85,.86))
skin=material('Warm ivory mannequin',(.66,.53,.38),.56)
black=material('Carbon graphite',(.012,.016,.021),.32)
orange=material('Coral racket frame',(.85,.085,.025),.36)
string=material('Silver racket strings',(.48,.5,.52),.48)
sole=material('Soft white shoe midsoles',(.78,.8,.79))
floor=material('Charcoal studio',(.075,.085,.098),.8)
for m in (purple,white):
    nt=m.node_tree; p=nt.nodes.get('Principled BSDF'); p.inputs['Sheen Weight'].default_value=.22
    tex=nt.nodes.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value=240; tex.inputs['Detail'].default_value=2
    bump=nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.13; bump.inputs['Distance'].default_value=.0006
    nt.links.new(tex.outputs['Fac'],bump.inputs['Height']); nt.links.new(bump.outputs['Normal'],p.inputs['Normal'])

def finish(o,name,m):
    o.name=name; o.data.materials.append(m)
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
    return o
def ell(name,p,s,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=28,location=p)
    o=bpy.context.object; o.scale=s; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,m)
def mesh(name,vs,fs,m,sub=0):
    data=bpy.data.meshes.new(name); data.from_pydata(vs,[],fs); data.update()
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); finish(o,name,m)
    if sub:
        mod=o.modifiers.new('Surface refinement','SUBSURF'); mod.levels=sub
    return o
def curve(name,pts,r,m,closed=False):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.bevel_depth=r; c.bevel_resolution=3
    s=c.splines.new('POLY'); s.points.add(len(pts)-1)
    for p,v in zip(s.points,pts):p.co=(*v,1)
    s.use_cyclic_u=closed
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); return finish(o,name,m)
def loft(name,rings,m,fold=0,sub=2):
    # rings: center, width, depth. Cross sections follow the centerline.
    vs=[]; fs=[]; n=48
    for i,(pos,rx,ry) in enumerate(rings):
        p=Vector(pos); tangent=Vector(rings[min(i+1,len(rings)-1)][0])-Vector(rings[max(0,i-1)][0])
        tangent.normalize(); u=Vector((1,0,0)); u=(u-tangent*u.dot(tangent)).normalized(); v=tangent.cross(u)
        for j in range(n):
            t=math.tau*j/n
            wave=fold*(.55*math.sin(t*7+i*1.4)+.3*math.sin(t*13-i*.9)+.15*math.sin(t*21+i*2))
            vs.append(p+u*(rx+wave)*math.cos(t)+v*(ry+wave)*math.sin(t))
    for i in range(len(rings)-1):
        for j in range(n):fs.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    fs.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+j for j in range(n))])
    return mesh(name,vs,fs,m,sub)
def segment(name,a,b,profile,m,fold=0):
    a,b=Vector(a),Vector(b)
    return loft(name,[(a.lerp(b,t),rx,ry) for t,rx,ry in profile],m,fold)
def fuse(name,objects,voxel=.004):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True); bpy.context.view_layer.objects.active=o
        for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join(); o=bpy.context.object; o.name=name
    rem=o.modifiers.new('Continuous sculpted anatomy','REMESH'); rem.mode='VOXEL'; rem.voxel_size=voxel; bpy.ops.object.modifier_apply(modifier=rem.name)
    sm=o.modifiers.new('Relax skin','SMOOTH'); sm.factor=.6; sm.iterations=5; bpy.ops.object.modifier_apply(modifier=sm.name)
    sub=o.modifiers.new('Skin finish','SUBSURF');sub.levels=1
    return o

# Natural seven-and-a-half-head proportions, with a forward step.
for label,hip,knee,ankle in [
    ('Forward',(.115,0,.92),(.21,-.12,.54),(.25,-.13,.16)),
    ('Trailing',(-.12,.025,.92),(-.29,.15,.52),(-.46,.22,.15))]:
    upper=segment(label+' thigh',hip,knee,[(0,.094,.10),(.2,.103,.105),(.5,.09,.095),(.8,.066,.074),(1,.06,.065)],skin)
    lower=segment(label+' calf',knee,ankle,[(0,.06,.065),(.2,.067,.074),(.4,.069,.078),(.65,.051,.058),(.9,.038,.044),(1,.037,.042)],skin)
    joint=ell(label+' patella',Vector(knee)+Vector((0,-.018,0)),(.06,.061,.065),skin)
    fuse(label+' continuous leg',[upper,lower,joint])
    a=Vector(ankle); socktop=a.lerp(Vector(knee),.30)
    segment(label+' ribbed crew sock',a+Vector((0,0,-.04)),socktop,[(0,.044,.049),(.1,.045,.05),(.7,.049,.053),(.97,.049,.053),(1,.05,.054)],white)
    segment(label+' sock cuff',socktop-Vector((0,0,.015)),socktop,[(0,.051,.055),(1,.051,.055)],white)
    for j in range(24):
        t=j*math.tau/24
        curve('Sock knit rib',[a+Vector((.045*math.cos(t),.05*math.sin(t),.0)),socktop+Vector((.05*math.cos(t),.054*math.sin(t),-.018))],.00065,white)
    # Shoe local coordinates, heel at +Y, toe at -Y.
    x,y=a.x,a.y-.035
    shoe=loft(label+' molded outsole',[((x,y,.025),.06,.133),((x,y,.032),.069,.148),((x,y,.052),.07,.15),((x,y,.065),.066,.144)],sole,0,2)
    loft(label+' purple shoe upper',[((x,y,.058),.065,.143),((x,y,.07),.067,.144),((x,y+.01,.10),.062,.128),((x,y+.04,.14),.048,.079),((x,y+.055,.155),.043,.062)],purple,0,2)
    ell('Shoe tongue',(x,y+.005,.14),(.033,.065,.019),purple)
    for j in range(6):
        yy=y-.045+j*.018; zz=.127+j*.004
        curve('Woven shoelace',[(x-.029,yy,zz),(x+.029,yy+.012,zz+.005)],.0025,dark)
        for s in (-1,1):ell('Eyelet',(x+s*.032,yy,zz),(.0035,.0035,.002),white)
    for s in (-1,1):
        curve('Shoe side stripe',[(x+s*.063,y-.078,.082),(x+s*.066,y-.025,.098),(x+s*.05,y+.045,.119)],.0045,white)
        curve('Shoe crossing stripe',[(x+s*.066,y-.06,.112),(x+s*.065,y-.012,.08)],.004,white)
    curve('Toe bumper',[(x+.063*math.cos(t),y-.02+.126*math.sin(t),.056) for t in [math.pi+j*math.pi/48 for j in range(49)]],.003,dark)

# Loose white shorts with irregular cloth folds, open-looking hems.
loft('Shorts hip', [((0,.01,.86),.18,.113),((0,.01,.94),.18,.115),((0,0,1.005),.157,.104)],white,.003)
for side in (-1,1):
    start=Vector((side*.095,.01,.96)); end=Vector((side*.16,(-.065 if side==1 else .075),.71))
    segment('Tailored white shorts',start,end,[(0,.096,.119),(.12,.111,.128),(.4,.112,.127),(.7,.117,.121),(.94,.108,.113),(1,.108,.113)],white,.004)
    segment('Double stitched shorts hem',start.lerp(end,.96),end+Vector((0,0,-.006)),[(0,.109,.114),(1,.109,.114)],white,.001)
    curve('Purple shorts piping',[start+Vector((side*.09,-.08,0)),start.lerp(end,.5)+Vector((side*.095,-.07,0)),end+Vector((side*.095,-.06,0))],.0025,purple)

# Shaped polo: shoulder and torso form one continuous tailored volume.
rings=[((0,0,.965),.175,.113),((0,0,.98),.177,.115),((-.008,0,1.03),.165,.112),((-.018,0,1.09),.154,.103),((-.025,0,1.17),.157,.106),((-.027,0,1.26),.182,.118),((-.025,0,1.35),.205,.121),((-.025,0,1.415),.219,.113),((-.025,0,1.45),.195,.10),((-.025,0,1.485),.094,.067)]
loft('Fitted purple polo',rings,purple,.0027)
loft('Polo lower hem', [((0,0,.963),.176,.114),((0,0,.979),.178,.116),((0,0,.988),.175,.114)],dark,.001)
for side in (-1,1):
    curve('White torso seam',[(side*.157,-.066,.984),(side*.142-.01,-.066,1.08),(side*.143-.025,-.075,1.18),(side*.166-.025,-.079,1.29)],.0024,white)
    curve('Shoulder piping',[(side*.065-.025,-.045,1.477),(side*.13-.025,-.078,1.451),(side*.195-.025,-.084,1.404)],.0026,white)
curve('Polo placket',[(-.025,-.074,1.47),(-.023,-.115,1.40),(-.02,-.123,1.33)],.008,dark)
curve('Placket white edge',[(-.014,-.077,1.47),(-.011,-.118,1.40),(-.009,-.126,1.33)],.0018,white)
for z in (1.435,1.397,1.36):ell('Polo button',(-.025,-.124 if z<1.42 else -.10,z),(.004,.002,.004),white)

# Neck and blank mannequin head have a restrained jaw and no cartoon features.
head=loft('Mannequin head',[((-.025,.0,1.55),.032,.045),((-.025,-.025,1.575),.052,.062),((-.025,-.021,1.615),.074,.076),((-.025,-.005,1.67),.085,.085),((-.025,.0,1.735),.082,.081),((-.025,.004,1.78),.065,.067),((-.025,.004,1.80),.025,.031)],skin)
neck=segment('Neck',(-.025,.015,1.45),(-.025,.015,1.62),[(0,.059,.058),(.4,.051,.052),(1,.052,.055)],skin)
ears=[ell('Ear',(-.025+s*.083,.005,1.67),(.017,.019,.031),skin) for s in (-1,1)]
fuse('Smooth faceless mannequin head',[head,neck,*ears],.003)
# Collar wraps the neck and falls into two pointed lapels.
curve('Raised polo collar',[(-.025+.076*math.cos(t),.012+.064*math.sin(t),1.49+.012*math.sin(t)) for t in [j*math.tau/96 for j in range(96)]],.018,purple,True)
for side in (-1,1):
    vs=[(-.025+side*.014,-.068,1.50),(-.025+side*.075,-.036,1.51),(-.025+side*.10,-.092,1.447),(-.025+side*.046,-.12,1.418)]
    o=mesh('Folded polo collar',vs,[(0,1,2,3)],purple,0)
    sol=o.modifiers.new('Fabric thickness','SOLIDIFY');sol.thickness=.006
    be=o.modifiers.new('Rounded collar edges','BEVEL');be.width=.006;be.segments=3

# One bent arm raised in celebration; the other drops behind with the racket.
arms=[('Raised',(.175,0,1.405),(.247,-.075,1.17),(.41,-.23,1.365)),('Racket',(-.225,0,1.40),(-.265,.06,1.15),(-.31,-.005,.965))]
for label,s,e,w in arms:
    s,e,w=map(Vector,(s,e,w))
    upper=segment(label+' upper arm',s,e,[(0,.071,.074),(.3,.076,.075),(.65,.064,.064),(1,.047,.05)],skin)
    fore=segment(label+' forearm',e,w,[(0,.048,.05),(.25,.057,.055),(.55,.048,.046),(1,.032,.035)],skin)
    joint=ell(label+' elbow',e,(.049,.052,.052),skin)
    fuse(label+' sculpted arm',[upper,fore,joint],.0035)
    segment(label+' polo sleeve',s-Vector((0,0,-.012)),s.lerp(e,.50),[(0,.074,.08),(.15,.083,.085),(.55,.085,.084),(.9,.077,.076),(1,.076,.075)],purple,.0025)
    segment(label+' sleeve welt',s.lerp(e,.47),s.lerp(e,.53),[(0,.077,.077),(1,.076,.075)],dark,.0007)
    if label=='Raised':
        segment('White sweat wristband',e.lerp(w,.73),w+Vector((.008,-.004,.009)),[(0,.041,.042),(.06,.043,.044),(.94,.041,.042),(1,.039,.04)],white)
        handcenter=w+Vector((.025,-.015,.04))
        parts=[ell('Fist palm',handcenter,(.041,.031,.053),skin)]
        for j in range(4):
            p=handcenter+Vector((-.024+j*.016,-.018,.035-(j==3)*.01))
            parts.append(ell('Curled finger',p,(.012,.022,.025),skin))
        parts.append(ell('Folded thumb',handcenter+Vector((-.026,-.029,-.001)),(.018,.015,.031),skin))
        fuse('Raised fist with fingers',parts,.002)
    else:
        parts=[ell('Racket palm',w+Vector((0,-.005,-.017)),(.036,.026,.048),skin)]
        for j in range(4):parts.append(ell('Grip fingers',w+Vector((.004,-.029,.012-j*.018)),(.031,.014,.011),skin))
        parts.append(ell('Grip thumb',w+Vector((.025,-.024,.014)),(.014,.013,.028),skin))
        fuse('Racket gripping hand',parts,.002)

# Structured six-panel baseball cap and curved projecting visor.
cx=-.025; cy=.008; zbase=1.728
vs=[]; fs=[]; n=96; rows=18
for i in range(rows):
    a=(i/(rows-1))*(math.pi/2-.015)
    for j in range(n):
        t=j*math.tau/n
        vs.append((cx+.091*math.cos(a)*math.cos(t),cy+.09*math.cos(a)*math.sin(t),zbase+.105*math.sin(a)))
for i in range(rows-1):
    for j in range(n):fs.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
mesh('Purple baseball cap crown',vs,fs,purple,1)
ell('Cap top button',(cx,cy,zbase+.105),(.009,.009,.005),dark)
for j in range(6):
    t=j*math.tau/6
    curve('Cap panel stitching',[(cx+.092*math.cos(a)*math.cos(t),cy+.091*math.cos(a)*math.sin(t),zbase+.106*math.sin(a)) for a in [i*(math.pi/2-.06)/40 for i in range(41)]],.0011,dark)
vs=[];fs=[]
for k in range(7):
    f=k/6
    for j in range(49):
        t=-math.pi/2+j*math.pi/48
        x=.093*math.sin(t); yy=-.063*math.cos(t)-.015-f*.072*math.cos(t)
        zz=zbase-.01-.017*f-.015*(abs(math.sin(t))**2)
        vs.append((cx+x,cy+yy,zz))
for k in range(6):
    for j in range(48):fs.append((k*49+j,k*49+j+1,(k+1)*49+j+1,(k+1)*49+j))
o=mesh('Curved cap visor',vs,fs,purple,2);mod=o.modifiers.new('Visor thickness','SOLIDIFY');mod.thickness=.005
# Small original crest rather than duplicating the reference brand mark.
curve('Cap white crest',[(cx+.012*math.cos(t),-.080,1.767+.015*math.sin(t)) for t in [j*math.tau/48 for j in range(49)]],.0024,white)
curve('Chest crest',[(-.105+.011*math.cos(t),-.119,1.365+.014*math.sin(t)) for t in [j*math.tau/48 for j in range(49)]],.002,white)

# Racket hangs beside the rear leg, with a long wrapped grip and oval stringbed.
base=Vector((-.31,-.025,.965)); axis=Vector((.12,.03,-.993)).normalized(); u=Vector((axis.z,0,-axis.x)).normalized(); v=axis.cross(u)
def rp(x,z,d=0):return base+u*x+axis*z+v*d
curve('Racket handle',[rp(0,-.15),rp(0,.035)],.014,white)
for j in range(16):curve('Handle spiral',[rp(.0145*math.cos(t),-.148+j*.011+.003*t/math.tau,.0145*math.sin(t)) for t in [k*math.tau/24 for k in range(25)]],.001,dark)
for s in (-1,1):curve('Racket throat',[rp(0,.027),rp(s*.025,.11),rp(s*.065,.17)],.007,black)
rx=.118;rz=.162;center=.30
pts=[rp(rx*math.cos(t),center+rz*math.sin(t)) for t in [j*math.tau/96 for j in range(96)]]
curve('Graphite hoop',pts,.010,black,True);curve('Coral frame stripe',[p+v*.009 for p in pts],.003,orange,True)
for j in range(-7,8):
    x=j*.014; ext=rz*math.sqrt(1-(x/rx)**2);curve('Racket main',[rp(x,center-ext),rp(x,center+ext)],.0008,string)
for j in range(-10,11):
    z=j*.014; ext=rx*math.sqrt(1-(z/rz)**2);curve('Racket cross',[rp(-ext,center+z),rp(ext,center+z)],.0008,string)

bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.005));finish(bpy.context.object,'Studio ground',floor)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,power,size,color):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;aim(o,(0,0,1))
light('Soft key',(-3,-4,5),400,3,(1,.92,.83));light('Soft fill',(3,-3,2.5),200,2.5,(.8,.88,1));light('Rim',(1,3,3.5),500,2,(.9,.9,1))
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Neutral studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.18,.21,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.3
bpy.ops.object.camera_add(location=(2.6,-6,2.65));cam=bpy.context.object;aim(cam,(-.025,0,.94));cam.data.type='ORTHO';cam.data.ortho_scale=2.13;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True;scene.render.resolution_x=1100;scene.render.resolution_y=1400;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.color_type='MATERIAL'
scene.render.filepath=str(OUT/'player-v2-three-quarter.png');bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'tennis-player-v2.blend'));bpy.ops.render.render(write_still=True)
cam.location=(0,-6,2.1);aim(cam,(-.025,0,.94));scene.render.filepath=str(OUT/'player-v2-front.png');bpy.ops.render.render(write_still=True)
print('REFERENCE_STUDY_COMPLETE')
