// =====================================================================
//  Driving: input, vehicle dynamics, surfaces, laps, cameras, audio, HUD
// =====================================================================
const RPM_MAX = 12300, RPM_IDLE = 3800;
// Surfaces as the F4 physics sees them (grip multiplier, rolling drag).
const SURF_PHYS = {
  [SURF.road]: { kind: 'asphalt', grip: 1, drag: 0 }, [SURF.kerb]: { kind: 'kerb', grip: 0.97, drag: 0 },
  [SURF.asphalt]: { kind: 'paint', grip: 0.95, drag: 0.004 }, [SURF.gravel]: { kind: 'gravel', grip: 0.5, drag: 0.32 },
  [SURF.grass]: { kind: 'grass', grip: 0.55, drag: 0.06 },
};

// ---------------------------------------------------------------------
//  Input
// ---------------------------------------------------------------------
const keys = new Set();
const input = { steer: 0, throttle: 0, brake: 0 };
addEventListener('keydown', (e) => { keys.add(e.code); });
addEventListener('keyup', (e) => { keys.delete(e.code); });
addEventListener('blur', () => keys.clear());
function readInput(dt, speed) {
  let st = 0, th = 0, br = 0, analog = false;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p || !p.connected) continue;
    const ax = p.axes[0] || 0;
    const dz = Math.abs(ax) < 0.06 ? 0 : (ax - Math.sign(ax) * 0.06) / 0.94;
    const rt = p.buttons[7]?.value || 0, lt = p.buttons[6]?.value || 0;
    if (Math.abs(dz) > 0 || rt > 0.02 || lt > 0.02) { analog = true; st = -Math.sign(dz) * Math.abs(dz) ** 1.4; th = rt; br = lt; }
    if (p.buttons[3]?.pressed) padPress('cam'); else padRelease('cam');
    if (p.buttons[2]?.pressed) padPress('reset'); else padRelease('reset');
  }
  const kL = keys.has('KeyA') || keys.has('ArrowLeft'), kR = keys.has('KeyD') || keys.has('ArrowRight');
  const kT = keys.has('KeyW') || keys.has('ArrowUp'), kB = keys.has('KeyS') || keys.has('ArrowDown') || keys.has('Space');
  if (!analog || kL || kR || kT || kB) {
    // Keyboard: ramp inputs so taps are progressive rather than binary.
    const target = (kL ? 1 : 0) - (kR ? 1 : 0);
    const rate = target === 0 || Math.sign(target) !== Math.sign(input.steer) ? 6 : 1.6 + 3 / (1 + speed / 15);
    input.steer += clamp(target - input.steer, -rate * dt, rate * dt);
    input.throttle += clamp((kT ? 1 : 0) - input.throttle, -9 * dt, 3 * dt);
    input.brake += clamp((kB ? 1 : 0) - input.brake, -12 * dt, 9 * dt);
  } else {
    input.steer += (st - input.steer) * Math.min(1, dt * 20);
    input.throttle = th; input.brake = br;
  }
}
const padState = {};
function padPress(k) { if (!padState[k]) { padState[k] = true; if (k === 'cam') cycleCamera(); else resetCar(); } }
function padRelease(k) { padState[k] = false; }

// ---------------------------------------------------------------------
//  Car state
// ---------------------------------------------------------------------
const car = {
  x: 0, z: 0, y: 0, heading: 0, vF: 0, vL: 0, yaw: 0, steer: 0,
  gear: '1', rpm: RPM_IDLE, hint: -1, surf: SURF.road, wheelSurf: [0, 0, 0, 0], slip: 0, onKerb: 0,
  assist: 1, impact: 0,
};
const ASSIST_NAMES = ['OFF', 'SPORT', 'FULL'];

