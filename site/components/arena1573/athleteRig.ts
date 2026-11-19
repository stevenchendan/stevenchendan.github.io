import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { rallyFrame } from './rallyMotion';
import {playerContactShadows} from './playerContactShadows';
import {footwork} from './footwork';
import {portraits,skinTones} from './athleteKits';
import {impactTime,type StrokeKind} from './strokeContacts';

type Actor = ReturnType<typeof rallyFrame>['players'][number];
const smooth = (value:number) => T.MathUtils.smoothstep(value,0,1);

type Step=ReturnType<typeof footwork>['feet'][number];

function recoveryLeg(body:T.Object3D,root:T.Group,side:'Left'|'Right'){
  const thigh=body.getObjectByName(side+'UpLeg')!, shin=body.getObjectByName(side+'Leg')!, foot=body.getObjectByName(side+'Foot')!;
  const hip=new T.Vector3(), knee=new T.Vector3(), ankle=new T.Vector3(), target=new T.Vector3(), kneeTarget=new T.Vector3();
  const axis=new T.Vector3(), pole=new T.Vector3(), bend=new T.Vector3(), current=new T.Vector3(), desired=new T.Vector3();
  const original=new T.Quaternion(),rot=new T.Quaternion(),parentRot=new T.Quaternion(),flat=new T.Quaternion(),orientation=new T.Quaternion();
  const flatFoot=new T.Quaternion().fromArray(foot.userData.plantedQuaternion);
  const lateral=side==='Left'?-1:1;

  function aim(bone:T.Object3D,child:T.Object3D,goal:T.Vector3){
    bone.getWorldPosition(current);
    desired.copy(goal).sub(current).normalize();
    child.getWorldPosition(axis).sub(current).normalize();
    rot.setFromUnitVectors(axis,desired).multiply(bone.getWorldQuaternion(original));
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(parentRot).invert().multiply(rot));
    bone.updateWorldMatrix(false,false);
  }
  return (step:Step,weight:number)=>{
    if(weight>=1)return;
    target.set(step.x,step.y,step.z);
    root.localToWorld(target);
    thigh.getWorldPosition(hip);shin.getWorldPosition(knee);foot.getWorldPosition(ankle);
    foot.getWorldQuaternion(orientation);
    target.lerp(ankle,weight);
    const upper=hip.distanceTo(knee),lower=knee.distanceTo(ankle);
    axis.copy(target).sub(hip);
    const reach=T.MathUtils.clamp(axis.length(),Math.abs(upper-lower)+.001,upper+lower-.002);
    axis.normalize();
    target.copy(hip).addScaledVector(axis,reach);
    const along=(upper*upper-lower*lower+reach*reach)/(2*reach);
    const height=Math.sqrt(Math.max(0,upper*upper-along*along));
    // Blend the knee plane into the captured plane as the player plants.
    root.getWorldQuaternion(parentRot);
    pole.set(lateral*.10,0,-1).applyQuaternion(parentRot).projectOnPlane(axis).normalize();
    bend.copy(knee).sub(hip).projectOnPlane(axis).normalize();
    pole.lerp(bend,weight).normalize();
    kneeTarget.copy(hip).addScaledVector(axis,along).addScaledVector(pole,height);
    aim(thigh,shin,kneeTarget);aim(shin,foot,target);
    flat.copy(root.getWorldQuaternion(rot)).multiply(flatFoot).slerp(orientation,weight);
    foot.quaternion.copy(shin.getWorldQuaternion(parentRot).invert().multiply(flat));
  };
}

