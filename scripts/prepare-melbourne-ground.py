"""Prepare Melbourne Park terrain from the May 2020 City of Melbourne orthophoto.

Input: a 4000 x 2400 EPSG:3857 JPEG exported at bounds
16137875.396,-4554958.595,16140407.257,-4553439.478 from the city's
AerialImage2020_WGS84 map service, layer 1. Source and CC BY 4.0 credit
are also available in the scene. Run from the repository root.
"""
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

source = cv2.imread(sys.argv[1])
assert source is not None and source.shape[:2] == (2400, 4000)
context = json.loads(Path("public/data/1573-context.json").read_text())
origin = context["origin"]
angle = context["angle"]
west, north, scale = -540, -520, 2
width, height = 3200, 2032
lat = math.radians(origin["latitude"])
cos, sin = math.cos(angle), math.sin(angle)
x = west + (np.arange(width, dtype=np.float64) + .5) / scale
ground = np.empty((height, width, 3), dtype=np.uint8)
for start in range(0, height, 128):
    end = min(start + 128, height)
    z = north + (np.arange(start, end, dtype=np.float64)[:, None] + .5) / scale
    lon = origin["longitude"] + (cos*x-sin*z)/(111320*math.cos(lat))
    latitude = lat - np.radians((sin*x+cos*z)/110540)
    mx = (6378137*np.radians(lon)-16137875.396) / (16140407.257-16137875.396)*4000-.5
    my = (-4553439.478-6378137*np.log(np.tan(np.pi/4+latitude/2))) / (4554958.595-4553439.478)*2400-.5
    ground[start:end] = cv2.remap(source, mx.astype('float32'), my.astype('float32'), cv2.INTER_LINEAR,
                                  borderMode=cv2.BORDER_REPLICATE)

def pixel(x,z):
    return int(round((x-west)*scale)), int(round((z-north)*scale))

def polygon(image, points, value):
    pts = np.array([pixel(x,z) for x,z in points], np.int32)
    cv2.fillPoly(image, [pts], value)

