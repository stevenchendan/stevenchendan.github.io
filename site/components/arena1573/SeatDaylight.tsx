import { useEffect, useMemo, useState } from 'react';
import type { Language } from './i18n';
import { clockTime, daysInMonth, summerSun, type SolarDate } from './solar';
import { loadSeatSun, sectionCentreSun, sectionSun, type SeatSunAtlas } from './seatSun';
import type { SectionId, SeatingVenue } from './seating';
import Icon from './Icon';
import styles from './seating.module.css';

export const firstMinute = 300;
export const lastMinute = 1320;
export const sunlightPlaybackSpeed = 4;
export const openingDay: SolarDate = { year: 2027, month: 1, day: 17, minutes: 14 * 60 };

export function readSeatDate(query: URLSearchParams): SolarDate {
  const date = { ...openingDay };
  const match = /^(\d{4})-(01|02)-(\d{2})$/.exec(query.get('date') ?? '');
  if (match) {
    const year = Number(match[1]), month = Number(match[2]) as 1 | 2, day = Number(match[3]);
    if (year >= 2000 && year <= 2100 && day >= 1 && day <= daysInMonth(year, month)) Object.assign(date, { year, month, day });
  }
  const time = /^(\d{2}):([0-5]\d)$/.exec(query.get('time') ?? '');
  if (time) {
    const minutes = Number(time[1]) * 60 + Number(time[2]);
    if (minutes >= firstMinute && minutes <= lastMinute) date.minutes = minutes;
  }
  return date;
}

export type Study = {
  atlas: SeatSunAtlas | null;
  failed: boolean;
  retry: () => void;
  date: SolarDate;
  closed: boolean;
  playing: boolean;
  setDate: (date: SolarDate) => void;
  setClosed: (closed: boolean) => void;
  toggle: () => void;
};

export function useSeatDaylight(active: boolean) {
  const [atlas, setAtlas] = useState<SeatSunAtlas | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active || atlas) return;
    let current = true;
    setFailed(false);
    loadSeatSun().then(value => { if (current) setAtlas(value); }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [active, atlas, attempt]);
  return { atlas, failed, retry: () => setAttempt(old => old + 1) };
}

export type Exposure = 'sun' | 'mixed' | 'shade' | 'dark' | 'pending';
export const exposureNames = {
  en: { sun: 'Direct sun', mixed: 'Part sun', shade: 'Shade', dark: 'After dark', pending: 'Calculating shade…' },
  zh: { sun: '阳光直射', mixed: '部分日晒', shade: '阴影', dark: '夜间', pending: '正在计算遮阴…' },
};
export function bayExposure(count: number | null, above: boolean, closed: boolean): Exposure {
  if (!above) return 'dark';
  if (closed) return 'shade';
  if (count === null) return 'pending';
  return count === 0 ? 'shade' : count === 9 ? 'sun' : 'mixed';
}
const palette: Record<Exposure, string> = { sun: '#efbb56', mixed: '#d0c99f', shade: '#80a6b8', dark: '#445a72', pending: '#c3cacc' };

type Props = { language: Language; study: Study; transitioning?: boolean } & (
  { compact?: false; venue: SeatingVenue; id: SectionId } |
  { compact: true; venue?: SeatingVenue; id?: SectionId; active: boolean; activate: () => void }
);

