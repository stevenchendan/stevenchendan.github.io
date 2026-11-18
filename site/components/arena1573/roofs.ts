import * as T from 'three';
import type { Batch } from './architecture';
import { pointInRing } from './precinctGeometry';

export type RoofStatus = 'open' | 'closing' | 'closed' | 'opening';
type RoofVenue = 'mca' | 'rla' | 'john';
type LeafBuilder = Batch & { finish(): T.Group };

// Dimensions of the openings in the reconstructed fixed canopies, in metres.
const openings = {
  mca: { halfWidth: 27.5, halfDepth: 22.5, railOverhang: .25, corner: 0 },
  rla: { halfWidth: 35, halfDepth: 35, railOverhang: 2.9, corner: 3 },
  john: { halfWidth: 33, halfDepth: 36, railOverhang: 2.9, corner: 2 },
};

export const rodLaverAnnexes = [[154,-3,23,10],[154,147,21,10],[92,83,11,24]];

export function copperRoofHeight(x: number) {
  const phase = ((x - 25) % 8 + 8) % 8;
  const fold = 1 - Math.abs(phase - 4) / 4;
  const skirt = Math.min(1, Math.max(0, (x - 15) / 12), Math.max(0, (130 - x) / 22));
  return 10.5 + skirt * (4.5 + fold * 2.8);
}

function skinHeight(venue: RoofVenue, x: number, centerX: number) {
  if (venue === 'mca') return copperRoofHeight(centerX + x) + 1.45;
  const span = openings[venue].halfWidth + openings[venue].railOverhang;
  if (venue === 'john') return 27.5 + 1.4 * (1 - Math.abs(x) / span);
  return 28.45 + 2.5 * (1 - (x / span) ** 2);
}

function insideRounded(x: number, z: number, width: number, depth: number, corner: number) {
  if (x > width || z > depth) return false;
  const u = Math.max(0, x - width + corner);
  const v = Math.max(0, z - depth + corner);
  return u * u + v * v <= corner * corner;
}

function buildLeaf(b: LeafBuilder, venue: RoofVenue, centerX: number) {
  const { halfWidth, halfDepth, railOverhang } = openings[venue];
  const span = halfWidth + railOverhang, end = halfDepth / 2;
  const height = (x: number) => skinHeight(venue, x, centerX);
  const copper = venue === 'mca';
  const sheet = venue === 'john' ? '#cdd4d1' : '#e4e7e2';
  const seam = copper ? '#c4906c' : '#aebabb';
  const breaks = [-span];
  if (copper) {
    // Align the ridges of the moving plates with the folds on the fixed roof.
    for (let x = 25 + 4 * Math.ceil((centerX - span - 25) / 4); x < centerX + span; x += 4) {
      if (x > centerX - span) breaks.push(x - centerX);
    }
  } else {
    for (let i = 1; i < 20; i++) breaks.push(-span + (2 * span * i) / 20);
  }
  breaks.push(span);
  for (let i = 1; i < breaks.length; i++) {
    const a = breaks[i - 1], c = breaks[i];
    const geometry = new T.BoxGeometry(c - a, .22, halfDepth);
    geometry.translate((a + c) / 2, -.11, 0);
    const pos = geometry.getAttribute('position');
    for (let j = 0; j < pos.count; j++) pos.setY(j, pos.getY(j) + height(pos.getX(j)));
    geometry.computeVertexNormals();
    b.add(geometry, copper ? (height(c) > height(a) ? '#be8059' : '#a86b49') : sheet);
    b.rod([c, height(c) + .035, -end], [c, height(c) + .035, end], .055, seam);
  }

  // Open-web girders travel with the roof. Their bottom chords, purlins and
  // work lights give the moving leaf a readable silhouette from the bowl.
  const girderDepth = copper ? 1.3 : venue === 'john' ? 2.2 : 2.6;
  const chord = (x: number) => copper ? 15.7 : height(x) - .38;
  const bays = Math.ceil((2 * span) / 5.5);
  for (const z of [-end + .35, 0, end - .35]) {
    for (let i = 0; i < bays; i++) {
      const a = -span + (2 * span * i) / bays, c = -span + (2 * span * (i + 1)) / bays;
      const topA = chord(a), topC = chord(c);
      b.rod([a,topA,z], [c,topC,z], .13, '#879496');
      b.rod([a,topA-girderDepth,z], [c,topC-girderDepth,z], .15, '#a6b3b3');
      b.rod([a,topA-(i%2)*girderDepth,z], [c,topC-((i+1)%2)*girderDepth,z], .085, '#93a3a3');
      if (copper) b.rod([a,topA,z], [a,height(a)-.18,z], .07, '#879496');
    }
  }
  for (let i = 1; i < 8; i++) {
    const x = -span + 2 * span * i / 8;
    b.rod([x,height(x)-.35,-end], [x,height(x)-.35,end], .11, '#879496');
    if (i%2 === 0) b.box(x,chord(x)-girderDepth-.1,0,1.15,.16,.46,'#e4e9dc');
  }
  if(venue==='rla'){
    // The white bowstring girders stand above the moving leaves and remain
    // visible across the opening from the upper baseline and corner blocks.
    const crown=(x:number)=>height(x)+.24+3.9*(1-(x/span)**2);
    for(const z of [-end+.08,end-.08])for(let i=1;i<breaks.length;i++){
      const a=breaks[i-1],c=breaks[i],g=new T.BoxGeometry(c-a,1,.18);
      g.translate((a+c)/2,0,z);
      const pos=g.getAttribute('position');
      for(let j=0;j<pos.count;j++)pos.setY(j,pos.getY(j)>0?height(pos.getX(j))-.1:24.74);
      g.computeVertexNormals();b.add(g,'#b9c4c6');
    }
    for(const z of [-end+1.7,end-1.7])for(let i=0;i<18;i++){
      const a=-span+2*span*i/18,c=-span+2*span*(i+1)/18;
      b.rod([a,crown(a),z],[c,crown(c),z],.16,'#e3e6df');
      b.rod([a,height(a)+.18,z],[c,height(c)+.18,z],.14,'#d1d8d5');
      const even=i%2===0;
      b.rod([a,even?height(a)+.18:crown(a),z],[c,even?crown(c):height(c)+.18,z],.10,'#e6e9e3');
    }
  }
  return b.finish();
}

