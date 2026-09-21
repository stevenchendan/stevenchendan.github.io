'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as T from 'three';
import { Component, type ComponentRef, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildArena, buildContext, type ContextData, disposeModel } from './model';
import styles from './arena.module.css';
import { getTranslator, type Language } from './i18n';
import { InkLandscape, InkWash } from './InkWash';
import SunControls from './SunControls';
import TennisRally from './TennisRally';
import PrecinctRallies from './PrecinctRallies';
import PrecinctAssets from './PrecinctAssets';
import Rain from './Rain';
import Visitors from './Visitors';
import { venueVisible } from './venueVisibility';
import { SEATING_LIFT } from './dimensions';
import { summerSun, type ShadeResult, type SolarDate, type Stand, standSamples, STANDS } from './solar';

type View = 'hero' | 'plan' | 'seat' | 'court' | 'precinct' | 'ao';
type Light = 'day' | 'golden' | 'night' | 'rain' | 'solar';
type Theme = 'classic' | 'ink';
type Shot = {view:View;serial:number;stand?:Stand;destination?:string};
const destinations = [
  {id:'1573',name:'1573 Arena',target:[0,0,0],offset:[-68,82,98]},
  {id:'mca',name:'Margaret Court Arena',target:[76,5,34],offset:[-95,170,160]},
  {id:'rla',name:'Rod Laver Arena',target:[154,4,72],offset:[-85,205,120]},
  {id:'kia',name:'Kia Arena',target:[345,0,79],offset:[-60,110,110]},
  {id:'centrepiece',name:'Centrepiece Melbourne',target:[278,6,-12],offset:[-95,140,125]},
  {id:'ntc',name:'National Tennis Centre',target:[642,7,161],offset:[-65,145,140]},
  {id:'john',name:'John Cain Arena',target:[463,4,165],offset:[-85,235,135]},
  {id:'west',name:'西侧球场',target:[0,0,-155],offset:[-80,255,165]},
  {id:'east',name:'东侧球场',target:[738,0,220],offset:[0,255,210]},
  {id:'oval',name:'Grand Slam Oval',target:[300,0,188],offset:[-80,185,150]},
] satisfies {id:string;name:string;target:[number,number,number];offset:[number,number,number]}[];
type Sun = ReturnType<typeof summerSun> | null;
const standCameras:Record<Stand,[number,number,number]>={north:[4,5.4+SEATING_LIFT,-25.5],east:[16.2,5.4+SEATING_LIFT,9],south:[-4,5.4+SEATING_LIFT,25.5],west:[-16.2,5.4+SEATING_LIFT,9]};
const views: {id:View;label:string;en:string;icon:string}[] = [
  {id:'hero',label:'场馆全景',en:'ORBIT',icon:'◈'},
  {id:'plan',label:'垂直俯瞰',en:'PLAN',icon:'⊞'},
  {id:'seat',label:'看台视角',en:'SEAT',icon:'▤'},
  {id:'court',label:'走进球场',en:'COURT',icon:'⌖'},
  {id:'precinct',label:'周边区域',en:'PRECINCT',icon:'⌘'},
  {id:'ao',label:'澳网全景',en:'AO GROUNDS',icon:'◎'},
];
const cameras: Record<View,{position:[number,number,number];target:[number,number,number]}> = {
  hero:{position:[-57,58,73],target:[4,1,-1]},
  plan:{position:[0,105,.01],target:[0,0,0]},
  seat:{position:[-16.2,5.4+SEATING_LIFT,9],target:[0,1,0]},
  court:{position:[-2,1.75,16.6],target:[0,1,-6]},
  precinct:{position:[-170,230,255],target:[12,0,-28]},
  ao:{position:[-210,780,990],target:[290,0,30]},
};
const points = [
  {id:'court',title:'蓝色中心球场',en:'THE PLAYING SURFACE',position:[0,.3,0] as [number,number,number],view:'court' as View,description:'23.77 × 10.97 米标准双打场地。单打边线、发球区、中心标记，以及中部下垂的球网，均以米为单位建模。'},
  {id:'seat',title:'环抱式看台',en:'A SEAT IN THE ARENA',position:[-16,5+SEATING_LIFT,9] as [number,number,number],view:'seat' as View,description:'十二排逐级抬升的独立座椅，沿圆角矩形环绕球场。靠背、径向通道、扶手和后排遮阳棚均为实体几何；排数与细节为视觉近似。'},
  {id:'precinct',title:'Margaret Court Arena',en:'THE COPPER NEIGHBOUR',position:[59,19,20] as [number,number,number],view:'precinct' as View,description:'东侧紧邻的铜色屋顶是这片区域的视觉地标。周边建筑底图来自墨尔本开放数据，屋顶折线为参考卫星图的示意细化。'},
];

