// One icon family for the whole game. `Icon` is the flat glyph (inherits colour);
// `Badge` sets the same glyph on a glossy, bevelled tile: the 3D nav icons.
import type { CSSProperties } from 'react';

/** 24x24 glyphs, drawn as filled shapes so they hold up from 14px to 64px. */
const G: Record<string, string> = {
  home: 'M12 2.5 1.5 11h3v10h6v-6h3v6h6V11h3z',
  helmet: 'M3 13.5C3 7.7 7.4 3 13 3c4.6 0 8 3.2 8 7.6V12h-6.6l.9 2.6H21v2h-4.1l.6 1.9H21v2h-6.3l-1.6-4.6H10c-.4 1.7-1.6 3.1-3.6 3.1C4.7 19 3 17 3 13.5Zm4.2 1.3a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z',
  roster: 'M8.5 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm8 1a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM1 20.5c0-4 3.3-7 7.5-7s7.5 3 7.5 7V21H1zm15.6.5c0-2.6-.9-4.9-2.5-6.5.8-.3 1.6-.5 2.4-.5 3.3 0 6.5 2.2 6.5 5.6v1.4z',
  lineup: 'M2 4h20v16H2zm2 2v12h7V6zm9 0v12h7V6zM6 8.5h3v3H6zm0 4.5h3v3H6zm9-4.5h3v3h-3zm0 4.5h3v3h-3z',
  trade: 'M16.5 3 22 8.5 16.5 14v-3.5H8V6.5h8.5zM7.5 10 2 15.5 7.5 21v-3.5H16v-4H7.5z',
  contract: 'M5 2h10l5 5v15H5zm9 1.5V8h4.5M8 11h9v1.6H8zm0 3.4h9V16H8zm0 3.4h5.5v1.6H8z',
  money: 'M12 1.5a10.5 10.5 0 1 1 0 21 10.5 10.5 0 0 1 0-21Zm1 4h-2v1.6c-2 .4-3.2 1.7-3.2 3.4 0 2.2 1.8 3 3.8 3.5 1.7.4 2.3.8 2.3 1.5s-.8 1.2-2 1.2c-1.4 0-2.2-.6-2.4-1.6H7.4c.2 1.9 1.6 3.1 3.6 3.4v1.6h2v-1.6c2-.4 3.3-1.6 3.3-3.5 0-2.3-1.9-3.1-3.9-3.6-1.6-.4-2.2-.7-2.2-1.4 0-.6.7-1.1 1.8-1.1 1.2 0 1.8.5 2 1.3h2c-.2-1.7-1.3-2.9-3-3.2z',
  draft: 'M4 3h16v4H4zm1 5.5h14L17.5 21h-11zM9 11v7h2v-7zm4 0v7h2v-7z',
  scout: 'M10 3a7 7 0 0 1 5.6 11.2l5.6 5.6-1.6 1.6-5.6-5.6A7 7 0 1 1 10 3Zm0 2.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Z',
  league: 'M12 2 3 6v6c0 5.2 3.8 9.4 9 10 5.2-.6 9-4.8 9-10V6zm0 4.3 1.4 2.9 3.2.5-2.3 2.2.5 3.2-2.8-1.5-2.9 1.5.6-3.2L7.4 9.7l3.2-.5z',
  trophy: 'M6 2h12v2h4v3.5c0 2.8-2 5-4.7 5.4A6 6 0 0 1 13 16.9V19h4v3H7v-3h4v-2.1a6 6 0 0 1-4.3-4C4 12.5 2 10.3 2 7.5V4h4zm0 4H4v1.5c0 1.4.8 2.6 2 3.1zm12 0v4.6c1.2-.5 2-1.7 2-3.1V6z',
  stats: 'M3 21V11h4v10zm7 0V3h4v18zm7 0v-7h4v7z',
  calendar: 'M7 1h2v2h6V1h2v2h4v19H3V3h4zm-2 8v11h14V9zm2 2h3v3H7zm5 0h3v3h-3z',
  standings: 'M3 4h18v3H3zm0 6.5h13v3H3zM3 17h8v3H3z',
  injury: 'M9 2h6v7h7v6h-7v7H9v-7H2V9h7z',
  news: 'M2 4h16v15a2 2 0 0 0 2 2H5a3 3 0 0 1-3-3zm4 3v4h8V7zm0 6v1.6h8V13zm0 3.4V18h8v-1.6zM19 7h3v12a1.5 1.5 0 0 1-3 0z',
  inbox: 'M2 4h20v16H2zm2.3 2 7.7 6 7.7-6zM4 8.3V18h16V8.3l-8 6.2z',
  strategy: 'M7 2h10v2h3v18H4V4h3zm1.5 2v2h7V4zM7 9.5l1.4-1.4 1.6 1.6 1.6-1.6L13 9.5l-1.6 1.6 1.6 1.6-1.4 1.4-1.6-1.6-1.6 1.6L7 12.7l1.6-1.6zm7.5 2.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM8 17.3h9V19H8z',
  coach: 'M14 3h7v4.5l-3.6 1.4a6.5 6.5 0 1 1-6.1-4.3H14zm-5 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  progress: 'M3 17.5 9 11.5l4 4 6.5-6.5H16V6h9v9h-3V11.1L13 20l-4-4-3.9 3.9z',
  cap: 'M3 7h18v13H3zm5-4h8v4h-2V5h-4v2H8zm2.3 6.5v1.2c-1.3.3-2.1 1.1-2.1 2.2 0 1.4 1.1 1.9 2.5 2.3 1.1.3 1.4.5 1.4.9s-.5.7-1.2.7c-.9 0-1.4-.4-1.5-1H7.8c.1 1.2 1 2 2.5 2.3v1.2h1.4v-1.2c1.4-.3 2.2-1.1 2.2-2.3 0-1.5-1.2-2-2.6-2.4-1-.3-1.4-.5-1.4-.9 0-.4.5-.7 1.1-.7.8 0 1.2.3 1.3.8h1.4c-.1-1.1-.9-1.9-2-2.1V9.5z',
  play: 'M5 3l16 9-16 9z',
  sim: 'M3 4l9 8-9 8zm9 0 9 8-9 8z',
  save: 'M3 3h14l4 4v14H3zm3 2v5h10V5zm6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  menu: 'M3 5h18v2.6H3zm0 5.7h18v2.6H3zm0 5.7h18V19H3z',
  star: 'm12 1.8 3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z',
  bolt: 'M13.5 1 4 13.5h6.5L9 23l11-13h-6.6z',
  shield: 'M12 1.5 3 5v6.5c0 5.3 3.8 10 9 11 5.2-1 9-5.7 9-11V5z',
  fire: 'M12.5 1c.6 3.7 5.5 6 5.5 11.3A6.3 6.3 0 0 1 12 23a6.3 6.3 0 0 1-6-6.4c0-3 1.7-4.7 2.9-6.3.4 1.6 1.1 2.7 2.3 3.2C11.4 9.8 10.4 5.3 12.5 1z',
  ball: 'M21.5 2.5c.6 4.6-.8 10-4.4 13.6S8.1 21.1 3.5 20.5C2.9 15.9 4.3 10.5 7.9 6.9S16.9 1.9 21.5 2.5Zm-12 7.6-1.2 1.2 1.5 1.5-1.2 1.2 1.3 1.3 1.2-1.2 1.5 1.5 1.2-1.2-1.5-1.5 1.2-1.2 1.5 1.5 1.2-1.2-1.5-1.5 1.2-1.2-1.3-1.3-1.2 1.2-1.5-1.5-1.2 1.2 1.5 1.5-1.2 1.2z',
  whistle: 'M9.5 7H22v4.5l-5.2 1.2A7.5 7.5 0 1 1 9.5 7Zm0 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM14 2h2v4h-2z',
  chart: 'M3 3h2v16h16v2H3zm4 11.5 4-5 3.5 3L19.6 6 21 7.2l-6.3 8.1-3.5-3-2.6 3.3z',
  history: 'M12 2a10 10 0 1 1-9.4 13.4l2.2-.7A7.7 7.7 0 1 0 6.6 6.6L9 9H2V2l2.9 2.9A10 10 0 0 1 12 2Zm-1 5h2v5l3.6 2.2-1 1.7L11 13.2z',
  block: 'M4 4h16v4H4zm0 6h7v10H4zm9 0h7v4h-7zm0 6h7v4h-7z',
  offers: 'M2 6h14v4H2zm0 6h14v4H2zm16-6 5 6-5 6z',
  finder: 'M10.5 3a7.5 7.5 0 0 1 6 12l4.8 4.8-1.6 1.6-4.8-4.8A7.5 7.5 0 1 1 10.5 3Zm-.8 3.5v3.2H6.5v1.6h3.2v3.2h1.6v-3.2h3.2V9.7h-3.2V6.5z',
  power: 'M11 2h2v10h-2zm-5.3 3.2 1.4 1.4a7 7 0 1 0 9.8 0l1.4-1.4A9 9 0 1 1 5.7 5.2Z',
  x: 'M5 3.6 12 10.6l7-7L20.4 5l-7 7 7 7-1.4 1.4-7-7-7 7L3.6 19l7-7-7-7z',
  chevron: 'M8.6 3 7.2 4.4 14.8 12l-7.6 7.6L8.6 21l9-9z',
  up: 'M12 4 3 14h6v6h6v-6h6z',
  down: 'M12 20 3 10h6V4h6v6h6z',
  sign: 'M3 17.3V21h3.8L17.8 10 14 6.2zm17.7-10.2a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0L15 5.2 18.8 9z',
};
export type IconName = keyof typeof G;

export function Icon({ n, size = 18, style, className }: { n: IconName; size?: number; style?: CSSProperties; className?: string }) {
  return <svg className={`ico ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden style={style}><path d={G[n]} fill="currentColor" /></svg>;
}

/** Glossy bevelled tile with the glyph embossed on it. `tone` picks the face colour. */
export function Badge({ n, size = 40, tone = 'team', style }: { n: IconName; size?: number; tone?: 'team' | 'gold' | 'red' | 'green' | 'steel' | 'purple'; style?: CSSProperties }) {
  return (
    <span className={`badge3d ${tone}`} style={{ width: size, height: size, ...style }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" aria-hidden><path d={G[n]} fill="currentColor" /></svg>
    </span>
  );
}
