import { grandSlamOval } from './GrandSlamOval';
import { outerCourtStands } from './OuterCourtStands';
import { SEATING_LIFT } from './dimensions';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { courtFrame, pathIntervals, pointInRing, pavingCells } from './precinctGeometry';
import { facade, roofTruss, supportBuilding } from './architecture';
import { precinctMaterial } from './materials';
import { courtElevation } from './courtPlacements';

export interface ContextData {
  buildings: { id: string; name?: string; ring: number[][]; height: number; base: number; roof: string; structureType?:string }[];
  features: { id: string; name: string; kind: string; width: number; surface?:string; layer?:number; highway?:string; points: number[][] }[];
}

// All dimensions are metres. Court geometry is regulation sized; architecture
// is a visual reconstruction, not a surveyed or as-built model.
const palette = { concrete: '#b4b4ac', edge: '#d4d1c5', steel: '#727d7b', dark: '#183b46', blue: '#147daa', outer: '#3593b5', seat: '#72b9e4', white: '#f2f0dc', copper: '#a87050' };
class Builder {
  group = new T.Group();
  batches = new Map<string, T.BufferGeometry[]>();
  add(geometry: T.BufferGeometry, color: string) {
    // Extruded shapes are non-indexed; boxes and cylinders are indexed.
    // Normalize before batching so an entire material group is not dropped.
    if (!geometry.index) geometry.setIndex(Array.from({length:geometry.getAttribute('position').count},(_,i)=>i));
    const list = this.batches.get(color) || [];
    list.push(geometry); this.batches.set(color, list);
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, rotation = 0) {
    const g = new T.BoxGeometry(w,h,d); g.rotateY(rotation); g.translate(x,y,z); this.add(g,color);
  }
  rod(a: number[], b: number[], radius = .04, color = palette.steel) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
    const g = new T.CylinderGeometry(radius,radius,delta.length(),6);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
    g.translate(...start.add(end).multiplyScalar(.5).toArray()); this.add(g,color);
  }
  finish() {
    this.batches.forEach((geometries,color) => {
      const merged = mergeGeometries(geometries);
      if (merged) { const mesh = new T.Mesh(merged,precinctMaterial(color,merged)); mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh); }
      geometries.forEach(g=>g.dispose());
    });
    this.batches.clear(); return this.group;
  }
}

function roundedPath(w: number, d: number, r: number) {
  const p = new T.Shape();
  p.moveTo(-w+r,-d); p.lineTo(w-r,-d); p.absarc(w-r,-d+r,r,-Math.PI/2,0,false);
  p.lineTo(w,d-r); p.absarc(w-r,d-r,r,0,Math.PI/2,false);
  p.lineTo(-w+r,d); p.absarc(-w+r,d-r,r,Math.PI/2,Math.PI,false);
  p.lineTo(-w,-d+r); p.absarc(-w+r,-d+r,r,Math.PI,Math.PI*1.5,false);
  return p;
}
function ring(b: Builder, inner: number, outer: number, bottom: number, height: number, color: string) {
  const s = roundedPath(10.8+outer,19.5+outer,2.8+outer);
  const hole = roundedPath(10.8+inner,19.5+inner,2.8+inner);
  s.holes.push(new T.Path(hole.getPoints(12).reverse()));
  const g = new T.ExtrudeGeometry(s,{depth:height,bevelEnabled:false,curveSegments:10});
  g.rotateX(-Math.PI/2); g.translate(0,bottom,0); b.add(g,color);
}
function label(text: string, w: number, h: number, color = '#eff5ed', background = '#163945') {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background; ctx.fillRect(0,0,1024,128);
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 65px Arial';ctx.fillText(text,512,69);
  const texture = new T.CanvasTexture(canvas);texture.colorSpace = T.SRGBColorSpace;texture.anisotropy=8;
  return new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:texture,roughness:.8,side:T.DoubleSide}));
}
function court(b: Builder, x=0,z=0,rotation=0, detailed=true, footprint?:number[][], clay=false, elevation=0) {
  const cb = new Builder();
  const outer=clay?'#bb7250':'#397fac', blue=clay?'#bd6845':'#236598';
  if(footprint){
    const c=Math.cos(rotation),s=Math.sin(rotation);
    const apron=new T.Shape(footprint.map(p=>{const dx=p[0]-x,dz=p[1]-z;return new T.Vector2(dx*c-dz*s,-(dx*s+dz*c));}));
    const surface=new T.ShapeGeometry(apron);surface.rotateX(-Math.PI/2);surface.translate(0,.095,0);cb.add(surface,outer);
  }else cb.box(0,.035,0,21.2,.12,38.3,palette.outer);
  cb.box(0,.105,0,10.97,.02,23.77,blue);
  const line=(x:number,z:number,w:number,d:number)=>cb.box(x,.122,z,w,.015,d,palette.white);
  [-5.485,-4.115,4.115,5.485].forEach(x=>line(x,0,.05,23.77));
  [-11.885,11.885].forEach(z=>{line(0,z,10.97,.065);line(0,z-Math.sign(z)*.15,.05,.3);});
  [-6.4,6.4].forEach(z=>line(0,z,8.23,.05)); line(0,0,.05,12.8);
  [-6.4,6.4].forEach(x=>cb.rod([x,.1,0],[x,1.22,0],.055,palette.dark));
  // Fine net lattice with a visibly lower centre strap.
  if(detailed){
    for(let i=0;i<=80;i++) { const x=-6.4+i*.16; const y=.914+.156*Math.pow(Math.abs(x)/6.4,2); cb.rod([x,.18,0],[x,y,0],.009,'#293a3b'); }
    for(let i=0;i<9;i++) cb.rod([-6.4,.2+i*.085,0],[6.4,.2+i*.085,0],.008,'#293a3b');
  }else cb.box(0,.56,0,12.8,.82,.035,'#475e60');
  for(let i=0;i<32;i++){ const x=-6.4+i*.4; const y=(n:number)=>.914+.156*Math.pow(Math.abs(n)/6.4,2);cb.rod([x,y(x),0],[x+.4,y(x+.4),0],.023,palette.white); }
  cb.box(0,.55,.016,.045,.89,.025,palette.white);
  const g=cb.finish();g.position.set(x,elevation,z);g.rotation.y=rotation;
  if(detailed){
    [-1,1].forEach(s=>{
      const text=label('M E L B O U R N E',6.7,.8,palette.white,palette.outer);text.rotation.x=-Math.PI/2;text.rotation.z=s<0?0:Math.PI;text.position.set(0,.105,s*16);g.add(text);
    });
  }
  b.group.add(g);
}

