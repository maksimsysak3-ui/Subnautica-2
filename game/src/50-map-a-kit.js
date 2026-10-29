// =====================================================================
//  WORLD MAP — engine: static batching, surface shader, collision, terrain, sky, lamp pool, LOD
// =====================================================================
// Every static object (walls, props, a coffee mug) is written into merged, vertex-coloured meshes
// split into 48 m chunks and four detail levels. Surfaces carry a small per-vertex material id
// (plaster, ashlar, zellige, asphalt, cobbles, wood…) that a shared shader turns into world-space
// procedural texture, bump and roughness, so nothing is stretched and nothing needs UVs.
const MAP = {
  // which case is loaded (?map=dar | seoul); none → the case-files menu
  id: (() => { const m = new URLSearchParams(location.search).get('map'); return m === 'dar' || m === 'seoul' || m === 'manor' ? m : null; })(),
  bounds: 400, debugNaN: 5, poi: [], lamps: [], colliders: [], meshes: [], lampGain: 2.0,
  // batch chunk size per detail level: big chunks for far architecture (few draw calls), small for fine detail (tight culling)
  chunk: [64, 48, 32, 32],
  // max draw distance per detail level: 0 architecture, 1 street props, 2 interior furniture, 3 small clutter
  lodDist: [520, 140, 60, 30],
  drawDist: 520,
};

// ---------------- deterministic randomness (layout must be identical every load) ----------------
let MSEED = 1337;
const mrand = () => { MSEED = (MSEED * 16807) % 2147483647; return (MSEED - 1) / 2147483646; };
const mr = (a, b) => a + mrand() * (b - a);
const mpick = (arr) => arr[Math.floor(mrand() * arr.length)];
const mchance = (p) => mrand() < p;

// ---------------- surface ids understood by the world shader ----------------
const TX = {
  none: 0, plaster: 1, stone: 2, brick: 3, zellige: 4, asphalt: 5, paving: 6, cobble: 7, wood: 8, fabric: 9, gravel: 10,
  concrete: 11, metal: 12, rooftile: 13, carved: 14, earth: 15, terrazzo: 16, ceramic: 17, tadelakt: 18, pise: 19,
  corrugated: 20, rug: 21, gebs: 22, leaf: 23, louver: 24,
};

// ---------------- terrain ----------------
// The city sits on a flat plateau; foothills rise beyond the outskirts toward a mountain backdrop.
const FLATS = []; // {x0,z0,x1,z1,y,blend}
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, z) { let s = 0, a = 1, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); a *= 0.5; f *= 2.03; } return s / 1.875; }
// the walled town sits on a flat coastal shelf: the sea to the south, dry hills rising inland
const CITY = { x0: -165, x1: 165, z0: -470, z1: 118 };
const coastZ = (x) => MAP.id === 'seoul' || MAP.id === 'manor' ? 1e9 : (x < -22 ? 101 : 113.5) + (x < -175 || x > 175 ? (fbm(x * 0.02, 3.1) - 0.5) * 18 : 0);
function rawTerrain(x, z) {
  const cz = coastZ(x);
  if (z > cz) return Math.max(-8, -2.2 - (z - cz) * 0.22) + (fbm(x * 0.05, z * 0.05) - 0.5) * 0.8;   // sea bed
  const out = Math.max(0, Math.max(CITY.x0 - x, x - CITY.x1, CITY.z0 - z) + fbm(x * 0.006, z * 0.006) * 40 - 20);
  let h = out > 0 ? 80 * (1 - Math.exp(-((out / 140) ** 1.4))) + (fbm(x * 0.01, z * 0.01) - 0.5) * 18 * Math.min(1, out / 50) : 0;
  h += (fbm(x * 0.03 + 5, z * 0.03) - 0.5) * 1.6 * Math.min(1, out / 30);
  return h * clamp((cz - z) / 45, 0, 1);   // hills ease down to the shore
}
function terrainH(x, z) {
  let h = rawTerrain(x, z);
  for (const f of FLATS) {
    const dx = Math.max(f.x0 - x, 0, x - f.x1), dz = Math.max(f.z0 - z, 0, z - f.z1), d = Math.hypot(dx, dz);
    if (d < f.blend) { const t = smooth(1 - d / f.blend); h = lerp(h, f.y, t); }
  }
  return h;
}
function flat(x0, z0, x1, z1, y = 0, blend = 18) { FLATS.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y, blend }); }

