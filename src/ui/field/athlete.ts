// A football player drawn as a small, solid athlete: helmet with cage and stripe,
// shoulder pads under the jersey, sleeves, gloves, pants with a stripe, socks and
// cleats. Skeleton-driven: every pose is joint angles (hips, knees, shoulders,
// elbows) solved from feet up, so stances, strides, throws and catches all read.
// Units are yards; the caller sets the canvas transform (origin at his feet,
// +x the way he faces, -y up).

export interface Kit { jersey: string; num: string; trim: string; pants: string; helmet: string; mask: string; socks: string }
export type Build = 'big' | 'mid' | 'lean';
export type Act =
  | { k: 'run'; speed: number; secs: number }
  | { k: 'back'; speed: number; secs: number }           // backpedal, facing the play
  | { k: 'stand'; secs: number }
  | { k: 'three' }                                        // 3-point stance
  | { k: 'two'; hands?: boolean }                         // 2-point; hands on knees
  | { k: 'gun' }                                          // QB in shotgun, hands out
  | { k: 'block'; secs: number }                          // engaged: arms locked out, chopping feet
  | { k: 'throw'; p: number }                             // 0 cocked .. 1 follow-through
  | { k: 'catch'; p: number; high: boolean }              // hands up for the ball
  | { k: 'carry'; speed: number; secs: number }
  | { k: 'dive'; p: number }
  | { k: 'down'; p: number }
  | { k: 'kick'; p: number }
  | { k: 'party'; secs: number };

interface Pose { lean: number; legs: [number, number][]; arms: [number, number][]; bob: number; ball?: 0 | 1 }

const L = { thigh: 0.55, shin: 0.53, upper: 0.36, fore: 0.34 };
function pose(a: Act): Pose {
  switch (a.k) {
    case 'run': case 'carry': {
      const run = Math.min(1, a.speed / 8.5), ph = a.secs * (4.6 + a.speed * 0.95);
      const A = 0.3 + run * 0.72, s = Math.sin(ph), c = Math.cos(ph);
      const bendF = 0.25 + Math.max(0, c) * (0.5 + run * 1.1), bendB = 0.25 + Math.max(0, -c) * (0.5 + run * 1.1);
      const arms: [number, number][] = a.k === 'carry' ? [[-0.25 - (0.08 + run * 0.28), 2.5], [-s * A * 1.1, 1.3]] : [[-s * A * 1.1, 1.35], [s * A * 1.1, 1.35]];
      return { lean: 0.08 + run * 0.28, legs: [[s * A, bendF], [-s * A, bendB]], arms, bob: Math.abs(Math.sin(ph)) * 0.05 * run, ball: a.k === 'carry' ? 0 : undefined };
    }
    case 'back': {
      const ph = a.secs * 9, s = Math.sin(ph);
      return { lean: 0.3, legs: [[0.25 + s * 0.22, 0.75], [0.15 - s * 0.22, 0.75]], arms: [[0.35, 1.3], [0.25, 1.3]], bob: 0 };
    }
    case 'stand': { const b = Math.sin(a.secs * 2) * 0.01; return { lean: 0.04, legs: [[0.1, 0.12], [-0.1, 0.12]], arms: [[0.15, 0.5], [0.05, 0.4]], bob: b }; }
    case 'three': return { lean: 1.15, legs: [[0.95, 2.0], [0.55, 1.75]], arms: [[-1.15, 0.1], [0.4, 1.6]], bob: 0 };
    case 'two': return a.hands ? { lean: 0.7, legs: [[0.6, 1.2], [0.4, 1.1]], arms: [[0.0, 0.5], [-0.2, 0.6]], bob: 0 } : { lean: 0.4, legs: [[0.45, 0.85], [0.1, 0.75]], arms: [[0.4, 1.1], [0.2, 1.0]], bob: 0 };
    case 'gun': return { lean: 0.25, legs: [[0.25, 0.5], [0.0, 0.45]], arms: [[1.05, 0.5], [0.9, 0.6]], bob: 0 };
    case 'block': { const s = Math.sin(a.secs * 11) * 0.12; return { lean: 0.5, legs: [[0.5 + s, 1.0], [-0.15 - s, 0.5]], arms: [[1.45, 0.15], [1.35, 0.2]], bob: 0 }; }
    case 'throw': {
      const p = a.p; // front arm throws; back arm points at the target
      const sh = p < 0.55 ? -2.6 + p * 0.6 : -2.27 + (p - 0.55) / 0.45 * 3.8;
      return { lean: p < 0.55 ? -0.12 : -0.12 + (p - 0.55) * 0.7, legs: [[0.35, 0.3], [-0.25, 0.2]], arms: [[sh, p < 0.55 ? 1.4 : 0.4], [1.25 - p * 0.6, 0.2]], bob: 0 };
    }
    case 'catch': return { lean: a.high ? -0.08 : 0.15, legs: [[0.3, 0.6], [-0.2, 0.5]], arms: a.high ? [[2.75, 0.25], [2.6, 0.3]] : [[1.55, 0.6], [1.45, 0.7]], bob: a.high ? -0.12 * Math.sin(a.p * Math.PI) : 0 };
    case 'dive': return { lean: 0.6 + a.p * 0.6, legs: [[-0.2, 0.3], [-0.6, 0.4]], arms: [[1.6, 0.1], [1.5, 0.15]], bob: 0 };
    case 'down': return { lean: 0.2, legs: [[0.3, 0.6], [0.6, 1.0]], arms: [[0.9, 0.9], [1.5, 0.6]], bob: 0, ball: 0 };
    case 'kick': { const p = a.p; return { lean: -0.15, legs: [[-0.6 + p * 2.1, 1.2 - p * 1.2], [-0.15, 0.25]], arms: [[-0.9, 0.3], [1.1, 0.3]], bob: 0 }; }
    case 'party': { const j = Math.abs(Math.sin(a.secs * 6)); return { lean: -0.05, legs: [[0.2, 0.4 + j * 0.6], [-0.2, 0.4 + j * 0.6]], arms: [[2.9, 0.15], [2.75, 0.2]], bob: -j * 0.28 }; }
  }
}

