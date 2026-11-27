import { useEffect, useMemo, useRef, useState } from 'react';
import CampaignBoard from './CampaignBoard';
import { Icon, type IconName } from './Icons';
import { fmt, type Terrain } from './geography';
import { buildBoard, extendBoard, placeType, terrainLookup, type Board, type Place } from './places';
import PlacePicker from './PlacePicker';
import {
  advance,
  calendar,
  goalProsperity,
  goalSites,
  income,
  linked,
  maxTurns,
  output,
  parseSave,
  projects,
  quote,
  replay,
  SAVE_KEY,
  status,
  type Building,
  type Order,
  type Save,
  type Yields,
} from './turns';
import './campaign.css';

const buildingKinds = Object.keys(projects) as Building[];
const icons: Record<keyof Yields, IconName> = {
  coins: 'weeklyIncome',
  supplies: 'layers',
  prosperity: 'wonder',
};
const flowText = (v: Yields) =>
  Object.entries(v)
    .filter(([, n]) => n)
    .map(([k, n]) => '+' + n + ' ' + k)
    .join(' · ');
const orderName = (o: Order) =>
  o.kind === 'reserve'
    ? 'Stockpile supplies'
    : o.kind === 'link'
      ? 'Open trade route'
      : 'Build ' + projects[o.kind].name.toLowerCase();
const saveFor = (p: Place): Save => ({ version: 1, home: p.id, orders: [] });
const season = (turn: number) => ['Spring', 'Summer', 'Autumn', 'Winter'][(turn - 1) % 4];