// A real interior surface and stepped bowl beneath each open roof, so terrain
// colours and pedestrian paths cannot read as the arena floor.
function arenaBowl(b:Builder,x:number,z:number,w:number,d:number,onlySeats=false,rows=22,drawCourt=true,spectators?:T.Group){
  const seatPositions:{x:number;y:number;z:number;angle:number}[]=[];
  if(!onlySeats){const floor=new T.ShapeGeometry(roundedPath(w,d,12));floor.rotateX(-Math.PI/2);floor.translate(x,.06,z);b.add(floor,'#394f5b');}
  for(let row=0;row<rows;row++){
    const t=row/rows,u=(row+1)/rows;
    const shape=roundedPath(13+(w-13)*u,22+(d-22)*u,3+8*u);
    shape.holes.push(new T.Path(roundedPath(13+(w-13)*t,22+(d-22)*t,3+8*t).getPoints(12).reverse()));
    const tier=new T.ExtrudeGeometry(shape,{depth:.48,bevelEnabled:false,curveSegments:12});
    if(!onlySeats){tier.rotateX(-Math.PI/2);tier.translate(x,.35+row*.57,z);b.add(tier,'#77888f');}else tier.dispose();
    const path=roundedPath(13+(w-13)*(t+u)/2,22+(d-22)*(t+u)/2,3+8*u),count=Math.floor(path.getLength()/.57);
    for(let i=0;i<count;i++){
      const f=i/count;if((f*16)%1<.08)continue;
      const p=path.getPointAt(f),v=path.getTangentAt(f);
      seatPositions.push({x:x+p.x,y:(onlySeats?1.4:1)+row*(onlySeats?.48:.57),z:z-p.y,angle:Math.atan2(v.y,v.x)});
    }
  }
  const seat=new T.BoxGeometry(.46,.38,.45),mesh=new T.InstancedMesh(seat,new T.MeshStandardMaterial({roughness:.7}),seatPositions.length),o=new T.Object3D();
  seatPositions.forEach((p,i)=>{o.position.set(p.x,p.y,p.z);o.rotation.y=p.angle;o.updateMatrix();mesh.setMatrixAt(i,o.matrix);mesh.setColorAt(i,new T.Color(['#578ba8','#74a4bf','#a2bac6','#477592'][i%4]));});
  mesh.castShadow=true;mesh.receiveShadow=true;b.group.add(mesh);
  if(spectators){
    // Sample actual seats after aisle exclusions so nobody floats or blocks stairs.
    const occupied=seatPositions.filter((_,i)=>((i*17+Math.floor(i/11))%13)<5);
    const bodies=new T.InstancedMesh(new T.CapsuleGeometry(.15,.28,3,5),new T.MeshStandardMaterial({roughness:.9}),occupied.length);
    const heads=new T.InstancedMesh(new T.SphereGeometry(.125,6,5),new T.MeshStandardMaterial({roughness:.85}),occupied.length);
    const shirts=['#e4dcc4','#40586e','#ece9e1','#4d7385','#cc6c4c','#677052','#b9a0bb'];
    const skin=['#c79c78','#976c50','#dfb99a','#694936'];
    occupied.forEach((p,i)=>{
      o.position.set(p.x,p.y+.42,p.z);o.rotation.set(0,p.angle,0);o.updateMatrix();bodies.setMatrixAt(i,o.matrix);bodies.setColorAt(i,new T.Color(shirts[i%shirts.length]));
      o.position.y+=.39;o.updateMatrix();heads.setMatrixAt(i,o.matrix);heads.setColorAt(i,new T.Color(skin[i%skin.length]));
    });
    spectators.add(bodies,heads);
  }
  if(!onlySeats&&drawCourt)court(b,x,z,0,false);
}

