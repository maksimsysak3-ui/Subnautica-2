// =====================================================================
//  Weapons + player state
// =====================================================================
const G = 9.81;
const WEAPONS = {
  rifle: { name: 'M4A1 CARBINE', build: buildRifle, hold: 'shoulder', rpm: 800, modes: ['AUTO', 'SEMI', 'BURST'], cap: 30, reserve: 240,
    v: 880, drag: 0.8, pellets: 1, choke: 0, mass: 1, spread: [0.024, 0.0011], recoil: { z: 1.4, rx: 2.6, ry: 0.8, cam: 0.36, climb: 0.0042 },
    reload: 'mag', tracer: 3, zero: 50, ads: [52, 46], casing: 'rifle' },
  shotgun: { name: 'M870 SHOTGUN', build: buildShotgun, hold: 'shoulder', rpm: 300, modes: ['PUMP'], cap: 7, reserve: 42,
    v: 400, drag: 2.2, pellets: 9, choke: 0.032, mass: 0.32, spread: [0.02, 0.005], recoil: { z: 2.9, rx: 5.6, ry: 1.3, cam: 0.95, climb: 0.012 },
    reload: 'shell', tracer: 0, zero: 25, ads: [56, 52], casing: 'shell' },
  pistol: { name: 'G17 PISTOL', build: buildPistol, hold: 'pistol', rpm: 600, modes: ['SEMI'], cap: 17, reserve: 102,
    v: 375, drag: 1.1, pellets: 1, choke: 0, mass: 0.6, spread: [0.03, 0.0025], recoil: { z: 0.7, rx: 5.2, ry: 1.1, cam: 0.5, climb: 0.006 },
    reload: 'mag', tracer: 0, zero: 15, ads: [58, 54], casing: 'pistol' },
  // bolt action: every shot is followed by a ~0.8 s bolt cycle; one body hit drops a man, scope at ~9x
  sniper: { name: 'M24 SNIPER', build: buildSniper, hold: 'shoulder', rpm: 50, modes: ['BOLT'], cap: 5, reserve: 40, bolt: true,
    v: 850, drag: 0.32, pellets: 1, choke: 0, mass: 1.6, dmg: 3.2, spread: [0.055, 0.00022], recoil: { z: 3.2, rx: 7.5, ry: 1.0, cam: 1.0, climb: 0.018 },
    reload: 'mag', tracer: 0, zero: 100, ads: [8, 8], casing: 'rifle', scope: true },
};
const ORDER = ['rifle', 'shotgun', 'pistol', 'sniper'];
const P = {
  pos: new V3(0, 0, -2.5), vel: new V3(), yaw: 0, pitch: 0,
  crouch: false, crouchT: 0, sprintT: 0, ads: false, adsT: 0, fp: false, fpT: 0, lowT: 0,
  phase: 0, gaitW: 0, prevU: [0, 0], camY: 1.6,
  w: 'rifle', inv: {}, burst: 0, nextShot: 0, trigger: false, edge: false,
  reload: null, swap: null, pump: null, boltT: 0, slideT: 0,
  kick: { z: 0, vz: 0, rx: 0, vrx: 0, ry: 0, vry: 0 }, cr: { p: 0, vp: 0, y: 0, vy: 0 }, bloom: 0,
  sway: { x: 0, vx: 0, y: 0, vy: 0 }, feel: { land: 0, vland: 0, hit: 0, vhit: 0, hitSide: 1, yawRate: 0, lastYaw: 0 }, air: false, shake: 0, lean: 0, leanT: 0, stamina: 1, breath: 1, holdBreath: false, winded: 0,
  stats: { shots: 0, hits: 0, score: 0 }, infinite: true, sens: 1, flashT: 0, shotId: 0, lastHitShot: -1,
};
function freshInv() { for (const id of ORDER) P.inv[id] = { mag: WEAPONS[id].cap, chamber: 1, reserve: WEAPONS[id].reserve, locked: false, mode: 0 }; }
freshInv();
const inv = () => P.inv[P.w];
const WD = () => WEAPONS[P.w];
let mode = 'custom', paused = false, locked = false, lockFallback = false;
let pose = 'ready', turntable = false;
const orbit = { yaw: 0.5, pitch: 0.1, dist: 3.6, tyaw: 0.5, tpitch: 0.1, tdist: 3.6 };
let ch = null, gun = null, guns = {}, holsterModel = null;
const bullets = [];

const T = { a: new V3(), b: new V3(), c: new V3(), d: new V3(), e: new V3(), mid: new V3(), end: new V3(), pole: new V3(), fwd: new V3(0, 0, 1),
  q: new THREE.Quaternion(), q2: new THREE.Quaternion(), camQ: new THREE.Quaternion(), aim: new V3(), camBase: new V3(), camFwd: new V3() };
const ray = new THREE.Raycaster();

function shellMesh() {
  const s = new THREE.Group();
  M(new THREE.CylinderGeometry(0.0105, 0.0105, 0.058, 7), SLOT.hull, s, 0, 0.004, 0);
  M(new THREE.CylinderGeometry(0.0108, 0.0108, 0.014, 7), SLOT.brass, s, 0, -0.028, 0);
  return s;
}
function rebuild() {
  if (ch) { scene.remove(ch.root); disposeTree(ch.root); }
  gun = null;
  ch = buildCharacter(cfg);
  ch.spine.rotation.order = 'YXZ'; ch.head.rotation.order = 'YXZ'; ch.pelvis.rotation.order = 'YXZ';
  scene.add(ch.root);
  rebuildGuns();
  applyColors(cfg);
}
function rebuildGuns() {
  for (const id in guns) {
    const g = guns[id];
    if (g.group.parent) g.group.parent.remove(g.group);
    disposeTree(g.group);
    scene.remove(g.handItem);
  }
  if (holsterModel) { holsterModel.parent && holsterModel.parent.remove(holsterModel); disposeTree(holsterModel); holsterModel = null; }
  if (flash.parent) flash.parent.remove(flash);
  for (let i = props.length - 1; i >= 0; i--) if (props[i].kind === 'mag') { scene.remove(props[i].obj); props.splice(i, 1); }
  guns = {};
  for (const id of ORDER) {
    const g = WEAPONS[id].build(cfg);
    g.handItem = g.mag ? g.mag.clone() : shellMesh();
    g.handItem.scale.setScalar(GUN_SCALE); g.handItem.visible = false; scene.add(g.handItem);
    guns[id] = g;
  }
  if (ch.holster) { holsterModel = buildPistol(cfg).group; ch.holster.add(holsterModel); }
  gun = null;
  equip(P.w);
}
// weapon light (night maps): L clicks a torch under the barrel on and off — a real spotlight, the lens
// glowing, and its beam hanging in the rain
const TORCH = (() => {
  const light = new THREE.SpotLight(0xfff2dc, 0, 46, 0.34, 0.6, 1.4), tgt = new THREE.Object3D();
  light.target = tgt; tgt.position.set(0, 0, 10); light.castShadow = false;
  const body = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.5, metalness: 0.6 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.11, 10), dark); tube.rotation.x = Math.PI / 2; body.add(tube);
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.018, 0.025, 12), dark); bezel.rotation.x = Math.PI / 2; bezel.position.z = 0.065; body.add(bezel);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x404040, toneMapped: false }), lens = new THREE.Mesh(new THREE.CircleGeometry(0.017, 12), lensMat); lens.position.z = 0.0785; body.add(lens);
  const fadeTex = canvasTex(4, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const beamGeo = new THREE.ConeGeometry(2.4, 14, 20, 1, true); beamGeo.rotateX(-Math.PI / 2); beamGeo.translate(0, 0, 7.08);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xfff0d8, alphaMap: fadeTex, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  beam.renderOrder = 5; body.add(beam, light, tgt);
  let on = false, k = 0;
  return {
    mount(g) { body.position.set(0.034, -0.012, Math.max(0.12, g.muzzle.z - 0.16)); g.group.add(body); },
    toggle() { if (!MAP.night) return; on = !on; audio.dry(); feed(`<span class="m">WEAPON LIGHT ${on ? 'ON' : 'OFF'}</span>`); },
    update(dt) {
      const want = on && mode === 'range' && !P.holstered && !P.dead && !P.vehicle ? 1 : 0;
      k = want ? 1 : Math.max(0, k - dt * 12);   // clicks on, dies off in a blink
      light.intensity = k * 70; light.visible = k > 0; beam.visible = k > 0.02; beam.material.opacity = 0.05 * k * (P.fpT > 0.5 && P.adsT > 0.5 ? 0.35 : 1);
      lensMat.color.setScalar(0.25 + k * 3);
    },
    get on() { return on; },
  };
})();
function equip(id) {
  if (gun) { ch.root.remove(gun.group); gun.handItem.visible = false; if (gun.mag) gun.mag.visible = true; }
  P.w = id; gun = guns[id];
  ch.root.add(gun.group);
  flash.position.copy(gun.muzzle); gun.group.add(flash); TORCH.mount(gun);
  if (gun.mag) gun.mag.visible = true;
  P.reload = null; P.burst = 0;
  if (holsterModel) holsterModel.visible = id !== 'pistol';
}
function switchTo(id) {
  if (mode !== 'range') { equip(id); return; }
  if (P.swap) { P.swap.to = id; return; }
  if (id === P.w) return;
  if (P.reload && gun.mag) gun.mag.visible = true;
  P.reload = null; P.burst = 0; gun.handItem.visible = false;
  P.swap = { t: 0, to: id, done: false, k: 0 };
  audio.holster();
}

