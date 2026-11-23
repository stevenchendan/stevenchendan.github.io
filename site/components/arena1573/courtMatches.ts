import {compileRally,rallyFrame,RALLY_SECONDS,type ShotSpec} from './rallyMotion';
import type {StrokeKind} from './strokeContacts';

export const tossTime=1.43;
const clamp=(t:number)=>Math.max(0,Math.min(1,t));
const ease=(t:number)=>t*t*(3-2*t);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const turn=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

// Contact lanes and depths in metres. Each pattern describes a different way
// to construct a point, including who attacks and whether the ball bounces.
const patterns=[
  [[2.8,12.8],[-3.1,12.3],[3.3,13.1],[-2.9,12.1],[2.5,12.7],[3.3,11.9]],
  [[2.6,13.1],[-1.8,9.2],[3.2,12.7],[1.4,5.8]],
  [[2.7,13.6],[2.1,12.9],[-2.9,12.6],[-3.3,13.4],[2.6,12.9],[3.1,12.4],[-2.4,11.7],[-3.6,12.8]],
  [[2.5,12.4],[-2.7,12.7],[1.6,9.4],[3.1,13.1],[-.3,5.8]],
  [[2.4,13.1],[-1.8,12.5],[3.2,11.6]],
  [[2.5,12.7],[-2.1,11.7],[2.6,12.3],[1.1,8.8],[-3.3,12.9],[-1.4,4.6]],
];
function seeded(key:string){
  let bits=2166136261;
  for(const ch of key)bits=Math.imul(bits^ch.charCodeAt(0),16777619);
  return ()=>{bits=(Math.imul(1664525,bits)+1013904223)>>>0;return bits/4294967296;};
}
function buildMatch(key:string){
  const random=seeded(key),first=Math.floor(random()*patterns.length);
  const clay=key.startsWith('clay-');
  let total=0;
  const points=Array.from({length:4},(_,index)=>{
    const lanes=patterns[(first+index*(index%2?1:2))%patterns.length];
    const sign=index%2?-1:1,flip=index>=2,tempo=(clay?1.13:1)+random()*.12;
    const specs:ShotSpec[]=[[-sign*(1.15+random()*.75),12.1,'serve',(1.065+random()*.08)*tempo,1]];
    for(const [j,[lane,depth]] of lanes.entries()){
      const x=sign*(lane+(random()-.5)*.64),z=(j%2?1:-1)*(depth+(random()-.5)*.48);
      const kind:StrokeKind=depth<7?(x*Math.sign(z)>0?'volley':'backhand-volley'):x*Math.sign(z)>0?'forehand':'backhand';
      const next=lanes[j+1],short=next&&next[1]<7;
      specs.push([x,z,kind,(short?1.02:1.25+random()*.22)*tempo,.96+random()*.13]);
    }
    const last=specs.length-1;
    // A winner has a landing and a run-out beyond the receiver. The last
    // two waypoints supply a recovery path and never trigger another swing.
    const receiver=last%2?1:-1;
    const winnerX=-(Math.sign(specs[last-1][0])||1)*(3.55+random()*.38);
    specs.push([winnerX,receiver*14.2,'forehand',1.55,1]);
    if(specs.length%2)specs.push([0,-receiver*12.2,'forehand',1.5,1]);
    const rally=compileRally(specs),winner=rally.strokes[last];
    const liveEnd=winner.at+winner.flight;
    const reset=2.9+random()*1.3;
    const at=total;total+=tossTime+liveEnd+reset;
    return {rally,winner,liveEnd,reset,at,flip,last};
  });
  function oriented(p:typeof points[number],t:number){
    const f=p.rally.frame(Math.max(0,Math.min(t,p.liveEnd-.000001)));
    const missSide=(p.last+1)%2;
    if(t>=p.winner.at){
      const miss=f.players[missSide],u=clamp((t-p.winner.at)/p.winner.flight);
      // The beaten player slows on the chase, short of the passing ball.
      const reduce=.55*ease(u),prev=p.rally.strokes[p.last-1];
      miss.vx=miss.vx*(1-reduce)+(prev.rootX-miss.x)*.55*6*u*(1-u)/p.winner.flight;
      miss.vz=miss.vz*(1-reduce)+(prev.rootZ-miss.z)*.55*6*u*(1-u)/p.winner.flight;
      miss.x=mix(miss.x,prev.rootX,reduce);miss.z=mix(miss.z,prev.rootZ,reduce);
      miss.relativeTime=3;
    }
    if(t<0){
      f.players[0].relativeTime=t;
      f.players[1].relativeTime=3;
      // Release and catch height share the server's actual contact frame.
      const end=p.rally.strokes[0].contact,dt=Math.min(.78,-t);
      const start=f.players[0],c=Math.cos(start.yaw),s=Math.sin(start.yaw);
      const u=clamp(1+t/.78),height=end[1]+2.35*dt-4.905*dt*dt;
      f.ball=[end[0]-.37*(1-u)*c,height,end[2]+.37*(1-u)*s];
    }
    if(p.flip){
      f.ball[0]*=-1;f.ball[2]*=-1;f.players.reverse();
      for(const a of f.players){a.x*=-1;a.z*=-1;a.vx*=-1;a.vz*=-1;a.yaw+=Math.PI;a.side=a.side===1?-1:1;}
    }
    return f;
  }
  function frame(seconds:number){
    const time=((seconds%total)+total)%total;
    let i=points.length-1;while(i&&points[i].at>time)i--;
    const p=points[i],t=time-p.at-tossTime,f=oriented(p,t);
    const since=t-p.liveEnd;
    if(since>=0){
      const next=oriented(points[(i+1)%points.length],-tossTime);
      const u=clamp(since/p.reset),rate=6*u*(1-u)/p.reset;
      f.players.forEach((a,side)=>{
        const b=next.players[side],dx=b.x-a.x,dz=b.z-a.z;
        let w=ease(u),velocity=rate,yaw=a.yaw+turn(a.yaw,b.yaw)*w;
        a.turn=0;
        if(key==='1573'){
          const distance=Math.hypot(dx,dz),delay=.16+side*.12;
          const pace=distance>3?2.45:1.65;
          const duration=Math.min(p.reset-delay-.35,Math.max(.38,distance/pace+.24));
          const ramp=Math.min(.24,duration/2),area=duration-ramp;
          const t=Math.max(0,Math.min(duration,since-delay));
          // Integrate a short acceleration ramp, steady steps and braking.
          w=t<ramp?t*t/(2*ramp*area):t>duration-ramp?
            1-(duration-t)**2/(2*ramp*area):(t-ramp/2)/area;
          velocity=Math.min(t/ramp,1,(duration-t)/ramp)/area;
          const facing=a.yaw+turn(a.yaw,b.yaw)*ease(t/duration);
          a.turn=clamp(distance/2)*ease(clamp(t/ramp))*ease(clamp((duration-t)/ramp));
          yaw=facing+turn(facing,Math.atan2(-dx,-dz))*a.turn;
        }
        a.vx=dx*velocity;a.vz=dz*velocity;
        a.x+=dx*w;a.z+=dz*w;a.yaw=yaw;
        a.relativeTime=3;a.split=0;
      });
      const drift=Math.min(since,.38);
      f.ball[2]+=Math.sign(f.ball[2])*drift*7;
      f.ball[1]=Math.max(.15,f.ball[1]+drift*(.7-4.905*drift));
    }
    for(const a of f.players){
      a.seconds=seconds;a.court=key;
      const live=since<0,dx=live?f.ball[0]-a.x:-a.x,dz=live?f.ball[2]-a.z:-a.z;
      const distance=Math.hypot(dx,dz);
      a.lookYaw=Math.max(-.48,Math.min(.48,turn(a.yaw,Math.atan2(-dx,-dz))));
      a.lookPitch=live?Math.max(-.18,Math.min(.23,Math.atan2(f.ball[1]-1.68,distance))):0;
    }
    return {...f,ballVisible:since<.38};
  }
  return {duration:total,points,frame};
}
const matches=new Map<string,ReturnType<typeof buildMatch>>();
export function courtMatch(key:string){
  let match=matches.get(key);
  if(!match){match=buildMatch(key);matches.set(key,match);}
  return match;
}
export function courtFrameAt(seconds:number,key?:string){
  return key?courtMatch(key).frame(seconds):{...rallyFrame(seconds),ballVisible:true};
}
export function courtDuration(key?:string){return key?courtMatch(key).duration:RALLY_SECONDS;}

