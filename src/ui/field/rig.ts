// The players, drawn as pixel art from a skeleton. Every pose is a set of joint angles
// (side view, facing right); the rasterizer stamps helmet, pads, jersey, pants, socks,
// cleats, arms and the ball straight into a small pixel grid, then outlines and shades it.
// Because each frame is drawn from the pose rather than picked from a sheet, motion is
// continuous: run cycles at any speed, hands that reach for the actual ball, bodies that
// tip over cleanly when tackled (no rotated sprites), smooth blends between actions.
import type { Kit } from './pixel';

export interface RigPose {
  hipX: number; hipY: number;        // pelvis above the feet anchor (rig px, y up)
  lean: number;                      // torso from vertical, + forward
  nt: number; nk: number;            // near leg: thigh angle (+ forward), knee bend
  ft: number; fk: number;            // far leg
  na: number; ne: number;            // near arm: upper-arm angle (+ forward, π = straight up), elbow bend
  fa: number; fe: number;            // far arm
  nf?: number; ff?: number;          // ankle flex (+ toes down)
  rot: number; pivot: 0 | 1;         // whole-body rotation (+ = tipping forward) about the feet (0) or hips (1)
  lift: number;                      // off the ground (rig px)
  ball: 0 | 1 | 2 | 3;               // ball in the near hand, both hands at the chest, or tucked high and tight
  look?: number;                     // head tilt
}
export type Build = 'line' | 'skill' | 'qb' | 'k' | 'ref' | 'civ';

interface Dim { th: number; sh: number; ft: number; to: number; ua: number; fa: number; hr: number; sw: number; ww: number; tr: number; srr: number; ar: number }
const DIM: Record<Build, Dim> = {
  skill: { th: 7, sh: 7, ft: 3, to: 9, ua: 4.8, fa: 4.6, hr: 4.4, sw: 10.5, ww: 7, tr: 1.9, srr: 1.35, ar: 1.25 },
  qb: { th: 7, sh: 7, ft: 3, to: 9, ua: 4.8, fa: 4.6, hr: 4.4, sw: 10, ww: 6.8, tr: 1.8, srr: 1.3, ar: 1.2 },
  k: { th: 7, sh: 7, ft: 3, to: 8.5, ua: 4.6, fa: 4.4, hr: 4.2, sw: 9, ww: 6.4, tr: 1.7, srr: 1.25, ar: 1.15 },
  line: { th: 6.3, sh: 6, ft: 3.2, to: 9.5, ua: 4.8, fa: 4.6, hr: 4.6, sw: 14, ww: 12, tr: 2.8, srr: 2.0, ar: 1.8 },
  civ: { th: 7, sh: 7, ft: 3, to: 9.5, ua: 5, fa: 5, hr: 3.3, sw: 8.4, ww: 6.6, tr: 1.6, srr: 1.2, ar: 1.1 },
  ref: { th: 7, sh: 7, ft: 3, to: 9.5, ua: 5, fa: 5, hr: 3.3, sw: 8.4, ww: 6.6, tr: 1.6, srr: 1.2, ar: 1.1 },
};
export const STAND_HIP = 15;

export const W = 60, H = 52, AX = 30, AY = 47;   // grid and the feet anchor inside it

// ---- palette ---------------------------------------------------------------------------------
const hex = (h: string): [number, number, number] => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const shade = (c: [number, number, number], k: number): [number, number, number] => c.map(v => Math.round(Math.max(0, Math.min(255, k < 0 ? v * (1 + k) : v + (255 - v) * k)))) as [number, number, number];
// Colour slots; each has a far (shaded) twin at +16 and a lit twin at +32.
const enum C { HELM = 1, STRIPE, MASK, SKIN, JER, TRIM, NUM, PANT, SOCK, SHOE, GLOVE, BALL, LACE, CAP, SHIRT2, DARK, SLEEVE, SLEEVE2, TIGHT, MOUTH, VISOR, TOWEL, BAND, EDGE }
const FAR = 32;

// ---- geometry ---------------------------------------------------------------------------------
type P = [number, number];
const add = (a: P, l: number, ang: number): P => [a[0] + l * Math.sin(ang), a[1] - l * Math.cos(ang)];   // y up, angle from straight down

function joints(p: RigPose, d: Dim) {
  const hip: P = [p.hipX, p.hipY];
  const up = (l: number, ang: number, from: P): P => [from[0] + l * Math.sin(ang), from[1] + l * Math.cos(ang)];
  const neck = up(d.to, p.lean, hip);
  const shoulder = up(d.to - 2.2, p.lean, hip);
  const head = up(d.hr * 0.95, p.lean * 0.8 + (p.look ?? 0), neck);
  const leg = (t: number, k: number, fl = 0) => { const knee = add(hip, d.th, t); const ank = add(knee, d.sh, t - k); const toe = add(ank, d.ft, t - k + Math.PI / 2 - fl); return { knee, ank, toe }; };
  const arm = (a: number, e: number) => { const el = add(shoulder, d.ua, a); const hand = add(el, d.fa, a + e); return { el, hand }; };
  return { hip, neck, shoulder, head, nl: leg(p.nt, p.nk, p.nf ?? 0), fl: leg(p.ft, p.fk, p.ff ?? 0), na: arm(p.na, p.ne), fa: arm(p.fa, p.fe) };
}

