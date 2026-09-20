import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const modules={};
for(const name of ['precinctGeometry','eventLayout','visitorMotion']){
  const m={exports:{}};modules[name]=m.exports;
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`site/components/arena1573/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:id=>modules[id.replace('./','')]});
}
const data=JSON.parse(fs.readFileSync('public/data/1573-context.json','utf8'));
const pockets=modules.eventLayout.eventLayout(data);
const crossings=modules.eventLayout.eventCrossings(data);
assert.ok(crossings.length>0&&crossings.length<=8,'Crossings are bounded and use mapped intersections');
for(const crossing of crossings)assert.ok(Number.isFinite(crossing.x+crossing.z+crossing.dx+crossing.dz));
console.log(pockets.map(p=>`${p.zone}: ${p.kind} (${p.x}, ${p.z})`).join('\n'));
assert.ok(pockets.length>=8,'Several event pockets fit without blocking existing routes');
for(const kind of ['food','lounge','lawn'])assert.ok(pockets.some(p=>p.kind===kind),`${kind} areas exist`);
const {pathIntervals,pointInRing}=modules.precinctGeometry;
for(const p of pockets){
  assert.ok(modules.eventLayout.pocketRing(p,2).every(point=>pointInRing(point,modules.eventLayout.PLAZA_OUTLINE)),'Facilities remain on paved ground');
  for(const f of data.features.filter(f=>['path','rail'].includes(f.kind)))for(let i=1;i<f.points.length;i++){
    assert.ok(pathIntervals(f.points[i-1],f.points[i],[p],(f.kind==='rail'?4:Math.max(2,f.width))/2+1).reduce((sum,[lo,hi])=>sum+hi-lo,0)>.999,'Facilities keep mapped paths clear');
  }
  for(const route of modules.visitorMotion.visitorRoutes(data)){
    assert.ok(pathIntervals(route.a,route.b,[p],.6).reduce((sum,[lo,hi])=>sum+hi-lo,0)>.999,'Walking visitors avoid new facilities');
  }
}
console.log(`Event layout passed: ${pockets.length} pockets, ${crossings.length} crossings, clear walking routes and paved-ground placement.`);
