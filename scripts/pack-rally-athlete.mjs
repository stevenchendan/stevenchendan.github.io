// Pack the three retargeted Tennis-MoCap strokes used in Court Atlas.
// First sculpt the portraits with scripts/sculpt-tennis-players.py in Blender.
// Usage: node scripts/pack-rally-athlete.mjs <Tennis-Agent frontend directory> [portrait GLB]
import fs from 'node:fs/promises';
import {loadRunningClip} from './running-clip.mjs';
import {tailorAthlete} from './tennis-kit.mjs';
import {calibrateRelease,mountRacket} from './tennis-release.mjs';
import path from 'node:path';
import * as T from 'three';
import {MeshoptSimplifier} from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const upstream=process.argv[2];
if(!upstream) throw Error('Pass the path to the Tennis-Agent frontend containing the retargeted motion.');
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}
};
async function model(file){
  const buffer=await fs.readFile(file);
  return (await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'')).scene;
}
const base=new URL('../public/models/tennis/',import.meta.url);
const [athlete,equipment,recordings,boneNames,portraits]=await Promise.all([
  model(path.join(upstream,'public/models/tennis/tennis-athlete.glb')),
  model(new URL('club-player.glb',base)),
  fs.readFile(path.join(upstream,'src/lib/drills/recorded-motion.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(upstream,'src/lib/tennis-motion/rig-bones.json'),'utf8').then(JSON.parse),
  model(process.argv[3]??new URL('../.astro/player-portraits.glb',import.meta.url)),
]);
athlete.updateMatrixWorld(true);
const bones=boneNames.map(name=>athlete.getObjectByName(name));
const wrist=athlete.getObjectByName('RightHand');
const mesh=athlete.getObjectByName('Human_Mesh');

const dress=mesh.clone(false);
dress.name='TourDress';
mesh.parent.add(dress);
dress.updateWorldMatrix(true,false);
tailorAthlete(dress,portraits,true);
tailorAthlete(mesh,portraits);

// Merge the authored 16 × 19 strung racket into one mesh and attach its grip
// to the target wrist. The head centre is also the ball contact landmark.
const eq=equipment.getObjectByName('Racket');
eq.updateWorldMatrix(true,true);
const inverse=eq.matrixWorld.clone().invert(), parts=[];
eq.traverse(o=>{
  if(!o.isMesh)return;
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
  g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
  for(const attr of Object.keys(g.attributes))if(!['normal','position'].includes(attr))g.deleteAttribute(attr);
  const c=o.material.color;
  const col=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<col.length;i+=3){col[i]=c.r;col[i+1]=c.g;col[i+2]=c.b;}
  g.setAttribute('color',new T.BufferAttribute(col,3));parts.push(g);
});
const racket=new T.Mesh(mergeVertices(mergeGeometries(parts)),new T.MeshStandardMaterial({vertexColors:true,roughness:.64}));
racket.name='Stringbed';
mountRacket(wrist,racket);

// Attach the original Blender portraits to the bone in their fitted bind pose.
// Precompute an additional small index buffer for the precinct representation.
await MeshoptSimplifier.ready;
const [dressIndices]=MeshoptSimplifier.simplify(Uint32Array.from(dress.geometry.index.array),dress.geometry.attributes.position.array,3,1700*3,.012,['Permissive']);
dress.userData.distantIndices=Array.from(dressIndices);
for(const [name,role] of [['CapPlayer','TennisCap'],['BandPlayer','HeadbandPlayer'],['CropPlayer','CroppedPlayer'],['TiePlayer','TiedPlayer']]){
  const head=portraits.getObjectByName(name);head.name=role;
  const g=head.geometry;
  const [detailed]=MeshoptSimplifier.simplify(Uint32Array.from(g.index.array),g.attributes.position.array,3,8500*3,.00055,['LockBorder']);
  const [distant]=MeshoptSimplifier.simplify(detailed,g.attributes.position.array,3,520*3,.009,['Permissive']);
  head.userData.distantIndices=Array.from(distant);
  g.setIndex(new T.BufferAttribute(Uint16Array.from(detailed),1));
  athlete.getObjectByName('Head').attach(head);
}

// Flat-shoe reference for recovery steps, in the playing direction (-Z).
for(const side of ['Left','Right']){
  const foot=athlete.getObjectByName(side+'Foot');
  foot.userData.plantedQuaternion=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI)
    .multiply(foot.getWorldQuaternion(new T.Quaternion())).toArray();
}