// ---- rasterizer -------------------------------------------------------------------------------
class Grid {
  a = new Uint8Array(W * H);
  // world (rig px, y up, anchor at the feet) -> grid
  set(x: number, y: number, c: number) { const gx = Math.round(AX + x), gy = Math.round(AY - y); if (gx >= 0 && gx < W && gy >= 0 && gy < H) this.a[gy * W + gx] = c; }
  get(gx: number, gy: number) { return gx >= 0 && gx < W && gy >= 0 && gy < H ? this.a[gy * W + gx] : 0; }
  disk(cx: number, cy: number, r: number, c: number) {
    const r2 = r * r + 0.35;
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) this.set(x, y, c);
  }
  line(a: P, b: P, r: number, c: number) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
    for (let i = 0; i <= n; i++) { const t = i / n; this.disk(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r, c); }
  }
  poly(pts: P[], c: number) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; }
      if (inside) this.set(x, y, c);
    }
  }
}

function rotate(pt: P, piv: P, r: number): P { const x = pt[0] - piv[0], y = pt[1] - piv[1]; return [piv[0] + x * Math.cos(r) + y * Math.sin(r), piv[1] - x * Math.sin(r) + y * Math.cos(r)]; }

/** What a player wears beyond the uniform: picked per player and kept for good. */
export interface Gear { sleeve: number; full: boolean; glove: number; tights: number; mouth: number; visor: number; towel: boolean; band: boolean; elbow: boolean; cleat: number }
const hashS = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
export function gearFor(id: string, b: Build): Gear {
  const h = hashS(id || 'x'), r = (k: number, n: number) => (Math.floor(h / (k * 7 + 1)) + k * 13) % n;
  const line = b === 'line', q = b === 'qb', k = b === 'k';
  return {
    sleeve: k ? 0 : [0, 0, 1, 1, 2, 3, 1, 0][r(1, 8)],       // none / black / white / team
    full: r(2, 3) > 0,
    glove: k ? 1 : [0, 0, 1, 2, 3, 0][r(3, 6)],               // trim / white / black / jersey
    tights: line ? [0, 0, 1][r(4, 3)] : [0, 0, 0, 1, 2][r(4, 5)],
    mouth: q || k ? 0 : [0, 0, 1, 2, 3, 4][r(5, 6)],           // none / black / white / team / neon
    visor: line ? 0 : [0, 0, 0, 1, 2][r(6, 5)],               // none / dark / iridescent
    towel: !line && !k && r(7, 3) === 0,
    band: r(8, 3) === 0,
    elbow: line ? r(9, 2) === 0 : false,
    cleat: [0, 0, 1, 2][r(10, 4)],                            // black / white / team
  };
}
const NO_GEAR: Gear = { sleeve: 0, full: false, glove: 0, tights: 0, mouth: 0, visor: 0, towel: false, band: false, elbow: false, cleat: 0 };

