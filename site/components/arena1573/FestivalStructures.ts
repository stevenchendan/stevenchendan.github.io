import * as T from 'three';
import type { Batch } from './architecture';
import {eventStructures, type EventStructure} from './eventWorlds';
import {seatedCrowd,type SpectatorSeat} from './seatedCrowd';
import {gardenSquare} from './GardenSquare';

const steel='#56666b', wood='#bb9673', linen='#e9e4d5', dark='#233746', blue='#1575b8', white='#f3f1e4';

/** One sign atlas per zone; all original artwork, including the broadcast court. */
function signSheet(b:Batch){
  const signs:{geometry:T.BufferGeometry;label:string;screen:boolean;color:string}[]=[];
  return {
    add(geometry:T.BufferGeometry,label:string,screen:boolean,color:string){signs.push({geometry,label,screen,color});},
    finish(){
      if(!signs.length)return;
      const cells=signs.map(s=>[s.label,s.screen,s.color].join('|')),keys=[...new Set(cells)];
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128*keys.length;
      const ctx=canvas.getContext('2d')!;
      keys.forEach((k,i)=>{
        const {label,screen,color}=signs[cells.indexOf(k)],y=128*i;
        ctx.fillStyle=color;ctx.fillRect(0,y,512,128);
        if(screen){
          ctx.fillStyle='#173851';ctx.fillRect(0,y,114,128);
          ctx.fillStyle='#177bb0';ctx.fillRect(122,y+5,384,118);
          ctx.fillStyle='#2471ba';ctx.fillRect(183,y+20,261,88);
          ctx.strokeStyle='#eff4e7';ctx.lineWidth=2;ctx.beginPath();
          for(const xx of [183,230,312,397,444]){ctx.moveTo(xx,y+20);ctx.lineTo(xx,y+108);}
          for(const yy of [20,31,97,108]){ctx.moveTo(183,y+yy);ctx.lineTo(444,y+yy);}
          ctx.moveTo(230,y+64);ctx.lineTo(397,y+64);ctx.stroke();
          ctx.fillStyle='#f4e7bb';ctx.fillRect(174,y+68,6,10);ctx.fillRect(449,y+48,6,10);
          ctx.fillStyle=white;ctx.font='bold 19px Arial';ctx.textAlign='left';ctx.textBaseline='middle';
          ctx.fillText('AO',12,y+36);ctx.font='bold 13px Arial';ctx.fillText('MELBOURNE',12,y+66);ctx.fillText('ON COURT',12,y+90);
        }else{
          ctx.fillStyle=white;ctx.font='bold 57px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,256,y+66,474);
          ctx.fillStyle='#86cbd9';ctx.fillRect(13,y+15,5,98);
        }
      });
      const vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
      signs.forEach(({geometry},i)=>{
        const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),slot=keys.indexOf(cells[i]),offset=vertices.length/3;
        for(let j=0;j<p.count;j++){
          vertices.push(p.getX(j),p.getY(j),p.getZ(j));uvs.push(.003+.994*uv.getX(j),(keys.length-slot-1+.006+.988*uv.getY(j))/keys.length);
        }
        for(const j of geometry.index!.array)indices.push(offset+j);
        geometry.dispose();
      });
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
      const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
      b.group.add(new T.Mesh(g,new T.MeshBasicMaterial({map:tex,side:T.DoubleSide})));
    }
  };
}