const kinds=['forehand','volley','backhand-volley','backhand','serve'];
for(const kind of kinds)calibrateRelease(kind,recordings[kind],bones,racket);
for(const kind of kinds){
  const record=recordings[kind],pose=record.poses[Math.round(record.contact/record.dt)];
  bones[0].position.fromArray(pose.h);
  bones.forEach((b,i)=>b.quaternion.fromArray(pose.b[i]).normalize());
  console.log(kind,'impact',racket.getWorldPosition(new T.Vector3()).toArray().map(v=>v.toFixed(6)).join(', '));
}

const hips=bones[0],ready=recordings.volley.poses.at(-1);
for(const [i,bone] of bones.entries())bone.quaternion.fromArray(ready.b[i]).normalize();
hips.position.copy(hips.parent.worldToLocal(new T.Vector3(0,.82,0)));
athlete.updateMatrixWorld(true);

// Between shots the elbows bend and the support hand steadies the throat.
// Use the player's measured upper-arm and forearm lengths to set that stance.
function aim(node,child,target){
  const start=node.getWorldPosition(new T.Vector3());
  const from=child.getWorldPosition(new T.Vector3()).sub(start).normalize();
  const to=target.clone().sub(start).normalize();
  const rotation=new T.Quaternion().setFromUnitVectors(from,to).multiply(node.getWorldQuaternion(new T.Quaternion()));
  node.quaternion.copy(node.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));
  node.updateWorldMatrix(false,true);
}
function readyArm(side,handTarget,elbowPole){
  const arm=athlete.getObjectByName(side+'Arm'),forearm=athlete.getObjectByName(side+'ForeArm'),hand=athlete.getObjectByName(side+'Hand');
  const a=arm.getWorldPosition(new T.Vector3()),b=forearm.getWorldPosition(new T.Vector3()),c=hand.getWorldPosition(new T.Vector3());
  const upper=a.distanceTo(b),lower=b.distanceTo(c),axis=handTarget.clone().sub(a);
  const reach=Math.min(axis.length(),upper+lower-.002);axis.normalize();
  const along=(upper*upper-lower*lower+reach*reach)/(2*reach),bend=elbowPole.sub(a).projectOnPlane(axis).normalize();
  const elbow=a.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-along*along)));
  aim(arm,forearm,elbow);aim(forearm,hand,a.addScaledVector(axis,reach));
}
readyArm('Right',new T.Vector3(.055,.97,-.32),new T.Vector3(.38,.96,-.11));
const shaft=new T.Vector3(-.40,.87,-.29).normalize();
const face=new T.Vector3(.32,.08,-.94).projectOnPlane(shaft).normalize();
const racketRotation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(shaft.clone().cross(face),shaft,face));
wrist.quaternion.copy(wrist.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(racketRotation).multiply(racket.quaternion.clone().invert()));
athlete.updateMatrixWorld(true);
const throat=racket.localToWorld(new T.Vector3(0,-.275,0));
readyArm('Left',throat.add(new T.Vector3(-.04,-.038,.042)),new T.Vector3(-.37,.94,-.18));
athlete.updateMatrixWorld(true);

// Keep 50 Hz sampling at each impact. Only varying tracks need every frame.
const clips=kinds.map(kind=>{
  const {poses,dt}=recordings[kind],times=poses.map((_,i)=>i*dt);
  const tracks=[new T.VectorKeyframeTrack('Hips.position',times,poses.flatMap(p=>p.h))];
  for(const [i,bone] of bones.entries()){
    const first=poses[0].b[i],constant=poses.every(p=>Math.abs(1-Math.abs(new T.Quaternion(...first).dot(new T.Quaternion(...p.b[i]))))<.000001);
    if(constant && Math.abs(1-Math.abs(bone.quaternion.dot(new T.Quaternion(...first))))<.000001)continue;
    tracks.push(new T.QuaternionKeyframeTrack(bone.name+'.quaternion',constant?[0]:times,constant?first:poses.flatMap(p=>p.b[i])));
  }
  return new T.AnimationClip(kind,-1,tracks);
});
clips.push(await loadRunningClip(upstream,athlete));
athlete.userData.motionCredits='motion-credits.txt';
const bytes=await new GLTFExporter().parseAsync(athlete,{binary:true,animations:clips});
await fs.writeFile(new URL('rally-athlete.glb',base),Buffer.from(bytes));
console.log('Packed articulated tennis athlete, racket and five captured strokes:',bytes.byteLength,'bytes');
