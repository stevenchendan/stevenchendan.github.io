'use client';

import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ContextData } from './model';
import { getTranslator, type Language } from './i18n';
import { destinations, points, views, isRoofed, type Light, type Shot, type Theme, type View } from './views';
import SectionPicker from './SectionPicker';
import GroundsPlan from './GroundsPlan';
import Autographs from './Autographs';
import {seatSections,type SectionId,type SeatingVenue} from './seating';
import type {RoofStatus} from './roofs';
import {film} from './film';
import { summerSun, type ShadeResult, type SolarDate, type Stand } from './solar';
import SunControls, { standNames } from './SunControls';
import Icon from './Icon';
import styles from './arena.module.css';

const ArenaScene = lazy(() => import('./ArenaScene'));
const moods = [
  {id:'day',label:'日间'}, {id:'golden',label:'日落'}, {id:'night',label:'夜场'}, {id:'rain',label:'雨天'},
] as const;
const sources = [
  ['卫星图参考 · Google Maps ↗','https://www.google.com/maps/place/1573+Arena/@-37.8208432,144.9768967,113m/data=!3m1!1e3'],
  ['场馆位置参考 · Tennis Australia ↗','https://officiating.tennis.com.au/pdf/ImportantlocationsAO21.pdf'],
  ['建筑轮廓 · City of Melbourne · CC BY 4.0 ↗','https://data.melbourne.vic.gov.au/explore/dataset/2020-building-footprints/information/'],
  ['球场与道路 · © OpenStreetMap contributors · ODbL ↗','https://www.openstreetmap.org/copyright'],
  ['罗德·拉沃尔球场内景 · 澳网 ↗','https://ausopen.com/articles/news/concert-tennis-mode-transformation-rod-laver-arena'],
  ['球员练习照片参考 · 澳网 ↗','https://ausopen.com/articles/news/stars-prepare-ahead-ao-2026'],
  ['运动捕捉与球员模型署名 ↗','/models/tennis/motion-credits.txt'],
  ['封面照片 · Gracchus250 ↗','https://commons.wikimedia.org/wiki/File:Rod_Laver_Arena_Melbourne_Park_Australian_Open_2023_quarter_final_dusk.jpg'],
  ['照片授权 · CC BY-SA 4.0（已缩放、转码和裁切）↗','https://creativecommons.org/licenses/by-sa/4.0/'],
];
type Panel = 'settings' | 'venues' | 'about' | 'detail' | 'sections' | 'autographs';
const coverSource='https://commons.wikimedia.org/wiki/File:Rod_Laver_Arena_Melbourne_Park_Australian_Open_2023_quarter_final_dusk.jpg';
const roofNames:Record<RoofStatus,string>={open:'屋顶已打开',closing:'屋顶正在关闭',closed:'屋顶已关闭',opening:'屋顶正在打开'};

class SceneBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onFailure();}
  render(){return this.state.failed?null:this.props.children;}
}

function Drawer({title,closeLabel,onClose,children,wide}:{title:string;closeLabel:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const node=dialog.current;
    if(!node)return;
    node.showModal();
    return ()=>node.close();
  },[]);
  return <dialog ref={dialog} className={styles.drawer} data-wide={wide||undefined} aria-labelledby="atlas-panel-title"
    onCancel={onClose} onClick={event=>{if(event.target===dialog.current)onClose();}}>
    <div className={styles.drawerBody}>
      <div className={styles.drawerHeading}><h2 id="atlas-panel-title">{title}</h2><button autoFocus aria-label={closeLabel} onClick={onClose}><Icon name="close"/></button></div>
      {children}
    </div>
  </dialog>;
}

