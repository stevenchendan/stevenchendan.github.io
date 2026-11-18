type Name = 'ball'|'seat'|'venues'|'settings'|'chevron'|'day'|'golden'|'night'|'rain'|'solar'|'reset'|'capture'|'expand'|'cinema'|'close'|'pin'|'mouse'|'check'|'camera'|'play'|'pause'|'info'|'exit'|'language'|'next';
const paths:Record<Name,React.ReactNode> = {
  seat:<><path d="m5 4 1.8 9.4a2 2 0 0 0 2 1.6H19v3H8.5a4 4 0 0 1-3.9-3.2L3 5zM8 18v3m10-3v3M9 12h7.5a2.5 2.5 0 0 1 2.5 2.5"/></>,
  ball:<><circle cx="12" cy="12" r="9.4"/><path d="M3.7 7.5a9 9 0 0 1 9.2 13.8M11 2.8a9 9 0 0 0 9.2 13.7"/></>,
  venues:<><path d="m2.5 6 6-2.5 7 2.5 6-2.5v14.7l-6 2.4-7-2.4-6 2.4zM8.5 3.5v14.8M15.5 6v14.6"/></>,
  settings:<><path d="M3 7h6m5 0h7M3 17h11m5 0h2"/><circle cx="11.5" cy="7" r="2.5"/><circle cx="16.5" cy="17" r="2.5"/></>,
  chevron:<path d="m8 10 4 4 4-4"/>,next:<path d="m9 6 6 6-6 6"/>,
  day:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,
  golden:<><path d="M3 16h18M5 20h14M7 16a5 5 0 1 1 10 0M12 3v3M3.5 7.5l2 2m15-2-2 2"/></>,
  night:<path d="M20.3 14.7A8.8 8.8 0 0 1 9.3 3.6a8.9 8.9 0 1 0 11 11.1Z"/>,
  rain:<><path d="M6 15a4 4 0 0 1-1-7.8 6 6 0 0 1 11.4-.8A4.4 4.4 0 0 1 19 15M8 17l-1 3m6-3-1 3m6-3-1 3"/></>,
  solar:<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
  reset:<><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/></>,
  capture:<><path d="M3 7.5h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="3.4"/></>,
  expand:<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>,
  cinema:<><rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M3 8h18m-12-4-3 4m9-4-3 4m9-4-3 4m-8 3 4 2.5-4 2.5z"/></>,
  close:<path d="m6 6 12 12M18 6 6 18"/>,
  pin:<><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/></>,
  mouse:<><rect x="6" y="2.5" width="12" height="19" rx="6"/><path d="M12 6v4"/></>,
  check:<path d="m5 12 4 4L19 6"/>,camera:<><rect x="2.5" y="5.5" width="13" height="13" rx="2"/><path d="m15.5 10 6-3v10l-6-3"/></>,
  play:<path d="m8 5 11 7-11 7z"/>,pause:<path d="M8 5v14M16 5v14"/>,info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.4"/></>,
  exit:<path d="M15 3v6h6M9 21v-6H3M15 9l6-6M9 15l-6 6"/>,
  language:<><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.5 9h17m-17 6h17"/></>,
};
export default function Icon({name}:{name:Name}){
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