// The track as the F4 physics' ground: height, surface and barrier contacts.
const ground = {
  heightAt(x, z) { return S ? surfaceHeight(x, z, car.hint).y : 0; },
  surfaceAt(x, z) { return S ? SURF_PHYS[surfaceHeight(x, z, car.hint).surf] : null; },
  // Barriers (and painted walls, which stand even with barriers off), then hand-placed props.
  wallContact(x, z) {
    let best = null;
    const p = S ? project(x, z, car.hint) : null;
    if (p) {
      const k = p.d > 0 ? 0 : 1, side = p.d > 0 ? 1 : -1;
      if (state.settings.barriers || S.wallH[k][p.i] > 0) {
        const lim = Math.min(S.bar[k][p.i], S.lim[k][p.i]) - 0.15;
        const depth = Math.abs(p.d) - lim;
        if (depth > 0 && depth < 4) best = { nx: -leftX(p.i) * side, nz: -leftZ(p.i) * side, depth: Math.min(depth, 0.6) };
      }
    }
    const pc = propContact(x, z);
    if (pc && (!best || pc.depth > best.depth)) best = pc;
    return best;
  },
};
const vehicle = new F4.vehicle.Vehicle(ground, F1_SPEC);
vehicle.awd = false;
vehicle.assistLevel = car.assist;

let carModel = null;
function ensureCarModel() {
  if (carModel && carModel.livery === state.settings.livery) return;
  if (carModel) { scene.remove(carModel.root); carModel.root.traverse((o) => o.geometry && o.geometry.dispose()); }
  carModel = buildCar(state.settings.livery, vehicle);
  carModel.livery = state.settings.livery;
  scene.add(carModel.root);
}

function placeAt(i, lat) {
  car.hint = i;
  const x = S.px[i] + leftX(i) * lat, z = S.pz[i] + leftZ(i) * lat;
  vehicle.reset(new THREE.Vector3(x, surfaceHeight(x, z, i).y, z), Math.atan2(S.tx[i], S.tz[i]));
  syncCar();
}
let gridHold = null;
function placeOnGrid() {
  const i = (S.n - Math.round(10 / S.step)) % S.n;
  placeAt(i, Math.min(3.2, S.w[i] / 4));
  gridHold = { x: vehicle.body.position.x, z: vehicle.body.position.z };
}
function resetCar() {
  if (!S || mode !== 'drive') return;
  const p = project(car.x, car.z, car.hint);
  if (!p) return;
  placeAt(p.i, clamp(p.d, -S.w[p.i] / 2 + 1.5, S.w[p.i] / 2 - 1.5));
  lap.valid = false;
  showToast('RESET — LAP INVALID', '#ffb800');
}
function cycleAssists() {
  car.assist = (car.assist + 2) % 3;          // SPORT -> OFF -> FULL -> SPORT
  vehicle.assistLevel = car.assist;
  $('tcState').textContent = ASSIST_NAMES[car.assist];
  showToast('ASSISTS ' + ASSIST_NAMES[car.assist]);
}

// Surface type and height under a world point.
function surfaceHeight(x, z, hint) {
  const p = project(x, z, hint);
  if (!p) return { y: terrainHeight(x, z), surf: SURF.grass, p: null };
  const k = p.d > 0 ? 0 : 1, i = p.i;
  const ad = Math.abs(p.d);
  const half = S.w[i] / 2;
  let surf = SURF.road, extra = 0;
  if (ad > half) {
    const kerb = S.kerb[k][i];
    if (kerb && ad <= half + KERB_W) {
      surf = SURF.kerb;
      const f = (ad - half) / KERB_W;
      extra = kerb === 2 ? 0.02 + Math.sin(f * Math.PI * 0.85) * 0.07 : 0.012 + f * 0.05;
    } else {
      const edge = half + (kerb ? KERB_W : 0);
      if (kerb === 2 && ad <= edge + 0.55) { surf = SURF.kerb; extra = 0.02 + Math.sin(((ad - edge) / 0.55) * Math.PI) * 0.16; }
      else surf = S.runW[k][i] > 0.5 && ad <= edge + S.runW[k][i] ? S.runS[k][i] : SURF.grass;
    }
  }
  const verge = Math.min(S.bar[k][i] + 3, S.lim[k][i]);
  let y;
  if (ad <= verge) y = p.cy - p.d * Math.tan(p.roll) + extra;
  else {
    // Past the mowed verge (only reachable with barriers off): blend into the terrain.
    const edgeY = p.cy - Math.sign(p.d) * verge * Math.tan(p.roll);
    y = lerp(edgeY, terrainHeight(x, z), clamp((ad - verge) / 6, 0, 1));
  }
  return { y, surf, p };
}

