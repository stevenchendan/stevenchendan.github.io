import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const modules=new Map();
// Only canvas labels/textures are stubbed; all geometry uses real Three.js.
const document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},ellipse(){},fill(){}})})};
function load(name){
  if(name==='three')return THREE;
  if(name.startsWith('three/'))return {mergeGeometries};
  const key=name.replace('./','');if(modules.has(key))return modules.get(key);
  const m={exports:{}};modules.set(key,m.exports);
  const source=fs.readFileSync(`site/components/arena1573/${key}.ts`,'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:load,document});
  return m.exports;
}
const {buildContext,disposeModel}=load('model');
const {venueVisible,courtVenue}=load('venueVisibility');
const {rallyCourts}=load('courtPlacements');
const data=JSON.parse(fs.readFileSync('public/data/1573-context.json','utf8'));
const context=buildContext(data);
const ids=['mca','rla','kia','village','john','centrepiece','ntc','west','east','oval'];
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
const audience=interior.getObjectByName('precinct-spectators'),aerialEye=new THREE.PerspectiveCamera();
aerialEye.position.set(154,150,207);aerialEye.updateMatrixWorld(true);audience.visible=true;
let distantCalls=0,distantTriangles=0;
audience.traverseVisible(node=>{
  if(node.isLOD)node.update(aerialEye);
  if(node.isInstancedMesh){distantCalls++;distantTriangles+=node.geometry.index.count/3*node.count;}
});
assert.equal(distantCalls,1,'The 200 m crowd view is one draw');
assert.ok(distantTriangles<30000,'A distant occupied venue uses cutouts');
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
disposeModel(context);
console.log('Venue visibility and retractable roofs passed, including roof geometry, rain cover, reversal, speed and reduced motion.');
