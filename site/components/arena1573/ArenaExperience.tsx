'use client';

import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ContextData } from './model';
import type {LoadProgress} from './ArenaScene';
import {courtDirectory,venueCourts} from './courtPlacements';
import { getTranslator, type Language } from './i18n';
import { destinations, homeShot, points, views, isRoofed, type Light, type Shot, type Theme, type View } from './views';
import {benchDescription,benchLayout} from './playerBenches';
import SectionPicker from './SectionPicker';
import GroundsPlan from './GroundsPlan';
import Autographs from './Autographs';
import {seatSections,type SectionId,type SeatingVenue} from './seating';
import type {RoofStatus} from './roofs';
import {film} from './film';
import {useCinemaSound} from './useCinemaSound';
import { summerSun, type ShadeResult, type SolarDate, type Stand } from './solar';
import SunControls, { standNames } from './SunControls';
import SeatDaylight, { firstMinute, lastMinute, openingDay, readSeatDate, sunlightPlaybackSpeed, useSeatDaylight } from './SeatDaylight';
import { clockTime } from './solar';
import Icon from './Icon';
import styles from './arena.module.css';

const ArenaScene = lazy(() => import('./ArenaScene'));
const moods = [
  {id:'day',label:'日间'}, {id:'golden',label:'日落'}, {id:'night',label:'夜场'}, {id:'rain',label:'雨天'},
] as const;
const sources = [
  ['园区地表 · 墨尔本市 2020 年 5 月航摄影像（已裁切、重投影和遮罩）↗','https://discover.data.vic.gov.au/dataset/2020-aerial-imagery'],
  ['园区航摄影像授权 · CC BY 4.0 ↗','https://creativecommons.org/licenses/by/4.0/'],
  ['澳网比赛日航拍参考 · Lensaloft ↗','https://www.lensaloft.com.au/projects/melbourne-park-australian-open/'],
  ['澳网 2026 园区地图 ↗','https://ausopen.com/sites/default/files/2026-01/ao26_transport-map.pdf'],
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

function StageLighting({light, minutes, language, interactive, onPreset, children}: {
  light: Light; minutes: number; language: Language; interactive: boolean;
  onPreset: (preset: typeof moods[number]['id']) => void; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const tr = getTranslator(language);
  const preset = moods.find(mood => mood.id === light);
  const label = preset ? tr(preset.label) : clockTime(minutes) + ' AEDT';
  const closeAndFocus = useCallback(() => {
    setOpen(false);
    toggle.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        closeAndFocus();
      }
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('keydown', escape);
    };
  }, [open, closeAndFocus]);

  return <div className={styles.lightingStack} ref={root}
    onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={toggle} className={styles.lightingToggle} disabled={!interactive}
      aria-label={tr('光线氛围') + ' · ' + label} aria-expanded={open} aria-controls="stage-lighting"
      onClick={() => setOpen(value => !value)}>
      <Icon name={light}/><span>{label}</span><Icon name="chevron"/>
    </button>
    <div id="stage-lighting" className={styles.lightingPanel} data-open={open || undefined}>
      <div className={styles.moods} role="group" aria-label={tr('光线氛围')}>
        {moods.map(mood => <button key={mood.id} disabled={!interactive}
          aria-pressed={light === mood.id} aria-label={tr(mood.label)} title={tr(mood.label)}
          onClick={() => { onPreset(mood.id); if (open) closeAndFocus(); }}>
          <Icon name={mood.id}/><span>{tr(mood.label)}</span>
        </button>)}
      </div>
      {children}
    </div>
  </div>;
}

