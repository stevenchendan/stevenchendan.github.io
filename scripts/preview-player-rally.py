from pathlib import Path
import bpy, math,json
from mathutils import Vector,Matrix
out=Path.cwd()/'output/rally-court'
scene=bpy.context.scene
rig=bpy.data.objects['Tennis player pose rig']
rig.animation_data_clear()
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
scene.render.fps=30
bpy.data.objects['Studio ground'].hide_render=True
def load(i):
    old=set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(out/f'motion-{i}.glb'))
    objects=set(scene.objects)-old
    arm=next(o for o in objects if o.type=='ARMATURE')
    for o in objects:
        if o.type=='MESH' and ((i==0 and not o.name.startswith(('Stringbed','TennisBall'))) or (i==1 and o.name.startswith('TennisBall'))):o.hide_render=True
    return arm
src=load(0);opp=load(1)
def loc(n):
    return src.matrix_world@src.pose.bones[n].head
def axes(x,z):
    z=z.normalized();x=(x-z*x.dot(z)).normalized()
    return Matrix((x,z.cross(x),z)).transposed().to_quaternion()
def key(name,pos,rot,f):
    p=rig.pose.bones[name]; rest=p.bone.matrix_local
    m=(rot@rest.to_quaternion()).to_matrix().to_4x4();m.translation=pos
    p.matrix=m
    p.keyframe_insert('location',frame=f);p.keyframe_insert('rotation_quaternion',frame=f);p.keyframe_insert('scale',frame=f)
    bpy.context.view_layer.update()
# Use each source bone's live rotation relative to its own bind orientation.
bindworld=src.matrix_world.copy()
def orient(n):
    p=src.pose.bones[n]
    return ((src.matrix_world@p.matrix).to_quaternion() @ (bindworld@p.bone.matrix_local).to_quaternion().inverted())
for f in range(0,178,3):
    scene.frame_set(f)
    chest=axes(loc('LeftArm')-loc('RightArm'),loc('Neck')-loc('Hips'))
    key('Torso',loc('Hips'),chest,f)
    key('Head',loc('Neck'),chest,f)
    for side,pre in [('Left','l'),('Right','r')]:
        for dn,start,end in [('UpperArm','Arm','ForeArm'),('Forearm','ForeArm','Hand'),('Hand','Hand','HandIndex1'),('Thigh','UpLeg','Leg'),('Shin','Leg','Foot'),('Foot','Foot','ToeBase')]:
            p=rig.pose.bones[pre+dn];a=loc(side+start);b=loc(side+end)
            rest=p.bone.tail_local-p.bone.head_local
            axis=chest@rest
            rotation=axis.rotation_difference(b-a)@chest
            key(p.name,a,rotation,f)
def block(name,center,scale,color):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center);o=bpy.context.object;o.name=name;o.dimensions=scale
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.diffuse_color=(*color,1);o.data.materials.append(m)
    return o
block('Court surround',(0,0,-.10),(22,38,.2),(.044,.17,.26))
block('Blue hard court',(0,0,.015),(10.97,23.77,.035),(.021,.13,.31))
for x in (-5.485,-4.115,4.115,5.485):block('Court paint',(x,0,.037),(.052,23.77,.008),(.93,.94,.95))
for y in (-11.885,-6.4,6.4,11.885):block('Court paint',(0,y,.037),(10.97 if abs(y)>10 else 8.23,.052,.008),(.93,.94,.95))
block('Court paint',(0,0,.037),(.052,12.8,.008),(.93,.94,.95))
for x in (-6.4,6.4):block('Net posts',(x,0,.53),(.08,.08,1.06),(.035,.05,.06))
for i in range(129):block('Net cord',(-6.4+i*.1,0,.48),(.008,.012,.92),(.025,.031,.036))
for i in range(10):block('Net cord',(0,0,.05+i*.10),(12.8,.012,.008),(.025,.031,.036))
block('White net tape',(0,0,.96),(12.8,.035,.048),(.9,.91,.92))
for x in (-10,10):block('Sideline wall',(x,0,.68),(.15,37,1.36),(.023,.075,.115))
for y in (-18,18):block('Back wall',(0,y,.75),(20,.15,1.5),(.023,.075,.115))
scene.render.engine='BLENDER_WORKBENCH';sh=scene.display.shading;sh.color_type='MATERIAL';sh.light='STUDIO';sh.show_shadows=True;sh.show_cavity=False
# Match solid viewport materials to the rendered kit.
for o in scene.objects:
    if o.name.startswith('Anatomical athlete'):o.data.materials[0].diffuse_color=(.60,.34,.21,1)
    if o.name.startswith('White performance shirt') and o.data.color_attributes:
        o.data.materials.append(bpy.data.materials['Navy inserts'])
        attr=o.data.color_attributes.get('KitColor')
        for p in o.data.polygons:p.material_index=len(o.data.materials)-1 if sum(attr.data[i].color[0] for i in p.vertices)/len(p.vertices)<.43 else 0
for o in scene.objects:
    if o.name.startswith('TennisBall') and not o.hide_render:o.data.materials[0].diffuse_color=(.85,1,.025,1)
cam=scene.camera;cam.data.type='PERSP';cam.data.lens=37
track=json.loads((out/'track-0.json').read_text())
for f in range(0,178,3):
    x,z=track[f];target=Vector((x*.78,-z+.15,1.01))
    cam.location=target+Vector((3.15,-2.6,1.4));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.keyframe_insert('location',frame=f);cam.keyframe_insert('rotation_euler',frame=f)
scene.frame_start=0;scene.frame_end=175;scene.frame_step=3
scene.render.resolution_x=768;scene.render.resolution_y=432;scene.render.resolution_percentage=100
scene.display.render_aa='FXAA'
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/'frames'/'rally-')
scene.frame_set(24)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'courtside-rally.blend'))
bpy.ops.render.render(animation=True)