# Water in the true ortho contains triangular seams between photographic
# passes. Separate the water along its banks at quarter scale, retaining the
# bridges and wharves, then remove those exposure steps before texturing it.
river=[[-598,-153],[-527,-163],[-457,-168],[-398,-162],[-347,-152],[-290,-132],[-233,-107],[-175,-68],[-133,-18],[-97,37],[-60,82],[-8,132],[48,175],[93,222],[145,273],[202,328],[272,397],[335,470],[377,527],[272,535],[213,470],[167,417],[113,358],[60,305],[8,257],[-40,212],[-92,170],[-138,118],[-177,73],[-217,32],[-257,-3],[-303,-33],[-352,-55],[-403,-68],[-455,-73],[-507,-68],[-603,-47]]
water_shape=np.zeros((height,width),np.uint8)
polygon(water_shape,river,255)
mini=cv2.resize(ground,(width//4,height//4),interpolation=cv2.INTER_AREA)
seed=cv2.resize(water_shape,(mini.shape[1],mini.shape[0]),interpolation=cv2.INTER_NEAREST)
mask=np.where(cv2.dilate(seed,np.ones((23,23),np.uint8))>0,cv2.GC_PR_BGD,cv2.GC_BGD).astype('uint8')
mask[seed>0]=cv2.GC_PR_FGD
core=cv2.erode(seed,np.ones((15,15),np.uint8))
grey=cv2.cvtColor(mini,cv2.COLOR_BGR2GRAY).astype(np.float32)
spread=np.sqrt(np.maximum(0,cv2.blur(grey**2,(5,5))-cv2.blur(grey,(5,5))**2))
mask[(core>0)&(spread<5)]=cv2.GC_FGD
mask[spread>25]=cv2.GC_PR_BGD
cv2.setRNGSeed(93)
cv2.grabCut(mini,mask,None,np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),3,cv2.GC_INIT_WITH_MASK)
water=cv2.resize(np.isin(mask,[cv2.GC_FGD,cv2.GC_PR_FGD]).astype(np.float32),(width,height))
water=cv2.GaussianBlur(water,(0,0),1.1)[:,:,None]
row,col=np.ogrid[:height,:width]
waves=2.5*np.sin(col*.09+row*.15+2*np.sin(col*.014))+1.6*np.sin(row*.29-col*.07)
water_tone=np.array([66,74,68])+waves[:,:,None]
ground=np.clip(ground*(1-water*.93)+water_tone*water*.93,0,255).astype(np.uint8)

# Later development is supplied by the current court, plaza and building
# meshes. Feather to the surrounding paths to avoid exposing the 2020 works.
opacity = np.full((height,width), 255, dtype=np.uint8)
works=np.zeros_like(opacity)
polygon(works, [(209,-38),(316,-42),(361,-18),(420,14),(445,98),(393,148),(324,151),(270,130),(223,105),(219,30)], 255)
for railway in (f for f in context["features"] if f["kind"]=="rail"):
    cv2.polylines(works,[np.asarray([pixel(*p) for p in railway["points"]],np.int32)],False,0,round(scale*8))

# The Central Terrace opened after the flight. Its architects' 2022 oblique
# shows grey patterned stone, pale edges, and closely planted grass platforms.
# Build an original finish in that gap, preserving the mapped routes and
# excluding all later courts and structures independently below.
rng=np.random.default_rng(1573)
px,pz=pixel(200,-91)
right,bottom=pixel(449,153)
h,w=bottom-pz,right-px
zz,xx=np.indices((h,w),dtype=np.float32)
wx,wz=west+(px+xx)/scale,north+(pz+zz)/scale
u=np.floor((.915*wx+.404*wz)/.72)
v=np.floor((-.404*wx+.915*wz)/.49)
block=np.mod(np.sin(u*127.1+v*311.7)*43758.55,1.)
band=.5+.5*np.sin(wx*.095+wz*.16+.7*np.sin(wz*.12))
paver=68+15*band+16*block+6*rng.random((h,w))
paver+=np.where(block<.12+.13*band,49,0)+np.where(block<.035+.065*band,38,0)
new_ground=np.stack([paver+5,paver+4,paver+2],axis=2)
beds=np.zeros_like(opacity)
for outline in [
    [(259,23),(276,27),(277,41),(265,38)],[(282,23),(312,23),(307,39),(282,48)],
    [(318,10),(355,10),(365,25),(330,24),(319,29)],
    [(260,58),(278,54),(276,96),(261,98)],[(288,65),(299,68),(298,85),(286,87)],
    [(314,126),(346,130),(377,113),(374,136),(358,145),(329,138)],
    [(385,55),(392,43),(396,94),(387,102)],[(270,110),(289,110),(316,133),(302,135)],
    [(306,54),(314,43),(316,40),(316,108),(310,106)],
    [(365,37),(379,33),(393,26),(398,26),(385,42),(378,54)],
    [(239,117),(260,111),(279,129),(271,132),(252,121),(243,124)]
]:
    polygon(beds,outline,255)
# The temporary shop, marquee and terrace tables occupy this part of the
# podium during the tournament. Their decks need a clear, level approach.
polygon(beds,[(263,59),(282,59),(282,97),(263,97)],0)
for feature in context["features"]:
    if feature["kind"] in ("path","rail"):
        pts=np.asarray([pixel(*point) for point in feature["points"]],np.int32)
        cv2.polylines(beds,[pts],False,0,int(scale*((feature.get("width") or 3)+2.5)))
beds=cv2.morphologyEx(beds,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))
bed=beds[pz:bottom,px:right]>0
soil=8*np.sin(wx*.08)+4*np.sin(wz*.27)+rng.normal(0,5,(h,w))
new_ground[bed]=np.stack([62+soil,98+soil,82+soil],axis=2)[bed]
edge=(cv2.dilate(beds,np.ones((5,5),np.uint8))[pz:bottom,px:right]>0)&~bed
new_ground[edge]=[160,165,166]
blend=cv2.GaussianBlur(works,(0,0),4)[pz:bottom,px:right,None]/255
ground[pz:bottom,px:right]=np.clip(ground[pz:bottom,px:right]*(1-blend)+new_ground*blend,0,255)
for court in (f for f in context["features"] if f["kind"]=="court"):
    polygon(opacity, court["points"], 0)
