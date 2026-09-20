import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const modules=new Map();
// Only canvas labels/textures are stubbed; all geometry uses real Three.js.
const document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}})})};
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
const ids=['mca','rla','kia','john','centrepiece','ntc','west','east','oval'];
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
disposeModel(context);
console.log('Venue visibility passed: all 10 destinations, AO overview, context restoration and venue rallies.');