export default function ArenaExperience(){
  const [theme,setTheme]=useState<Theme>('classic');
  const [language,setLanguage]=useState<Language>('en');
  const [data,setData]=useState<ContextData|null>(null);
  const [interactive,setInteractive]=useState(false);
  const [failure,setFailure]=useState<'data'|'render'|null>(null);
  const [ready,setReady]=useState(false);
  const [seats,setSeats]=useState(0);
  const [shot,setShot]=useState<Shot>({view:'hero',serial:0});
  const [light,setLight]=useState<Light>('day');
  const [solarDate,setSolarDate]=useState<SolarDate>({year:2027,month:1,day:15,minutes:14*60});
  const [shade,setShade]=useState<ShadeResult|null>(null);
  const [rotate,setRotate]=useState(false),[context,setContext]=useState(true),[crowd,setCrowd]=useState(true);
  const [markers,setMarkers]=useState(false),[rally,setRally]=useState(true);
  const [reducedMotion,setReducedMotion]=useState(true);
  const [panel,setPanel]=useState<Panel|null>(null),[selected,setSelected]=useState<string|null>(null);
  const [cinema,setCinema]=useState(false),[toast,setToast]=useState('');
  const [cover,setCover]=useState(true);
  const [chapter,setChapter]=useState(0),[playing,setPlaying]=useState(false);
  const [roof,setRoof]=useState<RoofStatus>('open');
  const [seatVenue,setSeatVenue]=useState<SeatingVenue>('rla'),[section,setSection]=useState<SectionId|null>(null);
  const currentShot=useRef(shot);
  currentShot.current=shot;
  const container=useRef<HTMLElement>(null),canvas=useRef<HTMLCanvasElement|null>(null);
  const audio=useRef<HTMLAudioElement>(null),compassRef=useRef<HTMLElement>(null);
  const tr=getTranslator(language);
  const sun=useMemo(()=>light==='solar'?summerSun(solarDate):null,[light,solarDate]);

  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    setInteractive(true);
    const arena=query.get('arena')??undefined,sectionId=query.get('section');
    if(isRoofed(arena)){
      const choice=seatSections[arena].find(s=>String(s.id)===sectionId);
      setSeatVenue(arena);setSection(choice?.id??null);setCover(false);
      setShot(choice?{view:'seat',serial:1,destination:arena,section:choice.id}:query.get('view')==='player'?{view:'court',destination:arena,follow:true,serial:1}:{view:'ao',destination:arena,serial:1});
    }else if(query.get('view')==='player'){
      setShot({view:'court',follow:true,serial:1});setCover(false);
    }else if(arena&&destinations.some(d=>d.id===arena)){
      setShot({view:arena==='1573'?'hero':'ao',destination:arena,serial:1});setCover(false);
    }
    try{
      const savedTheme=localStorage.getItem('1573-arena-theme'), savedLanguage=localStorage.getItem('1573-arena-language');
      if(savedTheme==='ink')setTheme(savedTheme);
      if(savedLanguage==='zh')setLanguage(savedLanguage);
    }catch{/* Preferences still work for this visit. */}
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    function updateMotion(){
      setReducedMotion(motion.matches);
      if(motion.matches){setRally(false);setRotate(false);setPlaying(false);}
    }
    updateMotion();motion.addEventListener('change',updateMotion);
    const abort=new AbortController();
    fetch('/data/1573-context.json',{signal:abort.signal}).then(response=>{
      if(!response.ok)throw new Error('Context unavailable');
      return response.json();
    }).then(setData).catch(error=>{if(error.name!=='AbortError')setFailure('data');});
    return ()=>{abort.abort();motion.removeEventListener('change',updateMotion);};
  },[]);
  useEffect(()=>{
    const previous=document.documentElement.lang;
    document.documentElement.lang=language==='zh'?'zh-CN':'en';
    return ()=>{document.documentElement.lang=previous;};
  },[language]);
  function savePreference(key:string,value:string){
    try{localStorage.setItem('1573-arena-'+key,value);}catch{/* Storage is optional. */}
  }
  const navigate=useCallback((next:Omit<Shot,'serial'>)=>{
    const url=new URL(window.location.href);
    for(const key of ['arena','section','view'])url.searchParams.delete(key);
    if(next.destination)url.searchParams.set('arena',next.destination);
    if(next.section!==undefined)url.searchParams.set('section',String(next.section));
    if(next.follow)url.searchParams.set('view','player');
    history.replaceState(history.state,'',url);
    setCover(false);
    setShot(previous=>({...next,serial:previous.serial+1}));
    setRotate(false);setPanel(null);setSelected(null);
  },[]);
  const openSeats=useCallback(()=>{
    if(isRoofed(shot.destination)&&shot.destination!==seatVenue){setSeatVenue(shot.destination);setSection(null);}
    setPanel('sections');
  },[shot.destination,seatVenue]);
  const selectView=useCallback((view:View)=>{
    if(view==='seat'&&isRoofed(shot.destination)){openSeats();return;}
    navigate({view});
  },[shot.destination,openSeats,navigate]);
  const onSelect=useCallback((id:string)=>{
    if(destinations.some(venue=>venue.id===id)){
      navigate(id==='1573'?{view:'hero'}:{view:'ao',destination:id});
      return;
    }
    const point=points.find(p=>p.id===id);
    if(point){navigate({view:point.view});setSelected(id);setMarkers(false);setPanel('detail');}
  },[navigate]);
  const onReady=useCallback((count:number)=>{setSeats(count);setReady(true);},[]);
  const onFailure=useCallback(()=>{
    const previous=currentShot.current;
    setFailure('render');setReady(false);setCinema(false);setPlaying(false);
    if(isRoofed(previous.destination)){
      setSeatVenue(previous.destination);setSection(previous.section??null);setPanel('sections');
    }else setPanel(null);
    setShot({view:previous.view,serial:previous.serial+1});
  },[]);
  const onInteract=useCallback(()=>setRotate(false),[]);
  const toggleOrbit=()=>setRotate(value=>!value);
  useEffect(()=>{if(rotate)setRally(true);},[rotate]);
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||event.ctrlKey||event.altKey||event.metaKey||event.isComposing||panel)return;
      if(event.key==='Escape'){setCinema(false);setPlaying(false);return;}
      if(cinema)return;
      if(event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input,select,textarea')))return;
      if(/^[1-6]$/.test(event.key))selectView(views[Number(event.key)-1].id);
      if(event.key.toLowerCase()==='r')navigate({view:'hero'});
      if(!ready)return;
      if(event.key.toLowerCase()==='h')setMarkers(value=>!value);
      if(event.code==='Space' && !(event.target instanceof HTMLElement && event.target.closest('button,a'))){
        event.preventDefault();setRotate(value=>!value);
      }
    };
    window.addEventListener('keydown',handler);return ()=>window.removeEventListener('keydown',handler);
  },[navigate,selectView,panel,ready,cinema]);
  useEffect(()=>{
    if(!cinema||!playing)audio.current?.pause();
  },[cinema,playing]);
  useEffect(()=>{const player=audio.current;return ()=>player?.pause();},[]);
  useEffect(()=>{if(toast){const timer=setTimeout(()=>setToast(''),3500);return ()=>clearTimeout(timer);}},[toast]);
  function soundtrack(){
    if(!audio.current)return;
    audio.current.volume=.4;
    void audio.current.play().catch(error=>{if(error.name!=='AbortError')setToast('影院音乐暂时无法播放，请退出后重试。');});
  }
  function toggleCinema(){
    if(cinema){setPlaying(false);setCinema(false);return;}
    setCover(false);setCinema(true);setChapter(0);setPlaying(!reducedMotion);setRotate(false);
    if(audio.current)audio.current.currentTime=0;
    if(!reducedMotion)soundtrack();
  }
  const onCut=useCallback(()=>{if(chapter<film.length-1)setChapter(chapter+1);else {setPlaying(false);setCinema(false);}},[chapter]);
  function togglePlayback(){if(!playing)soundtrack();setPlaying(!playing);}
  async function fullscreen(){
    try{if(document.fullscreenElement)await document.exitFullscreen();else await container.current?.requestFullscreen();}
    catch{setToast('当前浏览器不支持全屏，请使用浏览器的全屏功能。');}
  }
  function capture(){
    if(!ready||!canvas.current)return;
    try{
      const a=document.createElement('a');a.download=`court-atlas-${shot.destination??shot.view}-${light}.png`;
      a.href=canvas.current.toDataURL('image/png');a.click();setToast('已保存当前 3D 画面');
    }catch{setToast('画面暂时无法保存，请重试。');}
  }
  function viewStand(stand:Stand){navigate({view:'seat',stand});}
  function setSolar(){
    if(light==='solar')setLight('day');
    else {setContext(true);setLight('solar');}
  }
  const venue=destinations.find(d=>d.id===shot.destination);
  const wide=!!venue||shot.view==='ao'||shot.view==='precinct';
  const title=venue?tr(venue.name):wide?tr('墨尔本公园'):'1573 Arena';
  const detail=points.find(point=>point.id===selected);
  const activeView=views.find(view=>view.id===shot.view)!;
  const currentSeat=shot.view==='seat'?tr(standNames[shot.stand??'west']):null;
  const caption=shot.follow?tr('球员特写'):shot.section!==undefined?(language==='en'?`Section ${shot.section} · Approximate view`:`${shot.section} 区 · 模拟视角`):venue?tr('场馆建筑模型'):shot.view==='ao'?tr('澳网全景'):shot.view==='precinct'?tr('西区场馆与练习场'):currentSeat??(shot.view==='court'?tr('底线视角'):tr('室外硬地球场'));
  const close=()=>setPanel(null);
  const heading=panel==='autographs'?tr('签名攻略'):panel==='sections'?tr('座区指南'):panel==='settings'?tr('场景设置'):panel==='venues'?tr('选择场馆'):panel==='detail'&&detail?tr(detail.title):tr('关于模型');
  const staticView=shot.view;

  return <main ref={container} className={styles.experience} data-interactive={interactive} data-cover={cover||undefined} data-cinema={cinema||undefined} data-roof={roof} lang={language==='zh'?'zh-CN':'en'}>
    <header className={styles.header}>
      <a href="/" className={styles.brand} aria-label={tr('返回作品集')}><Icon name="ball"/><span>Court Atlas</span></a>
      <span className={styles.eventName}>{tr('澳大利亚网球公开赛')}</span>
      <nav className={styles.topActions} inert={!interactive} aria-label={tr('场馆工具')}>
        <button aria-haspopup="dialog" onClick={openSeats} aria-label={tr('座区指南')}><Icon name="seat"/><span>{tr('座区指南')}</span></button>
        <button disabled={!!failure} aria-haspopup="dialog" onClick={()=>setPanel('venues')} aria-label={tr('场馆列表')}><Icon name="venues"/><span>{tr('场馆列表')}</span></button>
        <button aria-haspopup="dialog" onClick={()=>setPanel(cover?'about':'settings')} aria-label={tr(cover?'关于模型':'场景设置')}><Icon name={cover?'info':'settings'}/><span>{tr(cover?'关于模型':'场景设置')}</span></button>
        <button className={styles.language} lang={language==='en'?'zh-CN':'en'} aria-label={language==='en'?'切换到中文':'Switch to English'} onClick={()=>{const next=language==='en'?'zh':'en';setLanguage(next);savePreference('language',next);}}>{language==='en'?'中文':'EN'}</button>
      </nav>
    </header>
    <section className={styles.stage} aria-label={tr('墨尔本公园场馆探索')}>
      {cover&&<div className={styles.cover}>
        <img className={styles.coverPhoto} src="/images/court-atlas/rod-laver-dusk.webp" srcSet="/images/court-atlas/rod-laver-dusk-small.webp 900w, /images/court-atlas/rod-laver-dusk.webp 2048w" sizes="100vw" alt={tr('2023 年澳网，罗德·拉沃尔球场暮色中的四分之一决赛')} fetchPriority="high"/>
        <div className={styles.coverCopy} inert={!interactive}>
          <p className={styles.coverLocation}><span/>{tr('澳大利亚网球公开赛')}</p>
          <h1>{language==='en'?<>Inside<br/><em>Melbourne Park.</em></>:<>走进<br/><em>墨尔本公园。</em></>}</h1>
          <div className={styles.coverLinks}>
            <button onClick={()=>navigate({view:'hero'})}>{tr('探索球场')}<Icon name="next"/></button>
            <button disabled={!!failure} onClick={toggleCinema}><Icon name="play"/>{tr('播放场馆短片')}</button>
          </div>
          <div className={styles.fanLinks}><button className={styles.coverGuide} onClick={openSeats}>{tr('查找座区')} ↗</button><button className={styles.coverGuide} onClick={()=>setPanel('autographs')}>{tr('签名攻略')} ↗</button></div>
        </div>
        <a className={styles.coverCredit} href={coverSource} target="_blank" rel="noreferrer">Rod Laver Arena · 2023 <span>© Gracchus250 ↗</span></a>
      </div>}
      {!cover&&!cinema&&ready&&light==='rain'&&!isRoofed(venue?.id)&&<button className={styles.weatherLink} onClick={()=>navigate({view:'ao',destination:'mca'})}><Icon name="rain"/>{tr('查看玛格丽特球场屋顶')}<Icon name="next"/></button>}
      {!cover&&!ready&&<picture className={styles.poster}>
        <source media="(orientation: portrait)" srcSet={`/images/court-atlas/${staticView}-portrait.webp`}/>
        <img src={`/images/court-atlas/${staticView}.webp`} alt={tr(activeView.label)} fetchPriority="high"/>
      </picture>}
      {!cover&&!failure&&data&&<div className={styles.viewport}>
        <SceneBoundary onFailure={onFailure}><Suspense fallback={null}><ArenaScene {...{data,shot,light,rotate,crowd,rally,onSelect,onReady,onInteract,language,theme,sun,onFailure,reducedMotion,compassRef,onCut}} chapter={cinema?chapter:null} playing={cinema&&playing} context={cinema||context} onRoof={setRoof} markers={markers&&!cinema} onShade={setShade} canvasRef={canvas}/></Suspense></SceneBoundary>
      </div>}
      <div className={styles.shade}/>
      {!cinema&&!cover&&<div className={styles.stageBar}>
        {!failure&&<div className={styles.moods} role="group" aria-label={tr('光线氛围')}>{moods.map(mood=><button key={mood.id} disabled={!ready} aria-pressed={light===mood.id} aria-label={tr(mood.label)} title={tr(mood.label)} onClick={()=>setLight(mood.id)}><Icon name={mood.id}/><span>{tr(mood.label)}</span></button>)}{light==='solar'&&<button aria-label={tr('夏日日照')} aria-pressed="true" onClick={()=>setPanel('settings')}><Icon name="solar"/><span>{tr('夏日日照')}</span></button>}</div>}
        <div className={styles.tools}>
          <button disabled={!ready} onClick={()=>navigate({view:'hero'})} aria-label={tr('重置视角')} title={tr('重置视角 · R')}><Icon name="reset"/></button>
          <button disabled={!ready} onClick={capture} aria-label={tr('保存画面')} title={tr('保存画面')}><Icon name="capture"/></button>
          <button onClick={fullscreen} aria-label={tr('切换全屏')} title={tr('全屏')}><Icon name="expand"/></button>
        </div>
      </div>}
      {!cinema&&!cover&&<div className={styles.caption} aria-live="polite">
        <p className={styles.location}><Icon name="pin"/>{tr(wide?'澳大利亚墨尔本':'澳大利亚 · 墨尔本公园')}</p>
        <h1>{title}</h1>
        <p className={styles.facts}>{caption}{!wide&&<><i/>{shot.view==='court'||shot.view==='plan'?'23.77 × 10.97 m':seats?`${seats.toLocaleString(language)} ${tr('模型座椅').toLowerCase()}`:'23.77 × 10.97 m'}</>}{isRoofed(venue?.id)&&<><i/>{tr(roofNames[roof])}</>}</p>
        {isRoofed(venue?.id)&&<button className={styles.seatLink} onClick={openSeats}><Icon name="seat"/>{tr('查看座区')}<Icon name="next"/></button>}
        {(isRoofed(venue?.id)||shot.view==='court'||shot.view==='hero')&&ready&&<button className={styles.seatLink} aria-pressed={!!shot.follow} onClick={()=>{
          if(shot.follow)navigate(isRoofed(venue?.id)?{view:'ao',destination:venue.id}:{view:'court'});
          else navigate({view:'court',destination:venue?.id,follow:true});
        }}><Icon name="camera"/>{tr(shot.follow?'返回全场':'跟拍球员')}</button>}
        {venue?.id==='village'&&<button className={styles.seatLink} onClick={()=>setPanel('autographs')}>{tr('签名攻略')}<Icon name="next"/></button>}
      </div>}
      {cinema&&ready&&<div className={styles.filmBar}><div><small>{String(chapter+1).padStart(2,'0')} / 05</small><strong>{tr(film[chapter].title)}</strong></div><button aria-label={tr(playing?'暂停短片':'播放短片')} onClick={togglePlayback}><Icon name={playing?'pause':'play'}/></button><button aria-label={tr('下一镜头')} onClick={()=>setChapter((chapter+1)%film.length)}><Icon name="next"/></button></div>}
      {(ready||cinema)&&!cover&&<button className={styles.cinema} aria-pressed={cinema} onClick={toggleCinema}><Icon name={cinema?'exit':'cinema'}/><span>{tr(cinema?'退出影院模式':'影院模式')}</span></button>}
      {!cover&&!ready&&<div className={styles.status} role="status">{failure?<><span>{tr('静态场馆视图')}</span><button onClick={()=>window.location.reload()}>{tr('重试 3D')}</button></>:<><i/>{tr('正在构建场景')}</>}</div>}
      {theme==='ink'&&ready&&!cinema&&<span className={styles.inkNote}>{tr('远山为艺术化背景，并非当地地貌。')}</span>}
    </section>
    {!cinema&&!cover&&<nav className={styles.cameraNav} aria-labelledby="camera-heading">
      <div className={styles.railHeading}><h2 id="camera-heading">{tr('相机视角')}</h2>{ready&&!shot.follow&&<p className={styles.gesture}><span className={styles.north} title={tr('地理北向参考 · 8°')}><i ref={compassRef}/>N</span><Icon name="mouse"/><span>{tr(shot.section===undefined?'拖动旋转 · 滚轮缩放':'拖动环顾 · 滚轮缩放')}</span><b>{tr(shot.section===undefined?'拖动旋转 · 双指缩放':'拖动环顾看台')}</b></p>}</div>
      <div className={styles.filmstrip}>{views.map((view,index)=><button className={styles.cameraCard} key={view.id} aria-label={tr(view.label)} aria-pressed={shot.view===view.id} title={`${tr(view.label)} · ${index+1}`} onClick={()=>selectView(view.id)}>
        <span className={styles.thumb}><img src={`/images/court-atlas/${view.id}-thumb.webp`} alt="" draggable="false"/><kbd>{index+1}</kbd></span>
        <span className={styles.cardLabel}>{tr(view.label)}{shot.view===view.id&&<Icon name="check"/>}</span>
      </button>)}</div>
    </nav>}
    <audio ref={audio} src="/audio/cinema-music.mp3" preload="none" loop/>
    {panel&&<Drawer title={heading} closeLabel={tr('关闭')} onClose={close} wide={panel==='sections'||panel==='venues'}>
      {panel==='sections'&&<SectionPicker venue={seatVenue} section={section} language={language} canView={!failure&&!!data} onSelect={setSection} onVenueChange={id=>{setSeatVenue(id);setSection(null);}} onView={id=>{setSection(id);navigate({view:'seat',destination:seatVenue,section:id});}}/>}
      {(panel==='sections'||panel==='venues')&&<button className={styles.guideLink} onClick={()=>setPanel('autographs')}>{tr('签名攻略')}<Icon name="next"/></button>}
      {panel==='autographs'&&<Autographs language={language} visit={()=>{setContext(true);navigate({view:'ao',destination:'village'});}}/>}
      {panel==='venues'&&<>
        {data&&<GroundsPlan data={data} selected={shot.destination??(shot.view==='hero'?'1573':undefined)} onSelect={onSelect} language={language}/>}
        <div className={styles.venueList}>{[{id:'all',name:'澳网全景'},...destinations].map(d=>{
          const active=d.id===(venue?.id??(wide?'all':'1573'));
          return <button key={d.id} aria-pressed={active} onClick={()=>d.id==='all'?navigate({view:'ao'}):onSelect(d.id)}>{tr(d.name)}<Icon name={active?'check':'next'}/></button>;
        })}</div><a className={styles.textLink} href="https://ausopen.com/digitalmap" target="_blank" rel="noreferrer">{tr('官方 AO26 地图 ↗')}</a>
      </>}
      {panel==='settings'&&<>
        <fieldset disabled={!ready} className={styles.section}>
          <legend>{tr('视觉主题')}</legend><div className={styles.segment}>{(['classic','ink'] as const).map((option,i)=><button key={option} aria-pressed={theme===option} onClick={()=>{setTheme(option);savePreference('theme',option);}}>{tr(i?'水墨':'原色')}</button>)}</div>
        </fieldset>
        <fieldset disabled={!ready} className={styles.section}><legend>{tr('场景图层')}</legend>
          {[{name:'周边建筑',value:context,set:setContext,locked:light==='solar'},{name:'显示标签',value:markers,set:setMarkers},{name:'活动人群',value:crowd,set:setCrowd}].map(row=><label key={row.name} className={styles.switch}><span>{tr(row.name)}</span><input type="checkbox" disabled={row.locked} checked={row.value} onChange={e=>row.set(e.target.checked)}/></label>)}
        </fieldset>
        <fieldset disabled={!ready} className={styles.section}><legend>{tr('动态效果')}</legend>
          <label className={styles.switch}><span>{tr('自动环绕')}</span><input type="checkbox" checked={rotate} onChange={toggleOrbit}/></label>
          <label className={styles.switch}><span>{tr('球员回合')}</span><input type="checkbox" checked={rally} onChange={e=>setRally(e.target.checked)}/></label>
        </fieldset>
        <button className={styles.solarButton} disabled={!ready} aria-pressed={light==='solar'} aria-expanded={light==='solar'} onClick={setSolar}><Icon name="solar"/>{tr('夏日日照')}<span aria-hidden="true">{light==='solar'?'−':'+'}</span></button>
        {light==='solar'&&<SunControls date={solarDate} onChange={date=>{setShade(null);setSolarDate(date);}} language={language} shade={shade} onStand={viewStand}/>}
        <button className={styles.aboutButton} onClick={()=>setPanel('about')}><Icon name="info"/>{tr('关于模型')}<Icon name="next"/></button>
      </>}
      {panel==='detail'&&detail&&<div className={styles.prose}><p>{tr(detail.description)}</p><button className={styles.textLink} onClick={()=>{navigate({view:'hero'});setMarkers(true);}}>{tr('返回场馆全景 ↗')}</button></div>}
      {panel==='about'&&<div className={styles.prose}><p>{tr('1573 Arena 的标准球场与周边地理位置采用米制建模；圆角看台、座椅、遮阳棚、灯架和屋顶细节依据卫星图与公开场馆资料做视觉近似。不是测绘模型，也不代表最新的现场设施。')}</p><p>{tr('日落与夜场为艺术灯光预设，网球轨迹为演示动画。观众和街道家具是示意布置。')}</p><p>{tr('在三个可伸缩屋顶场馆中，雨天会触发加速模拟的闭合过程。')}</p><div className={styles.sources}>{sources.map(([label,url])=><a key={url} href={url} target="_blank" rel="noreferrer">{tr(label)}</a>)}<a href="/data/1573-context.json" download>{tr('下载衍生地理数据 · ODbL / CC BY 4.0 ↓')}</a></div><small>{tr('快捷键：1–6 切换视角 · R 重置 · H 热点 · 空格环绕')}</small></div>}
    </Drawer>}
    {toast&&<div className={styles.toast} role="status">{tr(toast)}</div>}
  </main>;
}

