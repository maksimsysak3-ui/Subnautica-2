// The prime-time stage: a night stadium drawn in Canvas 2D with a real 2.5D camera. The bowl
// is a set of superellipse rings (lower bowl, LED ribbon, upper deck, rim, outer wall) whose
// quads are projected, near-plane clipped and painter-sorted each frame; the field, light
// rigs, volumetric beams, a crowd of camera flashes, fireworks, sparks and weather sit in
// the same space. Every static layer (sky, skyline, crowd texture, sprites, vignette, grain)
// is rendered once to an offscreen canvas; a frame only projects points and blits.
export type Look = 'thu' | 'sun' | 'mon';
type RGB = [number, number, number];

export interface StageOpts {
  look: Look;
  home: string; home2: string; away: string; away2: string;
  /** Home logo for the midfield mark (drawn only once it has loaded). */
  logo?: string;
  precip: 'none' | 'rain' | 'snow'; dome: boolean; dusk: boolean;
  /** Impact moments (seconds): screen shake, flash bursts, sparks. */
  hits: number[];
  /** Hard camera cuts (seconds): a flash frame on the cut. */
  cuts: number[];
  /** The DOM layer that shakes with the camera. */
  shakeEl?: HTMLElement | null;
  seed: number;
}

const rgbOf = (c: string): RGB => {
  if (c[0] === '#') { const n = parseInt(c.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = c.match(/\d+/g); return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
};
const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const ease = { io: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2), out: (x: number) => 1 - Math.pow(1 - x, 3), lin: (x: number) => x, inq: (x: number) => x * x * x, soft: (x: number) => 1 - Math.pow(1 - x, 2.2) };

interface Pal { sky: [string, string, string]; ground: RGB; stands: RGB; accent: RGB; accent2: RGB; light: RGB; beam: RGB[]; grass: [RGB, RGB]; skyline: RGB; window: RGB; metal: RGB }
const PAL: Record<Look, Pal> = {
  thu: { sky: ['#030010', '#13062f', '#0b2b4a'], ground: [4, 6, 14], stands: [14, 11, 30], accent: [25, 240, 224], accent2: [168, 82, 255], light: [214, 250, 255], beam: [[90, 240, 255], [190, 120, 255]], grass: [[28, 100, 72], [24, 90, 64]], skyline: [9, 6, 24], window: [110, 225, 255], metal: [30, 26, 54] },
  sun: { sky: ['#01030b', '#051639', '#14387c'], ground: [3, 6, 14], stands: [12, 15, 32], accent: [244, 197, 90], accent2: [255, 233, 172], light: [255, 244, 216], beam: [[255, 236, 194]], grass: [[40, 112, 54], [34, 100, 48]], skyline: [5, 10, 26], window: [255, 212, 140], metal: [26, 30, 46] },
  mon: { sky: ['#000000', '#070102', '#2a0508'], ground: [6, 3, 3], stands: [20, 13, 13], accent: [232, 22, 42], accent2: [255, 112, 64], light: [255, 236, 228], beam: [[255, 222, 210]], grass: [[30, 74, 38], [25, 64, 32]], skyline: [12, 3, 5], window: [255, 126, 86], metal: [44, 40, 42] },
};
const DUSK: Record<Look, [string, string, string]> = { thu: ['#0a0526', '#3a1d6a', '#c0607a'], sun: ['#06153e', '#2c4f9a', '#e09a5a'], mon: ['#080204', '#3a0b10', '#b0442a'] };

// ---- camera shots -------------------------------------------------------------------------
// 'p' polar: [angleDeg, radius, height, tx, ty, tz, fovDeg, roll]; 'c' cartesian: [px, py, pz, tx, ty, tz, fov, roll]
type Shot = { t0: number; t1: number; k: 'p' | 'c'; a: number[]; b: number[]; e: (x: number) => number };
const S = (t0: number, t1: number, k: 'p' | 'c', a: number[], b: number[], e: (x: number) => number = ease.io): Shot => ({ t0, t1, k, a, b, e });
const SHOTS: Record<Look, Shot[]> = {
  thu: [
    S(0, 0.85, 'c', [-78, 5, -33, 6, 3, -12, 62, -0.03], [-34, 4, -33, 50, 3, -10, 60, 0], ease.lin),
    S(0.85, 1.7, 'p', [38, 175, 150, 0, 0, 0, 50, 0], [72, 160, 125, 0, 0, 0, 48, 0], ease.lin),
    S(1.7, 2.6, 'c', [72, 3, 30, 0, 26, -70, 60, 0.04], [48, 8, 20, 0, 20, -70, 56, 0.02], ease.out),
    S(2.6, 4.8, 'p', [-102, 220, 74, 0, 4, 0, 46, 0], [-80, 205, 66, 0, 4, 0, 45, 0], ease.lin),
    S(4.8, 7.0, 'p', [160, 150, 38, 0, 10, 0, 52, 0], [186, 140, 34, 0, 10, 0, 50, 0], ease.lin),
    S(7.0, 9.4, 'p', [-62, 270, 122, 0, 0, 0, 45, 0], [-40, 190, 86, 0, 0, 0, 44, 0], ease.out),
  ],
  sun: [
    S(0, 10.8, 'p', [-164, 470, 215, 0, 0, 0, 50, 0], [-64, 96, 60, 0, 2, 0, 46, 0], ease.soft),
    S(10.8, 12, 'p', [-64, 96, 60, 0, 2, 0, 46, 0], [-60, 62, 30, 0, 6, 0, 42, 0], ease.inq),
  ],
  mon: [
    S(0, 3.1, 'c', [-60, 2.2, -9, 40, 24, 12, 64, -0.09], [-49, 2.8, -6, 40, 22, 12, 60, -0.06], ease.lin),
    S(3.1, 5.7, 'p', [98, 138, 54, 0, 0, 0, 48, 0.035], [112, 128, 50, 0, 0, 0, 47, 0.03], ease.lin),
    S(5.7, 7.7, 'c', [22, 1.6, 31, -30, 12, -22, 60, 0.08], [14, 2.2, 28, -30, 12, -22, 58, 0.06], ease.lin),
    S(7.7, 10.6, 'p', [-132, 235, 96, 0, 0, 0, 46, 0], [-118, 165, 68, 0, 0, 0, 45, 0], ease.out),
  ],
};
const SHAKE: Record<Look, number> = { thu: 5, sun: 0, mon: 15 };

// ---- geometry -----------------------------------------------------------------------------
const N = 64;                                   // segments around the bowl
const RINGS: [number, number, number][] = [     // [a, b, y]: superellipse half-axes (yards) and height
  [68, 38, 1.5], [93, 61, 15], [95, 63, 20.5], [120, 88, 42], [122, 90, 48], [126, 94, 0],
];
// Bands between rings: kind 0 lower stands, 1 LED ribbon, 2 upper deck, 3 rim fascia, 4 outer wall
const BANDS: [number, number, number][] = [[0, 1, 0], [1, 2, 1], [2, 3, 2], [3, 4, 3], [4, 5, 4]];
const SE = 2 / 5;                                // superellipse exponent: a rounded rectangle
const ringPt = (a: number, b: number, th: number): [number, number] => {
  const c = Math.cos(th), s = Math.sin(th);
  return [a * Math.sign(c) * Math.pow(Math.abs(c), SE), b * Math.sign(s) * Math.pow(Math.abs(s), SE)];
};

function rngOf(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
  return [c, c.getContext('2d')!];
}
function glowSprite(c: RGB, size = 64, core = 0.18): HTMLCanvasElement {
  const [cv, x] = canvas(size, size), r = size / 2, g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(core, rgba(c, 0.9)); g.addColorStop(0.45, rgba(c, 0.25)); g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g; x.fillRect(0, 0, size, size); return cv;
}
function beamSprite(c: RGB): HTMLCanvasElement {
  const [cv, x] = canvas(64, 256);
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, rgba(c, 0.9)); g.addColorStop(0.5, rgba(c, 0.35)); g.addColorStop(1, rgba(c, 0.05));
  x.fillStyle = g; x.beginPath(); x.moveTo(29, 0); x.lineTo(35, 0); x.lineTo(64, 256); x.lineTo(0, 256); x.closePath(); x.fill();
  // soften the edges
  x.globalCompositeOperation = 'destination-in';
  const h = x.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = h; x.fillRect(0, 0, 64, 256); return cv;
}
function streakSprite(c: RGB): HTMLCanvasElement {
  const [cv, x] = canvas(512, 48), g = x.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.42, rgba(c, 0.5)); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(0.58, rgba(c, 0.5)); g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g; x.fillRect(0, 22, 512, 4);
  x.globalAlpha = 0.35; x.fillRect(0, 18, 512, 12);
  x.globalCompositeOperation = 'destination-in'; const v = x.createLinearGradient(0, 0, 0, 48);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.5, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = 1; x.fillStyle = v; x.fillRect(0, 0, 512, 48);
  return cv;
}
function ringSprite(c: RGB): HTMLCanvasElement {
  const [cv, x] = canvas(128, 128), g = x.createRadialGradient(64, 64, 30, 64, 64, 64);
  g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.75, rgba(c, 0.22)); g.addColorStop(0.9, rgba(c, 0.4)); g.addColorStop(1, rgba(c, 0));
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return cv;
}
function bankSprite(c: RGB): HTMLCanvasElement {
  const [cv, x] = canvas(96, 64);
  x.fillStyle = 'rgba(10,12,18,.9)'; x.fillRect(16, 18, 64, 30);
  const g = glowSprite(c, 32, 0.3);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) x.drawImage(g, 14 + i * 13, 14 + j * 13, 18, 18);
  return cv;
}
function crowdTile(base: RGB, home: RGB, away: RGB, look: Look, rnd: () => number, scale: number): HTMLCanvasElement {
  const T = 96 * scale, [cv, x] = canvas(T, T);
  x.fillStyle = rgba(base); x.fillRect(0, 0, T, T);
  const tints: RGB[] = [home, home, home, mix(home, [255, 255, 255], 0.5), away, [200, 200, 205], [90, 70, 60], [150, 110, 90], [40, 40, 50], look === 'thu' ? [60, 200, 220] : look === 'mon' ? [150, 30, 30] : [200, 170, 110]];
  for (let i = 0; i < 1300; i++) {
    const c = tints[(rnd() * tints.length) | 0], k = 0.22 + rnd() * 0.34;
    x.fillStyle = rgba(mix([0, 0, 0], c, k));
    x.fillRect((rnd() * T) | 0, (rnd() * T) | 0, scale * (1 + (rnd() * 1.6) | 0), scale * (1 + (rnd() * 1.4) | 0));
  }
  // rows of seats
  x.fillStyle = 'rgba(0,0,0,.28)'; for (let y = 0; y < T; y += 4 * scale) x.fillRect(0, y, T, scale);
  return cv;
}
function skylineStrip(w: number, h: number, pal: Pal, rnd: () => number, far: boolean): HTMLCanvasElement {
  const [cv, x] = canvas(w, h);
  const col = far ? mix(pal.skyline, [60, 70, 110], 0.18) : pal.skyline;
  let px = 0;
  while (px < w) {
    const bw = (far ? 18 : 26) + rnd() * (far ? 40 : 70), bh = h * (far ? 0.18 + rnd() * 0.42 : 0.12 + rnd() * (rnd() < 0.12 ? 0.85 : 0.45));
    x.fillStyle = rgba(col); x.fillRect(px, h - bh, bw, bh);
    if (!far && rnd() < 0.25) { x.fillRect(px + bw / 2 - 1, h - bh - h * 0.06, 2, h * 0.06); }
    // lit windows
    for (let wy = h - bh + 5; wy < h - 3; wy += 6) for (let wx = px + 3; wx < px + bw - 3; wx += 5) {
      if (rnd() < (far ? 0.12 : 0.2)) { x.fillStyle = rgba(pal.window, far ? 0.25 + rnd() * 0.2 : 0.35 + rnd() * 0.45); x.fillRect(wx, wy, 2, 2); }
    }
    px += bw + (rnd() < 0.3 ? rnd() * 20 : 0);
  }
  return cv;
}