export function buildArena() {
  const b = new Builder();
  court(b);
  const stand = new Builder();
  ring(b,0,10.9,.1,SEATING_LIFT,palette.concrete);
  const seats: {x:number;y:number;z:number;angle:number}[]=[];
  for(let row=0;row<12;row++) {
    const offset = row*.79;
    ring(stand,offset,offset+.79,.1,.5+row*.43,palette.concrete);
    ring(stand,offset,offset+.055,.61+row*.43,.025,palette.edge);
    const path=roundedPath(11.2+offset,19.9+offset,3.2+offset);
    const length=path.getLength(), count=Math.floor(length/.52);
    for(let i=0;i<count;i++){
      const t=i/count, p=path.getPointAt(t), tangent=path.getTangentAt(t);
      // Twelve radial aisles retained through every seating tier.
      if ((t*12)%1 < .105 || (t*12)%1 > .94) continue;
      seats.push({x:p.x,y:.87+row*.43,z:-p.y,angle:Math.atan2(tangent.y,tangent.x)});
    }
  }
  ring(stand,9.48,10.9,.1,5.24,palette.concrete);
  ring(stand,10.7,10.94,5.34,.75,palette.edge);
  // Tall court-facing retaining wall visible in the supplied four photographs.
  // Continuous rounded corners replace the previous low, disconnected boards.
  ring(b,-.32,.02,.1,2.22,palette.edge);
  ring(b,-.34,.025,1.77,.65,palette.dark);
  [-1,1].forEach(s=>{
    b.box(s*10.43,2.095,0,.08,.65,29,palette.dark);
    b.box(0,2.095,s*19.13,15.4,.65,.08,palette.dark);
    const name=label('1573 ARENA',7.4,.52);name.position.set(0,2.08,s*19.075);if(s>0)name.rotation.y=Math.PI;b.group.add(name);
    for(let z=-10;z<=10;z+=10){const ad=label(z===0?'MELBOURNE':'AO   /   1573',6,.5);ad.position.set(s*10.375,2.08,z);ad.rotation.y=-s*Math.PI/2;b.group.add(ad);}
  });
  // Radial stair handrails and guardrails around the outer concourse.
  for(let section=0;section<12;section++) {
    const t=(section+.015)/12;
    const lo=roundedPath(11.05,19.75,3.05).getPointAt(t), hi=roundedPath(20.65,29.35,12.65).getPointAt(t);
    // Half-height treads make the aisles climb in smaller steps than seat tiers.
    for(let row=0;row<11;row++){
      const offset=row*.79+.59;
      const path=roundedPath(11.05+offset,19.75+offset,3.05+offset);
      const p=path.getPointAt(t),tangent=path.getTangentAt(t);
      stand.box(p.x,.7075+row*.43,-p.y,.85,.215,.395,palette.edge,Math.atan2(tangent.y,tangent.x));
    }
    stand.rod([lo.x,1.6,-lo.y],[hi.x,6.5,-hi.y],.043);
    for(let j=0;j<=4;j++){const k=j/4;stand.rod([T.MathUtils.lerp(lo.x,hi.x,k),.65+k*4.9,-T.MathUtils.lerp(lo.y,hi.y,k)],[T.MathUtils.lerp(lo.x,hi.x,k),1.6+k*4.9,-T.MathUtils.lerp(lo.y,hi.y,k)],.035);}
  }
  const rail=roundedPath(21.55,30.25,13.55).getPoints(60);
  rail.forEach((p,i)=>{if(i) stand.rod([rail[i-1].x,6.8,-rail[i-1].y],[p.x,6.8,-p.y],.04);if(i%3===0)stand.rod([p.x,6,-p.y],[p.x,6.8,-p.y],.035);});
  // Lightweight shade hoods at the back of the stands.
  for(const s of [-1,1])for(const z of [-19,-9,3,15]){
    stand.box(s*20,6.8,z,3.3,.16,5.3,'#ece9dd');
    for(const end of [-2.3,2.3]) stand.rod([s*21.15,5.35,z+end],[s*21.15,6.75,z+end],.065);
  }
  for(const s of [-1,1])for(const x of [-6,3])stand.box(x,6.8,s*29.4,6.5,.18,3,'#ece9dd');
  // Six floodlight masts with cross bracing and individually modelled luminaires.
  const lamps = new T.Group();
  for(const x of [-22.7,22.7])for(const z of [-23,0,23]) {
    b.rod([x,.1,z],[x,19.5,z],.14,'#737d7e');
    b.rod([x-1.7,19.2,z],[x+1.7,19.2,z],.09);
    b.rod([x,17.7,z],[x+1.65,19.2,z],.06);b.rod([x,17.7,z],[x-1.65,19.2,z],.06);
    for(let i=0;i<4;i++){
      b.box(x-1.35+i*.9,19.2,z,.63,.36,.5,'#384449');
      const light = new T.Mesh(new T.BoxGeometry(.52,.07,.42),new T.MeshStandardMaterial({color:'#fff4cf',emissive:'#ffe4a5',emissiveIntensity:.1}));light.position.set(x-1.35+i*.9,18.98,z);lamps.add(light);
    }
  }
  b.group.add(lamps);
  // Umpire chair and access ladder, player benches, umbrellas, bins, camera.
  for(const z of [-.55,.55]){
    b.rod([8.8,.1,z],[9.1,2.25,z],.035);b.rod([9.8,.1,z],[9.45,2.25,z],.035);
  }
  b.box(9.24,2.2,0,.72,.14,1.25,palette.dark);b.box(9.57,2.65,0,.13,.8,1.25,palette.dark);
  for(let y=.35;y<2.1;y+=.3)b.rod([9.7,y,-.5],[9.7,y,.5],.035);
  for(const z of [-7,7]){
    b.box(8.4,.52,z,.72,.14,2.7,palette.white);b.box(8.75,.9,z,.1,.65,2.7,palette.white);
    [-1,1].forEach(s=>b.box(8.4,.28,z+s,.45,.5,.15,palette.steel));
    b.rod([9.2,.1,z],[9.2,3.3,z],.045,palette.white);
    const umbrella=new T.ConeGeometry(1.9,.58,8);umbrella.translate(9.2,3.25,z);b.add(umbrella,'#ecdfc2');
    b.box(9.2,.45,z+2, .65,.7,.65,palette.dark);
  }
  const scoreboard = label('1573     •     MELBOURNE PARK',10.5,1.4,'#c8f586','#122d37');scoreboard.position.set(0,7.7,-29.7);stand.group.add(scoreboard);
  stand.box(0,7.7,-29.86,10.8,1.65,.3,palette.dark);
  stand.rod([-4,5.3,-29.8],[-4,8.5,-29.8],.09);stand.rod([4,5.3,-29.8],[4,8.5,-29.8],.09);

  // One shared geometry and one draw call for thousands of individual seats.
  const base=new T.BoxGeometry(.43,.115,.43);base.translate(0,0,0);
  const back=new T.BoxGeometry(.43,.43,.095);back.rotateX(-.12);back.translate(0,.22,.21);
  const seatGeometry=mergeGeometries([base,back])!;base.dispose();back.dispose();
  const seatMesh=new T.InstancedMesh(seatGeometry,new T.MeshStandardMaterial({color:palette.seat,roughness:.66}),seats.length);
  const dummy=new T.Object3D();
  seats.forEach((s,i)=>{dummy.position.set(s.x,s.y,s.z);dummy.rotation.set(0,s.angle,0);dummy.updateMatrix();seatMesh.setMatrixAt(i,dummy.matrix);seatMesh.setColorAt(i,new T.Color(i%17===0?'#c5c7b6':i%7===0?'#a8bfc0':palette.seat));});
  seatMesh.castShadow=true;seatMesh.receiveShadow=true;stand.group.add(seatMesh);
  const crowd=new T.Group();
  const bodies=new T.InstancedMesh(new T.CapsuleGeometry(.15,.3,3,5),new T.MeshStandardMaterial({roughness:.9}),Math.floor(seats.length/7));
  const heads=new T.InstancedMesh(new T.SphereGeometry(.125,6,5),new T.MeshStandardMaterial({color:'#c79c78'}),bodies.count);
  const shirts=['#e4dcc4','#40586e','#ece9e1','#4d7385','#cc6c4c','#677052'];
  for(let i=0;i<bodies.count;i++) { const s=seats[i*7];dummy.position.set(s.x,s.y+.36,s.z);dummy.rotation.set(0,s.angle,0);dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);bodies.setColorAt(i,new T.Color(shirts[i%shirts.length]));dummy.position.y+=.39;dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);}
  crowd.add(bodies,heads);crowd.visible=false;stand.group.add(crowd);
  stand.finish();stand.group.position.y=SEATING_LIFT;b.group.add(stand.group);
  return {group:b.finish(),lamps,crowd,seats:seats.length};
}

