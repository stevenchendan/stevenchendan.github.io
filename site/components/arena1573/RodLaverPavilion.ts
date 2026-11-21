import * as T from 'three';
import type {Batch} from './architecture';

/** Eastern Pavilion envelope, reconstructed from the user's ground photograph
 * and COX's completed-project photographs. Dimensions are approximate. */
export function pavilionEnvelope(b:Batch){
  // Extruded curved silver hood: its tapered cheeks frame an open glass face.
  const section=new T.Shape();
  section.moveTo(-30,5.2);section.quadraticCurveTo(-38,10,-36,17.2);
  section.quadraticCurveTo(0,22,36,17.2);section.quadraticCurveTo(38,10,30,5.2);
  section.lineTo(27.8,5.2);section.quadraticCurveTo(32.7,10,32.4,16);
  section.quadraticCurveTo(0,20, -32.4,16);section.quadraticCurveTo(-32.7,10,-27.8,5.2);section.closePath();
  const shell=new T.ExtrudeGeometry(section,{depth:31.5,bevelEnabled:false,curveSegments:24});
  shell.rotateY(Math.PI/2);shell.translate(216,0,74.28);b.add(shell,'#cbd0ce');

  // Glass is physically distinct from cladding. Floor plates and mullions remain
  // visible through it; no opaque wall sits behind the entrance glazing.
  const width=256,height=128,pixels=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const v=y/(height-1),a=x/width*Math.PI*2;
    const cloud=Math.pow(Math.max(0,Math.sin(a*7+v*32)*Math.sin(a*3-v*19)),3)*.32;
    const sky=v>.5?new T.Color().setRGB(.33+cloud,.53+cloud*.8,.69+cloud*.6):
      new T.Color().setRGB(.17+.07*Math.sin(a*12)**2,.22,.23);
    const i=(y*width+x)*4;pixels[i]=sky.r*255;pixels[i+1]=sky.g*255;pixels[i+2]=sky.b*255;pixels[i+3]=255;
  }
  const reflection=new T.DataTexture(pixels,width,height);reflection.mapping=T.EquirectangularReflectionMapping;
  reflection.colorSpace=T.SRGBColorSpace;reflection.needsUpdate=true;
  const glass=new T.MeshPhysicalMaterial({color:'#8eb6c4',transparent:true,opacity:.53,
    envMap:reflection,envMapIntensity:1.3,roughness:.1,metalness:.28,clearcoat:1,side:T.DoubleSide,depthWrite:false});
  const px=(y:number)=>242.1+(y-5.2)*.23;
  const top=(u:number)=>18-2*Math.pow(u/32.4,2);
  for(let u=-28;u<28;u+=3.5){
    for(const [lo,hi] of [[5.35,10.65],[10.95,top(u+1.75)]]){
      const a=u+.06,c=u+3.44;
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute([
        px(lo),lo,74.28-a,px(lo),lo,74.28-c,px(hi),hi,74.28-c,
        px(lo),lo,74.28-a,px(hi),hi,74.28-c,px(hi),hi,74.28-a],3));g.computeVertexNormals();
      const pane=new T.Mesh(g,glass);pane.name='rla-pavilion-glazing';b.group.add(pane);
    }
    b.rod([px(5.2)+.04,5.2,74.28-u],[px(top(u))+.04,top(u),74.28-u],.045,'#4f6570');
  }
  for(const y of [5.3,8,10.8,13.6,16])b.box(px(y)+.07,y,74.28,.08,.07,y===16?54:57,'#70848b');
  // Interior columns and slender balustrades give the glazing depth and scale.
  for(const z of [49,60,88,99]){
    b.box(236,11,z,.22,11.5,.22,'#becac8');
    b.box(236,5.7,z,4,.7,1.5,'#7c6d57');
    b.box(235,11.3,z,3.6,.7,1.4,'#82715c');
  }
  b.rod([240.5,11.9,47],[240.5,11.9,101],.045,'#a9bbbd');
  for(let z=47;z<=101;z+=3)b.rod([240.5,10.9,z],[240.5,11.9,z],.025,'#9daeb0');
  // Triangular panel joints along both bowed side cheeks.
  for(const sign of [-1,1])for(let x=216;x<247;x+=3.5)for(let row=0;row<6;row++){
    const t=row/6,q=(row+1)/6;
    const point=(xx:number,v:number)=>[xx,5.2+9.6*v+2.4*v*v,74.28+sign*(30+16*v-10*v*v+.025)];
    b.rod(point(x,t),point(Math.min(x+3.5,247.5),t),.013,'#a3afae');
    b.rod(point(x,t),point(x,q),.013,'#a3afae');
    b.rod(point(x,t),point(Math.min(x+3.5,247.5),q),.013,'#a3afae');
  }
}
