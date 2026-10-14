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
  ball: 0 | 1 | 2;                   // ball in the near hand, or held in both hands at the chest
  look?: number;                     // head tilt
}
export type Build = 'line' | 'skill' | 'qb' | 'k' | 'ref' | 'civ';

interface Dim { th: number; sh: number; ft: number; to: number; ua: number; fa: number; hr: number; sw: number; ww: number; tr: number; srr: number; ar: number }
const DIM: Record<Build, Dim> = {
  skill: { th: 7, sh: 7, ft: 3, to: 10, ua: 5, fa: 5, hr: 3.9, sw: 10, ww: 6.8, tr: 1.8, srr: 1.3, ar: 1.2 },
  qb: { th: 7, sh: 7, ft: 3, to: 10, ua: 5, fa: 5, hr: 3.9, sw: 9.6, ww: 6.6, tr: 1.7, srr: 1.25, ar: 1.15 },
  k: { th: 7, sh: 7, ft: 3, to: 9.5, ua: 5, fa: 4.5, hr: 3.8, sw: 8.6, ww: 6.2, tr: 1.6, srr: 1.2, ar: 1.1 },
  line: { th: 6.5, sh: 6.5, ft: 3, to: 10.5, ua: 5, fa: 5, hr: 4.1, sw: 12, ww: 10.5, tr: 2.3, srr: 1.7, ar: 1.5 },
  civ: { th: 7, sh: 7, ft: 3, to: 10, ua: 5, fa: 5, hr: 3.1, sw: 8.4, ww: 6.6, tr: 1.6, srr: 1.2, ar: 1.1 },
  ref: { th: 7, sh: 7, ft: 3, to: 10, ua: 5, fa: 5, hr: 3.1, sw: 8.4, ww: 6.6, tr: 1.6, srr: 1.2, ar: 1.1 },
};
export const STAND_HIP = 15;

export const W = 60, H = 52, AX = 30, AY = 47;   // grid and the feet anchor inside it

// ---- palette ---------------------------------------------------------------------------------
const hex = (h: string): [number, number, number] => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const shade = (c: [number, number, number], k: number): [number, number, number] => c.map(v => Math.round(Math.max(0, Math.min(255, k < 0 ? v * (1 + k) : v + (255 - v) * k)))) as [number, number, number];
// Colour slots; each has a far (shaded) twin at +16 and a lit twin at +32.
const enum C { HELM = 1, STRIPE, MASK, SKIN, JER, TRIM, NUM, PANT, SOCK, SHOE, GLOVE, BALL, LACE, CAP, SHIRT2, DARK }

// ---- geometry ---------------------------------------------------------------------------------
type P = [number, number];
const add = (a: P, l: number, ang: number): P => [a[0] + l * Math.sin(ang), a[1] - l * Math.cos(ang)];   // y up, angle from straight down

