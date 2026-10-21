// Procedural pixel-art footballers. Every figure is drawn from a tiny skeleton (hip, knees,
// feet, shoulders, hands, head) so one renderer covers running, kicking, sliding, diving,
// heading and celebrating, in any kit, skin tone and hairstyle.
import type { Club, Player } from '../core/types';
import { faceSpec } from './art';
import { luminance } from './art';
import type { KitPattern } from '../data/clubs';

export type Pose = 'idle' | 'run' | 'kick' | 'slide' | 'dive' | 'header' | 'celebrate' | 'slideCelebrate' | 'dejected' | 'lift' | 'wave' | 'jump';
export interface Look { shirt: string; trim: string; shorts: string; socks: string; skin: string; hair: string; hairStyle: number; stripes: boolean; gk: boolean; num: number; pattern: KitPattern; sleeve: string; beard: number }

export function lookFor(p: Player, club: Club | undefined, opts: { away?: boolean; gk?: boolean; gkColor?: string } = {}): Look {
  const f = faceSpec(p);
  const c1 = club ? (opts.away ? club.a1 : club.c1) : '#2b3550';
  const c2 = club ? (opts.away ? club.a2 : club.c2) : '#8fa3c7';
  const shirt = opts.gk ? (opts.gkColor ?? '#1ed760') : c1;
  const light = luminance(shirt) > 0.65;
  const home = !!club && !opts.away && !opts.gk;
  const pattern: KitPattern = home ? club!.kit : 'plain';
  return {
    shirt, trim: opts.gk ? '#111' : c2,
    shorts: opts.gk ? '#111' : home && club!.shorts ? club!.shorts : light ? '#1b2232' : (luminance(c2) > 0.7 ? '#f3f5f9' : c2),
    socks: opts.gk ? shirt : home && club!.socks ? club!.socks : c1, skin: f.skin, hair: f.hair, hairStyle: f.hairStyle,
    stripes: pattern === 'stripes' || pattern === 'pinstripe', gk: !!opts.gk, num: p.num, pattern, sleeve: pattern === 'sleeves' ? c2 : shirt, beard: f.beard,
  };
}

const OUT = '#0b0d14';
function shade(hex: string, k: number) {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Thick pixel line between two points (round caps). */
function seg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, c: string) {
  ctx.fillStyle = c;
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  const h = w / 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    ctx.fillRect(Math.round(x1 + (x2 - x1) * t - h), Math.round(y1 + (y2 - y1) * t - h), w, w);
  }
}

interface Skel { hip: [number, number]; kneeL: [number, number]; footL: [number, number]; kneeR: [number, number]; footR: [number, number]; sh: [number, number]; elL: [number, number]; handL: [number, number]; elR: [number, number]; handR: [number, number]; head: [number, number]; lean: number }

