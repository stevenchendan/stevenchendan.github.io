import * as T from 'three';
import type { Batch } from './architecture';
import type { ContextData } from './model';
import { eventCrossings, eventLayout, pocketRing } from './eventLayout';
import type { GroundSurfaces } from './ground';

function sign(b:Batch,text:string,x:number,y:number,z:number,width:number,angle=0){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#174c60';ctx.fillRect(0,0,512,128);
  ctx.font='bold 38px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f4f1df';ctx.fillText(text,256,64);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const mesh=new T.Mesh(new T.PlaneGeometry(width,width/4),new T.MeshStandardMaterial({map:texture,roughness:.85}));
  mesh.position.set(x,y,z);mesh.rotation.y=angle;b.group.add(mesh);
}

function slattedBench(b:Batch,x:number,z:number,back=1){
  for(let i=0;i<5;i++)b.box(x,.48,z+(i-2)*.132,2.5,.095,.108,'#ac8767');
  for(const side of [-1,1]){
    const leg=x+side*.86;
    b.box(leg,.23,z,.10,.46,.51,'#41565d');
    b.box(leg,.52,z+back*.27,.08,.54,.08,'#41565d');
  }
  for(const y of [.68,.84])b.box(x,y,z+back*.28,2.5,.11,.095,'#ac8767');
}

/** Sheltered benches on the 1573 apron, with a tensioned fabric hypar. */
function benchCanopy(b:Batch){
  const corners=[[-9,3.45,34.1],[8.6,4.45,34.1],[8.6,3.45,39.4],[-9,4.45,39.4]];
  const point=(u:number,v:number)=>{
    const weights=[(1-u)*(1-v),u*(1-v),u*v,(1-u)*v];
    const pos=[0,0,0];
    for(let n=0;n<4;n++)for(let k=0;k<3;k++)pos[k]+=corners[n][k]*weights[n];
    // Scalloped edges bow toward the middle; all four corners meet their posts.
    pos[0]+=(1-2*u)*.45*Math.sin(Math.PI*v);
    pos[2]+=(1-2*v)*.5*Math.sin(Math.PI*u);
    return pos;
  };
  const vertices:number[]=[],indices:number[]=[];
  for(let i=0;i<=16;i++)for(let j=0;j<=6;j++){
    const n=i*7+j;
    vertices.push(...point(i/16,j/6));
    if(i<16&&j<6)indices.push(n,n+1,n+7,n+7,n+1,n+8);
  }
  const cloth=new T.BufferGeometry();
  cloth.setAttribute('position',new T.Float32BufferAttribute(vertices,3));cloth.setIndex(indices);cloth.computeVertexNormals();
  const sail=new T.Mesh(cloth,new T.MeshStandardMaterial({color:'#eeeae0',side:T.DoubleSide,roughness:.94}));
  sail.castShadow=true;sail.receiveShadow=true;b.group.add(sail);
  for(const [x,y,z] of corners){
    b.rod([x,0,z],[x,y+.14,z],.08,'#58696d');
    b.box(x,.045,z,.32,.09,.32,'#8d989a');
  }
  for(let i=0;i<12;i++)for(const side of [0,1]){
    b.rod(point(i/12,side),point((i+1)/12,side),.04,'#b3bdba');
    b.rod(point(side,i/12),point(side,(i+1)/12),.04,'#b3bdba');
  }
  for(const x of [-5.8,-.2,5.4])slattedBench(b,x,37.25);
}

export function arenaEntryFacilities(b:Batch){
  for(const z of [-13.5,12.5]){
    const x=-28.9,front=x+2.35;
    b.box(x,.11,z,5.15,.22,9.0,'#8a9695');
    b.box(x,1.59,z,4.7,2.86,8.45,'#7d918e');
    // Individual steel jambs, fascia and counter frame a recessed service hatch.
    b.box(front+.035,1.88,z,.07,1.25,4.4,'#283f46');
    for(const offset of [-2.25,2.25])b.box(front+.065,1.88,z+offset,.14,1.42,.11,'#bcc6bf');
    b.box(front+.29,1.22,z,.64,.12,4.7,'#c9b397');
    b.box(front+.12,2.96,z,.18,.48,8.5,'#25596a');
    sign(b,z<0?'INFORMATION':'WATER',front+.22,2.96,z,2.15,Math.PI/2);
    for(const end of [-1,1])for(let n=0;n<8;n++){
      b.box(x-1.9+n*.5,1.52,z+end*4.245,.13,2.72,.095,'#a3aca2');
    }
    const awning=new T.BoxGeometry(6.5,.16,9.35);
    awning.rotateZ(-.065);awning.translate(x+.57,3.48,z);b.add(awning,'#dedfd4');
    for(const side of [-1,1]){
      const edge=z+side*4.3;
      b.rod([x+3.45,0,edge],[x+3.45,3.31,edge],.065,'#475b61');
      b.rod([x+3.45,2.65,edge],[front,3.38,edge],.04,'#475b61');
    }
    for(let off=-4;off<=4;off+=1.33)b.rod([x-2.65,3.8,z+off],[x+3.78,3.39,z+off],.04,'#aeb7b2');
  }
  benchCanopy(b);
  for(const [x,z] of [[-17.5,-34],[17.5,34]]){
    b.box(x,1.32,z,.76,2.64,.22,'#254f60');
    b.box(x,2.7,z,.76,.12,.22,'#75bbcb');
    sign(b,'1573',x,2.28,z+.12,.74);
    sign(b,'1573',x,2.28,z-.12,.74,Math.PI);
    for(const side of [-1,1]){
      const cx=x+side*.39;
      b.box(cx,.5,z+1.5,.71,1,.55,'#56696d');
      b.box(cx,1.015,z+1.5,.76,.08,.6,'#9baaa7');
      b.box(cx,1.06,z+1.5,.43,.015,.22,'#32474d');
    }
  }
}

/** Original, tree-free event dressing; paths and courts remain unobstructed. */
export function eventFacilities(b:Batch,ground:GroundSurfaces,data:ContextData){
  for(const crossing of eventCrossings(data))for(let offset=-3.4;offset<=3.4;offset+=.85){
    const {x,z,dx,dz}=crossing,cx=x-dz*offset,cz=z+dx*offset;
    ground.strip([cx-dx*1.8,cz-dz*1.8],[cx+dx*1.8,cz+dz*1.8],.42,.026,'#eee9d9');
  }
  const bench=(x:number,z:number)=>slattedBench(b,x,z);
  const table=(x:number,z:number)=>{
    const top=new T.CylinderGeometry(.9,.9,.09,16);top.translate(x,.85,z);b.add(top,'#c4aa85');
    b.rod([x,.05,z],[x,.8,z],.09,'#485a60');
    slattedBench(b,x,z+1.5);slattedBench(b,x,z-1.5,-1);
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