export function buildContext(data: ContextData) {
  const b=new Builder();
  const spectators=new T.Group();spectators.name='precinct-spectators';spectators.visible=false;b.group.add(spectators);
  const mappedCourts=data.features.filter(f=>f.kind==='court').map(f=>({feature:f,frame:courtFrame(f.points)}));
  const courtExclusions=mappedCourts.map(c=>c.frame);
  b.box(300,-1.65,0,1300,3,820,'#758268');
  // Neutral paving and planted ground replace the former event-zone colour washes.
  for(const [x,z,w,d,color] of pavingCells([[15,-142,210,195,'#979d9b'],[665,212,465,105,'#838e80'],[110,-12,245,105,'#a3aaa8'],[335,63,280,205,'#9da5a4']])) {
    b.box(x,-.09,z,w,.025,d,color);
  }
  grandSlamOval(b);
  // Five hard courts are on the Eastern Plaza deck; clay courts remain at grade.
  b.box(653,2.85,219,111,5.7,46,'#9babae');
  for(let x=600;x<708;x+=6)b.box(x,2.4,242,.35,4.5,.3,'#c1c8c7');
  // Riverbank follows the existing Yarra Trail, offset toward the water.
  const bank=[[-210,-260],[-175,-170],[-151,-82],...(data.features.find(f=>f.id==='way/991624386')?.points??[])];
  const riverShape=new T.Shape([...bank.map(p=>new T.Vector2(p[0]-16,-p[1])),new T.Vector2(-325,-260),new T.Vector2(-325,265)]);
  const riverGeometry=new T.ShapeGeometry(riverShape);riverGeometry.rotateX(-Math.PI/2);riverGeometry.translate(0,-.06,0);
  const river=new T.Mesh(riverGeometry,new T.MeshStandardMaterial({color:'#547d80',roughness:.48,metalness:.12}));river.receiveShadow=true;b.group.add(river);
  b.box(2,-.11,1,62,.1,83,'#c7c5b6');
  // Paving joints around the arena make the pedestrian scale legible.
  for(let x=-30;x<=30;x+=3) b.box(x,-.045,0,.018,.02,80,'#a8ab9d');
  for(let z=-39;z<=39;z+=3)b.box(0,-.045,z,60,.02,.018,'#a8ab9d');
  for(const f of data.features){
    if(f.kind==='green'&&f.points.length>3){
      const g=new T.ShapeGeometry(new T.Shape(f.points.map(p=>new T.Vector2(p[0],-p[1]))));g.rotateX(-Math.PI/2);g.translate(0,-.04,0);b.add(g,'#6f855e');
    }
    if(f.kind==='rail')for(let i=1;i<f.points.length;i++){
      const a=f.points[i-1],c=f.points[i],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
      b.box((a[0]+c[0])/2,-.01,(a[1]+c[1])/2,2.7,.06,len,'#77736c',angle);
      for(const side of [-1,1]){const nx=dz/len*.72*side,nz=-dx/len*.72*side;b.rod([a[0]+nx,.12,a[1]+nz],[c[0]+nx,.12,c[1]+nz],.055,'#a8abaa');}
      for(let d=0;d<len;d+=2)b.box(a[0]+dx*d/len,.07,a[1]+dz*d/len,2,.08,.18,'#585955',angle);
    }
    if(f.kind==='path'){
      for(let i=1;i<f.points.length;i++){
        const a=f.points[i-1], c=f.points[i], dx=c[0]-a[0],dz=c[1]-a[1];
        if(Math.abs((a[0]+c[0])/2)<24&&Math.abs((a[1]+c[1])/2)<33)continue;
        const bridge=f.name==='Tanderrum Bridge',road=f.name==='Batman Avenue'||/^(primary|secondary|tertiary|service|residential|trunk|motorway)/.test(f.highway??'');
        // Paths cross the road network. Keep their top surfaces above both
        // asphalt and lane markings to avoid coplanar depth-buffer flicker.
        const y=bridge?6.6:road?-.018:.02,width=bridge?6:road?8:Math.max(2,f.width);
        for(const [lo,hi] of bridge?[[0,1]]:pathIntervals(a,c,courtExclusions,width/2+.15)){
          const middle=(lo+hi)/2;
          b.box(a[0]+dx*middle,y,a[1]+dz*middle,width,bridge?.5:.035,Math.hypot(dx,dz)*(hi-lo),road?'#687070':'#d7d4c5',Math.atan2(dx,dz));
        }
        if(bridge){
          const len=Math.hypot(dx,dz),nx=dz/len*2.9,nz=-dx/len*2.9;
          for(const side of [-1,1]){
            b.rod([a[0]+nx*side,7.9,a[1]+nz*side],[c[0]+nx*side,7.9,c[1]+nz*side],.065,'#8c938c');
            for(let d=0;d<len;d+=3){const t=d/len,x=a[0]+dx*t+nx*side,z=a[1]+dz*t+nz*side;b.rod([x,6.85,z],[x,7.9,z],.035);}
          }
          for(let d=8;d<len;d+=24){const t=d/len;b.box(a[0]+dx*t,3.15,a[1]+dz*t,1.1,6.3,1.1,'#aeb2a9');}
        }
        if(road){const len=Math.hypot(dx,dz);for(let d=2;d<len-2;d+=8)b.box(a[0]+dx*d/len,.015,a[1]+dz*d/len,.12,.015,3,'#dedbc6',Math.atan2(dx,dz));}
      }
    }
    if(f.kind==='court'&&f.id!=='way/126844352'){
      const {x,z,rotation,width,depth}=courtFrame(f.points);
      if(x < -260 || x > 910 || z < -310 || z > 330)continue;
      // Landmark interiors are constructed once, with their own floor and bowl.
      if(data.buildings.some(building=>building.name&&pointInRing([x,z],building.ring)))continue;
      if(f.id==='way/126844350'){
        arenaBowl(b,x,z,22,31,false,12);
        const canopy=roundedPath(24,33,10);canopy.holes.push(new T.Path(roundedPath(19.5,28.5,8).getPoints(24).reverse()));
        const g=new T.ExtrudeGeometry(canopy,{depth:.25,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(x,8.2,z);b.add(g,'#dce1df');
        facade(b,roundedPath(23,32,9).getPoints(32).map(p=>[x+p.x,z-p.y]),0,7,'#5d7079');
        continue;
      }
      const elevation=courtElevation(x,f.layer);
      court(b,x,z,rotation,false,f.points,f.surface==='clay',elevation);
      outerCourtStands(b,{x,z,rotation,width,depth},f.name,spectators);
      if(f.id==='way/1239949236'){
        const floor=new T.ShapeGeometry(roundedPath(12.4,22.1,3));floor.rotateX(-Math.PI/2);floor.translate(x,.075,z);b.add(floor,'#397fac');
        continue;
      }
      const transform=(u:number,v:number,h:number)=>[x+u*Math.cos(rotation)+v*Math.sin(rotation),h+elevation,z-u*Math.sin(rotation)+v*Math.cos(rotation)];
      for(const s of [-1,1]){
        const u=s*(width/2-.25),v=depth/2-3.5;
        b.rod(transform(u,-v,.1),transform(u,-v,2.8),.055);b.rod(transform(u,v,.1),transform(u,v,2.8),.055);
        b.rod(transform(u,-v,2.8),transform(u,v,2.8),.04);
      }
      // Complete perimeter screens and regularly spaced fence posts.
      const fence=new T.BufferGeometry(),vertices:number[]=[];
      for(let i=1;i<f.points.length;i++){
        const a=f.points[i-1],c=f.points[i],len=Math.hypot(c[0]-a[0],c[1]-a[1]);
        for(let t=0;t<1;t+=3/len)b.rod([a[0]+(c[0]-a[0])*t,elevation,a[1]+(c[1]-a[1])*t],[a[0]+(c[0]-a[0])*t,elevation+3,a[1]+(c[1]-a[1])*t],.035,'#394d50');
        vertices.push(a[0],elevation+.15,a[1],c[0],elevation+.15,c[1],c[0],elevation+2.9,c[1],a[0],elevation+.15,a[1],c[0],elevation+2.9,c[1],a[0],elevation+2.9,a[1]);
        b.rod([a[0],elevation+3,a[1]],[c[0],elevation+3,c[1]],.035,'#536469');
      }
      fence.setAttribute('position',new T.Float32BufferAttribute(vertices,3));fence.computeVertexNormals();
      b.group.add(new T.Mesh(fence,new T.MeshStandardMaterial({color:'#31474c',transparent:true,opacity:.23,side:T.DoubleSide,depthWrite:false})));
      for(const side of [-1,1]){const p=transform(side*(width/2+.7),0,0);b.rod(p,[p[0],p[1]+12,p[2]],.08,'#829198');b.box(p[0],p[1]+12,p[2],1.6,.3,.6,'#dae0dc');}
    }
  }
  arenaBowl(b,344.8375,78.58,30,40,true);
  data.buildings.forEach(building=>{
    if(building.id==='805343-2-0')return; // Duplicate Olympic Boulevard bridge tier.
    if(building.id.startsWith('806665-')){
      if(building.id!=='806665-1-0')return;
      // AAMI is peripheral context, but its open field must not be a solid slab.
      const cx=654,cz=391,outer=roundedPath(97,103,32),inner=roundedPath(49,70,12);
      const wall=roundedPath(94,100,30);wall.holes.push(new T.Path(roundedPath(81,88,23).getPoints(48).reverse()));
      const shell=new T.ExtrudeGeometry(wall,{depth:15,bevelEnabled:false});shell.rotateX(-Math.PI/2);shell.translate(cx,0,cz);b.add(shell,'#93a8ac');
      b.box(cx,.1,cz,75,.15,112,'#507f50');
      const vertices:number[]=[],indices:number[]=[];
      for(let i=0;i<=144;i++)for(let j=0;j<=6;j++){
        const t=i/144,u=j/6,a=inner.getPointAt(t),c=outer.getPointAt(t);
        vertices.push(cx+a.x+(c.x-a.x)*u,18+Math.sin(Math.PI*u)*7+Math.pow(Math.sin(t*Math.PI*12),2)*3,cz-a.y-(c.y-a.y)*u);
        if(i<144&&j<6){const n=i*7+j;indices.push(n,n+7,n+1,n+1,n+7,n+8);}
      }
      const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(vertices,3));roof.setIndex(indices);roof.computeVertexNormals();
      const canopy=new T.Mesh(roof,new T.MeshStandardMaterial({color:'#e0e4e1',side:T.DoubleSide,roughness:.75}));canopy.castShadow=true;canopy.receiveShadow=false;b.group.add(canopy);
      return;
    }
    if(building.id.startsWith('819103-')){
      if(building.id!=='819103-1-0')return;
      // Peripheral MCG: preserve the visible oval void rather than a city-data box.
      const ellipse=(w:number,d:number)=>{const s=new T.Shape();s.absellipse(546,173,w,d,0,Math.PI*2,false,0);return s;};
      const shell=ellipse(150,140);shell.holes.push(new T.Path(ellipse(116,108).getPoints(96).reverse()));
      const walls=new T.ExtrudeGeometry(shell,{depth:32,bevelEnabled:false,curveSegments:48});walls.rotateX(-Math.PI/2);b.add(walls,'#8f9da3');
      const roof=ellipse(153,143);roof.holes.push(new T.Path(ellipse(121,113).getPoints(96).reverse()));
      const cap=new T.ShapeGeometry(roof);cap.rotateX(-Math.PI/2);cap.translate(0,34,0);b.add(cap,'#d3d7d3');
      const grass=new T.ShapeGeometry(ellipse(111,103));grass.rotateX(-Math.PI/2);grass.translate(0,.1,0);b.add(grass,'#64864e');
      for(let i=0;i<96;i++){const a=i*Math.PI/48,x=546+151*Math.cos(a),z=-173-141*Math.sin(a);b.rod([x,1,z],[x,33,z],.25,'#b7c2c6');}
      return;
    }
    // This footprint is the elevated bridge, rebuilt as an open deck above.
    if(building.id==='810459-2-0')return;
    if(building.structureType==='Bridge'){
      // The city data describes the full bridge elevation envelope, not a solid
      // building. Keep open clearance under its deck instead of extruding a wall.
      const top=building.base+building.height,deck=new T.Shape(building.ring.map(p=>new T.Vector2(p[0],-p[1])));
      const geometry=new T.ExtrudeGeometry(deck,{depth:.65,bevelEnabled:false});geometry.rotateX(-Math.PI/2);geometry.translate(0,top-.65,0);b.add(geometry,'#b6beb7');
      const xs=building.ring.map(p=>p[0]),zs=building.ring.map(p=>p[1]);
      for(let x=Math.min(...xs)+2;x<Math.max(...xs);x+=12)for(let z=Math.min(...zs)+2;z<Math.max(...zs);z+=24){
        if(pointInRing([x,z],building.ring))b.box(x,(top-.65)/2,z,1.1,top-.65,1.1,'#929f98');
      }
      building.ring.forEach((p,i)=>{if(i){const a=building.ring[i-1];b.rod([a[0],top+1.05,a[1]],[p[0],top+1.05,p[1]],.07,'#667b78');}});
      return;
    }
    if(building.name==='Margaret Court Arena')return;
    if(building.name==='John Cain Arena'){
      const ring=building.ring.slice(0,-1);
      const cx=ring.reduce((s,p)=>s+p[0],0)/ring.length,cz=ring.reduce((s,p)=>s+p[1],0)/ring.length;
      const outline=new T.Shape(ring.map(p=>new T.Vector2(p[0],-p[1])));
      outline.holes.push(new T.Path(ring.map(p=>new T.Vector2(cx+(p[0]-cx)*.92,-cz-(p[1]-cz)*.92)).reverse()));
      const walls=new T.ExtrudeGeometry(outline,{depth:24,bevelEnabled:false});walls.rotateX(-Math.PI/2);b.add(walls,'#788f98');
      const roof=new T.Shape(ring.map(p=>new T.Vector2(p[0],-p[1])));
      roof.holes.push(new T.Path(roundedPath(33,36,2).getPoints(24).map(p=>new T.Vector2(p.x+cx,p.y-cz)).reverse()));
      const canopy=new T.ExtrudeGeometry(roof,{depth:1.6,bevelEnabled:false});canopy.rotateX(-Math.PI/2);canopy.translate(0,25,0);b.add(canopy,'#cbd1cd');
      for(let i=0;i<ring.length;i++){
        const p=ring[i],q=ring[(i+1)%ring.length],length=Math.hypot(q[0]-p[0],q[1]-p[1]);
        for(let d=0;d<length;d+=5){const t=d/length,x=p[0]+(q[0]-p[0])*t,z=p[1]+(q[1]-p[1])*t;b.rod([x,0,z],[x,25,z],.18,'#d2d6ca');}
      }
      arenaBowl(b,cx,cz,40,48);
      facade(b,building.ring,1.2,12,'#536b78');
      // Rectangular moving roof panels parked at the ends in the open preset.
      for(const side of [-1,1]){
        b.box(cx,27,cz+side*51,71,.65,27,'#dce0dd');
        for(const dz of [-11,0,11])roofTruss(b,cx,cz+side*51+dz,71,27.5,3.2);
      }
      for(const x of [cx-36,cx+36]){
        b.rod([x,27,cz-77],[x,27,cz+77],.3,'#a9b8bd');
        for(let z=cz-60;z<cz+65;z+=12)b.rod([x,18,z],[x,27,z],.17,'#d5dcda');
      }
      return;
    }
    if(building.name==='Rod Laver Arena'){
      const shell=roundedPath(55,64,30);shell.holes.push(new T.Path(roundedPath(49,58,26).getPoints(32).reverse()));
      const wall=new T.ExtrudeGeometry(shell,{depth:22,bevelEnabled:false,curveSegments:24});wall.rotateX(-Math.PI/2);wall.translate(154,0,72);b.add(wall,'#8b9799');
      const roofShape=roundedPath(56,65,31);roofShape.holes.push(new T.Path(roundedPath(35,35,3).getPoints(32).reverse()));
      const roof=new T.ShapeGeometry(roofShape,36);roof.rotateX(-Math.PI/2);const pos=roof.getAttribute('position');
      for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setXYZ(i,x+154,23+5*(1-Math.min(1,Math.max(Math.abs(x)/56,Math.abs(z)/65))),z+72);}roof.computeVertexNormals();b.add(roof,'#e4e5dc');
      // Keep roof seams on the solid bays rather than stretching across the opening.
      for(let z=-42;z<=42;z+=14){
        b.rod([103,24,72+z],[128,24,72+z],.10,'#bfc5c3');
        b.rod([180,24,72+z],[205,24,72+z],.10,'#bfc5c3');
      }
      arenaBowl(b,154,72,46,55,false,22,true,spectators);
      const perimeter=roundedPath(55.15,64.15,30).getPoints(48).map(p=>[p.x+154,72-p.y]);
      facade(b,perimeter,2.2,9);
      for(const z of [-48,-38,38,48])roofTruss(b,154,72+z,76,28,3);
      for(const x of [116,192])b.rod([x,28,16],[x,28,128],.25,'#87999f');
      for(const z of [-42,42]){
        b.box(154,27.8,72+z,72,.5,13,'#d4dad8');
        for(let x=122;x<190;x+=4)b.rod([x,28.15,72+z-6],[x,28.15,72+z+6],.045,'#a8b5b9');
      }
      for(const [x,z,w,d] of [[154,-3,23,10],[154,147,21,10],[92,83,11,24]]){
        const pod=roundedPath(w,d,6),g=new T.ExtrudeGeometry(pod,{depth:7,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(x,.2,z);b.add(g,'#bcc8c9');
        facade(b,pod.getPoints(24).map(p=>[x+p.x,z-p.y]),.3,5.8);
        const roof=new T.ShapeGeometry(pod);roof.rotateX(-Math.PI/2);roof.translate(x,7.3,z);b.add(roof,'#e0e3df');
      }
      return;
    }
    supportBuilding(b,building);
  });
  // Clip each roof fold to the OSM footprint, so the copper roof's sawtooth
  // silhouette follows the irregular building without floating geometry.
  const mca=data.buildings.find(building=>building.name==='Margaret Court Arena');
  if(mca){
    const pitch=data.features.find(f=>f.id==='way/1239949234');
    if(pitch){const frame=courtFrame(pitch.points);arenaBowl(b,frame.x,frame.z,32,36,false,22,false,spectators);court(b,frame.x,frame.z,frame.rotation,false,pitch.points);}
    const clip=(polygon:number[][],boundary:number,keepAbove:boolean)=>{
      const result:number[][]=[];
      for(let i=0;i<polygon.length;i++){
        const a=polygon[i],c=polygon[(i+1)%polygon.length];
        const inside=(p:number[])=>keepAbove?p[1]>=boundary:p[1]<=boundary;
        if(inside(a))result.push(a);
        if(inside(a)!==inside(c)){const t=(boundary-a[1])/(c[1]-a[1]);result.push([a[0]+(c[0]-a[0])*t,boundary]);}
      }return result;
    };
    // Separate roof bays and lower perimeter skirts, clipped to the footprint.
    const clipX=(poly:number[][],value:number,above:boolean)=>clip(poly.map(p=>[p[1],p[0]]),value,above).map(p=>[p[1],p[0]]);
    const roofHeight=(x:number,z:number)=>{
      const phase=((x-25)%8+8)%8,fold=1-Math.abs(phase-4)/4;
      const skirt=Math.min(1,Math.max(0,(x-15)/12),Math.max(0,(130-x)/22));
      const parked=x>=38&&x<=93&&((z>=-22&&z<=0)||(z>=45&&z<=67));
      return 10.5+skirt*(4.5+fold*2.8)+(parked?.8:0);
    };
    // Populous aerial reference: two pleated leaves parked beyond the baselines.
    // Include aperture edges in the tessellation so no partial bay bridges it.
    const xs=[...new Set([...Array.from({length:35},(_,i)=>5+i*4),38,93])].sort((a,c)=>a-c);
    const zs=[...new Set([...Array.from({length:31},(_,i)=>-50+i*5.5),-22,0,45,67])].sort((a,c)=>a-c);
    for(let zi=0;zi<zs.length-1;zi++)for(let xi=0;xi<xs.length-1;xi++){
      const z=zs[zi],zh=zs[zi+1],xl=xs[xi],xh=xs[xi+1];
      if(xl>=38&&xh<=93&&z>=0&&zh<=45)continue;
      const polygon=clipX(clipX(clip(clip(mca.ring.slice(0,-1),z,true),zh,false),xl,true),xh,false);
      if(polygon.length<3)continue;
      const g=new T.ShapeGeometry(new T.Shape(polygon.map(p=>new T.Vector2(p[0],-p[1]))));g.rotateX(-Math.PI/2);
      const pos=g.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setY(i,roofHeight(pos.getX(i),pos.getZ(i)));g.computeVertexNormals();
      const roof=new T.Mesh(g,new T.MeshStandardMaterial({color:Math.round((xl-5)/4)%2===0?'#a86b49':'#be8059',roughness:.8,side:T.DoubleSide}));roof.castShadow=true;roof.receiveShadow=true;b.group.add(roof);
      polygon.forEach((p,i)=>{const q=polygon[(i+1)%polygon.length];b.rod([p[0],roofHeight(...p as [number,number])+.04,p[1]],[q[0],roofHeight(...q as [number,number])+.04,q[1]],.045,'#d3ad89');});
    }
    // Full-height glazed perimeter with visible mullions, doors and opaque fins.
    for(const z of [0,45])roofTruss(b,65.5,z,55,15,1.8);
    for(const x of [38,93]){
      b.box(x,18.8,22.5,.3,.25,89,'#aeb7b3');
      for(const z of [-22,0,45,67])b.box(x,18.2,z,.8,.6,1.2,'#45545b');
    }
    const fasciaParts:T.BufferGeometry[]=[];
    mca.ring.forEach((p,i)=>{
      if(!i)return;const a=mca.ring[i-1],dx=p[0]-a[0],dz=p[1]-a[1],len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
      for(let d=0;d<len;d+=1.5){
        const t=d/len,u=Math.min(1,(d+1.5)/len),x=a[0]+dx*t,z=a[1]+dz*t,xx=a[0]+dx*u,zz=a[1]+dz*u;
        const h=roofHeight(x,z),hh=roofHeight(xx,zz);
        const fascia=new T.BufferGeometry();fascia.setAttribute('position',new T.Float32BufferAttribute([x,10.2,z,xx,10.2,zz,xx,hh,zz,x,10.2,z,xx,hh,zz,x,h,z],3));fascia.computeVertexNormals();
        fasciaParts.push(fascia);
      }
      b.box((p[0]+a[0])/2,5.1,(p[1]+a[1])/2,.24,10.2,len,'#425b62',angle);
      for(let d=0;d<len;d+=2.5){const t=d/len,x=a[0]+dx*t,z=a[1]+dz*t;b.rod([x,0,z],[x,10.4,z],.065,'#bdc3bc');}
      for(const y of [1.1,4.8,8.4,10.3])b.rod([a[0],y,a[1]],[p[0],y,p[1]],.075,'#aeb7b3');
    });
    const fasciaGeometry=mergeGeometries(fasciaParts);fasciaParts.forEach(g=>g.dispose());
    if(fasciaGeometry){const face=new T.Mesh(fasciaGeometry,new T.MeshStandardMaterial({color:'#aa7657',roughness:.8,side:T.DoubleSide}));face.castShadow=true;face.receiveShadow=true;b.group.add(face);}
    for(const z of [-26,-23,20,23])b.box(25.3,5.3,z,.55,10.6,1.25,'#c8c8b9');
    const sign=label('MARGARET COURT ARENA',15,.8,'#d5dcda','#263c43');sign.rotation.y=-Math.PI/2;sign.position.set(25.1,3.6,-4);b.group.add(sign);
  }

  // Service pavilions, entry furniture and planting are interpretive details.
  for(let z=-18;z<=18;z+=12){
    b.box(-28,1.7,z,4,3.4,7,'#66756f');b.box(-28,3.5,z,4.5,.18,7.5,'#dedacb');
    b.box(-25.95,1.65,z,.04,1.4,4,'#324a4d');
  }
  for(let x=-16;x<19;x+=5){
    b.box(x,.42,37,2.8,.14,.65,'#807c63');b.box(x-1,.2,37,.14,.5,.55,palette.steel);b.box(x+1,.2,37,.14,.5,.55,palette.steel);
  }
  for(const x of [-23,23])for(const z of [-34,34]){
    b.box(x,1.8,z,.35,3.6,.45,palette.dark);
    const sign=label('1573  →',2.8,.65,'#e5f0c9');sign.position.set(x,3.35,z+.26);b.group.add(sign);
  }
  const trees: number[][]=[];
  for(let i=0;i<18;i++){const a=i*Math.PI/9;trees.push([344+45*Math.cos(a),79+53*Math.sin(a)]);}
  for(let i=0;i<12;i++){const a=i*Math.PI/6;trees.push([300+94*Math.cos(a),188+59*Math.sin(a)]);}
  for(let i=0;i<27;i++)trees.push([-48-Math.sin(i*.75)*5, -145+i*11]);
  bank.forEach(([x,z],i)=>{trees.push([x+3,z]);if(i%2===0)trees.push([x+10,z+5]);});
  for(let i=0;i<16;i++)trees.push([-81+i*13,-146+Math.sin(i)*4]);
  for(let i=0;i<14;i++)trees.push([-65+i*15,135+Math.sin(i)*6]);
  const plantedTrees=trees.filter(([x,z])=>!data.features.some(f=>f.kind==='court'&&x>Math.min(...f.points.map(p=>p[0]))-4&&x<Math.max(...f.points.map(p=>p[0]))+4&&z>Math.min(...f.points.map(p=>p[1]))-4&&z<Math.max(...f.points.map(p=>p[1]))+4));
  const leaves=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#687b4d',roughness:1,flatShading:true}),plantedTrees.length*4);
  const o=new T.Object3D();
  plantedTrees.forEach(([x,z],i)=>{
    const height=5+(Math.sin(i*7)+1)*1.6;b.rod([x,0,z],[x,height,z],.28,'#83745b');
    b.box(x,.15,z,4,.3,4,'#999f7f');
    for(let j=0;j<4;j++){
      o.position.set(x+Math.sin(j*2.1)*1.7,height+j*.64,z+Math.cos(j*2.1)*1.5);o.scale.set(2.8,2.7,2.6);o.rotation.set(i,j,i*.3);o.updateMatrix();leaves.setMatrixAt(i*4+j,o.matrix);leaves.setColorAt(i*4+j,new T.Color(['#728455','#849365','#586e48','#9caa79'][i%4]));
    }
  });leaves.castShadow=true;leaves.receiveShadow=true;b.group.add(leaves);
  return b.finish();
}

export function disposeModel(group: T.Group) {
  group.traverse(obj=>{
    if(obj instanceof T.Mesh){obj.geometry.dispose();const materials=Array.isArray(obj.material)?obj.material:[obj.material];materials.forEach(m=>{if('map' in m && m.map instanceof T.Texture)m.map.dispose();m.dispose();});}
  });
}


