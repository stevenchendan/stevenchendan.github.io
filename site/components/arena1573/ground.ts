import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pavingMaterial } from './materials';

// A continuous interpretive concourse, following the existing venue clusters.
// Heights stay below court runoffs (0.095 m) and arena interiors (0.06 m).
export const EVENT_CONCOURSE = [
  [-93,-240],[120,-240],[120,-70],[245,-70],[245,-42],[475,-42],
  [475,140],[590,140],[590,151],[900,151],[900,273],[570,273],
  [490,256],[210,256],[175,147],[-46,147],[-93,80],
];
export const GROUND = {concourse:-.075, lawn:-.105, apron:-.04, road:-.025, markings:-.013, path:.015};

/** Ground is a top surface, never a thin shadow-casting solid. */
export class GroundSurfaces {
  private batches=new Map<string,T.BufferGeometry[]>();
  polygon(points:number[][],height:number,color:string){
    const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));
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
      if(cap)this.polygon(Array.from({length:24},(_,i)=>{
        const angle=i*Math.PI/12;return [point[0]+Math.cos(angle)*width/2,point[1]+Math.sin(angle)*width/2];
      }),height,color);
    }
  }
  finish(group:T.Group){
    for(const [color,parts] of this.batches){
      const geometry=mergeGeometries(parts)!;
      const material=pavingMaterial(color,geometry,color==='#829078'?'lawn':color==='#626b6c'?'asphalt':'paving');
      const mesh=new T.Mesh(geometry,material);mesh.name=`ground-${color}`;
      mesh.receiveShadow=true;mesh.castShadow=false;group.add(mesh);
      parts.forEach(part=>part.dispose());
    }
    this.batches.clear();
  }
}
