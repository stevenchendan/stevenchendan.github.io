// Bake local bone transforms once, so all distant players can share two draw calls.
// Run after changing the athlete mesh, captured strokes, footwork or rally choreography.
import fs from 'node:fs/promises';
import * as T from 'three';
import {MeshoptSimplifier} from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import {loadModule,loadAthlete} from './rally-fixture.mjs';

loadModule('strokeContacts');
const {strokes,rallyFrame,RALLY_SECONDS}=loadModule('rallyMotion');
const {makeAthlete}=loadModule('athleteRig');
const {scene,animations}=await loadAthlete();
const athlete=makeAthlete(scene,animations,'#277b9a',true),root=athlete.group;
const skeleton=root.getObjectByName('Human_Mesh').skeleton;
const attachments=['Stringbed','TennisCap'].map(name=>root.getObjectByName(name));
const {strokeOrder,samplesPerStroke,gaitSamples,extraPoseRows}=loadModule('strokePoseRows');
const jointCount=skeleton.bones.length+attachments.length;
// Keep editorial contact times as exact samples, including exchanges at net.
const samples=new Set([0,RALLY_SECONDS,...strokes.map(shot=>shot.at)]);
for(let i=1;i/30<RALLY_SECONDS;i++)samples.add(i/30);
const times=Float32Array.from([...samples].sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>.00001));
const data=new Uint16Array((2*times.length+extraPoseRows)*jointCount*8);
const m=new T.Matrix4(),inverse=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();
let index=0;
function sample(previous){
    inverse.copy(root.matrixWorld).invert();
    for(let j=0;j<jointCount;j++){
      if(j<skeleton.bones.length)m.multiplyMatrices(inverse,skeleton.bones[j].matrixWorld).multiply(skeleton.boneInverses[j]);
      else m.multiplyMatrices(inverse,attachments[j-skeleton.bones.length].matrixWorld);
      m.decompose(p,q,scale);q.normalize();
      // q and -q represent the same rotation. Neighbouring rows must take the short arc.
      if(previous[j].dot(q)<0)q.set(-q.x,-q.y,-q.z,-q.w);
      previous[j].copy(q);
      for(const v of [q.x,q.y,q.z,q.w,p.x,p.y,p.z,scale.x])data[index++]=T.DataUtils.toHalfFloat(v);
    }
}
for(let side=0;side<2;side++){
  const previous=Array.from({length:jointCount},()=>new T.Quaternion());
  for(const seconds of times){
    athlete.pose(rallyFrame(seconds).players[side]);root.updateMatrixWorld(true);
    sample(previous);
  }
}
const {impactTime}=loadModule('strokeContacts');
const base={...rallyFrame(0).players[0],x:0,z:0,yaw:0,vx:0,vz:0,turn:0,split:0,pace:1};
const previous=Array.from({length:jointCount},()=>new T.Quaternion());
function steps(phase,running){
  return {phase,speed:running?3:0,feet:[0,1].map((side)=>{
    const t=phase*2*Math.PI+side*Math.PI;
    return {x:side===0?-.17:.17,y:.074+(running?.12*Math.max(0,Math.sin(t)):0),z:running?.32*Math.cos(t):0,swing:0,planted:true};
  })};
}
for(const kind of strokeOrder)for(let i=0;i<samplesPerStroke;i++){
  athlete.pose({...base,kind,relativeTime:i/50-impactTime(kind)},steps(0,false));
  root.updateMatrixWorld(true);sample(previous);
}
for(let i=0;i<=gaitSamples;i++){
  const run=i<gaitSamples;
  athlete.pose({...base,turn:run?1:0,relativeTime:4},steps(i/(gaitSamples-1),run));
  root.updateMatrixWorld(true);sample(previous);
}
const skin=scene.getObjectByName('Human_Mesh').geometry;
await MeshoptSimplifier.ready;
const [simplified]=MeshoptSimplifier.simplify(Uint32Array.from(skin.index.array),skin.attributes.position.array,3,1700*3,.012,['Permissive']);
const indices=Uint16Array.from(simplified);
const header=new Uint32Array([times.length,jointCount,indices.length]);
const file=Buffer.concat([Buffer.from(header.buffer),Buffer.from(times.buffer),Buffer.from(data.buffer),Buffer.from(indices.buffer)]);
await fs.writeFile(new URL('../public/models/tennis/precinct-motion.bin',import.meta.url),file);
console.log('Packed',times.length,'poses per athlete and',jointCount,'joints,',indices.length/3,'body triangles in',file.length,'bytes.');
