export type Point2 = number[];
export type CourtFrame = {x:number;z:number;rotation:number;width:number;depth:number};

export type PavingRect = [number,number,number,number,string];
/** Partition overlapping painted rectangles into disjoint cells, last colour wins. */
export function pavingCells(rects:PavingRect[]):PavingRect[]{
  const xs=[...new Set(rects.flatMap(([x,,w])=>[x-w/2,x+w/2]))].sort((a,b)=>a-b);
  const zs=[...new Set(rects.flatMap(([,z,,d])=>[z-d/2,z+d/2]))].sort((a,b)=>a-b);
  const cells:PavingRect[]=[];
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
    const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;
    const rect=[...rects].reverse().find(([cx,cz,w,d])=>Math.abs(x-cx)<w/2&&Math.abs(z-cz)<d/2);
    if(rect)cells.push([x,z,xs[i+1]-xs[i],zs[j+1]-zs[j],rect[4]]);
  }
  return cells;
}

// Use every vertex: several eastern courts are chamfered octagons.
// Their first four vertices describe an end, not the whole playing enclosure.
export function courtFrame(points:Point2[]):CourtFrame {
  let dx=0,dz=1,longest=0;
  points.forEach((p,i)=>{
    const q=points[(i+1)%points.length],length=Math.hypot(q[0]-p[0],q[1]-p[1]);
    if(length>longest){longest=length;dx=q[0]-p[0];dz=q[1]-p[1];}
  });
  let rotation=Math.atan2(dx,dz);
  // Equivalent orientations use a consistent sign for stable camera/model data.
  if(rotation>Math.PI/2)rotation-=Math.PI;
  if(rotation<-Math.PI/2)rotation+=Math.PI;
  const c=Math.cos(rotation),s=Math.sin(rotation);
  const us=points.map(p=>p[0]*c-p[1]*s),vs=points.map(p=>p[0]*s+p[1]*c);
  const loU=Math.min(...us),hiU=Math.max(...us),loV=Math.min(...vs),hiV=Math.max(...vs);
  const u=(loU+hiU)/2,v=(loV+hiV)/2;
  return {x:u*c+v*s,z:-u*s+v*c,rotation,width:hiU-loU,depth:hiV-loV};
}

// Clip entire path strips against court enclosures (including half their width).
// Returning intervals preserves the two sides of a path that crosses a court.
export function pathIntervals(a:Point2,b:Point2,frames:CourtFrame[],padding=0):[number,number][] {
  let result:[number,number][]=[[0,1]];
  for(const f of frames){
    const c=Math.cos(f.rotation),s=Math.sin(f.rotation);
    const local=(p:Point2)=>[(p[0]-f.x)*c-(p[1]-f.z)*s,(p[0]-f.x)*s+(p[1]-f.z)*c];
    const p=local(a),q=local(b),half=[f.width/2+padding,f.depth/2+padding];
    let enter=0,leave=1;
    for(let axis=0;axis<2;axis++){
      const delta=q[axis]-p[axis];
      if(Math.abs(delta)<1e-9){if(Math.abs(p[axis])>half[axis]){enter=1;leave=0;break;}}
      else {const t1=(-half[axis]-p[axis])/delta,t2=(half[axis]-p[axis])/delta;enter=Math.max(enter,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));}
    }
    if(leave<=enter)continue;
    result=result.flatMap(([lo,hi])=>{
      if(leave<=lo||enter>=hi)return [[lo,hi]];
      const pieces:[number,number][]=[];
      if(enter>lo)pieces.push([lo,enter]);if(leave<hi)pieces.push([leave,hi]);return pieces;
    });
  }
  return result.filter(([lo,hi])=>hi-lo>1e-5);
}

export function pointInRing(point:Point2,ring:Point2[]) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
