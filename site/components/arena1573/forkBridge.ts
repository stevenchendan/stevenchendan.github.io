export const forkBridgeId='806910-1-0';
export const tennisBridgeId='809687-1-0';
type Point=number[];

// Survey footprint order runs out along one rail, across the nose and back
// along the opposite rail of each approach.
const arms=[[27,96,97,161],[162,240,241,294]] as const;
const landing=.025;
/** Stage 3 removed the southern tubular bridge before Kia was built.
 * Keep the northern crossing and both ground approaches, ending at their fork.
 * Development Victoria: Melbourne Park redevelopment, Stage 3. */
export function currentForkBridgeRing(ring:Point[]){
  const a=ring[457],b=ring[458],z=ring[294][1];
  const t=(z-a[1])/(b[1]-a[1]);
  return [...ring.slice(0,295),[a[0]+(b[0]-a[0])*t,z],...ring.slice(458)];
}
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

/** The NTC bridge survey includes two approach arms, not a level flying deck. */
export function tennisBridgeParts(ring:Point[],top:number){
  const ramp=(points:Point[],a:Point,b:Point,c:Point,d:Point)=>({
    ring:points,
    height:(x:number,z:number)=>{
      const rise=distanceToLine(x,z,c,d),remaining=distanceToLine(x,z,a,b);
      return landing+(top-landing)*rise/Math.max(.001,rise+remaining);
    },
  });
  return [
    ramp([ring[135],ring[136],...ring.slice(0,4)],ring[135],ring[3],ring[0],ring[1]),
    ramp(ring.slice(22,30),ring[22],ring[29],ring[24],ring[25]),
    {ring:[...ring.slice(3,23),...ring.slice(29,136)],height:(_x:number,_z:number)=>top},
  ];
}
