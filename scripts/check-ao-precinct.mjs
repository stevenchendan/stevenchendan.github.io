import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const data=JSON.parse(fs.readFileSync(new URL('public/data/1573-context.json',root)));
const spatial={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('site/components/arena1573/precinctGeometry.ts',root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:spatial,exports:spatial.exports});
const {courtFrame,pathIntervals,pavingCells}=spatial.exports;
const slabs=[[15,-142,210,195,'west'],[110,-12,245,105,'east']];
const cells=pavingCells(slabs);
assert.equal(cells.reduce((area,[,,w,d])=>area+w*d,0),210*195+245*105-132.5*20,'Preserve paved union area');
for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++){
  const [x,z,w,d]=cells[i],[xx,zz,ww,dd]=cells[j];
  assert.ok(Math.abs(x-xx)>=(w+ww)/2||Math.abs(z-zz)>=(d+dd)/2,'No coplanar overlapping paving');
}
assert.equal(cells.find(([x,z,w,d])=>Math.abs(50-x)<w/2&&Math.abs(-55-z)<d/2)[4],'east','Stable colour in reported overlap');
const eastern=data.features.filter(f=>f.kind==='court'&&f.points.some(p=>p[0]>600));
for(const f of eastern){
  const frame=courtFrame(f.points);
  assert.ok(frame.width>17&&frame.width<22,`${f.id}: invalid runoff width`);
  assert.ok(frame.depth>35&&frame.depth<40,`${f.id}: invalid runoff length`);
  const minZ=Math.min(...f.points.map(p=>p[1])),maxZ=Math.max(...f.points.map(p=>p[1]));
  assert.ok(Math.abs(frame.z-(minZ+maxZ)/2)<.3,`${f.id}: court shifted to one end`);
}
const east18=courtFrame(data.features.find(f=>f.id==='way/320313219').points);
assert.ok(Math.abs(east18.x-611.1)<.2&&Math.abs(east18.z-218.1)<.2,'Court 18 regression: full octagon centre');
const testFrame={x:0,z:0,width:20,depth:36,rotation:0};
const clipped=pathIntervals([-30,0],[30,0],[testFrame],2);
assert.equal(clipped.length,2,'Crossing path must keep both exterior segments');
assert.ok(Math.abs(clipped[0][1]-.3)<1e-9&&Math.abs(clipped[1][0]-.7)<1e-9,'Path width must clear court');
assert.equal(pathIntervals([-5,0],[5,0],[testFrame],0).length,0,'Interior paths must be removed');
assert.equal(pathIntervals([-30,30],[30,30],[testFrame],0).length,1,'Exterior paths must remain');
const rotated=courtFrame([[0,0],[10,10],[40,-20],[30,-30],[0,0]]);
assert.ok(Math.abs(rotated.width-Math.sqrt(200))<1e-8,'Rotation must preserve width');
for(const name of ['Margaret Court Arena','Rod Laver Arena','John Cain Arena','Centrepiece Melbourne'])
  assert.equal(data.buildings.filter(b=>b.name===name).length,1,`${name} must have one landmark footprint`);
assert.ok(data.features.some(f=>f.kind==='court'&&f.points.some(p=>p[0]>800)),'Eastern courts missing');
assert.ok(data.features.some(f=>f.id==='way/126844352'),'1573 court missing');
assert.ok(data.features.some(f=>f.id==='way/1239949236'),'Kia alignment court missing');
assert.equal(new Set(data.buildings.map(b=>b.id)).size,data.buildings.length);
for(const feature of [...data.features,...data.buildings])
  for(const p of feature.points??feature.ring)assert.ok(p.length===2&&p.every(Number.isFinite));
assert.ok(data.attribution);
assert.equal(data.buildings.find(b=>b.id==='806910-1-0').structureType,'Bridge','Bridge type must survive extraction');
const glb=fs.readFileSync(new URL('public/models/precinct/ao-precinct.glb',root));
assert.equal(glb.toString('ascii',0,4),'glTF');
assert.equal(glb.readUInt32LE(4),2);
assert.equal(glb.readUInt32LE(8),glb.length);
const gltf=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));
assert.equal(gltf.meshes.length,1);
assert.ok(gltf.meshes[0].primitives.length<=4,'Keep material draw calls bounded');
assert.ok(gltf.materials.some(m=>m.name==='Pale concrete'),'Canopy material missing');
assert.ok(!gltf.materials.some(m=>m.name==='Mineral blue seating'),'Seats must be instanced at runtime, not duplicated into glTF');
assert.ok(glb.length<1000000,'Precinct asset exceeds 1 MB budget');
assert.equal(data.features.filter(f=>f.kind==='court'&&f.surface==='clay').length,6,'Clay tags must survive extraction');
assert.equal(data.features.filter(f=>f.kind==='court'&&f.layer===1&&courtFrame(f.points).x>590&&courtFrame(f.points).x<709).length,5,'Eastern Plaza platform courts');
assert.ok(data.features.some(f=>f.kind==='rail'),'Mapped railway context missing');
assert.ok(data.buildings.some(b=>b.id==='808864-1-0'),'Administration building must remain distinct from Centrepiece');
console.log(`AO precinct checks passed: ${data.buildings.length} building tiers, ${data.features.length} features, ${(glb.length/1024).toFixed(1)} KiB GLB.`);
