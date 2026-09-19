import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('site/components/arena1573/rallyMotion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports});
const {rallyFrame,SHOT_SECONDS,HITS}=m.exports;
for(let t=0;t<SHOT_SECONDS*HITS.length;t+=.002){
 const f=rallyFrame(t);assert.ok(f.ball.every(Number.isFinite));assert.ok(f.ball[1]>=.199);
 if(Math.abs(f.ball[2])<.05)assert.ok(f.ball[1]>1.1,'Ball must clear net');
 const next=rallyFrame(t+.002);assert.ok(Math.hypot(...next.ball.map((v,i)=>v-f.ball[i]))<.15,'Ball path must be continuous');
}
for(let i=0;i<HITS.length;i++){
 const f=rallyFrame(i*SHOT_SECONDS),p=f.players[i%2];
 assert.ok(Math.abs(p.x+.78*p.side-f.ball[0])<1e-8);
 assert.ok(Math.abs(p.z-.3*p.side-f.ball[2])<1e-8);
}
console.log('Rally checks passed: finite motion, court bounce, net clearance, continuous loop and racket contact alignment.');
