"""Export the revised Blender portrait in Court Atlas athlete bind coordinates."""
import bpy, bmesh, math
from pathlib import Path
from mathutils import Vector
root=Path.cwd()
scene=bpy.context.scene
scene.frame_set(1)
# Sample the same anatomical throat used by the live rally rig in its bind pose.
with bpy.data.libraries.load(str(root/'scripts/assets/tennis/player-sculpts.blend')) as (_,library):
    library.objects=['NeckSkin']
throat=bmesh.new()
throat.from_mesh(library.objects[0].data)
cut=bmesh.ops.bisect_plane(throat,geom=[*throat.verts,*throat.edges,*throat.faces],
                           plane_co=(0,0,1.505),plane_no=(0,0,1),dist=1e-6)
socket=[v.co.copy() for v in cut['geom_cut'] if isinstance(v,bmesh.types.BMVert)]
throat.free()
center=sum(socket,Vector())/len(socket)
def angle(p,c):
    return math.atan2(p.y-c.y,p.x-c.x)
parts=[]
for obj in list(scene.objects):
    if obj.name.startswith(('Anatomical athlete','Eyeball','Hazel iris','Eye pupil','Catchlight','Chestnut underlayer','Swept locks','Wrapped cotton band','Headband knot','Headband tie')):
        for modifier in obj.modifiers:
            if modifier.type=='SUBSURF':modifier.levels=min(1,modifier.levels)
        bpy.context.view_layer.update()
        evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        data=bpy.data.meshes.new_from_object(evaluated)
        data.transform(evaluated.matrix_world)
        bm=bmesh.new();bm.from_mesh(data)
        if obj.name.startswith('Anatomical athlete'):
            # The match body supplies its own shoulders and lower neck.
            bmesh.ops.bisect_plane(bm,geom=[*bm.verts,*bm.edges,*bm.faces],
                                   dist=1e-6,plane_co=(0,0,1.622),
                                   plane_no=(0,0,1),clear_inner=True)
            rim=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-1.622)<1e-5 for v in e.verts)]
            rimverts={v for e in rim for v in e.verts}
            assert len(rimverts)>12
            upper=sum((v.co for v in rimverts),Vector())/len(rimverts)
            # Extend the existing skin surface into the moving collar. Leave a few
            # millimetres of overlap where neck and head have different weights.
            offset=Vector((0,.015,-.095))
            extruded=bmesh.ops.extrude_edge_only(bm,edges=rim)
            for v in extruded['geom']:
                if not isinstance(v,bmesh.types.BMVert):continue
                a=angle(v.co,upper)
                target=min(socket,key=lambda p:1-math.cos(angle(p,center)-a))
                v.co=center+(target-center)*.93-offset
                v.co.z-=.004
            # New faces have no facial UV detail. Use the match body's neck tone.
            neckmat=bpy.data.materials.new('Court neck skin')
            neckmat.diffuse_color=(.578,.31,.19,1)
            neckmat.use_nodes=True
            neckmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=neckmat.diffuse_color
            data.materials.append(neckmat)
            for face in extruded['geom']:
                if isinstance(face,bmesh.types.BMFace):face.material_index=len(data.materials)-1
        bm.to_mesh(data);bm.free()
        for v in data.vertices:v.co+=Vector((0,.015,-.095))
        part=bpy.data.objects.new('Court portrait',data);scene.collection.objects.link(part);parts.append(part)
        if len(data.polygons)>200:
            dec=part.modifiers.new('Court detail','DECIMATE');dec.ratio=.21
# The animated shirt collar opens into the torso as the head tilts. A closed
# tapered neck core overlaps both meshes even at the forehand's deepest lean.
bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,location=(0,.004,1.503))
core=bpy.context.object
core.name='Neck core'
core.scale=(.061,.071,.112)
core.data.materials.append(neckmat)
for polygon in core.data.polygons:polygon.use_smooth=True
parts.append(core)
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:obj.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.export_scene.gltf(filepath=str(root/'public/models/tennis/swept-player.glb'),use_selection=True,export_apply=True,export_animations=False,export_format='GLB')

