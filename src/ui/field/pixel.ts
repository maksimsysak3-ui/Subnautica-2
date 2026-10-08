// Pixel-art players. Each frame is a 12x18 grid drawn by hand (facing right),
// recoloured per team kit and skin tone, given a 1px dark outline automatically,
// and cached as a tiny canvas. Lower-case letters are the far-side limbs, shaded
// darker so a stride reads at a glance.
//
// H helmet  h helmet stripe  M facemask  S skin  J jersey  T jersey trim  N number
// P pants   p pants stripe   K socks     B shoe  G glove   F football     W laces
// R referee stripe (black)   lower case = far limb (shaded)

export interface Kit { jersey: string; num: string; trim: string; pants: string; helmet: string; mask: string; socks: string }
export type Frame = 'stand' | 'run0' | 'run1' | 'run2' | 'run3' | 'carry0' | 'carry1' | 'carry2' | 'carry3' | 'crouch' | 'three' | 'throwA' | 'throwB'
  | 'catch' | 'block0' | 'block1' | 'dive' | 'down' | 'party0' | 'party1' | 'kick' | 'signal';

const HELMET = [
  '....HHHH....',
  '...HhhhHH...',
  '...HHHHHMM..',
  '....HHSMM...',
];
const TORSO: Record<string, string[]> = {
  idle: ['..TJJJJJT...', '.JJJJJJJJJ..', '.SJJNNNJJS..', '.SJJNNNJJS..', '.GJJJJJJJG..'],
  runA: ['..TJJJJJT...', '.JJJJJJJJJS.', 'sJJJNNNJJG..', 'gJJJNNNJJ...', '..JJJJJJJ...'],
  runB: ['..TJJJJJT...', 'sJJJJJJJJJ..', 'gJJJNNNJJS..', '..JJNNNJJS..', '..JJJJJJJG..'],
  carry: ['..TJJJJJT...', '.JJJJJJJJS..', 'sJJJNNNFFS..', 'gJJJNNNFWG..', '..JJJJJJJ...'],
  throwA: ['FG.TJJJJT...', 'SSJJJJJJJ...', '.JJJNNNJJSG.', '.JJJNNNJJ...', '..JJJJJJJ...'],
  throwB: ['..TJJJJJTSSG', '.JJJJJJJJJ..', 'sJJJNNNJJ...', 'gJJJNNNJJ...', '..JJJJJJJ...'],
  up: ['..TJJJJJT...', '.JJJJJJJJJ..', '..JJNNNJJ...', '..JJNNNJJ...', '..JJJJJJJ...'],
  fwd: ['..TJJJJJTSSG', '.JJJJJJJJJ..', '.JJJNNNJJSSG', '..JJNNNJJ...', '..JJJJJJJ...'],
};
// arms raised above the helmet (rows 0-1) for catches and celebrations
const RAISE = ['.G.....G....', '.S.....S....'];
const LEGS: Record<string, string[]> = {
  stand: ['...PPPPPP...', '...PP..PP...', '...KK..KK...', '...KK..KK...', '...BBB.BBB..'],
  run0: ['...PPPPPP...', '..pp....PP..', '.kk......KK.', 'bb.......BBB', '............'],
  run1: ['...PPPPPP...', '.kpp...PP...', 'bk.....KK...', '.......KK...', '.......BBB..'],
  run2: ['...PPPPPP...', '..PP....pp..', '.KK......kk.', 'BBB......bb.', '............'],
  run3: ['...PPPPPP...', '.KPP...pp...', 'BK.....kk...', '.......kk...', '.......bbb..'],
  crouch: ['..PPPPPPP...', '..PP...PP...', '.KK.....KK..', '.BBB....BBB.', '............'],
  kick: ['...PPPPPP...', '...pp...PPPK', '...kk.....KB', '...kk.......', '...bbb......'],
};
const WHOLE: Record<string, string[]> = {
  three: ['............', '............', '............', '............', '............', '............',
    '......HHHH..', '..TJJJHhhHM.', '.JJJJJJHHSM.', '.PJJNNJJJS..', 'PPJJJJJJJS..', 'PP.pp...SS..', 'KK.kk...G...', 'K...kk......', 'BB..bbb.....', '............', '............', '............'],
  dive: ['............', '............', '............', '............', '............', '............', '............',
    '.........HHH', 'BKKPPJJJHHhM', 'bkkPPJNNJHSM', '...ppJJJJGSG', '............', '............', '............', '............', '............', '............', '............'],
  down: ['............', '............', '............', '............', '............', '............', '............', '............', '............', '............', '............',
    '.....SG..HHH', 'BKKPPJJJJHhM', 'bkkPPJNNJHSM', '............', '............', '............', '............'],
};