/** Joint positions in sprite space (feet at y=0, facing +x, figure ~40px tall). */
function skeleton(pose: Pose, phase: number, t: number): Skel {
  const S = Math.sin, C = Math.cos;
  let hipY = -18, lean = 0.06;
  let aL = 0, aR = 0, kL = 0.1, kR = 0.1;           // thigh angle (+ forward), knee bend
  let uL = 0.25, uR = -0.25, eL = 0.5, eR = 0.5;      // upper-arm angle (+ forward), elbow bend
  switch (pose) {
    case 'run': {
      const p = phase;
      aL = S(p) * 0.95; aR = -S(p) * 0.95;
      kL = 0.25 + Math.max(0, -C(p)) * 1.7; kR = 0.25 + Math.max(0, C(p)) * 1.7;
      uL = -S(p) * 1.0; uR = S(p) * 1.0; eL = 1.4; eR = 1.4;
      lean = 0.32; hipY = -17.5 + Math.abs(C(p)) * 1.4;
      break;
    }
    case 'idle': { const b = S(phase * 0.5) * 0.3; hipY = -18 + b; aL = 0.14; aR = -0.1; kL = 0.2; kR = 0.15; uL = 0.15; uR = -0.12; eL = 0.4; eR = 0.35; lean = 0.08; break; }
    case 'kick': {
      const wind = t < 0.35, k = wind ? t / 0.35 : Math.min(1, (t - 0.35) / 0.3);
      aR = wind ? -0.9 * k : -0.9 + 2.4 * k; kR = wind ? 1.8 * k : Math.max(0.05, 1.8 - k * 2.2);
      aL = -0.2; kL = 0.35; uL = 1.3; uR = -1.1; eL = 0.3; eR = 0.6; lean = wind ? 0.1 : -0.15; hipY = -17.5; break;
    }
    case 'slide': { hipY = -6; aL = 1.5; aR = 1.25; kL = 0.05; kR = 0.7; uL = -2.2; uR = 0.9; eL = 0.2; eR = 0.4; lean = -1.0; break; }
    case 'dive': { hipY = -12; aL = 0.35; aR = -0.25; kL = 0.4; kR = 0.6; uL = 2.9; uR = 3.05; eL = 0.1; eR = 0.1; lean = -1.3; break; }
    case 'header': { hipY = -20; aL = 0.6; aR = -0.4; kL = 1.6; kR = 1.2; uL = 1.0; uR = -1.3; eL = 0.6; eR = 0.6; lean = 0.45; break; }
    case 'celebrate': { const j = Math.abs(S(phase * 1.3)); hipY = -18 - j * 2; aL = 0.3; aR = -0.25; kL = 0.35 + j * 0.6; kR = 0.3; uL = 2.5; uR = -2.5; eL = -0.3; eR = -0.3; lean = -0.12; break; }
    case 'slideCelebrate': { hipY = -9; aL = 1.55; aR = 1.55; kL = 2.9; kR = 2.9; uL = 2.4; uR = -2.4; eL = -0.2; eR = -0.2; lean = -0.3; break; }
    case 'dejected': { hipY = -16.5; aL = 0.3; aR = -0.05; kL = 0.6; kR = 0.5; uL = 0.7; uR = 0.6; eL = 0.1; eR = 0.1; lean = 0.85; break; }
    case 'lift': { const j = Math.abs(S(phase)); hipY = -18 - j * 1.2; uL = 2.95; uR = -2.95; eL = 0.05; eR = 0.05; aL = 0.12; aR = -0.12; kL = 0.2; kR = 0.2; lean = -0.05; break; }
    case 'wave': { uL = 2.6; eL = -0.4 + S(phase * 3) * 0.5; uR = -0.2; eR = 0.4; aL = 0.1; aR = -0.1; break; }
    case 'jump': { const j = Math.abs(S(phase * 1.2)); hipY = -18 - j * 5; aL = 0.45; aR = -0.3; kL = 0.8 + j; kR = 0.7 + j; uL = 2.6; uR = -2.6; eL = -0.3; eR = -0.3; break; }
  }
  const hip: [number, number] = [0, hipY];
  const th = 8.5, sh = 9;
  const leg = (a: number, k: number): [[number, number], [number, number]] => {
    const knee: [number, number] = [hip[0] + S(a) * th, hip[1] + C(a) * th];
    const b = a - k;
    return [knee, [knee[0] + S(b) * sh, knee[1] + C(b) * sh]];
  };
  const [kneeL, footL] = leg(aL, kL);
  const [kneeR, footR] = leg(aR, kR);
  const torso = 12.5;
  const shp: [number, number] = [hip[0] + S(lean) * torso, hip[1] - C(lean) * torso];
  const arm = (u: number, e: number): [[number, number], [number, number]] => {
    const el: [number, number] = [shp[0] + S(u + lean * 0.4) * 6, shp[1] + 1 + C(u + lean * 0.4) * 6];
    const fa = u + lean * 0.4 + e;
    return [el, [el[0] + S(fa) * 5.5, el[1] + C(fa) * 5.5]];
  };
  const [elL, handL] = arm(uL, eL);
  const [elR, handR] = arm(uR, eR);
  const head: [number, number] = [shp[0] + S(lean) * 6.5, shp[1] - C(lean) * 6.5];
  return { hip, kneeL, footL, kneeR, footR, sh: shp, elL, handL, elR, handR, head, lean };
}

