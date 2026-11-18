import * as T from 'three';
import {BALL_RADIUS, COURT_FLOOR, RALLY_SECONDS, rallyFrame} from './rallyMotion';

export type RallyCourt = {x:number;y:number;z:number;rotation:number;phase:number};

export function readPoseAtlas(buffer:ArrayBuffer){
  const [frames,joints,indexCount]=new Uint32Array(buffer,0,3);
  const times=new Float32Array(buffer,12,frames);
  const pixels=new Uint16Array(buffer,12+4*frames,frames*2*joints*8);
  const indices=new Uint16Array(buffer,pixels.byteOffset+pixels.byteLength);
  if(indices.length!==indexCount)throw new Error('Invalid tennis pose atlas');
  const texture=new T.DataTexture(pixels,joints*2,frames*2,T.RGBAFormat,T.HalfFloatType);
  texture.minFilter=texture.magFilter=T.LinearFilter;
  texture.needsUpdate=true;
  return {times,texture,indices};
}

// Fractional row in a texture containing two full performances. Linear texture
// filtering blends adjacent positions and quaternions with a single lookup each.
export function poseRow(times:Float32Array,seconds:number){
  const t=T.MathUtils.euclideanModulo(seconds,RALLY_SECONDS);
  let low=0,high=times.length-1;
  while(high-low>1){
    const mid=(low+high)>>>1;
    if(times[mid]<=t)low=mid;else high=mid;
  }
  return low+(t-times[low])/(times[high]-times[low]);
}

function playerGeometry(scene:T.Group,skinIndices:Uint16Array){
  const skin=scene.getObjectByName('Human_Mesh') as T.SkinnedMesh;
  const position:number[]=[],normal:number[]=[],color:number[]=[],joints:number[]=[],weights:number[]=[],kitPart:number[]=[],indices:number[]=[];
  const p=new T.Vector3(),n=new T.Vector3(),c=new T.Color(),shirt=new T.Color('#277b9a');
  const identity=new T.Matrix4(),skinColor=new T.Color('#c89779'),panel=new T.Color('#206980');
  function append(g:T.BufferGeometry,transform:T.Matrix4,attachment:number,tint?:T.Color,part=0,selection?:readonly number[]){
    const base=position.length/3,normalTransform=new T.Matrix3().getNormalMatrix(transform);
    const attr=g.attributes;
    for(let i=0;i<attr.position.count;i++){
      p.fromBufferAttribute(attr.position,i).applyMatrix4(transform).toArray(position,position.length);
      n.fromBufferAttribute(attr.normal,i).applyNormalMatrix(normalTransform).toArray(normal,normal.length);
      if(tint)c.copy(tint);else c.fromBufferAttribute(attr.color as T.BufferAttribute,i);
      c.toArray(color,color.length);
      const jersey=attachment===-1&&Math.abs(c.r-shirt.r)<.001&&Math.abs(c.g-shirt.g)<.001;
      const skin=attachment===-1&&Math.abs(c.r-skinColor.r)<.001&&Math.abs(c.g-skinColor.g)<.001;
      const sidePanel=attachment===-1&&Math.abs(c.r-panel.r)<.001&&Math.abs(c.g-panel.g)<.001;
      kitPart.push(jersey?1:skin?4:sidePanel?5:part);
      if(attachment!==-1){joints.push(attachment,0,0,0);weights.push(1,0,0,0);}
      else for(let k=0;k<4;k++){joints.push(attr.skinIndex.getComponent(i,k));weights.push(attr.skinWeight.getComponent(i,k));}
    }
    if(selection)for(const i of selection)indices.push(base+i);
    else if(attachment===-1)for(const i of skinIndices)indices.push(base+i);
    else if(g.index)for(let i=0;i<g.index.count;i++)indices.push(base+g.index.getX(i));
    else for(let i=0;i<attr.position.count;i++)indices.push(base+i);
  }
  append(skin.geometry,skin.bindMatrix,-1);
  const racketIndex=skin.skeleton.bones.length;
  const graphite=new T.Color('#26383b'),strings=new T.Color('#dce2d8');
  const ring=new T.TorusGeometry(1,.044,5,26).scale(.151,.19,.16);
  append(ring,identity,racketIndex,graphite);ring.dispose();
  function rod(ax:number,ay:number,bx:number,by:number,radius:number,tint:T.Color){
    const a=new T.Vector3(ax,ay,0),b=new T.Vector3(bx,by,0),delta=b.clone().sub(a);
    const rod=new T.CylinderGeometry(radius,radius,delta.length(),5,1,true);
    const axis=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
    const transform=new T.Matrix4().compose(a.lerp(b,.5),axis,new T.Vector3(1,1,1));
    append(rod,transform,racketIndex,tint);rod.dispose();
  }
  rod(0,-.489,0,-.286,.016,graphite);rod(0,-.296,-.098,-.145,.009,graphite);rod(0,-.296,.098,-.145,.009,graphite);
  for(let i=-3;i<=3;i++){
    const f=i/4,extent=Math.sqrt(1-f*f);
    rod(.147*f,-.186*extent,.147*f,.186*extent,.0015,strings);
    rod(-.147*extent,.186*f,.147*extent,.186*f,.0015,strings);
  }
  for(const [i,name] of ['TennisCap','HeadbandPlayer'].entries()){
    const head=scene.getObjectByName(name) as T.Mesh;
    append(head.geometry,identity,racketIndex+1,undefined,2+i,head.userData.distantIndices);
  }
  const result=new T.BufferGeometry();
  for(const [name,data,size] of [['position',position,3],['normal',normal,3],['color',color,3],['kitPart',kitPart,1],['jointIndex',joints,4],['jointWeight',weights,4]] as const){
    result.setAttribute(name,new T.Float32BufferAttribute(data,size));
  }
  result.setIndex(indices);
  return result;
}

