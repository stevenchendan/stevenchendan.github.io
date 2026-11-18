// Pose the same fitted bodies used by the match into court-duty silhouettes.
// Run after pack-rally-athlete. The runtime shares these static meshes across courts.
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {MeshoptSimplifier} from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {loadAthlete} from './rally-fixture.mjs';

globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}};
const {scene}=await loadAthlete();
await MeshoptSimplifier.ready;
const group=new T.Group(),mat=new T.MeshStandardMaterial({vertexColors:true,roughness:.83});
const vec=(x,y,z)=>new T.Vector3(x,y,z);
function bake(name,posture,portrait,skin){
  const model=clone(scene),body=model.getObjectByName('Human_Mesh'),bones=body.skeleton;
  bones.pose();model.updateMatrixWorld(true);
  const bone=name=>model.getObjectByName(name);
  const pos=name=>bone(name).getWorldPosition(vec());
  // The bind pose faces +Z. All targets below are in metres about the hip.
  function aim(parent,child,direction){
    const node=bone(parent),from=pos(child).sub(pos(parent)).normalize();
    const q=new T.Quaternion().setFromUnitVectors(from,direction.clone().normalize()).multiply(node.getWorldQuaternion(new T.Quaternion()));
    node.quaternion.copy(node.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));node.updateWorldMatrix(true,true);
  }
  for(const [side,sign] of [['Left',1],['Right',-1]]){
    const seated=posture==='seated',low=posture==='kneeling';
    const bent=seated||low&&sign===1;
    aim(side+'UpLeg',side+'Leg',bent?vec(sign*.11,-.12,1):low?vec(-.03,-.96,.25):vec(sign*.10,-1,.07));
    aim(side+'Leg',side+'Foot',bent?vec(0,-1,-.14):low?vec(.04,-.14,-1):vec(.025,-1,-.05));
    const foot=bone(side+'Foot');
    // Undo the shin's tilt so the sole bears on the step or court.
    const ankle=bones.boneInverses[bones.bones.indexOf(foot)].clone().invert();
    const restQ=new T.Quaternion();ankle.decompose(vec(),restQ,vec());
    if(low&&!bent)restQ.premultiply(new T.Quaternion().setFromAxisAngle(vec(1,0,0),-.95));
    foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(restQ));foot.updateWorldMatrix(true,true);
    aim(side+'Arm',side+'ForeArm',vec(sign*.17,-1,seated?.35:low?.55:.14));
    aim(side+'ForeArm',side+'Hand',seated?vec(-sign*.29,-.1,1):low?vec(-sign*.33,-.30,.82):vec(-sign*.35,-.86,.32));
  }
  const parts=[];
  function copy(mesh,skinned=false){
    const src=mesh.geometry,g=new T.BufferGeometry(),p=[],cols=[];
    const a=src.attributes,base=new T.Color('#277b9a'),panel=new T.Color('#206980'),skinBase=new T.Color('#c89779'),shorts=new T.Color('#213944');
    const c=new T.Color(),point=vec();
    for(let i=0;i<a.position.count;i++){
      if(skinned)mesh.getVertexPosition(i,point);else point.fromBufferAttribute(a.position,i);
      point.applyMatrix4(mesh.matrixWorld).toArray(p,p.length);
      c.fromBufferAttribute(a.color,i);
      if(skinned){
        if(Math.abs(c.r-base.r)<.001&&Math.abs(c.g-base.g)<.001)c.set(posture==='seated'?'#d0dfde':'#258a86');
        else if(Math.abs(c.r-panel.r)<.001&&Math.abs(c.g-panel.g)<.001)c.set(posture==='seated'?'#70939a':'#21606b');
        else if(Math.abs(c.r-skinBase.r)<.001&&Math.abs(c.g-skinBase.g)<.001)c.set(skin);
        else if(Math.abs(c.r-shorts.r)<.001&&Math.abs(c.g-shorts.g)<.001)c.set('#24394a');
      }
      c.toArray(cols,cols.length);
    }
    g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(cols,3));g.setIndex(src.index.clone());parts.push(g);
  }
  model.updateMatrixWorld(true);bones.update();
  copy(body,true);copy(bone(portrait));
  if(posture!=='seated'){
    const ball=new T.Mesh(new T.SphereGeometry(.034,10,8));
    const palm=pos('RightHand');ball.position.copy(palm).add(vec(.008,-.045,.044));ball.updateMatrixWorld();
    const color=new T.Color('#dce948');
    ball.geometry.setAttribute('color',new T.Float32BufferAttribute(Array.from({length:ball.geometry.attributes.position.count},()=>color.toArray()).flat(),3));copy(ball);
  }
  const g=mergeVertices(mergeGeometries(parts),1e-5);
  const [idx]=MeshoptSimplifier.simplify(Uint32Array.from(g.index.array),g.attributes.position.array,3,posture==='seated'?5400:4200,.0025,['Permissive']);
  g.setIndex(Array.from(idx));const compact=mergeVertices(g.toNonIndexed());compact.computeVertexNormals();compact.computeBoundingBox();
  const hip=pos('Hips'),scale=posture==='seated'?1:.88;
  const anchor=posture==='seated'?hip.y-.094:compact.boundingBox.min.y;
  compact.translate(-hip.x,-anchor,-hip.z);compact.scale(scale,scale,scale);
  const mesh=new T.Mesh(compact,mat);mesh.name=name;group.add(mesh);
}
bake('ChairUmpire','seated','CroppedPlayer','#b57c5a');
bake('NetCrew','kneeling','TennisCap','#c89779');
bake('NetCrewBraid','kneeling','TiedPlayer','#ac7457');
bake('BaselineCrew','standing','HeadbandPlayer','#8c5c45');
bake('BaselineCrewBraid','standing','TiedPlayer','#ac7457');
const bytes=await new GLTFExporter().parseAsync(group,{binary:true});
await fs.writeFile(new URL('../public/models/tennis/court-crew.glb',import.meta.url),Buffer.from(bytes));
console.log('Packed five court-duty poses in',bytes.byteLength,'bytes.');

