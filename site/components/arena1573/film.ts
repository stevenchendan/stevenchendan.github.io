// Positions and sight lines are authored together in the model's metre grid.
// Each cut starts a new camera move; the camera never flies through an arena wall.
type Triplet = [number,number,number];
type Chapter = {title:string;venue:string;seconds:number;from:Triplet;to:Triplet;look:Triplet;lookTo:Triplet;fov:number;via?:Triplet;horizontalFov?:number;interior?:boolean;cue?:'rain'|'nightfall'};
export const film:Chapter[]=[
  {title:'墨尔本公园',venue:'all',seconds:7,from:[-110,185,310],to:[-45,152,274],look:[131,4,31],lookTo:[142,7,41],fov:42},
  {title:'铜色屋顶',venue:'mca',seconds:6,from:[-11,68,78],to:[8,58,84],look:[65,13,21],lookTo:[69,13,25],fov:43},
  // Stay on the open terrace between pavilion and Kia. A bowed lateral move
  // starts at pedestrian height, then cranes up across the reflective frontage.
  {title:'光映玻璃',venue:'rla',seconds:12,from:[281,5.8,118],via:[288,7,87],to:[282,18,53],look:[242,10,94],lookTo:[240,12,72],fov:48,horizontalFov:62},
  // Slide across the south baseline above the lower bowl and below the soffit.
  {title:'罗德·拉沃尔球场',venue:'rla',interior:true,seconds:7,from:[162,19.2,112],to:[154,18.3,109],look:[154,1.9,72],lookTo:[154,1.3,71],fov:40},
  {title:'底线回合',venue:'1573',seconds:7,from:[-3.6,9.2,26.6],to:[-1.6,8.1,25],look:[0,1.1,0],lookTo:[0,.9,.4],fov:40},
  {title:'雨临约翰·凯因球场',venue:'john',cue:'rain',seconds:12,from:[408,117,240],to:[430,129,248],look:[462,22,165],lookTo:[463,23,165],fov:40},
  {title:'墨尔本公园亮灯',venue:'all',cue:'nightfall',seconds:12,from:[-55,71,83],to:[-107,135,149],look:[9,2,-28],lookTo:[32,3,-36],fov:44},
];

// Keep both baselines in the frame as the stage narrows. The close 1573
// shot needs a wider horizontal field because its near player is much closer.
export function filmFieldOfView(take:Chapter,aspect:number){
  const horizontal=take.horizontalFov??(take.venue==='1573'?48:take.venue==='rla'?32:38);
  const vertical=2*Math.atan(Math.tan(horizontal*Math.PI/360)/aspect)*180/Math.PI;
  return Math.max(take.fov,vertical);
}

export function filmPosition(take:Chapter,t:number):Triplet{
  return take.from.map((start,i)=>take.via?
    (1-t)*(1-t)*start+2*(1-t)*t*take.via[i]+t*t*take.to[i]:start+(take.to[i]-start)*t) as Triplet;
}

function ramp(seconds:number,from:number,to:number){
  const t=Math.max(0,Math.min(1,(seconds-from)/(to-from)));
  return t*t*(3-2*t);
}
export const filmRain=(seconds:number)=>ramp(seconds,.15,1.6);
export function filmRoof(cue:Chapter['cue'],seconds:number){
  if(cue==='rain')return ramp(seconds,1.6,9.4);
  if(cue==='nightfall')return 1-ramp(seconds,0,8);
  return 0;
}
export const filmDusk=(seconds:number)=>ramp(seconds,.4,8.9);
export const filmLights=(seconds:number)=>ramp(seconds,3.2,7.5);
