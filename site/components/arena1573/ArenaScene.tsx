'use client';

import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as T from 'three';
import { type ComponentRef, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildArena, buildContext, type ContextData, disposeModel } from './model';
import styles from './arena.module.css';
import { getTranslator, type Language } from './i18n';
import { InkLandscape, SceneEffects } from './InkWash';
import CourtStaff from './CourtStaff';
import TennisRally from './TennisRally';
import PrecinctRallies from './PrecinctRallies';
import PrecinctAssets from './PrecinctAssets';
import Rain from './Rain';
import CourtFloodlights from './CourtFloodlights';
import { athleteModelUrl, athleteMotionUrl } from './athleteKits';
import { bindSpectators, spectatorImagesSettled } from './seatedCrowd';
import { addGroundPhotography, addParkTrees } from './PrecinctLandscape';
import Visitors from './Visitors';
import { venueVisible } from './venueVisibility';
import { cameraCourtAreas, courtInView, courtDirectory,venueCourts } from './courtPlacements';
import { RoofMotion,type RoofStatus } from './roofs';
import { film,filmDusk,filmRoof,filmFieldOfView } from './film';
import { cameras, homeCamera, standCameras, destinations, points, isRoofed,sectionEye,type Shot, type Light, type Theme } from './views';
import { ARENA_LOCATION, summerSun, type ShadeResult, standSamples, STANDS } from './solar';

type Sun = ReturnType<typeof summerSun> | null;

type FilmTrack={seconds:React.RefObject<number>;cue:(typeof film)[number]['cue']};
function Sky({horizon,zenith,dusk}:{horizon:string;zenith:string;dusk?:React.RefObject<number>}){
  const uniforms=useMemo(()=>({horizon:{value:new T.Color(horizon)},zenith:{value:new T.Color(zenith)}}),[horizon,zenith]);
  const sky=useMemo(()=>[new T.Color(horizon),new T.Color('#172b38'),new T.Color(zenith),new T.Color('#101c38')],[horizon,zenith]);
  useFrame(()=>{
    if(!dusk)return;
    const t=filmDusk(dusk.current);
    uniforms.horizon.value.lerpColors(sky[0],sky[1],t);uniforms.zenith.value.lerpColors(sky[2],sky[3],t);
  });
  return <mesh frustumCulled={false} renderOrder={-1000}>
    <sphereGeometry args={[1,24,12]}/>
    <shaderMaterial side={T.BackSide} depthWrite={false} uniforms={uniforms}
      vertexShader={`varying vec3 direction; void main(){
        direction=position;
        vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);
        gl_Position=clip.xyww;
      }`}
      fragmentShader={`uniform vec3 horizon; uniform vec3 zenith; varying vec3 direction;
        void main(){
          float h=smoothstep(-.02,.65,normalize(direction).y);
          gl_FragColor=vec4(mix(horizon,zenith,h),1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`}/>
  </mesh>;
}

export type LoadProgress = {done:number;total:number;stage:'geometry'|'imagery'};
type LoadingProps = {onProgress:(progress:LoadProgress)=>void;onFailure:()=>void};

