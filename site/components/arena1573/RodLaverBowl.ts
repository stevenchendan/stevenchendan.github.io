import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Batch } from './architecture';
import { seatedCrowd } from './seatedCrowd';
import { sectionDoors, seatSections } from './seating';
import { rodLaverBanks, rodLaverRow, rodLaverRowPoint, type RodLaverTier } from './rodLaverProfile';

// Match-day architecture and room layout references:
// https://ausopen.com/articles/news/concert-tennis-mode-transformation-rod-laver-arena
// https://commons.wikimedia.org/wiki/File:Rod_Laver_Arena_Melbourne_Park_Australian_Open_2023_quarter_final_dusk.jpg

type Outline = (w:number,d:number,r:number)=>T.Shape;
type Seat = {x:number;y:number;z:number;angle:number;seed:number};
type Lettering = 'AO'|'Australian Open'|'ROD LAVER ARENA'|'CENTRE COURT'|'Melbourne Park'|'screen'|'portal'|'MELBOURNE'|'door';
const panelWords:Lettering[]=['AO','Australian Open','ROD LAVER ARENA','CENTRE COURT','Melbourne Park','screen','portal','MELBOURNE','door'];

// The score screens and fascia share one original atlas. The screens carry
// tournament graphics so the reconstructed rally never shows a fictitious score.
class Displays {
  pieces:T.BufferGeometry[]=[];
  wallMark(kind:Lettering,path:T.Shape,fraction:number,width:number,height:number){
    const vertices:number[]=[],uv:number[]=[],indices:number[]=[],n=panelWords.indexOf(kind);
    for(let i=0;i<=8;i++){
      const t=i/8,f=(1+fraction+(t-.5)*width/path.getLength())%1;
      const p=path.getPointAt(f),v=path.getTangentAt(f);
      const x=p.x-.045*v.y,z=-p.y-.045*v.x;
      vertices.push(x,2.12-height/2,z,x,2.12+height/2,z);
      const u=.004+.992*(1-t);
      uv.push(u,1-(n+.955)/panelWords.length,u,1-(n+.045)/panelWords.length);
      if(i<8){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    g.setIndex(indices);g.computeVertexNormals();this.pieces.push(g);
  }
  panel(kind:Lettering,x:number,y:number,z:number,w:number,h:number,angle:number,floor=false,door=1){
    const g=new T.PlaneGeometry(w,h),uv=g.getAttribute('uv');
    const n=panelWords.indexOf(kind);
    for(let i=0;i<uv.count;i++){
      const s=kind==='door'?(door-1+uv.getX(i))/20:uv.getX(i);
      uv.setXY(i,.004+.992*s,1-(n+.955-.91*uv.getY(i))/panelWords.length);
    }
    if(floor)g.rotateX(-Math.PI/2);
    g.rotateY(angle);g.translate(x,y,z);this.pieces.push(g);
  }
  finish(group:T.Group){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128*panelWords.length;
    const ctx=canvas.getContext('2d')!;
    panelWords.forEach((word,i)=>{
      const y=i*128;
      if(word==='screen'||word==='portal'){ctx.fillStyle='#1d2529';ctx.fillRect(0,y,512,128);}
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f0f2ed';
      ctx.font=word==='AO'?'italic bold 116px Arial':word==='Melbourne Park'?'64px Arial':'bold 80px Arial';
      if(word==='door'){
        ctx.fillStyle='#e5e7e4';ctx.font='bold 20px Arial';
        for(let door=1;door<=20;door++)ctx.fillText(String(door),(door-.5)*512/20,y+64,24);
      }else if(word==='portal'){
        ctx.fillStyle='#164d72';ctx.fillRect(0,y+3,512,122);
        ctx.fillStyle='#40b3de';ctx.fillRect(0,y+5,512,12);
        ctx.font='bold 59px Arial';ctx.fillStyle='#f1f5f1';ctx.fillText('AO   |   MELBOURNE',256,y+72,492);
      }else if(word==='screen'){
        ctx.fillStyle='#0c4b81';ctx.fillRect(0,y,512,128);ctx.fillStyle='#216f9c';ctx.fillRect(6,y+7,305,92);
        ctx.strokeStyle='#c5e3e6';ctx.lineWidth=2;ctx.beginPath();
        for(const u of [28,52,160,268,292]){ctx.moveTo(u,y+19);ctx.lineTo(u,y+89);}
        for(const v of [19,28,54,80,89]){ctx.moveTo(28,y+v);ctx.lineTo(292,y+v);}
        ctx.stroke();ctx.fillStyle='#afe74a';ctx.fillRect(106,y+37,8,5);
        ctx.fillStyle='#ecf6fd';ctx.font='italic bold 62px Arial';ctx.fillText('AO',413,y+47);
        ctx.font='bold 13px Arial';ctx.fillText('ROD LAVER ARENA',414,y+84);
        ctx.fillStyle='#081d35';ctx.fillRect(0,y+100,512,28);
        ctx.fillStyle='#eaf3fb';ctx.textAlign='left';ctx.font='bold 16px Arial';ctx.fillText('AUSTRALIAN OPEN',16,y+115);
      }else{
        if(word==='MELBOURNE')ctx.font='bold 85px Arial';
        ctx.fillText(word,256,y+66,480);
      }
    });
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
    const geometry=mergeGeometries(this.pieces)!;this.pieces.forEach(g=>g.dispose());
    const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({map:texture,alphaTest:.28,toneMapped:false}));
    mesh.name='rod-laver-displays';group.add(mesh);
  }
}

// A ribbon between two closed outlines, including vertical walls viewed from
// inside the bowl. Sampling at equal arc length keeps the curved corners smooth.
function ribbon(b:Batch,inner:T.Shape,outer:T.Shape,low:number,high:number,color:string){
  const count=112,vertices:number[]=[],indices:number[]=[],uv:number[]=[];
  for(let i=0;i<=count;i++){
    const a=inner.getPointAt(i/count),c=outer.getPointAt(i/count);
    vertices.push(a.x,low,-a.y,c.x,high,-c.y);uv.push(i/count,0,i/count,1);
    if(i<count){const n=2*i;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();b.add(g,color);
}

function railing(b:Batch,path:T.Shape,base:number,height:number){
  const count=Math.ceil(path.getLength()/2.5);
  for(let i=0;i<count;i++){
    const p=path.getPointAt(i/count),q=path.getPointAt((i+1)/count);
    b.rod([p.x,base,-p.y],[p.x,base+height,-p.y],.038,'#35434a');
    for(const h of [.52,height])b.rod([p.x,base+h,-p.y],[q.x,base+h,-q.y],.043,'#35434a');
  }
}

function seatFurniture(b:Batch,displays:Displays){
  // Player benches and camera wells live beside the sideline, behind the chair.
  for(const s of [-1,1]){
    const z=s*5.0;
    b.box(-9.1,.24,z,1.48,.43,3.7,'#197ba7');b.box(-9.23,.53,z,.76,.13,3.22,'#ced9da');
    b.box(-9.59,.82,z,.12,.55,3.22,'#b9cccf');
    b.box(-10.6,.54,z,1.0,1.02,.74,'#263c47');
    for(const dz of [-1.25,1.25])b.box(-9.06,.47,z+dz,.86,.2,.13,'#48575d');
    b.box(10.65,.43,s*9.5,.77,.78,3.2,'#293338');
    b.rod([10.5,.79,s*9.5],[10.1,1.45,s*9.5],.12,'#435056');
    b.box(10.05,1.54,s*9.5,.65,.39,.45,'#212a2d');
    for(const off of [-1,1])b.box(-11.55,.38,s*11.0+off*.55,.5,.74,.56,'#273a40');
  }
  // Tall umpire stand with ladder, standing deck and small overhead hood.
  for(const dz of [-.42,.42]){
    b.rod([-8.55,.14,dz],[-8.18,2.36,dz],.107,'#303e46');
    b.rod([-7.35,.14,dz],[-7.96,2.36,dz],.095,'#33454d');
  }
  for(let y=.42;y<2.25;y+=.33)b.rod([-8.54+.16*y,y,-.43],[-8.54+.16*y,y,.43],.048,'#b3bdba');
  b.box(-8.02,2.4,0,1,.16,1.22,'#27383d');b.box(-8.35,2.81,0,.13,.83,1.17,'#27383d');
  const chairPanel=new T.BoxGeometry(.32,2.08,1.11);chairPanel.rotateZ(-.17);chairPanel.translate(-7.74,1.29,0);b.add(chairPanel,'#234a5a');
  displays.panel('AO',-7.49,1.51,0,.93,.46,Math.PI/2);
  b.rod([-8.42,2.45,-.51],[-8.58,3.55,-.51],.066,'#354650');
  b.box(-8.13,3.58,0,1.14,.13,1.35,'#364750');
  for(const s of [-1,1])displays.panel('MELBOURNE',0,.135,s*15.2,6.45,1.06,s<0?Math.PI:0,true);
}

function courtWalls(b:Batch,outline:Outline,displays:Displays){
  const rim=outline(13.1,21.5,6.78);
  ribbon(b,rim,rim,.095,3.08,'#1d282c');
  ribbon(b,rim,outline(13.48,21.88,6.9),3.08,3.08,'#707d80');
  const words:Lettering[]=['AO','Melbourne Park','ROD LAVER ARENA','CENTRE COURT','Australian Open'];
  for(let i=0;i<30;i++){
    displays.wallMark(words[i%words.length],rim,(i+.5)/30,3.6,.92);
  }
  for(const s of [-1,1]){
    const x=-13.01,z=s*10.2;
    b.box(x,1.08,z,.15,2.13,2.42,'#10171e');
    b.box(x+.13,2.17,z,.38,.19,2.7,'#68757a');
    b.box(0,.94,s*21.38,8.15,.72,.28,'#111d22');
  }
}

function seatingBank(b:Batch,outline:Outline,tier:RodLaverTier,seats:Seat[]){
  const bank=rodLaverBanks[tier];
  const sections=seatSections.rla.filter(section=>section.tier===tier);
  const edges=sections.map(section=>{
    const center=Math.atan2(section.z,section.x);
    const deviations=section.footprints.flat().map(p=>{
      const angle=Math.atan2(p.z,p.x)-center;return Math.atan2(Math.sin(angle),Math.cos(angle));
    });
    return {center,start:center+Math.min(...deviations),end:center+Math.max(...deviations)};
  }).sort((a,c)=>a.center-c.center);
  const directions=edges.map((edge,i)=>{
    const next=edges[(i+1)%edges.length],end=next.start+(i===edges.length-1?Math.PI*2:0);
    const angle=(edge.end+end)/2;return {x:Math.cos(angle),z:Math.sin(angle)};
  });
  const shape=(row:number)=>{const {w,d,r}=rodLaverRow(tier,row);return outline(w,d,r);};
  for(let row=0;row<bank.rows;row++){
    const front=shape(row),back=shape(row+1),middle=shape(row+.52);
    const spec=rodLaverRow(tier,row+.52),floor=rodLaverRow(tier,row).y;
    ribbon(b,front,front,floor-bank.rise,floor,'#6b777b');ribbon(b,front,back,floor,floor,'#949d9e');
    const aisles=directions.map(dir=>rodLaverRowPoint(spec.w,spec.d,spec.r,dir.x,dir.z));
    for(const p of aisles){
      const l=Math.hypot(p.x/spec.w,p.z/spec.d);
      const nx=p.x/spec.w/l,nz=p.z/spec.d/l,angle=Math.atan2(nx,nz);
      b.box(p.x,floor+.014,p.z,1.13,.028,bank.tread,'#b9bcb5',angle);
      b.box(p.x+nx*bank.tread*.24,floor+bank.rise*.25,p.z+nz*bank.tread*.24,1.12,bank.rise*.5,bank.tread*.5,'#bfc2bd',angle);
    }
    const count=Math.floor(middle.getLength()/.54);
    for(let i=0;i<count;i++){
      const f=(i+.35*(row%2))/count,p=middle.getPointAt(f);
      if(aisles.some(a=>Math.abs(a.x-p.x)<1.12&&Math.hypot(a.x-p.x,a.z+p.y)<.8))continue;
      const v=middle.getTangentAt(f),seed=Math.imul((i+17)*(row+127)+(tier==='upper'?11843:233),2654435761)>>>0;
      seats.push({x:p.x,y:floor+.4,z:-p.y,angle:Math.atan2(v.y,v.x),seed});
    }
  }
}

function bowlGalleries(b:Batch,outline:Outline,displays:Displays){
  const lower=rodLaverRow('lower',rodLaverBanks.lower.rows),upper=rodLaverRow('upper',0);
  const ledge=outline(lower.w,lower.d,lower.r),inner=outline(upper.w,upper.d,upper.r);
  ribbon(b,ledge,inner,lower.y,lower.y,'#788287');
  ribbon(b,inner,inner,lower.y,upper.y,'#56666d');
  railing(b,ledge,lower.y,.96);
  for(const door of sectionDoors.rla){
    const p=rodLaverRowPoint(upper.w,upper.d,upper.r,door.x,door.z);
    const dx=p.x-T.MathUtils.clamp(p.x,-upper.w+upper.r,upper.w-upper.r);
    const dz=p.z-T.MathUtils.clamp(p.z,-upper.d+upper.r,upper.d-upper.r),l=Math.hypot(dx,dz);
    const v={x:dz/l,y:dx/l},angle=Math.atan2(v.y,v.x);
    const x=p.x-.15*v.y,z=p.z-.15*v.x;
    b.box(x,lower.y+.95,z,2.55,1.86,.28,'#202a32',angle);
    for(const s of [-1,1])b.box(x+s*v.x*1.38,lower.y+.97,z-s*v.y*1.38,.19,1.94,.5,'#849397',angle);
    b.box(x,upper.y-.1,z,3.29,.44,1.1,'#35454a',angle);
    const face=Math.atan2(-v.y,-v.x);
    displays.panel(door.id%3===0?'Australian Open':'portal',x-.58*v.y,upper.y-.14,z-.58*v.x,2.94,.43,face);
    displays.panel('door',x-.19*v.y,lower.y+1.12,z-.19*v.x,.35,1.38,face,false,door.id);
  }
  const upperBack=rodLaverRow('upper',rodLaverBanks.upper.rows),gallery=outline(48.3,57.1,25.5);
  ribbon(b,outline(upperBack.w,upperBack.d,upperBack.r),gallery,upperBack.y-.32,upperBack.y-.32,'#68777e');
  ribbon(b,gallery,gallery,upperBack.y-.32,24.8,'#3e5058');
  for(let i=0;i<104;i++){
    const p=gallery.getPointAt(i/104),q=gallery.getPointAt((i+1)/104),v=gallery.getTangentAt(i/104);
    const angle=Math.atan2(v.y,v.x);
    b.box(p.x,22.85,-p.y,.14,2.6,.17,'#7c8a8c',angle);
    b.rod([p.x,23.8,-p.y],[q.x,23.8,-q.y],.085,'#65767b');
    if(i%7<4)b.box(p.x-.12*v.y,22.1,-p.y-.12*v.x,1.3,.43,.09,'#a0a294',angle);
  }
  // Roof-edge catwalk, floodlight clusters, diagonal hangers and broadcast screens.
  const catwalk=outline(35.8,35.8,3.7);
  ribbon(b,catwalk,catwalk,23.75,24.8,'#59666a');
  ribbon(b,outline(37.7,37.7,4.2),catwalk,23.72,23.72,'#46555c');
  const arc=catwalk.getLength();
  for(let i=0;i<72;i++){
    const f=i/72,p=catwalk.getPointAt(f),q=catwalk.getPointAt((i+1)/72),v=catwalk.getTangentAt(f);
    b.rod([p.x,23.08,-p.y],[q.x,23.08,-q.y],.13,'#56666c');
    b.rod([p.x,23.08,-p.y],[q.x,23.86,-q.y],.065,'#96a2a1');
    if(i%3!==0)continue;
    const angle=Math.atan2(v.y,v.x);
    b.box(p.x,23.42,-p.y,arc/72*.7,.56,.65,'#293b45',angle);
    for(const s of [-1,0,1])b.box(p.x+v.x*s*.79-v.y*.36,23.39,-p.y-v.y*s*.79-v.x*.36,.61,.30,.12,'#f1efd8',angle);
  }
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const x=sx*29.1,z=sz*35.2,angle=Math.atan2(-x,-z),nx=Math.sin(angle),nz=Math.cos(angle);
    b.box(x,21.47,z,6.4,3.63,.41,'#263337',angle);
    displays.panel('screen',x+nx*.215,21.47,z+nz*.215,6.05,3.3,angle);
    for(const s of [-1,1]){
      const px=x+s*Math.cos(angle)*2.15,pz=z-s*Math.sin(angle)*2.15;
      b.rod([px,23.23,pz],[px,24.85,pz],.07,'#5e6b6d');
    }
  }
}

export function rodLaverBowl(b:Batch,outline:Outline,seatGeometry:T.BufferGeometry){
  const displays=new Displays(),seats:Seat[]=[];
  courtWalls(b,outline,displays);seatFurniture(b,displays);
  seatingBank(b,outline,'lower',seats);seatingBank(b,outline,'upper',seats);
  bowlGalleries(b,outline,displays);
  const chairs=new T.InstancedMesh(seatGeometry,new T.MeshStandardMaterial({roughness:.65,side:T.DoubleSide}),seats.length);
  const transform=new T.Object3D(),color=new T.Color(),palette=['#578cab','#64a0bb','#6697af','#4e829f','#87afc1'];
  seats.forEach((p,i)=>{
    transform.position.set(p.x,p.y,p.z);transform.rotation.y=p.angle;transform.updateMatrix();
    chairs.setMatrixAt(i,transform.matrix);chairs.setColorAt(i,color.set(palette[p.seed%palette.length]));
  });
  chairs.name='rod-laver-seats';chairs.receiveShadow=true;b.group.add(chairs);
  const crowd=seatedCrowd(seats,.71);crowd.name='precinct-spectators';crowd.visible=false;
  b.group.add(crowd);displays.finish(b.group);
}
