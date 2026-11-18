import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {loadModule,loadAthlete} from './rally-fixture.mjs';

const {rallyCourts}=loadModule('courtPlacements');
const {strokes,RALLY_SECONDS}=loadModule('rallyMotion');
const {makePrecinctPlayers,readPoseAtlas,poseRow}=loadModule('precinctPlayers');
const data=JSON.parse(fs.readFileSync(new URL('../public/data/1573-context.json',import.meta.url),'utf8'));
const placements=rallyCourts(data).map((c,i)=>({...c,phase:i*.713}));
assert.equal(placements.length,30);
assert.equal(new Set(placements.map(c=>c.id)).size,placements.length);
assert.equal(placements.filter(c=>c.y>5).length,5);
const {scene}=await loadAthlete();
const bytes=fs.readFileSync(new URL('../public/models/tennis/precinct-motion.bin',import.meta.url));
const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const {times,texture,indices}=readPoseAtlas(buffer);
assert.ok(Math.abs(times.at(-1)-RALLY_SECONDS)<1e-5);
assert.ok(indices.length/3<2600);
const p=makePrecinctPlayers(scene,buffer,placements),[bodies,balls]=p.group.children;
assert.equal(bodies.count,60);assert.equal(balls.count,30);assert.equal(p.group.children.length,2);
// Test the actual half-float transform sampled by the GPU at each racket contact,
// including off-axis and elevated courts, the rear striker and wraparound.
const racketJoint=scene.getObjectByName('Human_Mesh').skeleton.bones.length;
const pixel=texture.image.data,width=texture.image.width,near=new T.Vector3(),far=new T.Vector3(),matrix=new T.Matrix4();
let maxError=0;
for(const [i,stroke] of strokes.entries()){
  for(const courtIndex of [0,5,14,23,29]){
    const c=placements[courtIndex],elapsed=stroke.at-c.phase-RALLY_SECONDS;
    p.pose(elapsed);
    const slot=2*courtIndex+i%2;
    const row=bodies.geometry.attributes.playerPose.getX(slot);
    assert.ok(Math.abs(row-(poseRow(times,stroke.at)+i%2*times.length))<.001);
    const a=Math.floor(row),b=Math.min(a+1,texture.image.height-1),alpha=row-a;
    function offset(frame,out){
      const start=4*(frame*width+racketJoint*2+1);
      return out.set(...Array.from(pixel.subarray(start,start+3),T.DataUtils.fromHalfFloat));
    }
    offset(a,near).lerp(offset(b,far),alpha);
    bodies.getMatrixAt(slot,matrix);near.applyMatrix4(matrix);
    balls.getMatrixAt(courtIndex,matrix);far.setFromMatrixPosition(matrix);
    maxError=Math.max(maxError,near.distanceTo(far));
  }
}
assert.ok(maxError<.002,'Racket/ball impact precision: '+maxError);
texture.dispose();p.dispose();
console.log('Verified 30 courts, 60 instanced players, five raised courts and baked racket contact within',Math.ceil(maxError*1000),'mm.');