/** Crisp tapered torso: scanlines from the waist to the shoulders. */
/** Kit pattern painted over the torso scanlines: stripes, hoops, bands, sashes, halves. */
function kitPattern(ctx: CanvasRenderingContext2D, hip: [number, number], sh: [number, number], look: Look) {
  const p = look.pattern;
  if (p === 'plain' || p === 'sleeves' || look.gk) return;
  const n = Math.max(1, Math.ceil(Math.hypot(sh[0] - hip[0], sh[1] - hip[1])));
  ctx.fillStyle = look.trim;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = hip[0] + (sh[0] - hip[0]) * t, cy = Math.round(hip[1] + (sh[1] - hip[1]) * t);
    const hw = Math.round((7 + 3 * Math.min(1, t * 1.25)) / 2);
    const x0 = Math.round(cx - hw);
    for (let k = 0; k < hw * 2; k++) {
      const u = k / (hw * 2);
      let on = false;
      if (p === 'stripes') on = (k + 1) % 4 < 2;
      else if (p === 'pinstripe') on = k % 3 === 1;
      else if (p === 'hoops') on = (i + 1) % 4 < 2;
      else if (p === 'halves' || p === 'quarters') on = u > 0.5;
      else if (p === 'band') on = u > 0.38 && u < 0.66;
      else if (p === 'hband') on = t > 0.45 && t < 0.68;
      else if (p === 'sash') on = Math.abs(u - (1 - t)) < 0.18;
      else if (p === 'chevron') on = Math.abs(t - 0.6 - Math.abs(u - 0.5) * 0.5) < 0.09;
      else if (p === 'yoke') on = t > 0.82;
      if (on) ctx.fillRect(x0 + k, cy, 1, 1);
    }
  }
}

function torsoFill(ctx: CanvasRenderingContext2D, hip: [number, number], sh: [number, number], wHip: number, wSh: number, c: string, light?: string, dark?: string) {
  const n = Math.max(1, Math.ceil(Math.hypot(sh[0] - hip[0], sh[1] - hip[1])));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = hip[0] + (sh[0] - hip[0]) * t, cy = hip[1] + (sh[1] - hip[1]) * t;
    const hw = (wHip + (wSh - wHip) * Math.min(1, t * 1.25)) / 2;
    ctx.fillStyle = c; ctx.fillRect(Math.round(cx - hw), Math.round(cy), Math.round(hw * 2), 1);
    if (dark) { ctx.fillStyle = dark; ctx.fillRect(Math.round(cx - hw), Math.round(cy), 2, 1); }
    if (light) { ctx.fillStyle = light; ctx.fillRect(Math.round(cx + hw - 2), Math.round(cy), 1, 1); }
  }
}

/**
 * Draw a footballer with feet at (x, y). `facing` 1 = right, -1 = left. `px` scales the sprite
 * (1 on the low-res match canvas, bigger for cutscenes).
 */