function rasterize(p: RigPose, b: Build, gear: Gear): Grid {
  const d = DIM[b], g = new Grid();
  const J = joints(p, d);
  const piv: P = p.pivot ? J.hip : [0, 0];
  const R = (q: P): P => { const r = p.rot ? rotate(q, piv, p.rot) : q; return [r[0], r[1] + p.lift]; };
  const hip = R(J.hip), neck = R(J.neck), sh = R(J.shoulder), head = R(J.head);
  const L = (l: typeof J.nl) => ({ knee: R(l.knee), ank: R(l.ank), toe: R(l.toe) });
  const A = (a: typeof J.na) => ({ el: R(a.el), hand: R(a.hand) });
  const nl = L(J.nl), fl = L(J.fl), na = A(J.na), fa = A(J.fa);
  const far = FAR;
  const ref = b === 'ref' || b === 'civ';
  const lerpP = (a: P, c: P, t: number): P => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
  const drawLeg = (l: ReturnType<typeof L>, o: number) => {
    if (!o) { g.line(hip, l.knee, d.tr + 0.55, C.EDGE); g.line(l.knee, l.ank, d.srr + 0.55, C.EDGE); }
    g.line(hip, l.knee, d.tr, C.PANT + o);
    const pantEnd = lerpP(l.knee, l.ank, 0.22);
    g.line(l.knee, pantEnd, d.srr + 0.1, C.PANT + o);
    if (ref) g.line(pantEnd, l.ank, d.srr, C.DARK + o);
    else {
      g.line(pantEnd, l.ank, d.srr, (gear.tights ? C.TIGHT : C.SOCK) + o);
      if (!gear.tights) g.disk(...lerpP(l.knee, l.ank, 0.42), d.srr, C.TRIM + o);   // sock stripe
    }
    g.line(l.ank, l.toe, 1.0, C.SHOE + o);
  };
  const drawArm = (a: ReturnType<typeof A>, o: number) => {
    const sl = lerpP(sh, a.el, 0.42);
    if (!o) { g.line(sh, a.el, d.ar + 0.9, C.EDGE); g.line(a.el, a.hand, d.ar + 0.5, C.EDGE); g.disk(a.hand[0], a.hand[1], 1.6, C.EDGE); }
    g.line(sh, sl, d.ar + 0.35, C.JER + o);                     // jersey sleeve over the pads
    if (!ref) g.disk(sl[0], sl[1], d.ar + 0.1, C.TRIM + o);
    g.line(sl, a.el, d.ar, (gear.sleeve ? C.SLEEVE : C.SKIN) + o);
    if (gear.elbow) g.disk(a.el[0], a.el[1], d.ar + 0.3, C.SLEEVE2 + o);
    g.line(a.el, a.hand, d.ar - 0.1, (gear.sleeve && gear.full ? C.SLEEVE : C.SKIN) + o);
    if (gear.band) g.disk(...lerpP(a.el, a.hand, 0.8), d.ar, C.BAND + o);
    g.disk(a.hand[0], a.hand[1], ref ? 0.8 : 1.05, (ref ? C.SKIN : C.GLOVE) + o);
  };
  const drawBall = () => {
    if (!p.ball) return;
    let bp: P, ang = 0;
    if (p.ball === 2) bp = [(na.hand[0] + fa.hand[0]) / 2 + 0.4, (na.hand[1] + fa.hand[1]) / 2];
    else if (p.ball === 3) { const t = lerpP(na.el, na.hand, 0.5); bp = [t[0] + 0.8, t[1] + 0.6]; ang = 0.35; }
    else bp = [na.hand[0] + 0.5, na.hand[1] + 0.3];
    const dx = Math.cos(ang) * 1.6, dy = Math.sin(ang) * 1.6;
    g.line([bp[0] - dx, bp[1] - dy], [bp[0] + dx, bp[1] + dy], 1.2, C.BALL);
    g.set(bp[0], bp[1] + 0.6, C.LACE); g.set(bp[0] + 1, bp[1] + 0.6, C.LACE);
  };
  drawArm(fa, far); drawLeg(fl, far);
  // Torso: pants at the hips, the jersey up to padded shoulders; linemen carry a belly.
  const ang = Math.atan2(neck[0] - hip[0], neck[1] - hip[1]);
  const px = Math.cos(ang), py = -Math.sin(ang);
  const at = (k: number, wf: number, wb = wf): [P, P] => { const c: P = [hip[0] + (neck[0] - hip[0]) * k, hip[1] + (neck[1] - hip[1]) * k]; return [[c[0] + px * wf / 2, c[1] + py * wf / 2], [c[0] - px * wb / 2, c[1] - py * wb / 2]]; };
  const belly = b === 'line' ? 1.3 : 0;
  const [h1, h2] = at(-0.1, d.ww), [b1, b2] = at(0.22, d.ww + belly * 0.6, d.ww), [g1, g2] = at(0.45, d.ww + belly, d.ww + 0.3), [s1, s2] = at(0.86, d.sw), [t1, t2] = at(0.98, d.sw - 2.6);
  g.poly([h1, b1, b2, h2], C.PANT);
  g.poly([b1, g1, s1, t1, t2, s2, g2, b2], b === 'ref' ? C.SHIRT2 : C.JER);
  if (b === 'ref') { for (let k = 0; k < 6; k++) { const [a1, a2] = at(0.3 + k * 0.12, d.sw - 0.5); g.line(a1, a2, 0.3, k % 2 ? C.SHIRT2 : C.DARK); } }
  else {
    g.line(b1, b2, 0.45, C.TRIM);                      // jersey hem / belt
    if (gear.towel) { const t0 = lerpP(b1, b2, 0.3); g.line(t0, [t0[0] + 0.3, t0[1] - 3.2], 0.7, C.TOWEL); }
    const sh0 = lerpP(s1, s2, 0.5); g.line(sh0, lerpP(t1, t2, 0.5), 0.5, C.NUM);   // shoulder number stripe
  }
  if (p.ball === 3) drawBall();          // tucked: the forearm wraps over it
  drawLeg(nl, 0);
  // Helmet: shell, centre stripe, facemask, a sliver of face (or a visor), maybe a mouthguard.
  const hr = d.hr, hx = head[0], hy = head[1];
  if (ref) {
    g.disk(hx, hy, hr, C.SKIN);
    g.line([hx - hr, hy + 1], [hx + hr + 1.2, hy + 1], 0.6, C.CAP); g.disk(hx - 0.3, hy + 1.6, hr * 0.85, C.CAP);
  } else {
    const fr = (p.rot || 0) + ang * 0.7, fx = Math.cos(fr), fy = Math.sin(fr);
    const H2 = (u: number, v: number): P => [hx + u * fx + v * fy, hy - u * fy + v * fx];   // helmet frame: u forward, v up
    g.disk(hx, hy, hr + 0.75, C.EDGE);
    g.disk(hx, hy, hr, C.HELM);
    for (let u = -hr * 0.55; u <= hr * 0.35; u += 0.5) g.set(...H2(u, hr - 1.3 - Math.abs(u) * 0.15), C.STRIPE);
    g.disk(...H2(hr - 0.7, -0.4), 1.0, gear.visor ? C.VISOR : C.SKIN);
    g.line(H2(hr + 0.4, 0.8), H2(hr + 0.4, -hr + 0.5), 0.45, C.MASK);
    g.line(H2(hr - 0.5, -0.9), H2(hr + 0.7, -0.9), 0.4, C.MASK);
    g.line(H2(hr - 0.6, -hr + 0.6), H2(hr + 0.6, -hr + 0.6), 0.4, C.MASK);
    if (gear.mouth) g.line(H2(hr + 0.3, -hr + 0.2), H2(hr + 0.6, -hr - 1.3), 0.45, C.MOUTH);
  }
  drawArm(na, 0);
  if (p.ball !== 3) drawBall();
  return g;
}

