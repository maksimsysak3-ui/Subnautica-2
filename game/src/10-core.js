
// =====================================================================
//  Utilities
// =====================================================================
const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const rand = (a, b) => a + Math.random() * (b - a);
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const _v1 = new V3(), _v2 = new V3(), _v3 = new V3(), _v4 = new V3(), _v5 = new V3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _e1 = new THREE.Euler();

// =====================================================================
//  Renderer / scene
// =====================================================================
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d14);
scene.fog = new THREE.FogExp2(0x0a0d14, 0.0042);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.02, 3000);
camera.rotation.order = 'YXZ';
scene.add(camera);

// =====================================================================
//  Materials (slots are shared and recoloured live, never rebuilt)
// =====================================================================
const std = (color, rough = 0.85, metal = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: true, ...extra });

const SLOT = {
  skin: std(0xd99a66, 0.75), skinShade: std(0xb07a50, 0.8), eye: std(0x121214, 0.35), brow: std(0x16120f, 0.9),
  hair: std(0x1c1612, 0.9), hat: std(0x24252c, 0.9), hatPatch: std(0x34353d, 0.9),
  ear: std(0x4f5638, 0.7), earPad: std(0x1a1a1c, 0.9),
  top: std(0x2a2c3a, 0.95), topDark: std(0x202230, 0.95), string: std(0x8b8d96, 0.9),
  glove: std(0x1b1b1e, 0.85), vest: std(0x7a6c48, 0.95), vestDark: std(0x5e5336, 0.95),
  pack: std(0x5f5d3a, 0.95), packDark: std(0x4a482c, 0.95), strap: std(0x1d1d20, 0.9), buckle: std(0x0f0f10, 0.6),
  pants: std(0x5b5d36, 0.95), pantsDark: std(0x4a4c2c, 0.95), knee: std(0x2b2b2e, 0.7),
  shoe: std(0x2c2b2d, 0.85), sole: std(0x141415, 0.9), lace: std(0x55555a, 0.9),
  gun: std(0x1b1c1f, 0.45, 0.55), gunDark: std(0x0c0c0d, 0.5, 0.6), furn: std(0x1b1c1f, 0.7, 0.1),
  rubber: std(0x111112, 0.95), bolt: std(0x9a9ca2, 0.3, 0.9), brass: std(0xc9a14a, 0.3, 0.9),
  hatSeam: std(0x1a1b20, 0.9), hatDS: std(0x24252c, 0.9, 0, { side: THREE.DoubleSide }),
  lens: new THREE.MeshStandardMaterial({ color: 0xd8b33a, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.55, flatShading: true }),
  frame: std(0x141416, 0.5, 0.2), paint: std(0x2b3324, 0.95), patch: std(0x3b3f4a, 0.9), patchEdge: std(0x151517, 0.9),
  watch: std(0x111113, 0.4, 0.4), holster: std(0x18181a, 0.7),
  sgFurn: std(0x1b1c1f, 0.7, 0.1), pSlide: std(0x1b1c1f, 0.4, 0.5), pFrame: std(0x1b1c1f, 0.75, 0.05),
  hull: std(0xa3261e, 0.6), sight: std(0xe8e04a, 0.4),
  glass: new THREE.MeshStandardMaterial({ color: 0x6fa0b0, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.18, depthWrite: false }),
};
const shadeHex = (hex, f) => new THREE.Color(hex).multiplyScalar(f);

function applyColors(c) {
  const set = (m, hex, f = 1) => m.color.copy(shadeHex(hex, f));
  set(SLOT.skin, c.skin); set(SLOT.skinShade, c.skin, 0.78);
  set(SLOT.eye, c.eyeColor); set(SLOT.hair, c.hairColor); set(SLOT.brow, c.hairColor, 0.85);
  set(SLOT.hat, c.hatColor); set(SLOT.hatPatch, c.hatColor, 1.35); set(SLOT.hatSeam, c.hatColor, 0.62); set(SLOT.hatDS, c.hatColor);
  set(SLOT.lens, c.lensColor); SLOT.lens.opacity = c.eyewear === 'sunglasses' ? 0.85 : 0.5; set(SLOT.paint, c.paintColor);
  set(SLOT.patch, c.patchColor); set(SLOT.holster, c.beltColor, 0.85);
  set(SLOT.sgFurn, c.sgFurnColor); set(SLOT.pSlide, c.pistolSlide); set(SLOT.pFrame, c.pistolFrame);
  set(SLOT.ear, c.earColor); set(SLOT.top, c.topColor); set(SLOT.topDark, c.topColor, 0.78);
  set(SLOT.glove, c.gloveColor); set(SLOT.vest, c.vestColor); set(SLOT.vestDark, c.vestColor, 0.75);
  set(SLOT.pack, c.packColor); set(SLOT.packDark, c.packColor, 0.78);
  set(SLOT.pants, c.pantsColor); set(SLOT.pantsDark, c.pantsColor, 0.8); set(SLOT.knee, c.kneeColor);
  set(SLOT.shoe, c.shoeColor); set(SLOT.sole, c.shoeColor, 0.5); set(SLOT.strap, c.beltColor);
  set(SLOT.lace, c.shoes === 'sneakers' ? '#e8e6e0' : c.shoeColor, c.shoes === 'sneakers' ? 1 : 1.7);
  if (c.shoes === 'sneakers') SLOT.sole.color.set('#e9e7e1');
  set(SLOT.gun, c.gunColor); set(SLOT.furn, c.furnColor);
}

// =====================================================================
//  Configuration
// =====================================================================
const REFERENCE = {
  skin: '#e09a62', height: 1, shoulders: 1, muscle: 0.45, fat: 0.15, legLen: 1, headSize: 1.08,
  eyeColor: '#121214', brows: 'stern', facialHair: 'none', hair: 'short', hairColor: '#1c1612',
  headwear: 'cap', hatColor: '#24252c', ears: 'earpro', earColor: '#4f5638',
  top: 'hoodie', topColor: '#2b2d3c', sleeves: 'rolled', gloves: 'fingerless', gloveColor: '#1b1b1e',
  vest: 'plate', vestColor: '#7a6c48', pack: 'assault', packColor: '#5f5d3a', belt: true, beltColor: '#1d1d20',
  bottom: 'cargo', pantsColor: '#5b5d36', kneepads: true, kneeColor: '#2b2b2e', shoes: 'boots', shoeColor: '#2c2b2d',
  gunColor: '#1b1c1f', furnColor: '#1b1c1f', optic: 'holo', grip: 'none', muzzle: 'flash',
  eyewear: 'none', lensColor: '#d8b33a', facePaint: 'none', paintColor: '#2b3324', patch: 'flag', patchColor: '#3b3f4a',
  holster: true, watch: true, sgFurnColor: '#1b1c1f', sgOptic: 'bead', pistolSlide: '#1b1c1f', pistolFrame: '#1b1c1f', pistolLight: false,
};
const PRESETS = {
  'Reference': REFERENCE,
  'Urban Black': { ...REFERENCE, top: 'jacket', topColor: '#1d1e23', sleeves: 'full', vest: 'plate', vestColor: '#232428', pack: 'none',
    pantsColor: '#2a2b30', bottom: 'cargo', headwear: 'helmet', hatColor: '#1f2024', earColor: '#232428', ears: 'headset', gloves: 'full', kneeColor: '#1a1a1d' },
  'Desert': { ...REFERENCE, skin: '#c98a58', top: 'tshirt', topColor: '#a08a60', vest: 'rig', vestColor: '#b39b6c', pack: 'hydration', packColor: '#a08a60',
    bottom: 'cargo', pantsColor: '#a8916a', headwear: 'boonie', hatColor: '#9f8a62', ears: 'none', shoeColor: '#8a7352', gunColor: '#7a6c48', furnColor: '#7a6c48', facialHair: 'beard' },
  'Woodland': { ...REFERENCE, skin: '#a86b43', top: 'longsleeve', topColor: '#3d4a33', sleeves: 'full', vest: 'plate', vestColor: '#4f5638',
    pantsColor: '#4a5233', headwear: 'helmet', hatColor: '#4f5638', ears: 'headset', earColor: '#2b2d26', furnColor: '#4f5638' },
  'Range Day': { ...REFERENCE, skin: '#f0c7a2', top: 'tshirt', topColor: '#6b6f74', vest: 'none', pack: 'none', bottom: 'pants', pantsColor: '#3a4a66',
    kneepads: false, shoes: 'sneakers', shoeColor: '#3b3f4a', headwear: 'capback', hatColor: '#7a2e2a', ears: 'earpro', earColor: '#c0392b', gloves: 'none', hair: 'messy', hairColor: '#6b4a2e', grip: 'vertical', optic: 'reddot' },
};

