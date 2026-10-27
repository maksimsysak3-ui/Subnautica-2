// =====================================================================
//  Hand-built F1 car (2026-style proportions, ~5.6 m long, 2 m wide).
//  Faces +z. Modelled with the front axle at z = +1.6 and rear at z = -2.0,
//  then shifted so the root origin sits under the centre of mass (CAR.a / CAR.b).
// =====================================================================
const LIVERIES = [
  { name: 'Rosso', body: 0xc4121a, second: 0x16161a, accent: 0xf4f4f4 },
  { name: 'Argento', body: 0xb8bec6, second: 0x0f1013, accent: 0x00c2b2 },
  { name: 'Papaya', body: 0xff7a00, second: 0x1b2a4a, accent: 0x111111 },
  { name: 'Verde', body: 0x0b5a3c, second: 0x0d0f0d, accent: 0xb6f000 },
  { name: 'Notte', body: 0x101a3a, second: 0xc4121a, accent: 0xffcc00 },
  { name: 'Ghiaccio', body: 0xf2f4f7, second: 0x111216, accent: 0x2aa8ff },
];

const carbonTex = canvasTex(128, (g, s) => {
  g.fillStyle = '#151619'; g.fillRect(0, 0, s, s);
  const c = 8;
  for (let y = 0; y < s; y += c) for (let x = 0; x < s; x += c) {
    const on = ((x + y) / c) % 2 === 0;
    const grd = g.createLinearGradient(x, y, on ? x + c : x, on ? y : y + c);
    grd.addColorStop(0, '#202227'); grd.addColorStop(0.5, '#2d3036'); grd.addColorStop(1, '#1a1b1f');
    g.fillStyle = grd; g.fillRect(x, y, c, c);
  }
});
carbonTex.repeat.set(6, 6);

// Loft through superellipse cross-sections: {z, w (half width), h (half height), y (centre), p (squareness)}.
function loft(sections, { x = 0, seg = 28, capStart = true, capEnd = true } = {}) {
  const pos = [], uv = [], ind = [];
  const ring = seg + 1;
  sections.forEach((s, j) => {
    const p = s.p ?? 2.6;
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / p), ey = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / p);
      // Flatten the underside: real chassis are close to flat-bottomed.
      const yy = ey < 0 ? ey * (s.under ?? 0.7) : ey;
      pos.push(x + ex * s.w, s.y + yy * s.h, s.z);
      uv.push(k / seg, j / (sections.length - 1));
    }
  });
  for (let j = 0; j < sections.length - 1; j++) for (let k = 0; k < seg; k++) {
    const a = j * ring + k, b = a + ring;
    ind.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const cap = (j, flip) => {
    const s = sections[j];
    const centre = pos.length / 3;
    pos.push(x, s.y, s.z); uv.push(0.5, 0.5);
    for (let k = 0; k < seg; k++) {
      const a = j * ring + k;
      if (flip) ind.push(centre, a + 1, a); else ind.push(centre, a, a + 1);
    }
  };
  if (capStart) cap(0, true);
  if (capEnd) cap(sections.length - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind);
  g.computeVertexNormals();
  return g;
}

// Airfoil cross-section (in the y/z plane) extruded across the car (x).
function wing(span, chord, thick, { aoa = 0, camber = 0.06 } = {}) {
  const sh = new THREE.Shape();
  const N = 14;
  const top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, xc = (1 - Math.cos(t * Math.PI)) / 2;
    const yt = 5 * thick * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1015 * xc ** 4);
    const yc = camber * 4 * xc * (1 - xc);
    top.push([xc, yc + yt]); bot.push([xc, yc - yt]);
  }
  sh.moveTo(0, 0);
  for (const [a, b] of top) sh.lineTo(a * chord, b * chord);
  for (let i = bot.length - 1; i >= 0; i--) sh.lineTo(bot[i][0] * chord, bot[i][1] * chord);
  const g = new THREE.ExtrudeGeometry(sh, { depth: span, bevelEnabled: false, curveSegments: 4 });
  // Shape x = chord running back (-z), shape y = up. Extrusion along +z becomes the span (x).
  g.translate(0, 0, -span / 2);
  g.rotateY(Math.PI / 2);         // extrusion axis -> x, chord -> -z... leading edge forward
  g.rotateX(aoa);
  return g;
}

