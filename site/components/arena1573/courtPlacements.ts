import type { ContextData } from './model';
import { courtFrame, pointInRing } from './precinctGeometry';
import { buildingVenue, courtVenue, venueVisible } from './venueVisibility';

export function courtElevation(x:number,layer?:number){return x>590&&x<709&&layer===1?5.75:0;}

/** Match the centres used by the reconstructed arena interiors. */
export function rallyCourts(data:ContextData){
  const courts=data.features.filter(f=>f.kind==='court'&&f.id!=='way/126844352').map(f=>{
    const frame=courtFrame(f.points);
    const placement={id:f.id,x:frame.x,z:frame.z,rotation:frame.rotation,y:courtElevation(frame.x,f.layer)};
    if(f.id==='way/1239949235')Object.assign(placement,{x:154,z:72,rotation:0});
    if(f.id==='way/1239949236')Object.assign(placement,{x:344.8375,z:78.58});
    if(f.id==='way/126844350')placement.rotation=0;
    return placement;
  });
  const john=data.buildings.find(b=>b.name==='John Cain Arena');
  if(john){const ring=john.ring.slice(0,-1);courts.push({id:'john-cain-interior',x:ring.reduce((s,p)=>s+p[0],0)/ring.length,z:ring.reduce((s,p)=>s+p[1],0)/ring.length,y:0,rotation:0});}
  return courts;
}

/** Stable links and bilingual labels for the 31 individual playing surfaces. */
export function courtDirectory(data:ContextData){
  const features=new Map(data.features.map(f=>[f.id,f]));
  const courts=rallyCourts(data);
  const clay=courts.filter(c=>features.get(c.id)?.surface==='clay').sort((a,b)=>a.x-b.x);
  const landmarks:Record<string,[string,string,string]>={
    'way/126844352':['1573','1573 Arena','1573 Arena'],
    'way/1239949234':['mca','Margaret Court Arena','Margaret Court Arena'],
    'way/1239949235':['rla','Rod Laver Arena','Rod Laver Arena'],
    'way/1239949236':['kia','Kia Arena','Kia Arena'],
    'john-cain-interior':['john','John Cain Arena','John Cain Arena'],
    'way/126844350':['west-show','ANZ Arena (Court 3)','ANZ 球场（3 号球场）'],
  };
  return [{id:'way/126844352',x:0,y:0,z:0,rotation:0},...courts].map((court,i)=>{
    const number=features.get(court.id)?.name?.match(/^#(\d+)$/)?.[1];
    const clayIndex=clay.findIndex(c=>c.id===court.id);
    const letter=String.fromCharCode(65+clayIndex);
    const [key,en,zh]=landmarks[court.id]??(number?[number,`Court ${number}`,`${number} 号球场`]:
      clayIndex>=0?[`clay-${letter.toLowerCase()}`,`Clay court ${letter}`,`红土 ${letter} 场`]:[court.id,`Court ${i}`,`球场 ${i}`]);
    return {...court,key,en,zh,phase:Math.max(0,i-1)*.713,venue:courtVenue(court.id,court.x)};
  });
}

export function venueCourts(list:ReturnType<typeof courtDirectory>,venue:string|undefined){
  return list.filter(c=>c.venue===venue).sort((a,b)=>{
    const numbered=Number(/^\d+$/.test(b.key))-Number(/^\d+$/.test(a.key));
    return numbered||a.en.localeCompare(b.en,'en',{numeric:true});
  });
}

/** Use the arena shell for stadiums and the fenced runoff for practice courts. */
export function cameraCourtAreas(data:ContextData, courts:ReturnType<typeof courtDirectory>){
  return courts.map(court=>{
    const building=data.buildings.find(b=>buildingVenue(b)===court.key);
    let ring=building?.ring??data.features.find(f=>f.id===court.id)?.points??[];
    // These two bowls are built procedurally around a smaller mapped court.
    if(court.key==='1573'||court.key==='kia'){
      const [w,d]=court.key==='1573'?[22,31]:[30,40];
      ring=Array.from({length:32},(_,i)=>{
        const angle=i*Math.PI/16;
        return [court.x+w*Math.sign(Math.cos(angle))*Math.sqrt(Math.abs(Math.cos(angle))),
          court.z+d*Math.sign(Math.sin(angle))*Math.sqrt(Math.abs(Math.sin(angle)))];
      });
    }
    const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
    return {key:court.key,venue:court.venue,ring,height:building?building.base+building.height*.6:court.y,
      left:Math.min(...xs),right:Math.max(...xs),front:Math.min(...zs),back:Math.max(...zs)};
  });
}

export function courtInView(areas:ReturnType<typeof cameraCourtAreas>,eye:{x:number;y:number;z:number},
  target:{x:number;y:number;z:number},visibleSpan:number,selected:string,surroundings:boolean){
  const drop=eye.y-target.y;
  if(drop<=0.001)return null;
  let nearest=Infinity, key:string|null=null;
  for(const area of areas){
    if(!venueVisible(area.venue,selected,surroundings))continue;
    if(Math.max(area.right-area.left,area.back-area.front)<visibleSpan*.16)continue;
    const surface=eye.y>area.height?area.height:0;
    const t=(eye.y-surface)/drop;
    if(t<0||t>=nearest)continue;
    const x=eye.x+(target.x-eye.x)*t,z=eye.z+(target.z-eye.z)*t;
    if(x<area.left||x>area.right||z<area.front||z>area.back||!pointInRing([x,z],area.ring))continue;
    nearest=t;key=area.key;
  }
  return key;
}
