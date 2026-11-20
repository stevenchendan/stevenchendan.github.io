export const forkBridgeId='806910-1-0';
type Point=number[];

// Survey footprint order runs out along one rail, across the nose and back
// along the opposite rail of each approach.
const arms=[[27,96,97,161],[162,240,241,294]] as const;
const landing=.025;
const distanceToLine=(x:number,z:number,a:Point,b:Point)=>
  Math.abs((x-a[0])*(b[1]-a[1])-(z-a[1])*(b[0]-a[0]))/Math.hypot(b[0]-a[0],b[1]-a[1]);

export function forkBridgeParts(ring:Point[],top:number){
  const spine=ring.filter((_,i)=>!arms.some(([first,,,last])=>i>first&&i<last));
  const ramps=arms.map(([first,tipA,tipB,last])=>({
    ring:ring.slice(first,last+1),
    height:(x:number,z:number)=>{
      const rise=distanceToLine(x,z,ring[tipA],ring[tipB]);
      const remaining=distanceToLine(x,z,ring[first],ring[last]);
      return landing+(top-landing)*rise/(rise+remaining);
    },
  }));
  return [...ramps,{ring:spine,height:()=>top}];
}
