import * as T from 'three';
import {courtKit,matchPair} from './athleteKits';
import {makeAthlete} from './athleteRig';
import type {rallyFrame} from './rallyMotion';
import type {RallyCourt} from './precinctPlayers';

type Frame=ReturnType<typeof rallyFrame>;
const uniforms=courtKit();
const MAX_DETAILED_COURTS=4;

/** Reserve full skinning for players large enough to resolve faces and equipment.
 * The threshold is in CSS pixels, so telephoto and mobile views work as well as orbit. */
export function nearbyAthletes(source:T.Group,clips:T.AnimationClip[],courts:readonly RallyCourt[]){
  const group=new T.Group();group.name='courtside-athletes';
  function makePair(){
    const parent=new T.Group(),athletes=uniforms.map((kit,i)=>makeAthlete(source,clips,kit,i===0));
    parent.add(...athletes.map(a=>a.group));group.add(parent);
    return {parent,athletes,court:-1,sampled:Number.NaN};
  }
  const pool:ReturnType<typeof makePair>[]=[];
  const selected=new Set<number>(),viewPoint=new T.Vector3();
  function update(camera:T.Camera,height:number,frames:Frame[],seconds:number){
    const visible:{index:number;size:number}[]=[];
    camera.updateWorldMatrix(true,false);
    for(const [index,c] of courts.entries()){
      const cos=Math.cos(c.rotation),sin=Math.sin(c.rotation);
      let size=0;
      for(const player of frames[index].players){
        viewPoint.set(c.x+player.x*cos+player.z*sin,c.y+1.02,c.z-player.x*sin+player.z*cos).applyMatrix4(camera.matrixWorldInverse);
        const depth=-viewPoint.z;
        if(depth<=.2)continue;
        viewPoint.applyMatrix4(camera.projectionMatrix);
        if(Math.abs(viewPoint.x)>1.2||Math.abs(viewPoint.y)>1.3||viewPoint.z>1)continue;
        size=Math.max(size,.89*height*camera.projectionMatrix.elements[5]/depth);
      }
      if(size>=(selected.has(index)?17:23))visible.push({index,size});
    }
    visible.sort((a,b)=>b.size-a.size);selected.clear();
    for(const entry of visible.slice(0,MAX_DETAILED_COURTS))selected.add(entry.index);
    for(const pair of pool){
      if(!selected.has(pair.court)){pair.parent.visible=false;pair.court=-1;pair.sampled=Number.NaN;}
    }
    for(const index of selected){
      let pair=pool.find(p=>p.court===index);
      if(!pair){
        pair=pool.find(p=>p.court===-1);
        if(!pair){pair=makePair();pool.push(pair);}
        const c=courts[index];const kits=matchPair(c.key);pair.athletes.forEach((a,i)=>a.setKit(kits[i].shirt,kits[i].portrait,kits[i].shorts));
        pair.court=index;pair.parent.visible=true;pair.parent.position.set(c.x,c.y,c.z);pair.parent.rotation.y=c.rotation;
        pair.parent.updateWorldMatrix(true,false);
      }
      if(pair.sampled!==seconds){
        pair.athletes.forEach((a,side)=>a.pose(frames[index].players[side]));pair.sampled=seconds;
      }
    }
    return selected;
  }
  return {group,update,dispose(){for(const pair of pool)for(const a of pair.athletes)a.dispose();}};
}
