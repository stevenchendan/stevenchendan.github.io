import bpy, math, random
from mathutils import Vector
from pathlib import Path
out=Path(bpy.data.filepath).parent
for o in list(bpy.data.objects):
    if o.name.startswith(('Hair volume','Wavy hair lock','White cloth headband','Natural eyebrow')): bpy.data.objects.remove(o,do_unlink=True)
body=bpy.data.objects['Anatomical athlete']
from mathutils.bvhtree import BVHTree
tree=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
C=Vector((0,-.051,1.756))
def surface(t,a):
    d=Vector((math.sin(a)*math.cos(t),math.sin(a)*math.sin(t),math.cos(a)))
    hit=tree.ray_cast(C+d*.32,-d,.45)[0]
    r=1/math.sqrt((d.x/.084)**2+(d.y/.103)**2+(d.z/.101)**2); return C+d*r if a>1.55 else (hit if hit is not None else C+d*r)
def obj(name,vs,fs,col):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o)
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True; shader=m.node_tree.nodes.get("Principled BSDF");shader.inputs["Base Color"].default_value=(*col,1);shader.inputs["Roughness"].default_value=.68;o.data.materials.append(m)
    for p in me.polygons:p.use_smooth=True
    rig=bpy.data.objects['Tennis player pose rig'];o.parent=rig;o.parent_type='BONE';o.parent_bone='Head';bpy.context.view_layer.update();o.matrix_world=__import__('mathutils').Matrix.Identity(4)
    return o
def limit(t):return 1.82+.64*math.sin(t)+.06*math.sin(5*t)
def point(t,a,h):
    p=surface(t,a);return p+(p-C).normalized()*h
def grid(name,n,k,fn,col):
    vs=[fn(i*math.tau/n,j/(k-1)) for j in range(k) for i in range(n)]
    fs=[(j*n+i,(j+1)*n+i,(j+1)*n+(i+1)%n,j*n+(i+1)%n) for j in range(k-1) for i in range(n)]
    return obj(name,vs,fs,col)
grid('Chestnut underlayer',144,45,lambda t,u:point(t,.001+u*limit(t),.007+.005*(1-u)),(.04,.021,.011))
grid('Wrapped cotton band',144,9,lambda t,u:point(t,1.29+.32*u+.075*math.sin(t),.012+.001*math.sin(math.pi*u)),(.87,.87,.84))
random.seed(36)
for layer in range(3):
    vs=[];fs=[]
    for l in range(54):
        start=l*math.tau/54+random.uniform(-.026,.026);end=limit(start)+random.uniform(-.08,.08)
        lo,hi=[(.01,.67),(.32,.93),(.61,1.02)][layer]
        for j in range(27):
            u=j/26;a=.018+end*(lo+(hi-lo)*u);t=start+.57*(1-u)+.11*math.sin(u*6+start)
            taper=math.sin(math.pi*u)**.7
            for k in range(9):
                v=(k-4)/4;ang=t+v*(.022+.093*taper)
                h=.008+.004*(1-a/2.5)+.012*taper*(1-v*v)+.0008*math.cos(v*17)*taper
                if 1.26+.075*math.sin(ang)<a<1.64+.075*math.sin(ang):h*=.38
                vs.append(point(ang,a,h))
            if j:
                b=len(vs)-18
                for k in range(8):fs.append((b+k,b+9+k,b+10+k,b+1+k))
    obj('Swept locks '+str(layer),vs,fs,[(.050,.026,.013),(.059,.032,.018),(.047,.024,.013)][layer])
scene=bpy.context.scene
bpy.ops.wm.save_as_mainfile(filepath=str(out/'player-swept-hair.blend'))
cam=scene.camera;cam.location=(.43,-2.3,1.85);cam.rotation_euler=(Vector((0,-.04,1.7))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.48
scene.render.resolution_x=650;scene.render.resolution_y=700;scene.cycles.samples=12;scene.render.filepath=str(out/'swept-hair-preview.png');bpy.ops.render.render(write_still=True)

