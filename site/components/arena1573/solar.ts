import { SEATING_LIFT } from './dimensions';
/** NOAA's general solar-position equations (geometric solar centre).
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 * Approximate clear-sky geometry, not weather, UV or a surveyed shade guarantee.
 */
export const ARENA_LOCATION = { latitude: -37.8207577, longitude: 144.97696165, rotation: .142 };
export const SUMMER_UTC_OFFSET = 11; // Australia/Melbourne in January and February: AEDT.
export type SolarDate = { year: number; month: 1 | 2; day: number; minutes: number };
export function daysInMonth(year:number,month:1|2){return month===1?31:year%4===0&&(year%100!==0||year%400===0)?29:28;}
export type Stand = 'north' | 'east' | 'south' | 'west';
export const STANDS: Stand[] = ['north','east','south','west'];
export type ShadeResult = Record<Stand, number>;
const radians = Math.PI/180;
const clamp = (n:number)=>Math.max(-1,Math.min(1,n));

export function sunDirection(azimuth:number,elevation:number):[number,number,number]{
  const east=Math.sin(azimuth*radians)*Math.cos(elevation*radians);
  const south=-Math.cos(azimuth*radians)*Math.cos(elevation*radians);
  const angle=ARENA_LOCATION.rotation;
  // Same east/south-to-court transform as extract-1573-context.mjs.
  return [east*Math.cos(angle)+south*Math.sin(angle),Math.sin(elevation*radians),-east*Math.sin(angle)+south*Math.cos(angle)];
}

export function summerSun({year,month,day,minutes}:SolarDate){
  if(!Number.isInteger(year)||year<2000||year>2100||![1,2].includes(month)||!Number.isInteger(day)||day<1||day>daysInMonth(year,month)||!Number.isFinite(minutes)||minutes<0||minutes>=1440)throw new RangeError('Invalid summer solar date');
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const gamma=2*Math.PI/(leap?366:365)*((month===2?31:0)+day-1+(minutes/60-12)/24);
  const equation=229.18*(.000075+.001868*Math.cos(gamma)-.032077*Math.sin(gamma)-.014615*Math.cos(2*gamma)-.040849*Math.sin(2*gamma));
  const declination=.006918-.399912*Math.cos(gamma)+.070257*Math.sin(gamma)-.006758*Math.cos(2*gamma)+.000907*Math.sin(2*gamma)-.002697*Math.cos(3*gamma)+.00148*Math.sin(3*gamma);
  const latitude=ARENA_LOCATION.latitude*radians;
  const solarMinutes=((minutes+equation+4*ARENA_LOCATION.longitude-60*SUMMER_UTC_OFFSET)%1440+1440)%1440;
  const hourAngle=(solarMinutes/4-180)*radians;
  const east=-Math.cos(declination)*Math.sin(hourAngle);
  const north=Math.cos(latitude)*Math.sin(declination)-Math.sin(latitude)*Math.cos(declination)*Math.cos(hourAngle);
  const up=Math.sin(latitude)*Math.sin(declination)+Math.cos(latitude)*Math.cos(declination)*Math.cos(hourAngle);
  const elevation=Math.asin(clamp(up))/radians;
  const azimuth=(Math.atan2(east,north)/radians+360)%360;
  return {azimuth,elevation,direction:sunDirection(azimuth,elevation),aboveHorizon:elevation>0};
}

export function summerDaylight(year:number,month:1|2,day:number){
  summerSun({year,month,day,minutes:720}); // Validate input before computing day events.
  // Iterate on the full position calculation at the conventional -0.833°
  // sunrise/sunset threshold (solar disk + standard refraction).
  function crossing(low:number,high:number,rising:boolean){
    for(let i=0;i<22;i++){
      const mid=(low+high)/2;
      const above=summerSun({year,month,day,minutes:mid}).elevation>-.833;
      if(above===rising)high=mid;else low=mid;
    }return (low+high)/2;
  }
  return {sunrise:crossing(180,720,true),sunset:crossing(960,1439,false)};
}

export function clockTime(minutes:number){
  const m=Math.max(0,Math.min(1439,Math.round(minutes)));
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}

// Nine seated-head positions on each stand: three rows × three lateral points.
// Counts describe these samples only, not real seat numbers or whole-stand area.
export function standSamples(stand:Stand):[number,number,number][]{
  return [2,6,10].flatMap(row=>[-1,0,1].map(offset=>{
    const y=SEATING_LIFT+.87+row*.43+.82;
    if(stand==='east'||stand==='west')return [(stand==='east'?1:-1)*(11.2+row*.79),y,offset*9] as [number,number,number];
    return [offset*5,y,(stand==='south'?1:-1)*(19.9+row*.79)] as [number,number,number];
  }));
}