function tube(points, r, seg = 24) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(c, seg, r, 8, false);
}
function strut(a, b, r = 0.018) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.CylinderGeometry(r, r, len, 6);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()));
  g.translate(va.x, va.y, va.z);
  return g;
}

const COMPOUND = [0xe8202a, 0xffd21e, 0xf2f2f2];   // soft / medium / hard sidewall stripe
const wheelCoverTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#1b1c20'; g.fillRect(0, 0, s, s);
  g.translate(s / 2, s / 2);
  for (let i = 0; i < 5; i++) {
    g.rotate((Math.PI * 2) / 5);
    g.fillStyle = '#2c2f35'; g.fillRect(-10, 18, 20, s * 0.32);
  }
  g.fillStyle = '#c9cbd0'; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill();
  g.fillStyle = '#e10600'; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill();
}, false);

function buildWheel(width, mats, compound) {
  const R = 0.36, rim = 0.235;
  const g = new THREE.Group();
  // Tyre profile revolved around the axle: flat tread with rounded shoulders.
  const prof = [];
  const hw = width / 2, sh = 0.05;
  prof.push(new THREE.Vector2(rim, -hw + 0.01));
  prof.push(new THREE.Vector2(R - sh, -hw));
  for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i / 5) * (Math.PI / 2); prof.push(new THREE.Vector2(R - sh + Math.cos(a) * sh, -hw + sh + Math.sin(a) * sh)); }
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); prof.push(new THREE.Vector2(R - sh + Math.cos(a) * sh, hw - sh + Math.sin(a) * sh)); }
  prof.push(new THREE.Vector2(R - sh, hw));
  prof.push(new THREE.Vector2(rim, hw - 0.01));
  const tyre = new THREE.Mesh(new THREE.LatheGeometry(prof, 40).rotateZ(Math.PI / 2), mats.tyre);
  tyre.castShadow = true;
  g.add(tyre);
  for (const s of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.RingGeometry(0.29, 0.305, 40), new THREE.MeshStandardMaterial({ color: COMPOUND[compound], roughness: 0.6, side: THREE.DoubleSide }));
    stripe.rotation.y = s * Math.PI / 2;
    stripe.position.x = s * (hw + 0.002);
    g.add(stripe);
    const cover = new THREE.Mesh(new THREE.CircleGeometry(rim + 0.005, 32), mats.cover);
    cover.rotation.y = s * Math.PI / 2;
    cover.position.x = s * (hw - 0.012);
    g.add(cover);
  }
  return g;
}

