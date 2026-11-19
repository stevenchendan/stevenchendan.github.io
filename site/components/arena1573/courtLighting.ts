import * as T from 'three';
import { courtFrame } from './precinctGeometry';
import { rallyCourts } from './courtPlacements';
import { courtVenue } from './venueVisibility';
import type { ContextData } from './model';

const resolution = 1.6;
const showCourtSpan: Record<string,number> = { rla:33.9, john:30, mca:23.5, kia:26, '1573':22.7 };

/** One world-space irradiance field lights every match at once. Red and green
 * separate open-air and roofed courts so evening and rain can be staged separately. */
export function courtLighting(data: ContextData) {
  const courts = [{ id:'way/126844352', x:0, y:0, z:0, rotation:0 }, ...rallyCourts(data)];
  const frames = new Map(data.features.filter(f => f.kind === 'court').map(f => [f.id, courtFrame(f.points)]));
  const x0 = Math.floor(Math.min(...courts.map(c => c.x)) - 76), z0 = Math.floor(Math.min(...courts.map(c => c.z)) - 85);
  const width = Math.ceil((Math.max(...courts.map(c => c.x)) + 76 - x0) / resolution);
  const height = Math.ceil((Math.max(...courts.map(c => c.z)) + 85 - z0) / resolution);
  const pixels = new Uint8Array(width * height * 4);
  const circuits = courts.map(c => {
    const venue = courtVenue(c.id, c.x), indoor = ['rla','mca','john'].includes(venue);
    const show = indoor || ['1573','kia'].includes(venue) || c.id === 'way/126844350';
    const mastX = show ? (showCourtSpan[venue] ?? 22) : (frames.get(c.id)?.width ?? 20) / 2 + .7;
    const mastY = indoor ? venue === 'mca' ? 13.8 : 22.5 : venue==='1573' ? 19 : show ? 17 : 12;
    const cos = Math.cos(c.rotation), sin = Math.sin(c.rotation);
    const lamps: T.Vector3[] = [];
    for (const side of [-1,1]) for (const v of venue==='1573' ? [-23,0,23] : show ? [-16,0,16] : [0]) {
      const u = side * mastX;
      lamps.push(new T.Vector3(c.x + u*cos + v*sin, c.y + mastY, c.z - u*sin + v*cos));
    }
    const reach = show ? 70 : 35;
    for (let iz = Math.max(0, Math.floor((c.z-reach-z0)/resolution)); iz < Math.min(height, (c.z+reach-z0)/resolution); iz++) {
      for (let ix = Math.max(0, Math.floor((c.x-reach-x0)/resolution)); ix < Math.min(width, (c.x+reach-x0)/resolution); ix++) {
        const dx = x0 + (ix+.5)*resolution-c.x, dz = z0 + (iz+.5)*resolution-c.z;
        const u = Math.abs(dx*cos-dz*sin), v = Math.abs(dx*sin+dz*cos);
        const edge = Math.hypot(Math.max(0,u-8.6), Math.max(0,v-15.5));
        const fall = Math.exp(-edge*edge / (show ? 170 : 38));
        const gallery = show ? .29 * Math.exp(-edge*edge / 715) : 0;
        const light = Math.min(255, Math.round(225*fall + 94*gallery));
        const p = (iz*width+ix)*4;
        const ch = indoor ? 1 : 0;
        if (light > pixels[p+ch]) {
          pixels[p+ch] = light;
          // The strongest field in each circuit owns its own ceiling. The
          // taller outdoor masts must not lift indoor light onto a closed roof.
          pixels[p+2+ch] = Math.round((mastY+c.y) * 6);
        }
      }
    }
    return { c, venue, indoor, lamps };
  });
  const texture = new T.DataTexture(pixels,width,height);
  texture.minFilter = texture.magFilter = T.LinearFilter; texture.needsUpdate = true;
  return { circuits, texture, bounds: new T.Vector4(x0,z0,width*resolution,height*resolution) };
}