for building in context["buildings"]:
    if building.get("structureType") != "Bridge":
        polygon(opacity, building["ring"], 0)
# Protect the reconstructed Rod Laver terraces, Garden Square lawn and the
# event-day oval. The photographed grass outside the event is retained.
cv2.ellipse(opacity,pixel(300,188),(176,99),0,0,360,0,-1)
opacity = cv2.GaussianBlur(opacity,(0,0),1.8)

# Detect tree crowns in the photographic parkland. Only woody, locally
# textured canopy can be selected; courts, buildings and transport corridors
# are excluded using the same mapped geometry as the rendered model.
b,g,r = [ch.astype('float32') for ch in cv2.split(ground)]
y = cv2.cvtColor(ground,cv2.COLOR_BGR2GRAY).astype('float32')
std = np.sqrt(np.maximum(0,cv2.blur(y*y,(23,23))-cv2.blur(y,(23,23))**2))
green = ((g>r*1.035)&(g>b*1.13)&(g>37)&(g<162)&(std>10)).astype('float32')
score = cv2.GaussianBlur(green,(0,0),5)
keep = opacity.copy()
for f in context["features"]:
    if f["kind"]=='path' or f["kind"]=='rail':
        pts=np.array([pixel(px,pz) for px,pz in f["points"]],np.int32)
        road=f.get('highway') in ['primary','secondary','tertiary','service']
        cv2.polylines(keep,[pts],False,0,round(scale*(max(f.get('width') or 3,5) if road else 3.3)))
cv2.ellipse(keep,pixel(546,-173),(300,282),0,0,360,0,-1)
# The two peripheral playing fields and their grass runoff have no canopy.
for mid, axes in [((361,347),(110,80)),((863,81),(88,77))]:
    cv2.ellipse(keep,pixel(*mid),(axes[0]*scale,axes[1]*scale),0,0,360,0,-1)
keep=cv2.erode(keep,np.ones((9,9),np.uint8))
score[keep<240]=0
peaks = (score>=cv2.dilate(score,np.ones((21,21),np.float32))) & (score>.49)
pz,px=np.where(peaks)
tree_rows=[]
for iz,ix in zip(pz,px):
    wx,wz=west+ix/scale,north+iz/scale
    if not (-460<wx<996 and -418<wz<417):continue
    if any((wx-p[0])**2+(wz-p[1])**2<30 for p in tree_rows[-120:]):continue
    radius=round(min(6.7,2.8+4*(score[iz,ix]-.4)),1)
    tree_rows.append([round(wx,1),round(wz,1),radius])

# Model the young canopy visible in the architect's Central Terrace aerial
# on its planted berms only, allowing crown clearance along each route.
clear=cv2.erode(cv2.bitwise_and(beds,keep),np.ones((9,9),np.uint8))
for j,z in enumerate(range(12,143,6)):
    for x in range(257+j%2*2,395,7):
        ix,iz=pixel(x,z)
        if clear[iz,ix] and not any((x-t[0])**2+(z-t[1])**2<18 for t in tree_rows):
            tree_rows.append([x,z,round(rng.uniform(1.6,2.5),1)])

# Planting beds are exported as low 3D landforms with seat-height coping.
# Simplification follows the clipped perimeter so the geometry respects the paths.
def contours(mask,min_area):
    rings=[]
    for contour in cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)[0]:
        if cv2.contourArea(contour)<min_area: continue
        ring=cv2.approxPolyDP(contour,.8,True).reshape(-1,2)
        rings.append([[west+ix/scale,north+iz/scale] for ix,iz in ring])
    return rings

terrace_beds=contours(beds,100)
terrace_turf=contours(cv2.erode(beds,np.ones((3,3),np.uint8)),80)
grates=[]
for x,z in [(x,z) for z in (104,110,116,122,128) for x in range(277,372,7)]+[(x,z) for z in range(26,65,7) for x in (308,315,322)]:
    ix,iz=pixel(x,z)
    if keep[iz,ix]<245 or beds[iz,ix] or not works[iz,ix]:continue
    if ((x-345)/31)**4+((z-79)/41)**4<1.12:continue
    if any((x-t[0])**2+(z-t[1])**2<24 for t in tree_rows):continue
    grates.append([x,z]);tree_rows.append([x,z,round(rng.uniform(1.9,2.65),1)])
