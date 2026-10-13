// Every FBS program and its 2026 roster (built by tools/college-dynasty.mjs from cfbfastR).
// Logos and headshots are ESPN images, linked by id.
import raw from './data.json';

export interface School { id: number; school: string; mascot: string; abbr: string; conf: string; prestige: number; c1: string; c2: string; ovr: number; win: number }
export interface Player { id: string; fn: string; ln: string; t: number; pos: string; yr: number; ht: number; wt: number; num: number; ovr: number; /** Rating at the start of the season, once he has developed. */ b?: number; st?: 1; hs?: 1; home?: string; s?: number[] }

const D = raw as unknown as { season: number; teams: School[]; players: Player[] };
export const SEASON = D.season;
export const SCHOOLS = D.teams;
export const PLAYERS = D.players;
export const school = (id: number) => SCHOOLS.find(s => s.id === id)!;
export const rosterOf = (id: number) => PLAYERS.filter(p => p.t === id).sort((a, b) => b.ovr - a.ovr);
export const CONFS = ['SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12', 'American', 'Mountain West', 'Sun Belt', 'C-USA', 'MAC', 'Independent'].filter(c => SCHOOLS.some(s => s.conf === c));

export const logo = (id: number) => `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`;
export const logoDark = (id: number) => `https://a.espncdn.com/i/teamlogos/ncaa/500-dark/${id}.png`;
export const headshot = (p: Player) => (p.hs ? `https://a.espncdn.com/i/headshots/college-football/players/full/${p.id}.png` : undefined);
export const YEAR = ['', 'Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'];
export const YR = ['', 'FR', 'SO', 'JR', 'SR', 'GR'];
export const height = (h: number) => `${Math.floor(h / 12)}'${h % 12}"`;

/** A colour that reads on a dark background: the primary, or the secondary when the primary is near-black. */
const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
export const showColor = (s: School) => {
  if (lum(s.c1) >= 28) return s.c1;
  if (lum(s.c2) >= 50 && lum(s.c2) <= 225) return s.c2;
  // Both too dark (or the second is white): lift the primary so it still reads as the school.
  const n = parseInt(s.c1.slice(1), 16), up = (v: number) => Math.round(v + (255 - v) * 0.28);
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map(v => up(v).toString(16).padStart(2, '0')).join('')}`;
};
/** Preseason top 25, by roster strength with a nudge for last year's record. */
export const TOP25 = [...SCHOOLS].sort((a, b) => (b.ovr + b.win * 4) - (a.ovr + a.win * 4)).slice(0, 25);
