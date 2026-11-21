import * as T from 'three';
import type {Batch} from './architecture';
import {carveEntries,entrance,type ArenaEntry} from './arenaAccess';

/** ANZ / Show Court 3: blue undercroft with open white tensile canopy.
 * Ground reference: F42 Consulting AO26 IMG_6181; AO25 court plan page 8.
 * Gate widths and framing sections are visual estimates. */
export function showCourtEnvelope(b:Batch&{batches:Map<string,T.BufferGeometry[]>},x:number,z:number,outline:(w:number,d:number,r:number)=>T.Shape){
  const outer=outline(24,33,10),inner=outline(19.5,28.5,8);
  const edges=outer.getSpacedPoints(80),insides=inner.getSpacedPoints(80);
  const vertices:number[]=[],indices:number[]=[];
  for(let i=0;i<=80;i++){
    const a=edges[i],q=insides[i];
    for(let j=0;j<=6;j++){
      const t=j/6;
      vertices.push(x+T.MathUtils.lerp(a.x,q.x,t),8.2+.85*Math.sin(Math.PI*t),z-T.MathUtils.lerp(a.y,q.y,t));
      if(i<80&&j<6){const n=i*7+j;indices.push(n,n+1,n+7,n+1,n+8,n+7);}
    }
  }
  const skin=new T.BufferGeometry();skin.setAttribute('position',new T.Float32BufferAttribute(vertices,3));skin.setIndex(indices);skin.computeVertexNormals();
  const canopy=new T.Mesh(skin,new T.MeshStandardMaterial({color:'#e1e5de',roughness:.87,side:T.DoubleSide}));canopy.castShadow=true;canopy.receiveShadow=true;b.group.add(canopy);
  const perimeter=outline(23,32,9),points=perimeter.getSpacedPoints(64);
  for(let i=0;i<64;i++){
    const a=points[i],q=points[i+1],length=a.distanceTo(q),angle=Math.atan2(q.y-a.y,q.x-a.x);
    b.box(x+(a.x+q.x)/2,2.1,z-(a.y+q.y)/2,length+.04,4.2,.22,'#146b9c',angle);
    if(i%2===0){
      b.rod([x+a.x,4.2,z-a.y],[x+a.x,8.2,z-a.y],.075,'#d7deda');
      const inside=inner.getPointAt(i/64),next=perimeter.getPointAt((i+2)/64);
      b.rod([x+a.x,8.15,z-a.y],[x+inside.x,8.15,z-inside.y],.065,'#d7deda');
      b.rod([x+a.x,4.7,z-a.y],[x+next.x,8.1,z-next.y],.045,'#c6d2d0');
    }
    b.rod([x+a.x,4.28,z-a.y],[x+q.x,4.28,z-q.y],.07,'#bfcbd0');
  }
  const entries:ArenaEntry[]=[
    {name:'ANZ ARENA',x:x+23,z:z+10,yaw:Math.PI/2,width:4.4,height:3.3,depth:3.5},
    {name:'ARENA ACCESS',x:x-23,z:z-10,yaw:-Math.PI/2,width:4.4,height:3.3,depth:3.5},
  ];
  carveEntries(b,entries);for(const e of entries)entrance(b,e);
}