function buildCar(liveryIdx = 0) {
  const L = LIVERIES[liveryIdx] || LIVERIES[0];
  const paint = (c) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.1, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 0.6 });
  const mats = {
    body: paint(L.body), second: paint(L.second), accent: paint(L.accent),
    carbon: new THREE.MeshStandardMaterial({ map: carbonTex, color: 0xffffff, metalness: 0.25, roughness: 0.4 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.82 }),
    cover: new THREE.MeshStandardMaterial({ map: wheelCoverTex, metalness: 0.5, roughness: 0.35 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.25 }),
    black: new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.5 }),
    visor: new THREE.MeshPhysicalMaterial({ color: 0x0a0a0c, metalness: 0.9, roughness: 0.05, clearcoat: 1 }),
    rain: new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1010, emissiveIntensity: 0 }),
  };
  const root = new THREE.Group();
  const body = new THREE.Group();      // pitches / rolls on the "suspension"
  root.add(body);
  const add = (geo, mat, parent = body, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow; m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Chassis: nose -> cockpit -> engine cover -> gearbox.
  add(loft([
    { z: 3.02, w: 0.07, h: 0.06, y: 0.24, p: 2.2 },
    { z: 2.85, w: 0.13, h: 0.09, y: 0.27 },
    { z: 2.3, w: 0.2, h: 0.14, y: 0.33 },
    { z: 1.6, w: 0.27, h: 0.2, y: 0.42 },
    { z: 0.9, w: 0.34, h: 0.25, y: 0.48 },
    { z: 0.35, w: 0.4, h: 0.26, y: 0.5 },
    { z: -0.35, w: 0.44, h: 0.27, y: 0.5 },
    { z: -1.0, w: 0.38, h: 0.27, y: 0.48 },
    { z: -1.6, w: 0.26, h: 0.22, y: 0.42 },
    { z: -2.15, w: 0.14, h: 0.14, y: 0.36 },
    { z: -2.42, w: 0.08, h: 0.08, y: 0.33 },
  ]), mats.body);
  // Airbox + engine cover spine with the shark-fin taper.
  add(loft([
    { z: -0.18, w: 0.17, h: 0.16, y: 0.86, p: 2.2, under: 1 },
    { z: -0.4, w: 0.2, h: 0.2, y: 0.84, under: 1 },
    { z: -0.9, w: 0.17, h: 0.2, y: 0.75, under: 1 },
    { z: -1.5, w: 0.09, h: 0.17, y: 0.62, under: 1 },
    { z: -2.1, w: 0.035, h: 0.12, y: 0.52, under: 1 },
  ]), mats.second);
  // Airbox intake (dark mouth above the driver's head).
  const mouth = add(new THREE.CircleGeometry(1, 20), mats.black, body, false);
  mouth.scale.set(0.11, 0.11, 1); mouth.position.set(0, 0.88, -0.17);
  // Engine cover fin.
  add(new THREE.BoxGeometry(0.012, 0.22, 1.1).translate(0, 0.72, -1.55).rotateX(0.05), mats.accent);

  // Sidepods with dark radiator inlets.
  for (const s of [-1, 1]) {
    add(loft([
      { z: 0.55, w: 0.13, h: 0.15, y: 0.36, p: 3.2 },
      { z: 0.35, w: 0.2, h: 0.18, y: 0.37, p: 3.2 },
      { z: -0.2, w: 0.22, h: 0.19, y: 0.36, p: 3 },
      { z: -0.9, w: 0.19, h: 0.15, y: 0.31 },
      { z: -1.55, w: 0.11, h: 0.09, y: 0.25 },
      { z: -1.95, w: 0.05, h: 0.05, y: 0.22 },
    ], { x: s * 0.5 }), mats.body);
    const inlet = add(new THREE.PlaneGeometry(0.3, 0.2), mats.black, body, false);
    inlet.position.set(s * 0.5, 0.39, 0.556);
    // Accent stripe along the sidepod.
    add(loft([
      { z: 0.3, w: 0.012, h: 0.03, y: 0.5 }, { z: -0.6, w: 0.012, h: 0.03, y: 0.47 }, { z: -1.3, w: 0.01, h: 0.02, y: 0.36 },
    ], { x: s * 0.66 }), mats.accent, body, false);
  }

  // Floor with tapered planform, edge wings and a diffuser.
  const fl = new THREE.Shape();
  fl.moveTo(-0.32, 1.1); fl.lineTo(0.32, 1.1); fl.lineTo(0.78, 0.4); fl.lineTo(0.78, -1.7); fl.lineTo(0.6, -2.25);
  fl.lineTo(-0.6, -2.25); fl.lineTo(-0.78, -1.7); fl.lineTo(-0.78, 0.4); fl.closePath();
  add(new THREE.ExtrudeGeometry(fl, { depth: 0.025, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, 0.085, 0), mats.carbon);
  add(new THREE.BoxGeometry(1.15, 0.012, 0.55).rotateX(-0.28).translate(0, 0.16, -2.42), mats.carbon);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.012, 0.22, 0.55).translate(s * 0.58, 0.17, -2.42), mats.carbon);

  // Front wing: three elements, endplates, nose pylons.
  add(wing(1.75, 0.34, 0.1, { aoa: 0.05 }).translate(0, 0.1, 3.1), mats.carbon);
  add(wing(1.6, 0.22, 0.09, { aoa: -0.22 }).translate(0, 0.17, 2.82), mats.accent);
  add(wing(1.45, 0.16, 0.09, { aoa: -0.45 }).translate(0, 0.24, 2.64), mats.body);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.012, 0.22, 0.6).translate(s * 0.88, 0.17, 2.84), mats.body);
    add(new THREE.BoxGeometry(0.03, 0.14, 0.18).translate(s * 0.09, 0.18, 2.86), mats.carbon);
  }
  // Rear wing: main plane + DRS flap, endplates, swan-neck pylon, beam wing.
  add(wing(1.0, 0.36, 0.12, { aoa: 0.12 }).translate(0, 0.84, -2.3), mats.second);
  add(wing(1.0, 0.24, 0.1, { aoa: -0.42 }).translate(0, 0.99, -2.52), mats.body);
  add(wing(0.9, 0.18, 0.12, { aoa: 0.1 }).translate(0, 0.42, -2.42), mats.carbon);
  for (const s of [-1, 1]) {
    const ep = new THREE.Shape();
    ep.moveTo(0, 0); ep.lineTo(0.72, 0); ep.lineTo(0.72, 0.5); ep.quadraticCurveTo(0.3, 0.62, 0, 0.42); ep.closePath();
    add(new THREE.ExtrudeGeometry(ep, { depth: 0.014, bevelEnabled: false }).rotateY(Math.PI / 2).translate(s * 0.5, 0.55, -2.0 + 0), mats.body);
  }
  add(new THREE.BoxGeometry(0.03, 0.42, 0.14).translate(0, 0.62, -2.32).rotateX(-0.1), mats.carbon);
  // Rain light.
  add(new THREE.BoxGeometry(0.12, 0.05, 0.03).translate(0, 0.36, -2.47), mats.rain, body, false);

  // Halo.
  add(tube([[-0.32, 0.6, -0.3], [-0.31, 0.82, -0.05], [-0.22, 0.88, 0.25], [0, 0.9, 0.36], [0.22, 0.88, 0.25], [0.31, 0.82, -0.05], [0.32, 0.6, -0.3]], 0.026), mats.second);
  add(tube([[0, 0.9, 0.36], [0, 0.83, 0.52], [0, 0.72, 0.66]], 0.026, 8), mats.second);
  // Cockpit rim and driver.
  const rim = add(new THREE.TorusGeometry(1, 0.035, 8, 32), mats.black);
  rim.scale.set(0.3, 0.55, 1); rim.rotation.x = Math.PI / 2; rim.position.set(0, 0.73, 0.02);
  const opening = add(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), mats.black, body, false);
  opening.scale.set(0.29, 1, 0.54); opening.position.set(0, 0.735, 0.02);
  const helmet = add(new THREE.SphereGeometry(0.135, 24, 16), mats.accent);
  helmet.position.set(0, 0.84, -0.06); helmet.scale.set(1, 1, 1.12);
  const visor = add(new THREE.SphereGeometry(0.137, 24, 12, -Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.36, Math.PI * 0.2), mats.visor, body, false);
  visor.position.copy(helmet.position); visor.scale.copy(helmet.scale);
  // Mirrors.
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.13, 0.055, 0.035).translate(s * 0.47, 0.76, 0.42), mats.second);
    add(strut([s * 0.3, 0.68, 0.4], [s * 0.45, 0.77, 0.42], 0.01), mats.carbon, body, false);
  }
  // T-cam on the airbox.
  add(new THREE.BoxGeometry(0.08, 0.05, 0.16).translate(0, 1.07, -0.3), mats.accent, body, false);

  // Wheels: steering pivots up front, all four spin.
  const wheels = [];
  const hubs = [[0.79, 1.6, 0.31, true], [-0.79, 1.6, 0.31, true], [0.77, -2.0, 0.41, false], [-0.77, -2.0, 0.41, false]];
  for (const [x, z, w, front] of hubs) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const wheel = buildWheel(w, mats, front ? 0 : 0);
    pivot.add(wheel);
    root.add(pivot);
    wheels.push({ pivot, wheel, front });
    // Wishbones + push rod from the chassis side to the hub.
    const cx = Math.sign(x) * (front ? 0.24 : 0.3);
    const parent = root;
    add(strut([cx, 0.45, z + 0.22], [x * 0.9, 0.48, z], 0.016), mats.carbon, parent);
    add(strut([cx, 0.45, z - 0.25], [x * 0.9, 0.48, z], 0.016), mats.carbon, parent);
    add(strut([cx, 0.25, z + 0.25], [x * 0.9, 0.24, z], 0.016), mats.carbon, parent);
    add(strut([cx, 0.25, z - 0.28], [x * 0.9, 0.24, z], 0.016), mats.carbon, parent);
    add(strut([cx, 0.55, z - 0.05], [x * 0.88, 0.27, z], 0.012), mats.metal, parent);
  }
  // Move the modelling origin to the centre of mass (2.0 m behind the front axle).
  for (const o of root.children) o.position.z += 0.4;
  return { root, body, wheels, mats };
}
