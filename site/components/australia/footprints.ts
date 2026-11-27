import { regionCode, type Cell, type RegionGrid, type Selection, type Terrain } from './geography';

export type Footprints = {
  cells: Record<string, number[]>;
  anchors: Record<string, number>;
  membership: Record<string, [string | null, string | null]>;
};

export function areaCells(s: Selection, terrain: Terrain, grid: RegionGrid, footprints: Footprints): Cell[] {
  if (s.kind === 'region') return terrain.cells.filter(([q, r]) => regionCode(grid, q, r) === s.profile.code);
  const id = s.kind === 'place' ? s.place.id : s.kind === 'city' ? s.profile.code : '';
  return (footprints.cells[id] ?? []).map((i) => terrain.cells[i]);
}
