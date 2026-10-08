// The head coach's look: skin, hair, facial hair, build, headwear, glasses and what
// he wears on the sideline. Built in the coach creator before the season and drawn
// as pixel sprites (front view at the podium, side view walking in). Real coaches
// start from a default that matches them; the player can change anything.
import type { League } from '../core/types';
import { hash } from '../core/rng';
import { paint } from './field/pixel';
import { vivid } from './components';

export const SKIN_TONES = ['#f3cdb0', '#e2b08c', '#c98d66', '#a06a45', '#6f452a', '#4a2c1a'];
export const HAIR_COLORS = ['#17120e', '#3b2717', '#6e4a2a', '#c9a35c', '#9a9a96', '#8a3b1e'];
export const OPTIONS = {
  hair: ['Short', 'Buzz', 'Bald', 'Long', 'Swept'] as const,
  beard: ['None', 'Stubble', 'Beard', 'Mustache', 'Goatee'] as const,
  build: ['Slim', 'Average', 'Big'] as const,
  head: ['Cap', 'Visor', 'Headset', 'Beanie', 'None'] as const,
  glasses: ['None', 'Clear', 'Shades'] as const,
  top: ['Polo', 'Hoodie', 'Quarter-Zip', 'Suit'] as const,
};
export interface CoachLook {
  skin: number; hairColor: number;
  hair: typeof OPTIONS.hair[number]; beard: typeof OPTIONS.beard[number]; build: typeof OPTIONS.build[number];
  head: typeof OPTIONS.head[number]; glasses: typeof OPTIONS.glasses[number]; top: typeof OPTIONS.top[number];
}

/** Defaults for the real head coaches in the league file (by surname), so nobody starts as someone else. */
const REAL: Record<string, Partial<CoachLook>> = {
  Campbell: { skin: 0, hair: 'Buzz', hairColor: 1, build: 'Big', beard: 'None', head: 'Visor', top: 'Hoodie' },
  Reid: { skin: 0, hair: 'Short', hairColor: 4, build: 'Big', beard: 'Mustache', glasses: 'Clear', head: 'Visor', top: 'Hoodie' },
  Morris: { skin: 5, hair: 'Bald', build: 'Average', beard: 'Goatee', hairColor: 0, head: 'None' },
  Ryans: { skin: 5, hair: 'Buzz', hairColor: 0, beard: 'Beard', build: 'Average', head: 'Cap' },
  Bowles: { skin: 5, hair: 'Buzz', hairColor: 4, beard: 'Mustache', build: 'Average', head: 'Cap' },
  Glenn: { skin: 5, hair: 'Bald', hairColor: 0, beard: 'Goatee', build: 'Average', head: 'Headset' },
  Saleh: { skin: 2, hair: 'Bald', hairColor: 0, beard: 'Beard', build: 'Average', head: 'None' },
  McVay: { skin: 0, hair: 'Swept', hairColor: 1, build: 'Slim', head: 'Headset', top: 'Quarter-Zip' },
  Shanahan: { skin: 0, hair: 'Short', hairColor: 1, beard: 'Stubble', head: 'Cap', top: 'Hoodie' },
  Harbaugh: { skin: 0, hair: 'Short', hairColor: 4, head: 'Cap', top: 'Quarter-Zip' },
  Payton: { skin: 0, hair: 'Short', hairColor: 4, head: 'Visor', glasses: 'Shades' },
  McDermott: { skin: 0, hair: 'Short', hairColor: 4, head: 'Cap', top: 'Hoodie' },
  Vrabel: { skin: 0, hair: 'Bald', build: 'Big', head: 'Cap', top: 'Hoodie' },
  Sirianni: { skin: 0, hair: 'Short', hairColor: 1, head: 'Cap', beard: 'Stubble' },
  LaFleur: { skin: 0, hair: 'Bald', head: 'Visor', glasses: 'Shades' },
  Quinn: { skin: 0, hair: 'Bald', build: 'Average', head: 'Cap', top: 'Hoodie' },
  McCarthy: { skin: 0, hair: 'Short', hairColor: 1, build: 'Big', beard: 'Mustache', head: 'Cap' },
  Macdonald: { skin: 0, hair: 'Short', hairColor: 3, build: 'Slim', head: 'Visor' },
  Taylor: { skin: 0, hair: 'Short', hairColor: 1, beard: 'Beard', head: 'Cap' },
  Johnson: { skin: 0, hair: 'Short', hairColor: 1, head: 'Cap', top: 'Hoodie' },
  Gannon: { skin: 0, hair: 'Short', hairColor: 1, beard: 'Stubble', head: 'Cap' },
  O_Connell: { skin: 0, hair: 'Swept', hairColor: 3, head: 'Headset', top: 'Quarter-Zip' },
  Moore: { skin: 0, hair: 'Short', hairColor: 1, head: 'Visor' },
  Canales: { skin: 1, hair: 'Short', hairColor: 0, beard: 'Beard', head: 'Cap' },
  Steichen: { skin: 0, hair: 'Short', hairColor: 1, head: 'Cap', glasses: 'Shades' },
};

