import * as T from 'three';
import type { Batch } from './architecture';
import type { ContextData } from './model';
import { eventCrossings, eventLayout, pocketRing } from './eventLayout';
import type { GroundSurfaces } from './ground';

function sign(b:Batch,text:string,x:number,y:number,z:number,width:number){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#174c60';ctx.fillRect(0,0,512,128);
  ctx.font='bold 38px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f4f1df';ctx.fillText(text,256,64);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const mesh=new T.Mesh(new T.PlaneGeometry(width,width/4),new T.MeshStandardMaterial({map:texture,roughness:.85}));
  mesh.position.set(x,y,z);b.group.add(mesh);
}

/** Original, tree-free event dressing; paths and courts remain unobstructed. */
export function eventFacilities(b:Batch,ground:GroundSurfaces,data:ContextData){
  for(const crossing of eventCrossings(data))for(let offset=-3.4;offset<=3.4;offset+=.85){
    const {x,z,dx,dz}=crossing,cx=x-dz*offset,cz=z+dx*offset;
    ground.strip([cx-dx*1.8,cz-dz*1.8],[cx+dx*1.8,cz+dz*1.8],.42,.026,'#eee9d9');
  }
  const bench=(x:number,z:number,rotation=0)=>{
    b.box(x,.5,z,2.6,.15,.65,'#ae8b65',rotation);
    for(const side of [-1,1])b.box(x+side*Math.cos(rotation),.24,z-side*Math.sin(rotation),.12,.48,.55,'#45585e',rotation);
  };
  const table=(x:number,z:number)=>{
    const top=new T.CylinderGeometry(.9,.9,.09,16);top.translate(x,.85,z);b.add(top,'#c4aa85');
    b.rod([x,.05,z],[x,.8,z],.09,'#485a60');
    bench(x,z+1.5);bench(x,z-1.5);
  };
  for(const p of eventLayout(data)){
    const ring=pocketRing(p);
    ground.polygon(pocketRing(p,1.1),-.045,'#d1cfc0');
    ground.polygon(ring,p.kind==='lawn'?.095:-.02,p.kind==='lawn'?'#829078':'#c5bba9');
    // Low, continuous edging gives the islands a readable boundary and real scale.
    ring.forEach((a,i)=>{
      const c=ring[(i+1)%ring.length],dx=c[0]-a[0],dz=c[1]-a[1];
      b.box((a[0]+c[0])/2,.065,(a[1]+c[1])/2,.18,.16,Math.hypot(dx,dz),'#d5d1c1',Math.atan2(dx,dz));
    });
    if(p.kind==='lawn'){
      // Two planted textures, with small low beds rather than reinstating trees.
      for(const side of [-1,1]){
        b.box(p.x+side*3.7,.22,p.z,1,.32,7,'#7a8b65');
        bench(p.x,p.z+side*5);
      }
      continue;
    }
    if(p.kind==='food'){
      for(const side of [-1,1]){
        const x=p.x+side*3.5,z=p.z-5;
        b.box(x,1.65,z,5.7,3.3,4.2,side<0?'#337e91':'#b77752');
        b.box(x,2.05,z+2.12,4.5,1.45,.06,'#203d45');
        b.box(x,1.25,z+2.45,5,.16,1,'#c9b28c');
        b.box(x,3.45,z+.7,6.2,.2,6,'#e1dcc8');
        for(const s of [-1,1])b.rod([x+s*2.6,0,z+3.5],[x+s*2.6,3.4,z+3.5],.06,'#53666b');
        sign(b,side<0?'FOOD':'COFFEE',x,3,z+2.16,4.7);
      }
      table(p.x-3.5,p.z+4.4);table(p.x+3.5,p.z+4.4);
      // Short queue rails in front of each counter, entirely inside this pocket.
      for(const side of [-1,1])for(const x of [p.x+side*3.5-1.2,p.x+side*3.5+1.2]){
        b.rod([x,0,p.z-1.4],[x,1,p.z-1.4],.04,'#53666b');
        b.rod([x,1,p.z-1.4],[x,1,p.z+.6],.035,'#53666b');
      }
    }else{
      // An open-sided shade pergola, with a small original tennis screen.
      for(const x of [-6,6])for(const z of [-6,3])b.rod([p.x+x,0,p.z+z],[p.x+x,4,p.z+z],.10,'#647571');
      for(let x=-6;x<=6;x+=.75)b.box(p.x+x,4.08,p.z-1.5,.38,.16,9.5,'#c8b99b');
      for(const z of [-6,3])b.box(p.x,3.87,p.z+z,12.5,.25,.22,'#66736b');
      table(p.x-3,p.z);table(p.x+3,p.z);
      b.box(p.x,2.4,p.z-6,6,3.4,.35,'#234650');
      b.box(p.x,2.45,p.z-5.80,5.3,2.6,.025,'#317ea0');
      for(const x of [-1.6,1.6])b.box(p.x+x,2.45,p.z-5.78,.025,2,.01,'#e8eee0');
      for(const y of [1.45,2.45,3.45])b.box(p.x,y,p.z-5.77,3.2,.025,.01,'#e8eee0');
      sign(b,'WATCH & RELAX',p.x,4.8,p.z-5.75,6);
      bench(p.x-3,p.z+6);bench(p.x+3,p.z+6);
    }
    // Low wayfinding posts and waste bins complete the human-scale detail.
    b.box(p.x+p.width/2-1,.48,p.z+6,.6,.95,.6,'#36545c');
    b.box(p.x-p.width/2+.7,1.3,p.z+6,.18,2.6,.18,'#5f7377');
    sign(b,'COURTS →',p.x-p.width/2+.7,2.65,p.z+6.12,2.6);
  }
}
