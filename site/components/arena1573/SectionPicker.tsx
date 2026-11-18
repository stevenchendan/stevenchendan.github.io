'use client';

import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Language } from './i18n';
import Icon from './Icon';
import { seatSections, sectionDoors, seatingVenues, type SeatSection, type SectionId, type SeatingVenue } from './seating';
import styles from './seating.module.css';

type Props = {
  venue: SeatingVenue;
  section: SectionId | null;
  language: Language;
  onVenueChange: (venue: SeatingVenue) => void;
  onSelect: (section: SectionId) => void;
  onView: (section: SectionId) => void;
  canView?: boolean;
};

const copy = {
  en: {
    arena: 'Arena', map: 'Choose a section', compass: 'N', section: 'Section',
    plan: 'Section plan', door: 'Near door', entry: 'Player entry', sun: 'Some rows receive direct sun with the roof open.', shortView: 'View in 3D', photo: 'Photo cropped from',
    northeast: 'Northeast corner', southeast: 'Southeast corner', southwest: 'Southwest corner', northwest: 'Northwest corner',
    enlarge: 'Enlarge section map', fit: 'Fit section map',
    view: 'View from this section', offline: '3D view unavailable',
    note: 'Section layout for the 17 January 2027 day session. Choose your session on Ticketmaster for seats and prices.',
    source: 'Ticketmaster section plan', tickets: 'See sessions',
    north: 'North baseline', east: 'East sideline', south: 'South baseline', west: 'West sideline',
    courtside: 'Courtside', lower: 'Lower bowl', middle: 'Middle bowl', upper: 'Upper bowl',
  },
  zh: {
    arena: '场馆', map: '点选看台分区', compass: '北', section: '分区',
    plan: '看台平面图', door: '邻近入口', entry: '球员入口', sun: '屋顶开启时，部分座位会受到阳光直射。', shortView: '三维视角', photo: '图片裁自',
    northeast: '东北转角', southeast: '东南转角', southwest: '西南转角', northwest: '西北转角',
    enlarge: '放大分区图', fit: '查看完整分区图',
    view: '从此分区观看', offline: '三维视角暂不可用',
    note: '分区示意参考 2027 年 1 月 17 日日场。请前往 Ticketmaster 选择场次，查看座位和票价。',
    source: 'Ticketmaster 分区图', tickets: '查看场次',
    north: '北侧底线', east: '东侧边线', south: '南侧底线', west: '西侧边线',
    courtside: '场边席', lower: '下层看台', middle: '中层看台', upper: '上层看台',
  },
} as const;

const directions: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowRight: [1, 0], ArrowLeft: [-1, 0],
};

function nextSection(sections: SeatSection[], current: SeatSection, [dx, dz]: [number, number]) {
  let next: SeatSection | undefined;
  let best = Infinity;
  for (const candidate of sections) {
    const x = candidate.x - current.x;
    const z = candidate.z - current.z;
    const ahead = x * dx + z * dz;
    const cross = Math.abs(x * dz - z * dx);
    if (ahead <= .01 || cross > ahead * 1.75) continue;
    const distance = ahead + cross * 2.5;
    if (distance < best) {
      next = candidate;
      best = distance;
    }
  }
  return next;
}


type PlanPoint = { x: number; z: number };
const extent = { rla: [147, 125], mca: [153, 117], john: [138, 124] } as const;

function project(venue: SeatingVenue, point: PlanPoint): [number, number] {
  const [width, height] = extent[venue];
  return venue === 'john'
    ? [169 + width * point.x, 134 + height * point.z]
    : [169 - width * point.z, 134 + height * point.x];
}

function coordinates(points: [number, number][]) {
  return 'M' + points.map(([x, y]) => x.toFixed(1) + ' ' + y.toFixed(1)).join('L') + 'Z';
}

function location(venue: SeatingVenue, section: SeatSection) {
  const x = Math.abs(section.x), z = Math.abs(section.z);
  if (venue === 'john' || Math.min(x, z) < .68 * Math.max(x, z)) return section.side;
  if (section.z < 0) return section.x > 0 ? 'northeast' : 'northwest';
  return section.x > 0 ? 'southeast' : 'southwest';
}

