import * as T from 'three';
import { pointInRing } from './precinctGeometry';

export interface Batch {
  group:T.Group;
  add(g:T.BufferGeometry,color:string):void;
  box(x:number,y:number,z:number,w:number,h:number,d:number,color:string,rotation?:number):void;
  rod(a:number[],b:number[],radius?:number,color?:string):void;
}
type Building={id:string;name?:string;ring:number[][];height:number;base:number;roof:string;structureType?:string};

export function roofTruss(b:Batch,x:number,z:number,width:number,y:number,depth=3){
  for(const h of [y,y+depth])b.rod([x-width/2,h,z],[x+width/2,h,z],.16,'#b9c2c6');
  const bays=Math.ceil(width/6);
  for(let i=0;i<bays;i++){
    const a=x-width/2+i*width/bays,c=a+width/bays;
    b.rod([a,y,z],[c,y+depth,z],.095,'#cbd0cf');
    b.rod([a,y+depth,z],[c,y,z],.095,'#cbd0cf');
    b.rod([a,y,z],[a,y+depth,z],.1,'#cbd0cf');
  }
}

/** Mapped perimeter, segmented glazing and opaque spandrels, not invented windows. */
export function facade(b:Batch,outline:number[][],base:number,height:number,glass='#465a65'){
  for(let i=1;i<outline.length;i++){
    const a=outline[i-1],c=outline[i],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz);
    if(length<.1)continue;
    b.box((a[0]+c[0])/2,base+height/2,(a[1]+c[1])/2,.18,height,length,glass,Math.atan2(dx,dz));
    for(let d=0;d<length;d+=3){const t=d/length,x=a[0]+dx*t,z=a[1]+dz*t;b.rod([x,base,z],[x,base+height,z],.075,'#aeb8ba');}
    for(let h=base+3;h<base+height;h+=3.5)b.rod([a[0],h,a[1]],[c[0],h,c[1]],.09,'#a6b1b5');
  }
}

