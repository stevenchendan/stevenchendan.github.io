/** Centreline, deck height and mitred outer edges in the precinct metre grid. */
export function bridgeSections(points:number[][]){
  const nodes=points.filter((p,i)=>!i||p[0]!==points[i-1][0]||p[1]!==points[i-1][1]);
  const distances=[0];
  for(let i=1;i<nodes.length;i++)distances.push(distances[i-1]+Math.hypot(nodes[i][0]-nodes[i-1][0],nodes[i][1]-nodes[i-1][1]));
  const total=distances.at(-1)??0;
  const sections=[];
  for(let i=1;i<nodes.length;i++){
    const [x,z]=nodes[i-1],dx=nodes[i][0]-x,dz=nodes[i][1]-z;
    const length=distances[i]-distances[i-1],count=Math.ceil(length/3);
    for(let j=i===1?0:1;j<=count;j++){
      const t=j/count,station=distances[i-1]+t*length;
      const u=Math.min(1,Math.min(station,total-station)/84);
      const h=.025+6.825*u*u*(3-2*u);
      let nx=dz/length,nz=-dx/length;
      if(j===count&&i<nodes.length-1){
        const next=distances[i+1]-distances[i];
        const mx=(nodes[i+1][1]-nodes[i][1])/next,mz=-(nodes[i+1][0]-nodes[i][0])/next;
        const scale=1+nx*mx+nz*mz;
        if(scale>.1){nx=(nx+mx)/scale;nz=(nz+mz)/scale;}
      }
      sections.push({x:x+t*dx,z:z+t*dz,h,nx,nz,station});
    }
  }
  return sections;
}
