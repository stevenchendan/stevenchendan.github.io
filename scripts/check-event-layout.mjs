import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const modules={};
for(const name of ['precinctGeometry','eventWorlds','eventLayout','visitorMotion']){
  const m={exports:{}};modules[name]=m.exports;
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`site/components/arena1573/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:id=>modules[id.replace('./','')]});
}
const data=JSON.parse(fs.readFileSync('public/data/1573-context.json','utf8'));
const {routeFinish}=modules.eventLayout;
const route=highway=>routeFinish(data.features.find(f=>f.highway===highway));
assert.ok(route('service').width<route('secondary').width,'Service lanes are narrower than arterial streets');
assert.equal(route('service').arterial,false,'Service lanes remain unmarked');
assert.equal(route('secondary').arterial,true,'Through streets carry lane markings');
assert.equal(route('footway').road,false);
assert.equal(route('corridor'),null,'Indoor corridors do not paint through arena floors');
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

const {eventStructures,eventWorlds,footprintRing}=modules.eventWorlds;
const routeEdges=data.features.filter(f=>['path','rail'].includes(f.kind)&&(f.layer??0)===0&&f.highway!=='corridor')
  .flatMap(f=>f.points.slice(1).map((b,i)=>({a:f.points[i],b,radius:(f.kind==='rail'?4:routeFinish(f)?.width??f.width)/2+.4})));
const outlines=[...data.buildings.filter(b=>b.base<8&&b.structureType!=='Bridge').map(b=>b.ring),...data.features.filter(f=>f.kind==='court').map(f=>f.points)];
const intersects=(a,b,p,margin)=>pathIntervals(a,b,[p],margin).reduce((sum,[lo,hi])=>sum+hi-lo,0)<.99999;
assert.equal(new Set(eventStructures.map(p=>p.zone)).size,Object.keys(eventWorlds).length);
for(const p of eventStructures){
  const id=p.zone+' '+p.kind;
  assert.ok(!routeEdges.some(({a,b,radius})=>intersects(a,b,p,radius)),id+' has clearance from at-grade routes');
  assert.ok(!outlines.some(ring=>pointInRing([p.x,p.z],ring)||ring.some((a,i)=>intersects(a,ring[(i+1)%ring.length],p,.58))),id+' clears courts, buildings and neighbouring attractions');
  outlines.push(footprintRing(p));
}
console.log(`Verified ${eventStructures.length} event installations in ${Object.keys(eventWorlds).length} visitor areas.`);
