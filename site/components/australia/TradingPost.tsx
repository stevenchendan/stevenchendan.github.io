import { useMemo, useState } from 'react';
import census from '../../data/australia/regions.json';
import {
  cityName,
  fmt,
  regionCode,
  type Profile,
  type RegionGrid,
  type Selection,
  type Terrain,
} from './geography';
import type { Footprints } from './footprints';
import {
  deliver,
  jobs,
  keeper,
  localDestinations,
  passage,
  rank,
  train,
  travel,
  type Journey,
} from './journey';
import { normaliseName, type Place } from './places';
import { Icon } from './Icons';

type Props = {
  journey: Journey | null;
  here: Place | null;
  selected: Place | null;
  selection: Selection;
  places: Place[];
  byId: Map<string, Place>;
  footprints: Footprints;
  fallback: Place;
  data: Terrain;
  grid: RegionGrid;
  onLocate: (p: Place) => void;
  onSelect: (s: Selection) => void;
  onSearch: () => void;
  onUpdate: (j: Journey) => void;
  onStart: (p: Place) => void;
};
function Districts({
  profile,
  selected,
  places,
  footprints,
  onLocate,
  onMetro,
}: {
  profile?: Profile;
  selected: Place;
  places: Place[];
  footprints: Footprints;
  onLocate: (p: Place) => void;
  onMetro: (p: Profile) => void;
}) {
  const members = useMemo(
    () =>
      places.filter(
        (p) =>
          !p.urban &&
          (profile
            ? footprints.membership[p.id]?.[1] === profile.code
            : footprints.membership[p.id]?.[0] === selected.id),
      ),
    [selected, profile, places, footprints],
  );
  const parent = !profile && census.cities.find((c) => c.code === footprints.membership[selected.id]?.[1]);
  const [query, setQuery] = useState(''),
    [limit, setLimit] = useState(8);
  const matching = members.filter((p) => p.search.includes(normaliseName(query.trim())));
  return (
    <div className="place-districts">
      {members.length > 0 && (
        <details key={profile?.code ?? selected.id}>
          <summary>周边郊区与地方 · {fmt(members.length)}</summary>
          {members.length > 8 && (
            <input
              type="search"
              aria-label="在选中地区找郊区"
              placeholder="按地名查找，如 Parramatta"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(8);
              }}
            />
          )}
          <div>
            {matching.slice(0, limit).map((p) => (
              <button onClick={() => onLocate(p)} key={p.id}>
                {p.name} ›
              </button>
            ))}
            {matching.length > limit && (
              <button onClick={() => setLimit((n) => n + 12)}>更多地点（{matching.length - limit}）</button>
            )}
            {!matching.length && <p>这个地区没有匹配的地名。</p>}
          </div>
        </details>
      )}
      {parent && <button onClick={() => onMetro(parent)}>查看 {cityName(parent)} 都市圈 ›</button>}
    </div>
  );
}
export default function TradingPost({
  journey: j,
  here,
  selected,
  selection,
  places,
  byId,
  footprints,
  fallback,
  data,
  grid,
  onLocate,
  onSearch,
  onUpdate,
  onStart,
  onSelect,
}: Props) {
  const post = selected ?? here ?? fallback;
  const local = useMemo(
    () => (here ? localDestinations(here, places, footprints) : []),
    [here, places, footprints],
  );
  const offers = j && here ? jobs(j, here, local) : [];
  const job = j?.job,
    destination = job && byId.get(job.to);
  const visiting = !!j && !!here && post.id !== here.id;
  const trip = here && j && visiting ? passage(here, post, j.trained) : null;
  const contact = keeper(post);
  const profile = selection.kind === 'city' ? selection.profile : undefined;
  const partners = j ? Object.keys(j.trust).length : 0;
  function move(express: boolean) {
    if (!j || !here) return;
    const next = travel(j, here, post, express);
    if (next !== j) {
      onUpdate(next);
      onLocate(post);
    }
  }
  return (
    <>
      <div className="post-art">
        <img
          src="/images/australia/game/trading-post.webp"
          alt="澳洲乡镇的合作社店主递出一件包裹"
          width="1280"
          height="640"
        />
      </div>
      <div className="post-body">
        {selection.kind === 'cell' && (
          <div className="place-observation">
            <Icon name="terrain" /> {data.terrains[selection.cell[3]]} · 海拔 {selection.cell[4]} m
            <small>
              {
                census.regions.find((r) => r.code === regionCode(grid, selection.cell[0], selection.cell[1]))
                  ?.name
              }
            </small>
          </div>
        )}
        {selection.kind === 'wonder' && (
          <div className="place-observation">
            <Icon name="wonder" /> {selection.wonder.shortLabel}
            <small>
              {selection.wonder.year} · UNESCO · <a href={selection.wonder.url}>遗产名录 ↗</a>
            </small>
          </div>
        )}
        <div className="post-overline">
          <span className="post-seal">✦</span> {j ? rank(j) : '行商生涯'} <span>／</span> {post.state}
        </div>
        <h2>{profile ? cityName(profile) : post.name}</h2>
        {profile && (
          <p className="place-facts">
            {profile.name} · {fmt(profile.population)} 位居民 · 2021
          </p>
        )}
        {!profile && selected && (
          <p className="place-facts">
            {post.urban ? '城镇' : '郊区与地方'} · {fmt(post.population)} 位居民 · 2021
          </p>
        )}
        <div className="keeper-line">
          <b>{contact}</b>
          <span>合作社店主{j?.trust[post.id] ? ' · 信任 ' + j.trust[post.id] : ''}</span>
        </div>
        {!j ? (
          <>
            <blockquote>“来接活儿？柜台上有两份运单。慢车省钱，急单得算着日子走。”</blockquote>
            <button className="post-primary" onClick={() => onStart(post)}>
              在 {post.name} 启程 <Icon name="chevron" size={16} />
            </button>
            <button className="post-link" onClick={onSearch}>
              <Icon name="search" size={14} /> 换个地方落脚
            </button>
          </>
        ) : (
          <>
            {job && destination && (
              <div className="waybill">
                <small>在手运单 · 第 {job.due} 天截止</small>
                <b>
                  {job.cargo} → {destination.name}
                </b>
                <span>
                  交给 {keeper(destination)} · 约定报酬 ${job.fee}
                </span>
                {destination.id !== post.id && (
                  <button onClick={() => onLocate(destination)}>在地图上看目的地 ›</button>
                )}
              </div>
            )}
            {visiting && trip ? (
              <>
                <p>
                  {here!.name} → {post.name} <strong>· {Math.max(1, Math.round(trip.km))} km</strong>
                </p>
                <button className="post-choice" onClick={() => move(false)}>
                  <b>搭顺风车</b>
                  <span>免费 · 第 {j.day + trip.slowDays} 天到达</span>
                </button>
                <button className="post-choice" onClick={() => move(true)} disabled={j.cash < trip.fare}>
                  <b>乘快车</b>
                  <span>
                    ${trip.fare} · 第 {j.day + trip.expressDays} 天到达
                  </span>
                </button>
                <button className="post-link" onClick={() => onLocate(here!)}>
                  返回 {here!.name} 柜台
                </button>
              </>
            ) : (
              <>
                <p className="post-note" role="status">
                  {j.note}
                </p>
                {job && job.to === j.here ? (
                  <button className="post-primary" onClick={() => onUpdate(deliver(j))}>
                    交货给 {contact} · 领取 ${j.day <= job.due ? job.fee : Math.floor(job.fee / 2)}
                  </button>
                ) : (
                  !job && (
                    <section className="offer-list">
                      <h3>柜台委托</h3>
                      {offers.map((o, i) => {
                        const to = byId.get(o.to)!;
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              onUpdate({ ...j, job: o, note: '已签收运单。' });
                              onLocate(to);
                            }}
                          >
                            <span>
                              <small>{i ? '限时急送' : '邻里托运'}</small>
                              <b>
                                {o.cargo} → {to.name}
                              </b>
                              <em>
                                {keeper(to)} 收货 · 给你 {o.due - j.day} 天
                              </em>
                            </span>
                            <strong>${o.fee}</strong>
                          </button>
                        );
                      })}
                    </section>
                  )
                )}
                {!j.trained && !!j.trust[j.here] && (
                  <button className="post-choice" onClick={() => onUpdate(train(j))}>
                    <b>请 {contact} 教你配载</b>
                    <span>学 1 天 · 每趟快车省 $3</span>
                  </button>
                )}
              </>
            )}
            <details className="career-book">
              <summary>我的行商手记 · {j.deliveries} 单</summary>
              <p>
                {rank(j) === '合作社合伙人'
                  ? '你已成为合伙人，柜台开放联运委托，每单追加 $14。'
                  : '送达 3 单，获得 3 个地方的店主信任，即可成为合伙人并承接联运委托。'}
              </p>
              <p>
                交货 {j.deliveries}/3 · 熟识地点 {partners}/3{j.trained ? ' · 已学配载' : ''}
              </p>
              {Object.entries(j.trust).map(([id, n]) => (
                <button className="book-contact" key={id} onClick={() => onLocate(byId.get(id)!)}>
                  {keeper(byId.get(id)!)} · {byId.get(id)!.name} <b>信任 {n}</b>
                </button>
              ))}
            </details>
          </>
        )}
        {selected && (
          <Districts
            key={profile?.code ?? selected.id}
            profile={profile}
            selected={selected}
            places={places}
            footprints={footprints}
            onLocate={onLocate}
            onMetro={(p) => onSelect({ kind: 'city', profile: p })}
          />
        )}
      </div>
    </>
  );
}
