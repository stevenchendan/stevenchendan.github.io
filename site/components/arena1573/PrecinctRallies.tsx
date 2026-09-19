'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import type { ContextData } from './model';
import { rallyCourts } from './courtPlacements';
import { rallyFrame } from './rallyMotion';

/** Shared low-detail articulated players: six draw calls for the whole precinct. */
export default function PrecinctRallies({data,active,visible}:{data:ContextData;active:boolean;visible:boolean}){
  const courts=useMemo(()=>rallyCourts(data),[data]);
  const torso=useRef<T.InstancedMesh>(null),heads=useRef<T.InstancedMesh>(null),limbs=useRef<T.InstancedMesh>(null),rackets=useRef<T.InstancedMesh>(null),grips=useRef<T.InstancedMesh>(null),balls=useRef<T.InstancedMesh>(null);
  const time=useRef(0);
  const scratch=useMemo(()=>({object:new T.Object3D(),a:new T.Vector3(),b:new T.Vector3(),up:new T.Vector3(0,1,0),color:new T.Color()}),[]);
  useFrame((_,delta)=>{
    if(active&&visible)time.current+=Math.min(delta,.05);
    if(!visible||!torso.current||!heads.current||!limbs.current||!rackets.current||!grips.current||!balls.current)return;
    const {object:o,a,b,up,color}=scratch;
    courts.forEach((court,index)=>{
      const t=time.current+index*.713,frame=rallyFrame(t),cos=Math.cos(court.rotation),sin=Math.sin(court.rotation);
      const world=(x:number,y:number,z:number,out:T.Vector3)=>out.set(court.x+x*cos+z*sin,court.y+y,court.z-x*sin+z*cos);
      const put=(mesh:T.InstancedMesh,i:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,angle=0)=>{
        world(x,y,z,o.position);o.rotation.set(0,court.rotation+angle,0);o.scale.set(sx,sy,sz);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);
      };
      frame.players.forEach((p,side)=>{
        const i=index*2+side,step=p.moving?Math.sin(t*12)*.22:0;
        const angle=p.side===1?0:Math.PI;
        put(torso.current!,i,p.x,1.13,p.z,.48,.65,.31,angle+p.swing*.3);
        torso.current!.setColorAt(i,color.set(['#e4af38','#457eaa','#d2654d','#74a496'][(index+side)%4]));
        put(heads.current!,i,p.x,1.65,p.z,.17,.20,.17);
        const bone=(slot:number,start:number[],end:number[],radius=.07)=>{
          world(...start as [number,number,number],a);world(...end as [number,number,number],b);
          o.position.copy(a).add(b).multiplyScalar(.5);const length=a.distanceTo(b);
          o.quaternion.setFromUnitVectors(up,b.sub(a).normalize());o.scale.set(radius,length,radius);o.updateMatrix();limbs.current!.setMatrixAt(i*4+slot,o.matrix);
        };
        for(const s of [-1,1])bone(s<0?0:1,[p.x+s*.13,.87,p.z],[p.x+s*.24,.16,p.z+step*s],.095);
        const swing=p.swing*1.75,rx=p.x+p.side*(.78*Math.cos(swing)-.12*Math.sin(swing)),rz=p.z+p.side*(-.3-.75*Math.sin(swing)),ry=.99+Math.abs(p.swing)*.35;
        bone(2,[p.x+p.side*.22,1.4,p.z],[rx,ry,rz],.065);
        bone(3,[p.x-p.side*.22,1.4,p.z],[p.x-p.side*.4,1.05,p.z-p.side*.25],.065);
        put(rackets.current!,i,rx,ry,rz,.28,.36,.28,angle+swing);
        put(grips.current!,i,rx,ry-.4,rz,.035,.32,.035,angle+swing);
      });
      put(balls.current!,index,...frame.ball,.075,.075,.075);
    });
    for(const mesh of [torso,heads,limbs,rackets,grips,balls]){mesh.current!.instanceMatrix.needsUpdate=true;if(mesh.current!.instanceColor)mesh.current!.instanceColor!.needsUpdate=true;}
  });
  const players=courts.length*2;
  return <group visible={visible}>
    <instancedMesh ref={torso} args={[undefined,undefined,players]} frustumCulled={false}><boxGeometry/><meshStandardMaterial roughness={.8}/></instancedMesh>
    <instancedMesh ref={heads} args={[undefined,undefined,players]} frustumCulled={false}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color="#b98562"/></instancedMesh>
    <instancedMesh ref={limbs} args={[undefined,undefined,players*4]} frustumCulled={false}><cylinderGeometry args={[1,1,1,6]}/><meshStandardMaterial color="#c39b79"/></instancedMesh>
    <instancedMesh ref={rackets} args={[undefined,undefined,players]} frustumCulled={false}><torusGeometry args={[1,.075,4,12]}/><meshStandardMaterial color="#d0d6d5"/></instancedMesh>
    <instancedMesh ref={grips} args={[undefined,undefined,players]} frustumCulled={false}><boxGeometry/><meshStandardMaterial color="#273944"/></instancedMesh>
    <instancedMesh ref={balls} args={[undefined,undefined,courts.length]} frustumCulled={false}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color="#dce849" emissive="#7a870e" emissiveIntensity={.25}/></instancedMesh>
  </group>;
}