function World({data,light,context,crowd,crowdMoving,closedStudyRoof,compareStands,onReady,onProgress,onFailure,panorama,sun,onShade,selectedVenue,roofs,reducedMotion,onRoof,track}:LoadingProps&{track?:FilmTrack;panorama:boolean;crowdMoving:boolean;closedStudyRoof:boolean;compareStands:boolean;selectedVenue:string;data:ContextData;light:Light;context:boolean;crowd:boolean;onReady:(seats:number)=>void;sun:Sun;onShade:(result:ShadeResult|null)=>void;roofs:RoofMotion;reducedMotion:boolean;onRoof:(status:RoofStatus)=>void}) {
  const root=useRef<T.Group>(null);
  const invalidate=useThree(state=>state.invalidate);
  const model=useMemo(()=>({
    groups:new Map<string,T.Group>(),arena:null as ReturnType<typeof buildArena>|null,
    audiences:new Map<T.Group,ReturnType<typeof bindSpectators>>(),
    treesReady:false,groundReady:false,releaseGround:()=>{},releaseTrees:()=>{},
  }),[data]);
  const [revision,refresh]=useState(0);
  useLayoutEffect(()=>{if(root.current)roofs.bind(root.current);},[roofs]);
  const lastRoof=useRef<RoofStatus>('open');
  const selected=selectedVenue==='all'?'rla':selectedVenue;
  const preparingFilm=!!track;
  const plan=useMemo(()=>{
    if(preparingFilm)return ['landscape',...destinations.map(d=>d.id)];
    if(!context && selectedVenue!=='all')return [selected];
    return [...new Set([selected,...(context?['landscape']:[]),'mca','1573','kia','west',...destinations.map(d=>d.id)])];
  },[context,selected,selectedVenue,preparingFilm]);
  useFrame((state,delta)=>{
    if(crowd)for(const [group,tick] of model.audiences)if(group.visible)tick(state.camera,delta,crowdMoving&&!document.hidden);
    const status=track
      ?roofs.setFilmClosure(track.cue==='rain'?filmRoof(track.seconds.current):track.cue==='nightfall'?1:0)
      :roofs.advance(light==='rain'||closedStudyRoof,reducedMotion,delta);
    if(status!==lastRoof.current){lastRoof.current=status;onRoof(status);}
    if(!track&&roofs.moving)invalidate();
  },-1);
  useEffect(()=>{
    const parent=root.current!;
    return ()=>{
      model.releaseGround();model.releaseTrees();
      for(const group of model.groups.values()){parent.remove(group);disposeModel(group);}
      model.groups.clear();model.audiences.clear();model.arena=null;model.groundReady=false;model.treesReady=false;
    };
  },[model]);

  // One venue per browser task lets input and the progress bar paint between
  // builds. A camera change reprioritises pending venues and reuses finished ones.
  useEffect(()=>{
    const parent=root.current!;
    let frame=0,timer=0,cancelled=false,presented=false;
    const required=panorama?plan:[selected];
    const nextFrame=()=>{frame=requestAnimationFrame(()=>{timer=window.setTimeout(step,0);});};
    function step(){
      if(cancelled)return;
      try {
        const pending=plan.find(id=>!model.groups.has(id));
        const done=required.filter(id=>model.groups.has(id)).length;
        if(!presented){
          if(done<required.length)onProgress({stage:'geometry',done,total:required.length});
          else if(required.includes('landscape')&&(!model.groundReady||(preparingFilm&&!model.treesReady)))onProgress({stage:'imagery',done,total:done});
          else {
            presented=true;
            onReady(model.arena?.seats??0);
          }
        }
        if(pending){
          let group:T.Group;
          if(pending==='1573'){
            model.arena=buildArena();group=model.arena.group;
          }else group=buildContext(data,pending);
          model.groups.set(pending,group);
          if(pending==='landscape'){
            model.releaseGround=addGroundPhotography(group,invalidate,()=>{model.groundReady=true;invalidate();});
            model.releaseTrees=addParkTrees(group,invalidate,()=>{model.treesReady=true;invalidate();});
          }
          parent.add(group);
          model.audiences.set(group,bindSpectators(group,invalidate));
          roofs.bind(parent);refresh(n=>n+1);invalidate();
        }
        if(pending||!presented)nextFrame();
      } catch {onFailure();}
    }
    nextFrame();
    return ()=>{cancelled=true;cancelAnimationFrame(frame);clearTimeout(timer);};
  },[model,plan,selected,panorama,data,roofs,onReady,onProgress,onFailure,invalidate,preparingFilm]);
  useEffect(()=>{
    for(const [id,group] of model.groups){
      if(id==='landscape'){
        for(const child of group.children)child.visible=!!child.userData.alwaysVisible||context;
      }else group.visible=venueVisible(id,selectedVenue,context);
      group.traverse(child=>{if(child.name==='precinct-spectators')child.visible=crowd;});
    }
    if(model.arena){
      model.arena.crowd.visible=crowd;
      model.arena.lamps.traverse(o=>{if(o instanceof T.Mesh)(o.material as T.MeshStandardMaterial).emissiveIntensity=light==='night'||(sun&&!sun.aboveHorizon)?5:light==='golden'?1:.08;});
    }
    invalidate();
  },[revision,model,light,context,crowd,sun,selectedVenue,invalidate]);
  useEffect(()=>{
    if(!compareStands||!sun||!sun.aboveHorizon||!model.arena){onShade(null);return;}
    // Structural geometry only. Tiny seat/crowd
    // details are excluded from the coarse head-height shade comparison.
    const arena=model.arena;
    const frame=requestAnimationFrame(()=>{
      const blockers:T.Object3D[]=[];
      root.current?.updateWorldMatrix(true,true);
      (context?[...model.groups.values()]:[arena.group]).forEach(group=>group.traverse(obj=>{
        if(obj instanceof T.Mesh&&obj.castShadow&&!(obj instanceof T.InstancedMesh))blockers.push(obj);
      }));
      const ray=new T.Raycaster();ray.near=.06;ray.far=700;
      const direction=new T.Vector3(...sun.direction);
      const result={} as ShadeResult;
      for(const stand of STANDS){
        result[stand]=standSamples(stand).filter(position=>{ray.set(new T.Vector3(...position),direction);return ray.intersectObjects(blockers,false).length>0;}).length;
      }
      onShade(result);
    });
    return()=>cancelAnimationFrame(frame);
  },[sun,context,model,revision,onShade,compareStands]);
  return <group ref={root}/>;
}