// ---- colour, outline, light ------------------------------------------------------------------
function paint(g: Grid, kit: Kit, skin: string, ref: boolean, civ: boolean, gear: Gear): HTMLCanvasElement {
  const team = kit.jersey.toLowerCase() === '#f3f3f1' ? kit.num : kit.jersey;
  const pick = (i: number, opts: string[]) => opts[i] ?? opts[0];
  const base: Record<number, [number, number, number]> = {
    [C.HELM]: hex(kit.helmet), [C.STRIPE]: hex(kit.trim), [C.MASK]: hex(kit.mask), [C.SKIN]: hex(skin), [C.JER]: hex(ref ? '#f2f2f2' : kit.jersey), [C.CAP]: hex(civ ? '#2a1d14' : '#161616'), [C.TRIM]: hex(kit.trim),
    [C.NUM]: hex(kit.num), [C.PANT]: hex(ref ? '#1c1c1c' : kit.pants), [C.SOCK]: hex(kit.socks), [C.SHOE]: hex(ref ? '#111111' : pick(gear.cleat, ['#151515', '#f2f2f2', team])),
    [C.GLOVE]: hex(pick(gear.glove, [kit.trim.toLowerCase() === '#ffffff' ? '#e8e8e8' : kit.trim, '#f2f2f2', '#1a1a1a', team])),
    [C.BALL]: hex('#7a3a12'), [C.LACE]: hex('#ffffff'), [C.SHIRT2]: hex('#f2f2f2'), [C.DARK]: hex('#141414'),
    [C.SLEEVE]: hex(pick(gear.sleeve, ['#000000', '#151515', '#f2f2f2', team])), [C.SLEEVE2]: hex('#1a1a1a'), [C.TIGHT]: hex(gear.tights === 2 ? '#f2f2f2' : '#151515'),
    [C.MOUTH]: hex(pick(gear.mouth, ['#000000', '#141414', '#f2f2f2', kit.trim, '#b6ff2e'])), [C.VISOR]: hex(gear.visor === 2 ? '#62d6ff' : '#1b2030'), [C.TOWEL]: hex('#f4f4f4'), [C.BAND]: hex('#f2f2f2'), [C.EDGE]: hex('#0a0c12'),
  };
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x2 = c.getContext('2d')!, img = x2.createImageData(W, H), px = img.data;
  const OUT = hex('#0a0c12');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = g.a[y * W + x], o = (y * W + x) * 4;
    if (!v) {
      if (g.get(x - 1, y) || g.get(x + 1, y) || g.get(x, y - 1) || g.get(x, y + 1)) { px[o] = OUT[0]; px[o + 1] = OUT[1]; px[o + 2] = OUT[2]; px[o + 3] = 235; }
      continue;
    }
    const isFar = v > FAR, slot = isFar ? v - FAR : v;
    let col = base[slot] ?? [255, 0, 255];
    if (slot === C.EDGE) { /* inner outline */ }
    else if (isFar) col = shade(col, -0.32);
    else if (!g.get(x, y - 1)) col = slot === C.HELM || slot === C.STRIPE ? col : shade(col, 0.12);
    else if (!g.get(x, y + 1)) col = shade(col, -0.18);
    px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = 255;
  }
  x2.putImageData(img, 0, 0);
  return c;
}

const cache = new Map<string, HTMLCanvasElement>();
const q = (v: number, s = 0.08) => Math.round(v / s);
const gkey = (g: Gear) => `${g.sleeve}${g.full ? 1 : 0}${g.glove}${g.tights}${g.mouth}${g.visor}${g.towel ? 1 : 0}${g.band ? 1 : 0}${g.elbow ? 1 : 0}${g.cleat}`;
/** A drawn player for this pose, kit, gear and facing (cached by quantized pose). */
export function renderRig(p: RigPose, b: Build, kit: Kit, skin: string, gear: Gear | null, flip: boolean): HTMLCanvasElement {
  const G = gear ?? NO_GEAR;
  const key = `${b}|${kit.jersey}${kit.helmet}${kit.num}${kit.pants}|${skin}|${gkey(G)}|${flip ? 1 : 0}|${q(p.hipX, 0.5)},${q(p.hipY, 0.5)},${q(p.lean)},${q(p.nt)},${q(p.nk)},${q(p.ft)},${q(p.fk)},${q(p.na)},${q(p.ne)},${q(p.fa)},${q(p.fe)},${q(p.nf ?? 0)},${q(p.ff ?? 0)},${q(p.rot, 0.06)},${p.pivot},${q(p.lift, 0.5)},${p.ball},${q(p.look ?? 0)}`;
  let c = cache.get(key);
  if (!c) {
    c = paint(rasterize(p, b, G), kit, skin, b === 'ref', b === 'civ', G);
    if (flip) { const f = document.createElement('canvas'); f.width = W; f.height = H; const fg = f.getContext('2d')!; fg.translate(W, 0); fg.scale(-1, 1); fg.drawImage(c, 0, 0); c = f; }
    cache.set(key, c);
    if (cache.size > 8000) cache.delete(cache.keys().next().value!);
  }
  return c;
}

