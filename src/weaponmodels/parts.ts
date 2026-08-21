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
  | 'polymerMid' | 'polymerOlive' | 'wood' | 'woodDark' | 'glass' | 'reticle'
  | 'rubber' | 'brass' | 'glove' | 'gloveTan' | 'sleeve' | 'skin';

/**
 * Weapon palette.
 *
 * The governing constraint is **internal value separation**. A weapon whose
 * receiver, handguard, grip and magazine are all the same dark grey renders as
 * one flat mass — you can see its outline and nothing inside it. The part
 * census bore this out: 36 meshes shared a single colour across the handguard,
 * the pistol grip, the magazine and every M-LOK slot.
 *
 * So the polymer furniture is deliberately spread across three values, and
 * they alternate along the weapon: receiver (mid metal) → handguard (dark
 * polymer) → magazine (mid polymer) → grip (darkest). Every adjacent pair
 * differs by enough to hold an edge without a highlight.
 *
 * Roughness carries the rest. Machined aluminium at 0.42 catches the sky and
 * draws the receiver's top line; a moulded grip at 0.94 never does.
 */
export const MATERIALS: Record<MatKey, THREE.Material> = {
  // ## Why the metalness values are low for "metal"
  //
  // In the metallic-roughness BRDF, `diffuse = albedo x (1 - metalness)`. At
  // metalness 0.72 only 28% of the authored colour survives; the other 72% is
  // whatever the environment probe says. The probe here is a single sky
  // gradient at hue 0.58 — a 209-degree blue. So the receiver was being
  // painted with the sky and the palette barely reached the screen: measured
  // output had blue at 3.6x red, from materials authored with B-R of 6 to 15.
  //
  // Titles that run metalness 0.7-0.9 on a viewmodel have local reflection
  // probes and a full HDRI to reflect. With one gradient, the honest setting
  // is lower, and the authored colour does the work.
  //
  // ## Value separation
  // Adjacent parts must differ by ~20 luma or they merge into one mass. The
  // ramp runs: aluminium 126 > receiver 90 > polymerMid 61 > polymerBlack 38.
  // Every touching pair on the assembled weapon crosses at least one step.

  // Real phosphate is grey-green, not blue. Brightest structural value —
  // the receiver is the hero and should read as such.
  parkerised:   new THREE.MeshStandardMaterial({ color: 0x565a54, roughness: 0.58, metalness: 0.25, flatShading: true }),
  // Kept glossy so the barrel throws a highlight line. That line is what
  // separates a barrel from the handguard it sits in front of.
  blued:        new THREE.MeshStandardMaterial({ color: 0x26282a, roughness: 0.32, metalness: 0.35, flatShading: true }),
  // Roughness 0.48, not 0.36. The rail slots are the highest-frequency
  // geometry on the weapon and they sit right under the key light; at 0.36
  // their specular lobe was narrow enough to clip to pure white in a band
  // across the top of the receiver.
  alu:          new THREE.MeshStandardMaterial({ color: 0x7d8086, roughness: 0.48, metalness: 0.40, flatShading: true }),
  aluDark:      new THREE.MeshStandardMaterial({ color: 0x585b5e, roughness: 0.44, metalness: 0.35, flatShading: true }),
  polymerBlack: new THREE.MeshStandardMaterial({ color: 0x25272b, roughness: 0.92, metalness: 0.02, flatShading: true }),
  polymerMid:   new THREE.MeshStandardMaterial({ color: 0x3a3d41, roughness: 0.88, metalness: 0.02, flatShading: true }),
  polymerFde:   new THREE.MeshStandardMaterial({ color: 0x8d7f64, roughness: 0.90, metalness: 0.02, flatShading: true }),
  polymerOlive: new THREE.MeshStandardMaterial({ color: 0x545b47, roughness: 0.90, metalness: 0.02, flatShading: true }),
  wood:         new THREE.MeshStandardMaterial({ color: 0x8a5f3b, roughness: 0.70, metalness: 0.04, flatShading: true }),
  woodDark:     new THREE.MeshStandardMaterial({ color: 0x634126, roughness: 0.76, metalness: 0.04, flatShading: true }),
  // Opacity 0.20, not 0.62. Real optic glass transmits 85-90%; at 0.62 the
  // red dot's window rendered as an opaque grey panel and aiming through the
  // sight showed nothing but the sight. depthWrite off so the reticle drawn
  // behind it is not occluded by it.
  glass:        new THREE.MeshStandardMaterial({ color: 0x3f6f88, roughness: 0.05, metalness: 0.20, transparent: true, opacity: 0.20, depthWrite: false }),
  reticle:      new THREE.MeshBasicMaterial({ color: 0xff4433, toneMapped: false }),
  rubber:       new THREE.MeshStandardMaterial({ color: 0x1e2023, roughness: 0.97, metalness: 0.0, flatShading: true }),
  brass:        new THREE.MeshStandardMaterial({ color: 0xb08d4a, roughness: 0.35, metalness: 0.55, flatShading: true }),
  // Hands run WARM against a cool weapon. That hue split is the cheapest
  // separation available and it is what the reference titles do — a gloved
  // hand the same colour as the grip it wraps is invisible.
  glove:        new THREE.MeshStandardMaterial({ color: 0x4a453f, roughness: 0.95, metalness: 0.0, flatShading: true }),
  gloveTan:     new THREE.MeshStandardMaterial({ color: 0x6d604a, roughness: 0.95, metalness: 0.0, flatShading: true }),
  sleeve:       new THREE.MeshStandardMaterial({ color: 0x434a3a, roughness: 0.97, metalness: 0.0, flatShading: true }),
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

/**
 * M-LOK style slot row along one face of a handguard.
 *
 * These were modelled backwards: boxes protruding 3 mm from the surface, in
 * the same colour as the handguard. Real M-LOK is a *recess*. 144 triangles
 * were buying nothing but silhouette fuzz, and at viewing scale each nub
 * resolved to about three pixels.
 *
 * Now they are flat, dark, and large enough to read: a 27 x 10 pixel slot at
 * hip carry, sitting almost flush against a lighter handguard.
 */
export function mlokRow(b: PartBuilder, x: number, y: number, z0: number, z1: number,
                        mat: MatKey, axis: 'x' | 'y'): void {
  const len = Math.abs(z1 - z0);
  const n = Math.max(2, Math.floor(len / 0.046));
  for (let i = 0; i < n; i++) {
    const sz = Math.min(z0, z1) + (i + 0.5) * (len / n);
    if (axis === 'y') b.box(0.012, 0.002, 0.032, mat, x, y, sz);
    else b.box(0.002, 0.012, 0.032, mat, x, y, sz);
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
  // Receiver extension. It has to start *inside* the receiver, not next to it:
  // starting the tube at the receiver's rear face left a 10 mm gap, and the
  // stock read as a separate object floating behind the gun.
  b.cyl(0.0175, length * 1.02, 'parkerised', x, y, z + length * 0.40, 12);
  // Castle nut and end plate at the junction — the hardware that actually
  // holds a buffer tube on, and the detail that makes the joint read as a
  // joint rather than as two parts that happen to touch.
  b.cyl(0.0215, 0.016, 'aluDark', x, y, z - 0.004, 12);
  b.box(0.040, 0.048, 0.005, 'aluDark', x, y, z - 0.014);
  // Adjustment notches along the underside of the tube.
  const n = 6;
  for (let i = 0; i < n; i++) {
    b.box(0.020, 0.005, 0.008, 'aluDark', x, y - 0.018, z + 0.034 + i * (length * 0.115));
  }
  // Slider body. Sized so the comb can sit PROUD on top of it: at 82 mm tall
  // the body swallowed the comb entirely, which is why the stock rendered as
  // one featureless slab.
  b.box(0.042, 0.066, 0.112, 'polymerMid', x, y - 0.006, z + length * 0.56);
  // Side scallops — the lightening cuts every collapsible stock has, and the
  // only thing breaking up 112 mm of flat flank.
  for (let i = 0; i < 2; i++) {
    b.box(0.046, 0.026, 0.030, 'polymerBlack', x, y - 0.012, z + length * 0.46 + i * 0.044);
  }
  // Comb, standing proud along the top and ending ~11 mm below the rail line.
  b.box(0.036, 0.020, 0.098, mat, x, y + 0.021, z + length * 0.55);
  // Adjustment lever under the comb.
  b.box(0.020, 0.014, 0.028, 'aluDark', x, y - 0.040, z + length * 0.44, 0.3);
  // Butt pad, rubber and slightly proud.
  b.box(0.046, 0.080, 0.020, 'rubber', x, y - 0.004, z + length * 0.85);
  // QD sling socket. Recessed and dark: as a proud aluminium cylinder seen
  // end-on it read as a bright disc stuck to the side of the stock.
  b.cyl(0.008, 0.006, 'aluDark', x + 0.020, y - 0.014, z + length * 0.66, 8, 0, Math.PI / 2, 0);
  b.cyl(0.0052, 0.008, 'polymerBlack', x + 0.022, y - 0.014, z + length * 0.66, 8, 0, Math.PI / 2, 0);
  // Sling loop.
  b.box(0.006, 0.020, 0.006, 'aluDark', x + 0.021, y - 0.032, z + length * 0.68);
}

/** Fixed rifle stock — one solid piece with a comb and a butt plate. */
export function fixedStock(b: PartBuilder, x: number, y: number, z: number,
                           length: number, mat: MatKey): void {
  b.box(0.040, 0.070, length * 0.75, mat, x, y - 0.010, z + length * 0.40, -0.05);
  b.box(0.036, 0.030, length * 0.50, mat, x, y + 0.034, z + length * 0.34);
  b.box(0.046, 0.104, 0.018, 'rubber', x, y - 0.020, z + length * 0.80);
  b.box(0.006, 0.018, 0.006, 'aluDark', x + 0.021, y - 0.044, z + length * 0.60);
}

/**
 * Red-dot / holographic sight.
 *
 * The window has to be **empty**. The emitter housing used to sit inside it —
 * a 14 mm opaque block across the bottom of a 34 mm window, blocking 45% of
 * the sight picture and clipping the bottom half of the dot. Looking through
 * the optic showed a wall of grey with a red sliver on top of it. An emitter
 * lives under the tube on a real sight, which is where it goes here.
 */
export function redDot(b: PartBuilder, x: number, y: number, z: number, holo: boolean): number {
  // 22 mm, not 30: the dot was landing 81 mm over the bore where an absolute
  // co-witness sits at 66. This puts it at 69 — a normal LRP mount.
  const mountH = 0.022;
  b.box(0.024, mountH, 0.032, 'aluDark', x, y + mountH / 2, z);
  // Throw lever.
  b.box(0.032, 0.009, 0.014, 'alu', x - 0.005, y + 0.007, z + 0.011);

  const bodyH = holo ? 0.040 : 0.034;
  const bodyW = holo ? 0.036 : 0.030;
  const cy = y + mountH + bodyH / 2;
  const wall = 0.004;

  // Hood: two uprights and top and bottom bridges, leaving an open window.
  // Modelling the window as a genuine gap rather than as a dark face is what
  // makes it read as a sight rather than as a block with a sticker on it.
  b.box(wall, bodyH, 0.046, 'parkerised', x - bodyW / 2, cy, z);
  b.box(wall, bodyH, 0.046, 'parkerised', x + bodyW / 2, cy, z);
  b.box(bodyW + wall, 0.006, 0.046, 'parkerised', x, cy + bodyH / 2, z);
  b.box(bodyW + wall, 0.006, 0.046, 'parkerised', x, cy - bodyH / 2, z);

  // Emitter, slung UNDER the tube where it belongs.
  b.box(bodyW - 0.008, 0.010, 0.018, 'parkerised', x, cy - bodyH / 2 - 0.006, z + 0.012);

  // Glass across the front of the open window.
  b.box(bodyW - wall, bodyH - 0.008, 0.002, 'glass', x, cy, z - 0.020);

  // Turrets: elevation on top, windage on the right.
  b.cyl(0.0065, 0.011, 'alu', x + bodyW / 2 + 0.005, cy, z + 0.008, 8, 0, Math.PI / 2, 0);
  b.cyl(0.0065, 0.011, 'alu', x, cy + bodyH / 2 + 0.006, z + 0.008, 8, Math.PI / 2, 0, 0);

  // The dot, dead centre of the window and drawn in front of the glass.
  //
  // 0.6 mm, not 4.2. Measured, the old quad rendered 23 x 23 px at ADS, which
  // at the aimed field of view works out to a 129 MOA dot — sixty-four times a
  // real 2 MOA red dot, and physically wider than a man's torso at 40 m. The
  // sight was decorative: you could not aim with it past about fifteen metres,
  // because the dot covered whatever you were aiming at.
  b.box(0.0006, 0.0006, 0.0004, 'reticle', x, cy, z - 0.023);
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
  // Reticle at the ocular end. A magnified optic's reticle subtends the same
  // angle as the dot above, so it is the same size in model space.
  b.box(0.0006, 0.0006, 0.0004, 'reticle', x, cy, z + tubeLen / 2 + 0.026);
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

/**
 * A2-pattern birdcage flash hider.
 *
 * Modelled as a slotted cylinder rather than as four free-standing prongs. The
 * prong version was geometrically honest and visually useless: four 6 mm bars
 * on a 9 mm radius read as a pair of wire antennae at any distance the player
 * ever sees the weapon from. A solid body with dark slots cut into it gives
 * the same read at a glance and holds together in silhouette.
 */
export function flashHider(b: PartBuilder, x: number, y: number, z: number): number {
  const len = 0.054;
  // Mount collar, then the cage body.
  b.cyl(0.0125, 0.012, 'blued', x, y, z - 0.006, 10);
  b.cyl(0.0118, len - 0.012, 'blued', x, y, z - 0.012 - (len - 0.012) / 2, 10);
  // Five slots around the top and sides — closed underneath, as an A2 is, so
  // it does not kick dust when fired prone.
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * 0.5 + (i / 4) * Math.PI * 1.35 + Math.PI * 0.32;
    b.box(0.005, 0.005, len * 0.62, 'polymerBlack',
      x + Math.cos(a) * 0.0105, y + Math.sin(a) * 0.0105, z - 0.014 - len * 0.31);
  }
  // Crowned tip so the bore still reads as a hole.
  b.add(taperGeo(0.0118, 0.0088, 0.008, 10), 'blued', x, y, z - len + 0.004);
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
