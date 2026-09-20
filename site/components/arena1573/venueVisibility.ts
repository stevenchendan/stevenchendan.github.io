/** Primary venues remain visible when their surrounding context is hidden. */
export function venueVisible(venue:string|undefined,selected:string,surroundings:boolean){
  return surroundings||!!venue&&(selected==='all'||venue===selected);
}

export function courtVenue(id:string,x:number){
  if(id==='way/126844352')return '1573';
  if(id==='way/1239949234')return 'mca';
  if(id==='way/1239949235')return 'rla';
  if(id==='way/1239949236')return 'kia';
  if(id==='john-cain-interior')return 'john';
  return x>590?'east':'west';
}

export function buildingVenue(building:{name?:string;id:string}){
  if(building.name==='Margaret Court Arena')return 'mca';
  if(building.name==='Rod Laver Arena')return 'rla';
  if(building.name==='John Cain Arena')return 'john';
  if(building.name==='Centrepiece Melbourne')return 'centrepiece';
  if(building.id.startsWith('810422-'))return 'ntc';
  return undefined;
}