function PrepareFilm({onPrepared}:{onPrepared:()=>void}){
  // Read the same decoded resources used by the actors. Suspense waits for all
  // of them even when an individual court is outside the opening camera shot.
  useGLTF(athleteModelUrl);
  useGLTF('/models/tennis/court-crew.glb');
  useLoader(T.FileLoader,athleteMotionUrl,loader=>loader.setResponseType('arraybuffer'));
  const {gl,scene,camera,invalidate}=useThree();
  useEffect(()=>{
    let current=true,frame=0;
    async function prepare(){
      await spectatorImagesSettled();
      if(!current)return;
      // The renderer falls back to ordinary program compilation if needed.
      try{await gl.compileAsync(scene,camera);}catch{/* The next render compiles on drivers without async support. */}
      if(!current)return;
      invalidate();frame=requestAnimationFrame(()=>{if(current)onPrepared();});
    }
    void prepare();
    return ()=>{current=false;cancelAnimationFrame(frame);};
  },[gl,scene,camera,invalidate,onPrepared]);
  return null;
}

type FilmProps={chapter:number|null;playing:boolean;onCut:()=>void};
type Court=ReturnType<typeof courtDirectory>[number];
type FocusProps={onFocus:(court:string|null|undefined)=>void};
function Rig({areas,selectedVenue,context,onFocus,shot,rotate,rain,language,onInteract,canvasRef,compassRef,chapter,playing,onCut,featured,filmTime}:FocusProps&{areas:ReturnType<typeof cameraCourtAreas>;selectedVenue:string;context:boolean;filmTime:React.RefObject<number>;shot:Shot;rotate:boolean;rain:boolean;language:Language;onInteract:()=>void;compassRef:React.RefObject<HTMLElement|null>;canvasRef:React.RefObject<HTMLCanvasElement|null>;featured?:Court}&FilmProps) {
  const {camera,gl,scene,invalidate,size}=useThree();
  const controls=useRef<ComponentRef<typeof OrbitControls>>(null);
  const seated=chapter===null&&shot.section!==undefined;
  const gaze=useRef({yaw:0,pitch:0,fov:55});
  useEffect(()=>{gaze.current={yaw:0,pitch:0,fov:shot.destination==='rla'?56:51};invalidate();},[shot,invalidate]);
  const [transitioning,setTransitioning]=useState(true);
  const manual=useRef(false);
  const lastFocus=useRef<string|null|undefined>(undefined);
  useEffect(()=>{lastFocus.current=undefined;onFocus(undefined);},[shot,chapter,onFocus]);
  useEffect(()=>{manual.current=false;setTransitioning(true);invalidate();},[shot,invalidate]);
  useEffect(()=>{if(!manual.current)setTransitioning(true);},[size.width,size.height]);
  useEffect(()=>{canvasRef.current=gl.domElement;return()=>{canvasRef.current=null;};},[gl,canvasRef]);
  useEffect(()=>{
    const element=gl.domElement;
    element.tabIndex=0;
    element.setAttribute('aria-label',getTranslator(language)('三维球场。方向键旋转，加减键缩放。'));
    let pointer:number|null=null,x=0,y=0;
    const sensitivity=.004;
    const down=(e:PointerEvent)=>{if(!seated||pointer!==null)return;pointer=e.pointerId;x=e.clientX;y=e.clientY;element.setPointerCapture(pointer);};
    const move=(e:PointerEvent)=>{
      if(e.pointerId!==pointer)return;
      gaze.current.yaw-=(e.clientX-x)*sensitivity;
      gaze.current.pitch=T.MathUtils.clamp(gaze.current.pitch+(e.clientY-y)*sensitivity,-1.1,1.48);
      x=e.clientX;y=e.clientY;invalidate();
    };
    const release=(e:PointerEvent)=>{if(e.pointerId===pointer)pointer=null;};
    const wheel=(e:WheelEvent)=>{if(seated){e.preventDefault();gaze.current.fov=T.MathUtils.clamp(gaze.current.fov+e.deltaY*.033,30,78);invalidate();}};
    function keyboard(event:KeyboardEvent){
      const orbit=controls.current;
      if(chapter!==null || event.ctrlKey || event.metaKey || event.altKey || !orbit || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(event.key))return;
      event.preventDefault();manual.current=true;setTransitioning(false);onInteract();
      if(seated){
        if(event.key==='ArrowLeft')gaze.current.yaw+=.12;
        if(event.key==='ArrowRight')gaze.current.yaw-=.12;
        if(event.key==='ArrowUp'||event.key==='ArrowDown')gaze.current.pitch=T.MathUtils.clamp(gaze.current.pitch+(event.key==='ArrowUp'?.1:-.1),-1.1,1.48);
        if('+=-'.includes(event.key))gaze.current.fov=T.MathUtils.clamp(gaze.current.fov+(event.key==='-'?4:-4),30,78);
        invalidate();return;
      }
      const offset=camera.position.clone().sub(orbit.target),sphere=new T.Spherical().setFromVector3(offset);
      if(event.key==='ArrowLeft')sphere.theta-=.12;
      if(event.key==='ArrowRight')sphere.theta+=.12;
      if(event.key==='ArrowUp')sphere.phi=Math.max(.01,sphere.phi-.10);
      if(event.key==='ArrowDown')sphere.phi=Math.min(orbit.maxPolarAngle,sphere.phi+.10);
      if('+=-'.includes(event.key))sphere.radius=T.MathUtils.clamp(sphere.radius*(event.key==='-'?1.2:1/1.2),orbit.minDistance,orbit.maxDistance);
      camera.position.copy(orbit.target).add(offset.setFromSpherical(sphere));orbit.update();invalidate();
    }
    element.addEventListener('keydown',keyboard);
    element.addEventListener('pointerdown',down);element.addEventListener('pointermove',move);
    element.addEventListener('pointerup',release);element.addEventListener('pointercancel',release);
    element.addEventListener('wheel',wheel,{passive:false});
    return ()=>{element.removeEventListener('keydown',keyboard);element.removeEventListener('pointerdown',down);element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',release);element.removeEventListener('pointercancel',release);element.removeEventListener('wheel',wheel);};
  },[camera,gl,language,onInteract,invalidate,seated,chapter]);
  const destination=useMemo(()=>{
    if(shot.home){
      const {target,offset}=homeCamera(size.width/size.height,window.matchMedia('(orientation: portrait)').matches);
      return {target:new T.Vector3(...target),offset:new T.Spherical().setFromVector3(new T.Vector3(...offset))};
    }
    const venue=destinations.find(d=>d.id===shot.destination);
    if(shot.section!==undefined&&isRoofed(shot.destination)&&featured){
      const eye=sectionEye(shot.destination,shot.section);
      if(eye){
        const targetY=shot.destination==='rla'?3.7:1.9;
        const target=new T.Vector3(featured.x,targetY,featured.z);
        return {target,offset:new T.Spherical().setFromVector3(new T.Vector3(eye[0],eye[1]-targetY,eye[2]))};
      }
    }
    if(shot.court&&featured){
      const target=new T.Vector3(featured.x,featured.y+1,featured.z);
      const offset=new T.Vector3(-11,21,28).applyAxisAngle(new T.Vector3(0,1,0),featured.rotation);
      return {target,offset:new T.Spherical().setFromVector3(offset)};
    }
    const target=new T.Vector3(...(venue?.target ?? (shot.stand ? [0,1,0] as const : cameras[shot.view].target)));
    const offset=venue ? new T.Vector3(...venue.offset) : new T.Vector3(...(shot.stand ? standCameras[shot.stand] : cameras[shot.view].position)).sub(target);
    if(shot.view!=='seat'){
      const fit=shot.view==='ao'&&!venue?1.68:1.23;
      offset.multiplyScalar(Math.max(1,Math.min(2.9,fit*size.height/size.width)));
    }
    return {target,offset:new T.Spherical().setFromVector3(offset)};
  },[shot,featured,size.width,size.height]);
  const scratch=useMemo(()=>({offset:new T.Vector3(),sphere:new T.Spherical()}),[]);
  const firstFrame=useRef(true);
  const cut=useRef(false);
  useLayoutEffect(()=>{cut.current=false;invalidate();},[chapter,invalidate]);
  useEffect(()=>{firstFrame.current=true;setTransitioning(true);invalidate();},[shot.section,chapter,invalidate]);
  useEffect(()=>{if(chapter===null&&camera instanceof T.PerspectiveCamera){camera.fov=43;camera.updateProjectionMatrix();}},[camera,chapter,seated]);
  useFrame((_,delta)=>{
    const orbit=controls.current;
    if(!orbit)return;
    if(chapter!==null){
      const take=film[chapter];
      const u=T.MathUtils.clamp(filmTime.current/take.seconds,0,1);
      const ease=u*u*(3-2*u);
      const {offset}=scratch;
      orbit.target.fromArray(take.look).lerp(offset.fromArray(take.lookTo),ease);
      camera.position.fromArray(take.from).lerp(offset.fromArray(take.to),ease);
      if(camera instanceof T.PerspectiveCamera){
        const fov=filmFieldOfView(take,size.width/Math.max(1,size.height));
        if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
      }
      orbit.update();
      if(playing&&u>=1&&!cut.current){cut.current=true;onCut();}
    }else if(seated){
      const {sphere,offset}=scratch;
      offset.setFromSpherical(destination.offset);
      camera.position.copy(destination.target).add(offset);
      sphere.setFromVector3(offset.negate());
      sphere.theta+=gaze.current.yaw;
      sphere.phi=T.MathUtils.clamp(sphere.phi-gaze.current.pitch,.06,Math.PI-.10);
      orbit.target.copy(camera.position).add(offset.setFromSpherical(sphere));
      camera.lookAt(orbit.target);
      if(camera instanceof T.PerspectiveCamera&&camera.fov!==gaze.current.fov){camera.fov=gaze.current.fov;camera.updateProjectionMatrix();}
    }else if(transitioning){
      const {offset,sphere}=scratch;
      sphere.setFromVector3(offset.copy(camera.position).sub(orbit.target));
      const end=destination.offset;
      const angle=Math.atan2(Math.sin(end.theta-sphere.theta),Math.cos(end.theta-sphere.theta));
      const snap=firstFrame.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const a=snap ? 1 : 1-Math.exp(-Math.min(delta,.35)*6.5);
      firstFrame.current=false;
      sphere.theta+=angle*a;
      sphere.phi=T.MathUtils.lerp(sphere.phi,end.phi,a);
      sphere.radius=T.MathUtils.lerp(sphere.radius,end.radius,a);
      orbit.target.lerp(destination.target,a);
      camera.position.copy(orbit.target).add(offset.setFromSpherical(sphere));
      orbit.update();
      if(a===1 || (Math.abs(angle)<.001 && Math.abs(sphere.phi-end.phi)<.001 && Math.abs(sphere.radius-end.radius)<.025 && orbit.target.distanceTo(destination.target)<.025))setTransitioning(false);
      else invalidate();
    }
    if(compassRef.current){
      const bearing=Math.round(T.MathUtils.radToDeg(orbit.getAzimuthalAngle()-ARENA_LOCATION.rotation));
      const transform=`rotate(${bearing}deg)`;
      if(compassRef.current.style.transform!==transform)compassRef.current.style.transform=transform;
    }
    if(camera instanceof T.PerspectiveCamera){
      const distance=camera.position.distanceTo(orbit.target);
      if(manual.current&&!seated&&chapter===null){
        const span=2*distance*Math.tan(T.MathUtils.degToRad(camera.fov/2))*Math.min(1,camera.aspect);
        const court=courtInView(areas,camera.position,orbit.target,span,selectedVenue,context);
        const focus=court??(orbit.target.distanceToSquared(destination.target)<1?undefined:null);
        if(focus!==lastFocus.current){lastFocus.current=focus;onFocus(focus);}
      }
      const near=T.MathUtils.clamp(distance*.01,.1,12);
      if(Math.abs(camera.near-near)>.01){camera.near=near;camera.updateProjectionMatrix();}
      if(scene.fog instanceof T.Fog){
        scene.fog.near=distance+(rain?18:65);
        scene.fog.far=scene.fog.near+(rain?210:450)+distance*.65;
      }
    }
  });
  // A preset owns the camera until it settles; orbit must not keep nudging its
  // position away from the completion threshold. Disable residual damping too.
  return <OrbitControls ref={controls} enabled={chapter===null&&!seated} makeDefault enableDamping={!transitioning&&chapter===null} dampingFactor={.075} minDistance={1.5} maxDistance={2700} maxPolarAngle={Math.PI*.488} autoRotate={rotate&&!transitioning&&chapter===null&&!seated} autoRotateSpeed={.45} zoomSpeed={.7} target={cameras.hero.target} onStart={()=>{manual.current=true;setTransitioning(false);onInteract();}}/>;
}

function Scene({onFilmPrepared,onFocus,data,shot,light:atlasLight,compareStands,closedStudyRoof:atlasRoof,rotate,context,crowd,markers,rally,ready,onProgress,onFailure,onSelect,onReady,onInteract,canvasRef,compassRef,language,theme,sun:atlasSun,onShade,onRoof,reducedMotion,chapter,playing,onCut}:FocusProps&LoadingProps&{onFilmPrepared:()=>void;ready:boolean;compareStands:boolean;closedStudyRoof:boolean;data:ContextData;shot:Shot;light:Light;rotate:boolean;context:boolean;crowd:boolean;markers:boolean;rally:boolean;onSelect:(id:string)=>void;onReady:(seats:number)=>void;onInteract:()=>void;compassRef:React.RefObject<HTMLElement|null>;canvasRef:React.RefObject<HTMLCanvasElement|null>;language:Language;theme:Theme;sun:Sun;onShade:(result:ShadeResult|null)=>void;reducedMotion:boolean;onRoof:(status:RoofStatus)=>void}&FilmProps){
  const tr=getTranslator(language);
  const filmTime=useRef(0),filmTick=useRef<number|null>(null);
  const take=chapter!==null?film[chapter]:undefined;
  const track=useMemo(()=>take?{seconds:filmTime,cue:take.cue}:undefined,[take]);
  const dusk=track?.cue==='nightfall'?filmTime:undefined;
  const light=take?(take.cue==='rain'?'rain':'golden'):atlasLight;
  const sun=take?null:atlasSun,closedStudyRoof=!take&&atlasRoof;
  useLayoutEffect(()=>{filmTime.current=0;},[chapter]);
  useLayoutEffect(()=>{
    const reset=()=>{filmTick.current=null;};
    reset();document.addEventListener('visibilitychange',reset);
    return ()=>document.removeEventListener('visibilitychange',reset);
  },[playing,chapter]);
  useFrame(()=>{
    if(!take||!playing||document.hidden)return;
    const now=performance.now();
    if(filmTick.current!==null)filmTime.current=Math.min(take.seconds,filmTime.current+(now-filmTick.current)/1000);
    filmTick.current=now;
  },-4);
  const night=light==='night'||!!sun&&!sun.aboveHorizon,golden=light==='golden'||!!sun&&sun.aboveHorizon&&sun.elevation<15;
  const selectedVenue=chapter!==null?film[chapter].venue:shot.destination??(shot.view==='ao'?'all':shot.view==='precinct'?'mca':'1573');
  const inBowl=chapter===2||(chapter===null&&shot.section!==undefined);
  const showPrecinct=context&&!inBowl;
  const focus=destinations.find(d=>d.id===selectedVenue)?.target;
  const atlasRoofs=useMemo(()=>new RoofMotion(),[]),filmRoofs=useMemo(()=>new RoofMotion(),[]);
  const roofs=take?filmRoofs:atlasRoofs;
  const courts=useMemo(()=>courtDirectory(data),[data]);
  const [kiaSettled,setKiaSettled]=useState(false);
  const areas=useMemo(()=>cameraCourtAreas(data,courts),[data,courts]);
  const atVenue=useMemo(()=>venueCourts(courts,selectedVenue),[courts,selectedVenue]);
  const featured=atVenue.find(c=>c.key===shot.court)??(atVenue.length===1?atVenue[0]:undefined);
  const away=featured&&featured.venue!=='1573'?featured:undefined;
  const time=useRef(-.16),previous=useRef<number|null>(null);
  useEffect(()=>{
    const reset=()=>{previous.current=null;};reset();
    document.addEventListener('visibilitychange',reset);
    return()=>document.removeEventListener('visibilitychange',reset);
  },[rally]);
  useFrame(()=>{
    if(!rally||document.hidden)return;
    const now=performance.now();
    if(previous.current!==null)time.current+=(now-previous.current)/1000;
    previous.current=now;
  },-3);
  const lightTarget=useMemo(()=>{
    const target=new T.Object3D();if(focus)target.position.set(focus[0],0,focus[2]);return target;
  },[focus]);
  const sunPosition:[number,number,number]=sun?[lightTarget.position.x+sun.direction[0]*300,sun.direction[1]*300,lightTarget.position.z+sun.direction[2]*300]:[lightTarget.position.x+(golden?-65:-40),golden?24:80,lightTarget.position.z+(golden?38:-30)];
  const ink=!take&&theme==='ink', rain=light==='rain';
  const floodPower=light==='night'?1:sun?1-T.MathUtils.smoothstep(sun.elevation,-1,7):0;
  const bg=rain?(ink?'#dde3df':'#aebcc3'):ink?'#f3f0e6':night?'#172b38':golden?'#d6c5ab':'#cbdde9';
  const fill=useRef<T.HemisphereLight>(null),keyLight=useRef<T.DirectionalLight>(null);
  const palette=useMemo(()=>['#e4eff8','#8299c3','#b1a788','#26362e','#ffd4a0','#acbfdf','#d6c5ab','#172b38'].map(c=>new T.Color(c)),[]);
  useFrame(({scene})=>{
    if(!dusk||!fill.current||!keyLight.current)return;
    const t=filmDusk(dusk.current);
    fill.current.color.lerpColors(palette[0],palette[1],t);
    fill.current.groundColor.lerpColors(palette[2],palette[3],t);
    fill.current.intensity=T.MathUtils.lerp(1.35,.68,t);
    keyLight.current.color.lerpColors(palette[4],palette[5],t);
    keyLight.current.intensity=T.MathUtils.lerp(2.6,.09,t);
    if(scene.background instanceof T.Color)scene.background.lerpColors(palette[6],palette[7],t);
    if(scene.fog instanceof T.Fog)scene.fog.color.lerpColors(palette[6],palette[7],t);
  });
  return <>
    <color key={dusk?'dusk-bg':'bg'} attach="background" args={[bg]}/><fog key={dusk?'dusk-fog':'fog'} attach="fog" args={[bg,120,650]}/>
    {ink&&<InkLandscape/>}
    {ink ? <SceneEffects/> : <Sky key={dusk?'dusk':'sky'} dusk={dusk} horizon={bg} zenith={night?'#101c38':rain?'#8297ac':golden?'#8daabd':'#70abd7'}/>}
    <hemisphereLight ref={fill} key={dusk?'dusk-fill':'fill'} args={[night?'#8299c3':'#e4eff8',night?'#26362e':rain?'#81959b':'#b1a788',night?.85:rain?1.8:sun?1.0:golden?1.35:1.75]}/>
    <directionalLight ref={keyLight} target={lightTarget} key={dusk?'dusk-key':sun?'solar':'mood'} position={sunPosition} color={rain?'#c5dcf2':golden?'#ffd4a0':'#fff0d8'} intensity={rain?.4:sun?(sun.aboveHorizon?Math.max(.3,Math.sin(sun.elevation*Math.PI/180)*3.3):0):night?.1:golden?2.6:2.05} castShadow={!rain} shadow-mapSize={sun?[4096,4096]:[2048,2048]} shadow-camera-left={-105} shadow-camera-right={105} shadow-camera-top={105} shadow-camera-bottom={-105} shadow-camera-far={700} shadow-normalBias={.04} shadow-bias={-.00005}/>
    {night&&selectedVenue==='1573'&&shot.view==='seat'&&<><pointLight position={[lightTarget.position.x-18,18,lightTarget.position.z]} intensity={shot.destination&&shot.destination!=='1573'?560:1600} distance={85} decay={2} color="#e7f2ff"/><pointLight position={[lightTarget.position.x+18,18,lightTarget.position.z]} intensity={shot.destination&&shot.destination!=='1573'?560:1600} distance={85} decay={2} color="#fff0d6"/><pointLight position={[lightTarget.position.x,17,lightTarget.position.z-22]} intensity={shot.destination&&shot.destination!=='1573'?385:1100} distance={65} decay={2}/><pointLight position={[lightTarget.position.x,17,lightTarget.position.z+22]} intensity={shot.destination&&shot.destination!=='1573'?385:1100} distance={65} decay={2}/></>}
    {featured&&inBowl&&(rain||night||closedStudyRoof)&&<spotLight target={lightTarget} position={[featured.x+12,14,featured.z+8]} angle={1.06} penumbra={.56} color="#f4f5ec" intensity={1700} distance={75} decay={2} castShadow shadow-mapSize={[1024,1024]} shadow-normalBias={.025}/>}
    <World {...{track,selectedVenue,data,light,crowd,closedStudyRoof,onReady,onProgress,onFailure,sun,onShade,roofs,reducedMotion,onRoof}} panorama={!!shot.home||(!shot.destination&&(shot.view==='ao'||shot.view==='precinct'))||chapter!==null} crowdMoving={!reducedMotion&&(chapter===null||playing)} compareStands={compareStands&&selectedVenue==='1573'} context={showPrecinct}/>
    {(dusk||floodPower>0||rain||closedStudyRoof)&&<CourtFloodlights dusk={dusk} data={data} night={floodPower} covered={!!dusk||rain||closedStudyRoof} venue={selectedVenue} surroundings={showPrecinct}/>}
    <primitive object={lightTarget}/>
    {(take||(ready&&venueVisible('kia',selectedVenue,showPrecinct)))&&<PrecinctAssets visible={venueVisible('kia',selectedVenue,showPrecinct)} onSettled={setKiaSettled}/>}
    {ready&&take&&kiaSettled&&<Suspense fallback={null}><PrepareFilm onPrepared={onFilmPrepared}/></Suspense>}
    {ready&&<Suspense fallback={null}><CourtStaff courts={courts} venue={take?'all':selectedVenue} surroundings={!!take||showPrecinct}/></Suspense>}
    {ready&&showPrecinct&&crowd&&<Visitors data={data} visible/>}
    {rain&&<Rain ink={ink} roofs={roofs} filmTime={track?.seconds}/>}
    {markers&&shot.view==='ao'&&destinations.filter(d=>venueVisible(d.id,selectedVenue,context)).map(d=><Html key={d.id} position={[d.target[0],38,d.target[2]]} center zIndexRange={[10,0]}><button className={styles.venuePin} title={tr(d.name)} aria-label={tr(d.name)} onClick={()=>onSelect(d.id)}>{d.id==='mca'?'MCA':d.id==='rla'?'RLA':d.id==='1573'?'1573':tr(d.name)}</button></Html>)}
    {ready&&(take||venueVisible('1573',selectedVenue,showPrecinct))&&<Suspense fallback={null}><TennisRally active={rally} time={time} court="1573"/></Suspense>}
    {ready&&!take&&away&&<group position={[away.x,away.y,away.z]} rotation={[0,away.rotation,0]}><Suspense fallback={null}><TennisRally active={rally} time={time} phase={away.phase} court={away.key}/></Suspense></group>}
    {ready&&(take||!inBowl)&&<Suspense fallback={null}><PrecinctRallies data={data} time={time} surroundings={context} selectedVenue={take?'all':selectedVenue} excludeCourt={take?undefined:away?.id}/></Suspense>}
    {markers&&shot.view!=='ao'&&points.filter(p=>context||selectedVenue==='all'||(p.id==='precinct'?selectedVenue==='mca':selectedVenue==='1573')).map((p,i)=><Html key={p.id} position={p.position} center zIndexRange={[10,0]}><button className={styles.pin} title={tr(p.title)} aria-label={`${tr('探索')}${tr(p.title)}`} onClick={()=>onSelect(p.id)}><span>{String(i+1).padStart(2,'0')}</span><b>{tr(p.title)}</b></button></Html>)}
    <Rig context={showPrecinct} {...{areas,selectedVenue,onFocus,shot,rotate,rain,language,onInteract,canvasRef,compassRef,featured,chapter,playing,onCut,filmTime}}/>
  </>;
}

type ArenaSceneProps = Parameters<typeof Scene>[0] & {onFailure:()=>void;reducedMotion:boolean};

export default function ArenaScene({onFailure,reducedMotion,...props}:ArenaSceneProps){
  const connect=useCallback((node:HTMLCanvasElement|null)=>{
    if(!node)return;
    if(!node.getContext('webgl2',{alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'})){onFailure();return;}
    node.addEventListener('webglcontextlost',onFailure);
    return ()=>node.removeEventListener('webglcontextlost',onFailure);
  },[onFailure]);
  const animated=props.chapter!==null?props.playing:props.rally||props.rotate||(!reducedMotion&&(props.light==='rain'||props.crowd));
  return <Canvas ref={connect} frameloop={animated?'always':'demand'} shadows camera={{position:cameras.hero.position,fov:43,near:.1,far:4000}} dpr={[1,1.5]}
    gl={{antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'}}
    onCreated={({gl})=>{gl.toneMapping=T.ACESFilmicToneMapping;gl.toneMappingExposure=1.03;}}>
    <Scene {...props} onFailure={onFailure} reducedMotion={reducedMotion}/>
  </Canvas>;
}
