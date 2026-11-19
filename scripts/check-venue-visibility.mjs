import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {loadArenaModule as load} from './arena-model-fixture.mjs';
const {buildContext,buildArena,disposeModel}=load('model');
const {venueVisible,courtVenue}=load('venueVisibility');
const {rallyCourts,courtDirectory,cameraCourtAreas,courtInView}=load('courtPlacements');
const data=JSON.parse(fs.readFileSync('public/data/1573-context.json','utf8'));
const courtsForFocus=courtDirectory(data),focusAreas=cameraCourtAreas(data,courtsForFocus);
for(const key of ['1573','mca','rla','john','kia','16']){
  const {x,z}=courtsForFocus.find(c=>c.key===key);
  // An oblique approach should identify the footprint under the centre of the view.
  const eye={x:x-12,y:80,z:z+18},target={x,y:0,z};
  assert.equal(courtInView(focusAreas,eye,target,100,'all',true),key);
  assert.equal(courtInView(focusAreas,eye,target,100,'oval',false),null);
}
assert.equal(courtInView(focusAreas,{x:-900,y:100,z:-900},{x:-900,y:0,z:-900},100,'all',true),null);
const context=buildContext(data);
const ids=['mca','rla','kia','village','john','centrepiece','ntc','west','east','oval',
  'hilltop','ballpark','topcourt','garden','terrace','courtside'];
// Each streamed region must contain exactly the meshes used by the complete model.
function meshCounts(roots){
  let meshes=0,vertices=0,instances=0;
  for(const root of roots)root.traverse(o=>{
    if(!o.isMesh)return;
    meshes++;vertices+=o.geometry.attributes.position.count;instances+=o.isInstancedMesh?o.count:1;
  });
  return {meshes,vertices,instances};
}
for(const id of ['landscape',...ids]){
  const part=buildContext(data,id);
  const original=context.children.filter(o=>id==='landscape'?!o.userData.venue:o.userData.venue===id);
  assert.deepEqual(meshCounts([part]),meshCounts(original),id+' can load independently');
  disposeModel(part);
}
for(const id of ids){
  const groups=context.children.filter(child=>venueVisible(child.userData.venue,id,false));
  assert.equal(groups.length,1,`${id} retains exactly its own venue group`);
  assert.equal(groups[0].userData.venue,id);
  assert.ok(groups[0].children.length>0,`${id} geometry is not empty`);
  assert.ok(!new THREE.Box3().setFromObject(groups[0]).isEmpty(),`${id} has renderable geometry`);
  assert.equal(venueVisible('1573',id,false),false,'Hide 1573 when inspecting another venue');
}
assert.equal(context.children.filter(child=>venueVisible(child.userData.venue,'1573',false)).length,0);
assert.equal(context.children.filter(child=>venueVisible(child.userData.venue,'all',false)).length,ids.length);
assert.ok(context.children.every(child=>venueVisible(child.userData.venue,'rla',true)),'Restoring surroundings shows all groups');
for(const id of ['mca','rla','kia','john','west','east']){
  assert.ok(rallyCourts(data).some(c=>venueVisible(courtVenue(c.id,c.x),id,false)),`${id} retains its rally`);
}
for(const id of ['mca','john','west','east']){
  const net=context.getObjectByName('venue-'+id).getObjectByName('court-net-mesh');
  assert.ok(net.material.transparent&&!net.material.depthWrite,`${id} keeps the view through its net`);
  const pos=net.geometry.getAttribute('position');
  assert.ok(pos.getY(1)-pos.getY(25)>.15,'The net tape drops from its posts to the centre strap');
}