export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, look: Look, pose: Pose, phase: number, t: number, facing: 1 | -1, px = 1, rot = 0) {
  const sk = skeleton(pose, phase, t);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facing * px, px);
  if (rot) ctx.rotate(rot);
  const skinD = shade(look.skin, 0.75), skinL = shade(look.skin, 1.1);
  const shirtD = shade(look.shirt, 0.7), shirtL = shade(look.shirt, 1.18);
  const shortsD = shade(look.shorts, 0.72);
  const sockD = shade(look.socks, 0.7);
  const glove = '#eef2f8';
  const boot = (f: [number, number], back: boolean) => {
    seg(ctx, f[0] - 1, f[1] - 0.5, f[0] + 3, f[1] - 0.5, 4, OUT);
    seg(ctx, f[0] - 0.5, f[1] - 1, f[0] + 2.5, f[1] - 1, 2, back ? '#1a1d26' : '#2b2f3c');
    ctx.fillStyle = back ? '#555' : '#e8e8e8'; ctx.fillRect(Math.round(f[0] + 2), Math.round(f[1] - 1), 1, 1);
  };
  const legDraw = (knee: [number, number], foot: [number, number], back: boolean) => {
    seg(ctx, sk.hip[0], sk.hip[1], knee[0], knee[1], 7, OUT);
    seg(ctx, knee[0], knee[1], foot[0], foot[1], 6, OUT);
    // thigh: shorts down to mid-thigh, then skin
    const mx = sk.hip[0] + (knee[0] - sk.hip[0]) * 0.55, my = sk.hip[1] + (knee[1] - sk.hip[1]) * 0.55;
    seg(ctx, sk.hip[0], sk.hip[1], mx, my, 5, back ? shortsD : look.shorts);
    seg(ctx, mx, my, knee[0], knee[1], 4, back ? skinD : look.skin);
    // shin: sock from below the knee
    const sx = knee[0] + (foot[0] - knee[0]) * 0.2, sy = knee[1] + (foot[1] - knee[1]) * 0.2;
    seg(ctx, knee[0], knee[1], sx, sy, 4, back ? skinD : look.skin);
    seg(ctx, sx, sy, foot[0], foot[1], 4, back ? sockD : look.socks);
    if (!back) { ctx.fillStyle = sockD; ctx.fillRect(Math.round(sx - 2), Math.round(sy), 1, Math.max(1, Math.round(foot[1] - sy - 1))); }
    boot(foot, back);
  };
  const armDraw = (el: [number, number], hand: [number, number], back: boolean) => {
    seg(ctx, sk.sh[0], sk.sh[1] + 1.5, el[0], el[1], 6, OUT);
    seg(ctx, el[0], el[1], hand[0], hand[1], 5, OUT);
    seg(ctx, sk.sh[0], sk.sh[1] + 1.5, el[0], el[1], 4, back ? shade(look.sleeve, 0.72) : look.sleeve);
    const sl = look.gk ? 1 : 0.35;
    const mx = el[0] + (hand[0] - el[0]) * sl, my = el[1] + (hand[1] - el[1]) * sl;
    if (look.gk) seg(ctx, el[0], el[1], hand[0], hand[1], 3, back ? shirtD : look.shirt);
    else if (look.pattern === 'sleeves') seg(ctx, el[0], el[1], el[0] + (hand[0] - el[0]) * 0.3, el[1] + (hand[1] - el[1]) * 0.3, 3, back ? shade(look.sleeve, 0.72) : look.sleeve);
    else seg(ctx, el[0], el[1], hand[0], hand[1], 3, back ? skinD : look.skin);
    void mx; void my;
    ctx.fillStyle = OUT; ctx.fillRect(Math.round(hand[0] - 2), Math.round(hand[1] - 2), 4, 4);
    ctx.fillStyle = look.gk ? glove : back ? skinD : look.skin; ctx.fillRect(Math.round(hand[0] - 1), Math.round(hand[1] - 1), look.gk ? 3 : 2, look.gk ? 3 : 2);
  };
  // back limbs
  armDraw(sk.elL, sk.handL, true);
  legDraw(sk.kneeL, sk.footL, true);
  // torso with outline, shading and kit detail
  torsoFill(ctx, [sk.hip[0], sk.hip[1] + 1], [sk.sh[0], sk.sh[1] - 1], 9, 12, OUT);
  torsoFill(ctx, sk.hip, sk.sh, 7, 10, look.shirt, shirtL, shirtD);
  kitPattern(ctx, sk.hip, sk.sh, look);
  // collar & sleeve trim
  ctx.fillStyle = look.trim; ctx.fillRect(Math.round(sk.sh[0] - 1), Math.round(sk.sh[1]), 4, 1);
  // shorts block
  torsoFill(ctx, [sk.hip[0], sk.hip[1] + 3], [sk.hip[0], sk.hip[1] - 1], 9, 9, OUT);
  torsoFill(ctx, [sk.hip[0], sk.hip[1] + 2], [sk.hip[0], sk.hip[1]], 7, 7, look.shorts, undefined, shortsD);
  // front leg & arm
  legDraw(sk.kneeR, sk.footR, false);
  armDraw(sk.elR, sk.handR, false);
  // neck and head
  const [hx, hy] = sk.head;
  seg(ctx, sk.sh[0] + 0.5, sk.sh[1] + 0.5, hx, hy + 3, 4, OUT);
  seg(ctx, sk.sh[0] + 0.5, sk.sh[1] + 0.5, hx, hy + 3, 2, skinD);
  headDraw(ctx, hx, hy - 1, look, skinD, skinL, pose);
  // shirt number on the back for cutscene-size sprites
  if (px >= 3) { ctx.fillStyle = look.trim; ctx.font = 'bold 5px monospace'; ctx.textAlign = 'center'; ctx.save(); ctx.scale(facing, 1); ctx.fillText(String(look.num), facing * ((sk.hip[0] + sk.sh[0]) / 2 - 2), (sk.hip[1] + sk.sh[1]) / 2 + 2); ctx.restore(); }
  ctx.restore();
}

