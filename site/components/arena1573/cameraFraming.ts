import { Vector3 } from 'three';
import type { courtDirectory } from './courtPlacements';
import { outerStandLayout } from './OuterCourtStands';
import { cameras, destinations, standCameras, type View } from './views';
import { courtFrame } from './precinctGeometry';
import type { ContextData } from './model';

export function presetCamera(view:View,venueId:string|undefined,court:ReturnType<typeof courtDirectory>[number]|undefined,data:ContextData,aspect:number){
  const venue=destinations.find(d=>d.id===venueId);
  const target=court?new Vector3(court.x,court.y+1,court.z):new Vector3(...(venue?.target??cameras.ao.target));
  const arena=!!venue&&(!court||court.venue===court.key);
  const offset=new Vector3();
  if(view==='ao'){
    // Keep the subject on its own side of the precinct while fitting the grounds.
    target.lerp(new Vector3(...cameras.ao.target),.74);
    offset.fromArray(cameras.ao.position).sub(new Vector3(...cameras.ao.target));
  }else if(view==='precinct'){
    offset.set(-115,210,175);
  }else if(view==='plan'){
    offset.set(0,arena?Math.max(105,venue.offset[1]*1.48):74,.06);
  }else if(view==='seat'&&court){
    if(court.key==='1573')offset.fromArray(standCameras.west).sub(new Vector3(0,1,0));
    else if(court.key==='kia'||court.key==='west-show')offset.set(0,court.key==='kia'?9:6,court.key==='kia'?32:28);
    else {
      const feature=data.features.find(f=>f.id===court.id)!;
      const {width,depth}=courtFrame(feature.points),stand=outerStandLayout[feature.name]?.[0];
      // Look along the central aisle or from the end gallery of the actual court.
      if(stand){const row=Math.floor(stand.rows*.65);offset.set(stand.side*(width/2+1.1+row*.72),1+row*.38,0);}
      else offset.set(width/2-2.4,1.5,depth/2-1.45);
    }
  }else if(arena)offset.fromArray(venue.offset);
  else offset.set(-23,34,43);
  if(court&&!arena&&view!=='ao'&&view!=='precinct')offset.applyAxisAngle(new Vector3(0,1,0),court.rotation);
  if(view!=='seat')offset.multiplyScalar(Math.max(1,Math.min(2.9,(view==='ao'?1.68:1.23)/aspect)));
  return {target,offset};
}