function build(b:Batch,p:EventStructure,signs:ReturnType<typeof signSheet>,seats:SpectatorSeat[]){
  const c=Math.cos(p.rotation),s=Math.sin(p.rotation),w=p.width,d=p.depth;
  const world=(u:number,y:number,v:number)=>[p.x+c*u+s*v,y,p.z-s*u+c*v];
  const seat=(u:number,y:number,v:number,angle:number)=>{
    const [x,h,z]=world(u,y,v);seats.push({x,y:h,z,angle:p.rotation+angle});
  };
  const box=(u:number,y:number,v:number,width:number,height:number,depth:number,color:string,angle=0)=>{
    const [x,h,z]=world(u,y,v);b.box(x,h,z,width,height,depth,color,p.rotation+angle);
  };
  const rod=(a:number[],to:number[],radius:number,color=steel)=>b.rod(world(a[0],a[1],a[2]),world(to[0],to[1],to[2]),radius,color);
  const add=(g:T.BufferGeometry,u:number,y:number,v:number,color:string)=>{
    g.rotateY(p.rotation);const [x,h,z]=world(u,y,v);g.translate(x,h,z);b.add(g,color);
  };
  const sign=(label:string,u:number,y:number,v:number,width:number,height:number,screen=false,angle=0)=>{
    const g=new T.PlaneGeometry(width,height);g.rotateY(angle+p.rotation);const [x,h,z]=world(u,y,v);g.translate(x,h,z);
    signs.add(g,label,screen,p.zone==='ballpark'?'#176e91':p.zone==='topcourt'?'#644077':'#25495b');
  };
  const rail=(a:number[],z:number[],base:number)=>{
    for(const h of [.52,1.04])rod([a[0],h+base,a[1]],[z[0],h+base,z[1]],.045);
    const count=Math.ceil(Math.hypot(z[0]-a[0],z[1]-a[1])/3);
    for(let i=0;i<=count;i++){const u=a[0]+(z[0]-a[0])*i/count,v=a[1]+(z[1]-a[1])*i/count;rod([u,base,v],[u,base+1.08,v],.046);}
  };
  const pole=(u:number,v:number,h:number,r=.09)=>rod([u,0,v],[u,h,v],r);
  const banner=(u:number,v:number,height:number,accent:string)=>{
    pole(u,v,height,.055);
    const cloth=new T.BoxGeometry(.86,2.25,.045,4,1,1),pos=cloth.getAttribute('position');
    for(let i=0;i<pos.count;i++)pos.setZ(i,pos.getZ(i)+.12*Math.cos(pos.getX(i)*5));
    cloth.computeVertexNormals();add(cloth,u+.43,height-1.2,v,accent);
    sign('AO',u+.42,height-1.14,v+.19,.75,.43);
  };
  const bench=(u:number,v:number,width:number)=>{
    box(u,.47,v,width,.14,.56,wood);
    for(const side of [-1,1])box(u+side*width*.32,.21,v,.12,.42,.44,steel);
    for(let offset=-width/2+.43;offset<width/2-.2;offset+=.83)seat(u+offset,.54,v,0);
  };
  const parasol=(u:number,v:number,r:number,accent:string)=>{
    pole(u,v,2.6,.05);add(new T.ConeGeometry(r,.73,8),u,2.88,v,accent);
    add(new T.CylinderGeometry(.72,.72,.09,10),u,.79,v,wood);
    const spots=[[-.95,0],[.95,0],[0,.95],[0,-.95]];
    for(const [dx,dz] of spots){
      box(u+dx,.44,v+dz,.46,.1,.46,linen);box(u+dx,.20,v+dz,.1,.4,.1,steel);
      seat(u+dx,.49,v+dz,Math.atan2(dx,dz));
    }
  };
  const deck=(color=wood)=>box(0,.13,0,w-.1,.26,d-.1,color);
  if(p.kind==='umbrellas'||p.kind==='lawn'){
    // Small picnic areas retain the park aerial between groups of furniture.
    if(p.zone==='terrace')box(0,.025,0,w-.1,.05,d-.1,'#c3af91');
    const nx=Math.max(2,Math.floor(w/4.6)),nz=Math.max(1,Math.floor(d/4.1));
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
      const u=-w/2+(i+.5)*w/nx,v=-d/2+(j+.5)*d/nz;
      if(p.kind==='lawn'){bench(u,v-1,2.2);bench(u,v+1,2.2);box(u,.75,v,2.2,.1,.88,wood);}
      else parasol(u,v,Math.min(2.25,w/nx*.42,d/nz*.41),i%3===0?'#e0ad77':linen);
    }
    return;
  }
  if(p.kind==='shop'||p.kind==='bar'||p.kind==='marquee'){
    box(0,.055,0,w-.1,.11,d-.1,'#b79775');
    const bays=Math.max(2,Math.round(w/5.4)),span=w/bays,front=d*.39,ridge=p.kind==='marquee'?4.9:4.5;
    for(let i=0;i<bays;i++){
      const u=-w/2+(i+.5)*span;
      for(const side of [-1,1]){
        // Ridge and shallow gables instead of featureless shipping containers.
        const roof=new T.BoxGeometry(span-.06,.16,d/2+.04);
        roof.rotateX(side*.25);add(roof,u,ridge-d*.061,side*d*.25,linen);
      }
      for(const v of [-front,front])pole(u-span*.45,v,ridge-.5,.085);
      if(p.kind==='marquee'){bench(u,0,span*.7);continue;}
      const accent=p.kind==='shop'?'#3f7893':p.zone==='topcourt'?'#916f9d':'#67978e';
      box(u,1.74,-d*.15,span-.1,3.45,d*.57,accent);
      box(u,1.95,d*.14,span*.83,1.7,.09,dark);
      box(u,1.18,d*.19,span*.87,.14,.57,wood);
      for(const edge of [-1,1])box(u+edge*span*.42,2.1,d*.15,.09,2.15,.16,linen);
      box(u,3.20,d*.18,span-.06,.6,.22,accent);
      if(p.kind==='shop'){
        // Hanging colours and merchandise tables make the open shopfront legible.
        for(let n=0;n<4;n++)box(u-span*.3+n*span*.2,2.08,d*.16,span*.13,.73,.10,['#548eb1','#eee9d3','#9a735e','#b1b68a'][n]);
        box(u,.78,d*.31,span*.57,.16,.76,wood);
        for(const side of [-1,1])box(u+side*span*.20,.4,d*.31,.12,.8,.52,steel);
      }
    }
    if(p.name)sign(p.name,0,3.24,d*.18+.13,Math.min(w*.7,10),.61);
    if(p.name)banner(-w*.47,d*.43,4.5,p.zone==='topcourt'?'#8069a3':'#1688bc');
    return;
  }
  if(p.kind==='screen'||p.kind==='stage'){
    const stage=p.kind==='stage',h=stage?(p.zone==='topcourt'?8.5:5.9):6,front=stage?d*.33:d*.06;
    if(stage){
      deck(dark);box(0,.78,0,w*.94,1.03,d*.86,dark);
      for(const end of [-1,1])for(const face of [-1,1]){
        const u=end*w*.43,v=face*d*.36;
        for(const o of [-.23,.23])pole(u+o,v,h);
        for(let y=1;y<h-.8;y+=1.25)rod([u-.23,y,v],[u+.23,y+1.2,v],.055,linen);
      }
      if(p.zone==='topcourt'){
        // Faceted festival canopy observed from above, with radial fabric bays.
        const cut=3.15,outline=[[-w/2+cut,-d/2],[w/2-cut,-d/2],[w/2,-d/2+cut],[w/2,d/2-cut],[w/2-cut,d/2],[-w/2+cut,d/2],[-w/2,d/2-cut],[-w/2,-d/2+cut]];
        const apex=[0,h+1.65,-d*.11];
        outline.forEach(([x,z],i)=>{
          const [xx,zz]=outline[(i+1)%outline.length],g=new T.BufferGeometry();
          const vertices=[...apex,xx,h,zz,x,h,z,...apex,x,h,z,xx,h,zz];
          g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute([.5,1,1,0,0,0,.5,1,0,0,1,0],2));
          g.computeVertexNormals();add(g,0,0,0,i%2?'#3b75ad':'#3375ba');
          rod([x,h,z],apex,.045,'#7ba3bf');
          rod([x,h,z],[xx,h,zz],.105,'#34729b');
        });
      }else{
        const canopy=new T.BoxGeometry(w-.2,.28,d-.12);canopy.rotateX(-.055);add(canopy,0,h,0,blue);
      }
      box(0,(h+1.2)/2,-d*.36,w*.88,h-1.2,.25,dark);
      for(const end of [-1,1])for(let n=0;n<4;n++)box(end*w*.407,h-1.5-n*.59,front,1.45,.55,.81,dark);
      box(0,h-.5,front+.08,w*.68,.9,.22,dark);sign(p.name,0,h-.5,front+.21,w*.53,.8);
      for(const end of [-1,1])banner(end*(w*.45-.5),d*.45,h*.81,p.zone==='ballpark'?'#e3b655':'#62548d');
    }else for(const end of [-1,1]){pole(end*w*.31,0,5,.2);box(end*w*.31,.14,0,1.6,.28,2,steel);}
    const width=w*(stage?.67:.90),height=Math.min(width*.42,h*(stage?.52:.76)),v=stage?-d*.34:.08;
    box(0,h*.55,v,width+.38,height+.38,.36,dark);sign('',0,h*.55,v+.19,width,height,true);
    return;
  }
  if(p.kind==='playcourt'||p.kind==='hotshots'){
    const junior=p.kind==='hotshots',surface=junior?'#239ebb':'#8574aa',line=junior?'#fff0c5':white;
    box(0,.06,0,w-.02,.12,d-.02,junior?'#efa940':'#568dae');
    const length=w*.82,breadth=d*.73;
    box(0,.126,0,length,.015,breadth,surface);
    for(const side of [-1,1]){
      box(0,.14,side*breadth/2,length,.012,.075,line);box(side*length/2,.14,0,.075,.012,breadth,line);
      box(side*length*.17,.14,0,.075,.012,breadth*(junior?.8:1),line);
      box(side*length*.335,.14,0,length*.33,.012,.07,line);
      pole(0,side*(breadth*.52),.94,.055);
    }
    for(const y of [.38,.55,.73,.87])rod([0,y,-breadth*.52],[0,y,breadth*.52],y===.87?.029:.014,y===.87?white:dark);
    for(const end of [-1,1])for(const n of [-.32,0,.32])pole(end*w*.48,n*d,junior?.65:1.08,.045);
    for(const end of [-1,1])rod([end*w*.48,junior?.60:.99,-d*.32],[end*w*.48,junior?.60:.99,d*.32],.036,junior?'#f3bc55':'#7f7b97');
    if(p.name)sign(p.name,0,1.03,-d*.49,w*.58,.98);
    return;
  }
  if(p.kind==='slide'){
    // Twin 6 m and 2.5 m inflatable lanes, with rails following their fall.
    deck('#72bec3');
    for(const side of [-1,1]){
      const v=side*d*.21,height=side<0?6:2.5,span=d*.38;
      box(-w*.33,height/2,v,w*.16,height,span,'#228eb6');
      box(-w*.33,height+.27,v,w*.16,.52,span,'#eec257');
      for(let n=0;n<12;n++){
        const t=n/12,t1=(n+1)/12,curve=(k:number)=>.48+height*(1-k*k*(3-2*k));
        const x=-w*.25+t*w*.64,xx=-w*.25+t1*w*.64,y=curve(t),yy=curve(t1);
        const slope=new T.BoxGeometry(Math.hypot(xx-x,yy-y)+.04,.16,span*.78);slope.rotateZ(Math.atan2(yy-y,xx-x));add(slope,(x+xx)/2,(y+yy)/2,v,'#72d5da');
        for(const edge of [-1,1])rod([x,y+.23,v+edge*span*.42],[xx,yy+.23,v+edge*span*.42],.22,side<0?'#248dc3':'#f6c551');
      }
      for(const edge of [-1,1])rod([-w*.4,height+.3,v+edge*span*.4],[-w*.4,height+1.6,v+edge*span*.4],.20,'#2eaac2');
      box(w*.40,.52,v,w*.15,.63,span,side<0?'#56bdd1':'#f1c65a');
    }
    return;
  }
  // A two-level shaded viewing gallery with an open and accessible court face.
  const floor=3.65,top=7.1,sideline=-w*.43,back=w*.37;
  box(0,.10,0,w-.1,.20,d-.1,steel);
  box(w*.23,1.65,0,w*.36,3.25,d*.84,'#4e7381');
  for(const u of [sideline,back])for(let i=0;i<5;i++)pole(u,-d*.44+i*d*.22,top-.2,.1);
  box(0,floor,0,w*.9,.35,d*.9,wood);
  for(let i=0;i<3;i++)box(w*(-.24+i*.205),floor+.20+i*.23,0,w*.19,.20+i*.46,d*.75,wood);
  rail([sideline,-d*.44],[sideline,d*.44],floor+.17);
  for(const end of [-1,1])rail([sideline,end*d*.44],[back,end*d*.44],floor+.17);
  const roof=new T.BoxGeometry(w-.1,.22,d-.1);roof.rotateZ(-.075);add(roof,0,top,0,linen);
  box(sideline,top-.48,0,.2,.64,d*.88,'#315e70');
  sign(p.name,sideline-.12,top-.48,0,d*.70,.58,false,-Math.PI/2);
  for(let r=0;r<3;r++)for(let v=-d*.35;v<=d*.35;v+=.92)seat(w*(-.24+r*.205),floor+.30+r*.46,v,Math.PI/2);
}

export function festivalStructures(venue:(id:string)=>Batch,spectators:(id:string)=>T.Group,onlyZone?:string){
  for(const zone of new Set(eventStructures.map(p=>p.zone))){
    if(onlyZone && zone!==onlyZone)continue;
    const b=venue(zone),sheet=signSheet(b),seats:SpectatorSeat[]=[];
    if(zone==='garden')gardenSquare(b);
    for(const p of eventStructures.filter(p=>p.zone===zone))build(b,p,sheet,seats);
    if(seats.length)spectators(zone).add(seatedCrowd(seats,.68));
    sheet.finish();
  }
}
