import { useEffect, useId, useRef } from 'react';
import './board.css';

type Tile = { q: number; r: number; terrain: number };
type Site = {
  id: string;
  name: string;
  q: number;
  r: number;
  home: boolean;
  linked: boolean;
  building: 'market' | 'works' | 'campus' | null;
};
type Props = {
  tiles: Tile[];
  sites: Site[];
  routes: { from: string; to: string }[];
  selected: string;
  onSelect: (id: string) => void;
};

const palettes = [
  ['#a7bb84', '#687f58', '#485e44'],
  ['#c7b778', '#98834f', '#6c653f'],
  ['#c19b71', '#966c4e', '#745744'],
  ['#dba06a', '#a96747', '#81553c'],
  ['#8fa886', '#687f66', '#4e6658'],
  ['#a7a794', '#797f71', '#5e685f'],
];
const top = '0,-34.67 45,-17.33 45,17.33 0,34.67 -45,17.33 -45,-17.33';
const relief = [2, 3, 9, 3, 11, 17];
const sprites = '/images/australia/game/';
const slot = (q: number, r: number) => q + ',' + r;
function noise(q: number, r: number, channel: number) {
  let n = Math.imul(q + 101, 374761393) + Math.imul(r + 73, 668265263) + Math.imul(channel + 11, 69069);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function position({ q, r }: { q: number; r: number }, terrain: number) {
  return { x: 460 + (q + r / 2) * 90, y: 308 - r * 52 - (relief[terrain] ?? 2) - noise(q, r, 1) * 3 };
}

function Land({ tile, occupied, id }: { tile: Tile; occupied: boolean; id: string }) {
  const { q, r, terrain } = tile;
  const { x, y } = position(tile, terrain);
  const color = palettes[terrain] ?? ['#b4af97', '#848676', '#6b7468'];
  const depth = 13 + (relief[terrain] ?? 2);
  const seed = noise(q, r, 0);
  const rise = terrain === 5 ? 28 : terrain === 4 ? 16 : 9;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d={`M-45,-17.33 L-45,17.33 0,34.67 45,17.33 45,-17.33 V${17.33 + depth} L0,${34.67 + depth} -45,${17.33 + depth}Z`}
        fill={color[2]}
      />
      <path d={`M-45,17.33 L0,34.67 V${34.67 + depth} L-45,${17.33 + depth}Z`} fill={color[1]} />
      <path
        d={`M-42,${22 + depth * 0.28} l17,6 m3,1 9,3 m18,3 18,-7`}
        stroke="#f0cf94"
        opacity=".18"
        fill="none"
      />
      <polygon points={top} fill={color[0]} />
      <polygon points={top} fill={`url(#${id}-light)`} opacity={0.5 + seed * 0.45} />
      <path d="M-45,-17.33 0,-34.67 45,-17.33 7,0Z" fill="#fff6c4" opacity={0.04 + seed * 0.09} />
      <path d="M45,-17.33 45,17.33 0,34.67 7,0Z" fill="#443b2b" opacity={0.03 + seed * 0.07} />
      <polygon
        points={top}
        fill={`url(#${id}-grain)`}
        stroke="#fbefc4"
        strokeWidth=".75"
        strokeOpacity=".43"
      />
      <g transform={`translate(${(seed - 0.5) * 16} ${noise(q, r, 2) * 5})`}>
        {terrain < 0 ? (
          <path d="M-16,2h6m-3,-3v6 M13,-6h4m-2,-2v4" stroke="#656d60" strokeWidth="1.1" opacity=".4" />
        ) : terrain === 3 ? (
          <g fill="none" strokeLinecap="round">
            <path
              d="M-28,5 Q-15,-10 1,-6 T26,-10 M-20,12 Q-7,-2 8,2 T30,-2"
              stroke="#a96946"
              opacity=".51"
              strokeWidth="1.9"
            />
            <path
              d="M-28,3 Q-15,-12 1,-8 T26,-12 M-20,10 Q-7,-4 8,0 T30,-4"
              stroke="#ffe3a5"
              opacity=".71"
              strokeWidth="1.5"
            />
          </g>
        ) : (terrain >= 4 || terrain === 2) && !occupied ? (
          <g>
            <ellipse rx="29" ry="7" cy="6" cx="5" fill="#3e4d3b" opacity=".16" />
            <path
              d={`M-30,5 -14,${-rise * 0.7} -7,${-rise * 0.45} 1,${-rise} 9,${-rise * 0.7} 15,${-rise * 0.86} 30,3 10,10 -9,12Z`}
              fill={color[1]}
            />
            <path
              d={`M-30,5 -14,${-rise * 0.7} -17,1 -7,${-rise * 0.45} 1,${-rise} -3,0 5,2 15,${-rise * 0.86} 8,4 -9,12Z`}
              fill={terrain === 5 ? '#c4c6b4' : '#dbcb9d'}
            />
            <path d={`M1,${-rise} 9,${-rise * 0.7} 2,-1 -3,0Z`} fill={color[2]} />
          </g>
        ) : (
          <g opacity=".45" fill="none" stroke={color[2]} strokeWidth="1.2">
            <path d="M-23,4 l-2,-3 m2,3 1,-4 M18,6 l-2,-3 m2,3 2,-4 M-3,-11 l-2,-3 m2,3 1,-3" />
          </g>
        )}
        {!occupied &&
          (terrain === 0 || terrain === 1 || terrain === 4) &&
          seed > (terrain === 0 ? 0.13 : 0.54) && (
            <image
              href={sprites + 'bush.webp'}
              x={terrain === 4 ? -34 : -28}
              y={terrain === 4 ? -23 : -30}
              width={terrain === 4 ? 38 : 52}
              height={terrain === 4 ? 32 : 42}
            />
          )}
      </g>
    </g>
  );
}

