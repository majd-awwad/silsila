/** One small line-icon set (24px grid, 2px stroke). Directional icons mirror in right-to-left layouts. */
import type { SVGProps } from 'react';

const PATHS = {
  next: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  send: 'M5 12h14M13 6l6 6-6 6',
  mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  stop: 'M7 7h10v10H7z',
  sound: 'M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  check: 'M5 12.5l4.5 4.5L19 7',
  cross: 'M6 6l12 12M18 6L6 18',
  question: 'M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9v.3M12 18h.01',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6.5 6.5 0 0 1 3.5 5.5',
  chart: 'M4 20V4M4 20h16M8 20v-7M13 20V8M18 20v-4',
  book: 'M12 6c-2-1.5-4.5-2-8-2v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V4c-3.500 0-6 .5-8 2zM12 6v14',
  spark: 'M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3',
  replay: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v5h5',
  play: 'M8 5l11 7-11 7z',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  print: 'M7 9V4h10v5M7 18H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-3M7 14h10v6H7z',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18v2h2M20 18v2h-2',
  screen: 'M3 4h18v12H3zM8 20h8M12 16v4',
  cap: 'M2 9l10-5 10 5-10 5L2 9zM6 11.5V16c1.5 1.5 3.5 2.5 6 2.5s4.5-1 6-2.5v-4.5',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  lock: 'M6 11h12v9H6zM8.500 11V8a3.500 3.500 0 0 1 7 0v3',
  shield: 'M12 3l7.5 3v6c0 4.5-3 7.500-7.500 9-4.500-1.500-7.500-4.500-7.500-9V6L12 3zM8.500 12l2.500 2.500 4.500-5',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.500 6.500l4 4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1',
  offline: 'M3 3l18 18M8.5 16.500a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.4M19 13a10 10 0 0 0-5-2.8M12 20h.01',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3.5 2',
  menu: 'M4 7h16M4 12h16M4 17h16',
  home: 'M4 11l8-7 8 7M6 10v10h12V10',
} as const;

export type IconName = keyof typeof PATHS;
const MIRRORED: IconName[] = ['next', 'back', 'send', 'play', 'replay'];

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className={MIRRORED.includes(name) ? 'rtl:-scale-x-100 shrink-0' : 'shrink-0'} {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