// ---------------------------------------------------------------------
//  One physics step of the F4 vehicle, then mirror its state into `car`
//  (position, heading, speeds) for the camera, laps, HUD and audio.
// ---------------------------------------------------------------------
const ctrl = { throttle: 0, brake: 0, steer: 0, handbrake: 0, shiftUp: false, shiftDown: false };
const _fw = new THREE.Vector3(), _lf = new THREE.Vector3();
function physicsStep(dt) {
  const held = heldOnGrid();
  // On the grid: handbrake only. Holding the foot brake at a standstill would make the
  // automatic gearbox select reverse, and the car would creep backwards when released.
  ctrl.throttle = held ? 0 : input.throttle;
  ctrl.brake = held ? 0 : input.brake;
  ctrl.handbrake = held ? 1 : 0;
  ctrl.steer = -input.steer;                     // F4 steer: + = right
  vehicle.step(dt, ctrl);
  if (held && gridHold) {
    // Pin the car to its grid slot (it may still settle on its springs).
    const b = vehicle.body;
    b.position.x = gridHold.x; b.position.z = gridHold.z;
    b.velocity.x = b.velocity.z = 0;
    b.angularVelocity.y = 0;
  }
  syncCar();
  if (vehicle.wallHit > 4) { lap.valid = false; car.impact = Math.max(car.impact, Math.min(1, vehicle.wallHit / 25)); audio.thump(Math.min(1, vehicle.wallHit / 30)); }
}
function syncCar() {
  const b = vehicle.body, c = car;
  _fw.set(0, 0, 1).applyQuaternion(b.quaternion);
  _lf.set(1, 0, 0).applyQuaternion(b.quaternion);
  c.x = b.position.x; c.z = b.position.z; c.y = b.position.y - F1_SPEC.cgHeight;
  c.heading = Math.atan2(_fw.x, _fw.z);
  c.vF = b.velocity.dot(_fw); c.vL = b.velocity.dot(_lf);
  c.yaw = b.angularVelocity.y;
  c.steer = vehicle.steerAngle;
  c.rpm = vehicle.rpm; c.gear = vehicle.gearLabel; c.reverse = c.gear === 'R';
  const p = project(c.x, c.z, c.hint);
  if (p) { c.hint = p.i; }
  let kerb = 0, slip = 0;
  vehicle.wheels.forEach((w, i) => {
    const sf = w.surface === 'kerb' ? SURF.kerb : w.surface === 'gravel' ? SURF.gravel : w.surface === 'grass' ? SURF.grass : w.surface === 'paint' ? SURF.asphalt : SURF.road;
    c.wheelSurf[i] = sf;
    if (sf === SURF.kerb) kerb++;
    slip = Math.max(slip, Math.abs(w.vLat || 0) / Math.max(4, w.groundSpeed || 0));
  });
  c.onKerb = kerb;
  c.slip = slip - 0.08;
  c.surf = surfaceHeight(c.x, c.z, c.hint).surf;
}

