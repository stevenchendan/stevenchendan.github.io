import {useMemo} from 'react';
import type {ContextData} from './model';
import {destinations} from './views';
import {eventWorlds} from './eventWorlds';
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
  // Labels sit away from the points where venues share a concourse.
  const marks:[string,string,number,number,number][]=[
    ['hilltop',language==='zh'?'山顶':'Hilltop',-415,-316,108],
    ['ballpark','Ballpark',-355,-100,132],['topcourt','TOPCOURT',-205,-287,155],
    ['west',language==='zh'?'西场':'West courts',-24,-290,165],
    ['courtside',language==='zh'?'场边酒吧':'Courtside Bar',148,-211,187],
    ['garden',language==='zh'?'花园广场':'Garden Square',184,-133,211],
    ['1573','1573',-53,34,77],['mca','MCA',45,119,78],['rla','RLA',148,189,76],
    ['terrace',language==='zh'?'露台':'Terrace',248,-5,108],['kia','Kia',343,27,68],
    ['village',language==='zh'?'训练村':'The Village',462,-59,149],
    ['john','JCA',507,234,75],['oval',language==='zh'?'大满贯广场':'Grand Slam Oval',302,281,223],['east',tr('东侧球场'),736,150,205],
  ];
  const zoneColors=['#b7d7cd','#e2b4a3','#d9d897','#a8c298','#c4b5d4','#e7c392','#dcb885','#c8bdab'];
  return <div className={styles.groundsMap}>
    <svg viewBox="-496 -349 1395 670" aria-label={tr('园区平面图')} role="group">
      <rect x="-496" y="-349" width="1395" height="670" fill="#e9ece1"/>
      <path d={paths.lawns} fill="#d1ddc6"/>
      {Object.values(eventWorlds).map((world,i)=><polygon key={world.name} points={world.ring.map(p=>p.join(',')).join(' ')} fill={zoneColors[i]} stroke="#fafbec" strokeWidth="2"/>)}
      <path d={paths.walks} fill="none" stroke="#fcfbef" strokeWidth="5" strokeLinejoin="round"/>
      <path d={paths.rails} fill="none" stroke="#aeb9b5" strokeWidth="2"/>
      <path d={paths.buildings} fill="#c1ccca" fillRule="nonzero" stroke="#a8b8b8" strokeWidth="1.2"/>
      <path d={paths.courts} fill="#71a9bb" stroke="#f0f3e6" strokeWidth="2"/>
      {marks.map(([id,label,lx,lz,width])=>{
        const d=destinations.find(v=>v.id===id)!;
        const [x,,z]=d.target;
        return <g key={id} className={styles.groundMarker} data-selected={selected===id} role="button" tabIndex={0} aria-label={tr(d.name)} onClick={()=>onSelect(id)}
          onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(id);}}}>
          <path d={`M${x} ${z}L${lx} ${lz}`} stroke="#29484b" strokeWidth="2.7"/>
          <circle cx={x} cy={z} r="5" fill="#284849"/>
          <rect x={lx-width/2} y={lz-20} rx="8" width={width} height="40"/>
          <text x={lx} y={lz+8} textAnchor="middle">{label}</text>
        </g>;
      })}
    </svg>
    <small>{language==='en'?'AO26 event areas · approximate positions':'2026 澳网活动区域 · 位置示意'} · © OpenStreetMap · City of Melbourne</small>
  </div>;
}
