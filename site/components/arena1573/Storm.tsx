import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as T from 'three';
import type {MatchAudio} from './useMatchSound';

/** Distant lightning: one gentle pulse, with thunder arriving after the light. */
export default function Storm({audio,active}:{audio:MatchAudio|null;active:boolean}){
  const light=useRef<T.DirectionalLight>(null),bolt=useRef<T.Group>(null);
  const material=useRef<T.LineBasicMaterial>(null);
  const timing=useRef({wait:5,age:10});
  const stop=useRef<(()=>void)|null>(null);
  const forward=useMemo(()=>new T.Vector3(),[]);
  const geometry=useMemo(()=>{
    const points=[
      [0,100,0],[-8,82,0],[-8,82,0],[3,67,0],[3,67,0],[-5,51,0],
      [-5,51,0],[5,37,0],[5,37,0],[0,18,0],
      [3,67,0],[19,58,0],[19,58,0],[24,43,0],
      [-8,82,0],[-21,72,0],[-21,72,0],[-29,55,0],
    ];
    return new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));
  },[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useEffect(()=>{
    const reset=()=>{
      stop.current?.();stop.current=null;
      timing.current={wait:5,age:10};
      if(light.current)light.current.intensity=0;
      if(bolt.current)bolt.current.visible=false;
    };
    reset();
    document.addEventListener('visibilitychange',reset);
    return ()=>{document.removeEventListener('visibilitychange',reset);reset();};
  },[audio,active]);
  useFrame(({camera},delta)=>{
    if(!active||document.hidden)return;
    const state=timing.current,step=Math.min(delta,.1);
    state.wait-=step;state.age+=step;
    if(state.wait<=0){
      state.wait=14+Math.random()*12;state.age=0;
      camera.getWorldDirection(forward);forward.y=0;
      if(forward.lengthSq()<.01)forward.set(0,0,-1);
      forward.normalize().applyAxisAngle(T.Object3D.DEFAULT_UP,(Math.random()-.5)*.8);
      if(bolt.current){
        bolt.current.position.copy(camera.position).addScaledVector(forward,650);
        bolt.current.position.y=80;
        bolt.current.rotation.y=Math.atan2(-forward.x,-forward.z);
      }
      stop.current?.();stop.current=audio?.thunder()??null;
    }
    // A smooth 0.9-second glow, never a rapid sequence of strobe flashes.
    const pulse=state.age<.9?Math.sin(Math.PI*state.age/.9)**2:0;
    if(light.current)light.current.intensity=pulse*1.7;
    if(material.current)material.current.opacity=pulse*.8;
    if(bolt.current)bolt.current.visible=pulse>0;
  });
  return <>
    <directionalLight ref={light} position={[100,300,-200]} color="#d3e7ff" intensity={0}/>
    <group ref={bolt} visible={false}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial ref={material} color="#e3efff" transparent opacity={0} depthWrite={false} toneMapped={false} fog={false}/>
      </lineSegments>
    </group>
  </>;
}
