import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  cityName,
  compact,
  elevationColours,
  lenses,
  limits,
  locationOf,
  regionCode,
  statisticalColours,
  terrainColours,
  type Lens,
  type Point,
  type Profile,
  type RegionGrid,
  type Selection,
  type Terrain,
  type Wonder,
} from './geography';
import { drawMap, findCell, frame, initialView, makeChart, screen, world, type View } from './cartography';
import { Icon, Rose } from './Icons';

type Props = {
  data: Terrain;
  grid: RegionGrid;
  regions: Map<string, Profile>;
  cities: Profile[];
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
  regions,
  cities,
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
  const chart = useMemo(() => makeChart(data, grid, regions, lens), [data, grid, regions, lens]);
  const regionCells = useMemo(
    () =>
      selection.kind === 'region'
        ? data.cells.filter(([q, r]) => regionCode(grid, q, r) === selection.profile.code)
        : [],
    [selection, data, grid],
  );
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
    if (canvas.current)
      drawMap(
        canvas.current,
        chart.sheet,
        f,
        selection.kind === 'cell' ? selection.cell : null,
        regionCells,
        labels,
      );
  }, [chart, view, size, selection, regionCells, labels]);
  useEffect(() => {
    if (!focus) return;
    const p = locationOf(focus);
    setView(p ? { ...p, zoom: focus.kind === 'region' ? 3 : 2.4 } : initialView);
    if (focus.kind === 'city') setCityPins(true);
    if (focus.kind === 'wonder') setWonderPins(true);
  }, [focus]);
  function zoomBy(factor: number, anchor?: Point) {
    setView((v) => {
      const old = frame(size.width, size.height, v),
        zoom = Math.min(10, Math.max(0.85, v.zoom * factor));
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
  const displayedPins = pins.filter((p) => (p.city ? cityPins : wonderPins));
  const active = locationOf(selection);
  const activeScreen = active && screen(active, f);
  const scaleKm = [10, 25, 50, 100, 250, 500, 1000].filter((k) => (k / 25) * f.scale < 90).at(-1) ?? 10;
  return (
    <section className="maproom" aria-label="Australian hex map">
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
              if (e.key === 'Home') setView(initialView);
              else if (e.key === 'Enter') {
                const cell = findCell(chart.index, view);
                if (cell) onSelect({ kind: 'cell', cell });
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
                cell = findCell(
                  chart.index,
                  world({ x: e.clientX - rect.left, y: e.clientY - rect.top }, f),
                );
              if (cell) onSelect({ kind: 'cell', cell });
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
        />
        <div className="map-title">
          <span className="eyebrow">
            <i /> Map room
          </span>
          <h1>Continental map</h1>
        </div>
        <div className="map-options">
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
              {(
                [
                  ['Capital cities', cityPins, setCityPins],
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
              className={'map-pin ' + (pin.city ? 'city-pin' : 'wonder-pin') + (selected ? ' chosen' : '')}
              style={{ left: p.x, top: p.y }}
              onClick={() => onSelect(pin.selection)}
            >
              <span className="pin-glyph">{pin.city ? '✦' : '◆'}</span>
              {pin.city && (
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
        <div className="map-compass" aria-hidden="true">
          <span>N</span>
          <Rose size={48} />
        </div>
        <div className="scale" style={{ width: (scaleKm / 25) * f.scale }}>
          {scaleKm} km
        </div>
        <div className="map-tools">
          <button className="tool-square" aria-label="Zoom in" onClick={() => zoomBy(1.4)}>
            <Icon name="plus" />
          </button>
          <button className="tool-square" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.4)}>
            <Icon name="minus" />
          </button>
          <button className="tool-square" aria-label="Fit Australia" onClick={() => setView(initialView)}>
            <Icon name="fit" />
          </button>
        </div>
      </div>
      <div className="lensbar">
        <div className="lens-title">
          <Icon name="layers" size={15} />
          <span>Map lenses</span>
        </div>
        <div className="lens-buttons">
          {(Object.keys(lenses) as Lens[]).map((k) => (
            <button key={k} aria-pressed={lens === k} onClick={() => onLens(k)}>
              <Icon name={k} size={16} />
              {lenses[k]}
            </button>
          ))}
        </div>
        <Legend lens={lens} data={data} />
      </div>
    </section>
  );
}