// ---- pose library ----------------------------------------------------------------------------
const base = (): RigPose => ({ hipX: 0, hipY: STAND_HIP, lean: 0.06, nt: 0.12, nk: 0.1, ft: -0.12, fk: 0.1, na: 0.3, ne: 0.35, fa: -0.3, fe: 0.3, rot: 0, pivot: 0, lift: 0, ball: 0 });
// The sprint cycle for one leg, keyed from foot strike: [phase, thigh, knee, ankle].
const GAIT: [number, number, number, number][] = [
  [0.00, 0.45, 0.2, -0.15], [0.12, 0.1, 0.5, 0.0], [0.26, -0.38, 0.3, 0.35], [0.36, -0.6, 0.55, 0.8],
  [0.5, -0.35, 1.9, 0.6], [0.63, 0.4, 2.2, 0.25], [0.77, 0.95, 1.3, 0.0], [0.9, 0.75, 0.45, -0.15],
];
function cr(a: number, b: number, c: number, d: number, t: number) { return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t); }
function gaitLeg(ph: number, s: number): [number, number, number] {
  ph = ((ph % 1) + 1) % 1;
  const n = GAIT.length; let i = n - 1;
  for (let k = 0; k < n; k++) if (GAIT[k][0] <= ph) i = k;
  const p0 = GAIT[(i - 1 + n) % n], p1 = GAIT[i], p2 = GAIT[(i + 1) % n], p3 = GAIT[(i + 2) % n];
  const span = ((p2[0] - p1[0]) + 1) % 1 || 1, t = (((ph - p1[0]) + 1) % 1) / span;
  const amp = 0.5 + s * 0.5, tuck = 0.45 + s * 0.55;
  return [cr(p0[1], p1[1], p2[1], p3[1], t) * amp, 0.15 + cr(p0[2], p1[2], p2[2], p3[2], t) * tuck, cr(p0[3], p1[3], p2[3], p3[3], t) * amp];
}
// The throw: set, ball to the ear, layback, over the top, follow-through with the back leg up.
type Key = [number, Partial<RigPose>];
// The pass, keyed so the hand never loops: from the two-hand hold the ball rises straight up to
// the ear (elbow back at shoulder height, off arm pointing at the target), then the arm comes over
// the top with the elbow leading, releases high in front and follows through across the body.
// Elbow angles past 2π keep the forearm's absolute angle continuous between keys, so the
// interpolation takes the short way round instead of swinging the ball down past the hip.
const TAU = Math.PI * 2;
const THROW: Key[] = [
  [-1, { hipY: 14.4, lean: 0.12, nt: 0.15, nk: 0.35, ft: -0.2, fk: 0.35, na: 0.4, ne: 1.95, fa: 0.3, fe: 2.0, ball: 2 }],
  [-0.6, { hipY: 14.3, lean: 0.04, nt: -0.2, nk: 0.4, ft: 0.25, fk: 0.3, na: -0.55, ne: 3.3, fa: 1.0, fe: 1.1, ball: 1 }],
  [-0.15, { hipY: 13.9, lean: -0.1, nt: -0.4, nk: 0.45, ft: 0.5, fk: 0.2, na: -1.5, ne: 4.85, fa: 1.4, fe: 0.45, ball: 1 }],
  [0, { hipY: 13.9, lean: 0.2, nt: -0.45, nk: 0.5, ft: 0.45, fk: 0.25, na: -4.0, ne: 5.9, fa: 0.6, fe: 1.4, ball: 0 }],
  [0.4, { hipY: 13.5, lean: 0.4, nt: -0.7, nk: 1.15, ft: 0.35, fk: 0.35, na: -5.35, ne: 0.35 + TAU, fa: 0.15, fe: 1.6, ball: 0 }],
  [1, { hipY: 13.8, lean: 0.3, nt: -0.35, nk: 0.8, ft: 0.3, fk: 0.35, na: -5.75, ne: 0.6 + TAU, fa: 0.25, fe: 1.4, ball: 0 }],
];
function keyed(keys: Key[], k: number): RigPose {
  let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= k) i++;
  const [k0, a] = keys[i], [k1, b] = keys[i + 1], t0 = Math.max(0, Math.min(1, (k - k0) / (k1 - k0))), t = t0 * t0 * (3 - 2 * t0);
  const A = { ...base(), ...a }, B = { ...base(), ...b };
  return { ...blend(A, B, t), ball: t < 0.5 ? A.ball : B.ball };
}

