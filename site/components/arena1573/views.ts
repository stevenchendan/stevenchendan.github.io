import { SEATING_LIFT } from './dimensions';
import type { Stand } from './solar';
import {sectionPosition, type SectionId, type SeatingVenue} from './seating';
import {rodLaverSeatEye} from './rodLaverProfile';

export type View = 'hero' | 'plan' | 'seat' | 'precinct' | 'ao';
export type Light = 'day' | 'golden' | 'night' | 'rain' | 'solar';
export type Theme = 'classic' | 'ink';
export type Shot = {view:View;serial:number;stand?:Stand;destination?:string;section?:SectionId;court?:string;home?:boolean};
export const homeShot = {view:'ao',destination:'rla',home:true} as const;

// The wide composition looks across Rod Laver towards the railway and the MCG.
// The portrait poster is composed on a 390 × 737 stage. Match its cover crop
// as the available width changes, keeping the bowl in frame on short phones.
export function homeCamera(aspect:number, portraitScreen:boolean){
  const portrait=Math.max(0,Math.min(1,(1.5-aspect)/.9));
  const target:[number,number,number]=portraitScreen?[154,5,60]:[195-38*portrait,0,5+32*portrait];
  const distance=portraitScreen?1.25*Math.min(1,(390/737)/aspect):Math.max(1,Math.min(1.9,2.12/aspect));
  const offset:[number,number,number]=[-33*distance,251*distance,260*distance];
  return {target,offset};
}
export function isRoofed(id?:string):id is SeatingVenue {return id==='rla'||id==='mca'||id==='john';}

export function sectionEye(venue:SeatingVenue,id:SectionId){
  const section=sectionPosition(venue,id);
  if(!section)return;
  if(venue==='rla')return rodLaverSeatEye(section.x,section.z,section.level);
  const [width,depth]=venue==='john'?[40,48]:[32,36];
  const row=Math.round(21*section.level), fraction=(row+.5)/22;
  const w=13+(width-13)*fraction,d=22+(depth-22)*fraction,r=3+8*fraction;
  const dx=section.x*w,dz=section.z*d;
  let lo=0,hi=5;
  for(let i=0;i<20;i++){
    const mid=(lo+hi)/2;
    const u=Math.max(0,Math.abs(mid*dx)-(w-r)),v=Math.max(0,Math.abs(mid*dz)-(d-r));
    if(u*u+v*v<=r*r)lo=mid;else hi=mid;
  }
  return [dx*lo,2.17+row*.57,dz*lo] as const;
}
export const destinations = [
  {id:'1573',name:'1573 Arena',target:[0,0,0],offset:[-68,82,98]},
  {id:'mca',name:'Margaret Court Arena',target:[68,5,25],offset:[-63,103,78]},
  {id:'rla',name:'Rod Laver Arena',target:[154,7,72],offset:[-63,125,97]},
  {id:'kia',name:'Kia Arena',target:[345,0,79],offset:[-60,110,110]},
  {id:'village',name:'训练村',target:[408,1,67],offset:[-34,54,71]},
  {id:'centrepiece',name:'Centrepiece Melbourne',target:[278,6,-12],offset:[-95,140,125]},
  {id:'ntc',name:'National Tennis Centre',target:[642,7,161],offset:[-65,145,140]},
  {id:'john',name:'John Cain Arena',target:[463,7,165],offset:[-76,143,103]},
  {id:'west',name:'西侧球场',target:[0,0,-155],offset:[-80,255,165]},
  {id:'east',name:'东侧球场',target:[738,0,220],offset:[0,255,210]},
  {id:'oval',name:'Grand Slam Oval',target:[300,0,188],offset:[-80,185,150]},
  {id:'hilltop',name:'AO Hilltop',target:[-382,2,-244],offset:[20,28,43]},
  {id:'ballpark',name:'AO Ballpark',target:[-326,2,-177],offset:[20,29,55]},
  {id:'topcourt',name:'TOPCOURT',target:[-193,3,-193],offset:[-6,13,55]},
  {id:'garden',name:'Garden Square',target:[160,2,-53],offset:[-23,13,-18]},
  {id:'terrace',name:'Rod Laver Arena Terrace',target:[273,2,72],offset:[12,17,31]},
  {id:'courtside',name:'Courtside Bar',target:[62,3,-155],offset:[-27,34,38]},
] satisfies {id:string;name:string;target:[number,number,number];offset:[number,number,number]}[];
export const standCameras:Record<Stand,[number,number,number]>={north:[4,5.4+SEATING_LIFT,-25.5],east:[16.2,5.4+SEATING_LIFT,9],south:[-4,5.4+SEATING_LIFT,25.5],west:[-16.2,5.4+SEATING_LIFT,9]};
export const views: {id:View;label:string}[] = [
  {id:'hero',label:'场馆全景'},
  {id:'plan',label:'垂直俯瞰'},
  {id:'seat',label:'看台视角'},
  {id:'precinct',label:'周边区域'},
  {id:'ao',label:'澳网全景'},
];
export const cameras: Record<View,{position:[number,number,number];target:[number,number,number]}> = {
  hero:{position:[-40,39,50],target:[0,2,0]},
  plan:{position:[0,90,.05],target:[0,0,0]},
  seat:{position:[-16.2,5.4+SEATING_LIFT,9],target:[0,1,0]},
  precinct:{position:[-170,230,255],target:[12,0,-28]},
  ao:{position:[160,670,570],target:[315,0,65]},
};
export const points = [
  {id:'court',title:'蓝色中心球场',en:'THE PLAYING SURFACE',position:[0,.3,0] as [number,number,number],view:'plan' as View,description:'23.77 × 10.97 米标准双打场地。单打边线、发球区、中心标记，以及中部下垂的球网，均以米为单位建模。'},
  {id:'seat',title:'环抱式看台',en:'A SEAT IN THE ARENA',position:[-16,5+SEATING_LIFT,9] as [number,number,number],view:'seat' as View,description:'十二排逐级抬升的独立座椅，沿圆角矩形环绕球场。靠背、径向通道、扶手和后排遮阳棚均为实体几何；排数与细节为视觉近似。'},
  {id:'precinct',title:'Margaret Court Arena',en:'THE COPPER NEIGHBOUR',position:[59,19,20] as [number,number,number],view:'precinct' as View,description:'东侧紧邻的铜色屋顶是这片区域的视觉地标。周边建筑底图来自墨尔本开放数据，屋顶折线为参考卫星图的示意细化。'},
];