// Hand-drawn head templates (side profile facing right). Canvas rows 0-1 are headroom for hair.
// o outline · s skin · d shade · l light · e eye white · p pupil · b brow · m mouth · n nose
const BASE = [
  '..............',
  '..............',
  '....ooooo.....',
  '..oolsssssoo..',
  '.olssssssssso.',
  '.osssssssssso.',
  'ossssssssbbsso',
  'ossdssssssepso',
  'osddsssssssssn',
  'ossdsssssssso.',
  'osssssssssmso.',
  '.osssssssssso.',
  '.oddssssssso..',
  '..oddssssoo...',
  '....ooooo.....',
];
// h hair · H highlight · o outline · x shaved (hair blended into skin) · S skin (forehead restore)
const HAIR: Record<number, string[]> = {
  1: ['..............', '..............', '...oooooo.....', '..ohhhhhhoo...', '.ohhhHHhhhho..', '.ohhhhhhhhhho.', 'ohhhhhh.......', 'ohhh..........', 'ohh...........'],
  2: ['..............', '...ooooooo....', '..ohhhhHHhoo..', '.ohhhhhhhhhho.', 'ohhhhhhhhhhhho', 'ohhhhhhhhhhho.', 'ohhhhh..hho...', 'ohhh..........', 'ohh...........'],
  3: ['.......oooo...', '....oooHHhho..', '..oohhhhhhhho.', '.ohhhhhhhhhhho', '.ohhhhhhhhhho.', 'ohhhhhhhh.....', 'ohhhh.........', 'ohh...........', 'oh............'],
  4: ['..............', '...ooooooo....', '..ohhhhHHhoo..', '.ohhhhhhhhhho.', 'ohhhhhhhhhhhho', 'ohhhhhhhh.....', 'ohhhh.........', 'ohhhh.........', 'ohhhh.........', 'ohhhho........', 'ohhhho........', '.ohhho........', '..oo..........'],
  5: ['...oooooooo...', '.oohhhhHHhhoo.', 'ohhhhhhhhhhhho', 'ohhhhhHhhhhhho', 'ohhhhhhhhhhhho', 'ohhhhhhhhhhho.', 'ohhhhhhh......', 'ohhhh.........', 'ohhh..........', '.ohh..........'],
  6: ['...o.o.o.o....', '..ohohohoho...', '.ohhhhhhhhhoo.', '.ohhhhhhhhhhho', '.ohhhhhhhhhho.', 'ohhhhhhh......', 'ohhh..........', 'ohh...........', 'oh............'],
  7: ['......ooo.....', '.....ohhHo....', '....ohhhhho...', '..xxhhhhhhxx..', '.xxxxxhhhxxxx.', '.xxxxxxxxxxxx.', 'xxxxxx........', 'xxx...........', 'xx............'],
  0: ['..............', '..............', '..............', '..xxxxxxxx....', '.xxxxxxxxxxx..', '.xxxxxxxxxxxx.', 'xxxxxx........', 'xxx...........', 'xx............'],
  8: [],
};
const BEARD: Record<number, string[]> = {
  1: ['', '', '', '', '', '', '', '', '', '', '', '', '...yyyyyyy....', '....yyyyy.....'],
  2: ['', '', '', '', '', '', '', '', '', '...h..........', '...hh.........', '..hhhhhhhh....', '..hhhhhhhhh...', '....hhhhhh....'],
  3: ['', '', '', '', '', '', '', '', '', '', '', '.........hh...', '........hhh...', '.........h....'],
};