// ---------------------------------------------------------------------
//  Laps, sectors, track limits
// ---------------------------------------------------------------------
const lap = { t: 0, n: 1, running: false, valid: true, armed: false, prev: 0, sectors: [0, 0, 0], secT: [null, null, null], last: null, best: null, bestSec: [null, null, null], limitsHits: 0, lastLimit: -9 };
function bestKey() { return 'tb.best.' + state.name + '.' + Math.round(S.L); }
function resetLap() {
  Object.assign(lap, { t: 0, n: 1, running: false, valid: true, armed: false, prev: 0, secT: [null, null, null], last: null, limitsHits: 0 });
  lap.sectorStart = 0;
  try { const b = JSON.parse(localStorage.getItem(bestKey()) || 'null'); lap.best = b?.t ?? null; lap.bestSec = b?.sec ?? [null, null, null]; } catch { lap.best = null; lap.bestSec = [null, null, null]; }
}
function lapStep(dt) {
  if (!lap.running) return;
  lap.t += dt;
  const p = project(car.x, car.z, car.hint);
  if (!p) return;
  const L = S.L, d = p.dist;
  // Track limits: the whole car past the white line + kerb.
  const k = p.d > 0 ? 0 : 1;
  const edge = S.w[p.i] / 2 + (S.kerb[k][p.i] ? KERB_W : 0);
  if (Math.abs(p.d) > edge + 1.0 && lap.t - lap.lastLimit > 1.5) {
    lap.lastLimit = lap.t;
    if (lap.valid) { lap.valid = false; showToast('TRACK LIMITS — LAP DELETED', '#ff4d4d'); }
  }
  if (d > L * 0.5 && d < L * 0.9) lap.armed = true;
  for (let s = 1; s < 3; s++) {
    const b = (L * s) / 3;
    if (lap.prev < b && d >= b && d - lap.prev < L * 0.2 && lap.secT[s - 1] == null) closeSector(s - 1);
  }
  if (lap.prev > L * 0.85 && d < L * 0.15) {
    if (lap.armed) finishLap();
  } else if (lap.prev < L * 0.15 && d > L * 0.85) {
    lap.armed = false;                       // went backwards over the line
  }
  lap.prev = d;
}
function closeSector(s) {
  const t = lap.t - lap.sectorStart;
  lap.secT[s] = t;
  lap.sectorStart = lap.t;
  const el = $('sec' + s);
  const best = lap.bestSec[s];
  el.textContent = fmtSec(t);
  el.className = !lap.valid ? '' : best == null || t < best ? 'best' : t < best + 0.15 ? 'pb' : 'slow';
  if (lap.valid && (best == null || t < best)) lap.bestSec[s] = t;
}
function finishLap() {
  closeSector(2);
  const t = lap.t;
  lap.last = { t, valid: lap.valid };
  if (lap.valid && (lap.best == null || t < lap.best)) {
    lap.best = t;
    showToast('BEST LAP  ' + fmtLap(t), '#b26bff');
    try { localStorage.setItem(bestKey(), JSON.stringify({ t, sec: lap.bestSec })); } catch {}
  } else if (lap.valid) showToast('LAP  ' + fmtLap(t), '#ffffff');
  lap.n++; lap.t = 0; lap.sectorStart = 0; lap.valid = true; lap.armed = false; lap.secT = [null, null, null];
  setTimeout(() => { for (let s = 0; s < 3; s++) if (lap.secT[s] == null) { $('sec' + s).textContent = 'S' + (s + 1); $('sec' + s).className = ''; } }, 2500);
}
const fmtLap = (t) => { if (t == null) return '–'; const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(3).padStart(6, '0')}`; };
const fmtSec = (t) => (t >= 60 ? fmtLap(t) : t.toFixed(3));
let toastTimer = 0;
function showToast(text, color = '#fff') {
  const el = $('toast');
  el.textContent = text; el.style.color = color; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------------
//  Start lights
// ---------------------------------------------------------------------
const start = { phase: 'off', t: 0, outAt: 0 };
function beginStart() {
  start.phase = 'lights'; start.t = 0; start.outAt = 5 * 0.75 + 0.4 + Math.random() * 1.2;
  $('lights').classList.remove('hidden');
  lap.running = false;
}
function startStep(dt) {
  if (start.phase !== 'lights') return;
  start.t += dt;
  const lit = start.t >= start.outAt ? 0 : Math.min(5, Math.floor(start.t / 0.75) + 1);
  [...$('lights').children].forEach((el, i) => el.classList.toggle('on', i < lit));
  if (startLights) startLights.forEach((m, i) => m.emissive.setHex(i < lit ? 0xff1010 : 0x000000));
  if (start.t >= start.outAt) {
    start.phase = 'go'; lap.running = true; lap.t = 0; lap.sectorStart = 0;
    lap.prev = project(car.x, car.z, car.hint)?.dist ?? 0;
    showToast('GO GO GO', '#2fd06a');
    setTimeout(() => $('lights').classList.add('hidden'), 600);
  }
}
// Until the lights go out the car is held on the grid (revving allowed).
const heldOnGrid = () => start.phase === 'lights';

// ---------------------------------------------------------------------
//  Cameras
// ---------------------------------------------------------------------
const CAMS = ['CHASE', 'FAR', 'ONBOARD', 'TV'];
let camIdx = 0;
const camState = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 60, init: false, tv: null };
function cycleCamera() { camIdx = (camIdx + 1) % CAMS.length; camState.init = false; $('camName').textContent = CAMS[camIdx]; }
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function updateCamera(dt) {
  const c = car, speed = Math.hypot(c.vF, c.vL);
  const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
  const mode = CAMS[camIdx];
  let fov = 58 + clamp(speed / 90, 0, 1) * 16;
  if (mode === 'CHASE' || mode === 'FAR') {
    const far = mode === 'FAR';
    // Follow a blend of heading and travel direction so slides read clearly.
    const vx = fx * c.vF + Math.cos(c.heading) * c.vL, vz = fz * c.vF - Math.sin(c.heading) * c.vL;
    const vl = Math.hypot(vx, vz);
    let dx = fx, dz = fz;
    if (vl > 5 && c.vF > 0) { dx = lerp(fx, vx / vl, 0.35); dz = lerp(fz, vz / vl, 0.35); const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    const dist = (far ? 11 : 6.6) + clamp(speed / 90, 0, 1) * (far ? 2 : 0.9), hgt = far ? 3.6 : 1.75;
    _v.set(c.x - dx * dist, c.y + hgt, c.z - dz * dist);
    const gy = surfaceHeight(_v.x, _v.z, c.hint).y + 0.6;
    if (_v.y < gy) _v.y = gy;
    if (!camState.init) { camState.pos.copy(_v); camState.init = true; }
    const kxz = 1 - Math.exp(-dt * (far ? 5 : 9)), ky = 1 - Math.exp(-dt * 6);
    camState.pos.x += (_v.x - camState.pos.x) * kxz; camState.pos.z += (_v.z - camState.pos.z) * kxz; camState.pos.y += (_v.y - camState.pos.y) * ky;
    // Keep the distance tight even when the smoothing lags at very high speed.
    _w.set(c.x, c.y + hgt, c.z);
    const cur = camState.pos.distanceTo(_w);
    if (cur > dist * 1.25) camState.pos.sub(_w).multiplyScalar((dist * 1.25) / cur).add(_w);
    camera.position.copy(camState.pos);
    camState.look.set(c.x + fx * 4, c.y + (far ? 0.6 : 0.95), c.z + fz * 4);
  } else if (mode === 'ONBOARD') {
    carModel.body.updateWorldMatrix(true, false);
    // T-cam: just above the airbox, looking over the halo.
    camera.position.set(0, 0.98, -0.3).applyMatrix4(carModel.body.matrixWorld);
    camState.look.set(0, 0.62, 14).applyMatrix4(carModel.body.matrixWorld);
    fov = 66 + clamp(speed / 90, 0, 1) * 10;
  } else {
    // TV: hop between trackside cameras set back from the barriers.
    const p = project(c.x, c.z, c.hint);
    if (p) {
      const spacing = Math.max(20, Math.round(260 / S.step));
      const slot = Math.round(p.i / spacing) * spacing % S.n;
      if (!camState.tv || camState.tv.slot !== slot) {
        const side = S.k[slot] > 0 ? -1 : 1, k = side > 0 ? 0 : 1;
        const off = side * (Math.min(S.bar[k][slot], S.lim[k][slot]) + 5);
        const x = S.px[slot] + leftX(slot) * off, z = S.pz[slot] + leftZ(slot) * off;
        camState.tv = { slot, pos: new THREE.Vector3(x, Math.max(crossY(slot, off), terrainHeight(x, z)) + 7, z) };
      }
      camera.position.copy(camState.tv.pos);
      const d = camState.tv.pos.distanceTo(_w.set(c.x, c.y, c.z));
      fov = clamp(2 * Math.atan(9 / d) * 180 / Math.PI, 4, 50);
      camState.look.set(c.x, c.y + 0.5, c.z);
    }
  }
  // Shake from kerbs, gravel, impacts and very high speed.
  const shake = c.onKerb * 0.012 + (c.surf === SURF.gravel || c.surf === SURF.grass ? 0.03 : 0) * clamp(speed / 30, 0, 1) + c.impact * 0.25 + clamp((speed - 70) / 30, 0, 1) * 0.004;
  if (shake > 0 && mode !== 'TV') {
    const t = performance.now() * 0.05;
    camera.position.x += Math.sin(t * 1.7) * shake; camera.position.y += Math.sin(t * 2.3 + 1) * shake;
  }
  c.impact = Math.max(0, c.impact - dt * 2.5);
  camState.fov += (fov - camState.fov) * Math.min(1, dt * (mode === 'TV' ? 3 : 4));
  camera.fov = camState.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(camState.look);
}

// ---------------------------------------------------------------------
//  Audio: synthesised turbo-V6 + tyres + wind
// ---------------------------------------------------------------------
const audio = {
  ctx: null, on: true, nodes: null,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    let ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    this.ctx = ctx;
    const master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(master);
    const eng = ctx.createGain(); eng.gain.value = 0;
    const shaper = ctx.createWaveShaper();
    const curveArr = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curveArr[i] = Math.tanh(x * 2.6); }
    shaper.curve = curveArr;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
    const osc = [['sawtooth', 1, 0.5], ['square', 0.5, 0.35], ['sawtooth', 2, 0.18], ['triangle', 3, 0.12]].map(([type, mult, g]) => {
      const o = ctx.createOscillator(); o.type = type;
      const gg = ctx.createGain(); gg.gain.value = g;
      o.connect(gg).connect(shaper); o.start();
      return { o, mult };
    });
    shaper.connect(lp).connect(eng).connect(comp);
    // Noise source shared by tyres, kerbs, gravel and wind.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = (type, f, q) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(fl).connect(g).connect(comp); src.start();
      return { g, fl };
    };
    this.nodes = { master, eng, lp, osc, squeal: noise('bandpass', 1100, 6), rumble: noise('lowpass', 140, 1), gravel: noise('bandpass', 2400, 0.7), wind: noise('lowpass', 700, 0.5) };
  },
  update(dt) {
    if (!this.nodes) return;
    const n = this.nodes, t = this.ctx.currentTime, c = car;
    const speed = Math.hypot(c.vF, c.vL);
    const live = mode === 'drive' && this.on;
    n.master.gain.setTargetAtTime(live ? 0.5 : 0, t, 0.08);
    const f = (c.rpm / 60) * 3 * 0.5;                                 // V6 firing frequency (halved: fundamental)
    for (const { o, mult } of n.osc) o.frequency.setTargetAtTime(f * mult, t, 0.015);
    const thr = c.reverse ? input.brake : input.throttle;
    n.lp.frequency.setTargetAtTime(700 + thr * 3200 + (c.rpm / RPM_MAX) * 1800, t, 0.03);
    n.eng.gain.setTargetAtTime(0.1 + thr * 0.22 + (c.rpm / RPM_MAX) * 0.06, t, 0.04);
    n.squeal.g.gain.setTargetAtTime(clamp(c.slip * 2.2, 0, 0.18) * clamp(speed / 10, 0, 1) * (c.surf <= SURF.asphalt ? 1 : 0), t, 0.05);
    n.squeal.fl.frequency.setTargetAtTime(900 + speed * 4, t, 0.1);
    n.rumble.g.gain.setTargetAtTime(c.onKerb ? 0.35 * clamp(speed / 30, 0, 1) : 0, t, 0.02);
    const rough = c.wheelSurf.filter((s) => s === SURF.gravel || s === SURF.grass).length / 4;
    n.gravel.g.gain.setTargetAtTime(rough * 0.25 * clamp(speed / 15, 0, 1), t, 0.05);
    n.wind.g.gain.setTargetAtTime(clamp(speed / 95, 0, 1) ** 2 * 0.28, t, 0.1);
  },
  thump(k) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.25);
    g.gain.setValueAtTime(0.6 * k, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.nodes.master); o.start(t); o.stop(t + 0.32);
  },
};

// ---------------------------------------------------------------------
//  HUD
// ---------------------------------------------------------------------
const rpmEl = $('rpm');
for (let i = 0; i < 15; i++) rpmEl.appendChild(document.createElement('i'));
let miniPath = null, miniXf = null;
function buildMinimap() {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < S.n; i++) { minX = Math.min(minX, S.px[i]); maxX = Math.max(maxX, S.px[i]); minZ = Math.min(minZ, S.pz[i]); maxZ = Math.max(maxZ, S.pz[i]); }
  const size = 420, pad = 30;
  const sc = (size - pad * 2) / Math.max(maxX - minX, maxZ - minZ, 1);
  const ox = (size - (maxX - minX) * sc) / 2, oz = (size - (maxZ - minZ) * sc) / 2;
  // Same orientation as the editor's top view: +x right, +z down.
  miniXf = (x, z) => [ox + (x - minX) * sc, oz + (z - minZ) * sc];
  miniPath = new Path2D();
  for (let i = 0; i <= S.n; i++) { const [a, b] = miniXf(S.px[i % S.n], S.pz[i % S.n]); i ? miniPath.lineTo(a, b) : miniPath.moveTo(a, b); }
  miniPath.closePath();
  miniBg = null;
}
let miniBg = null;
function drawMinimap() {
  const cv = $('mini'), g = cv.getContext('2d');
  if (!miniBg) {
    miniBg = document.createElement('canvas');
    miniBg.width = cv.width; miniBg.height = cv.height;
    const b = miniBg.getContext('2d');
    b.lineJoin = 'round';
    b.strokeStyle = 'rgba(255,255,255,.18)'; b.lineWidth = 14; b.stroke(miniPath);
    b.strokeStyle = '#e8eaee'; b.lineWidth = 5; b.stroke(miniPath);
    const [sx, sz] = miniXf(S.px[0], S.pz[0]);
    b.fillStyle = '#e10600'; b.fillRect(sx - 7, sz - 7, 14, 14);
  }
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(miniBg, 0, 0);
  const [cx, cz] = miniXf(car.x, car.z);
  g.fillStyle = '#ffb800'; g.beginPath(); g.arc(cx, cz, 11, 0, 7); g.fill();
  g.strokeStyle = '#000'; g.lineWidth = 3; g.stroke();
}
// DOM writes only when a value changes, at most 20 times a second.
let hudT = 0;
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHUD(dt) {
  hudT += dt;
  if (hudT < 0.05) return;
  hudT = 0;
  const c = car;
  const kmh = Math.abs(c.vF) * 3.6;
  const spd = String(Math.round(kmh));
  if (hudCache.spd !== spd) { hudCache.spd = spd; $('spd').firstChild.nodeValue = spd; }
  setText('gear', String(c.gear));
  const lit = Math.round(((c.rpm - RPM_IDLE) / (RPM_MAX - RPM_IDLE)) * 15);
  if (hudCache.lit !== lit) { hudCache.lit = lit; [...rpmEl.children].forEach((el, i) => { el.className = i < lit ? (i < 5 ? 'g' : i < 10 ? 'r' : 'b') : ''; }); }
  $('thr').firstChild.style.width = Math.round(input.throttle * 100) + '%';
  $('brk').firstChild.style.width = Math.round(input.brake * 100) + '%';
  setText('surf', SURF_NAMES[c.surf]);
  $('surf').style.color = c.surf === SURF.gravel || c.surf === SURF.grass ? '#ffb800' : '';
  setText('lapNo', 'LAP ' + lap.n);
  setText('lapState', !lap.running ? 'GRID' : lap.valid ? '' : 'INVALID');
  setText('cur', fmtLap(lap.t));
  $('cur').style.color = lap.valid ? '' : '#ff6b6b';
  setText('last', lap.last ? fmtLap(lap.last.t) + (lap.last.valid ? '' : ' ✕') : '–');
  setText('best', fmtLap(lap.best));
  drawMinimap();
}