export function mountStage(cv: HTMLCanvasElement, o: StageOpts): () => void {
  const ctx = cv.getContext('2d', { alpha: false })!;
  const pal = PAL[o.look], look = o.look, rnd = rngOf(o.seed);
  const home = rgbOf(o.home), home2 = rgbOf(o.home2), away = rgbOf(o.away);
  const shots = SHOTS[look];
  const sky = o.dusk ? DUSK[look] : pal.sky;

  // ---- sprites (once) ----
  const glowL = glowSprite(pal.light), glowA = glowSprite(pal.accent), glowA2 = glowSprite(pal.accent2);
  const flashS = glowSprite([230, 240, 255], 48, 0.12);
  const beams = pal.beam.map(beamSprite);
  const streak = streakSprite(pal.accent), streakW = streakSprite(pal.light), ghost = ringSprite(pal.accent2);
  const bank = bankSprite(pal.light);
  const crowdFar = crowdTile(pal.stands, home, away, look, rnd, 1), crowdNear = crowdTile(pal.stands, home, away, look, rnd, 2);
  const patFar = ctx.createPattern(crowdFar, 'repeat')!, patNear = ctx.createPattern(crowdNear, 'repeat')!;
  const PM = new DOMMatrix();
  const [grainC, gx] = canvas(256, 256);
  { const id = gx.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const v = (rnd() * 255) | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } gx.putImageData(id, 0, 0); }
  const grain = ctx.createPattern(grainC, 'repeat')!;
  let logo: HTMLImageElement | null = null;
  if (o.logo) { const im = new Image(); im.onload = () => { logo = im; }; im.src = o.logo; }
  // shade strings, precomputed so the frame loop never builds colours
  const SHADE = Array.from({ length: 24 }, (_, i) => `rgba(0,0,0,${(i / 23 * 0.92).toFixed(3)})`);
  const ribbonCols = [pal.accent, home, pal.accent, home2.every(v => v > 200) || home2.every(v => v < 30) ? pal.accent2 : home2];
  const RIB = ribbonCols.map(c => Array.from({ length: 12 }, (_, i) => rgba(mix([0, 0, 0], c, 0.25 + 0.75 * (i / 11)))));
  const RIM = rgba(pal.metal), WALL = rgba(mix(pal.metal, [0, 0, 0], 0.55)), WALL2 = rgba(mix(pal.metal, [0, 0, 0], 0.3));
  const GRASS = pal.grass.map(c => rgba(c)), APRON = rgba(mix(pal.grass[1], [0, 0, 0], 0.35));
  const EZ = rgba(mix(home, [0, 0, 0], 0.35)), GROUND = rgba(pal.ground);
  const winCol = rgba(pal.window, 0.75), STRIP = rgba(mix(pal.window, [255, 255, 255], 0.3), 0.55);

  // ---- world (once) ----
  const R = RINGS.length, RX = new Float32Array(R * N), RZ = new Float32Array(R * N);
  for (let k = 0; k < R; k++) for (let j = 0; j < N; j++) { const [x, z] = ringPt(RINGS[k][0], RINGS[k][1], (j / N) * Math.PI * 2); RX[k * N + j] = x; RZ[k * N + j] = z; }
  const NQ = BANDS.length * N, QV = new Float32Array(NQ * 12), QC = new Float32Array(NQ * 3), QK = new Uint8Array(NQ), QJ = new Uint16Array(NQ);
  for (let bi = 0; bi < BANDS.length; bi++) {
    const [ka, kb, kind] = BANDS[bi];
    for (let j = 0; j < N; j++) {
      const q = bi * N + j, j2 = (j + 1) % N, v = q * 12;
      const P = [[ka, j], [ka, j2], [kb, j2], [kb, j]];
      let sx = 0, sy = 0, sz = 0;
      for (let p = 0; p < 4; p++) { const [k, jj] = P[p]; QV[v + p * 3] = RX[k * N + jj]; QV[v + p * 3 + 1] = RINGS[k][2]; QV[v + p * 3 + 2] = RZ[k * N + jj]; sx += QV[v + p * 3]; sy += QV[v + p * 3 + 1]; sz += QV[v + p * 3 + 2]; }
      QC[q * 3] = sx / 4; QC[q * 3 + 1] = sy / 4; QC[q * 3 + 2] = sz / 4; QK[q] = kind; QJ[q] = j;
    }
  }
  const order = Array.from({ length: NQ }, (_, i) => i), QD = new Float32Array(NQ);
  // apron and ground polygons
  const AP = new Float32Array(N * 3); for (let j = 0; j < N; j++) { AP[j * 3] = RX[j]; AP[j * 3 + 1] = 0; AP[j * 3 + 2] = RZ[j]; }
  const GR = new Float32Array([-9000, -0.5, -9000, 9000, -0.5, -9000, 9000, -0.5, 9000, -9000, -0.5, 9000]);
  const FQ = new Float32Array(12);
  // crowd flashes on the stands
  const NF = 1500, FP = new Float32Array(NF * 3), FPh = new Float32Array(NF), FRate = new Float32Array(NF);
  for (let i = 0; i < NF; i++) {
    const band = rnd() < 0.55 ? 0 : 2, q = band * N + ((rnd() * N) | 0), u = 0.1 + rnd() * 0.85, w = rnd(), v = q * 12;
    const ax = QV[v] + (QV[v + 3] - QV[v]) * w, az = QV[v + 2] + (QV[v + 5] - QV[v + 2]) * w, ay = QV[v + 1];
    const bx = QV[v + 9] + (QV[v + 6] - QV[v + 9]) * w, bz = QV[v + 11] + (QV[v + 8] - QV[v + 11]) * w, by = QV[v + 10];
    FP[i * 3] = ax + (bx - ax) * u; FP[i * 3 + 1] = ay + (by - ay) * u + 0.8; FP[i * 3 + 2] = az + (bz - az) * u;
    FPh[i] = rnd(); FRate[i] = 0.18 + rnd() * 0.5;
  }
  // city lights on the ground outside
  const NC = 2600, CP = new Float32Array(NC * 2);
  for (let i = 0; i < NC; i++) {
    let x = 0, z = 0;
    do { const along = (rnd() * 2 - 1) * 1500, street = Math.round((rnd() * 2 - 1) * 1500 / 110) * 110; [x, z] = rnd() < 0.5 ? [along, street] : [street, along]; } while (Math.abs(x) < 170 && Math.abs(z) < 140);
    CP[i * 2] = x; CP[i * 2 + 1] = z;
  }
  // light rigs along the rim
  const RIGS: number[] = [];
  for (const deg of [62, 76, 90, 104, 118, -62, -76, -90, -104, -118, 18, -18, 162, -162]) { const [x, z] = ringPt(124, 92, deg * Math.PI / 180); RIGS.push(x, 56, z); }
  const NR = RIGS.length / 3;
  // fireworks (Sunday) and sky lasers (Thursday)
  const NFW = 64, FWD = new Float32Array(NFW * 3);
  for (let i = 0; i < NFW; i++) { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u); FWD[i * 3] = s * Math.cos(a); FWD[i * 3 + 1] = u; FWD[i * 3 + 2] = s * Math.sin(a); }
  const BURSTS = look === 'sun' ? [[1.3, -60, 120, 110], [1.9, 70, 140, 120], [2.5, 0, 165, 150], [3.1, -110, 110, -40], [9.6, -40, 130, 100], [10.1, 60, 120, 90]] : [];
  // screen-space particles: [x, y, vx, vy, life, size]
  const NP = 420, PP = new Float32Array(NP * 6);
  const NA = 90, AA = new Float32Array(NA * 4);      // ambient motes: x, y, speed, phase (unit coords)
  for (let i = 0; i < NA; i++) { AA[i * 4] = rnd(); AA[i * 4 + 1] = rnd(); AA[i * 4 + 2] = 0.2 + rnd(); AA[i * 4 + 3] = rnd() * 6.28; }
  const wet = !o.dome && o.precip !== 'none';
  const NW = wet ? (o.precip === 'rain' ? 340 : 260) : 0, WP = new Float32Array(NW * 3);
  for (let i = 0; i < NW; i++) { WP[i * 3] = rnd(); WP[i * 3 + 1] = rnd(); WP[i * 3 + 2] = 0.4 + rnd() * 0.6; }

  // ---- size-dependent layers ----
  let W = 1, H = 1, dpr = 1, skyC: HTMLCanvasElement | null = null, vigC: HTMLCanvasElement | null = null, sky1: HTMLCanvasElement | null = null, sky2: HTMLCanvasElement | null = null;
  const resize = () => {
    const cw = cv.clientWidth || window.innerWidth, ch = cv.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2.6e6 / (cw * ch)));
    W = Math.round(cw * dpr); H = Math.round(ch * dpr); cv.width = W; cv.height = H;
    const r2 = rngOf(o.seed + 7);
    let x: CanvasRenderingContext2D;
    [skyC, x] = canvas(W, H * 1.6);
    const g = x.createLinearGradient(0, 0, 0, H * 1.6); g.addColorStop(0, sky[0]); g.addColorStop(0.55, sky[1]); g.addColorStop(0.9, sky[2]); g.addColorStop(1, sky[2]);
    x.fillStyle = g; x.fillRect(0, 0, W, H * 1.6);
    const stars = look === 'mon' ? 120 : look === 'sun' ? 420 : 260;
    for (let i = 0; i < stars; i++) { const a = r2(); x.fillStyle = `rgba(255,255,255,${(0.15 + a * 0.7) * (1 - r2() * 0.5)})`; const s = a > 0.96 ? 2 : 1; x.fillRect(r2() * W, Math.pow(r2(), 1.6) * H * 1.1, s * dpr, s * dpr); }
    if (look === 'sun') { // a soft milky band
      x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 30; i++) { const gx2 = W * (0.1 + i / 30 * 0.8), gy = H * (0.15 + Math.sin(i / 5) * 0.06); const rg = x.createRadialGradient(gx2, gy, 0, gx2, gy, H * 0.18); rg.addColorStop(0, 'rgba(120,150,255,.035)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = rg; x.fillRect(gx2 - H * 0.2, gy - H * 0.2, H * 0.4, H * 0.4); }
      x.globalCompositeOperation = 'source-over';
    }
    sky1 = skylineStrip(Math.max(W * 2, 1600), Math.round(H * 0.16), pal, rngOf(o.seed + 3), true);
    sky2 = skylineStrip(Math.max(W * 2, 1600), Math.round(H * 0.2), pal, rngOf(o.seed + 5), false);
    [vigC, x] = canvas(W, H);
    const v = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.56);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, look === 'mon' ? 'rgba(0,0,0,.85)' : 'rgba(0,0,0,.7)');
    x.fillStyle = v; x.fillRect(0, 0, W, H);
  };
  resize();
  window.addEventListener('resize', resize);

  // ---- camera ----
  let cx = 0, cy = 0, F = 1, px = 0, py = 0, pz = 0, rx = 0, rz = 0, ux = 0, uy = 0, uz = 0, fx = 0, fy = 0, fz = 0, roll = 0;
  const camv = new Float32Array(8);
  const setCam = (t: number) => {
    let s = shots[shots.length - 1];
    for (const sh of shots) if (t < sh.t1) { s = sh; break; }
    const k = s.e(clamp((t - s.t0) / (s.t1 - s.t0), 0, 1));
    for (let i = 0; i < 8; i++) camv[i] = s.a[i] + (s.b[i] - s.a[i]) * k;
    if (s.k === 'p') { const a = camv[0] * Math.PI / 180; px = Math.cos(a) * camv[1]; pz = Math.sin(a) * camv[1]; py = camv[2]; }
    else { px = camv[0]; py = camv[1]; pz = camv[2]; }
    // a slow drift so nothing is ever perfectly still
    const dr = Math.sin(t * 0.7) * 0.6;
    fx = camv[3] - px; fy = camv[4] + dr - py; fz = camv[5] - pz;
    const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    rx = fz; rz = -fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    // u = cross(f, r) with r = (rx, 0, rz)
    ux = fy * rz; uy = fz * rx - fx * rz; uz = -fy * rx;
    F = (H / 2) / Math.tan((camv[6] * Math.PI / 180) / 2); cx = W / 2; cy = H / 2; roll = camv[7];
  };
  // project into module scratch: returns depth (<=0 if behind)
  let SX = 0, SY = 0;
  const proj = (x: number, y: number, z: number) => {
    const dx = x - px, dy = y - py, dz = z - pz, Z = dx * fx + dy * fy + dz * fz;
    if (Z < 0.5) return -1;
    SX = cx + F * (dx * rx + dz * rz) / Z; SY = cy - F * (dx * ux + dy * uy + dz * uz) / Z; return Z;
  };
  const CA = new Float32Array(3 * 72), CB = new Float32Array(3 * 150);
  let P0x = 0, P0y = 0, P0z = 0;
  /** Path a world polygon (near-plane clipped). False when fully behind the camera. */
  const polyPath = (A: Float32Array, off: number, n: number) => {
    let any = false, all = true;
    for (let i = 0; i < n; i++) {
      const dx = A[off + i * 3] - px, dy = A[off + i * 3 + 1] - py, dz = A[off + i * 3 + 2] - pz;
      const Z = dx * fx + dy * fy + dz * fz;
      CA[i * 3] = dx * rx + dz * rz; CA[i * 3 + 1] = dx * ux + dy * uy + dz * uz; CA[i * 3 + 2] = Z;
      if (Z >= 0.5) any = true; else all = false;
    }
    if (!any) return false;
    let src = CA, m = n;
    if (!all) {
      m = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, zi = CA[i * 3 + 2], zj = CA[j * 3 + 2], ii = zi >= 0.5, ij = zj >= 0.5;
        if (ii) { CB[m * 3] = CA[i * 3]; CB[m * 3 + 1] = CA[i * 3 + 1]; CB[m * 3 + 2] = zi; m++; }
        if (ii !== ij) { const k = (0.5 - zi) / (zj - zi); CB[m * 3] = CA[i * 3] + (CA[j * 3] - CA[i * 3]) * k; CB[m * 3 + 1] = CA[i * 3 + 1] + (CA[j * 3 + 1] - CA[i * 3 + 1]) * k; CB[m * 3 + 2] = 0.5; m++; }
      }
      src = CB; if (m < 3) return false;
    }
    ctx.beginPath();
    for (let i = 0; i < m; i++) {
      const Z = src[i * 3 + 2], x = cx + F * src[i * 3] / Z, y = cy - F * src[i * 3 + 1] / Z;
      if (i === 0) { ctx.moveTo(x, y); P0x = x; P0y = y; P0z = Z; } else ctx.lineTo(x, y);
    }
    ctx.closePath(); return true;
  };
  const rectXZ = (x0: number, z0: number, x1: number, z1: number) => {
    FQ[0] = x0; FQ[1] = 0.02; FQ[2] = z0; FQ[3] = x1; FQ[4] = 0.02; FQ[5] = z0; FQ[6] = x1; FQ[7] = 0.02; FQ[8] = z1; FQ[9] = x0; FQ[10] = 0.02; FQ[11] = z1;
    if (polyPath(FQ, 0, 4)) ctx.fill();
  };
  const line3 = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
    let a = (x1 - px) * fx + (y1 - py) * fy + (z1 - pz) * fz, b = (x2 - px) * fx + (y2 - py) * fy + (z2 - pz) * fz;
    if (a < 0.5 && b < 0.5) return;
    if (a < 0.5) { const k = (0.5 - a) / (b - a); x1 += (x2 - x1) * k; y1 += (y2 - y1) * k; z1 += (z2 - z1) * k; a = 0.5; }
    if (b < 0.5) { const k = (0.5 - b) / (a - b); x2 += (x1 - x2) * k; y2 += (y1 - y2) * k; z2 += (z1 - z2) * k; b = 0.5; }
    proj(x1, y1, z1); ctx.moveTo(SX, SY); proj(x2, y2, z2); ctx.lineTo(SX, SY);
  };
  const sprite = (img: CanvasImageSource, x: number, y: number, s: number) => ctx.drawImage(img, x - s / 2, y - s / 2, s, s);

  // ---- time & effects ----
  const t0 = performance.now();
  let raf = 0, last = 0, pi = 0;
  const hitAmt = (t: number, k: number) => { let v = 0; for (const h of o.hits) if (t >= h && t < h + 1.5) v += Math.exp(-(t - h) * k); return v; };
  const spawn = (x: number, y: number, n: number, sp: number) => {
    for (let i = 0; i < n; i++) {
      const p = (pi = (pi + 1) % NP) * 6, a = rnd() * Math.PI * 2, v = sp * (0.3 + rnd());
      PP[p] = x; PP[p + 1] = y; PP[p + 2] = Math.cos(a) * v; PP[p + 3] = Math.sin(a) * v - sp * 0.4; PP[p + 4] = 0.5 + rnd() * 0.7; PP[p + 5] = 1 + rnd() * 2;
    }
  };
  let shakeStr = '';

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000, dt = Math.min(0.05, Math.max(0, t - last));
    // hits that just fired
    for (const h of o.hits) if (last < h && t >= h) { if (look === 'mon') { spawn(W * 0.5, H * 0.52, 70, H * 0.9); } else if (look === 'thu') spawn(W * 0.5, H * 0.5, 26, H * 0.7); }
    last = t;
    setCam(t);
    // shake
    let shx = 0, shy = 0;
    const amp = SHAKE[look];
    if (amp) for (const h of o.hits) if (t >= h && t < h + 0.6) { const d = t - h, e = Math.exp(-d * 9) * amp; shx += Math.sin(d * 83) * e; shy += Math.cos(d * 71) * e * 0.8; }
    if (o.shakeEl) { const s = shx || shy ? `translate3d(${shx.toFixed(1)}px,${shy.toFixed(1)}px,0)` : ''; if (s !== shakeStr) { o.shakeEl.style.transform = s; shakeStr = s; } }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.translate(W / 2 + shx * dpr, H / 2 + shy * dpr); ctx.rotate(roll); ctx.scale(1.08, 1.08); ctx.translate(-W / 2, -H / 2);

    // sky: shifts with pitch (horizon) and yaw
    const yaw = Math.atan2(fx, fz), hl = Math.hypot(fx, fz) || 1;
    const hz = proj(px + fx / hl * 9000, 0, pz + fz / hl * 9000) > 0 ? SY : -H;
    const horizon = proj(px + fx / hl * 1e6, py, pz + fz / hl * 1e6) > 0 ? SY : 0;
    ctx.drawImage(skyC!, -W * 0.1, horizon - H * 1.45, W * 1.2, H * 1.6);
    if (horizon > H * 1.0) { ctx.fillStyle = sky[2]; ctx.fillRect(-W * 0.1, horizon + H * 0.15, W * 1.2, H * 2); }
    ctx.fillStyle = GROUND; if (polyPath(GR, 0, 4)) ctx.fill();
    // skyline on the far ground edge, two parallax depths
    const sw1 = sky1!.width, off1 = ((-yaw / (Math.PI * 2)) * sw1 * 2.2) % sw1, sw2 = sky2!.width, off2 = ((-yaw / (Math.PI * 2)) * sw2 * 3.4) % sw2;
    for (let k = -1; k <= 1; k++) { ctx.drawImage(sky1!, off1 + k * sw1, hz - sky1!.height + 2); }
    for (let k = -1; k <= 1; k++) { ctx.drawImage(sky2!, off2 + k * sw2, hz - sky2!.height + 3); }
    // horizon glow
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = look === 'mon' ? 0.28 : 0.3; ctx.drawImage(glowA, -W * 0.2, hz - H * 0.18, W * 1.4, H * 0.36);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // light spill around the stadium, then the city
    { const Z = proj(0, 0, 0); if (Z > 0) { const s = F * 520 / Z; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = look === 'mon' ? 0.16 : 0.2; ctx.drawImage(look === 'sun' ? glowA : glowL, SX - s, SY - s * 0.5, s * 2, s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } }
    if (py > 30) {
      ctx.fillStyle = winCol; ctx.beginPath();
      for (let i = 0; i < NC; i++) { const Z = proj(CP[i * 2], 0, CP[i * 2 + 1]); if (Z > 0 && SX > -10 && SX < W + 10 && SY > 0 && SY < H) { const s = clamp(F * 2.6 / Z, 0.8, 2.6) * dpr; ctx.rect(SX, SY, s, s); } }
      ctx.fill();
    }

    // field
    ctx.fillStyle = APRON; if (polyPath(AP, 0, N)) ctx.fill();
    for (let i = 0; i < 22; i++) {
      const x0 = i === 0 ? -60 : -50 + (i - 1) * 5, x1 = i === 0 ? -50 : i === 21 ? 60 : x0 + 5;
      const xx0 = i === 21 ? 50 : x0;
      FQ[0] = xx0; FQ[1] = 0; FQ[2] = -26.65; FQ[3] = x1; FQ[4] = 0; FQ[5] = -26.65; FQ[6] = x1; FQ[7] = 0; FQ[8] = 26.65; FQ[9] = xx0; FQ[10] = 0; FQ[11] = 26.65;
      ctx.fillStyle = i === 0 || i === 21 ? EZ : GRASS[i & 1];
      if (polyPath(FQ, 0, 4)) ctx.fill();
    }
    // light pool on the turf
    ctx.globalCompositeOperation = 'lighter';
    { const Z = proj(0, 0, 0); if (Z > 0) { const s = Math.min(F * 150 / Z, W * 2); ctx.globalAlpha = look === 'mon' ? 0.07 : 0.11; ctx.drawImage(glowL, SX - s, SY - s * 0.5, s * 2, s); ctx.globalAlpha = 1; } }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    for (let x = -50; x <= 50; x += 5) { const w = x % 50 === 0 ? 0.35 : 0.2; rectXZ(x - w, -26.65, x + w, 26.65); }
    rectXZ(-60, -27.4, 60, -26.65); rectXZ(-60, 26.65, 60, 27.4); rectXZ(-60.7, -27.4, -60, 27.4); rectXZ(60, -27.4, 60.7, 27.4);
    for (let x = -45; x <= 45; x += 5) for (const z of [-26.65, -3.1, 2.4, 25.95]) rectXZ(x - 0.12, z, x + 0.12, z + 0.7);
    if (logo) {
      const Z = proj(0, 0.03, 0);
      if (Z > 0) { const ox = SX, oy = SY; proj(7, 0.03, 0); const ax = SX - ox, ay = SY - oy; proj(0, 0.03, 7); const bx = SX - ox, by = SY - oy;
        ctx.save(); ctx.transform(ax, ay, bx, by, ox, oy); ctx.globalAlpha = 0.85; ctx.drawImage(logo, -1, -1, 2, 2); ctx.restore(); }
    }
    if (look === 'thu') { // neon scan line racing down the field
      const sx = ((t * 70) % 160) - 80; ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(pal.accent, 0.25); ctx.lineWidth = clamp(F * 2.2 / Math.max(1, proj(sx, 0, 0)), 2, 30); ctx.beginPath(); line3(sx, 0.05, -26.65, sx, 0.05, 26.65); ctx.stroke();
      ctx.strokeStyle = rgba(pal.accent, 0.9); ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); line3(sx, 0.05, -26.65, sx, 0.05, 26.65); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    // the bowl, painter-sorted
    for (let q = 0; q < NQ; q++) QD[q] = (QC[q * 3] - px) * fx + (QC[q * 3 + 1] - py) * fy + (QC[q * 3 + 2] - pz) * fz;
    order.sort((a, b) => QD[b] - QD[a]);
    for (let n = 0; n < NQ; n++) {
      const q = order[n]; if (QD[q] < -60) continue;
      if (!polyPath(QV, q * 12, 4)) continue;
      const kind = QK[q], fog = clamp(P0z / 900, 0, 0.5);
      if (kind === 0 || kind === 2) {
        const pat = P0z < 120 ? patNear : patFar, sc = clamp(F * 0.22 / P0z / (pat === patNear ? 2 : 1), 0.55, 2.4);
        PM.a = sc; PM.d = sc; PM.e = P0x; PM.f = P0y; pat.setTransform(PM);
        ctx.fillStyle = pat; ctx.fill();
        ctx.fillStyle = SHADE[clamp(Math.round((kind === 2 ? 0.34 : 0.22) * 23 + fog * 23), 0, 23)]; ctx.fill();
      } else if (kind === 1) {
        const j = QJ[q], sect = ((j / 8) | 0) & 3, b = 0.6 + 0.4 * Math.sin(j * 0.5 - t * (look === 'thu' ? 9 : look === 'mon' ? 3 : 2));
        ctx.fillStyle = RIB[sect][clamp(Math.round(b * (look === 'mon' ? 8 : 11)), 0, 11)]; ctx.fill();
      } else if (kind === 3) { ctx.fillStyle = RIM; ctx.fill(); }
      else { const nx = QC[q * 3] / 15876, nz = QC[q * 3 + 2] / 8836, nl = Math.hypot(nx, nz), vx = px - QC[q * 3], vz = pz - QC[q * 3 + 2], face = (nx * vx + nz * vz) / (nl * Math.hypot(vx, vz) + 1e-6);
        ctx.fillStyle = face > 0.5 ? WALL2 : WALL; ctx.fill(); ctx.fillStyle = SHADE[clamp(Math.round((0.5 - face * 0.4) * 14 + fog * 20), 0, 23)]; ctx.fill();
        if (face > -0.2) { const v = q * 12; ctx.strokeStyle = STRIP; ctx.lineWidth = clamp(F * 0.9 / P0z, 0.6, 6); ctx.beginPath();
          for (const k of [0.3, 0.62]) { const ax = QV[v] + (QV[v + 9] - QV[v]) * k, ay = QV[v + 1] + (QV[v + 10] - QV[v + 1]) * k, az = QV[v + 2] + (QV[v + 11] - QV[v + 2]) * k, bx = QV[v + 3] + (QV[v + 6] - QV[v + 3]) * k, by = QV[v + 4] + (QV[v + 7] - QV[v + 4]) * k, bz = QV[v + 5] + (QV[v + 8] - QV[v + 5]) * k; line3(ax, ay, az, bx, by, bz); }
          ctx.stroke(); } }
    }

    // flashes
    ctx.globalCompositeOperation = 'lighter';
    const boost = hitAmt(t, 3) + (look === 'sun' ? 0.6 * Math.max(0, Math.sin(t * 0.9)) : 0);
    const width = (look === 'thu' ? 0.05 : look === 'sun' ? 0.045 : 0.03) * (1 + 2.5 * boost);
    for (let i = 0; i < NF; i++) {
      const ph = (t * FRate[i] + FPh[i]) % 1; if (ph > width) continue;
      const Z = proj(FP[i * 3], FP[i * 3 + 1], FP[i * 3 + 2]); if (Z <= 0 || SX < 0 || SX > W || SY < 0 || SY > H) continue;
      const s = clamp(F * 1.8 / Z, 2.5, 26) * (1 - ph / width) * dpr;
      sprite(flashS, SX, SY, s);
    }
    // rigs, beams, dome haze
    const strobe = look === 'mon' ? 0.75 + 0.6 * hitAmt(t, 6) : look === 'thu' ? 0.85 + 0.15 * Math.sin(t * 20) : 1;
    let flareX = -1, flareY = 0, flareZ = 1e9;
    for (let i = 0; i < NR; i++) {
      const x = RIGS[i * 3], y = RIGS[i * 3 + 1], z = RIGS[i * 3 + 2];
      // beam toward the field
      const sw = look === 'thu' ? Math.sin(t * 2.4 + i * 1.7) * 30 : look === 'mon' ? Math.sin(t * 0.6 + i) * 8 : Math.sin(t * 0.35 + i) * 6;
      const txp = x * 0.12 + sw, tzp = z * 0.08 + (look === 'thu' ? Math.cos(t * 1.9 + i) * 12 : 0);
      const Za = proj(x, y, z); const sx = SX, sy = SY;
      const Zb = proj(txp, 0, tzp);
      if (Za > 0 && Zb > 0) {
        const dx = SX - sx, dy = SY - sy, L = Math.hypot(dx, dy), w = clamp(F * 26 / Zb, 4, W * 0.5);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
        ctx.globalAlpha = (look === 'thu' ? 0.16 : look === 'mon' ? 0.11 : 0.1) * strobe;
        ctx.drawImage(beams[i % beams.length], -w / 2, 0, w, L); ctx.restore();
      }
      if (Za > 0) {
        const s = clamp(F * 12 / Za, 3, 120) * dpr;
        ctx.globalAlpha = Math.min(1, strobe); ctx.drawImage(bank, sx - s * 0.75, sy - s * 0.5, s * 1.5, s);
        ctx.globalAlpha = 0.55 * strobe; sprite(look === 'sun' ? glowL : i & 1 ? glowA : glowA2, sx, sy, s * 4);
        if (sx > W * 0.05 && sx < W * 0.95 && sy > H * 0.03 && sy < H * 0.8 && Za < flareZ) { flareX = sx; flareY = sy; flareZ = Za; }
      }
    }
    if (look === 'thu') { // lasers into the sky
      ctx.lineWidth = 1.6 * dpr;
      for (let i = 0; i < 6; i++) {
        const k = i * 2 + 1, x = RIGS[k * 3], z = RIGS[k * 3 + 2];
        ctx.strokeStyle = rgba(i & 1 ? pal.accent2 : pal.accent, 0.55); ctx.beginPath();
        line3(x, 56, z, x * 2 + Math.sin(t * 1.3 + i) * 260, 520, z * 2 + Math.cos(t * 1.1 + i * 2) * 260); ctx.stroke();
      }
    }
    { const Z = proj(0, 36, 0); if (Z > 0) { const s = Math.min(F * 330 / Z, W * 1.1); ctx.globalAlpha = look === 'mon' ? 0.14 : 0.13; ctx.drawImage(look === 'sun' ? glowL : glowA, SX - s, SY - s * 0.6, s * 2, s * 1.2); } }
    ctx.globalAlpha = 1;
    // fireworks
    for (const [bt, bx, by, bz] of BURSTS) {
      const d = t - bt; if (d < 0 || d > 2.4) continue;
      const r = 46 * (1 - Math.exp(-d * 2.6)), fall = d * d * 5, a = Math.pow(1 - d / 2.4, 1.5);
      for (let i = 0; i < NFW; i++) {
        const Z = proj(bx + FWD[i * 3] * r, by + FWD[i * 3 + 1] * r - fall, bz + FWD[i * 3 + 2] * r); if (Z <= 0) continue;
        ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(i + t * 30)); sprite(i % 3 ? glowA : glowA2, SX, SY, clamp(F * 4 / Z, 3, 30) * dpr);
      }
      if (d < 0.25) { const Z = proj(bx, by, bz); if (Z > 0) { ctx.globalAlpha = 1 - d / 0.25; sprite(glowL, SX, SY, F * 80 / Z); } }
    }
    ctx.globalAlpha = 1;
    // lens flare from the nearest bright rig
    if (flareX >= 0) {
      const fl = look === 'sun' ? 0.75 + 0.25 * Math.sin(t * 0.8) : look === 'mon' ? 0.45 + 0.6 * hitAmt(t, 4) : 0.55 + 0.3 * Math.sin(t * 6);
      ctx.globalAlpha = clamp(fl, 0, 1); ctx.drawImage(look === 'sun' ? streak : streakW, flareX - W * 0.5, flareY - H * 0.035, W, H * 0.07);
      if (look !== 'mon') ctx.drawImage(streak, flareX - W * 0.3, flareY - H * 0.015, W * 0.6, H * 0.03);
      const vx = cx - flareX, vy = cy - flareY;
      for (let g = 0; g < 4; g++) { const k = [0.55, 0.9, 1.35, 1.75][g], s = H * [0.08, 0.16, 0.05, 0.24][g]; ctx.globalAlpha = clamp(fl * [0.5, 0.25, 0.6, 0.18][g], 0, 1); sprite(g === 2 ? glowA2 : ghost, flareX + vx * k * 2, flareY + vy * k * 2, s); }
      ctx.globalAlpha = 1;
    }

    // screen space: ambient motes, sparks, weather
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < NA; i++) {
      const sp = AA[i * 4 + 2], ph = AA[i * 4 + 3];
      let x: number, y: number;
      if (look === 'mon') { x = (AA[i * 4] + Math.sin(t * 0.7 + ph) * 0.02) * W; y = (((AA[i * 4 + 1] - t * 0.05 * sp) % 1) + 1) % 1 * H; }
      else if (look === 'sun') { x = (((AA[i * 4] + t * 0.01 * sp) % 1) + 1) % 1 * W; y = (AA[i * 4 + 1] + Math.sin(t * 0.5 + ph) * 0.02) * H; }
      else { x = (((AA[i * 4] - t * 0.12 * sp) % 1) + 1) % 1 * W; y = AA[i * 4 + 1] * H; }
      ctx.globalAlpha = (look === 'sun' ? 0.35 : 0.5) * (0.5 + 0.5 * Math.sin(t * 2 + ph));
      sprite(look === 'thu' ? (i & 1 ? glowA : glowA2) : glowA, x, y, (look === 'sun' ? 6 + sp * 10 : 3 + sp * 5) * dpr);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = look === 'thu' ? rgba(pal.accent, 0.9) : 'rgba(255,190,110,.95)'; ctx.lineWidth = 1.4 * dpr; ctx.beginPath();
    for (let i = 0; i < NP; i++) {
      const p = i * 6; if (PP[p + 4] <= 0) continue;
      PP[p + 4] -= dt; PP[p + 3] += H * 1.6 * dt; PP[p] += PP[p + 2] * dt; PP[p + 1] += PP[p + 3] * dt;
      ctx.moveTo(PP[p], PP[p + 1]); ctx.lineTo(PP[p] - PP[p + 2] * 0.02, PP[p + 1] - PP[p + 3] * 0.02);
    }
    ctx.stroke();
    if (NW) {
      ctx.globalCompositeOperation = 'source-over';
      if (o.precip === 'rain') {
        ctx.strokeStyle = 'rgba(200,215,240,.32)'; ctx.lineWidth = 1 * dpr; ctx.beginPath();
        for (let i = 0; i < NW; i++) { const z = WP[i * 3 + 2], x = (((WP[i * 3] + t * 0.05 * z) % 1) + 1) % 1 * W, y = ((WP[i * 3 + 1] + t * 1.6 * z) % 1) * H; ctx.moveTo(x, y); ctx.lineTo(x - 4 * z * dpr, y - 26 * z * dpr); }
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(240,245,255,.75)'; ctx.beginPath();
        for (let i = 0; i < NW; i++) { const z = WP[i * 3 + 2], x = (((WP[i * 3] + Math.sin(t * 0.8 + i) * 0.01 + t * 0.02) % 1) + 1) % 1 * W, y = ((WP[i * 3 + 1] + t * 0.12 * z) % 1) * H, s = (1 + z * 2.4) * dpr; ctx.rect(x, y, s, s); }
        ctx.fill();
      }
    }
    // flashes on hits and cuts
    ctx.globalCompositeOperation = 'lighter';
    for (const c of o.cuts) { const d = t - c; if (d >= 0 && d < 0.18) { ctx.globalAlpha = (1 - d / 0.18) * 0.55; ctx.fillStyle = look === 'thu' ? rgba(pal.accent) : '#fff'; ctx.fillRect(0, 0, W, H); if (look === 'thu') { ctx.fillStyle = rgba(pal.accent2); for (let b = 0; b < 6; b++) ctx.fillRect(0, ((c * 997 + b * 131) % 1) * H + b * H / 6, W, H * 0.012); } } }
    if (look === 'mon') { const h = hitAmt(t, 14); if (h > 0.01) { ctx.globalAlpha = Math.min(0.5, h * 0.5); ctx.fillStyle = rgba(pal.accent); ctx.fillRect(0, 0, W, H); } }
    // grade, vignette and grain
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(vigC!, 0, 0);
    ctx.globalAlpha = look === 'mon' ? 0.07 : 0.045;
    ctx.globalCompositeOperation = 'overlay';
    const gxo = (t * 997) % 256, gyo = (t * 613) % 256;
    ctx.translate(-gxo, -gyo); ctx.fillStyle = grain; ctx.fillRect(gxo, gyo, W, H); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); if (o.shakeEl) o.shakeEl.style.transform = ''; };
}
