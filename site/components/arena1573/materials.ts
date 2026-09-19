import * as T from 'three';

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
