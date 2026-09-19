'use client';

import { getTranslator, type Language } from './i18n';
import { clockTime, daysInMonth, summerDaylight, summerSun, type ShadeResult, type SolarDate, type Stand, STANDS } from './solar';
import styles from './arena.module.css';

export const standNames: Record<Stand,string> = {north:'北侧看台',east:'东侧看台',south:'南侧看台',west:'西侧看台'};

export default function SunControls({date,onChange,language,shade,onStand}:{date:SolarDate;onChange:(date:SolarDate)=>void;language:Language;shade:ShadeResult|null;onStand:(stand:Stand)=>void}){
  const tr=getTranslator(language),sun=summerSun(date),daylight=summerDaylight(date.year,date.month,date.day);
  return <section className={styles.sunControls} aria-label={tr('夏日日照')}>
    <div className={styles.sunDate}>
      <label><span>{tr('日期')}</span><select aria-label={tr('日期')} value={`${date.month}-${date.day}`} onChange={e=>{const [month,day]=e.target.value.split('-').map(Number);onChange({...date,month:month as 1|2,day});}}>{([1,2] as const).map(month=><optgroup key={month} label={language==='zh'?`${month}月`:month===1?'January':'February'}>{Array.from({length:daysInMonth(date.year,month)},(_,i)=><option key={i} value={`${month}-${i+1}`}>{language==='zh'?`${month}月${i+1}日`:`${month===1?'Jan':'Feb'} ${i+1}`}</option>)}</optgroup>)}</select></label>
      <label><span>{tr('年份')}</span><select aria-label={tr('年份')} value={date.year} onChange={e=>{const year=Number(e.target.value);onChange({...date,year,day:Math.min(date.day,daysInMonth(year,date.month))});}}>{[2026,2027,2028,2029,2030,2031].map(year=><option key={year}>{year}</option>)}</select></label>
    </div>
    {date.year===2027&&<p className={styles.sunPosition}>{tr('AO 2027：资格赛 1月11–16日；正赛 1月17–31日。')} <a href="https://ausopen.com/sites/default/files/2026-08/ao27-provisional-schedule_final.pdf" target="_blank" rel="noreferrer">{tr('暂定赛程 ↗')}</a></p>}
    <div className={styles.sunTime}><label htmlFor="arena-sun-time">{tr('当地时间')}</label><input id="arena-sun-time" type="time" min="05:00" max="22:00" step="300" value={clockTime(date.minutes)} onChange={e=>{if(!e.target.value)return;const [h,m]=e.target.value.split(':').map(Number);onChange({...date,minutes:Math.max(300,Math.min(1320,h*60+m))});}}/></div>
    <input className={styles.sunSlider} type="range" min={300} max={1320} step={5} value={date.minutes} aria-label={tr('日照时间')} aria-valuetext={`${clockTime(date.minutes)} AEDT`} onChange={e=>onChange({...date,minutes:Number(e.target.value)})}/>
    <div className={styles.sunTicks}><span>05:00</span><span>AEDT · UTC+11</span><span>22:00</span></div>
    <div className={styles.sunFacts}><span>{tr('日出')} {clockTime(daylight.sunrise)}</span><span>{tr('日落')} {clockTime(daylight.sunset)}</span></div>
    <p className={styles.sunPosition}>{sun.aboveHorizon?`${tr('太阳高度')} ${sun.elevation.toFixed(0)}° · ${tr('方位')} ${sun.azimuth.toFixed(0)}°`:tr('太阳已在地平线以下')}</p>
    <details className={styles.shadeDetails} open>
      <summary>{tr('看台遮阴对比')}</summary>
      <p>{tr('遮阴采样点 / 每侧9点')}</p>
      {STANDS.map(stand=><button key={stand} onClick={()=>onStand(stand)} className={styles.standRow}><span>{tr(standNames[stand])}</span><span className={styles.shadeBar} aria-hidden="true"><i style={{width:sun.aboveHorizon&&shade?`${shade[stand]/9*100}%`:'0%'}}/></span><b>{!sun.aboveHorizon?'—':shade?`${shade[stand]}/9`:'…'}</b><span>↗</span></button>)}
      <small>{tr('点击看台查看视角。比较不同时段，再选择座位。')}</small>
    </details>
    <p className={styles.sunCaveat}>{tr('仅为近似建筑模型的遮阴参考，不含云层、紫外线或临时设施；不是座位遮阴保证。')}</p>
    <a className={styles.sunSource} href="https://gml.noaa.gov/grad/solcalc/solareqns.PDF" target="_blank" rel="noreferrer">{tr('太阳位置算法 · NOAA ↗')}</a>
  </section>;
}
