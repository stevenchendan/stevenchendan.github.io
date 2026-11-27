import { distanceKm, type Site } from './places';
export type Building = 'market' | 'works' | 'campus';
export type Order = { kind: Building | 'link'; site: string } | { kind: 'reserve' };
export type Yields = { coins: number; supplies: number; prosperity: number };
export type CampaignState = Yields & {
  completed: number;
  buildings: Record<string, Building>;
  routes: { from: string; to: string }[];
};
export const maxTurns = 12,
  goalSites = 4,
  goalProsperity = 50;
export const projects: Record<Building, { name: string; coins: number; supplies: number }> = {
  market: { name: 'Market', coins: 3, supplies: 4 },
  works: { name: 'Workshop', coins: 4, supplies: 2 },
  campus: { name: 'Campus', coins: 7, supplies: 6 },
};
export const calendar = [
  {
    turn: 4,
    title: 'Materials squeeze',
    effect: 'District construction costs 2 extra supplies this turn.',
  },
  { turn: 7, title: 'Regional show', effect: 'Each working market earns 3 bonus prosperity this turn.' },
  { turn: 10, title: 'Works grant', effect: 'Each working workshop earns 4 bonus coins this turn.' },
];
export function initialState(): CampaignState {
  return { completed: 0, coins: 8, supplies: 6, prosperity: 0, buildings: {}, routes: [] };
}
export function status(s: CampaignState) {
  if (s.routes.length + 1 >= goalSites && s.prosperity >= goalProsperity) return 'won';
  return s.completed >= maxTurns ? 'lost' : 'playing';
}
export function linked(s: CampaignState, id: string, home: string) {
  return id === home || s.routes.some((r) => r.to === id);
}
export function bonus(site: Site, kind: Building) {
  if (kind === 'market') return site.place.population >= 10000;
  if (kind === 'campus') return site.place.population >= 3000;
  return site.place.population < 3000 || [2, 4, 5].includes(site.terrain);
}
export function output(site: Site, kind: Building): Yields {
  const extra = Number(bonus(site, kind));
  return {
    coins: kind === 'market' ? 3 + extra : 0,
    supplies: kind === 'works' ? 3 + extra : 0,
    prosperity: kind === 'campus' ? 2 + extra : 0,
  };
}
export function income(state: CampaignState, sites: Site[]): Yields {
  const yields = { coins: 2, supplies: 2, prosperity: state.routes.length + 1 };
  for (const route of state.routes) {
    const a = sites.find((s) => s.place.id === route.from),
      b = sites.find((s) => s.place.id === route.to);
    if (a && b && distanceKm(a.place, b.place) >= 50) yields.coins++;
  }
  for (const site of sites) {
    const building = state.buildings[site.place.id];
    if (building) {
      const y = output(site, building);
      yields.coins += y.coins;
      yields.supplies += y.supplies;
      yields.prosperity += y.prosperity;
    }
  }
  return yields;
}
export type Quote = { coins: number; supplies: number; reason: string; from?: string; km?: number };
export function quote(state: CampaignState, sites: Site[], order: Order): Quote {
  const free = { coins: 0, supplies: 0, reason: '' };
  if (status(state) !== 'playing') return { ...free, reason: 'This charter has ended.' };
  if (order.kind === 'reserve') return free;
  const site = sites.find((s) => s.place.id === order.site);
  if (!site) return { ...free, reason: 'Unknown settlement.' };
  const isLinked = linked(state, order.site, sites[0].place.id);
  let cost: Quote;
  if (order.kind === 'link') {
    if (isLinked) return { ...free, reason: 'Already connected.' };
    const partners = sites
      .filter((s) => linked(state, s.place.id, sites[0].place.id))
      .map((s) => ({ from: s.place.id, km: distanceKm(s.place, site.place) }))
      .sort((a, b) => a.km - b.km);
    const { from, km } = partners[0];
    const haul = km <= 5 ? 0 : km <= 20 ? 1 : km < 250 ? 2 : 3;
    cost = { coins: 3 + 2 * haul, supplies: 2 + haul + Number(site.terrain >= 4), reason: '', from, km };
  } else {
    if (!Object.hasOwn(projects, order.kind)) return { ...free, reason: 'Unknown district.' };
    if (!isLinked) return { ...free, reason: 'Connect this settlement first.' };
    if (state.buildings[order.site]) return { ...free, reason: 'The district slot is occupied.' };
    const b = projects[order.kind];
    cost = { coins: b.coins, supplies: b.supplies + (state.completed + 1 === 4 ? 2 : 0), reason: '' };
  }
  if (cost.coins > state.coins || cost.supplies > state.supplies) cost.reason = 'Insufficient resources.';
  return cost;
}
export function advance(state: CampaignState, sites: Site[], order: Order): CampaignState | null {
  const cost = quote(state, sites, order);
  if (cost.reason) return null;
  const next = {
    ...state,
    completed: state.completed + 1,
    coins: state.coins - cost.coins,
    supplies: state.supplies - cost.supplies,
  };
  if (order.kind === 'link') next.routes = [...state.routes, { from: cost.from!, to: order.site }];
  else if (order.kind === 'reserve') next.supplies += 2;
  else next.buildings = { ...state.buildings, [order.site]: order.kind };
  const flow = income(next, sites);
  next.coins += flow.coins;
  next.supplies += flow.supplies;
  next.prosperity += flow.prosperity;
  const built = Object.values(next.buildings);
  if (next.completed === 7) next.prosperity += 3 * built.filter((k) => k === 'market').length;
  if (next.completed === 10) next.coins += 4 * built.filter((k) => k === 'works').length;
  return next;
}
export function replay(sites: Site[], orders: Order[]) {
  let state = initialState();
  for (const order of orders) {
    const next = advance(state, sites, order);
    if (!next) return null;
    state = next;
  }
  return state;
}
export const SAVE_KEY = 'australia.common-ground.v1';
export type Save = { version: 1; home: string; orders: Order[] };
export function parseSave(raw: string | null): Save | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (
      s?.version !== 1 ||
      typeof s.home !== 'string' ||
      !Array.isArray(s.orders) ||
      s.orders.length > maxTurns
    )
      return null;
    if (
      !s.orders.every(
        (o: Order) =>
          o &&
          (o.kind === 'reserve' ||
            (typeof o.site === 'string' && ['link', 'market', 'works', 'campus'].includes(o.kind))),
      )
    )
      return null;
    return s;
  } catch {
    return null;
  }
}
