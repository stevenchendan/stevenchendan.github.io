"""Standalone stylized tennis-player study. Run with Blender --background --python."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / 'output' / 'tennis-player-study'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, color, rough=.55, metal=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    s = m.node_tree.nodes.get('Principled BSDF')
    s.inputs['Base Color'].default_value = (*color, 1)
    s.inputs['Roughness'].default_value = rough
    s.inputs['Metallic'].default_value = metal
    return m

skin = mat('Warm terracotta skin', (.56,.29,.16))
hair = mat('Espresso hair', (.035,.021,.016))
shirt = mat('Deep teal performance knit', (.018,.23,.25))
navy = mat('Midnight navy shorts', (.018,.04,.065))
white = mat('Warm white', (.88,.9,.84))
lime = mat('Volt accents', (.7,.9,.06))
rubber = mat('Graphite racket and outsole', (.022,.033,.043), .35)
strings = mat('Natural strings', (.67,.7,.62))
eye = mat('Dark eyes', (.012,.018,.022), .2)
court = mat('Court blue', (.055,.16,.23))
ground = mat('Studio backdrop', (.11,.15,.19))

def finish(o, name, material):
    o.name = name
    o.data.materials.append(material)
    if o.type == 'MESH':
        for p in o.data.polygons: p.use_smooth = True
    return o

def ell(name, pos, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, location=pos)
    o = bpy.context.object
    o.scale = scale
    return finish(o, name, material)

def tube(name, points, radius, material, cyclic=False):
    c = bpy.data.curves.new(name, 'CURVE')
    c.dimensions = '3D'
    c.bevel_depth = radius
    c.bevel_resolution = 3
    s = c.splines.new('POLY')
    s.points.add(len(points)-1)
    for p, co in zip(s.points, points): p.co = (*co, 1)
    s.use_cyclic_u = cyclic
    o = bpy.data.objects.new(name, c)
    bpy.context.collection.objects.link(o)
    return finish(o, name, material)

def limb(name, a, b, r1, r2, material):
    a,b = Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=r1, radius2=r2, depth=(b-a).length, location=(a+b)/2)
    o=bpy.context.object
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    finish(o,name,material)
    bevel=o.modifiers.new('Soft tailored edges','BEVEL'); bevel.width=.022; bevel.segments=3
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def body(name, rings, material):
    verts=[]; faces=[]; n=48
    for z,rx,ry,cy in rings:
        for j in range(n):
            t=j*math.tau/n
            verts.append((rx*math.cos(t),cy+ry*math.sin(t),z))
    for i in range(len(rings)-1):
        for j in range(n): faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    faces.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+j for j in range(n))])
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); finish(o,name,material)
    sub=o.modifiers.new('Soft silhouette','SUBSURF'); sub.levels=2
    return o

# The player faces negative Y. Slightly bent knees and a two-hand ready grip.
body('Performance shirt',[(1.00,.21,.125,0),(1.025,.225,.14,0),(1.22,.215,.14,-.025),(1.46,.29,.15,-.055),(1.51,.255,.13,-.05),(1.55,.115,.08,-.04)],shirt)
body('Shorts waistband',[(.89,.22,.14,.02),(.98,.225,.145,.01),(1.035,.218,.135,0)],navy)
for side in (-1,1):
    hip=(side*.135,.02,.95); knee=(side*.25,-.09,.59); ankle=(side*.31,.04,.19)
    limb('Shorts leg', (side*.145,.015,.99),(side*.20,-.04,.76),.135,.143,navy)
    limb('Thigh',knee,(side*.19,-.03,.81),.085,.11,skin)
    ell('Knee',knee,(.086,.087,.09),skin)
    limb('Calf',ankle,knee,.052,.08,skin)
    limb('Crew sock',(side*.31,.04,.15),(side*.293,.008,.32),.058,.061,white)
    limb('Sock teal stripe',(side*.296,.012,.285),(side*.294,.009,.301),.062,.062,shirt)
    x=side*.32
    ell('Shoe outsole',(x,-.075,.065),(.095,.195,.045),rubber)
    ell('Shoe midsole',(x,-.08,.087),(.096,.195,.04),white)
    ell('Court shoe upper',(x,-.067,.125),(.088,.18,.065),white)
    tube('Shoe accent',[(x+side*.084,-.15,.13),(x+side*.089,-.055,.14),(x+side*.07,.035,.15)],.012,shirt)
    for j in range(4):
        y=-.14+j*.027
        tube('Lace',[(x-.038,y,.174),(x+.038,y+.008,.174)],.004,navy)

limb('Neck',(0,-.04,1.49),(0,-.055,1.67),.078,.074,skin)
ell('Head',(0,-.05,1.79),(.137,.119,.174),skin)
ell('Jaw',(0,-.083,1.7),(.105,.084,.087),skin)
for side in (-1,1):
    ell('Ear',(side*.135,-.048,1.785),(.025,.026,.042),skin)
    ell('Eye white',(side*.05,-.157,1.808),(.03,.012,.016),white)
    ell('Iris',(side*.047,-.169,1.808),(.011,.006,.012),eye)
    tube('Eyebrow',[(side*.023,-.161,1.839),(side*.05,-.165,1.845),(side*.078,-.151,1.84)],.007,hair)
ell('Nose',(0,-.172,1.774),(.023,.031,.036),skin)
tube('Mouth',[(-.032,-.163,1.726),(0,-.17,1.722),(.032,-.163,1.727)],.0035,hair)
ell('Cropped hair',(0,-.025,1.895),(.136,.113,.084),hair)
for j in range(9):
    x=(j-4)*.025
    tube('Swept hair ridge',[(x,-.105,1.902),(x+.02,-.055,1.968),(x+.025,.025,1.961)],.014,hair)
tube('Sweatband',[(.139*math.cos(t),-.047+.12*math.sin(t),1.874) for t in [j*math.tau/96 for j in range(96)]],.019,white,True)

for label,shoulder,elbow,wrist in [
    ('Right',(.255,-.045,1.45),(.36,-.12,1.19),(.14,-.43,1.17)),
    ('Left',(-.255,-.045,1.45),(-.30,-.23,1.23),(.235,-.43,1.305))]:
    s,e,w=map(Vector,(shoulder,elbow,wrist))
    limb(label+' sleeve',s,s+(e-s)*.43,.105,.095,shirt)
    limb(label+' upper arm',s+(e-s)*.35,e,.077,.064,skin)
    ell(label+' elbow',e,(.067,.065,.067),skin)
    limb(label+' forearm',e,w,.066,.044,skin)
    limb(label+' wristband',w+(e-w)*.1,w+(e-w)*.28,.051,.056,white)
    ell(label+' gripping hand',w,(.055,.044,.065),skin)

# Racket plane is vertical with a diagonal handle, built with real string geometry.
base=Vector((.14,-.43,1.17)); axis=Vector((.58,0,.815)).normalized(); across=Vector((axis.z,0,-axis.x))
def rp(u,v,depth=0): return base+across*u+axis*v+Vector((0,depth,0))
tube('Racket grip',[rp(0,-.06),rp(0,.17)],.025,rubber)
for j in range(12):
    v=-.055+j*.018
    tube('Grip wrap',[rp(.026*math.cos(t),v+.006*t/math.tau,.026*math.sin(t)) for t in [k*math.tau/24 for k in range(25)]],.0025,white)
for side in (-1,1): tube('Racket throat',[rp(0,.16),rp(side*.035,.25),rp(side*.105,.36)],.012,rubber)
center=.545; rx=.165; rz=.215
points=[rp(rx*math.cos(t),center+rz*math.sin(t)) for t in [j*math.tau/128 for j in range(128)]]
tube('Racket graphite hoop',points,.017,rubber,True)
tube('Racket volt rim',[p+Vector((0,-.014,0)) for p in points],.005,lime,True)
for j in range(-7,8):
    u=j*.02; ext=rz*math.sqrt(max(0,1-(u/rx)**2))
    tube('Main string',[rp(u,center-ext),rp(u,center+ext)],.0014,strings)
for j in range(-9,10):
    v=j*.021; ext=rx*math.sqrt(max(0,1-(v/rz)**2))
    tube('Cross string',[rp(-ext,center+v),rp(ext,center+v)],.0014,strings)
ball=Vector((-.60,-.26,.08))
ell('Tennis ball',ball,(.067,.067,.067),lime)
for side in (-1,1):
    tube('Ball seam',[ball+Vector((.067*math.cos(t),.067*math.sin(t)*math.cos(.65+side*.35*math.cos(2*t)),.067*math.sin(t)*math.sin(.65+side*.35*math.cos(2*t)))) for t in [j*math.tau/100 for j in range(101)]],.002,white)

bpy.ops.mesh.primitive_cylinder_add(vertices=128,radius=1.12,depth=.07,location=(0,0,-.045))
o=finish(bpy.context.object,'Court display plinth',court)
be=o.modifiers.new('Rounded platform edge','BEVEL'); be.width=.025; be.segments=3
tube('Baseline',[(-1,-.62,-.006),(.91,-.62,-.006)],.009,white)
tube('Sideline',[(-.73,-.8,-.005),(-.73,.8,-.005)],.009,white)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.084)); finish(bpy.context.object,'Studio floor',ground)

def aim(o,at): o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
def light(name,pos,power,size,color):
    bpy.ops.object.light_add(type='AREA',location=pos); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; o.data.color=color; aim(o,(0,0,1))
light('Large softbox',(-3,-4,6),650,4,(1,.88,.75))
light('Cool fill',(4,-2,3),450,3,(.70,.85,1))
light('Rim light',(1,3,4),800,3,(1,1,.92))
bpy.ops.object.camera_add(location=(3,-6,3.0)); cam=bpy.context.object; aim(cam,(.05,-.05,1)); cam.data.type='ORTHO'; cam.data.ortho_scale=2.85
scene=bpy.context.scene; scene.camera=cam
scene.render.engine='CYCLES'; scene.cycles.samples=48; scene.cycles.use_denoising=True
scene.render.resolution_x=1200; scene.render.resolution_y=1200; scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Studio world'); scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.19,.24,.3,1); scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.view_settings.view_transform='AgX'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
        area.spaces.active.shading.color_type='MATERIAL'
scene.render.filepath=str(OUT/'player-three-quarter.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'tennis-player-v1.blend'))
bpy.ops.render.render(write_still=True)
cam.location=(0,-6,2.5); aim(cam,(0,-.05,1)); scene.render.filepath=str(OUT/'player-front.png'); bpy.ops.render.render(write_still=True)
print('TENNIS_PLAYER_STUDY_COMPLETE',OUT)
