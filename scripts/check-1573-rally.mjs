import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

const modules={};
for(const name of ['strokeContacts','rallyMotion']){
  const module={exports:{}};
  const file=fs.readFileSync(new URL('../site/components/arena1573/'+name+'.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(file,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
    {module,exports:module.exports,require:id=>modules[id.slice(2)]});
  modules[name]=module.exports;
}
const {rallyFrame,strokes,COURT_FLOOR,BALL_RADIUS,RALLY_SECONDS}=modules.rallyMotion;
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
let bounces=0,netClearance=Infinity,peakSpeed=0;
for(const [i,stroke] of strokes.entries()){
  const frame=rallyFrame(stroke.at),p=frame.players[i%2],next=strokes[(i+1)%strokes.length];
  const [x,y,z]=modules.strokeContacts.STROKE_CONTACT[p.kind];
  assert.ok(distance(frame.ball,[p.x+x*Math.cos(p.yaw)+z*Math.sin(p.yaw),COURT_FLOOR+y,p.z-x*Math.sin(p.yaw)+z*Math.cos(p.yaw)])<1e-7);
  assert.ok(Math.hypot(p.vx,p.vz)<1e-8,'Feet plant for contact');
  let previous=frame,dy=0,count=0;
  const samples=900,dt=stroke.flight/samples;
  for(let j=1;j<=samples;j++){
    const current=rallyFrame(stroke.at+j*dt);
    assert.ok(current.ball.every(Number.isFinite));
    assert.ok(current.ball[1]>=COURT_FLOOR+BALL_RADIUS,'Ball stays above hard court');
    const speed=distance(previous.ball,current.ball)/dt;
    peakSpeed=Math.max(peakSpeed,speed);
    if(previous.ball[2]*current.ball[2]<=0){
      const tape=COURT_FLOOR+.914+.156*Math.abs(current.ball[0])/6.4;
      netClearance=Math.min(netClearance,current.ball[1]-BALL_RADIUS-tape);
      assert.ok(current.ball[1]-BALL_RADIUS>tape,'Ball clears the net');
    }
    const rise=current.ball[1]-previous.ball[1];
    if(dy<0&&rise>0){
      assert.ok(Math.abs(previous.ball[2])<=11.885&&Math.abs(previous.ball[0])<4.115,'Bounce inside singles court');
      count++;
    }
    current.players.forEach((player,s)=>{
      assert.ok(Math.hypot(player.x-previous.players[s].x,player.z-previous.players[s].z)<9*dt);
      assert.ok(player.travel>=previous.players[s].travel-1e-8);
    });
    previous=current;dy=rise;
  }
  assert.equal(count,next.kind==='forehand'?1:0);
  bounces+=count;
  assert.ok(distance(frame.ball,rallyFrame(stroke.at-RALLY_SECONDS).ball)<1e-6);
}
assert.ok(peakSpeed<48&&peakSpeed>15);
console.log(`${strokes.length} racket contacts, ${bounces} in-bounds bounces, minimum net clearance ${netClearance.toFixed(2)} m, peak ball speed ${Math.round(peakSpeed*3.6)} km/h.`);
