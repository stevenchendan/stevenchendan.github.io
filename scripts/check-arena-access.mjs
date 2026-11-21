import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {loadArenaModule as load} from './arena-model-fixture.mjs';

const data=JSON.parse(fs.readFileSync(new URL('../public/data/1573-context.json',import.meta.url)));
assert.equal(load('venueVisibility').buildingVenue({id:'812707-1-0'}),'rla',
  'Eastern Pavilion belongs to Rod Laver, not the generic landscape that concealed its entrance');
const {currentForkBridgeRing,forkBridgeParts}=load('forkBridge');
const old=data.buildings.find(b=>b.id==='806910-1-0');
const current=currentForkBridgeRing(old.ring),parts=forkBridgeParts(current,12);
assert.ok(current.every(p=>p[1]<=-58),'Demolished southern bridge must not overlap Kia or Centrepiece');
assert.equal(JSON.stringify(current.slice(0,295)),JSON.stringify(old.ring.slice(0,295)),'Both northern ground approaches are preserved');
for(const p of parts)for(const [x,z] of p.ring)assert.ok(Number.isFinite(p.height(x,z)));
for(const [part,tip] of [[parts[0],old.ring[96]],[parts[1],old.ring[240]]])
  assert.ok(Math.abs(part.height(...tip)-.025)<.001,'Approaches still descend to ground');

const {cutEntry}=load('arenaAccess');
for(const yaw of [0,Math.PI/2,-Math.PI/2,Math.PI]){
  const wall=new T.BoxGeometry(12,6,.4);wall.translate(0,3,0);wall.rotateY(yaw);wall.translate(20,0,30);
  const mesh=new T.Mesh(cutEntry(wall,{name:'test',x:20,z:30,yaw,width:4,height:3,depth:2}),new T.MeshBasicMaterial({side:T.DoubleSide}));
  const ray=(u,y)=>new T.Raycaster(new T.Vector3(20+u*Math.cos(yaw)+4*Math.sin(yaw),y,30-u*Math.sin(yaw)+4*Math.cos(yaw)),new T.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)));
  mesh.updateMatrixWorld();
  assert.equal(ray(0,1.5).intersectObject(mesh).length,0,'Entrance is a real opening');
  assert.ok(ray(4,1.5).intersectObject(mesh).length,'Adjacent wall remains');
  assert.ok(ray(0,4.5).intersectObject(mesh).length,'Lintel remains');
  assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
}
console.log('Arena apertures and surviving bridge approaches verified.');

// Exercise the actual assembled venues: nested bowl walls, advertising planes,
// facade layers and annex masses must all leave their entrances open.
const {buildContext,disposeModel}=load('model'),{arenaEntries}=load('arenaAccess');
const frame=load('precinctGeometry').courtFrame(data.features.find(f=>f.id==='way/1239949234').points);
for(const id of ['rla','mca']){
  const root=buildContext(data,id);root.updateMatrixWorld(true);
  const structural=[];
  root.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&o.name!=='entrance-sign')structural.push(o);});
  const origin=id==='rla'?new T.Vector3(141.5,1.5,61.8):new T.Vector3(frame.x+12.4,1.5,frame.z-10);
  const hit=new T.Raycaster(origin,new T.Vector3(id==='rla'?-1:1,0,0)).intersectObjects(structural,false)[0];
  assert.ok(hit&&hit.distance>10,`${id}: player tunnel must extend through seating, not stop at a painted panel`);
  const entry=arenaEntries[id][id==='rla'?1:0],normal=new T.Vector3(Math.sin(entry.yaw),0,Math.cos(entry.yaw));
  const outside=new T.Vector3(entry.x,(entry.base??0)+1.5,entry.z).addScaledVector(normal,2);
  const door=new T.Raycaster(outside,normal.clone().negate()).intersectObjects(structural,false)[0];
  assert.ok(door&&door.distance>5,`${id}: public entrance is recessed behind the outer facade`);
  disposeModel(root);
}
console.log('Rod Laver and Margaret Court assembled entrance and player passages verified.');
