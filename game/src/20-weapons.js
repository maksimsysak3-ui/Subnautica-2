// =====================================================================
//  Rifle (gun-local: origin at trigger, +Z = muzzle, +Y = up, -X = ejection side)
// =====================================================================
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const reticleTex = {
  holo: canvasTex(128, 128, (g, w) => {
    g.strokeStyle = '#ff2a1a'; g.fillStyle = '#ff2a1a'; g.shadowColor = '#ff2a1a'; g.shadowBlur = 6; g.lineWidth = 4;
    g.beginPath(); g.arc(w / 2, w / 2, 44, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(w / 2, w / 2, 4, 0, Math.PI * 2); g.fill();
    for (const [x, y] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) g.fillRect(w / 2 + x * 44 - 2 - (x ? x * 4 : 0), w / 2 + y * 44 - 2 - (y ? y * 4 : 0), 4 + Math.abs(x) * 4, 4 + Math.abs(y) * 4);
  }),
  reddot: canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#ff2a1a'; g.shadowColor = '#ff2a1a'; g.shadowBlur = 10;
    g.beginPath(); g.arc(w / 2, w / 2, 7, 0, Math.PI * 2); g.fill();
  }),
};

const GUN_SCALE = 1.2; // stylized proportions to match the concept sheet
function buildRifle(c) {
  const S = SLOT, g = new THREE.Group();
  const B = S.gun, F = S.furn, D = S.gunDark;
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, p = g) => M(geo, mat, p, x, y, z, rx, ry, rz);
  // lower receiver
  add(box(0.034, 0.05, 0.19), B, 0, 0.012, 0.03);
  add(box(0.037, 0.046, 0.075), B, 0, -0.03, 0.078);
  add(box(0.006, 0.006, 0.075), B, 0, -0.036, 0.0);
  add(box(0.004, 0.024, 0.006), D, 0, -0.018, 0.006, -0.2);
  add(box(0.028, 0.105, 0.04), F, 0, -0.072, -0.05, 0.38);
  add(box(0.008, 0.012, 0.03), D, 0.018, 0.02, -0.02); // safety selector
  add(box(0.006, 0.03, 0.012), D, 0.018, 0.0, 0.05);  // bolt catch
  // upper receiver + rail
  add(box(0.032, 0.046, 0.21), B, 0, 0.059, 0.035);
  add(box(0.022, 0.008, 0.21), B, 0, 0.086, 0.035);
  for (let i = 0; i < 13; i++) add(box(0.025, 0.005, 0.007), D, 0, 0.0915, -0.055 + i * 0.0145);
  add(box(0.002, 0.016, 0.052), D, -0.0162, 0.06, 0.045);
  const bolt = add(box(0.003, 0.011, 0.04), S.bolt, -0.0172, 0.06, 0.045);
  add(box(0.012, 0.014, 0.022), B, -0.019, 0.073, -0.01);
  const chg = new THREE.Group(); chg.position.set(0, 0.078, -0.07); g.add(chg);
  add(box(0.05, 0.008, 0.012), B, 0, 0, -0.008, 0, 0, 0, chg);
  add(box(0.012, 0.008, 0.035), B, 0, 0, 0.012, 0, 0, 0, chg);
  // buffer tube + adjustable stock
  add(cylZ(0.015, 0.19, 10), B, 0, 0.052, -0.165);
  add(box(0.042, 0.052, 0.12), F, 0, 0.052, -0.228);
  add(box(0.034, 0.07, 0.05), F, 0, 0.004, -0.262, -0.35);
  add(box(0.044, 0.135, 0.024), S.rubber, 0, 0.03, -0.298);
  add(box(0.012, 0.03, 0.05), D, 0, 0.018, -0.21);
  add(box(0.03, 0.01, 0.07), F, 0, 0.082, -0.24);
  // handguard (octagonal, M-LOK)
  const hgLen = 0.32, hgZ = 0.135 + hgLen / 2;
  const hgGeo = cylZ(0.029, hgLen, 8); hgGeo.rotateZ(Math.PI / 8);
  add(hgGeo, B, 0, 0.056, hgZ);
  add(box(0.022, 0.008, hgLen), B, 0, 0.088, hgZ);
  for (let i = 0; i < 20; i++) add(box(0.025, 0.005, 0.007), D, 0, 0.0935, 0.14 + i * 0.0155);
  for (let i = 0; i < 5; i++) {
    for (const sx of [1, -1]) add(box(0.003, 0.009, 0.03), D, sx * 0.0275, 0.056, 0.17 + i * 0.058);
    add(box(0.009, 0.003, 0.03), D, 0, 0.0275, 0.17 + i * 0.058);
    for (const sx of [1, -1]) add(box(0.003, 0.009, 0.03), D, sx * 0.0195, 0.0355, 0.17 + i * 0.058, 0, 0, sx * Math.PI / 4);
  }
  // barrel + muzzle device
  add(cylZ(0.0088, 0.13, 8), D, 0, 0.056, 0.52);
  let muzzleZ = 0.64;
  if (c.muzzle === 'flash') {
    add(cylZ(0.0115, 0.06, 8), D, 0, 0.056, 0.61);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; add(box(0.004, 0.004, 0.035), S.rubber, Math.cos(a) * 0.0105, 0.056 + Math.sin(a) * 0.0105, 0.62); }
  } else if (c.muzzle === 'brake') {
    add(box(0.028, 0.024, 0.06), D, 0, 0.056, 0.61);
    for (let i = 0; i < 3; i++) add(box(0.03, 0.008, 0.008), S.rubber, 0, 0.056, 0.592 + i * 0.016);
  } else {
    add(cylZ(0.0195, 0.18, 10), D, 0, 0.056, 0.67);
    muzzleZ = 0.765;
  }
  // optic
  let eyeY = 0.128, reticle = null;
  if (c.optic === 'holo') {
    add(box(0.036, 0.016, 0.09), B, 0, 0.099, 0.06);
    for (const sx of [1, -1]) add(box(0.004, 0.046, 0.06), B, sx * 0.018, 0.128, 0.075);
    add(box(0.04, 0.008, 0.062), B, 0, 0.153, 0.075);
    add(box(0.03, 0.022, 0.02), D, 0, 0.115, 0.03);
    add(box(0.008, 0.008, 0.012), D, 0.022, 0.112, 0.045);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.032, 0.038), S.glass); glass.position.set(0, 0.129, 0.104); g.add(glass);
  } else if (c.optic === 'reddot') {
    eyeY = 0.13;
    add(box(0.022, 0.03, 0.04), B, 0, 0.105, 0.06);
    const tubeG = cylZ(0.019, 0.07, 12, true);
    add(tubeG, new THREE.MeshStandardMaterial({ color: SLOT.gun.color, roughness: 0.45, metalness: 0.55, side: THREE.DoubleSide, flatShading: true }), 0, eyeY, 0.06);
    add(cylZ(0.008, 0.02, 8), D, 0.022, eyeY, 0.06);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.018, 12), S.glass); glass.position.set(0, eyeY, 0.094); g.add(glass);
  } else {
    eyeY = 0.112;
    add(box(0.028, 0.026, 0.024), B, 0, 0.104, -0.04);
    add(box(0.006, 0.01, 0.006), D, 0, 0.117, -0.04);
    add(box(0.022, 0.03, 0.02), B, 0, 0.104, 0.43);
    add(box(0.004, 0.024, 0.004), D, 0, 0.122, 0.43);
  }
  if (c.optic !== 'irons') {
    reticle = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), new THREE.MeshBasicMaterial({
      map: reticleTex[c.optic], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide }));
    reticle.position.set(0, eyeY, 0.085); g.add(reticle);
  }
  // foregrip
  let support = { wrist: new V3(0.004, -0.02, 0.245), palm: new V3(0, 0.02, 0.31) };
  if (c.grip === 'vertical') {
    add(new THREE.CylinderGeometry(0.014, 0.016, 0.085, 8), F, 0, -0.015, 0.31);
    support = { wrist: new V3(0, -0.035, 0.265), palm: new V3(0, -0.02, 0.31) };
  } else if (c.grip === 'angled') {
    add(box(0.026, 0.032, 0.07), F, 0, 0.014, 0.27, 0.45);
    support = { wrist: new V3(0, -0.03, 0.22), palm: new V3(0, 0.0, 0.28) };
  }
  // magazine
  const mag = new THREE.Group(); mag.position.set(0, -0.045, 0.078); g.add(mag);
  add(box(0.024, 0.09, 0.062), F, 0, -0.045, 0, 0, 0, 0, mag);
  add(box(0.024, 0.075, 0.06), F, 0, -0.118, 0.01, -0.22, 0, 0, mag);
  add(box(0.028, 0.012, 0.068), F, 0, -0.158, 0.019, -0.22, 0, 0, mag);
  for (let i = 0; i < 3; i++) add(box(0.026, 0.004, 0.05), S.rubber, 0, -0.03 - i * 0.03, 0, -0.07 * i, 0, 0, mag);
  g.scale.setScalar(GUN_SCALE);
  g.traverse((o) => { if (o.isMesh) o.userData.player = true; });
  return {
    kind: 'rifle', group: g, mag, bolt, boltZ0: bolt.position.z, chg, reticle,
    muzzle: new V3(0, 0.056, muzzleZ), eye: new V3(0, eyeY, -0.17), sightH: eyeY - 0.056,
    gripWrist: new V3(-0.003, -0.035, -0.105), gripPalm: new V3(0, -0.06, -0.035),
    support, butt: new V3(0, 0.035, -0.31), port: new V3(-0.02, 0.06, 0.045),
    magwell: new V3(0, -0.235, 0.1), magLow: new V3(0.02, -0.36, 0.07), boltCatch: new V3(0.04, 0.0, 0.03),
    suppressed: c.muzzle === 'suppressor', brake: c.muzzle === 'brake',
  };
}

