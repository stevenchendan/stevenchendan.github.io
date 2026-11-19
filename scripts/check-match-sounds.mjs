import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './rally-fixture.mjs';

const {courtDirectory}=loadModule('courtPlacements');
const {courtMatch,tossTime}=loadModule('courtMatches');
const {matchSoundCues,visitMatchCues}=loadModule('matchSoundCues');
const data=JSON.parse(fs.readFileSync(new URL('../public/data/1573-context.json',import.meta.url)));
let hits=0,bounces=0,cheers=0;
for(const court of courtDirectory(data)){
  const {cues,duration}=matchSoundCues(court.key),match=courtMatch(court.key);
  assert.equal(duration,match.duration);
  assert.ok(cues.every((cue,i)=>!i||cue.at>cues[i-1].at));
  for(const point of match.points){
    const start=point.at+tossTime,end=start+point.liveEnd;
    const live=cues.filter(cue=>cue.at>=start&&cue.at<end);
    const contacts=live.filter(cue=>cue.sample<5);
    assert.equal(contacts.length,point.last+1,'One impact per real swing');
    assert.ok([3,4].includes(contacts[0].sample),'Serve uses a serve recording');
    contacts.forEach((cue,i)=>assert.equal(cue.at,start+point.rally.strokes[i].at));
    for(const cue of live){
      const [x,y,z]=match.frame(cue.at).ball;
      assert.ok(Math.hypot(cue.x-x,cue.z-z)<.00001,'Sound originates at the visible ball');
      if(cue.sample===5){assert.ok(y<.16,'Bounce occurs on the surface');bounces++;}
      else hits++;
    }
    const reaction=cues.filter(cue=>cue.at>=end&&cue.at<end+point.reset);
    assert.equal(reaction.length,1,'One crowd reaction during recovery');
    assert.equal(reaction[0].sample,'cheer');cheers++;
  }
  const actual=[];
  for(let from=0;from<2*duration;from+=.07){
    visitMatchCues(court.key,from,Math.min(from+.07,2*duration),cue=>actual.push(cue));
  }
  assert.equal(actual.length,cues.length*2,'Emit each sound once across repeat playback');
  actual.forEach((cue,i)=>assert.equal(cue,cues[i%cues.length]));
  const first=cues[0],emitted=[];
  visitMatchCues(court.key,first.at,first.at,cue=>emitted.push(cue));
  assert.equal(emitted.length,0,'Paused playback stays silent');
  visitMatchCues(court.key,0,8*duration+first.at+.01,cue=>emitted.push(cue));
  assert.equal(emitted.length,1,'Resuming after a long gap skips old sounds');
  assert.equal(emitted[0],first);
}
console.log(`Verified ${hits} racket hits, ${bounces} bounces and ${cheers} point-end cheers across all courts.`);
