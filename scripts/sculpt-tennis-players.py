"""Build the four Court Atlas player portraits, shared neck, hands and shoes.

blender -b --python scripts/sculpt-tennis-players.py -- <asset directory> <output.glb>
The input directory contains makehuman-base.obj from
https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj
and the three CC0 MPFB macro shapes named below, from
https://github.com/makehumancommunity/mpfb2/tree/master/src/mpfb/data/targets/macrodetails. The generated GLB is an intermediate for pack-rally-athlete.
"""
import bpy
import gzip
import math
import random
import sys
from collections import defaultdict
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

TAU = math.tau
arguments=sys.argv[sys.argv.index('--')+1:]

def export_model(output):
    bpy.ops.export_scene.gltf(filepath=str(output.resolve()),export_format='GLB',export_yup=True,export_texcoords=False,export_animations=False)

if arguments[0]=='--export-only':
    # Portraits are side by side in the editable studio file. The runtime
    # expects each head at its own actor's bind origin.
    for obj in bpy.context.scene.objects: obj.location=(0,0,0)
    export_model(Path(arguments[1]))
    sys.exit(0)

source_dir,output=map(Path,arguments)
bpy.ops.wm.read_factory_settings(use_empty=True)

def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4

def colour(code):
    return Vector([linear(int(code[i:i+2], 16) / 255) for i in (0, 2, 4)])

material = bpy.data.materials.new('Painted skin, cloth and equipment')
material.use_nodes = True
shader = material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value = .74
vertex_colour = material.node_tree.nodes.new('ShaderNodeVertexColor')
vertex_colour.layer_name = 'Colour'
material.node_tree.links.new(vertex_colour.outputs['Color'], shader.inputs['Base Color'])

class Sculpture:
    def __init__(self):
        self.positions, self.colours, self.faces = [], [], []

    def surface(self, points, faces, colours):
        start = len(self.positions)
        self.positions.extend(points)
        if isinstance(colours, str):
            self.colours.extend([colour(colours)] * len(points))
        else:
            self.colours.extend(colours)
        self.faces.extend([tuple(start + i for i in face) for face in faces])

    def grid(self, rows, cols, function, tint, wrap=True):
        points = [function(i, j) for i in range(rows) for j in range(cols)]
        faces = []
        for i in range(rows-1):
            for j in range(cols if wrap else cols-1):
                k = (j + 1) % cols
                faces.append((i*cols+j, i*cols+k, (i+1)*cols+k, (i+1)*cols+j))
        self.surface(points, faces, tint)

    def ellipsoid(self, centre, scale, tint, cols=14, rows=8):
        c = Vector(centre)
        def point(i,j):
            a = math.pi * (i+.01)/(rows-.98) - math.pi/2
            a = min(a, math.pi/2-.001)
            b = TAU*j/cols
            return c + Vector((math.cos(a)*math.cos(b)*scale[0], math.cos(a)*math.sin(b)*scale[1], math.sin(a)*scale[2]))
        self.grid(rows,cols,point,tint)

    def tube(self, points, radii, tint, sides=5):
        path = list(map(Vector, points))
        if isinstance(radii,(int,float)):
            radii = [radii]*len(path)
        rows = []
        prior = None
        for i,p in enumerate(path):
            tangent = (path[min(len(path)-1,i+1)]-path[max(0,i-1)]).normalized()
            x = prior or tangent.orthogonal()
            x = (x-tangent*x.dot(tangent)).normalized()
            y = tangent.cross(x).normalized()
            prior = x
            rows.append([p + radii[i]*(x*math.cos(j*TAU/sides)+y*math.sin(j*TAU/sides)) for j in range(sides)])
        self.grid(len(path),sides,lambda i,j:rows[i][j],tint)

    def object(self, name):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.positions, [], self.faces)
        mesh.update()
        obj = bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(obj)
        mesh.materials.append(material)
        colors = mesh.color_attributes.new(name='Colour',type='BYTE_COLOR',domain='POINT')
        for d,c in zip(colors.data,self.colours): d.color = (*c,1)
        for p in mesh.polygons: p.use_smooth = True
        # Consolidated parts include independent eye, scalp, hem and shoe shells.
        # Recalculate each shell consistently for back-face culling in WebGL.
        import bmesh
        bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
        mesh.update()
        return obj

