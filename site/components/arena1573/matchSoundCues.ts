import {courtMatch,tossTime} from './courtMatches';

export type MatchCue={at:number; sample:number|'cheer'; x:number; z:number; gain:number; rate:number};
const cache=new Map<string,{duration:number;cues:MatchCue[]}>();

export function matchSoundCues(key:string){
  const saved=cache.get(key);
  if(saved)return saved;
  const match=courtMatch(key),cues:MatchCue[]=[];
  for(const [index,point] of match.points.entries()){
    const start=point.at+tossTime,sign=point.flip?-1:1;
    // The final waypoints move players back into position and have no hitter.
    for(let i=0;i<=point.last;i++){
      const stroke=point.rally.strokes[i],serve=stroke.kind==='serve',volley=stroke.kind.includes('volley');
      const sample=serve?3+index%2:(i+index)%3;
      cues.push({at:start+stroke.at,sample,x:sign*stroke.contact[0],z:sign*stroke.contact[2],
        gain:serve ? .96 : volley ? .57 : .80,rate:stroke.pace*(volley?1.09:1)});
      const bounce=point.rally.bounceAfter[i];
      if(bounce!==null){
        const at=stroke.at+bounce,[x,,z]=point.rally.frame(at).ball;
        cues.push({at:start+at,sample:5,x:sign*x,z:sign*z,gain:.39,rate:1+(i%3-1)*.045});
      }
    }
    cues.push({at:start+point.liveEnd+.16,sample:'cheer',x:0,z:0,gain:.78,rate:.98+.015*index});
  }
  const result={duration:match.duration,cues};
  cache.set(key,result);
  return result;
}

/** Advance from the last rendered pose. Drop stale impacts after a slow frame. */
export function visitMatchCues(key:string,previous:number,now:number,emit:(cue:MatchCue)=>void){
  if(now<=previous)return;
  const {duration,cues}=matchSoundCues(key);
  const from=Math.max(previous,now-.35),cycle=Math.floor(from/duration);
  for(let lap=cycle;lap<=Math.floor(now/duration);lap++){
    const offset=lap*duration;
    for(const cue of cues){
      const at=cue.at+offset;
      if(at>now)break;
      if(at>from)emit(cue);
    }
  }
}
