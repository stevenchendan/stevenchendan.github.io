import * as T from 'three';

/** Local ambient occlusion underneath the soles. The directional light can be
 * hundreds of metres away on the outer courts. Airborne feet cast a softer patch. */
export function playerContactShadows(group:T.Group,body:T.Object3D){
  const geometry=new T.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
  const shadow=(side:string)=>{
    const heel=body.getObjectByName(side+'Foot')!,toe=body.getObjectByName(side+'ToeBase')!;
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{strength:{value:.28}},
      vertexShader:'varying vec2 tex; void main(){tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform float strength;varying vec2 tex;
        void main(){
          vec2 p=tex*2.-1.;float opacity=pow(max(0.,1.-dot(p,p)),2.)*strength;
          gl_FragColor=vec4(.035,.052,.06,opacity);
          #include <colorspace_fragment>
        }`});
    const mesh=new T.Mesh(geometry,material);mesh.name=side+' shoe contact';mesh.renderOrder=1;group.add(mesh);
    return {heel,toe,mesh,material};
  };
  const feet=[shadow('Left'),shadow('Right')],a=new T.Vector3(),b=new T.Vector3(),inv=new T.Matrix4();
  function update(x:number,z:number,yaw:number){
    inv.copy(group.matrixWorld).invert();
    const c=Math.cos(yaw),s=Math.sin(yaw);
    for(const {heel,toe,mesh,material} of feet){
      heel.getWorldPosition(a).applyMatrix4(inv);toe.getWorldPosition(b).applyMatrix4(inv);
      const angle=Math.atan2(b.x-a.x,b.z-a.z),lift=Math.max(0,Math.min(a.y-.06,b.y));
      a.lerp(b,.48);const onCourt=Math.abs(x+a.x*c+a.z*s)<=5.51&&Math.abs(z-a.x*s+a.z*c)<=11.93;
      mesh.position.set(a.x,onCourt?.0218:.0018,a.z);mesh.rotation.y=angle;
      mesh.scale.set(.185+lift*.28,1,.354+lift*.35);
      material.uniforms.strength.value=.33*Math.exp(-6.5*lift);
    }
  }
  return {update,dispose(){geometry.dispose();feet.forEach(f=>f.material.dispose());}};
}
