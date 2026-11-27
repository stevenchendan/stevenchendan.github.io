import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  axial,
  cityName,
  compact,
  elevationColours,
  lenses,
  limits,
  locationOf,
  statisticalColours,
  terrainColours,
  type Cell,
  type Lens,
  type Point,
  type Profile,
  type RegionGrid,
  type Selection,
  type Terrain,
  type Wonder,
} from './geography';
import {
  drawMap,
  findCell,
  fitTerritory,
  frame,
  initialView,
  makeChart,
  screen,
  territory,
  world,
  type View,
} from './cartography';
import { areaCells, type Footprints } from './footprints';
import { capitalTown } from './journey';
import { Icon, Rose } from './Icons';
import { placeType, type Place } from './places';
import landmarks from '../../data/australia/landmarks.json';
import { buildFeatures, landform, tileName, type LandCover } from './tileFeatures';
import { makeFeatureLayer, loadArtwork } from './tileArtwork';

type Props = {
  data: Terrain;
  grid: RegionGrid;
  footprints: Footprints;
  cover: LandCover;
  here: Place | null;
  destination: Place | null;
  openDesk: () => void;
  regions: Map<string, Profile>;
  cities: Profile[];
  places: Place[];
  openPlaces: () => void;
  wonders: Wonder[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  lens: Lens;
  onLens: (l: Lens) => void;
  focus: Selection | null;
};
function Legend({ lens, data }: { lens: Lens; data: Terrain }) {
  if (lens === 'terrain')
    return (
      <div className="map-legend">
        {data.terrains.map((name, i) => (
          <span key={name}>
            <i style={{ background: terrainColours[i] }} />
            {name}
          </span>
        ))}
      </div>
    );
  const colours = lens === 'elevation' ? elevationColours : statisticalColours;
  const cuts = limits[lens],
    unit = lens === 'weeklyIncome' ? '$' : '',
    suffix = lens === 'elevation' ? ' m' : lens === 'medianAge' ? ' yr' : '';
  const v = (n: number) => unit + compact(n) + suffix;
  return (
    <div className="map-legend">
      {colours.map((color, i) => (
        <span key={color}>
          <i style={{ background: color }} />
          {i === 0
            ? '< ' + v(cuts[0])
            : i === colours.length - 1
              ? v(cuts[i - 1]) + '+'
              : v(cuts[i - 1]) + '–<' + v(cuts[i])}
        </span>
      ))}
      {lens !== 'elevation' && (
        <span>
          <i style={{ background: '#7c8583' }} />
          Unassigned
        </span>
      )}
    </div>
  );
}
export default function MapRoom({
  data,
  grid,
  footprints,
  cover,
  here,
  destination,
  openDesk,
  regions,
  cities,
  places,
  openPlaces,
  wonders,
  selection,
  onSelect,
  lens,
  onLens,
  focus,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 850, height: 650 }),
    [view, setView] = useState<View>(initialView);
  const [cityPins, setCityPins] = useState(true),
    [wonderPins, setWonderPins] = useState(true),
    [labels, setLabels] = useState(true);
  const [settings, setSettings] = useState(false);
  const f = frame(size.width, size.height, view);
  const features = useMemo(
    () => buildFeatures(data, cover, places, landmarks.landmarks),
    [data, cover, places],
  );
  const [art, setArt] = useState<Map<string, CanvasImageSource>>(() => new Map());
  useEffect(() => {
    let live = true;
    loadArtwork().then((images) => {
      if (live) setArt(images);
    });
    return () => {
      live = false;
    };
  }, []);
  const layer = useMemo(() => makeFeatureLayer(features, art), [features, art]);
  const chart = useMemo(
    () => makeChart(data, grid, regions, lens, features),
    [data, grid, regions, lens, features],
  );
  const area = useMemo(
    () => territory(areaCells(selection, data, grid, footprints)),
    [selection, data, grid, footprints],
  );
  const [inspected, setInspected] = useState<Cell | null>(null);
  const feature = inspected && features.get(inspected[0] + ',' + inspected[1]);
  const isArea = ['region', 'place', 'city'].includes(selection.kind);
  const areaName =
    selection.kind === 'place'
      ? selection.place.name
      : selection.kind === 'city'
        ? cityName(selection.profile)
        : selection.kind === 'region'
          ? selection.profile.name
          : '';
  const areaType =
    selection.kind === 'city'
      ? '首府都市圈'
      : selection.kind === 'region'
        ? '统计区域'
        : selection.kind === 'place' && selection.place.urban
          ? '城镇'
          : '郊区与地方';
  const inside = (p: Point) => !area || area.keys.has(axial(p.x, p.y).join(','));
  function inspect(cell: Cell) {
    if (area?.keys.has(cell[0] + ',' + cell[1])) setInspected(cell);
    else onSelect({ kind: 'cell', cell });
  }
  const pins = useMemo(
    () =>
      [
        ...wonders.map((wonder) => ({
          selection: { kind: 'wonder', wonder } as Selection,
          id: 'w' + wonder.id,
          label: wonder.shortLabel,
          city: false,
        })),
        ...cities.map((profile) => ({
          selection: { kind: 'city', profile } as Selection,
          id: 'c' + profile.code,
          label: cityName(profile),
          city: true,
        })),
      ].map((p) => ({ ...p, point: locationOf(p.selection)! })),
    [cities, wonders],
  );
  useLayoutEffect(() => {
    if (!viewport.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) setSize({ width, height });
    });
    ro.observe(viewport.current);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (canvas.current) drawMap(canvas.current, chart.sheet, f, inspected, area, labels, layer);
  }, [chart, view, size, selection, area, labels, inspected, layer]);
  useEffect(() => setInspected(selection.kind === 'cell' ? selection.cell : null), [selection]);
  useEffect(() => {
    if (!focus || focus !== selection || focus.kind === 'cell') return;
    const p = locationOf(focus);
    setView(
      area
        ? fitTerritory(area, p, size.width, size.height)
        : p
          ? {
              x: p.x,
              y: p.y,
              zoom: focus.kind === 'place' ? (focus.place.urban ? 6 : 40) : focus.kind === 'region' ? 3 : 2.4,
            }
          : initialView,
    );
    if (focus.kind === 'city' || focus.kind === 'place') setCityPins(true);
    if (focus.kind === 'wonder') setWonderPins(true);
  }, [focus, selection, area, size.width, size.height]);
  function zoomBy(factor: number, anchor?: Point) {
    setView((v) => {
      const old = frame(size.width, size.height, v),
        zoom = Math.min(220, Math.max(0.85, v.zoom * factor));
      const at = anchor ?? screen(v, old),
        p = world(at, old);
      return { x: p.x + ((v.x - p.x) * v.zoom) / zoom, y: p.y + ((v.y - p.y) * v.zoom) / zoom, zoom };
    });
  }
  const zoomRef = useRef(zoomBy);
  zoomRef.current = zoomBy;
  useEffect(() => {
    const el = canvas.current;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      zoomRef.current(Math.exp(-Math.sign(e.deltaY) * Math.min(0.35, Math.abs(e.deltaY) * 0.002)), {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };
    el?.addEventListener('wheel', wheel, { passive: false });
    return () => el?.removeEventListener('wheel', wheel);
  }, []);
  const drag = useRef<{ id: number; start: Point; view: View; moved: boolean } | null>(null);
  const displayedPins = pins.filter(
    (p) =>
      (p.city ? cityPins : wonderPins) &&
      !(
        selection.kind === 'place' &&
        p.selection.kind === 'city' &&
        capitalTown[p.selection.profile.state] === selection.place.id
      ),
  );
  const majorTowns = useMemo(
    () => places.filter((p) => p.urban && p.population >= 50000 && capitalTown[p.state] !== p.id),
    [places],
  );
  const settlementPins = useMemo(() => {
    if (!cityPins) return [];
    const chosen = selection.kind === 'place' ? selection.place : null;
    const visible: { place: Place; point: Point; label: boolean }[] = [];
    const occupied = new Set<string>();
    const labelled: { left: number; right: number; y: number }[] = [];
    for (const p of pins.filter((p) => p.city)) {
      const v = screen(p.point, f);
      occupied.add(Math.floor(v.x / 28) + ',' + Math.floor(v.y / 22));
      const width = p.label.length * 7.4 + 12;
      const west = p.label === 'Adelaide' || p.label === 'Canberra';
      labelled.push({ left: v.x - (west ? width : 8), right: v.x + (west ? 8 : width), y: v.y });
    }
    function add(place: Place, priority = false) {
      const point = screen(place, f);
      if (point.x < 6 || point.x > f.width - 6 || point.y < 6 || point.y > f.height - 6) return;
      const key = Math.floor(point.x / 28) + ',' + Math.floor(point.y / 22);
      if (!priority && occupied.has(key)) return;
      occupied.add(key);
      const left = point.x + 4,
        right = left + Math.min(113, place.name.length * 6.1 + 7);
      const clear =
        right <= f.width - 4 &&
        !labelled.some((b) => left < b.right + 5 && right + 5 > b.left && Math.abs(point.y - b.y) < 17);
      const label = priority || clear;
      if (label) labelled.push({ left, right, y: point.y });
      visible.push({ place, point, label });
    }
    if (chosen) add(chosen, true);
    if (!isArea) {
      const limit = size.width < 650 ? 4 : 8;
      for (const p of majorTowns) {
        add(p);
        if (visible.filter((p) => p.label).length >= limit) break;
      }
    }
    return visible;
  }, [cityPins, selection, majorTowns, view, size, pins, isArea]);
  const active = locationOf(selection);
  const activeScreen = active && screen(active, f);
  const person = here && screen(here, f),
    stop = destination && screen(destination, f);
  const scaleKm =
    [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000].filter((k) => (k / 25) * f.scale < 90).at(-1) ?? 0.5;
  function fitDelivery() {
    if (!here || !destination) return;
    const scale = Math.min(
      (size.width * 0.62) / Math.max(0.15, Math.abs(here.x - destination.x)),
      (size.height * 0.52) / Math.max(0.15, Math.abs(here.y - destination.y)),
    );
    setView({
      x: (here.x + destination.x) / 2,
      y: (here.y + destination.y) / 2,
      zoom: Math.min(220, Math.max(0.85, scale / frame(size.width, size.height, initialView).scale)),
    });
  }
  return (
    <section
      className="maproom"
      aria-label="Australian hex map"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && isArea && !settings) onSelect({ kind: 'country' });
      }}
    >
      <div className="map-viewport" ref={viewport}>
        <canvas
          ref={canvas}
          tabIndex={0}
          aria-label="Interactive land hexes. Use arrow keys to pan, plus and minus to zoom, Enter to inspect the centre and Home to reset."
          onKeyDown={(e) => {
            const shifts: Record<string, [number, number]> = {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
            };
            if (shifts[e.key]) {
              e.preventDefault();
              const [x, y] = shifts[e.key];
              setView((v) => ({ ...v, x: v.x + (x * 40) / f.scale, y: v.y + (y * 40) / f.scale }));
            } else if (['+', '=', '-', 'Home', 'Enter'].includes(e.key)) {
              e.preventDefault();
              if (e.key === 'Home') {
                onSelect({ kind: 'country' });
                setView(initialView);
              } else if (e.key === 'Enter') {
                const cell = findCell(chart.index, view);
                if (cell) inspect(cell);
              } else zoomBy(e.key === '-' ? 0.8 : 1.25);
            }
          }}
          onPointerDown={(e) => {
            if (e.button !== 0 || drag.current) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { id: e.pointerId, start: { x: e.clientX, y: e.clientY }, view, moved: false };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            const dx = e.clientX - d.start.x,
              dy = e.clientY - d.start.y;
            if (Math.hypot(dx, dy) > 4) d.moved = true;
            if (d.moved) setView({ ...d.view, x: d.view.x - dx / f.scale, y: d.view.y - dy / f.scale });
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            drag.current = null;
            if (!d.moved) {
              const rect = e.currentTarget.getBoundingClientRect(),
                cell = findCell(chart.index, world({ x: e.clientX - rect.left, y: e.clientY - rect.top }, f));
              if (cell) inspect(cell);
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
        />
        {person && (
          <svg className="journey-route" aria-hidden="true" width={f.width} height={f.height}>
            {stop && (
              <>
                <path
                  d={`M ${person.x},${person.y} L ${stop.x},${stop.y}`}
                  stroke="#214036"
                  strokeWidth="5"
                  fill="none"
                />
                <path
                  d={`M ${person.x},${person.y} L ${stop.x},${stop.y}`}
                  stroke="#ffdb88"
                  strokeWidth="3"
                  strokeDasharray="6 5"
                  fill="none"
                />
                <circle cx={stop.x} cy={stop.y} r="11" fill="none" stroke="#ffde88" strokeWidth="2" />
              </>
            )}
            <circle cx={person.x} cy={person.y} r="11" fill="none" stroke="#143c36" strokeWidth="5" />
            <circle cx={person.x} cy={person.y} r="11" fill="none" stroke="#fff4b7" strokeWidth="2.5" />
          </svg>
        )}
        {isArea ? (
          <div className="area-banner">
            <div aria-live="polite">
              <small>{areaType}</small>
              <h1>{areaName}</h1>
              <p>
                {area
                  ? area.keys.size + (area.keys.size === 1 ? ' 个代表格' : ' 个陆地格')
                  : '代表地点 · 超出陆地网格覆盖'}
              </p>
            </div>
            <button className="area-profile" onClick={openDesk}>
              地点与行动 ↓
            </button>
            <button
              className="area-close"
              aria-label="Close area view"
              onClick={() => onSelect({ kind: 'country' })}
            >
              <Icon name="close" size={17} />
            </button>
          </div>
        ) : (
          <div className="map-title">
            <span className="eyebrow">
              <i /> Australian Albers · 25 km
            </span>
            <h1>澳大利亚</h1>
          </div>
        )}
        <div className="map-options">
          <button className="tool-square" aria-label="Search settlements" onClick={openPlaces}>
            <Icon name="search" />
          </button>
          <button
            className="tool-square"
            aria-label="Map overlays"
            aria-expanded={settings}
            onClick={() => setSettings(!settings)}
          >
            <Icon name="layers" />
          </button>
          {settings && (
            <fieldset>
              <legend>Map overlays</legend>
              <label>
                地图图层{' '}
                <select value={lens} onChange={(e) => onLens(e.target.value as Lens)}>
                  {(Object.keys(lenses) as Lens[]).map((k) => (
                    <option value={k} key={k}>
                      {lenses[k]}
                    </option>
                  ))}
                </select>
              </label>
              {(
                [
                  ['Settlements', cityPins, setCityPins],
                  ['World wonders', wonderPins, setWonderPins],
                  ['Map labels', labels, setLabels],
                ] as const
              ).map(([label, value, set]) => (
                <label key={label}>
                  <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
        </div>
        {settlementPins.map(({ place, point, label }) => (
          <button
            key={place.id}
            className={
              'map-place ' +
              (selection.kind === 'place' && selection.place.id === place.id
                ? 'chosen'
                : inside(place)
                  ? ''
                  : 'outside-area')
            }
            title={place.name}
            aria-label={place.name + ', ' + placeType(place) + ', ' + place.state}
            style={{ left: point.x, top: point.y }}
            onClick={() => onSelect({ kind: 'place', place })}
          >
            <i />
            {label && labels && <span>{place.name}</span>}
          </button>
        ))}
        {displayedPins.map((pin) => {
          const p = screen(pin.point, f);
          if (p.x < 0 || p.x > f.width || p.y < 0 || p.y > f.height) return null;
          const selected =
            (pin.selection.kind === 'city' &&
              selection.kind === 'city' &&
              pin.selection.profile.code === selection.profile.code) ||
            (pin.selection.kind === 'wonder' &&
              selection.kind === 'wonder' &&
              pin.selection.wonder.id === selection.wonder.id);
          return (
            <button
              key={pin.id}
              title={pin.label}
              aria-label={pin.label + (pin.city ? ', capital city' : ', world wonder')}
              aria-pressed={selected}
              className={
                'map-pin ' +
                (pin.city ? 'city-pin' : 'wonder-pin') +
                (selected ? ' chosen' : inside(pin.point) ? '' : ' outside-area')
              }
              style={{ left: p.x, top: p.y }}
              onClick={() => onSelect(pin.selection)}
            >
              <span className="pin-glyph">{pin.city ? '✦' : '◆'}</span>
              {pin.city && labels && (!isArea || selected) && (
                <span
                  className={
                    'pin-label ' +
                    (pin.label === 'Canberra' ? 'label-sw' : pin.label === 'Adelaide' ? 'label-west' : '')
                  }
                >
                  {pin.label}
                </span>
              )}
            </button>
          );
        })}
        {selection.kind === 'region' && activeScreen && (
          <div className="region-pin" style={{ left: activeScreen.x, top: activeScreen.y }}>
            <Icon name="pin" size={22} />
          </div>
        )}
        {feature && (
          <section className="tile-note" aria-live="polite" aria-label="地块特征">
            <button className="area-close" aria-label="收起地块特征" onClick={() => setInspected(null)}>
              <Icon name="close" size={15} />
            </button>
            <small>
              地块特征 · {landform(feature.cell)} · {feature.cell[4]} m
            </small>
            <strong>{tileName(feature)}</strong>
            {feature.coverName && (
              <span>
                MODIS {cover.year} · 主要覆盖为{feature.coverName}
              </span>
            )}
            {feature.town && (
              <a
                href={
                  'https://www.abs.gov.au/census/find-census-data/quickstats/2021/UCL' +
                  feature.town.id.slice(1)
                }
                target="_blank"
                rel="noreferrer"
              >
                城镇人口 · {feature.town.name} · {feature.town.population.toLocaleString('en-AU')}（ABS
                2021）↗
              </a>
            )}
            {feature.landmarks.map(({ site, coastal }) => (
              <a key={site.id} href={site.source} target="_blank" rel="noreferrer">
                {coastal ? '邻近陆地格 · ' : ''}
                {site.name} · 档案 ↗
              </a>
            ))}
            <a href="/data/australia/landcover-readme.md" target="_blank" rel="noreferrer">
              卫星数据与图案依据 ↗
            </a>
          </section>
        )}
        <div className="map-compass" aria-hidden="true" hidden={!!feature}>
          <span>N</span>
          <Rose size={48} />
        </div>
        <div className="scale" style={{ width: (scaleKm / 25) * f.scale }}>
          {scaleKm} km
        </div>
        <div className="map-tools">
          {here && destination && here.id !== destination.id && (
            <button
              className="tool-square"
              title="查看运送路线"
              aria-label="查看运送路线"
              onClick={fitDelivery}
            >
              <Icon name="compass" />
            </button>
          )}
          <button className="tool-square" aria-label="Zoom in" onClick={() => zoomBy(1.4)}>
            <Icon name="plus" />
          </button>
          <button className="tool-square" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.4)}>
            <Icon name="minus" />
          </button>
          <button
            className="tool-square"
            aria-label="Fit Australia"
            onClick={() => {
              onSelect({ kind: 'country' });
              setView(initialView);
            }}
          >
            <Icon name="fit" />
          </button>
        </div>
      </div>
      {lens !== 'terrain' && (
        <div className="lensbar">
          <Legend lens={lens} data={data} />
        </div>
      )}
    </section>
  );
}
