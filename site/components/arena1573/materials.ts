import * as T from 'three';

// The fine aggregate of a painted acrylic court is visible at court level and
// disappears into the mipmaps when the visitor pulls back to the precinct.
export function courtMaterial(color: string, geometry: T.BufferGeometry, painted: boolean) {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 1573;
  for (let i = 0; i < pixels.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const shade = 215 + (seed >>> 27);
    pixels.set([shade, shade, shade, 255], i);
  }
  const grain = new T.DataTexture(pixels, size, size);
  grain.wrapS = grain.wrapT = T.RepeatWrapping;
  grain.generateMipmaps = true;
  grain.magFilter = T.LinearFilter;
  grain.minFilter = T.LinearMipmapLinearFilter;
  grain.anisotropy = 4;
  grain.needsUpdate = true;
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) uv.setXY(i, positions.getX(i) * 2, positions.getZ(i) * 2);
  const material=new T.MeshStandardMaterial({ color, map: grain, roughness: .94 });
  if(painted){
    // Put the paint directly into the acrylic surface. Derivatives soften
    // subpixel edges at aerial distances without a raised, shadow-casting strip.
    material.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec2 courtPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n courtPosition = position.xz;');
      shader.fragmentShader=`varying vec2 courtPosition;
        float paintStrip(float p, float centre, float width, float pixel) {
          float halfWidth = max(width, .85 * pixel) * .5;
          float overlap = min(p + pixel*.5, centre + halfWidth) - max(p - pixel*.5, centre - halfWidth);
          return clamp(overlap / pixel, 0., 1.);
        }\n`+shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        vec2 p = abs(courtPosition);
        vec2 pixel = max(fwidth(courtPosition), vec2(.0001));
        float singles = paintStrip(p.x,4.115,.05,pixel.x);
        float doubles = paintStrip(p.x,5.485-max(.05,.85*pixel.x)*.5,.05,pixel.x);
        float baseline = paintStrip(p.y,11.885-max(.065,.85*pixel.y)*.5,.065,pixel.y);
        float service = paintStrip(p.y,6.4,.05,pixel.y) * (1.-smoothstep(4.115-pixel.x*.5,4.115+pixel.x*.5,p.x));
        float centre = paintStrip(courtPosition.x,0.,.05,pixel.x);
        centre *= max(1.-smoothstep(6.4-pixel.y*.5,6.4+pixel.y*.5,p.y),smoothstep(11.72-pixel.y*.5,11.72+pixel.y*.5,p.y));
        float paint = max(max(singles,doubles),max(baseline,max(service,centre)));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.93,.94,.91), paint);
      `);
    };
  }
  return material;
}

export type GroundFinish = 'paving' | 'asphalt' | 'lawn' | 'plain';
function groundTexture(kind: GroundFinish){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle=kind==='lawn'?'#d4dfcf':kind==='asphalt'?'#dee2e0':'#d9dcda';
  ctx.fillRect(0,0,256,256);
  let seed=73;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  if(kind==='lawn'){
    for(let i=0;i<620;i++){
      const x=random()*256,y=random()*256,r=2+random()*14;
      ctx.fillStyle=random()>.5?'#b7cbb2':'#e0e8d9';
      ctx.globalAlpha=.07+random()*.09;
      ctx.beginPath();ctx.ellipse(x,y,r,r*.55,random()*Math.PI,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  if(kind==='paving'){
    // Metre-long units in a staggered bond. The half tiles at both edges
    // carry the same shade, so the repeated texture has no four-metre seam.
    for(let row=0;row<8;row++){
      const shades=Array.from({length:4},()=>Math.floor(229+random()*12));
      for(let col=-1;col<4;col++){
        const tone=shades[(col+4)%4];
        ctx.fillStyle=`rgb(${tone},${tone},${tone-2})`;
        ctx.fillRect(col*64+(row%2)*32+.45,row*32+.4,63.1,31.2);
      }
    }
  }
  for(let i=0;i<6800;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%256;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%256;
    ctx.fillStyle=kind==='lawn'?(i%2?'#a5b99e':'#edf0df'):kind==='asphalt'?(i%2?'#969f9e':'#e3e4dd'):(i%2?'#b8b8ad':'#efede4');
    ctx.globalAlpha=.13;ctx.fillRect(x,y,1,1);
  }
  ctx.globalAlpha=1;
  const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  texture.minFilter=T.LinearMipmapLinearFilter;
  return texture;
}

/** Original, seamless finishes using one shared texture per ground material. */
export function pavingMaterial(color:string,geometry:T.BufferGeometry,kind:GroundFinish='paving',shared?:T.Texture){
  const material=new T.MeshStandardMaterial({color,roughness:kind==='paving'?.92:.98});
  if(kind==='plain')return material;
  material.map=shared??groundTexture(kind);
  const position=geometry.getAttribute('position'),uv=new Float32Array(position.count*2);
  const tileSize=kind==='lawn'?16:4;
  for(let i=0;i<position.count;i++){uv[i*2]=position.getX(i)/tileSize;uv[i*2+1]=position.getZ(i)/tileSize;}
  geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
  return material;
}

/** Original procedural paving: metre-scaled UVs, no reference imagery reused. */
export function precinctMaterial(color:string,geometry:T.BufferGeometry){
  const material=new T.MeshStandardMaterial({color,roughness:.83});
  // Copper pleats pick up the directional light. A small variation between
  // neighbouring panels retains the continuous terracotta roof in the aerial.
  if(color==='#a86b49')material.color.set('#b57561');
  if(color==='#be8059')material.color.set('#bd7c68');
  const glazing=['#465a65','#344f5d','#536b78','#425b62','#344b59'].includes(color);
  const metal=['#e4e5dc','#e4e7e2','#cbd0ce','#cbd1cd','#be8059','#a86b49','#cdd4d1','#d3d7d3'].includes(color);
  if(glazing||metal){
    material.roughness=glazing?.39:.60;
    material.metalness=glazing?.11:.18;
    material.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 finishPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n finishPoint=position;');
      shader.fragmentShader='varying vec3 finishPoint;\n'+shader.fragmentShader.replace('#include <color_fragment>',glazing?`
        #include <color_fragment>
        vec2 bay=vec2((finishPoint.x+finishPoint.z)*.35,finishPoint.y*.28);
        float variation=fract(sin(dot(floor(bay),vec2(73.1,19.7)))*2845.9);
        float sky=.5+.5*sin((finishPoint.x+finishPoint.z)*.041+finishPoint.y*.37);
        diffuseColor.rgb*=.83+.24*variation;
        diffuseColor.rgb+=vec3(.028,.043,.055)*(sky*.54+.46*smoothstep(1.,15.,finishPoint.y));
      `:`
        #include <color_fragment>
        vec2 sheet=vec2(finishPoint.x/.56,finishPoint.z/10.);
        vec2 footprint=max(fwidth(sheet),vec2(.0001));
        vec2 joint=abs(fract(sheet+.5)-.5);
        vec2 seam=(1.-smoothstep(vec2(.006),vec2(.026)+footprint*.55,joint))*(1.-smoothstep(vec2(.16),vec2(.85),footprint));
        float weathering=.98+.02*sin(finishPoint.z*.19+sin(finishPoint.x*.13));
        diffuseColor.rgb*=weathering-.13*seam.x-.15*seam.y;
      `);
    };
    material.customProgramCacheKey=()=>glazing?'precinct-glazing':'precinct-standing-seams';
    return material;
  }
  if(!['#979d9b','#a3aaa8','#9da5a4','#d7d4c5'].includes(color))return material;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#d3d3d3';ctx.fillRect(0,0,256,256);
  for(let y=0;y<16;y++)for(let x=0;x<8;x++){
    const tone=219+((x*31+y*47)%7);
    ctx.fillStyle=`rgb(${tone},${tone},${tone})`;ctx.fillRect(x*32+1,y*16+1,30,14);
  }
  const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  const p=geometry.getAttribute('position'),uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)/8;uv[i*2+1]=p.getZ(i)/8;}
  geometry.setAttribute('uv',new T.BufferAttribute(uv,2));material.map=texture;
  return material;
}
