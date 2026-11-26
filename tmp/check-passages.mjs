import fs from 'node:fs';
import * as T from 'three';
import {loadArenaModule as load} from '../scripts/arena-model-fixture.mjs';
const data=JSON.parse(fs.readFileSync('public/data/1573-context.json'));
const {buildContext}=load('model');
for(const id of ['rla','mca']){
 const root=buildContext(data,id);root.updateMatrixWorld(true);
 let meshes=[];root.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&!o.name.includes('sign'))meshes.push(o)});
 const frame=load('precinctGeometry').courtFrame(data.features.find(f=>f.id==='way/1239949234').points);
 const origin=id==='rla'?new T.Vector3(154-12.5,1.5,72-10.2):new T.Vector3(frame.x+12.4,1.5,frame.z-10);
 const hit=new T.Raycaster(origin,new T.Vector3(id==='rla'?-1:1,0,0)).intersectObjects(meshes,false)[0];
 console.log(id,'player passage depth',hit?.distance, 'point',hit?.point.toArray());
}
