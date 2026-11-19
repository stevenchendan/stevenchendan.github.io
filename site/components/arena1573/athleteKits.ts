// The baked motion contains indices into this exact body mesh.
export const athleteModelUrl='/models/tennis/rally-athlete.glb?v=fc4120dd';
export const athleteMotionUrl='/models/tennis/precinct-motion.bin?v=43c2991b';

// Unbranded kits remain consistent between precinct, courtside and close-up.
const combinations=[
  ['#286e82','#df8f38'],['#e1eadf','#31588b'],['#bf6049','#344d59'],['#344f82','#e4ce7e'],
  ['#547859','#f3e5ca'],['#f3d8c4','#2a6774'],['#77618d','#d0d697'],['#e5e8e3','#ab5152'],
] as const;
export const portraits=['TennisCap','HeadbandPlayer','CroppedPlayer','TiedPlayer'] as const;
export const skinTones=['#c89779','#8c5c45','#b57c5a','#ac7457'];
const bottoms=['#213944','#eef0e7','#34304a','#27465c','#42463b','#272b34'];
export function matchPair(court?:string){
  const shirts=courtKit(court);
  let seed=0;
  for(const ch of court??'')seed=(Math.imul(seed,31)+ch.charCodeAt(0))>>>0;
  const first=!court||court==='1573'?0:seed%4;
  const second=!court||court==='1573'?1:(first+1+Math.floor(seed/4)%3)%4;
  return [first,second].map((portrait,i)=>({
    portrait,shirt:shirts[i],shorts:bottoms[(Math.floor(seed/7)+i*3)%bottoms.length],
    build:((Math.imul(seed+1,i?7919:3571)>>>0)%17-7)/9,
  }));
}
export function courtKit(court?:string){
  if(!court||court==='1573')return combinations[0];
  let hash=0;
  for(const letter of court)hash=Math.imul(hash,31)+letter.charCodeAt(0);
  return combinations[(hash>>>0)%combinations.length];
}
