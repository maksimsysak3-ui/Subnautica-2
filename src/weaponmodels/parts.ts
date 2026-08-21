/**
 * Weapon part library.
 *
 * OWNED BY: Weapon models.
 *
 * Reusable, parameterised sub-assemblies. Each function appends geometry to a
 * builder and returns nothing; the assembler in weapon-mesh.ts composes them.
 *
 * The detail budget goes where the eye goes. In a first-person view you spend
 * the whole game looking at the **left side of the receiver, the top rail and
 * the handguard** — so those get chamfers, cutouts, slots and hardware, while
 * the underside of the stock gets a box. Detail on surfaces the player never
 * sees is triangles spent on nothing.
 */

import * as THREE from 'three';

export type MatKey =
  | 'parkerised' | 'blued' | 'alu' | 'aluDark' | 'polymerBlack' | 'polymerFde'
  | 'polymerOlive' | 'wood' | 'woodDark' | 'glass' | 'reticle' | 'rubber' | 'brass'
  | 'glove' | 'gloveTan' | 'sleeve' | 'skin';

export const MATERIALS: Record<MatKey, THREE.Material> = {
  // Slightly lifted from true black: a real parkerised finish still shows its
  // form, and pure 0x1a reads as a silhouette with no surface at all.
  parkerised:   new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.68, metalness: 0.70, flatShading: true }),
  blued:        new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.34, metalness: 0.88, flatShading: true }),
  alu:          new THREE.MeshStandardMaterial({ color: 0x5c6067, roughness: 0.42, metalness: 0.82, flatShading: true }),
  aluDark:      new THREE.MeshStandardMaterial({ color: 0x44484e, roughness: 0.50, metalness: 0.78, flatShading: true }),
  polymerBlack: new THREE.MeshStandardMaterial({ color: 0x33363a, roughness: 0.88, metalness: 0.03, flatShading: true }),
  polymerFde:   new THREE.MeshStandardMaterial({ color: 0x9a8a6c, roughness: 0.90, metalness: 0.02, flatShading: true }),
  polymerOlive: new THREE.MeshStandardMaterial({ color: 0x59604c, roughness: 0.90, metalness: 0.02, flatShading: true }),
  wood:         new THREE.MeshStandardMaterial({ color: 0x7d5636, roughness: 0.74, metalness: 0.02, flatShading: true }),
  woodDark:     new THREE.MeshStandardMaterial({ color: 0x5d3d24, roughness: 0.78, metalness: 0.02, flatShading: true }),
  glass:        new THREE.MeshStandardMaterial({ color: 0x2a4a5c, roughness: 0.06, metalness: 0.30, transparent: true, opacity: 0.62 }),
  reticle:      new THREE.MeshBasicMaterial({ color: 0xff4433, toneMapped: false }),
  rubber:       new THREE.MeshStandardMaterial({ color: 0x26282b, roughness: 0.96, metalness: 0.0, flatShading: true }),
  brass:        new THREE.MeshStandardMaterial({ color: 0xb08d4a, roughness: 0.35, metalness: 0.85, flatShading: true }),
  // Hands. Kept a touch lighter and much rougher than the weapon so they
  // separate from it in silhouette instead of merging into one dark mass —
  // which is what happens when gloves and receiver share a value.
  glove:        new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.94, metalness: 0.0, flatShading: true }),
  gloveTan:     new THREE.MeshStandardMaterial({ color: 0x8a7a5e, roughness: 0.94, metalness: 0.0, flatShading: true }),
  sleeve:       new THREE.MeshStandardMaterial({ color: 0x5b6152, roughness: 0.97, metalness: 0.0, flatShading: true }),
  skin:         new THREE.MeshStandardMaterial({ color: 0xa87d5e, roughness: 0.72, metalness: 0.0, flatShading: true }),
};

// --- geometry caches -------------------------------------------------------
const boxCache = new Map<string, THREE.BoxGeometry>();
const cylCache = new Map<string, THREE.CylinderGeometry>();

export function boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
  const k = `${w.toFixed(4)},${h.toFixed(4)},${d.toFixed(4)}`;
  let g = boxCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); boxCache.set(k, g); }
  return g;
}

/** Cylinder lying along -Z (forward). */
export function cylGeo(r: number, len: number, seg = 10): THREE.CylinderGeometry {
  const k = `${r.toFixed(4)},${len.toFixed(4)},${seg}`;
  let g = cylCache.get(k);
  if (!g) {
    g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateX(Math.PI / 2);
    cylCache.set(k, g);
  }
  return g;
}

/** Tapered cylinder along -Z, for muzzle crowns and barrel steps. */
export function taperGeo(r0: number, r1: number, len: number, seg = 10): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

