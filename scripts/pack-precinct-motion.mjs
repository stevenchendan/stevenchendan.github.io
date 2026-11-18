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
const jointCount=skeleton.bones.length+attachments.length;
// Keep editorial contact times as exact samples, including exchanges at net.
const samples=new Set([0,RALLY_SECONDS,...strokes.map(shot=>shot.at)]);
for(let i=1;i/30<RALLY_SECONDS;i++)samples.add(i/30);
const times=Float32Array.from([...samples].sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>.00001));
const data=new Uint16Array(2*times.length*jointCount*8);
const m=new T.Matrix4(),inverse=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();
let index=0;
for(let side=0;side<2;side++){
  const previous=Array.from({length:jointCount},()=>new T.Quaternion());
  for(const seconds of times){
    athlete.pose(rallyFrame(seconds).players[side]);root.updateMatrixWorld(true);
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
}
const skin=scene.getObjectByName('Human_Mesh').geometry;
await MeshoptSimplifier.ready;
const [simplified]=MeshoptSimplifier.simplify(Uint32Array.from(skin.index.array),skin.attributes.position.array,3,1700*3,.012,['Permissive']);
const indices=Uint16Array.from(simplified);
const header=new Uint32Array([times.length,jointCount,indices.length]);
const file=Buffer.concat([Buffer.from(header.buffer),Buffer.from(times.buffer),Buffer.from(data.buffer),Buffer.from(indices.buffer)]);
await fs.writeFile(new URL('../public/models/tennis/precinct-motion.bin',import.meta.url),file);
console.log('Packed',times.length,'poses per athlete and',jointCount,'joints,',indices.length/3,'body triangles in',file.length,'bytes.');
