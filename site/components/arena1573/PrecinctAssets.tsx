'use client';
import { useEffect, useState } from 'react';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeModel } from './model';

// The Blender shell shares a material across the canopy, facade and concrete
// seating tiers. Apply the ribbed aluminium and entrance glazing to the exterior.
function finishKia(material:T.MeshStandardMaterial){
  if(material.name!=='Pale concrete')return;
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 kiaP,kiaN;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n kiaP=position;kiaN=normal;');
    shader.fragmentShader='varying vec3 kiaP,kiaN;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 q=kiaP.xz-vec2(344.8375,78.58);
      float run=(atan(q.y,q.x)+3.14159265)*39.;
      float outside=step(.52,dot(normalize(q),normalize(kiaN.xz+vec2(.00001))))*(1.-smoothstep(.15,.65,abs(kiaN.y)));
      float period=run/.23;
      float rib=.5+.5*cos(6.2831853*period);
      rib=mix(rib,.5,smoothstep(.12,.75,fwidth(period)));
      vec3 metal=vec3(.28,.318,.295)*(.83+.28*rib);
      float portal=1.-smoothstep(.27,.34,abs(fract(run/6.1)-.5));
      float mullion=1.-smoothstep(.02,.06+fwidth(run)*.3,abs(fract(run/1.43)-.5));
      vec3 glazing=mix(vec3(.031,.062,.077),vec3(.095,.145,.16),.5+.5*sin(run*.045+kiaP.y*.63));
      glazing=mix(glazing,vec3(.23,.26,.25),mullion*.8);
      vec3 plinth=mix(vec3(.41,.43,.40),glazing,portal);
      vec3 elevation=mix(plinth,metal,smoothstep(3.82,3.96,kiaP.y));
      diffuseColor.rgb=mix(diffuseColor.rgb,elevation,outside);
      float crown=smoothstep(13.27,13.9,kiaP.y)*smoothstep(.6,.92,abs(kiaN.y));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.43,.456,.428)*(.91+.12*rib),crown);
    `);
  };
  material.customProgramCacheKey=()=>'kia-aluminium';
}

// Optional architectural detail: a failed asset never takes down the arena.
export default function PrecinctAssets({visible,onSettled}:{visible:boolean;onSettled:(ready:boolean)=>void}) {
  const [model,setModel]=useState<T.Group|null>(null);
  useEffect(()=>{
    let disposed=false,loaded:T.Group|undefined;
    new GLTFLoader().load('/models/precinct/ao-precinct.glb',gltf=>{
      if(disposed){disposeModel(gltf.scene);return;}
      loaded=gltf.scene;
      loaded.traverse(o=>{if(o instanceof T.Mesh){
        o.castShadow=true;o.receiveShadow=true;
        for(const material of Array.isArray(o.material)?o.material:[o.material])if(material instanceof T.MeshStandardMaterial)finishKia(material);
      }});
      setModel(loaded);onSettled(true);
    },undefined,()=>{if(!disposed)onSettled(true);});
    return()=>{disposed=true;onSettled(false);if(loaded)disposeModel(loaded);};
  },[onSettled]);
  return model?<primitive object={model} visible={visible}/>:null;
}
