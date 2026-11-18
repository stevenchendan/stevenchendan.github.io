import * as T from 'three';
import type { Batch } from './architecture';
import { seatedCrowd, type SpectatorSeat } from './seatedCrowd';
import type { CourtFrame } from './precinctGeometry';

// Court-relative sides from the supplied AO26 map; dimensions are approximate.
export const outerStandLayout:Record<string,{side:number;rows:number}[]>={
  '#5':[{side:1,rows:8}], '#6':[{side:-1,rows:6},{side:1,rows:5}],
  '#7':[{side:-1,rows:6}], '#8':[{side:-1,rows:6}],
  '#12':[{side:-1,rows:7}], '#13':[{side:-1,rows:9}],
  '#14':[{side:-1,rows:6}], '#15':[{side:-1,rows:6}],
};

export function outerCourtStands(b:Batch,frame:CourtFrame,name:string,crowd:T.Group,elevation=0){
  const spectatorSeats:SpectatorSeat[]=[];
  // Adjacent practice courts often share a side fence. Fit the galleries
  // inside their own end corners, leaving the central run-back and gate free.
  if(!outerStandLayout[name]){
    const c=Math.cos(frame.rotation),s=Math.sin(frame.rotation);
    for(const end of [-1,1])for(const side of [-1,1]){
      const u=side*(frame.width/2-2.4),v=end*(frame.depth/2-1.15);
      const world=(offset:number,y:number,depth:number):[number,number,number]=>[
        frame.x+(u+offset)*c+(v+depth)*s,elevation+y,frame.z-(u+offset)*s+(v+depth)*c];
      for(const row of [0,1]){
        const depth=row*end*.67,top=.48+row*.32;
        b.box(...world(0,top-.05,depth),3.6,.10,.44,'#64859a',frame.rotation);
        b.box(...world(0,top+.17,depth+end*.2),3.6,.30,.07,'#41657d',frame.rotation);
        for(const leg of [-1.4,1.4])b.box(...world(leg,top/2,depth),.09,top,.32,'#51626b',frame.rotation);
        if(row)b.box(...world(0,.14,depth-end*.16),3.6,.28,.68,'#9ea8a9',frame.rotation);
        for(let i=0;i<6;i++){
          const [x,y,z]=world((i-2.5)*.58,top,depth);
          spectatorSeats.push({x,y,z,angle:frame.rotation+(end<0?Math.PI:0)});
        }
      }
    }
  }
  for(const {side,rows} of outerStandLayout[name]??[]){
    const length=frame.depth-7,front=frame.width/2+1.1,c=Math.cos(frame.rotation),s=Math.sin(frame.rotation);
    const world=(u:number,y:number,v:number)=>[frame.x+u*c+v*s,elevation+y,frame.z-u*s+v*c];
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
    const o=new T.Object3D();
    positions.forEach(({p,angle},i)=>{o.position.set(p[0],p[1],p[2]);o.rotation.set(0,angle,0);o.updateMatrix();seat.setMatrixAt(i,o.matrix);});
    positions.forEach(({p})=>spectatorSeats.push({x:p[0],y:p[1]+.14,z:p[2],angle:frame.rotation+side*Math.PI/2}));
    seat.castShadow=true;seat.receiveShadow=true;b.group.add(seat);
  }
  if(spectatorSeats.length)crowd.add(seatedCrowd(spectatorSeats,outerStandLayout[name] ? .62 : .73));
}
