import { useMemo, useState } from 'react';
import census from '../../data/australia/regions.json';
import {
  compact,
  metrics,
  states,
  titles,
  valueLabel,
  type Metric,
  type Profile,
  type Selection,
} from './geography';
import { Icon } from './Icons';

type Props = { onRegion: (p: Profile, lens: Metric) => void; selection: Selection };
export default function Explorer({ onRegion, selection }: Props) {
  const [query, setQuery] = useState(''),
    [state, setState] = useState('');
  const [x, setX] = useState<Metric>('weeklyIncome'),
    [y, setY] = useState<Metric>('population');
  const [sort, setSort] = useState<Metric | 'name'>('population'),
    [descending, setDescending] = useState(true);
  const [hover, setHover] = useState<Profile | null>(null);
  const rows = useMemo(
    () =>
      census.regions
        .filter(
          (p) => (!state || p.state === state) && p.name.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .sort(
          (a, b) =>
            (sort === 'name' ? a.name.localeCompare(b.name) : a[sort] - b[sort]) * (descending ? -1 : 1),
        ),
    [query, state, sort, descending],
  );
  const selected = selection.kind === 'region' ? selection.profile.code : '';
  const max = (key: Metric) => Math.max(1, ...rows.map((p) => p[key]));
  const xmax = max(x),
    ymax = max(y);
  const px = (v: number) => 55 + (340 * v) / xmax,
    py = (v: number) => 185 - (155 * v) / ymax;
  const tick = (key: Metric, n: number) => (key === 'weeklyIncome' ? '$' : '') + compact(Math.round(n));
  function sortBy(key: Metric | 'name') {
    setDescending(key === sort ? !descending : key !== 'name');
    setSort(key);
  }
  return (
    <section className="explorer content-page">
      <header className="page-intro">
        <p className="eyebrow">
          <i />
          2021 Census · ABS
        </p>
        <h1>Regional explorer</h1>
        <p>
          Compare Australia’s statistical regions. Select a point or a region name to locate it in the map
          room.
        </p>
      </header>
      <div className="explorer-layout">
        <div className="explorer-table">
          <div className="filterbar">
            <label className="search-box">
              <Icon name="search" size={17} />
              <input
                aria-label="Search regions"
                placeholder="Search regions"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHover(null);
                }}
              />
            </label>
            <select
              aria-label="Filter by state or territory"
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setHover(null);
              }}
            >
              <option value="">All jurisdictions</option>
              {[...new Set(census.regions.map((p) => p.state))].sort().map((s) => (
                <option value={s} key={s}>
                  {states[s] || s}
                </option>
              ))}
            </select>
          </div>
          <div className="result-count">
            {rows.length} of {census.regions.length} regions
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {(['name', ...metrics] as const).map((key) => (
                    <th
                      key={key}
                      aria-sort={sort === key ? (descending ? 'descending' : 'ascending') : 'none'}
                    >
                      <button onClick={() => sortBy(key)}>
                        {key === 'name'
                          ? 'Region'
                          : key === 'weeklyIncome'
                            ? 'Income / wk'
                            : key === 'medianAge'
                              ? 'Age'
                              : key === 'employed'
                                ? 'Employed'
                                : 'Residents'}{' '}
                        {sort === key ? (descending ? '↓' : '↑') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.code}
                    className={p.code === selected ? 'highlight' : ''}
                    onMouseEnter={() => setHover(p)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <td>
                      <button onClick={() => onRegion(p, y)}>{p.name}</button>
                      <small>
                        {p.state} · {p.code}
                      </small>
                    </td>
                    {metrics.map((k) => (
                      <td key={k}>{valueLabel(k, p[k])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="empty">No regions match these filters.</p>}
          </div>
        </div>
        <section className="scatter-panel">
          <p className="kicker">Regional comparison</p>
          <h2>Scatter plot</h2>
          <div className="axis-controls">
            {(
              [
                ['X axis', x, setX],
                ['Y axis', y, setY],
              ] as const
            ).map(([label, k, set]) => (
              <label key={label}>
                {label}
                <select value={k} onChange={(e) => set(e.target.value as Metric)}>
                  {metrics.map((m) => (
                    <option key={m} value={m}>
                      {titles[m]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <svg
            role="group"
            aria-label={titles[y] + ' by ' + titles[x]}
            viewBox="0 0 415 233"
            className="scatter"
          >
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <path
                  d={'M55 ' + py(t * ymax) + 'H395 M' + px(t * xmax) + ' 30V185'}
                  stroke="#364e50"
                  strokeDasharray="2 4"
                />
                <text x="49" y={py(t * ymax) + 4} textAnchor="end">
                  {tick(y, t * ymax)}
                </text>
                <text x={px(t * xmax)} y="202" textAnchor="middle">
                  {tick(x, t * xmax)}
                </text>
              </g>
            ))}
            <text x="55" y="16">
              {titles[y]}
            </text>
            <text x="225" y="225" textAnchor="middle">
              {titles[x]}
            </text>
            {rows.map((p) => (
              <circle
                key={p.code}
                role="button"
                tabIndex={0}
                aria-label={'Locate ' + p.name}
                cx={px(p[x])}
                cy={py(p[y])}
                r={hover?.code === p.code || p.code === selected ? 6 : 4}
                className={hover?.code === p.code || p.code === selected ? 'active' : ''}
                onFocus={() => setHover(p)}
                onBlur={() => setHover(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRegion(p, y);
                  }
                }}
                onClick={() => onRegion(p, y)}
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{p.name + ' · ' + valueLabel(x, p[x]) + ' / ' + valueLabel(y, p[y])}</title>
              </circle>
            ))}
          </svg>
          <div className="plot-caption">
            {hover ? (
              <>
                <b>{hover.name}</b> · {valueLabel(x, hover[x])} / {valueLabel(y, hover[y])}
              </>
            ) : (
              'Each point represents one SA4 census region.'
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
