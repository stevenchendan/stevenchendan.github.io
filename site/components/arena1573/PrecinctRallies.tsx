'use client';

import {useEffect,useMemo,type RefObject} from 'react';
import {useFrame,useLoader} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import {FileLoader} from 'three';
import type {ContextData} from './model';
import {rallyCourts} from './courtPlacements';
import {courtVenue,venueVisible} from './venueVisibility';
import {makePrecinctPlayers,type RallyCourt} from './precinctPlayers';

type Props={data:ContextData;time:RefObject<number>;surroundings:boolean;selectedVenue:string;excludeCourt?:string};

export default function PrecinctRallies({data,time,surroundings,selectedVenue,excludeCourt}:Props){
  const courts=useMemo(()=>rallyCourts(data).map((c,i)=>({...c,phase:i*.713})).filter(c=>
    c.id!==excludeCourt&&venueVisible(courtVenue(c.id,c.x),selectedVenue,surroundings)),[data,selectedVenue,surroundings,excludeCourt]);
  return courts.length?<CourtPlayers time={time} courts={courts}/>:null;
}

function CourtPlayers({time,courts}:{time:RefObject<number>;courts:RallyCourt[]}){
  const {scene}=useGLTF('/models/tennis/rally-athlete.glb');
  const atlas=useLoader(FileLoader,'/models/tennis/precinct-motion.bin',loader=>{loader.setResponseType('arraybuffer');}) as ArrayBuffer;
  const players=useMemo(()=>makePrecinctPlayers(scene,atlas,courts),[scene,atlas,courts]);
  useEffect(()=>()=>players.dispose(),[players]);
  useFrame(()=>players.pose(time.current));
  return <primitive object={players.group} dispose={null}/>;
}