/** Roof profiles retained for every city tier; details are scale cues, not surveyed. */
export function supportBuilding(b:Batch,building:Building){
  const {ring,base,height}=building,top=base+height;
  if(building.structureType==='Tram Stop'){
    const platform=new T.ExtrudeGeometry(new T.Shape(ring.map(p=>new T.Vector2(p[0],-p[1]))),{depth:.25,bevelEnabled:false});platform.rotateX(-Math.PI/2);b.add(platform,'#b7bcb8');
    return;
  }
  const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
  const left=Math.min(...xs),right=Math.max(...xs),front=Math.min(...zs),back=Math.max(...zs);
  const w=right-left,d=back-front,cx=(left+right)/2,cz=(front+back)/2;
  const ntc=building.id==='810422-1-0', pavilion=building.id==='812707-1-0', centre=building.name==='Centrepiece Melbourne',office=building.id==='808864-1-0';
  const h=ntc?13:centre?15:pavilion?14:office?22:height;
  const shape=new T.Shape(ring.map(p=>new T.Vector2(p[0],-p[1])));
  const mass=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false});mass.rotateX(-Math.PI/2);mass.translate(0,base,0);
  b.add(mass,centre?'#b4aa95':ntc?'#bac4c5':pavilion?'#a8b3b7':'#969e9d');
  const cap=new T.ShapeGeometry(shape);cap.rotateX(-Math.PI/2);cap.translate(0,base+h+.08,0);b.add(cap,'#cbd0ce');
  if(ntc){
    // Eight roof bays, three raised cowls each, observed in the aerial reference.
    // Smooth rise and glazed vertical face give each cowl its scooped profile.
    for(let col=0;col<8;col++)for(let row=0;row<3;row++){
      const x=left+9+col*(w-18)/8,z=front+15+row*13,ww=(w-18)/8-1.3,dd=11;
      if(!pointInRing([x+ww/2,z+dd/2],ring))continue;
      const g=new T.PlaneGeometry(ww,dd,4,10);g.rotateX(-Math.PI/2);
      const p=g.getAttribute('position');
      for(let j=0;j<p.count;j++){const v=(p.getZ(j)+dd/2)/dd,u=p.getX(j)/(ww/2);p.setXYZ(j,p.getX(j)+x+ww/2,base+h+.2+3.8*v*v*(1-.25*u*u),p.getZ(j)+z+dd/2);}
      g.computeVertexNormals();b.add(g,'#e2e3dd');
      b.box(x+ww/2,base+h+1.9,z+dd,ww,3.6,.12,'#7d969e');
    }
    facade(b,ring,base,7,'#344f5d');
  }else if(centre||pavilion||office){
    facade(b,ring,base,centre?8:office?20:9);
    for(let x=left+5;x<right-5;x+=5)for(let z=back-22;z<back-5;z+=3){
      if(pointInRing([x,z],ring))b.box(x,base+h+.25,z,4.4,.15,2.5,'#344b59');
    }
    for(let x=left+4;x<right;x+=9){if(pointInRing([x,cz],ring))b.rod([x,base+h+.2,front+4],[x,base+h+.2,back-4],.06,'#9ba8ac');}
  }else if(building.roof==='Gable'&&w>2&&d>2){
    const axis=w<d?0:1,mid=axis===0?cx:cz,span=axis===0?w:d,rise=Math.min(3.8,span*.22);
    const heightAt=(p:number[])=>top+.12+rise*(1-Math.abs(p[axis]-mid)/(span/2));
    for(const sign of [-1,1]){
      const poly:number[][]=[];
      for(let i=0;i<ring.length-1;i++){
        const a=ring[i],c=ring[i+1],inside=(p:number[])=>sign*(p[axis]-mid)>=0;
        if(inside(a))poly.push(a);
        if(inside(a)!==inside(c)){const t=(mid-a[axis])/(c[axis]-a[axis]);poly.push([a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t]);}
      }
      if(poly.length<3)continue;
      const roof=new T.ShapeGeometry(new T.Shape(poly.map(p=>new T.Vector2(p[0],-p[1]))));roof.rotateX(-Math.PI/2);
      const p=roof.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,heightAt([p.getX(i),p.getZ(i)]));roof.computeVertexNormals();b.add(roof,'#adb7b8');
    }
  }else if(/Hip|Pyramid/.test(building.roof)&&w>2&&d>2){
    const rise=Math.min(3.8,Math.min(w,d)*.22);
    const p=new T.Vector2(cx,-cz),roof=new T.BufferGeometry(),vertices:number[]=[];
    // Apex roof facets for hip/pyramid tiers; shallow pitched facets for gables.
    for(let i=1;i<ring.length;i++)vertices.push(ring[i-1][0],top+.1,ring[i-1][1],ring[i][0],top+.1,ring[i][1],p.x,top+rise,-p.y);
    roof.setAttribute('position',new T.Float32BufferAttribute(vertices,3));roof.computeVertexNormals();
    const mesh=new T.Mesh(roof,new T.MeshStandardMaterial({color:'#adb7b8',roughness:.68,side:T.DoubleSide}));mesh.castShadow=true;mesh.receiveShadow=true;b.group.add(mesh);
  }
  for(let i=1;i<ring.length;i++){
    const a=ring[i-1],p=ring[i];
    b.rod([a[0],base+h+.22,a[1]],[p[0],base+h+.22,p[1]],.11,'#d0d4d1');
    if(!ntc&&!centre&&!pavilion&&Math.hypot(p[0]-a[0],p[1]-a[1])>6){
      for(const t of [.25,.5,.75]){const x=a[0]+(p[0]-a[0])*t,z=a[1]+(p[1]-a[1])*t;b.rod([x,base+.2,z],[x,base+h-.2,z],.045,'#7d8b8e');}
    }
  }
}
