// Tailor the neutral skinned athlete in bind space. Cut the mesh at garment hems
// so jersey, skin and shorts keep distinct edges as joints bend.
import * as T from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const skinTone=new T.Color('#c89779'),jersey=new T.Color('#277b9a'),shorts=new T.Color('#213944');
const trim=new T.Color('#cee3db'),sock=new T.Color('#e4e9e3');
const jerseyPanel=new T.Color('#206980'),shortsPanel=new T.Color('#334954');
const smooth=T.MathUtils.smoothstep;
const key=p=>[p.x,p.y,p.z].map(n=>Math.round(n*1e5)).join('/');

function blend(a,b,t){
  const influence=new Map();
  for(const [v,f] of [[a,1-t],[b,t]])for(let j=0;j<v.joints.length;j++){
    if(!v.weights[j])continue;
    influence.set(v.joints[j],(influence.get(v.joints[j])??0)+v.weights[j]*f);
  }
  const top=[...influence].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((s,v)=>s+v[1],0);
  return {p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),joints:top.map(v=>v[0]),weights:top.map(v=>v[1]/sum)};
}

function measure(p,axis){
  if(axis==='wrist')return Math.abs(p.x);
  if(axis==='neckline')return p.y-1.439-1.12*p.x*p.x-.19*(.078-p.z);
  if(axis==='raglan')return Math.abs(p.x)-.124-(1.416-p.y)*.73;
  if(axis==='sidePanel')return Math.abs(p.x)-.127-Math.abs(p.z)*.48;
  if(axis==='shortHem')return p.y-.662-.027*smooth(Math.abs(p.x),.145,.237);
  if(axis==='shirtHem')return p.y-.910-.021*smooth(Math.abs(p.x),.10,.175)-.009*smooth(p.z,-.08,.10);
  if(axis==='shortStripe')return Math.abs(p.x)-.154-.055*(.93-p.y)-.41*Math.abs(p.z);
  return p[axis];
}
function divide(polygon,axis,level){
  let below=false,above=false;
  for(const v of polygon){below ||= measure(v.p,axis)<level-1e-8;above ||= measure(v.p,axis)>level+1e-8;}
  if(!below||!above)return [polygon];
  const first=[],second=[];
  for(const [i,a] of polygon.entries()){
    const b=polygon[(i+1)%polygon.length],da=measure(a.p,axis)-level,db=measure(b.p,axis)-level;
    if(da<=0)first.push(a);if(da>=0)second.push(a);
    if(da*db<0){const cross=blend(a,b,da/(da-db));first.push(cross);second.push(cross);}
  }
  return [first,second];
}