const OPTS = {
  brows: [['stern', 'Stern'], ['flat', 'Flat'], ['raised', 'Raised'], ['none', 'None']],
  facialHair: [['none', 'None'], ['stubble', 'Stubble'], ['beard', 'Beard'], ['goatee', 'Goatee'], ['mustache', 'Mustache']],
  hair: [['none', 'Bald'], ['buzz', 'Buzz'], ['short', 'Short'], ['messy', 'Messy'], ['long', 'Long'], ['ponytail', 'Ponytail']],
  headwear: [['none', 'None'], ['cap', 'Cap'], ['capback', 'Cap (back)'], ['beanie', 'Beanie'], ['helmet', 'Helmet'], ['boonie', 'Boonie'], ['bandana', 'Bandana']],
  eyewear: [['none', 'None'], ['glasses', 'Shooting Glasses'], ['sunglasses', 'Sunglasses'], ['goggles', 'Goggles']],
  facePaint: [['none', 'None'], ['stripes', 'Stripes'], ['eyeblack', 'Eye Black'], ['band', 'Band']],
  patch: [['none', 'None'], ['flag', 'Flag'], ['morale', 'Morale'], ['name', 'Name Tape']],
  holster: [[true, 'Yes'], [false, 'No']], watch: [[true, 'Yes'], [false, 'No']],
  sgOptic: [['bead', 'Bead'], ['reddot', 'Red Dot']], pistolLight: [[false, 'No'], [true, 'Weapon Light']],
  ears: [['none', 'None'], ['earpro', 'Ear Pro'], ['headset', 'Comms']],
  top: [['hoodie', 'Hoodie'], ['jacket', 'Jacket'], ['longsleeve', 'Long Sleeve'], ['tshirt', 'T-Shirt'], ['tank', 'Tank'], ['none', 'Shirtless']],
  sleeves: [['rolled', 'Rolled'], ['full', 'Full']],
  gloves: [['none', 'None'], ['fingerless', 'Fingerless'], ['full', 'Full']],
  vest: [['none', 'None'], ['plate', 'Plate Carrier'], ['rig', 'Chest Rig']],
  pack: [['none', 'None'], ['assault', 'Assault Pack'], ['hydration', 'Hydration']],
  belt: [[true, 'Yes'], [false, 'No']],
  bottom: [['cargo', 'Cargo'], ['pants', 'Straight'], ['joggers', 'Joggers'], ['shorts', 'Shorts']],
  kneepads: [[true, 'Yes'], [false, 'No']],
  shoes: [['boots', 'Boots'], ['sneakers', 'Sneakers']],
  optic: [['holo', 'Holo'], ['reddot', 'Red Dot'], ['irons', 'Irons']],
  grip: [['none', 'None'], ['vertical', 'Vertical'], ['angled', 'Angled']],
  muzzle: [['flash', 'Flash Hider'], ['brake', 'Muzzle Brake'], ['suppressor', 'Suppressor']],
};
const SW = {
  skin: ['#f6d5b8', '#f0c7a2', '#e09a62', '#c98a58', '#a86b43', '#8a5233', '#6b3d24', '#4a2a19'],
  cloth: ['#1b1c20', '#2b2d3c', '#3b3f4a', '#6b6f74', '#5b5d36', '#4f5638', '#3d4a33', '#7a6c48', '#a8916a', '#3a2f2a', '#7a2e2a', '#3a4a66', '#e5e2da'],
  hair: ['#0e0c0b', '#1c1612', '#3b2a1e', '#6b4a2e', '#a8783e', '#d8b878', '#8a8a8a', '#e8e4dc', '#7a2a1a'],
  eyes: ['#121214', '#2a1c12', '#3a5a8a', '#3d6b3a', '#6b5a3a'],
  gun: ['#1b1c1f', '#3b3f44', '#7a6c48', '#4f5638', '#5a5e64'],
  wood: ['#1b1c1f', '#5a3b22', '#7a4a2a', '#7a6c48', '#4f5638'],
  lens: ['#d8b33a', '#c8d0d8', '#3a3f48', '#b0502a', '#4a7ab0'],
  paint: ['#2b3324', '#121214', '#4a4630', '#5b5d36'],
};
const SCHEMA = [
  { tab: 'Body', items: [
    { k: 'skin', t: 'color', sw: 'skin', l: 'Skin tone' },
    { k: 'height', t: 'range', min: 0.86, max: 1.14, l: 'Height' },
    { k: 'shoulders', t: 'range', min: 0.82, max: 1.2, l: 'Shoulder width' },
    { k: 'muscle', t: 'range', min: 0, max: 1, l: 'Muscle' },
    { k: 'fat', t: 'range', min: 0, max: 1, l: 'Body fat' },
    { k: 'legLen', t: 'range', min: 0.88, max: 1.12, l: 'Leg length' },
    { k: 'headSize', t: 'range', min: 0.9, max: 1.25, l: 'Head size' } ] },
  { tab: 'Face', items: [
    { k: 'eyeColor', t: 'color', sw: 'eyes', l: 'Eyes' },
    { k: 'brows', t: 'opt', l: 'Brows' },
    { k: 'hair', t: 'opt', l: 'Hair' },
    { k: 'hairColor', t: 'color', sw: 'hair', l: 'Hair color' },
    { k: 'facialHair', t: 'opt', l: 'Facial hair' },
    { k: 'eyewear', t: 'opt', l: 'Eyewear' },
    { k: 'lensColor', t: 'color', sw: 'lens', l: 'Lens tint' },
    { k: 'facePaint', t: 'opt', l: 'Face paint' },
    { k: 'paintColor', t: 'color', sw: 'paint', l: 'Paint color' } ] },
  { tab: 'Head', items: [
    { k: 'headwear', t: 'opt', l: 'Headwear' },
    { k: 'hatColor', t: 'color', sw: 'cloth', l: 'Headwear color' },
    { k: 'ears', t: 'opt', l: 'Hearing protection' },
    { k: 'earColor', t: 'color', sw: 'cloth', l: 'Ear pro color' } ] },
  { tab: 'Top', items: [
    { k: 'top', t: 'opt', l: 'Top' },
    { k: 'topColor', t: 'color', sw: 'cloth', l: 'Top color' },
    { k: 'sleeves', t: 'opt', l: 'Sleeves' },
    { k: 'gloves', t: 'opt', l: 'Gloves' },
    { k: 'gloveColor', t: 'color', sw: 'cloth', l: 'Glove color' } ] },
  { tab: 'Gear', items: [
    { k: 'vest', t: 'opt', l: 'Vest' },
    { k: 'vestColor', t: 'color', sw: 'cloth', l: 'Vest color' },
    { k: 'pack', t: 'opt', l: 'Backpack' },
    { k: 'packColor', t: 'color', sw: 'cloth', l: 'Pack color' },
    { k: 'belt', t: 'opt', l: 'Belt' },
    { k: 'beltColor', t: 'color', sw: 'cloth', l: 'Belt & straps' },
    { k: 'patch', t: 'opt', l: 'Patch' },
    { k: 'patchColor', t: 'color', sw: 'cloth', l: 'Patch color' },
    { k: 'holster', t: 'opt', l: 'Thigh holster' },
    { k: 'watch', t: 'opt', l: 'Watch' } ] },
  { tab: 'Legs', items: [
    { k: 'bottom', t: 'opt', l: 'Bottoms' },
    { k: 'pantsColor', t: 'color', sw: 'cloth', l: 'Bottoms color' },
    { k: 'kneepads', t: 'opt', l: 'Knee pads' },
    { k: 'kneeColor', t: 'color', sw: 'cloth', l: 'Knee pad color' },
    { k: 'shoes', t: 'opt', l: 'Footwear' },
    { k: 'shoeColor', t: 'color', sw: 'cloth', l: 'Footwear color' } ] },
  { tab: 'Weapons', items: [
    { k: 'optic', t: 'opt', l: 'Rifle optic' },
    { k: 'muzzle', t: 'opt', l: 'Rifle muzzle device' },
    { k: 'grip', t: 'opt', l: 'Rifle foregrip' },
    { k: 'gunColor', t: 'color', sw: 'gun', l: 'Rifle receiver' },
    { k: 'furnColor', t: 'color', sw: 'gun', l: 'Rifle furniture' },
    { k: 'sgOptic', t: 'opt', l: 'Shotgun sight' },
    { k: 'sgFurnColor', t: 'color', sw: 'wood', l: 'Shotgun stock' },
    { k: 'pistolLight', t: 'opt', l: 'Pistol light' },
    { k: 'pistolSlide', t: 'color', sw: 'gun', l: 'Pistol slide' },
    { k: 'pistolFrame', t: 'color', sw: 'gun', l: 'Pistol frame' } ] },
];

