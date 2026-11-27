export type Cell = [q: number, r: number, state: number, terrain: number, elevation: number];
export type Terrain = { cells: Cell[]; states: string[]; terrains: string[] };
export type RegionGrid = { byRow: Record<string, number[]> };
export type Industry = { name: string; count: number; share: number; nationalShare: number };
export type Profile = {
  code: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  population: number;
  weeklyIncome: number;
  medianAge: number;
  employed: number;
  topIndustry: Industry;
  signatureIndustry: Industry;
};
export type Wonder = {
  id: number;
  name: string;
  shortLabel: string;
  year: number;
  category: string;
  lat: number;
  lon: number;
  url: string;
};
export type Selection =
  | { kind: 'country' }
  | { kind: 'cell'; cell: Cell }
  | { kind: 'region' | 'city'; profile: Profile }
  | { kind: 'wonder'; wonder: Wonder };
export type Point = { x: number; y: number };
export type Lens = 'terrain' | 'elevation' | 'population' | 'weeklyIncome' | 'medianAge' | 'employed';
export type Metric = Exclude<Lens, 'terrain' | 'elevation'>;
export const metrics: Metric[] = ['population', 'weeklyIncome', 'medianAge', 'employed'];
export const lenses: Record<Lens, string> = {
  terrain: 'Terrain',
  elevation: 'Elevation',
  population: 'Population',
  weeklyIncome: 'Income',
  medianAge: 'Age',
  employed: 'Workforce',
};
export const titles: Record<Metric, string> = {
  population: 'Residents',
  weeklyIncome: 'Median weekly income',
  medianAge: 'Median age',
  employed: 'Employed residents',
};
export const terrainColours = ['#91a97b', '#c6b67d', '#be935f', '#d8a367', '#8a9d69', '#89918a'];
export const elevationColours = ['#96b584', '#b5be88', '#d8ba81', '#b7906c', '#e4d8b4'];
export const statisticalColours = ['#c4d3af', '#92b59a', '#5f9787', '#33766f', '#154d55'];
export const limits: Record<Exclude<Lens, 'terrain'>, number[]> = {
  elevation: [100, 250, 500, 1000],
  population: [100000, 200000, 300000, 450000],
  weeklyIncome: [650, 775, 900, 1050],
  medianAge: [34, 38, 42, 46],
  employed: [50000, 90000, 150000, 220000],
};
export const fmt = (n: number) => n.toLocaleString('en-AU');
export const compact = (n: number) =>
  new Intl.NumberFormat('en-AU', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export function valueLabel(key: Metric, n: number) {
  return key === 'weeklyIncome' ? '$' + fmt(n) : key === 'medianAge' ? fmt(n) + ' years' : fmt(n);
}
export const regionCode = (grid: RegionGrid, q: number, r: number) => {
  const row = grid.byRow[r];
  return row && q >= row[0] ? String(row[q - row[0] + 1] || '') : '';
};
// EPSG:3577 ellipsoidal Albers, expressed in 25 km units with canvas y increasing south.
const radians = Math.PI / 180,
  a = 6378137,
  f = 1 / 298.257222101,
  e = Math.sqrt(f * (2 - f));
function authalic(latitude: number) {
  const s = Math.sin(latitude),
    es = e * s;
  return (1 - e * e) * (s / (1 - es * es) - Math.log((1 - es) / (1 + es)) / (2 * e));
}
const m2 = (lat: number) => Math.cos(lat) ** 2 / (1 - (e * Math.sin(lat)) ** 2);
const p1 = -18 * radians,
  p2 = -36 * radians;
const n = (m2(p1) - m2(p2)) / (authalic(p2) - authalic(p1));
const c = m2(p1) + n * authalic(p1);
const rho0 = (a * Math.sqrt(c)) / n;
export function project(lon: number, lat: number): Point {
  const rho = (a * Math.sqrt(c - n * authalic(lat * radians))) / n;
  const theta = n * (lon - 132) * radians;
  return { x: (rho * Math.sin(theta)) / 25000, y: (rho * Math.cos(theta) - rho0) / 25000 };
}
export const rowStep = Math.sqrt(3) / 2;
export const centre = (q: number, r: number): Point => ({ x: q + r / 2, y: -r * rowStep });
export function axial(x: number, y: number) {
  const r = -y / rowStep,
    q = x - r / 2,
    s = -q - r;
  let iq = Math.round(q),
    ir = Math.round(r);
  const is = Math.round(s),
    dq = Math.abs(iq - q),
    dr = Math.abs(ir - r),
    ds = Math.abs(is - s);
  if (dq > dr && dq > ds) iq = -ir - is;
  else if (dr > ds) ir = -iq - is;
  return [iq, ir];
}
export const states: Record<string, string> = {
  WA: 'Western Australia',
  NT: 'Northern Territory',
  QLD: 'Queensland',
  NSW: 'New South Wales',
  ACT: 'Australian Capital Territory',
  VIC: 'Victoria',
  SA: 'South Australia',
  TAS: 'Tasmania',
  OT: 'Other Territories',
};
// City labels use the city centre. Census values describe the entire GCCSA.
export const capitals: Record<string, [string, number, number]> = {
  NSW: ['Sydney', 151.2093, -33.8688],
  VIC: ['Melbourne', 144.9631, -37.8136],
  QLD: ['Brisbane', 153.0251, -27.4698],
  WA: ['Perth', 115.8605, -31.9505],
  SA: ['Adelaide', 138.6007, -34.9285],
  TAS: ['Hobart', 147.3272, -42.8821],
  NT: ['Darwin', 130.8456, -12.4634],
  ACT: ['Canberra', 149.13, -35.2809],
};
export const cityName = (p: Profile) => capitals[p.state]?.[0] || p.name;
export function locationOf(s: Selection): Point | null {
  if (s.kind === 'country') return null;
  if (s.kind === 'cell') return centre(s.cell[0], s.cell[1]);
  if (s.kind === 'wonder') return project(s.wonder.lon, s.wonder.lat);
  if (s.kind === 'region' && s.profile.state === 'OT') return null;
  if (s.kind === 'city' && capitals[s.profile.state]) {
    const [, lon, lat] = capitals[s.profile.state];
    return project(lon, lat);
  }
  return project(s.profile.lon, s.profile.lat);
}