export function makeAthlete(source:T.Group,clips:T.AnimationClip[],shirt:string,cap:boolean){
  const body=clone(source),group=new T.Group(), ownedGeometry:T.BufferGeometry[]=[];
  group.add(body);
  const heads=portraits.map(name=>body.getObjectByName(name)!);
  const figure=body.getObjectByName('Human_Mesh') as T.SkinnedMesh;
  const jerseySlots:{colors:T.BufferAttribute|T.InterleavedBufferAttribute;body:number[];panel:number[];skin:number[];shorts:number[];shortsPanel:number[]}[]=[];
  function setKit(hex:string,portrait=cap?0:1,shorts='#213944',build=0){
    heads.forEach((h,i)=>h.visible=i===portrait);
    if(figure.morphTargetInfluences)figure.morphTargetInfluences[0]=build;
    const flesh=new T.Color(skinTones[portrait]),woven=new T.Color(shorts);
    const c=new T.Color(hex),p=c.clone().multiplyScalar(.74);
    const stripe=woven.clone().lerp(c,.23);
    for(const {colors,body,panel,skin,shorts,shortsPanel} of jerseySlots){
      for(const i of skin)colors.setXYZ(i,flesh.r,flesh.g,flesh.b);
      for(const i of shorts)colors.setXYZ(i,woven.r,woven.g,woven.b);
      for(const i of shortsPanel)colors.setXYZ(i,stripe.r,stripe.g,stripe.b);
      for(const i of body)colors.setXYZ(i,c.r,c.g,c.b);
      for(const i of panel)colors.setXYZ(i,p.r,p.g,p.b);
      colors.needsUpdate=true;
    }
  }
  body.traverse(o=>{
    if(!(o instanceof T.Mesh))return;
    o.castShadow=true;o.receiveShadow=true;
    if(!(o instanceof T.SkinnedMesh))return;
    o.frustumCulled=false;
    // Each player has a separate vertex-colour buffer and skeleton while the
    // racket, cap and skin material stay shared between the two athletes.
    o.geometry=o.geometry.clone();ownedGeometry.push(o.geometry);
    const colors=o.geometry.getAttribute('color'),base=new T.Color('#277b9a'),bodySlots:number[]=[],panelSlots:number[]=[];
    const panel=new T.Color('#206980');
    const skinSlots:number[]=[],shortSlots:number[]=[],stripeSlots:number[]=[],stripe=new T.Color('#334954');
    jerseySlots.push({colors,body:bodySlots,panel:panelSlots,skin:skinSlots,shorts:shortSlots,shortsPanel:stripeSlots});
    const skin=new T.Color('#c89779'),fabric=new T.Color('#213944');
    for(let i=0;i<colors.count;i++){
      const r=colors.getX(i),g=colors.getY(i);
      if(Math.abs(r-base.r)<.001 && Math.abs(g-base.g)<.001)bodySlots.push(i);
      if(Math.abs(r-panel.r)<.001 && Math.abs(g-panel.g)<.001)panelSlots.push(i);
      if(Math.abs(r-skin.r)<.001 && Math.abs(g-skin.g)<.001)skinSlots.push(i);
      if(Math.abs(r-fabric.r)<.001 && Math.abs(g-fabric.g)<.001)shortSlots.push(i);
      if(Math.abs(r-stripe.r)<.001 && Math.abs(g-stripe.g)<.001)stripeSlots.push(i);
    }
    colors.needsUpdate=true;
  });
  setKit(shirt);
  const shadows=playerContactShadows(group,body);
  const hips=body.getObjectByName('Hips')!;
  const hipRest=hips.position.clone();
  const q=new T.Quaternion(),pos=new T.Vector3();
  const poseBones:T.Bone[]=[];
  body.traverse(o=>{if(o instanceof T.Bone)poseBones.push(o);});
  const rest=poseBones.map(b=>b.quaternion.clone());
  const library=new Map(clips.map(clip=>{
    const samplers=clip.tracks.map(track=>{
      const binding=T.PropertyBinding.parseTrackName(track.name);
      const bone=body.getObjectByName(binding.nodeName)!;
      const interpolant=track.InterpolantFactoryMethodLinear();
      return {index:poseBones.indexOf(bone as T.Bone),position:binding.propertyName==='position',interpolant};
    });
    return [clip.name as StrokeKind|'run',{duration:clip.duration,samplers}] as const;
  }));
  const left=recoveryLeg(body,group,'Left'),right=recoveryLeg(body,group,'Right');
  const head=body.getObjectByName('Head')!,neck=body.getObjectByName('Neck')!;
  const spine=body.getObjectByName('Spine')!;
  const look=new T.Quaternion(),parentQ=new T.Quaternion(),around=new T.Vector3(),across=new T.Vector3();
  const pitchQ=new T.Quaternion();
  // Convert a metre along the actor's up axis to the imported armature units.
  const up=new T.Vector3(0,1,0).applyQuaternion(hips.parent!.getWorldQuaternion(q).invert())
    .divide(hips.parent!.getWorldScale(new T.Vector3()));
  function pose(actor:Actor,gait=footwork(actor)){
    group.position.set(actor.x,.095,actor.z);group.rotation.y=actor.yaw;
    const clip=library.get(actor.kind)!;
    const t=impactTime(actor.kind)+actor.relativeTime*actor.pace;
    const weight=smooth(Math.min(t/.22,(clip.duration-t)/.23));
    const run=library.get('run');
    const moving=smooth(gait.speed/1.9);
    const grounded=weight*(1-smooth((gait.speed-.12)/1.65));
    for(let i=0;i<poseBones.length;i++)poseBones[i].quaternion.copy(rest[i]);
    hips.position.copy(hipRest);
    if(run&&moving>0){
      // The CC0 running cycle was authored on this skeleton. Give a sprint its
      // arm drive and trunk counterrotation, then settle into the incoming shot.
      const time=T.MathUtils.euclideanModulo(gait.phase+.80,1)*run.duration;
      for(const {index,position,interpolant} of run.samplers){
        const sample=interpolant.evaluate(time);
        const influence=moving*(.26+.64*actor.turn);
        if(position)hips.position.lerp(pos.fromArray(sample),influence);
        else {
          const bone=poseBones[index];
          const arm=/Arm|Shoulder/.test(bone.name);
          bone.quaternion.slerp(q.fromArray(sample).normalize(),influence*(arm?.67:1));
        }
      }
    }
    if(weight>0){
      for(const {index,position,interpolant} of clip.samplers){
        const sample=interpolant.evaluate(t);
        if(position)hips.position.lerp(pos.fromArray(sample),Math.max(grounded,weight*.42));
        else {
          const bone=poseBones[index],lower=/Leg|Foot|Toe/.test(bone.name);
          bone.quaternion.slerp(q.fromArray(sample).normalize(),lower?grounded:weight);
        }
      }
    }
    const waiting=(1-weight)*(1-moving*(.46+.54*actor.turn));
    const vertical=.047*actor.split-.035*moving*(1-actor.turn)-.065*waiting;
    hips.position.addScaledVector(up,vertical*(1-grounded));
    group.updateWorldMatrix(true,true);
    // Receive with the chest over the balls of the feet. The captured swing
    // takes over as its preparation starts, including the service toss.
    if(waiting>0){
      across.set(1,0,0).applyQuaternion(group.getWorldQuaternion(q))
        .applyQuaternion(spine.parent!.getWorldQuaternion(parentQ).invert());
      spine.quaternion.premultiply(pitchQ.setFromAxisAngle(across,-.21*waiting));
      spine.updateWorldMatrix(false,true);
    }
    // Keep the ball in sight while recovering. At impact the capture supplies
    // the full head turn. Spread the smaller tracking motion over both joints.
    if(actor.court && weight<1){
      group.getWorldQuaternion(q);
      for(const joint of [neck,head]){
        const share=(joint===neck?.32:.68)*(1-weight);
        joint.parent!.getWorldQuaternion(parentQ).invert();
        around.set(0,1,0).applyQuaternion(q).applyQuaternion(parentQ);
        across.set(1,0,0).applyQuaternion(q).applyQuaternion(parentQ);
        look.setFromAxisAngle(around,actor.lookYaw*share);
        pitchQ.setFromAxisAngle(across,actor.lookPitch*share);
        joint.quaternion.premultiply(look.multiply(pitchQ));
        joint.updateWorldMatrix(false,false);
      }
    }
    left(gait.feet[0],grounded);right(gait.feet[1],grounded);
    shadows.update(actor.x,actor.z,actor.yaw);
  }
  return {group,pose,setKit,dispose(){
    shadows.dispose();
    ownedGeometry.forEach(g=>g.dispose());
    body.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.dispose();});
  }};
}
