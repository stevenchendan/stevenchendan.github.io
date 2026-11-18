"""Build the two original Court Atlas player portraits and footwear in Blender.

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
group = ''
for line in (source_dir/'makehuman-base.obj').read_text(encoding='utf-8').splitlines():
    if line.startswith('v '): verts.append(Vector(tuple(map(float,line.split()[1:4]))))
    elif line.startswith('g '): group=line[2:].strip()
    elif line.startswith('f '): groups[group].append(tuple(int(k.split('/')[0])-1 for k in line.split()[1:]))

def target(name):
    with gzip.open(source_dir/(name+'.target.gz'),'rt') as file:
        return [(int(a),Vector((float(x),float(y),float(z)))) for a,x,y,z in (l.split() for l in file if l[0].isdigit())]

shape_a=target('caucasian-male-young')
shape_b=target('african-male-young')
athletic=target('universal-male-young-maxmuscle-averageweight')

def centre(points): return sum(points,Vector((0,0,0)))/len(points)

def portrait(near):
    art=Sculpture()
    v=[p.copy() for p in verts]
    for morph,amount in [(shape_a,.87 if near else .17),(shape_b,.13 if near else .83),(athletic,.65 if near else .84)]:
        for i,d in morph: v[i] += d*amount
    ids=lambda g:set(k for face in groups[g] for k in face)
    eye=centre([v[i] for i in ids('joint-l-eye')]); top=max(v[i].y for i in ids('body'))
    scale=(.137 if near else .140)/(top-eye.y)
    def world(p):
        # Centre the transformed head on the rig's upper neck. +Z in the OBJ
        # faces the net; Blender -Y exports as glTF +Z in the bind pose.
        return Vector((p.x*scale*(1.015 if near else 1.055),-(p.z-eye.z)*scale-.063,1.663+(p.y-eye.y)*scale))
    base_skin=colour('c89779' if near else '8c5c45')
    cheek=colour('ce8c72' if near else '955e46')
    lips=colour('a5655c' if near else '794b46')
    shadow=colour('9a7765' if near else '604638')
    polys=[f for f in groups['body'] if min(verts[i].y for i in f)>5.70 and max(abs(verts[i].x) for i in f)<1.3]
    selected=sorted(set(i for f in polys for i in f)); ix={old:i for i,old in enumerate(selected)}
    points=[world(v[i]) for i in selected]
    # Taper the neck socket inside the skinned collar. The head may rotate
    # independently without a rigid neck edge protruding through the trapezius.
    for p in points:
        t=max(0,min(1,(1.558-p.z)/.066)); t=t*t*(3-2*t)
        if t:
            p.x *= 1-.56*t
            p.y = .015 + (p.y-.015)*(1-.62*t)
    faces=[tuple(ix[i] for i in f) for f in polys]
    pigments=[]
    for i in selected:
        x,y,z=verts[i]; w=world(v[i]); x=abs(x)
        blush=math.exp(-((x-.51)/.28)**2-((y-6.97)/.24)**2)*max(0,min(1,(z-.6)*2))
        mouth=math.exp(-(x/.245)**4-((y-6.53)/.063)**4)*max(0,min(1,(z-1.35)*10))
        stubble=math.exp(-((y-6.39)/.31)**2)*max(0,min(1,(z-.35)*2))*(.34 if near else .22)
        pigments.append(base_skin.lerp(cheek,blush*.42).lerp(shadow,stubble).lerp(lips,mouth*.86))
    art.surface(points,faces,pigments)
    bvh=BVHTree.FromPolygons(points,faces,all_triangles=False)
    def skin_at(x,z):
        p=bvh.ray_cast(Vector((x,-.32,z)),Vector((0,1,0)))[0]
        return p if p else Vector((x,-.091,z))
    for side in [-1,1]:
        e=world(centre([v[i] for i in ids('joint-l-eye' if side==1 else 'joint-r-eye')]))
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
        d=Vector((math.sin(t),-math.cos(t),0));p=bvh.ray_cast(Vector((0,centre_y,z)),d)[0]
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
    art.grid(13,64,hairpoint,'3a302a' if near else '2a2521')
    if near:
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
    return art.object('CapPlayer' if near else 'BandPlayer')

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

portraits=[portrait(True),portrait(False)]
shoes=[shoe(1),shoe(-1)]
output.parent.mkdir(parents=True,exist_ok=True)
export_model(output)
portraits[0].location.x=-.16
portraits[1].location.x=.16
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