function frameRows(f: Frame): string[] {
  if (WHOLE[f]) return WHOLE[f];
  const pad = ['............', '............'];
  const legs = (k: string) => LEGS[k];
  switch (f) {
    case 'stand': return [...pad, ...HELMET, ...TORSO.idle, ...legs('stand'), '............', '............'];
    case 'crouch': return [...pad, '............', ...HELMET, ...TORSO.idle, ...legs('crouch'), '............'];
    case 'run0': case 'run1': case 'run2': case 'run3': { const i = +f.slice(3); return [...pad, ...(i % 2 ? ['............'] : []), ...HELMET, ...(i < 2 ? TORSO.runA : TORSO.runB), ...legs(`run${i}`), ...(i % 2 ? [] : ['............']), '............']; }
    case 'carry0': case 'carry1': case 'carry2': case 'carry3': { const i = +f.slice(5); return [...pad, ...(i % 2 ? ['............'] : []), ...HELMET, ...TORSO.carry, ...legs(`run${i}`), ...(i % 2 ? [] : ['............']), '............']; }
    case 'throwA': return [...pad, ...HELMET, ...TORSO.throwA, ...legs('stand'), '............', '............'];
    case 'throwB': return [...pad, ...HELMET, ...TORSO.throwB, ...legs('run0'), '............', '............'];
    case 'catch': return [...RAISE, ...HELMET, ...TORSO.up, ...legs('stand'), '............', '............'];
    case 'party0': return [...RAISE, ...HELMET, ...TORSO.up, ...legs('stand'), '............', '............'];
    case 'party1': return [...RAISE.map(r => r), ...HELMET, ...TORSO.up, ...legs('crouch'), '............', '............'].slice(0, 18);
    case 'block0': return [...pad, '............', ...HELMET, ...TORSO.fwd, ...legs('run0'), '............'];
    case 'block1': return [...pad, '............', ...HELMET, ...TORSO.fwd, ...legs('run2'), '............'];
    case 'kick': return [...pad, ...HELMET, ...TORSO.runB, ...legs('kick'), '............', '............'];
    case 'signal': return [...RAISE, ...HELMET, ...TORSO.up, ...legs('stand'), '............', '............'];
  }
  return [...pad, ...HELMET, ...TORSO.idle, ...legs('stand'), '............', '............'];
}

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const f = (c: number) => Math.round(Math.max(0, Math.min(255, k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
const cache = new Map<string, HTMLCanvasElement>();
export const SPRITE_W = 12, SPRITE_H = 18;

/** A cached sprite canvas for this kit, skin, frame and facing. Feet sit on row 16. */
export function sprite(kit: Kit, skin: string, f: Frame, flip: boolean, ref = false): HTMLCanvasElement {
  const key = `${kit.jersey}|${kit.num}|${kit.helmet}|${kit.pants}|${skin}|${f}|${flip ? 1 : 0}|${ref ? 1 : 0}`;
  const hit = cache.get(key); if (hit) return hit;
  const rows = frameRows(f);
  const W = SPRITE_W + 2, H = SPRITE_H + 2;   // 1px border for the outline
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const glove = kit.trim.toLowerCase() === '#ffffff' ? kit.jersey : kit.trim;
  const col: Record<string, string> = ref
    ? { H: '#1a1a1a', h: '#1a1a1a', M: '#1a1a1a', S: skin, J: '#f2f2f2', T: '#111', N: '#111', P: '#f2f2f2', p: '#111', K: '#111', B: '#111', G: '#111', F: '#7a3a12', W: '#fff' }
    : { H: kit.helmet, h: kit.trim, M: kit.mask, S: skin, J: kit.jersey, T: kit.trim, N: kit.num, P: kit.pants, p: kit.trim, K: kit.socks, B: '#141414', G: glove, F: '#7a3a12', W: '#ffffff' };
  const filled: boolean[][] = Array.from({ length: H }, () => Array(W).fill(false));
  rows.forEach((r, y) => [...r].forEach((ch, x0) => {
    if (ch === '.') return;
    const x = flip ? SPRITE_W - 1 - x0 : x0;
    const lower = ch >= 'a' && ch <= 'z' && ch !== 'h' && ch !== 'p';
    const base = col[lower ? ch.toUpperCase() : ch] ?? '#f0f';
    let fill = lower ? shade(base, -0.35) : base;
    if (ref && ch === 'J' && x0 % 2 === 0) fill = '#111';   // referee stripes
    g.fillStyle = fill; g.fillRect(x + 1, y + 1, 1, 1); filled[y + 1][x + 1] = true;
  }));
  // Top-left light: brighten the first lit pixel in each row of the helmet.
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (let y = 0; y < H; y++) { const x = filled[y].indexOf(true); if (x >= 0 && y < 9) g.fillRect(x, y, 1, 1); }
  // Outline.
  g.fillStyle = 'rgba(10,12,16,.92)';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (filled[y][x]) continue;
    if ((filled[y - 1]?.[x]) || (filled[y + 1]?.[x]) || filled[y][x - 1] || filled[y][x + 1]) g.fillRect(x, y, 1, 1);
  }
  cache.set(key, c);
  if (cache.size > 2500) cache.delete(cache.keys().next().value!);
  return c;
}
