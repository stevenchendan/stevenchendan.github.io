import * as T from 'three';
import type { Batch } from './architecture';

/** AO26 map-inspired temporary event layout; dimensions are interpretive metres. */
export function grandSlamOval(b:Batch){
  const cx=300,cz=188,y=.24;
  const ellipse=(rx:number,rz:number)=>new T.Shape().absellipse(cx,cz,rx,rz,0,Math.PI*2,false,0);
  // Disjoint surface regions, not stacked decals. Source paths lie below this plaza.
  for(const [rx,rz,ix,iz,color] of [[92,55,86,49,'#c8b69a'],[86,49,81,44,'#e2dacb'],[81,44,0,0,'#cfb28a']] as const){
    const shape=ellipse(rx,rz);if(ix)shape.holes.push(new T.Path(ellipse(ix,iz).getPoints(128).reverse()));
    const g=new T.ShapeGeometry(shape,128);g.rotateX(Math.PI/2);g.translate(0,y,0);
    // Shape coordinates map to positive world z; reverse winding remains double-sided.
    const mesh=new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:1,side:T.DoubleSide}));mesh.receiveShadow=true;b.group.add(mesh);
  }
  const box=(x:number,h:number,z:number,w:number,d:number,color:string,base=y)=>b.box(cx+x,base+h/2,cz+z,w,h,d,color);
  const bench=(x:number,z:number,angle=0)=>{
    b.box(cx+x,y+.55,cz+z,3.2,.18,.7,'#aa805a',angle);
    for(const s of [-1,1])b.box(cx+x+s*1.15*Math.cos(angle),y+.25,cz+z-s*1.15*Math.sin(angle),.12,.5,.5,'#425961',angle);
  };
  // Eight separate tensile petals and structural masts replace the solid cone.
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,x=cx+13*Math.cos(a),z=cz+13*Math.sin(a),vertices=[x,10.5,z],indices:number[]=[];
    const rim:number[][]=[];
    for(let j=0;j<=32;j++){
      const t=j/32*Math.PI*2,u=10*Math.cos(t),v=5.3*Math.sin(t);
      rim.push([x+u*Math.cos(a)-v*Math.sin(a),7.5+1.1*Math.cos(t),z+u*Math.sin(a)+v*Math.cos(a)]);
      vertices.push(...rim[j]);if(j)indices.push(0,j,j+1);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
    const sail=new T.Mesh(g,new T.MeshStandardMaterial({color:i%2?'#d9d7c3':'#c9cbb7',roughness:.9,side:T.DoubleSide}));sail.castShadow=true;b.group.add(sail);
    const px=cx+20*Math.cos(a),pz=cz+20*Math.sin(a);
    b.box(px,y+.2,pz,1.7,.4,1.7,'#b4b3a5');b.rod([px,y,pz],[px,11,pz],.14,'#7e979d');
    for(const j of [0,8,16,24])b.rod([px,11,pz],rim[j],.055,'#aabcc0');
    for(let j=1;j<rim.length;j++)b.rod(rim[j-1],rim[j],.045,'#abb8b4');
  }
  // Raised broadcast screen facing the gathering space.
  box(0,7,-22,20,.55,'#264a60',3);box(0,5.3,-21.68,18,.08,'#258caf',3.8);
  for(const x of [-8,8])box(x,4,-22,.35,.5,'#60777e');
  // Main hospitality pavilion: glazed frontage, canopy, terrace steps and rails.
  box(8,7,-34,62,10,'#58676c');box(8,.35,-34,65,13,'#d9ddd6',7.24);
  box(8,4.5,-28.9,59,.18,'#527f91',1.4);
  for(let x=-20;x<=36;x+=4)box(x,6.2,-28.65,.12,.15,'#d3dbd7',.8);
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
  for(let i=0;i<9;i++){
    const a=Math.PI*(.28+i*.055),x=54*Math.cos(a),z=34*Math.sin(a);
    b.box(cx+x,y+2.6,cz+z,10,5.2,5,'#8f7770',Math.PI/2-a);
    b.box(cx+x,y+5.35,cz+z,10.3,.3,5.5,'#c9cec8',Math.PI/2-a);
    bench(x*.78,z*.78,Math.PI/2-a);
  }
  for(const side of [-1,1])for(let i=0;i<6;i++)bench(side*29,-9+i*4,Math.PI/2);
  // Planted edges and occasional tables soften the hardscape.
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,x=75*Math.cos(a),z=39*Math.sin(a);
    box(x,.65,z,3,1.6,'#aa9b83');box(x,.55,z,2.7,1.3,'#728761',.89);
  }
}
