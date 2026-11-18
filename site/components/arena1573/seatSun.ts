import type { SectionId, SeatingVenue } from './seating';

export type SeatSunAtlas = {
  readonly sections: ReadonlyMap<string, number>;
  readonly masks: Uint16Array;
  readonly step: number;
  readonly azimuths: number;
  readonly elevations: number;
};
type Sun = { aboveHorizon: boolean; direction: readonly number[] };

/** Each bit is an unobstructed sky ray from one seated head. Bit 4 is the
 * representative section camera. Two-byte runs store up to 128 equal masks. */
export function decodeSeatSun(bytes: ArrayBuffer): SeatSunAtlas {
  const data = new DataView(bytes);
  if (bytes.byteLength < 12 || data.getUint32(0) !== 0x414f5355 || data.getUint8(4) !== 1) {
    throw new Error('Unrecognised arena sunlight data');
  }
  const step = data.getUint8(5), count = data.getUint16(8, true), keyLength = data.getUint16(10, true);
  const start = 12 + keyLength;
  if (step !== 2 || data.getUint8(6) !== 9 || count === 0 || count > 256 || start >= bytes.byteLength || (bytes.byteLength-start)%2) {
    throw new Error('Invalid arena sunlight grid');
  }
  const keys = new TextDecoder().decode(new Uint8Array(bytes,12,keyLength)).split('\n');
  const sections = new Map(keys.map((key, i) => [key, i]));
  if (keys.length !== count || sections.size !== count) throw new Error('Invalid arena sunlight sections');
  const azimuths = 360/step, elevations = 90/step+1;
  const masks = new Uint16Array(count*azimuths*elevations);
  let index = 0;
  for (let cursor = start; cursor < bytes.byteLength; cursor += 2) {
    const run = data.getUint16(cursor,true), next = index + (run & 127) + 1;
    if (next > masks.length) throw new Error('Invalid arena sunlight run');
    masks.fill(run >>> 7,index,next);
    index = next;
  }
  if (index !== masks.length) throw new Error('Incomplete arena sunlight grid');
  return { sections, masks, step, azimuths, elevations };
}

let pending: Promise<SeatSunAtlas> | undefined;
export function loadSeatSun(): Promise<SeatSunAtlas> {
  if (!pending) {
    pending = fetch('/data/ao-seat-sun-v1.bin').then(async response => {
      if (!response.ok) throw new Error('Could not load arena sunlight data');
      return decodeSeatSun(await response.arrayBuffer());
    }).catch(error => { pending = undefined; throw error; });
  }
  return pending;
}

function sunlightMask(atlas: SeatSunAtlas, venue: SeatingVenue, id: SectionId, sun: Sun, closed: boolean) {
  if (closed || !sun.aboveHorizon) return 0;
  const [x,y,z] = sun.direction;
  if (!(y > 0) || !Number.isFinite(x+y+z)) return 0;
  const section = atlas.sections.get(venue+'/'+id);
  if (section === undefined) throw new RangeError('Unknown arena seating section');
  const {azimuths,elevations,step,masks} = atlas;
  // The incoming direction already includes the court's rotation. The bake
  // uses the same model-space axes, so no geographic north correction is needed.
  const a = ((Math.atan2(x,z)*180/Math.PI+360)%360)/step;
  const e = Math.atan2(y,Math.hypot(x,z))*180/Math.PI/step;
  const col = Math.floor(a), row = Math.min(elevations-1,Math.floor(e));
  const row0 = (section*elevations+row)*azimuths;
  const row1 = row0+(row+1<elevations?azimuths:0);
  const right = (col+1)%azimuths;
  const m00=masks[row0+col],m10=masks[row0+right],m01=masks[row1+col],m11=masks[row1+right];
  if (m00===m10 && m00===m01 && m00===m11) return m00;
  const u=a-col,v=e-row;
  let mask=0;
  for(let bit=1;bit<512;bit*=2){
    const lower=(m00&bit)*(1-u)+(m10&bit)*u,upper=(m01&bit)*(1-u)+(m11&bit)*u;
    if(lower*(1-v)+upper*v>=bit*.5)mask|=bit;
  }
  return mask;
}

/** Number of sunlit samples out of nine across this bay, with the given roof state. */
export function sectionSun(atlas: SeatSunAtlas, venue: SeatingVenue, id: SectionId, sun: Sun, closed: boolean) {
  let mask=sunlightMask(atlas,venue,id,sun,closed),count=0;
  while(mask){mask&=mask-1;count++;}
  return count;
}

export function sectionCentreSun(atlas: SeatSunAtlas, venue: SeatingVenue, id: SectionId, sun: Sun, closed: boolean) {
  return (sunlightMask(atlas,venue,id,sun,closed)&16)!==0;
}