const {rodLaverSeatEye}=load('rodLaverProfile');
const {seatSections}=load('seating');
const interior=context.getObjectByName('rod-laver-interior');
const chairs=interior.getObjectByName('rod-laver-seats');
assert.ok(chairs.count>12000&&chairs.count<18000,'Rod Laver retains its full two-tier seating bowl');
interior.updateWorldMatrix(true,true);
// Trace the four doubles corners from the whole cinema move. Expand each
// physical chair to include its seated spectator, even when the crowd is off.
const {film,filmFieldOfView,filmRain,filmRoof,filmDusk,filmLights}=load('film');
const take=film.find(t=>t.venue==='rla'),camera=new THREE.PerspectiveCamera();
const occupied=[],seatMatrix=new THREE.Matrix4(),seatCentre=new THREE.Vector3();
for(let i=0;i<chairs.count;i++){
  chairs.getMatrixAt(i,seatMatrix);seatCentre.setFromMatrixPosition(seatMatrix).applyMatrix4(chairs.matrixWorld);
  if(seatCentre.z<72||Math.abs(seatCentre.x-154)>24)continue;
  const box=new THREE.Box3().setFromCenterAndSize(seatCentre,new THREE.Vector3(.68,2.5,.8));
  box.translate(new THREE.Vector3(0,.45,0));occupied.push(box);
}
const sight=new THREE.Ray(),hit=new THREE.Vector3(),end=new THREE.Vector3();
for(let sample=0;sample<=32;sample++){
  const u=sample/32;
  camera.position.fromArray(take.from).lerp(end.fromArray(take.to),u);
  camera.lookAt(end.fromArray(take.look).lerp(new THREE.Vector3(...take.lookTo),u));
  camera.updateMatrixWorld();
  for(const x of [-5.485,5.485])for(const z of [-11.885,11.885]){
    end.set(154+x,.12,72+z);
    sight.set(camera.position,end.clone().sub(camera.position).normalize());
    const distance=camera.position.distanceTo(end);
    assert.ok(!occupied.some(box=>sight.intersectBox(box,hit)&&hit.distanceTo(camera.position)<distance),'Occupied Rod Laver row blocks the cinema view at '+u);
    for(const aspect of [320/844,390/844,16/9,21/9]){
      camera.aspect=aspect;camera.fov=filmFieldOfView(take,aspect);camera.updateProjectionMatrix();
      const ndc=end.clone().project(camera);
      assert.ok(Math.max(Math.abs(ndc.x),Math.abs(ndc.y))<.96,'Keep both doubles baselines in frame at '+aspect);
    }
  }
}
const audience=interior.getObjectByName('precinct-spectators'),aerialEye=new THREE.PerspectiveCamera();
aerialEye.position.set(154,150,207);aerialEye.updateMatrixWorld(true);audience.visible=true;
let distantCalls=0,distantTriangles=0;
audience.traverseVisible(node=>{
  if(node.isLOD)node.update(aerialEye);
  if(node.isInstancedMesh){distantCalls++;distantTriangles+=node.geometry.index.count/3*node.count;}
});
assert.equal(distantCalls,1,'The 200 m crowd view is one draw');
assert.ok(distantTriangles<30000,'A distant occupied venue uses cutouts');
const {courtFrame}=load('precinctGeometry');
for(const id of ['rla','mca','john','kia','west','east']){
  const fans=context.getObjectByName('venue-'+id).getObjectsByProperty('name','seated-spectators');
  if(id==='west'||id==='east'){
    // Show courts have sideline grandstands. Smaller practice courts each
    // have one audience shared across the four corner benches.
    const courts=data.features.filter(f=>f.kind==='court'&&courtVenue(f.id,courtFrame(f.points).x)===id);
    assert.ok(courts.length>0,`${id} includes the mapped outdoor courts`);
    assert.equal(fans.length,courts.length,`${id} has one audience per mapped court`);
  }else{
    assert.equal(fans.length,1,`${id} has one batched stadium crowd`);
  }
  for(const batch of fans){
    assert.ok(batch.count>0,`${id} uses the shared photographic audience`);
    assert.ok(batch.castShadow&&batch.receiveShadow,'Spectators participate in the sunlight and stadium shade');
    assert.equal(batch.customDepthMaterial.map,batch.material.map,'Shadow outlines match the photographed silhouettes');
  }
}
const {bindSpectators}=load('seatedCrowd');
const home=buildArena().group;
const courts=courtDirectory(data),instance=new THREE.Matrix4(),seat=new THREE.Vector3();
const {benchLayout}=load('playerBenches');
assert.equal(courts.filter(c=>benchLayout(c.key).source).length,17);
for(const court of courts){
  const root=court.key==='1573'?home:context.getObjectByName('venue-'+court.venue);
  root.updateWorldMatrix(true,true);
  const small=['west','east','village'].includes(court.venue)&&court.key!=='west-show';
  const c=Math.cos(court.rotation),s=Math.sin(court.rotation);
  let occupied=0;
  for(const batch of root.getObjectsByProperty('name','seated-spectators')){
    for(let i=0;i<batch.count;i++){
      batch.getMatrixAt(i,instance);seat.setFromMatrixPosition(instance).applyMatrix4(batch.matrixWorld);
      const dx=seat.x-court.x,dz=seat.z-court.z,x=Math.abs(dx*c-dz*s),z=Math.abs(dx*s+dz*c);
      if(seat.y<court.y || seat.y>court.y+15)continue;
      if(small ? (x<10&&z>15&&z<19.7)||(z<15&&x>9.7&&x<16.5) : Math.hypot(dx,dz)<45)occupied++;
    }
  }
  assert.ok(occupied>0,'An occupied stand at the height of '+court.en);
}
disposeModel(home);
const tickCrowd=bindSpectators(context,()=>{}),seatCamera=new THREE.PerspectiveCamera();
const lower=seatSections.rla.find(s=>s.id===6),sampleEye=rodLaverSeatEye(lower.x,lower.z,.26);
seatCamera.position.set(154+sampleEye[0],sampleEye[1],72+sampleEye[2]);seatCamera.updateMatrixWorld(true);
tickCrowd(seatCamera,.04,false);
const neighbours=audience.getObjectByName('seated-neighbours');
assert.ok(neighbours.visible&&neighbours.count>0&&neighbours.count<=40,'Nearby bodies use a bounded relief mesh');
assert.ok(neighbours.geometry.index.count*neighbours.count/3<=41600,'Close seats stay within the detail triangle budget');
const shader={uniforms:{},vertexShader:'',fragmentShader:''};
neighbours.material.onBeforeCompile(shader,null);
const phase=shader.uniforms.crowdTime;
assert.equal(phase.value,0,'Camera and wardrobe can update while motion is paused');
tickCrowd(seatCamera,.04,true);assert.equal(phase.value,.04);
tickCrowd(aerialEye,.04,false);
assert.equal(phase.value,.04);
assert.equal(neighbours.visible,false,'Moving to the overview removes the detail draw');
audience.visible=false;
const structure=interior.children.filter(node=>node.isMesh&&!node.isInstancedMesh);
const position=new THREE.Matrix4();
for(const section of seatSections.rla){
  const [x,y,z]=rodLaverSeatEye(section.x,section.z,section.tier==='upper'?.82:.26);
  let distance=Infinity;
  for(let i=0;i<chairs.count;i++){
    chairs.getMatrixAt(i,position);
    const e=position.elements;
    if(Math.abs(e[13]-(y-.92))<.01)distance=Math.min(distance,Math.hypot(e[12]-x,e[14]-z));
  }
  assert.ok(distance<.8,`Bay ${section.id} eye lands on a physical seat in the matching tier`);
  if(![1,6,12,20,37,44].includes(section.id))continue;
  const eye=new THREE.Vector3(154+x,y,72+z),toNet=new THREE.Vector3(154,1.55,72).sub(eye);
  const ray=new THREE.Raycaster(eye,toNet.clone().normalize(),.03,toNet.length());
  assert.equal(ray.intersectObjects(structure,false).length,0,`Bay ${section.id} has a clear sightline over the wall and balcony`);
}