export class PartBuilder {
  readonly group = new THREE.Group();
  triangles = 0;

  add(geo: THREE.BufferGeometry, mat: MatKey, x: number, y: number, z: number,
      rx = 0, ry = 0, rz = 0): THREE.Mesh {
    const m = new THREE.Mesh(geo, MATERIALS[mat]);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    this.group.add(m);
    const idx = geo.getIndex();
    this.triangles += idx ? idx.count / 3 : geo.attributes.position.count / 3;
    return m;
  }

  box(w: number, h: number, d: number, mat: MatKey, x: number, y: number, z: number,
      rx = 0, ry = 0, rz = 0): THREE.Mesh {
    return this.add(boxGeo(w, h, d), mat, x, y, z, rx, ry, rz);
  }

  cyl(r: number, len: number, mat: MatKey, x: number, y: number, z: number,
      seg = 10, rx = 0, ry = 0, rz = 0): THREE.Mesh {
    return this.add(cylGeo(r, len, seg), mat, x, y, z, rx, ry, rz);
  }
}

// ===========================================================================
// Sub-assemblies
// ===========================================================================

/**
 * Picatinny-style rail: a base with evenly spaced recoil slots. The slots are
 * the single most recognisable piece of small-arms detail, and they cost four
 * triangles each.
 */
export function rail(b: PartBuilder, x: number, y: number, z: number, length: number, width = 0.021): void {
  b.box(width, 0.006, length, 'aluDark', x, y, z);
  const slots = Math.max(3, Math.round(length / 0.0102));
  const pitch = length / slots;
  for (let i = 0; i < slots; i++) {
    const sz = z - length / 2 + pitch * (i + 0.5);
    b.box(width * 1.06, 0.0052, pitch * 0.42, 'alu', x, y + 0.0045, sz);
  }
}

/** M-LOK style slot row along one face of a handguard. */
export function mlokRow(b: PartBuilder, x: number, y: number, z0: number, z1: number,
                        mat: MatKey, axis: 'x' | 'y'): void {
  const len = Math.abs(z1 - z0);
  const n = Math.max(2, Math.floor(len / 0.038));
  for (let i = 0; i < n; i++) {
    const sz = Math.min(z0, z1) + (i + 0.5) * (len / n);
    if (axis === 'y') b.box(0.010, 0.004, 0.024, mat, x, y, sz);
    else b.box(0.004, 0.010, 0.024, mat, x, y, sz);
  }
}

/** Pistol grip with finger grooves and a palm swell. */
export function pistolGrip(b: PartBuilder, x: number, y: number, z: number, mat: MatKey, rake = 0.30): void {
  const g = new THREE.Group();
  const sub = new PartBuilder();
  sub.box(0.034, 0.108, 0.046, mat, 0, -0.050, 0.004);
  // Palm swell.
  sub.box(0.039, 0.052, 0.040, mat, 0, -0.038, 0.006);
  // Finger grooves — three shallow steps down the front strap.
  for (let i = 0; i < 3; i++) {
    sub.box(0.036, 0.007, 0.008, mat, 0, -0.030 - i * 0.022, -0.019);
  }
  // Beavertail into the receiver.
  sub.box(0.032, 0.020, 0.030, mat, 0, 0.002, 0.020);
  // Baseplate.
  sub.box(0.036, 0.008, 0.044, 'polymerBlack', 0, -0.104, 0.004);
  g.add(sub.group);
  g.position.set(x, y, z);
  g.rotation.x = rake;
  b.group.add(g);
  b.triangles += sub.triangles;
}

/** STANAG-pattern box magazine with taper, witness holes and a floorplate. */
export function boxMagazine(b: PartBuilder, x: number, y: number, z: number,
                            length: number, curve: number, mat: MatKey): void {
  const g = new THREE.Group();
  const sub = new PartBuilder();
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const segLen = length / segs;
    // A curved magazine is a stack of short segments each rotated a little —
    // that curve is most of what identifies an eastern-pattern rifle.
    const sy = -segLen * (i + 0.5);
    const sz = curve * length * t * t * 0.5;
    sub.box(0.026, segLen * 1.02, 0.046 - t * 0.004, mat, 0, sy, sz, -curve * t * 0.6);
  }
  // Witness holes down the side.
  for (let i = 0; i < 4; i++) {
    sub.box(0.028, 0.005, 0.006, 'polymerBlack', 0, -0.022 - i * 0.026, 0.004 + curve * 0.02 * i);
  }
  // Floorplate.
  sub.box(0.030, 0.010, 0.050, 'polymerBlack', 0, -length - 0.004, curve * length * 0.5);
  g.add(sub.group);
  g.position.set(x, y, z);
  b.group.add(g);
  b.triangles += sub.triangles;
}