const shells = {
  rla: 'M132 4H206C270 4 323 47 323 107V161C323 221 270 264 206 264H132C68 264 15 221 15 161V107C15 47 68 4 132 4Z',
  mca: 'M87 11H251L288 23L312 55L326 92V176L310 217L281 247L247 257H92L54 246L24 214L12 177V89L26 52L53 23Z',
  john: 'M111 5H224L247 33L312 59V206L250 230L223 261H111L85 234L26 207V60L83 35Z',
};

function CourtMark({ venue }: { venue: SeatingVenue }) {
  return <g transform={venue === 'john' ? 'rotate(90 169 134)' : undefined} aria-hidden="true" className={styles.court}>
    <rect x="112" y="103" width="114" height="62" rx="8" fill="#367eab" />
    <rect x="135" y="119" width="68" height="30" fill="#156798" />
    <path d="M135 119h68v30h-68z M135 123h68 M135 145h68 M151 123v22 M187 123v22 M151 134h36" />
    <path className={styles.net} d="M169 116v36"/>
    <g fill="#26485c"><rect x="149" y="159" width="10" height="2" rx="1"/><rect x="177" y="159" width="10" height="2" rx="1"/></g>
  </g>;
}

export default function SectionPicker({ venue, section, language, onSelect, onView, onVenueChange, canView = true }: Props) {
  const labels = copy[language];
  const sections = seatSections[venue];
  const selected = sections.find(s => s.id === section) ?? sections[0];
  const [selectedX, selectedY] = project(venue, selected);
  const venueId = useId();
  const sectionId = useId();
  const clipId = useId();
  const arranged = useMemo(() => sections.map(s => ({
    ...s, point: project(venue, s),
    path: s.footprints.map(points => coordinates(points.map(p => project(venue, p)))).join(' '),
  })), [sections, venue]);
  const scroller = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || !zoomed) return;
    element.scrollLeft = selectedX / 338 * element.scrollWidth - element.clientWidth / 2;
    element.scrollTop = selectedY / 268 * element.scrollHeight - element.clientHeight / 2;
  }, [zoomed, selectedX, selectedY]);
  const directionsOnPlan = (delta: [number, number]): [number, number] =>
    venue === 'john' ? delta : [delta[1], -delta[0]];

  function onMapKey(event: KeyboardEvent<SVGGElement>, current: SeatSection) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onSelect(current.id);
    }
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    const next = nextSection(sections, current, directionsOnPlan(direction));
    if (!next) return;
    event.currentTarget.ownerSVGElement?.querySelector<SVGGElement>('[data-section="' + next.id + '"]')?.focus();
    onSelect(next.id);
  }

  return <div className={styles.picker}>
    <div className={styles.identity} data-venue={venue}>
      {venue === 'rla' && <img src="/images/court-atlas/rod-laver-dusk-small.webp" alt="" width="360" height="170" />}
      <label htmlFor={venueId}>{labels.arena}</label>
      <div className={styles.venueControl}>
        <select id={venueId} value={venue} onChange={e => {
          setZoomed(false);
          onVenueChange(e.target.value as SeatingVenue);
        }}>
          {Object.entries(seatingVenues).map(([id, v]) => <option key={id} value={id}>{v.name}</option>)}
        </select>
        <Icon name="chevron" />
      </div>
    </div>

    <div className={styles.map}>
      <div className={styles.mapHeading}>
        <h3>{labels.plan}</h3>
        <span className={styles.north}>{labels.compass} <span aria-hidden="true">{venue === 'john' ? '↑' : '→'}</span></span>
        <button className={styles.zoom} type="button" aria-label={zoomed ? labels.fit : labels.enlarge}
          title={zoomed ? labels.fit : labels.enlarge} aria-pressed={zoomed} onClick={() => setZoomed(!zoomed)}>
          <Icon name={zoomed ? 'exit' : 'expand'} />
        </button>
      </div>
      <div className={styles.pan} ref={scroller} data-zoomed={zoomed}>
        <svg className={styles.diagram} viewBox="0 0 338 268" data-venue={venue} role="group" aria-label={seatingVenues[venue].name + ' · ' + labels.map}>
          <defs><clipPath id={clipId}><path d={arranged.map(s => s.path).join(' ')} /></clipPath></defs>
          <path d={shells[venue]} className={styles.shell} />
          {arranged.map(s => {
            const name = labels.section + ' ' + s.id + ' · ' + labels[location(venue, s)] + ' · ' + labels[s.tier];
            return <g key={s.id} data-section={s.id} data-tier={s.tier} role="button" aria-label={name}
              aria-pressed={s.id === selected.id} tabIndex={s.id === selected.id ? 0 : -1}
              className={styles.block} onClick={() => onSelect(s.id)} onKeyDown={e => onMapKey(e, s)}>
              <title>{name}</title><path d={s.path} />
            </g>;
          })}
          <g clipPath={'url(#' + clipId + ')'} aria-hidden="true" className={styles.rowLines}>
            {Array.from({ length: 29 }, (_, i) => {
              const t = i / 28;
              const [w, h] = extent[venue];
              const width = w * (.34 + .68 * t), height = h * (.31 + .71 * t);
              return <rect key={i} x={169 - width} y={134 - height} width={width * 2} height={height * 2}
                rx={venue === 'john' ? 4 : (11 + 53 * t)} />;
            })}
          </g>
          <CourtMark venue={venue} />
          {venue !== 'john' && <path className={styles.entry} aria-label={labels.entry} role="img"
            transform={venue === 'rla' ? 'translate(208 97)' : 'translate(216 180) rotate(180)'}
            d="M0 -2.9L3 2.4H-3Z"><title>{labels.entry}</title></path>}
          <line className={styles.sightline} x1={selectedX} y1={selectedY} x2="169" y2="134" aria-hidden="true" />
          <circle cx="169" cy="134" r="2" className={styles.target} aria-hidden="true" />
          {sectionDoors[venue].map((door, index) => {
            const [x, y] = project(venue, door);
            return <circle key={index} cx={x} cy={y} r={door.id === selected.nearbyDoor ? 2.7 : 1.15}
              className={door.id === selected.nearbyDoor ? styles.activeDoor : styles.door} aria-hidden="true" />;
          })}
          <g className={styles.numbers} aria-hidden="true">
            {arranged.map(s => <text key={s.id} x={s.point[0]} y={s.point[1]} dy=".34em" textAnchor="middle"
              data-tier={s.tier} data-active={s.id === selected.id} data-letter={typeof s.id === 'string'}>
              {s.id}
            </text>)}
          </g>
        </svg>
      </div>
      <div className={styles.legend} aria-hidden="true">
        {(['courtside','lower','middle','upper'] as const).filter(t => sections.some(s => s.tier === t)).map(t =>
          <span key={t} data-tier={t}><i />{labels[t]}</span>)}
        {venue !== 'john' && <span className={styles.entryKey}><b>▲</b>{labels.entry}</span>}
      </div>
    </div>

    <div className={styles.selection}>
      <div className={styles.selectionTop}>
        <div className={styles.sectionControl}>
          <label className={styles.visuallyHidden} htmlFor={sectionId}>{labels.section}</label>
          <select id={sectionId} value={selected.id} onChange={e => {
            const choice = sections.find(s => String(s.id) === e.target.value);
            if (choice) onSelect(choice.id);
          }}>
            {sections.map(s => <option key={s.id} value={s.id}>{labels.section} {s.id}</option>)}
          </select>
          <Icon name="chevron" />
        </div>
        <button className={styles.view} type="button" disabled={!canView} aria-label={canView ? labels.view : labels.offline}
          onClick={() => canView && onView(selected.id)}>
          <Icon name="camera" /><span>{canView ? labels.shortView : labels.offline}</span>
        </button>
      </div>
      <div className={styles.detail} aria-live="polite">
        <span>{labels[selected.tier]} · {labels[location(venue, selected)]}</span>
        {selected.nearbyDoor && <span className={styles.doorInfo}>{labels.door} {selected.nearbyDoor}</span>}
      </div>
      {selected.sunMarked && <p className={styles.sun}><Icon name="day" />{labels.sun}</p>}
    </div>

    <footer className={styles.sources}>
      <p>{labels.note}</p>
      <div>
        <a href={seatingVenues[venue].map} target="_blank" rel="noreferrer">{labels.source} ↗</a>
        <a href="https://www.ticketmaster.com.au/ausopen" target="_blank" rel="noreferrer">{labels.tickets} ↗</a>
      </div>
      {venue === 'rla' && <p className={styles.credit}>{labels.photo} <a href="https://commons.wikimedia.org/wiki/File:Rod_Laver_Arena_Melbourne_Park_Australian_Open_2023_quarter_final_dusk.jpg"
        target="_blank" rel="noreferrer">Gracchus250</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></p>}
    </footer>
  </div>;
}