function animateMaterial(material:T.Material,atlas:T.DataTexture){
  material.onBeforeCompile=shader=>{
    shader.uniforms.poses={value:atlas};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      uniform highp sampler2D poses;
      attribute vec4 jointIndex, jointWeight;
      attribute vec2 playerPose;
      attribute vec3 shirtColor;
      attribute float kitPart;
      vec3 rotateJoint(vec4 q,vec3 v){return v+2.0*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
    `).replace('#include <color_vertex>',`#include <color_vertex>
      if(kitPart==1.0)vColor.rgb=shirtColor;
      if(kitPart==5.0)vColor.rgb=shirtColor*.74;
      if(kitPart==4.0 && playerPose.y<.5)vColor.rgb=vec3(${new T.Color('#8c5c45').toArray().join(',')});
    `).replace('void main() {',`void main() {
      vec3 posedPosition=vec3(0.0),posedNormal=vec3(0.0);
      vec2 pixel=1.0/vec2(textureSize(poses,0));
      for(int i=0;i<4;i++){
        float w=jointWeight[i];
        if(w<=0.0)continue;
        vec2 uv=vec2(jointIndex[i]*2.0+0.5,playerPose.x+0.5)*pixel;
        vec4 q=normalize(texture(poses,uv));
        vec4 tr=texture(poses,uv+vec2(pixel.x,0.0));
        posedPosition+=(rotateJoint(q,position*tr.w)+tr.xyz)*w;
        posedNormal+=rotateJoint(q,normal)*w;
      }
    `).replace('#include <beginnormal_vertex>','vec3 objectNormal=normalize(posedNormal);').replace('#include <begin_vertex>','vec3 transformed=((kitPart==2.0 && playerPose.y<0.5)||(kitPart==3.0 && playerPose.y>0.5))?vec3(0.0):posedPosition;');
  };
}

export function makePrecinctPlayers(scene:T.Group,buffer:ArrayBuffer,courts:readonly RallyCourt[]){
  const group=new T.Group(),{times,texture,indices}=readPoseAtlas(buffer);
  const geometry=playerGeometry(scene,indices),count=courts.length*2;
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.86,side:T.DoubleSide});
  const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
  animateMaterial(material,texture);animateMaterial(depth,texture);
  const uniforms=new T.InstancedBufferAttribute(new Float32Array(count*2),2).setUsage(T.DynamicDrawUsage);
  const shirts=new T.InstancedBufferAttribute(new Float32Array(count*3),3);
  geometry.setAttribute('playerPose',uniforms);geometry.setAttribute('shirtColor',shirts);
  const athletes=new T.InstancedMesh(geometry,material,count);
  athletes.castShadow=true;athletes.receiveShadow=true;athletes.customDepthMaterial=depth;
  const balls=new T.InstancedMesh(new T.SphereGeometry(BALL_RADIUS,8,6),new T.MeshStandardMaterial({color:'#dbea43',roughness:.88}),courts.length);
  for(const mesh of [athletes,balls]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(mesh);}
  const kits=[new T.Color('#286e82'),new T.Color('#df8f38')];
  for(let i=0;i<count;i++)shirts.setXYZ(i,kits[i%2].r,kits[i%2].g,kits[i%2].b);
  const placements=courts.map(c=>({...c,cos:Math.cos(c.rotation),sin:Math.sin(c.rotation)}));
  const obj=new T.Object3D();
  let previous=Number.NaN;
  function pose(seconds:number){
    if(previous===seconds)return;
    previous=seconds;
    for(const [i,c] of placements.entries()){
      const t=seconds+c.phase,frame=rallyFrame(t),row=poseRow(times,t);
      for(let side=0;side<2;side++){
        const actor=frame.players[side],slot=i*2+side;
        uniforms.setXY(slot,row+side*times.length,side===0?1:0);
        obj.position.set(c.x+actor.x*c.cos+actor.z*c.sin,c.y+COURT_FLOOR,c.z-actor.x*c.sin+actor.z*c.cos);
        obj.rotation.y=c.rotation+actor.yaw;obj.updateMatrix();athletes.setMatrixAt(slot,obj.matrix);
      }
      const [x,y,z]=frame.ball;
      obj.position.set(c.x+x*c.cos+z*c.sin,c.y+y,c.z-x*c.sin+z*c.cos);
      obj.updateMatrix();balls.setMatrixAt(i,obj.matrix);
    }
    uniforms.needsUpdate=true;athletes.instanceMatrix.needsUpdate=true;balls.instanceMatrix.needsUpdate=true;
  }
  return {group,pose,dispose(){
    for(const mesh of [athletes,balls]){mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();}
    depth.dispose();texture.dispose();
  }};
}