verts, groups = [], defaultdict(list)
uvs, skin_uv = [], {}
group = ''
for line in (source_dir/'makehuman-base.obj').read_text(encoding='utf-8').splitlines():
    if line.startswith('v '): verts.append(Vector(tuple(map(float,line.split()[1:4]))))
    elif line.startswith('vt '): uvs.append(tuple(map(float,line.split()[1:3])))
    elif line.startswith('g '): group=line[2:].strip()
    elif line.startswith('f '):
        corners=[k.split('/') for k in line.split()[1:]]
        groups[group].append(tuple(int(k[0])-1 for k in corners))
        if group=='body':
            for k in corners:
                if len(k)>1 and k[1]: skin_uv[int(k[0])-1]=uvs[int(k[1])-1]

# Bake the CC0 MakeHuman complexion into the face vertices. Pigment follows
# the source UVs through each morph, retaining the lips, lids and beard shadow.
def complexion_samples():
    texture=source_dir/'young_lightskinned_male_diffuse.png'
    if not texture.exists(): texture=source_dir/'skin-diffuse.jpg'
    image=bpy.data.images.load(str(texture.resolve()))
    import numpy as np
    w,h=image.size
    pixels=np.empty(w*h*4,dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgb=pixels.reshape(h,w,4)[:,:,:3]
    return {i:Vector(rgb[min(h-1,int(v*h)),min(w-1,int(u*w))]) for i,(u,v) in skin_uv.items()}

complexion=complexion_samples()

def target(name):
    with gzip.open(source_dir/(name+'.target.gz'),'rt') as file:
        return [(int(a),Vector((float(x),float(y),float(z)))) for a,x,y,z in (l.split() for l in file if l[0].isdigit())]

shape_a=target('caucasian-male-young')
shape_b=target('african-male-young')
athletic=target('universal-male-young-maxmuscle-averageweight')

def centre(points): return sum(points,Vector((0,0,0)))/len(points)

def portrait_shape(near,style=''):
    v=[p.copy() for p in verts]
    mix={'crop':.62,'tie':.43}.get(style,.87 if near else .17)
    for morph,amount in [(shape_a,mix),(shape_b,1-mix),(athletic,.65 if near else .84)]:
        for i,d in morph: v[i] += d*amount
    ids=lambda g:set(k for face in groups[g] for k in face)
    eye=centre([v[i] for i in ids('joint-l-eye')]); top=max(v[i].y for i in ids('body'))
    scale=(.137 if near else .140)/(top-eye.y)
    def world(p):
        # Centre the transformed head on the rig's upper neck. +Z in the OBJ
        # faces the net; Blender -Y exports as glTF +Z in the bind pose.
        return Vector((p.x*scale*(1.015 if near else 1.055),-(p.z-eye.z)*scale-.063,1.663+(p.y-eye.y)*scale))
    return [world(p) for p in v], {side: world(centre([v[i] for i in ids('joint-l-eye' if side==1 else 'joint-r-eye')])) for side in (-1,1)}, scale

def portrait(near, canonical,style):
    art=Sculpture()
    fitted, eyes, scale = portrait_shape(near,style)
    tone={'crop':'b57c5a','tie':'ac7457'}.get(style,'c89779' if near else '8c5c45')
    base_skin=colour(tone)
    cheek=colour('ce8c72' if near else '955e46')
    lips=colour('a5655c' if near else '794b46')
    shadow=colour('9a7765' if near else '604638')
    # The jaw and deforming throat meet along shared anatomical mesh edges.
    upper=[f for f in groups['body'] if min(verts[i].y for i in f)>4.60]
    polys=[f for f in upper if min(verts[i].y for i in f)>6.22]
    throat=[f for f in upper if min(verts[i].y for i in f)<=6.22]
    boundary={i for f in throat for i in f}
    if style=='cap':
        neck=Sculpture()
        ni=sorted(boundary); lookup={v:i for i,v in enumerate(ni)}
        neck.surface([fitted[i] for i in ni],[tuple(lookup[i] for i in f) for f in throat],'c89779')
        neck.object('NeckSkin')
    selected=sorted(set(i for f in polys for i in f)); ix={old:i for i,old in enumerate(selected)}
    points=[]
    for i in selected:
        t=0 if i in boundary else max(0,min(1,(verts[i].y-6.22)/.30))
        points.append(canonical[i].lerp(fitted[i],t*t*(3-2*t)))
    faces=[tuple(ix[i] for i in f) for f in polys]
    pigments=[]
    for i in selected:
        x,y,z=verts[i]; x=abs(x)
        blush=math.exp(-((x-.51)/.28)**2-((y-6.97)/.24)**2)*max(0,min(1,(z-.6)*2))
        mouth=math.exp(-(x/.245)**4-((y-6.53)/.063)**4)*max(0,min(1,(z-1.35)*10))
        stubble=math.exp(-((y-6.39)/.31)**2)*max(0,min(1,(z-.35)*2))*(.34 if near else .22)
        flat=base_skin.lerp(cheek,blush*.38).lerp(shadow,stubble*.68).lerp(lips,mouth*.65)
        sample=complexion[i]
        detail=Vector(tuple(flat[k]*max(.22,min(1.65,(sample[k]/ref)**.65)) for k,ref in enumerate((.55,.285,.19))))
        pigments.append(flat.lerp(detail,max(0,min(.87,(y-6.24)*3))))
    art.surface(points,faces,pigments)
    bvh=BVHTree.FromPolygons(points,faces,all_triangles=False)
    def skin_at(x,z):
        p=bvh.ray_cast(Vector((x,-.32,z)),Vector((0,1,0)))[0]
        return p if p else Vector((x,-.091,z))
    for side in [-1,1]:
        e=eyes[side]
        radius=scale*.143
        # Iris and sclera share a convex surface, so lids can occlude the eye.
        arows=[0,.09,.16,.235,.285,.36,.405,.435,.53,.69,.93,1.19,1.51,1.90,2.40,3.12]
        cols=36
        iris=colour('634b34' if near else '36291e');rim=colour('32291f');white=colour('d6cbc1')
        eyedots=[];eye_col=[]
        for row,a in enumerate(arows):
            for j in range(cols):
                t=j*TAU/cols
                eyedots.append(e+Vector((radius*math.sin(a)*math.cos(t),-radius*math.cos(a),radius*math.sin(a)*math.sin(t))))
                shade=colour('1e1916') if a<.16 else iris*(.83+.17*math.sin(11*t+row)) if a<=.405 else rim if a<.435 else white
                eye_col.append(shade)
        art.grid(len(arows),cols,lambda i,j:eyedots[i*cols+j],eye_col)
        art.ellipsoid(e+Vector((-.0025,-radius*.975,.0027)),(.00125,.00045,.00085),'f1f4ed',8,5)
        # Brows follow the individual brow ridge, formed from tapered hair ribbons.
        eye_x=abs(e.x)
        for layer in range(3):
            brow=[];radii=[]
            for j in range(13):
                t=j/12;x=side*(eye_x-.019+.047*t)
                z=e.z+.014+.006*math.sin(t*math.pi)-.003*t+layer*.0009
                p=skin_at(x,z);p.y-=.00075;brow.append(p)
                radii.append(.00045+.00135*math.sin(math.pi*t)**.5)
            art.tube(brow,radii,'49382d' if near else '302720',4)
    # A ray-fit hairline and cap follow each individual skull and ears.
    centre_y=.008; crown=max(p.z for p in points)
    def scalp(t,z,offset):
        d=Vector((math.sin(t),-math.cos(t),0))
        p=bvh.ray_cast(Vector((0,centre_y,z))+d*.32,-d)[0]
        if p is None:
            ht=max(0,1-((z-(crown-.11))/.112)**2)**.5
            p=Vector((.088*ht*d.x,centre_y+.112*ht*d.y,z))
        return p+d*offset
    def hairline(t):
        f=(1+math.cos(t))/2
        return 1.609+.106*f**1.65+.011*math.cos(2*t)*f
    def hairpoint(i,j):
        t=TAU*j/64;f=i/12;z=hairline(t)+(crown-hairline(t)-.001)*math.sin(f*math.pi/2)
        p=scalp(t,z,.003 if near else .006+.0015*math.sin(19*t+2*f));p.z+=.002 if near else .005+f*.004
        return p
    hair={'cap':'3a302a','band':'2a2521','crop':'644331','tie':'292726'}[style]
    art.grid(13,64,hairpoint,hair)
    if style=='crop' or style=='tie':
        # Angled locks run from the temple over the crown. The tied cut adds
        # a gathered coil behind the occiput, visible from the follow camera.
        for k in range(56):
            t=TAU*k/56
            path=[]
            for j in range(12):
                f=j/12; a=t+(.54 if style=='crop' else -.32)*f
                z=hairline(a)+(crown-hairline(a)-.001)*math.sin(f*math.pi/2)
                p=scalp(a,z,.005+.003*math.sin(math.pi*f));p.z+=.003+.006*f
                path.append(p)
            art.tube(path,[.001+.0027*math.sin(math.pi*j/12) for j in range(12)],'6c4e39' if style=='crop' else '35312e',5)
        if style=='tie':
            knot=scalp(math.pi,1.69,.016)
            art.ellipsoid(knot,(.041,.039,.035),'302b29',22,14)
            art.ellipsoid(knot+Vector((.001,.024,.01)),(.033,.027,.026),'332e2b',20,12)
    elif near:
        def cap(t,h):
            bottom=1.695+.010*math.cos(t);a=h*math.pi/2
            z=bottom+(crown-bottom-.0004)*math.sin(a)
            p=scalp(t,z,.006+(.006*math.cos(a)));p.z+=.003+.008*math.sin(a)
            return p
        art.grid(14,64,lambda i,j:cap(TAU*j/64,i/13),'efece2')
        for k in range(6):
            t=(k+.5)*TAU/6
            stitch=[cap(t,.04+i*.915/18) for i in range(19)]
            art.tube(stitch,.00085,'bfc5bd',4)
        for side in (-1,1):
            for ii in range(3):
                for jj in range(5):
                    theta=side*(1.45+.092*jj+.042*(ii%2));p=cap(theta,.22+ii*.065)
                    outward=Vector((math.sin(theta),-math.cos(theta),.32)).normalized();p+=outward*.0007
                    art.ellipsoid(p,(.00165,.00165,.00115),'86938c',6,4)
        art.ellipsoid((0,centre_y,crown+.011),(.007,.007,.0035),'d4d5ca')
        # Curved laminated brim, shaped across its width and at the outer corners.
        rows,cols=5,25
        def brim(i,j):
            u=2*j/(cols-1)-1;f=i/(rows-1)
            y0=-.079+.049*u*u
            return Vector((u*(.092+.007*f),y0-f*(.088*(1-u*u)**.72+.009),1.708-.016*u*u-.019*f*f))
        art.grid(rows,cols,brim,'e9e8df',False)
        art.grid(rows,cols,lambda i,j:brim(rows-1-i,j)-Vector((0,0,.0034)),'5a6962',False)
        for row in (.77,.90):
            line=[brim(rows-1,j)*row+brim(0,j)*(1-row)+Vector((0,0,.00065)) for j in range(cols)]
            art.tube(line,.00055,'c0c4b9',4)
        art.tube([brim(rows-1,j) for j in range(cols)],.0018,'3d625e',5)
        for j in (0,cols-1):art.tube([brim(i,j) for i in range(rows)],.0015,'d4dbd3',4)
    else:
        rng=random.Random(1753)
        # Short coiled hair gives the rear player a separate crown and profile.
        for row,count in enumerate([43,42,40,37,33,29,24,18,11,5]):
            for j in range(count):
                t=TAU*(j+.5*(row%2)+rng.uniform(-.12,.12))/count
                bottom=1.698+.012*math.cos(t);f=(row+.52)/10.2
                z=bottom+(crown-bottom)*math.sin(f*math.pi/2)
                p=scalp(t,z,.003);p.z+=.003+.004*f
                size=.009+rng.random()*.0022
                art.ellipsoid(p,(size*(.88+.2*rng.random()),size*.87,size*(.73+.24*f)),rng.choice(['312820','392d23','413127','322922']),7,5)
        def band(i,j):
            t=j*TAU/64;z=1.684+.012*math.cos(t)+i*.008
            p=scalp(t,z,.0105);return p
        art.grid(3,64,band,'e3e3d8')
        for row in (0,2):art.tube([band(row,i%64) for i in range(65)],.0008,'777c70',4)
    return art.object({'cap':'CapPlayer','band':'BandPlayer','crop':'CropPlayer','tie':'TiePlayer'}[style])

# A hard-court shoe with a flared lateral outsole, an asymmetrical forefoot,
# eyelet stays, crossed flat laces and a padded Achilles notch.
def shoe(side):
    art=Sculpture();x0=.115*side
    ring=[(-.089,.043,.076),(-.072,.055,.101),(-.031,.056,.128),(.015,.053,.120),(.060,.057,.098),(.104,.063,.078),(.147,.062,.063),(.177,.049,.046),(.193,.023,.034),(.196,.003,.025)]
    def shell(i,j):
        d,w,h=ring[i];a=j*TAU/20;u=math.cos(a);z=math.sin(a)
        centre=x0-side*.013*max(0,d)/.19
        return Vector((centre+w*u, -d, .032+max(-.018,z*(h-.032))+.010*max(0,(d-.12)/.08)))
    art.grid(len(ring),20,shell,'e4e7dc')
    def outsole(i,j):
        d,w,h=ring[i];a=j*TAU/14
        return Vector((x0-side*.013*max(0,d)/.19+(w+.0025)*math.cos(a),-d,.012+.013*math.sin(a)+.016*max(0,(d-.12)/.08)**1.5))
    art.grid(len(ring),14,outsole,'64736f')
    for sign in [-1,1]:
        path=[shell(i,0 if sign==1 else 10)+Vector((sign*.0008,0,.006)) for i in range(1,9)]
        art.tube(path,.0028,'c9d0c4',6)
        path=[shell(i,1 if sign==1 else 9)+Vector((sign*.0007,0,.003)) for i in range(1,7)]
        art.tube(path,[.003,.005,.006,.006,.004,.002],'476a6e',6)
    for i in range(2,7):
        for sign in [-1,1]:
            a=shell(i,4 if sign==1 else 6);b=shell(i+1,6 if sign==1 else 4)
            art.tube([a+Vector((0,0,.002)),(a+b)/2+Vector((0,0,.004)),b+Vector((0,0,.002))],.0018,'f5f1de',5)
    return art.object('ShoeLeft' if side==1 else 'ShoeRight')

def hand(right):
    # Preserve the five individual fingers and knuckle topology of the CC0 hand.
    # Fit the right MCP/PIP/DIP joints around the actual diagonal 32 mm overgrip.
    def pivot(group):
        indices=set(i for f in groups[group] for i in f)
        return centre([verts[i] for i in indices])
    origin=pivot('joint-l-hand')
    digits=[[pivot('joint-l-finger-%d-%d'%(i,j)) for j in range(1,5)] for i in range(1,6)]
    length=(centre([d[0] for d in digits[1:]])-origin).normalized()
    width=digits[1][0]-digits[4][0];width=(width-length*width.dot(length)).normalized()
    palm=-width.cross(length).normalized()
    def local(v):
        u=v-origin
        return Vector((u.dot(width),u.dot(length),u.dot(palm)))*.093
    digits=[[local(v) for v in d] for d in digits]
    grip=Vector((0,.069,.024));shaft=Vector((-.823275,.440949,-.357467)).normalized()
    behind=Vector((0,0,-1));behind=(behind-shaft*shaft.dot(behind)).normalized();around=behind.cross(shaft)
    targets=[[Vector(p) for p in [(.030,.025,.006),(.042,.044,.021),(.039,.063,.043),(.022,.074,.042)]]]
    for i,along in enumerate([-.034,-.013,.009,.029]):
        target=[]
        for j,(angle,radius) in enumerate([(0,.028),(.95,.033),(1.91,.028),(2.80,.022)]):
            a=angle*(.94 if i==3 else 1)
            target.append(grip+shaft*(along-.0018*j)+radius*(behind*math.cos(a)+around*math.sin(a)))
        targets.append(target)
    links=[]
    for digit,goal in zip(digits,targets):
        for i in range(3):
            a,b=digit[i:i+2];u,w=goal[i:i+2];axis=b-a
            links.append((a,axis,u,w-u,axis.rotation_difference(w-u)))
    points=[];faces=[];remap={}
    polys=[f for f in groups['body'] if all(verts[i].x>3.60 and verts[i].y<3.3 and local(verts[i]).y>-.033 for i in f)]
    for face in polys:
        tri=[]
        for index in face:
            if index not in remap:
                p=local(verts[index]);out=p.copy()
                if right:
                    # Skin the captured hand to the fitted finger chains. The
                    # palm gradually joins the knuckles from the undisturbed wrist.
                    dst=Vector();total=0
                    for a,axis,u,bone,rotation in links:
                        t=max(0,min(1,(p-a).dot(axis)/axis.length_squared))
                        delta=p-a-axis*t
                        coeff=1/(delta.length_squared+.000006)**2.7
                        dst+=(u+bone*t+rotation@delta)*coeff;total+=coeff
                    k=max(0,min(1,(p.y-.015)/.056));k=k*k*(3-2*k)
                    out=p.lerp(dst/total,k)
                else:
                    out.x*=-1;out.z+=.010*max(0,(p.y-.080)/.080)**2
                remap[index]=len(points);points.append(Vector((out.x,-out.z,out.y)))
            tri.append(remap[index])
        faces.append(tuple(tri))
    art=Sculpture();art.surface(points,faces,'c89779');obj=art.object('HandRight' if right else 'HandLeft')
    # A common wrist socket is stitched to the deforming forearm during packing.
    # Cutting faces at this plane gives the skin a clean, closed junction.
    import bmesh
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,
                           plane_co=(0,0,0),plane_no=(0,0,1),clear_inner=True)
    bm.to_mesh(obj.data);bm.free();obj.data.update();return obj

