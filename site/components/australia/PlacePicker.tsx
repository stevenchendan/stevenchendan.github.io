import { useEffect, useMemo, useRef, useState } from 'react';
import { cityName, fmt, states, type Profile } from './geography';
import census from '../../data/australia/regions.json';
import { placeType, searchPlaces, type Place } from './places';
import { Icon } from './Icons';

type Props = {
  places: Place[];
  mode: 'game' | 'atlas' | 'route';
  onClose: () => void;
  onPick: (p: Place) => void;
  onCapital?: (p: Profile) => void;
};
export default function PlacePicker({ places, mode, onClose, onPick, onCapital }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState(''),
    [state, setState] = useState(''),
    [kind, setKind] = useState(''),
    [page, setPage] = useState(0);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  const rows = useMemo(() => searchPlaces(places, query, state, kind), [places, query, state, kind]);
  const pageSize = 20;
  const capitals =
    onCapital && page === 0 && !kind && query.trim()
      ? census.cities.filter(
          (p) =>
            (!state || state === p.state) && cityName(p).toLowerCase().includes(query.trim().toLowerCase()),
        )
      : [];
  return (
    <dialog
      ref={ref}
      className="places-dialog"
      aria-labelledby="place-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="places-inner">
        <header>
          <div>
            <span className="campaign-kicker">Australian settlement register</span>
            <h2 id="place-title">
              {mode === 'game'
                ? 'Choose your council seat'
                : mode === 'route'
                  ? 'Find a trade partner'
                  : '寻找城镇或郊区'}
            </h2>
          </div>
          <button className="tool-square" aria-label="Close place search" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <p>
          {mode === 'game'
            ? 'Play a local charter from a city, town or suburb.'
            : mode === 'route'
              ? 'Survey a destination for your current charter. You can review the route cost before committing a turn.'
              : '按英文地名搜索。'}{' '}
          {fmt(places.length)} places · ABS 2021
        </p>
        <label className="place-search">
          <Icon name="search" />
          <input
            autoFocus
            aria-label="Search cities, towns and suburbs"
            placeholder="Try Bendigo, Parramatta or your suburb"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <div className="place-filters">
          <select
            aria-label="Settlement geography"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All place types</option>
            <option value="urban">Urban centres &amp; localities</option>
            <option value="suburb">Suburbs &amp; localities</option>
          </select>
          <select
            aria-label="Settlement state"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All jurisdictions</option>
            {Object.entries(states).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="place-range" aria-live="polite">
          {rows.length
            ? fmt(page * pageSize + 1) +
              '–' +
              fmt(Math.min(rows.length, (page + 1) * pageSize)) +
              ' of ' +
              fmt(rows.length) +
              ' places'
            : 'No matching places. Try a shorter name or another state.'}
        </div>
        <div className="place-results" key={page}>
          {capitals.map((p) => (
            <button key={p.code} onClick={() => onCapital?.(p)}>
              <span>
                <b>{cityName(p)} · 都市圈</b>
                <small>
                  {p.name} · {fmt(p.population)} residents
                </small>
              </span>
              <Icon name="chevron" />
            </button>
          ))}
          {rows.slice(page * pageSize, (page + 1) * pageSize).map((p) => (
            <button key={p.id} onClick={() => onPick(p)}>
              <span>
                <b>{p.name}</b>
                <small>
                  {p.state} · {placeType(p)} · {fmt(p.population)} residents
                </small>
              </span>
              <Icon name="chevron" />
            </button>
          ))}
        </div>
        <footer>
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </footer>
      </div>
    </dialog>
  );
}