export default function SeatDaylight(props: Props) {
  const { language, venue, id, study, compact, transitioning } = props;
  const { date, closed, playing, atlas } = study;
  const zh = language === 'zh';
  const { year, month, day, minutes } = date;
  const sun = summerSun(date);
  const selected = venue !== undefined && id !== undefined;
  const count = atlas && selected ? sectionSun(atlas, venue, id, sun, closed) : null;
  const label = exposureNames[language];
  const state = bayExposure(count, sun.aboveHorizon, closed);
  const centre = atlas && selected && sectionCentreSun(atlas, venue, id, sun, closed);
  const times = useMemo(() => {
    const samples: { at: number; state: Exposure }[] = [];
    for (let at = firstMinute; at <= lastMinute; at += 15) {
      const sky = summerSun({ year, month, day, minutes: at });
      const light = selected ? bayExposure(atlas ? sectionSun(atlas, venue, id, sky, closed) : null, sky.aboveHorizon, closed)
        : sky.aboveHorizon ? (sky.elevation < 12 ? 'mixed' : 'sun') : 'dark';
      samples.push({ at, state: light });
    }
    return samples;
  }, [year, month, day, closed, atlas, venue, id, selected]);
  const track = useMemo(() => {
    return 'linear-gradient(90deg,' + times.map(({ state, at }) => {
      const start = (at - firstMinute) / (lastMinute - firstMinute) * 100;
      const end = Math.min(100, start + 100 / (times.length - 1));
      return palette[state] + ' ' + start + '% ' + end + '%';
    }).join(',') + ')';
  }, [times]);
  let status: string = label[state];
  if (study.failed && state === 'pending') status = zh ? '日照数据暂不可用' : 'Shade data unavailable';
  if (sun.aboveHorizon && closed) status = zh ? '闭顶遮阴' : 'Sheltered by the roof';
  const dateValue = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  const name = zh ? id + ' 区' : 'Section ' + id;
  const summer = zh ? '夏日日照' : 'Summer sun';
  const regionName = selected ? (zh ? '座区日照' : 'Section sunlight') : summer;
  const sectionStatus = transitioning ? (zh ? '屋顶移动中' : 'Roof moving') : status;
  return <section className={styles.daylight} data-compact={compact || undefined} data-active={props.compact && props.active || undefined} aria-label={regionName}>
    {props.compact ? <div className={styles.clockHeader}>
      <button type="button" className={styles.clockMode} onClick={props.activate} aria-pressed={props.active} aria-label={summer}>
        <Icon name="day"/><span><b>{summer}</b><small>{zh ? '墨尔本 · AEDT' : 'Melbourne · AEDT'}</small></span>
      </button>
      <input type="time" aria-label={zh ? '墨尔本当地时间' : 'Melbourne local time'} min="05:00" max="22:00" value={clockTime(minutes)}
        onChange={e=>{if(!e.target.value)return;const [h,m]=e.target.value.split(':').map(Number);study.setDate({...date,minutes:Math.max(firstMinute,Math.min(lastMinute,h*60+m))});}}/>
    </div> : <div className={styles.dayHeading}><div>
      <span className={styles.dayOverline}>{zh ? '墨尔本时间 · AEDT' : 'Melbourne time · AEDT'}</span>
      <strong>{clockTime(minutes)}</strong>
    </div><div className={styles.daySummary} data-exposure={state}>
      <span>{name}</span><b>{sectionStatus}</b>
    </div></div>}
    <div className={styles.transport}>
      <button type="button" onClick={study.toggle} aria-pressed={playing} aria-label={playing ? (zh ? '暂停日照演示' : 'Pause sunlight playback') : (zh ? '播放一日光影' : 'Play sunlight through the day')}
        title={(playing ? (zh ? '暂停' : 'Pause') : (zh ? '播放一日光影' : 'Play through the day'))+' · '+sunlightPlaybackSpeed+'×'}><Icon name={playing ? 'pause' : 'play'} /></button>
      <div><input type="range" min={firstMinute} max={lastMinute} step={playing?'any':1} value={minutes}
        aria-label={selected ? (zh ? '座区日照时间' : 'Section sunlight time') : (zh ? '日照时间' : 'Sunlight time')} aria-valuetext={clockTime(minutes) + ' AEDT'}
        style={{ backgroundImage: track }} onChange={e => study.setDate({ ...date, minutes: Number(e.target.value) })} />
        <div className={styles.tickRow}><span>05:00</span><span>12:00</span><span>17:00</span><span>22:00</span></div>
      </div>
    </div>
    {compact && selected && <div className={styles.quickExposure} data-exposure={state}><span>{name}</span><b>{sectionStatus}</b></div>}
    {!compact && <details className={styles.sunOptions}>
      <summary>{zh?'日期、屋顶与采样结果':'Date, roof & seat samples'}</summary>
      <div className={styles.dayFilters}>
        <label>{zh ? '日期' : 'Date'}<input type="date" aria-label={zh ? '日期' : 'Date'} value={dateValue} min={year + '-01-01'} max={year + '-02-' + daysInMonth(year, 2)} onChange={e => {
          if (!e.target.value || !e.target.validity.valid) return;
          const [, m, d] = e.target.value.split('-').map(Number);
          study.setDate({ ...date, month: m as 1 | 2, day: d });
        }} /></label>
        <label>{zh ? '屋顶' : 'Roof'}<select aria-label={zh ? '屋顶' : 'Roof'} value={closed ? 'closed' : 'open'} onChange={e => study.setClosed(e.target.value === 'closed')}>
          <option value="open">{zh ? '打开' : 'Open'}</option><option value="closed">{zh ? '关闭' : 'Closed'}</option>
        </select></label>
      </div>
      {count !== null && sun.aboveHorizon && !closed && <p className={styles.sampleSummary}>{zh
        ? `9 个前中后排采样座位中，${count} 个受直射。模拟视角位于${centre ? '阳光下' : '阴影中'}。`
        : `${count} of 9 seats sampled across the rows receive direct sun. The 3D viewpoint is in ${centre ? 'sun' : 'shade'}.`}</p>}
    </details>}
    {study.failed && selected && <button className={styles.retry} onClick={study.retry}>{zh ? '重新加载日照数据' : 'Reload shade data'}</button>}
  </section>;
}
