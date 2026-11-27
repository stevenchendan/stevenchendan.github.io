import { useEffect, useRef, useState, type ReactNode } from 'react';
import census from '../../data/australia/regions.json';
import heritage from '../../data/australia/wonders.json';
import {
  cityName,
  compact,
  fmt,
  states,
  regionCode,
  type Profile,
  type RegionGrid,
  type Terrain,
  type Selection,
} from './geography';
import { Icon, type IconName } from './Icons';
import { placeType, type Place } from './places';

const districts: Record<string, string> = {
  Mining: 'Mining district',
  'Agriculture, forestry and fishing': 'Agricultural district',
  Construction: 'Builders’ quarter',
  'Education and training': 'Campus',
  'Accommodation and food services': 'Hospitality quarter',
  'Health care and social assistance': 'Medical district',
  'Financial and insurance services': 'Commercial hub',
  'Transport, postal and warehousing': 'Logistics hub',
  Manufacturing: 'Industrial zone',
  'Professional, scientific and technical services': 'Research campus',
  'Public administration and safety': 'Government plaza',
};
export function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="stat">
      <span>
        <Icon name={icon} size={15} />
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
function Action({
  icon,
  title,
  note,
  onClick,
}: {
  icon: IconName;
  title: string;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button className="journal-action" onClick={onClick}>
      <span className="action-icon">
        <Icon name={icon} />
      </span>
      <span>
        <b>{title}</b>
        {note && <small>{note}</small>}
      </span>
      <Icon name="chevron" size={15} />
    </button>
  );
}
export function Rule({ children }: { children: ReactNode }) {
  return <h3 className="rule">{children}</h3>;
}
type Props = {
  selection: Selection;
  data: Terrain | null;
  grid: RegionGrid | null;
  regions: Map<string, Profile>;
  onSelect: (s: Selection, focus?: boolean) => void;
  openGuide: () => void;
  openPlaces: () => void;
  onPlay: (p: Place) => void;
};
export default function Journal({
  selection,
  data,
  grid,
  regions,
  onSelect,
  openGuide,
  openPlaces,
  onPlay,
}: Props) {
  const [directory, setDirectory] = useState<'city' | 'wonder' | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setDirectory(null);
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [selection]);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [directory]);
  const country = () => {
    setDirectory(null);
    onSelect({ kind: 'country' }, true);
  };
  let content: ReactNode;
  if (directory) {
    const cities = directory === 'city';
    content = (
      <>
        <button className="back" onClick={country}>
          <Icon name="back" size={14} />
          Country overview
        </button>
        <p className="kicker">Atlas index</p>
        <h2>{cities ? 'Capital cities' : 'World wonders'}</h2>
        <p className="body-copy">
          {cities
            ? 'Open a city to inspect its workforce, income and signature district.'
            : heritage.metadata.selection}
        </p>
        <div className="directory">
          {cities
            ? [...census.cities]
                .sort((a, b) => cityName(a).localeCompare(cityName(b)))
                .map((p) => (
                  <Action
                    key={p.code}
                    icon="city"
                    title={cityName(p)}
                    note={p.state + ' · ' + fmt(p.population) + ' residents'}
                    onClick={() => onSelect({ kind: 'city', profile: p }, true)}
                  />
                ))
            : heritage.sites.map((w) => (
                <Action
                  key={w.id}
                  icon="wonder"
                  title={w.shortLabel}
                  note={w.category + ' · ' + w.year}
                  onClick={() => onSelect({ kind: 'wonder', wonder: w }, true)}
                />
              ))}
        </div>
      </>
    );
  } else if (selection.kind === 'country') {
    content = (
      <>
        <figure className="country-plate">
          <img
            src="/images/australia/ranges.webp"
            alt="Illustration of eucalyptus and red escarpments in the MacDonnell Ranges"
            width="800"
            height="286"
          />
        </figure>
        <p className="kicker">
          <i />
          Country overview
        </p>
        <h2>Australia</h2>
        <p className="body-copy">
          Explore the continent one hex at a time. Select a tile, capital city or wonder to open its field
          notes.
        </p>
        <div className="stats">
          <Stat icon="population" label="Residents · 2021" value={compact(census.national.population)} />
          <Stat
            icon="hex"
            label="Land hexes"
            value={fmt(data?.cells.length ?? census.metadata.gridCoverage.terrainCells)}
          />
        </div>
        <Rule>Atlas index</Rule>
        <Action
          icon="search"
          title="Find a settlement"
          note="Cities, towns, suburbs and localities"
          onClick={openPlaces}
        />
        <Action
          icon="city"
          title="Capital cities"
          note={census.cities.length + ' city profiles'}
          onClick={() => setDirectory('city')}
        />
        <Action
          icon="wonder"
          title="World wonders"
          note={heritage.sites.length + ' World Heritage properties'}
          onClick={() => setDirectory('wonder')}
        />
        <div className="journal-source">
          <Icon name="guide" size={14} />
          <button onClick={openGuide}>Sources &amp; survey notes</button>
        </div>
      </>
    );
  } else if (selection.kind === 'place') {
    const p = selection.place;
    content = (
      <>
        <button className="back" onClick={country}>
          <Icon name="back" size={14} />
          Country overview
        </button>
        <p className="kicker">
          {p.state} · {placeType(p)}
        </p>
        <h2>{p.name}</h2>
        <p className="body-copy">
          2021 Census · ABS {p.urban ? 'UCL' : 'SAL'} {p.id.slice(1)}
        </p>
        <div className="stats">
          <Stat icon="population" label="Residents" value={fmt(p.population)} />
          <Stat icon="pin" label="Jurisdiction" value={p.state} />
        </div>
        <Action
          icon="compass"
          title="Play a charter here"
          note="Lead this place and connect its neighbours"
          onClick={() => onPlay(p)}
        />
        <Action icon="search" title="Find another settlement" onClick={openPlaces} />
        <p className="body-copy">The marker shows a representative point inside the census area.</p>
      </>
    );
  } else if (selection.kind === 'wonder') {
    const w = selection.wonder;
    content = (
      <>
        <button className="back" onClick={() => setDirectory('wonder')}>
          <Icon name="back" size={14} />
          World wonders
        </button>
        <div className="record-emblem">
          <Icon name="wonder" size={33} />
        </div>
        <p className="kicker">World Heritage wonder</p>
        <h2>{w.shortLabel}</h2>
        <p className="body-copy">{w.name}</p>
        <div className="stats">
          <Stat icon="wonder" label="Inscribed" value={String(w.year)} />
          <Stat icon="guide" label="Category" value={w.category} />
        </div>
        <Rule>Site record</Rule>
        <p className="body-copy">
          UNESCO lists this property for its outstanding universal value. The marker locates one published
          component of the inscription.
        </p>
        <p className="location-line">
          {Math.abs(w.lat).toFixed(3)}° S · {w.lon.toFixed(3)}° E
        </p>
        <a className="source-link" href={w.url} target="_blank" rel="noreferrer">
          Read the UNESCO listing
        </a>
      </>
    );
  } else if (selection.kind === 'cell' && data && grid) {
    const [q, r, state, type, height] = selection.cell,
      p = regions.get(regionCode(grid, q, r));
    content = (
      <>
        <button className="back" onClick={country}>
          <Icon name="back" size={14} />
          Country overview
        </button>
        <div className="record-emblem">
          <Icon name="hex" size={34} />
        </div>
        <p className="kicker">{states[data.states[state]]} · Land tile</p>
        <h2>{data.terrains[type]}</h2>
        <p className="body-copy">
          Hex {q}, {r} on the Australian Albers grid.
        </p>
        <div className="stats">
          <Stat icon="elevation" label="Elevation" value={fmt(height) + ' m'} />
          <Stat icon="hex" label="Hex spacing" value="25 km" />
        </div>
        <Rule>Census region</Rule>
        {p ? (
          <>
            <Action
              icon="atlas"
              title={p.name}
              note={'SA4 ' + p.code + ' · ' + data.states[state]}
              onClick={() => onSelect({ kind: 'region', profile: p }, true)}
            />
            <p className="body-copy">
              The 2021 Census recorded {fmt(p.population)} people in this region. Median personal income was
              ${fmt(p.weeklyIncome)} per week.
            </p>
          </>
        ) : (
          <p className="body-copy">This centre has no matching ABS region within its mapped state.</p>
        )}
      </>
    );
  } else if (selection.kind === 'city' || selection.kind === 'region') {
    const p = selection.profile,
      city = selection.kind === 'city',
      ind = p.signatureIndustry;
    content = (
      <>
        <button className="back" onClick={city ? () => setDirectory('city') : country}>
          <Icon name="back" size={14} />
          {city ? 'Capital cities' : 'Country overview'}
        </button>
        <p className="kicker">
          {p.state} · {city ? 'Capital city' : 'Census region'}
        </p>
        <h2>{city ? cityName(p) : p.name}</h2>
        <p className="body-copy">
          {city ? p.name + ' · GCCSA' : 'Statistical Area Level 4 · ' + p.code} · 2021 Census
        </p>
        {p.state === 'OT' && (
          <p className="body-copy">
            This region combines Jervis Bay, Christmas Island, the Cocos (Keeling) Islands and Norfolk
            Island. Their census profile is available here. The terrain grid covers the eight main
            jurisdictions.
          </p>
        )}
        <div className="stats">
          <Stat icon="population" label="Residents" value={fmt(p.population)} />
          <Stat icon="weeklyIncome" label="Income / week" value={'$' + fmt(p.weeklyIncome)} />
          <Stat icon="employed" label="Employed" value={fmt(p.employed)} />
          <Stat icon="medianAge" label="Median age" value={p.medianAge + ' yrs'} />
        </div>
        <Rule>Signature district</Rule>
        <div className="district">
          <span className="action-icon">
            <Icon name="district" size={24} />
          </span>
          <strong>{districts[ind.name] || ind.name}</strong>
        </div>
        <p className="body-copy">
          {fmt(ind.count)} residents work in {ind.name.toLowerCase()}. This is {ind.share.toFixed(1)}% of
          the local workforce, compared with {ind.nationalShare.toFixed(1)}% nationally.
        </p>
        <Rule>Largest industry</Rule>
        <p className="body-copy">
          <b>{p.topIndustry.name}</b>
          <br />
          {fmt(p.topIndustry.count)} employed residents · {p.topIndustry.share.toFixed(1)}%
        </p>
        <div className="journal-source">
          <Icon name="guide" size={14} />
          <button onClick={openGuide}>District rules &amp; data sources</button>
        </div>
      </>
    );
  }
  return (
    <aside className="journal" aria-label="Field journal">
      <header className="journal-head">
        <span>
          <Icon name="guide" size={17} />
          Field journal
        </span>
        <span className="brass-diamond" aria-hidden="true">
          ◆
        </span>
        <button
          className="return-map"
          onClick={() => document.querySelector('.maproom')?.scrollIntoView({ block: 'start' })}
        >
          Back to map
        </button>
      </header>
      <div className="journal-scroll" ref={scroller}>
        <div className="journal-content">{content}</div>
      </div>
    </aside>
  );
}