/** Collapsible stock: buffer tube, adjustment notches, cheek plate, butt pad. */
export function collapsibleStock(b: PartBuilder, x: number, y: number, z: number,
                                 length: number, mat: MatKey): void {
  b.cyl(0.0165, length * 0.92, 'parkerised', x, y, z + length * 0.42, 10);
  // Adjustment notches along the underside of the tube.
  const n = 6;
  for (let i = 0; i < n; i++) {
    b.box(0.020, 0.005, 0.008, 'aluDark', x, y - 0.017, z + 0.03 + i * (length * 0.13));
  }
  // Slider body.
  b.box(0.040, 0.058, 0.070, mat, x, y - 0.004, z + length * 0.62);
  // Cheek rest.
  b.box(0.034, 0.026, 0.088, mat, x, y + 0.032, z + length * 0.60);
  // Butt pad, rubber and slightly proud.
  b.box(0.044, 0.094, 0.018, 'rubber', x, y - 0.012, z + length * 0.86);
  // Sling loop.
  b.box(0.006, 0.020, 0.006, 'aluDark', x + 0.020, y - 0.030, z + length * 0.72);
}

/** Fixed rifle stock — one solid piece with a comb and a butt plate. */
export function fixedStock(b: PartBuilder, x: number, y: number, z: number,
                           length: number, mat: MatKey): void {
  b.box(0.040, 0.070, length * 0.75, mat, x, y - 0.010, z + length * 0.40, -0.05);
  b.box(0.036, 0.030, length * 0.50, mat, x, y + 0.034, z + length * 0.34);
  b.box(0.046, 0.104, 0.018, 'rubber', x, y - 0.020, z + length * 0.80);
  b.box(0.006, 0.018, 0.006, 'aluDark', x + 0.021, y - 0.044, z + length * 0.60);
}

/** Red-dot / holographic sight: hood, window, mount, adjustment turrets. */
export function redDot(b: PartBuilder, x: number, y: number, z: number, holo: boolean): number {
  const mountH = 0.030;
  b.box(0.026, mountH, 0.030, 'aluDark', x, y + mountH / 2, z);
  // Throw lever.
  b.box(0.034, 0.010, 0.014, 'alu', x - 0.006, y + 0.008, z + 0.010);

  const bodyH = holo ? 0.040 : 0.034;
  const bodyW = holo ? 0.036 : 0.028;
  const cy = y + mountH + bodyH / 2;

  // Hood: two uprights and a top bridge, leaving an open window. Modelling the
  // window as a gap rather than a dark face is what makes it read as a sight.
  b.box(0.004, bodyH, 0.044, 'parkerised', x - bodyW / 2, cy, z);
  b.box(0.004, bodyH, 0.044, 'parkerised', x + bodyW / 2, cy, z);
  b.box(bodyW + 0.004, 0.005, 0.044, 'parkerised', x, cy + bodyH / 2, z);
  b.box(bodyW + 0.004, 0.005, 0.044, 'parkerised', x, cy - bodyH / 2, z);
  // Glass in the window.
  b.box(bodyW - 0.004, bodyH - 0.006, 0.002, 'glass', x, cy, z - 0.014);
  // Emitter housing at the rear.
  b.box(bodyW - 0.006, 0.014, 0.014, 'parkerised', x, cy - bodyH / 2 + 0.010, z + 0.026);
  // Turrets.
  b.cyl(0.007, 0.012, 'alu', x + bodyW / 2 + 0.004, cy, z + 0.006, 8, 0, Math.PI / 2, 0);
  b.cyl(0.007, 0.012, 'alu', x, cy + bodyH / 2 + 0.005, z + 0.006, 8, Math.PI / 2, 0, 0);
  // The dot.
  b.box(0.0022, 0.0022, 0.001, 'reticle', x, cy, z - 0.013);
  return cy;
}

