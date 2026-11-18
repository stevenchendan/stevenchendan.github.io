'use client';

import {useEffect,useMemo,type RefObject} from 'react';
import {useFrame,useLoader} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import {FileLoader} from 'three';
import type {ContextData} from './model';
import {courtDirectory} from './courtPlacements';
import {venueVisible} from './venueVisibility';
import {makePrecinctPlayers,type RallyCourt} from './precinctPlayers';

type Props={data:ContextData;time:RefObject<number>;surroundings:boolean;selectedVenue:string;excludeCourt?:string};

export default function PrecinctRallies({data,time,surroundings,selectedVenue,excludeCourt}:Props){
  const courts=useMemo(()=>courtDirectory(data).filter(c=>c.venue!=='1573'&&
    c.id!==excludeCourt&&venueVisible(c.venue,selectedVenue,surroundings)),[data,selectedVenue,surroundings,excludeCourt]);
  return courts.length?<CourtPlayers time={time} courts={courts}/>:null;
}

function CourtPlayers({time,courts}:{time:RefObject<number>;courts:RallyCourt[]}){
  const {scene,animations}=useGLTF('/models/tennis/rally-athlete.glb');
  const atlas=useLoader(FileLoader,'/models/tennis/precinct-motion.bin',loader=>{loader.setResponseType('arraybuffer');}) as ArrayBuffer;
  const players=useMemo(()=>makePrecinctPlayers(scene,atlas,courts,animations),[scene,atlas,courts,animations]);
  useEffect(()=>()=>players.dispose(),[players]);
  useFrame(({camera,size})=>players.pose(time.current,camera,size.height));
  return <primitive object={players.group} dispose={null}/>;
}
