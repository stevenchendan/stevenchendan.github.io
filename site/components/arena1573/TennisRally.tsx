'use client';

import {useEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import * as T from 'three';
import {BALL_RADIUS,rallyFrame} from './rallyMotion';
import {makeAthlete} from './athleteRig';

export default function TennisRally({active,time,phase=0}:{active:boolean;time?:RefObject<number>;phase?:number}){
  const {scene,animations}=useGLTF('/models/tennis/rally-athlete.glb');
  const players=useMemo(()=>[
    makeAthlete(scene,animations,'#286e82',true),
    makeAthlete(scene,animations,'#df8f38',false),
  ],[scene,animations]);
  useEffect(()=>()=>players.forEach(p=>p.dispose()),[players]);
  const ownClock=useRef(-.16),lastSample=useRef(Number.NaN),ball=useRef<T.Mesh>(null);
  useFrame((_,delta)=>{
    if(!time && active)ownClock.current+=delta;
    const seconds=(time?.current??ownClock.current)+phase;
    if(seconds===lastSample.current)return;
    lastSample.current=seconds;
    const frame=rallyFrame(seconds);
    players.forEach((player,i)=>player.pose(frame.players[i]));
    ball.current?.position.set(...frame.ball);
  });
  return <group>
    {players.map((p,i)=><primitive key={i} object={p.group} dispose={null}/>)}
    <mesh ref={ball} castShadow><sphereGeometry args={[BALL_RADIUS,16,12]}/><meshStandardMaterial color="#dbea43" roughness={.88} emissive="#a8b41a" emissiveIntensity={.10}/></mesh>
  </group>;
}
