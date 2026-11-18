import {rallyFrame,RALLY_SECONDS} from './rallyMotion';

type Actor=ReturnType<typeof rallyFrame>['players'][number];
const count=Math.ceil(RALLY_SECONDS*120),dt=RALLY_SECONDS/count;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>x*x*(3-2*x);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;

// One timetable for both feet. Stride grows with speed, so a sprint covers
// distance with longer steps instead of playing a short shuffle at double speed.
const tracks=[0,1].map(side=>{
  let cycles=0;
  const samples=Array.from({length:count+1},(_,i)=>{
    const p=rallyFrame(i*dt).players[side],speed=Math.hypot(p.vx,p.vz);
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

export function footwork(actor:Actor){
  const track=tracks[actor.side===1?0:1];
  const wrapped=((actor.seconds%RALLY_SECONDS)+RALLY_SECONDS)%RALLY_SECONDS;
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
    return {x:dx*c-dz*s,z:dx*s+dz*c,y:.074+lift+.035*actor.split,swing:t,planted:t===0||t===1};
  });
  return {feet,phase,speed};
}
