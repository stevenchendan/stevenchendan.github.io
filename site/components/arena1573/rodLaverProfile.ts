// Reconstructed from match photographs and the AO seating plan, in metres.
// The published three-metre court wall sets the first spectator row.
export const rodLaverBanks = {
  lower: {rows:21, width:13.15, depth:21.55, radius:6.8, tread:.86, rise:.405, floor:3.12},
  upper: {rows:16, width:33.5, depth:41.9, radius:17.75, tread:.85, rise:.49, floor:13.65},
};
export type RodLaverTier = keyof typeof rodLaverBanks;

export function rodLaverRow(tier:RodLaverTier,row:number){
  const bank=rodLaverBanks[tier],run=row*bank.tread;
  return {w:bank.width+run,d:bank.depth+run,r:bank.radius+run*.55,y:bank.floor+row*bank.rise};
}

/** Project a direction on the ticket diagram onto a physical row. */
export function rodLaverRowPoint(w:number,d:number,r:number,x:number,z:number){
  const dx=x*w,dz=z*d;
  let lo=0,hi=5;
  for(let i=0;i<23;i++){
    const t=(lo+hi)/2,u=Math.max(0,Math.abs(t*dx)-w+r),v=Math.max(0,Math.abs(t*dz)-d+r);
    if(u*u+v*v<=r*r)lo=t;else hi=t;
  }
  return {x:dx*lo,z:dz*lo};
}

export function rodLaverSeatEye(x:number,z:number,level:number){
  const tier=level>.6?'upper':'lower',row=tier==='upper'?8:11;
  const {w,d,r}=rodLaverRow(tier,row+.52),p=rodLaverRowPoint(w,d,r,x,z);
  return [p.x,rodLaverRow(tier,row).y+1.32,p.z] as const;
}
