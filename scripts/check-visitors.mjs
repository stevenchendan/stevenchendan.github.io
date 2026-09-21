import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const data=JSON.parse(fs.readFileSync('public/data/1573-context.json','utf8'));
const modules={};
for(const name of ['precinctGeometry','visitorMotion']){
  const m={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`site/components/arena1573/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:id=>modules[id.replace('./','')]});
  modules[name]=m.exports;
}
const {visitorRoutes,visitorFrame}=modules.visitorMotion;
const {pointInRing,courtFrame,pathIntervals}=modules.precinctGeometry;
const routes=visitorRoutes(data);
assert.ok(routes.length>10&&routes.length<=60,'Bound crowd density across multiple paths');
const courts=[{x:0,z:0,width:46,depth:64,rotation:0},...data.features.filter(f=>f.kind==='court').map(f=>courtFrame(f.points))];
for(let r=0;r<routes.length;r++){
  const route=routes[r];
  for(let t=0;t<180;t+=.17){
    const f=visitorFrame(route,t,r*4),next=visitorFrame(route,t+.01,r*4);
    assert.ok([f.x,f.z,f.heading,f.stride].every(Number.isFinite));
    assert.ok(Math.hypot(f.x-next.x,f.z-next.z)<.02,'Walking and turnarounds stay continuous');
    assert.equal(pathIntervals([f.x-.01,f.z],[f.x+.01,f.z],courts,.2).length,1,'Visitors stay outside the 1573 seating bowl and playing enclosures');
    assert.ok(!data.buildings.some(b=>b.base<2&&pointInRing([f.x,f.z],b.ring)),'Visitors stay outside buildings');
  }
}
console.log(`Visitor checks passed: ${routes.length*4} visitors; continuous motion and clear arena/court/building routes.`);
