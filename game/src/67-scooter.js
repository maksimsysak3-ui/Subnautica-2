// =====================================================================
//  Scooters: hop on (E) and ride through the medina
// =====================================================================
// A two-wheeler handles like one: at speed you steer by leaning (A/D), and the turn follows from the
// lean (radius = v² / g·tanθ), so fast corners need early, deep leans. Below walking pace it wobbles
// and you paddle it round with the bars. SPACE locks the rear wheel to swing the tail out round a
// tight corner; F is the horn (people get out of the way); hit a wall too fast and you're off.
const SCOOTER = (() => {
  const SPOTS = MAP.id === 'bahamas' ? BAHAMAS.jets.map((j) => [...j, 'jet']) : MAP.id === 'manor' ? [] : MAP.id === 'seoul' ? SEOUL.scooters : [[25, -14, 1.2, 0xc8261e], [30, 97, 0.3, 0x2a6ab0], [-6, 50, 3.1, 0xe8e6e0], [48, 9, 1.6, 0x3a8a6a], [-56, 11, -1.4, 0xe8c040], [38, -41, 0.2, 0x2a2a2a], [80, 26, 2.2, 0x8a3a5a], [-112, 2.6, 1.57, 0x4a8ac8]];
  const list = [];
  let riding = null, t = 0, lastLookT = 0, crashT = 0;
  addEventListener('mousemove', () => { lastLookT = performance.now(); });
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.35, metalness: o.m ?? 0.25, ...o.x });
  function model(col) {
    const g = new THREE.Group(), body = mat(col, { r: 0.25, m: 0.35 }), dark = mat(0x1c1c1e, { r: 0.6, m: 0.2 }), chrome = mat(0xd8dade, { r: 0.15, m: 0.95 }), tyre = mat(0x121214, { r: 0.9, m: 0 });
    const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0, p = g) => { const o = M(geo, m, p, x, y, z, rx, ry, rz); o.castShadow = true; return o; };
    // rear body: rounded side panels over the engine, seat, tail light, rack with a crate
    add(new THREE.SphereGeometry(0.3, 14, 10).scale(1, 0.85, 1.6), body, 0, 0.45, -0.32);
    add(new THREE.BoxGeometry(0.42, 0.18, 0.6), body, 0, 0.38, -0.3);
    add(new THREE.BoxGeometry(0.3, 0.12, 0.66), dark, 0, 0.77, -0.25, 0.05);
    add(new THREE.BoxGeometry(0.12, 0.06, 0.04), mat(0xc0201a, { x: { emissive: 0x500808 } }), 0, 0.6, -0.81);
    add(new THREE.BoxGeometry(0.34, 0.025, 0.3), chrome, 0, 0.84, -0.6);
    add(new THREE.BoxGeometry(0.32, 0.26, 0.3), mat(0x8a6a4a, { r: 0.8, m: 0 }), 0, 0.98, -0.6);
    // floorboard + legshield sweeping up to the headset
    add(new THREE.BoxGeometry(0.34, 0.06, 0.62), dark, 0, 0.26, 0.2);
    add(new THREE.BoxGeometry(0.44, 0.62, 0.05), body, 0, 0.6, 0.53, -0.16);
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 10), body, 0, 0.62, 0.62, -0.25);
    // steering: headset, bars, mirrors, headlight, front wheel in the fork (turns as a unit)
    const steer = new THREE.Group(); steer.position.set(0, 0.95, 0.66); steer.rotation.x = -0.25; g.add(steer);
    add(new THREE.BoxGeometry(0.22, 0.14, 0.16), body, 0, 0.06, 0, 0, 0, 0, steer);
    add(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 14), chrome, 0, 0.06, 0.09, Math.PI / 2, 0, 0, steer);
    add(new THREE.CircleGeometry(0.06, 14), mat(0xfff4d0, { x: { emissive: 0xfff0c0, emissiveIntensity: 0.6 } }), 0, 0.06, 0.116, 0, 0, 0, steer);
    add(new THREE.CylinderGeometry(0.014, 0.014, 0.68, 8), chrome, 0, 0.12, -0.02, 0, 0, Math.PI / 2, steer);
    for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), dark, s * 0.3, 0.12, -0.02, 0, 0, Math.PI / 2, steer); add(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6), chrome, s * 0.2, 0.22, -0.02, 0, 0, s * 0.3, steer); add(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 12), chrome, s * 0.24, 0.32, -0.02, Math.PI / 2, 0, 0, steer); }
    const fork = new THREE.Group(); fork.position.set(0, -0.69, 0.06); steer.add(fork);
    add(new THREE.BoxGeometry(0.05, 0.5, 0.05), dark, 0.07, 0.3, 0, 0, 0, 0, fork);
    add(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.8, 0.6, 1.1), body, 0, 0.12, 0, 0, 0, 0, fork);
    const fw = new THREE.Group(); fw.position.set(0, 0, 0); fork.add(fw);
    add(new THREE.TorusGeometry(0.17, 0.055, 8, 18), tyre, 0, 0, 0, 0, Math.PI / 2, 0, fw); add(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12), chrome, 0, 0, 0, 0, 0, Math.PI / 2, fw);
    const rw = new THREE.Group(); rw.position.set(0, 0.22, -0.48); g.add(rw);
    add(new THREE.TorusGeometry(0.17, 0.055, 8, 18), tyre, 0, 0, 0, 0, Math.PI / 2, 0, rw); add(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12), chrome, 0, 0, 0, 0, 0, Math.PI / 2, rw);
    add(new THREE.CylinderGeometry(0.035, 0.045, 0.4, 8), chrome, 0.16, 0.28, -0.62, Math.PI / 2 - 0.15);   // exhaust
    const stand = add(new THREE.BoxGeometry(0.03, 0.28, 0.03), dark, 0.16, 0.12, -0.05, 0, 0, 0.35);
    return { g, steer, fw, rw, stand };
  }
  // a golf cart: the tub, the bench seat and its back, a roof on four posts, the windscreen, the wheel on its column
  function cartModel(col) {
    const g = new THREE.Group(), paint = mat(col, { r: 0.3, m: 0.3 }), seat = mat(0xe8e0d0, { r: 0.85, m: 0 }), dark = mat(0x1c1c1e, { r: 0.6, m: 0.2 }), chrome = mat(0xd8dade, { r: 0.15, m: 0.9 }), tyre = mat(0x121214, { r: 0.9, m: 0 });
    const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0, p = g) => { const o = M(geo, m, p, x, y, z, rx, ry, rz); o.castShadow = true; return o; };
    add(new THREE.BoxGeometry(1.2, 0.36, 2.3), paint, 0, 0.42, 0); add(new THREE.BoxGeometry(1.2, 0.34, 0.55), paint, 0, 0.75, 0.88); add(new THREE.BoxGeometry(1.1, 0.04, 1.1), dark, 0, 0.61, 0.15);
    add(new THREE.BoxGeometry(1.08, 0.16, 0.6), seat, 0, 0.72, -0.3); add(new THREE.BoxGeometry(1.08, 0.5, 0.1), seat, 0, 1.02, -0.6, -0.12);
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.75, 10), dark, 0, 0.98, -0.98, 0.2);   // the golf bag on the back
    for (const [x, z] of [[-0.55, 0.95], [0.55, 0.95], [-0.55, -0.62], [0.55, -0.62]]) add(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), chrome, x, 1.3, z);
    add(new THREE.BoxGeometry(1.28, 0.06, 1.8), paint, 0, 1.97, 0.15); add(new THREE.BoxGeometry(1.08, 0.62, 0.02), mat(0xb8d8e0, { r: 0.05, m: 0.1, x: { transparent: true, opacity: 0.3 } }), 0, 1.45, 0.95, -0.08);
    for (const sx of [-1, 1]) for (const z of [0.78, -0.72]) add(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 12), tyre, sx * 0.58, 0.22, z, 0, 0, Math.PI / 2);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.16, 0.08, 0.04), mat(0xfff4d0, { x: { emissive: 0xfff0c0, emissiveIntensity: 0.4 } }), sx * 0.4, 0.78, 1.16);
    const steer = new THREE.Group(); steer.position.set(0.26, 1.02, 0.38); steer.rotation.x = 0.9; g.add(steer);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), dark, 0, 0, -0.25, Math.PI / 2, 0, 0, steer);
    const wheel = new THREE.Group(); steer.add(wheel); add(new THREE.TorusGeometry(0.16, 0.018, 6, 16), dark, 0, 0, 0, 0, 0, 0, wheel);
    const nop = new THREE.Group(); g.add(nop);
    return { g, steer, wheel, fw: nop, rw: nop, stand: nop, grip: [0.15, 0, 0] };
  }
  function spawn() {
    const carts = MAP.id === 'bahamas' ? BAHAMAS.carts.map((c) => [...c, 'cart']) : [];
    for (const [x, z, yaw, col, kind] of SPOTS.concat(carts)) {
      const jet = kind === 'jet', m = jet ? JET.model(col) : kind === 'cart' ? cartModel(col) : model(col); scene.add(m.g);
      const s = { m, kind, x, z, y: jet ? MAP.waterY : COL.ground(x, z, 0.3), yaw, v: 0, vx: 0, vz: 0, lean: jet || kind === 'cart' ? 0 : 0.22, steer: 0, steerIn: 0, slip: 0, pitch: 0 };
      if (jet && terrainH(s.x, s.z) > MAP.waterY - 0.35) { let b = null; for (let r = 1.5; r < 30 && !b; r += 1.5) for (let k = 0; k < 12 && !b; k++) { const a = k / 12 * Math.PI * 2, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r; if (terrainH(x, z) < MAP.waterY - 0.5) b = [x, z]; } if (b) { s.x = b[0]; s.z = b[1]; } }   // find enough water to float in
      list.push(s);
    }
  }
  const nearest = () => { let b = null, bd = 2.6; for (const s of list) { const d = Math.hypot(s.x - P.pos.x, s.z - P.pos.z); if (d < (s.kind === 'jet' ? 2.4 : s.kind === 'cart' ? 2.6 : 1.9) && d < bd && s !== riding && Math.abs(s.y - P.pos.y) < (s.kind === 'jet' ? 1.8 : 1.2)) { bd = d; b = s; } } return b; };
  function mount(s) {
    riding = s; P.vehicle = s; s.v = 0; s.vx = s.vz = 0;
    s.wasHolstered = P.holstered; if (!P.holstered) DISGUISE.toggleHolster(true);
    P.crouch = false; P.lean = 0; P.yaw = s.yaw; audio.pouch(); s.m.stand.visible = false;
    feed(s.kind === 'jet' ? '<span class="m">W throttle · S reverse · A/D steer · SPACE carve · E get off at a dock or the beach</span>' : s.kind === 'cart' ? '<span class="m">W drive · S brake, then reverse · A/D steer · F horn · E get out</span>' : '<span class="m">W throttle · S brake · A/D lean · SPACE rear brake · F horn · E get off</span>');
  }
  function dismount(force = false) {
    const s = riding; if (!s) return;
    if (!force && Math.hypot(s.vx, s.vz) > 3) return;
    const lx = Math.cos(s.yaw), lz = -Math.sin(s.yaw);   // the scooter's left side
    const out = s.kind === 'cart' ? 1.3 : 0.9; let p = { x: s.x - lx * out, y: s.y, z: s.z - lz * out };
    if (s.kind === 'jet') {
      // step off onto a dock or into water shallow enough to stand in
      p = null;
      // a dry deck or beach first (anywhere within reach), shallow water only if there's nothing better
      for (const ok of [MAP.waterY + 0.15, MAP.waterY - 0.8]) for (let r = 1.2; r <= 4.2 && !p; r += 0.5) for (let k = 0; k < 16 && !p; k++) { const a = k / 16 * Math.PI * 2, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r, g = COL.ground(x, z, 2); if (g > ok) p = { x, y: g, z }; }
      if (!p) { if (!force) feed('<span class="m">TOO DEEP — GET TO A DOCK OR THE BEACH</span>'); if (!force) return; p = { x: s.x, y: s.y, z: s.z }; }
    }
    COL.resolve(p, 0.32, 1.75);
    P.pos.set(p.x, s.kind === 'jet' ? p.y : s.kind === 'cart' ? COL.ground(p.x, p.z, s.y + 0.5) : s.y, p.z); P.vel.set(s.vx * 0.5, 0, s.vz * 0.5);
    riding = null; P.vehicle = null; s.v = 0; s.vx = s.vz = 0; s.m.stand.visible = true;
    audio.engine(false); audio.skid(0);
    if (!s.wasHolstered && !force) DISGUISE.toggleHolster(false);
  }
  function interact() {
    if (riding) { dismount(); return true; }
    const s = nearest(); if (s) { mount(s); return true; }
    return false;
  }
  function horn() { if (!riding) return false; audio.horn(); NPCS.honk(riding.x, riding.z, riding.yaw); return true; }
  // ---------------- riding ----------------
  function drive(dt) {
    if (riding.kind === 'jet') { driveJet(dt); return; }
    if (riding.kind === 'cart') { driveCart(dt); return; }
    const s = riding, keys2 = keys;
    const thr = keys2.KeyW ? 1 : 0, brk = keys2.KeyS ? 1 : 0, rear = keys2.Space ? 1 : 0;
    s.steerIn = damp(s.steerIn, (keys2.KeyA ? 1 : 0) - (keys2.KeyD ? 1 : 0), 6, dt);
    const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    let v = s.vx * fx + s.vz * fz;                         // speed along the heading
    const VMAX = 15;
    if (thr) v += 4.4 * (1 - Math.max(0, v) / VMAX) * dt;
    if (brk) v = v > 0.4 ? v - 7.5 * dt : Math.max(-1.4, v - 2 * dt);   // stop, then walk it backwards
    if (rear) v = v > 0 ? Math.max(0, v - 3.2 * dt) : v;
    v *= Math.exp(-(thr ? 0.04 : 0.22) * dt);
    if (!thr && !brk && Math.abs(v) < 0.15) v = 0;
    // lean: how far you can lean grows with speed; below ~2 m/s it wobbles and you steer the bars
    const leanMax = clamp(Math.abs(v) / 6, 0, 1) * 0.72, wob = Math.abs(v) > 0.3 && Math.abs(v) < 2.4 ? Math.sin(t * 8.5) * 0.06 * (2.4 - Math.abs(v)) : 0;
    s.lean = damp(s.lean, s.steerIn * leanMax + wob, 3.2 + Math.abs(v) * 0.2, dt);
    let yawRate = Math.abs(v) > 2 ? 9.81 * Math.tan(s.lean) / Math.max(2, v) : s.steerIn * 1.5 * clamp(v, -1, 1);
    if (rear && Math.abs(v) > 2.5) yawRate *= 1.9;          // tail out: pivots round the front
    s.yaw += yawRate * dt;
    s.steer = damp(s.steer, Math.abs(v) > 2 ? s.steerIn * 0.12 : s.steerIn * 0.6, 10, dt);
    // tyre grip pulls the velocity onto the new heading; with the rear locked it slides
    // (forward speed is kept; only the sideways part bleeds off, slowly when the rear wheel is locked)
    const nfx = -Math.sin(s.yaw), nfz = -Math.cos(s.yaw), grip = rear ? 1.4 : 12;
    const along = s.vx * nfx + s.vz * nfz, latX = s.vx - along * nfx, latZ = s.vz - along * nfz, keep = Math.exp(-grip * dt);
    const vNew = v + (along - (s.vx * fx + s.vz * fz));   // speed carried round the turn
    s.vx = nfx * vNew + latX * keep; s.vz = nfz * vNew + latZ * keep;
    s.slip = Math.hypot(latX, latZ);
    // move + collide
    const ox = s.x, oz = s.z, p = { x: s.x + s.vx * dt, y: s.y, z: s.z + s.vz * dt };
    COL.resolve(p, 0.42, 1.3);
    const pushX = p.x - (ox + s.vx * dt), pushZ = p.z - (oz + s.vz * dt), push = Math.hypot(pushX, pushZ);
    if (push > 1e-4) {
      const nx = pushX / push, nz = pushZ / push, into = -(s.vx * nx + s.vz * nz);   // speed into the wall
      if (into > 7.5) { crash(into); return; }
      if (into > 2.5) { P.shake = Math.min(1.5, P.shake + into * 0.12); audio.crash(into / 12); }
      s.vx += nx * into * 1.05; s.vz += nz * into * 1.05;   // scrape along it
    }
    s.x = p.x; s.z = p.z; s.y = damp(s.y, COL.ground(s.x, s.z, s.y + 0.45), 14, dt);
    if (terrainH(s.x, s.z) < -0.8) { crash(6); return; }
    // people in the way
    const sp = Math.hypot(s.vx, s.vz);
    if (sp > 3) { NPCS.bump(s.x, s.z, sp); BOTS.ram(s.x, s.z, sp); }
    P.pos.set(s.x, s.y, s.z); P.vel.set(s.vx, 0, s.vz); placeModel(s);
    // the camera settles behind the bars unless you're looking around
    // follow a filtered heading (the low-speed wobble and lean twitches don't reach the camera), only while moving
    s.camYaw = s.camYaw === undefined ? s.yaw : s.camYaw + wrapPI(s.yaw - s.camYaw) * Math.min(1, dt * 3);
    if (performance.now() - lastLookT > 1200 && Math.abs(v) > 1.2) P.yaw += wrapPI(s.camYaw - P.yaw) * Math.min(1, dt * 3.5);
    audio.engine(true, clamp(Math.abs(v) / VMAX, 0, 1) * 0.8 + thr * 0.2, thr);
    audio.skid(clamp((s.slip - 0.8) / 4, 0, 1) * (sp > 2 ? 1 : 0));
    if (thr && sp > 1) P.shake = Math.min(0.3, P.shake + dt * 0.4);
  }
  // on the water: JET does the hull, the water and the spray; here it's what riding it does to you
  function driveJet(dt) {
    const s = riding, { sp, VMAX } = JET.drive(s, dt, keys), thr = keys.KeyW ? 1 : 0;
    if (sp > 3) { NPCS.bump(s.x, s.z, sp); BOTS.ram(s.x, s.z, sp); }
    P.pos.set(s.x, s.y, s.z); P.vel.set(s.vx, 0, s.vz); placeModel(s);
    s.camYaw = s.camYaw === undefined ? s.yaw : s.camYaw + wrapPI(s.yaw - s.camYaw) * Math.min(1, dt * 2.6);
    if (performance.now() - lastLookT > 1200 && sp > 1.2) P.yaw += wrapPI(s.camYaw - P.yaw) * Math.min(1, dt * 3);
    audio.engine(true, clamp(sp / VMAX, 0, 1) * 0.9 + thr * 0.25 + (s.air ? 0.15 : 0), thr);
    if (sp > 4 && !s.air) P.shake = Math.min(0.18, P.shake + dt * 0.12 * sp / VMAX);
  }
  // a golf cart: electric, about 30 km/h flat out, steers like a car (no lean, no slide); it won't go into the sea
  // or onto the jetties, and it bumps off walls rather than throwing you
  function driveCart(dt) {
    const s = riding, thr = keys.KeyW ? 1 : 0, brk = keys.KeyS ? 1 : 0, VMAX = 8.5;
    s.steerIn = damp(s.steerIn, (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0), 5, dt);
    const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    let v = s.vx * fx + s.vz * fz;
    if (thr) v += 3.2 * (1 - Math.max(0, v) / VMAX) * dt;
    if (brk) v = v > 0.3 ? v - 6 * dt : Math.max(-2.5, v - 2.5 * dt);
    v *= Math.exp(-(thr || brk ? 0.05 : 0.6) * dt); if (!thr && !brk && Math.abs(v) < 0.1) v = 0;
    const lock = 0.55 * (1 - 0.45 * clamp(Math.abs(v) / VMAX, 0, 1));
    s.yaw += v * Math.tan(s.steerIn * lock) / 1.9 * dt;   // wheelbase 1.9 m
    const nfx = -Math.sin(s.yaw), nfz = -Math.cos(s.yaw);
    s.vx = nfx * v; s.vz = nfz * v;
    const p = { x: s.x + s.vx * dt, y: s.y, z: s.z + s.vz * dt };
    if (MAP.waterY !== undefined && terrainH(p.x, p.z) < MAP.waterY - 0.1) { s.vx = s.vz = 0; p.x = s.x; p.z = s.z; }   // the water's edge
    COL.resolve(p, 0.75, 1.5);
    const pushX = p.x - (s.x + s.vx * dt), pushZ = p.z - (s.z + s.vz * dt), push = Math.hypot(pushX, pushZ);
    if (push > 1e-4) { const nx = pushX / push, nz = pushZ / push, into = -(s.vx * nx + s.vz * nz); if (into > 3.5) { P.shake = Math.min(1.2, P.shake + into * 0.1); audio.crash(into / 14); } s.vx += nx * into; s.vz += nz * into; }
    s.x = p.x; s.z = p.z; s.y = damp(s.y, COL.ground(s.x, s.z, s.y + 0.45), 14, dt);
    const sp = Math.hypot(s.vx, s.vz);
    s.lean = damp(s.lean, -s.steerIn * clamp(sp / VMAX, 0, 1) * 0.05, 4, dt); s.steer = damp(s.steer, s.steerIn * 1.6, 8, dt);
    if (sp > 2.5) { NPCS.bump(s.x, s.z, sp); BOTS.ram(s.x, s.z, sp); }
    P.pos.set(s.x, s.y, s.z); P.vel.set(s.vx, 0, s.vz); placeModel(s);
    s.camYaw = s.camYaw === undefined ? s.yaw : s.camYaw + wrapPI(s.yaw - s.camYaw) * Math.min(1, dt * 3);
    if (performance.now() - lastLookT > 1200 && sp > 1.2) P.yaw += wrapPI(s.camYaw - P.yaw) * Math.min(1, dt * 3.5);
    audio.engine(true, clamp(sp / VMAX, 0, 1) * 0.35 + thr * 0.1, thr);
  }
  function crash(speed) {
    const s = riding;
    audio.crash(1); audio.skid(0);
    P.shake = 1.6; P.feel.vland -= 12; crashT = 1.2;
    const dmg = Math.round((speed - 6) * 9);
    s.lean = 1.35; s.v = 0;
    dismount(true);
    P.vel.set(-s.vx * 0.15, 0, -s.vz * 0.15); s.vx = s.vz = 0;
    if (dmg > 0) BOTS.hurt(dmg);
    feed('<span class="m">CRASHED</span>');
  }
  // ---------------- the rider: seated, feet on the floorboard, hands on the grips ----------------
  const _xAxis = new V3(1, 0, 0), _q = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _e = new THREE.Euler(), _a = new V3(), _b = new V3(), _c = new V3();
  function placeModel(s) {
    _q.setFromEuler(_e.set(0, s.yaw + Math.PI, 0)); _qr.setFromAxisAngle(T.fwd, -s.lean); _q.multiply(_qr); if (s.pitch) { _qr.setFromAxisAngle(_xAxis, -s.pitch); _q.multiply(_qr); }
    s.m.g.position.set(s.x, s.y, s.z); s.m.g.quaternion.copy(_q);
    if (s.m.wheel) s.m.wheel.rotation.z = -s.steer; else s.m.steer.rotation.y = s.steer;
  }
  function poseRider(dt) {
    const s = riding, c = ch, d = c.d;
    c.root.position.set(s.x, s.y, s.z); c.root.quaternion.copy(s.m.g.quaternion);
    const jet = s.kind === 'jet', cart = s.kind === 'cart', spd = Math.hypot(s.vx, s.vz);
    c.pelvis.position.set(cart ? 0.26 : 0, jet ? 0.6 + (s.air ? 0.12 : 0) : cart ? 0.86 : 0.8, jet ? -0.32 : cart ? -0.3 : -0.2); c.pelvis.rotation.set(0, 0, 0);
    // on the jetski you hunch over the bars as it gets going and throw your weight into the turn
    if (jet) c.spine.rotation.set(0.28 + clamp(spd / 24, 0, 1) * 0.22, s.steerIn * 0.12, s.steerIn * 0.28 * clamp(spd / 8, 0.3, 1));
    else c.spine.rotation.set(0.1 + Math.min(0.1, spd * 0.008), 0, s.steerIn * 0.08);
    c.head.rotation.set(-0.2 - P.pitch * 0.6, clamp(wrapPI(P.yaw - s.yaw), -1.2, 1.2), 0);
    c.root.updateMatrixWorld(true);
    for (const [leg, hipA, side] of [[c.legL, c.hipL, 1], [c.legR, c.hipR, -1]]) {
      const hip = toRoot(hipA, T.a), foot = jet ? _c.set(side * 0.34, 0.34 + d.ankle * 0.5, 0.02) : cart ? _c.set(0.26 + side * 0.16, 0.62 + d.ankle * 0.5, 0.42) : _c.set(side * 0.15, 0.3 + d.ankle * 0.5, 0.26);
      ik(hip, foot, d.thigh, d.shin, T.pole.set(side * 0.1, 0.2, 1), T.mid, T.end);
      placeSeg(leg.thigh, hip, T.mid, T.fwd); placeSeg(leg.shin, T.mid, T.end, T.fwd);
      leg.foot.position.copy(T.end); leg.foot.rotation.set(0.1, 0, 0);
    }
    s.m.g.updateMatrixWorld(true);
    for (const [arm, shA, side] of [[c.armL, c.shL, 1], [c.armR, c.shR, -1]]) {
      const gp = s.m.grip, grip = c.root.worldToLocal(s.m.steer.localToWorld(gp ? _b.set(side * gp[0], gp[1], gp[2]) : _b.set(side * 0.31, 0.12, -0.02)));
      placeArm(arm, toRoot(shA, _a), grip, null, T.pole.set(side * 0.6, -1, -0.6), T.fwd);
    }
    if (gun) gun.group.visible = false;
    c.head.visible = P.fpT < 0.5;
  }
  function update(dt) {
    t += dt; crashT = Math.max(0, crashT - dt);
    if (!MAP.ready) return;
    if (!list.length) spawn();
    for (const s of list) {
      if (s === riding) continue;
      if (s.kind === 'jet') { const tt = performance.now() / 1000; s.vx *= Math.exp(-1.5 * dt); s.vz *= Math.exp(-1.5 * dt); if (terrainH(s.x + s.vx * dt, s.z + s.vz * dt) < MAP.waterY - 0.25) { s.x += s.vx * dt; s.z += s.vz * dt; } s.y = MAP.waterY + waveH(s.x, s.z, tt); s.lean = damp(s.lean, Math.sin(tt * 1.2 + s.x) * 0.05, 2, dt); s.pitch = Math.sin(tt * 1.6 + s.z) * 0.03; placeModel(s); continue; }
      if (s.kind === 'cart') { const sp = Math.hypot(s.vx, s.vz); if (sp > 0.05) { s.vx *= Math.exp(-3 * dt); s.vz *= Math.exp(-3 * dt); const p = { x: s.x + s.vx * dt, y: s.y, z: s.z + s.vz * dt }; COL.resolve(p, 0.75, 1.5); s.x = p.x; s.z = p.z; } s.lean = 0; placeModel(s); continue; }
      // parked (or dropped): settle onto the stand, roll to a stop
      const sp = Math.hypot(s.vx, s.vz);
      if (sp > 0.05) { s.vx *= Math.exp(-2 * dt); s.vz *= Math.exp(-2 * dt); const p = { x: s.x + s.vx * dt, y: s.y, z: s.z + s.vz * dt }; COL.resolve(p, 0.42, 1.3); s.x = p.x; s.z = p.z; }
      s.lean = damp(s.lean, s.lean > 0.9 ? 1.35 : 0.22, 4, dt); s.steer = damp(s.steer, 0.35, 4, dt);
      placeModel(s);
    }
    if (riding && mode === 'range') {
      if (P.dead) { dismount(true); return; }
      placeModel(riding);
    }
  }
  return {
    update, drive, interact, horn, poseRider, placeModel,
    get riding() { return riding; },
    prompt: () => { if (riding) return ''; const n = nearest(); return n ? (n.kind === 'jet' ? '[E]  RIDE THE JETSKI' : n.kind === 'cart' ? '[E]  DRIVE THE GOLF CART' : '[E]  RIDE THE SCOOTER') : ''; },
    camRoll: () => (riding ? -riding.lean * 0.18 : 0),   // a hint of the lean in first person; the horizon mostly stays put
  };
})();