// Pump shotgun (870-style). Same gun-local convention as the rifle.
function buildShotgun(c) {
  const S = SLOT, g = new THREE.Group();
  const B = S.gun, F = S.sgFurn, D = S.gunDark;
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, p = g) => M(geo, mat, p, x, y, z, rx, ry, rz);
  add(box(0.036, 0.064, 0.21), B, 0, 0.036, 0.035);                 // receiver
  add(box(0.03, 0.022, 0.1), B, 0, -0.006, 0.0);                     // trigger plate
  add(box(0.006, 0.006, 0.07), B, 0, -0.03, 0.0);
  add(box(0.004, 0.022, 0.006), D, 0, -0.016, 0.006, -0.2);
  add(box(0.008, 0.008, 0.01), D, 0, 0.004, -0.03);                 // safety
  add(box(0.03, 0.1, 0.042), F, 0, -0.07, -0.05, 0.38);              // pistol grip
  add(box(0.04, 0.05, 0.3), F, 0, 0.018, -0.245, 0.05);              // stock comb (drops away from the cheek)
  add(box(0.038, 0.06, 0.22), F, 0, -0.008, -0.29, 0.22);            // stock belly
  add(box(0.046, 0.135, 0.026), S.rubber, 0, 0.022, -0.405);         // recoil pad
  add(cylZ(0.0115, 0.5, 8), D, 0, 0.052, 0.39);                      // barrel
  add(box(0.006, 0.004, 0.46), D, 0, 0.066, 0.38);                   // vent rib
  add(cylZ(0.0125, 0.36, 8), B, 0, 0.022, 0.31);                     // magazine tube
  add(cylZ(0.015, 0.03, 8), D, 0, 0.022, 0.5);                       // tube cap
  add(box(0.03, 0.03, 0.03), D, 0, 0.035, 0.47);                     // barrel clamp
  // side saddle with spare shells on the left
  add(box(0.006, 0.034, 0.075), D, 0.021, 0.04, 0.02);
  for (let i = 0; i < 4; i++) {
    add(cylZ(0.0105, 0.06, 7).rotateX(Math.PI / 2), S.hull, 0.03, 0.04, -0.012 + i * 0.022);
    add(new THREE.CylinderGeometry(0.0108, 0.0108, 0.012, 7), S.brass, 0.03, 0.007, -0.012 + i * 0.022);
  }
  // pump fore-end
  const pump = new THREE.Group(); pump.position.set(0, 0.022, 0.26); g.add(pump);
  add(box(0.044, 0.046, 0.165), F, 0, -0.004, 0, 0, 0, 0, pump);
  for (let i = 0; i < 6; i++) for (const sx of [1, -1]) add(box(0.004, 0.036, 0.008), S.rubber, sx * 0.0225, -0.004, -0.06 + i * 0.024, 0, 0, 0, pump);
  add(box(0.004, 0.004, 0.16), D, 0.016, 0.022, -0.1, 0, 0, 0, pump);   // action bar
  const bolt = add(box(0.003, 0.02, 0.05), S.bolt, -0.0182, 0.045, 0.06);
  add(box(0.002, 0.026, 0.07), D, -0.0181, 0.045, 0.06);               // ejection port
  // sights
  let eyeY = 0.084, reticle = null;
  add(box(0.004, 0.014, 0.006), D, 0, 0.074, 0.635);
  add(new THREE.SphereGeometry(0.0038, 6, 4), S.sight, 0, 0.084, 0.635);
  if (c.sgOptic === 'reddot') {
    eyeY = 0.112;
    add(box(0.024, 0.016, 0.04), B, 0, 0.076, 0.05);
    add(cylZ(0.019, 0.06, 12, true), new THREE.MeshStandardMaterial({ color: SLOT.gun.color, roughness: 0.45, metalness: 0.55, side: THREE.DoubleSide, flatShading: true }), 0, eyeY, 0.05);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.018, 12), S.glass); glass.position.set(0, eyeY, 0.08); g.add(glass);
    reticle = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), new THREE.MeshBasicMaterial({ map: reticleTex.reddot, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide }));
    reticle.position.set(0, eyeY, 0.075); g.add(reticle);
  } else { add(box(0.022, 0.016, 0.014), D, 0, 0.074, 0.11); add(box(0.008, 0.006, 0.016), S.rubber, 0, 0.083, 0.11); } // ghost-ring rear
  g.scale.setScalar(GUN_SCALE);
  g.traverse((o) => { if (o.isMesh) o.userData.player = true; });
  return {
    kind: 'shotgun', group: g, mag: null, bolt, boltZ0: bolt.position.z, pump, pumpZ0: pump.position.z, reticle,
    muzzle: new V3(0, 0.052, 0.64), eye: new V3(0, eyeY, -0.32), sightH: eyeY - 0.052,
    gripWrist: new V3(-0.003, -0.035, -0.11), gripPalm: new V3(0, -0.06, -0.04),
    support: { wrist: new V3(0.004, -0.04, 0.2), palm: new V3(0, -0.012, 0.27) }, supportOnPump: true,
    butt: new V3(0, 0.025, -0.42), port: new V3(-0.022, 0.045, 0.06),
    loadPort: new V3(0, -0.075, 0.08), loadLow: new V3(0.03, -0.17, 0.05),
    suppressed: false, brake: false,
  };
}