const {ArenaRoof,RoofMotion}=load('roofs');
const roofs=new RoofMotion();
roofs.bind(context);
const assemblies=[];
context.traverse(node=>{if(node instanceof ArenaRoof)assemblies.push(node);});
assert.deepEqual(assemblies.map(roof=>roof.venue).sort(),['john','mca','rla']);
const down=new THREE.Vector3(0,-1,0);
function actualRoofHeight(roof,x,z){
  roof.updateWorldMatrix(true,true);
  const ray=new THREE.Raycaster(new THREE.Vector3(x,50,z),down);
  return ray.intersectObjects(roof.children,true)[0]?.point.y??0;
}
const depths={john:36,mca:22.5,rla:35};
for(const roof of assemblies){
  const {x,z}=roof.position;
  assert.equal(actualRoofHeight(roof,x+.3,z+.3),0,`${roof.venue} has a clear opening`);
  assert.equal(roofs.rainFloor(x+.3,z+.3),.15);
  assert.ok(roofs.rainFloor(x,z+depths[roof.venue]+3)>10,'The parked panel shelters its end stand');
}
assert.equal(roofs.advance(true,false,600),'closing','An idle frame must not skip the animation');
assert.ok(roofs.progress<.001);
for(let i=0;i<200;i++)roofs.advance(true,false,1/60);
assert.ok(roofs.progress>.4&&roofs.progress<.6);
for(const roof of assemblies){
  const {x,z}=roof.position, depth=depths[roof.venue];
  assert.equal(roofs.rainFloor(x+.3,z+.2),.15,'Rain can reach the remaining aperture');
  assert.ok(actualRoofHeight(roof,x+.3,z+depth*.8)>10);
  assert.ok(roofs.rainFloor(x+.3,z+depth*.8)>10,'Rain stops at the travelling leaf');
}
const before=roofs.progress;
assert.equal(roofs.advance(false,false,1/60),'opening');
assert.ok(Math.abs(roofs.progress-before)<.003,'A reversal preserves the current position');
for(let i=0;i<500;i++)roofs.advance(false,false,1/60);
assert.equal(roofs.status,'open');
for(const hz of [12,30,60,144]){
  let elapsed=0;
  do{roofs.advance(true,false,1/hz);elapsed+=1/hz;}while(roofs.moving&&elapsed<10);
  assert.equal(roofs.status,'closed');
  assert.ok(elapsed>6&&elapsed<9,`Closure at ${hz} fps took ${elapsed.toFixed(2)} seconds`);
  for(const roof of assemblies){
    const {x,z}=roof.position;
    for(const dx of [-18.3,.3,18.3])for(const dz of [-17.1,-.001,.001,17.1]){
      const surface=actualRoofHeight(roof,x+dx,z+dz);
      assert.ok(surface>10,`${roof.venue} has a complete physical ceiling`);
      assert.ok(Math.abs(roofs.rainFloor(x+dx,z+dz)-surface)<.13,`${roof.venue} rain stops at its skin`);
    }
  }
  assert.equal(roofs.rainFloor(0,0),.15,'1573 Arena stays exposed');
  assert.equal(roofs.rainFloor(344.8375,78.58),.15,'Kia Arena stays exposed');
  assert.equal(roofs.advance(false,true,0),'open','Reduced motion reopens instantly');
}
assert.equal(roofs.advance(true,true,0),'closed');
const hidden=assemblies[0];
hidden.parent.visible=false;
assert.equal(roofs.rainFloor(hidden.position.x,hidden.position.z),.15,'Hidden venues cannot shelter visible rain');
hidden.parent.visible=true;
const filmedRoof=new RoofMotion();
filmedRoof.bind(context);
const rainShot=film.find(t=>t.cue==='rain'),nightShot=film.find(t=>t.cue==='nightfall');
assert.ok(filmRain(1)>0&&filmRoof(1)===0,'Rain arrives before closure starts');
for(const [seconds,status] of [[0,'open'],[5,'closing'],[5,'closing'],[rainShot.seconds-1,'closed'],[0,'open']]){
  assert.equal(filmedRoof.setFilmClosure(filmRoof(seconds)),status);
  for(const roof of assemblies){
    const {x,z}=roof.position;
    assert.equal(actualRoofHeight(roof,x+.3,z+.3)>10,status==='closed','Roof geometry follows playback and replay on '+roof.venue);
  }
}
assert.ok(filmDusk(2)>0&&filmLights(2)===0);
assert.ok(filmLights(5)>0&&filmLights(5)<1);
assert.equal(filmLights(nightShot.seconds-2),1);
assert.equal(filmDusk(nightShot.seconds-2),1);
disposeModel(context);
console.log('Venue visibility and retractable roofs passed, including roof geometry, rain cover, reversal, speed and reduced motion.');