function joints(p: RigPose, d: Dim) {
  const hip: P = [p.hipX, p.hipY];
  const up = (l: number, ang: number, from: P): P => [from[0] + l * Math.sin(ang), from[1] + l * Math.cos(ang)];
  const neck = up(d.to, p.lean, hip);
  const shoulder = up(d.to - 2.2, p.lean, hip);
  const head = up(d.hr * 0.72, p.lean * 0.85 + (p.look ?? 0), neck);
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
const DIGIT: Record<string, string> = { '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001010010', '8': '111101111101111', '9': '111101111001111' };

function rotate(pt: P, piv: P, r: number): P { const x = pt[0] - piv[0], y = pt[1] - piv[1]; return [piv[0] + x * Math.cos(r) + y * Math.sin(r), piv[1] - x * Math.sin(r) + y * Math.cos(r)]; }

function rasterize(p: RigPose, b: Build, num: number): Grid {
  const d = DIM[b], g = new Grid();
  const J = joints(p, d);
  // Whole-body rotation and lift.
  const piv: P = p.pivot ? J.hip : [0, 0];
  const R = (q: P): P => { const r = p.rot ? rotate(q, piv, p.rot) : q; return [r[0], r[1] + p.lift]; };
  const hip = R(J.hip), neck = R(J.neck), sh = R(J.shoulder), head = R(J.head);
  const L = (l: typeof J.nl) => ({ knee: R(l.knee), ank: R(l.ank), toe: R(l.toe) });
  const A = (a: typeof J.na) => ({ el: R(a.el), hand: R(a.hand) });
  const nl = L(J.nl), fl = L(J.fl), na = A(J.na), fa = A(J.fa);
  const far = 16;
  const ref = b === 'ref' || b === 'civ';
  // Far side: arm and leg, shaded.
  const drawLeg = (l: ReturnType<typeof L>, o: number) => {
    g.line(hip, l.knee, d.tr, C.PANT + o);
    const mid: P = [l.knee[0] + (l.ank[0] - l.knee[0]) * 0.25, l.knee[1] + (l.ank[1] - l.knee[1]) * 0.25];
    g.line(l.knee, mid, d.srr, ref ? C.PANT + o : C.PANT + o);
    g.line(mid, l.ank, d.srr, ref ? C.DARK + o : C.SOCK + o);
    g.line(l.ank, l.toe, 0.9, C.SHOE + o);
  };
  const drawArm = (a: ReturnType<typeof A>, o: number) => {
    const sl: P = [sh[0] + (a.el[0] - sh[0]) * 0.55, sh[1] + (a.el[1] - sh[1]) * 0.55];
    g.line(sh, sl, d.ar + 0.25, (ref ? C.JER : C.JER) + o);
    g.disk(sl[0], sl[1], d.ar, (ref ? C.DARK : C.TRIM) + o);
    g.line(sl, a.el, d.ar, C.SKIN + o);
    g.line(a.el, a.hand, d.ar - 0.1, C.SKIN + o);
    g.disk(a.hand[0], a.hand[1], 0.8, (ref ? C.SKIN : C.GLOVE) + o);
  };
  drawArm(fa, far); drawLeg(fl, far);
  // Torso: pants at the hips, the jersey up to padded shoulders.
  const ang = Math.atan2(neck[0] - hip[0], neck[1] - hip[1]);
  const px = Math.cos(ang), py = -Math.sin(ang);    // perpendicular (toward the front)
  const at = (k: number, w: number): [P, P] => { const c: P = [hip[0] + (neck[0] - hip[0]) * k, hip[1] + (neck[1] - hip[1]) * k]; return [[c[0] + px * w / 2, c[1] + py * w / 2], [c[0] - px * w / 2, c[1] - py * w / 2]]; };
  const [h1, h2] = at(-0.08, d.ww), [b1, b2] = at(0.22, d.ww), [w1, w2] = at(0.3, d.ww + 0.4), [s1, s2] = at(0.88, d.sw), [t1, t2] = at(1.02, d.sw - 1.6);
  g.poly([h1, b1, b2, h2], C.PANT);
  g.poly([w1, s1, t1, t2, s2, w2], b === 'ref' ? C.SHIRT2 : C.JER);
  if (b === 'ref') { for (let k = 0; k < 6; k++) { const [a1, a2] = at(0.32 + k * 0.11, d.sw - 0.5); g.line(a1, a2, 0.3, k % 2 ? C.SHIRT2 : C.DARK); } }
  else g.line(b1, b2, 0.4, C.TRIM);                 // belt / jersey hem
  // Number on the chest (when upright enough to read).
  const tilt = Math.abs(ang + (p.rot || 0));
  if (!ref && tilt < 0.75 && num >= 0 && b === 'line' && false) {
    const s = String(num % 100), wd = s.length * 4 - 1, c: P = [hip[0] + (neck[0] - hip[0]) * 0.58, hip[1] + (neck[1] - hip[1]) * 0.58];
    [...s].forEach((ch, i) => { const m = DIGIT[ch]; for (let k = 0; k < 15; k++) if (m[k] === '1') g.set(c[0] - wd / 2 + i * 4 + (k % 3) + 0.5, c[1] + 2 - Math.floor(k / 3), C.NUM); });
  }
  drawLeg(nl, 0);
  // Helmet: shell, stripe, the facemask on the front, a sliver of face.
  const hr = d.hr, hx = head[0], hy = head[1];
  if (ref) {
    g.disk(hx, hy, hr, C.SKIN);
    g.line([hx - hr, hy + 1], [hx + hr + 1.2, hy + 1], 0.6, C.CAP); g.disk(hx - 0.3, hy + 1.6, hr * 0.85, C.CAP);
  } else {
    const fr = (p.rot || 0) + ang * 0.7;    // the face turns with the body
    const fx = Math.cos(fr), fy = -Math.sin(fr);
    g.disk(hx, hy, hr, C.HELM);
    // Stripe over the crown, front to back.
    for (let k = -hr + 0.6; k <= hr - 0.8; k += 0.5) g.set(hx + k * fx + fy * 0, hy + hr - 0.2 + k * fy * 0 - Math.abs(k) * 0.15, C.STRIPE);
    // Face opening and mask.
    g.disk(hx + fx * (hr - 0.6) + fy * 0.4, hy - 0.4 + fy * (hr - 0.6) * 0, 0.9, C.SKIN);
    g.line([hx + fx * (hr + 0.3), hy + 0.6], [hx + fx * (hr + 0.3), hy - hr + 0.6], 0.45, C.MASK);
    g.line([hx + fx * (hr - 0.4), hy - 0.9], [hx + fx * (hr + 0.6), hy - 0.9], 0.4, C.MASK);
  }
  drawArm(na, 0);
  // The ball: tucked or carried in the near hand, or held at the chest in both.
  if (p.ball) {
    const bp: P = p.ball === 2 ? [(na.hand[0] + fa.hand[0]) / 2 + 0.6, (na.hand[1] + fa.hand[1]) / 2] : [na.hand[0] + 0.6, na.hand[1] + 0.3];
    g.line([bp[0] - 1.3, bp[1]], [bp[0] + 1.3, bp[1]], 0.95, C.BALL); g.set(bp[0], bp[1] + 0.5, C.LACE);
  }
  return g;
}

// ---- colour, outline, light ------------------------------------------------------------------
function paint(g: Grid, kit: Kit, skin: string, ref: boolean, civ = false): HTMLCanvasElement {
  const base: Record<number, [number, number, number]> = {
    [C.HELM]: hex(kit.helmet), [C.STRIPE]: hex(kit.trim), [C.MASK]: hex(kit.mask), [C.SKIN]: hex(skin), [C.JER]: hex(ref ? '#f2f2f2' : kit.jersey), [C.CAP]: hex(civ ? '#2a1d14' : '#161616'), [C.TRIM]: hex(kit.trim),
    [C.NUM]: hex(kit.num), [C.PANT]: hex(ref ? '#1c1c1c' : civ ? kit.pants : kit.pants), [C.SOCK]: hex(kit.socks), [C.SHOE]: hex(ref ? '#111111' : '#151515'), [C.GLOVE]: hex(kit.trim.toLowerCase() === '#ffffff' ? '#e8e8e8' : kit.trim),
    [C.BALL]: hex('#7a3a12'), [C.LACE]: hex('#ffffff'), [C.SHIRT2]: hex('#f2f2f2'), [C.DARK]: hex('#141414'),
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
    const isFar = v > 16, slot = isFar ? v - 16 : v;
    let col = base[slot] ?? [255, 0, 255];
    if (isFar) col = shade(col, -0.32);
    // Top light: a lit rim where nothing is above; a darker edge underneath.
    else if (!g.get(x, y - 1)) col = shade(col, 0.22);
    else if (!g.get(x, y + 1)) col = shade(col, -0.18);
    px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = 255;
  }
  x2.putImageData(img, 0, 0);
  return c;
}

const cache = new Map<string, HTMLCanvasElement>();
const q = (v: number, s = 0.08) => Math.round(v / s);
/** A drawn player for this pose, kit and facing (cached by quantized pose). */
export function renderRig(p: RigPose, b: Build, kit: Kit, skin: string, num: number, flip: boolean): HTMLCanvasElement {
  const key = `${b}|${kit.jersey}${kit.helmet}${kit.num}${kit.pants}|${skin}|${num}|${flip ? 1 : 0}|${q(p.hipX, 0.5)},${q(p.hipY, 0.5)},${q(p.lean)},${q(p.nt)},${q(p.nk)},${q(p.ft)},${q(p.fk)},${q(p.na)},${q(p.ne)},${q(p.fa)},${q(p.fe)},${q(p.nf ?? 0)},${q(p.ff ?? 0)},${q(p.rot, 0.06)},${p.pivot},${q(p.lift, 0.5)},${p.ball},${q(p.look ?? 0)}`;
  let c = cache.get(key);
  if (!c) {
    c = paint(rasterize(p, b, num), kit, skin, b === 'ref', b === 'civ');
    if (flip) { const f = document.createElement('canvas'); f.width = W; f.height = H; const fg = f.getContext('2d')!; fg.translate(W, 0); fg.scale(-1, 1); fg.drawImage(c, 0, 0); c = f; }
    cache.set(key, c);
    if (cache.size > 6000) cache.delete(cache.keys().next().value!);
  }
  return c;
}

// ---- pose library ----------------------------------------------------------------------------
const base = (): RigPose => ({ hipX: 0, hipY: STAND_HIP, lean: 0.05, nt: 0.05, nk: 0.08, ft: -0.05, fk: 0.08, na: 0.12, ne: 0.25, fa: -0.12, fe: 0.25, rot: 0, pivot: 0, lift: 0, ball: 0 });
export const POSE = {
  stand: (breath = 0): RigPose => ({ ...base(), hipY: STAND_HIP - breath * 0.3 }),
  /** Run/jog cycle. ph in [0,1), s = intensity 0 (walk) .. 1 (sprint), carry tucks the ball in the near arm. */
  run(ph: number, s: number, carry = false, accel = 0): RigPose {
    const w = ph * Math.PI * 2, amp = 0.35 + s * 0.6;
    const swing = (o: number) => Math.sin(w + o) * amp;
    const knee = (o: number) => { const c = Math.cos(w + o); return 0.25 + (c > 0 ? c * (0.6 + s * 1.1) : -c * 0.12); };
    const bob = Math.abs(Math.cos(w)) * (0.6 + s * 0.8);
    const lean = 0.12 + s * 0.28 + accel * 0.18;
    const arm = (o: number) => -Math.sin(w + o) * (0.45 + s * 0.75);
    return { ...base(), hipY: STAND_HIP - 0.8 - s * 0.6 + bob, hipX: 0.4 + s * 0.5, lean, nt: swing(0), nk: knee(0), ft: swing(Math.PI), fk: knee(Math.PI),
      na: carry ? 0.15 : arm(0), ne: carry ? 2.3 : 1.4, fa: arm(Math.PI), fe: 1.4, nf: 0.2, ff: 0.2, ball: carry ? 1 : 0 };
  },
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
  /** The throw, k from -1 (start of the wind-up) through 0 (release) to 1 (finish). */
  throw(k: number): RigPose {
    if (k < 0) { const u = 1 + k;   // wind-up: ball back by the ear, front foot lifting
      return { ...base(), hipY: 14.4, lean: -0.08 + u * 0.05, nt: 0.15 + u * 0.35, nk: 0.3 + u * 0.4, ft: -0.35, fk: 0.3, na: -0.4 - u * 2.1, ne: 1.4 + u * 0.5, fa: 0.6 + u * 0.7, fe: 0.4, ball: 1 }; }
    const u = Math.min(1, k);        // release over the top and follow through across the body
    return { ...base(), hipY: 14.2 - u * 0.8, lean: 0.1 + u * 0.45, nt: 0.5, nk: 0.35, ft: -0.35 - u * 0.4, fk: 0.4 + u * 0.8, na: -2.5 - u * 2.9 + (u > 0.15 ? 0 : 0), ne: 0.4 - u * 0.3, fa: 1.1 - u * 1.3, fe: 0.6, ball: u < 0.08 ? 1 : 0 };
  },
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
  stiff(ph: number): RigPose { const r = POSE.run(ph, 0.8, true); return { ...r, na: 1.6, ne: 0.05, fa: 0.2, fe: 2.2, ball: 2 }; },
  plant(): RigPose { return { ...base(), hipY: 11.5, hipX: -1.2, lean: -0.05, nt: 0.95, nk: 0.25, ft: -0.2, fk: 1.3, na: 0.2, ne: 2.3, fa: -0.8, fe: 0.9, ball: 1 }; },
  /** Going down: forward (dir 1) or knocked back (-1); k 0..1, then lying flat. */
  fall(k: number, dir: number, carry: boolean): RigPose {
    const u = Math.min(1, k), sm = u * u * (3 - 2 * u);
    const b = dir > 0
      ? { ...base(), hipY: STAND_HIP - sm * 4, lean: 0.4 + sm * 0.3, nt: 0.4, nk: 0.9 + sm * 0.4, ft: -0.6 - sm * 0.3, fk: 0.4, na: carry ? 0.2 : 1.2 + sm * 0.8, ne: carry ? 2.3 : 0.4, fa: 1.4 + sm * 0.7, fe: 0.3, ball: (carry ? 1 : 0) as 0 | 1 }
      : { ...base(), hipY: STAND_HIP - sm * 3, lean: -0.3 - sm * 0.3, nt: 0.7, nk: 0.5, ft: 0.4, fk: 0.4, na: 2.4, ne: 0.6, fa: 2.0, fe: 0.8, ball: (carry ? 1 : 0) as 0 | 1, look: 0.5 };
    return { ...b, rot: dir * sm * 1.35, pivot: 0 };
  },
  lying(dir: number, carry: boolean, breath = 0): RigPose {
    return dir > 0
      ? { ...base(), hipY: 11, lean: 0.75, nt: 0.4, nk: 1.3, ft: -0.9, fk: 0.4, na: carry ? 0.2 : 2.2, ne: carry ? 2.3 : 0.4, fa: 2.5, fe: 0.3, rot: 1.42 + breath * 0.02, pivot: 0, lift: 0, ball: carry ? 1 : 0, look: -0.2 }
      : { ...base(), hipY: 12, lean: -0.6, nt: 0.7, nk: 0.5, ft: 0.4, fk: 0.4, na: 2.5, ne: 0.4, fa: 2.2, fe: 0.6, rot: -1.25, pivot: 0, lift: 0, ball: carry ? 1 : 0, look: 0.5 };
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
export function blend(a: RigPose, b: RigPose, w: number): RigPose {
  const l = (x: number, y: number) => x + (y - x) * w;
  return { hipX: l(a.hipX, b.hipX), hipY: l(a.hipY, b.hipY), lean: l(a.lean, b.lean), nt: l(a.nt, b.nt), nk: l(a.nk, b.nk), ft: l(a.ft, b.ft), fk: l(a.fk, b.fk), na: l(a.na, b.na), ne: l(a.ne, b.ne), fa: l(a.fa, b.fa), fe: l(a.fe, b.fe),
    nf: l(a.nf ?? 0, b.nf ?? 0), ff: l(a.ff ?? 0, b.ff ?? 0), rot: l(a.rot, b.rot), pivot: w < 0.5 ? a.pivot : b.pivot, lift: l(a.lift, b.lift), ball: w < 0.5 ? a.ball : b.ball, look: l(a.look ?? 0, b.look ?? 0) };
}
export const buildOf = (slot: string, role: string): Build => /^(OL|DL|FG\d|RU)/.test(slot) && role !== 'J' ? 'line' : slot === 'QB' ? 'qb' : slot === 'K' || slot === 'P' ? 'k' : 'skill';
