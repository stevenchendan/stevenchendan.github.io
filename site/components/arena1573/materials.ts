import * as T from 'three';

/** Subtle, seamless material detail at a consistent world-space scale. */
export function pavingMaterial(color:string,geometry:T.BufferGeometry,kind:'paving'|'asphalt'|'lawn'='paving'){
  const material=new T.MeshStandardMaterial({color,roughness:kind==='paving'?.94:1});
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle=kind==='lawn'?'#d4dfcf':kind==='asphalt'?'#c5cac7':'#d6d5cb';
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
  for(let i=0;i<10500;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%256;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%256;
    ctx.fillStyle=kind==='lawn'?(i%2?'#a5b99e':'#edf0df'):kind==='asphalt'?(i%2?'#969f9e':'#e3e4dd'):(i%2?'#b8b8ad':'#efede4');
    ctx.globalAlpha=.13;ctx.fillRect(x,y,1,1);
  }
  ctx.globalAlpha=1;
  if(kind==='paving'){
    ctx.strokeStyle='#aeb0a7';ctx.lineWidth=1;
    ctx.beginPath();
    for(let y=0;y<=256;y+=64){ctx.moveTo(0,y);ctx.lineTo(256,y);}
    for(let row=0;row<4;row++)for(let x=(row%2)*64;x<=256;x+=128){ctx.moveTo(x,row*64);ctx.lineTo(x,(row+1)*64);}
    ctx.stroke();
  }
  const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  texture.minFilter=T.LinearMipmapLinearFilter;
  const position=geometry.getAttribute('position'),uv=new Float32Array(position.count*2);
  const tileSize=kind==='lawn'?16:4;
  for(let i=0;i<position.count;i++){uv[i*2]=position.getX(i)/tileSize;uv[i*2+1]=position.getZ(i)/tileSize;}
  geometry.setAttribute('uv',new T.BufferAttribute(uv,2));material.map=texture;
  return material;
}

/** Original procedural paving: metre-scaled UVs, no reference imagery reused. */
export function precinctMaterial(color:string,geometry:T.BufferGeometry){
  const material=new T.MeshStandardMaterial({color,roughness:.83});
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
