import type { ContextData } from './model';
import { courtFrame, pathIntervals, pointInRing, type CourtFrame } from './precinctGeometry';

export type EventPocket= CourtFrame & {kind:'lawn'|'food'|'lounge';zone:string};
export const PLAZA_OUTLINE=[[-93,-240],[120,-240],[120,-70],[245,-70],[245,-42],[475,-42],[475,140],[590,140],[590,151],[900,151],[900,273],[570,273],[490,256],[210,256],[175,147],[-46,147],[-93,80]];
export function pocketRing(p:EventPocket,margin=0){
  const w=p.width/2+margin,d=p.depth/2+margin,cut=1.5;
  return [[-w+cut,-d],[w-cut,-d],[w,-d+cut],[w,d-cut],[w-cut,d],[-w+cut,d],[-w,d-cut],[-w,-d+cut]].map(([x,z])=>[p.x+x,p.z+z]);
}

/** Original event dressing inspired by the 2026 reference, not surveyed facilities. */
export function eventLayout(data:ContextData):EventPocket[]{
  const rings=[...data.buildings.filter(b=>b.base<8).map(b=>b.ring),...data.features.filter(f=>f.kind==='court').map(f=>f.points)];
  // Include rebuilt arena extensions, raised courts and the existing oval event set.
  const obstacles: CourtFrame[]=[{x:0,z:2,width:67,depth:116,rotation:0},
    {x:154,z:72,width:152,depth:183,rotation:0},{x:345,z:79,width:69,depth:89,rotation:0},
    {x:300,z:188,width:196,depth:121,rotation:0},{x:653,z:219,width:115,depth:51,rotation:0},
    ...rings.map(courtFrame)];
  const paths=data.features.filter(f=>['path','rail'].includes(f.kind)).flatMap(f=>f.points.slice(1).map((b,i)=>({a:f.points[i],b,width:f.kind==='rail'?4:Math.max(2,f.width)})));
  const zones=[{name:'West walk',x:-73,z:-202,nx:30,nz:46},{name:'Arena walk',x:212,z:-25,nx:36,nz:37},{name:'East walk',x:590,z:158,nx:41,nz:15}];
  const selected:EventPocket[]=[];
  for(const zone of zones){
    // Larger social pockets first, then smaller lawn islands in the remaining space.
    for(const kind of ['food','lounge','lawn'] as const){
      let placed=0;
      for(let j=0;j<zone.nz&&placed<(kind==='lawn'?5:2);j++)for(let i=0;i<zone.nx&&placed<(kind==='lawn'?5:2);i++){
        const p:EventPocket={x:zone.x+i*7.5,z:zone.z+j*7.5,width:kind==='lawn'?10:16,depth:kind==='lawn'?14:18,rotation:0,kind,zone:zone.name};
        if(!pocketRing(p,2).every(point=>pointInRing(point,PLAZA_OUTLINE)))continue;
        if([...obstacles,...selected].some(o=>{
          const c=Math.abs(Math.cos(o.rotation)),s=Math.abs(Math.sin(o.rotation));
          if(Math.abs(p.x-o.x)>p.width/2+5+(o.width*c+o.depth*s)/2||Math.abs(p.z-o.z)>p.depth/2+5+(o.width*s+o.depth*c)/2)return false;
          // Test all edges and the centre, including rotated court rectangles.
          const ring=pocketRing(p,4);
          return ring.some((a,k)=>pathIntervals(a,ring[(k+1)%ring.length],[o],1).reduce((sum,[lo,hi])=>sum+hi-lo,0)<.999)||pathIntervals([p.x-.01,p.z],[p.x+.01,p.z],[o],1).length===0||pathIntervals([o.x-.01,o.z],[o.x+.01,o.z],[p],4).length===0;
        }))continue;
        if(paths.some(path=>pathIntervals(path.a,path.b,[p],path.width/2+1.2).reduce((sum,[lo,hi])=>sum+hi-lo,0)<.999))continue;
        selected.push(p);placed++;
      }
    }
  }
  return selected;
}

/** Mark existing at-grade footpath/road intersections; never invent a new route. */
export function eventCrossings(data:ContextData){
  const roads=data.features.filter(f=>f.kind==='path'&&['primary','secondary','tertiary'].includes(f.highway??'')&&!(f.layer??0));
  const walks=data.features.filter(f=>f.kind==='path'&&['footway','pedestrian'].includes(f.highway??'')&&!(f.layer??0));
  const crossings:{x:number;z:number;dx:number;dz:number}[]=[];
  for(const road of roads)for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<8)continue;
    for(const walk of walks)for(let j=1;j<walk.points.length;j++){
      const p=walk.points[j-1],q=walk.points[j],ex=q[0]-p[0],ez=q[1]-p[1],cross=dx*ez-dz*ex;
      if(Math.abs(cross)<length*Math.hypot(ex,ez)*.8)continue;
      const t=((p[0]-a[0])*ez-(p[1]-a[1])*ex)/cross,u=((p[0]-a[0])*dz-(p[1]-a[1])*dx)/cross;
      if(t<0||t>1||u<0||u>1)continue;
      const x=a[0]+dx*t,z=a[1]+dz*t;
      if(!pointInRing([x,z],PLAZA_OUTLINE)||crossings.some(c=>Math.hypot(c.x-x,c.z-z)<25))continue;
      crossings.push({x,z,dx:dx/length,dz:dz/length});
      if(crossings.length===8)return crossings;
    }
  }
  return crossings;
}
