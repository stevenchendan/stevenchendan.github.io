import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {pavingMaterial} from './materials';

type Point = [number, number];
export type TerracePlan = { beds: Point[][]; turf: Point[][]; grates: Point[] };

// Shallow seating berms in the architects' Central Terrace photographs.
// The same undulation sets the height of each lawn, its coping and its trees.
export const terraceHeight = (x:number,z:number) => .62+.27*Math.cos(x*.09+z*.065);

export function buildCentralTerrace(plan:TerracePlan) {
  const result=new T.Group();result.name='Central Terrace planting and furniture';
  const parts=new Map<string,T.BufferGeometry[]>();
  const add=(finish:string,g:T.BufferGeometry)=>{
    if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}
    g.deleteAttribute('uv');
    const batch=parts.get(finish)??[];batch.push(g);parts.set(finish,batch);
  };
  const surface=(ring:Point[],finish:string,lift:number)=>{
    const g=new T.ShapeGeometry(new T.Shape(ring.map(([x,z])=>new T.Vector2(x,-z))));
    g.rotateX(-Math.PI/2);
    const points=g.getAttribute('position');
    for(let i=0;i<points.count;i++)points.setY(i,terraceHeight(points.getX(i),points.getZ(i))+lift);
    g.computeVertexNormals();add(finish,g);
  };
  for(const ring of plan.beds){
    surface(ring,'limestone',0);
    const sides:number[]=[];
    ring.forEach(([x,z],i)=>{
      const [u,v]=ring[(i+1)%ring.length],h=terraceHeight(x,z),k=terraceHeight(u,v);
      sides.push(x,-.02,z, u,k,v, u,-.02,v, x,-.02,z, x,h,z, u,k,v);
    });
    const face=new T.BufferGeometry();face.setAttribute('position',new T.Float32BufferAttribute(sides,3));face.computeVertexNormals();add('edge',face);
  }
  for(const ring of plan.turf)surface(ring,'grass',.035);
  for(const [x,z] of plan.grates){
    const square=new T.BoxGeometry(1.45,.055,1.45);square.translate(x,.047,z);add('iron',square);
    for(let i=-3;i<=3;i++){
      const slat=new T.BoxGeometry(.06,.025,1.33);slat.translate(x+i*.19,.084,z);add('metal',slat);
    }
    // Young street trees have two small supporting stakes on either side.
    for(const side of [-1,1]){
      const post=new T.CylinderGeometry(.045,.057,1.65,5);
      post.translate(x+side*.47,.85,z);add('timber',post);
    }
  }
  // Slim pedestrian lanterns along the central walk and the oval approach.
  for(const [x,z] of [[312,32],[310,58],[306,95],[321,118],[349,121],[376,110],[382,49],[263,102],[290,122]]){
    const pole=new T.CylinderGeometry(.06,.13,5.3,8);pole.translate(x,2.63,z);add('metal',pole);
    const head=new T.BoxGeometry(.68,.12,.36);head.translate(x+.22,5.28,z);add('iron',head);
    const lens=new T.BoxGeometry(.48,.04,.27);lens.translate(x+.26,5.20,z);add('limestone',lens);
  }
  // Two demountable white pavilions on the service apron appear in the
  // tournament aerial. Retain an open lane between the buildings and the yard.
  for(const [x,z,length,depth,bays] of [[348,11,51,14,10],[325,-12,15,8,3]]){
    const width=length/bays,eave=3.65,peak=eave+depth*.14;
    const body=new T.BoxGeometry(length-.3,eave,depth-.4);body.translate(x,eave/2,z);add('panels',body);
    for(let k=0;k<bays;k++){
      const u=x-length/2+(k+.5)*width;
      for(const side of [-1,1]){
        const g=new T.BoxGeometry(width-.028,.11,Math.hypot(depth/2,peak-eave));
        g.rotateX(side*Math.atan2(peak-eave,depth/2));g.translate(u,(peak+eave)/2,z+side*depth/4);add('fabric',g);
        const post=new T.BoxGeometry(.1,eave,.14);post.translate(u-width/2,eave/2,z+side*depth/2);add('metal',post);
      }
      if(k%3===1){
        const doors=new T.BoxGeometry(width*.69,2.5,.08);doors.translate(u,1.27,z+depth/2-.13);add('iron',doors);
      }
    }
  }
  const finishes:Record<string,string>={limestone:'#d5d4c6',edge:'#969988',grass:'#6e8850',iron:'#424d4b',metal:'#82908b',timber:'#a48968',fabric:'#d9dfdd',panels:'#c0ceca'};
  for(const [finish,pieces] of parts){
    const geometry=mergeGeometries(pieces)!;pieces.forEach(piece=>piece.dispose());
    const material=finish==='grass'?pavingMaterial(finishes.grass,geometry,'lawn'):new T.MeshStandardMaterial({color:finishes[finish],roughness:.84});
    material.side=T.DoubleSide;
    const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;mesh.castShadow=finish!=='grass';result.add(mesh);
  }
  return result;
}
