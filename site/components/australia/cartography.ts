import {
  axial,
  centre,
  elevationColours,
  limits,
  project,
  regionCode,
  statisticalColours,
  terrainColours,
  type Cell,
  type Lens,
  type Point,
  type Profile,
  type RegionGrid,
  type Terrain,
} from './geography';

const corners = Array.from({ length: 6 }, (_, i) => {
  const angle = ((i * 60 - 90) * Math.PI) / 180;
  return { x: Math.cos(angle) / Math.sqrt(3), y: Math.sin(angle) / Math.sqrt(3) };
});
const neighbours = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];
export const mapMid = { x: 5.25, y: 117 };
const bounds = { left: -79, top: 38, width: 169, height: 159 };
export function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.moveTo(x + corners[0].x, y + corners[0].y);
  for (let i = 1; i < 6; i++) ctx.lineTo(x + corners[i].x, y + corners[i].y);
  ctx.closePath();
}
function shade(hex: string, amount: number) {
  const v = parseInt(hex.slice(1), 16);
  return (
    'rgb(' +
    [v >> 16, (v >> 8) & 255, v & 255]
      .map((c) => Math.min(255, Math.max(0, Math.round(c + amount))))
      .join(',') +
    ')'
  );
}
export function makeChart(data: Terrain, grid: RegionGrid, profiles: Map<string, Profile>, lens: Lens) {
  const sheet = document.createElement('canvas'),
    detail = 14;
  sheet.width = bounds.width * detail;
  sheet.height = bounds.height * detail;
  const ctx = sheet.getContext('2d')!;
  ctx.setTransform(detail, 0, 0, detail, -bounds.left * detail, -bounds.top * detail);
  const index = new Map(data.cells.map((cell) => [cell[0] + ',' + cell[1], cell]));
  const coast = new Path2D(),
    border = new Path2D(),
    mesh = new Path2D();
  for (const [q, r, state] of data.cells) {
    const { x, y } = centre(q, r);
    neighbours.forEach(([dq, dr], i) => {
      const other = index.get(q + dq + ',' + (r + dr));
      const first = corners[(i + 1) % 6],
        next = corners[(i + 2) % 6];
      const line = !other ? coast : state !== other[2] ? border : mesh;
      if (!other || i < 3) {
        line.moveTo(x + first.x, y + first.y);
        line.lineTo(x + next.x, y + next.y);
      }
    });
  }
  // Sea bands follow the actual hex coastline. They are decorative, not depth data.
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const [width, color] of [
    [5.1, '#2b5158'],
    [3.2, '#37616a'],
    [1.5, '#548088'],
  ] as const) {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke(coast);
  }
  for (const [q, r, , type, height] of data.cells) {
    const { x, y } = centre(q, r);
    const grain = Math.sin(q * 154.7 + r * 39.1) * 7331.4;
    const noise = grain - Math.floor(grain);
    let colour: string;
    if (lens === 'terrain') {
      const nw = index.get(q + ',' + (r + 1))?.[4] ?? height;
      const se = index.get(q + ',' + (r - 1))?.[4] ?? height;
      colour = shade(
        terrainColours[type],
        (noise - 0.5) * 12 + Math.max(-22, Math.min(22, (se - nw) * 0.1)),
      );
    } else {
      const value = lens === 'elevation' ? height : profiles.get(regionCode(grid, q, r))?.[lens];
      const palette = lens === 'elevation' ? elevationColours : statisticalColours;
      colour = value == null ? '#7c8583' : palette[limits[lens].filter((t) => value >= t).length];
    }
    ctx.beginPath();
    hexPath(ctx, x, y);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.lineWidth = 0.075;
    ctx.strokeStyle = colour;
    ctx.stroke();
    if (lens === 'terrain' && noise > 0.78 && (type === 4 || type === 5)) {
      ctx.beginPath();
      ctx.moveTo(x - 0.32, y + 0.12);
      ctx.lineTo(x - 0.06, y - 0.22);
      ctx.lineTo(x + 0.2, y + 0.12);
      ctx.strokeStyle = 'rgba(56,64,43,.55)';
      ctx.lineWidth = 0.07;
      ctx.stroke();
    }
  }
  ctx.lineWidth = 0.045;
  ctx.strokeStyle = 'rgba(62,61,39,.23)';
  ctx.stroke(mesh);
  ctx.lineWidth = 0.18;
  ctx.strokeStyle = 'rgba(65,55,35,.65)';
  ctx.setLineDash([0.46, 0.34]);
  ctx.stroke(border);
  ctx.setLineDash([]);
  ctx.strokeStyle = '#e5d09a';
  ctx.lineWidth = 0.13;
  ctx.stroke(coast);
  return { sheet, index };
}
export type View = Point & { zoom: number };
export const initialView: View = { ...mapMid, zoom: 1 };
export type Frame = { width: number; height: number; scale: number; cx: number; cy: number };
export function frame(width: number, height: number, view: View): Frame {
  const usable = Math.max(160, height - (width < 500 ? 63 : 72));
  const scale = Math.min((width - (width < 500 ? 34 : 68)) / 166, usable / 159) * view.zoom;
  return { width, height, scale, cx: width / 2 - view.x * scale, cy: height * 0.53 - view.y * scale };
}
export const screen = (p: Point, f: Frame) => ({ x: f.cx + p.x * f.scale, y: f.cy + p.y * f.scale });
export const world = (p: Point, f: Frame) => ({ x: (p.x - f.cx) / f.scale, y: (p.y - f.cy) / f.scale });
export function findCell(index: Map<string, Cell>, p: Point) {
  const [q, r] = axial(p.x, p.y);
  return index.get(q + ',' + r);
}
const stateNames: [string, number, number][] = [
  ['WESTERN|AUSTRALIA', 122, -25.0],
  ['NORTHERN|TERRITORY', 133.2, -19.6],
  ['QUEENSLAND', 144.8, -23],
  ['SOUTH|AUSTRALIA', 135.2, -30],
  ['NEW SOUTH|WALES', 146.8, -32],
  ['VICTORIA', 143.7, -36.65],
];
const oceans: [string, number, number][] = [
  ['Indian Ocean', 110, -25],
  ['Coral Sea', 154, -18],
  ['Great Australian Bight', 130.1, -34.3],
  ['Tasman Sea', 154, -39],
];
function graticule(ctx: CanvasRenderingContext2D, f: Frame) {
  ctx.beginPath();
  for (let lon = 85; lon <= 180; lon += 5) {
    for (let lat = -62; lat <= 8; lat += 2) {
      const p = screen(project(lon, lat), f);
      if (lat === -62) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
  }
  for (let lat = -60; lat <= 5; lat += 5) {
    for (let lon = 84; lon <= 180; lon += 2) {
      const p = screen(project(lon, lat), f);
      if (lon === 84) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
  }
  ctx.strokeStyle = 'rgba(183,210,199,.12)';
  ctx.lineWidth = 0.7;
  ctx.setLineDash([2, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}
export function drawMap(
  canvas: HTMLCanvasElement,
  sheet: HTMLCanvasElement,
  f: Frame,
  selection: Cell | null,
  regionCells: Cell[],
  labels: boolean,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(f.width * dpr),
    h = Math.round(f.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, f.width, f.height);
  graticule(ctx, f);
  ctx.save();
  ctx.translate(f.cx, f.cy);
  ctx.scale(f.scale, f.scale);
  ctx.drawImage(sheet, bounds.left, bounds.top, bounds.width, bounds.height);
  if (regionCells.length) {
    ctx.beginPath();
    for (const [q, r] of regionCells) {
      const p = centre(q, r);
      hexPath(ctx, p.x, p.y);
    }
    ctx.fillStyle = 'rgba(234,175,58,.27)';
    ctx.fill();
    ctx.lineWidth = 0.11;
    ctx.strokeStyle = '#ecd181';
    ctx.stroke();
  }
  if (selection) {
    const p = centre(selection[0], selection[1]);
    ctx.beginPath();
    hexPath(ctx, p.x, p.y);
    ctx.fillStyle = '#f8db7388';
    ctx.fill();
    ctx.strokeStyle = '#192d32';
    ctx.lineWidth = Math.max(0.13, 2 / f.scale);
    ctx.stroke();
  }
  ctx.restore();
  if (!labels) return;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = Math.max(8, Math.min(14, f.scale * 2.65));
  for (const [name, lon, lat] of stateNames) {
    const p = screen(project(lon, lat), f),
      lines = name.split('|');
    ctx.font = '600 ' + size + 'px Georgia';
    ctx.fillStyle = '#3c3e32';
    ctx.strokeStyle = 'rgba(226,215,165,.8)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    lines.forEach((line, i) => {
      const y = p.y + (i - (lines.length - 1) / 2) * (size + 2);
      ctx.strokeText(line, p.x, y);
      ctx.fillText(line, p.x, y);
    });
  }
  ctx.font = 'italic ' + Math.max(12, Math.min(21, f.scale * 3.2)) + 'px Georgia';
  ctx.fillStyle = '#86a6a5';
  for (const [name, lon, lat] of oceans) {
    const p = screen(project(lon, lat), f);
    ctx.fillText(name, p.x, p.y);
  }
}