export class ArenaRoof extends T.Group {
  readonly negativeLeaf: T.Group;
  readonly positiveLeaf: T.Group;
  private readonly bounds: T.Box2;
  private readonly sample = [0, 0];
  private gap: number;

  constructor(
    readonly venue: RoofVenue, x: number, z: number, private readonly footprint: number[][],
    build: () => LeafBuilder,
  ) {
    super();
    this.name = venue + '-retractable-roof';
    this.position.set(x, 0, z);
    this.bounds = new T.Box2().setFromPoints(footprint.map(([u,v]) => new T.Vector2(u,v)));
    this.gap = openings[venue].halfDepth;
    this.negativeLeaf = buildLeaf(build(), venue, x);
    this.positiveLeaf = this.negativeLeaf.clone();
    this.add(this.negativeLeaf, this.positiveLeaf);
    this.setClosure(0);
  }

  setClosure(progress: number) {
    const depth = openings[this.venue].halfDepth;
    this.gap = depth * (1 - progress);
    this.negativeLeaf.position.z = -(this.gap + depth / 2);
    this.positiveLeaf.position.z = this.gap + depth / 2;
  }

  shelterHeight(x: number, z: number) {
    if (!this.parent?.visible || !this.visible) return 0;
    const u = Math.abs(x - this.position.x), v = Math.abs(z - this.position.z);
    const {halfWidth, halfDepth, railOverhang, corner} = openings[this.venue];
    if (u <= halfWidth + railOverhang && v >= this.gap && v <= this.gap + halfDepth) {
      return skinHeight(this.venue, x - this.position.x, this.position.x);
    }
    if (insideRounded(u,v,halfWidth,halfDepth,corner)) return 0;
    if (this.venue === 'rla') {
      if (insideRounded(u,v,56,65,31)) return 23 + 5 * (1 - Math.max(u / 56, v / 65));
      for (const [cx,cz,w,d] of rodLaverAnnexes) {
        if (insideRounded(Math.abs(x-cx),Math.abs(z-cz),w,d,6)) return 7.3;
      }
      return 0;
    }
    const {min,max} = this.bounds;
    if (x < min.x || x > max.x || z < min.y || z > max.y) return 0;
    this.sample[0] = x; this.sample[1] = z;
    if (!pointInRing(this.sample, this.footprint)) return 0;
    return this.venue === 'mca' ? copperRoofHeight(x) : 26.6;
  }
}

/** A single reversible motor drives all three arenas and their rain shadows. */
export class RoofMotion {
  progress = 0;
  private velocity = 0;
  private target = 0;
  private assemblies: ArenaRoof[] = [];
  get moving() { return this.progress !== this.target; }
  get status(): RoofStatus {
    if (this.moving) return this.target ? 'closing' : 'opening';
    return this.target ? 'closed' : 'open';
  }

  bind(root: T.Group) {
    this.assemblies = [];
    root.traverse(object => {
      if (object instanceof ArenaRoof) {
        object.setClosure(this.progress);
        this.assemblies.push(object);
      }
    });
  }

  advance(rain: boolean, reducedMotion: boolean, delta: number): RoofStatus {
    const target = rain ? 1 : 0, previous = this.progress;
    // Demand rendering can wake up with a delta that includes minutes of idle time.
    const changed = this.target !== target;
    this.target = target;
    if (reducedMotion || !this.moving) {
      this.progress = target;
      this.velocity = 0;
    } else {
      const dt = Math.min(Math.max(delta, 0), changed ? 1 / 30 : 8);
      const steps = Math.ceil(dt * 60);
      for (let i = 0; i < steps && this.moving; i++) {
        const step = dt / steps, distance = target - this.progress;
        const acceleration = .24, maxSpeed = .16;
        const speed = Math.sign(distance) * Math.min(maxSpeed, Math.sqrt(2 * acceleration * Math.abs(distance)));
        const next = this.velocity + T.MathUtils.clamp(speed - this.velocity, -acceleration * step, acceleration * step);
        this.progress = T.MathUtils.clamp(this.progress + (this.velocity + next) * step / 2, 0, 1);
        this.velocity = this.moving ? next : 0;
      }
    }
    if (previous !== this.progress) for (const assembly of this.assemblies) assembly.setClosure(this.progress);
    return this.status;
  }

  rainFloor(x: number, z: number) {
    let floor = .15;
    for (const assembly of this.assemblies) floor = Math.max(floor, assembly.shelterHeight(x,z));
    return floor;
  }
}
