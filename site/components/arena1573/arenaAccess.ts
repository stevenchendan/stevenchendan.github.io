import * as T from 'three';
import type {Batch} from './architecture';

export type ArenaEntry={name:string;x:number;z:number;yaw:number;width:number;height:number;base?:number;depth?:number;steps?:number;canopy?:boolean};
// Gate sides come from M&OP's August 2025 precinct map. Widths, heights and
// recess depths are photo-based approximations, not an evacuation plan.
export const arenaEntries:Record<string,ArenaEntry[]>={
  rla:[
    {name:'GATE 3',x:154,z:-13,yaw:Math.PI,width:12,height:3.6,depth:4,canopy:true},
    {name:'GATE 4',x:245.9,z:74.3,yaw:Math.PI/2,width:27,height:4.7,depth:7},
    {name:'ARENA ACCESS',x:154,z:157,yaw:0,width:10,height:3.4,depth:4},
  ],
  mca:[
    {name:'MARGARET COURT ARENA',x:108,z:-28.68,yaw:2.878,width:20,height:3.6,base:2.4,depth:9,steps:14},
    {name:'ARENA ENTRY',x:75,z:-37.56,yaw:2.878,width:6,height:3.2,depth:4},
    {name:'ARENA EXIT',x:25.6,z:-5,yaw:-Math.PI/2,width:8,height:3.1,depth:4},
  ],
  john:[
    {name:'GATE 6',x:405.87,z:163,yaw:-Math.PI/2,width:18,height:3.7,base:2.4,depth:6,steps:14,canopy:true},
    {name:'GATE 7 WEST',x:446,z:243.8,yaw:0,width:13,height:3.7,depth:5,canopy:true},
    {name:'GATE 7 EAST',x:477,z:243.7,yaw:0,width:13,height:3.7,depth:5,canopy:true},
    {name:'GATE 8',x:517.25,z:166,yaw:Math.PI/2,width:14,height:3.7,base:5.7,depth:6,canopy:true},
  ],
  '1573':[
    {name:'1573 ARENA',x:0,z:-30.45,yaw:Math.PI,width:4.2,height:3.1,depth:3.6,canopy:true},
    {name:'ARENA ACCESS',x:0,z:30.45,yaw:0,width:4.2,height:3.1,depth:3.6},
  ],
};

type Vertex=number[];
/** Subtract an oriented rectangular aperture, retaining interpolated UVs and normals. */
export function cutEntry(geometry:T.BufferGeometry,e:ArenaEntry){
  const base=e.base??0,depth=e.depth??4;
  const inverse=new T.Matrix4().makeRotationY(-e.yaw).multiply(new T.Matrix4().makeTranslation(-e.x,0,-e.z));
  const bounds=new T.Box3(new T.Vector3(-e.width/2,base+.12,-depth),new T.Vector3(e.width/2,base+e.height,.6));
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  if(!geometry.boundingBox!.clone().applyMatrix4(inverse).intersectsBox(bounds))return geometry;
  const local=geometry.clone().applyMatrix4(inverse);local.computeBoundingBox();
  if(!local.boundingBox!.intersectsBox(bounds)){local.dispose();return geometry;}
  const g=local.index?local.toNonIndexed():local;
  const names=Object.keys(g.attributes),sizes=names.map(n=>g.attributes[n].itemSize),offsets:number[]=[];
  let total=0;for(const size of sizes){offsets.push(total);total+=size;}
  const positionOffset=offsets[names.indexOf('position')],out:number[][]=names.map(()=>[]);
  const read=(i:number)=>names.flatMap((n,k)=>Array.from({length:sizes[k]},(_,j)=>g.attributes[n].array[i*sizes[k]+j]));
  const emit=(poly:Vertex[])=>{for(let i=1;i+1<poly.length;i++)for(const v of [poly[0],poly[i],poly[i+1]])names.forEach((_,k)=>out[k].push(...v.slice(offsets[k],offsets[k]+sizes[k])));};
  const planes=[[0,-e.width/2,1],[0,e.width/2,-1],[1,base+.12,1],[1,base+e.height,-1],[2,-depth,1],[2,.6,-1]];
  for(let i=0;i<g.attributes.position.count;i+=3){
    let remaining=[read(i),read(i+1),read(i+2)];
    for(const [axis,bound,sign] of planes){
      if(!remaining.length)break;
      const inside:Vertex[]=[],outside:Vertex[]=[];
      for(let j=0;j<remaining.length;j++){
        const a=remaining[j],b=remaining[(j+1)%remaining.length];
        const da=(a[positionOffset+axis]-bound)*sign,db=(b[positionOffset+axis]-bound)*sign;
        (da>=0?inside:outside).push(a);
        if((da>=0)!==(db>=0)){
          const t=da/(da-db),v=a.map((value,k)=>value+(b[k]-value)*t);inside.push(v);outside.push(v);
        }
      }
      emit(outside);remaining=inside;
    }
  }
  const result=new T.BufferGeometry();names.forEach((n,k)=>result.setAttribute(n,new T.Float32BufferAttribute(out[k],sizes[k])));
  result.applyMatrix4(new T.Matrix4().makeRotationY(e.yaw));result.translate(e.x,0,e.z);
  // Builder batches require indexed geometry even for clipped triangles.
  result.setIndex(Array.from({length:result.attributes.position.count},(_,i)=>i));
  if(g!==local)g.dispose();local.dispose();geometry.dispose();
  return result;
}

