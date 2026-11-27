import { useEffect, useMemo, useRef, useState } from 'react';
import census from '../../data/australia/regions.json';
import heritage from '../../data/australia/wonders.json';
import { fmt, type Lens, type RegionGrid, type Selection, type Terrain } from './geography';
import MapRoom from './MapRoom';
import PlacePicker from './PlacePicker';
import { preparePlaces, type Place, type PlaceRow } from './places';
import type { Footprints } from './footprints';
import { Icon, Rose } from './Icons';
import { capitalTown, JOURNEY_KEY, readJourney, startJourney, tradingPlaces, type Journey } from './journey';
import TradingPost from './TradingPost';
import './atlas.css';
import './campaign.css';
import './journey.css';

type Assets = { data: Terrain; grid: RegionGrid; places: Place[]; footprints: Footprints };
async function readAsset<T>(name: string, signal: AbortSignal): Promise<T> {
  const response = await fetch('/data/australia/' + name + '.json', { signal });
  if (!response.ok) throw new Error('Map asset unavailable');
  return response.json();
}

function Game({ assets }: { assets: Assets }) {
  const { data, grid, places, footprints } = assets;
  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const regions = useMemo(() => new Map(census.regions.map((p) => [p.code, p])), []);
  const [journey, setJourney] = useState<Journey | null>(() => {
    try {
      return readJourney(localStorage.getItem(JOURNEY_KEY), byId);
    } catch {
      return null;
    }
  });
  const [selection, setSelection] = useState<Selection>(() => {
    const key = new URLSearchParams(window.location.search).get('city');
    const profile = census.cities.find((p) => p.code === key);
    return profile ? { kind: 'city', profile } : { kind: 'country' };
  });
  const [lens, setLens] = useState<Lens>('terrain'),
    [search, setSearch] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const desk = useRef<HTMLElement>(null);
  const here = journey ? byId.get(journey.here)! : null;
  const destination = journey?.job ? byId.get(journey.job.to)! : null;
  function select(s: Selection) {
    setSelection(s);
    if (desk.current) desk.current.scrollTop = 0;
  }
  function locate(p: Place) {
    select({ kind: 'place', place: p });
    if (window.matchMedia('(max-width:760px)').matches) window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const selectedPlace = useMemo(() => {
    if (selection.kind === 'place') return selection.place;
    if (selection.kind !== 'city') return null;
    return byId.get(capitalTown[selection.profile.state]) ?? null;
  }, [selection, byId]);
  const home = byId.get('U203002') ?? places[0];
  function update(next: Journey) {
    setJourney(next);
    try {
      localStorage.setItem(JOURNEY_KEY, JSON.stringify(next));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }
  const revealDesk = () => {
    desk.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    desk.current?.focus({ preventScroll: true });
  };
  return (
    <main className="aus-atlas trader-world">
      <header className="masthead travel-head">
        <button className="brand" aria-label="全澳地图" onClick={() => select({ kind: 'country' })}>
          <span className="brand-rose">
            <Rose size={43} />
          </span>
          <span>
            <strong>Australia</strong>
            <small>Common Ground</small>
          </span>
        </button>
        <div className="player-hud">
          {journey && here ? (
            <>
              <button onClick={() => locate(here)} title="在地图上定位">
                <Icon name="pin" size={15} />
                {here.name}
              </button>
              <span>第 {journey.day} 天</span>
              <b>${journey.cash}</b>
            </>
          ) : (
            <span>澳洲行商记</span>
          )}
        </div>
      </header>
      <div className="map-layout">
        <MapRoom
          data={data}
          grid={grid}
          footprints={footprints}
          regions={regions}
          cities={census.cities}
          places={places}
          openPlaces={() => setSearch(true)}
          wonders={heritage.sites}
          selection={selection}
          focus={selection}
          onSelect={select}
          lens={lens}
          onLens={setLens}
          here={here}
          destination={destination}
          openDesk={revealDesk}
        />
        <aside className="trading-post" tabIndex={-1} ref={desk} aria-label="地点与行动">
          <TradingPost
            journey={journey}
            here={here}
            selected={selectedPlace}
            selection={selection}
            places={places}
            byId={byId}
            footprints={footprints}
            fallback={home}
            data={data}
            grid={grid}
            onLocate={locate}
            onSelect={select}
            onSearch={() => setSearch(true)}
            onUpdate={update}
            onStart={(p) => {
              update(startJourney(p));
              if (selection.kind !== 'city') locate(p);
            }}
          />
          {saveFailed && <p role="status">浏览器无法保存进度，本次游戏仍可继续。</p>}
          <details className="source-notes">
            <summary>地图与游戏资料</summary>
            <p>
              {fmt(data.cells.length)} 个陆地格，格心相距 25 km。城市和郊区采用 ABS 2021
              边界。行程按地图位置的直线距离估算，八个首府的商站设在市中心。人物、委托、车费和商誉为游戏设定。
            </p>
            <a href="/data/australia/footprints-readme.md">ABS 城市范围与许可</a> ·{' '}
            <a href="/data/australia/terrain-readme.md">地形与署名</a> ·{' '}
            <a href="/data/australia/places-readme.md">聚落与人口</a> ·{' '}
            <a href={heritage.metadata.source}>UNESCO 世界遗产</a> ·{' '}
            <a href={heritage.metadata.licenseUrl}>CC BY-SA 4.0</a>
          </details>
        </aside>
      </div>
      {search && (
        <PlacePicker
          mode="atlas"
          places={places}
          onClose={() => setSearch(false)}
          onPick={(p) => {
            locate(p);
            setSearch(false);
          }}
          onCapital={(profile) => {
            select({ kind: 'city', profile });
            setSearch(false);
          }}
        />
      )}
    </main>
  );
}
export default function Atlas() {
  const [assets, setAssets] = useState<Assets | null>(null),
    [error, setError] = useState(false),
    [attempt, retry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      readAsset<Terrain>('terrain', abort.signal),
      readAsset<RegionGrid>('regions-grid', abort.signal),
      readAsset<{ places: PlaceRow[] }>('places', abort.signal),
      readAsset<Footprints>('footprints', abort.signal),
    ])
      .then(([data, grid, catalogue, footprints]) => {
        if (!abort.signal.aborted)
          setAssets({ data, grid, places: tradingPlaces(preparePlaces(catalogue.places)), footprints });
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [attempt]);
  if (assets) return <Game assets={assets} />;
  return (
    <main className="map-loading journey-loading" role="status">
      <Rose />
      <p>{error ? '地图暂时无法载入。' : '正在展开澳洲地图…'}</p>
      {error && (
        <button
          onClick={() => {
            setError(false);
            retry((n) => n + 1);
          }}
        >
          重新载入
        </button>
      )}
    </main>
  );
}