class SceneBoundary extends Component<{children:ReactNode;language:Language},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){const tr=getTranslator(this.props.language);return this.state.failed?<div className={styles.error}><h2>{tr('3D 场景暂时无法启动')}</h2><p>{tr('请开启浏览器硬件加速，或使用支持 WebGL 2 的浏览器。')}</p><button onClick={()=>window.location.reload()}>{tr('重新加载')}</button></div>:this.props.children;}
}

function World({data,light,context,crowd,onReady,sun,onShade,selectedVenue}:{selectedVenue:string;data:ContextData;light:Light;context:boolean;crowd:boolean;onReady:(seats:number)=>void;sun:Sun;onShade:(result:ShadeResult|null)=>void}) {
  const root=useRef<T.Group>(null);
  const models=useRef<{arena:ReturnType<typeof buildArena>;context:T.Group}|null>(null);
  useEffect(()=>{
    const arena=buildArena(), surroundings=buildContext(data), parent=root.current!;
    models.current={arena,context:surroundings};parent.add(arena.group,surroundings);onReady(arena.seats);
    return ()=>{parent.remove(arena.group,surroundings);disposeModel(arena.group);disposeModel(surroundings);models.current=null;};
  },[data,onReady]);
  useEffect(()=>{
    if(!models.current)return;
    models.current.context.children.forEach(child=>{child.visible=venueVisible(child.userData.venue,selectedVenue,context);});
    models.current.arena.group.visible=venueVisible('1573',selectedVenue,context);
    models.current.arena.crowd.visible=crowd;
    models.current.context.traverse(child=>{if(child.name==='precinct-spectators')child.visible=crowd;});
    models.current.arena.lamps.traverse(o=>{if(o instanceof T.Mesh)(o.material as T.MeshStandardMaterial).emissiveIntensity=light==='night'||(sun&&!sun.aboveHorizon)?5:light==='golden'?1:.08;});
  },[light,context,crowd,data,sun,selectedVenue]);
  useEffect(()=>{
    if(!sun||!sun.aboveHorizon||!models.current){onShade(null);return;}
    // Structural geometry only. Tiny seat/crowd
    // details are excluded from the coarse head-height shade comparison.
    const current=models.current;
    const frame=requestAnimationFrame(()=>{
      const blockers:T.Object3D[]=[];
      root.current?.updateWorldMatrix(true,true);
      [current.arena.group,...(context?[current.context]:[])].forEach(group=>group.traverse(obj=>{
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
  },[sun,context,data,onShade]);
  return <group ref={root}/>;
}

function Rig({shot,rotate,onInteract,canvasRef}:{shot:Shot;rotate:boolean;onInteract:()=>void;canvasRef:React.RefObject<HTMLCanvasElement|null>}) {
  const {camera,gl,invalidate,size}=useThree();
  const controls=useRef<ComponentRef<typeof OrbitControls>>(null);
  const [transitioning,setTransitioning]=useState(true);
  useEffect(()=>{setTransitioning(true);invalidate();},[shot,invalidate,size.width,size.height]);
  useEffect(()=>{canvasRef.current=gl.domElement;return()=>{canvasRef.current=null;};},[gl,canvasRef]);
  useFrame((_,delta)=>{
    // Keep metre-scale floor layers distinguishable while zooming kilometres out.
    // A fixed 0.1 m near plane wasted almost all depth precision at distant courts.
    if(camera instanceof T.PerspectiveCamera&&controls.current){
      const near=Math.max(.1,Math.min(12,camera.position.distanceTo(controls.current.target)*.01));
      if(Math.abs(camera.near-near)>.01){camera.near=near;camera.updateProjectionMatrix();}
    }
    if(!controls.current||!transitioning)return;
    const destination=destinations.find(d=>d.id===shot.destination);
    const preset=destination?{position:destination.target.map((v,i)=>v+destination.offset[i]) as [number,number,number],target:destination.target}:shot.stand?{position:standCameras[shot.stand],target:[0,1,0] as [number,number,number]}:cameras[shot.view], p=new T.Vector3(...preset.position), t=new T.Vector3(...preset.target);
    if(size.width<760&&['hero','plan','precinct','ao'].includes(shot.view))p.sub(t).multiplyScalar(1.65).add(t);
    const a=1-Math.exp(-Math.min(delta,.05)*4.5);
    camera.position.lerp(p,a);controls.current.target.lerp(t,a);controls.current.update();
    if(camera.position.distanceTo(p)<.025&&controls.current.target.distanceTo(t)<.025){camera.position.copy(p);controls.current.target.copy(t);setTransitioning(false);}
  });
  // A preset owns the camera until it settles; orbit must not keep nudging its
  // position away from the completion threshold. Disable residual damping too.
  return <OrbitControls ref={controls} makeDefault enableDamping={!transitioning} dampingFactor={.075} minDistance={1.5} maxDistance={2200} maxPolarAngle={Math.PI*.488} autoRotate={rotate&&!transitioning} autoRotateSpeed={.45} zoomSpeed={.7} target={[4,1,-1]} onStart={()=>{setTransitioning(false);onInteract();}}/>;
}

function Scene({data,shot,light,rotate,context,crowd,markers,rally,onSelect,onReady,onInteract,canvasRef,language,theme,sun,onShade}:{data:ContextData;shot:Shot;light:Light;rotate:boolean;context:boolean;crowd:boolean;markers:boolean;rally:boolean;onSelect:(id:string)=>void;onReady:(seats:number)=>void;onInteract:()=>void;canvasRef:React.RefObject<HTMLCanvasElement|null>;language:Language;theme:Theme;sun:Sun;onShade:(result:ShadeResult|null)=>void}){
  const tr=getTranslator(language);
  const night=light==='night'||!!sun&&!sun.aboveHorizon,golden=light==='golden'||!!sun&&sun.aboveHorizon&&sun.elevation<15;
  const selectedVenue=shot.destination??(shot.view==='ao'?'all':shot.view==='precinct'?'mca':'1573');
  const focus=destinations.find(d=>d.id===shot.destination)?.target;
  const lightTarget=useMemo(()=>{
    const target=new T.Object3D();if(!sun&&focus)target.position.set(focus[0],0,focus[2]);return target;
  },[sun,focus]);
  const sunPosition:[number,number,number]=sun?sun.direction.map(v=>v*300) as [number,number,number]:[lightTarget.position.x+(golden?-65:-40),golden?24:80,lightTarget.position.z+(golden?38:-30)];
  const ink=theme==='ink', rain=light==='rain';
  const bg=rain?(ink?'#dde3df':'#aebcc3'):ink?'#f3f0e6':night?'#172b38':golden?'#d6c5ab':'#cbdde9';
  return <>
    <color attach="background" args={[bg]}/><fog attach="fog" args={[bg,shot.view==='ao'?(rain?1000:1400):rain?180:ink?250:320,shot.view==='ao'?(rain?2600:3200):rain?680:ink?650:750]}/>
    {ink&&<><InkLandscape/><InkWash/></>}
    <hemisphereLight args={[night?'#8299c3':'#e4eff8',night?'#26362e':rain?'#81959b':'#b1a788',night?.65:rain?1.35:sun?1.0:golden?.85:1.05]}/>
    <directionalLight target={lightTarget} key={sun?'solar':'mood'} position={sunPosition} color={rain?'#c5dcf2':golden?'#ffcb8d':'#f4f8ff'} intensity={rain?.4:sun?(sun.aboveHorizon?Math.max(.3,Math.sin(sun.elevation*Math.PI/180)*3.3):0):night?.1:golden?3.3:2.3} castShadow={!rain} shadow-mapSize={sun?[4096,4096]:[2048,2048]} shadow-camera-left={-105} shadow-camera-right={105} shadow-camera-top={105} shadow-camera-bottom={-105} shadow-camera-far={700} shadow-normalBias={.04} shadow-bias={-.00005}/>
    {night&&<><pointLight position={[lightTarget.position.x-18,18,lightTarget.position.z]} intensity={shot.destination&&shot.destination!=='1573'?560:1600} distance={85} decay={2} color="#e7f2ff"/><pointLight position={[lightTarget.position.x+18,18,lightTarget.position.z]} intensity={shot.destination&&shot.destination!=='1573'?560:1600} distance={85} decay={2} color="#fff0d6"/><pointLight position={[lightTarget.position.x,17,lightTarget.position.z-22]} intensity={shot.destination&&shot.destination!=='1573'?385:1100} distance={65} decay={2}/><pointLight position={[lightTarget.position.x,17,lightTarget.position.z+22]} intensity={shot.destination&&shot.destination!=='1573'?385:1100} distance={65} decay={2}/></>}
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-3.2,0]} receiveShadow><planeGeometry args={[3000,3000]}/><meshStandardMaterial color={bg} roughness={1}/></mesh>
    <World selectedVenue={selectedVenue} data={data} light={light} context={context} crowd={crowd} onReady={onReady} sun={sun} onShade={onShade}/>
    <primitive object={lightTarget}/>
    <PrecinctAssets visible={venueVisible('kia',selectedVenue,context)}/>
    <Visitors data={data} visible={context&&crowd}/>
    {rain&&<Rain ink={ink}/>}
    {markers&&shot.view==='ao'&&destinations.filter(d=>venueVisible(d.id,selectedVenue,context)).map(d=><Html key={d.id} position={[d.target[0],38,d.target[2]]} center zIndexRange={[10,0]}><button className={styles.venuePin} title={tr(d.name)} aria-label={tr(d.name)} onClick={()=>onSelect(d.id)}>{d.id==='mca'?'MCA':d.id==='rla'?'RLA':d.id==='1573'?'1573':tr(d.name)}</button></Html>)}
    <group visible={venueVisible('1573',selectedVenue,context)}><Suspense fallback={null}><TennisRally active={rally}/></Suspense></group>
    <PrecinctRallies data={data} active={rally} visible={true} surroundings={context} selectedVenue={selectedVenue}/>
    {markers&&points.filter(p=>context||selectedVenue==='all'||(p.id==='precinct'?selectedVenue==='mca':selectedVenue==='1573')).map((p,i)=><Html key={p.id} position={p.position} center zIndexRange={[10,0]}><button className={styles.pin} title={tr(p.title)} aria-label={`${tr('探索')}${tr(p.title)}`} onClick={()=>onSelect(p.id)}><span>{String(i+1).padStart(2,'0')}</span><b>{tr(p.title)}</b></button></Html>)}
    <Rig shot={shot} rotate={rotate} onInteract={onInteract} canvasRef={canvasRef}/>
  </>;
}

export default function ArenaExperience(){
  const [theme,setTheme]=useState<Theme>('classic');
  useEffect(()=>{try{const saved=localStorage.getItem('1573-arena-theme');if(saved==='classic'||saved==='ink')setTheme(saved);}catch{/* Optional persistence. */}},[]);
  function changeTheme(next:Theme){setTheme(next);try{localStorage.setItem('1573-arena-theme',next);}catch{/* The switch still works without storage. */}}
  const [language,setLanguage]=useState<Language>('en');
  const tr=getTranslator(language);
  useEffect(()=>{
    try {const saved=localStorage.getItem('1573-arena-language');if(saved==='en'||saved==='zh')setLanguage(saved);} catch {/* Storage may be disabled; switching still works. */}
  },[]);
  useEffect(()=>{
    const previous=document.documentElement.lang;
    document.documentElement.lang=language==='zh'?'zh-CN':'en';
    return()=>{document.documentElement.lang=previous;};
  },[language]);
  function changeLanguage(next:Language){
    setLanguage(next);
    try {localStorage.setItem('1573-arena-language',next);} catch {/* Keep the preference in memory when storage is unavailable. */}
  }
  const [data,setData]=useState<ContextData|null>(null),[loadError,setLoadError]=useState(false),[ready,setReady]=useState(false),[seats,setSeats]=useState(0);
  const [shot,setShot]=useState<Shot>({view:'hero',serial:0}),[light,setLight]=useState<Light>('golden');
  const [solarDate,setSolarDate]=useState<SolarDate>({year:2027,month:1,day:15,minutes:14*60});
  const [shade,setShade]=useState<ShadeResult|null>(null);
  const sun=useMemo(()=>light==='solar'?summerSun(solarDate):null,[light,solarDate]);
  function changeSolarDate(date:SolarDate){setShade(null);setSolarDate(date);}
  function viewStand(stand:Stand){setShot(s=>({view:'seat',serial:s.serial+1,stand}));setRotate(false);setSelected(null);}
  const [cinema,setCinema]=useState(false);
  const cinemaAudio=useRef<HTMLAudioElement>(null);
  useEffect(()=>{if(!cinema)cinemaAudio.current?.pause();},[cinema]);
  useEffect(()=>{const audio=cinemaAudio.current;return()=>{audio?.pause();};},[]);
  function toggleCinema(){
    const audio=cinemaAudio.current;
    if(cinema){audio?.pause();setCinema(false);return;}
    setCinema(true);
    if(audio){
      audio.volume=.4;audio.currentTime=0;
      // Start inside the click gesture so browsers allow audible playback.
      void audio.play().catch(error=>{if(error.name!=='AbortError')setToast('影院音乐暂时无法播放，请退出后重试。');});
    }
  }
  const [rotate,setRotate]=useState(false),[context,setContext]=useState(true),[crowd,setCrowd]=useState(true),[markers,setMarkers]=useState(false),[rally,setRally]=useState(true);
  useEffect(()=>{if(rotate)setRally(true);},[rotate]);
  const [selected,setSelected]=useState<string|null>(null),[info,setInfo]=useState(false),[panel,setPanel]=useState(false),[toast,setToast]=useState('');
  const container=useRef<HTMLElement>(null),canvas=useRef<HTMLCanvasElement|null>(null);
  useEffect(()=>{
    const abort=new AbortController();fetch('/data/1573-context.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('Context unavailable');return r.json();}).then(setData).catch(e=>{if(e.name!=='AbortError')setLoadError(true);});
    return()=>abort.abort();
  },[]);
  const choose=useCallback((view:View)=>{setShot(s=>({view,serial:s.serial+1}));setRotate(false);},[]);
  const onReady=useCallback((count:number)=>{setReady(true);setSeats(count);},[]);
  const onInteract=useCallback(()=>setRotate(false),[]);
  const onSelect=useCallback((id:string)=>{const destination=destinations.find(d=>d.id===id);if(destination){setRotate(false);setSelected(null);setShot(s=>({view:'ao',serial:s.serial+1,destination:id}));return;}setSelected(id);setMarkers(false);const p=points.find(p=>p.id===id);if(p)choose(p.view);},[choose]);
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){setCinema(false);setSelected(null);setInfo(false);setPanel(false);return;}
      if(e.target instanceof HTMLElement&&['INPUT','BUTTON','SELECT','TEXTAREA','A'].includes(e.target.tagName))return;
      const index=Number(e.key)-1;if(index>=0&&index<views.length){choose(views[index].id);}
      if(e.key.toLowerCase()==='r')choose('hero');
      if(e.key.toLowerCase()==='h')setMarkers(v=>!v);
      if(e.code==='Space'){e.preventDefault();setRotate(v=>!v);}
    };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[choose]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3000);return()=>clearTimeout(timer);},[toast]);
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await container.current?.requestFullscreen();}catch{setToast('当前浏览器不支持全屏，请使用浏览器的全屏功能。');}}
  function capture(){if(!canvas.current||!ready)return;try{const a=document.createElement('a');a.download=`1573-arena-${light}.png`;a.href=canvas.current.toDataURL('image/png');a.click();setToast('已保存当前 3D 画面');}catch{setToast('画面暂时无法保存，请重试。');}}
  const detail=points.find(p=>p.id===selected);
  const activeVenue=destinations.find(d=>d.id===shot.destination);
  return <main lang={language==='zh'?'zh-CN':'en'} ref={container} className={`${styles.experience} ${cinema?styles.cinemaMode:''} ${theme==='ink'?styles.ink:light==='night'||(sun&&!sun.aboveHorizon)?styles.night:''}`}>
    <div className={styles.viewport} aria-label={tr("1573 Arena 可交互三维场景")}>
      {data&&<SceneBoundary language={language}><Suspense fallback={null}><Canvas shadows camera={{position:cameras.hero.position,fov:43,near:.1,far:4000}} dpr={[1,1.6]} gl={{antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'}} fallback={<div className={styles.error}>{tr("当前浏览器不支持 WebGL 2。请开启硬件加速后重试。")}</div>} onCreated={({gl})=>{gl.toneMapping=T.ACESFilmicToneMapping;gl.toneMappingExposure=1;}}><Scene {...{data,shot,light,rotate,context,crowd,markers,rally,onSelect,onReady,onInteract,language,theme,sun}} markers={markers&&!cinema} onShade={setShade} canvasRef={canvas}/></Canvas></Suspense></SceneBoundary>}
    </div>
    <audio ref={cinemaAudio} src="/audio/cinema-music.mp3" preload="none" loop/>
    <button className={styles.cinemaToggle} aria-pressed={cinema} title={cinema?tr("退出影院模式 · Esc"):tr("影院模式")} onClick={toggleCinema}><span aria-hidden="true">{cinema?"↙":"▣"}</span> {tr(cinema?"退出影院模式":"影院模式")}</button>
    <header className={styles.header}>
      <a href="/" className={styles.brand} aria-label={tr("返回 Tennis-Agent 首页")}><span className={styles.brandMark}>◉</span> COURT ATLAS<span className={styles.brandDivider}/><small>{tr("A TENNIS-AGENT EXPLORATION")}</small></a>
      <div className={styles.headerActions}><div className={styles.themeSwitch} role="group" aria-label={tr('视觉主题')}><button aria-pressed={theme==='classic'} onClick={()=>changeTheme('classic')}>{tr('原色')}</button><button aria-pressed={theme==='ink'} onClick={()=>changeTheme('ink')}>{tr('水墨')}</button></div><div className={styles.languageSwitch} role="group" aria-label={tr('页面语言')}><button lang="en" aria-pressed={language==='en'} onClick={()=>changeLanguage('en')}>English</button><button lang="zh-CN" aria-pressed={language==='zh'} onClick={()=>changeLanguage('zh')}>中文</button></div><span className={styles.live}><i/>  {tr("INTERACTIVE 3D")}</span><button onClick={()=>setInfo(v=>!v)} aria-expanded={info}>{tr("关于模型 ↗")}</button><button onClick={fullscreen} aria-label={tr("切换全屏")} title={tr("全屏")}>⛶</button></div>
    </header>
    <section className={styles.title}>
      <p className={styles.eyebrow}><span>{tr("AUSTRALIA")}</span><i/>  {tr("MELBOURNE PARK")}</p>
      {activeVenue&&activeVenue.id!=='1573'?<h1 className={styles.destinationTitle}>{tr(activeVenue.name)}</h1>:<h1>1573<span>Arena.</span></h1>}
      <p className={styles.subtitle}>{tr(theme==='ink'?'一方球场，一纸山水。':'离球场，更近一点。')}</p>
      {theme==='ink'&&<div className={styles.inkSeal} aria-label={tr('水墨')}>山<br/>水</div>}
      <div className={styles.coordinates}>{activeVenue&&activeVenue.id!=='1573'?'MELBOURNE PARK · AO26':'37°49′14.7″ S · 144°58′37.1″ E'}</div>
    </section>
    <section className={styles.precinctExplorer} aria-label={tr('探索澳网园区')}>
      <label htmlFor="ao-destination">{tr('探索澳网园区')}</label>
      <select id="ao-destination" value={shot.destination??(shot.view==='ao'?'all':'')} onChange={e=>e.target.value==='all'?choose('ao'):onSelect(e.target.value)}>
        <option value="" disabled>{tr('选择场馆')}</option>
        <option value="all">{tr('澳网全景')}</option>
        {destinations.map(d=><option key={d.id} value={d.id}>{tr(d.name)}</option>)}
      </select>
      <small>{tr('建筑为参考重建，非实测模型。')}</small>
      <a href="https://ausopen.com/digitalmap" target="_blank" rel="noreferrer">{tr('官方 AO26 地图 ↗')}</a>
    </section>
    <button className={styles.mobileSettings} aria-expanded={panel} onClick={()=>setPanel(v=>!v)}>{tr("场景设置")} {panel?'−':'+'}</button>
    <aside className={`${styles.settings} ${panel?styles.settingsOpen:''}`}>
      <div className={styles.panelHeading}><span>{tr("YOUR PERSPECTIVE")}</span><span>↗</span></div>
      <h2>{tr("此刻的球场")}</h2>
      <div className={styles.controlLabel}><span>{tr("光线氛围")}</span><small>{tr("LIGHT & TIME")}</small></div>
      <div className={styles.lights}>{(['day','golden','night','rain'] as Light[]).map((l,i)=><button key={l} aria-pressed={light===l} className={light===l?styles.activeLight:''} onClick={()=>setLight(l)}><span>{['☀','◒','☾','☂'][i]}</span>{[tr("日间"),tr("日落"),tr("夜场"),tr("雨天")][i]}</button>)}</div>
      {light==='rain'&&<p className={styles.weatherNote}>{tr('示意天气 · 非实时预报')}</p>}
      <button className={styles.solarMode} aria-pressed={light==='solar'} aria-expanded={light==='solar'} onClick={()=>{if(light==='solar')setLight('day');else{setContext(true);setLight('solar');}}}><span>◷</span>{tr('夏日日照')}<span>{light==='solar'?'−':'+'}</span></button>
      {light==='solar'&&<SunControls date={solarDate} onChange={changeSolarDate} language={language} shade={shade} onStand={viewStand}/>}
      <div className={styles.divider}/>
      {[{label:tr("周边建筑"),sub:tr("Precinct context"),value:context,set:setContext},{label:tr("显示标签"),sub:tr("球场与看台标签 · H"),value:markers,set:setMarkers},{label:tr("活动人群"),sub:tr("园区行人 · 看台观众"),value:crowd,set:setCrowd}].map(c=><label key={c.label} className={styles.toggleRow}><span>{c.label}<small>{c.sub}</small></span><input type="checkbox" checked={c.value} disabled={light==='solar'&&c.set===setContext} onChange={e=>c.set(e.target.checked)}/><i/></label>)}
      <div className={styles.divider}/>
      <button className={`${styles.orbitButton} ${rotate?styles.engaged:''}`} aria-pressed={rotate} onClick={()=>setRotate(v=>!v)}><span>{rotate?'Ⅱ':'▷'}</span>{rotate?tr("暂停环绕"):tr("自动环绕")}<small>{tr("SPACE")}</small></button>
      <button className={styles.rallyButton} aria-pressed={rally} onClick={()=>setRally(v=>!v)}>{rally?'●':'○'} {rally?tr("暂停球员回合"):tr("播放球员回合")} <span>↗</span></button>
    </aside>
    <div className={styles.north} title={tr("北向相对球场长轴约偏转 8°")}><span>N</span><svg width="34" height="42" viewBox="0 0 34 42" aria-hidden="true"><path d="M17 3 L29 34 L17 27 L5 34 Z" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M17 3 L17 27 L5 34 Z" fill="currentColor"/></svg><small>{tr("地理北向参考 · 8°")}</small></div>
    {(shot.view!=='ao'||shot.destination==='1573')&&<section className={styles.caption}><div className={styles.captionNumber}>01<span> / {tr('FIELD NOTES')}</span></div><h2>{tr("一座开放的网球剧场。")}</h2><p>{tr("蓝色硬地、层叠看台与铜色屋顶，")}<br/>{tr("在墨尔本公园的一隅相遇。")}</p><div className={styles.metrics}><div><b>{seats?seats.toLocaleString():'—'}</b><span>{tr("模型座椅")}</span></div><div><b>23.77<span> m</span></b><span>{tr("标准场地长度")}</span></div></div></section>}
    <nav className={styles.viewDock} aria-label={tr("相机视角")}><span className={styles.dockLabel}>{tr("EXPLORE")}</span><div>{views.map((v,i)=><button key={v.id} aria-pressed={shot.view===v.id} className={shot.view===v.id?styles.activeView:''} onClick={()=>{choose(v.id);setSelected(null);}} title={`${tr(v.label)} · ${tr('快捷键')} ${i+1}`}><span>{v.icon}</span><b>{tr(v.label)}</b><small>{v.en}</small></button>)}</div></nav>
    <div className={styles.utilities}><button onClick={()=>choose('hero')} title={tr("重置视角 · R")} aria-label={tr("重置视角")}>↺</button><button onClick={capture} disabled={!ready} title={tr("保存画面")} aria-label={tr("保存画面")}>⌑</button></div>
    <footer className={styles.footer}><span><i/> {ready?tr("场景已就绪"):tr("正在构建场景")}</span><span>{tr("拖动旋转")} <b>·</b>  {tr("滚轮缩放")} <b>·</b>  {tr("右键平移")} <b>·</b>  {tr("双指操作")}</span><span>{tr("VISUAL STUDY")} <b> / </b> 01</span></footer>
    {!ready&&!loadError&&<div className={styles.loading} role="status"><span className={styles.spinner}/><strong>{tr("正在构建你的场边视角")}</strong><small>{tr("球场 · 看台 · 墨尔本公园")}</small></div>}
    {loadError&&<div className={styles.error} role="alert"><h2>{tr("场景数据加载失败")}</h2><p>{tr("请检查连接后重试。")}</p><button onClick={()=>window.location.reload()}>{tr("重新加载")}</button></div>}
    {detail&&<section className={styles.detail} aria-live="polite"><button className={styles.close} onClick={()=>setSelected(null)} aria-label={tr("关闭热点详情")}>×</button><p className={styles.eyebrow}>{tr(detail.en)}</p><h2>{tr(detail.title)}</h2><p>{tr(detail.description)}</p><button className={styles.detailBack} onClick={()=>{setSelected(null);setMarkers(true);choose('hero');}}>{tr("返回场馆全景 ↗")}</button></section>}
    {info&&<section className={styles.about} aria-label={tr("关于模型")}><button className={styles.close} onClick={()=>setInfo(false)} aria-label={tr("关闭模型说明")}>×</button><p className={styles.eyebrow}>{tr("THE MAKING OF THIS PLACE")}</p><h2>{tr("真实位置，手工重建。")}</h2><p>{tr("1573 Arena 的标准球场与周边地理位置采用米制建模；圆角看台、座椅、遮阳棚、灯架和屋顶细节依据卫星图与公开场馆资料做视觉近似。不是测绘模型，也不代表最新的现场设施。")}</p><p>{tr("日落与夜场为艺术灯光预设，网球轨迹为演示动画。观众和街道家具是示意布置。")}</p><div className={styles.sourceLinks}><a href="https://www.google.com/maps/place/1573+Arena/@-37.8208432,144.9768967,113m/data=!3m1!1e3" target="_blank" rel="noreferrer">{tr("卫星图参考 · Google Maps ↗")}</a><a href="https://officiating.tennis.com.au/pdf/ImportantlocationsAO21.pdf" target="_blank" rel="noreferrer">{tr("场馆位置参考 · Tennis Australia ↗")}</a><a href="https://data.melbourne.vic.gov.au/explore/dataset/2020-building-footprints/information/" target="_blank" rel="noreferrer">{tr("建筑轮廓 · City of Melbourne · CC BY 4.0 ↗")}</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{tr("球场与道路 · © OpenStreetMap contributors · ODbL ↗")}</a><a href="/data/1573-context.json" download>{tr("下载衍生地理数据 · ODbL / CC BY 4.0 ↓")}</a></div><small>{tr("快捷键：1–6 切换视角 · R 重置 · H 热点 · 空格环绕")}</small></section>}
    {theme==='ink'&&<p className={styles.inkNote}>{tr('远山为艺术化背景，并非当地地貌。')}</p>}
    {toast&&<div className={styles.toast} role="status">{tr(toast)}</div>}
  </main>;
}




