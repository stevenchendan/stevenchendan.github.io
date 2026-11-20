import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadArenaModule as load} from './arena-model-fixture.mjs';

const {decodeSeatSun,loadSeatSun,sectionSun,sectionCentreSun}=load('seatSun');
const {summerSun}=load('solar'),{seatSections}=load('seating');
const binary=fs.readFileSync(new URL('../public/data/ao-seat-sun-v1.bin',import.meta.url));
const buffer=binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength);
assert.throws(()=>decodeSeatSun(buffer.slice(0,9)));
assert.throws(()=>decodeSeatSun(buffer.slice(0,-2)));
let calls=0;
globalThis.fetch=async url=>{
  assert.equal(url,'/data/ao-seat-sun-v1.bin');
  calls++;
  return calls===1?{ok:false}:{ok:true,arrayBuffer:async()=>buffer};
};
await assert.rejects(loadSeatSun());
const [atlas,again]=await Promise.all([loadSeatSun(),loadSeatSun()]);
assert.equal(atlas,again,'Concurrent readers share the retry');
assert.equal(calls,2);

const date={year:2027,month:1,day:17};
const daylight=[9,13,17].map(hour=>summerSun({...date,minutes:hour*60}));
const night=summerSun({...date,minutes:23*60});
// Opposing lower sideline seats have a clear morning-to-afternoon reversal.
// Walking the real section IDs through the lookup catches mirrored plan axes.
for(const [venue,east,west] of [['rla',6,16],['mca',5,15],['john','7A','18A']]){
  for(const [sun,brighter,darker] of [[daylight[0],west,east],[daylight[2],east,west]]){
    assert.ok(sectionSun(atlas,venue,brighter,sun,false)>sectionSun(atlas,venue,darker,sun,false),
      `${venue}: section ${brighter} should receive more direct sun than ${darker}`);
  }
}
let open=0,partial=0,shaded=0;
for(const [venue,sections] of Object.entries(seatSections)){
  for(const {id} of sections){
    assert.ok(atlas.sections.has(venue+'/'+id));
    assert.equal(sectionSun(atlas,venue,id,night,false),0);
    assert.equal(sectionCentreSun(atlas,venue,id,night,false),false);
    for(const sun of daylight){
      assert.equal(sectionSun(atlas,venue,id,sun,true),0);
      assert.equal(sectionCentreSun(atlas,venue,id,sun,true),false);
      const value=sectionSun(atlas,venue,id,sun,false),centre=sectionCentreSun(atlas,venue,id,sun,false);
      assert.ok(Number.isInteger(value)&&value>=0&&value<=9);
      if(value===0){assert.equal(centre,false);shaded++;}
      else if(value===9){assert.equal(centre,true);open++;}
      else partial++;
    }
  }
}
assert.equal(atlas.sections.size,175);
assert.ok(open&&partial&&shaded,'Open roofs distinguish direct sun, partial cover and full shade');
console.log('Seat sunlight passed for all 175 bays, including mixed exposure, closed roofs, night, asset integrity and fetch retry.');