function headDraw(ctx: CanvasRenderingContext2D, cx: number, cy: number, look: Look, skinD: string, skinL: string, pose: Pose) {
  const x0 = Math.round(cx) - 6, y0 = Math.round(cy) - 9;
  const open = pose === 'celebrate' || pose === 'slideCelebrate' || pose === 'lift' || pose === 'jump';
  const shaved = mix(look.skin, look.hair, 0.55);
  const stubble = mix(look.skin, look.hair, 0.22);
  const hairHi = shade(look.hair, look.hair === '#111' || look.hair === '#1d140e' ? 2.2 : 1.35);
  const brow = look.hair === '#e8d08a' ? '#9c6b3c' : look.hair;
  const col: Record<string, string> = { o: OUT, s: look.skin, d: skinD, l: skinL, e: '#ffffff', p: '#1a1208', b: brow, m: open ? '#5a1a1a' : shade(look.skin, 0.5), n: look.skin };
  for (let r = 0; r < BASE.length; r++) {
    const row = BASE[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      ctx.fillStyle = col[ch]; ctx.fillRect(x0 + c, y0 + r, 1, 1);
    }
  }
  if (open) { ctx.fillStyle = '#5a1a1a'; ctx.fillRect(x0 + 10, y0 + 10, 2, 2); ctx.fillStyle = '#fff'; ctx.fillRect(x0 + 10, y0 + 10, 2, 1); }
  const paint = (grid: string[] | undefined) => {
    if (!grid) return;
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        ctx.fillStyle = ch === 'h' ? look.hair : ch === 'H' ? hairHi : ch === 'x' ? shaved : ch === 'y' ? stubble : ch === 'o' ? OUT : look.skin;
        ctx.fillRect(x0 + c, y0 + r, 1, 1);
      }
    }
  };
  paint(HAIR[look.hairStyle] ?? HAIR[1]);
  if (look.hairStyle === 8) { ctx.fillStyle = skinL; ctx.fillRect(x0 + 5, y0 + 3, 3, 1); }
  if (look.beard) paint(BEARD[look.beard]);
}
function mix(a: string, b: string, k: number) {
  if (!a.startsWith('#') || !b.startsWith('#')) return a;
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** Little pixel trophy for cutscenes. */
export function drawTrophy(ctx: CanvasRenderingContext2D, x: number, y: number, px: number) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(px, px);
  const G = '#f5c542', D = '#b8871b', L = '#fff4c4';
  ctx.fillStyle = OUT; ctx.fillRect(-6, -18, 12, 10); ctx.fillRect(-3, -9, 6, 6); ctx.fillRect(-5, -4, 10, 4);
  ctx.fillStyle = G; ctx.fillRect(-5, -17, 10, 8); ctx.fillRect(-2, -9, 4, 5); ctx.fillRect(-4, -3, 8, 2);
  ctx.fillStyle = D; ctx.fillRect(2, -17, 3, 8);
  ctx.fillStyle = L; ctx.fillRect(-4, -16, 2, 4);
  ctx.fillStyle = G; ctx.fillRect(-8, -16, 3, 2); ctx.fillRect(-8, -14, 2, 3); ctx.fillRect(5, -16, 3, 2); ctx.fillRect(6, -14, 2, 3);
  ctx.restore();
}