function loadCfg() {
  try {
    const raw = localStorage.getItem('nightrange.cfg');
    if (raw) return { ...REFERENCE, ...JSON.parse(raw) };
  } catch (e) { /* storage unavailable */ }
  return { ...REFERENCE };
}
function saveCfg() { try { localStorage.setItem('nightrange.cfg', JSON.stringify(cfg)); } catch (e) { /* ignore */ } }
let cfg = loadCfg();

// =====================================================================
//  Geometry helpers
// =====================================================================
function M(geo, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const ball = (r, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
// Tapered cylinder along +Y from len*from to len*to (r0 at the start of the segment, r1 at its end).
function tube(r0, r1, len, from = 0, to = 1, seg = 7) {
  const g = new THREE.CylinderGeometry(lerp(r0, r1, to), lerp(r0, r1, from), len * (to - from), seg, 1);
  g.translate(0, len * (from + to) / 2, 0);
  return g;
}
// Sculpted limb along +Y: tapered with a muscle bulge (biceps, forearm, quads, calf) and an
// elliptical cross-section. Clothing shells reuse the same profile with `grow` so they hug the body.
function limb(r0, r1, len, o = {}) {
  const { from = 0, to = 1, bulge = 0, at = 0.4, grow = 0, seg = 8, sx = 1, sz = 1, cap = true } = o;
  const pts = [], n = 7;
  const rad = (t) => lerp(r0, r1, t) * (1 + bulge * Math.exp(-(((t - at) / 0.24) ** 2))) + grow;
  if (cap) pts.push(new THREE.Vector2(0.001, len * from));
  for (let i = 0; i <= n; i++) { const t = lerp(from, to, i / n); pts.push(new THREE.Vector2(rad(t), len * t)); }
  if (cap) pts.push(new THREE.Vector2(0.001, len * to));
  const g = new THREE.LatheGeometry(pts, seg, Math.PI / seg);
  g.scale(sx, 1, sz);
  return g;
}
// Cloth fold: a slightly tilted thin ring around a limb.
function fold(r, y, tilt, mat, parent, sx = 1, sz = 1) {
  const g = new THREE.TorusGeometry(r, 0.007, 3, 9); g.rotateX(Math.PI / 2); g.scale(sx, 1, sz);
  return M(g, mat, parent, 0, y, 0, tilt, 0, tilt * 0.6);
}
// Cylinder along +Z.
function cylZ(r, len, seg = 8, open = false) {
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, open);
  g.rotateX(Math.PI / 2);
  return g;
}
function lathe(pts, depth, seg = 8) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, Math.PI / seg);
  g.scale(1, 1, depth);
  return g;
}
const inflate = (pts, by) => pts.map(([r, y]) => [r > 0.002 ? r + by : r, y]);

// Orient a group so its +Y runs from a to b, with +Z as close to zHint as possible.
function placeSeg(g, a, b, zHint) {
  const y = _v1.subVectors(b, a).normalize();
  const z = _v2.copy(zHint).addScaledVector(y, -zHint.dot(y));
  if (z.lengthSq() < 1e-6) z.set(0, 0, 1).addScaledVector(y, -y.z);
  z.normalize();
  const x = _v3.crossVectors(y, z);
  _m1.makeBasis(x, y, z);
  g.quaternion.setFromRotationMatrix(_m1);
  g.position.copy(a);
}
// Analytic two-bone IK. Writes joint + effector positions.
const _i1 = new V3(), _i2 = new V3();
function ik(a, target, l1, l2, pole, outMid, outEnd) {
  const dir = _i1.subVectors(target, a);
  let dist = dir.length();
  dir.divideScalar(dist || 1);
  dist = clamp(dist, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-4);
  const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const bend = _i2.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (bend.lengthSq() < 1e-8) bend.set(0, -1, 0);
  bend.normalize();
  outMid.copy(a).addScaledVector(dir, cosA * l1).addScaledVector(bend, sinA * l1);
  outEnd.copy(a).addScaledVector(dir, dist);
}
// Box for shoes: the front half narrows (toeW) and its top drops toward the tip (toeH = remaining height).
function footGeo(w, h, len, toeW, toeH) {
  const g = new THREE.BoxGeometry(w, h, len, 2, 1, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getZ(i) / len) + 0.5;
    const f = smooth(clamp((t - 0.45) / 0.55, 0, 1));
    p.setX(i, p.getX(i) * lerp(1, toeW, f) * (t < 0.08 ? 0.9 : 1));
    if (p.getY(i) > 0) p.setY(i, lerp(h / 2, -h / 2 + h * toeH, f * f));
  }
  g.computeVertexNormals();
  return g;
}
function disposeTree(o) { o.traverse((n) => { if (n.geometry) n.geometry.dispose(); }); }

// =====================================================================
//  Character
// =====================================================================
function dims(c) {
  const s = c.height, m = c.muscle, f = c.fat, sh = c.shoulders, L = c.legLen;
  const d = { s };
  d.thigh = 0.42 * s * L; d.shin = 0.41 * s * L; d.ankle = 0.075 * s;
  d.hipY = d.thigh + d.shin + d.ankle;
  d.hipX = (0.09 + 0.015 * f) * s;
  d.waistY = 0.1 * s;
  d.torso = 0.46 * s;
  d.chestW = (0.165 * sh + 0.025 * m + 0.02 * f) * s;
  d.waistW = (0.135 + 0.05 * f) * s;
  d.hipW = (0.15 + 0.035 * f) * s;
  d.depth = 0.62 + 0.08 * f;
  d.shX = (0.19 * sh + 0.015 * m) * s;
  d.shY = d.torso - 0.055 * s;
  d.front = d.chestW * d.depth;
  d.upper = 0.28 * s; d.fore = 0.26 * s; d.hand = 0.085 * s;
  d.rUA = (0.05 + 0.018 * m + 0.014 * f) * s; d.rFA = (0.042 + 0.012 * m + 0.008 * f) * s;
  d.rTh = (0.078 + 0.02 * m + 0.025 * f) * s; d.rSh = (0.056 + 0.012 * m + 0.01 * f) * s;
  d.neck = 0.07 * s; d.neckR = (0.055 + 0.01 * m) * s;
  const h = c.headSize * s;
  d.hw = 0.25 * h; d.hh = 0.28 * h; d.hd = 0.26 * h;
  return d;
}