// Striker-fired 9mm pistol (G17-style).
function buildPistol(c) {
  const S = SLOT, g = new THREE.Group();
  const SL = S.pSlide, FR = S.pFrame, D = S.gunDark;
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, p = g) => M(geo, mat, p, x, y, z, rx, ry, rz);
  add(box(0.03, 0.026, 0.165), FR, 0, 0.004, 0.035);                 // dust cover / frame
  add(box(0.03, 0.11, 0.05), FR, 0, -0.058, -0.03, 0.3);              // grip
  for (let i = 0; i < 4; i++) for (const sx of [1, -1]) add(box(0.002, 0.012, 0.03), D, sx * 0.0155, -0.03 - i * 0.022, -0.023 - i * 0.007, 0.3);
  add(box(0.03, 0.03, 0.02), FR, 0, -0.008, -0.062);                  // beavertail
  add(box(0.005, 0.005, 0.055), FR, 0, -0.022, 0.012);               // trigger guard
  add(box(0.005, 0.02, 0.005), FR, 0, -0.012, 0.038);
  add(box(0.004, 0.018, 0.005), D, 0, -0.008, 0.004, -0.15);          // trigger
  add(box(0.024, 0.006, 0.05), D, 0, -0.008, 0.075);                  // accessory rail
  if (c.pistolLight) { add(box(0.03, 0.03, 0.07), D, 0, -0.03, 0.09); add(cylZ(0.012, 0.004, 10), S.glass, 0, -0.03, 0.126); }
  const slide = new THREE.Group(); slide.position.set(0, 0.033, 0.035); g.add(slide);
  add(box(0.028, 0.032, 0.188), SL, 0, 0, 0, 0, 0, 0, slide);
  for (let i = 0; i < 6; i++) for (const sx of [1, -1]) add(box(0.002, 0.024, 0.003), D, sx * 0.0142, 0, -0.088 + i * 0.006, 0, 0, 0, slide);
  add(box(0.004, 0.008, 0.004), S.sight, 0, 0.02, 0.086, 0, 0, 0, slide);   // front post
  for (const sx of [1, -1]) add(box(0.007, 0.008, 0.006), D, sx * 0.006, 0.02, -0.084, 0, 0, 0, slide); // rear notch
  add(box(0.002, 0.014, 0.04), D, -0.0142, 0.004, 0.02, 0, 0, 0, slide);   // ejection port
  add(cylZ(0.0062, 0.012, 8), D, 0, -0.004, 0.095);                        // muzzle crown
  // magazine
  const mag = new THREE.Group(); mag.position.set(0, -0.012, -0.018); mag.rotation.x = 0.3; g.add(mag);
  add(box(0.022, 0.108, 0.034), D, 0, -0.054, 0, 0, 0, 0, mag);
  add(box(0.03, 0.012, 0.05), FR, 0, -0.11, -0.004, 0, 0, 0, mag);
  g.scale.setScalar(GUN_SCALE);
  g.traverse((o) => { if (o.isMesh) o.userData.player = true; });
  const eyeY = 0.057;
  return {
    kind: 'pistol', group: g, mag, slide, slideZ0: slide.position.z, reticle: null,
    muzzle: new V3(0, 0.03, 0.135), eye: new V3(0, eyeY, -0.42), sightH: eyeY - 0.03,
    gripWrist: new V3(0, -0.085, -0.085), gripPalm: new V3(0, -0.045, -0.035),
    support: { wrist: new V3(0.04, -0.1, -0.035), palm: new V3(0.022, -0.06, -0.015) },
    port: new V3(-0.02, 0.037, 0.055), magwell: new V3(0, -0.17, -0.055), magLow: new V3(0.03, -0.29, -0.04),
    rack: new V3(0.02, 0.04, -0.07), suppressed: false, brake: false,
  };
}

