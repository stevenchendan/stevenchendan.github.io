'use client';

import {useEffect,useLayoutEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import * as T from 'three';
import {courtFrameAt} from './courtMatches';
import {BALL_RADIUS} from './rallyMotion';
import {makeAthlete} from './athleteRig';
import {athleteModelUrl,matchPair} from './athleteKits';

function SweptPlayer({actor}:{actor:T.Group}){
  const {scene}=useGLTF('/models/tennis/swept-player.glb?v=3');
  useLayoutEffect(()=>{
    const original=actor.getObjectByName('TennisCap')!;
    const portrait=scene.clone();
    portrait.name='1573 swept-hair player';
    portrait.position.copy(original.position);
    portrait.quaternion.copy(original.quaternion);
    portrait.scale.copy(original.scale);
    original.parent!.add(portrait);
    original.visible=false;
    return ()=>{portrait.removeFromParent();original.visible=true;};
  },[actor,scene]);
  return null;
}

export default function TennisRally({active,time,phase=0,court}:{active:boolean;time?:RefObject<number>;phase?:number;court?:string}){
  const {scene,animations}=useGLTF(athleteModelUrl);
  const kits=useMemo(()=>matchPair(court),[court]);
  const players=useMemo(()=>kits.map((kit,i)=>{
    const player=makeAthlete(scene,animations,kit.shirt,i===0);
    const featured=court==='1573'&&i===0;
    player.setKit(featured?'#f6f6f2':kit.shirt,kit.portrait,kit.shorts,kit.build,featured?'#25344e':undefined);return player;
  }),[scene,animations,kits,court]);
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
    {court==='1573'&&<SweptPlayer actor={players[0].group}/>}
    {players.map((p,i)=><primitive key={i} object={p.group} dispose={null}/>)}
    <mesh ref={ball} castShadow><sphereGeometry args={[BALL_RADIUS,16,12]}/><meshStandardMaterial color="#dbea43" roughness={.88} emissive="#a8b41a" emissiveIntensity={.10}/></mesh>
  </group>;
}