// Hand-sculpted low-poly head: an ellipsoid pushed around like clay — flat face plane, brow ridge,
// cheekbones, an angled jaw and chin, flatter crown/back — plus a tiny deterministic wobble on every facet.
function headShape(d) {
  const ex = d.hw * 0.5, ey = d.hh * 0.52, ez = d.hd * 0.54; // 8% narrower than the first pass
  return { ex, ey, ez, cy: d.hh / 2 };
}
const bump = (x, y, cx, cy, r) => Math.exp(-(((x - cx) ** 2) + ((y - cy) ** 2)) / (r * r));
function sculpt(H, ux, uy, uz) { // unit-sphere direction in, head-space offset out (relative to head centre)
  const bx = (u) => Math.sign(u) * Math.abs(u) ** 0.55; // push toward a box like the concept art
  ux = bx(ux); uy = bx(uy); uz = bx(uz);
  const front = Math.max(0, uz), side = Math.abs(ux);
  let x = ux * H.ex, y = uy * H.ey, z = uz * H.ez;
  if (uy < 0) { // jaw: narrows toward the chin but keeps a corner at the jaw angle
    const t = Math.min(1, -uy);
    x *= 1 - 0.38 * t * t;
    z *= 1 - 0.08 * t;
  }
  if (uy > 0.55) y = H.ey * (0.55 + (uy - 0.55) * 0.82);        // flatter crown
  if (uz < -0.2) z = lerp(z, z * 0.88, Math.min(1, (-uz - 0.2) * 2)); // flatter back of the skull
  z = Math.min(z, H.ez * (0.9 + 0.1 * side));                     // flat face plane
  // features pushed out along the surface
  const n = 1 + 0.07 * front * bump(side, uy, 0.32, 0.36, 0.22)  // brow ridge
            + 0.05 * front * bump(side, uy, 0.62, -0.05, 0.22)   // cheekbones
            + 0.06 * front * bump(side, uy, 0.0, -0.78, 0.2)     // chin
            - 0.04 * bump(side, uy, 0.95, 0.15, 0.25);           // temples
  x *= n; z *= n;
  // hand-made unevenness, hashed from the direction so seams and rebuilds stay identical
  const h = Math.sin(ux * 127.1 + uy * 311.7 + uz * 74.7) * 43758.5453;
  const w = (h - Math.floor(h) - 0.5) * 0.035;
  return [x * (1 + w), y * (1 + w * 0.6), z * (1 + w)];
}
function headShell(d, grow, phiStart = 0, phiLen = Math.PI * 2, thStart = 0, thLen = Math.PI, ws = 8, hs = 6) {
  const H = headShape(d);
  const g = new THREE.SphereGeometry(1, ws, hs, phiStart, phiLen, thStart, thLen);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i);
    const [x, y, z] = sculpt(H, ux, uy, uz);
    const len = Math.hypot(x, y, z) || 1;
    p.setXYZ(i, x + (x / len) * grow, y + (y / len) * grow, z + (z / len) * grow);
  }
  g.computeVertexNormals();
  g.translate(0, H.cy, 0);
  return g;
}
// Point on the sculpted head surface (same parametrisation as SphereGeometry / headShell).
function shellPt(d, grow, theta, phi, out = new V3()) {
  const H = headShape(d);
  const ux = -Math.cos(phi) * Math.sin(theta), uy = Math.cos(theta), uz = Math.sin(phi) * Math.sin(theta);
  const [x, y, z] = sculpt(H, ux, uy, uz), len = Math.hypot(x, y, z) || 1;
  return out.set(x + (x / len) * grow, y + (y / len) * grow + H.cy, z + (z / len) * grow);
}
function seam(d, grow, phi, th0, th1, r, mat, parent) {
  const pts = [];
  for (let i = 0; i <= 8; i++) pts.push(shellPt(d, grow, lerp(th0, th1, i / 8), phi));
  return M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, r, 4), mat, parent);
}
function ring(d, grow, theta, r, mat, parent, phi0 = 0, phi1 = Math.PI * 2, closed = true) {
  const pts = [], n = closed ? 24 : 12;
  for (let i = 0; i < (closed ? n : n + 1); i++) pts.push(shellPt(d, grow, theta, lerp(phi0, phi1, i / n)));
  return M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), closed ? 48 : 20, r, 4, closed), mat, parent);
}
// Front of a sphere segment is phi = PI/2 (+Z) in three.js' parametrisation.
const FRONT = Math.PI / 2;
const _faceRay = new THREE.Raycaster();

