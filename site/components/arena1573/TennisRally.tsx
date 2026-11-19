'use client';

import {useEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import * as T from 'three';
import {courtFrameAt} from './courtMatches';
import {BALL_RADIUS} from './rallyMotion';
import {makeAthlete} from './athleteRig';
import {athleteModelUrl,matchPair} from './athleteKits';

export default function TennisRally({active,time,phase=0,court}:{active:boolean;time?:RefObject<number>;phase?:number;court?:string}){
  const {scene,animations}=useGLTF(athleteModelUrl);
  const kits=useMemo(()=>matchPair(court),[court]);
  const players=useMemo(()=>kits.map((kit,i)=>{
    const player=makeAthlete(scene,animations,kit.shirt,i===0);
    player.setKit(kit.shirt,kit.portrait,kit.shorts,kit.build);return player;
  }),[scene,animations,kits]);
  useEffect(()=>()=>players.forEach(p=>p.dispose()),[players]);
  const ownClock=useRef(-.16),cache=useMemo(()=>({sample:Number.NaN}),[players,phase]),ball=useRef<T.Mesh>(null);
  useFrame((_,delta)=>{
    if(!time && active)ownClock.current+=delta;
    const seconds=(time?.current??ownClock.current)+phase;
    if(seconds===cache.sample)return;
    cache.sample=seconds;
    const frame=courtFrameAt(seconds,court);
    players.forEach((player,i)=>player.pose(frame.players[i]));
    if(ball.current){ball.current.position.set(...frame.ball);ball.current.visible=frame.ballVisible;}
  });
  return <group>
    {players.map((p,i)=><primitive key={i} object={p.group} dispose={null}/>)}
    <mesh ref={ball} castShadow><sphereGeometry args={[BALL_RADIUS,16,12]}/><meshStandardMaterial color="#dbea43" roughness={.88} emissive="#a8b41a" emissiveIntensity={.10}/></mesh>
  </group>;
}