type Marker = { site: Site; x: number; y: number };
function labelsFor(markers: Marker[]) {
  const placed: { x: number; y: number; width: number; marker: Marker }[] = [];
  for (const marker of markers) {
    const width = Math.min(205, Math.max(56, marker.site.name.length * 6.45 + 20));
    const offsets = [
      [0, 24],
      [0, 42],
      [0, -75],
      [-27, 32],
      [27, 32],
      [0, -94],
      [-56, 10],
      [56, 10],
    ];
    const choices = offsets.map(([dx, dy], order) => {
      const x = Math.max(width / 2 + 6, Math.min(914 - width / 2, marker.x + dx));
      const y = Math.max(14, Math.min(577, marker.y + dy));
      const overlaps = placed.reduce(
        (score, other) =>
          score +
          Math.max(0, (width + other.width) / 2 + 4 - Math.abs(x - other.x)) *
            Math.max(0, 25 - Math.abs(y - other.y)),
        0,
      );
      return { x, y, width, marker, penalty: overlaps + order * 0.1 };
    });
    choices.sort((a, b) => a.penalty - b.penalty);
    placed.push(choices[0]);
  }
  return placed;
}

export default function CampaignBoard({ tiles, sites, routes, selected, onSelect }: Props) {
  const id = 'cb' + useId().replace(/[^a-zA-Z0-9-]/g, '');
  const ordered = [...tiles].sort((a, b) => b.r - a.r || a.q - b.q);
  const terrain = new Map(tiles.map((tile) => [slot(tile.q, tile.r), tile.terrain]));
  const occupied = new Set(sites.map((site) => slot(site.q, site.r)));
  const markers = sites
    .map((site) => ({ site, ...position(site, terrain.get(slot(site.q, site.r)) ?? 0) }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const selectedMarker = markers.find((marker) => marker.site.id === selected);
  const labels = labelsFor(markers);
  const viewport = useRef<HTMLDivElement>(null);
  const selectedX = selectedMarker?.x;
  useEffect(() => {
    const element = viewport.current;
    if (!element || selectedX === undefined || element.scrollWidth <= element.clientWidth) return;
    element.scrollLeft = (selectedX / 920) * element.scrollWidth - element.clientWidth / 2;
  }, [selectedX]);
  return (
    <div className="campaign-board" ref={viewport}>
      <svg
        className="campaign-board__scene"
        viewBox="15 27 890 555"
        role="group"
        aria-label="Campaign board. Select a settlement to inspect it."
      >
        <defs>
          <linearGradient id={id + '-light'} x1="0" y1="0" x2=".85" y2="1">
            <stop stopColor="#fff3b5" stopOpacity=".49" />
            <stop offset=".58" stopColor="#f6dca2" stopOpacity=".03" />
            <stop offset="1" stopColor="#473c37" stopOpacity=".25" />
          </linearGradient>
          <pattern id={id + '-grain'} width="19" height="17" patternUnits="userSpaceOnUse">
            <path d="M1,4 l2,-.6 M10,12 l2,-.3" stroke="#4a4936" strokeWidth="1.2" opacity=".13" />
            <path d="M6,8 l2,-.4 M15,2 h1.8" stroke="#fff3cb" strokeWidth="1" opacity=".37" />
          </pattern>
          <pattern id={id + '-waves'} width="78" height="37" patternUnits="userSpaceOnUse">
            <path
              d="M3,10 q4,1 10,-1 t8,0 M46,28 q5,1 11,-1"
              fill="none"
              stroke="#a1c5ab"
              strokeWidth="1"
              opacity=".15"
            />
          </pattern>
          <filter id={id + '-shadow'} x="-20%" y="-35%" width="150%" height="205%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        <rect x="-1200" y="-300" width="3320" height="1190" fill={`url(#${id}-waves)`} />
        <g aria-hidden="true" fill="#142d2f" opacity=".67" filter={`url(#${id}-shadow)`}>
          {tiles.map((tile) => {
            const { x, y } = position(tile, tile.terrain);
            return (
              <polygon
                key={slot(tile.q, tile.r)}
                transform={`translate(${x + 4} ${y + 23})`}
                points={top}
              />
            );
          })}
        </g>
        <g aria-hidden="true">
          {ordered.map((tile) => (
            <Land
              key={slot(tile.q, tile.r)}
              tile={tile}
              id={id}
              occupied={occupied.has(slot(tile.q, tile.r))}
            />
          ))}
        </g>
        <g aria-hidden="true" fill="none" strokeLinecap="round">
          {routes.map(({ from, to }) => {
            const a = markers.find((m) => m.site.id === from),
              b = markers.find((m) => m.site.id === to);
            if (!a || !b) return null;
            const midX = (a.x + b.x) / 2,
              midY = (a.y + b.y) / 2;
            const d = `M${a.x},${a.y + 4} Q${midX + 12},${midY - 14} ${b.x},${b.y + 4}`;
            return (
              <g key={from + '-' + to}>
                <path d={d} stroke="#685438" strokeOpacity=".84" strokeWidth="5.5" />
                <path d={d} stroke="#f3cf87" strokeWidth="2.65" strokeDasharray="6 3" />
                <g className="trade-runner">
                  <animateMotion path={d} dur="6s" repeatCount="indefinite" rotate="auto" />
                  <rect
                    x="-4"
                    y="-2.3"
                    width="8"
                    height="4.6"
                    rx="1"
                    stroke="#4c3c27"
                    fill="#fff0bb"
                    strokeWidth="1.2"
                  />
                </g>
              </g>
            );
          })}
        </g>
        {selectedMarker && (
          <g aria-hidden="true" transform={`translate(${selectedMarker.x} ${selectedMarker.y})`}>
            <polygon points={top} fill="#ffdf7a" fillOpacity=".16" stroke="#64482d" strokeWidth="4.5" />
            <polygon points={top} fill="none" stroke="#ffdc82" strokeWidth="2.5" />
          </g>
        )}
        {markers.map(({ site, x, y }) => {
          const size = site.home ? 91 : site.building ? 84 : 68;
          return (
            <g
              className="campaign-board__model"
              aria-hidden="true"
              key={site.id}
              transform={`translate(${x} ${y})`}
              onClick={() => onSelect(site.id)}
            >
              <ellipse
                cy="6"
                rx={site.home ? 30 : 24}
                ry={site.home ? 10 : 8}
                fill="#334637"
                opacity=".31"
              />
              <ellipse
                cy="5"
                rx={site.home ? 31 : 24}
                ry={site.home ? 11 : 8}
                fill="none"
                stroke={site.linked || site.home ? '#ffdf91' : '#f0dfb7'}
                strokeWidth="1.8"
              />
              <image
                href={sprites + (site.home ? 'seat' : 'town') + '.webp'}
                x={-size / 2 - (site.building ? 11 : 0)}
                y={12 - size}
                width={size}
                height={size}
              />
              {site.building && (
                <image href={sprites + site.building + '.webp'} x="3" y="-29" width="49" height="46" />
              )}
              {site.linked && (
                <g transform={`translate(${site.home ? 29 : 25} -13)`}>
                  <path d="M0,13V-22" stroke="#4a4b36" strokeWidth="2.4" />
                  <path
                    d="M1,-22 16,-19 12,-14 16,-10 1,-12Z"
                    fill="#286758"
                    stroke="#f9e7a7"
                    strokeWidth="1.5"
                  />
                </g>
              )}
            </g>
          );
        })}
        {labels.map(({ x, y, width, marker: { site, x: anchorX, y: anchorY } }) => {
          const active = site.id === selected;
          return (
            <g
              key={site.id}
              className={'campaign-board__label' + (active ? ' is-selected' : '')}
              transform={`translate(${x} ${y})`}
              role="button"
              tabIndex={0}
              aria-label={
                site.name +
                (site.home ? ', seat of government' : '') +
                (site.building ? ', ' + site.building : '')
              }
              aria-pressed={active}
              onClick={() => onSelect(site.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(site.id);
                }
              }}
            >
              <path
                aria-hidden="true"
                d={`M${anchorX - x},${anchorY - y + 8} L0,0`}
                stroke="#594d37"
                strokeWidth="2.5"
              />
              <rect
                className="campaign-board__halo"
                x={-width / 2 - 3}
                y="-14"
                width={width + 6}
                height="28"
                rx="6"
              />
              <rect
                className="campaign-board__plate"
                x={-width / 2}
                y="-10.5"
                width={width}
                height="21"
                rx="3"
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                textLength={site.name.length > 27 ? width - 13 : undefined}
                lengthAdjust="spacingAndGlyphs"
              >
                {site.name}
              </text>
              <rect x={-width / 2} y="-16" width={width} height="32" rx="4" fill="transparent" />
            </g>
          );
        })}
        <g aria-hidden="true" transform="translate(44 52)" fill="#e9d7a7">
          <text y="-18" textAnchor="middle" className="campaign-board__north">
            N
          </text>
          <path d="M0,-10 -5,8 0,5Z" />
          <path d="M0,-10 5,8 0,5Z" opacity=".42" />
        </g>
      </svg>
    </div>
  );
}
