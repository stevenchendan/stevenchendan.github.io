import * as T from 'three';

export type SpectatorSeat = { x: number; y: number; z: number; angle: number; seed?: number };
type Person = SpectatorSeat & { seed: number; portrait: number };
const IDENTITIES=12;
const MAX_NEIGHBOURS = 40;
const CELL = 8;
const SHIRTS = [
  '#e3ded4','#4c7588','#527457','#ab6958','#354861','#8b7385','#8697a3',
  '#c4a77b','#4c4344','#b2c9c7','#a87960','#b3aab8','#516777','#9d9c7f',
].map(hex => new T.Color(hex));

function hash(value: number) {
  let bits = value >>> 0;
  bits = Math.imul(bits ^ (bits >>> 16), 0x85ebca6b);
  bits = Math.imul(bits ^ (bits >>> 13), 0xc2b2ae35);
  return (bits ^ (bits >>> 16)) >>> 0;
}

class CrowdAtlas {
  colour = new T.Texture();
  surface = new T.Texture();
  references = 0;
  ready = false;
  listeners = new Set<() => void>();

  constructor() {
    this.colour.colorSpace = T.SRGBColorSpace;
    for (const texture of [this.colour, this.surface]) {
      texture.anisotropy = 4;
      texture.userData.sharedSpectatorAtlas = true;
    }
    if (typeof Image === 'undefined') return;
    const load = (name: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Spectator atlas failed to load'));
      image.src = '/images/court-atlas/' + name;
    });
    Promise.all([load('seated-spectators.webp'), load('seated-spectators-surface.webp')]).then(([colour, surface]) => {
      this.colour.image = colour;
      this.surface.image = surface;
      this.colour.needsUpdate = this.surface.needsUpdate = true;
      this.ready = true;
      this.listeners.forEach(redraw => redraw());
    }).catch(() => { /* The unoccupied seats remain visible if the image request fails. */ });
  }

  release() {
    if (--this.references > 0) return;
    this.colour.dispose();
    this.surface.dispose();
    this.listeners.clear();
    if (atlas === this) atlas = undefined;
  }
}
let atlas: CrowdAtlas | undefined;

// Four measured views of each seated person share one hip anchor. Opposite
// three-quarter and profile views mirror the capture about its sagittal plane.
const facingCode = `
  mat4 crowdWorld = modelMatrix * instanceMatrix;
  vec3 eye = -transpose(mat3(viewMatrix)) * viewMatrix[3].xyz;
  vec3 toEye = eye - crowdWorld[3].xyz;
  vec2 facing = vec2(dot(toEye, normalize(crowdWorld[0].xyz)), dot(toEye, normalize(crowdWorld[2].xyz)));
  facing /= max(.00001, length(facing));
  vec2 across = vec2(facing.y, -facing.x);
  float angle = acos(clamp(-facing.y, -1., 1.));
  float row = step(.365, angle) + step(1.16, angle) + step(2.36, angle);
  float mirror = row > .5 && row < 2.5 ? (facing.x > 0. ? -1. : 1.) : (crowdStyle.y > .5 ? -1. : 1.);
  vec2 tileUV = vec2(mirror*(uv.x-.5)+.5,uv.y);
  vMapUv = (tileUV+vec2(crowdStyle.x,3.-row))/vec2(12.,4.);
  vCrowdWardrobe = wardrobe;
  vCrowdStrength = crowdStyle.w;
  vec3 viewAcross = normalize(mat3(viewMatrix * crowdWorld) * vec3(across.x,0.,across.y));
  vec3 viewUp = normalize(mat3(viewMatrix * crowdWorld) * vec3(0.,1.,0.));
  vec3 viewFront = normalize(mat3(viewMatrix * crowdWorld) * vec3(facing.x,0.,facing.y));
  vCrowdAcross = viewAcross * mirror; vCrowdUp = viewUp; vCrowdFront = viewFront;
`;

const swayCode = `
  float shoulder = smoothstep(.05,.68,position.y);
  float phase = crowdStyle.y * 6.28318;
  float breath = sin(crowdTime*(.94+.36*crowdStyle.z)+phase);
  float glance = pow(max(0.,sin(crowdTime*.23+phase)),7.) * sin(crowdTime*.58+phase*3.);
  vec3 posed = vec3(across.x*position.x,position.y,across.y*position.x);
  posed.y += shoulder * .007 * breath;
  posed.x += shoulder * (.006*breath + .027*glance);
  posed.z += shoulder * (.006*breath - .02*glance);
  if (crowdStyle.x == 4.) {
    float hands = exp(-18.*abs(position.x)-23.*abs(position.y-.48));
    float applause = smoothstep(.65,.96,sin(crowdTime*.31+phase));
    posed.y += hands * applause * .017 * sin(crowdTime*7.5+phase);
  }
  posed.xz += facing * relief;
  if (crowdHidden > .5) posed=vec3(0.);
  vec3 transformed=posed;
`;

