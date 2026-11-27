import { useEffect, useMemo, useState } from 'react';
import census from '../../data/australia/regions.json';
import heritage from '../../data/australia/wonders.json';
import { fmt, type Lens, type RegionGrid, type Selection, type Terrain } from './geography';
import Explorer from './Explorer';
import MapRoom from './MapRoom';
import Journal from './Journal';
import Campaign from './Campaign';
import PlacePicker from './PlacePicker';
import { preparePlaces, type Place, type PlaceRow } from './places';
import { Icon, Rose, type IconName } from './Icons';
import './atlas.css';

type Page = 'campaign' | 'map' | 'explorer' | 'guide';
const pages: [Page, string, IconName][] = [
  ['campaign', 'Campaign', 'compass'],
  ['map', 'World atlas', 'atlas'],
  ['explorer', 'Explorer', 'explore'],
  ['guide', 'Field guide', 'guide'],
];
function Guide() {
  const meta = census.metadata,
    w = heritage.metadata;
  return (
    <section className="content-page guide-page">
      <header className="page-intro">
        <p className="eyebrow">
          <i />
          Methodology &amp; sources
        </p>
        <h1>Field guide</h1>
        <p>How Australian geography, people and places become a strategy atlas.</p>
      </header>
      <div className="guide-columns">
        <article>
          <Icon name="city" size={28} />
          <h2>Playable places</h2>
          <p>
            Choose a council seat from 1,809 urban centre and locality records and 15,334 suburb and
            locality records. Cross-border urban centres retain the ABS state parts. Two records with the
            same name can cover different areas.
          </p>
          <p>
            Each campaign brings six populated neighbouring suburbs or localities onto a tactical board. The
            layout spreads the settlements around the seat for play. Route prices use distances between the
            actual representative points, and district bonuses use the published 2021 population and the
            terrain atlas.
          </p>
          <a href="/data/australia/places-readme.md">
            Settlement geography, coordinates and census sources
          </a>
        </article>
        <article>
          <Icon name="hex" size={28} />
          <h2>The hex grid</h2>
          <p>
            The map has {fmt(meta.gridCoverage.terrainCells)} land tiles. Neighbouring centres are 25 km
            apart in Australian Albers (EPSG:3577). A centre must fall inside a state or territory’s land
            polygon to appear. The grid includes the mainland, Tasmania and qualifying nearby islands.
            Jervis Bay and remote territories fall outside the terrain edition.
          </p>
          <p>
            Elevation is the median of up to seven on-land Mapzen terrain samples. Terrain classes combine
            sampled elevation and relief with Natural Earth physical regions. Colours represent these
            classes, including where vegetation varies within a class.
          </p>
          <a href="/data/australia/terrain-readme.md">Terrain rules, rebuild steps and licences</a>
          <p className="attribution">
            Natural Earth (public domain). Elevation derived from Mapzen Terrain Tiles, including ©
            Commonwealth of Australia (Geoscience Australia) 2017, USGS and NOAA.
          </p>
        </article>
        <article>
          <Icon name="explore" size={28} />
          <h2>Regional lenses</h2>
          <p>
            The 2021 Census measures residents, employed residents, median age and median weekly personal
            income. Income covers people aged 15 and over. Each lens repeats the region’s value across its
            matched tiles. Adding the tiles together would count residents multiple times.
          </p>
          <p>
            {fmt(meta.gridCoverage.matched)} centres match an ABS statistical area and agree on its state.
            The remainder have no census allocation. {meta.gridCoverage.representedRegions} of{' '}
            {census.regions.length} spatial SA4 regions have a matched tile. The Explorer includes every
            region and uses a representative point to locate smaller areas.
          </p>
          <a href={meta.sources[0]} target="_blank" rel="noreferrer">
            ABS Census DataPacks
          </a>{' '}
          ·{' '}
          <a href={meta.sources[1]} target="_blank" rel="noreferrer">
            ABS boundaries
          </a>
          <p className="attribution">
            {meta.attribution} <a href={meta.licenceUrl}>{meta.licence}</a>.
          </p>
        </article>
        <article>
          <Icon name="district" size={28} />
          <h2>Capital districts</h2>
          <p>
            City markers sit at the capitals. Their profiles cover the ABS Greater Capital City Statistical
            Areas. Canberra’s profile covers the whole ACT.
          </p>
          <p>
            A district represents the industry most specialised locally relative to Australia. An industry
            qualifies when it accounts for at least 5% of employed residents. Among qualifying industries,
            the highest ratio of local to national workforce share determines the district. Finance yields a
            Commercial hub, mining a Mining district and professional services a Research campus.
          </p>
        </article>
        <article>
          <Icon name="wonder" size={28} />
          <h2>World wonders</h2>
          <p>{w.selection}</p>
          <p>{w.method}</p>
          <a href={w.source} target="_blank" rel="noreferrer">
            UNESCO World Heritage List
          </a>
          <p className="attribution">
            {w.attribution} The adapted wonder records are licensed under{' '}
            <a href={w.licenseUrl}>{w.license}</a>.
          </p>
        </article>
      </div>
    </section>
  );
}
async function readAsset<T>(name: string, signal: AbortSignal): Promise<T> {
  const response = await fetch('/data/australia/' + name + '.json', { signal });
  if (!response.ok) throw new Error('Map asset unavailable');
  return response.json();
}
export default function Atlas() {
  const [page, setPage] = useState<Page>('campaign'),
    [lens, setLens] = useState<Lens>('terrain');
  const [assets, setAssets] = useState<{ data: Terrain; grid: RegionGrid; places: Place[] } | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<Selection>({ kind: 'country' }),
    [focus, setFocus] = useState<Selection | null>(null);
  const regions = useMemo(() => new Map(census.regions.map((p) => [p.code, p])), []);
  const [picker, setPicker] = useState<'game' | 'atlas' | null>(null),
    [requested, setRequested] = useState<{ place: Place } | null>(null);
  const [visitedMap, setVisitedMap] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      readAsset<Terrain>('terrain', abort.signal),
      readAsset<RegionGrid>('regions-grid', abort.signal),
      readAsset<{ places: PlaceRow[] }>('places', abort.signal),
    ])
      .then(([data, grid, catalogue]) => setAssets({ data, grid, places: preparePlaces(catalogue.places) }))
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [attempt]);
  function select(s: Selection, move = false) {
    setSelection(s);
    if (move) setFocus(s);
    setPage('map');
    setVisitedMap(true);
    if (window.matchMedia('(max-width: 760px)').matches && s.kind !== 'country')
      requestAnimationFrame(() => {
        document.querySelector('.journal')?.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
  }
  function navigate(p: Page) {
    setPage(p);
    if (p === 'map') setVisitedMap(true);
    if (window.matchMedia('(max-width: 760px)').matches) window.scrollTo({ top: 0 });
  }
  return (
    <main className={'aus-atlas ' + (page === 'campaign' ? 'is-campaign' : '')}>
      <header className="masthead">
        <button className="brand" aria-label="Australia campaign home" onClick={() => navigate('campaign')}>
          <span className="brand-rose">
            <Rose size={49} />
          </span>
          <span>
            <strong>Australia</strong>
            <small>Common Ground</small>
          </span>
        </button>
        <nav aria-label="Atlas navigation">
          {pages.map(([key, label, icon]) => (
            <button
              key={key}
              aria-current={page === key ? 'page' : undefined}
              onClick={() => navigate(key)}
            >
              <Icon name={icon} size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="grid-id">
          <Icon name="city" size={17} />
          {assets ? fmt(assets.places.length) + ' places' : 'Settlement strategy'}
        </div>
      </header>
      <section className="campaign-tab" hidden={page !== 'campaign'} aria-label="Regional campaign">
        {assets ? (
          <Campaign
            places={assets.places}
            terrain={assets.data}
            requested={requested}
            choosePlace={() => setPicker('game')}
            onAtlas={(p) => select({ kind: 'place', place: p }, true)}
          />
        ) : (
          <div className="map-loading" role="status">
            <Rose />
            <p>{error ? 'The campaign data could not be loaded.' : 'Preparing your regional charter…'}</p>
            {error && (
              <button
                onClick={() => {
                  setError(false);
                  setAttempt((n) => n + 1);
                }}
              >
                Retry download
              </button>
            )}
          </div>
        )}
      </section>
      <div className="map-layout" hidden={page !== 'map'}>
        {assets && visitedMap ? (
          <MapRoom
            data={assets.data}
            grid={assets.grid}
            regions={regions}
            cities={census.cities}
            places={assets.places}
            openPlaces={() => setPicker('atlas')}
            wonders={heritage.sites}
            selection={selection}
            focus={focus}
            onSelect={select}
            lens={lens}
            onLens={setLens}
          />
        ) : (
          <div className="map-loading" role="status">
            <Rose />
            <p>{error ? 'The map data could not be loaded.' : 'Surveying the continent…'}</p>
            {error && (
              <button
                onClick={() => {
                  setError(false);
                  setAttempt((n) => n + 1);
                }}
              >
                Retry map download
              </button>
            )}
          </div>
        )}
        <Journal
          data={assets?.data ?? null}
          grid={assets?.grid ?? null}
          selection={selection}
          regions={regions}
          onSelect={select}
          openGuide={() => navigate('guide')}
          openPlaces={() => setPicker('atlas')}
          onPlay={(p) => {
            setRequested({ place: p });
            navigate('campaign');
          }}
        />
      </div>
      <div className="page-container" hidden={page !== 'explorer'}>
        <Explorer
          selection={selection}
          onRegion={(p, l) => {
            setLens(l);
            select({ kind: 'region', profile: p }, true);
          }}
        />
      </div>
      <div className="page-container" hidden={page !== 'guide'}>
        <Guide />
      </div>
      {picker && assets && (
        <PlacePicker
          places={assets.places}
          mode={picker}
          onClose={() => setPicker(null)}
          onPick={(place) => {
            if (picker === 'atlas') select({ kind: 'place', place }, true);
            else {
              setRequested({ place });
              navigate('campaign');
            }
            setPicker(null);
          }}
        />
      )}
      <footer className="atlas-footer" hidden={page === 'campaign'}>
        <span>
          <span className="footer-star">✦</span> Australian Albers <b>·</b> EPSG:3577
        </span>
        <span>
          {page === 'map'
            ? 'Drag to pan · Scroll to zoom · Select to inspect'
            : 'Australian Civilization Atlas'}
        </span>
      </footer>
    </main>
  );
}