function buildHead(c, d, head) {
  const S = SLOT, H = headShape(d);
  const skull = M(headShell(d, 0), S.skin, head);
  // place a feature on the sculpted surface (found by raycasting the head), turned to follow it
  const probe = new THREE.Mesh(skull.geometry);
  const onFace = (geo, mat, x, y, depth, rz = 0, inset = 0) => {
    _faceRay.set(_v4.set(x, y, 1), _v5.set(0, 0, -1));
    const hit = _faceRay.intersectObject(probe, false)[0];
    const z = (hit ? hit.point.z : H.ez * 0.8) - inset + depth / 2;
    const ry = hit ? Math.atan2(hit.face.normal.x, hit.face.normal.z) * 0.8 : 0;
    return M(geo, mat, head, x, y, z, 0, ry, rz);
  };
  for (const sx of [1, -1]) {
    onFace(box(d.hw * 0.1, d.hh * 0.17, 0.012), S.eye, sx * d.hw * 0.2, d.hh * 0.48, 0.012, 0, 0.006);
    if (c.brows !== 'none') {
      const rz = c.brows === 'stern' ? 0.28 * sx : c.brows === 'raised' ? -0.18 * sx : 0;
      const by = c.brows === 'raised' ? 0.66 : 0.63;
      onFace(box(d.hw * 0.3, d.hh * 0.075, 0.02), S.brow, sx * d.hw * 0.22, d.hh * by, 0.02, rz, 0.012);
    }
    M(ball(0.03, 0), S.skin, head, sx * H.ex * 0.93, d.hh * 0.47, -0.01).scale.set(0.5, 1, 0.7);
  }
  onFace(box(d.hw * 0.12, d.hh * 0.13, 0.03), S.skin, 0, d.hh * 0.38, 0.03, 0, 0.018);
  onFace(box(d.hw * 0.2, 0.007, 0.006), S.skinShade, 0, d.hh * 0.2, 0.006, 0, 0.002);
  if (c.facePaint === 'band') onFace(box(d.hw * 0.98, d.hh * 0.16, 0.012), S.paint, 0, d.hh * 0.47, 0.012, 0, 0.009);
  for (const sx of [1, -1]) {
    if (c.facePaint === 'eyeblack') onFace(box(d.hw * 0.17, d.hh * 0.05, 0.01), S.paint, sx * d.hw * 0.21, d.hh * 0.36, 0.01, 0, 0.007);
    if (c.facePaint === 'stripes') for (let i = 0; i < 2; i++) onFace(box(d.hw * 0.26, d.hh * 0.035, 0.01), S.paint, sx * d.hw * 0.27, d.hh * (0.33 - i * 0.07), 0.01, sx * 0.35, 0.007);
  }

  // facial hair: thin shells over the lower face
  const fh = c.facialHair;
  if (fh === 'stubble') M(headShell(d, 0.003, FRONT - 1.35, 2.7, Math.PI * 0.56, Math.PI * 0.44), S.skinShade, head);
  if (fh === 'beard') M(headShell(d, 0.009, FRONT - 1.2, 2.4, Math.PI * 0.62, Math.PI * 0.38), S.hair, head);
  if (fh === 'goatee') onFace(box(d.hw * 0.3, d.hh * 0.16, 0.03), S.hair, 0, d.hh * 0.09, 0.03, 0, 0.022);
  if (fh === 'mustache' || fh === 'beard' || fh === 'goatee') onFace(box(d.hw * 0.34, d.hh * 0.05, 0.022), S.hair, 0, d.hh * 0.27, 0.022, 0, 0.012);

  // hair: crown cap + back/sides shell that leaves the face open
  const hs = c.hair;
  if (hs !== 'none') {
    const t = hs === 'buzz' ? 0.005 : 0.014;
    if (c.headwear === 'none') M(headShell(d, t, 0, Math.PI * 2, 0, Math.PI * 0.36), S.hair, head);
    M(headShell(d, t, FRONT + 1.2, Math.PI * 2 - 2.4, 0, Math.PI * (hs === 'long' ? 0.8 : 0.64)), S.hair, head);
    if (hs === 'messy' && c.headwear === 'none') for (let i = 0; i < 6; i++)
      M(box(0.05, 0.035, 0.07), S.hair, head, (i % 3 - 1) * d.hw * 0.25, d.hh + 0.005, (Math.floor(i / 3) - 0.5) * d.hd * 0.35, rand(-0.4, 0.4), rand(-0.6, 0.6), rand(-0.4, 0.4));
    if (hs === 'long') M(box(d.hw * 0.9, d.hh * 0.6, 0.04), S.hair, head, 0, d.hh * 0.05, -H.ez * 0.85);
    if (hs === 'ponytail') {
      M(ball(0.04, 0), S.hair, head, 0, d.hh * 0.62, -H.ez - 0.02);
      M(tube(0.035, 0.015, 0.2, 0, 1, 6), S.hair, head, 0, d.hh * 0.62, -H.ez - 0.04, Math.PI * 0.85);
    }
  }

  // headwear
  const hw = c.headwear;
  // Headwear is fitted to the sculpted skull (shellPt/headShell) and given real construction:
  // panel seams, sweatband, pre-curved brim, cuffs, rails, stitched brims.
  let crownTop = H.cy + H.ey * 0.92 + 0.02;
  if (hw === 'cap' || hw === 'capback') {
    const cap = new THREE.Group(); head.add(cap);
    if (hw === 'capback') cap.rotation.y = Math.PI;
    const g = 0.024, rimTh = Math.PI * 0.43;
    M(headShell(d, g, 0, Math.PI * 2, 0, rimTh, 10, 7), S.hat, cap);
    for (let k = 0; k < 6; k++) seam(d, g + 0.002, FRONT + k * Math.PI / 3, 0.05, rimTh, 0.0024, S.hatSeam, cap);
    ring(d, g + 0.003, rimTh - 0.02, 0.0045, S.hatSeam, cap);
    // brim: its inner edge is the crown's front rim itself, so it is attached all the way round the curve
    const span = 1.15, N = 14, inner = [], outer = [], pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, phi = FRONT - span + u * span * 2, c = Math.cos((u - 0.5) * Math.PI);
      const p = shellPt(d, g, rimTh, phi);
      const out = new V3(p.x, 0, p.z).normalize().lerp(new V3(0, 0, 1), 0.55).normalize();
      const w = d.hd * 0.6 * Math.pow(Math.max(c, 0), 0.55);
      const q = p.clone().addScaledVector(out, w); q.y -= w * 0.2 + (1 - c) * 0.004;
      inner.push(p); outer.push(q);
      pos.push(p.x, p.y, p.z, q.x, q.y, q.z);
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); }
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setIndex(idx); bg.computeVertexNormals();
    M(bg, S.hatDS, cap);
    M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outer), 28, 0.0055, 4), S.hatDS, cap);   // stiff brim edge / thickness
    M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(inner), 28, 0.004, 4), S.hatSeam, cap);  // seam where the brim meets the crown
    const pp = shellPt(d, g + 0.004, Math.PI * 0.26, FRONT);
    M(box(H.ex * 0.62, d.hh * 0.11, 0.008), S.hatPatch, cap, 0, pp.y, pp.z, -0.55);
    const bk = shellPt(d, g, rimTh - 0.06, FRONT + Math.PI);
    M(box(0.065, 0.032, 0.012), S.hatSeam, cap, 0, bk.y, bk.z);
    M(box(0.03, 0.008, 0.014), S.buckle, cap, 0, bk.y - 0.014, bk.z - 0.004);
    crownTop = shellPt(d, g, 0, 0).y;
    M(new THREE.CylinderGeometry(0.011, 0.012, 0.008, 6), S.hat, cap, 0, crownTop + 0.003, 0);
  } else if (hw === 'beanie') {
    const g = 0.02, rimTh = Math.PI * 0.46;
    M(headShell(d, g, 0, Math.PI * 2, 0, rimTh, 10, 7), S.hat, head);
    for (let k = 0; k < 14; k++) seam(d, g + 0.001, k * Math.PI / 7, 0.18, rimTh - 0.08, 0.0016, S.hatSeam, head);
    ring(d, g + 0.006, rimTh - 0.04, 0.017, S.hatPatch, head);
    crownTop = shellPt(d, g, 0, 0).y;
  } else if (hw === 'helmet') {
    // High-cut ballistic helmet: a smooth ellipsoid (not the boxy skull) so it reads as a moulded shell.
    const hel = new THREE.Group(); head.add(hel);
    const C = new V3(0, H.cy + 0.012, -0.006), R = new V3(H.ex + 0.052, H.ey * 0.95 + 0.05, H.ez + 0.056);
    const ell = (th, ph, k = 1) => new V3(-Math.cos(ph) * Math.sin(th) * R.x * k + C.x, Math.cos(th) * R.y * k + C.y, Math.sin(ph) * Math.sin(th) * R.z * k + C.z);
    const piece = (ph0, phL, th0, thL, mat, k = 1, side) => {
      const g2 = new THREE.SphereGeometry(1, 16, 10, ph0, phL, th0, thL);
      g2.scale(R.x * k, R.y * k, R.z * k); g2.translate(C.x, C.y, C.z);
      const m = M(g2, side ? new THREE.MeshStandardMaterial({ color: mat.color, roughness: 0.9, flatShading: true, side: THREE.BackSide }) : mat, hel);
      return m;
    };
    const top = Math.PI * 0.4, brow = Math.PI * 0.47, nape = Math.PI * 0.56, fw = 1.05, bw = 1.25;
    piece(0, Math.PI * 2, 0, top, S.hat);
    piece(FRONT - fw, fw * 2, top, brow - top, S.hat);
    piece(FRONT + Math.PI - bw, bw * 2, top, nape - top, S.hat);
    piece(0, Math.PI * 2, 0, top, S.hatSeam, 0.96, true);   // inner liner visible at the edges
    // edge trim following the cut line (brow → ear cut-out → nape)
    const edge = [];
    const pushArc = (th, a0, a1, n) => { for (let i = 0; i <= n; i++) edge.push(ell(th, lerp(a0, a1, i / n), 1.01)); };
    pushArc(brow, FRONT - fw, FRONT + fw, 10);
    pushArc(top, FRONT + fw + 0.12, FRONT + Math.PI - bw - 0.12, 5);
    pushArc(nape, FRONT + Math.PI - bw, FRONT + Math.PI + bw, 10);
    pushArc(top, FRONT + Math.PI + bw + 0.12, FRONT + Math.PI * 2 - fw - 0.12, 5);
    M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true), 90, 0.0065, 4, true), S.hatSeam, hel);
    // side rails, shroud, velcro, counterweight
    for (const ph of [0, Math.PI]) {
      const r0 = ell(Math.PI * 0.37, ph, 1.03);
      M(box(0.014, 0.024, 0.13), S.hatSeam, hel, r0.x, r0.y, r0.z, 0, 0, ph ? 0.35 : -0.35);
      const a2 = ell(top + 0.04, ph + (ph ? -0.25 : 0.25)), j = shellPt(d, 0.006, Math.PI * 0.78, ph + (ph ? -0.45 : 0.45)), c2 = shellPt(d, 0.006, Math.PI * 0.93, FRONT);
      M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a2, j, c2]), 10, 0.0045, 4), S.strap, hel);
    }
    const sh = ell(Math.PI * 0.33, FRONT, 1.04);
    M(box(0.075, 0.045, 0.022), S.hatSeam, hel, sh.x, sh.y, sh.z, -0.65);
    M(box(0.03, 0.02, 0.02), S.buckle, hel, sh.x, sh.y - 0.022, sh.z + 0.012, -0.65);
    const vt = ell(Math.PI * 0.08, FRONT, 1.01);
    M(box(0.11, 0.008, 0.08), S.hatPatch, hel, vt.x, vt.y, vt.z - 0.01, -0.12);
    const cw = ell(Math.PI * 0.45, FRONT + Math.PI, 1.03);
    M(box(0.09, 0.06, 0.035), S.hatPatch, hel, cw.x, cw.y, cw.z, 0.25);
    crownTop = shellPt(d, 0.004, 0, 0).y; // ear-pro band runs under the shell
  } else if (hw === 'boonie') {
    const g = 0.03, rimTh = Math.PI * 0.42;
    M(headShell(d, g, 0, Math.PI * 2, 0, rimTh, 10, 7), S.hat, head);
    ring(d, g + 0.006, rimTh - 0.05, 0.013, S.hatPatch, head);
    const N = 28, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const p = shellPt(d, g - 0.004, rimTh, (i / N) * Math.PI * 2);
      const out = new V3(p.x, 0, p.z).normalize();
      pos.push(p.x, p.y, p.z, p.x + out.x * 0.085, p.y - 0.035, p.z + out.z * 0.085);
      if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setIndex(idx); bg.computeVertexNormals();
    M(bg, S.hatDS, head);
    crownTop = shellPt(d, g, 0, 0).y;
  } else if (hw === 'bandana') {
    M(headShell(d, 0.009, 0, Math.PI * 2, 0, Math.PI * 0.4, 10, 7), S.hat, head);
    ring(d, 0.012, Math.PI * 0.39, 0.006, S.hatSeam, head);
    const k = shellPt(d, 0.012, Math.PI * 0.42, FRONT + Math.PI);
    M(box(0.04, 0.03, 0.03), S.hat, head, k.x, k.y, k.z - 0.01);
    for (const sx of [1, -1]) M(box(0.025, 0.09, 0.008), S.hat, head, k.x + sx * 0.015, k.y - 0.05, k.z - 0.02, 0.2, 0, sx * 0.25);
    crownTop = shellPt(d, 0.009, 0, 0).y;
  }

  // eyewear: lenses are a slice of the head shell so they wrap the face
  if (c.eyewear !== 'none') {
    const gog = c.eyewear === 'goggles';
    const g = gog ? 0.036 : 0.026, t0 = Math.PI * (gog ? 0.458 : 0.466), tl = Math.PI * (gog ? 0.11 : 0.085);
    M(headShell(d, g, FRONT - 0.95, 1.9, t0, tl, 10, 2), SLOT.lens, head).castShadow = false;
    ring(d, g + 0.002, t0, gog ? 0.008 : 0.004, S.frame, head, FRONT - 0.95, FRONT + 0.95, false);
    if (gog) { ring(d, g + 0.002, t0 + tl, 0.008, S.frame, head, FRONT - 0.95, FRONT + 0.95, false); ring(d, 0.03, Math.PI * 0.5, 0.007, S.strap, head); }
    else for (const phi of [0, Math.PI]) {
      const s0 = shellPt(d, g, t0 + 0.03, FRONT + (phi ? 0.95 : -0.95)), s1 = shellPt(d, 0.016, t0 + 0.03, phi), s2 = shellPt(d, 0.01, t0 + 0.06, phi + (phi ? 0.45 : -0.45));
      M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([s0, s1, s2]), 8, 0.0035, 4), S.frame, head);
    }
  }

  // hearing protection
  if (c.ears !== 'none') {
    const big = c.ears === 'earpro';
    const cy = d.hh * 0.47, cx = H.ex + (big ? 0.016 : 0.008);
    for (const sx of [1, -1]) {
      const cup = new THREE.Group(); cup.position.set(sx * cx, cy, 0); head.add(cup);
      const rr = big ? 0.054 : 0.04;
      const g1 = new THREE.CylinderGeometry(rr, rr, big ? 0.05 : 0.035, 8); g1.rotateZ(Math.PI / 2); g1.scale(1, 1.15, 0.9);
      M(g1, S.ear, cup, sx * 0.008, 0, 0);
      const g2 = new THREE.CylinderGeometry(rr * 0.98, rr * 0.98, 0.016, 8); g2.rotateZ(Math.PI / 2); g2.scale(1, 1.15, 0.9);
      M(g2, S.earPad, cup, -sx * 0.02, 0, 0);
      if (big) M(box(0.012, 0.03, 0.02), S.earPad, cup, sx * 0.036, -0.02, 0.02);
      if (!big && sx < 0) M(box(0.008, 0.008, d.hd * 0.55), S.earPad, cup, sx * 0.01, -0.035, d.hd * 0.28, 0.25, 0, 0);
    }
    const R = cx;
    const band = new THREE.TorusGeometry(R, big ? 0.015 : 0.01, 4, 12, Math.PI);
    band.scale(1, Math.max(1, (crownTop - cy + 0.018) / R), big ? 1.6 : 1.2);
    M(band, big ? S.earPad : S.ear, head, 0, cy, 0);
  }
}

