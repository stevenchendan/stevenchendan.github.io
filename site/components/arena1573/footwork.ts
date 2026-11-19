import type {rallyFrame} from './rallyMotion';
import {courtDuration,courtFrameAt} from './courtMatches';

type Actor=ReturnType<typeof rallyFrame>['players'][number];

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>x*x*(3-2*x);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const readyHalfWidth=.27;

// One timetable for both feet. Stride grows with speed, so a sprint covers
// distance with longer steps instead of playing a short shuffle at double speed.
function buildTracks(key?:string){
  const duration=courtDuration(key),count=Math.ceil(duration*100),dt=duration/count;
  const frames=Array.from({length:count+1},(_,i)=>courtFrameAt(i*dt,key));
  const tracks=[0,1].map(side=>{
  let cycles=0;
  const samples=Array.from({length:count+1},(_,i)=>{
    const p=frames[i].players[side],speed=Math.hypot(p.vx,p.vz);
    if(i)cycles+=dt*speed/(.72+.39*speed);
    return {x:p.x,z:p.z,yaw:p.yaw,phase:cycles,speed};
  });
  const periods=Math.max(1,Math.round(cycles));
  for(const sample of samples)sample.phase*=periods/cycles;
  const contacts=[-.5,0].map((offset,foot)=>{
    return Array.from({length:periods},(_,k)=>{
      const target=(k-offset)%periods;
      let lo=0,hi=count;
      while(hi-lo>1){const mid=(hi+lo)>>1;if(samples[mid].phase<target)lo=mid;else hi=mid;}
      const a=samples[lo],b=samples[hi],u=clamp((target-a.phase)/Math.max(.00001,b.phase-a.phase));
      const yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*u;
      const lateral=(foot===0?-1:1)*mix(.205,.125,clamp(a.speed/4.5));
      return {x:mix(a.x,b.x,u)+lateral*Math.cos(yaw),z:mix(a.z,b.z,u)-lateral*Math.sin(yaw)};
    });
  });
  return {samples,contacts,periods};
});

  return {tracks,count,dt,duration};
}
const cache=new Map<string,ReturnType<typeof buildTracks>>();
export function footwork(actor:Actor){
  const key=actor.court??'';
  let trackSet=cache.get(key);
  if(!trackSet){trackSet=buildTracks(actor.court);cache.set(key,trackSet);}
  const {tracks,count,dt,duration}=trackSet;
  const track=tracks[actor.side===1?0:1];
  const wrapped=((actor.seconds%duration)+duration)%duration;
  const i=Math.min(count-1,Math.floor(wrapped/dt)),u=wrapped/dt-i;
  const a=track.samples[i],b=track.samples[i+1];
  const phase=mix(a.phase,b.phase,u),x=mix(a.x,b.x,u),z=mix(a.z,b.z,u);
  const speed=Math.hypot(actor.vx,actor.vz);
  const duty=mix(.55,.28,clamp(speed/4.5));
  const feet=track.contacts.map((anchors,index)=>{
    const p=phase+(index===0?-.5:0)+track.periods,k=Math.floor(p),f=p-k;
    const t=clamp((f-duty*.5)/(1-duty));
    const from=anchors[k%track.periods],to=anchors[(k+1)%track.periods];
    const dx=mix(from.x,to.x,smooth(t))-x,dz=mix(from.z,to.z,smooth(t))-z;
    const lift=Math.sin(Math.PI*t)**2*mix(.08,.24,clamp(speed/5))*smooth(clamp(speed/.75));
    const c=Math.cos(actor.yaw),s=Math.sin(actor.yaw);
    // At a standstill the next running footprint can be across the body.
    // Set both feet beneath their hips as the player brakes for a stroke.
    const moving=actor.court?smooth(clamp(speed/1.2)):1;
    const localX=mix(index===0?-readyHalfWidth:readyHalfWidth,dx*c-dz*s,moving);
    const localZ=mix(index===0?.075:-.075,dx*s+dz*c,moving);
    return {x:localX,z:localZ,y:.074+lift+.035*actor.split,swing:t,planted:t===0||t===1};
  });
  // Keep the receiving base open on a short lateral shuffle. Adjust the
  // travelling shoe first. A full crossover or a long stride has room to pass.
  if(actor.court){
    const [left,right]=feet;
    const shuffle=(1-smooth(clamp((speed-1.45)/.75)))*(1-smooth(clamp(actor.turn/.6)));
    const adjacent=1-smooth(clamp((Math.abs(left.z-right.z)-.10)/.22));
    const correction=Math.max(0,.29-(right.x-left.x))*shuffle*adjacent;
    const leftShare=.5+.5*(Math.sin(Math.PI*left.swing)**2-Math.sin(Math.PI*right.swing)**2);
    left.x-=correction*leftShare;right.x+=correction*(1-leftShare);
  }
  return {feet,phase,speed};
}