// ---------------- world surface shader (patched into the standard materials) ----------------
const SURF_GLSL = /* glsl */`
varying vec3 vWP; varying vec3 vSF;
float gH; float gR; float gM;
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm3(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 3; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s / .875; }
vec3 vor(vec2 p){ vec2 n = floor(p), f = fract(p); float d1 = 8., d2 = 8.; vec2 id = n;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(i, j); vec2 r = g + h22(n + g) * .85 + .075 - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = n + g; } else if (d < d2) d2 = d; }
  d1 = sqrt(d1); d2 = sqrt(d2); return vec3(d1, d2 - d1, h21(id)); }
vec3 srgb(vec3 c){ return pow(c, vec3(2.2)); }
// zellige palettes: star / corner / ground
vec3 zpal(int v, int k){
  vec3 B = srgb(vec3(.09,.24,.5)), G = srgb(vec3(.08,.42,.3)), Wt = srgb(vec3(.9,.88,.82)), O = srgb(vec3(.78,.55,.18)),
       K = srgb(vec3(.14,.11,.09)), T = srgb(vec3(.05,.45,.5)), R = srgb(vec3(.66,.28,.17)), C = srgb(vec3(.88,.8,.64));
  if (v == 0) return k == 0 ? B : k == 1 ? G : Wt;
  if (v == 1) return k == 0 ? G : k == 1 ? O : Wt;
  if (v == 2) return k == 0 ? K : k == 1 ? B : Wt;
  if (v == 3) return k == 0 ? Wt : k == 1 ? O : B;
  if (v == 4) return k == 0 ? O : k == 1 ? G : C;
  if (v == 5) return k == 0 ? T : k == 1 ? K : Wt;
  if (v == 6) return k == 0 ? R : k == 1 ? B : C;
  return k == 0 ? G : k == 1 ? B : C;
}
// edge distance of a running-bond block pattern in metres: returns (edgeDist, blockHash)
vec2 blocks(vec2 uv, vec2 sz, float offs){
  float row = floor(uv.y / sz.y); float u = uv.x / sz.x + offs * row; float col = floor(u);
  vec2 f = vec2(fract(u) * sz.x, fract(uv.y / sz.y) * sz.y);
  float e = min(min(f.x, sz.x - f.x), min(f.y, sz.y - f.y));
  return vec2(e, h21(vec2(col, row)));
}
void applySurf(inout vec3 col){
  gH = 0.; gR = -1.; gM = -1.;
  vec3 wn = normalize(cross(dFdx(vWP), dFdy(vWP)));
  float flr = step(.7, abs(wn.y));
  float a = vSF.z / 255. * 1.5707963; float ca = cos(a), sa = sin(a);
  vec2 uvF = vec2(ca * vWP.x - sa * vWP.z, sa * vWP.x + ca * vWP.z);
  vec2 tg = normalize(vec2(-wn.z, wn.x) + vec2(1e-5, 0.));
  vec2 uvW = vec2(dot(vWP.xz, tg), vWP.y);
  vec2 uv = mix(uvW, uvF, flr);
  float dist = length(vViewPosition);
  float fw = max(fwidth(uv.x), fwidth(uv.y)) + 1e-4;
  float fine = 1. - smoothstep(6., 40., dist);
  float midd = 1. - smoothstep(25., 140., dist);
  int id = int(vSF.x + .5); int var = int(vSF.y + .5); float wear = clamp(vSF.y / 7., 0., 1.);
  if (id == 0) { col *= .97 + .06 * vn(vWP.xz * 3. + vWP.y * 2.) * midd; return; }
  if (id == 1) { // weathered lime plaster: trowel undulation, sun-faded blotches, rain streaks, chipped patches
    float big = fbm3(uv * .32 + float(var) * 3.1), m = vn(uv * 2.6), g = vn(uv * 29.) * fine;
    col *= .86 + .24 * big + .06 * (m - .5) * midd + .07 * (g - .5);
    float st = smoothstep(.55, .95, vn(vec2(uv.x * 2.2, uv.y * .14 + 7.))) * (1. - flr);
    col *= 1. - .18 * st * (.25 + wear);
    float chip = fbm3(uv * .32 + 41.) + .05 * vn(uv * 7.) + .12 * (1. - smoothstep(0., 2.5, fract(vWP.y / 3.1) * 3.1));
    float thr = 1.08 - .2 * wear;
    float cm = smoothstep(thr, thr + .02, chip) * (1. - flr);
    vec2 br = blocks(uv, vec2(.24, .075), .5);
    vec3 bc = srgb(vec3(.62, .42, .3)) * (.85 + .3 * br.y) * (br.x < .008 ? .8 : 1.);
    col = mix(col, bc, cm);
    gH = (m * .004 + g * .0012) * midd - cm * .006;
    gR = .94 - .1 * st;
    return; }
  if (id == 2) { // ashlar masonry
    vec2 b = blocks(uv, vec2(.62 + .3 * h21(vec2(floor(uv.y / .36), 5.)), .36), .41);
    float mort = 1. - smoothstep(.012, .012 + fw, b.x);
    float n = vn(uv * 6.) * .5 + vn(uv * 23.) * .5 * fine;
    col *= (.82 + .3 * b.y) * (.9 + .2 * n);
    col = mix(col, col * .62 + .06, mort);
    gH = (smoothstep(0., .05, b.x) * .012 + n * .004) * midd; gR = .9; return; }
  if (id == 3) { // brick, running bond
    vec2 b = blocks(uv, vec2(.24, .075), .5);
    float mort = 1. - smoothstep(.007, .007 + fw, b.x);
    col *= .78 + .38 * b.y + .1 * (vn(uv * 40.) - .5) * fine;
    col = mix(col, srgb(vec3(.62, .58, .52)), mort * midd);
    gH = smoothstep(0., .02, b.x) * .006 * midd; gR = .88; return; }
  if (id == 4) { // zellige: glazed 8-point star mosaic
    float cs = .2; vec2 p = fract(uv / cs) - .5; vec2 cell = floor(uv / cs);
    float sq = max(abs(p.x), abs(p.y)), dm = (abs(p.x) + abs(p.y)) * .7071;
    float star = min(sq, dm);
    vec2 q = p - sign(p) * .5; float corner = abs(q.x) + abs(q.y);
    int v = var & 7; float j = h21(cell) * .14;
    vec3 c = star < .3 ? zpal(v, 0) : corner < .2 ? zpal(v, 1) : zpal(v, 2);
    if (var >= 8 && star < .3) c = zpal(int(h21(cell + 3.) * 7.99), 0);
    float gl = min(abs(star - .3), abs(corner - .2)) * cs;
    float grout = 1. - smoothstep(.0035, .0035 + fw, gl);
    col = c * (1. - j) * (col / max(.001, max(col.r, max(col.g, col.b)))) ;
    col = mix(col, srgb(vec3(.6, .57, .5)), grout * midd);
    gH = -grout * .002 * midd + vn(uv * 18.) * .0006 * fine; gR = mix(.18, .7, grout); return; }
  if (id == 5) { // asphalt: aggregate speckle, tar-sealed cracks, patch repairs
    float sp = vn(uv * 55.) * fine, sp2 = vn(uv * 9.);
    col *= .9 + .14 * sp + .1 * (sp2 - .5);
    vec2 pc = floor(uv / 3.1); float ph = h21(pc + 7.);
    vec2 pf = fract(uv / 3.1) * 3.1;
    float inPatch = ph > .82 - .1 * wear ? step(.4, pf.x) * step(pf.x, 2.6) * step(.5, pf.y) * step(pf.y, 2.3) : 0.;
    col *= 1. + inPatch * (ph > .9 ? -.18 : .1);
    vec3 v3 = vor(uv * .55);
    float crack = (1. - smoothstep(.02, .02 + fw * .6, v3.y)) * step(.55 - .35 * wear, v3.z);
    col *= 1. - .45 * crack * midd;
    gH = (sp * .0015 - crack * .004) * midd; gR = mix(.88, .7, crack); return; }
  if (id == 6) { // dressed paving slabs
    vec2 b = blocks(uv, vec2(.6, .4), .5);
    float j2 = 1. - smoothstep(.01, .01 + fw, b.x);
    col *= (.85 + .26 * b.y) * (.94 + .12 * vn(uv * 7.));
    col = mix(col, col * .55, j2 * midd);
    gH = (smoothstep(0., .03, b.x) * .005 + vn(uv * 25.) * .001 * fine) * midd; gR = .9; return; }
  if (id == 7) { // cobbles
    vec3 v3 = vor(uv * 6.8);
    float edge = 1. - smoothstep(.07, .07 + fw * 6.8, v3.y);
    col *= (.82 + .3 * v3.z) * (.93 + .14 * vn(uv * 30.) * fine) * (.9 + .2 * fbm3(uv * .15));
    col = mix(col, col * .72 + srgb(vec3(.08, .06, .03)), edge * midd);
    gH = (1. - v3.x) * .012 * midd - edge * .006; gR = mix(.78, .95, edge); return; }
  if (id == 8) { // wood planks: grain, seams, per-board tone
    float pw = .15; float row = floor(uv.y / pw); float off = h21(vec2(row, 1.)) * 3.;
    float bl = 1.8 + h21(vec2(row, 2.)) * 1.6; float bc = floor((uv.x + off) / bl);
    float t = h21(vec2(bc, row));
    float seam = 1. - smoothstep(.004, .004 + fw, min(abs(fract(uv.y / pw) - .5) * pw * 2. - (pw - .01), min(fract((uv.x + off) / bl), 1. - fract((uv.x + off) / bl)) * bl));
    float grain = vn(vec2(uv.x * 1.5 + t * 9., uv.y * 70.)) * .6 + vn(vec2(uv.x * 4., uv.y * 140.)) * .4;
    col *= (.8 + .35 * t) * (.86 + .24 * grain * fine + .12 * (1. - fine));
    col *= 1. - .5 * seam * midd;
    gH = (grain * .0012 * fine - seam * .002) * midd; gR = .78; return; }
  if (id == 9) { // woven fabric, optionally striped
    float w = (sin(uv.x * 900.) * sin(uv.y * 900.)) * fine * (1. - smoothstep(2., 6., dist));
    if (var >= 4) { float s = step(.5, fract(uv.x / .32)); col *= mix(1., 1.85, s * .35); }
    col *= .92 + .08 * w + .14 * (vn(uv * 3.) - .5);
    gH = w * .0004; gR = .98; return; }
  if (id == 10) { // roof gravel
    vec3 v3 = vor(uv * 26.);
    col *= (.75 + .45 * v3.z) * (.9 + .15 * vn(uv * 2.));
    gH = (1. - v3.x) * .004 * fine; gR = .96; return; }
  if (id == 11) { // cast concrete: board-formed lines, tie holes, blotches
    float lines = 1. - smoothstep(.004, .004 + fw, abs(fract(uv.y / .6) - .5) * .6 - .296);
    vec2 th = fract(uv / vec2(1.2, .6)) - .5; float tie = 1. - smoothstep(.012, .02, length(th * vec2(1.2, .6)));
    float bl = fbm3(uv * .4 + 9.);
    col *= .86 + .22 * bl + .06 * (vn(uv * 35.) - .5) * fine;
    col *= 1. - (.12 * lines + .35 * tie) * midd * (1. - flr);
    float st = smoothstep(.6, .95, vn(vec2(uv.x * 2.4, uv.y * .12))) * (1. - flr) * wear;
    col *= 1. - .2 * st;
    gH = (-tie * .004 - lines * .002) * midd + vn(uv * 35.) * .0008 * fine; gR = .92; return; }
  if (id == 12) { // painted metal with scratches and rust
    float n = fbm3(uv * 1.3 + 2.);
    float rust = smoothstep(.92 - .45 * wear, 1., n + .2 * vn(uv * 12.));
    float scr = smoothstep(.97, 1., vn(vec2(uv.x * 60., uv.y * 3.))) * fine;
    col = mix(col * (.94 + .1 * vn(uv * 20.)), srgb(vec3(.42, .2, .1)) * (.8 + .4 * vn(uv * 30.)), rust);
    col = mix(col, col * 1.6 + .05, scr * .5);
    gH = rust * vn(uv * 40.) * .0015 * fine; gR = mix(.45, .92, rust); gM = mix(.45, .1, rust); return; }
  if (id == 13) { // glazed barrel roof tiles (green) or terracotta
    float ch = sin(uv.x * 6.2832 / .21); float rowf = fract(uv.y / .16);
    col *= .82 + .2 * (ch * .5 + .5) - .18 * smoothstep(.85, 1., rowf);
    col *= .92 + .16 * h21(floor(vec2(uv.x / .21, uv.y / .16)));
    gH = (ch * .01 - smoothstep(.85, 1., rowf) * .008) * midd; gR = var >= 4 ? .8 : .3; return; }
  if (id == 14) { // carved cedar door panels
    float cs = .16; vec2 p = fract(uv / cs) - .5;
    float star = min(max(abs(p.x), abs(p.y)), (abs(p.x) + abs(p.y)) * .7071);
    float groove = 1. - smoothstep(.02, .045, abs(star - .3));
    float grain = vn(vec2(uv.x * 3., uv.y * 60.));
    col *= (.85 + .2 * grain) * (1. - .35 * groove * midd);
    gH = -groove * .004 * midd; gR = .72; return; }
  if (id == 15) { // earth / sand: ripples, pebbles, tyre-packed patches
    float rip = sin(uv.x * 2.6 + vn(uv * .7) * 6.) * .5 + .5;
    vec3 v3 = vor(uv * 7.);
    float peb = (1. - smoothstep(.12, .2, v3.x)) * step(.82, v3.z) * fine;
    col *= .86 + .2 * fbm3(uv * .08) + .06 * rip * midd + .05 * (vn(uv * 40.) - .5) * fine;
    col = mix(col, col * .7, peb);
    gH = (rip * .006 * midd + peb * .006); gR = .98; return; }
  if (id == 16) { // terrazzo
    vec3 v3 = vor(uv * 34.);
    float chip = step(.62, v3.z) * (1. - smoothstep(.2, .35, v3.x));
    col = mix(col * (.95 + .08 * vn(uv * 3.)), mix(col * .45, col * 1.35 + .04, step(.8, v3.z)), chip * .7 * fine);
    gR = .32; return; }
  if (id == 17) { // ceramic floor tiles, checker
    vec2 c2 = floor(uv / .33); float ch = mod(c2.x + c2.y, 2.);
    vec2 e2 = abs(fract(uv / .33) - .5) * .33; float gl = .165 - max(e2.x, e2.y);
    float grout = 1. - smoothstep(.003, .003 + fw, gl);
    if (var >= 4) col = mix(col, col * vec3(.35, .38, .45), ch); else col *= 1. - .14 * ch;
    col *= .96 + .08 * h21(c2);
    col = mix(col, col * .6 + .05, grout * midd);
    gH = -grout * .0015 * midd; gR = mix(.25, .8, grout); return; }
  if (id == 18) { // tadelakt: polished lime plaster
    float m = fbm3(uv * .9 + 4.), m2 = vn(uv * 7.);
    col *= .88 + .2 * m + .05 * m2;
    gH = m2 * .0008 * fine; gR = .38 + .15 * m; return; }
  if (id == 19) { // rammed earth (pise): lifts, putlog holes, erosion
    float lift = 1. - smoothstep(.006, .006 + fw, abs(fract(uv.y / .82) - .5) * .82 - .4);
    vec2 ph = fract(vec2(uv.x / 1.35 + floor(uv.y / .82) * .5, uv.y / .82)) - vec2(.5, .3);
    float hole = step(abs(ph.x) * 1.35, .055) * step(abs(ph.y) * .82, .05) * (1. - flr);
    float er = fbm3(uv * vec2(.8, 2.4));
    col *= .82 + .26 * er + .06 * (vn(uv * 30.) - .5) * fine;
    col *= 1. - lift * .15 * midd;
    col = mix(col, col * .2, hole * midd);
    gH = (er * .01 - lift * .004 - hole * .03) * midd; gR = .97; return; }
  if (id == 20) { // corrugated metal cladding
    float rib = sin(uv.x * 6.2832 / .076);
    float n = fbm3(uv * vec2(.6, .25) + 3.);
    float rust = smoothstep(.85 - .4 * wear, 1., n + .25 * (1. - fract(uv.y * .2))) * (1. - flr);
    col *= .9 + .12 * rib * midd;
    col = mix(col, srgb(vec3(.45, .24, .12)), rust * .75);
    gH = rib * .006 * midd; gR = mix(.5, .9, rust); gM = mix(.5, .15, rust); return; }
  if (id == 21) { // Berber rug: diamond lattice
    vec2 p = uv / .28; vec2 f = fract(p) - .5; float dm = abs(f.x) + abs(f.y);
    float ring = step(.32, dm) * step(dm, .42); float core = step(dm, .14);
    vec3 a1 = col, a2 = mix(col, srgb(vec3(.88, .82, .7)), .75), a3 = srgb(vec3(.12, .1, .12));
    vec3 c = mix(col, a2, ring); c = mix(c, a3, core);
    col = c * (.9 + .12 * vn(uv * 60.) * fine);
    gR = 1.; return; }
  if (id == 22) { // gebs: carved plaster lattice
    float cs = .11; vec2 p = fract(uv / cs) - .5;
    float star = min(max(abs(p.x), abs(p.y)), (abs(p.x) + abs(p.y)) * .7071);
    float r = length(p);
    float cut = smoothstep(.02, .0, abs(star - .3)) + smoothstep(.03, .0, abs(r - .18)) * .7;
    col *= 1. - .3 * clamp(cut, 0., 1.) * midd;
    gH = -clamp(cut, 0., 1.) * .004 * midd; gR = .85; return; }
  if (id == 24) { // louvred shutter: angled slats with shadowed gaps, painted wood
    float sl = fract(uv.y / .055);
    col *= (.68 + .4 * smoothstep(.0, .55, sl)) * (.92 + .1 * vn(uv * 9.));
    float frame = step(.47, abs(fract(uv.x / 1.0 + .5) - .5));
    gH = (sl * .004) * fine; gR = .7; return; }
  if (id == 23) { // foliage
    col *= .75 + .5 * vn(vWP.xz * 6. + vWP.y * 5.) * midd;
    gR = .85; return; }
}
`;
function patchSurface(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor *= vColor;')
      .replace('#include <common>', '#include <common>\nattribute vec3 surf; varying vec3 vSF; varying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSF = surf; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SURF_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\napplySurf(diffuseColor.rgb);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (gR >= 0.) roughnessFactor = gR;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (gM >= 0.) metalnessFactor = gM;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec2 dH = vec2(dFdx(gH), dFdy(gH)); vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
        vec3 R1 = cross(sy, normal), R2 = cross(normal, sx); float det = dot(sx, R1) * faceDirection;
        vec3 grad = sign(det) * (dH.x * R1 + dH.y * R2); normal = normalize(abs(det) * normal - grad); }`);
  };
  mat.customProgramCacheKey = () => 'surf1';
  return mat;
}

// ---------------- static batch builder ----------------
// vertex colours are stored as sqrt(linear) in 8 bits (less banding in shadows); square them back
function sqColors(mat) { mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\nvColor *= vColor;'); }; mat.customProgramCacheKey = () => 'sq1'; return mat; }
const W = (() => {
  const layers = {
    solid: patchSurface(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true, envMapIntensity: 0.35 })),
    metal: patchSurface(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.55, flatShading: true, envMapIntensity: 0.8 })),
    glass: sqColors(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.38, depthWrite: false, flatShading: true, envMapIntensity: 1.4 })),
    glow: sqColors(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
    // opaque window panes on building shells: dark, glossy, reflecting the sky probe
    pane: sqColors(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.9, flatShading: true, envMapIntensity: 1.1 })),
    cloth: patchSurface(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true, side: THREE.DoubleSide, envMapIntensity: 0.3 })),
  };
  const buckets = new Map(); // `${layer}|${lod}|${cx}|${cz}` -> {pos, col, srf, n}
  const geoCache = new Map();
  let M = new THREE.Matrix4();
  const stack = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new V3(), _s = new V3(), _c = new THREE.Color();
  let tris = 0, objects = 0; const lodTris = [0, 0, 0, 0];
  // drawing state: detail level, interior albedo dimming (stands in for blocked skylight), default surface
  const S = { lod: 0, dim: 1, t: 0, wear: 2 };
  let MODE = 'full';   // 'col': colliders + lamps only (deferred detail at build time) · 'geom': geometry only (streamed in)
  const deferred = [];
  // unit shapes are stored indexed with shared corners (8 vertices per box instead of 36):
  // faces are shaded from screen derivatives, so vertices need no per-face normals
  function unit(key, make) {
    let g = geoCache.get(key);
    if (!g) {
      const src = make(), P = src.attributes.position, idx = src.index ? src.index.array : null, map = new Map(), pos = [], ind = [];
      const n = idx ? idx.length : P.count;
      for (let k = 0; k < n; k++) {
        const v = idx ? idx[k] : k, x = P.getX(v), y = P.getY(v), z = P.getZ(v), key2 = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
        let j = map.get(key2); if (j === undefined) { j = pos.length / 3; map.set(key2, j); pos.push(x, y, z); }
        ind.push(j);
      }
      g = { p: new Float32Array(pos), i: new Uint16Array(ind) }; src.dispose(); geoCache.set(key, g);
    }
    return g;
  }
  const G = {
    box: () => unit('box', () => new THREE.BoxGeometry(1, 1, 1)),
    cyl: (seg = 8, ratio = 1, open = false) => unit(`cyl${seg}_${ratio.toFixed(2)}_${open}`, () => new THREE.CylinderGeometry(0.5 * ratio, 0.5, 1, seg, 1, open)),
    sphere: (w = 8, h = 6) => unit(`sph${w}_${h}`, () => new THREE.SphereGeometry(0.5, w, h)),
    hemi: (w = 8, h = 4) => unit(`hem${w}_${h}`, () => new THREE.SphereGeometry(0.5, w, h, 0, Math.PI * 2, 0, Math.PI / 2)),
    cone: (seg = 8) => unit(`cone${seg}`, () => new THREE.ConeGeometry(0.5, 1, seg)),
    torus: (seg = 10, tube = 0.2, arc = Math.PI * 2) => unit(`tor${seg}_${tube}_${arc.toFixed(3)}`, () => new THREE.TorusGeometry(0.5, tube * 0.5, 4, seg, arc)),
    wedge: () => unit('wedge', () => { // right-angle prism: slope from (-.5,-.5) up to (.5,.5) over z
      const g = new THREE.BufferGeometry();
      const v = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5]];
      const p = [];
      const tri = (a, b, c) => p.push(...a, ...b, ...c);
      const P = (i, z) => [v[i][0], v[i][1], z];
      tri(P(0, 0.5), P(1, 0.5), P(2, 0.5)); tri(P(0, -0.5), P(2, -0.5), P(1, -0.5));
      const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
      quad(P(0, -0.5), P(1, -0.5), P(1, 0.5), P(0, 0.5));
      quad(P(1, -0.5), P(2, -0.5), P(2, 0.5), P(1, 0.5));
      quad(P(2, -0.5), P(0, -0.5), P(0, 0.5), P(2, 0.5));
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      return g;
    }),
    pyramid: (seg = 4) => unit(`pyr${seg}`, () => new THREE.ConeGeometry(0.7071, 1, seg, 1).rotateY(Math.PI / 4)),
    plane: () => unit('plane', () => new THREE.PlaneGeometry(1, 1)),
    disc: (seg = 12) => unit(`disc${seg}`, () => new THREE.CircleGeometry(0.5, seg)),
  };
  function bucket(layer, lod, wx, wz) {
    const cs = MAP.chunk[lod];
    const key = MODE === 'geom' ? `${layer}|${lod}` : `${layer}|${lod}|${Math.floor(wx / cs)}|${Math.floor(wz / cs)}`;
    let b = buckets.get(key);
    if (!b) { b = { layer, lod, pos: new Float32Array(3 * 2048), col: new Uint8Array(3 * 2048), srf: new Uint8Array(3 * 2048), idx: new Uint32Array(4096), nv: 0, ni: 0 }; buckets.set(key, b); }
    return b;
  }
  function grow(b, nv, ni) {
    if ((b.nv + nv) * 3 > b.pos.length) {
      let cap = b.pos.length; while (cap < (b.nv + nv) * 3) cap *= 2;
      const p = new Float32Array(cap), c = new Uint8Array(cap), s = new Uint8Array(cap); p.set(b.pos); c.set(b.col); s.set(b.srf); b.pos = p; b.col = c; b.srf = s;
    }
    if (b.ni + ni > b.idx.length) { let cap = b.idx.length; while (cap < b.ni + ni) cap *= 2; const q = new Uint32Array(cap); q.set(b.idx); b.idx = q; }
  }
  // write a unit shape transformed by world matrix m, colour col (hex), with per-object variation + contact darkening
  const SQ = (v) => Math.min(255, Math.round(Math.sqrt(Math.max(0, v)) * 255));
  function put(u, m, col, layer = 'solid', o = {}) {
    const e = m.elements;
    const lod = o.lod ?? S.lod;
    if (MODE === 'col') { mrand(); return; }
    const b = bucket(layer, lod, e[12], e[14]);
    const arr = u.p, nv = arr.length / 3, ind = u.i;
    grow(b, nv, ind.length);
    _c.set(col);
    const jit = o.jit ?? 0.06, k = (1 + (mrand() - 0.5) * 2 * jit) * (o.dim ?? (layer === 'glow' ? 1 : S.dim));
    const r = _c.r * k, g = _c.g * k, bl = _c.b * k;
    const ao = o.ao ?? (layer === 'solid' || layer === 'metal');
    const base = o.ground ?? 0;
    const t = o.t ?? (layer === 'solid' || layer === 'cloth' ? S.t : 0);
    const wear = o.wear ?? S.wear;
    // yaw of the object (mod 90°) so floor patterns follow rotated buildings
    let yaw = Math.atan2(-e[2], e[0]); yaw = ((yaw % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
    const yq = Math.round(yaw / (Math.PI / 2) * 255) % 256;
    const v0 = b.nv;
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i], y = arr[i + 1], z = arr[i + 2];
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const j = v0 * 3 + i;
      b.pos[j] = wx; b.pos[j + 1] = wy; b.pos[j + 2] = wz;
      const a = ao ? 0.62 + 0.38 * clamp((wy - base) / 0.8, 0, 1) : 1;
      b.col[j] = SQ(r * a); b.col[j + 1] = SQ(g * a); b.col[j + 2] = SQ(bl * a);
      b.srf[j] = t; b.srf[j + 1] = wear; b.srf[j + 2] = yq;
    }
    // mirrored transforms flip winding: keep faces pointing outwards
    const det = e[0] * (e[5] * e[10] - e[6] * e[9]) - e[4] * (e[1] * e[10] - e[2] * e[9]) + e[8] * (e[1] * e[6] - e[2] * e[5]);
    if (det >= 0) for (let i = 0; i < ind.length; i++) b.idx[b.ni + i] = v0 + ind[i];
    else for (let i = 0; i < ind.length; i += 3) { b.idx[b.ni + i] = v0 + ind[i]; b.idx[b.ni + i + 1] = v0 + ind[i + 2]; b.idx[b.ni + i + 2] = v0 + ind[i + 1]; }
    b.nv += nv; b.ni += ind.length;
    tris += ind.length / 3; objects++; lodTris[lod] += ind.length / 3;
    if (MAP.debugNaN && !Number.isFinite(e[12] + e[13] + e[14] + e[0] + e[5] + e[10])) { MAP.debugNaN--; console.warn('NaN put', new Error().stack.split('\n').slice(2, 6).join(' | ')); }
  }
  function local(x, y, z, sx, sy, sz, o) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    return new THREE.Matrix4().multiplyMatrices(M, _m);
  }
  // collider from a unit-box matrix: oriented (yaw only) when possible, else world AABB
  function solidFrom(m, mat = 'concrete', o = {}) {
    if (MODE === 'geom') return;
    const e = m.elements;
    const sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]), sz = Math.hypot(e[8], e[9], e[10]);
    if (sx > 1e-6 && sy > 1e-6 && Math.abs(e[5] / sy) > 0.9999) {
      COL.add({ cx: e[12], cz: e[14], hx: sx / 2, hz: sz / 2, y0: e[13] - sy / 2, y1: e[13] + sy / 2, c: e[0] / sx, s: -e[2] / sx, mat, walk: o.walk });
      return;
    }
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (const cx of [-0.5, 0.5]) for (const cy of [-0.5, 0.5]) for (const cz of [-0.5, 0.5]) {
      _p.set(cx, cy, cz).applyMatrix4(m);
      x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x); y0 = Math.min(y0, _p.y); y1 = Math.max(y1, _p.y); z0 = Math.min(z0, _p.z); z1 = Math.max(z1, _p.z);
    }
    COL.add({ x0, y0, z0, x1, y1, z1, mat, walk: o.walk });
  }
  const api = {
    G, layers, S,
    push(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) { stack.push(M.clone()); _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1)); M = M.clone().multiply(_m); },
    pop() { M = stack.pop(); },
    // run fn with temporary drawing state (lod / dim / default surface t / wear)
    scope(st, fn) { const prev = { ...S }; Object.assign(S, st); try { return fn(); } finally { Object.assign(S, prev); } },
    // primitives in the current local frame; o: {rx,ry,rz,layer,solid,mat,jit,ao,walk,t,wear,lod}
    box(w, h, d, x, y, z, col, o = {}) { const m = local(x, y, z, w, h, d, o); put(G.box(), m, col, o.layer, o); if (o.solid) solidFrom(m, o.mat, o); return m; },
    cyl(rt, rb, h, x, y, z, col, o = {}) { const seg = o.seg || 8; const r = Math.max(rt, rb); const m = local(x, y, z, r * 2, h, r * 2, o); put(G.cyl(seg, rb > 0 ? rt / rb : 1, o.open), m, col, o.layer, o); if (o.solid) solidFrom(m, o.mat, o); return m; },
    sphere(w, h, d, x, y, z, col, o = {}) { put(G.sphere(o.seg || 8, o.hseg || 6), local(x, y, z, w, h, d, o), col, o.layer, o); },
    hemi(w, h, d, x, y, z, col, o = {}) { put(G.hemi(o.seg || 8, o.hseg || 4), local(x, y, z, w, h, d, o), col, o.layer, o); },
    cone(r, h, x, y, z, col, o = {}) { put(G.cone(o.seg || 8), local(x, y, z, r * 2, h, r * 2, o), col, o.layer, o); },
    pyramid(w, h, d, x, y, z, col, o = {}) { put(G.pyramid(4), local(x, y, z, w, h, d, o), col, o.layer, o); },
    torus(r, tube, x, y, z, col, o = {}) { put(G.torus(o.seg || 10, tube / r, o.arc || Math.PI * 2), local(x, y, z, r * 2, r * 2, r * 2, o), col, o.layer, o); },
    wedge(w, h, d, x, y, z, col, o = {}) { const m = local(x, y, z, w, h, d, o); put(G.wedge(), m, col, o.layer, o); if (o.solid) solidFrom(m, o.mat, o); },
    plane(w, h, x, y, z, col, o = {}) { put(G.plane(), local(x, y, z, w, h, 1, o), col, o.layer, o); },
    disc(r, x, y, z, col, o = {}) { put(G.disc(o.seg || 12), local(x, y, z, r * 2, r * 2, 1, o), col, o.layer, o); },
    // a thin tube between two local points (cables, pipes, rope, rebar)
    rod(a, b, r, col, o = {}) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1e-4;
      const q = new THREE.Quaternion().setFromUnitVectors(UP, new V3(dx / L, dy / L, dz / L));
      const m = new THREE.Matrix4().compose(new V3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new V3(r * 2, L, r * 2));
      put(G.cyl(o.seg || 5), new THREE.Matrix4().multiplyMatrices(M, m), col, o.layer, o);
    },
    // sagging cable through points
    cable(a, b, sag, r, col, n = 8, o = {}) {
      let prev = a;
      for (let i = 1; i <= n; i++) {
        const t = i / n, p = [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag, lerp(a[2], b[2], t)];
        this.rod(prev, p, r, col, { ao: false, t: 0, seg: 3, ...o }); prev = p;
      }
    },
    solid(w, h, d, x, y, z, mat = 'concrete', o = {}) { solidFrom(local(x, y, z, w, h, d, o), mat, o); },
    // raw triangle soup (Float32Array of local xyz triples) — roads, ribbons, terrain patches
    tris(arr, col, o = {}) { const i = new Uint32Array(arr.length / 3); for (let k = 0; k < i.length; k++) i[k] = k; put({ p: arr, i }, M, col, o.layer, o); },
    worldPos(x, y, z) { return new V3(x, y, z).applyMatrix4(M); },
    worldRotY() { _e.setFromRotationMatrix(M, 'YXZ'); return _e.y; },
    lamp(x, y, z, color = 0xffd9a0, intensity = 8, range = 12, o = {}) {
      if (MODE === 'geom') return;
      const p = this.worldPos(x, y, z);
      MAP.lamps.push({ p, color: new THREE.Color(color), intensity: intensity * MAP.lampGain, range: range * 1.25, flicker: o.flicker || 0, halo: o.halo ?? 0.6 });
    },
    stats: () => ({ tris: Math.round(tris), objects, buckets: buckets.size, lod: lodTris.map(Math.round) }),
    get mode() { return MODE; },
    // DEFERRED DETAIL: fn runs now for its colliders/lamps; its geometry is generated later, only when
    // the camera comes near (see STREAM). RNG state, frame and drawing state are captured so both runs match.
    defer(fn, cls = 'near', at = null) {
      if (MODE !== 'full') { fn(); return; }       // nested deferral runs inline
      const o = at ? new V3(at[0], 0, at[1]).applyMatrix4(M) : new V3(0, 0, 0).applyMatrix4(M);
      const d = { x: o.x, z: o.z, M: M.clone(), S: { ...S }, seed: MSEED, fn, cls };
      const pm = MODE; MODE = 'col';
      try { fn(); } finally { MODE = pm; }
      deferred.push(d);
    },
    deferred,
    // generate the geometry of a list of deferred items into fresh meshes
    stream(list) {
      const keepM = M, keepStack = stack.splice(0), keepS = { ...S }, keepSeed = MSEED, keepB = new Map(buckets);
      buckets.clear(); MODE = 'geom';
      try { for (const d of list) { M = d.M.clone(); Object.assign(S, d.S); MSEED = d.seed; d.fn(); } }
      finally { MODE = 'full'; M = keepM; stack.push(...keepStack); Object.assign(S, keepS); MSEED = keepSeed; }
      const meshes = this.finish(true);
      for (const [k, v] of keepB) buckets.set(k, v);
      return meshes;
    },
    finish(streamed = false) {
      const meshes = [];
      const _a = new V3(), _b = new V3(), _n = new V3();
      for (const b of buckets.values()) {
        if (!b.ni) continue;
        const nv = b.nv, pos = b.pos.slice(0, nv * 3), col = b.col.slice(0, nv * 3), srf = b.srf.slice(0, nv * 3);
        const index = nv < 65536 ? new Uint16Array(b.idx.subarray(0, b.ni)) : b.idx.slice(0, b.ni);
        // smooth (area-weighted) normals — used only to offset shadow lookups; shading is per face from derivatives
        const nf = new Float32Array(nv * 3);
        for (let i = 0; i < b.ni; i += 3) {
          const ia = index[i] * 3, ib = index[i + 1] * 3, ic = index[i + 2] * 3;
          _a.set(pos[ib] - pos[ia], pos[ib + 1] - pos[ia + 1], pos[ib + 2] - pos[ia + 2]);
          _b.set(pos[ic] - pos[ia], pos[ic + 1] - pos[ia + 1], pos[ic + 2] - pos[ia + 2]);
          _n.crossVectors(_a, _b);
          for (const q of [ia, ib, ic]) { nf[q] += _n.x; nf[q + 1] += _n.y; nf[q + 2] += _n.z; }
        }
        const nrm = new Int8Array(nv * 3);
        for (let i = 0; i < nv * 3; i += 3) { const L = Math.hypot(nf[i], nf[i + 1], nf[i + 2]) || 1; nrm[i] = Math.round(nf[i] / L * 127); nrm[i + 1] = Math.round(nf[i + 1] / L * 127); nrm[i + 2] = Math.round(nf[i + 2] / L * 127); }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3, true));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
        g.setAttribute('surf', new THREE.BufferAttribute(srf, 3, false));
        g.setIndex(new THREE.BufferAttribute(index, 1));
        g.userData.tris = b.ni / 3;
        g.computeBoundingSphere(); g.computeBoundingBox();
        // free the CPU copies once the GPU has them (the map is static)
        for (const k in g.attributes) g.attributes[k].onUpload(function () { this.array = null; });
        g.index.onUpload(function () { this.array = null; });
        const mesh = new THREE.Mesh(g, layers[b.layer]);
        const shadowy = (b.layer === 'solid' || b.layer === 'metal' || b.layer === 'cloth' || b.layer === 'pane') && b.lod <= 1;
        mesh.castShadow = shadowy; mesh.receiveShadow = b.layer !== 'glow';
        mesh.renderOrder = b.layer === 'glass' ? 2 : 0;
        mesh.matrixAutoUpdate = false;
        mesh.userData.lod = b.lod;
        scene.add(mesh); meshes.push(mesh); MAP.meshes.push(mesh);
      }
      buckets.clear();
      return meshes;
    },
    // hide chunks beyond their detail level's draw distance
    updateLOD(cam) {
      const p = cam.position;
      for (const m of MAP.meshes) {
        const s = m.geometry.boundingSphere;
        m.visible = p.distanceTo(s.center) - s.radius < MAP.lodDist[m.userData.lod];
      }
    },
    // keep detail ranges proportional to the current draw distance
    setDrawDist(d) { MAP.drawDist = d; MAP.lodDist[0] = d; MAP.lodDist[1] = Math.min(120, d * 0.4); MAP.lodDist[2] = Math.min(55, d * 0.2); MAP.lodDist[3] = Math.min(28, d * 0.1); scene.fog.near = d * 0.33; scene.fog.far = d; },
  };
  return api;
})();

// ---------------- interior streaming: furnished rooms are built near the camera, dropped far away ----------------
const STREAM = (() => {
  // two rings: 'near' = furnished interiors, 'mid' = facade/street/rooftop detail
  const CLS = { near: { CS: 48, R_IN: 70, R_OUT: 100 }, mid: { CS: 64, R_IN: 135, R_OUT: 170 } };
  const chunks = new Map();
  let t = 0, ready = false;
  const queue = [];
  function index() {
    for (const d of W.deferred) {
      const C = CLS[d.cls] || CLS.near, k = `${d.cls}|${Math.floor(d.x / C.CS)}|${Math.floor(d.z / C.CS)}`;
      let c = chunks.get(k); if (!c) chunks.set(k, (c = { C, x: (Math.floor(d.x / C.CS) + 0.5) * C.CS, z: (Math.floor(d.z / C.CS) + 0.5) * C.CS, list: [], meshes: null, queued: false }));
      c.list.push(d);
    }
    ready = true;
  }
  function load(c) { c.meshes = W.stream(c.list); c.queued = false; }
  function unload(c) { const set = new Set(c.meshes); for (const m of c.meshes) { scene.remove(m); m.geometry.dispose(); } MAP.meshes = MAP.meshes.filter((m) => !set.has(m)); c.meshes = null; }
  return {
    index, chunks,
    update(dt, p, budgetMs = 7) {
      if (!ready) return;
      t -= dt;
      if (t <= 0) {
        t = 0.25;
        for (const c of chunks.values()) {
          const d = Math.hypot(c.x - p.x, c.z - p.z);
          if (d < c.C.R_IN && !c.meshes && !c.queued) { c.queued = true; queue.push(c); }
          else if (d > c.C.R_OUT && c.meshes) unload(c);
        }
        for (const c of queue) c.dist = Math.hypot(c.x - p.x, c.z - p.z) / c.C.R_IN;
        queue.sort((a, b) => a.dist - b.dist);
      }
      const t0 = performance.now();
      while (queue.length && performance.now() - t0 < budgetMs) { const c = queue.shift(); if (Math.hypot(c.x - p.x, c.z - p.z) < c.C.R_OUT) load(c); else c.queued = false; }
    },
    prime(p) { for (const c of chunks.values()) if (!c.meshes && Math.hypot(c.x - p.x, c.z - p.z) < c.C.R_IN) load(c); },
    stats() { let n = 0, l = 0, tris = 0; for (const c of chunks.values()) { n++; if (c.meshes) { l++; for (const m of c.meshes) tris += m.geometry.userData.tris; } } return { chunks: n, loaded: l, deferred: W.deferred.length, queued: queue.length, streamedTris: tris }; },
  };
})();

// ---------------- collision: yaw-oriented boxes in a 4 m spatial hash ----------------
// Each box: centre (cx,cz), half extents (hx,hz), vertical span y0..y1, rotation (c,s) = (cos, sin) of yaw.
const COL = (() => {
  const cell = 4, grid = new Map(), list = [];
  const key = (i, j) => i * 100003 + j;
  function add(b) {
    if (b.cx === undefined) { b.cx = (b.x0 + b.x1) / 2; b.cz = (b.z0 + b.z1) / 2; b.hx = (b.x1 - b.x0) / 2; b.hz = (b.z1 - b.z0) / 2; b.c = 1; b.s = 0; }
    const ex = Math.abs(b.c) * b.hx + Math.abs(b.s) * b.hz, ez = Math.abs(b.s) * b.hx + Math.abs(b.c) * b.hz;
    b.x0 = b.cx - ex; b.x1 = b.cx + ex; b.z0 = b.cz - ez; b.z1 = b.cz + ez;
    b.id = list.length; list.push(b);
    for (let i = Math.floor(b.x0 / cell); i <= Math.floor(b.x1 / cell); i++) for (let j = Math.floor(b.z0 / cell); j <= Math.floor(b.z1 / cell); j++) {
      const k = key(i, j); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(b);
    }
    return b;
  }
  let stamp = 1;
  function near(x0, z0, x1, z1, out) {
    stamp++; out.length = 0;
    for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
      const a = grid.get(key(i, j)); if (!a) continue;
      for (const b of a) if (b._s !== stamp) { b._s = stamp; out.push(b); }
    }
    return out;
  }
  const tmp = [];
  // world → box-local (xz)
  const toL = (b, x, z, o) => { const dx = x - b.cx, dz = z - b.cz; o[0] = dx * b.c - dz * b.s; o[1] = dx * b.s + dz * b.c; return o; };
  const lp = [0, 0];
  // highest walkable surface under (x,z) that is no more than `step` above the feet
  function ground(x, z, feet, step = 0.45) {
    let h = terrainH(x, z);
    for (const b of near(x - 0.01, z - 0.01, x + 0.01, z + 0.01, tmp)) {
      if (b.y1 > feet + step || b.y1 <= h) continue;
      toL(b, x, z, lp);
      if (Math.abs(lp[0]) <= b.hx && Math.abs(lp[1]) <= b.hz) h = b.y1;
    }
    return h;
  }
  // push a vertical capsule (circle in XZ) out of boxes it overlaps
  function resolve(p, r, height, step = 0.45) {
    for (let it = 0; it < 4; it++) {
      let moved = false;
      for (const b of near(p.x - r, p.z - r, p.x + r, p.z + r, tmp)) {
        if (b.y1 <= p.y + step || b.y0 >= p.y + height) continue;
        toL(b, p.x, p.z, lp);
        const qx = clamp(lp[0], -b.hx, b.hx), qz = clamp(lp[1], -b.hz, b.hz);
        let dx = lp[0] - qx, dz = lp[1] - qz; const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        let px, pz;
        if (d2 < 1e-10) { // centre inside the box: leave by the nearest face
          const ox = b.hx - Math.abs(lp[0]), oz = b.hz - Math.abs(lp[1]);
          if (ox < oz) { px = Math.sign(lp[0] || 1) * (ox + r); pz = 0; } else { px = 0; pz = Math.sign(lp[1] || 1) * (oz + r); }
        } else { const d = Math.sqrt(d2), push = r - d; px = (dx / d) * push; pz = (dz / d) * push; }
        // local push → world (inverse of toL)
        p.x += px * b.c + pz * b.s; p.z += -px * b.s + pz * b.c;
        moved = true;
      }
      if (!moved) break;
    }
  }
  // nearest ray hit: exact 2D DDA over the hash cells the ray crosses, slab test in each box's frame
  const seen = new Set();
  function ray(o, d, maxT) {
    let best = null, bt = maxT;
    seen.clear();
    let i = Math.floor(o.x / cell), j = Math.floor(o.z / cell);
    const si = d.x > 0 ? 1 : -1, sj = d.z > 0 ? 1 : -1;
    const tdx = Math.abs(d.x) > 1e-9 ? cell / Math.abs(d.x) : Infinity, tdz = Math.abs(d.z) > 1e-9 ? cell / Math.abs(d.z) : Infinity;
    let tmx = Math.abs(d.x) > 1e-9 ? ((d.x > 0 ? (i + 1) * cell - o.x : o.x - i * cell) / Math.abs(d.x)) : Infinity;
    let tmz = Math.abs(d.z) > 1e-9 ? ((d.z > 0 ? (j + 1) * cell - o.z : o.z - j * cell) / Math.abs(d.z)) : Infinity;
    let tCell = 0;
    for (let guard = 0; guard < 4000; guard++) {
      const a = grid.get(key(i, j));
      if (a) for (const b of a) {
        if (seen.has(b.id)) continue; seen.add(b.id);
        // ray into box frame
        const ox = o.x - b.cx, oz = o.z - b.cz;
        const lox = ox * b.c - oz * b.s, loz = ox * b.s + oz * b.c;
        const ldx = d.x * b.c - d.z * b.s, ldz = d.x * b.s + d.z * b.c;
        let t0 = 0, t1 = bt, axis = -1, sign = 0, ok = true;
        const L = [[lox, ldx, -b.hx, b.hx], [o.y, d.y, b.y0, b.y1], [loz, ldz, -b.hz, b.hz]];
        for (let k = 0; k < 3; k++) {
          const [oo, dd, lo, hi] = L[k];
          if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) { ok = false; break; } continue; }
          let ta = (lo - oo) / dd, tb = (hi - oo) / dd, s = -1;
          if (ta > tb) { const t = ta; ta = tb; tb = t; s = 1; }
          if (ta > t0) { t0 = ta; axis = k; sign = s; }
          if (tb < t1) t1 = tb;
          if (t0 > t1) { ok = false; break; }
        }
        if (ok && t0 < bt && t0 > 0) {
          bt = t0;
          const nl = [0, 0, 0]; if (axis >= 0) nl[axis] = sign;
          best = { t: t0, box: b, normal: new V3(nl[0] * b.c + nl[2] * b.s, nl[1], -nl[0] * b.s + nl[2] * b.c) };
        }
      }
      // next cell
      if (tmx < tmz) { tCell = tmx; tmx += tdx; i += si; } else { tCell = tmz; tmz += tdz; j += sj; }
      if (tCell > bt || tCell > maxT) break;
    }
    if (best) best.point = new V3(o.x + d.x * best.t, o.y + d.y * best.t, o.z + d.z * best.t);
    return best;
  }
  return { add, list, ground, resolve, ray, near };
})();
MAP.colliders = COL.list;

// ---------------- bullet holes (instanced decals on the map) ----------------
const HOLES = (() => {
  const N = 600;
  const tex = canvasTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(8,7,6,1)'); gr.addColorStop(0.35, 'rgba(20,18,16,.95)'); gr.addColorStop(0.6, 'rgba(60,55,50,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 }), N);
  mesh.count = 0; mesh.frustumCulled = false; scene.add(mesh);
  let i = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3();
  return {
    add(p, n, size = 1) {
      q.setFromUnitVectors(new V3(0, 0, 1), n);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), Math.random() * 6.28));
      m4.compose(p.clone().addScaledVector(n, 0.004), q, s.setScalar(size * rand(0.8, 1.25)));
      mesh.setMatrixAt(i, m4); i = (i + 1) % N; mesh.count = Math.min(N, mesh.count + 1);
      mesh.instanceMatrix.needsUpdate = true;
    },
    clear() { mesh.count = 0; i = 0; },
  };
})();

// ---------------- sky: late-afternoon sun, haze, high cloud, Atlas mountain backdrop ----------------
const SKY = (() => {
  const sunDir = new V3(-0.74, 0.43, 0.52).normalize();      // low in the west-south-west: long raking shadows
  const ZEN = new THREE.Color().setRGB(0.10, 0.22, 0.52), HOR = new THREE.Color().setRGB(0.62, 0.58, 0.52), GLOWC = new THREE.Color().setRGB(1.0, 0.7, 0.42);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2600, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: sunDir }, zen: { value: ZEN }, hor: { value: HOR }, glowc: { value: GLOWC } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 sunDir, zen, hor, glowc; varying vec3 vP;
      float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.1+3.7; a*=.5; } return s; }
      void main(){
        vec3 d = normalize(vP); float h = d.y;
        float sd = max(dot(d, sunDir), 0.);
        vec3 c = mix(hor, zen, pow(clamp(h, 0., 1.), .5));
        c += glowc * (pow(sd, 5.) * .55 + pow(sd, 40.) * .8) * (1. - .5 * clamp(h, 0., 1.));
        c += vec3(1.6, 1.4, 1.1) * smoothstep(.99955, .9998, sd) * 6.;
        if (h > 0.) {
          vec2 cp = d.xz / (h + .15) * 1.4;
          float cl = fbm(cp * 1.3 + vec2(3., 1.)) * .65 + fbm(cp * vec2(.4, 3.) + 9.) * .35;
          cl = smoothstep(.52, .82, cl) * smoothstep(.0, .3, h);
          c = mix(c, vec3(.95, .82, .68) * (.7 + .6 * pow(sd, 3.)), cl * .55);
        } else c = mix(hor, hor * .8, clamp(-h * 4., 0., 1.));
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  dome.renderOrder = -10; scene.add(dome);
  // mountain ring: hazy foothills and a snow-capped range, fading into the horizon colour
  const ring = new THREE.Group();
  for (const [r, hgt, segs, snow, haze] of [[2300, 420, 200, 0.7, 0.6], [1750, 170, 170, 2, 0.4]]) {
    const pts = [], cols = [], idx = [];
    const base = new THREE.Color().setRGB(0.32, 0.26, 0.21), hz = HOR.clone();
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const n = fbm(Math.cos(a) * 3 + r, Math.sin(a) * 3) * 0.8 + fbm(Math.cos(a) * 11, Math.sin(a) * 11 + r) * 0.4;
      const hh = hgt * (0.15 + n * 0.95) * (0.65 + 0.35 * Math.max(0, Math.sin(a + 1.2)));
      pts.push(Math.cos(a) * r, -30, Math.sin(a) * r, Math.cos(a) * r * 0.99, hh, Math.sin(a) * r * 0.99);
      const top = base.clone().lerp(hz, haze); if (hh > hgt * snow) top.setRGB(0.85, 0.86, 0.9).lerp(hz, haze * 0.5);
      const bot = hz.clone();
      cols.push(bot.r, bot.g, bot.b, top.r, top.g, top.b);
      if (i < segs) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    mesh.renderOrder = -9; ring.add(mesh);
  }
  scene.add(ring);
  const sun = new THREE.DirectionalLight(0xffdcae, 2.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const SH = 70;
  const sc = sun.shadow.camera; sc.left = -SH; sc.right = SH; sc.top = SH; sc.bottom = -SH; sc.near = 1; sc.far = 700;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
  scene.add(sun, sun.target);
  scene.fog.color.copy(HOR); scene.background.copy(HOR);
  const _f = new V3();
  // night: moonlit sky with the city's sodium-and-neon glow on the horizon; the range behind goes dark
  // dusk: the sun just over the trees, a long orange light, the sky going violet overhead
  function dusk() {
    MAP.dusk = true;
    const u = dome.material.uniforms;
    u.zen.value.setRGB(0.07, 0.1, 0.28); u.hor.value.setRGB(0.95, 0.5, 0.3); u.glowc.value.setRGB(1.0, 0.52, 0.22);
    HOR.copy(u.hor.value);
    ring.traverse((o) => { if (o.isMesh) o.material.color.setRGB(0.3, 0.22, 0.26); });
    sunDir.set(0.86, 0.15, -0.48).normalize();
    sun.color.set(0xffa060); sun.intensity = 1.8;
    scene.fog.color.setRGB(0.58, 0.42, 0.4); scene.background.copy(scene.fog.color);
    HEMI.color.setRGB(0.5, 0.52, 0.72); HEMI.groundColor.setRGB(0.32, 0.24, 0.2); HEMI.intensity = 0.5;
    MAP.lampGain = 2.6;
  }
  function night() {
    MAP.night = true;
    const u = dome.material.uniforms;
    u.zen.value.setRGB(0.003, 0.004, 0.012); u.hor.value.setRGB(0.05, 0.028, 0.05); u.glowc.value.setRGB(0.05, 0.05, 0.07);
    HOR.copy(u.hor.value);
    ring.traverse((o) => { if (o.isMesh) o.material.color.setRGB(0.07, 0.06, 0.1); });
    sunDir.set(0.35, 0.62, -0.7).normalize();
    sun.color.set(0x8fa4d8); sun.intensity = 0.32;
    sun.castShadow = false;   // moonlight this faint casts nothing you'd see under the street lamps: skip the whole shadow pass
    scene.fog.color.setRGB(0.03, 0.022, 0.04); scene.background.copy(scene.fog.color);
    HEMI.color.setRGB(0.18, 0.2, 0.32); HEMI.groundColor.setRGB(0.12, 0.06, 0.1); HEMI.intensity = 0.35;
    MAP.lampGain = 3.2;
  }
  return {
    sunDir, sun, horizon: HOR, night, dusk,
    update(cam, focus) {
      dome.position.copy(cam.position); ring.position.set(cam.position.x, 0, cam.position.z);
      // shadow box biased ahead of the camera (more useful texels where the player looks), snapped to texels
      cam.getWorldDirection(_f); _f.y = 0; if (_f.lengthSq() > 1e-6) _f.normalize();
      const cx = focus.x + _f.x * SH * 0.55, cz = focus.z + _f.z * SH * 0.55;
      const snap = (SH * 2) / 2048;
      const fx = Math.round(cx / snap) * snap, fz = Math.round(cz / snap) * snap;
      sun.target.position.set(fx, 0, fz);
      sun.position.set(fx + sunDir.x * 350, sunDir.y * 350, fz + sunDir.z * 350);
    },
  };
})();

// ---------------- lamp pool: hundreds of lamps, only the nearest few are real lights ----------------
const LAMPS = (() => {
  const N = MAP.id === 'seoul' ? 8 : 6, pool = [];
  for (let i = 0; i < N; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); scene.add(l); pool.push({ l, lamp: null, cur: 0 }); }
  let haloPts = null, timer = 0;
  function buildHalos() {
    const tex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    const L = MAP.lamps.filter((l) => l.halo > 0);
    const pos = new Float32Array(L.length * 3), col = new Float32Array(L.length * 3);
    L.forEach((l, i) => { pos.set([l.p.x, l.p.y, l.p.z], i * 3); col.set([l.color.r * l.halo * 0.5, l.color.g * l.halo * 0.5, l.color.b * l.halo * 0.5], i * 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    haloPts = new THREE.Points(g, new THREE.PointsMaterial({ map: tex, size: 0.9, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    scene.add(haloPts);
  }
  return {
    init: buildHalos,
    update(dt, focus, time) {
      timer -= dt;
      if (timer <= 0) {
        timer = 0.25;
        const ranked = [];
        for (const l of MAP.lamps) { const d = l.p.distanceToSquared(focus); if (d < 3600) ranked.push({ l, d: Math.sqrt(d) - l.range * 0.6 + Math.abs(l.p.y - focus.y - 1.5) * 2 }); }
        ranked.sort((a, b) => a.d - b.d);
        const top = ranked.slice(0, N).map((x) => x.l), keep = new Set(ranked.slice(0, N + 4).map((x) => x.l));
        for (const s of pool) if (s.lamp && !keep.has(s.lamp)) s.lamp = null;
        for (const l of top) {
          if (pool.some((s) => s.lamp === l)) continue;
          const free = pool.find((s) => !s.lamp);
          if (!free) break;
          free.lamp = l; free.cur = 0;
          free.l.position.copy(l.p); free.l.color.copy(l.color); free.l.distance = l.range;
        }
      }
      for (const s of pool) {
        const target = s.lamp ? s.lamp.intensity * (s.lamp.flicker ? 1 - s.lamp.flicker * (Math.random() < 0.06 ? Math.random() : 0) : 1) : 0;
        s.cur = damp(s.cur, target, 6, dt);
        s.l.intensity = s.cur;
      }
    },
  };
})();

// ---------------- eye adaptation: open sky vs. enclosed interiors ----------------
// Probes the collision world for overhead cover around the camera and eases exposure, so stepping
// from a sun-baked street into a shuttered shop opens up the shadows the way an eye would.
const EYE = (() => {
  let t = 0, enclosed = 0, cur = 1;
  const dirs = [[0, 1, 0], [0.5, 0.86, 0], [-0.5, 0.86, 0], [0, 0.86, 0.5], [0, 0.86, -0.5], [0.7, 0.3, 0], [-0.7, 0.3, 0], [0, 0.3, 0.7], [0, 0.3, -0.7]].map((d) => new V3(...d).normalize());
  return {
    update(dt, cam, base = 1.0) {
      t -= dt;
      if (t <= 0) {
        t = 0.2;
        let hit = 0;
        for (const d of dirs) if (COL.ray(cam.position, d, 22)) hit++;
        enclosed = hit / dirs.length;
      }
      cur = damp(cur, base * (1 + 0.85 * smooth(clamp((enclosed - 0.35) / 0.6, 0, 1))), 1.6, dt);
      renderer.toneMappingExposure = cur;
      return enclosed;
    },
  };
})();