export function carveEntries(b:Batch&{batches:Map<string,T.BufferGeometry[]>},entries:ArenaEntry[]){
  for(const [color,geometries] of b.batches)b.batches.set(color,geometries.map(g=>entries.reduce((g,e)=>cutEntry(g,e),g)));
}

function nameplate(b:Batch,e:ArenaEntry,u:number,y:number,v:number,text:string,width:number){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#173a49';ctx.fillRect(0,0,1024,128);
  ctx.fillStyle='#edf2ed';ctx.font='600 63px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,66,980);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const mesh=new T.Mesh(new T.PlaneGeometry(width,.65),new T.MeshStandardMaterial({map:texture,roughness:.8}));
  mesh.rotation.y=e.yaw;mesh.position.set(e.x+u*Math.cos(e.yaw)+v*Math.sin(e.yaw),y,e.z-u*Math.sin(e.yaw)+v*Math.cos(e.yaw));
  mesh.name='entrance-sign';b.group.add(mesh);
}

/** Recessed lobby, doors, lintel and flush approach: no painted-on fake doors. */
export function entrance(b:Batch,e:ArenaEntry){
  const y=e.base??0,d=e.depth??4,c=Math.cos(e.yaw),s=Math.sin(e.yaw);
  const point=(u:number,h:number,v:number)=>[e.x+u*c+v*s,h,e.z-u*s+v*c];
  const box=(u:number,h:number,v:number,w:number,hh:number,dd:number,color:string)=>b.box(...point(u,h,v) as [number,number,number],w,hh,dd,color,e.yaw);
  box(0,y+.06,-d/2,e.width,.12,d+.8,'#9ca7a5');
  for(const side of [-1,1])box(side*(e.width/2+.11),y+e.height/2,-d/2,.22,e.height,d+.9,'#a9b4b3');
  box(0,y+e.height+.14,-d/2,e.width+.44,.28,d+.9,'#c3cac5');
  box(0,y+e.height/2,-d,e.width,e.height,.15,'#18303b');
  // Ticket doors sit well inside the shadow of the outer opening.
  const bays=Math.max(2,Math.floor(e.width/1.5)),bay=e.width/bays;
  for(let i=0;i<bays;i++){
    const u=-e.width/2+(i+.5)*bay;
    box(u,y+1.42,-d+.2,bay-.12,2.76,.10,i%3===1?'#243d49':'#526c73');
    box(u-bay/2+.04,y+1.45,-d+.3,.065,2.9,.12,'#b0bcba');
    box(u,y+1.1,-d+.29,bay*.55,.045,.065,'#cad1cd');
  }
  nameplate(b,e,0,y+e.height+.53,.48,e.name,Math.min(e.width,15));
  if(e.canopy){
    box(0,y+e.height+1.05,1.2,e.width+2.2,.2,3.8,'#cbd2cd');
    for(const side of [-1,1])box(side*(e.width/2+.65),y+(e.height+.95)/2,2.65,.14,e.height+.95,.14,'#657c81');
  }
  if(e.steps){
    const run=e.steps*.34;
    // Broad upper landing and timber seating flank the MCA arrival stair.
    if(e.name==='MARGARET COURT ARENA')for(const side of [-1,1]){
      for(let i=0;i<6;i++){
        const h=y*(6-i)/6;
        box(side*(e.width/2+3),h/2,.7+(i+.5)*run/6,5.5,h,run/6+.03,'#8b5941');
      }
      box(side*(e.width/2+1.5),5,-1,.25,10,.25,'#51616a');
    }
    for(let i=0;i<e.steps;i++){
      const top=y*(e.steps-i)/e.steps;
      box(0,top/2,.7+(i+.5)*.34,e.width+2,top,.35,'#b7beb9');
    }
    for(const u of [-e.width/2,0,e.width/2]){
      b.rod(point(u,y+1,.7),point(u,1,run+.7),.045,'#768b8e');
      for(let i=0;i<=4;i++){const t=i/4;b.rod(point(u,y*(1-t),.7+run*t),point(u,y*(1-t)+1,.7+run*t),.035,'#768b8e');}
    }
    // Side landing connects to the surrounding concourse; no invented short
    // steep "accessible" ramp is substituted for the venue's lift route.
  }else if(y<.2)box(0,.025,1.7,e.width+1.6,.05,3.8,'#969f9b');
}
