'use client';
import { useEffect, useState } from 'react';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeModel } from './model';

// Optional architectural detail: a failed asset never takes down the arena.
export default function PrecinctAssets({visible}:{visible:boolean}) {
  const [model,setModel]=useState<T.Group|null>(null);
  useEffect(()=>{
    let disposed=false,loaded:T.Group|undefined;
    new GLTFLoader().load('/models/precinct/ao-precinct.glb',gltf=>{
      if(disposed){disposeModel(gltf.scene);return;}
      loaded=gltf.scene;
      loaded.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
      setModel(loaded);
    },undefined,()=>{/* The mapped courts remain available without the detail. */});
    return()=>{disposed=true;if(loaded)disposeModel(loaded);};
  },[]);
  return model?<primitive object={model} visible={visible}/>:null;
}
