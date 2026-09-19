import type { ContextData } from './model';
import { courtFrame } from './precinctGeometry';

export function courtElevation(x:number,layer?:number){return x>590&&x<709&&layer===1?5.75:0;}

/** Match the centres used by the reconstructed arena interiors. */
export function rallyCourts(data:ContextData){
  const courts=data.features.filter(f=>f.kind==='court'&&f.id!=='way/126844352').map(f=>{
    const frame=courtFrame(f.points);
    const placement={id:f.id,x:frame.x,z:frame.z,rotation:frame.rotation,y:courtElevation(frame.x,f.layer)};
    if(f.id==='way/1239949235')Object.assign(placement,{x:154,z:72,rotation:0});
    if(f.id==='way/1239949236')Object.assign(placement,{x:344.8375,z:78.58});
    if(f.id==='way/126844350')placement.rotation=0;
    return placement;
  });
  const john=data.buildings.find(b=>b.name==='John Cain Arena');
  if(john){const ring=john.ring.slice(0,-1);courts.push({id:'john-cain-interior',x:ring.reduce((s,p)=>s+p[0],0)/ring.length,z:ring.reduce((s,p)=>s+p[1],0)/ring.length,y:0,rotation:0});}
  return courts;
}