export const POSE = {
  stand: (breath = 0): RigPose => ({ ...base(), hipY: STAND_HIP - breath * 0.3 }),
  /** Run/jog cycle. ph in [0,1), s = 0 (jog) .. 1 (sprint); carry tucks the ball high and tight. */
  run(ph: number, s: number, carry = false, accel = 0): RigPose {
    const n = gaitLeg(ph, s), f = gaitLeg(ph + 0.5, s);
    const bob = Math.cos(4 * Math.PI * (ph - 0.37)) * (0.35 + s * 0.55);
    const arm = (o: number) => -Math.sin(2 * Math.PI * (ph - 0.06 + o)) * (0.5 + s * 0.6) + 0.15;
    return { ...base(), hipY: STAND_HIP - 0.7 - s * 0.5 + bob, hipX: 0.3 + s * 0.4, lean: 0.12 + s * 0.24 + accel * 0.2,
      nt: n[0], nk: n[1], nf: n[2], ft: f[0], fk: f[1], ff: f[2],
      na: carry ? -0.3 : arm(0), ne: carry ? 2.5 : 1.35 + s * 0.2, fa: arm(0.5), fe: 1.35 + s * 0.2, ball: carry ? 3 : 0 };
  },
  /** Lower body from one pose (legs, hips) with the upper body (arms, lean, ball) of another. */
  compose(lower: RigPose, upper: Partial<RigPose>): RigPose { return { ...lower, ...upper, hipX: lower.hipX, hipY: lower.hipY, nt: lower.nt, nk: lower.nk, ft: lower.ft, fk: lower.fk, nf: lower.nf, ff: lower.ff, lift: Math.max(lower.lift, upper.lift ?? 0) }; },
  backpedal(ph: number): RigPose {
    const w = ph * Math.PI * 2;
    return { ...base(), hipY: 12.4 + Math.abs(Math.cos(w)) * 0.5, lean: 0.32, nt: 0.25 + Math.sin(w) * 0.4, nk: 0.8 - Math.cos(w) * 0.3, ft: 0.25 - Math.sin(w) * 0.4, fk: 0.8 + Math.cos(w) * 0.3, na: 0.55 - Math.sin(w) * 0.3, ne: 1.2, fa: 0.55 + Math.sin(w) * 0.3, fe: 1.2 };
  },
  shuffle(ph: number): RigPose { const w = ph * Math.PI * 2; return { ...base(), hipY: 12.6 + Math.abs(Math.sin(w)) * 0.6, lean: 0.35, nt: 0.35, nk: 0.85, ft: -0.05, fk: 0.75, na: 0.7, ne: 1.3, fa: 0.5, fe: 1.3 }; },
  // Stances.
  three: (): RigPose => ({ ...base(), hipY: 9.5, hipX: -1, lean: 1.25, nt: 1.25, nk: 2.1, ft: 0.75, fk: 1.55, na: 0.1, ne: 0.15, fa: 1.0, fe: 1.2, look: -0.9 }),
  snap: (): RigPose => ({ ...base(), hipY: 9.5, hipX: -1, lean: 1.3, nt: 1.1, nk: 2.0, ft: 0.95, fk: 1.9, na: 0.35, ne: 0.2, fa: 0.3, fe: 0.25, look: -1.0, ball: 0 }),
  two: (): RigPose => ({ ...base(), hipY: 12.4, lean: 0.5, nt: 0.45, nk: 0.9, ft: 0.0, fk: 0.65, na: 0.55, ne: 1.1, fa: 0.25, fe: 1.3, look: -0.3 }),
  gun: (): RigPose => ({ ...base(), hipY: 13.3, lean: 0.3, nt: 0.3, nk: 0.55, ft: -0.05, fk: 0.45, na: 0.9, ne: 0.6, fa: 0.85, fe: 0.7 }),
  under: (): RigPose => ({ ...base(), hipY: 12.2, lean: 0.75, nt: 0.4, nk: 0.85, ft: 0.1, fk: 0.75, na: 1.1, ne: 0.25, fa: 1.0, fe: 0.3, look: -0.5 }),
  rb: (): RigPose => ({ ...base(), hipY: 12.6, lean: 0.55, nt: 0.4, nk: 0.85, ft: 0.05, fk: 0.7, na: 0.65, ne: 0.6, fa: 0.6, fe: 0.6 }),
  hold: (): RigPose => ({ ...base(), hipY: 14.2, lean: 0.12, nt: 0.25, nk: 0.35, ft: -0.2, fk: 0.35, na: 0.35, ne: 1.9, fa: 0.25, fe: 2.0, ball: 2 }),
  /** The throw, k from -1 (ball at the chest) through 0 (release) to 1 (finish). */
  throw(k: number): RigPose { return keyed(THROW, k); },
  /** Reaching for the ball at (fx, fy) relative to the shoulders (rig px, + forward/up). */
  reach(fx: number, fy: number, jump = 0, carry = false): RigPose {
    const a = Math.atan2(fx, -fy);     // angle from straight down to the target
    const e = Math.max(0.1, 0.9 - Math.min(1, Math.hypot(fx, fy) / 11) * 0.8);
    return { ...base(), hipY: STAND_HIP - 0.6, lean: 0.1 + Math.max(0, -fy) * 0.03, nt: jump ? 0.7 : 0.25, nk: jump ? 1.4 : 0.3, ft: jump ? -0.4 : -0.15, fk: jump ? 1.2 : 0.3, na: a, ne: e, fa: a - 0.15, fe: e, lift: jump, ball: carry ? 2 : 0, nf: jump ? 0.6 : 0, ff: jump ? 0.6 : 0 };
  },
  dive(k: number, ball: boolean): RigPose {   // layout: horizontal, arms out, legs trailing
    return { ...base(), hipY: 8, lean: 1.45, nt: -0.4 - k * 0.3, nk: 0.3, ft: -0.6, fk: 0.6, na: 2.9, ne: 0.1, fa: 2.75, fe: 0.15, rot: 0.15, pivot: 1, lift: Math.sin(Math.min(1, k) * Math.PI) * 6, ball: ball ? 2 : 0, nf: 0.8, ff: 0.8 };
  },
  toetap(k: number): RigPose {
    return { ...base(), hipY: 15.3, lean: -0.22, nt: 0.12, nk: 0.05, ft: -0.18, fk: 0.1, na: 0.8, ne: 1.4, fa: 0.7, fe: 1.5, nf: 1.0 - k * 0.3, ff: 1.0, ball: 2, look: 0.4 };
  },
  // Contact.
  drive(ph: number): RigPose {   // run block / bull rush: low, arms locked out, choppy feet
    const w = ph * Math.PI * 2;
    return { ...base(), hipY: 11.5, hipX: -0.5, lean: 0.75, nt: 0.4 + Math.sin(w) * 0.25, nk: 1.1, ft: -0.45 - Math.sin(w) * 0.25, fk: 0.6, na: 1.45, ne: 0.25, fa: 1.35, fe: 0.3 };
  },
  passpro(ph: number): RigPose {  // sitting down in the kick-slide, punching
    const w = ph * Math.PI * 2;
    return { ...base(), hipY: 11.2, hipX: -0.8, lean: 0.4, nt: 0.55, nk: 1.25, ft: -0.25 + Math.sin(w) * 0.12, fk: 0.95, na: 1.3 + Math.sin(w * 2) * 0.15, ne: 0.5, fa: 1.25, fe: 0.55 };
  },
  swim(k: number): RigPose { return { ...base(), hipY: 11.5, lean: 0.85, nt: 0.5, nk: 1.1, ft: -0.5, fk: 0.7, na: 2.6 - k * 1.2, ne: 0.6, fa: 1.2, fe: 0.4 }; },
  wrap(k: number): RigPose {      // tackler: dropping the hips, head across, arms wrapping
    return { ...base(), hipY: 11 - k * 2, lean: 0.9 + k * 0.4, nt: 0.6, nk: 1.2, ft: -0.7 - k * 0.3, fk: 0.5, na: 1.6, ne: 1.5, fa: 1.45, fe: 1.6 };
  },
  stiff(ph: number): RigPose { const r = POSE.run(ph, 0.75); return { ...r, na: 1.62, ne: 0.02, fa: -0.3, fe: 2.5, ball: 0, lean: 0.3 }; },
  /** More stances, so players don't all set up the same way. */
  four: (): RigPose => ({ ...base(), hipY: 9.2, hipX: -1, lean: 1.3, nt: 1.25, nk: 2.1, ft: 0.85, fk: 1.7, na: 0.05, ne: 0.1, fa: 0.25, fe: 0.1, look: -0.9 }),
  edge: (): RigPose => ({ ...base(), hipY: 12.6, lean: 0.55, nt: 0.5, nk: 0.9, ft: -0.15, fk: 0.75, na: 1.0, ne: 0.9, fa: 0.8, fe: 1.1, look: -0.2 }),
  passSet: (): RigPose => ({ ...base(), hipY: 11.8, hipX: -0.6, lean: 0.45, nt: 0.5, nk: 1.15, ft: -0.2, fk: 0.95, na: 0.75, ne: 0.9, fa: 0.7, fe: 1.0 }),
  twoLow: (): RigPose => ({ ...base(), hipY: 11.6, lean: 0.75, nt: 0.55, nk: 1.15, ft: -0.1, fk: 0.85, na: 0.35, ne: 1.5, fa: 0.0, fe: 1.4, look: -0.5 }),
  press: (): RigPose => ({ ...base(), hipY: 12.4, lean: 0.35, nt: 0.4, nk: 0.85, ft: -0.2, fk: 0.75, na: 1.3, ne: 0.9, fa: 1.2, fe: 1.0 }),
  lb: (): RigPose => ({ ...base(), hipY: 12.2, lean: 0.6, nt: 0.45, nk: 0.95, ft: -0.25, fk: 0.85, na: 0.55, ne: 0.25, fa: 0.5, fe: 0.3, look: -0.2 }),
  dbOff: (): RigPose => ({ ...base(), hipY: 12.8, lean: 0.4, nt: 0.3, nk: 0.75, ft: -0.25, fk: 0.6, na: 0.45, ne: 1.0, fa: 0.2, fe: 1.1 }),
  /** The juke, k 0..1: brake and drop the hips, sell the fake with the head and shoulders, explode out. */
  juke(k: number, ph: number): RigPose {
    // Gather (feet under him, hips sink), a quick side-hop with the free arm out for balance, then burst.
    if (k < 0.3) return { ...base(), hipY: 11.8, lean: 0.25, nt: 0.35, nk: 1.1, ft: -0.15, fk: 1.0, na: -0.3, ne: 2.5, fa: 0.4, fe: 1.1, ball: 3 };
    if (k < 0.55) return { ...base(), hipY: 12.4, lift: 2.5, lean: 0.35, nt: 0.7, nk: 1.6, ft: -0.1, fk: 1.5, na: -0.3, ne: 2.5, fa: -0.9, fe: 0.5, ball: 3, look: 0.3, nf: 0.5, ff: 0.5 };
    const r = POSE.run(ph, 1, true, 1); return { ...r, hipY: r.hipY - 1, lean: 0.55 };
  },

  plant(): RigPose { return { ...base(), hipY: 11.5, hipX: -1.2, lean: -0.05, nt: 0.95, nk: 0.25, ft: -0.2, fk: 1.3, na: 0.2, ne: 2.3, fa: -0.8, fe: 0.9, ball: 1 }; },
  /** Going down: forward (dir 1: knees buckle, hips drop, chest to the turf) or knocked back
   *  (-1: rocked upright, feet go, landing on the backside). No stiff tipping-over. */
  fall(k: number, dir: number, carry: boolean): RigPose {
    const ball: 0 | 3 = carry ? 3 : 0;
    const keys: Key[] = dir > 0 ? [
      [0, { hipY: STAND_HIP - 1, lean: 0.35, nt: 0.4, nk: 0.5, ft: -0.4, fk: 0.4, na: -0.3, ne: 2.5, fa: 0.6, fe: 0.8, ball }],
      [0.3, { hipY: 11.5, lean: 0.75, nt: 0.55, nk: 1.5, ft: -0.2, fk: 1.4, na: -0.3, ne: 2.5, fa: 1.2, fe: 0.6, ball }],
      [0.6, { hipY: 7, lean: 1.1, nt: 0.6, nk: 2.2, ft: 0.2, fk: 2.0, na: -0.2, ne: 2.5, fa: 1.7, fe: 0.4, ball, look: -0.3 }],
      [0.82, { hipY: 4.6, lean: 1.38, nt: -0.6, nk: 1.3, ft: -0.8, fk: 1.2, na: 0.1, ne: 2.5, fa: 2.2, fe: 0.4, ball, look: -0.25 }],
      [1, { hipY: 3.2, lean: 1.52, nt: -1.3, nk: 0.35, ft: -1.42, fk: 0.55, nf: 0.6, ff: 0.6, na: 0.4, ne: 2.4, fa: 2.5, fe: 0.4, ball, look: -0.2 }],
    ] : [
      [0, { hipY: STAND_HIP, lean: -0.15, nt: 0.2, nk: 0.3, ft: -0.3, fk: 0.3, na: 1.9, ne: 0.6, fa: 2.4, fe: 0.5, ball, look: 0.4 }],
      [0.35, { hipY: 13, lean: -0.5, nt: 0.8, nk: 0.5, ft: 0.4, fk: 0.6, na: 2.6, ne: 0.4, fa: 2.9, fe: 0.4, ball, lift: 1.5, look: 0.6 }],
      [0.7, { hipY: 5.5, lean: -0.9, nt: 1.35, nk: 0.6, ft: 1.1, fk: 0.9, na: 2.4, ne: 0.6, fa: 2.7, fe: 0.5, ball, look: 0.5 }],
      [1, { hipY: 3.2, lean: -1.45, nt: 1.45, nk: 0.35, ft: 1.25, fk: 0.7, na: 2.6, ne: 0.4, fa: 2.2, fe: 0.8, ball, look: 0.3 }],
    ];
    return keyed(keys, Math.min(1, k));
  },
  lying(dir: number, carry: boolean, breath = 0): RigPose {
    const end = POSE.fall(1, dir, carry);
    return { ...end, hipY: end.hipY + breath * 0.15 };
  },
  kneel: (): RigPose => ({ ...base(), hipY: 8.5, lean: 0.15, nt: 1.45, nk: 1.55, ft: -0.3, fk: 2.2, na: 0.8, ne: 0.6, fa: 0.25, fe: 0.4, ff: -0.6 }),
  // After the whistle.
  point: (carry: boolean): RigPose => ({ ...base(), na: 1.57, ne: 0.02, fa: 0.2, fe: carry ? 2.2 : 0.3, ball: carry ? 0 : 0 }),
  spike(k: number): RigPose { return k < 0.5 ? { ...base(), lean: -0.1, na: 3.0, ne: 0.2, fa: 0.4, fe: 0.4, ball: 1 } : { ...base(), hipY: 13.5, lean: 0.55, nt: 0.5, nk: 0.8, ft: -0.3, fk: 0.4, na: 0.9, ne: 0.1, fa: -0.4, fe: 0.5 }; },
  jump(k: number): RigPose { const up = Math.sin(Math.min(1, k) * Math.PI); return { ...base(), lift: up * 7, nt: 0.5 * up, nk: 1.2 * up, ft: -0.2, fk: 1.0 * up, na: 3.0, ne: 0.2, fa: 2.4, fe: 0.8, nf: 0.6 * up, ff: 0.6 * up }; },
  flex: (t: number): RigPose => ({ ...base(), hipY: 14, lean: -0.05, nt: 0.35, nk: 0.4, ft: -0.3, fk: 0.4, na: 1.6, ne: 2.1 + Math.sin(t * 8) * 0.1, fa: 1.8, fe: 2.1, look: 0.25 }),
  dance(t: number): RigPose { const w = Math.sin(t * 9); return { ...base(), hipY: 14 - Math.abs(w) * 1.5, lean: 0.1, nt: 0.3 + w * 0.3, nk: 0.6, ft: -0.3 + w * 0.3, fk: 0.6, na: 2.6 + w * 0.4, ne: 0.6, fa: 0.5 - w * 0.6, fe: 1.4 }; },
  pray: (): RigPose => ({ ...POSE.kneel(), lean: 0.35, na: 1.3, ne: 1.9, fa: 1.2, fe: 2.0, look: -0.4 }),
  // Officials.
  td: (): RigPose => ({ ...base(), na: 3.1, ne: 0.02, fa: 3.0, fe: 0.05 }),
  incomplete: (t: number): RigPose => { const w = Math.sin(t * 10); return { ...base(), na: 1.5 + w * 0.5, ne: 0.05, fa: 1.5 - w * 0.5, fe: 0.05 }; },
  // Kicking.
  kick(k: number): RigPose {   // k -1..1 around contact
    const u = (k + 1) / 2;
    return { ...base(), hipY: 14.5, lean: -0.15 - u * 0.15, nt: -0.9 + u * 2.6, nk: Math.max(0, 1.6 - u * 2.2), ft: 0.25, fk: 0.2, na: -0.6 + u * 0.5, ne: 0.4, fa: 1.4 - u * 0.4, fe: 0.4, nf: 0.6 };
  },
  holder: (): RigPose => ({ ...POSE.kneel(), lean: 0.5, na: 1.2, ne: 0.2, fa: 0.9, fe: 0.4 }),
};

