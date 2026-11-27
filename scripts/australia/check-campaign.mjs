import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const source = read('site/components/australia/' + name + '.ts');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require: (path) => load(path.replace('./', '')) });
  modules.set(name, exports);
  return exports;
}
const placesAPI = load('places'),
  game = load('turns');
const rows = JSON.parse(read('public/data/australia/places.json')).places;
const places = placesAPI.preparePlaces(rows);
const land = placesAPI.terrainLookup(JSON.parse(read('public/data/australia/terrain.json')));
assert.equal(places.length, 17143);
assert.equal(new Set(places.map((p) => p.id)).size, places.length);
assert.equal(places.filter((p) => p.urban).length, 1809);
assert.equal(places.filter((p) => p.population === 0).length, 686);
assert.equal(placesAPI.searchPlaces(places, 'Parramatta', 'NSW', 'suburb')[0].id, 'S13167');
const greenmount = placesAPI.searchPlaces(places, 'greenmount', 'QLD', 'suburb');
assert.deepEqual([...greenmount.slice(0, 2).map((p) => p.id)].sort(), ['S31239', 'S31240']);
assert.equal(game.parseSave('{'), null);
assert.equal(game.parseSave('{"version":1,"orders":[null],"home":"S13167"}'), null);
let outcomes = [];
for (const id of ['U203002', 'S13167', 'U603001', places.find((p) => p.state === 'OT').id]) {
  const home = places.find((p) => p.id === id);
  const { sites, tiles } = placesAPI.buildBoard(home, places, land);
  assert.equal(tiles.length, 61);
  assert.equal(new Set(sites.map((s) => s.place.id)).size, 7);
  assert.equal(new Set(sites.map((s) => [s.q, s.r].join(','))).size, 7);
  const orders = [],
    initial = game.initialState();
  let current = initial;
  assert.equal(game.advance(current, sites, { kind: 'campus', site: sites[1].place.id }), null);
  // Invest in production first, open the cheapest routes, then invest spare resources in prosperity.
  while (game.status(current) === 'playing') {
    const options = sites
      .map((s) => ({ kind: 'link', site: s.place.id }))
      .map((o) => [o, game.quote(current, sites, o)])
      .filter(([, c]) => !c.reason)
      .sort((a, b) => a[1].coins - b[1].coins || a[1].supplies - b[1].supplies);
    let order = { kind: 'reserve' };
    if (!current.completed) order = { kind: 'market', site: id };
    else if (options.length) order = options[0][0];
    else {
      const campus = sites
        .map((s) => ({ kind: 'campus', site: s.place.id }))
        .find((o) => !game.quote(current, sites, o).reason);
      if (campus) order = campus;
    }
    const next = game.advance(current, sites, order);
    assert.ok(next && next.coins >= 0 && next.supplies >= 0);
    orders.push(order);
    current = next;
  }
  assert.equal(game.status(current), 'won', home.name + ' campaign is winnable');
  assert.equal(game.advance(current, sites, { kind: 'reserve' }), null);
  const save = game.parseSave(JSON.stringify({ version: 1, home: id, orders }));
  assert.equal(JSON.stringify(game.replay(sites, save.orders)), JSON.stringify(current));
  assert.equal(
    game.status(
      game.replay(
        sites,
        Array.from({ length: 12 }, () => ({ kind: 'reserve' })),
      ),
    ),
    'lost',
  );
  const campus = { kind: 'campus', site: id };
  assert.equal(game.advance({ ...initial, coins: 0 }, sites, campus), null);
  assert.equal(game.quote({ ...initial, completed: 3 }, sites, campus).supplies, 8);
  assert.equal(game.advance(game.advance(initial, sites, campus), sites, campus), null);
  if (id === 'U203002') {
    const destination = places.find((p) => p.id === 'S13167');
    const expanded = placesAPI.extendBoard({ sites, tiles }, [destination, destination], land);
    assert.equal(expanded.sites.length, 8);
    const route = { kind: 'link', site: destination.id };
    const rich = { ...initial, coins: 15, supplies: 15 };
    const cost = game.quote(rich, expanded.sites, route);
    assert.ok(cost.km > 500 && cost.from === id);
    const opened = game.advance(rich, expanded.sites, route);
    assert.equal(game.income(opened, expanded.sites).coins, 3);
    assert.equal(opened.routes[0].to, destination.id);
  }
  outcomes.push(home.name + ' (turn ' + current.completed + ')');
}
console.log(
  'Validated 17,143 places, suburb search, both game outcomes, district and route costs, and saved-game replay. Won ' +
    outcomes.join(', ') +
    '.',
);

const journey = load('journey');
const towns = journey.tradingPlaces(places);
const byId = new Map(towns.map((p) => [p.id, p]));
const footprints = JSON.parse(read('public/data/australia/footprints.json'));
const terrain = JSON.parse(read('public/data/australia/terrain.json'));
const census = JSON.parse(read('site/data/australia/regions.json'));
const states = new Map([
  ...towns.map((p) => [p.id, p.state]),
  ...census.cities.map((p) => [p.code, p.state]),
]);
for (const [id, cells] of Object.entries(footprints.cells)) {
  assert.ok(cells.length && cells.length === new Set(cells).size);
  for (const i of cells) assert.equal(terrain.states[terrain.cells[i][2]], states.get(id));
}
assert.equal(footprints.cells['1GSYD'].length, 24);
assert.equal(footprints.cells['2GMEL'].length, 20);
assert.deepEqual(footprints.membership.S13167, ['U101001', '1GSYD']);
const sydney = byId.get(journey.capitalTown.NSW);
assert.equal(sydney.lon, 151.2093);
let run = journey.startJourney(sydney);
assert.equal(journey.readJourney('{', byId), null);
assert.equal(journey.train(run), run);
for (let i = 0; i < 3; i++) {
  const here = byId.get(run.here);
  const local = journey.localDestinations(here, towns, footprints);
  const [regular, urgent] = journey.jobs(run, here, local);
  assert.ok(urgent.fee > regular.fee && regular.to !== urgent.to);
  const job = i === 1 ? regular : urgent,
    to = byId.get(job.to);
  const signed = { ...run, job };
  const fare = journey.passage(here, to, run.trained);
  assert.equal(journey.deliver(signed), signed);
  const broke = { ...signed, cash: 0 };
  assert.equal(journey.travel(broke, here, to, true), broke);
  const late = journey.deliver({ ...signed, here: to.id, day: job.due + 1 });
  assert.equal(late.cash, run.cash + Math.floor(job.fee / 2));
  assert.equal(late.trust[to.id], run.trust[to.id]);
  const arrived = journey.travel(signed, here, to, i !== 1);
  assert.equal(arrived.cash, run.cash - (i !== 1 ? fare.fare : 0));
  run = journey.deliver(arrived);
  assert.ok(run.trust[here.id] && run.trust[to.id]);
  assert.equal(run.cash, arrived.cash + job.fee);
  assert.equal(journey.deliver(run), run);
  assert.equal(journey.readJourney(JSON.stringify(run), byId).deliveries, i + 1);
  if (i === 0) {
    run = journey.train(run);
    assert.ok(run.trained);
    assert.equal(journey.passage(here, to, true).fare, fare.fare - 3);
  }
}
assert.equal(journey.rank(run), '合作社合伙人');
console.log(
  'Verified metro footprints, independent suburb memberships, capital trading posts, delivery deadlines, travel, trust, training, promotion and reload.',
);
