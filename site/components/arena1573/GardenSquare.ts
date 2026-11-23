import * as T from 'three';
import type {Batch} from './architecture';
import {eventWorlds} from './eventWorlds';
import {pavingMaterial} from './materials';

/** Connected Garden Square concourse; existing mapped paths remain above it. */
export function gardenSquare(b:Batch){
  const lawn=new T.Shape().absellipse(157,55,18,12,0,Math.PI*2,false,.30);
  const edging=new T.Shape().absellipse(157,55,18.25,12.25,0,Math.PI*2,false,.30);
  const plaza=new T.Shape(eventWorlds.garden.ring.map(([x,z])=>new T.Vector2(x,-z)));
  plaza.holes.push(new T.Path(edging.getPoints(64).reverse()));
  edging.holes.push(new T.Path(lawn.getPoints(64).reverse()));
  const surface=(shape:T.Shape,height:number,color:string,grass=false)=>{
    const geometry=new T.ShapeGeometry(shape,64);geometry.rotateX(-Math.PI/2);geometry.translate(0,height,0);
    const mesh=new T.Mesh(geometry,pavingMaterial(color,geometry,grass?'lawn':'paving'));
    mesh.name='garden-square-'+(grass?'lawn':'paving');mesh.receiveShadow=true;b.group.add(mesh);
    if(shape===plaza){
      // Feather the whole boundary into the aerial, rather than exposing the
      // straight-edged survey footprint as a large opaque patch.
      const material=mesh.material,previous=material.onBeforeCompile;
      material.transparent=true;material.depthWrite=false;
      material.onBeforeCompile=(shader,renderer)=>{
        previous.call(material,shader,renderer);
        shader.vertexShader='varying vec2 plazaPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nplazaPosition=position.xz;');
        const edges=eventWorlds.garden.ring.map(([x,z],i)=>{
          const [u,v]=eventWorlds.garden.ring[(i+1)%eventWorlds.garden.ring.length];
          return `a=vec2(${x.toFixed(2)},${z.toFixed(2)});b=vec2(${u.toFixed(2)},${v.toFixed(2)});edge=b-a;d=min(d,length(plazaPosition-a-edge*clamp(dot(plazaPosition-a,edge)/dot(edge,edge),0.,1.)));`;
        }).join('\n');
        shader.fragmentShader='varying vec2 plazaPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat d=1000.;vec2 a,b,edge;${edges}\ndiffuseColor.a*=smoothstep(0.,16.,d)*.82;`);
      };
      material.customProgramCacheKey=()=> 'garden-feathered-stone-v1';
    }
  };
  // Stone replaces the blurred photographed plaza, with a flush stone border
  // connecting the event lawn to the existing pedestrian paths and entrances.
  surface(plaza,-.022,'#858c83');
  surface(edging,-.012,'#c1c4b5');
  surface(lawn,-.011,'#788566',true);
}
