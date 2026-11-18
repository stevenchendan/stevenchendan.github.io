import type { CourtFrame } from './precinctGeometry';

// AO26 transport map registered against nine surveyed arena/court centres.
// These outlines describe a visitor area, not the walls of a temporary tenancy.
export const eventWorlds = {
  hilltop: {name:'AO Hilltop', ring:[[-468,-207],[-449,-269],[-389,-302],[-325,-225]], centre:[-382,-244]},
  ballpark: {name:'AO Ballpark', ring:[[-447,-200],[-329,-219],[-249,-147],[-217,-126],[-224,-107],[-289,-145],[-361,-176],[-434,-186]], centre:[-326,-177]},
  topcourt: {name:'TOPCOURT', ring:[[-302,-221],[-165,-236],[-114,-111],[-158,-127],[-168,-143],[-238,-155]], centre:[-198,-195]},
  garden: {name:'Garden Square', ring:[[120,-113],[174,-99],[209,-74],[217,-23],[169,-39],[135,-48],[129,-79]], centre:[158,-55]},
  terrace: {name:'Rod Laver Arena Terrace', ring:[[254,12],[312,13],[307,55],[307,114],[274,99],[257,78]], centre:[279,65]},
  oval: {name:'Grand Slam Oval', ring:[[218,150],[245,132],[312,126],[373,146],[388,191],[376,237],[228,243],[206,201]], centre:[300,188]},
  village: {name:'Practice Village', ring:[[376,15],[418,17],[442,43],[439,86],[417,105],[382,111]], centre:[408,67]},
  courtside: {name:'Courtside Bar', ring:[[54,-177],[83,-177],[83,-128],[54,-128]], centre:[63,-155]},
} satisfies Record<string,{name:string;ring:number[][];centre:[number,number]}>;

export type EventWorldId = keyof typeof eventWorlds;
export type StructureKind = 'screen'|'umbrellas'|'marquee'|'stage'|'playcourt'|'slide'|'hotshots'|'bar'|'gallery'|'shop'|'lawn';
export type EventStructure = CourtFrame & {zone:EventWorldId;kind:StructureKind;name:string};

// Positions and forms of the activations are interpretations of the event-day
// aerial and AO programme. Each footprint also bounds eaves, decks and stairs.
const entries:[EventWorldId,StructureKind,string,number,number,number,number,number][]=[
  ['hilltop','screen','HILLTOP',-392,-251,20,9,16],
  ['hilltop','umbrellas','',-381,-239,26,13,16],
  ['hilltop','marquee','',-411,-229,18,8,16],
  ['hilltop','lawn','',-361,-250,17,11,16],
  ['ballpark','slide','BALLPARK',-322,-185,27,11,-22],
  ['ballpark','hotshots','HOT SHOTS',-344,-190,15,11,-20],
  ['ballpark','hotshots','',-360,-195,15,11,-20],
  ['ballpark','stage','KIDS STAGE',-302,-172,14,10,-24],
  ['ballpark','marquee','',-276,-157,16,8,-28],
  ['ballpark','umbrellas','',-335,-174,10,7,-20],
  ['topcourt','stage','TOPCOURT',-191,-195,29,21,-15],
  ['topcourt','playcourt','',-162,-185,21,13,-15],
  ['topcourt','playcourt','',-162,-202,21,13,-15],
  ['topcourt','bar','GAME ON',-221,-187,20,12,-20],
  ['topcourt','marquee','',-239,-192,16,9,-20],
  ['topcourt','umbrellas','',-211,-170,12,8,-20],
  ['garden','screen','GARDEN SQUARE',167,-58,14,5,-145],
  ['garden','umbrellas','',152,-56,13,8,22],
  ['garden','lawn','',163,-48,11,6,22],
  ['garden','marquee','',184,-77,12,6,12],
  ['terrace','shop','AO SHOP',273,65,15,7,0],
  ['terrace','marquee','',272,79,12,7,0],
  ['terrace','umbrellas','',273,89,13,9,0],
  ['oval','screen','GRAND SLAM OVAL',300,166,20,5,0],
  ['village','gallery','THE VILLAGE',434,54,5,16,0],
  ['village','bar','THE LOCAL',392,21,14,8,0],
  ['courtside','gallery','COURTSIDE BAR',65,-156,10,24,0],
];
export const eventStructures:EventStructure[]=entries.map(([zone,kind,name,x,z,width,depth,angle])=>({zone,kind,name,x,z,width,depth,rotation:angle*Math.PI/180}));

export function footprintRing({x,z,width,depth,rotation}:CourtFrame){
  const c=Math.cos(rotation),s=Math.sin(rotation);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[x+u*width/2*c+v*depth/2*s,z-u*width/2*s+v*depth/2*c]);
}
