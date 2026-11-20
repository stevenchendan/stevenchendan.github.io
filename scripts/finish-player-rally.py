import bpy,bmesh,math,json
from mathutils import Vector
from pathlib import Path
out=Path.cwd()/'output/rally-court';s=bpy.context.scene
def keep(o, predicate):
    bm=bmesh.new();bm.from_mesh(o.data);bm.verts.ensure_lookup_table()
    ids=[v.index for v in o.data.vertices if predicate(v)]
    bmesh.ops.delete(bm,geom=[bm.verts[i] for i in ids],context='VERTS');bm.to_mesh(o.data);bm.free()
def handweight(o,v):
    return sum(w.weight for w in v.groups if 'hand' in o.vertex_groups[w.group].name.lower())
body=bpy.data.objects['Anatomical athlete']
keep(body,lambda v:handweight(body,v)>.55)
source=bpy.data.objects['Human_Mesh'];print(source.name,len(source.vertex_groups))
keep(source,lambda v:handweight(source,v)<.40)
source.hide_render=False
skin=bpy.data.materials.new('Match grip skin');skin.diffuse_color=(.58,.34,.22,1);source.data.materials.clear();source.data.materials.append(skin)
s.display.shading.studio_light='paint.sl';s.display.shading.show_shadows=False
cam=s.camera;cam.animation_data_clear();track=json.loads((out/'track-0.json').read_text())
for f in range(0,178,3):
    x,z=track[f];wide=max(0,min(1,(f-33)/15,(126-f)/15));target=Vector((x*.85,-z+.50,.95)).lerp(Vector((0,-1,.6)),wide)
    pos=Vector((x*.85+2.8,-z-3.6,2.65)).lerp(Vector((5.4,-22.2,9.3)),wide)
    cam.location=pos;cam.rotation_euler=(target-pos).to_track_quat('-Z','Y').to_euler()
    cam.keyframe_insert('location',frame=f);cam.keyframe_insert('rotation_euler',frame=f)
s.frame_set(24);s.render.filepath=str(out/'final'/'return-');bpy.ops.wm.save_as_mainfile(filepath=str(out/'match-preview.blend'));bpy.ops.render.render(animation=True)