const shade = (hex: string, k: number) => {
  const m = hex.startsWith('rgb') ? hex.match(/\d+/g)!.map(Number) : (() => { const n = parseInt(hex.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; })();
  const f = (c: number) => Math.round(Math.max(0, Math.min(255, k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return `rgb(${f(m[0])},${f(m[1])},${f(m[2])})`;
};

/** Draws at the current transform: feet at the origin, facing +x, 1 unit = 1 yard (y up is negative). */
export function drawBody(ctx: CanvasRenderingContext2D, kit: Kit, num: number, act: Act, build: Build, skin: string, flip: number, helmetMark?: string) {
  const P = pose(act);
  const W = build === 'big' ? 1.3 : build === 'mid' ? 1.1 : 1;
  const thighW = 0.185 * W, shinW = 0.13 * W, upperW = 0.135 * W, foreW = 0.108 * W;
  const OUT = 'rgba(8,10,14,.62)', ow = 0.026;
  const legEnd = ([t, b]: [number, number]) => {
    const kx = Math.sin(t) * L.thigh, ky = Math.cos(t) * L.thigh;
    const a2 = t - b; return { kx, ky, fx: kx + Math.sin(a2) * L.shin, fy: ky + Math.cos(a2) * L.shin, a2 };
  };
  const lg = P.legs.map(legEnd);
  const hipH = Math.max(lg[0].fy, lg[1].fy) + 0.06;
  const hipY = -hipH + P.bob;
  const torso = 0.7, shX = Math.sin(P.lean) * torso, shY = hipY - Math.cos(P.lean) * torso;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Limb segment with an outline pass so he reads at any size.
  const seg = (x1: number, y1: number, x2: number, y2: number, w: number, col: string) => {
    ctx.strokeStyle = OUT; ctx.lineWidth = w + ow * 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const dot = (x: number, y: number, r: number, col: string) => { ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x, y, r + ow, 0, 7); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  const drawLeg = (i: number, back: boolean) => {
    const { kx, ky, fx, fy, a2 } = lg[i]; const d = back ? -0.3 : 0;
    const kY = hipY + ky, fY = hipY + fy;
    // thigh (pants), knee pad bulge, calf (sock) with a stripe, cleat with a white sole
    seg(0, hipY, kx, kY, thighW, shade(kit.pants, d));
    ctx.strokeStyle = shade(kit.trim, d); ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(Math.sin(P.legs[i][0]) * 0.05 - 0.05, hipY + 0.06); ctx.lineTo(kx - 0.05, kY - 0.03); ctx.stroke();
    dot(kx + 0.02, kY, thighW * 0.55, shade(kit.pants, d - 0.06));
    const mx = kx + Math.sin(a2) * 0.2, my = kY + Math.cos(a2) * 0.2;
    seg(kx, kY, mx, my, shinW * 1.08, shade(kit.socks, d));
    seg(mx, my, fx, fY, shinW * 0.9, shade(kit.socks, d - 0.05));
    ctx.strokeStyle = shade(kit.trim, d); ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(mx - 0.06, my + 0.04); ctx.lineTo(mx + 0.06, my + 0.04); ctx.stroke();
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(fx + 0.08, fY - 0.01, 0.15 * W, 0.075, 0, 0, 7); ctx.fill();
    ctx.fillStyle = back ? '#0d0d0d' : '#1a1a1a'; ctx.beginPath(); ctx.ellipse(fx + 0.08, fY - 0.02, 0.13 * W, 0.055, 0, 0, 7); ctx.fill();
    ctx.fillStyle = back ? '#9a9a9a' : '#e8e8e8'; ctx.fillRect(fx - 0.04, fY + 0.015, 0.25 * W, 0.022);
  };
  const arm = (i: number, back: boolean) => {
    const [a1, a2] = P.arms[i];
    const sx = shX + (back ? -0.05 : 0.06), sy = shY + 0.08;
    const ex = sx + Math.sin(a1 + P.lean) * L.upper, ey = sy + Math.cos(a1 + P.lean) * L.upper;
    const hx = ex + Math.sin(a1 + P.lean + a2) * L.fore, hy = ey + Math.cos(a1 + P.lean + a2) * L.fore;
    const d = back ? -0.32 : 0;
    // sleeve, bicep, forearm, wristband, glove
    const svx = sx + (ex - sx) * 0.45, svy = sy + (ey - sy) * 0.45;
    seg(sx, sy, ex, ey, upperW, shade(skin, d));
    seg(sx, sy, svx, svy, upperW * 1.25, shade(kit.jersey, d - 0.04));
    seg(ex, ey, hx, hy, foreW, shade(skin, d - 0.04));
    const wx = ex + (hx - ex) * 0.8, wy = ey + (hy - ey) * 0.8;
    seg(wx, wy, wx + (hx - ex) * 0.08, wy + (hy - ey) * 0.08, foreW * 1.15, back ? '#cfcfcf' : '#f2f2f2');
    const glove = shade(kit.trim.toLowerCase() === '#ffffff' ? kit.jersey : kit.trim, d);
    dot(hx, hy, 0.072 * W, glove);
    return [hx, hy] as const;
  };
  drawLeg(1, true);
  arm(1, true);
  // Pelvis / pants and belt.
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(0, hipY, 0.2 * W + ow, 0.15 + ow, 0, 0, 7); ctx.fill();
  ctx.fillStyle = kit.pants; ctx.beginPath(); ctx.ellipse(0, hipY, 0.2 * W, 0.15, 0, 0, 7); ctx.fill();
  // Torso: jersey over shoulder pads, leaning from the hips.
  ctx.save(); ctx.translate(0, hipY); ctx.rotate(P.lean);
  const g = ctx.createLinearGradient(-0.3, -torso, 0.3, 0);
  g.addColorStop(0, shade(kit.jersey, 0.24)); g.addColorStop(0.55, kit.jersey); g.addColorStop(1, shade(kit.jersey, -0.3));
  const body = new Path2D();
  body.moveTo(-0.16 * W, 0.02);
  body.lineTo(-0.23 * W, -torso * 0.55);
  body.quadraticCurveTo(-0.37 * W, -torso * 0.92, -0.22 * W, -torso - 0.07);
  body.quadraticCurveTo(0.02, -torso - 0.16, 0.27 * W, -torso - 0.05);
  body.quadraticCurveTo(0.4 * W, -torso * 0.86, 0.25 * W, -torso * 0.5);
  body.lineTo(0.16 * W, 0.02); body.closePath();
  ctx.strokeStyle = OUT; ctx.lineWidth = ow * 2; ctx.stroke(body);
  ctx.fillStyle = g; ctx.fill(body);
  // Pad shading under the shoulders and a side panel in the trim colour.
  ctx.save(); ctx.clip(body);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-0.4, -torso * 0.62, 0.8, 0.05);
  ctx.fillStyle = shade(kit.trim, -0.1); ctx.globalAlpha = 0.55; ctx.fillRect(-0.24 * W, -torso * 0.55, 0.05, torso * 0.55); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(-0.05, -torso - 0.03, 0.22 * W, 0.06, 0, 0, 7); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = kit.trim; ctx.lineWidth = 0.045; ctx.beginPath(); ctx.moveTo(0.17 * W, -torso * 0.76); ctx.lineTo(0.34 * W, -torso * 0.86); ctx.moveTo(0.16 * W, -torso * 0.68); ctx.lineTo(0.31 * W, -torso * 0.77); ctx.stroke();
  // Number, unflipped so it reads.
  ctx.save(); ctx.translate(0.02, -torso * 0.46); ctx.scale(0.01 * flip, 0.01);
  ctx.font = `800 ${build === 'big' ? 31 : 29}px "Barlow Condensed", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4.5; ctx.strokeStyle = kit.trim; ctx.strokeText(String(num), 0, 0);
  ctx.fillStyle = kit.num; ctx.fillText(String(num), 0, 0);
  ctx.restore();
  // Neck, helmet shell with stripe and decal, chinstrap, facemask cage.
  ctx.fillStyle = shade(skin, -0.12); ctx.fillRect(-0.04, -torso - 0.13, 0.1, 0.1);
  const hx = 0.05, hy = -torso - 0.22, R = 0.22;
  ctx.save(); ctx.translate(hx, hy); ctx.scale(0.78, 0.78); ctx.translate(-hx, -hy);
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(hx, hy, R * 1.04 + ow, R + ow, 0, 0, 7); ctx.fill();
  const hg = ctx.createRadialGradient(hx - 0.08, hy - 0.1, 0.01, hx, hy, R * 1.2);
  hg.addColorStop(0, shade(kit.helmet, 0.65)); hg.addColorStop(0.4, kit.helmet); hg.addColorStop(1, shade(kit.helmet, -0.5));
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(hx, hy, R * 1.04, R, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = kit.trim; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(hx, hy, R * 0.86, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
  ctx.fillStyle = helmetMark ?? shade(kit.trim, 0.1); ctx.beginPath(); ctx.ellipse(hx - 0.05, hy + 0.01, 0.07, 0.065, 0, 0, 7); ctx.fill();
  ctx.fillStyle = shade(skin, -0.38); ctx.beginPath(); ctx.ellipse(hx + 0.155, hy + 0.06, 0.07, 0.095, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(hx - 0.06, hy - 0.12, 0.07, 0.03, -0.4, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(20,20,20,.7)'; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(hx + 0.05, hy + 0.14); ctx.quadraticCurveTo(hx + 0.12, hy + 0.23, hx + 0.2, hy + 0.16); ctx.stroke();
  ctx.strokeStyle = kit.mask; ctx.lineWidth = 0.034;
  ctx.beginPath(); ctx.moveTo(hx + 0.12, hy - 0.06); ctx.lineTo(hx + 0.26, hy - 0.02); ctx.lineTo(hx + 0.255, hy + 0.14); ctx.lineTo(hx + 0.09, hy + 0.18);
  ctx.moveTo(hx + 0.13, hy + 0.04); ctx.lineTo(hx + 0.265, hy + 0.05); ctx.moveTo(hx + 0.2, hy - 0.04); ctx.lineTo(hx + 0.19, hy + 0.17); ctx.stroke();
  ctx.restore();
  ctx.restore();
  drawLeg(0, false);
  const [bx, by] = arm(0, false);
  if (P.ball === 0) {
    ctx.save(); ctx.translate(bx - 0.02, by - 0.06); ctx.rotate(-0.6);
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(0, 0, 0.19, 0.12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a3a12'; ctx.beginPath(); ctx.ellipse(0, 0, 0.17, 0.1, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(-0.07, -0.03); ctx.lineTo(0.07, -0.03); ctx.stroke();
    ctx.restore();
  }
}