// ---------------------------------------------------------------------
//  Pose helpers
// ---------------------------------------------------------------------
const toRoot = (obj, out) => ch.root.worldToLocal(obj.getWorldPosition(out));
const gunToRoot = (p, out) => out.copy(p).applyMatrix4(gun.group.matrix);
function lookQuat(dir, out) { _m1.lookAt(dir, _v5.set(0, 0, 0), UP); return out.setFromRotationMatrix(_m1); }

function poseBody(dt, time, o) {
  const d = ch.d;
  const lv = o.localVel, speed = Math.hypot(lv.x, lv.z);
  P.gaitW = damp(P.gaitW, clamp(speed / 1.2, 0, 1), 8, dt);
  const L = clamp(0.3 + speed * 0.13, 0.3, 1.05) * (1 - o.crouchT * 0.35);
  if (speed > 0.05) P.phase += dt * Math.PI * speed / L;
  const breath = Math.sin(time * (1.7 + P.winded * 1.6)) * (1 + P.winded * 2.5);
  const bob = P.gaitW * 0.028 * Math.abs(Math.sin(P.phase));
  const pelYaw = -0.2 * o.bladed + Math.sin(P.phase) * 0.08 * P.gaitW;
  const spYaw = -0.3 * o.bladed - Math.sin(P.phase) * 0.12 * P.gaitW;
  ch.pelvis.position.set(0, d.hipY - o.crouchT * d.hipY * 0.3 - bob + breath * 0.002, 0);
  ch.pelvis.rotation.set(0, pelYaw, 0);
  ch.spine.rotation.set(o.lean + breath * 0.01, spYaw, (o.side || 0) * 0.26);
  ch.head.rotation.set(-o.lookPitch * 0.55 - o.lean * 0.6, -(pelYaw + spYaw) * 0.95, -(o.side || 0) * 0.12);
  ch.root.updateMatrixWorld(true);

  const dir = T.d.set(lv.x, 0, lv.z);
  if (speed > 0.01) dir.divideScalar(speed);
  const legs = [[ch.legL, ch.hipL, 1, 0], [ch.legR, ch.hipR, -1, Math.PI]];
  legs.forEach(([leg, hipA, side, off], i) => {
    const hip = toRoot(hipA, T.a);
    const u = (((P.phase + off) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let along, lift = 0;
    if (u < Math.PI) along = L / 2 - L * (u / Math.PI);
    else { const q = (u - Math.PI) / Math.PI; along = -L / 2 + L * smooth(q); lift = Math.sin(q * Math.PI); }
    if (u < P.prevU[i] - Math.PI && P.gaitW > 0.4 && mode === 'range') audio.step(P.crouchT > 0.5, P.sprintT);
    P.prevU[i] = u;
    const st = T.b.set(side * (d.hipX + 0.025 + 0.04 * o.bladed + 0.05 * o.crouchT), d.ankle, 0);
    st.z += side > 0 ? 0.1 * o.bladed + 0.24 * o.crouchT : -0.08 * o.bladed - 0.12 * o.crouchT;
    st.addScaledVector(dir, along * P.gaitW);
    st.y += lift * (0.11 + 0.05 * o.sprintT) * P.gaitW;
    T.pole.set(side * 0.2, 0, 1);
    ik(hip, st, d.thigh, d.shin, T.pole, T.mid, T.end);
    placeSeg(leg.thigh, hip, T.mid, T.fwd);
    placeSeg(leg.shin, T.mid, T.end, T.fwd);
    leg.foot.position.copy(T.end);
    leg.foot.rotation.set(-lift * 0.35 * P.gaitW, side * 0.12 + pelYaw * 0.6, 0, 'YXZ');
  });
}

function placeArm(arm, sh, wrist, palm, pole, handZ) {
  const d = ch.d;
  ik(sh, wrist, d.upper, d.fore, pole, T.mid, T.end);
  placeSeg(arm.upper, sh, T.mid, T.fwd);
  placeSeg(arm.fore, T.mid, T.end, T.fwd);
  if (palm) placeSeg(arm.hand, T.end, palm, handZ);
  else placeSeg(arm.hand, T.end, T.c.subVectors(T.end, T.mid).normalize().multiplyScalar(d.hand).add(T.end), handZ);
}

// ---------------------------------------------------------------------
//  Reload choreography (left-hand path + gun tilt, all procedural)
// ---------------------------------------------------------------------
const RELOADS = {
  rifle: {
    tac: { dur: 2.0, keys: [[0, 'support', 0], [0.2, 'support', 1], [0.55, 'pouch', 1], [0.82, 'pouch', 1], [1.15, 'magLow', 1], [1.32, 'magwell', 1], [1.48, 'magwell', 1], [1.75, 'support', 0.45], [2.0, 'support', 0]],
      ev: [[0.22, 'magOut'], [0.6, 'pouch'], [0.82, 'grab'], [1.32, 'magIn'], [2.0, 'done']] },
    empty: { dur: 2.55, keys: [[0, 'support', 0], [0.2, 'support', 1], [0.55, 'pouch', 1], [0.82, 'pouch', 1], [1.15, 'magLow', 1], [1.32, 'magwell', 1], [1.46, 'magwell', 1], [1.7, 'bolt', 1], [1.86, 'bolt', 0.9], [2.2, 'support', 0.4], [2.55, 'support', 0]],
      ev: [[0.22, 'magOut'], [0.6, 'pouch'], [0.82, 'grab'], [1.32, 'magIn'], [1.76, 'bolt'], [2.55, 'done']] },
  },
  sniper: {
    tac: { dur: 2.4, keys: [[0, 'support', 0], [0.25, 'support', 1], [0.6, 'pouch', 1], [0.95, 'pouch', 1], [1.35, 'magLow', 1], [1.55, 'magwell', 1], [1.75, 'magwell', 1], [2.05, 'support', 0.45], [2.4, 'support', 0]],
      ev: [[0.27, 'magOut'], [0.65, 'pouch'], [0.95, 'grab'], [1.55, 'magIn'], [2.4, 'done']] },
    empty: { dur: 3.0, keys: [[0, 'support', 0], [0.25, 'support', 1], [0.6, 'pouch', 1], [0.95, 'pouch', 1], [1.35, 'magLow', 1], [1.55, 'magwell', 1], [1.75, 'magwell', 1], [2.05, 'bolt', 1], [2.4, 'bolt', 0.9], [2.7, 'support', 0.4], [3.0, 'support', 0]],
      ev: [[0.27, 'magOut'], [0.65, 'pouch'], [0.95, 'grab'], [1.55, 'magIn'], [2.2, 'bolt'], [3.0, 'done']] },
  },
  pistol: {
    tac: { dur: 1.45, keys: [[0, 'support', 0], [0.14, 'support', 1], [0.45, 'pouch', 1], [0.62, 'pouch', 1], [0.9, 'magLow', 1], [1.02, 'magwell', 1], [1.12, 'magwell', 1], [1.3, 'support', 0.4], [1.45, 'support', 0]],
      ev: [[0.16, 'magOut'], [0.5, 'pouch'], [0.62, 'grab'], [1.02, 'magIn'], [1.45, 'done']] },
    empty: { dur: 1.85, keys: [[0, 'support', 0], [0.14, 'support', 1], [0.45, 'pouch', 1], [0.62, 'pouch', 1], [0.9, 'magLow', 1], [1.02, 'magwell', 1], [1.12, 'magwell', 0.8], [1.3, 'rack', 0.6], [1.42, 'rackBack', 0.6], [1.62, 'support', 0.3], [1.85, 'support', 0]],
      ev: [[0.16, 'magOut'], [0.5, 'pouch'], [0.62, 'grab'], [1.02, 'magIn'], [1.42, 'slide'], [1.85, 'done']] },
  },
};
const SHELL = { inT: 0.3, cycle: 0.55, outT: 0.35 };
const SHELL_KEYS = [[0, 'loadPort', 1], [0.2, 'pouch', 1], [0.36, 'loadLow', 1], [0.47, 'loadPort', 1], [0.55, 'loadPort', 1]];
function reloadSeg(r) {
  if (r.type === 'shell') {
    if (r.phase === 'in') return { a: [0, 'support', 0], b: [1, 'support', 1], u: smooth(clamp(r.t / SHELL.inT, 0, 1)) };
    if (r.phase === 'out') return { a: [0, 'loadPort', 1], b: [1, 'support', 0], u: smooth(clamp(r.ot / SHELL.outT, 0, 1)) };
    let k = 0;
    while (k < SHELL_KEYS.length - 2 && r.ct >= SHELL_KEYS[k + 1][0]) k++;
    const a = k === 0 && r.n === 0 ? [0, 'support', 1] : SHELL_KEYS[k], b = SHELL_KEYS[k + 1];
    return { a, b, u: smooth(clamp((r.ct - a[0]) / (b[0] - a[0]), 0, 1)) };
  }
  const keys = r.def.keys;
  let k = 0;
  while (k < keys.length - 2 && r.t >= keys[k + 1][0]) k++;
  const a = keys[k], b = keys[k + 1];
  return { a, b, u: smooth(clamp((r.t - a[0]) / (b[0] - a[0]), 0, 1)) };
}
const pumpOff = () => (P.pump ? pumpK(P.pump.t) : 0) * -0.085;
function supportPt(p, out) { out.copy(p); if (gun.supportOnPump) out.z += pumpOff(); return gunToRoot(out, out); }
function lhWrist(name, out) {
  if (name === 'pouch') return toRoot(P.w === 'pistol' ? ch.beltPouch : ch.pouch, out);
  if (name === 'support') return supportPt(gun.support.wrist, out);
  const p = { magLow: gun.magLow, magwell: gun.magwell, bolt: gun.boltCatch, loadPort: gun.loadPort, loadLow: gun.loadLow, rack: gun.rack, rackBack: gun.rack }[name];
  gunToRoot(p, out);
  if (name === 'rackBack') out.add(T.e.set(0, 0, -0.05).applyQuaternion(gun.group.quaternion));
  return out;
}
function lhPalm(name, out) {
  if (name === 'support') return supportPt(gun.support.palm, out);
  lhWrist(name, out);
  if (name === 'pouch') return out.y += 0.08, out;
  if (name === 'bolt') return out.add(T.e.set(-0.03, 0.02, 0.08).applyQuaternion(gun.group.quaternion));
  if (name === 'rack' || name === 'rackBack') return out.add(T.e.set(-0.02, 0.03, 0.02).applyQuaternion(gun.group.quaternion));
  return out.add(T.e.set(0, 0.08, 0).applyQuaternion(gun.group.quaternion));
}

function startReload() {
  if (P.reload || P.swap || mode !== 'range') return;
  const I = inv(), W = WD();
  if (!P.infinite && I.reserve <= 0) return;
  if (W.reload === 'shell') {
    if (I.mag >= W.cap || P.pump) return;
    P.reload = { type: 'shell', t: 0, phase: 'in', ct: 0, ot: 0, n: 0, stop: false };
  } else {
    if (I.mag >= W.cap && I.chamber) return;
    P.reload = { type: 'mag', def: I.chamber ? RELOADS[P.w].tac : RELOADS[P.w].empty, t: 0 };
  }
  P.burst = 0;
}
function takeAmmo(n) {
  const I = inv();
  const take = P.infinite ? n : Math.min(n, I.reserve);
  if (!P.infinite) I.reserve -= take;
  return take;
}
function reloadEvent(e) {
  const I = inv();
  if (e === 'magOut') {
    gun.group.updateMatrixWorld(true);
    const m = gun.mag.clone();
    gun.mag.getWorldPosition(m.position); gun.mag.getWorldQuaternion(m.quaternion); m.scale.setScalar(GUN_SCALE);
    const down = T.e.set(0, -1, 0).applyQuaternion(gun.group.getWorldQuaternion(T.q2));
    spawnProp(m, down.multiplyScalar(1.4).add(P.vel), new V3(rand(-4, 4), rand(-2, 2), rand(-4, 4)), { r: P.w === 'pistol' ? 0.013 : 0.02, rest: 0.25, life: 40, kind: 'mag' });
    gun.mag.visible = false;
    audio.magOut(P.w === 'pistol');
  } else if (e === 'pouch') audio.pouch();
  else if (e === 'grab') gun.handItem.visible = true;
  else if (e === 'magIn') {
    gun.handItem.visible = false; gun.mag.visible = true;
    I.mag = takeAmmo(WD().cap);
    audio.magIn(P.w === 'pistol');
  } else if (e === 'bolt' || e === 'slide') {
    I.locked = false;
    if (I.mag > 0) { I.mag--; I.chamber = 1; }
    if (e === 'slide') P.slideT = 1;
    audio.boltRelease(e === 'slide');
  } else if (e === 'done') P.reload = null;
}
function updateShellReload(dt) {
  const r = P.reload, I = inv(), W = WD();
  r.t += dt;
  if (r.phase === 'in') { if (r.t >= SHELL.inT) { r.phase = 'cycle'; r.ct = 0; } return; }
  if (r.phase === 'cycle') {
    const c0 = r.ct; r.ct += dt;
    if (c0 < 0.2 && r.ct >= 0.2) { gun.handItem.visible = true; audio.pouch(); }
    if (c0 < 0.47 && r.ct >= 0.47) { gun.handItem.visible = false; if (takeAmmo(1)) I.mag++; audio.shellIn(); }
    if (r.ct >= SHELL.cycle) {
      r.ct -= SHELL.cycle; r.n++;
      if (r.stop || I.mag >= W.cap || (!P.infinite && I.reserve <= 0)) { r.phase = 'out'; r.ot = 0; }
    }
    return;
  }
  r.ot += dt;
  if (r.ot >= SHELL.outT) { P.reload = null; if (!I.chamber && I.mag > 0) P.pump = { t: 0, hull: false }; }
}
// pump stroke: rearward 0.05-0.17 s, forward 0.22-0.34 s
function pumpK(t) {
  if (t < 0.05) return 0;
  if (t < 0.17) return smooth((t - 0.05) / 0.12);
  if (t < 0.22) return 1;
  if (t < 0.34) return 1 - smooth((t - 0.22) / 0.12);
  return 0;
}
// bolt cycle: lift + draw back (casing out), push + lock (next round in)
function updateBoltCycle(dt) {
  const c = P.cycle, t0 = c.t, I = inv();
  c.t += dt;
  const k = c.t < 0 ? 0 : c.t < 0.15 ? c.t / 0.15 : c.t < 0.55 ? 1 : c.t < 0.72 ? 1 - (c.t - 0.55) / 0.17 : 0;
  const pull = c.t < 0.15 ? 0 : c.t < 0.32 ? (c.t - 0.15) / 0.17 : c.t < 0.45 ? 1 : c.t < 0.58 ? 1 - (c.t - 0.45) / 0.13 : 0;
  if (gun.bolt) { gun.bolt.rotation.z = -k * 1.1; gun.bolt.position.z = -0.035 - pull * 0.09; }
  if (t0 < 0.15 && c.t >= 0.15) { audio.pump(0); P.kick.vrx += 0.6; }
  if (t0 < 0.3 && c.t >= 0.3) ejectCasing('rifle');
  if (t0 < 0.5 && c.t >= 0.5) { audio.pump(1); if (!I.chamber && I.mag > 0) { I.mag--; I.chamber = 1; } P.kick.vrx -= 0.4; }
  if (c.t >= 0.78) { P.cycle = null; if (gun.bolt) { gun.bolt.rotation.z = 0; gun.bolt.position.z = -0.035; } }
}
function updatePump(dt) {
  const p = P.pump, t0 = p.t, I = inv();
  p.t += dt;
  if (t0 < 0.12 && p.t >= 0.12) {
    audio.pump(0);
    if (p.hull) ejectCasing('shell');
  }
  if (t0 < 0.3 && p.t >= 0.3) { audio.pump(1); if (!I.chamber && I.mag > 0) { I.mag--; I.chamber = 1; } }
  if (p.t >= 0.4) P.pump = null;
}

function poseGun(dt, aimDirRoot, lowT, relaxed) {
  const d = ch.d;
  gun.group.visible = !relaxed;
  if (relaxed) {
    for (const [arm, shA, side] of [[ch.armL, ch.shL, 1], [ch.armR, ch.shR, -1]]) {
      const sh = toRoot(shA, T.a);
      const sw = Math.sin(P.phase) * 0.12 * P.gaitW * side;
      T.b.set(sh.x + side * 0.045, sh.y - (d.upper + d.fore) * 0.95, sh.z + 0.05 + sw);
      placeArm(arm, sh, T.b, null, T.pole.set(side * 0.2, -0.3, -1), T.c.set(-side, 0, 0.3));
    }
    return;
  }
  const pistol = WD().hold === 'pistol';
  const r = P.reload;
  let tilt = 0;
  if (r) { const s = reloadSeg(r); tilt = lerp(s.a[2], s.b[2], s.u); }
  const sw = P.swap ? P.swap.k : 0;
  lowT = Math.max(lowT, sw);

  const mount = toRoot(pistol ? ch.pistolMount : ch.mount, T.a), low = toRoot(pistol ? ch.pistolLow : ch.lowMount, T.b);
  lookQuat(aimDirRoot, T.q);
  if (pistol) lookQuat(T.c.set(0.08, -0.82, 0.56).normalize(), T.q2);
  else { lookQuat(T.c.set(0.66, -0.58, 0.48).normalize(), T.q2); T.q2.multiply(_q1.setFromEuler(_e1.set(0, 0, 0.25))); }
  T.q.slerp(T.q2, lowT);
  mount.lerp(low, lowT);
  mount.y -= 0.22 * sw;
  // weapon bob (figure-eight while walking) + sway/inertia from looking around
  const bobW = P.gaitW * (1 - 0.75 * P.adsT) * (1 + P.sprintT * 0.6);
  const ph = P.phase;
  mount.x += Math.sin(ph) * 0.014 * bobW; mount.y += -Math.abs(Math.cos(ph)) * 0.014 * bobW;
  const swayK = 1 - 0.55 * P.adsT;
  T.q.multiply(_q1.setFromEuler(_e1.set(
    -P.kick.rx - 0.25 * tilt + P.sway.y * swayK + Math.cos(ph * 2) * 0.012 * bobW,
    P.kick.ry + 0.18 * tilt + P.sway.x * swayK,
    0.8 * tilt + Math.sin(ph) * 0.03 * bobW - P.sway.x * 0.6 * swayK - P.leanT * 0.12 * (1 - P.adsT), 'XYZ')));
  mount.add(T.c.set(0.06 * tilt - P.sway.x * 0.05 * swayK, -0.09 * tilt + P.sway.y * 0.03 * swayK, 0.03 * tilt));
  gun.group.quaternion.copy(T.q);
  const anchorPt = T.c.copy(pistol ? gun.gripPalm : gun.butt).multiplyScalar(GUN_SCALE).applyQuaternion(T.q);
  gun.group.position.copy(mount).sub(anchorPt).add(T.d.set(0, 0, -P.kick.z).applyQuaternion(T.q));
  gun.group.updateMatrix();
  gun.group.updateMatrixWorld(true);

  // moving parts
  const I = inv();
  if (gun.kind === 'rifle') {
    P.boltT = I.locked ? 1 : Math.max(0, P.boltT - dt * 18);
    gun.bolt.position.z = gun.boltZ0 - 0.032 * P.boltT;
  } else if (gun.kind === 'pistol') {
    P.slideT = Math.max(0, P.slideT - dt * 22);
    let s = I.locked ? 1 : P.slideT;
    if (r && r.type === 'mag') { const sg = reloadSeg(r); if (sg.b[1] === 'rackBack') s = Math.max(s, sg.u); }
    gun.slide.position.z = gun.slideZ0 - 0.03 * s;
  } else if (gun.kind === 'shotgun') {
    const k = P.pump ? pumpK(P.pump.t) : 0;
    gun.pump.position.z = gun.pumpZ0 - 0.085 * k;
    gun.bolt.position.z = gun.boltZ0 - 0.07 * k;
  }

  const gunX = new V3(1, 0, 0).applyQuaternion(T.q), gunY = new V3(0, 1, 0).applyQuaternion(T.q);
  placeArm(ch.armR, toRoot(ch.shR, T.a), gunToRoot(gun.gripWrist, T.b), gunToRoot(gun.gripPalm, new V3()), T.pole.set(pistol ? -0.6 : -0.9, -1, pistol ? -0.2 : -0.35), gunX);
  const wrist = new V3(), palm = new V3();
  if (r) {
    const s = reloadSeg(r);
    wrist.copy(lhWrist(s.a[1], T.b)).lerp(lhWrist(s.b[1], T.c), s.u);
    palm.copy(lhPalm(s.a[1], T.b)).lerp(lhPalm(s.b[1], T.c), s.u);
  } else { supportPt(gun.support.wrist, wrist); supportPt(gun.support.palm, palm); }
  placeArm(ch.armL, toRoot(ch.shL, T.a), wrist, palm, T.pole.set(pistol ? 0.6 : 0.7, -1, pistol ? -0.2 : -0.1), pistol ? gunX.clone().negate() : gunY);
  if (gun.handItem.visible) {
    const pw = ch.root.localToWorld(palm.clone());
    const gq = gun.group.getWorldQuaternion(T.q2);
    const off = gun.kind === 'shotgun' ? T.e.set(0, 0.035, 0) : gun.kind === 'pistol' ? T.e.set(0, 0.07, -0.02) : T.e.set(0, 0.11, -0.022);
    gun.handItem.position.copy(pw).add(off.multiplyScalar(GUN_SCALE).applyQuaternion(gq));
    gun.handItem.quaternion.copy(gq);
    if (gun.kind === 'pistol') gun.handItem.quaternion.multiply(_q1.setFromEuler(_e1.set(0.3, 0, 0, 'XYZ')));
  }
}

// ---------------------------------------------------------------------
//  Shooting
// ---------------------------------------------------------------------
function spreadRad() {
  const W = WD();
  let s = lerp(W.spread[0], W.spread[1], P.adsT);
  s += Math.min(P.vel.length(), 6) * 0.0035 * (1 - 0.6 * P.adsT);
  s += P.bloom * 0.006 * (1 - 0.55 * P.adsT);
  s += P.winded * 0.004 * P.adsT;
  return s * (1 - 0.25 * P.crouchT);
}
function ejectCasing(kind) {
  const g = gun, gq = g.group.getWorldQuaternion(new THREE.Quaternion());
  const port = g.group.localToWorld(g.port.clone());
  let c;
  if (kind === 'shell') c = shellMesh();
  else { c = new THREE.Mesh(kind === 'pistol' ? pistolCaseGeo : caseGeo, SLOT.brass); c.castShadow = true; }
  c.position.copy(port); c.quaternion.copy(gq).multiply(_q1.setFromEuler(_e1.set(0, 0, Math.PI / 2, 'XYZ')));
  const sp = kind === 'shell' ? 2.2 : kind === 'pistol' ? 2.4 : 3.1;
  const ej = new V3(-1, rand(0.35, 0.7), rand(-0.45, -0.1)).applyQuaternion(gq).multiplyScalar(sp * rand(0.85, 1.15)).add(P.vel);
  spawnProp(c, ej, new V3(rand(-30, 30), rand(-30, 30), rand(-30, 30)), { r: kind === 'shell' ? 0.011 : 0.005, rest: kind === 'shell' ? 0.25 : 0.4, life: 30, kind: kind === 'shell' ? 'hull' : 'case' });
  emitPuff(port, 0x9a9a9a, 0.04, 0.6, ej.clone().multiplyScalar(0.1), 0.12, 2);
}
function fire() {
  const W = WD(), I = inv(), g = gun;
  I.chamber = 0;
  if (W.reload === 'shell') P.pump = { t: -0.12, hull: true };
  else if (W.bolt) P.cycle = { t: -0.18 };
  else if (I.mag > 0) { I.mag--; I.chamber = 1; } else I.locked = true;
  if (g.kind === 'rifle') P.boltT = 1;
  if (g.kind === 'pistol') P.slideT = 1;
  const id = ++P.shotId;
  const mz = g.group.localToWorld(g.muzzle.clone());
  const gq = g.group.getWorldQuaternion(new THREE.Quaternion());
  // zero the bore to the sight line when looking through the sights
  const tof = W.zero / W.v;
  const zeroAng = Math.atan((g.sightH * GUN_SCALE + 0.5 * G * tof * tof) / W.zero) * P.fpT * P.adsT;
  const base = new V3(0, Math.sin(zeroAng), Math.cos(zeroAng)).applyQuaternion(gq);
  const cone = (dir, s) => {
    const r = s * Math.sqrt(Math.random()), a = rand(0, Math.PI * 2);
    const p1 = new V3().crossVectors(dir, Math.abs(dir.y) > 0.9 ? T.fwd : UP).normalize(), p2 = new V3().crossVectors(dir, p1);
    return dir.addScaledVector(p1, Math.cos(a) * r).addScaledVector(p2, Math.sin(a) * r).normalize();
  };
  cone(base, spreadRad());
  for (let i = 0; i < W.pellets; i++) {
    const dir = W.pellets > 1 ? cone(base.clone(), W.choke) : base.clone();
    const b = { pos: mz.clone(), vel: dir.clone().multiplyScalar(W.v * (W.pellets > 1 ? rand(0.95, 1.05) : 1)).add(P.vel), p0: mz.clone(), d0: dir.clone(), t: 0, tracer: null,
      drag: W.drag, mass: W.mass, dmg: W.dmg, shot: id };
    if (W.tracer && P.stats.shots % W.tracer === 0) { b.tracer = new THREE.Mesh(tracerGeo, tracerMat); b.tracer.frustumCulled = false; scene.add(b.tracer); }
    bullets.push(b);
  }
  P.stats.shots++;

  const sup = g.suppressed, big = g.kind === 'shotgun';
  flash.visible = true; P.flashT = big ? 0.055 : 0.04;
  flash.rotation.z = rand(0, Math.PI * 2);
  flash.scale.setScalar((sup ? 0.22 : g.brake ? 1.25 : big ? 1.6 : g.kind === 'pistol' ? 0.75 : 1) * rand(0.8, 1.2));
  flashLight.position.copy(mz); flashLight.intensity = sup ? 4 : big ? 90 : 60;
  emitPuff(mz.clone().addScaledVector(base, 0.08), 0x8a8a8a, big ? 0.16 : 0.1, 1.3, base.clone().multiplyScalar(sup ? 0.3 : 0.9).add(T.e.set(0, 0.25, 0)), sup ? 0.12 : big ? 0.3 : 0.2, 1.8);
  if (W.casing !== 'shell' && !W.bolt) ejectCasing(W.casing);
  audio.gunshot(g.kind === 'sniper' ? 'shotgun' : g.kind, sup, g.brake);
  BOTS.playerShot(mz, base);

  // recoil: visual gun spring, camera spring, permanent climb, view shake
  const R = W.recoil;
  const f = lerp(1, 0.55, P.adsT) * (g.brake ? 0.75 : 1) * (sup ? 0.92 : 1) * (1 - 0.2 * P.crouchT);
  P.kick.vz += R.z * f; P.kick.vrx += R.rx * f; P.kick.vry += rand(-R.ry, R.ry) * f;
  P.cr.vp += R.cam * f; P.cr.vy += rand(-0.33, 0.45) * R.cam * f;
  P.pitch += R.climb * f; P.yaw += rand(-0.3, 0.45) * R.climb * f;
  P.shake = Math.min(1.5, P.shake + R.cam * 0.9);
  P.bloom = Math.min(4, P.bloom + (big ? 2.5 : 1));
}
// telescopic sight: black surround, lens edge, mil-dot reticle; the rifle is hidden while you're behind the glass
const SCOPE = (() => {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;display:none';
  el.innerHTML = `<svg width="100%" height="100%" viewBox="-100 -56.25 200 112.5" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="sg"><stop offset="0.86" stop-color="#000" stop-opacity="0"/><stop offset="0.97" stop-color="#000" stop-opacity="0.75"/><stop offset="1" stop-color="#000"/></radialGradient><mask id="sm"><rect x="-200" y="-200" width="400" height="400" fill="#fff"/><circle r="47" fill="#000"/></mask></defs>
    <rect x="-200" y="-200" width="400" height="400" fill="#000" mask="url(#sm)"/><circle r="47.2" fill="url(#sg)"/>
    <g stroke="#0a0a0a" fill="#0a0a0a"><line x1="-47" y1="0" x2="-1.2" y2="0" stroke-width="0.35"/><line x1="1.2" y1="0" x2="47" y2="0" stroke-width="0.35"/><line x1="0" y1="-47" x2="0" y2="-1.2" stroke-width="0.35"/><line x1="0" y1="1.2" x2="0" y2="47" stroke-width="0.35"/>
    <line x1="-47" y1="0" x2="-24" y2="0" stroke-width="1.2"/><line x1="24" y1="0" x2="47" y2="0" stroke-width="1.2"/><line x1="0" y1="24" x2="0" y2="47" stroke-width="1.2"/><line x1="0" y1="-47" x2="0" y2="-24" stroke-width="1.2"/>
    ${[-4, -3, -2, -1, 1, 2, 3, 4].map((k) => `<circle cx="${k * 5}" cy="0" r="0.55"/><circle cx="0" cy="${k * 5}" r="0.55"/>`).join('')}</g>
    <circle r="0.25" fill="#c0201a"/></svg><div id="scopeInfo" style="position:absolute;left:50%;top:calc(50% + 34vh);transform:translateX(-50%);font:600 12px Rajdhani,sans-serif;letter-spacing:.2em;color:#9a9a8a"></div>`;
  document.body.appendChild(el);
  const info = el.querySelector('#scopeInfo');
  let shown = 0;
  return {
    update(k) {
      if (k !== shown) { shown = k; el.style.display = k > 0.01 ? 'block' : 'none'; el.style.opacity = String(k); }
      if (gun && gun.kind === 'sniper' && !P.holstered) gun.group.visible = k < 0.5;
      if (k > 0.5) info.textContent = P.holdBreath ? 'BREATH HELD' : P.breath < 0.2 ? 'OUT OF BREATH' : 'SHIFT — HOLD BREATH';
    },
  };
})();
function canFire() { return !P.holstered && !HANDMAP.open && !P.reload && !P.swap && !P.pump && !P.cycle && P.lowT < 0.35; }
function trigger(now) {
  if (mode !== 'range' || paused) { P.edge = false; return; }
  const I = inv(), W = WD(), m = W.modes[I.mode];
  if (P.edge && P.reload && P.reload.type === 'shell' && I.chamber) P.reload.stop = true;
  if (!canFire()) { if (P.edge && !P.reload && !P.swap && !P.pump && !P.cycle && !I.chamber) audio.dry(); P.edge = false; return; }
  if (P.edge) {
    P.edge = false;
    if (!I.chamber) { audio.dry(); return; }
    if (m === 'BURST') P.burst = 3;
    if ((m === 'SEMI' || m === 'PUMP' || m === 'BOLT') && now >= P.nextShot) { fire(); P.nextShot = now + 60 / W.rpm; return; }
  }
  if (!I.chamber) { P.burst = 0; return; }
  if (now < P.nextShot) return;
  if ((m === 'AUTO' && P.trigger) || (m === 'BURST' && P.burst > 0)) {
    fire(); P.nextShot = now + 60 / W.rpm;
    if (m === 'BURST') P.burst--;
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    let dead = false;
    for (let s = 0; s < 2 && !dead; s++) {
      const h = dt / 2;
      const from = T.a.copy(b.pos);
      b.vel.y -= G * h; b.vel.multiplyScalar(Math.exp(-b.drag * h));
      const to = T.b.copy(b.pos).addScaledVector(b.vel, h);
      const seg = T.c.subVectors(to, from), len = seg.length();
      ray.set(from, seg.divideScalar(len)); ray.far = len; ray.near = 0;
      let hit = null;
      for (const x of ray.intersectObjects(hitList, false)) {
        const tg = x.object.userData.target;
        if (tg.type === 'paper') {
          const px = Math.floor(x.uv.x * PW), py = Math.floor((1 - x.uv.y) * PH);
          if (px < 0 || py < 0 || px >= PW || py >= PH || alphaData[(py * PW + px) * 4 + 3] < 128) continue;
        }
        hit = x; break;
      }
      const tf = terrainH(from.x, from.z), tt = terrainH(to.x, to.z);
      if (to.y <= tt) {
        const a0 = from.y - tf, a1 = to.y - tt, fr = clamp(a0 / Math.max(1e-6, a0 - a1), 0, 1), fd = len * fr;
        if (!hit || fd < hit.distance) hit = { point: from.clone().lerp(to, fr), distance: fd, floor: true };
      }
      const mh = COL.ray(from, seg, len);
      if (mh && (!hit || mh.t < hit.distance)) hit = { point: mh.point, distance: mh.t, map: mh };
      b.t += h;
      if (hit) { impact(b, hit); dead = true; break; }
      b.pos.copy(to);
    }
    if (!dead && b.t > 3) dead = true;
    if (dead) { if (b.tracer) scene.remove(b.tracer); bullets.splice(i, 1); continue; }
    if (b.tracer) {
      b.tracer.position.copy(b.pos);
      lookQuat(T.d.copy(b.vel).normalize(), b.tracer.quaternion);
      b.tracer.scale.set(1, 1, Math.min(b.pos.distanceTo(b.p0), 9));
    }
  }
}

function impact(b, h) {
  const p = h.point, dist = Math.round(p.distanceTo(b.p0));
  const along = T.d.subVectors(p, b.p0).dot(b.d0);
  const drop = (b.p0.y + b.d0.y * along - p.y) * 100;
  const info = `${dist} m · ${b.t.toFixed(3)} s · drop ${drop.toFixed(1)} cm`;
  if (h.map) {
    const n = h.map.normal, mat = h.map.box.mat;
    if (n.lengthSq() > 0.5) HOLES.add(p, n, mat === 'metal' ? 0.8 : 1.1);
    if (mat === 'metal') { emitSparks(p, 10, n, [1, 0.65, 0.3], 3.5); audio.impact('mag', 0.25); }
    else if (mat === 'glass') { emitSparks(p, 8, n, [0.7, 0.8, 0.9], 2.5); audio.impact('case', 0.6); }
    else { emitPuff(p, mat === 'wood' ? 0x8a6a4a : mat === 'sand' || mat === 'cloth' ? 0x9a8562 : 0x8a8478, 0.09, 0.9, n.clone().multiplyScalar(0.7), 0.4, 1.6); emitSparks(p, 3, n, [0.9, 0.75, 0.5], 2); }
    return;
  }
  if (h.floor) {
    emitPuff(p.clone().setY(0.03), 0x3a3833, 0.12, 1.1, new V3(rand(-0.3, 0.3), 0.6, rand(-0.3, 0.3)), 0.35, 1.2);
    emitSparks(p, 3, UP, [0.9, 0.7, 0.45], 2);
    return;
  }
  const tg = h.object.userData.target;
  const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : UP.clone();
  if (tg.type === 'frame') { emitSparks(p, 8, n, [1, 0.6, 0.25], 3); return; }
  if (tg.type === 'bot') { BOTS.hit(tg, p, b); return; }
  if (tg.type === 'civ') { NPCS.hit(tg, p, b); return; }
  const firstOnTarget = tg.lastShot !== b.shot;
  tg.lastShot = b.shot;
  if (P.lastHitShot !== b.shot) { P.lastHitShot = b.shot; P.stats.hits++; }
  if (tg.type === 'steel') {
    emitSparks(p, b.mass < 0.5 ? 6 : 16, n, [1, 0.62, 0.25], 4.5);
    emitPuff(p, 0x8a8a8a, 0.08, 0.5, n.clone().multiplyScalar(0.6), 0.25, 2);
    if (h.face && h.face.normal.z > 0.5) markSteel(tg, p);
    const lx = tg.plate.worldToLocal(p.clone()).x;
    tg.vel += 2.4 * (0.35 / tg.size) * (b.vel.length() / 880) * b.mass;
    tg.tvel -= (lx / tg.size) * 7 * b.mass;
    if (!firstOnTarget) return;
    audio.ding(dist, tg.size);
    const pts = Math.round(dist / 10) + (tg.mover ? 5 : 0);
    P.stats.score += pts;
    hitFx(true);
    feed(`<span class="s">${tg.label} +${pts}</span> <span class="m">${info}</span>`);
  } else if (tg.type === 'paper') {
    holePaper(tg, h.uv);
    emitPuff(p, 0xc4a06a, 0.05, 0.4, n.clone().multiplyScalar(-0.5), 0.4, 2);
    if (!tg.down && tg.ang > -0.05) { tg.down = true; tg.downT = 2.6; tg.vel = -1.2; }
    if (!firstOnTarget) return;
    const z = paperZone(h.uv.x * PW, (1 - h.uv.y) * PH);
    const pts = z === 'A' ? 5 : z === 'C' ? 3 : 1;
    P.stats.score += pts;
    audio.paper(dist);
    hitFx(false);
    feed(`<span class="p">${z}-ZONE +${pts}</span> <span class="m">${info}</span>`);
  }
}

// =====================================================================
//  HUD
// =====================================================================
const hud = { mag: $('magN'), cham: $('chamN'), res: $('resN'), mode: $('modeN'), wname: $('wname'), ammo: $('ammo'), rbar: $('rbar'), rfill: $('rbar').firstElementChild,
  stats: $('stats'), feed: $('feed'), prompt: $('prompt'), xh: $('xhair'), hm: $('hitmark'), vig: $('vig'), stam: $('stam'), last: {} };
const xhParts = [...$('xhair').querySelectorAll('i')];
function setText(el, key, v) { if (hud.last[key] !== v) { hud.last[key] = v; el.innerHTML = v; } }
function feed(html) {
  const d = document.createElement('div'); d.innerHTML = html; hud.feed.prepend(d);
  while (hud.feed.children.length > 6) hud.feed.lastChild.remove();
}
function hitFx(steel) {
  hud.hm.classList.remove('show'); hud.hm.classList.toggle('steel', steel);
  void hud.hm.offsetWidth; hud.hm.classList.add('show');
}
function updateHud() {
  const I = inv(), W = WD();
  setText(hud.mag, 'mag', String(I.mag));
  setText(hud.cham, 'cham', I.chamber ? '+1' : '+0');
  setText(hud.res, 'res', P.infinite ? '/ ∞' : `/ ${I.reserve}`);
  setText(hud.mode, 'mode', W.modes[I.mode]);
  setText(hud.wname, 'wname', W.name);
  hud.ammo.classList.toggle('low', I.mag <= Math.ceil(W.cap / 6));
  const acc = P.stats.shots ? Math.round(100 * P.stats.hits / P.stats.shots) : 0;
  setText(hud.stats, 'stats', `SCORE <b>${P.stats.score}</b><br>HITS ${P.stats.hits} / ${P.stats.shots} · ACC ${acc}%<br>${P.fp ? '1ST' : '3RD'} PERSON${P.crouch ? ' · CROUCH' : ''}`);
  const rp = P.reload ? (P.reload.type === 'shell' ? (I.mag / W.cap) : P.reload.t / P.reload.def.dur) : 0;
  hud.rbar.style.opacity = P.reload ? 1 : 0;
  if (P.reload) hud.rfill.style.width = `${100 * rp}%`;
  let pr = '';
  if (!P.reload && !P.pump && !I.chamber && !P.swap) pr = (!P.infinite && I.reserve <= 0 && I.mag <= 0) ? 'OUT OF AMMO — PRESS T' : 'RELOAD  [R]';
  setText(hud.prompt, 'prompt', pr);
  const fov = camera.fov * Math.PI / 180;
  const gap = Math.tan(spreadRad()) / Math.tan(fov / 2) * innerHeight / 2 + 4;
  const hideX = (P.fpT > 0.5 && P.adsT > 0.4) || P.lowT > 0.5;
  hud.xh.style.opacity = hideX ? 0 : 1;
  const lines = P.adsT > 0.6 ? 0 : 1;
  xhParts[0].style.transform = `translateY(${-gap - 9}px)`; xhParts[1].style.transform = `translateY(${gap}px)`;
  xhParts[2].style.transform = `translateX(${-gap - 9}px)`; xhParts[3].style.transform = `translateX(${gap}px)`;
  for (const x of xhParts) x.style.opacity = lines;
  hud.vig.style.opacity = (P.fpT * P.adsT * 0.9 + P.winded * 0.35).toFixed(3);
  hud.stam.style.opacity = P.stamina < 0.98 ? 1 : 0;
  hud.stam.firstElementChild.style.width = `${P.stamina * 100}%`;
}

// =====================================================================
//  Simulation
// =====================================================================
const keys = {};
function spring(o, x, v, k, c, dt) { o[v] += (-k * o[x] - c * o[v]) * dt; o[x] += o[v] * dt; }
const _rideOff = new V3();
const wrapPI = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
let lastJumpT = -9;
const clockJump = (t) => { if (t - lastJumpT < 0.45) return false; lastJumpT = t; return true; };
// touching down: the harder the fall, the deeper the dip (and a jolt of shake past ~2 m)
function land() {
  const v = -(P.vy || 0); P.air = false;
  if (v > 2.5) { const k = Math.min(1, (v - 2.5) / 7); P.feel.vland -= 4 + k * 10; P.shake = Math.min(1.5, P.shake + k * 0.7); audio.step(false, 1); if (v > 5) audio.step(true, 0); }
}
// a hit rocks the view toward the side it came from
function flinch(side, k = 1) { P.feel.vhit -= 6 * k; P.feel.hitSide = side; }
const aimKey = { down: false, t: 0, toggled: false };

function updateRange(dt, time) {
  TORCH.update(dt);
  // movement + stamina
  const fwd = T.a.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), right = T.b.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  const ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const shift = keys.ShiftLeft || keys.ShiftRight;
  P.ads = (aimKey.down || aimKey.toggled) && !P.holstered && !HANDMAP.open;
  const sprint = !P.vehicle && shift && iz > 0 && !P.ads && !P.reload && P.stamina > 0.05;
  if (sprint && P.crouch) P.crouch = false;
  P.stamina = clamp(P.stamina + (sprint ? -dt / 6 : dt / (P.vel.lengthSq() > 1 ? 7 : 4)), 0, 1);
  P.winded = damp(P.winded, clamp((0.6 - P.stamina) / 0.6, 0, 1), 1.5, dt);
  if (P.vehicle) SCOOTER.drive(dt); else {
  const spd = sprint ? 5.6 : P.crouch ? 1.5 : P.ads ? 1.8 : 3.1;
  const wish = T.c.copy(fwd).multiplyScalar(iz).addScaledVector(right, ix);
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(spd);
  P.vel.lerp(wish, 1 - Math.exp(-(wish.lengthSq() > 0 ? 9 : 12) * dt));
  P.pos.addScaledVector(P.vel, dt);
  // world collision: walls push you out, floors/steps lift you, ledges drop you with gravity
  COL.resolve(P.pos, 0.32, 1.75);
  P.pos.x = clamp(P.pos.x, -MAP.bounds, MAP.bounds); P.pos.z = clamp(P.pos.z, -MAP.bounds, MAP.bounds);
  const gy = COL.ground(P.pos.x, P.pos.z, P.pos.y);
  // jump (Space): a modest hop — enough for a kerb or a low wall, not for rooftops
  if (keys.Space && !P.air && !P.dead && P.stamina > 0.1 && clockJump(time)) { P.vy = 4.3; P.air = true; P.stamina = Math.max(0, P.stamina - 0.08); audio.step(false, 1); }
  if ((P.vy || 0) > 0 || gy < P.pos.y - 0.04) { P.vy = (P.vy || 0) - G * dt; P.pos.y = Math.max(gy, P.pos.y + P.vy * dt); P.air = P.pos.y > gy + 0.02 || P.vy > 0; if (!P.air) land(); }
  else { if (P.air) land(); P.vy = 0; P.pos.y = damp(P.pos.y, gy, 20, dt); }
  }

  // hold breath while aiming (Shift): steadies sway for a few seconds, then you pay for it
  P.holdBreath = shift && P.ads && P.breath > 0;
  P.breath = clamp(P.breath + (P.holdBreath ? -dt / 4 : dt / 5), 0, 1);

  P.adsT = damp(P.adsT, P.ads && !sprint && !P.reload && !P.swap ? 1 : 0, 13, dt);
  P.sprintT = damp(P.sprintT, sprint ? 1 : 0, 8, dt);
  P.lowT = damp(P.lowT, sprint ? 1 : 0, 9, dt);
  P.crouchT = damp(P.crouchT, P.crouch ? 1 : 0, 9, dt);
  const scoped = WD().scope && P.ads && !sprint && !P.reload && !P.swap;
  P.fpT = damp(P.fpT, P.fp || scoped || HANDMAP.open ? 1 : 0, scoped ? 16 : 10, dt);
  P.leanT = damp(P.leanT, P.lean, 9, dt);
  P.bloom = Math.max(0, P.bloom - dt * 5);
  P.shake *= Math.exp(-14 * dt);
  for (let i = 0; i < 2; i++) {
    const h = dt / 2;
    spring(P.kick, 'z', 'vz', 380, 28, h); spring(P.kick, 'rx', 'vrx', 300, 24, h); spring(P.kick, 'ry', 'vry', 300, 24, h);
    spring(P.cr, 'p', 'vp', 90, 16, h); spring(P.cr, 'y', 'vy', 90, 16, h);
    spring(P.sway, 'x', 'vx', 150, 15, h); spring(P.sway, 'y', 'vy', 150, 15, h);
    spring(P.feel, 'land', 'vland', 140, 13, h); spring(P.feel, 'hit', 'vhit', 160, 12, h);
  }
  P.feel.yawRate = damp(P.feel.yawRate, wrapPI(P.yaw - P.feel.lastYaw) / Math.max(dt, 1e-3), 10, dt); P.feel.lastYaw = P.yaw;
  P.sway.x = clamp(P.sway.x, -0.09, 0.09); P.sway.y = clamp(P.sway.y, -0.07, 0.07);
  if (P.swap) {
    const s = P.swap, half = 0.26;
    s.t += dt;
    s.k = s.t < half ? smooth(s.t / half) : 1 - smooth((s.t - half) / half);
    if (!s.done && s.t >= half) { equip(s.to); s.done = true; audio.draw(); }
    if (s.t >= half * 2) P.swap = null;
  }
  if (P.reload) {
    if (P.reload.type === 'shell') updateShellReload(dt);
    else {
      const r = P.reload, t0 = r.t;
      r.t += dt;
      for (const [t, e] of r.def.ev) if (t > t0 && t <= r.t) reloadEvent(e);
    }
  }
  if (P.pump) updatePump(dt);
  if (P.cycle) updateBoltCycle(dt);

  // camera orientation: breathing sway (worse when winded, calm when holding breath), strafe roll, lean, shake
  const swayAmp = P.adsT * (1 - 0.5 * P.crouchT) * (P.holdBreath ? 0.12 : 1 + P.winded * 3 + (P.breath < 0.05 ? 1.5 : 0)) * (WD().scope ? 2.6 : 1);
  const bf = 1.3 + P.winded * 1.2;
  const lvx = P.vel.dot(right);
  // head motion: footfalls nod the view (more when sprinting, little when aiming), idle breathing, landing dip, flinch when hit
  const hipK = 1 - 0.75 * P.adsT, gait = P.gaitW * (1 + 1.6 * P.sprintT) * hipK;
  const nod = Math.sin(P.phase * 2) * 0.0045 * gait + Math.sin(time * (1.1 + P.winded)) * 0.0016 * (1 - P.gaitW) * hipK * (1 + P.winded * 2) + P.feel.land * 0.05 - P.feel.hit * 0.035;
  const pitch = clamp(P.pitch + P.cr.p + nod + Math.sin(time * bf) * 0.0013 * swayAmp + Math.sin(time * 2.9) * 0.0004 * swayAmp, -1.4, 1.4);
  const yaw = P.yaw + P.cr.y + Math.sin(time * bf * 0.63) * 0.001 * swayAmp + P.feel.hit * P.feel.hitSide * 0.025;
  const roll = -P.leanT * 0.17 - lvx * 0.006 * hipK + Math.sin(P.phase) * (0.006 + 0.012 * P.sprintT) * P.gaitW * hipK
    - clamp(P.feel.yawRate, -6, 6) * 0.0045 * hipK * (P.vehicle ? 0 : 1) + P.feel.hit * P.feel.hitSide * 0.04 + (Math.random() - 0.5) * P.shake * 0.02 + SCOOTER.camRoll() * P.fpT;
  _e1.set(pitch + (Math.random() - 0.5) * P.shake * 0.004, yaw, roll, 'YXZ'); T.camQ.setFromEuler(_e1);
  T.camFwd.set(0, 0, -1).applyQuaternion(T.camQ);

  // body
  const pistol = WD().hold === 'pistol';
  if (P.vehicle) SCOOTER.poseRider(dt); else {
  ch.root.position.copy(P.pos);
  ch.root.rotation.set(0, P.yaw + Math.PI, 0);
  const lv = T.d.copy(P.vel).applyAxisAngle(UP, -(P.yaw + Math.PI));
  poseBody(dt, time, { localVel: lv, bladed: (1 - P.lowT) * (pistol ? 0.35 : 1), lean: 0.22 * P.sprintT + 0.12 * P.crouchT - 0.3 * pitch * (1 - P.lowT), lookPitch: pitch * (1 - P.lowT * 0.5), crouchT: P.crouchT, sprintT: P.sprintT, side: P.leanT });
  ch.head.visible = P.fpT < 0.5;
  }

  // camera base position (third person shoulder cam or the eyes)
  const eyeW = ch.eye.getWorldPosition(T.e);
  if (P.vehicle) eyeW.add(_rideOff.set(-Math.sin(P.vehicle.yaw) * 0.24, 0.06, -Math.cos(P.vehicle.yaw) * 0.24));   // riding: eyes ahead of the chest, over the bars
  P.camY = damp(P.camY, eyeW.y, 12, dt);
  const off = P.vehicle ? T.a.set(0, 0.7, 3.9) : T.a.set(lerp(0.78, 0.66, P.adsT), lerp(0.24, 0.1, P.adsT), lerp(2.7, 1.5, P.adsT));
  _e1.set(pitch, yaw, 0, 'YXZ'); off.applyQuaternion(_q2.setFromEuler(_e1));
  // shoulder camera: pull in when a wall is between you and the camera
  const pivot = T.b.set(P.pos.x, P.camY + 0.05, P.pos.z), offLen = off.length();
  const camHit = COL.ray(pivot, T.c.copy(off).divideScalar(offLen), offLen + 0.3);
  const tp = camHit ? pivot.addScaledVector(T.c, Math.max(0.15, camHit.t - 0.3)) : pivot.add(off);
  tp.y = Math.max(tp.y, terrainH(tp.x, tp.z) + 0.25);
  T.camBase.copy(tp).lerp(eyeW, P.fpT);

  // aim point from the camera centre
  ray.set(T.camBase, T.camFwd); ray.near = 0.5; ray.far = 400;
  const hits = ray.intersectObjects(hitList, false);
  let aimT = hits.length ? hits[0].distance : 400;
  const mapAim = COL.ray(T.camBase, T.camFwd, aimT);
  if (mapAim) aimT = mapAim.t;
  for (let t = 1; t < aimT; t += 2) { const px = T.camBase.x + T.camFwd.x * t, pz = T.camBase.z + T.camFwd.z * t; if (T.camBase.y + T.camFwd.y * t < terrainH(px, pz)) { aimT = t; break; } }
  T.aim.copy(T.camBase).addScaledVector(T.camFwd, aimT);
  const mountW = (pistol ? ch.pistolMount : ch.mount).getWorldPosition(T.c);
  const dirW = T.d.subVectors(T.aim, mountW).normalize().lerp(T.camFwd, P.fpT * P.adsT).normalize();
  const dirRoot = dirW.applyQuaternion(_q2.copy(ch.root.quaternion).invert());
  if (!P.vehicle) poseGun(dt, dirRoot, P.lowT, (P.holstered && !P.swap) || HANDMAP.open);

  // final camera: through the sights in first person ADS
  camera.quaternion.copy(T.camQ);
  const k = P.fpT * P.adsT;
  if (k > 0.001) camera.position.copy(T.camBase).lerp(gun.group.localToWorld(T.a.copy(gun.eye)), smooth(k));
  else camera.position.copy(T.camBase);
  camera.position.y += P.feel.land * 0.16;
  SCOPE.update(WD().scope ? smooth(clamp((P.adsT * P.fpT - 0.82) / 0.18, 0, 1)) : 0);
  const W = WD();
  const fovT = lerp(P.fp ? 74 : 68, P.fp ? W.ads[1] : W.ads[0], smooth(P.adsT)) + P.sprintT * 5 + P.shake * 1.2;
  if (Math.abs(camera.fov - fovT) > 0.01) { camera.fov = fovT; camera.updateProjectionMatrix(); }

  trigger(time);
  updateHud();
}

function updateCustom(dt, time) {
  if (turntable) orbit.tyaw += dt * 0.35;
  orbit.yaw = damp(orbit.yaw, orbit.tyaw, 10, dt);
  orbit.pitch = damp(orbit.pitch, orbit.tpitch, 10, dt);
  orbit.dist = damp(orbit.dist, orbit.tdist, 10, dt);
  P.vel.set(0, 0, 0); P.adsT = 0; P.lowT = 0; P.crouchT = 0; P.sprintT = 0; P.fpT = 0; P.leanT = 0; P.swap = null; P.pump = null;
  P.kick.z = P.kick.rx = P.kick.ry = 0; P.sway.x = P.sway.y = 0;
  for (const kk of ['vz', 'vrx', 'vry']) P.kick[kk] = 0;
  ch.root.position.copy(P.pos);
  ch.root.rotation.set(0, 0, 0);
  ch.head.visible = true;
  const relaxed = pose === 'relaxed', pistol = WD().hold === 'pistol';
  poseBody(dt, time, { localVel: T.d.set(0, 0, 0), bladed: (pose === 'aim' ? 1 : pose === 'ready' ? 0.35 : 0) * (pistol ? 0.35 : 1), lean: 0, lookPitch: 0, crouchT: 0, sprintT: 0 });
  poseGun(dt, T.e.set(0, 0, 1), pose === 'ready' ? 1 : 0, relaxed);
  if (holsterModel) holsterModel.visible = relaxed || P.w !== 'pistol';
  const headY = ch.d.hipY + ch.d.waistY + ch.d.torso + ch.d.neck + ch.d.hh * 0.5;
  const h = lerp(ch.d.hipY * 0.95, headY, clamp((3 - orbit.dist) / 1.7, 0, 1)) + (orbit.focus || 0);
  const tgt = T.a.set(P.pos.x, P.pos.y + h, P.pos.z);
  camera.position.set(
    tgt.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist,
    tgt.y + Math.sin(orbit.pitch) * orbit.dist,
    tgt.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist);
  camera.lookAt(tgt);
  const narrow = innerWidth <= 760;
  camera.setViewOffset(innerWidth, innerHeight, narrow ? 0 : 180, narrow ? innerHeight * 0.2 : 0, innerWidth, innerHeight);
  if (Math.abs(camera.fov - 35) > 0.01) { camera.fov = 35; camera.updateProjectionMatrix(); }
}

function resetRange() {
  BOTS.reset();
  resetTargets();
  freshInv();
  P.reload = null; P.burst = 0; P.pump = null; P.swap = null;
  P.stats = { shots: 0, hits: 0, score: 0 };
  for (const id in guns) { if (guns[id].mag) guns[id].mag.visible = true; guns[id].handItem.visible = false; }
  for (const p of props) scene.remove(p.obj);
  props.length = 0;
  HOLES.clear();
  hud.feed.innerHTML = '';
}

