import type {Batch} from './architecture';
import type {ArenaEntry} from './arenaAccess';

/** True passages: the opening faces the court, with its corridor behind it.
 * AO25 floor plans establish player-entry sides; dimensions are approximate. */
export function insidePassage(x:number,y:number,z:number,e:ArenaEntry){
  const dx=x-e.x,dz=z-e.z,c=Math.cos(e.yaw),s=Math.sin(e.yaw);
  const u=dx*c-dz*s,v=dx*s+dz*c;
  return Math.abs(u)<e.width/2+.3&&v<.7&&v>-(e.depth??4)&&y>(e.base??0)&&y<(e.base??0)+e.height+.35;
}
export function passage(b:Batch,e:ArenaEntry){
  const c=Math.cos(e.yaw),s=Math.sin(e.yaw),y=e.base??0,d=e.depth??4;
  const box=(u:number,h:number,v:number,w:number,hh:number,dd:number,color:string)=>
    b.box(e.x+u*c+v*s,h,e.z-u*s+v*c,w,hh,dd,color,e.yaw);
  box(0,y+.055,-d/2,e.width,.11,d,'#59666a');
  for(const side of [-1,1])box(side*(e.width/2+.12),y+e.height/2,-d/2,.24,e.height,d,'#44535c');
  box(0,y+e.height+.12,-d/2,e.width+.48,.24,d,'#65747b');
  box(0,y+e.height/2,-d,e.width,e.height,.14,'#101d26');
  // A light deep in the corridor makes the recess legible from the court.
  box(0,y+e.height-.12,-d*.7,e.width*.6,.04,.32,'#d4ded8');
}