function crowdMaterial(resources: CrowdAtlas, clock: { value: number }, close: boolean, shadows: boolean) {
  const material = shadows
    ? new T.MeshDepthMaterial({ map: resources.colour, alphaTest: .34, depthPacking: T.RGBADepthPacking, side: T.DoubleSide })
    : new T.MeshLambertMaterial({ map: resources.colour, alphaTest: .34, side: T.DoubleSide });
  material.shadowSide = T.DoubleSide;
  material.customProgramCacheKey = () => 'seated-atlas-v2-' + Number(close) + Number(shadows);
  material.onBeforeCompile = shader => {
    shader.uniforms.crowdSurface = { value: resources.surface };
    shader.uniforms.crowdTime = clock;
    const varying = `
      uniform sampler2D crowdSurface;
      varying vec3 vCrowdAcross, vCrowdUp, vCrowdFront, vCrowdWardrobe;
      varying float vCrowdStrength;
    `;
    shader.vertexShader = varying + `
      uniform float crowdTime;
      attribute vec4 crowdStyle;
      attribute vec3 wardrobe;
      attribute float crowdHidden;
    ` + shader.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n' + facingCode)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n objectNormal = vec3(facing.x,.35,facing.y);')
      .replace('#include <begin_vertex>', (close
        ? 'float relief = texture2D(crowdSurface,vMapUv).r*.91-.24;'
        : 'float relief = mix(.03,.22,1.-uv.y)*(-facing.y);') + swayCode);
    if (shadows) return;
    shader.fragmentShader = varying + shader.fragmentShader
      .replace('#include <map_fragment>', `
        #include <map_fragment>
        vec4 crowdData = texture2D(crowdSurface,vMapUv);
        float clothLight = dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        float heightOnTile = fract(vMapUv.y*4.);
        vec3 dye = heightOnTile > .82 ? mix(vCrowdWardrobe.bgr,vec3(.11),.18) : vCrowdWardrobe;
        if(heightOnTile < .395) dye = mix(vec3(.075,.11,.16),vCrowdWardrobe.brg,.37);
        diffuseColor.rgb = mix(diffuseColor.rgb, dye*(.14+1.27*clothLight), crowdData.g*vCrowdStrength);
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        vec2 slope = (crowdData.ba*2.-1.)*.76;
        normal = normalize(vCrowdAcross*slope.x + vCrowdUp*(slope.y+.23) + vCrowdFront*sqrt(max(.025,1.-dot(slope,slope))));
      `);
  };
  return material;
}

type Layer = ReturnType<typeof createLayer>;
function createLayer(capacity: number, close: boolean, resources: CrowdAtlas, clock: { value: number }) {
  const shape = new T.PlaneGeometry(1.05, 1.4, close ? 20 : 1, close ? 26 : 1);
  shape.translate(0,.22,0);
  const style = new T.InstancedBufferAttribute(new Float32Array(capacity * 4),4);
  const wardrobe = new T.InstancedBufferAttribute(new Float32Array(capacity * 3),3);
  const hidden = new T.InstancedBufferAttribute(new Float32Array(capacity),1);
  shape.setAttribute('crowdStyle',style);
  shape.setAttribute('wardrobe',wardrobe);
  shape.setAttribute('crowdHidden',hidden);
  const material = crowdMaterial(resources,clock,close,false);
  const mesh = new T.InstancedMesh(shape,material,capacity);
  const depth = crowdMaterial(resources,clock,close,true);
  mesh.customDepthMaterial = depth;
  material.addEventListener('dispose', () => depth.dispose());
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = close ? 'seated-neighbours' : 'seated-spectators';
  return { mesh, style, wardrobe, hidden };
}

const transform = new T.Object3D();
function writePerson(layer: Layer, person: Person, index: number) {
  const bits = person.seed;
  transform.position.set(person.x,person.y,person.z);
  transform.rotation.y = person.angle + (((bits>>>18)%23)-11)*.012;
  const height = .91+((bits>>>9)%23)*.008;
  transform.scale.set(height*(.94+((bits>>>15)%14)*.01),height,height);
  transform.updateMatrix();
  layer.mesh.setMatrixAt(index,transform.matrix);
  const kit = hash(bits^0x6e249);
  const colour = SHIRTS[(kit>>>8)%SHIRTS.length];
  layer.wardrobe.setXYZ(index,colour.r,colour.g,colour.b);
  layer.style.setXYZW(index,person.portrait,(bits%1031)/1031,((kit>>>20)%997)/997,kit%9===0 ? .04 : .62+((bits>>>7)%35)/100);
}

class SeatedAudience extends T.Group {
  readonly resources = atlas ?? (atlas = new CrowdAtlas());
  private readonly clock = { value: 0 };
  private readonly people: Person[];
  private readonly distant: Layer;
  private readonly close: Layer;
  private readonly cells = new Map<string, number[]>();
  private readonly lastEye = new T.Vector3(Infinity,Infinity,Infinity);
  private readonly eye = new T.Vector3();
  private readonly hiddenSeats: number[] = [];