hands=[hand(True),hand(False)]
canonical=portrait_shape(True)[0]
portraits=[portrait(style in ('cap','crop'),canonical,style) for style in ('cap','band','crop','tie')]
# Fit the skull depth and eye line to the captured armature.
for obj in [*portraits,bpy.data.objects['NeckSkin']]:
    for vertex in obj.data.vertices:
        p=vertex.co
        p.x*=.93
        p.y=(p.y+.064)*.83-.075
        p.z=1.652+(p.z-1.663)*.90
    obj.data.update()
shoes=[shoe(1),shoe(-1)]
output.parent.mkdir(parents=True,exist_ok=True)
export_model(output)
hands[0].location=(-.17,0,1.37)
hands[1].location=(.17,0,1.37)
portraits[0].location.x=-.16
portraits[1].location.x=.16
portraits[2].location.x=-.48
portraits[3].location.x=.48
from mathutils import Quaternion
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        space=area.spaces.active
        space.region_3d.view_location=(0,0,1.66)
        space.region_3d.view_distance=.89
        space.region_3d.view_rotation=Quaternion((1,0,0),math.pi/2)
        space.overlay.show_overlays=False
        space.shading.color_type='VERTEX'
        space.shading.light='STUDIO'
bpy.ops.wm.save_as_mainfile(filepath=str(output.with_suffix('.blend').resolve()))
