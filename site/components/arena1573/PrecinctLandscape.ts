import * as T from 'three';
import { eventStructures, footprintRing } from './eventWorlds';
import { pointInRing } from './precinctGeometry';
import { buildCentralTerrace, terraceHeight, type TerracePlan } from './CentralTerrace';

// The orthophoto is pre-warped into the local court grid at 50 cm per pixel.
// Pixel alpha masks the post-2020 works, roofs and independently modelled courts.
// Each road, path and lawn receives the same world-space image coordinates.
export function addGroundPhotography(root:T.Group, invalidate:()=>void) {
  let disposed=false;
  const ready={value:0};
  const texture=new T.TextureLoader().load('/images/court-atlas/melbourne-ground.webp',()=>{
    if(disposed)return;
    ready.value=1;invalidate();
  });
  texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  const farReady={value:0};
  const parkland=new T.TextureLoader().load('/images/court-atlas/melbourne-parkland.webp',()=>{
    if(!disposed){farReady.value=1;invalidate();}
  });
  parkland.colorSpace=T.SRGBColorSpace;parkland.anisotropy=4;
  const stadiumTextures=new Map<string,T.Texture>();
  root.traverse(o=>{
    if(o instanceof T.Mesh && /^ortho-(mcg|aami)$/.test(o.name)){
      const id=o.name.slice(6), mcg=id==='mcg';
      const box=mcg?[380,-326,334,306]:[548,280,210,215];
      let map=stadiumTextures.get(id);
      if(!map){
        map=new T.TextureLoader().load('/images/court-atlas/'+id+'-aerial.webp',()=>{if(!disposed)invalidate();});
        map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;stadiumTextures.set(id,map);
      }
      const p=o.geometry.attributes.position,uv=new Float32Array(p.count*2);
      for(let i=0;i<p.count;i++){uv[i*2]=(p.getX(i)-box[0])/box[2];uv[i*2+1]=1-(p.getZ(i)-box[1])/box[3];}
      o.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
      o.material.color.set('#ffffff');o.material.map=map;o.material.needsUpdate=true;
      return;
    }
    if(!(o instanceof T.Mesh)||!o.name.startsWith('ground-')||!(o.material instanceof T.MeshStandardMaterial))return;
    const material=o.material, previous=material.onBeforeCompile, key=material.customProgramCacheKey();
    // Preserve fine joint lines and stone grain close to the pedestrian.
    const base=['ground-#758268','ground-#829078','ground-water'].includes(o.name);
    const contribution=base?1:o.name==='ground-#b8bcb8'?.89:o.name==='ground-#eef0e7'?0:.30;
    if(!contribution)return;
    material.onBeforeCompile=function(shader,renderer){
      previous.call(this,shader,renderer);
      shader.uniforms.orthoAtlas={value:texture};shader.uniforms.orthoReady=ready;
      shader.uniforms.parklandAtlas={value:parkland};shader.uniforms.parklandReady=farReady;
      shader.vertexShader='varying vec2 orthoPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n orthoPosition=position.xz;');
      shader.fragmentShader='varying vec2 orthoPosition; uniform sampler2D orthoAtlas,parklandAtlas; uniform float orthoReady,parklandReady;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
        #include <map_fragment>
        vec2 uvGround=(orthoPosition+vec2(540.,520.))/vec2(1600.,1016.);
        vec4 photo=texture2D(orthoAtlas,vec2(uvGround.x,1.-uvGround.y));
        vec2 borders=min(uvGround,1.-uvGround);
        float fade=smoothstep(0.,.035,min(borders.x,borders.y));
        vec2 geographic=mat2(.989935,.141523,-.141523,.989935)*orthoPosition;
        vec2 farUV=(geographic*vec2(1.,1.00705)+vec2(1700.,1200.))/vec2(3600.,2400.);
        vec2 farBorder=min(farUV,1.-farUV);
        vec4 farSample=texture2D(parklandAtlas,vec2(farUV.x,1.-farUV.y));
        float farFade=parklandReady*(1.-fade)*smoothstep(0.,.08,min(farBorder.x,farBorder.y));
        diffuseColor.rgb=mix(diffuseColor.rgb,farSample.rgb*1.12,farSample.a*farFade);
        float distanceBlend=smoothstep(6.,75.,distance(cameraPosition.xz,orthoPosition)+cameraPosition.y*.55);
        // Kia's Central Terrace is one continuous stone surface. Its mapped
        // pedestrian paths use that same finish through the plaza.
        vec2 centralEdge=min(orthoPosition-vec2(217.,17.),vec2(407.,147.)-orthoPosition);
        float terrace=smoothstep(-2.,7.,min(centralEdge.x,centralEdge.y));
        float coverage=mix(${contribution.toFixed(2)}*mix(${base?'.71':'.25'},1.,distanceBlend),.965,terrace);
        diffuseColor.rgb=mix(diffuseColor.rgb,photo.rgb*mix(1.25,1.05,terrace),orthoReady*fade*photo.a*coverage);
        ${['ground-#b8bcb8','ground-#c8cac4'].includes(o.name)?`
        // Resolve individual stone setts at walking height, where the half-
        // metre aerial texels can no longer describe the bond and joints.
        vec2 stone=mat2(.915,-.404,.404,.915)*orthoPosition;
        stone/=vec2(.72,.49);stone.x+=.5*mod(floor(stone.y),2.);
        vec2 index=floor(stone);
        float seed=fract(sin(dot(index,vec2(127.1,311.7)))*43758.55);
        float drift=.5+.5*sin(orthoPosition.x*.095+orthoPosition.y*.16);
        vec3 setts=mix(vec3(.058,.067,.072),vec3(.116,.126,.128),seed);
        setts=mix(setts,vec3(.28,.30,.295),1.-step(.10+.09*drift,seed));
        setts=mix(setts,vec3(.49,.50,.46),1.-step(.03+.038*drift,seed));
        vec2 widths=max(fwidth(stone),vec2(.001)),joint=min(fract(stone),1.-fract(stone));
        float grout=max(1.-smoothstep(.004,.012+widths.x*.5,joint.x),1.-smoothstep(.004,.012+widths.y*.5,joint.y));
        setts*=1.-grout*.19;
        float nearStone=1.-smoothstep(32.,105.,length(vec3(cameraPosition.x-orthoPosition.x,cameraPosition.y,cameraPosition.z-orthoPosition.y)));
        diffuseColor.rgb=mix(diffuseColor.rgb,setts,terrace*photo.a*nearStone*orthoReady);`:''}`);
    };
    material.customProgramCacheKey=()=>key+'-melbourne-ground-'+contribution;
    material.needsUpdate=true;
  });
  return ()=>{disposed=true;texture.dispose();parkland.dispose();};
}

/** Trunk, side silhouette and overhead crown share an atlas. The gently domed
 * top keeps foliage readable looking straight down or across the riverbanks. */
function treeShape(style:number) {
  const positions:number[]=[],uv:number[]=[],normals:number[]=[];
  const add=(x:number,y:number,z:number,u:number,v:number,upper:boolean)=>{
    positions.push(x,y,z);
    uv.push((style+u)/3,(upper?0:.5)+v*.5);
    const len=Math.hypot(x*.4,1,z*.4);normals.push(x*.4/len,1/len,z*.4/len);
  };
  for(let k=0;k<2;k++){
    const a=k*Math.PI/2,c=Math.cos(a),s=Math.sin(a);
    for(const [u,v] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]])add((u*2-1)*c,v*2.65,(u*2-1)*s,u,v,false);
  }
  for(let k=0;k<16;k++){
    const start=k*Math.PI/8, end=(k+1)*Math.PI/8;
    const vertex=(angle:number,r:number,y:number)=>{
      const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
      add(x,y,z,.5+x*.49,.5-z*.49,true);
    };
    vertex(0,0,2.58);vertex(end,.58,2.39);vertex(start,.58,2.39);
    vertex(start,.58,2.39);vertex(end,.58,2.39);vertex(end,1,1.75);
    vertex(start,.58,2.39);vertex(end,1,1.75);vertex(start,1,1.75);
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  return g;
}

export function addParkTrees(root:T.Group,invalidate:()=>void){
  const controller=new AbortController();
  const forest=new T.Group();forest.name='park-trees';root.add(forest);
  let terrace:T.Group|undefined;
  fetch('/data/central-terrace.json',{signal:controller.signal}).then(r=>{
    if(!r.ok)throw new Error('Terrace unavailable');return r.json() as Promise<TerracePlan>;
  }).then(plan=>{
    if(controller.signal.aborted)return;
    terrace=buildCentralTerrace(plan);terrace.visible=forest.visible;root.add(terrace);invalidate();
  }).catch(()=>{/* The ground plan includes the same paving and planting. */});
  const tex=new T.TextureLoader().load('/images/court-atlas/park-canopies.webp',()=>{if(!controller.signal.aborted)invalidate();});
  tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
  const mat=new T.MeshLambertMaterial({map:tex,alphaTest:.38,side:T.DoubleSide});
  fetch('/data/precinct-canopy.json',{signal:controller.signal}).then(r=>{
    if(!r.ok)throw new Error('Canopy unavailable');return r.json() as Promise<[number,number,number,number?][]>;
  }).then(rows=>{
    if(controller.signal.aborted)return;
    const groups:[number,number,number,number?][][]=[[],[],[]];
    const occupied=eventStructures.map(s=>footprintRing({...s,width:s.width+4,depth:s.depth+4}));
    for(const p of rows)if(!occupied.some(ring=>pointInRing([p[0],p[1]],ring)))groups[Math.abs(Math.round(p[0]*57+p[1]*23))%3].push(p);
    const dummy=new T.Object3D(),color=new T.Color();
    groups.forEach((points,style)=>{
      const mesh=new T.InstancedMesh(treeShape(style),mat,points.length);
      points.forEach(([x,z,r,onBerm],i)=>{
        const seed=Math.abs(Math.sin(x*12.34+z*62.23)*9372.23)%1;
        dummy.position.set(x,onBerm?terraceHeight(x,z):-.14,z);dummy.rotation.y=seed*Math.PI*2;dummy.scale.set(r,r*(.89+seed*.24),r);dummy.updateMatrix();
        mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,color.setRGB(.85+seed*.15,.89+seed*.1,.82+seed*.15));
      });
      mesh.castShadow=true;mesh.receiveShadow=true;forest.add(mesh);
    });invalidate();
  }).catch(()=>{ /* The underlying aerial canopy remains visible. */ });
  return ()=>{
    controller.abort();root.remove(forest);
    forest.children.forEach(o=>{const m=o as T.InstancedMesh;m.geometry.dispose();m.dispose();});mat.dispose();tex.dispose();
    if(terrace){
      root.remove(terrace);terrace.children.forEach(o=>{const m=o as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;m.geometry.dispose();m.material.map?.dispose();m.material.dispose();});
    }
  };
}
