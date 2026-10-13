// The 3D football player: a jointed skeleton dressed in real equipment, and a procedural motion
// system driven by how the player is actually moving (speed, acceleration, turning) plus the
// beat of the play (stance, throw, catch, carry, block, tackle, celebration).
//
// Units are yards (a 6'2" player is 2.06 tall). The character faces +Z in its own space.
// Joint conventions: limbs hang along -Y; flex() bends a joint forward, extend() backward.
import * as THREE from 'three';

export interface Kit { jersey: string; num: string; trim: string; pants: string; helmet: string; mask: string; socks: string; glove?: string }
export type Build = 'line' | 'big' | 'skill' | 'qb' | 'kicker' | 'ref';
export type Act = 'idle' | 'move' | 'stance3' | 'stance2' | 'stanceQB' | 'stanceRB' | 'stanceD' | 'throw' | 'catch' | 'carry' | 'block' | 'rush' | 'tackle' | 'down' | 'party' | 'kick' | 'signal';
export interface Drive {
  act: Act;
  /** World-space velocity and acceleration on the ground plane (yd/s, yd/s²). */
  vel: THREE.Vector2; acc: THREE.Vector2;
  /** Phase within a timed act, in seconds from its key moment (throw release, catch, kick, tackle). */
  beat: number;
  /** World point to look at, reach for (ball) or lean into (blocker). */
  look?: THREE.Vector3; reach?: THREE.Vector3;
  /** Direction of a fall (world, on the ground plane) and how fast he was going. */
  fallDir?: THREE.Vector2; fallSpeed?: number;
  ballHand?: 'L' | 'R';
}

// ---- shared geometry -------------------------------------------------------------------------
const lathe = (pts: [number, number][], seg = 22) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const GEO = (() => {
  const torso = lathe([[0.001, 0], [0.15, 0.01], [0.165, 0.08], [0.16, 0.18], [0.185, 0.3], [0.215, 0.42], [0.225, 0.5], [0.2, 0.56], [0.12, 0.6], [0.001, 0.61]]);
  const belly = lathe([[0.001, 0], [0.17, 0.02], [0.215, 0.14], [0.22, 0.26], [0.2, 0.38], [0.22, 0.48], [0.225, 0.54], [0.18, 0.59], [0.001, 0.61]]);
  const pelvis = lathe([[0.001, -0.02], [0.13, -0.01], [0.17, 0.06], [0.165, 0.15], [0.15, 0.2], [0.001, 0.21]]);
  const thigh = lathe([[0.001, -0.47], [0.085, -0.46], [0.095, -0.38], [0.11, -0.2], [0.115, -0.08], [0.1, 0], [0.001, 0.01]]);
  const shin = lathe([[0.001, -0.45], [0.055, -0.44], [0.06, -0.36], [0.075, -0.18], [0.072, -0.05], [0.07, 0], [0.001, 0.01]]);
  const upper = lathe([[0.001, -0.3], [0.058, -0.29], [0.068, -0.18], [0.072, -0.06], [0.07, 0], [0.001, 0.01]], 14);
  const fore = lathe([[0.001, -0.27], [0.042, -0.26], [0.05, -0.18], [0.058, -0.06], [0.055, 0], [0.001, 0.01]], 14);
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const pad = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  // Helmet: a shell with the face opening cut out of the front.
  // Crown all the way round; below the brow the front is open for the face; the jaw guards wrap low.
  const shell = new THREE.SphereGeometry(0.155, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.43);
  const shellBack = new THREE.SphereGeometry(0.155, 32, 14, Math.PI * 0.72, Math.PI * 1.56, Math.PI * 0.43, Math.PI * 0.37);
  const tube = (pts: [number, number, number][], r = 0.008) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 24, r, 6, false);
  // Facemasks in three styles: open skill-player two-bar, quarterback, and the lineman's cage.
  const bar = (y: number, d = 0.17, w = 0.13) => [[-w, y + 0.02, 0.06], [-w * 0.6, y, d - 0.02], [0, y - 0.005, d], [w * 0.6, y, d - 0.02], [w, y + 0.02, 0.06]] as [number, number, number][];
  const masks = {
    skill: [tube(bar(-0.035)), tube(bar(-0.085, 0.16, 0.12)), tube([[-0.13, -0.01, 0.07], [-0.12, -0.11, 0.1], [-0.05, -0.135, 0.13], [0.05, -0.135, 0.13], [0.12, -0.11, 0.1], [0.13, -0.01, 0.07]])],
    qb: [tube(bar(-0.03)), tube(bar(-0.075, 0.165)), tube(bar(-0.115, 0.15, 0.11)), tube([[0, -0.03, 0.172], [0, -0.13, 0.145]])],
    line: [tube(bar(-0.02)), tube(bar(-0.065, 0.172)), tube(bar(-0.11, 0.16, 0.12)), tube([[-0.035, 0.0, 0.17], [-0.03, -0.14, 0.145]]), tube([[0.035, 0.0, 0.17], [0.03, -0.14, 0.145]]), tube([[0, 0.005, 0.172], [0, -0.14, 0.15]])],
  };
  const visor = new THREE.SphereGeometry(0.158, 20, 8, Math.PI * 0.22, Math.PI * 0.56, Math.PI * 0.38, Math.PI * 0.14);
  const strap = tube([[-0.13, -0.05, 0.02], [-0.09, -0.15, 0.06], [0, -0.17, 0.09], [0.09, -0.15, 0.06], [0.13, -0.05, 0.02]], 0.012);
  const cleat = (() => { const g = new THREE.BoxGeometry(0.11, 0.06, 0.29, 2, 1, 3); const p = g.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), y = p.getY(i); p.setX(i, p.getX(i) * (z > 0.08 ? 0.75 : 1)); if (z > 0.1 && y > 0) p.setY(i, y - 0.02); } g.computeVertexNormals(); return g; })();
  const sole = new THREE.BoxGeometry(0.115, 0.02, 0.3);
  const hand = (() => { const g = new THREE.CapsuleGeometry(0.042, 0.07, 4, 8); g.scale(1, 1, 0.62); return g; })();
  const thumb = new THREE.CapsuleGeometry(0.016, 0.04, 3, 6);
  const plane = new THREE.PlaneGeometry(1, 1);
  const towel = (() => { const g = new THREE.PlaneGeometry(0.11, 0.22, 1, 4); g.translate(0, -0.11, 0); return g; })();
  return { torso, belly, pelvis, thigh, shin, upper, fore, sphere, pad, shell, shellBack, masks, visor, strap, cleat, sole, hand, thumb, plane, towel, cyl: new THREE.CylinderGeometry(1, 1, 1, 14), ring: new THREE.TorusGeometry(1, 0.25, 6, 18), belt: new THREE.TorusGeometry(1, 0.1, 6, 24), stripe: new THREE.TorusGeometry(0.1585, 0.011, 6, 28, Math.PI * 0.85) };
})();

