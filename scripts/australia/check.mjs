import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const json = (path) => JSON.parse(read(path));
const terrain = json('public/data/australia/terrain.json');
const grid = json('public/data/australia/regions-grid.json');
const census = json('site/data/australia/regions.json');
const heritage = json('site/data/australia/wonders.json');
const compiled = ts.transpileModule(read('site/components/australia/geography.ts'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const geo = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const regions = new Map(census.regions.map((p) => [p.code, p]));
const represented = new Set();
const keys = new Set();
let matched = 0;
for (const [q, r, state, kind, elevation] of terrain.cells) {
  const p = geo.centre(q, r);
  const [pickedQ, pickedR] = geo.axial(p.x, p.y);
  assert.ok(pickedQ === q && pickedR === r, 'Picking a drawn hex must return the same cell');
  assert.ok(terrain.states[state] && terrain.terrains[kind] && Number.isFinite(elevation));
  keys.add(q + ',' + r);
  const code = geo.regionCode(grid, q, r);
  if (!code) continue;
  assert.equal(regions.get(code)?.state, terrain.states[state], 'Join must preserve jurisdiction');
  represented.add(code);
  matched++;
}
assert.equal(keys.size, terrain.cells.length);
assert.equal(terrain.cells.length, census.metadata.gridCoverage.terrainCells);
assert.equal(matched, census.metadata.gridCoverage.matched);
assert.equal(represented.size, census.metadata.gridCoverage.representedRegions);
// The EPSG:3577 origin is on the equator on its central meridian.
const origin = geo.project(132, 0);
assert.ok(origin.x === 0 && origin.y === 0);
// Independent reference point transformed with PROJ, compared at metre tolerance.
const canberra = geo.project(149.13, -35.2809);
assert.ok(Math.abs(canberra.x * 25000 - 1550557.24) < 1);
assert.ok(Math.abs(-canberra.y * 25000 - -3957467.75) < 1);
assert.equal(new Set(census.cities.map((p) => p.state)).size, 8);
assert.equal(regions.size, 89);
for (const p of [...regions.values(), ...census.cities]) {
  assert.ok(p.signatureIndustry.share >= 5 && p.signatureIndustry.count <= p.employed);
  assert.ok(p.employed <= p.population && p.weeklyIncome > 0);
}
assert.equal(new Set(heritage.sites.map((p) => p.id)).size, 18);
console.log(
  `Verified ${keys.size} unique hexes, ${matched} census joins, ${regions.size} regions, eight capitals and 18 wonders.`,
);
