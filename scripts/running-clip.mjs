import fs from 'node:fs/promises';
import path from 'node:path';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

// The tennis rig is the Quaternius human with the same bones and a different
// armature basis. Transfer the original CC0 run in metres facing the net (-Z).
export async function loadRunningClip(upstream,athlete){
  const bytes=await fs.readFile(path.join(upstream,'public/models/tennis/quaternius-human.glb'));
  const original=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
  const source=original.animations.find(clip=>clip.name.endsWith('|Run'));
  const sourceHips=original.scene.getObjectByName('Hips'),hips=athlete.getObjectByName('Hips');
  const mirrorHeading=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI);
  const sourceParent=sourceHips.parent.getWorldQuaternion(new T.Quaternion());
  const orientation=hips.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(mirrorHeading).multiply(sourceParent);
  const scale=hips.parent.getWorldScale(new T.Vector3()).y/sourceHips.parent.getWorldScale(new T.Vector3()).y;
  const tracks=[];
  for(const track of source.tracks){
    const {nodeName,propertyName}=T.PropertyBinding.parseTrackName(track.name);
    if(!athlete.getObjectByName(nodeName)||propertyName==='scale'||/Hand|Toe/.test(nodeName))continue;
    const out=track.clone();
    if(nodeName==='Hips'){
      const q=new T.Quaternion(),v=new T.Vector3();
      for(let j=0;j<out.values.length;j+=out.getValueSize()){
        if(propertyName==='quaternion')q.fromArray(track.values,j).premultiply(orientation).normalize().toArray(out.values,j);
        else {
          v.fromArray(track.values,j);
          sourceHips.parent.localToWorld(v).multiplyScalar(scale).applyQuaternion(mirrorHeading);
          hips.parent.worldToLocal(v).toArray(out.values,j);
        }
      }
    }
    tracks.push(out);
  }
  return new T.AnimationClip('run',source.duration,tracks);
}