// ---- textures --------------------------------------------------------------------------------
const texCache = new Map<string, THREE.Texture>();
function tex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  let t = texCache.get(key); if (t) return t;
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(key, t); return t;
}
/** A jersey number with its outline, on a transparent background. */
const numberTex = (n: number, fill: string, edge: string) => tex(`n${n}${fill}${edge}`, 128, 128, g => {
  g.font = '900 104px "Barlow Condensed", "Arial Narrow", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = edge; g.strokeText(String(n), 64, 70); g.fillStyle = fill; g.fillText(String(n), 64, 70);
});
/** Knit jersey: a faint mesh weave so it doesn't read as plastic. */
const knit = () => tex('knit', 64, 64, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 64; x += 4) { g.fillStyle = 'rgba(0,0,0,.09)'; g.fillRect(x, y, 2, 2); } });
const stripeTex = (a: string, b: string) => tex(`st${a}${b}`, 64, 64, g => { g.fillStyle = a; g.fillRect(0, 0, 64, 64); g.fillStyle = b; g.fillRect(0, 22, 64, 8); g.fillRect(0, 36, 64, 8); });
const refTex = () => tex('ref', 64, 64, g => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#111' : '#f4f4f4'; g.fillRect(i * 8, 0, 8, 64); } });

const lum = (h: string) => { const n = parseInt(h.replace('#', '').slice(0, 6).padEnd(6, '0'), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const throwTwist = () => (globalThis as unknown as { TW?: number }).TW ?? Math.PI / 2;

/** Skeleton handles. */
interface Bones {
  root: THREE.Group; body: THREE.Group; pelvis: THREE.Group; spine: THREE.Group; chest: THREE.Group; neck: THREE.Group; head: THREE.Group;
  shL: THREE.Group; shR: THREE.Group; elL: THREE.Group; elR: THREE.Group; haL: THREE.Group; haR: THREE.Group;
  hipL: THREE.Group; hipR: THREE.Group; knL: THREE.Group; knR: THREE.Group; anL: THREE.Group; anR: THREE.Group;
}

export class Athlete {
  b: Bones;
  private mats: Record<string, THREE.MeshStandardMaterial> = {};
  private numMats: THREE.MeshStandardMaterial[] = [];
  private masks: Record<string, THREE.Group> = {};
  private visor: THREE.Mesh; private towel: THREE.Mesh; private sleeves: THREE.Mesh[] = []; private bellyMesh: THREE.Mesh; private torsoMesh: THREE.Mesh; private wristCard: THREE.Mesh;
  private key = '';
  // Motion state.
  yaw = 0; private phase = Math.random() * 6; private lean = 0; private bank = 0; private fall = 0; private fallV = 0; private fallSlide = 0; private bob = 0;
  private fallDirW = new THREE.Vector2(0, 1); private fallStart = new THREE.Vector3();
  private headYaw = 0; private last: Act = 'idle';
  height = 2.06;

  constructor() {
    const M = (name: string, color: string, rough = 0.7, metal = 0, extra: THREE.MeshPhysicalMaterialParameters = {}) => { const m = Object.keys(extra).length ? new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: metal, ...extra }) : new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); this.mats[name] = m; return m; };
    const jersey = M('jersey', '#fff', 0.82); jersey.map = knit();
    M('pants', '#ddd', 0.55, 0, { sheen: 0.4, sheenColor: new THREE.Color('#ffffff') });
    M('helmet', '#c00', 0.18, 0.15, { clearcoat: 1, clearcoatRoughness: 0.08 });
    M('mask', '#ccc', 0.35, 0.5); M('skin', '#a46e4c', 0.62); M('socks', '#fff', 0.85); M('trim', '#fff', 0.6);
    M('glove', '#222', 0.55); M('cleat', '#111', 0.45); M('sole', '#f2f2f2', 0.6); M('sleeve', '#111', 0.7); M('pad', '#fff', 0.5); M('band', '#f4f4f4', 0.9);
    M('visor', '#111', 0.05, 0.6, { transparent: true, opacity: 0.85 }); M('eye', '#1a120c', 0.9);
    const mesh = (g: THREE.BufferGeometry, m: string | THREE.Material, parent: THREE.Object3D, p?: [number, number, number], s?: [number, number, number], r?: [number, number, number]) => {
      const x = new THREE.Mesh(g, typeof m === 'string' ? this.mats[m] : m); x.castShadow = true; x.receiveShadow = true;
      if (p) x.position.set(...p); if (s) x.scale.set(...s); if (r) x.rotation.set(...r); parent.add(x); return x;
    };
    const G = () => new THREE.Group();
    const root = G(), body = G(), pelvis = G(), spine = G(), chest = G(), neck = G(), head = G();
    root.add(body); body.add(pelvis); pelvis.position.y = 0.98; pelvis.add(spine); spine.position.y = 0.16; spine.add(chest); chest.position.y = 0.0;
    // Pelvis and pants.
    mesh(GEO.pelvis, 'pants', pelvis, [0, -0.07, 0], [1, 1, 0.8]);
    mesh(GEO.belt, 'trim', pelvis, [0, 0.12, 0], [0.163, 0.13, 0.25], [Math.PI / 2, 0, 0]);
    this.towel = mesh(GEO.towel, 'band', pelvis, [0.06, 0.1, 0.13], undefined, [0.15, 0, 0]);
    (this.mats.band as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    // Torso: the jersey over shoulder pads, with numbers front, back and on the shoulders.
    this.torsoMesh = mesh(GEO.torso, 'jersey', chest, [0, -0.05, 0], [1, 1, 0.72]);
    this.bellyMesh = mesh(GEO.belly, 'jersey', chest, [0, -0.05, 0], [1.05, 1, 0.85]); this.bellyMesh.visible = false;
    mesh(GEO.pad, 'jersey', chest, [0, 0.44, 0], [0.33, 0.16, 0.24]);
    for (const sx of [-1, 1]) mesh(GEO.pad, 'jersey', chest, [sx * 0.24, 0.47, 0], [0.13, 0.11, 0.16], [0, 0, -sx * 0.5]);
    const numMat = () => { const m = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); this.numMats.push(m); return m; };
    mesh(GEO.plane, numMat(), chest, [0, 0.27, 0.164], [0.27, 0.27, 1]);
    mesh(GEO.plane, numMat(), chest, [0, 0.27, -0.164], [0.3, 0.3, 1], [0, Math.PI, 0]);
    for (const sx of [-1, 1]) mesh(GEO.plane, numMat(), chest, [sx * 0.27, 0.5, 0], [0.1, 0.1, 1], [-Math.PI / 2 + 0.35, 0, sx * 0.9]);
    // Neck, head and helmet.
    chest.add(neck); neck.position.y = 0.55;
    mesh(GEO.cyl, 'skin', neck, [0, 0.06, 0.01], [0.062, 0.14, 0.062]);
    mesh(GEO.ring, 'jersey', neck, [0, 0.0, 0], [0.09, 0.09, 0.08], [Math.PI / 2, 0, 0]);
    neck.add(head); head.position.y = 0.17;
    mesh(GEO.sphere, 'skin', head, [0, -0.02, 0.025], [0.092, 0.115, 0.1]);            // face under the mask
    mesh(GEO.sphere, 'eye', head, [0, 0.0, 0.112], [0.07, 0.018, 0.012]);                 // eye shadow under the brow
    const helmet = G(); head.add(helmet); helmet.position.set(0, 0.035, -0.01);
    mesh(GEO.shell, 'helmet', helmet, undefined, [1, 1.02, 1.12]); mesh(GEO.shellBack, 'helmet', helmet, undefined, [1, 1.02, 1.12]);
    mesh(GEO.stripe, 'trim', helmet, undefined, [1, 1.02, 1.12], [0, Math.PI / 2, 0]);           // center stripe, crown to neck
    for (const sx of [-1, 1]) { mesh(GEO.cyl, 'mask', helmet, [sx * 0.152, -0.02, 0.02], [0.022, 0.012, 0.022], [0, 0, Math.PI / 2]); mesh(GEO.sphere, 'trim', helmet, [sx * 0.157, 0.04, -0.02], [0.004, 0.05, 0.05]); }
    for (const [k, list] of Object.entries(GEO.masks)) { const g = G(); for (const t of list) mesh(t, 'mask', g); helmet.add(g); this.masks[k] = g; g.visible = false; }
    mesh(GEO.strap, 'mask', helmet);
    this.visor = mesh(GEO.visor, 'visor', helmet, undefined, [1.0, 1.0, 1.1]); this.visor.visible = false;
    // Arms.
    const arm = (sx: number) => {
      const sh = G(); chest.add(sh); sh.position.set(sx * 0.255, 0.43, 0);
      mesh(GEO.sphere, 'jersey', sh, [0, -0.02, 0], [0.085, 0.085, 0.085]);
      const slv = mesh(GEO.upper, 'jersey', sh, [0, -0.02, 0], [1.18, 0.45, 1.18]); this.sleeves.push(slv);
      mesh(GEO.upper, 'skin', sh, [0, -0.02, 0]);
      mesh(GEO.upper, 'sleeve', sh, [0, -0.13, 0], [1.03, 0.6, 1.03]).name = 'armsleeve';
      const el = G(); sh.add(el); el.position.y = -0.31;
      mesh(GEO.fore, 'skin', el);
      mesh(GEO.fore, 'sleeve', el, undefined, [1.04, 0.85, 1.04]).name = 'armsleeve';
      mesh(GEO.cyl, 'band', el, [0, -0.23, 0], [0.05, 0.05, 0.05]);
      const ha = G(); el.add(ha); ha.position.y = -0.27;
      mesh(GEO.hand, 'glove', ha, [0, -0.06, 0.008]);
      mesh(GEO.thumb, 'glove', ha, [-sx * 0.035, -0.04, 0.03], undefined, [0.4, 0, sx * 0.6]);
      return { sh, el, ha };
    };
    const L = arm(-1), R = arm(1);
    this.wristCard = mesh(new THREE.BoxGeometry(0.08, 0.012, 0.1), 'band', L.el, [0, -0.17, 0.05]); this.wristCard.visible = false;
    // Legs.
    const leg = (sx: number) => {
      const hip = G(); pelvis.add(hip); hip.position.set(sx * 0.1, 0, 0);
      mesh(GEO.thigh, 'pants', hip);
      mesh(GEO.plane, 'trim', hip, [sx * 0.112, -0.22, 0], [0.025, 0.42, 1], [0, sx * Math.PI / 2, 0]);    // pant stripe
      mesh(GEO.sphere, 'pants', hip, [0, -0.43, 0.06], [0.08, 0.075, 0.05]);                               // knee pad
      const kn = G(); hip.add(kn); kn.position.y = -0.47;
      mesh(GEO.shin, 'socks', kn);
      const an = G(); kn.add(an); an.position.y = -0.45;
      mesh(GEO.cleat, 'cleat', an, [0, -0.02, 0.065]); mesh(GEO.sole, 'sole', an, [0, -0.055, 0.065]);
      return { hip, kn, an };
    };
    const LL = leg(-1), RL = leg(1);
    this.b = { root, body, pelvis, spine, chest, neck, head, shL: L.sh, shR: R.sh, elL: L.el, elR: R.el, haL: L.ha, haR: R.ha, hipL: LL.hip, hipR: RL.hip, knL: LL.kn, knR: RL.kn, anL: LL.an, anR: RL.an };
  }

  /** Dress and size him: kit colours, number, skin, build, height and weight, accessories. */
  dress(kit: Kit, num: number, skin: string, build: Build, ht: number, wt: number, seed: number) {
    const key = `${kit.jersey}|${kit.helmet}|${kit.pants}|${num}|${skin}|${build}|${ht}|${wt}`;
    if (this.key === key) return; this.key = key;
    const m = this.mats;
    if (build === 'ref') { m.jersey.map = refTex(); m.jersey.color.set('#ffffff'); }
    else { m.jersey.map = knit(); m.jersey.color.set(kit.jersey); }
    m.jersey.needsUpdate = true;
    m.pants.color.set(build === 'ref' ? '#f2f2f2' : kit.pants); m.helmet.color.set(build === 'ref' ? '#111111' : kit.helmet); m.mask.color.set(kit.mask);
    m.skin.color.set(skin); m.trim.color.set(build === 'ref' ? '#111111' : kit.trim);
    m.socks.color.set(build === 'ref' ? '#111111' : '#ffffff'); m.socks.map = build === 'ref' ? null : stripeTex(kit.socks, kit.trim); m.socks.needsUpdate = true;
    const glove = kit.glove ?? (lum(kit.jersey) > 200 ? kit.trim : seed % 3 === 0 ? '#f2f2f2' : kit.jersey);
    m.glove.color.set(build === 'line' || build === 'big' ? (seed % 2 ? '#1a1a1a' : glove) : glove);
    m.cleat.color.set(seed % 4 === 0 ? '#f2f2f2' : seed % 4 === 1 ? kit.trim : '#151515');
    const sleeveOn = build === 'skill' && seed % 3 !== 0 || build === 'qb' && seed % 2 === 0;
    m.sleeve.color.set(seed % 2 ? '#111111' : '#f2f2f2');
    this.b.root.traverse(o => { if (o.name === 'armsleeve') o.visible = sleeveOn; });
    for (const nm of this.numMats) { nm.map = build === 'ref' ? null : numberTex(num, kit.num, kit.trim); nm.visible = build !== 'ref'; nm.opacity = build === 'ref' ? 0 : 1; nm.needsUpdate = true; }
    // Facemask and visor by position; towels on skill players; a wrist play card on quarterbacks.
    for (const [k, g] of Object.entries(this.masks)) g.visible = k === (build === 'line' || build === 'big' ? 'line' : build === 'qb' ? 'qb' : 'skill');
    this.visor.visible = build === 'skill' && seed % 4 === 1;
    this.towel.visible = (build === 'skill' || build === 'qb') && seed % 3 !== 2;
    this.wristCard.visible = build === 'qb';
    // Body: height from the roster, width from weight (a 320 lb tackle is a different shape from a 185 lb corner).
    this.height = ht / 36;
    const sH = ht / 74, bulk = clamp((wt - 190) / 140, -0.25, 1);
    const w = 1 + bulk * 0.32;
    this.b.body.scale.set(w * (build === 'ref' ? 0.95 : 1), sH, w * (1 + bulk * 0.08));
    this.bellyMesh.visible = bulk > 0.55; this.torsoMesh.visible = !this.bellyMesh.visible;
    // Pads are smaller on kickers and officials.
    this.b.head.scale.set(1 / w, 1 / sH * 1.0, 1 / (w * (1 + bulk * 0.08)));
    this.b.neck.scale.set(Math.min(1.25, 1 + bulk * 0.2), 1, Math.min(1.25, 1 + bulk * 0.2));
  }

  /** One frame of motion. */
  update(d: Drive, dt: number, now: number) {
    const b = this.b, speed = d.vel.length();
    // Velocity in his own frame: forward along facing, lateral to his right.
    const fwd = new THREE.Vector2(Math.sin(this.yaw), Math.cos(this.yaw));
    const right = new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw));
    const vf = d.vel.dot(fwd), vs = d.vel.dot(right);
    const af = d.acc.dot(fwd), as = d.acc.dot(right);
    // Lean: into acceleration, forward with speed, banking into turns (centripetal = lateral accel).
    const wantLean = clamp(0.05 + Math.max(0, vf) * 0.028 + af * 0.025 - Math.max(0, -vf) * 0.02, -0.25, 0.55);
    const wantBank = clamp(-as * 0.035, -0.35, 0.35);
    this.lean = damp(this.lean, wantLean, 8, dt); this.bank = damp(this.bank, wantBank, 8, dt);
    // Gait: the step cycle advances with distance covered, so feet don't skate.
    const stride = 0.75 + speed * 0.13;                       // yards per step pair, longer at full speed
    const moving = speed > 0.35;
    this.phase += (moving ? speed / stride : 0) * Math.PI * dt * (d.act === 'block' || d.act === 'rush' ? 2.4 : 1);
    if (d.act === 'block' || d.act === 'rush') this.phase += dt * 9;   // choppy feet while engaged
    const amp = clamp(speed / 8.5, 0, 1), sp = Math.sin(this.phase), cp = Math.cos(this.phase);
    const back = vf < -0.8 && Math.abs(vf) > Math.abs(vs);               // backpedal
    const side = Math.abs(vs) > Math.abs(vf) * 1.3 && speed > 0.8 && speed < 6;   // shuffle

    // Pose targets (radians): hips/knees/ankles, spine, shoulders/elbows.
    let hL = 0, hR = 0, kL = 0.08, kR = 0.08, aL = 0, aR = 0, spinePitch = this.lean, spineTwist = 0, pelvisY = 0;
    let sL = 0.05, sR = 0.05, eL = 0.25, eR = 0.25, abL = 0.12, abR = 0.12, legSpread = 0, bob = 0;
    if (moving && !back && !side) {
      hL = sp * 0.95 * amp + 0.1; hR = -sp * 0.95 * amp + 0.1;
      kL = 0.2 + Math.max(0, -cp) * 1.5 * amp + Math.max(0, sp) * 0.3 * amp; kR = 0.2 + Math.max(0, cp) * 1.5 * amp + Math.max(0, -sp) * 0.3 * amp;
      aL = -Math.max(0, cp) * 0.5 * amp; aR = -Math.max(0, -cp) * 0.5 * amp;
      sL = -sp * 1.0 * amp; sR = sp * 1.0 * amp; eL = eR = 0.5 + amp * 0.9;
      spineTwist = sp * 0.16 * amp; bob = Math.abs(cp) * 0.06 * amp - 0.03 * amp;
    } else if (back) {
      const a2 = clamp(-vf / 6, 0, 1);
      hL = -sp * 0.55 * a2 + 0.35; hR = sp * 0.55 * a2 + 0.35; kL = 0.6 + Math.max(0, sp) * 0.7 * a2; kR = 0.6 + Math.max(0, -sp) * 0.7 * a2;
      spinePitch = 0.25; sL = sR = 0.35; eL = eR = 1.2; pelvisY = -0.1; bob = Math.abs(cp) * 0.03;
    } else if (side) {
      legSpread = 0.18 + Math.abs(sp) * 0.25; kL = kR = 0.6; hL = hR = 0.4; spinePitch = 0.3; sL = sR = 0.4; eL = eR = 1.1; pelvisY = -0.1; bob = Math.abs(sp) * 0.04;
    } else {
      hL = hR = 0.05; kL = kR = 0.1; sL = sR = 0.08; eL = eR = 0.3;
    }
    let headPitch = 0;
    const t = d.beat;
    switch (d.act) {
      case 'stance3': spinePitch = 1.3; hL = 1.6; hR = 1.3; kL = 1.85; kR = 1.5; aL = 0.2; pelvisY = -0.42; sR = 1.4; eR = 0.0; sL = 0.6; eL = 1.6; headPitch = -1.0; bob = 0; break;
      case 'stance2': spinePitch = 0.45; hL = 0.75; hR = 0.15; kL = 0.9; kR = 0.45; pelvisY = -0.12; sL = 0.5; sR = -0.2; eL = eR = 1.1; headPitch = -0.3; break;
      case 'stanceQB': spinePitch = 0.3; hL = hR = 0.5; kL = kR = 0.65; legSpread = 0.12; pelvisY = -0.12; sL = sR = 0.75; eL = eR = 1.2; headPitch = -0.2; break;
      case 'stanceRB': spinePitch = 0.6; hL = hR = 0.75; kL = kR = 0.85; legSpread = 0.14; pelvisY = -0.18; sL = sR = 0.75; eL = eR = 0.45; headPitch = -0.45; break;
      case 'stanceD': spinePitch = 0.45; hL = hR = 0.6; kL = kR = 0.8; legSpread = 0.15; pelvisY = -0.15; sL = sR = 0.55; eL = eR = 1.0; headPitch = -0.35; break;
      case 'throw': {
        // Wind-up 0.45s before release, release at 0, follow-through after: the chest coils and fires.
        const k = clamp((t + 0.45) / 0.45, 0, 1), f = clamp(t / 0.3, 0, 1);
        if (t < 0) { sR = 0.4 - k * 2.6; eR = 1.3 + k * 0.6; abR = 0.9; spineTwist = k * 0.75; sL = 0.9; eL = 0.9; abL = 0.2; hL = 0.35 * k; kL = 0.25; hR = -0.1; kR = 0.45; spinePitch = -0.08; }
        else { sR = -2.2 + f * 3.3; eR = 1.9 - f * 1.7; abR = 0.9 - f * 0.6; spineTwist = 0.75 - f * 1.25; sL = 0.4 - f * 0.6; eL = 1.2; hL = 0.45; kL = 0.35; hR = -0.2 - f * 0.3; kR = 0.35 + f * 0.6; spinePitch = 0.1 + f * 0.35; }
        break;
      }
      case 'catch': sL = sR = t < 0 ? 2.4 + clamp(-t, 0, 0.3) * 0.5 : 1.3; eL = eR = t < 0 ? 0.35 : 1.6; abL = abR = 0.05; headPitch = t < 0 ? -0.15 : -0.4; break;
      case 'carry': if (d.ballHand === 'L') { sL = 0.35; eL = 2.2; abL = 0.05; } else { sR = 0.35; eR = 2.2; abR = 0.05; } spinePitch += 0.1; break;
      case 'block': spinePitch = 0.5; sL = sR = 1.35; eL = eR = 0.55; abL = abR = 0.2; pelvisY = -0.12; hL = hL * 0.35 + 0.55; hR = hR * 0.35 + 0.45; kL = kL * 0.4 + 0.75; kR = kR * 0.4 + 0.7; break;
      case 'rush': spinePitch = 0.65; sL = 1.5 + Math.sin(now / 110) * 0.3; sR = 0.9 - Math.sin(now / 110) * 0.3; eL = 0.4; eR = 0.9; pelvisY = -0.1; hL = hL * 0.5 + 0.5; hR = hR * 0.5 + 0.4; kL = kL * 0.5 + 0.7; kR = kR * 0.5 + 0.7; break;
      case 'tackle': sL = sR = 1.7; eL = eR = 0.9; abL = abR = 0.45; spinePitch = 0.9; break;
      case 'down': sL = 2.2; sR = 0.4; eL = 0.6; eR = 0.8; hL = 0.2; hR = -0.1; kL = 0.6; kR = 0.2; spinePitch = 0.1; break;
      case 'party': { const j = Math.abs(Math.sin(now / 150)); sL = sR = 2.9; eL = eR = 0.3; abL = abR = 0.5; bob = j * 0.35; kL = kR = 0.4 * (1 - j); hL = hR = 0.3 * (1 - j); spinePitch = -0.1; break; }
      case 'kick': {
        const k = clamp((t + 0.35) / 0.35, 0, 1), f = clamp(t / 0.25, 0, 1);
        if (t < 0) { hR = -0.9 * k; kR = 1.3 * k; hL = 0.2; kL = 0.35; sL = 0.6; abL = 0.9; sR = -0.4; spinePitch = -0.05; }
        else { hR = -0.9 + f * 2.5; kR = 1.3 - f * 1.3; hL = 0.1; kL = 0.2; sL = 0.2; abL = 1.1; sR = 0.5; spinePitch = -0.2; bob = f * 0.08; }
        break;
      }
      case 'signal': sL = sR = Math.PI - 0.1; eL = eR = 0.05; abL = abR = 0.15; break;
    }

    // Reach: catch hands go to the ball (simple two-bone aim in the chest frame).
    // Applied below after the pose blend; store desired.
    const kBlend = 1 - Math.exp(-dt * 16);
    const set = (o: THREE.Object3D, v: number) => { o.rotation.x += (-v - o.rotation.x) * kBlend; };
    const setK = (o: THREE.Object3D, v: number) => { o.rotation.x += (v - o.rotation.x) * kBlend; };
    set(b.hipL, hL); set(b.hipR, hR); setK(b.knL, kL); setK(b.knR, kR); set(b.anL, aL - 0.1); set(b.anR, aR - 0.1);
    b.hipL.rotation.z = damp(b.hipL.rotation.z, -legSpread, 12, dt); b.hipR.rotation.z = damp(b.hipR.rotation.z, legSpread, 12, dt);
    set(b.shL, sL); set(b.shR, sR); set(b.elL, eL); set(b.elR, eR);
    b.shL.rotation.z = damp(b.shL.rotation.z, -abL, 12, dt); b.shR.rotation.z = damp(b.shR.rotation.z, abR, 12, dt);
    b.spine.rotation.x = damp(b.spine.rotation.x, spinePitch * 0.55, 10, dt); b.chest.rotation.x = damp(b.chest.rotation.x, spinePitch * 0.45, 10, dt);
    b.spine.rotation.y = damp(b.spine.rotation.y, spineTwist * 0.5, 12, dt); b.chest.rotation.y = damp(b.chest.rotation.y, spineTwist * 0.5, 12, dt);
    b.pelvis.rotation.y = damp(b.pelvis.rotation.y, -spineTwist * 0.35, 12, dt);
    b.pelvis.rotation.z = damp(b.pelvis.rotation.z, this.bank * 0.4, 8, dt);
    this.bob = damp(this.bob, bob + pelvisY, 14, dt);
    // Keep the planted foot on the turf: lower the pelvis by how much the legs are folded.
    const legDrop = (l: number, k: number) => 0.47 * (1 - Math.cos(l)) * 0.6 + 0.45 * (1 - Math.cos(k)) * 0.5;
    const drop = Math.min(legDrop(hL, kL), legDrop(hR, kR)) * (d.act === 'stance3' ? 0.4 : 1);
    b.pelvis.position.y = 0.98 + this.bob - drop * 0.55;
    // Head: turns toward what he's watching, within what a neck can do.
    let wantHead = 0;
    if (d.look) { const lw = new THREE.Vector2(d.look.x - b.root.position.x, d.look.z - b.root.position.z); const ang = Math.atan2(lw.x, lw.y) - this.yaw; wantHead = clamp(Math.atan2(Math.sin(ang), Math.cos(ang)), -1.1, 1.1); }
    this.headYaw = damp(this.headYaw, wantHead, 10, dt);
    b.neck.rotation.y = this.headYaw * 0.6 - b.chest.rotation.y; b.head.rotation.x = damp(b.head.rotation.x, headPitch * 0.6 - spinePitch * 0.2, 10, dt);

    // The throwing arm, set directly: upper arm out and back at shoulder height with the elbow
    // hinge turned vertical so the forearm stands up by the ear, then whipped over the top.
    if (d.act === 'throw') {
      const k = clamp((t + 0.45) / 0.45, 0, 1), f = clamp(t / 0.22, 0, 1);
      const cock = new THREE.Vector3(0.85, 0.25, -0.45).normalize(), rel = new THREE.Vector3(0.35, 0.55, 0.75).normalize(), rest = new THREE.Vector3(0.25, -0.9, 0.3).normalize();
      const dirA = t < 0 ? rest.clone().lerp(cock, k).normalize() : f < 0.6 ? cock.clone().lerp(rel, f / 0.6).normalize() : rel.clone().lerp(new THREE.Vector3(-0.3, -0.6, 0.75).normalize(), (f - 0.6) / 0.4).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirA).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), throwTwist()));
      b.shR.quaternion.slerp(q, 1 - Math.exp(-dt * 30));
      b.elR.rotation.x = damp(b.elR.rotation.x, t < 0 ? -1.75 * k : -1.75 * (1 - f), 30, dt);
    }
    // Reaching for the ball: aim both arms at it.
    if (d.reach && (d.act === 'catch' || d.act === 'tackle')) {
      b.root.updateMatrixWorld(true);
      for (const [sh, el] of [[b.shL, b.elL], [b.shR, b.elR]] as const) {
        const local = sh.parent!.worldToLocal(d.reach.clone());
        const dir = local.sub(sh.position).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
        sh.quaternion.slerp(q, 0.75); el.rotation.x = damp(el.rotation.x, -0.25, 16, dt);
      }
    }

    // Falling: a rigid topple about the feet with gravity (θ'' = g/L·sinθ), a short slide on the turf,
    // and a settle when he lands.
    const falling = d.act === 'down' || d.act === 'tackle';
    if (falling) {
      if (this.last !== 'down' && this.last !== 'tackle') {
        this.fall = 0.08; this.fallV = 0.6 + (d.fallSpeed ?? 3) * 0.32;
        if (d.fallDir && d.fallDir.lengthSq() > 0.01) this.fallDirW.copy(d.fallDir).normalize(); else this.fallDirW.copy(fwd);
        this.fallSlide = 0; this.fallStart.copy(b.root.position);
      }
      const limit = d.act === 'tackle' ? 1.35 : 1.52;
      if (this.fall < limit) { this.fallV += (9.8 / 1.1) * Math.sin(this.fall) * dt; this.fall += this.fallV * dt; if (this.fall >= limit) { this.fall = limit; this.fallV = -this.fallV * 0.18; } }
      else { this.fall = Math.max(limit - 0.05, this.fall + this.fallV * dt); this.fallV = damp(this.fallV, 0, 6, dt); }
      this.fallSlide = damp(this.fallSlide, Math.min(1.2, (d.fallSpeed ?? 3) * 0.16), 3, dt);
    } else { this.fall = damp(this.fall, 0, 6, dt); this.fallSlide = damp(this.fallSlide, 0, 6, dt); }
    this.last = d.act;
    // Root: facing, then the topple around the axis perpendicular to the fall.
    b.root.rotation.set(0, 0, 0);
    b.root.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    if (this.fall > 0.01) {
      const axis = new THREE.Vector3(this.fallDirW.y, 0, -this.fallDirW.x);   // world axis perpendicular to the fall
      const q = new THREE.Quaternion().setFromAxisAngle(axis, this.fall);
      b.root.quaternion.premultiply(q);
      b.root.position.x += this.fallDirW.x * this.fallSlide; b.root.position.z += this.fallDirW.y * this.fallSlide;
    }
    // Lean the whole body for banked turns while running.
    b.body.rotation.z = damp(b.body.rotation.z, moving ? this.bank * 0.6 : 0, 8, dt);
  }

  /** World position of the hand carrying the ball. */
  handWorld(side: 'L' | 'R', out: THREE.Vector3) { const h = side === 'L' ? this.b.haL : this.b.haR; h.updateWorldMatrix(true, false); return out.setFromMatrixPosition(h.matrixWorld); }
  /** World position between the hands (for a ball being caught or secured with two hands). */
  handsWorld(out: THREE.Vector3) { const a = new THREE.Vector3(), c = new THREE.Vector3(); this.handWorld('L', a); this.handWorld('R', c); return out.copy(a).add(c).multiplyScalar(0.5); }
  /** Forearm direction of a hand (to lay the ball along it). */
  forearmQuat(side: 'L' | 'R', out: THREE.Quaternion) { const e = side === 'L' ? this.b.elL : this.b.elR; e.updateWorldMatrix(true, false); return e.getWorldQuaternion(out); }
}