type Props = {
  places: Place[];
  terrain: Terrain;
  requested: { place: Place } | null;
  choosePlace: () => void;
  onAtlas: (p: Place) => void;
};
function readRun(places: Place[], land: Map<string, number>) {
  const fallback = places.find((p) => p.id === 'U203002') ?? places[0];
  try {
    const raw = localStorage.getItem(SAVE_KEY),
      saved = parseSave(raw);
    if (saved) {
      const home = places.find((p) => p.id === saved.home);
      if (home) {
        const local = buildBoard(home, places, land);
        if (replay(survey(local, saved.orders, places, land).sites, saved.orders)) return saved;
      }
    }
  } catch {
    /* Play remains available when storage is disabled. */
  }
  return saveFor(fallback);
}
function survey(
  local: Board,
  orders: Order[],
  places: Place[],
  land: Map<string, number>,
  candidate?: Place | null,
) {
  const partners: Place[] = [];
  for (const o of orders) {
    if (o.kind !== 'link' || local.sites.some((s) => s.place.id === o.site)) continue;
    const p = places.find((p) => p.id === o.site);
    if (p) partners.push(p);
  }
  if (candidate) partners.push(candidate);
  return extendBoard(local, partners, land);
}
function Resource({ kind, value, rate }: { kind: keyof Yields; value: number; rate: number }) {
  return (
    <div className={'game-resource resource-' + kind}>
      <span className="resource-medal">
        <Icon name={icons[kind]} size={22} />
      </span>
      <span>
        <small>{kind}</small>
        <strong>{value}</strong>
        <em>+{rate}/turn</em>
      </span>
    </div>
  );
}
export default function Campaign({ places, terrain, requested, choosePlace, onAtlas }: Props) {
  const land = useMemo(() => terrainLookup(terrain), [terrain]);
  const [run, setRun] = useState<Save>(() => readRun(places, land));
  const home = useMemo(() => places.find((p) => p.id === run.home)!, [places, run.home]);
  const local = useMemo(() => buildBoard(home, places, land), [home, places, land]);
  const [surveying, setSurveying] = useState(false),
    [candidate, setCandidate] = useState<Place | null>(null);
  const board = useMemo(
    () => survey(local, run.orders, places, land, candidate),
    [local, run, places, land, candidate],
  );
  const game = useMemo(() => replay(board.sites, run.orders)!, [board, run]);
  const [selected, setSelected] = useState(run.home),
    [order, setOrder] = useState<Order | null>(null);
  const [replacement, setReplacement] = useState<Place | null>(null),
    [saveError, setSaveError] = useState(false);
  const [showLog, setShowLog] = useState(false),
    [showRules, setShowRules] = useState(false);
  const command = useRef<HTMLElement>(null),
    confirm = useRef<HTMLDialogElement>(null),
    rules = useRef<HTMLDialogElement>(null);
  const site = board.sites.find((s) => s.place.id === selected) ?? board.sites[0],
    p = site.place;
  const flow = income(game, board.sites),
    outcome = status(game);
  const turn = Math.min(game.completed + 1, maxTurns),
    event = calendar.find((e) => e.turn >= turn);
  const connected = linked(game, p.id, home.id),
    built = game.buildings[p.id];
  const preview = order ? advance(game, board.sites, order) : null;
  const result = run.orders.at(-1);
  function report(o: Order) {
    if (o.kind === 'reserve') return 'Stockpiled 2 extra supplies.';
    const name = board.sites.find((s) => s.place.id === o.site)?.place.name;
    return o.kind === 'link'
      ? 'Opened a trade route to ' + name + '.'
      : 'Built a ' + projects[o.kind].name.toLowerCase() + ' in ' + name + '.';
  }
  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(run));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [run]);
  function start(place: Place) {
    setRun(saveFor(place));
    setSelected(place.id);
    setOrder(null);
    setCandidate(null);
    setReplacement(null);
    setShowLog(false);
  }
  useEffect(() => {
    if (!requested) return;
    if (run.orders.length && outcome === 'playing') setReplacement(requested.place);
    else start(requested.place);
  }, [requested]);
  useEffect(() => {
    if (replacement) confirm.current?.showModal();
  }, [replacement]);
  useEffect(() => {
    if (showRules) rules.current?.showModal();
  }, [showRules]);
  function pick(id: string) {
    setSelected(id);
    setOrder(null);
    if (window.matchMedia('(max-width:760px)').matches)
      requestAnimationFrame(() => command.current?.scrollIntoView({ block: 'start' }));
  }
  function endTurn() {
    if (!order || !preview) return;
    setRun((current) => (current === run ? { ...current, orders: [...current.orders, order] } : current));
    setOrder(null);
  }
  function projectOption(kind: Building) {
    const choice: Order = { kind, site: p.id },
      cost = quote(game, board.sites, choice),
      gain = output(site, kind);
    return (
      <button
        key={kind}
        className="build-choice"
        disabled={!!cost.reason}
        aria-pressed={order?.kind === kind}
        onClick={() => setOrder(choice)}
      >
        <img src={'/images/australia/game/' + kind + '.webp'} alt="" />
        <span>
          <b>{projects[kind].name}</b>
          <small>{flowText(gain)} per turn</small>
        </span>
        <span className="cost">
          <span>{cost.coins} coins</span>
          <span>{cost.supplies} supplies</span>
        </span>
      </button>
    );
  }
  const linkOrder: Order = { kind: 'link', site: p.id },
    linkCost = quote(game, board.sites, linkOrder);
  const partner = board.sites.find((s) => s.place.id === linkCost.from)?.place;
  const renderedSites = board.sites.map((s) => ({
    id: s.place.id,
    name: s.place.name,
    q: s.q,
    r: s.r,
    home: s.place.id === home.id,
    linked: linked(game, s.place.id, home.id),
    building: game.buildings[s.place.id] ?? null,
  }));
  return (
    <div className="campaign-shell">
      <div className="campaign-hud">
        <div className="turn-counter">
          <span className="turn-sun">☼</span>
          <span>
            <small>
              {outcome === 'playing' ? season(turn) + ' · Year ' + Math.ceil(turn / 4) : 'Charter complete'}
            </small>
            <b>
              Turn {outcome === 'playing' ? turn : game.completed}
              <em> / {maxTurns}</em>
            </b>
          </span>
        </div>
        {(['coins', 'supplies', 'prosperity'] as const).map((k) => (
          <Resource key={k} kind={k} value={game[k]} rate={flow[k]} />
        ))}
        <button className="game-help" onClick={() => setShowRules(true)}>
          <Icon name="guide" size={16} /> How to play
        </button>
      </div>
      <div className="campaign-layout">
        <section className="game-table">
          <header className="theatre-heading">
            <div>
              <p className="campaign-kicker">{home.state} · Regional campaign</p>
              <h1>
                {home.name} <em>&amp; surrounds</em>
              </h1>
            </div>
            <button className="choose-seat" onClick={choosePlace}>
              <Icon name="search" size={16} />
              Choose starting place
            </button>
          </header>
          <div className="tactical-field">
            <CampaignBoard
              tiles={board.tiles}
              sites={renderedSites}
              routes={game.routes}
              selected={p.id}
              onSelect={pick}
            />
          </div>
          <div className="board-key">
            <span>
              <i className="linked-key" />
              Your network
            </span>
            <span>
              <i />
              Available settlement
            </span>
            <button onClick={() => onAtlas(home)}>
              <Icon name="atlas" size={15} />
              Locate on atlas
            </button>
          </div>
          <section className="charter-strip">
            <div className="charter-icon">
              <Icon name="compass" size={27} />
            </div>
            <div className="charter-title">
              <small>Victory objective</small>
              <b>The regional charter</b>
            </div>
            <div className="charter-progress">
              <span>
                <b>
                  {game.routes.length + 1} / {goalSites}
                </b>{' '}
                settlements
              </span>
              <progress aria-label="Settlements connected" max={goalSites} value={game.routes.length + 1} />
            </div>
            <div className="charter-progress">
              <span>
                <b>
                  {game.prosperity} / {goalProsperity}
                </b>{' '}
                prosperity
              </span>
              <progress aria-label="Prosperity earned" value={game.prosperity} max={goalProsperity} />
            </div>
          </section>
        </section>
        <aside ref={command} className="command-post" aria-label="Council orders">
          <header className="command-heading">
            <Icon name="district" size={18} />
            <span>Council orders</span>
            <button
              className="back-to-board"
              onClick={() => document.querySelector('.theatre-heading')?.scrollIntoView({ block: 'start' })}
            >
              View board
            </button>
            <span className="command-turn">T{String(turn).padStart(2, '0')}</span>
          </header>
          <div className="command-scroll">
            {outcome !== 'playing' ? (
              <div className="end-card">
                <img src="/images/australia/game/seat.webp" alt="" />
                <p className="campaign-kicker">
                  {outcome === 'won' ? 'Charter fulfilled' : 'Charter expired'}
                </p>
                <h2>{outcome === 'won' ? 'A thriving network' : 'Time ran out'}</h2>
                <p>
                  In {game.completed} turns, your council connected {game.routes.length + 1} settlements and
                  earned {game.prosperity} prosperity.
                </p>
                {outcome === 'lost' && (
                  <p>
                    The charter required four connected settlements and 50 prosperity. A campus or an early
                    trade route increases prosperity each turn.
                  </p>
                )}
                <button className="end-turn" onClick={() => start(home)}>
                  Play this region again
                </button>
                <button className="text-command" onClick={choosePlace}>
                  Choose another council seat
                </button>
              </div>
            ) : (
              <>
                <div className="site-heading">
                  <img
                    src={
                      '/images/australia/game/' + (built ?? (p.id === home.id ? 'seat' : 'town')) + '.webp'
                    }
                    alt=""
                  />
                  <div>
                    <p className="campaign-kicker">
                      {p.id === home.id
                        ? 'Your council seat'
                        : connected
                          ? 'Network settlement'
                          : 'Independent settlement'}
                    </p>
                    <h2>{p.name}</h2>
                  </div>
                </div>
                <p className="site-demographics">
                  {placeType(p)} · {p.state} · {fmt(p.population)} residents in 2021
                </p>
                {connected && !built ? (
                  <>
                    <h3>Build a district</h3>
                    <p className="order-hint">
                      Choose one permanent district here, or select another settlement to open a route.
                    </p>
                    <div className="build-options">{buildingKinds.map(projectOption)}</div>
                  </>
                ) : !connected ? (
                  <>
                    <h3>Connect this settlement</h3>
                    <p className="order-hint">
                      A trade route from {partner?.name} spans {linkCost.km?.toFixed(1)} km and earns 1
                      prosperity{(linkCost.km ?? 0) >= 50 ? ' and 1 coin' : ''} each turn. It also unlocks a
                      district slot here.
                    </p>
                    <button
                      className="link-choice"
                      disabled={!!linkCost.reason}
                      aria-pressed={order?.kind === 'link'}
                      onClick={() => setOrder(linkOrder)}
                    >
                      <Icon name="atlas" />
                      <span>
                        <b>Open trade route</b>
                        <small>
                          {linkCost.coins} coins · {linkCost.supplies} supplies
                        </small>
                      </span>
                    </button>
                    {linkCost.reason && (
                      <p className="order-hint">{linkCost.reason} A closer route costs less.</p>
                    )}
                  </>
                ) : (
                  <>
                    <h3>{projects[built].name} in operation</h3>
                    <p className="order-hint">
                      {flowText(output(site, built))} per turn. Select an independent settlement on the
                      board to extend the network.
                    </p>
                  </>
                )}
                <button className="survey-partner" onClick={() => setSurveying(true)}>
                  <Icon name="search" size={15} />
                  Find a trade partner anywhere
                </button>
                <button
                  className="reserve"
                  aria-pressed={order?.kind === 'reserve'}
                  onClick={() => setOrder({ kind: 'reserve' })}
                >
                  <Icon name="layers" size={15} />
                  Stockpile supplies <span>+2 this turn</span>
                </button>
                {event && (
                  <div className="forecast">
                    <b>
                      {event.turn === turn ? 'This turn' : 'Turn ' + event.turn} · {event.title}
                    </b>
                    <p>{event.effect}</p>
                  </div>
                )}
              </>
            )}
            {result && (
              <section className="turn-record" aria-live="polite">
                <button onClick={() => setShowLog(!showLog)} aria-expanded={showLog}>
                  <Icon name="guide" size={15} />
                  Turn record <span>{showLog ? '−' : '+'}</span>
                </button>
                <p>
                  Turn {game.completed} · {report(result)}
                </p>
                {showLog && (
                  <ol>
                    {run.orders.map((o, i) => (
                      <li key={i}>{report(o)}</li>
                    ))}
                  </ol>
                )}
              </section>
            )}
            <div className="save-note">
              {saveError ? 'Saving unavailable on this device.' : 'Completed turns saved on this device.'}
            </div>
          </div>
          {outcome === 'playing' && (
            <div className="commit-panel">
              <p aria-live="polite">
                {order ? (
                  <>
                    <b>{orderName(order)}</b>
                    {order.kind !== 'reserve' ? ' · ' + p.name : ''}
                  </>
                ) : result ? (
                  report(result)
                ) : (
                  'Select an order to commit this turn.'
                )}
              </p>
              {preview && (
                <small>
                  After turn · {preview.coins} coins · {preview.supplies} supplies · {preview.prosperity}{' '}
                  prosperity
                </small>
              )}
              <button className="end-turn" disabled={!preview} onClick={endTurn}>
                <Icon name="compass" size={18} />
                End turn {turn}
              </button>
            </div>
          )}
        </aside>
      </div>
      {surveying && (
        <PlacePicker
          places={places}
          mode="route"
          onClose={() => setSurveying(false)}
          onPick={(place) => {
            setCandidate(place);
            pick(place.id);
            setSurveying(false);
          }}
        />
      )}
      {replacement && (
        <dialog
          ref={confirm}
          className="campaign-dialog"
          onCancel={() => setReplacement(null)}
          aria-labelledby="replace-title"
        >
          <h2 id="replace-title">Start in {replacement.name}?</h2>
          <p>
            This will replace the saved {home.name} campaign after {game.completed} completed turns.
          </p>
          <button autoFocus onClick={() => setReplacement(null)}>
            Keep playing {home.name}
          </button>
          <button onClick={() => start(replacement)}>Start new charter</button>
        </dialog>
      )}
      {showRules && (
        <dialog
          ref={rules}
          className="campaign-dialog"
          onCancel={() => setShowRules(false)}
          aria-labelledby="rules-title"
        >
          <p className="campaign-kicker">Player’s guide</p>
          <h2 id="rules-title">Win the regional charter</h2>
          <p>
            Connect four settlements, including your seat, and earn 50 prosperity in twelve turns. Select a
            building or settlement, review the cost, then end your turn.
          </p>
          <ul>
            <li>
              Your council receives 2 coins and 2 supplies per turn. Each connected settlement, including
              your seat, adds 1 prosperity per turn.
            </li>
            <li>
              Each place has one district slot. Markets earn coins, workshops make supplies and campuses
              earn prosperity. New districts and routes produce on their first turn.
            </li>
            <li>
              Markets gain a bonus at 10,000 residents and campuses at 3,000. Workshops gain a bonus below
              3,000 residents or on hills, plateaus and mountains.
            </li>
            <li>
              Survey any town or suburb with “Find a trade partner anywhere”. Each route starts at the
              closest connected place. Routes of at least 50 km earn an extra coin each turn.
            </li>
            <li>Shorter routes cost less. The calendar announces special turns in advance.</li>
          </ul>
          <p>
            The board arranges real places on a schematic hex grid. Route distances use their census
            representative points. Buildings, resources, seasonal events and prosperity are game rules.
          </p>
          <button autoFocus onClick={() => setShowRules(false)}>
            Return to campaign
          </button>
        </dialog>
      )}
    </div>
  );
}