  constructor(seats: SpectatorSeat[], occupancy: number) {
    super();
    this.people = [];
    this.userData.seatedAudience = true;
    this.resources.references++;
    const neighbours = new Map<string,Person[]>();
    for (const seat of seats) {
      const seed = hash(seat.seed ?? (Math.imul(Math.round(seat.x*97),73856093)^Math.imul(Math.round(seat.z*79),19349663)^Math.round(seat.y*337)));
      if (seed % 1000 >= occupancy*1000) continue;
      const key = Math.floor(seat.x/CELL)+','+Math.floor(seat.z/CELL);
      const group = this.cells.get(key) ?? [];
      group.push(this.people.length);
      this.cells.set(key,group);
      const gx=Math.floor(seat.x), gz=Math.floor(seat.z), sameFaces=Array<number>(IDENTITIES).fill(0);
      // Distribute photographic identities across the nearest rows.
      for(let ix=gx-1;ix<=gx+1;ix++) for(let iz=gz-1;iz<=gz+1;iz++){
        for(const other of neighbours.get(ix+','+iz) ?? []){
          const distance=(other.x-seat.x)**2+(other.z-seat.z)**2+(other.y-seat.y)**2;
          if(distance<2.1) sameFaces[other.portrait]+=1/(.1+distance);
        }
      }
      const start=hash(seed^0x6e249)%IDENTITIES;
      let portrait=start;
      for(let i=1;i<IDENTITIES;i++){const id=(start+i)%IDENTITIES;if(sameFaces[id]<sameFaces[portrait])portrait=id;}
      const person={...seat,seed,portrait}, bin=neighbours.get(gx+','+gz)??[];
      bin.push(person);neighbours.set(gx+','+gz,bin);
      this.people.push(person);
    }
    this.distant = createLayer(this.people.length,false,this.resources,this.clock);
    this.close = createLayer(Math.min(MAX_NEIGHBOURS,this.people.length),true,this.resources,this.clock);
    this.close.mesh.count = 0;
    this.close.mesh.visible = false;
    this.close.mesh.frustumCulled = false;
    this.people.forEach((person,i) => writePerson(this.distant,person,i));
    this.distant.mesh.material.addEventListener('dispose', () => this.resources.release());
    this.add(this.distant.mesh,this.close.mesh);
  }

  update(camera: T.Camera, delta: number, moving: boolean) {
    for (let p:T.Object3D|null=this; p; p=p.parent) if (!p.visible) return;
    if (moving) this.clock.value += Math.min(delta,.06);
    this.worldToLocal(this.eye.setFromMatrixPosition(camera.matrixWorld));
    if (this.eye.distanceToSquared(this.lastEye) < .0225) return;
    this.lastEye.copy(this.eye);
    const candidates: { index: number; distance: number }[] = [];
    const { x,y,z } = this.eye;
    const nearHidden: number[] = [];
    for (let ix=Math.floor((x-9)/CELL);ix<=Math.floor((x+9)/CELL);ix++) {
      for (let iz=Math.floor((z-9)/CELL);iz<=Math.floor((z+9)/CELL);iz++) {
        for (const index of this.cells.get(ix+','+iz) ?? []) {
          const p = this.people[index];
          const dx=p.x-x,dz=p.z-z,dy=p.y+.54-y, horizontal=dx*dx+dz*dz;
          const distance=horizontal+dy*dy;
          if (horizontal < .24 && Math.abs(dy)<.75) nearHidden.push(index);
          else if (distance<81) candidates.push({index,distance});
        }
      }
    }
    if (!candidates.length && !this.hiddenSeats.length && !nearHidden.length) return;
    candidates.sort((a,b) => a.distance-b.distance);
    for (const index of this.hiddenSeats) this.distant.hidden.setX(index,0);
    this.hiddenSeats.length = 0;
    const count = Math.min(MAX_NEIGHBOURS,candidates.length);
    for (let i=0;i<count;i++) {
      const index = candidates[i].index;
      writePerson(this.close,this.people[index],i);
      nearHidden.push(index);
    }
    for (const index of nearHidden) { this.distant.hidden.setX(index,1); this.hiddenSeats.push(index); }
    this.distant.hidden.needsUpdate = true;
    this.close.style.needsUpdate = this.close.wardrobe.needsUpdate = this.close.mesh.instanceMatrix.needsUpdate = true;
    this.close.mesh.count = count;
    this.close.mesh.visible = count>0;
  }
}

export function seatedCrowd(seats: SpectatorSeat[], occupancy = .49) {
  return new SeatedAudience(seats,occupancy);
}

/** Bind once when the arena models mount. The per-frame update queries nearby grid cells only. */
export function bindSpectators(root: T.Object3D, invalidate: () => void) {
  const crowds: SeatedAudience[] = [];
  root.traverse(obj => { if (obj.userData.seatedAudience) crowds.push(obj as SeatedAudience); });
  for(const {resources} of crowds) if(!resources.ready) resources.listeners.add(invalidate);
  return (camera: T.Camera, delta: number, moving: boolean) => {
    const animate = moving && (typeof document === 'undefined' || !document.hidden);
    for (const crowd of crowds) crowd.update(camera,delta,animate);
  };
}