export function tailorAthlete(mesh,models){
  const attr=mesh.geometry.attributes,world=mesh.matrixWorld,local=world.clone().invert();
  const normalToWorld=new T.Matrix3().getNormalMatrix(world),normalToLocal=new T.Matrix3().getNormalMatrix(local);
  const source=[],normals=new Map();
  for(let i=0;i<attr.position.count;i++){
    const p=new T.Vector3().fromBufferAttribute(attr.position,i).applyMatrix4(world);
    const n=new T.Vector3().fromBufferAttribute(attr.normal,i).applyNormalMatrix(normalToWorld);
    const code=key(p);if(!normals.has(code))normals.set(code,new T.Vector3());normals.get(code).add(n);
    source.push({p,n,joints:[0,1,2,3].map(k=>attr.skinIndex.getComponent(i,k)),weights:[0,1,2,3].map(k=>attr.skinWeight.getComponent(i,k))});
  }
  for(const v of source)v.n.copy(normals.get(key(v.p))).normalize();
  const pos=[],normal=[],colors=[],joints=[],weights=[];
  const origin=new T.Vector3(),direction=new T.Vector3();
  // A relaxed cut hangs from the shoulder and hip. Low folds gather above
  // each hem, with the outer thigh lifted slightly at the side vent.
  function drape(p,garment){
    const x=p.x,y=p.y;
    if(garment==='shorts'){
      const h=measure(p,'shortHem'),w=measure(p,'shirtHem');
      const easing=smooth(h,0,.007)*smooth(-w,0,.018);
      const flute=.5+.5*Math.cos(88*Math.abs(x)+16*y+7*p.z);
      return easing*(.014+(.024+.012*flute)*(1-smooth(h,.012,.23)));
    }
    const h=measure(p,'shirtHem'),collar=-measure(p,'neckline');
    const easing=smooth(h,0,.009)*smooth(collar,0,.022)*smooth(.34-Math.abs(x),0,.009);
    const front=smooth(Math.abs(p.z),.032,.105);
    const pleat=.5+.5*Math.sin(75*x+12*y+9*p.z);
    const diagonal=.5+.5*Math.cos(115*(h+.31*x)+Math.sin(25*x));
    return easing*(.012+.014*(1-smooth(h,.025,.28))*(pleat+front*.50*diagonal));
  }
  const sample=new T.Vector3(),slope=new T.Vector3(),surfaceNormal=new T.Vector3();
  function vertex(v,color,offset=0,garment){
    const lateral=Math.abs(v.p.x);
    const athletic= .010*Math.exp(-((lateral-.235)**2/.008+(v.p.y-1.365)**2/.012))
      + .006*Math.exp(-((lateral-.435)**2/.021+(v.p.y-1.335)**2/.009))
      + .006*Math.exp(-((v.p.y-.58)**2/.017))*(lateral<.2?1:0);
    const hemDistance=Math.min(...[.215,.697,.93,1.443].map(h=>Math.abs(h-v.p.y)),
      ...[.34,.69,.735].map(x=>Math.abs(lateral-x)),Math.abs(measure(v.p,'neckline')));
    surfaceNormal.copy(v.n);
    let lift=offset*smooth(hemDistance,0,.012);
    if(garment){
      lift=drape(v.p,garment);
      for(const axis of ['x','y','z']){
        sample.copy(v.p);sample[axis]+=.001;
        const above=drape(sample,garment);
        sample[axis]-=.002;slope[axis]=(above-drape(sample,garment))/.002;
      }
      surfaceNormal.sub(slope.addScaledVector(v.n,-slope.dot(v.n))).normalize();
    }
    origin.copy(v.p).addScaledVector(v.n,athletic+lift).applyMatrix4(local).toArray(pos,pos.length);
    direction.copy(surfaceNormal).applyNormalMatrix(normalToLocal).toArray(normal,normal.length);
    color.toArray(colors,colors.length);
    for(let i=0;i<4;i++){joints.push(v.joints[i]??0);weights.push(v.weights[i]??0);}
  }
  const collarEdge=new Map(),wristEdges={Left:new Map(),Right:new Map()};
  const indices=mesh.geometry.index?.array??source.map((_,i)=>i);
  const triangles=[];
  function splitChest(tri,depth){
    if(depth===0 || Math.max(...tri.map((v,i)=>v.p.distanceToSquared(tri[(i+1)%3].p)))<.001){triangles.push(tri);return;}
    const [a,b,c]=tri,ab=blend(a,b,.5),bc=blend(b,c,.5),ca=blend(c,a,.5);
    for(const part of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])splitChest(part,depth-1);
  }
  for(let i=0;i<indices.length;i+=3){
    const tri=[source[indices[i]],source[indices[i+1]],source[indices[i+2]]];
    if(tri.some(v=>v.p.y>1.28&&v.p.y<1.49&&Math.abs(v.p.x)<.32))splitChest(tri,3);
    else if(tri.some(v=>v.p.y>.64&&v.p.y<1.28&&Math.abs(v.p.x)<.28))splitChest(tri,2);
    else triangles.push(tri);
  }
  for(const tri of triangles){
    const levels=[.072,.20,.215,1.455].map(v=>['y',v]);
    if(tri.some(v=>v.p.y>.60&&v.p.y<1.01))levels.push(['shortHem',0],['shortHem',.009],['shortStripe',0],['shirtHem',0],['shirtHem',.012]);
    if(tri.some(v=>v.p.y>1.2 && Math.abs(v.p.x)>.29))for(const v of [-.735,-.69,-.34,-.330, .330,.34,.69,.735])levels.push(['x',v]);
    if(tri.some(v=>v.p.y>.91&&v.p.y<1.51))levels.push(['neckline',0],['neckline',-.009],['raglan',0],['raglan',.004],['sidePanel',0]);
    if(tri.some(v=>Math.abs(v.p.x)>.73))levels.push(['wrist',.745]);
    let polygons=[tri];
    for(const [axis,value] of levels)polygons=polygons.flatMap(poly=>divide(poly,axis,value));
    for(const poly of polygons){
      if(poly.length<3)continue;
      const p=poly.reduce((v,u)=>v.add(u.p),new T.Vector3()).divideScalar(poly.length);
      if(p.y<.072 || p.y>1.455 || Math.abs(p.x)>.745)continue;
      for(const v of poly)if(Math.abs(v.p.y-1.455)<1e-6)collarEdge.set(key(v.p),v);
      for(const v of poly)if(Math.abs(Math.abs(v.p.x)-.745)<1e-6)wristEdges[v.p.x>0?'Left':'Right'].set(key(v.p),v);
      let color=skinTone,offset=0,garment;
      if(p.y<.215){color=p.y<.20?sock:trim;offset=.002;}
      if(measure(p,'shortHem')>=0 && measure(p,'shirtHem')<0){
        garment='shorts';color=measure(p,'shortStripe')>0 || measure(p,'shortHem')<.009?shortsPanel:shorts;
      }
      if(measure(p,'shirtHem')>=0 && measure(p,'neckline')<0 && Math.abs(p.x)<.34){
        garment='jersey';
        const seam=measure(p,'raglan'),side=measure(p,'sidePanel');
        color=(side>0 && p.y<1.26)||(p.y>1.27&&seam>.004)?jerseyPanel:jersey;
        if(measure(p,'neckline')>-.009 || Math.abs(p.x)>.330 || (p.y>1.27&&seam>=0&&seam<.004))color=trim;
        if(measure(p,'shirtHem')<.012)color=jerseyPanel;
      }
      if(p.y>1.23 && p.y<1.385 && Math.abs(p.x)>.69 && Math.abs(p.x)<.735){color=sock;offset=.0035;}
      for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]])vertex(v,color,offset,garment);
    }
  }
  // Both laced Blender shoes are rigidly weighted to their matching foot.
  function graft(part,boneName,matrix=part.matrixWorld){
    const norm=new T.Matrix3().getNormalMatrix(matrix);
    const joint=mesh.skeleton.bones.findIndex(b=>b.name===boneName);
    const g=part.geometry,indices=g.index?.array??Array.from({length:g.attributes.position.count},(_,i)=>i);
    for(const i of indices){
      const p=new T.Vector3().fromBufferAttribute(g.attributes.position,i).applyMatrix4(matrix);
      const n=new T.Vector3().fromBufferAttribute(g.attributes.normal,i).applyNormalMatrix(norm);
      vertex({p,n,joints:[joint],weights:[1]},boneName.endsWith('Hand')?skinTone:new T.Color().fromBufferAttribute(g.attributes.color,i));
    }
  }
  // Connect the original forearm boundary to the Blender wrist in bind space.
  // Each side of the seam retains its own skin weights as the wrist extends.
  function joinRings(arm,palm,axis){
    const ring=list=>{
      const centre=list.reduce((p,v)=>p.add(v.p),new T.Vector3()).divideScalar(list.length);
      return list.map(v=>({v,angle:T.MathUtils.euclideanModulo(Math.atan2(v.p.z-centre.z,v.p[axis]-centre[axis]),2*Math.PI)})).sort((a,b)=>a.angle-b.angle);
    };
    const a=ring([...arm.values()]),b=ring([...palm.values()]);
    if(a.length<3||b.length<3)throw new Error('Missing anatomical attachment ring');
    function face(v,u,w){
      const normal=u.p.clone().sub(v.p).cross(w.p.clone().sub(v.p));
      const out=normal.dot(v.n.clone().add(u.n).add(w.n))>=0?[v,u,w]:[v,w,u];
      for(const e of out)vertex(e,skinTone);
    }
    let i=0,j=0;
    while(i<a.length||j<b.length){
      const n=i+1<a.length?a[i+1].angle:a[0].angle+2*Math.PI,m=j+1<b.length?b[j+1].angle:b[0].angle+2*Math.PI;
      const v=a[i%a.length].v,u=b[j%b.length].v;
      if(j===b.length||i<a.length&&n<m){face(v,u,a[++i%a.length].v);}
      else {face(v,u,b[++j%b.length].v);}
    }
  }
  models.updateMatrixWorld(true);
  // The nape, jaw and throat come from the same sculpt. Anchor the clavicle
  // end to the neck joint and the shared jaw edge to the skull during rotation.
  const head=mesh.skeleton.bones.findIndex(b=>b.name==='Head');
  const neck=mesh.skeleton.bones.findIndex(b=>b.name==='Neck');
  const throat=models.getObjectByName('NeckSkin').geometry;
  const throatRing=new Map(),baseHeight=1.483;
  const vertices=Array.from({length:throat.attributes.position.count},(_,i)=>{
    const p=new T.Vector3().fromBufferAttribute(throat.attributes.position,i);
    const n=new T.Vector3().fromBufferAttribute(throat.attributes.normal,i);
    const w=T.MathUtils.smoothstep(p.y,baseHeight,1.51);
    return {p,n,joints:[neck,head],weights:[1-w,w]};
  });
  for(let i=0;i<throat.index.count;i+=3){
    const tri=[0,1,2].map(j=>vertices[throat.index.getX(i+j)]);
    for(const poly of divide(tri,'y',baseHeight)){
      if(!poly.some(v=>v.p.y>baseHeight+1e-7))continue;
      for(const v of poly)if(Math.abs(v.p.y-baseHeight)<1e-6)throatRing.set(key(v.p),v);
      for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]])vertex(v,skinTone);
    }
  }
  joinRings(collarEdge,throatRing,'x');
  for(const side of ['Left','Right']){
    graft(models.getObjectByName('Shoe'+side),side+'Foot');
    const hand=mesh.skeleton.bones.find(b=>b.name===side+'Hand');
    const socket=new T.Matrix4().compose(hand.getWorldPosition(new T.Vector3()),hand.getWorldQuaternion(new T.Quaternion()),new T.Vector3(1,1,1));
    const part=models.getObjectByName('Hand'+side),g=part.geometry.attributes,palm=new Map();
    const joint=mesh.skeleton.bones.indexOf(hand),normals=new T.Matrix3().getNormalMatrix(socket);
    for(let i=0;i<g.position.count;i++){
      const p=new T.Vector3().fromBufferAttribute(g.position,i);
      if(Math.abs(p.y)>1e-6)continue;
      p.applyMatrix4(socket);
      const n=new T.Vector3().fromBufferAttribute(g.normal,i).applyNormalMatrix(normals);
      palm.set(key(p),{p,n,joints:[joint],weights:[1]});
    }
    joinRings(wristEdges[side],palm,'y');
    graft(part,side+'Hand',socket);
  }
  const geometry=new T.BufferGeometry();
  for(const [name,data,size] of [['position',pos,3],['normal',normal,3],['color',colors,3],['skinWeight',weights,4]])geometry.setAttribute(name,new T.Float32BufferAttribute(data,size));
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));
  mesh.geometry=mergeVertices(geometry,1e-5);
  // One relative shape changes the shoulder, ribcage and leg silhouette in
  // bind space. Keeping the joints fixed preserves shoe and grip contacts.
  const fitted=mesh.geometry,build=[],bindNormal=new T.Vector3(),delta=new T.Vector3();
  const toLocal=new T.Matrix3().setFromMatrix4(local);
  for(let i=0;i<fitted.attributes.position.count;i++){
    origin.fromBufferAttribute(fitted.attributes.position,i).applyMatrix4(world);
    bindNormal.fromBufferAttribute(fitted.attributes.normal,i).applyNormalMatrix(normalToWorld);
    const x=Math.abs(origin.x),y=origin.y;
    const shoulder=.025*Math.exp(-((x-.23)**2/.012+(y-1.34)**2/.010));
    const chest=.018*Math.exp(-((y-1.22)**2/.019))*(1-smooth(x,.17,.29));
    const thigh=.014*Math.exp(-((y-.68)**2/.014));
    const calf=.010*Math.exp(-((y-.38)**2/.007));
    const extent=(shoulder+chest+thigh+calf)*smooth(y,.20,.28)*(1-smooth(y,1.41,1.455))*(1-smooth(x,.38,.54));
    delta.copy(bindNormal).multiplyScalar(extent);
    delta.y=0;
    delta.applyMatrix3(toLocal).toArray(build,build.length);
  }
  fitted.morphTargetsRelative=true;
  fitted.morphAttributes.position=[new T.Float32BufferAttribute(build,3)];
  fitted.morphAttributes.position[0].name='AthleticBuild';
  mesh.updateMorphTargets();
  mesh.material.name='Athlete kit';
}
