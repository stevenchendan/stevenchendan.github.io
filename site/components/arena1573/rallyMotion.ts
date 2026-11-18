import { STROKE_CONTACT, type StrokeKind } from './strokeContacts';

export const COURT_FLOOR = .095;
export const BALL_RADIUS = .0335;
const bounceHeight = .115 + BALL_RADIUS;
type Point = [number,number,number];
export type ShotSpec = [x:number,z:number,kind:StrokeKind,flight:number,pace:number];

// A baseline exchange develops into a short approach and two volleys. The
// final deep return gives the net player time to recover to the baseline.
const exchange: ShotSpec[] = [
  [-2.1,12.9,'forehand',1.36,.99], [2.15,-12.6,'forehand',1.29,1.07],
  [2.65,12.4,'forehand',1.48,.94], [-2.48,-12.8,'forehand',1.41,1.03],
  [-1.36,12.2,'forehand',1.31,1.08], [-.68,-11.8,'forehand',1.25,.97],
  [1.8,8.7,'forehand',1.17,1.08], [2.65,-12.55,'forehand',.86,1.06],
  [2.38,4.9,'volley',1.16,1.10], [-.85,-12.2,'forehand',.87,1.01],
  [-.92,4.2,'backhand-volley',1.32,.96], [-2.5,-12.05,'forehand',1.99,.94],
  [-2.38,11.7,'forehand',1.46,1.02], [2.34,-12.7,'forehand',1.32,1.09],
  [1.36,12.85,'forehand',1.37,1.03], [.72,-12.55,'forehand',1.44,.97],
];
const wrap=(n:number,size:number)=>((n%size)+size)%size;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(t:number)=>t*t*(3-2*t);
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
export function compileRally(exchange:ShotSpec[]){
  let cycleSeconds=0;
  const strokes=exchange.map(([x,z,kind,flight,pace],i)=>{
    const [nextX,nextZ]=exchange[(i+1)%exchange.length];
    const yaw=Math.atan2(x-nextX,z-nextZ);
    const [ox,oy,oz]=STROKE_CONTACT[kind];
    const at=cycleSeconds;cycleSeconds+=flight;
    const rootX=x-(ox*Math.cos(yaw)+oz*Math.sin(yaw));
    const rootZ=z-(-ox*Math.sin(yaw)+oz*Math.cos(yaw));
    return {at,flight,pace,kind,yaw,rootX,rootZ,contact:[x,COURT_FLOOR+oy,z] as Point};
  });
  const RALLY_SECONDS=cycleSeconds;

  const drag=.23, gravity=9.81;
  const horizontalDistance=(t:number)=>(1-Math.exp(-drag*t))/drag;
  const flights=strokes.map((shot,i)=>{
    const next=strokes[(i+1)%strokes.length];
    const bounces=next.kind==='forehand'||next.kind==='backhand';
    const before=shot.flight*(shot.kind==='serve'?.565:i===11?.77:.71+(i%3)*.014);
    const after=shot.flight-before;
    const carry=horizontalDistance(before);
    const reboundSpeed=Math.exp(-drag*before)*.77;
    const distance=bounces?carry+reboundSpeed*horizontalDistance(after):horizontalDistance(shot.flight);
    return {bounces,before,after,carry,reboundSpeed,distance};
  });

  function ballAt(index:number,elapsed:number):Point{
    const shot=strokes[index],a=shot.contact,b=strokes[(index+1)%strokes.length].contact;
    const {bounces,before,after,carry,reboundSpeed,distance}=flights[index];
    const bounced=bounces&&elapsed>before;
    const t=bounced?elapsed-before:elapsed;
    const along=(bounced?carry+reboundSpeed*horizontalDistance(t):horizontalDistance(t))/distance;
    const duration=bounced?after:bounces?before:shot.flight;
    const y0=bounced?bounceHeight:a[1],y1=bounced||!bounces?b[1]:bounceHeight;
    const y=lerp(y0,y1,t/duration)+.5*gravity*t*(duration-t);
    return [lerp(a[0],b[0],along),y,lerp(a[2],b[2],along)];
  }

  // Each player's split step lands around the opponent's strike. Use integrated
  // path distance for the footwork cycle, so slower travel also means fewer steps.
  const metres=[0,0];
  const paths=strokes.map((start,i)=>{
    const end=strokes[(i+2)%strokes.length],sid=i%2;
    const midX=start.rootX*.48+end.rootX*.12;
    const advancing=Math.abs(end.rootZ)<Math.abs(start.rootZ);
    const midZ=lerp(start.rootZ,end.rootZ,advancing?.54:.24);
    const first=Math.hypot(midX-start.rootX,midZ-start.rootZ);
    const second=Math.hypot(end.rootX-midX,end.rootZ-midZ);
    const base=metres[sid];
    metres[sid]+=first+second;
    return {midX,midZ,first,second,base};
  });

  function playerAt(id:number,shot:number,cycle:number,elapsed:number){
    const previous=shot%2===id?shot:wrap(shot-1,strokes.length);
    const start=strokes[previous],other=strokes[(previous+1)%strokes.length],end=strokes[(previous+2)%strokes.length];
    const sinceHit=shot%2===id?elapsed:start.flight+elapsed;
    const remaining=start.flight+other.flight-sinceHit;
    const nextStroke=remaining<sinceHit;
    const strike=nextStroke?end:start;
    const path=paths[previous];
    const outbound=sinceHit<start.flight;
    const x0=outbound?start.rootX:path.midX, z0=outbound?start.rootZ:path.midZ;
    const x1=outbound?path.midX:end.rootX,z1=outbound?path.midZ:end.rootZ;
    const duration=outbound?start.flight-.17:other.flight-.19;
    const u=clamp((outbound?sinceHit-.17:sinceHit-start.flight)/duration);
    const blend=smooth(u), rate=6*u*(1-u)/duration;
    const pathCycle=previous>shot?cycle-1:cycle;
    const travel=pathCycle*metres[id]+path.base+(outbound?path.first*blend:path.first+path.second*blend);
    const side:1|-1=id===0?1:-1;
    const readyYaw=id===0?0:Math.PI;
    const toReady=Math.atan2(Math.sin(readyYaw-start.yaw),Math.cos(readyYaw-start.yaw));
    const fromReady=Math.atan2(Math.sin(end.yaw-readyYaw),Math.cos(end.yaw-readyYaw));
    const facing=outbound?start.yaw+toReady*blend:readyYaw+fromReady*blend;
    const vx=(x1-x0)*rate,vz=(z1-z0)*rate;
    // Shuffle short adjustments facing the net. Turn into a crossover run
    // for the long chase, and face the incoming ball again as the feet set.
    const peakSpeed=1.5*Math.hypot(x1-x0,z1-z0)/duration;
    const turn=smooth(clamp((peakSpeed-1)/2.5))*Math.sin(Math.PI*u)**2;
    const heading=Math.atan2(x0-x1,z0-z1);
    const arc=Math.atan2(Math.sin(heading-facing),Math.cos(heading-facing));
    const yaw=facing+Math.max(-1.48,Math.min(1.48,arc))*turn;
    return {
      court:undefined as string|undefined,x:lerp(x0,x1,blend),z:lerp(z0,z1,blend),side,yaw,lookYaw:0,lookPitch:0,
      vx,vz,travel,turn,seconds:cycle*RALLY_SECONDS+strokes[shot].at+elapsed,
      split:Math.sin(Math.PI*clamp((sinceHit-start.flight+.14)/.24)),
      kind:strike.kind,pace:strike.pace,relativeTime:nextStroke?-remaining:sinceHit,
    };
  }

  function frame(seconds:number){
    const cycle=Math.floor(seconds/RALLY_SECONDS);
    const time=seconds-cycle*RALLY_SECONDS;
    let index=strokes.length-1;
    while(index>0&&strokes[index].at>time)index--;
    const elapsed=time-strokes[index].at;
    return {ball:ballAt(index,elapsed),players:[playerAt(0,index,cycle,elapsed),playerAt(1,index,cycle,elapsed)]};
  }
  return {strokes,duration:RALLY_SECONDS,frame};
}

const original=compileRally(exchange);
export const {strokes,duration:RALLY_SECONDS,frame:rallyFrame}=original;