/** Blend two poses (for smooth transitions). */
/** Mix two poses. With `wrap`, arm angles take the shortest way round (for smoothing between
 *  frames, where one pose may carry a wound-up angle like a throw's follow-through). */
export function blend(a: RigPose, b: RigPose, w: number, wrap = false): RigPose {
  const l = (x: number, y: number) => x + (y - x) * w;
  const r = wrap ? (x: number, y: number) => { const d = ((((y - x) % TAU) + TAU * 1.5) % TAU) - Math.PI; return x + d * w; } : l;
  return { hipX: l(a.hipX, b.hipX), hipY: l(a.hipY, b.hipY), lean: l(a.lean, b.lean), nt: l(a.nt, b.nt), nk: l(a.nk, b.nk), ft: l(a.ft, b.ft), fk: l(a.fk, b.fk), na: r(a.na, b.na), ne: r(a.ne, b.ne), fa: r(a.fa, b.fa), fe: r(a.fe, b.fe),
    nf: l(a.nf ?? 0, b.nf ?? 0), ff: l(a.ff ?? 0, b.ff ?? 0), rot: l(a.rot, b.rot), pivot: w < 0.5 ? a.pivot : b.pivot, lift: l(a.lift, b.lift), ball: w < 0.5 ? a.ball : b.ball, look: l(a.look ?? 0, b.look ?? 0) };
}
export const buildOf = (slot: string, role: string): Build => /^(OL|DL|FG\d|RU)/.test(slot) && role !== 'J' ? 'line' : slot === 'QB' ? 'qb' : slot === 'K' || slot === 'P' ? 'k' : 'skill';
