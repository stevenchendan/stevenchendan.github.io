import * as T from 'three';
import type { Batch } from './architecture';
import type { CourtFrame } from './precinctGeometry';

// Court-relative sides from the supplied AO26 map; dimensions are approximate.
export const outerStandLayout:Record<string,{side:number;rows:number}[]>={
  '#5':[{side:1,rows:8}], '#6':[{side:-1,rows:6},{side:1,rows:5}],
  '#7':[{side:-1,rows:6}], '#8':[{side:-1,rows:6}],
  '#12':[{side:-1,rows:7}], '#13':[{side:-1,rows:9}],
  '#14':[{side:-1,rows:6}], '#15':[{side:-1,rows:6}],
};

export function outerCourtStands(b:Batch,frame:CourtFrame,name:string,crowd:T.Group){
  for(const {side,rows} of outerStandLayout[name]??[]){
    const length=frame.depth-7,front=frame.width/2+1.1,c=Math.cos(frame.rotation),s=Math.sin(frame.rotation);
    const world=(u:number,y:number,v:number)=>[frame.x+u*c+v*s,y,frame.z-u*s+v*c];
    const box=(u:number,y:number,v:number,w:number,h:number,d:number,color:string)=>{const p=world(u,y,v);b.box(p[0],p[1],p[2],w,h,d,color,frame.rotation);};
    const positions:{p:number[];angle:number}[]=[];
    for(let r=0;r<rows;r++){
      const u=side*(front+r*.72),top=.3+r*.38;
      // Split at the centre aisle; each section has a clear route to ground.
      for(const end of [-1,1])box(u,top/2,end*(length/4+.5),.72,top,length/2-1,'#9ca9ac');
      box(u,top/2,0,.72,top,1.8,'#c7cdc6');
      for(let v=-length/2+.6;v<length/2-.3;v+=.6){
        if(Math.abs(v)<1.2)continue;
        positions.push({p:world(u,top+.25,v),angle:frame.rotation-side*Math.PI/2});
      }
    }
    const back=side*(front+(rows-.5)*.72),height=.3+(rows-1)*.38+1.1;
    b.rod(world(back,height,-length/2),world(back,height,length/2),.055,'#758c96');
    for(let v=-length/2;v<=length/2;v+=3)b.rod(world(back,0,v),world(back,height,v),.055,'#758c96');
    for(const end of [-1,1])b.rod(world(side*front,1.3,end*length/2),world(back,height,end*length/2),.055,'#758c96');
    const seat=new T.InstancedMesh(new T.BoxGeometry(.48,.28,.42),new T.MeshStandardMaterial({color:'#5289ad',roughness:.8}),positions.length);
    const occupied=positions.filter((_,i)=>i%7<3);
    const bodies=new T.InstancedMesh(new T.CapsuleGeometry(.15,.28,3,5),new T.MeshStandardMaterial({roughness:.9}),occupied.length);
    const heads=new T.InstancedMesh(new T.SphereGeometry(.125,6,5),new T.MeshStandardMaterial({color:'#c79c78'}),occupied.length),o=new T.Object3D();
    positions.forEach(({p,angle},i)=>{o.position.set(p[0],p[1],p[2]);o.rotation.set(0,angle,0);o.updateMatrix();seat.setMatrixAt(i,o.matrix);});
    occupied.forEach(({p,angle},i)=>{
      o.position.set(p[0],p[1]+.38,p[2]);o.rotation.set(0,angle,0);o.updateMatrix();bodies.setMatrixAt(i,o.matrix);bodies.setColorAt(i,new T.Color(['#eee2ca','#42617b','#b86849','#789079'][i%4]));
      o.position.y+=.39;o.updateMatrix();heads.setMatrixAt(i,o.matrix);
    });
    seat.castShadow=true;seat.receiveShadow=true;b.group.add(seat);crowd.add(bodies,heads);
  }
}
