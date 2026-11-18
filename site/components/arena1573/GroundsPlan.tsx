import {useMemo} from 'react';
import type {ContextData} from './model';
import {destinations} from './views';
import {getTranslator,type Language} from './i18n';
import styles from './arena.module.css';

// Identical metre-grid to the 3D scene. The list below the plan provides a
// full-size alternative for venues grouped close together on a phone.
export default function GroundsPlan({data,selected,onSelect,language}:{data:ContextData;selected?:string;onSelect:(id:string)=>void;language:Language}){
  const tr=getTranslator(language);
  const paths=useMemo(()=>{
    const trace=(ring:number[][])=>'M'+ring.map(([x,z])=>Math.round(x)+' '+Math.round(z)).join('L');
    const layer=(kind:string)=>data.features.filter(f=>f.kind===kind).map(f=>trace(f.points)+(kind==='court'||kind==='green'?'Z':'')).join('');
    return {walks:layer('path'),lawns:layer('green'),courts:layer('court'),rails:layer('rail'),buildings:data.buildings.map(b=>trace(b.ring)+'Z').join('')};
  },[data]);
  const marks=[['1573','1573'],['mca','MCA'],['rla','RLA'],['kia','Kia'],['village',tr('训练村')],['john','JCA'],['east',tr('东侧球场')]] as const;
  return <div className={styles.groundsMap}>
    <svg viewBox="-105 -217 997 530" aria-label={tr('园区平面图')} role="group">
      <rect x="-105" y="-217" width="997" height="530" fill="#e9ece1"/>
      <path d={paths.lawns} fill="#d1ddc6"/>
      <path d={paths.walks} fill="none" stroke="#fcfbef" strokeWidth="5" strokeLinejoin="round"/>
      <path d={paths.rails} fill="none" stroke="#aeb9b5" strokeWidth="2"/>
      <path d={paths.buildings} fill="#c1ccca" fillRule="nonzero" stroke="#a8b8b8" strokeWidth="1.2"/>
      <path d={paths.courts} fill="#71a9bb" stroke="#f0f3e6" strokeWidth="2"/>
      {marks.map(([id,label])=>{
        const d=destinations.find(v=>v.id===id)!;
        const [x,,z]=d.target;
        const end=id==='1573'?-44:id==='mca'?69:id==='rla'?142:id==='kia'?34:id==='village'?-26:id==='john'?235:153;
        const width=id==='east'||id==='village'?180:87;
        return <g key={id} className={styles.groundMarker} data-selected={selected===id} role="button" tabIndex={0} aria-label={tr(d.name)} onClick={()=>onSelect(id)}
          onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(id);}}}>
          <path d={`M${x} ${z}V${end}`} stroke="#29484b" strokeWidth="3"/>
          <circle cx={x} cy={z} r="5" fill="#284849"/>
          <rect x={x-width/2} y={end-20} rx="8" width={width} height="40"/>
          <text x={x} y={end+8} textAnchor="middle">{label}</text>
        </g>;
      })}
    </svg>
    <small>© OpenStreetMap · City of Melbourne</small>
  </div>;
}
