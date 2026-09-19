import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'site/components/arena1573/solar.ts'),'utf8');
const solarModule={exports:{}};
const dimensions={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'site/components/arena1573/dimensions.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:dimensions,exports:dimensions.exports});
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:solarModule,exports:solarModule.exports,require:(id)=>{assert.equal(id,'./dimensions');return dimensions.exports;}});
const {summerSun,summerDaylight,sunDirection,clockTime,standSamples,STANDS}=solarModule.exports;
const close=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

// Coordinate conventions are critical: east/north directions must be rotated
// exactly like the supplied geographic context, not mirrored with the camera.
close(sunDirection(90,0)[0],Math.cos(.142));
close(sunDirection(90,0)[2],-Math.sin(.142));
close(sunDirection(0,0)[0],-Math.sin(.142));
close(sunDirection(0,0)[2],-Math.cos(.142));
close(sunDirection(0,90)[1],1);
for(const year of [2027,2028])for(const day of [1,15,31]){
  const events=summerDaylight(year,1,day);
  assert.ok(events.sunrise>350&&events.sunrise<410,'January sunrise should be around 06:00–06:50 AEDT');
  assert.ok(events.sunset>1210&&events.sunset<1290,'January sunset should be around 20:10–21:30 AEDT');
  close(summerSun({year,month:1,day,minutes:events.sunrise}).elevation,-.833,.001);
  close(summerSun({year,month:1,day,minutes:events.sunset}).elevation,-.833,.001);
  const morning=summerSun({year,month:1,day,minutes:540}),afternoon=summerSun({year,month:1,day,minutes:1080}),noon=summerSun({year,month:1,day,minutes:810});
  assert.ok(morning.azimuth>0&&morning.azimuth<180,'Morning sun must be east of north');
  assert.ok(afternoon.azimuth>180&&afternoon.azimuth<360,'Afternoon sun must be west of north');
  assert.ok(noon.elevation>68&&noon.elevation<78,'Solar noon near 13:30 AEDT should be high in the northern sky');
  assert.ok(!summerSun({year,month:1,day,minutes:300}).aboveHorizon);
  assert.ok(!summerSun({year,month:1,day,minutes:1320}).aboveHorizon);
  close(Math.hypot(...noon.direction),1);
}
assert.equal(clockTime(810),'13:30');
for(const year of [2027,2028])for(const day of [1,15,28]){
  const events=summerDaylight(year,2,day);
  assert.ok(events.sunrise>380&&events.sunrise<435);
  assert.ok(events.sunset>1170&&events.sunset<1250);
  close(summerSun({year,month:2,day,minutes:events.sunrise}).elevation,-.833,.001);
  close(summerSun({year,month:2,day,minutes:events.sunset}).elevation,-.833,.001);
}
assert.throws(()=>summerSun({year:2027,month:2,day:29,minutes:720}));
assert.doesNotThrow(()=>summerSun({year:2028,month:2,day:29,minutes:720}));
assert.throws(()=>summerSun({year:2027,month:3,day:1,minutes:720}));
assert.ok(summerDaylight(2027,2,28).sunset<summerDaylight(2027,1,15).sunset);
assert.throws(()=>summerSun({year:2027,month:1,day:32,minutes:600}));
assert.throws(()=>summerSun({year:2027,month:1,day:1,minutes:NaN}));
for(const stand of STANDS)assert.equal(standSamples(stand).length,9);
assert.ok(standSamples('east')[0][1]>4,'Seated shade samples must sit above the raised retaining-wall base');
console.log('Solar checks passed: AEDT day boundaries, January/February dates and leap years, sunrise/sunset crossings, sun bearings and arena alignment.');
for(const minutes of [360,540,810,1080,1260]){
  const sun=summerSun({year:2027,month:1,day:15,minutes});
  console.log(`15 Jan 2027 ${clockTime(minutes)} AEDT: elevation ${sun.elevation.toFixed(1)}°, azimuth ${sun.azimuth.toFixed(1)}°`);
}
