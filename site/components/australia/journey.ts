import { distanceKm, type Place } from './places';
import type { Footprints } from './footprints';
import { capitals, project } from './geography';

export const JOURNEY_KEY = 'common-ground.trader.v1';
// Capital trading posts sit at the city-centre marker, which can be far from a UCL's interior point.
export const capitalTown: Record<string, string> = {
  NSW: 'U101001',
  VIC: 'U201001',
  QLD: 'U301001',
  SA: 'U401001',
  WA: 'U501001',
  TAS: 'U603001',
  NT: 'U703001',
  ACT: 'U802001',
};
export function tradingPlaces(places: Place[]) {
  return places.map((p) => {
    if (capitalTown[p.state] !== p.id) return p;
    const [, lon, lat] = capitals[p.state];
    return { ...p, lon, lat, ...project(lon, lat) };
  });
}
export type Job = { from: string; to: string; cargo: string; due: number; fee: number };
export type Journey = {
  version: 1;
  home: string;
  here: string;
  day: number;
  cash: number;
  deliveries: number;
  trust: Record<string, number>;
  trained: boolean;
  job: Job | null;
  note: string;
};
export const startJourney = (p: Place): Journey => ({
  version: 1,
  home: p.id,
  here: p.id,
  day: 1,
  cash: 24,
  deliveries: 0,
  trust: {},
  trained: false,
  job: null,
  note: '第一天。合作社柜台上放着两张待签的运单。',
});
const whole = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
export function readJourney(raw: string | null, byId: Map<string, Place>): Journey | null {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (
      !v ||
      v.version !== 1 ||
      !byId.has(v.home) ||
      !byId.has(v.here) ||
      !whole(v.day) ||
      v.day < 1 ||
      !whole(v.cash) ||
      !whole(v.deliveries) ||
      typeof v.trained !== 'boolean' ||
      typeof v.note !== 'string' ||
      !v.trust ||
      Array.isArray(v.trust) ||
      typeof v.trust !== 'object' ||
      !Object.entries(v.trust).every(([id, n]) => byId.has(id) && whole(n))
    )
      return null;
    const j = v.job;
    if (
      j !== null &&
      (!j ||
        !byId.has(j.from) ||
        !byId.has(j.to) ||
        j.from === j.to ||
        typeof j.cargo !== 'string' ||
        !whole(j.fee) ||
        !whole(j.due))
    )
      return null;
    return v;
  } catch {
    return null;
  }
}
export function keeper(p: Place) {
  const names = ['Mia', 'Theo', 'Jules', 'Frankie', 'Sam', 'Anika', 'Lou', 'Kit', 'Robin', 'Jess', 'Noah'];
  return names[Number(p.id.slice(1)) % names.length];
}
export function rank(j: Journey) {
  if (j.deliveries >= 3 && Object.keys(j.trust).length >= 3) return '合作社合伙人';
  return j.deliveries ? '签约行商' : '见习行商';
}
export function localDestinations(here: Place, places: Place[], fp: Footprints) {
  const candidates = places
    .filter((p) => !p.urban && p.id !== here.id && p.population > 0 && p.search !== here.search)
    .map((p) => ({ p, km: distanceKm(here, p) }))
    .filter((x) => x.km > 0.15);
  const urban = here.urban ? here.id : fp.membership[here.id]?.[0];
  candidates.sort((a, b) => a.km - b.km);
  const local = urban
    ? candidates.filter(
        (x) => fp.membership[x.p.id]?.[0] === urban && x.km <= Math.max(30, candidates[0]?.km ?? 0),
      )
    : [];
  const combined = new Set([...local.slice(0, 5).map((x) => x.p), ...candidates.slice(0, 8).map((x) => x.p)]);
  return [...combined].slice(0, 8);
}
export function passage(from: Place, to: Place, trained: boolean) {
  const km = distanceKm(from, to);
  const expressDays = Math.max(1, Math.ceil(km / 350));
  return { km, slowDays: expressDays + 1, expressDays, fare: (trained ? 2 : 5) + Math.ceil(km / 100) };
}
export function jobs(j: Journey, here: Place, nearby: Place[]): Job[] {
  if (!nearby.length) return [];
  const premium = rank(j) === '合作社合伙人';
  const cargos = premium
    ? ['合作社联运货箱', '定制仪器']
    : ['菜园种子', '钟表零件', '织布机线轴', '装订样书'];
  const local = nearby[0],
    urgent = nearby[Math.min(nearby.length - 1, 3)];
  return [local, urgent].map((to, i) => {
    const trip = passage(here, to, j.trained);
    return {
      from: here.id,
      to: to.id,
      cargo: cargos[(j.deliveries + i) % cargos.length],
      due: j.day + (i ? trip.expressDays : trip.slowDays + 1),
      fee: (i ? 27 : 16) + Math.ceil(trip.km / 40) + (premium ? 14 : 0),
    };
  });
}
export function travel(j: Journey, from: Place, to: Place, express: boolean): Journey {
  if (from.id !== j.here || from.id === to.id) return j;
  const p = passage(from, to, j.trained);
  if (express && j.cash < p.fare) return j;
  return {
    ...j,
    here: to.id,
    day: j.day + (express ? p.expressDays : p.slowDays),
    cash: j.cash - (express ? p.fare : 0),
    note: '抵达 ' + to.name + '。' + keeper(to) + ' 在合作社柜台等你。',
  };
}
export function deliver(j: Journey): Journey {
  const job = j.job;
  if (!job || job.to !== j.here) return j;
  const onTime = j.day <= job.due,
    fee = onTime ? job.fee : Math.floor(job.fee / 2);
  const trust = { ...j.trust };
  if (onTime) for (const id of [job.from, job.to]) trust[id] = (trust[id] ?? 0) + 1;
  return {
    ...j,
    cash: j.cash + fee,
    deliveries: j.deliveries + 1,
    job: null,
    trust,
    note: onTime
      ? '按时签收，赚得 $' + fee + '。两地店主都记住了你。'
      : '货到了。误了交期，店主支付半价 $' + fee + '。',
  };
}
export function train(j: Journey): Journey {
  if (j.trained || !j.trust[j.here]) return j;
  return { ...j, trained: true, day: j.day + 1, note: '跟店主学了一天配载。以后每趟快车运费少 $3。' };
}
