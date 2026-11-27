import type { Frame } from './cartography';
import type { TileFeature } from './tileFeatures';
import { rowStep } from './geography';

type Artwork = Map<string, CanvasImageSource>;
const imageNames = [
  'forest',
  'woodland',
  'scrub',
  'grass',
  'wetland',
  'crops',
  'rock',
  'ridge',
  'town',
  'urban',
  'water',
  'opera-house',
  'exhibition-building',
  'parliament-house',
  'uluru',
  'tower',
  'hall',
  'gaol',
  'cascades',
  'bridge',
  'fort',
  'memorial',
  'hangar',
  'shed',
];
const base = '/images/australia/tiles/';
let loaded: Promise<Artwork> | undefined;
export function loadArtwork() {
  return (loaded ??= Promise.all(
    imageNames.map(async (name) => {
      const img = new Image();
      img.src = base + name + '.webp';
      try {
        await img.decode();
        return [name, img] as const;
      } catch {
        return null;
      }
    }),
  ).then((results) => new Map(results.filter((entry) => entry !== null))));
}
// Lightweight marks keep the terrain readable while the miniature assets decode.
function smallSymbol(ctx: CanvasRenderingContext2D, t: TileFeature) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.075;
  ctx.strokeStyle = t.sprite === 'water' ? '#426e75' : '#646349';
  ctx.fillStyle = t.tint;
  ctx.beginPath();
  if (t.sprite === 'water') {
    for (const [x, y] of [
      [-0.36, -0.08],
      [-0.1, 0.07],
      [-0.28, 0.21],
    ]) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 0.08, y + 0.06, x + 0.17, y);
      ctx.quadraticCurveTo(x + 0.25, y - 0.045, x + 0.34, y);
    }
  } else if (t.sprite === 'ridge' || t.sprite === 'relief' || t.sprite === 'snow') {
    ctx.moveTo(-0.32, 0.15);
    ctx.lineTo(-0.09, -0.14);
    ctx.lineTo(0.04, 0.04);
    ctx.lineTo(0.16, -0.12);
    ctx.lineTo(0.35, 0.15);
  } else {
    ctx.arc(0, 0, 0.075, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.stroke();
}
function stamp(ctx: CanvasRenderingContext2D, t: TileFeature, art: Artwork, maxSize = 1) {
  const img = art.get(t.sprite);
  const landmark = t.landmarks.length > 0;
  const variation = (((Math.imul(t.cell[0], 73856093) ^ Math.imul(t.cell[1], 19349663)) >>> 0) % 97) / 96;
  const size = Math.min(maxSize, landmark ? 0.99 : t.town ? 0.88 : 0.7 + 0.16 * variation);
  const x = t.x + (landmark || t.town ? 0 : (variation - 0.5) * 0.1);
  if (img) {
    ctx.drawImage(img, x - size / 2, t.y - size * 0.53, size, size);
  } else {
    ctx.save();
    ctx.translate(x, t.y);
    ctx.scale(size, size);
    smallSymbol(ctx, t);
    ctx.restore();
  }
}
export function makeFeatureLayer(features: Map<string, TileFeature>, art: Artwork) {
  // Bake small symbols once for the national map. Regional views use the full-resolution miniatures.
  const entries = [...features.values()];
  const left = Math.floor(Math.min(...entries.map((t) => t.x)) - 1);
  const top = Math.floor(Math.min(...entries.map((t) => t.y)) - 1);
  const width = Math.ceil(Math.max(...entries.map((t) => t.x)) + 1 - left);
  const height = Math.ceil(Math.max(...entries.map((t) => t.y)) + 1 - top);
  const miniature = document.createElement('canvas'),
    detail = 10;
  miniature.width = width * detail;
  miniature.height = height * detail;
  const ctx = miniature.getContext('2d')!;
  ctx.setTransform(detail, 0, 0, detail, -left * detail, -top * detail);
  for (const t of entries) stamp(ctx, t, art);
  return { features, art, miniature, left, top, width, height };
}
export type FeatureLayer = ReturnType<typeof makeFeatureLayer>;
export function drawFeatures(ctx: CanvasRenderingContext2D, f: Frame, layer: FeatureLayer) {
  if (f.scale < 12) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, 0.48 + f.scale * 0.035);
    ctx.drawImage(layer.miniature, layer.left, layer.top, layer.width, layer.height);
    ctx.restore();
    return;
  }
  const left = -f.cx / f.scale - 1,
    right = (f.width - f.cx) / f.scale + 1;
  const bottomRow = Math.ceil((f.cy - f.height) / f.scale / rowStep) - 1;
  const topRow = Math.floor(f.cy / f.scale / rowStep) + 1;
  const maxSize = 170 / f.scale;
  for (let r = topRow; r >= bottomRow; r--) {
    for (let q = Math.ceil(left - r / 2); q <= right - r / 2; q++) {
      const t = layer.features.get(q + ',' + r);
      if (t) stamp(ctx, t, layer.art, maxSize);
    }
  }
}
