import { axial, centre, project, type Point, type Terrain } from './geography';

export type PlaceRow = [
  id: string,
  name: string,
  state: string,
  lon: number,
  lat: number,
  population: number,
];
export type Place = Point & {
  id: string;
  name: string;
  state: string;
  lon: number;
  lat: number;
  population: number;
  search: string;
  urban: boolean;
};
export function normaliseName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
export function preparePlaces(rows: PlaceRow[]): Place[] {
  return rows
    .map(([id, name, state, lon, lat, population]) => ({
      id,
      name,
      state,
      lon,
      lat,
      population,
      search: normaliseName(name),
      urban: id.startsWith('U'),
      ...project(lon, lat),
    }))
    .sort((a, b) => b.population - a.population || a.id.localeCompare(b.id));
}
export function placeType(p: Place) {
  return p.urban ? 'Urban centre / locality' : 'Suburb / locality';
}
export function searchPlaces(places: Place[], query: string, state: string, kind: string) {
  const term = normaliseName(query.trim());
  const found = places.filter(
    (p) =>
      (!state || p.state === state) && (!kind || (kind === 'urban') === p.urban) && p.search.includes(term),
  );
  if (term) {
    const rank = (p: Place) =>
      p.search === term ? 0 : p.search.startsWith(term + ' (') ? 1 : p.search.startsWith(term) ? 2 : 3;
    found.sort((a, b) => rank(a) - rank(b));
  }
  return found;
}
export function distanceKm(a: Place, b: Place) {
  const rad = Math.PI / 180,
    dlat = (a.lat - b.lat) * rad,
    dlon = (a.lon - b.lon) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export type Site = { place: Place; q: number; r: number; terrain: number };
export type Board = { sites: Site[]; tiles: { q: number; r: number; terrain: number }[] };
const ring = [
  [3, 0],
  [0, 3],
  [-3, 3],
  [-3, 0],
  [0, -3],
  [3, -3],
];
export const terrainLookup = (terrain: Terrain) =>
  new Map(terrain.cells.map(([q, r, , type]) => [q + ',' + r, type]));
function angleDifference(a: number, b: number) {
  return Math.acos(Math.max(-1, Math.min(1, Math.cos(a - b))));
}

export function buildBoard(home: Place, places: Place[], land: Map<string, number>): Board {
  const terrainAt = (p: Point) => land.get(axial(p.x, p.y).join(',')) ?? -1;
  const sites: Site[] = [{ place: home, q: 0, r: 0, terrain: terrainAt(home) }];
  const basename = (p: Place) => p.search.replace(/\s*\(.*$/, '');
  const usedNames = new Set([basename(home)]);
  // Use distinct surrounding SALs. An overlapping urban-centre geography is never a satellite.
  const nearby = places
    .filter((p) => !p.urban && p.population > 0 && p.id !== home.id)
    .map((place) => ({
      place,
      d: distanceKm(home, place),
      angle: Math.atan2(home.y - place.y, place.x - home.x),
    }))
    .filter((p) => p.d > 0.1 && !usedNames.has(basename(p.place)))
    .sort((a, b) => a.d - b.d)
    .slice(0, 36);
  const localRange = nearby[5]?.d || 1;
  for (const [i, [q, r]] of ring.entries()) {
    const bearing = (i * Math.PI) / 3;
    let best: (typeof nearby)[number] | undefined,
      bestScore = Infinity;
    for (const p of nearby) {
      if (usedNames.has(basename(p.place))) continue;
      const score = p.d / localRange + 2.7 * angleDifference(p.angle, bearing);
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      usedNames.add(basename(best.place));
      sites.push({ place: best.place, q, r, terrain: terrainAt(best.place) });
    }
  }
  const kmPerHex = Math.max(1, ...sites.map((s) => distanceKm(s.place, home))) / 3;
  const tiles = [];
  for (let q = -4; q <= 4; q++)
    for (let r = Math.max(-4, -q - 4); r <= Math.min(4, -q + 4); r++) {
      const site = sites.find((s) => s.q === q && s.r === r);
      const offset = centre(q, r);
      tiles.push({
        q,
        r,
        terrain:
          site?.terrain ??
          terrainAt({ x: home.x + (offset.x * kmPerHex) / 25, y: home.y + (offset.y * kmPerHex) / 25 }),
      });
    }
  return { sites, tiles };
}

// National partners occupy spare board hexes. Real point-to-point distances still set every route price.
export function extendBoard(local: Board, partners: Place[], land: Map<string, number>): Board {
  if (!partners.length) return local;
  const sites = [...local.sites],
    home = sites[0].place;
  for (const place of partners) {
    if (sites.some((s) => s.place.id === place.id)) continue;
    const direction = Math.atan2(home.y - place.y, place.x - home.x);
    const occupied = sites.map((s) => centre(s.q, s.r));
    const available = local.tiles.filter((t) => !sites.some((s) => s.q === t.q && s.r === t.r));
    const preference = (tile: { q: number; r: number }) => {
      const point = centre(tile.q, tile.r);
      const separation = Math.min(...occupied.map((p) => Math.hypot(point.x - p.x, point.y - p.y)));
      return separation - angleDifference(direction, Math.atan2(-point.y, point.x)) * 0.42;
    };
    const [slot] = available.sort((a, b) => preference(b) - preference(a));
    if (slot)
      sites.push({
        place,
        q: slot.q,
        r: slot.r,
        terrain: land.get(axial(place.x, place.y).join(',')) ?? -1,
      });
  }
  return {
    sites,
    tiles: local.tiles.map((t) => ({
      ...t,
      terrain: sites.find((s) => s.q === t.q && s.r === t.r)?.terrain ?? t.terrain,
    })),
  };
}
