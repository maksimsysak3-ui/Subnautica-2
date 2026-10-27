// =====================================================================
//  Driving: input, vehicle dynamics, surfaces, laps, cameras, audio, HUD
// =====================================================================
const CAR = {
  // CG sits 2.0 m behind the front axle (44 % front weight, like a real F1 car).
  mass: 800, Iz: 1150, a: 2.0, b: 1.6, hCG: 0.3, trackW: 1.58,
  power: 760e3, maxDrive: 15500, ClA: 3.9, CdA: 1.25, aeroFront: 0.42, rho: 1.2,
  // Wider rear tyres: more cornering stiffness and a touch more grip -> stable, mild understeer at the limit.
  mu: 1.78, muRear: 1.05, B: 12, BRear: 15, C: 1.45, brakeMu: 0.98, frontBrake: 0.58,
};
CAR.L = CAR.a + CAR.b;
const G = 9.81;
const SURF_GRIP = { [SURF.road]: 1, [SURF.kerb]: 0.93, [SURF.asphalt]: 0.95, [SURF.gravel]: 0.5, [SURF.grass]: 0.56 };
const SURF_ROLL = { [SURF.road]: 0.012, [SURF.kerb]: 0.02, [SURF.asphalt]: 0.015, [SURF.gravel]: 0.55, [SURF.grass]: 0.11 };
const GEAR_TOP = [24, 35, 46, 57, 67, 77, 87, 99];   // m/s at the 12 500 rpm limiter in each gear
const RPM_MAX = 12500, RPM_IDLE = 4200;

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
    const rate = target === 0 || Math.sign(target) !== Math.sign(input.steer) ? 7 : 2.6 + 2 / (1 + speed / 25);
    input.steer += clamp(target - input.steer, -rate * dt, rate * dt);
    input.throttle += clamp((kT ? 1 : 0) - input.throttle, -9 * dt, 5 * dt);
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
  pitch: 0, roll: 0, bodyPitch: 0, bodyRoll: 0, ax: 0, ay: 0,
  gear: 1, rpm: RPM_IDLE, shiftCut: 0, reverse: false, reverseHold: 0,
  wheelSpin: 0, hint: -1, surf: SURF.road, wheelSurf: [0, 0, 0, 0], slip: 0, bump: 0, onKerb: 0,
  tc: true, impact: 0,
};
let carModel = null;
function ensureCarModel() {
  if (carModel && carModel.livery === state.settings.livery) return;
  if (carModel) { scene.remove(carModel.root); carModel.root.traverse((o) => o.geometry && o.geometry.dispose()); }
  carModel = buildCar(state.settings.livery);
  carModel.livery = state.settings.livery;
  scene.add(carModel.root);
}

