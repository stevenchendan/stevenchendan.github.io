import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {loadModule,loadAthlete} from './rally-fixture.mjs';

const {rallyCourts,courtDirectory,venueCourts}=loadModule('courtPlacements');
const {strokes,RALLY_SECONDS}=loadModule('rallyMotion');
const {makePrecinctPlayers,readPoseAtlas,poseRow}=loadModule('precinctPlayers');
const data=JSON.parse(fs.readFileSync(new URL('../public/data/1573-context.json',import.meta.url),'utf8'));
const placements=rallyCourts(data).map((c,i)=>({...c,phase:i*.713}));
assert.equal(placements.length,30);
assert.equal(new Set(placements.map(c=>c.id)).size,placements.length);
assert.equal(placements.filter(c=>c.y>5).length,5);
const {scene,animations}=await loadAthlete();
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
// Verify camera promotion on every world transform, including when the rally clock is paused.
const all=courtDirectory(data),other=all.filter(c=>c.venue!=='1573');
assert.equal(all.length,31);assert.equal(new Set(all.map(c=>c.key)).size,31);
assert.equal(venueCourts(all,'east')[0].key,'18');assert.equal(venueCourts(all,'west')[0].key,'5');
const adaptive=makePrecinctPlayers(scene,buffer,other,animations),camera=new T.PerspectiveCamera(40,1,.1,1100);
const person=adaptive.group.children[0],close=adaptive.group.getObjectByName('courtside-athletes');
for(const [index,c] of other.entries()){
  const s=Math.sin(c.rotation),cs=Math.cos(c.rotation);
  camera.position.set(c.x+12*s,c.y+2,c.z+12*cs+4);camera.lookAt(c.x+12*s,c.y+1,c.z+12*cs);camera.updateMatrixWorld(true);
  adaptive.pose(-.16,camera,650);
  const pair=close.children.find(g=>g.visible && g.position.distanceTo(new T.Vector3(c.x,c.y,c.z))<.001);
  assert.ok(pair,'A close camera should show the full athletes on '+c.en);
  assert.equal(pair.children.length,2);
  for(let side=0;side<2;side++){
    assert.ok(pair.children[side].getObjectByName('Human_Mesh').isSkinnedMesh);
    person.getMatrixAt(index*2+side,matrix);assert.ok(Math.abs(matrix.determinant())<.000001,'Avoid a duplicate athlete at '+c.en);
  }
}
camera.position.set(180,720,500);camera.lookAt(300,0,50);camera.updateMatrixWorld(true);adaptive.pose(-.16,camera,650);
assert.ok(close.children.every(g=>!g.visible));
for(let i=0;i<person.count;i++){person.getMatrixAt(i,matrix);assert.ok(matrix.determinant()>.9);}
adaptive.dispose();
// Check the actual court-specific matches at both rendering distances.
const {courtMatch,tossTime}=loadModule('courtMatches');
const {makeAthlete}=loadModule('athleteRig');
const {matchPair}=loadModule('athleteKits');
const matchPlayers=makePrecinctPlayers(scene,buffer,all);
const [distant,matchBalls]=matchPlayers.group.children;
const closePlayer=makeAthlete(scene,animations,'#277b9a',true);
const stringbed=closePlayer.group.getObjectByName('Stringbed');
const matchDurations=new Set(),kinds=new Set();
let shotCount=0;
for(const [courtIndex,court] of all.entries()){
  const match=courtMatch(court.key),kits=matchPair(court.key);
  matchDurations.add(match.duration);
  assert.notEqual(kits[0].portrait,kits[1].portrait);
  for(const point of match.points){
    for(const [i,stroke] of point.rally.strokes.slice(0,point.last+1).entries()){
      const t=point.at+tossTime+stroke.at+.00000001,side=(i%2)^Number(point.flip);
      const frame=match.frame(t),actor=frame.players[side];
      assert.equal(actor.kind,stroke.kind);
      closePlayer.pose(actor);
      assert.ok(stringbed.getWorldPosition(near).distanceTo(far.fromArray(frame.ball))<.002,'Close-up impact on '+court.en);
      matchPlayers.pose(t-court.phase);
      const slot=courtIndex*2+side,row=distant.geometry.attributes.playerPose.getX(slot);
      assert.equal(distant.geometry.attributes.portrait.getX(slot),kits[side].portrait);
      const start=4*(Math.round(row)*width+racketJoint*2+1);
      near.set(...Array.from(pixel.subarray(start,start+3),T.DataUtils.fromHalfFloat));
      distant.getMatrixAt(slot,matrix);near.applyMatrix4(matrix);
      matchBalls.getMatrixAt(courtIndex,matrix);
      assert.ok(near.distanceTo(far.setFromMatrixPosition(matrix))<.002,'Distant impact on '+court.en);
      let previous=frame.ball;
      for(let j=1;j<=80;j++){
        const ball=match.frame(t+stroke.flight*j/80-.000001).ball;
        if(previous[2]*ball[2]<0){
          const u=previous[2]/(previous[2]-ball[2]);
          const x=previous[0]+u*(ball[0]-previous[0]),y=previous[1]+u*(ball[1]-previous[1]);
          assert.ok(y-.0335>1.009+.156*Math.abs(x)/6.4,'Clear the tape on '+court.en);
        }
        previous=ball;
      }
      if(!i){
        const bounce=match.frame(t+stroke.flight*.565).ball;
        assert.ok(Math.abs(bounce[1]-.1485)<.001 && Math.abs(bounce[2])<6.401 &&
          Math.abs(bounce[0])<4.116 && bounce[0]*frame.ball[0]<0,'Serve lands in the opposite service box on '+court.en);
      }
      shotCount++;kinds.add(stroke.kind);
    }
    assert.equal(match.frame(point.at+tossTime+point.liveEnd+1).ballVisible,false);
  }
}
assert.equal(matchDurations.size,all.length);
assert.equal(kinds.size,5);
matchPlayers.dispose();closePlayer.dispose();
console.log('Verified',shotCount,'racket contacts, net clearance and service-box landings across',all.length,'distinct matches.');
console.log('Verified all 31 court links, close-up skinning and return to the precinct, including with the rally paused.');
console.log('Verified 30 courts, 60 instanced players, five raised courts and baked racket contact within',Math.ceil(maxError*1000),'mm.');
