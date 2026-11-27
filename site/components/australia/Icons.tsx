const paths = {
  atlas: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16m6-14v16',
  explore: 'M4 3v17h17 M8 15l4-5 3 2 5-7 M17 5h3v3',
  guide: 'M3 4c3-1 6-.5 9 2 3-2.5 6-3 9-2v14c-3-1-6-.4-9 2-3-2.4-6-3-9-2z M12 6v14',
  hex: 'm12 2 9 5v10l-9 5-9-5V7z',
  terrain: 'm2 19 7-12 5 9 3-6 5 9z M6.5 11.5 9 13l2.2-1.8',
  elevation: 'm2 17 10-6 10 6-10 5z M2 12l10-6 10 6 M2 7l10-5 10 5',
  population:
    'M4 20v-2a5 5 0 0 1 10 0v2 M16 14a4 4 0 0 1 5 4v2 M12.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0 M16 5a3 3 0 0 1 0 6',
  weeklyIncome:
    'M20 7c0 2-3.6 3.5-8 3.5S4 9 4 7s3.6-3.5 8-3.5 8 1.5 8 3.5Zm0 0v5c0 2-3.6 3.5-8 3.5S4 14 4 12V7m16 5v5c0 2-3.6 3.5-8 3.5S4 19 4 17v-5',
  medianAge: 'M6 3h12M6 21h12M7 3c0 5 1 7 5 9-4 2-5 4-5 9m10-18c0 5-1 7-5 9 4 2 5 4 5 9',
  employed: 'M3 8h18v12H3z M8 8V5h8v3 M3 12c6 3 12 3 18 0 M11 13h2v3h-2z',
  city: 'M2 20h20 M4 20V9h5v11m0-1V4h7v16m0-9h4v9 M12 7h1m-1 4h1m-1 4h1',
  wonder: 'm12 2 9 10-9 10-9-10z M8 14l4-6 4 6z',
  chevron: 'm9 6 6 6-6 6',
  back: 'm15 6-6 6 6 6',
  compass: 'm15.5 8.5-2 5-5 2 2-5z M12 2a10 10 0 1 1 0 20 10 10 0 1 1 0-20Z',
  fit: 'M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6',
  plus: 'M12 5v14m-7-7h14',
  minus: 'M5 12h14',
  search: 'M17 17l4 4 M18 10a8 8 0 1 1-16 0 8 8 0 1 1 16 0Z',
  layers: 'm12 3 10 6-10 6L2 9z M2 13l10 6 10-6 M2 17l10 6 10-6',
  pin: 'M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0Z M14 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0Z',
  close: 'm6 6 12 12M18 6 6 18',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h1m-1 6h1m-1 6h1',
  district: 'M3 21h18 M5 18V9m5 9V9m5 9V9m4 9V9 M2 7l10-5 10 5z',
};
export type IconName = keyof typeof paths;
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function Rose({ size = 44 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="23" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="32" cy="32" r="19" stroke="currentColor" strokeWidth=".6" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((rotation, i) => (
        <g key={rotation} transform={'rotate(' + rotation + ' 32 32)'}>
          <path d={i % 2 ? 'M32 11l3 17-3 4-3-4z' : 'M32 2l5 24-5 6-5-6z'} fill="currentColor" />
          <path d={i % 2 ? 'M32 12v19l3-3z' : 'M32 3v28l5-5z'} fill="#526160" />
        </g>
      ))}
      <circle cx="32" cy="32" r="3" fill="#efe0ac" />
    </svg>
  );
}
