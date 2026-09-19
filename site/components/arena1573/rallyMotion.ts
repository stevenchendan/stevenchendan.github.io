// Hand-authored baseline exchange inspired by the supplied court-level video.
// Positions are metres; this is choreography, not tracking or match replay.
export const SHOT_SECONDS=1.6;
export const HITS=[[-2,12.8],[2.6,-12.6],[2.9,12.7],[-2.5,-12.9],[-3.2,13.1],[1.5,-12.6],[.7,12.5],[-.8,-12.7]];
const wrap=(i:number,n:number)=>(i%n+n)%n;
const smooth=(t:number)=>t*t*(3-2*t);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export function rallyFrame(seconds:number){
  const shot=Math.floor(seconds/SHOT_SECONDS),u=seconds/SHOT_SECONDS-shot;
  const a=HITS[wrap(shot,HITS.length)],b=HITS[wrap(shot+1,HITS.length)];
  const bounce=[mix(a[0],b[0],.76),Math.sign(b[1])*8.7];
  const first=u<.73,t=first?u/.73:(u-.73)/.27;
  const start=first?a:bounce,end=first?bounce:b;
  const y=first?mix(1.08,.20,t)+2.6*4*t*(1-t):mix(.20,1.08,t)+.25*4*t*(1-t);
  const players=([0,1] as const).map(id=>{
    const last=Math.floor((seconds/SHOT_SECONDS-id)/2)*2+id;
    const phase=(seconds/SHOT_SECONDS-last)/2;
    const current=HITS[wrap(last,HITS.length)],next=HITS[wrap(last+2,HITS.length)],side=id===0?1:-1;
    // Recover towards centre, then plant at the next ball before contact.
    const middle=mix(current[0],next[0],.5)*.28;
    const x=phase<.45?mix(current[0],middle,smooth(phase/.45)):mix(middle,next[0],smooth(Math.min(1,(phase-.45)/.43)));
    const z=mix(current[1],next[1],smooth(phase));
    const swing=phase<.28?Math.sin(phase/.28*Math.PI)*.9:phase>.72?-Math.sin((phase-.72)/.28*Math.PI)*.8:0;
    return {x:x-.78*side,z:z+.3*side,side,phase,swing,moving:phase>.12&&phase<.85};
  });
  return {ball:[mix(start[0],end[0],t),y,mix(start[1],end[1],t)] as [number,number,number],players};
}
