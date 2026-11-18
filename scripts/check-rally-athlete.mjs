import assert from 'node:assert/strict';
import * as T from 'three';
import {loadModule,loadAthlete} from './rally-fixture.mjs';

loadModule('strokeContacts');
const {strokes,rallyFrame,RALLY_SECONDS,COURT_FLOOR}=loadModule('rallyMotion');
const {makeAthlete}=loadModule('athleteRig');
const {footwork}=loadModule('footwork');
const {scene,animations}=await loadAthlete();
const figures=[makeAthlete(scene,animations,'#286e82',true),makeAthlete(scene,animations,'#df8f38',false)];
const point=new T.Vector3(),ball=new T.Vector3(),direction=new T.Vector3();
function at(figure,name){return figure.group.getObjectByName(name).getWorldPosition(new T.Vector3());}
const near=figures[0],far=figures[1];
const skinned=near.group.getObjectByName('Human_Mesh');
assert.ok(skinned.isSkinnedMesh && skinned.skeleton!==far.group.getObjectByName('Human_Mesh').skeleton);
assert.equal(near.group.getObjectByName('TennisCap').visible,true);
assert.equal(far.group.getObjectByName('TennisCap').visible,false);
let maxContactError=0;
for(const [i,stroke] of strokes.entries()){
  const frame=rallyFrame(stroke.at),figure=figures[i%2];
  figure.pose(frame.players[i%2]);
  const error=at(figure,'Stringbed').distanceTo(ball.fromArray(frame.ball));
  maxContactError=Math.max(maxContactError,error);
  assert.ok(error<.001,'Wrist-mounted stringbed must intersect the ball at every contact. Error: '+error);
}
const pairs=[['LeftUpLeg','LeftLeg'],['LeftLeg','LeftFoot'],['RightArm','RightForeArm'],['RightForeArm','RightHand']];
const lengths=pairs.map(([a,b])=>at(near,a).distanceTo(at(near,b)));
const positions=skinned.geometry.attributes.position;
let lowest=Infinity,highestSole=-Infinity;
for(let t=-.16;t<RALLY_SECONDS;t+=1/30){
  const frame=rallyFrame(t),actor=frame.players[0];near.pose(actor);
  pairs.forEach(([a,b],i)=>assert.ok(Math.abs(at(near,a).distanceTo(at(near,b))-lengths[i])<.001,'Fixed bone length at '+t));
  // Include the actual deformed toes and heels, not just the ankle pivots.
  if(Math.round(t*30)%4===0){
    near.group.updateMatrixWorld(true);skinned.skeleton.update();
    let sole=Infinity;
    for(let i=0;i<positions.count;i++){
      skinned.getVertexPosition(i,point).applyMatrix4(skinned.matrixWorld);
      assert.ok(Number.isFinite(point.length()));
      sole=Math.min(sole,point.y-COURT_FLOOR);
    }
    lowest=Math.min(lowest,sole);highestSole=Math.max(highestSole,sole);
  }
}
console.log('Maximum impact error',maxContactError.toFixed(6),'m. Deformed sole range',lowest.toFixed(4),highestSole.toFixed(4),'m.');
assert.ok(lowest>-.025 && highestSole<.14,'Players stay grounded through shots and recovery.');
// Evaluate the actual ankle joints in world space while the player runs.
// The supporting foot should stay stationary as the hips pass over it.
for(const [side,figure] of figures.entries()){
  let previous=[];
  const slip=[];
  for(let i=0;i<RALLY_SECONDS*60;i++){
    const actor=rallyFrame(i/60).players[side],gait=footwork(actor);
    figure.pose(actor);
    previous=['Left','Right'].map((name,index)=>{
      const p=at(figure,name+'Foot'),support=gait.feet[index].planted&&gait.speed>1.9;
      if(support&&previous[index]?.support)slip.push(Math.hypot(p.x-previous[index].p.x,p.z-previous[index].p.z));
      return {p,support};
    });
  }
  slip.sort((a,b)=>a-b);
  assert.ok(slip.length>100&&slip[Math.floor(slip.length*.95)]<.005,'Support foot drifts during running');
}
// Confirm a real through-swing, not a stationary contact pose.
for(const kind of ['forehand','volley','backhand-volley']){
  const i=strokes.findIndex(s=>s.kind===kind),figure=figures[i%2],atTime=strokes[i].at;
  const head=t=>{figure.pose(rallyFrame(t).players[i%2]);return at(figure,'Stringbed');};
  const before=head(atTime-.025),after=head(atTime+.025);
  assert.ok(direction.subVectors(after,before).length()/.05>2,'Racket accelerates through '+kind);
}
// The markerless source includes a post-impact wrist flip. Protect the fitted
// grip, an approximately square string bed and the high across-body finish.
for(const kind of ['forehand','volley','backhand-volley']){
  const actor={...rallyFrame(0).players[0],x:0,z:0,yaw:0,pace:1,kind};
  const head=near.group.getObjectByName('Stringbed'),wrist=near.group.getObjectByName('RightHand');
  const rotation=new T.Quaternion(),expected=new T.Vector3(),actual=new T.Vector3();
  let peakAngular=0,previous;
  for(let f=-120;f<=120;f++){
    near.pose({...actor,relativeTime:f/200});
    head.getWorldQuaternion(rotation);
    if(previous)peakAngular=Math.max(peakAngular,previous.angleTo(rotation)*200);
    previous=rotation.clone();
    actual.set(0,-.397,0);head.localToWorld(actual);
    const handQ=wrist.getWorldQuaternion(new T.Quaternion());
    expected.set(0,.069,.024).applyQuaternion(handQ).add(at(near,'RightHand'));
    assert.ok(actual.distanceTo(expected)<.0001,'The grip stays in the palm through the entire '+kind);
    if(f===0)assert.ok(new T.Vector3(0,0,-1).applyQuaternion(rotation).z>.98,'Square stringbed at '+kind+' impact');
    if(kind==='forehand' && f===40){
      const tip=at(near,'Stringbed').sub(at(near,'RightHand'));
      assert.ok(tip.y>.2 && tip.x<-.15,'The follow-through wraps above the hand on the opposite side.');
    }
  }
  assert.ok(peakAngular<(kind==='forehand'?36:18),'Continuous wrist rotation through '+kind);
}
figures.forEach(f=>f.dispose());
console.log('Verified three captured strokes, independent rigs, fixed limb lengths and every racket/ball impact.');