/** Magnified optic: tube, bells, turrets, throw lever, killflash. */
export function scope(b: PartBuilder, x: number, y: number, z: number, magnification: number): number {
  const big = magnification > 6;
  const tubeR = big ? 0.0155 : 0.0135;
  const tubeLen = big ? 0.200 : 0.150;
  const mountH = big ? 0.036 : 0.030;
  const cy = y + mountH + tubeR + 0.004;

  // Two ring mounts rather than a slab — the gap under the tube is a strong
  // recognition cue.
  for (const rz of [-tubeLen * 0.26, tubeLen * 0.26]) {
    b.box(0.030, mountH, 0.016, 'aluDark', x, y + mountH / 2, z + rz);
    b.box(0.034, 0.012, 0.020, 'alu', x, y + mountH - 0.002, z + rz);
  }

  b.cyl(tubeR, tubeLen, 'parkerised', x, cy, z, 12);
  // Objective bell forward, ocular bell aft.
  b.add(taperGeo(tubeR, tubeR * 1.55, 0.042, 12), 'parkerised', x, cy, z - tubeLen / 2 - 0.019);
  b.add(taperGeo(tubeR * 1.35, tubeR, 0.034, 12), 'parkerised', x, cy, z + tubeLen / 2 + 0.015);
  // Lenses.
  b.cyl(tubeR * 1.42, 0.004, 'glass', x, cy, z - tubeLen / 2 - 0.039, 12);
  b.cyl(tubeR * 1.22, 0.004, 'glass', x, cy, z + tubeLen / 2 + 0.030, 12);
  // Elevation and windage turrets.
  b.cyl(0.011, 0.020, 'alu', x, cy + tubeR + 0.009, z - 0.010, 10, Math.PI / 2, 0, 0);
  b.cyl(0.010, 0.018, 'alu', x + tubeR + 0.008, cy, z - 0.010, 10, 0, Math.PI / 2, 0);
  // Magnification ring with a throw lever.
  b.cyl(tubeR * 1.18, 0.024, 'aluDark', x, cy, z + tubeLen * 0.28, 12);
  b.box(0.008, 0.026, 0.008, 'alu', x + tubeR * 1.1, cy + 0.014, z + tubeLen * 0.28, 0, 0, -0.5);
  // Reticle.
  b.box(0.0018, 0.0018, 0.001, 'reticle', x, cy, z + tubeLen / 2 + 0.026);
  return cy;
}

/** Iron sights: protected front post, folding rear aperture. */
export function ironSights(b: PartBuilder, x: number, railY: number, frontZ: number, rearZ: number): number {
  // Front: post inside two protective wings.
  b.box(0.004, 0.026, 0.006, 'parkerised', x, railY + 0.016, frontZ);
  b.box(0.004, 0.030, 0.010, 'parkerised', x - 0.011, railY + 0.018, frontZ);
  b.box(0.004, 0.030, 0.010, 'parkerised', x + 0.011, railY + 0.018, frontZ);
  b.box(0.026, 0.004, 0.010, 'parkerised', x, railY + 0.033, frontZ);
  // Rear: aperture plate, built as two posts with a gap, built as two posts.
  b.box(0.005, 0.020, 0.005, 'parkerised', x - 0.007, railY + 0.013, rearZ);
  b.box(0.005, 0.020, 0.005, 'parkerised', x + 0.007, railY + 0.013, rearZ);
  b.box(0.019, 0.005, 0.005, 'parkerised', x, railY + 0.023, rearZ);
  return railY + 0.014;
}

/** Suppressor with a visible mount collar and end cap. */
export function suppressor(b: PartBuilder, x: number, y: number, z: number, length: number): number {
  b.cyl(0.0135, 0.024, 'blued', x, y, z - 0.012, 12);          // mount collar
  b.cyl(0.0182, length, 'parkerised', x, y, z - 0.024 - length / 2, 14);
  // Faceted end cap.
  b.add(taperGeo(0.0182, 0.0150, 0.014, 14), 'blued', x, y, z - 0.024 - length - 0.007);
  // A couple of relief grooves so the tube isn't a plain cylinder.
  for (const t of [0.3, 0.6]) {
    b.cyl(0.0192, 0.005, 'aluDark', x, y, z - 0.024 - length * t, 14);
  }
  return z - 0.024 - length - 0.014;
}

/** Flash hider with real prongs. */
export function flashHider(b: PartBuilder, x: number, y: number, z: number): number {
  const len = 0.052;
  b.cyl(0.0125, 0.014, 'blued', x, y, z - 0.007, 10);
  // Four prongs around a hollow core.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.box(0.006, 0.006, len - 0.014, 'blued',
      x + Math.cos(a) * 0.0092, y + Math.sin(a) * 0.0092, z - 0.014 - (len - 0.014) / 2);
  }
  return z - len;
}

/** Muzzle brake: chambered body with side ports. */
export function muzzleBrake(b: PartBuilder, x: number, y: number, z: number): number {
  const len = 0.058;
  b.cyl(0.0145, len, 'blued', x, y, z - len / 2, 10);
  for (let i = 0; i < 3; i++) {
    const pz = z - 0.012 - i * 0.016;
    b.box(0.034, 0.010, 0.007, 'blued', x, y + 0.002, pz);
  }
  return z - len;
}
