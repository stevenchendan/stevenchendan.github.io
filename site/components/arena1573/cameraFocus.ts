import * as T from 'three';
import type { ContextData } from './model';
import type { courtDirectory } from './courtPlacements';
import { buildingVenue, venueVisible } from './venueVisibility';
import { eventWorlds } from './eventWorlds';

// Invisible pick geometry shares the footprints of the rendered courts. A
// low camera can see a stadium facade without looking down at its playing floor.
const pickMaterial=new T.MeshBasicMaterial({side:T.DoubleSide});
function footprint(key:string,venue:string,ring:number[][],base:number,height:number){
  const shape=new T.Shape(ring.map(([x,z])=>new T.Vector2(x,-z)));
  const geometry=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});
  geometry.rotateX(-Math.PI/2);geometry.translate(0,base,0);
  geometry.computeBoundingBox();
  const box=geometry.boundingBox!;
  const mesh=new T.Mesh(geometry,pickMaterial);
  mesh.name=key;
  mesh.userData={venue,span:Math.max(box.max.x-box.min.x,box.max.z-box.min.z)};
  return mesh;
}

export function cameraFootprints(data:ContextData,courts:ReturnType<typeof courtDirectory>){
  const areas:T.Mesh[]=[];
  for(const building of data.buildings){
    const id=buildingVenue(building);
    if(id)areas.push(footprint(id,id,building.ring,building.base,building.height));
  }
  for(const court of courts){
    if(areas.some(area=>area.name===court.key))continue;
    let ring=data.features.find(f=>f.id===court.id)?.points;
    let height=2.9;
    if(['1573','kia','west-show'].includes(court.key)){
      const [w,d]=court.key==='kia'?[30,40]:[23,32];
      height=court.key==='kia'?14:8.5;
      ring=Array.from({length:32},(_,i)=>{
        const x=Math.cos(i*Math.PI/16),z=Math.sin(i*Math.PI/16);
        return [court.x+w*Math.sign(x)*Math.sqrt(Math.abs(x)),court.z+d*Math.sign(z)*Math.sqrt(Math.abs(z))];
      });
    }
    if(ring)areas.push(footprint(court.key,court.venue,ring,court.y,height));
  }
  for(const [id,zone] of Object.entries(eventWorlds))areas.push(footprint(id,id,zone.ring,0,.1));
  return areas;
}

// Sample a small patch around the optical centre. The centre has the strongest
// vote; surrounding rays keep aisles and gaps between stands from flickering.
const samples=[[0,0,3],[-.22,0,1],[.22,0,1],[0,-.22,1],[0,.22,1],
  [-.19,-.19,1],[-.19,.19,1],[.19,-.19,1],[.19,.19,1]] as const;

export function trackCameraFocus(areas:T.Mesh[],selected:string,surroundings:boolean){
  const visible=areas.filter(a=>venueVisible(a.userData.venue,selected,surroundings));
  const ray=new T.Raycaster(),point=new T.Vector2(),hits:T.Intersection[]=[];
  const lastView=new T.Matrix4(),lastProjection=new T.Matrix4(),votes=new Map<string,number>();
  let focus:string|null=null;
  return (camera:T.PerspectiveCamera)=>{
    camera.updateMatrixWorld();
    if(camera.matrixWorld.equals(lastView)&&camera.projectionMatrix.equals(lastProjection))return focus;
    lastView.copy(camera.matrixWorld);lastProjection.copy(camera.projectionMatrix);
    const viewScale=2*Math.tan(T.MathUtils.degToRad(camera.getEffectiveFOV()/2))*Math.min(1,camera.aspect);
    ray.near=camera.near;ray.far=camera.far;
    votes.clear();
    for(const [x,y,weight] of samples){
      ray.setFromCamera(point.set(x,y),camera);
      hits.length=0;ray.intersectObjects(visible,false,hits);
      const hit=hits[0];
      if(!hit||hit.object.userData.span<hit.distance*viewScale*.2)continue;
      const key=hit.object.name;
      votes.set(key,(votes.get(key)??0)+weight);
    }
    let winner:string|null=null,best=3;
    for(const [key,count] of votes){
      if(count>best||(key===focus&&count===best)){
        winner=key;best=count;
      }
    }
    focus=winner;
    return focus;
  };
}
