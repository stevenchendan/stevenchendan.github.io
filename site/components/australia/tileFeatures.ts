import { axial, centre, project, type Cell, type Point, type Terrain } from './geography';
import type { Place } from './places';

export type LandCover = { year: number; source: string; classes: string[]; cover: number[] };
export type Landmark = {
  id: string;
  name: string;
  state: string;
  lon: number;
  lat: number;
  kind: string;
  source: string;
};
export type TileFeature = Point & {
  cell: Cell;
  sprite: string;
  tint: string;
  coverName: string | null;
  town?: Place;
  landmarks: { site: Landmark; coastal: boolean }[];
};

// Ground colour and illustrations share the same classification as the tile inspector.
const landCoverStyle: Record<string, [name: string, sprite: string, tint: string]> = {
  water: ['水域', 'water', '#70a2a4'],
  forest: ['森林', 'forest', '#83a575'],
  shrubland: ['灌丛', 'scrub', '#c6a275'],
  savanna: ['稀树草原', 'woodland', '#b4b27a'],
  grassland: ['草地', 'grass', '#c8bd81'],
  wetland: ['湿地', 'wetland', '#88ad91'],
  cropland: ['耕地', 'crops', '#cebb76'],
  built: ['城镇建设用地', 'urban', '#b6a591'],
  mosaic: ['农田与自然植被混合区', 'crops', '#b9bc85'],
  snow: ['冰雪', 'snow', '#dce2db'],
  barren: ['裸地或稀疏植被', 'rock', '#ce9d77'],
};
const landforms = ['低地', '平原', '台地', '荒漠', '丘陵', '山地'];
export function landform(cell: Cell) {
  return landforms[cell[3]];
}
export function tileName(t: TileFeature) {
  if (t.landmarks.length) return t.landmarks.map((l) => l.site.name).join(' · ');
  if (t.town) return t.town.name;
  if (t.sprite === 'ridge' || !t.coverName) return landform(t.cell);
  return t.coverName;
}
export function buildFeatures(terrain: Terrain, cover: LandCover, places: Place[], landmarks: Landmark[]) {
  const tiles = new Map<string, TileFeature>();
  terrain.cells.forEach((cell, i) => {
    const [q, r] = cell;
    const style = landCoverStyle[cover.classes[cover.cover[i]]];
    const ridge = cell[3] === 5;
    tiles.set(q + ',' + r, {
      ...centre(q, r),
      cell,
      sprite: ridge ? 'ridge' : (style?.[1] ?? 'relief'),
      tint: style?.[2] ?? '#bcad8d',
      coverName: style?.[0] ?? null,
      landmarks: [],
    });
  });
  for (const p of places) {
    if (!p.urban || p.population < 10000) continue;
    const tile = tiles.get(axial(p.x, p.y).join(','));
    if (
      tile &&
      terrain.states[tile.cell[2]] === p.state &&
      (!tile.town || tile.town.population < p.population)
    ) {
      tile.town = p;
      tile.sprite = tile.sprite === 'urban' || p.population >= 100000 ? 'urban' : 'town';
    }
  }
  for (const site of landmarks) {
    const point = project(site.lon, site.lat);
    let tile = tiles.get(axial(point.x, point.y).join(','));
    const coastal = !tile || terrain.states[tile.cell[2]] !== site.state;
    if (coastal) {
      // Coastline generalisation can put a waterfront site between land centres.
      // Restrict the illustrated displacement to one spacing, within the same jurisdiction.
      tile = undefined;
      let best = 1;
      for (const t of tiles.values()) {
        if (terrain.states[t.cell[2]] !== site.state) continue;
        const d = Math.hypot(t.x - point.x, t.y - point.y);
        if (d <= best) {
          tile = t;
          best = d;
        }
      }
    }
    if (!tile) continue;
    tile.landmarks.push({ site, coastal });
    if (tile.landmarks.length === 1) tile.sprite = landmarkSprite(site);
  }
  return tiles;
}
function landmarkSprite(site: Landmark) {
  if (site.id === 'cascades-female-factory') return 'cascades';
  switch (site.kind) {
    case 'sails':
      return 'opera-house';
    case 'dome':
      return 'exhibition-building';
    case 'parliament':
      return 'parliament-house';
    case 'monolith':
      return 'uluru';
    default:
      return site.kind;
  }
}
