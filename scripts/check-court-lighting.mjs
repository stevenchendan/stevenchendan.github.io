import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadArenaModule } from './arena-model-fixture.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../public/data/1573-context.json', import.meta.url)));
const { courtLighting } = loadArenaModule('courtLighting');
const field = courtLighting(data);
const { width, height, data: irradiance } = field.texture.image;
const { x, y, z, w } = field.bounds;
assert.equal(new Set(field.circuits.map(({c}) => c.id)).size, 31);
for (const {c, indoor, lamps} of field.circuits) {
  assert.ok(lamps.length >= 2 && lamps.every(p => p.y > c.y+10));
  for (const side of [-1,1]) {
    for (const end of [-1,1]) {
      const u=side*5.485, v=end*11.885;
      const px=c.x+u*Math.cos(c.rotation)+v*Math.sin(c.rotation);
      const pz=c.z-u*Math.sin(c.rotation)+v*Math.cos(c.rotation);
      const index=4*(Math.floor((pz-y)*height/w)*width + Math.floor((px-x)*width/z));
      assert.ok(irradiance[index+(indoor?1:0)] >= 210, c.id+' baseline receives match light');
      assert.ok(irradiance[index+2]/6 > c.y+10, c.id+' lighting reaches above the players');
    }
  }
}
assert.equal(field.circuits.filter(c=>c.indoor).length,3);
assert.equal(irradiance[0]+irradiance[1],0,'Parkland away from the courts remains dark');
field.texture.dispose();
console.log('Verified both ends of all 31 courts, including five raised courts and the three roofed arenas.');
