'use client';
import {useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import * as T from 'three';
import {rallyFrame} from './rallyMotion';

function player(source:T.Group,color:string){
 const group=source.clone(true);
 group.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;if(!Array.isArray(o.material)&&o.material.name==='Jersey'){o.material=o.material.clone();o.material.color.set(color);}}});
 const part=(name:string)=>{const o=group.getObjectByName(name);if(!o)throw new Error(`Missing player part: ${name}`);return o;};
 const torso=part('Torso'),hips=part('Hips'),racket=part('Racket');
 const limbs=Array.from({length:8},(_,i)=>part('Limb'+i));
 const shoes=[part('Shoe0'),part('Shoe1')],hands=[part('HandR'),part('HandL')];
 const up=new T.Vector3(0,1,0),a=new T.Vector3(),b=new T.Vector3(),hand=new T.Vector3();
 function bone(i:number,start:number[],end:number[]){
  a.fromArray(start);b.fromArray(end);const length=a.distanceTo(b);
  limbs[i].position.copy(a).add(b).multiplyScalar(.5);limbs[i].scale.set(1,length,1);limbs[i].quaternion.setFromUnitVectors(up,b.sub(a).normalize());
 }
 function pose(p:ReturnType<typeof rallyFrame>['players'][number],time:number){
  group.position.set(p.x,.09,p.z);group.rotation.y=p.side===1?0:Math.PI;
  const stride=p.moving?Math.sin(time*12)*.13:0,turn=p.swing*.55;
  torso.rotation.set(0,turn,0);hips.rotation.y=turn*.3;
  for(let i=0;i<2;i++){
   const s=i===0?-1:1,step=stride*s,ankle=[s*(.22+Math.abs(stride)*.25),.14+Math.max(0,step)*.3,step],knee=[s*.18,.52,-.10+step*.4];
   bone(i*2,[s*.10,.87,0],knee);bone(i*2+1,knee,ankle);
   shoes[i].position.set(ankle[0],ankle[1]-.14,ankle[2]);shoes[i].rotation.set(0,-s*.12,0);shoes[i].scale.set(1,1,1);
  }
  const angle=p.swing*1.75;
  racket.position.set(.78*Math.cos(angle)-.12*Math.sin(angle),.99+Math.abs(p.swing)*.35,-.3-.75*Math.sin(angle));racket.rotation.set(0,angle,-.95);racket.scale.set(1,1,1);
  // Grip is transformed with the racket, keeping the hand attached through the swing.
  hand.set(0,-.39,0).applyQuaternion(racket.quaternion).add(racket.position);
  const shoulder=[.21*Math.cos(turn),1.43,-.21*Math.sin(turn)],elbow=[(shoulder[0]+hand.x)*.5+.07,1.15,(shoulder[2]+hand.z)*.5+.08];
  bone(4,shoulder,elbow);bone(5,elbow,hand.toArray());hands[0].position.copy(hand);hands[0].quaternion.copy(racket.quaternion);hands[0].scale.set(1,1,1);
  const left=[-.22,1.12,-.32+Math.abs(p.swing)*.12];
  bone(6,[-.21*Math.cos(turn),1.43,.21*Math.sin(turn)],[-.35,1.19,-.10]);bone(7,[-.35,1.19,-.10],left);hands[1].position.fromArray(left);hands[1].rotation.set(.6,0,0);hands[1].scale.set(1,1,1);
 }
 return {group,pose};
}
export default function TennisRally({active}:{active:boolean}){
 const {scene}=useGLTF('/models/tennis/club-player.glb');
 const figures=useMemo(()=>[player(scene,'#547d7a'),player(scene,'#d5a731')],[scene]);
 const clock=useRef(0),ball=useRef<T.Mesh>(null);
 useFrame((_,delta)=>{if(active)clock.current+=Math.min(delta,.05);const frame=rallyFrame(clock.current);figures.forEach((f,i)=>f.pose(frame.players[i],clock.current));ball.current?.position.set(...frame.ball);});
 return <group dispose={null}>{figures.map((f,i)=><primitive key={i} object={f.group}/>)}<mesh ref={ball} castShadow><sphereGeometry args={[.055,12,10]}/><meshStandardMaterial color="#ddea42" emissive="#b2c630" emissiveIntensity={.22}/></mesh></group>;
}