export default function ArenaExperience(){
  const [theme,setTheme]=useState<Theme>('classic');
  const [language,setLanguage]=useState<Language>('en');
  const [data,setData]=useState<ContextData|null>(null);
  const [dataAttempt,setDataAttempt]=useState(0);
  const [interactive,setInteractive]=useState(false);
  const [failure,setFailure]=useState<'data'|'render'|null>(null);
  const [requested,setRequested]=useState(false),[ready,setReady]=useState(false);
  const [progress,setProgress]=useState<LoadProgress|null>(null);
  const preview=!requested&&!failure;
  const startScene=()=>setRequested(true);
  const [seats,setSeats]=useState(0);
  const [shot,setShot]=useState<Shot>({...homeShot,serial:0});
  const [focusKey,setFocusKey]=useState<string|null|undefined>(undefined);
  const directory=useMemo(()=>data?courtDirectory(data):[],[data]);
  const freeView=ready&&focusKey!==undefined;
  const focusedCourt=freeView?directory.find(c=>c.key===focusKey):undefined;
  const captionVenueId=freeView?focusedCourt?.venue:shot.destination;
  const [light,setLight]=useState<Light>('golden');
  const [solarDate,setSolarDate]=useState<SolarDate>({...openingDay,minutes:17*60+10});
  const [studyClosed,setStudyClosed]=useState(false),[sunPlaying,setSunPlaying]=useState(false);
  const [shade,setShade]=useState<ShadeResult|null>(null);
  const [rotate,setRotate]=useState(false),[context,setContext]=useState(true),[crowd,setCrowd]=useState(true);
  const [markers,setMarkers]=useState(false),[rally,setRally]=useState(true);
  const [reducedMotion,setReducedMotion]=useState(true);
  const [panel,setPanel]=useState<Panel|null>(null),[selected,setSelected]=useState<string|null>(null);
  const [cinema,setCinema]=useState(false),[toast,setToast]=useState('');
  const [chapter,setChapter]=useState(0),[playing,setPlaying]=useState(false);
  const [roof,setRoof]=useState<RoofStatus>('open');
  const [seatVenue,setSeatVenue]=useState<SeatingVenue>('rla'),[section,setSection]=useState<SectionId|null>(null);
  const cameraStrip=useRef<HTMLDivElement>(null);
  const currentShot=useRef(shot);
  currentShot.current=shot;
  const container=useRef<HTMLElement>(null),canvas=useRef<HTMLCanvasElement|null>(null);
  const [filmPrepared,setFilmPrepared]=useState(false);
  const onFilmPrepared=useCallback(()=>setFilmPrepared(true),[]);
  const musicUnavailable=useCallback(()=>setToast('影院音乐暂时无法播放，请退出后重试。'),[]);
  const music=useCinemaSound(cinema&&playing&&ready&&filmPrepared,musicUnavailable);
  const presentable=ready&&(!cinema||(filmPrepared&&music.ready));
  const compassRef=useRef<HTMLElement>(null);
  const tr=getTranslator(language);
  const sun=useMemo(()=>light==='solar'?summerSun(solarDate):null,[light,solarDate]);
  const seatedStudy=shot.section!==undefined&&isRoofed(shot.destination)&&light==='solar';
  const studyVisible=panel==='sections'||(seatedStudy&&!cinema&&!panel);
  const clockVisible=panel==='sections'||(!cinema&&!panel&&light==='solar'&&requested);
  const visibility=useSeatDaylight(studyVisible);
  const study={...visibility,date:solarDate,closed:studyClosed,playing:sunPlaying,
    setClosed:setStudyClosed,setDate:(date:SolarDate)=>{setSolarDate(date);setSunPlaying(false);},
    toggle:()=>{
      if(!sunPlaying&&solarDate.minutes>=lastMinute)setSolarDate(d=>({...d,minutes:firstMinute}));
      setSunPlaying(p=>!p);
    }};
  useEffect(()=>{
    if(!clockVisible||solarDate.minutes>=lastMinute){setSunPlaying(false);return;}
    if(!sunPlaying||(!ready&&panel!=='sections'))return;
    // The original pace advances ten Melbourne minutes every 450 ms.
    // Measure elapsed time so a busy court can catch up after a delayed frame.
    const stepMs=450/sunlightPlaybackSpeed;
    let lastStep=performance.now();
    const resetClock=()=>{lastStep=performance.now();};
    const timer=window.setInterval(()=>{
      if(document.hidden)return;
      const steps=Math.floor((performance.now()-lastStep)/stepMs);
      if(!steps)return;
      lastStep+=steps*stepMs;
      setSolarDate(d=>({...d,minutes:Math.min(lastMinute,d.minutes+steps*10)}));
    },Math.ceil(stepMs));
    document.addEventListener('visibilitychange',resetClock);
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',resetClock);};
  },[clockVisible,sunPlaying,ready,panel,solarDate.minutes>=lastMinute]);
  useEffect(()=>{
    const strip=cameraStrip.current, item=strip?.querySelector<HTMLElement>('[aria-pressed=true]');
    if(!strip||!item||strip.scrollWidth<=strip.clientWidth)return;
    const box=strip.getBoundingClientRect(),button=item.getBoundingClientRect();
    if(button.left<box.left)strip.scrollLeft+=button.left-box.left;
    else if(button.right>box.right)strip.scrollLeft+=button.right-box.right;
  },[shot.view,cinema,language]);
  useEffect(()=>{
    if(!seatedStudy)return;
    const url=new URL(window.location.href);
    url.searchParams.set('date',[solarDate.year,String(solarDate.month).padStart(2,'0'),String(solarDate.day).padStart(2,'0')].join('-'));
    url.searchParams.set('time',clockTime(solarDate.minutes));
    if(studyClosed)url.searchParams.set('roof','closed');else url.searchParams.delete('roof');
    history.replaceState(history.state,'',url);
  },[seatedStudy,solarDate,studyClosed,shot.serial]);

  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    setInteractive(true);
    const oldCamera=['player','court','courtside'].includes(query.get('view')??'');
    const arena=query.get('arena')??(oldCamera?'1573':undefined),sectionId=query.get('section');
    const court=query.get('court')??undefined;
    if(oldCamera){
      const url=new URL(window.location.href);
      url.searchParams.delete('view');url.searchParams.delete('end');
      if(arena)url.searchParams.set('arena',arena);
      history.replaceState(history.state,'',url);
    }
    if(arena&&destinations.some(d=>d.id===arena))setRequested(true);
    if(isRoofed(arena)){
      const choice=seatSections[arena].find(s=>String(s.id)===sectionId);
      if(choice){setLight('solar');setSolarDate(readSeatDate(query));setStudyClosed(query.get('roof')==='closed');}
      else {setLight('day');setSolarDate(openingDay);}
      setSeatVenue(arena);setSection(choice?.id??null);
      setShot(choice?{view:'seat',serial:1,destination:arena,section:choice.id}:{view:'hero',destination:arena,court,serial:1});
    }else if(arena&&destinations.some(d=>d.id===arena)){
      setLight('day');setSolarDate(openingDay);
      setShot({view:court||arena==='1573'?'hero':'ao',destination:arena,court,serial:1});
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
    return ()=>motion.removeEventListener('change',updateMotion);
  },[]);
  useEffect(()=>{
    const abort=new AbortController();
    fetch('/data/1573-context.json',{signal:abort.signal}).then(response=>{
      if(!response.ok)throw new Error('Context unavailable');
      return response.json();
    }).then(setData).catch(error=>{if(error.name!=='AbortError')setFailure('data');});
    return ()=>abort.abort();
  },[dataAttempt]);
  useEffect(()=>{
    const previous=document.documentElement.lang;
    document.documentElement.lang=language==='zh'?'zh-CN':'en';
    return ()=>{document.documentElement.lang=previous;};
  },[language]);
  function savePreference(key:string,value:string){
    try{localStorage.setItem('1573-arena-'+key,value);}catch{/* Storage is optional. */}
  }
  const navigate=useCallback((next:Omit<Shot,'serial'>)=>{
    setRequested(true);
    const url=new URL(window.location.href);
    for(const key of ['arena','section','view','date','time','roof'])url.searchParams.delete(key);
    url.searchParams.delete('court');url.searchParams.delete('end');
    if(next.court)url.searchParams.set('court',next.court);
    if(next.destination&&!next.home)url.searchParams.set('arena',next.destination);
    if(next.section!==undefined)url.searchParams.set('section',String(next.section));
    history.replaceState(history.state,'',url);
    if(next.home)setContext(true);
    setFocusKey(undefined);
    setShot(previous=>({...next,serial:previous.serial+1}));
    setRotate(false);setPanel(null);setSelected(null);
  },[]);
  const openSeats=useCallback(()=>{
    if(isRoofed(captionVenueId)&&captionVenueId!==seatVenue){setSeatVenue(captionVenueId);setSection(null);}
    if(light!=='solar')setStudyClosed(light==='rain');
    setPanel('sections');
  },[captionVenueId,seatVenue,light]);
  const selectView=useCallback((view:View)=>{
    if(view==='seat'&&isRoofed(captionVenueId)){openSeats();return;}
    navigate({view});
  },[captionVenueId,openSeats,navigate]);
  const onSelect=useCallback((id:string)=>{
    if(destinations.some(venue=>venue.id===id)){
      navigate(id==='1573'?{view:'hero'}:{view:'ao',destination:id});
      return;
    }
    const point=points.find(p=>p.id===id);
    if(point){navigate({view:point.view});setSelected(id);setMarkers(false);setPanel('detail');}
  },[navigate]);
  const onProgress=useCallback((next:LoadProgress)=>{
    setReady(false);
    setProgress(last=>last?.stage===next.stage&&last.done===next.done&&last.total===next.total?last:next);
  },[]);
  const onReady=useCallback((count:number)=>{setSeats(count);setReady(true);},[]);
  const onFailure=useCallback(()=>{
    const previous=currentShot.current;
    setFailure('render');setReady(false);setCinema(false);setPlaying(false);
    if(!previous.home&&isRoofed(previous.destination)){
      setSeatVenue(previous.destination);setSection(previous.section??null);setPanel('sections');
    }else setPanel(null);
  },[]);
  const onInteract=useCallback(()=>setRotate(false),[]);
  const toggleOrbit=()=>setRotate(value=>!value);
  useEffect(()=>{if(rotate)setRally(true);},[rotate]);
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||event.ctrlKey||event.altKey||event.metaKey||event.isComposing||panel)return;
      if(event.key==='Escape'){setCinema(false);setPlaying(false);return;}
      if(event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input,select,textarea')))return;
      if(cinema){
        if(presentable&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){
          event.preventDefault();
          const step=event.key==='ArrowLeft'?-1:1;
          setChapter(current=>(current+step+film.length)%film.length);
        }
        return;
      }
      const preset=/^[1-9]$/.test(event.key)?views[Number(event.key)-1]:undefined;
      if(preset)selectView(preset.id);
      if(event.key.toLowerCase()==='r')navigate(homeShot);
      if(!ready)return;
      if(event.key.toLowerCase()==='h')setMarkers(value=>!value);
      if(event.code==='Space' && !(event.target instanceof HTMLElement && event.target.closest('button,a'))){
        event.preventDefault();setRotate(value=>!value);
      }
    };
    window.addEventListener('keydown',handler);return ()=>window.removeEventListener('keydown',handler);
  },[navigate,selectView,panel,ready,presentable,cinema]);
  useEffect(()=>{if(toast){const timer=setTimeout(()=>setToast(''),3500);return ()=>clearTimeout(timer);}},[toast]);
  function toggleCinema(){
    if(cinema){setPlaying(false);setCinema(false);return;}
    startScene();setCinema(true);setChapter(0);setPlaying(!reducedMotion);setRotate(false);
    setReady(false);setFilmPrepared(false);music.prepare();
  }
  const onCut=useCallback(()=>{if(chapter<film.length-1)setChapter(chapter+1);else {setPlaying(false);setCinema(false);}},[chapter]);
  function togglePlayback(){if(!playing)music.unlock();setPlaying(!playing);}
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
  function activateClock(){
    startScene();
    setContext(true);setLight('solar');
  }
  function setSolar(){
    startScene();
    if(light==='solar')setLight('day');
    else {setContext(true);setLight('solar');}
  }
  const venue=destinations.find(d=>d.id===captionVenueId);
  const playable=venueCourts(directory,venue?.id??(!freeView&&shot.view==='hero'?'1573':undefined));
  const courtKey=freeView?focusedCourt?.key:shot.court;
  const chosen=playable.find(c=>c.key===courtKey)??playable[0];
  const showStandComparison=venue?.id==='1573'||(!venue&&shot.view!=='ao'&&shot.view!=='precinct');
  const wide=freeView?focusedCourt?.key!=='1573':!!venue||shot.view==='ao'||shot.view==='precinct';
  const title=chosen&&courtKey?chosen[language]:venue?tr(venue.name):wide?tr('墨尔本公园'):'1573 Arena';
  const detail=points.find(point=>point.id===selected);
  const activeView=views.find(view=>view.id===shot.view)!;
  const currentSeat=shot.view==='seat'?tr(standNames[shot.stand??'west']):null;
  let caption=tr('室外硬地球场');
  if(!freeView&&shot.section!==undefined){
    caption=language==='en'?`Section ${shot.section} · Approximate view`:`${shot.section} 区 · 模拟视角`;
  }else if(venue&&courtKey&&chosen&&chosen.key!==venue.id){
    caption=tr(venue.name);
  }else if(venue&&venue.id!=='1573'){
    caption=tr('场馆建筑模型');
  }else if(freeView){
    if(!focusedCourt)caption=tr('澳网全景');
  }else if(shot.view==='ao')caption=tr('澳网全景');
  else if(shot.view==='precinct')caption=tr('西区场馆与练习场');
  else if(currentSeat)caption=currentSeat;
  const close=()=>setPanel(null);
  const heading=panel==='autographs'?tr('签名攻略'):panel==='sections'?tr('座区指南'):panel==='settings'?tr('场景设置'):panel==='venues'?tr('选择场馆'):panel==='detail'&&detail?tr(detail.title):tr('关于模型');
  const staticView=shot.home?'home-aerial':shot.view;

  const progressLabel=cinema&&ready&&!presentable?tr('正在准备影片'):
    !data?tr('正在读取场馆地图'):!progress?tr('正在打开三维视图'):
    progress.stage==='imagery'?tr('正在加载航拍影像'):progress.total>1?tr('正在构建园区'):tr('正在构建场馆');

  return <main ref={container} className={styles.experience} data-interactive={interactive} data-cinema={cinema||undefined} data-roof={roof} lang={language==='zh'?'zh-CN':'en'}>
    <header className={styles.header}>
      <a href="/australian-open/" className={styles.brand} aria-label={language==='zh'?'Court Atlas · 返回澳网首页':'Court Atlas · Australian Open home'}><Icon name="ball"/><span>Court Atlas</span></a>
      <span className={styles.eventName}>{tr('澳大利亚网球公开赛')}</span>
      <nav className={styles.topActions} inert={!interactive} aria-label={tr('场馆工具')}>
        <button aria-haspopup="dialog" onClick={openSeats} aria-label={tr('座区指南')}><Icon name="seat"/><span>{tr('座区指南')}</span></button>
        <button disabled={!!failure} aria-haspopup="dialog" onClick={()=>setPanel('venues')} aria-label={tr('场馆列表')}><Icon name="venues"/><span>{tr('场馆列表')}</span></button>
        <button aria-haspopup="dialog" onClick={()=>setPanel('settings')} aria-label={tr('场景设置')}><Icon name="settings"/><span>{tr('场景设置')}</span></button>
        <button className={styles.language} lang={language==='en'?'zh-CN':'en'} aria-label={language==='en'?'切换到中文':'Switch to English'} onClick={()=>{const next=language==='en'?'zh':'en';setLanguage(next);savePreference('language',next);}}>{language==='en'?'中文':'EN'}</button>
      </nav>
    </header>
    <section className={styles.stage} aria-label={tr('墨尔本公园场馆探索')}
      onPointerDown={event=>{if(preview&&event.target===event.currentTarget)startScene();}}
      onWheel={event=>{if(preview&&event.target===event.currentTarget)startScene();}}>
      {!cinema&&ready&&light==='rain'&&!isRoofed(venue?.id)&&<button className={styles.weatherLink} onClick={()=>navigate({view:'ao',destination:'mca'})}><Icon name="rain"/>{tr('查看玛格丽特球场屋顶')}<Icon name="next"/></button>}
      {!presentable&&<picture className={styles.poster}>
        <source media="(orientation: portrait)" srcSet={`/images/court-atlas/${staticView}-portrait.webp`}/>
        <img src={`/images/court-atlas/${staticView}.webp`} alt={tr(activeView.label)} fetchPriority="high"/>
      </picture>}
      {requested&&!failure&&data&&<div className={styles.viewport}>
        <SceneBoundary onFailure={onFailure}><Suspense fallback={null}><ArenaScene onFilmPrepared={onFilmPrepared} onFocus={setFocusKey} {...{data,shot,light,rotate,crowd,ready,onProgress,onSelect,onReady,onInteract,language,theme,sun,onFailure,reducedMotion,compassRef,onCut}} rally={cinema?playing&&presentable:rally} compareStands={showStandComparison&&panel==='settings'} closedStudyRoof={light==='solar'&&seatedStudy&&studyClosed} chapter={cinema?chapter:null} playing={cinema&&playing&&presentable} context={cinema||context} onRoof={setRoof} markers={markers&&!cinema} onShade={setShade} canvasRef={canvas}/></Suspense></SceneBoundary>
      </div>}
      <div className={styles.shade}/>
      {!cinema&&<div className={styles.stageBar}>
        {!failure&&<StageLighting light={light} minutes={solarDate.minutes} language={language} interactive={interactive}
          onPreset={preset=>{startScene();setSunPlaying(false);setLight(preset);}}>
          <SeatDaylight compact language={language} active={light==='solar'} activate={activateClock}
            venue={seatedStudy&&isRoofed(shot.destination)?shot.destination:undefined} id={seatedStudy?shot.section:undefined}
            study={{...study,setDate:date=>{activateClock();setShade(null);study.setDate(date);},toggle:()=>{activateClock();study.toggle();}}}
            transitioning={roof==='closing'||roof==='opening'}/>
        </StageLighting>}
        <div className={styles.tools}>
          <button disabled={!ready} onClick={()=>navigate(homeShot)} aria-label={tr('重置视角')} title={tr('重置视角 · R')}><Icon name="reset"/></button>
          <button disabled={!ready} onClick={capture} aria-label={tr('保存画面')} title={tr('保存画面')}><Icon name="capture"/></button>
          <button onClick={fullscreen} aria-label={tr('切换全屏')} title={tr('全屏')}><Icon name="expand"/></button>
        </div>
      </div>}
      <div className={styles.stageFooter}>
        {!cinema&&<div className={styles.caption} aria-live="polite">
          <p className={styles.location}><Icon name="pin"/>{tr(wide?'澳大利亚墨尔本':'澳大利亚 · 墨尔本公园')}</p>
          <h1>{title}</h1>
          <p className={styles.facts}>{caption}{!wide&&<><i/>{shot.view==='plan'?'23.77 × 10.97 m':seats?`${seats.toLocaleString(language)} ${tr('模型座椅').toLowerCase()}`:'23.77 × 10.97 m'}</>}{isRoofed(venue?.id)&&<><i/>{tr(roofNames[roof])}</>}</p>
          {preview&&<button className={styles.start3d} onClick={startScene}><Icon name="play"/>{tr('探索三维球场')}</button>}
          {isRoofed(venue?.id)&&<button className={styles.seatLink} onClick={openSeats}><Icon name="seat"/>{tr('选择座区')}<Icon name="next"/></button>}
          {chosen&&ready&&<>
            {playable.length>1&&<select className={styles.courtChoice} aria-label={tr('选择球场')} value={courtKey?chosen.key:''} onChange={e=>navigate({view:'hero',destination:venue?.id,court:e.target.value})}>
              <option value="" disabled>{tr('选择球场')}</option>
              {playable.map(c=><option key={c.key} value={c.key}>{c[language]}</option>)}
            </select>}
            {(courtKey||playable.length===1)&&<details className={styles.benchGuide} key={chosen.key}>
              <summary>{language==='zh'?'球员休息席':'Player benches'}</summary>
              <p>{benchDescription(chosen.key,language)}</p>
              {benchLayout(chosen.key).source&&<a href={benchLayout(chosen.key).source} target="_blank" rel="noreferrer">{language==='zh'?'澳网场地布置图（2025）':'AO court layout (2025)'} ↗</a>}
            </details>}
          </>}
          {venue?.id==='village'&&<button className={styles.seatLink} onClick={()=>setPanel('autographs')}>{tr('签名攻略')}<Icon name="next"/></button>}
        </div>}
        {failure?<div className={styles.status} role="status"><span>{tr('静态场馆视图')}</span><button onClick={()=>{
          if(failure==='data')setDataAttempt(n=>n+1);
          setProgress(null);setFailure(null);startScene();
        }}>{tr('重试 3D')}</button></div>:
          requested&&!presentable&&<div className={styles.loading}>
            <div><span role="status">{progressLabel}</span>{!ready&&progress?.stage==='geometry'&&progress.total>1&&<small aria-hidden="true">{progress.done} / {progress.total}</small>}</div>
            <progress aria-label={progressLabel} value={!ready&&progress?.stage==='geometry'?progress.done:undefined} max={progress?.total||1}/>
          </div>}
      </div>
      {cinema&&presentable&&<div className={styles.filmBar}>
        <div aria-live="polite" aria-atomic="true"><small>{String(chapter+1).padStart(2,'0')} / {String(film.length).padStart(2,'0')}</small><strong>{tr(film[chapter].title)}</strong></div>
        <button aria-label={tr('上一镜头')} title={tr('上一镜头')} onClick={()=>setChapter(i=>(i+film.length-1)%film.length)}><Icon name="previous"/></button>
        <button aria-label={tr(playing?'暂停短片':'播放短片')} title={tr(playing?'暂停短片':'播放短片')} onClick={togglePlayback}><Icon name={playing?'pause':'play'}/></button>
        <button aria-label={tr('下一镜头')} title={tr('下一镜头')} onClick={()=>setChapter(i=>(i+1)%film.length)}><Icon name="next"/></button>
      </div>}
      {(ready||cinema||preview)&&<button className={styles.cinema} disabled={!interactive} aria-pressed={cinema} onClick={toggleCinema}><Icon name={cinema?'exit':'cinema'}/><span>{tr(cinema?'退出影院模式':'影院模式')}</span></button>}
      {theme==='ink'&&ready&&!cinema&&<span className={styles.inkNote}>{tr('远山为艺术化背景，并非当地地貌。')}</span>}
    </section>
    {!cinema&&<nav className={styles.cameraNav} aria-labelledby="camera-heading">
      <div className={styles.railHeading}><h2 id="camera-heading">{tr('相机视角')}</h2>{ready&&<p className={styles.gesture}><span className={styles.north} title={tr('地理北向参考 · 8°')}><i ref={compassRef}/>N</span><Icon name="mouse"/><span>{tr(shot.section===undefined?'拖动旋转 · 滚轮缩放':'拖动环顾 · 滚轮缩放')}</span><b>{tr(shot.section===undefined?'拖动旋转 · 双指缩放':'拖动环顾看台')}</b></p>}</div>
      <div ref={cameraStrip} className={styles.filmstrip}>{views.map((view,index)=><button className={styles.cameraCard} key={view.id} aria-label={tr(view.label)} aria-pressed={shot.view===view.id} title={`${tr(view.label)} · ${index+1}`} onClick={()=>selectView(view.id)}>
        <span className={styles.thumb}><img src={`/images/court-atlas/${view.id}-thumb.webp`} alt="" draggable="false"/><kbd>{index+1}</kbd></span>
        <span className={styles.cardLabel}>{tr(view.label)}{shot.view===view.id&&<Icon name="check"/>}</span>
      </button>)}</div>
    </nav>}
    {panel&&<Drawer title={heading} closeLabel={tr('关闭')} onClose={close} wide={panel==='sections'||panel==='venues'}>
      {panel==='sections'&&<SectionPicker venue={seatVenue} section={section} language={language} study={study} canView={!failure&&!!data} onSelect={setSection} onVenueChange={id=>{setSeatVenue(id);setSection(null);}} onView={id=>{setSection(id);setLight('solar');setContext(true);navigate({view:'seat',destination:seatVenue,section:id});}}/>}
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
        <fieldset disabled={!!failure} onChange={startScene} className={styles.section}>
          <legend>{tr('视觉主题')}</legend><div className={styles.segment}>{(['classic','ink'] as const).map((option,i)=><button key={option} aria-pressed={theme===option} onClick={()=>{startScene();setTheme(option);savePreference('theme',option);}}>{tr(i?'水墨':'原色')}</button>)}</div>
        </fieldset>
        <fieldset disabled={!!failure} onChange={startScene} className={styles.section}><legend>{tr('场景图层')}</legend>
          {[{name:'周边建筑',value:context,set:setContext,locked:light==='solar'},{name:'显示标签',value:markers,set:setMarkers},{name:'活动人群',value:crowd,set:setCrowd}].map(row=><label key={row.name} className={styles.switch}><span>{tr(row.name)}</span><input type="checkbox" disabled={row.locked} checked={row.value} onChange={e=>row.set(e.target.checked)}/></label>)}
        </fieldset>
        <fieldset disabled={!!failure} onChange={startScene} className={styles.section}><legend>{tr('动态效果')}</legend>
          <label className={styles.switch}><span>{tr('自动环绕')}</span><input type="checkbox" checked={rotate} onChange={toggleOrbit}/></label>
          <label className={styles.switch}><span>{tr('球员回合')}</span><input type="checkbox" checked={rally} onChange={e=>setRally(e.target.checked)}/></label>
        </fieldset>
        <button className={styles.solarButton} disabled={!!failure} aria-pressed={light==='solar'} aria-expanded={light==='solar'} onClick={setSolar}><Icon name="solar"/>{tr('夏日日照')}<span aria-hidden="true">{light==='solar'?'−':'+'}</span></button>
        {light==='solar'&&(isRoofed(shot.destination)?<button className={styles.guideLink} onClick={openSeats}>{tr('选择座区')}<Icon name="seat"/></button>:<SunControls date={solarDate} onChange={date=>{setShade(null);setSolarDate(date);}} language={language} shade={shade} onStand={showStandComparison?viewStand:undefined}/>)}
        <button className={styles.aboutButton} onClick={()=>setPanel('about')}><Icon name="info"/>{tr('关于模型')}<Icon name="next"/></button>
      </>}
      {panel==='detail'&&detail&&<div className={styles.prose}><p>{tr(detail.description)}</p><button className={styles.textLink} onClick={()=>{navigate({view:'hero'});setMarkers(true);}}>{tr('返回场馆全景 ↗')}</button></div>}
      {panel==='about'&&<div className={styles.prose}><p>{tr('1573 Arena 的标准球场与周边地理位置采用米制建模；圆角看台、座椅、遮阳棚、灯架和屋顶细节依据卫星图与公开场馆资料做视觉近似。不是测绘模型，也不代表最新的现场设施。')}</p><p>{tr('日落与夜场为艺术灯光预设，网球轨迹为演示动画。观众和街道家具是示意布置。')}</p><p>{tr('在三个可伸缩屋顶场馆中，雨天会触发加速模拟的闭合过程。')}</p><div className={styles.sources}>{sources.map(([label,url])=><a key={url} href={url} target="_blank" rel="noreferrer">{tr(label)}</a>)}<a href="/data/1573-context.json" download>{tr('下载衍生地理数据 · ODbL / CC BY 4.0 ↓')}</a></div><small>{tr('快捷键：1–5 切换视角 · R 重置 · H 热点 · 空格环绕')}</small></div>}
    </Drawer>}
    {toast&&<div className={styles.toast} role="status">{tr(toast)}</div>}
  </main>;
}