function placeOnGrid() {
  const back = Math.round(10 / S.step);
  const i = (S.n - back) % S.n;
  const lat = Math.min(3.2, S.w[i] / 4);
  car.x = S.px[i] + leftX(i) * lat; car.z = S.pz[i] + leftZ(i) * lat;
  car.heading = Math.atan2(S.tx[i], S.tz[i]);
  car.vF = car.vL = car.yaw = car.steer = 0;
  car.gear = 1; car.rpm = RPM_IDLE; car.reverse = false; car.hint = i;
  car.y = surfaceHeight(car.x, car.z, i).y;
}
function resetCar() {
  if (!S || mode !== 'drive') return;
  const p = project(car.x, car.z, car.hint);
  if (!p) return;
  const i = p.i;
  const lat = clamp(p.d, -S.w[i] / 2 + 1.5, S.w[i] / 2 - 1.5);
  car.x = S.px[i] + leftX(i) * lat; car.z = S.pz[i] + leftZ(i) * lat;
  car.heading = Math.atan2(S.tx[i], S.tz[i]);
  car.vF = car.vL = car.yaw = 0; car.reverse = false; car.gear = 1; car.hint = i;
  lap.valid = false;
  showToast('RESET — LAP INVALID', '#ffb800');
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
//  Vehicle dynamics: bicycle model with Pacejka-style tyres, load transfer,
//  downforce, friction circles per axle, traction control and ABS.
// ---------------------------------------------------------------------
function tyreForce(alpha, Fz, mu, B) {
  return -mu * Fz * Math.sin(CAR.C * Math.atan(B * alpha));
}
function physicsStep(dt) {
  const c = car;
  const speed = Math.hypot(c.vF, c.vL);
  // Steering lock shrinks with speed so keyboard play stays inside the tyre's window.
  const lock = Math.min(0.36, 0.04 + 5 / (Math.abs(c.vF) + 14));
  const targetSteer = input.steer * lock;
  c.steer += clamp(targetSteer - c.steer, -2.2 * dt, 2.2 * dt);

  // Gear / reverse logic.
  let thr = input.throttle, brk = input.brake;
  if (!c.reverse && c.vF < 0.6 && brk > 0.5 && thr < 0.05) { c.reverseHold += dt; if (c.reverseHold > 0.35) c.reverse = true; }
  else if (!c.reverse) c.reverseHold = 0;
  if (c.reverse && thr > 0.1 && c.vF > -0.6) { c.reverse = false; c.reverseHold = 0; }
  if (c.reverse) { const t = thr; thr = brk; brk = t; }

  // Normal loads: static + aero + longitudinal transfer.
  const down = 0.5 * CAR.rho * CAR.ClA * speed * speed;
  const W = CAR.mass * G;
  let Fzf = W * CAR.b / CAR.L + down * CAR.aeroFront - CAR.mass * c.ax * CAR.hCG / CAR.L;
  let Fzr = W * CAR.a / CAR.L + down * (1 - CAR.aeroFront) + CAR.mass * c.ax * CAR.hCG / CAR.L;
  Fzf = Math.max(Fzf, 200); Fzr = Math.max(Fzr, 200);
  const gF = (SURF_GRIP[c.wheelSurf[0]] + SURF_GRIP[c.wheelSurf[1]]) / 2;
  const gR = (SURF_GRIP[c.wheelSurf[2]] + SURF_GRIP[c.wheelSurf[3]]) / 2;
  const load = (Fz) => 1 - 0.07 * (Fz / 4500 - 1);       // mild load sensitivity
  const muF = CAR.mu * gF * load(Fzf / 2), muR = CAR.mu * CAR.muRear * gR * load(Fzr / 2);

  // Slip angles.
  const vRef = Math.max(Math.abs(c.vF), 3);
  const dir = c.vF >= 0 ? 1 : -1;
  const aF = Math.atan2(c.vL + CAR.a * c.yaw, vRef) - c.steer * dir;
  const aR = Math.atan2(c.vL - CAR.b * c.yaw, vRef);
  let Fyf = tyreForce(aF, Fzf, muF, CAR.B), Fyr = tyreForce(aR, Fzr, muR, CAR.BRear);

  // Longitudinal: power-limited drive on the rear, split braking, shift cut.
  c.shiftCut = Math.max(0, c.shiftCut - dt);
  let drive = 0;
  if (c.reverse) drive = -thr * (c.vF > -11 ? 5200 : 0);
  else if (c.shiftCut <= 0) drive = thr * Math.min(CAR.maxDrive, CAR.power / Math.max(Math.abs(c.vF), 6));
  const brakeTotal = brk * CAR.brakeMu * (muF * Fzf + muR * Fzr);
  const bsign = Math.abs(c.vF) > 0.3 ? Math.sign(c.vF) : 0;
  let Fxf = -bsign * brakeTotal * CAR.frontBrake;
  let Fxr = drive - bsign * brakeTotal * (1 - CAR.frontBrake);
  if (!thr && !brk && !c.reverse) Fxr -= Math.sign(c.vF) * Math.min(1800, Math.abs(c.vF) * 400);   // engine braking
  if (c.tc) {
    // Assists: traction control trims power, and cornering brake control eases the rear brakes,
    // so the rear tyres always keep enough grip to hold the line (the rear never steps out under braking).
    const room = Math.sqrt(Math.max(0, (muR * Fzr) ** 2 - Fyr * Fyr)) * 0.94;
    if (!c.reverse && drive > 0) Fxr = Math.min(Fxr, room);
    else if (Fxr < 0) Fxr = Math.max(Fxr, -room);
  }
  // ABS on the fronts: braking never takes more than the grip left after cornering (keeping at
  // least 70 % of full braking), so the car still turns while trail-braking.
  if (Fxf < 0) {
    const capF = muF * Fzf;
    Fxf = Math.max(Fxf, -Math.max(0.7 * capF, Math.sqrt(Math.max(0, capF * capF - Fyf * Fyf))));
  }
  // Friction circles (without assists, wheelspin and rear braking eat lateral grip).
  const circle = (Fx, Fy, cap) => {
    Fx = clamp(Fx, -cap, cap);
    const room = Math.sqrt(Math.max(0, cap * cap - Fx * Fx));
    return [Fx, clamp(Fy, -room, room)];
  };
  [Fxf, Fyf] = circle(Fxf, Fyf, muF * Fzf);
  [Fxr, Fyr] = circle(Fxr, Fyr, muR * Fzr);

  // Resistances: aero drag, rolling/surface drag, gravity along the slope.
  const drag = 0.5 * CAR.rho * CAR.CdA * c.vF * Math.abs(c.vF);
  const crr = (SURF_ROLL[c.wheelSurf[0]] + SURF_ROLL[c.wheelSurf[1]] + SURF_ROLL[c.wheelSurf[2]] + SURF_ROLL[c.wheelSurf[3]]) / 4;
  const roll = Math.abs(c.vF) > 0.05 ? Math.sign(c.vF) * crr * W * Math.min(1, Math.abs(c.vF) / 2) : 0;
  const slopeF = -W * Math.sin(c.pitch), slopeL = -W * Math.sin(c.roll);   // gravity pulls toward the low side

  const cs = Math.cos(c.steer), sn = Math.sin(c.steer);
  const FxTot = Fxf * cs - Fyf * sn + Fxr - drag - roll + slopeF;
  const FyTot = Fyf * cs + Fxf * sn + Fyr + slopeL;
  const Mz = CAR.a * (Fyf * cs + Fxf * sn) - CAR.b * Fyr;
  c.ax = lerp(c.ax, FxTot / CAR.mass, Math.min(1, dt * 12));
  c.ay = FyTot / CAR.mass;
  c.vF += (FxTot / CAR.mass + c.yaw * c.vL) * dt;
  c.vL += (FyTot / CAR.mass - c.yaw * c.vF) * dt;
  c.yaw += (Mz / CAR.Iz) * dt;
  // Low speed: blend toward rolling kinematics so the car doesn't jitter or spin on the spot.
  const kin = clamp(1 - Math.abs(c.vF) / 4, 0, 1);
  if (kin > 0) {
    c.yaw = lerp(c.yaw, (c.vF * Math.tan(c.steer)) / CAR.L, kin * Math.min(1, dt * 18));
    c.vL *= 1 - kin * Math.min(1, dt * 10);
    if (!thr && !c.reverse && Math.abs(c.vF) < 0.4 && brk > 0.1) c.vF = 0;
  }
  c.heading += c.yaw * dt;
  const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
  const lx = Math.cos(c.heading), lz = -Math.sin(c.heading);
  c.x += (fx * c.vF + lx * c.vL) * dt;
  c.z += (fz * c.vF + lz * c.vL) * dt;
  c.slip = Math.max(Math.abs(aF), Math.abs(aR)) - 0.09 + (Math.abs(Fxr) > 0.97 * muR * Fzr ? 0.05 : 0);

  // Gearbox (sound + HUD; power delivery is smoothed above).
  if (!c.reverse) {
    const v = Math.max(0, c.vF);
    c.rpm = clamp((v / GEAR_TOP[c.gear - 1]) * RPM_MAX, RPM_IDLE, RPM_MAX);
    if (c.rpm > 11900 && c.gear < 8) { c.gear++; c.shiftCut = 0.05; }
    else if (c.gear > 1 && (v / GEAR_TOP[c.gear - 2]) * RPM_MAX < 9800) c.gear--;
    if (c.gear === 1 && v < 2 && thr > 0) c.rpm = Math.max(c.rpm, RPM_IDLE + thr * 5000);
  } else c.rpm = clamp(RPM_IDLE + Math.abs(c.vF) * 500, RPM_IDLE, 9000);
}

// Wheels on the ground: surfaces, ride height, pitch/roll from terrain, barrier contact.
const WHEEL_OFF = [[0.79, CAR.a], [-0.79, CAR.a], [0.77, -CAR.b], [-0.77, -CAR.b]];   // [left offset, forward offset]
function groundStep(dt) {
  const c = car;
  const fx = Math.sin(c.heading), fz = Math.cos(c.heading), lx = Math.cos(c.heading), lz = -Math.sin(c.heading);
  const hs = [];
  let kerb = 0;
  for (let w = 0; w < 4; w++) {
    const [ox, oz] = WHEEL_OFF[w];
    const r = surfaceHeight(c.x + lx * ox + fx * oz, c.z + lz * ox + fz * oz, c.hint);
    c.wheelSurf[w] = r.surf; hs.push(r.y);
    if (r.surf === SURF.kerb) kerb++;
  }
  const centre = surfaceHeight(c.x, c.z, c.hint);
  if (centre.p) c.hint = centre.p.i;
  c.surf = centre.surf;
  c.onKerb = kerb;
  const front = (hs[0] + hs[1]) / 2, rear = (hs[2] + hs[3]) / 2, left = (hs[0] + hs[2]) / 2, right = (hs[1] + hs[3]) / 2;
  const tPitch = Math.atan2(front - rear, CAR.L), tRoll = Math.atan2(left - right, CAR.trackW);
  c.pitch = lerp(c.pitch, tPitch, Math.min(1, dt * 20));
  c.roll = lerp(c.roll, tRoll, Math.min(1, dt * 20));
  c.y = lerp(c.y, (front + rear) / 2, Math.min(1, dt * 30));
  // Barriers.
  if (centre.p && state.settings.barriers) {
    const p = centre.p, k = p.d > 0 ? 0 : 1, side = p.d > 0 ? 1 : -1;
    const lim = Math.min(S.bar[k][p.i], S.lim[k][p.i]) - 1.05;
    if (Math.abs(p.d) > lim) {
      const nx = leftX(p.i) * side, nz = leftZ(p.i) * side;          // outward normal
      const pen = Math.abs(p.d) - lim;
      c.x -= nx * pen; c.z -= nz * pen;
      let vx = fx * c.vF + lx * c.vL, vz = fz * c.vF + lz * c.vL;
      const vn = vx * nx + vz * nz;
      if (vn > 0) {
        vx -= nx * vn * 1.3; vz -= nz * vn * 1.3;
        const keep = clamp(1 - vn / 60, 0.55, 0.92);
        vx *= keep; vz *= keep;
        c.vF = vx * fx + vz * fz; c.vL = vx * lx + vz * lz;
        c.yaw *= 0.5;
        c.impact = Math.max(c.impact, Math.min(1, vn / 25));
        if (vn > 4) { lap.valid = false; audio.thump(Math.min(1, vn / 30)); }
      }
    }
  }
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
    camera.position.set(0, 1.24, -0.42).applyMatrix4(carModel.body.matrixWorld);
    camState.look.set(0, 0.9, 14).applyMatrix4(carModel.body.matrixWorld);
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
}
function drawMinimap() {
  const cv = $('mini'), g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 14; g.stroke(miniPath);
  g.strokeStyle = '#e8eaee'; g.lineWidth = 5; g.stroke(miniPath);
  const [sx, sz] = miniXf(S.px[0], S.pz[0]);
  g.fillStyle = '#e10600'; g.fillRect(sx - 7, sz - 7, 14, 14);
  const [cx, cz] = miniXf(car.x, car.z);
  g.fillStyle = '#ffb800'; g.beginPath(); g.arc(cx, cz, 11, 0, 7); g.fill();
  g.strokeStyle = '#000'; g.lineWidth = 3; g.stroke();
}
function updateHUD() {
  const c = car;
  const kmh = Math.abs(c.vF) * 3.6;
  $('spd').firstChild.nodeValue = Math.round(kmh);
  $('gear').textContent = c.reverse ? 'R' : kmh < 1 && input.throttle < 0.05 ? 'N' : c.gear;
  const lit = Math.round(((c.rpm - RPM_IDLE) / (RPM_MAX - RPM_IDLE)) * 15);
  [...rpmEl.children].forEach((el, i) => { el.className = i < lit ? (i < 5 ? 'g' : i < 10 ? 'r' : 'b') : ''; });
  $('thr').firstChild.style.width = (input.throttle * 100) + '%';
  $('brk').firstChild.style.width = (input.brake * 100) + '%';
  $('surf').textContent = SURF_NAMES[c.surf];
  $('surf').style.color = c.surf === SURF.gravel || c.surf === SURF.grass ? '#ffb800' : '';
  $('lapNo').textContent = 'LAP ' + lap.n;
  $('lapState').textContent = !lap.running ? 'GRID' : lap.valid ? '' : 'INVALID';
  $('cur').textContent = fmtLap(lap.t);
  $('cur').style.color = lap.valid ? '' : '#ff6b6b';
  $('last').textContent = lap.last ? fmtLap(lap.last.t) + (lap.last.valid ? '' : ' ✕') : '–';
  $('best').textContent = fmtLap(lap.best);
  drawMinimap();
}
