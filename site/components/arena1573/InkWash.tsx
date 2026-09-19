'use client';

import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Light-colour ink painting: crisp pen contours over mineral-colour washes.
// Preserve lighting values so actual cast shadows survive the paper treatment.
const washShader = {
  uniforms: { tDiffuse: { value: null }, resolution: { value: new T.Vector2(1,1) } },
  vertexShader: `varying vec2 vUv;
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 resolution; varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    float lum(vec2 p){return dot(texture2D(tDiffuse,p).rgb,vec3(.299,.587,.114));}
    void main(){
      vec2 px=1.0/resolution;
      vec2 jitter=vec2(noise(vUv*resolution*.11),noise(vUv*resolution*.13+7.0))-.5;
      vec2 uv=vUv+jitter*px*.25;
      float centre=lum(uv);
      float soft=(centre*4.0+lum(uv+px*vec2(1,0))+lum(uv-px*vec2(1,0))+lum(uv+px*vec2(0,1))+lum(uv-px*vec2(0,1)))/8.0;
      float edge=length(vec2(lum(uv+px*vec2(1,0))-lum(uv-px*vec2(1,0)),lum(uv+px*vec2(0,1))-lum(uv-px*vec2(0,1))));
      float pooling=noise(vUv*resolution*.028);
      float fibres=noise(vec2(vUv.x*resolution.x*.45,vUv.y*resolution.y*1.9));
      float grain=hash(vUv*resolution);
      vec3 paper=vec3(.953,.930,.875)+(grain-.5)*.018+(fibres-.5)*.010;
      vec3 ink=vec3(.105,.125,.125);
      vec3 source=texture2D(tDiffuse,uv).rgb;
      // Muted blue-grey, sage and ochre retain the architecture's local colour.
      vec3 mineral=mix(vec3(centre),source,.32);
      mineral=clamp((mineral-.5)*1.18+.5,0.0,1.0);
      vec3 color=mix(pow(mineral,vec3(.88))*paper,paper,.10);
      color+=(pooling-.5)*.028*(1.0-soft);
      // Broken fine nib strokes, without blurring the court or its shadows.
      float contour=smoothstep(.035,.24,edge)*(.63+.20*pooling);
      color=mix(color,ink,contour);
      float hatch=1.0-smoothstep(.06,.19,abs(sin((vUv.x*resolution.x+vUv.y*resolution.y*.55)*.72)));
      color=mix(color,ink,hatch*.09*(1.0-smoothstep(.16,.48,centre)));
      gl_FragColor=vec4(color,1.0);
    }`,
};

export function InkWash(){
  const {gl,scene,camera,size}=useThree();
  const pipeline=useMemo(()=>{
    const composer=new EffectComposer(gl);
    const render=new RenderPass(scene,camera),output=new OutputPass(),wash=new ShaderPass(washShader);
    composer.addPass(render);composer.addPass(output);composer.addPass(wash);
    return {composer,render,output,wash};
  },[gl,scene,camera]);
  useEffect(()=>{
    pipeline.composer.setPixelRatio(gl.getPixelRatio());pipeline.composer.setSize(size.width,size.height);
    pipeline.wash.uniforms.resolution.value.set(size.width*gl.getPixelRatio(),size.height*gl.getPixelRatio());
  },[pipeline,gl,size]);
  useEffect(()=>()=>{pipeline.composer.dispose();pipeline.render.dispose();pipeline.output.dispose();pipeline.wash.dispose();},[pipeline]);
  useFrame((_,delta)=>{
    // Reserve atmospheric perspective for the distant landscape, not the arena.
    if(scene.fog instanceof T.Fog){scene.fog.near=camera.position.length()+150;scene.fog.far=scene.fog.near+400;}
    pipeline.composer.render(delta);
  },1);
  return null;
}

// Imaginary distant ridges, explicitly an artistic backdrop rather than local
// geography. Layered silhouettes dissolve towards the paper-coloured horizon.
export function InkLandscape(){
  const layers=useMemo(()=>[0,1,2].map(layer=>{
    const shape=new T.Shape();shape.moveTo(-420,-6);
    for(let x=-420;x<=420;x+=4){
      const peak=Math.pow(.5+.5*Math.sin(x*.019+layer*2.1),2)*39;
      const detail=Math.sin(x*.072+layer)*6+Math.sin(x*.133)*2;
      shape.lineTo(x,16+peak+detail+layer*7);
    }
    shape.lineTo(420,-6);shape.closePath();
    return new T.ShapeGeometry(shape);
  }),[]);
  useEffect(()=>()=>layers.forEach(g=>g.dispose()),[layers]);
  return <group rotation={[0,-.35,0]} position={[0,-3,-225]}>{layers.map((geometry,i)=><mesh key={i} geometry={geometry} position={[i*27,0,-i*42]} renderOrder={-3+i}><shaderMaterial transparent depthWrite={false} side={T.DoubleSide} uniforms={{tone:{value:new T.Color(['#7c9199','#a0adb0','#c0c5bf'][i])},opacity:{value:.76-i*.13}}} vertexShader={`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`varying vec3 p;uniform vec3 tone;uniform float opacity;void main(){float stroke=pow(abs(sin(p.x*.43+p.y*.17+sin(p.y*.19)*1.3)),18.);float fine=pow(abs(sin(p.x*1.7+p.y*.26)),24.);vec3 c=tone-(stroke*.10+fine*.035)*smoothstep(0.,30.,p.y);gl_FragColor=vec4(c,opacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`}/></mesh>)}</group>;
}
