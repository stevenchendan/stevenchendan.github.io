import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as T from 'three';
import type { ContextData } from './model';
import { courtLighting } from './courtLighting';
import { venueVisible } from './venueVisibility';

export default function CourtFloodlights({data,night,covered,venue,surroundings}:{data:ContextData;night:number;covered:boolean;venue:string;surroundings:boolean}) {
  const scene = useThree(s=>s.scene), invalidate = useThree(s=>s.invalidate);
  const field = useMemo(()=>courtLighting(data),[data]);
  const power = useMemo(()=>({value:new T.Vector2()}),[]);
  power.value.set(night, Math.max(night, covered ? 1 : 0));
  useEffect(()=>{
    const cleanups: (()=>void)[] = [];
    const seen = new WeakSet<T.Object3D>(), materials = new WeakSet<T.Material>();
    function patch(material:T.Material) {
      if (materials.has(material) || !(material instanceof T.MeshStandardMaterial || material instanceof T.MeshLambertMaterial)) return;
      materials.add(material);
      const compile = material.onBeforeCompile, cache = material.customProgramCacheKey, oldKey = cache.call(material);
      material.onBeforeCompile = function(shader, renderer) {
        compile.call(this, shader, renderer);
        shader.uniforms.matchLightField = {value:field.texture};
        shader.uniforms.matchLightBounds = {value:field.bounds};
        shader.uniforms.matchLightPower = power;
        shader.vertexShader = 'varying vec3 matchWorld;\n'+shader.vertexShader.replace('#include <clipping_planes_vertex>',
          '#include <clipping_planes_vertex>\n matchWorld = cameraPosition + mvPosition.xyz * mat3(viewMatrix);');
        shader.fragmentShader = 'varying vec3 matchWorld; uniform sampler2D matchLightField; uniform vec4 matchLightBounds; uniform vec2 matchLightPower;\n'+shader.fragmentShader.replace('#include <lights_fragment_end>',`
          #include <lights_fragment_end>
          if (max(matchLightPower.x,matchLightPower.y)>0.) {
            vec2 uv=(matchWorld.xz-matchLightBounds.xy)/matchLightBounds.zw;
            vec3 lamp=texture2D(matchLightField,clamp(uv,0.,1.)).rgb;
            float heightFade=1.-smoothstep(lamp.b*42.5-1.,lamp.b*42.5+1.,matchWorld.y);
            float facing=mix(.26,1.,smoothstep(-.5,.95,(normal * mat3(viewMatrix)).y));
            float power=max(lamp.r*matchLightPower.x,lamp.g*matchLightPower.y);
            reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.91,.97,1.)*power*heightFade*facing*1.55;
          }`);
      };
      material.customProgramCacheKey = ()=>oldKey+'-match-floodlights';
      material.needsUpdate = true;
      cleanups.push(()=>{material.onBeforeCompile=compile;material.customProgramCacheKey=cache;material.needsUpdate=true;});
    }
    function attach(o:T.Object3D) {
      if(seen.has(o))return; seen.add(o);
      if(o instanceof T.Mesh) for (const mat of Array.isArray(o.material)?o.material:[o.material]) patch(mat);
      if(o instanceof T.Group || o instanceof T.Scene){
        const added=(event:{child:T.Object3D})=>event.child.traverse(attach);
        o.addEventListener('childadded',added);
        cleanups.push(()=>o.removeEventListener('childadded',added));
      }
    }
    scene.traverse(attach);invalidate();
    return ()=>{for(const cleanup of cleanups)cleanup();field.texture.dispose();};
  },[scene,field,power,invalidate]);
  // Group the luminous faces by circuit. Stadium clusters sit on the inside
  // of the catwalk, and the outdoor pairs coincide with the mapped sideline masts.
  const groups = useMemo(()=>{
    const groups = new Map<string,typeof field.circuits>();
    for(const circuit of field.circuits) {
      const group=groups.get(circuit.venue)??[];group.push(circuit);groups.set(circuit.venue,group);
    }
    return [...groups].map(([id,list])=>{
      const positions:number[]=[],normals:number[]=[];
      for(const {c,lamps} of list)for(const lamp of lamps){
        const eye=new T.Object3D();eye.position.copy(lamp);eye.lookAt(c.x,c.y,c.z);eye.translateZ(.38);eye.updateMatrix();
        const plane=new T.PlaneGeometry(id==='1573'?.9:1.65,.45).toNonIndexed();plane.applyMatrix4(eye.matrix);
        positions.push(...plane.attributes.position.array);normals.push(...plane.attributes.normal.array);plane.dispose();
      }
      const geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
      return {id,indoor:list[0].indoor,geometry};
    });
  },[field]);
  return <group>{groups.map(({id,indoor,geometry})=><mesh key={id} geometry={geometry} visible={venueVisible(id,venue,surroundings)&&(night>.01||covered&&indoor)}>
    <meshBasicMaterial color="#fff9df" side={T.DoubleSide} toneMapped={false}/>
  </mesh>)}</group>;
}