Path('public/data/central-terrace.json').write_text(json.dumps({"beds":terrace_beds,"turf":terrace_turf,"grates":grates},separators=(',',':'))+'\n')

# Soft contact darkening connects the photographed pavement to the reconstructed
# buildings and planting. Directional shadows are supplied by the scene lighting.
solid=np.zeros_like(opacity)
for building in context["buildings"]:
    if building.get("structureType")!="Bridge" and building.get("base",0)<4:
        polygon(solid,building["ring"],255)
for x,z,r in tree_rows:
    ix,iz=pixel(x,z)
    if 0<=ix<width and 0<=iz<height and works[iz,ix]:
        cv2.circle(solid,(ix,iz),max(1,round(r*.65*scale)),255,-1)
occlusion=cv2.GaussianBlur(solid,(0,0),4)
ground=np.clip(ground*(1-.26*(occlusion/255)*(works/255))[:,:,None],0,255).astype('uint8')
for row in tree_rows:
    ix,iz=pixel(row[0],row[1])
    if beds[iz,ix]:row.append(1)

output=Path('public/images/court-atlas')
img=Image.fromarray(cv2.cvtColor(ground,cv2.COLOR_BGR2RGB))
for key, bounds in [('mcg',(380,-326,714,-20)),('aami',(548,280,758,495))]:
    x,z,u,v=bounds
    crop=img.crop((*pixel(x,z),*pixel(u,v)))
    if key=='aami':
        # The flight caught almost the entire field under its canopy shadow.
        # Re-light the playing area independently so the 3D roof casts the
        # shadow appropriate to the selected clock. Retain the real roof skin.
        field=np.asarray(crop).copy()
        z_grid,x_grid=np.indices(field.shape[:2])
        dx=x+(x_grid+.5)/scale-654
        dz=z+(z_grid+.5)/scale-391
        inside=(np.abs(dx)<41)&(np.abs(dz)<60)
        stripe=5.5*np.tanh(3*np.sin((dz+52.5)*np.pi/6.56))
        grain=rng.normal(0,2,dx.shape)
        tone=stripe+grain
        pitch=np.stack([71+tone,110+tone,67+tone],axis=2)
        side,end=np.abs(dx),np.abs(dz)
        lines=((np.abs(side-34)<.28)&(end<52.7))|((np.abs(end-52.5)<.28)&(side<34.2))
        lines|=((end<.24)&(side<34))|(np.abs(np.hypot(dx,dz)-9.15)<.25)
        for depth,half in [(16.5,20.16),(5.5,9.16)]:
            lines|=((np.abs(end-(52.5-depth))<.23)&(side<half))|((np.abs(side-half)<.23)&(end>52.5-depth)&(end<52.5))
        pitch[lines]=[181,198,162]
        field[inside]=np.clip(pitch[inside],0,255)
        crop=Image.fromarray(field)
    crop.save(output/(key+'-aerial.webp'),quality=89,method=6)
img.putalpha(Image.fromarray(opacity))
img.save(output/'melbourne-ground.webp',quality=83,method=6)
Path('public/data/precinct-canopy.json').write_text(json.dumps(tree_rows,separators=(',',':'))+'\n')
print(f'{len(tree_rows)} canopy positions, {width} × {height} ground texture')

if len(sys.argv)>2:
    # Wider, lower-resolution context continues behind the detailed 50 cm crop.
    # Preserve the real survey boundary using a soft alpha edge at no-data pixels.
    far=cv2.imread(sys.argv[2])
    assert far is not None and far.shape[:2]==(1600,2400)
    valid=(np.min(far,axis=2)<230).astype('uint8')
    valid=cv2.morphologyEx(valid,cv2.MORPH_CLOSE,np.ones((17,17),np.uint8))
    alpha=np.minimum(cv2.distanceTransform(valid,cv2.DIST_L2,3)/26,1)
    far_img=Image.fromarray(cv2.cvtColor(far,cv2.COLOR_BGR2RGB))
    far_img.putalpha(Image.fromarray((alpha*255).astype('uint8')))
    far_img.save(output/'melbourne-parkland.webp',quality=74,method=6)
