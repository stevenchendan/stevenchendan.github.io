import {useEffect,useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import {athleteModelUrl} from './athleteKits';
import type {courtDirectory} from './courtPlacements';
import type {MatchAudio} from './useMatchSound';
import {visitMatchCues} from './matchSoundCues';

type Court=ReturnType<typeof courtDirectory>[number];
type Props={audio:MatchAudio;time:RefObject<number>;courts:Court[];focus?:string|null};

export default function CourtSounds({audio,time,courts,focus}:Props){
  useGLTF(athleteModelUrl);
  const previous=useRef<{court:Court;seconds:number}|null>(null);
  useEffect(()=>{
    const reset=()=>{previous.current=null;audio.stop();};
    document.addEventListener('visibilitychange',reset);
    return ()=>{document.removeEventListener('visibilitychange',reset);reset();};
  },[audio,focus]);
  useFrame(({camera})=>{
    if(document.hidden||!courts.length)return;
    const eye=camera.position;
    const distanceSquared=(c:Court)=>(eye.x-c.x)**2+(eye.y-c.y)**2+(eye.z-c.z)**2;
    const court=courts.find(c=>c.key===focus)??courts.reduce((a,b)=>distanceSquared(a)<distanceSquared(b)?a:b);
    const seconds=time.current+court.phase,last=previous.current;
    previous.current={court,seconds};
    if(last?.court!==court){audio.stop();return;}
    const right=camera.matrixWorld.elements;
    visitMatchCues(court.key,last.seconds,seconds,cue=>{
      const cos=Math.cos(court.rotation),sin=Math.sin(court.rotation);
      const dx=court.x+cue.x*cos+cue.z*sin-eye.x,dz=court.z-cue.x*sin+cue.z*cos-eye.z;
      const dy=court.y+1-eye.y,d=Math.max(1,Math.hypot(dx,dy,dz));
      const pan=(dx*right[0]+dy*right[1]+dz*right[2])/d;
      const volume=.86/(1+d/44);
      audio.play(cue,volume,Math.max(-.86,Math.min(.86,pan)));
    });
  });
  return null;
}
