import {useEffect,useMemo} from 'react';
import {useGLTF} from '@react-three/drei';
import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {courtDirectory} from './courtPlacements';
import {benchLayout} from './playerBenches';
import {venueVisible} from './venueVisibility';

type Court=ReturnType<typeof courtDirectory>[number];

function furniture(kind:'chair'|'bench'){
  const parts:T.BufferGeometry[]=[];
  function piece(g:T.BufferGeometry,tint:string){
    const flat=g.index?g.toNonIndexed():g;
    flat.deleteAttribute('uv');
    const c=new T.Color(tint),rgb=new Float32Array(flat.attributes.position.count*3);
    for(let i=0;i<rgb.length;i+=3)c.toArray(rgb,i);
    flat.setAttribute('color',new T.BufferAttribute(rgb,3));parts.push(flat);
    if(flat!==g)g.dispose();
  }
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>piece(new T.BoxGeometry(w,h,d).translate(x,y,z),color);
  const rod=(a:number[],b:number[],radius:number,color:string)=>{
    const from=new T.Vector3(...a),to=new T.Vector3(...b),axis=to.clone().sub(from);
    const g=new T.CylinderGeometry(radius,radius,axis.length(),8);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize()));
    g.translate(...from.lerp(to,.5).toArray());piece(g,color);
  };
  if(kind==='chair'){
    for(const s of [-1,1]){
      rod([s*.48,.03,-.51],[s*.37,2.23,-.24],.045,'#647b85');
      rod([s*.48,.03,.54],[s*.37,2.23,.23],.045,'#647b85');
      rod([s*.40,1.72,.34],[s*.40,2.61,-.18],.032,'#c2d0cd');
      rod([s*.40,2.61,-.18],[s*.40,2.61,-.36],.032,'#c2d0cd');
    }
    for(let i=1;i<7;i++)rod([-.42,i*.29,.54-i*.043],[.42,i*.29,.54-i*.043],.033,'#c5d1cf');
    box(0,2.18,0,.84,.13,.60,'#304956');box(0,2.45,-.27,.77,.55,.08,'#3c5861');
    box(0,1.69,.32,.72,.065,.34,'#607a84');
    box(0,2.48,.37,.52,.05,.23,'#30424b');
  }else{
    box(0,.42,0,1.86,.12,.54,'#cbd8d9');box(0,.64,-.25,1.86,.38,.09,'#abc4d0');
    for(const x of [-.72,.72])box(x,.21,0,.10,.41,.43,'#476476');
    box(.28,.49,-.035,.42,.045,.38,'#f2ede5');
    box(-1.19,.21,0,.43,.41,.39,'#246181');box(-1.19,.435,0,.45,.055,.40,'#e4ebe6');
    const bag=new T.SphereGeometry(1,12,8).scale(.48,.17,.16).translate(.58,.20,.41);
    piece(bag,'#31434b');rod([.33,.31,.41],[.42,.42,.41],.018,'#708083');rod([.42,.42,.41],[.70,.34,.41],.018,'#708083');
  }
  const result=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return result;
}
function assemble(actors:T.Group,courts:Court[]){
  const group=new T.Group();group.name='court-officials-and-benches';
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.83});
  const chair=furniture('chair'),bench=furniture('bench');
  const byVenue=new Map<string,Court[]>();
  for(const court of courts){const list=byVenue.get(court.venue)??[];list.push(court);byVenue.set(court.venue,list);}
  const batches:T.InstancedMesh[]=[];
  for(const [venue,list] of byVenue){
    const matrices=new Map<string,T.Matrix4[]>(),root=new T.Group();root.userData.venue=venue;group.add(root);
    for(const court of list){
      const {side}=benchLayout(court.key),angle=-side*Math.PI/2;
      const courtMatrix=new T.Matrix4().makeRotationY(court.rotation).setPosition(court.x,court.y,court.z);
      function add(name:string,x:number,y:number,z:number,yaw:number){
        const m=new T.Matrix4().makeRotationY(yaw).setPosition(x,y,z).premultiply(courtMatrix);
        const queue=matrices.get(name)??[];queue.push(m);matrices.set(name,queue);
      }
      const rla=court.key==='rla',home=court.key==='1573',stadium=['rla','mca','john','kia','1573','west-show'].includes(court.key);
      const chairX=side*(rla?8.02:home?9.24:stadium?8.2:7.5);
      add('ChairUmpire',chairX,rla?2.48:home?2.27:2.34,0,angle);
      if(!rla&&!home){
        add('chair',chairX,.095,0,angle);
        for(const end of [-1,1])add('bench',chairX+side*.37,.095,end*(stadium?4.8:4.1),angle);
      }
      // One attendant kneels outside each post. Four more cover the corners.
      for(const end of [-1,1]){
        add(end===1?'NetCrew':'NetCrewBraid',end*6.98,.125,end*.88,-end*Math.PI/2);
        for(const flank of [-1,1]){
          add(flank*end===1?'BaselineCrew':'BaselineCrewBraid',flank*(stadium?7.6:6.6),.125,end*(stadium?17.9:16.4),end>0?Math.PI:0);
        }
      }
    }
    for(const [name,placements] of matrices){
      const g=name==='chair'?chair:name==='bench'?bench:(actors.getObjectByName(name) as T.Mesh).geometry;
      const mesh=new T.InstancedMesh(g,material,placements.length);mesh.name=name;
      placements.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);batches.push(mesh);
    }
  }
  return {group,dispose(){batches.forEach(m=>m.dispose());chair.dispose();bench.dispose();material.dispose();}};
}
export default function CourtStaff({courts,venue,surroundings}:{courts:Court[];venue:string;surroundings:boolean}){
  const {scene}=useGLTF('/models/tennis/court-crew.glb');
  const crew=useMemo(()=>assemble(scene,courts),[scene,courts]);
  useEffect(()=>()=>crew.dispose(),[crew]);
  for(const group of crew.group.children)group.visible=venueVisible(group.userData.venue,venue,surroundings);
  return <primitive object={crew.group} dispose={null}/>;
}