function buildCharacter(c) {
  const d = dims(c), S = SLOT;
  const root = new THREE.Group();
  const pelvis = new THREE.Group(); root.add(pelvis);
  const spine = new THREE.Group(); spine.position.y = d.waistY; pelvis.add(spine);
  const neck = new THREE.Group(); neck.position.y = d.torso; spine.add(neck);
  const head = new THREE.Group(); head.position.y = d.neck; neck.add(head);
  const anchor = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };

  const top = c.top, sleeved = top === 'hoodie' || top === 'jacket' || top === 'longsleeve';
  const covered = top !== 'none';
  const legsFull = c.bottom !== 'shorts';
  const baggy = c.bottom === 'cargo' ? 0.02 : c.bottom === 'joggers' ? 0.014 : 0.01;

  // ---- pelvis (bottoms) ----
  const hipPts = [[0.001, -0.075], [d.hipW * 0.75, -0.075], [d.hipW, -0.01], [d.hipW, 0.04], [d.waistW + 0.006, d.waistY + 0.01], [0.001, d.waistY + 0.01]];
  M(lathe(inflate(hipPts, baggy * 0.5), d.depth + 0.04), S.pants, pelvis);
  if (c.belt) {
    M(lathe([[0.001, 0], [d.waistW + 0.016, 0], [d.waistW + 0.016, 0.04], [0.001, 0.04]], d.depth + 0.05), S.strap, pelvis, 0, d.waistY - 0.05, 0);
    M(box(0.06, 0.045, 0.02), S.buckle, pelvis, 0, d.waistY - 0.03, (d.waistW + 0.016) * (d.depth + 0.05) + 0.005);
  }
  if (c.bottom === 'cargo') for (const sx of [1, -1]) M(box(0.06, 0.07, 0.03), S.pantsDark, pelvis, sx * d.hipW * 0.55, 0.0, -(d.hipW * d.depth) - 0.008);

  // ---- torso ----
  const tp = [[0.001, -0.03], [d.waistW, -0.03], [d.waistW * 0.98, 0.06], [d.waistW * 1.04, d.torso * 0.28], [d.chestW * 0.93, d.torso * 0.5], [d.chestW * 1.02, d.torso * 0.68], [d.chestW, d.torso * 0.8], [d.chestW * 0.86, d.torso * 0.92], [d.neckR * 1.9, d.torso * 0.985], [d.neckR * 1.4, d.torso], [0.001, d.torso]];
  M(lathe(covered ? inflate(tp, 0.014) : tp, d.depth), covered ? S.top : S.skin, spine);
  if (!covered) {
    for (const sx of [1, -1]) M(box(d.chestW * 0.72, d.torso * 0.2, 0.03), S.skin, spine, sx * d.chestW * 0.38, d.torso * 0.7, d.front - 0.006, -0.12, sx * 0.2);
    for (let i = 0; i < 3; i++) for (const sx of [1, -1]) M(box(d.waistW * 0.4, d.torso * 0.08, 0.02), S.skinShade, spine, sx * d.waistW * 0.24, d.torso * (0.2 + i * 0.1), d.waistW * d.depth - 0.004);
  }
  if (top === 'hoodie' || top === 'jacket') M(lathe([[0.001, 0], [d.waistW + 0.026, 0], [d.waistW + 0.026, 0.055], [0.001, 0.055]], d.depth + 0.03), S.topDark, spine, 0, -0.045, 0);
  if (top === 'hoodie') {
    const hood = new THREE.TorusGeometry(d.neckR * 1.95, 0.05 * d.s, 5, 10, Math.PI * 1.3);
    hood.rotateZ(Math.PI * 0.85); hood.rotateX(Math.PI / 2); hood.scale(1, 1.4, 0.9);
    M(hood, S.top, spine, 0, d.torso + 0.005, -0.025);
    for (const sx of [1, -1]) M(box(0.008, 0.11, 0.008), S.string, spine, sx * 0.035, d.torso * 0.83, d.front * 0.8 + 0.02, -0.2);
    if (c.vest === 'none') M(box(d.chestW * 1.05, d.torso * 0.22, 0.025), S.topDark, spine, 0, d.torso * 0.2, d.waistW * d.depth + 0.018);
  }
  if (top === 'jacket') {
    M(box(0.012, d.torso * 0.95, 0.01), S.buckle, spine, 0, d.torso * 0.48, d.front + 0.012);
    M(lathe([[0.001, 0], [d.neckR * 1.35, 0], [d.neckR * 1.3, 0.07], [0.001, 0.07]], 1), S.topDark, spine, 0, d.torso - 0.02, 0);
  }
  if (top === 'tshirt' || top === 'tank' || top === 'longsleeve') M(lathe([[0.001, 0], [d.neckR * 1.3, 0], [d.neckR * 1.25, 0.03], [0.001, 0.03]], 1), S.topDark, spine, 0, d.torso - 0.012, 0);
  // neck
  M(tube(d.neckR, d.neckR * 0.95, d.neck + 0.05, 0, 1, 7), S.skin, neck, 0, -0.03, 0);
  buildHead(c, d, head);

  // shoulders (deltoid caps)
  const shL = anchor(spine, d.shX, d.shY, 0), shR = anchor(spine, -d.shX, d.shY, 0);
  for (const sx of [1, -1]) M(ball(d.rUA * 1.22), covered && top !== 'tank' ? S.top : S.skin, spine, sx * d.shX, d.shY, 0);

  // ---- vest ----
  const vestT = c.vest !== 'none' ? 0.03 : 0;
  let pouchAnchor;
  if (c.vest === 'plate') {
    const pw = d.chestW * 1.55, ph = d.torso * 0.52, py = d.torso * 0.56, pz = d.front + 0.022;
    M(box(pw, ph, 0.05), S.vest, spine, 0, py, pz);
    M(box(pw, ph * 1.05, 0.05), S.vest, spine, 0, py, -pz);
    for (let i = 0; i < 3; i++) M(box(pw * 0.9, 0.012, 0.006), S.vestDark, spine, 0, py + ph * 0.32 - i * 0.04, pz + 0.027);
    for (const sx of [1, -1]) {
      M(box(0.075, 0.035, d.front * 2 + 0.07), S.vest, spine, sx * d.chestW * 0.52, d.torso * 0.86, 0);
      M(box(0.045, d.torso * 0.3, d.front * 1.5), S.vestDark, spine, sx * (d.chestW + 0.012), d.torso * 0.42, 0);
    }
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.078;
      M(box(0.07, 0.12, 0.05), S.vest, spine, x, d.torso * 0.32, pz + 0.045);
      M(box(0.072, 0.035, 0.054), S.vestDark, spine, x, d.torso * 0.32 + 0.055, pz + 0.045, -0.1);
    }
    M(box(0.16, 0.07, 0.03), S.vestDark, spine, 0, py + ph * 0.18, pz + 0.035);
    pouchAnchor = anchor(spine, 0.078, d.torso * 0.36, pz + 0.12);
  } else if (c.vest === 'rig') {
    for (const sx of [1, -1]) M(box(0.04, d.torso * 0.6, 0.01), S.vestDark, spine, sx * d.chestW * 0.45, d.torso * 0.62, d.front + 0.01, 0, 0, sx * 0.15);
    M(box(d.chestW * 1.7, 0.16, 0.06), S.vest, spine, 0, d.torso * 0.4, d.front + 0.03);
    for (let i = 0; i < 4; i++) M(box(0.06, 0.04, 0.066), S.vestDark, spine, (i - 1.5) * 0.068, d.torso * 0.4 + 0.07, d.front + 0.032);
    pouchAnchor = anchor(spine, 0.1, d.torso * 0.42, d.front + 0.14);
  } else {
    pouchAnchor = anchor(pelvis, d.hipW * 0.8, d.waistY - 0.02, d.hipW * d.depth * 0.6 + 0.08);
    if (c.belt) M(box(0.06, 0.1, 0.035), S.strap, pelvis, d.hipW * 0.8, d.waistY - 0.07, d.hipW * d.depth * 0.6 + 0.02);
  }

  // ---- patch ----
  if (c.patch !== 'none') {
    const onVest = c.vest === 'plate';
    const px = onVest ? -d.chestW * 0.42 : -d.shX - 0.002, py = onVest ? d.torso * 0.74 : d.shY - 0.06, pz = onVest ? d.front + 0.05 : 0.0;
    const w = c.patch === 'name' ? 0.11 : 0.07, h = c.patch === 'name' ? 0.025 : 0.05;
    const ry = onVest ? 0 : -Math.PI / 2;
    M(box(w + 0.008, h + 0.008, 0.005), S.patchEdge, spine, px, py, pz + (onVest ? 0 : 0), 0, ry, 0).position.x += onVest ? 0 : -d.rUA * 0.9;
    const inner = M(box(w, h, 0.006), S.patch, spine, px, py, pz + (onVest ? 0.001 : 0), 0, ry, 0);
    if (!onVest) inner.position.x += -d.rUA * 0.9 - 0.001;
    if (c.patch === 'flag') for (let i = 0; i < 3; i++) M(box(w * 0.92, 0.006, 0.007), S.patchEdge, spine, inner.position.x, py + 0.014 - i * 0.014, inner.position.z, 0, ry, 0);
  }
  if (c.belt && c.vest !== 'none') M(box(0.05, 0.075, 0.03), S.strap, pelvis, d.hipW * 0.72, d.waistY - 0.07, d.hipW * d.depth * 0.45 + 0.03);

  // ---- backpack ----
  if (c.pack !== 'none') {
    const big = c.pack === 'assault';
    const bw = d.chestW * (big ? 1.4 : 1.0), bh = d.torso * (big ? 0.66 : 0.55), bd = big ? 0.15 : 0.07;
    const bz = -(d.front + vestT + 0.015 + bd / 2), by = d.torso * 0.5;
    M(box(bw, bh, bd), S.pack, spine, 0, by, bz);
    if (big) {
      M(box(bw * 1.02, 0.06, bd * 1.08), S.packDark, spine, 0, by + bh / 2 - 0.02, bz, -0.08);
      M(box(bw * 0.7, bh * 0.45, 0.045), S.pack, spine, 0, by - bh * 0.15, bz - bd / 2 - 0.02);
      for (const sx of [1, -1]) {
        M(box(0.045, bh * 0.5, bd * 0.75), S.packDark, spine, sx * (bw / 2 + 0.02), by - bh * 0.1, bz);
        M(box(0.025, bh * 0.75, 0.008), S.strap, spine, sx * bw * 0.28, by, bz - bd / 2 - 0.045);
      }
    } else {
      M(new THREE.CylinderGeometry(0.008, 0.008, bh, 5), S.strap, spine, bw * 0.4, by + 0.05, bz + 0.04, 0, 0, 0.4);
    }
    if (c.vest === 'none') for (const sx of [1, -1]) M(box(0.05, 0.03, d.front * 2 + 0.06), S.strap, spine, sx * d.chestW * 0.5, d.torso * 0.88, 0);
  }

  // ---- arms ----
  const sleeveR = covered ? 0.012 : 0;
  const mkArm = (side) => {
    const upper = new THREE.Group(), fore = new THREE.Group(), hand = new THREE.Group();
    root.add(upper, fore, hand);
    const uaMat = covered && top !== 'tank' ? S.top : S.skin;
    const UA = { bulge: 0.14 + 0.1 * c.muscle, at: 0.42, sz: 0.92 }, FA = { bulge: 0.16 + 0.08 * c.muscle, at: 0.24, sx: 1.08, sz: 0.86 };
    M(limb(d.rUA, d.rUA * 0.8, d.upper, UA), S.skin, upper);
    if (top === 'tshirt') M(limb(d.rUA, d.rUA * 0.8, d.upper, { ...UA, to: 0.55, grow: 0.016 }), S.top, upper);
    else if (sleeved) {
      M(limb(d.rUA, d.rUA * 0.8, d.upper, { ...UA, grow: sleeveR + (top === 'jacket' ? 0.008 : 0) }), uaMat, upper);
      fold(d.rUA * 0.9 + sleeveR + 0.006, d.upper * 0.82, 0.25, S.topDark, upper, 1, 0.9);
    }
    M(ball(d.rUA * 0.84), sleeved ? S.top : S.skin, fore);
    M(limb(d.rFA, d.rFA * 0.68, d.fore, FA), S.skin, fore);
    if (sleeved) {
      if (c.sleeves === 'rolled') {
        M(limb(d.rFA, d.rFA * 0.68, d.fore, { ...FA, to: 0.32, grow: 0.012 }), S.top, fore);
        M(limb(d.rFA, d.rFA * 0.68, d.fore, { ...FA, from: 0.29, to: 0.42, grow: 0.026 }), S.topDark, fore);
        fold(d.rFA * 1.1 + 0.03, d.fore * 0.355, 0.12, S.top, fore, 1.08, 0.86);
      } else {
        M(limb(d.rFA, d.rFA * 0.68, d.fore, { ...FA, to: 0.9, grow: 0.012 }), S.top, fore);
        M(limb(d.rFA, d.rFA * 0.68, d.fore, { ...FA, from: 0.86, to: 1, grow: 0.018 }), S.topDark, fore);
        fold(d.rFA * 1.12 + 0.012, d.fore * 0.12, -0.3, S.topDark, fore, 1.08, 0.86);
        fold(d.rFA * 0.8 + 0.014, d.fore * 0.72, 0.2, S.topDark, fore, 1.08, 0.86);
      }
    }
    if (c.watch && side === 1) {
      M(limb(d.rFA * 0.7, d.rFA * 0.7, d.fore, { from: 0.82, to: 0.9, grow: 0.007, sx: 1.08, sz: 0.86 }), S.watch, fore);
      M(box(0.026, 0.026, 0.01), S.watch, fore, 0, d.fore * 0.86, d.rFA * 0.62 + 0.006);
    }
    // hand (block style, wrist at origin, fingers along +Y)
    const gl = c.gloves;
    const palmMat = gl === 'none' ? S.skin : S.glove;
    const fingMat = gl === 'full' ? S.glove : S.skin;
    const hw = d.rFA * 1.9, ht = d.rFA * 1.15;
    M(box(hw, d.hand * 0.6, ht), palmMat, hand, 0, d.hand * 0.3, 0);
    if (gl === 'fingerless') M(box(hw * 1.02, d.hand * 0.18, ht * 0.92), S.glove, hand, 0, d.hand * 0.66, 0.002);
    M(box(hw * 0.96, d.hand * 0.42, ht * 0.85), fingMat, hand, 0, d.hand * 0.82, 0.006, 0.35);
    M(box(ht * 0.55, d.hand * 0.45, ht * 0.6), palmMat, hand, side * hw * 0.45, d.hand * 0.4, ht * 0.35, 0.3, 0, -side * 0.5);
    if (gl !== 'none') M(tube(d.rFA * 0.75 + 0.008, d.rFA * 0.75 + 0.008, 0.04, 0, 1, 7), S.glove, hand, 0, -0.03, 0);
    return { upper, fore, hand, side };
  };

  // ---- legs ----
  const mkLeg = (side) => {
    const thigh = new THREE.Group(), shin = new THREE.Group(), foot = new THREE.Group();
    root.add(thigh, shin, foot);
    M(ball(d.rTh * 0.98), legsFull || c.bottom === 'shorts' ? S.pants : S.skin, thigh);
    const TH = { bulge: 0.1 + 0.06 * c.muscle, at: 0.3, sz: 1.05 }, SH = { bulge: 0.2 + 0.06 * c.muscle, at: 0.28, sz: 1.05 };
    M(limb(d.rTh, d.rTh * 0.72, d.thigh, TH), S.skin, thigh);
    const pr = baggy;
    if (legsFull) {
      M(limb(d.rTh, d.rTh * 0.72, d.thigh, { ...TH, bulge: TH.bulge * 0.5, grow: pr }), S.pants, thigh);
      fold(d.rTh * 0.8 + pr + 0.004, d.thigh * 0.86, 0.3, S.pantsDark, thigh);
    } else M(limb(d.rTh, d.rTh * 0.72, d.thigh, { ...TH, to: 0.62, grow: 0.018 }), S.pants, thigh);
    if (c.bottom === 'cargo') {
      // cargo pocket on the outside of the thigh (local -X faces the body's left for the left leg)
      const ox = -side * (d.rTh * 0.86 + pr);
      M(box(0.03, d.thigh * 0.32, d.rTh * 1.15), S.pantsDark, thigh, ox, d.thigh * 0.52, 0);
      M(box(0.034, 0.03, d.rTh * 1.2), S.pants, thigh, ox, d.thigh * 0.36, 0, 0);
    }
    M(ball(d.rTh * 0.74 + (legsFull ? pr : 0)), legsFull ? S.pants : S.skin, shin);
    M(limb(d.rSh, d.rSh * 0.62, d.shin, SH), S.skin, shin);
    if (legsFull) {
      const cuffR = c.bottom === 'joggers' ? d.rSh * 0.7 + 0.008 : d.rSh * 0.72 + pr + 0.008;
      M(limb(d.rSh + pr + 0.004, cuffR, d.shin, { bulge: SH.bulge * 0.45, at: 0.3, to: 0.88, sz: 1.05 }), S.pants, shin);
      for (let i = 0; i < (c.bottom === 'cargo' ? 3 : 1); i++) fold(lerp(d.rSh + pr, cuffR, 0.7 + i * 0.07) + 0.006, d.shin * (0.62 + i * 0.07), (i % 2 ? -0.22 : 0.18), S.pantsDark, shin);
      if (c.bottom === 'joggers') M(tube(cuffR + 0.004, cuffR + 0.004, d.shin, 0.84, 0.94), S.pantsDark, shin);
      if (c.bottom === 'cargo') M(tube(cuffR + 0.012, cuffR + 0.006, d.shin, 0.72, 0.9), S.pants, shin);
    }
    if (c.kneepads) {
      M(box(d.rSh * 1.6, 0.13, 0.04), S.knee, shin, 0, 0.035, d.rTh * 0.74 + pr + 0.012);
      M(box(d.rSh * 1.65, 0.015, 0.03), S.strap, shin, 0, 0.11, d.rTh * 0.4);
    }
    // footwear: ankle at origin, foot extends +Z; toes taper narrower and slope down
    const fw = 0.1 * d.s, a = d.ankle, boots = c.shoes === 'boots';
    const sole = boots ? 0.034 : 0.03, len = (boots ? 0.27 : 0.26) * d.s, zc = 0.065 * d.s;
    M(footGeo(fw * 1.06, sole, len + 0.012, 0.78, 0.75), S.sole, foot, 0, -a + sole / 2, zc);
    const uh = a + (boots ? 0.03 : 0.0);
    M(footGeo(fw, uh, len, 0.74, 0.3), S.shoe, foot, 0, -a + sole + uh / 2 - 0.004, zc - 0.004);
    if (boots) {
      M(tube(d.rSh * 0.72 + 0.022, d.rSh * 0.72 + 0.026, 0.14 * d.s, 0, 1, 8), S.shoe, foot, 0, -0.01, 0.0);
    }
    for (let i = 0; i < 3; i++) M(box(fw * 0.42, 0.007, 0.012), S.lace, foot, 0, -a + sole + uh * 0.82 - i * 0.012, zc + 0.02 - i * 0.03, 0.45);
    let holster = null;
    if (side === -1 && c.holster) {
      const ox = d.rTh * 0.86 + pr + 0.03;
      M(box(0.045, 0.2, 0.075), S.holster, thigh, ox, d.thigh * 0.33, 0.005);
      M(limb(d.rTh * 0.86, d.rTh * 0.84, d.thigh, { from: 0.4, to: 0.46, grow: pr + 0.008, cap: false }), S.strap, thigh);
      M(limb(d.rTh * 0.95, d.rTh * 0.9, d.thigh, { from: 0.1, to: 0.15, grow: pr + 0.006, cap: false }), S.strap, thigh);
      holster = new THREE.Group(); holster.position.set(ox + 0.004, d.thigh * 0.2, 0.0); holster.rotation.x = -Math.PI / 2; thigh.add(holster);
    }
    return { thigh, shin, foot, side, holster };
  };

  const armL = mkArm(1), armR = mkArm(-1), legL = mkLeg(1), legR = mkLeg(-1);
  const holsterSlot = c.holster ? legR.holster : null;
  const ch = {
    cfg: c, d, root, pelvis, spine, neck, head,
    armL, armR, legL, legR,
    shL, shR,
    hipL: anchor(pelvis, d.hipX, 0, 0), hipR: anchor(pelvis, -d.hipX, 0, 0),
    eye: anchor(head, 0, d.hh * 0.5, d.hd * 0.5 + 0.02),
    pouch: pouchAnchor,
    beltPouch: anchor(pelvis, d.hipW * 0.72, d.waistY - 0.03, d.hipW * d.depth * 0.45 + 0.07),
    pistolMount: anchor(spine, -0.03, d.shY - 0.07, d.front + vestT + 0.46),
    pistolLow: anchor(spine, -0.03, d.torso * 0.6, d.front + vestT + 0.2),
    holster: holsterSlot,
    mount: anchor(spine, -d.shX * 0.62, d.shY - 0.035, d.front + vestT * 0.8 + 0.02),
    lowMount: anchor(spine, -d.shX * 0.35, d.torso * 0.58, d.front + vestT + 0.1),
  };
  root.traverse((o) => { if (o.isMesh) o.userData.player = true; });
  return ch;
}

