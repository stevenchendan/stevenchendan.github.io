// Tennis-MoCap records body joints. The retargeted right wrist exhibits a
// fast axial flip after forehand impact. Preserve the captured hand path and
// solve the racket orientation and anatomical wrist together on that path.
import * as T from 'three';

// Racket shaft directions in the player's court-aligned frame. The groundstroke
// drops below the hand before impact, releases forward, then wraps high to the
// opposite shoulder. Volleys use a smaller takeback and a firmer racket face.
const shafts={
  serve:[[-1.26,.52,.58,-.62],[-.72,.44,.27,.86],[-.35,.23,-.84,.49],[-.13,.62,-.38,.69],[0,.16,.98,-.10],[.10,-.45,.58,-.68],[.26,-.74,-.55,-.39],[.66,-.71,-.39,.58]],
  backhand:[[-.72,-.42,.58,.70],[-.34,-.62,.24,.75],[-.15,-.76,-.26,.59],[0,-.95,.24,-.17],[.14,-.47,.74,-.48],[.31,.29,.90,-.31],[.66,.63,.70,.34]],
  forehand:[[-.6,.40,.83,.39],[-.40,.48,.64,.60],[-.29,.52,.31,.80],[-.17,.56,-.24,.79],[-.08,.75,-.22,.62],[0,.98,.15,-.02],[.065,.66,.61,-.44],[.12,.0,.87,-.49],[.20,-.57,.80,-.16],[.31,-.77,.55,.31],[.44,-.65,.68,.35],[.66,-.18,.93,-.30]],
  volley:[[-.6,.25,.94,.22],[-.32,.49,.86,.18],[-.16,.59,.80,.11],[0,.73,.68,-.06],[.11,.57,.75,-.34],[.24,.17,.89,-.42],[.43,-.24,.90,-.34],[.66,-.24,.92,-.28]],
  'backhand-volley':[[-.6,-.39,.88,.24],[-.32,-.42,.84,.34],[-.16,-.53,.81,.26],[0,-.67,.73,-.09],[.12,-.46,.76,-.45],[.26,-.28,.78,-.56],[.44,-.20,.83,-.51],[.66,-.24,.90,-.31]],
};

// +Y of the right wrist points to the knuckles. A diagonal grip puts the
// handle across the palm with the fingers wrapped round the overgrip.
export function mountRacket(wrist,racket){
  const old=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),Math.PI/2);
  const palm=new T.Vector3(.10,.44,.89).normalize();
  racket.quaternion.setFromUnitVectors(palm.applyQuaternion(old),new T.Vector3(0,1,0)).multiply(old);
  const size=wrist.getWorldScale(new T.Vector3());
  racket.scale.set(1/size.x,1/size.y,1/size.z);
  racket.position.set(0,.397,0).applyQuaternion(racket.quaternion).add(new T.Vector3(0,.069,.024)).multiply(racket.scale);
  wrist.add(racket);
}

export function calibrateRelease(kind,recording,bones,racket){
  const wrist=bones.find(b=>b.name==='RightHand'),wristIndex=bones.indexOf(wrist);
  const gripInverse=racket.quaternion.clone().invert(),keys=shafts[kind];
  const times=Float32Array.from(keys,k=>k[0]),directions=[],faces=[];
  const front=new T.Vector3(0,kind==='forehand'?-.06:.1,-1).normalize();
  for(const [time,x,y,z] of keys){
    const shaft=new T.Vector3(x,y,z).normalize();
    const idx=T.MathUtils.clamp(Math.round((time+recording.contact)/recording.dt),0,recording.poses.length-1);
    const j=recording.poses[idx].j;
    const forearm=new T.Vector3(...j[9]).sub(new T.Vector3(...j[8])).normalize();
    const normal=forearm.projectOnPlane(shaft).normalize();
    const guide=front.clone().projectOnPlane(shaft).normalize();
    const guiding=kind==='forehand'?Math.exp(-Math.abs(time)*28):.75+.25*Math.exp(-Math.abs(time)*14);
    normal.lerp(guide,guiding).projectOnPlane(shaft).normalize();
    directions.push(...shaft.toArray());faces.push(...normal.toArray());
  }
  const shaftCurve=new T.CubicInterpolant(times,new Float32Array(directions),3);
  const faceCurve=new T.CubicInterpolant(times,new Float32Array(faces),3);
  const x=new T.Vector3(),y=new T.Vector3(),z=new T.Vector3(),q=new T.Quaternion(),m=new T.Matrix4();
  const parent=new T.Quaternion();
  for(const [i,pose] of recording.poses.entries()){
    const t=i*recording.dt-recording.contact;
    for(const [b,bone] of bones.entries())bone.quaternion.fromArray(pose.b[b]).normalize();
    y.fromArray(shaftCurve.evaluate(t)).normalize();
    z.fromArray(faceCurve.evaluate(t)).projectOnPlane(y).normalize();
    x.crossVectors(y,z);
    q.setFromRotationMatrix(m.makeBasis(x,y,z)).multiply(gripInverse);
    wrist.parent.getWorldQuaternion(parent);
    pose.b[wristIndex]=parent.invert().multiply(q).normalize().toArray();
  }
}
