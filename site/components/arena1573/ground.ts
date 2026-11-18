import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pavingMaterial, type GroundFinish } from './materials';
import { PLAZA_OUTLINE } from './eventLayout';

// A continuous interpretive concourse, following the existing venue clusters.
// Heights stay below court runoffs (0.095 m) and arena interiors (0.06 m).
export const EVENT_CONCOURSE = PLAZA_OUTLINE;
export const GROUND = {concourse:-.075, lawn:-.105, apron:-.04, road:-.025, markings:-.013, path:.015};

/** Ground is a top surface, never a thin shadow-casting solid. */
export class GroundSurfaces {
  private batches=new Map<string,T.BufferGeometry[]>();
  private joinedCaps=new Set<string>();
  polygon(points:number[][],height:number,color:string,inner?:number[][]){
    const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));
    if(inner)shape.holes.push(new T.Path(inner.map(([x,z])=>new T.Vector2(x,-z)).reverse()));
    const geometry=new T.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);geometry.translate(0,height,0);
    const list=this.batches.get(color)??[];list.push(geometry);this.batches.set(color,list);
  }
  strip(a:number[],b:number[],width:number,height:number,color:string,capStart=false,capEnd=false){
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<1e-6)return;
    const nx=-dz/length*width/2,nz=dx/length*width/2;
    this.polygon([[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]],height,color);
    // Rounded joins close the triangular gaps between successive mapped segments.
    // Clipped endpoints remain square so the path cannot spill back into a court.
    for(const [point,cap] of [[a,capStart],[b,capEnd]] as const){
      if(!cap)continue;
      const key=`${point[0].toFixed(3)},${point[1].toFixed(3)},${width},${height},${color}`;
      if(this.joinedCaps.has(key))continue;
      this.joinedCaps.add(key);
      this.polygon(Array.from({length:16},(_,i)=>{
        const angle=i*Math.PI/8;return [point[0]+Math.cos(angle)*width/2,point[1]+Math.sin(angle)*width/2];
      }),height,color);
    }
  }
  finish(group:T.Group){
    const textures=new Map<GroundFinish,T.Texture>();
    for(const [color,parts] of this.batches){
      const geometry=mergeGeometries(parts)!;
      const kind:GroundFinish=['#829078','#758268'].includes(color)?'lawn'
        :['#636a6b','#828988'].includes(color)?'asphalt'
        :['#eef0e7','#eee9d9','#a8aca8','#536066'].includes(color)?'plain':'paving';
      const material=pavingMaterial(color,geometry,kind,textures.get(kind));
      if(material.map)textures.set(kind,material.map);
      const mesh=new T.Mesh(geometry,material);mesh.name=`ground-${color}`;
      if(color==='#758268')mesh.userData.alwaysVisible=true;
      mesh.receiveShadow=true;mesh.castShadow=false;group.add(mesh);
      parts.forEach(part=>part.dispose());
    }
    this.batches.clear();this.joinedCaps.clear();
  }
}
