'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import type { ContextData } from './model';
import { visitorFrame, visitorRoutes } from './visitorMotion';

/** Instanced visitors: four draw calls regardless of crowd size. */
export default function Visitors({data,visible}:{data:ContextData;visible:boolean}){
  const routes=useMemo(()=>visitorRoutes(data),[data]);
  const bodies=useRef<T.InstancedMesh>(null),heads=useRef<T.InstancedMesh>(null),legs=useRef<T.InstancedMesh>(null),arms=useRef<T.InstancedMesh>(null);
  const time=useRef(0),[reduced,setReduced]=useState(true);
  const scratch=useMemo(()=>({o:new T.Object3D(),color:new T.Color()}),[]);
  useEffect(()=>{
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReduced(preference.matches);update();preference.addEventListener('change',update);
    return()=>preference.removeEventListener('change',update);
  },[]);
  useFrame((_,delta)=>{
    if(!visible||!bodies.current||!heads.current||!legs.current||!arms.current)return;
    if(!reduced)time.current+=Math.min(delta,.1);
    const {o,color}=scratch;
    routes.forEach((route,r)=>{
      for(let j=0;j<4;j++){
        const index=r*4+j,f=visitorFrame(route,time.current,index);
        const c=Math.cos(f.heading),s=Math.sin(f.heading);
        const put=(mesh:T.InstancedMesh,slot:number,x:number,y:number,z:number,w:number,h:number,d:number,swing=0)=>{
          o.position.set(f.x+x*c+z*s,y+.04,f.z-x*s+z*c);o.rotation.set(0,f.heading,0);
          o.rotateX(swing);o.scale.set(w,h,d);o.updateMatrix();mesh.setMatrixAt(slot,o.matrix);
        };
        const stride=reduced?0:f.stride,bob=Math.abs(stride)*.06;
        put(bodies.current!,index,0,1.14+bob,0,.48,.66,.28);
        bodies.current!.setColorAt(index,color.set(['#d2ae63','#5e8ca1','#d9d6c5','#ad6957','#698171','#586682'][index%6]));
        put(heads.current!,index,0,1.66+bob,0,.18,.21,.18);
        heads.current!.setColorAt(index,color.set(['#c49370','#9a6e50','#e0b697','#71503e'][index%4]));
        for(const side of [-1,1]){
          const slot=index*2+(side+1)/2;
          put(legs.current!,slot,side*.13,.46,side*stride*.32,.15,.79,.16,side*stride);
          put(arms.current!,slot,side*.3,1.15+bob,-side*stride*.35,.12,.62,.12,-side*stride);
        }
      }
    });
    for(const ref of [bodies,heads,legs,arms]){ref.current!.instanceMatrix.needsUpdate=true;if(ref.current!.instanceColor)ref.current!.instanceColor!.needsUpdate=true;}
  });
  const count=routes.length*4;
  return <group visible={visible} name="event-visitors">
    <instancedMesh ref={bodies} args={[undefined,undefined,count]} frustumCulled={false}><boxGeometry/><meshStandardMaterial roughness={.9}/></instancedMesh>
    <instancedMesh ref={heads} args={[undefined,undefined,count]} frustumCulled={false}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial roughness={.95}/></instancedMesh>
    <instancedMesh ref={legs} args={[undefined,undefined,count*2]} frustumCulled={false}><boxGeometry/><meshStandardMaterial color="#35414b" roughness={.95}/></instancedMesh>
    <instancedMesh ref={arms} args={[undefined,undefined,count*2]} frustumCulled={false}><boxGeometry/><meshStandardMaterial color="#bd987c" roughness={.95}/></instancedMesh>
  </group>;
}
