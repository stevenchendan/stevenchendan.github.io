import * as T from 'three';
import type { Batch } from './architecture';
import { pavingMaterial } from './materials';

/** AO26 map-inspired temporary event layout; dimensions are interpretive metres. */
export function grandSlamOval(b:Batch){
  const cx=300,cz=188,y=.24;
  const ellipse=(rx:number,rz:number)=>new T.Shape().absellipse(cx,cz,rx,rz,0,Math.PI*2,false,0);
  // Disjoint surface regions, not stacked decals. Source paths lie below this plaza.
  for(const [rx,rz,ix,iz,color] of [[92,55,86,49,'#66706b'],[86,49,81,44,'#b9b6a6'],[81,44,0,0,'#bc9573']] as const){
    const shape=ellipse(rx,rz);if(ix)shape.holes.push(new T.Path(ellipse(ix,iz).getPoints(128).reverse()));
    const g=new T.ShapeGeometry(shape,128);g.rotateX(Math.PI/2);g.translate(0,y,0);
    // Shape coordinates map to positive world z; reverse winding remains double-sided.
    const material=pavingMaterial(color,g);material.side=T.DoubleSide;
    const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;b.group.add(mesh);
  }
  const box=(x:number,h:number,z:number,w:number,d:number,color:string,base=y)=>b.box(cx+x,base+h/2,cz+z,w,h,d,color);
  const bench=(x:number,z:number,angle=0)=>{
    b.box(cx+x,y+.55,cz+z,3.2,.18,.7,'#aa805a',angle);
    for(const s of [-1,1])b.box(cx+x+s*1.15*Math.cos(angle),y+.25,cz+z-s*1.15*Math.sin(angle),.12,.5,.5,'#425961',angle);
  };
  // In the event aerial the warm shade cloth gathers in three overlapping
  // clusters around an open plaza. Metal masts hold the edged fabric in tension.
  const shadeBays=[[-12,-8,-.72],[-7,-4,-.72],[0,-1,-.72],[7,-3,.62],[12,-8,.62],
    [17,-12,.62],[-8,6,.28],[-5,11,.28],[-2,15,.28]];
  const fabricMaterial=new T.MeshStandardMaterial({color:'#b8b1a6',roughness:.93,side:T.DoubleSide});
  const fabricVertices:number[]=[],fabricIndices:number[]=[];
  for(let i=0;i<shadeBays.length;i++){
    const [u,v,a]=shadeBays[i],x=cx+u,z=cz+v,vertices=[x,8.2,z],indices:number[]=[];
    const rim:number[][]=[];
    for(let j=0;j<=16;j++){
      const t=j/16*Math.PI*2,u=9*Math.cos(t),v=3.8*Math.sin(t);
      rim.push([x+u*Math.cos(a)-v*Math.sin(a),6.5+.48*Math.cos(t),z+u*Math.sin(a)+v*Math.cos(a)]);
      vertices.push(...rim[j]);if(j)indices.push(0,j,j+1);
    }
    const offset=fabricVertices.length/3;fabricVertices.push(...vertices);fabricIndices.push(...indices.map(k=>k+offset));
    b.box(x,y+.12,z,.55,.24,.55,'#b4b3a5');b.rod([x,y,z],[x,8.25,z],.12,'#7e979d');
    for(const j of [0,4,8,12])b.rod([x,8.25,z],rim[j],.045,'#aabcc0');
  }
  const fabric=new T.BufferGeometry();fabric.setAttribute('position',new T.Float32BufferAttribute(fabricVertices,3));fabric.setIndex(fabricIndices);fabric.computeVertexNormals();
  const sails=new T.Mesh(fabric,fabricMaterial);sails.castShadow=true;sails.receiveShadow=true;b.group.add(sails);
  // Two occupied levels under a light roof, with an open balcony towards the oval.
  box(8,3.45,-34,62,10,'#607984');box(8,.35,-32.7,64,13.5,'#bda78c',3.75);
  box(8,.3,-34,65,14,'#e2e1d4',7.74);
  box(8,2.75,-37.8,58,.45,'#718b92',4.12);
  for(let x=-22;x<=38;x+=5){
    for(const z of [-39,-28.3])box(x,3.65,z,.19,.19,'#7a8887',4.1);
    box(x,1.08,-26.2,.07,.07,'#5e7277',4.08);
    box(x,1.65,-28.9,3.7,.17,'#2e4d58',1.35);
    bench(x,-27.7);
  }
  for(const h of [4.55,5.09])box(8,.06,-26.2,61,.07,'#64787d',h);
  box(8,1,-25.5,64,5,'#c1a17b');
  for(let i=0;i<3;i++)box(8,.22*(3-i),-22.5+i*.5,64,.5,'#d2b493');
  // Smaller event tenancies, terraces and pergolas retain a readable hierarchy.
  const kiosk=(x:number,z:number,w:number,d:number)=>{
    box(x,3.3,z,w,d,'#318faa');box(x,.24,z,w+.7,d+.7,'#d7ddd8',3.54);
    box(x,1.4,z+d/2+.12,w-1,.22,'#203e4c',1.2);
  };
  kiosk(-45,-16,18,9);kiosk(49,7,14,10);kiosk(-54,15,13,10);kiosk(41,30,19,7);
  const pergola=(x:number,z:number,w:number,d:number)=>{
    box(x,.25,z,w+3,d+3,'#b99b79');
    for(const xx of [-w/2,w/2])for(const zz of [-d/2,d/2])box(x+xx,4.5,z+zz,.18,.18,'#476675');
    for(let xx=-w/2;xx<=w/2;xx+=2)b.box(cx+x+xx,4.8,cz+z,.16,.25,d+.7,'#627f8a');
    for(const zz of [-d/2,d/2])b.box(cx+x,4.65,cz+z+zz,w,.22,.18,'#476675');
    for(let xx=-w/2+2;xx<w/2;xx+=4)bench(x+xx,z);
  };
  pergola(-40,20,16,10);pergola(37,12,17,11);
  // Southern terrace follows the oval rather than another anonymous box.
  for(let i=0;i<7;i++){
    const a=Math.PI*(.24+i*.085),x=57*Math.cos(a),z=36*Math.sin(a),angle=Math.PI/2-a;
    const width=[8,13,9,12][i%4],height=[3.5,4.1,3.7][i%3];
    const skin=['#728b8e','#a87d69','#498a96','#b5a27b'][i%4];
    b.box(cx+x,y+height/2,cz+z,width,height,5,skin,angle);
    b.box(cx+x,y+height+.13,cz+z,width+.3,.26,6.1,'#dddccd',angle);
    b.box(cx+x-2.53*Math.sin(angle),y+1.81,cz+z-2.53*Math.cos(angle),width*.74,1.24,.11,'#263e45',angle);
    bench(x*.78,z*.78,Math.PI/2-a);
  }
  // The 2026 furnishing gallery shows grass lounge floors, low crescent
  // sofas in coral and ivory, exposed white frames and round café tables.
  for(const [u,v,angle] of [[-31,0,-.18],[29,-3,.16],[-13,25,.10]]){
    const lawn=new T.Shape().absellipse(0,0,11.7,6.2,0,Math.PI*2,false,0);
    const geometry=new T.ShapeGeometry(lawn,32);geometry.rotateX(-Math.PI/2);geometry.rotateY(angle);geometry.translate(cx+u,y+.05,cz+v);
    const turf=new T.Mesh(geometry,pavingMaterial('#687c4b',geometry,'lawn'));turf.receiveShadow=true;b.group.add(turf);
    for(const [k,dx,dz] of [[0,-4,.8],[1,3.4,-.75],[2,7,1.1]]){
      const x=cx+u+dx,z=cz+v+dz,turn=angle+k*2.15,cloth=['#cb694c','#e7dacc','#cf8779'][k];
      for(let j=0;j<5;j++){
        const a=turn+(j-2)*.36,s=Math.sin(a),c=Math.cos(a),sx=x+1.65*s,sz=z+1.65*c;
        b.box(sx,y+.50,sz,.68,.25,.64,cloth,a);
        b.box(sx+.27*s,y+.75,sz+.27*c,.68,.55,.13,cloth,a);
        for(const t of [-1,1])b.rod([sx+t*.23*c,y+.07,sz-t*.23*s],[sx+t*.23*c,y+.4,sz-t*.23*s],.027,'#e5e3d7');
      }
      const table=new T.CylinderGeometry(.57,.57,.07,16);table.translate(x,y+.47,z);b.add(table,'#e2d9c9');
      b.rod([x,y+.09,z],[x,y+.44,z],.13,'#af614a');
    }
  }
  // Planted edges and occasional tables soften the hardscape.
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,x=75*Math.cos(a),z=39*Math.sin(a);
    box(x,.65,z,3,1.6,'#aa9b83');box(x,.55,z,2.7,1.3,'#728761',.89);
  }
}
