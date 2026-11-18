import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {MeshBVH,SAH} from 'three-mesh-bvh';
import {loadArenaModule as load} from './arena-model-fixture.mjs';

// node scripts/bake-seat-sun.mjs regenerates the static asset. --check compares
// the checked-in file with independent world-space rays on several summer days.
const output=new URL('../public/data/ao-seat-sun-v1.bin',import.meta.url);
const data=JSON.parse(fs.readFileSync(new URL('../public/data/1573-context.json',import.meta.url)));
const {buildContext,buildArena,disposeModel}=load('model');
const {seatSections}=load('seating'),{sectionEye}=load('views'),{summerSun}=load('solar');
const {rallyCourts}=load('courtPlacements');
const {decodeSeatSun,sectionSun,sectionCentreSun}=load('seatSun');
const ids={rla:'way/1239949235',mca:'way/1239949234',john:'john-cain-interior'};
const context=buildContext(data),home=buildArena().group;
const roots=[context,home];roots.forEach(root=>root.updateMatrixWorld(true));
const step=2,columns=360/step,rows=90/step+1,keys=[],points=[];
const ray=new T.Ray(),rad=Math.PI/180;

function physicalRows(chairs,center){
  const levels=new Map(),matrix=new T.Matrix4(),p=new T.Vector3();
  for(let i=0;i<chairs.count;i++){
    chairs.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix).applyMatrix4(chairs.matrixWorld);
    const y=Number(p.y.toFixed(4)),line=levels.get(y)??[];
    line.push([p.x-center.x,p.z-center.z]);levels.set(y,line);
  }
  return [...levels.keys()].sort((a,b)=>a-b).map(y=>{
    const line=levels.get(y);
    const w=Math.max(...line.map(p=>Math.abs(p[0]))),d=Math.max(...line.map(p=>Math.abs(p[1])));
    return {y,seats:line.map(([x,z])=>({x:x+center.x,z:z+center.z,angle:Math.atan2(z/d,x/w)}))};
  });
}

function sampleBay(venue,bay,levels,center){
  const eye=sectionEye(venue,bay.id),middle=new T.Vector3(eye[0]+center.x,eye[1],eye[2]+center.z);
  // The hinge/hip reference on each moulded seat is 92 cm below the eye.
  const head=.92;
  const mid=levels.findIndex(row=>Math.abs(row.y+head-middle.y)<.001);
  assert.ok(mid>=0,`Camera for ${venue}/${bay.id} must match a physical row`);
  const samples=venue==='rla'?(bay.tier==='upper'?[23,mid,34]:[3,mid,18])
    :venue==='mca'?(bay.tier==='upper'?[13,mid,20]:[2,mid,9])
    :{courtside:[0,mid,3],lower:[4,mid,8],middle:[9,mid,14],upper:[15,mid,20]}[bay.tier];
  const centerAngle=Math.atan2(bay.z,bay.x);
  const wrapped=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const extents=bay.footprints.flat().map(p=>wrapped(Math.atan2(p.z,p.x)-centerAngle));
  const directions=[Math.min(...extents)*.62,0,Math.max(...extents)*.62];
  return samples.flatMap((row,r)=>directions.map((offset,c)=>{
    if(r===1&&c===1)return middle;
    const angle=centerAngle+offset;
    const closest=levels[row].seats.reduce((best,p)=>Math.abs(wrapped(p.angle-angle))<Math.abs(wrapped(best.angle-angle))?p:best);
    return new T.Vector3(closest.x,levels[row].y+head,closest.z);
  }));
}

for(const venue of Object.keys(ids)){
  const center=rallyCourts(data).find(p=>p.id===ids[venue]);
  const group=context.getObjectByName('venue-'+venue);
  const chairs=group.getObjectByName(venue==='rla'?'rod-laver-seats':'arena-bowl-seats');
  const levels=physicalRows(chairs,center);
  for(const bay of seatSections[venue]){
    keys.push(venue+'/'+bay.id);
    const sample=sampleBay(venue,bay,levels,center);
    assert.equal(new Set(sample.map(p=>p.toArray().map(n=>n.toFixed(3)).join(','))).size,9,'Nine distinct physical seat positions in '+keys.at(-1));
    points.push(sample);
  }
}

function structureTree(){
  const sources=[];
  for(const root of roots)root.traverseVisible(obj=>{
    if(obj.isMesh&&!obj.isInstancedMesh&&obj.castShadow&&!obj.material.transparent)sources.push(obj);
  });
  // Keep the full precinct, including the parked leaves and adjacent arenas.
  // Every ray travels upwards. Ground, court paint and all triangles below the
  // lowest sample cannot obstruct it. Spectators and chairs are transient occupancy.
  const lowest=Math.min(...points.flat().map(p=>p.y))-.04;
  const capacity=sources.reduce((n,m)=>n+3*(m.geometry.index?.count??m.geometry.attributes.position.count),0);
  const positions=new Float32Array(capacity);
  let offset=0;
  for(const mesh of sources){
    const g=mesh.geometry,p=g.getAttribute('position').clone().applyMatrix4(mesh.matrixWorld),ids=g.index?.array;
    const n=ids?.length??p.count;
    for(let i=0;i<n;i+=3){
      const a=ids?ids[i]:i,b=ids?ids[i+1]:i+1,c=ids?ids[i+2]:i+2;
      if(Math.max(p.getY(a),p.getY(b),p.getY(c))<lowest)continue;
      for(const j of [a,b,c]){positions[offset++]=p.getX(j);positions[offset++]=p.getY(j);positions[offset++]=p.getZ(j);}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions.slice(0,offset),3));
  console.log('Baking against',offset/9,'world-space structural triangles');
  return new MeshBVH(g,{strategy:SAH,maxLeafTris:8});
}

