import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Seat = {x:number;y:number;z:number;angle:number};

function oval(x:number,y:number,z:number,w:number,h:number,d:number) {
  const shape=new T.SphereGeometry(1,8,6);
  shape.scale(w,h,d);shape.translate(x,y,z);
  return shape;
}

function limb(a:[number,number,number],b:[number,number,number],r1:number,r2:number){
  const start=new T.Vector3(...a),end=new T.Vector3(...b);
  const direction=end.clone().sub(start);
  const g=new T.CylinderGeometry(r2,r1,direction.length(),7);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()));
  const mid=start.lerp(end,.5);
  g.translate(mid.x,mid.y,mid.z);
  return g;
}

export function seatedCrowd(seats:Seat[]){
  const group=new T.Group();
  const occupied=seats.filter((_,i)=>((Math.imul(i+1,2654435761)>>>0)%100)<26);
  const jacket=new T.CylinderGeometry(.208,.168,.36,9);
  jacket.scale(1,1,.72);jacket.rotateX(-.09);jacket.translate(0,.34,-.045);
  const shirts=[jacket,oval(0,.50,-.063,.207,.075,.135)];
  const trousers:T.BufferGeometry[]=[oval(0,.115,-.045,.165,.115,.134)];
  const skin:T.BufferGeometry[]=[oval(0,.67,-.085,.10,.137,.101),oval(0,.537,-.078,.069,.071,.065)];
  const shoes:T.BufferGeometry[]=[];
  for(const side of [-1,1]){
    const x=side*.1;
    trousers.push(limb([x,.12,-.045],[x*1.24,.082,-.30],.096,.079));
    trousers.push(limb([x*1.24,.082,-.30],[x*1.24,-.17,-.32],.075,.052));
    shoes.push(oval(x*1.24,-.205,-.36,.068,.048,.125));
    shirts.push(limb([side*.169,.478,-.057],[side*.211,.355,-.097],.079,.064));
    skin.push(limb([side*.211,.355,-.097],[side*.213,.238,-.18],.057,.045));
    skin.push(limb([side*.213,.238,-.18],[side*.123,.201,-.27],.046,.035));
    skin.push(oval(side*.112,.199,-.279,.046,.032,.055));
  }
  function batch(parts:T.BufferGeometry[],people:Seat[],colors:string[],salt:number){
    const geometry=mergeGeometries(parts)!;
    parts.forEach(part=>part.dispose());
    const mesh=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({roughness:.85}),people.length);
    const transform=new T.Object3D(),color=new T.Color();
    people.forEach((s,i)=>{
      const seed=Math.imul(Math.round((s.x+50)*94+(s.z+60)*151),2654435761)>>>0;
      transform.position.set(s.x,s.y,s.z);
      transform.rotation.y=s.angle+((seed%101)/100-.5)*.22;
      transform.scale.setScalar(.92+(seed%17)*.011);
      transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
      mesh.setColorAt(i,color.set(colors[(seed>>>salt)%colors.length]));
    });
    mesh.receiveShadow=true;
    group.add(mesh);
  }
  batch(shirts,occupied,['#eee9d6','#294b68','#eadfba','#527f8d','#c26543','#5c7051','#d3ab58','#b8c8d4'],5);
  batch(trousers,occupied,['#354758','#49555a','#717d80','#8b826f'],9);
  batch(skin,occupied,['#c89a79','#9a6a4c','#dfb49a','#79543f','#caa387'],14);
  batch(shoes,occupied,['#e2ded2','#617078','#383e45'],12);
  const hair=new T.SphereGeometry(1,8,5,0,Math.PI*2,0,1.45);
  hair.scale(.105,.132,.107);hair.translate(0,.69,-.079);
  batch([hair],occupied,['#372f2c','#725236','#9a806a','#453a34','#bbb5a4'],18);
  const caps=occupied.filter((_,i)=>i%4===1);
  const crown=new T.SphereGeometry(1,9,4,0,Math.PI*2,0,Math.PI/2);
  crown.scale(.116,.083,.117);crown.translate(0,.753,-.078);
  batch([crown,oval(0,.751,-.172,.097,.013,.084)],caps,['#ece9dc','#315674','#d7cbb0'],8);
  return group;
}
