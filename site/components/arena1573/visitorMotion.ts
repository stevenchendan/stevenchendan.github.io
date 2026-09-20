import type { ContextData } from './model';
import { courtFrame, outsideRingIntervals, pathIntervals } from './precinctGeometry';

export type VisitorRoute={a:number[];b:number[];length:number;entrance?:boolean};

export function visitorRoutes(data:ContextData):VisitorRoute[]{
  const obstacles=[
    {x:0,z:0,width:46,depth:64,rotation:0},
    {x:300,z:188,width:190,depth:116,rotation:0},
    ...data.features.filter(f=>f.kind==='court').map(f=>courtFrame(f.points)),
    ...data.buildings.filter(b=>b.base<2).map(b=>{
      const xs=b.ring.map(p=>p[0]),zs=b.ring.map(p=>p[1]);
      const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...zs),bottom=Math.max(...zs);
      return {x:(left+right)/2,z:(top+bottom)/2,width:right-left,depth:bottom-top,rotation:0};
    }),
  ];
  const bank=[[-210,-260],[-175,-170],[-151,-82],...(data.features.find(f=>f.id==='way/991624386')?.points??[])];
  const water=[...bank.map(([x,z])=>[x-16,z]),[-325,260],[-325,-265]];
  const routes:VisitorRoute[]=[];
  for(const f of data.features){
    if(f.kind!=='path'||!['pedestrian','footway','path'].includes(f.highway??'')||f.name==='Tanderrum Bridge'||(f.layer??0)!==0)continue;
    for(let i=1;i<f.points.length;i++){
      const a=f.points[i-1],b=f.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const dry=outsideRingIntervals(a,b,water);
      for(const [lo,hi] of pathIntervals(a,b,obstacles,1.2))for(const [u,v] of dry){
        const start=Math.max(lo,u),end=Math.min(hi,v),length=(end-start)*Math.hypot(dx,dz);
        if(length<14)continue;
        const from=[a[0]+dx*start,a[1]+dz*start],to=[a[0]+dx*end,a[1]+dz*end];
        if(from[0]<-95||from[0]>900||from[1]<-240||from[1]>275)continue;
        routes.push({a:from,b:to,length});
      }
    }
  }
  // Spread a bounded crowd across the site instead of filling only the first paths.
  const selected=routes.filter((_,i)=>i%Math.max(1,Math.ceil(routes.length/60))===0);
  selected.unshift({a:[1.5,57],b:[1.5,32],length:25,entrance:true});
  return selected;
}

/** Out-and-back walks with a short pause. Entrance turnarounds are inside the vestibule. */
export function visitorFrame(route:VisitorRoute,time:number,index:number){
  const speed=.85+(index%5)*.09,duration=route.length/speed,pause=3,cycle=2*(duration+pause);
  const phase=((time+index*7.37)%cycle+cycle)%cycle,returning=phase>=duration+pause;
  const progress=returning?1-Math.min(1,(phase-duration-pause)/duration):Math.min(1,phase/duration);
  const dx=(route.b[0]-route.a[0])/route.length,dz=(route.b[1]-route.a[1])/route.length;
  const walking=returning?phase<2*duration+pause:phase<duration;
  const turn=phase<duration?0:phase<duration+pause?(phase-duration)/pause:phase<2*duration+pause?1:1+(phase-2*duration-pause)/pause;
  const lane=.38*Math.cos(turn*Math.PI);
  const x=route.a[0]+dx*route.length*progress-dz*lane,z=route.a[1]+dz*route.length*progress+dx*lane;
  return {x,z,heading:Math.atan2(dx,dz)+turn*Math.PI,walking,
    visible:!route.entrance||z>33.5,stride:walking?Math.sin((time+index)*speed*8)*.32:0};
}