const tree=structureTree();
roots.forEach(disposeModel);
function cast(sample,direction){
  ray.direction.copy(direction);
  let mask=0;
  for(let i=0;i<sample.length;i++){
    ray.origin.copy(sample[i]);
    if(!tree.raycastFirst(ray,T.DoubleSide,.035))mask|=1<<i;
  }
  return mask;
}

function bake(){
  const directions=[];
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const a=col*step*rad,e=row*step*rad;
    directions.push(new T.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)));
  }
  const words=[];
  let previous=-1,n=0;
  const flush=()=>{if(n)words.push((previous<<7)|(n-1));n=0;};
  points.forEach((samples,i)=>{
    if(i===0||keys[i].split('/')[0]!==keys[i-1].split('/')[0])console.log('Casting',keys[i].split('/')[0]);
    for(const direction of directions){
      const mask=cast(samples,direction);
      if(mask!==previous||n===128)flush();
      previous=mask;n++;
    }
  });
  flush();
  const directory=Buffer.from(keys.join('\n'),'utf8'),bytes=Buffer.alloc(12+directory.length+words.length*2);
  bytes.write('AOSU');bytes[4]=1;bytes[5]=step;bytes[6]=9;
  bytes.writeUInt16LE(keys.length,8);bytes.writeUInt16LE(directory.length,10);directory.copy(bytes,12);
  words.forEach((word,i)=>bytes.writeUInt16LE(word,12+directory.length+2*i));
  return bytes;
}

function check(raw){
  const atlas=decodeSeatSun(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
  assert.equal(atlas.sections.size,175);
  assert.deepEqual([...atlas.sections.keys()],keys);
  assert.throws(()=>decodeSeatSun(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength-2)));
  let error=0,centerError=0,total=0;const variation=new Map();
  const dir=new T.Vector3();
  for(const [month,day] of [[1,1],[1,17],[2,1],[2,28]])for(let hour=6;hour<21;hour++){
    const sun=summerSun({year:2027,month,day,minutes:hour*60+13});dir.fromArray(sun.direction);
    keys.forEach((key,i)=>{
      const [venue,id]=key.split('/'),value=sectionSun(atlas,venue,id,sun,false);
      assert.ok(Number.isInteger(value)&&value>=0&&value<=9);
      assert.equal(sectionSun(atlas,venue,id,sun,true),0);
      const mask=sun.aboveHorizon?cast(points[i],dir):0;
      let count=0;for(let k=0;k<9;k++)count+=(mask>>k)&1;
      error+=Math.abs(count-value);centerError+=Number(Boolean(mask&16)!==sectionCentreSun(atlas,venue,id,sun,false));total++;
      const v=variation.get(key)??new Set();v.add(value);variation.set(key,v);
    });
  }
  const mix=[...variation.values()].filter(s=>[...s].some(n=>n>0&&n<9));
  assert.ok(mix.length>60,'Section samples resolve partial shade');
  assert.ok(error/total<.7,'Interpolated counts track independent rays');
  assert.ok(centerError/total<.09,'The representative seat tracks independent rays');
  const format=(h,id)=>{
    const [venue,section]=id.split('/'),sun=summerSun({year:2027,month:1,day:17,minutes:h*60});
    return sectionSun(atlas,venue,section,sun,false);
  };
  for(const key of ['rla/1','rla/6','rla/16','rla/20','mca/5','mca/15','john/7A','john/18A']){
    console.log(key,[9,13,17,22].map(h=>h+'h='+format(h,key)).join(' '));
  }
  console.log('Passed',total,'independent section/time comparisons; mean count error', (error/total).toFixed(3),
    'of nine; centre agreement',((1-centerError/total)*100).toFixed(2)+'%;',
    mix.length,'bays showed partial shade during the sampled days.');
}

if(process.argv.includes('--check')){
  check(fs.readFileSync(output));
}else{
  const bytes=bake();
  check(bytes);
  const temp=new URL(output.href+'.'+process.pid+'.tmp');
  try{
    fs.writeFileSync(temp,bytes);fs.renameSync(temp,output);
  }finally{
    if(fs.existsSync(temp))fs.unlinkSync(temp);
  }
  console.log('Saved',bytes.length,'bytes for',keys.length,'bays');
}