const DEFAULT: CoachLook = { skin: 0, hairColor: 1, hair: 'Short', beard: 'None', build: 'Average', head: 'Cap', glasses: 'None', top: 'Polo' };

/** The user's coach look: saved on the league, or the real coach's default. */
export function lookOf(L: League): CoachLook {
  const saved = (L as League & { coachLook?: CoachLook }).coachLook;
  if (saved) return saved;
  const name = L.teams[L.user].coach.name, last = name.split(' ').slice(-1)[0].replace(/'/g, '_');
  const real = REAL[last];
  if (real) return { ...DEFAULT, ...real };
  // Unknown (custom or generated) coach: a stable pick, never a guess at a real person.
  const h = hash(name) >>> 0;
  return { ...DEFAULT, skin: h % SKIN_TONES.length, hairColor: (h >>> 3) % HAIR_COLORS.length, beard: OPTIONS.beard[(h >>> 6) % 5] };
}
export function setLook(L: League, look: CoachLook) { (L as League & { coachLook?: CoachLook }).coachLook = look; }

export function randomLook(seed: number): CoachLook {
  const r = (n: number, k: number) => ((seed >>> k) ^ (seed * 2654435761 >>> (k + 3))) % n;
  return {
    skin: r(6, 1), hairColor: r(6, 4), hair: OPTIONS.hair[r(5, 7)], beard: OPTIONS.beard[r(5, 9)], build: OPTIONS.build[r(3, 11)],
    head: OPTIONS.head[r(5, 13)], glasses: OPTIONS.glasses[r(3, 15) === 2 ? 2 : r(4, 15) === 1 ? 1 : 0], top: OPTIONS.top[r(4, 17)],
  };
}

// ---- sprites ---------------------------------------------------------------------------
// Palette letters: C headwear  c brim/trim  H hair  S skin  s shaded skin  E eye  O frames
// D shades  M mouth  K headset  J top  T top trim  W shirt  P pants  B shoes  G hand
type Grid = string[][];
const blank = (w: number, h: number): Grid => Array.from({ length: h }, () => Array(w).fill('.'));
const put = (g: Grid, y: number, x: number, row: string) => [...row].forEach((ch, i) => { if (ch !== ' ' && g[y]?.[x + i] !== undefined) g[y][x + i] = ch; });

function frontRows(look: CoachLook, point: boolean): string[] {
  const g = blank(12, 17);
  // Hair (drawn first so headwear covers it).
  const hairTop: Record<string, string[]> = {
    Short: ['    HHHH    ', '   HHHHHH   ', '  HHHHHHHH  '], Buzz: ['            ', '   HHHHHH   ', '  HHSSSSHH  '],
    Bald: ['            ', '    SSSS    ', '   SSSSSS   '], Long: ['    HHHH    ', '   HHHHHH   ', '  HHHHHHHH  '], Swept: ['   HHHHH    ', '  HHHHHHHH  ', '  HHHHHHHH  '],
  };
  hairTop[look.hair].forEach((r, i) => put(g, i, 0, r));
  // Face.
  put(g, 3, 0, '  SSSSSSSS  ');
  put(g, 4, 0, look.glasses === 'Shades' ? '  SDDDDDDS  ' : look.glasses === 'Clear' ? '  SOEOOEOS  ' : '  SSESSESS  ');
  put(g, 5, 0, '  SSSSSSSS  ');
  put(g, 6, 0, look.beard === 'Mustache' ? '   SHHHHS   ' : look.beard === 'Beard' ? '  HHSMMSHH  ' : '   SSMMSS   ');
  put(g, 7, 0, look.beard === 'Beard' ? '   HHHHHH   ' : look.beard === 'Goatee' ? '    SHHS    ' : look.beard === 'Stubble' ? '   sssss    ' : look.beard === 'Mustache' ? '    SMMS    ' : '    SSSS    ');
  if (look.beard === 'Stubble') put(g, 6, 0, '   sSMMSs   ');
  if (look.hair === 'Long') { put(g, 3, 0, ' H        H '); put(g, 4, 0, ' H        H '); put(g, 5, 0, ' H        H '); }
  else if (look.head !== 'Headset') { put(g, 4, 0, ' S        S '); }
  // Headwear.
  if (look.head === 'Cap') { put(g, 0, 0, '   CCCCCC   '); put(g, 1, 0, '  CCCCCCCC  '); put(g, 2, 0, '  cccccccc  '); }
  else if (look.head === 'Visor') { put(g, 1, 0, '  CCCCCCCC  '); put(g, 2, 0, '  cccccccc  '); }
  else if (look.head === 'Beanie') { put(g, 0, 0, '   CCCCCC   '); put(g, 1, 0, '  CCCCCCCC  '); put(g, 2, 0, '  cccccccc  '); }
  else if (look.head === 'Headset') { put(g, 0, 0, '   KKKKKK   '); put(g, 3, 0, ' K        K '); put(g, 4, 0, ' K        K '); put(g, 5, 0, ' K       K  '); put(g, 6, 0, '  KK        '); }
  // Torso by build and top.
  const w = look.build === 'Slim' ? 8 : look.build === 'Average' ? 10 : 12, x0 = (12 - w) / 2;
  const body = 'J'.repeat(w), arms = 'G' + 'J'.repeat(w - 2) + 'G';
  const collar: Record<string, string> = { Polo: 'TTJJTT', Hoodie: 'JcJJcJ', 'Quarter-Zip': 'TTTTTT', Suit: 'JWTTWJ' };
  put(g, 8, x0, body); put(g, 8, 3, collar[look.top]);
  for (let y = 9; y < 17; y++) put(g, y, x0, y >= 12 && y <= 13 ? arms : body);
  if (look.top === 'Hoodie') { put(g, 9, 0, '     W  W   '); put(g, 10, 0, '     W  W   '); }
  if (look.top === 'Quarter-Zip') for (let y = 9; y < 13; y++) put(g, y, 0, '      T     ');
  if (look.top === 'Suit') { put(g, 9, 0, '     WTW    '); put(g, 10, 0, '     WTW    '); put(g, 11, 0, '      T     '); }
  if (point) { const ax = x0 + w - 1; for (let y = 3; y <= 10; y++) { if (ax + 1 < 12) g[y][ax + 1] = y === 3 ? 'G' : y < 8 ? 'J' : '.'; } g[8][ax] = 'J'; }
  return g.map(r => r.join(''));
}

function sideRows(look: CoachLook, step: number): string[] {
  const g = blank(12, 17);
  const hair: Record<string, string[]> = {
    Short: ['    HHHH    ', '   HHHHHH   '], Buzz: ['            ', '   HHHHH    '], Bald: ['            ', '    SSSS    '], Long: ['    HHHH    ', '   HHHHHH   '], Swept: ['   HHHHHH   ', '   HHHHHH   '],
  };
  hair[look.hair].forEach((r, i) => put(g, i, 0, r));
  put(g, 2, 0, look.hair === 'Long' ? '   HSSSSS   ' : '   HSSSSS   ');
  put(g, 3, 0, look.glasses === 'Shades' ? '   SSSDDS   ' : look.glasses === 'Clear' ? '   SSSOEO   ' : '   SSSSES   ');
  put(g, 4, 0, '   SSSSSSS  ');
  put(g, 5, 0, look.beard === 'Beard' ? '   HHHHHM   ' : look.beard === 'Mustache' ? '    SSSHH   ' : look.beard === 'Goatee' ? '    SSSSH   ' : look.beard === 'Stubble' ? '    sssss   ' : '    SSSSM   ');
  if (look.hair === 'Long') { put(g, 3, 0, '  HH        '); put(g, 4, 0, '  HH        '); }
  if (look.head === 'Cap') { put(g, 0, 0, '   CCCCC    '); put(g, 1, 0, '   CCCCCcc  '); }
  else if (look.head === 'Visor') { put(g, 1, 0, '   CCCCCcc  '); }
  else if (look.head === 'Beanie') { put(g, 0, 0, '   CCCCC    '); put(g, 1, 0, '   cccccc   '); }
  else if (look.head === 'Headset') { put(g, 0, 0, '   KKKKK    '); put(g, 2, 0, '    K       '); put(g, 3, 0, '    K       '); put(g, 4, 0, '    KKKK    '); }
  const thick = look.build === 'Big' ? 1 : 0;
  put(g, 6, 0, look.top === 'Suit' ? '   JWTJ     ' : '   TJJT     ');
  const swing = step % 2 ? ['  JJJJJJ    ', '  JJJJJJ    ', '  JJJJJJG   ', '  JJJJJJ    '] : ['  JJJJJJ    ', ' sJJJJJJ    ', ' gJJJJJJ    ', '  JJJJJJ    '];
  swing.forEach((r, i) => put(g, 7 + i, 0, thick ? r.replace('  JJJJJJ', ' JJJJJJJJ').replace(' sJJJJJJ', 'sJJJJJJJJ').replace(' gJJJJJJ', 'gJJJJJJJJ') : r));
  put(g, 11, 0, '   JJJJJ    ');
  const legs: Record<number, string[]> = {
    0: ['   PPPPP    ', '  pp   PP   ', ' pp     PP  ', 'bb      BBB '],
    1: ['   PPPPP    ', '   pp PP    ', '   pp PP    ', '   bb BBB   '],
    2: ['   PPPPP    ', '  PP   pp   ', ' PP     pp  ', 'BBB     bb  '],
    3: ['   PPPPP    ', '   PP pp    ', '   PP pp    ', '   BBBbb    '],
  };
  legs[step % 4].forEach((r, i) => put(g, 12 + i, 0, r));
  return g.map(r => r.join(''));
}

export interface CoachSprites { walk: HTMLCanvasElement[]; front: HTMLCanvasElement; point: HTMLCanvasElement }
export function coachSprites(look: CoachLook, colors: string[]): CoachSprites {
  const c0 = vivid(colors[0]), c1 = colors[1] ?? '#ffffff';
  const suit = look.top === 'Suit';
  const col: Record<string, string> = {
    C: c0, c: c1, H: HAIR_COLORS[look.hairColor], S: SKIN_TONES[look.skin], E: '#16110d', O: '#2a2a2a', D: '#0c0c0e', M: '#7a4436',
    K: '#16181c', J: suit ? '#1c2029' : c0, T: suit ? c0 : c1, W: '#f2f2f2', P: suit ? '#20242c' : '#b9a47a', B: '#1e1a17', G: SKIN_TONES[look.skin],
  };
  return { walk: [0, 1, 2, 3].map(i => paint(sideRows(look, i), col)), front: paint(frontRows(look, false), col), point: paint(frontRows(look, true), col) };
}
