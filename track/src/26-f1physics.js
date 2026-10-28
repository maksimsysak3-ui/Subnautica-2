// =====================================================================
//  Vehicle physics, ported from the F4 racer (maksimsysak3-ui/F4, racer/src/physics + config):
//  rigid body, raycast suspension, slip-based tyres, gearbox, ABS/TC/ESC assists.
// =====================================================================
F4.config = (() => {
// World and assist tunables. Each car's own handling lives in src/cars/<car>/spec.js.
// Units are SI: metres, kilograms, seconds, newtons, radians.

const PHYSICS_HZ = 240;

const TRACK = {
  centerRadius: 150,
  width: 22,
  thickness: 2.4,      // visual slab depth under the asphalt
  kerbWidth: 1.4,
  kerbHeight: 0.035,   // kerbs are real bumps the suspension feels
  kerbBlockLength: 2.2,
  segments: 360,
  voidY: -40,          // below this the car is lost and respawns
};

const ASSISTS = {
  tractionSlip: 0.14,      // target max slip ratio with TC on
  stabilitySlip: 1.08,     // max combined slip on a driven tire before TC trims power
  escGrip: 1.65,           // g used to cap the yaw rate the driver can ask for (just above real grip)
  escDeadband: 0.06,       // rad/s of extra yaw tolerated before ESC steps in
  escGain: 4000,           // Nm of outside-front brake per rad/s of excess yaw
  escMaxTorque: 1500,
  escSlipAngle: 0.12,      // rad of tail-out sideslip ESC tolerates
  escSlipGain: 2.5,        // ESC level per rad of sideslip beyond that
  absSlip: 0.10,
  absCapMargin: 1.0,       // brake torque cap as a fraction of what the tyre can transmit
  absSlipRear: 0.06,       // rears are held well inside the limit so they keep side grip
  alignDeadband: 0.07,     // rad of body slide before the fronts start following the direction of travel
  alignGain: 1.0,          // how fully they follow it (1 = wheels track the slide)
  yawGain: 7,              // assist: how hard the car is turned toward the requested yaw rate (1/s)
  yawTorque: 0.32,         // assist: max yaw torque as a fraction of m*g*wheelbase
  assistGrip: 1.0,         // assist: requested yaw is capped at this fraction of the ESC grip
  slideDamp: 1.6,          // assist: sideways slide decay rate (1/s)
  slideMax: 0.35,          // assist: cap on the anti-slide force (g)
  brakeBoost: 0.6,         // extra braking deceleration (g) with assists on, along the nose
  brakeYawCut: 0.45,       // handling assist asks for this much less rotation at full brake
  frontSlipCap: 1.1,       // steering limiter: front slip angle at most this x the tyre's peak
  counterBeta: 0.04,       // slip (rad) from which a counter-steer stops asking the assist for rotation
  counterRange: 0.1,       // ...fading over this much more slip
  counterFloor: 0.1,       // ...to this fraction of the requested yaw rate
  handbrakeScale: 0.45,    // handbrake torque with assists on
  handbrakeSlideCap: 0.45, // rad: past this, ESC intervenes even with the handbrake held
};

/**
 * SPORT assists (the default): the same helpers with a looser grip. Wheels can lock
 * for a moment under a stamp on the brakes mid-corner, the rears can be spun up, and
 * the stability aids saturate well past the limit, so overdriving can still end in a spin.
 */
const SPORT = {
  ...ASSISTS,
  tractionSlip: 0.19,
  stabilitySlip: 1.3,
  escDeadband: 0.14,
  escGain: 2200,
  escMaxTorque: 900,
  escSlipAngle: 0.2,
  escSlipGain: 1.4,
  absSlip: 0.35,          // a stamp on the brakes locks the fronts for a moment (smoke, flat-spot squeal)
  absCapMargin: 1.2,
  absSlipRear: 0.22,
  yawTorque: 0.16,
  slideDamp: 0.7,
  slideMax: 0.18,
  brakeBoost: 0.45,
  frontSlipCap: 1.25,
  counterFloor: 0.3,
  handbrakeScale: 0.7,
  handbrakeSlideCap: 0.8,
};
return { PHYSICS_HZ, TRACK, ASSISTS, SPORT };
})();
F4.rigidbody = (() => {
const { Vector3, Quaternion } = THREE;
const _r = new Vector3();
const _t = new Vector3();
const _q = new Quaternion();
const _qInv = new Quaternion();
const _dq = new Quaternion();

/**
 * Minimal 6-DOF rigid body with a diagonal body-space inertia tensor.
 * Forces accumulate during a step and are cleared by integrate().
 */
class RigidBody {
  constructor(mass, inertia) {
    this.mass = mass;
    this.invMass = 1 / mass;
    this.invInertia = new Vector3(1 / inertia.x, 1 / inertia.y, 1 / inertia.z);

    this.position = new Vector3();
    this.quaternion = new Quaternion();
    this.velocity = new Vector3();
    this.angularVelocity = new Vector3(); // world space

    this.force = new Vector3();
    this.torque = new Vector3();
  }

  applyForce(f) {
    this.force.add(f);
  }

  applyForceAtPoint(f, worldPoint) {
    this.force.add(f);
    _r.subVectors(worldPoint, this.position);
    this.torque.add(_t.crossVectors(_r, f));
  }

  applyTorque(t) {
    this.torque.add(t);
  }

  /** Velocity of a world-space point rigidly attached to the body. */
  pointVelocity(worldPoint, out) {
    _r.subVectors(worldPoint, this.position);
    return out.crossVectors(this.angularVelocity, _r).add(this.velocity);
  }

  /** Body-space vector -> world-space point. */
  localToWorld(local, out) {
    return out.copy(local).applyQuaternion(this.quaternion).add(this.position);
  }

  /** Semi-implicit Euler. Gyroscopic term omitted (stable, negligible for a car). */
  integrate(dt) {
    this.velocity.addScaledVector(this.force, this.invMass * dt);

    // dw = R * I^-1 * R^T * torque * dt
    _qInv.copy(this.quaternion).invert();
    _t.copy(this.torque).applyQuaternion(_qInv).multiply(this.invInertia).applyQuaternion(this.quaternion);
    this.angularVelocity.addScaledVector(_t, dt);

    this.position.addScaledVector(this.velocity, dt);

    const w = this.angularVelocity;
    _dq.set(w.x * dt * 0.5, w.y * dt * 0.5, w.z * dt * 0.5, 0);
    _q.multiplyQuaternions(_dq, this.quaternion);
    this.quaternion.x += _q.x;
    this.quaternion.y += _q.y;
    this.quaternion.z += _q.z;
    this.quaternion.w += _q.w;
    this.quaternion.normalize();

    this.force.set(0, 0, 0);
    this.torque.set(0, 0, 0);
  }
}
return { RigidBody };
})();
F4.tire = (() => {
/**
 * Combined-slip tire model.
 *
 * Slip ratio and slip angle are normalised by their peak values and combined
 * into one slip magnitude `s` (friction ellipse). A single curve maps `s` to the
 * fraction of available grip: it rises to 1 at s = 1 (the peak) and decays
 * smoothly towards `slide` as the tire slides. The resulting force is split back
 * into longitudinal / lateral parts in proportion to each normalised slip, so
 * hard braking eats into cornering grip and vice versa.
 */

/** Grip fraction for a normalised combined slip (C1-continuous). */
function frictionCurve(s, slide, falloff) {
  if (s <= 1) return 1.5 * s - 0.5 * s * s * s;
  const e = s - 1;
  return slide + (1 - slide) * Math.exp(-falloff * e * e);
}

/** Grip drops as a tire is loaded beyond its nominal load (why weight transfer matters). */
function loadFactor(load, nominalLoad, sensitivity) {
  return Math.max(0.6, 1 - sensitivity * (load / nominalLoad - 1));
}

/**
 * @param {object} t        tire params (muLat, muLong, peakSlipAngle, peakSlipRatio, slide, falloff)
 * @param {number} grip     normal load * load factor (N)
 * @param {number} slipRatio  (wheel surface speed - ground speed) / reference speed
 * @param {number} slipAngle  radians, positive when the contact patch slides to the left
 * @param {object} out      receives fx (forward +), fy (left +), slip (combined, normalised)
 */
function tireForce(t, grip, slipRatio, slipAngle, out) {
  const sx = slipRatio / t.peakSlipRatio;
  const sy = slipAngle / t.peakSlipAngle;
  const s = Math.hypot(sx, sy);
  out.slip = s;
  if (s < 1e-9 || grip <= 0) {
    out.fx = 0;
    out.fy = 0;
    return out;
  }
  const f = frictionCurve(s, t.slide, t.falloff) * grip / s;
  out.fx = f * sx * t.muLong;
  out.fy = -f * sy * t.muLat;
  return out;
}

/** Max d(fx)/d(slipRatio): used to integrate wheel spin implicitly (stable at any load). */
function longitudinalStiffness(t, grip) {
  return (1.5 * grip * t.muLong) / t.peakSlipRatio;
}
return { frictionCurve, loadFactor, tireForce, longitudinalStiffness };
})();
F4.vehicle = (() => {
const { Vector3, Quaternion } = THREE;
const { ASSISTS, SPORT } = F4.config;
const { RigidBody } = F4.rigidbody;
const { tireForce, loadFactor, longitudinalStiffness } = F4.tire;
const G = 9.81;
const WHEEL_SUBSTEPS = 6;
const RPM_PER_RADS = 60 / (2 * Math.PI);
const GEAR_R = 0;
const GEAR_N = 1;
const GEAR_FIRST = 2;

const UP = new Vector3(0, 1, 0);
const WALL = { stiffness: 320000, damping: 14000, friction: 0.3 };
const _v = new Vector3();
const _p = new Vector3();
const _q2 = new Vector3();
const _ax = new Vector3();
const _qa = new Quaternion();
const _f = new Vector3();
const _fwd = new Vector3();
const _up = new Vector3();
const _left = new Vector3();
const _wf = new Vector3();
const _wl = new Vector3();
const _tire = { fx: 0, fy: 0, slip: 0 };

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

function sampleCurve(curve, x) {
  if (x <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (x <= curve[i][0]) {
      const [x0, y0] = curve[i - 1];
      const [x1, y1] = curve[i];
      return lerp(y0, y1, (x - x0) / (x1 - x0));
    }
  }
  return curve[curve.length - 1][1];
}

class Wheel {
  constructor(spec, cfg) {
    const front = spec.axle === 'front';
    const s = cfg.suspension;
    const axleZ = front ? cfg.cgToFront : -(cfg.wheelbase - cfg.cgToFront);
    this.id = spec.id;
    this.isFront = front;
    this.isLeft = spec.x > 0;
    this.anchor = new Vector3(spec.x, s.anchorHeight, axleZ); // body space
    this.radius = cfg.wheelRadius;
    this.tire = front ? cfg.tires.front : cfg.tires.rear;
    this.susp = front ? s.front : s.rear;
    this.restLength = s.restLength;
    this.maxCompression = s.maxTravel + 0.075;

    // Dynamic state
    this.compression = 0;
    this.prevCompression = 0;
    this.suspensionLength = s.restLength;
    this.inContact = false;
    this.springForce = 0;
    this.load = 0;
    this.omega = 0;           // spin rate, rad/s (+ = rolling forwards)
    this.spinAngle = 0;
    this.steer = 0;           // rad, + = left
    this.driveTorque = 0;
    this.brakeTorque = 0;
    this.slipRatio = 0;
    this.slipAngle = 0;
    this.slip = 0;            // normalised combined slip (1 = peak grip)
    this.fx = 0;
    this.fy = 0;
    this.absFactor = 1;
    this.vLong = 0;
    this.vLat = 0;
    this.groundSpeed = 0;
    this.contactPoint = new Vector3();
    this.forward = new Vector3();
    this.lateral = new Vector3();
  }

  get surfaceSpeed() {
    return this.omega * this.radius;
  }
}

/**
 * Raycast-suspension vehicle on a 6-DOF rigid body.
 * Each physics step: suspension -> drivetrain + tires (sub-stepped wheel spin)
 * -> aero -> hull contacts -> integrate.
 */
class Vehicle {
  /** @param cfg a car spec from src/cars (physics fields + proportions) */
  constructor(ground, cfg) {
    this.cfg = cfg;
    this.ground = ground;
    this.body = new RigidBody(cfg.mass, cfg.inertia);
    this.wheels = cfg.wheels.map((w) => new Wheel(w, cfg));
    this.nominalLoad = (cfg.mass * G) / 4;
    this.staticRearLoad = (cfg.mass * G * (cfg.cgToFront / cfg.wheelbase)) / 2;

    const cgZ = cfg.wheelbase / 2 - cfg.cgToFront; // CG position in model space
    this.modelOffset = new Vector3(0, -cfg.cgHeight, -cgZ); // model space -> body space
    this.hullPoints = cfg.hullPoints.map((p) => new Vector3(...cfg.proportions.designToModel(p)).add(this.modelOffset));

    // Driver-facing settings (toggled from the UI)
    this.damage = 0;        // 0 pristine .. 1 wrecked (set by the crash system, cleared on reset)
    this.hitPoint = new Vector3();
    this.hitNormal = new Vector3();
    this.assistLevel = 2; // 0 off, 1 sport, 2 full (the game picks SPORT from settings)
    this.wetness = 0; // 0 dry .. 1 soaking (set by the weather)
    this.puddleAt = null; // (x, z) -> standing-water depth 0..1, set by the weather
    this.automatic = true;
    this.awd = true;

    this.reset(new Vector3(0, 0, 0), 0);
  }

  reset(position, yaw) {
    const b = this.body;
    this.damage = 0;
    b.position.copy(position).y += this.cfg.cgHeight + 0.05;
    b.quaternion.setFromAxisAngle(UP, yaw);
    // On a slope, start pitched with the road so the wheels all touch at once.
    const half = this.cfg.wheelbase / 2;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const hf = this.ground.heightAt(position.x + fx * half, position.z + fz * half);
    const hr = this.ground.heightAt(position.x - fx * half, position.z - fz * half);
    if (hf !== null && hr !== null && Math.abs(hf - hr) > 0.01) {
      const pitch = Math.atan2(hf - hr, 2 * half); // nose up = positive
      b.quaternion.multiply(_qa.setFromAxisAngle(_ax.set(1, 0, 0), -pitch));
      b.position.y = (hf + hr) / 2 + this.cfg.cgHeight + 0.05;
    }
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    for (const w of this.wheels) {
      w.omega = 0;
      w.compression = w.prevCompression = 0.06;
      w.absFactor = 1;
    }
    this.gear = GEAR_FIRST;
    this.pendingGear = GEAR_FIRST;
    this.shiftTimer = 0;
    this.rpm = this.cfg.engine.idleRpm;
    this.clutchLocked = false;
    this.limiterTimer = 0;
    this.tcFactor = 1;
    this.escLevel = 0;
    this.tcActive = false;
    this.absActive = false;
    this.stopTimer = 0;
    this.steerAngle = 0;
    this.steerIntent = 0;
    this.throttle = 0;
    this.brake = 0;
    this.aeroMode = 0;        // active aero: 0 = Z-mode (cornering), 1 = X-mode (straight-line)
    this.engineTorque = 0;
    this.airTime = 0;
  }

  // ---------- Derived quantities ----------

  get forward() { return _fwd.set(0, 0, 1).applyQuaternion(this.body.quaternion); }
  get speed() { return this.body.velocity.length(); }
  get forwardSpeed() { return this.body.velocity.dot(this.forward); }

  /** Gear for display: during a shift, show the gear being engaged. */
  get gearLabel() {
    const g = this.isShifting ? this.pendingGear : this.gear;
    if (g === GEAR_R) return 'R';
    if (g === GEAR_N) return 'N';
    return String(g - 1);
  }

  get isShifting() { return this.shiftTimer > 0; }

  /** Any assists on (0 off, 1 sport, 2 full). */
  get assists() { return this.assistLevel > 0; }
  set assists(on) { this.assistLevel = on === true ? 2 : on === false ? 0 : on; }
  /** Assist tuning for the current level. */
  /**
   * Grip (in g) the stability aids expect at speed v. Downforce cars set escGripAero: their
   * grip grows with v^2, so a fixed figure would let them rotate past the tyres at low speed.
   */
  escGripAt(v) {
    const c = this.cfg, base = c.escGrip ?? this.A.escGrip;
    return c.escGripAero ? Math.min(c.escGripMax ?? base * 2, base + c.escGripAero * v * v) : base;
  }

  /** Assist settings for the current level, with the car's own overrides (cfg.assistTune.sport / .full). */
  get A() {
    const sport = this.assistLevel === 1;
    const t = this.cfg.assistTune?.[sport ? 'sport' : 'full'];
    if (!t) return sport ? SPORT : ASSISTS;
    const key = sport ? '_aSport' : '_aFull';
    return this[key] ?? (this[key] = { ...(sport ? SPORT : ASSISTS), ...t });
  }

  /** Body side-slip angle (rad), + when the car slides towards its left. */
  get slipAngle() {
    const b = this.body;
    _fwd.set(0, 0, 1).applyQuaternion(b.quaternion);
    _left.set(1, 0, 0).applyQuaternion(b.quaternion);
    const vl = b.velocity.dot(_fwd);
    const vs = b.velocity.dot(_left);
    if (Math.hypot(vl, vs) < 3) return 0;
    return Math.atan2(vs, Math.abs(vl));
  }

  /**
   * Wet-road grip for a wheel: the film of water costs grip on asphalt, more on
   * painted surfaces and kerbs, and at speed the tyre starts to aquaplane.
   */
  weatherGrip(w) {
    const wet = this.wetness;
    if (!wet) return 1;
    const painted = w.surface === 'kerb' || w.surface === 'paint' ? 0.12 : 0;
    const aqua = Math.max(0, (w.groundSpeed - 38) / 30) * 0.25; // above ~140 km/h the tread can't clear the water
    // Standing water: a puddle takes grip away, and at speed the tyre rides up on it (aquaplaning).
    const depth = this.puddleAt ? this.puddleAt(w.contactPoint.x, w.contactPoint.z) : 0;
    w.puddle = depth;
    const pool = depth * (0.18 + Math.min(0.32, Math.max(0, (w.groundSpeed - 18) / 40) * 0.32));
    return Math.max(0.3, 1 - wet * (0.3 + painted + Math.min(0.25, aqua) + pool));
  }

  get wheelsInContact() {
    let n = 0;
    for (const w of this.wheels) if (w.inContact) n++;
    return n;
  }

  // ---------- Main step ----------

  /**
   * @param {number} dt
   * @param {{throttle:number, brake:number, steer:number, handbrake:number, shiftUp?:boolean, shiftDown?:boolean}} input
   *        steer: -1 (left) .. +1 (right)
   */
  step(dt, input) {
    const b = this.body;
    _fwd.set(0, 0, 1).applyQuaternion(b.quaternion);
    _up.set(0, 1, 0).applyQuaternion(b.quaternion);
    _left.set(1, 0, 0).applyQuaternion(b.quaternion);

    this.updateGearbox(dt, input);
    this.mapPedals(input);
    this.updateSteering(dt, input);
    this.updateSuspension(dt);
    this.updateWheelsAndDrivetrain(dt, input);
    this.applyTireForces(dt);
    if (this.assists) this.applyHandlingAssist(input);
    this.applyAero(dt);
    this.applyHullContacts(dt);
    b.applyForce(_f.set(0, -G * b.mass, 0));
    b.integrate(dt);

    for (const w of this.wheels) w.spinAngle = (w.spinAngle + w.omega * dt) % (Math.PI * 2);
    this.airTime = this.wheelsInContact === 0 ? this.airTime + dt : 0;
  }

  // ---------- Gearbox & pedals ----------

  shiftTo(gear) {
    const g = clamp(gear, GEAR_R, this.cfg.gearbox.ratios.length - 1);
    if (g === this.gear && !this.isShifting) return;
    this.pendingGear = g;
    // Into/out of reverse or neutral is instant; real shifts cut torque briefly.
    if (g <= GEAR_N || this.gear <= GEAR_N) {
      this.gear = g;
      this.shiftTimer = 0;
    } else {
      this.shiftTimer = this.cfg.gearbox.shiftTime;
      this.gear = GEAR_N;
    }
  }

  updateGearbox(dt, input) {
    const gb = this.cfg.gearbox;
    const top = gb.ratios.length - 1;

    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt;
      if (this.shiftTimer <= 0) {
        this.shiftTimer = 0;
        this.gear = this.pendingGear;
      }
      return;
    }

    if (!this.automatic) {
      if (input.shiftUp) this.shiftTo(this.gear + 1);
      else if (input.shiftDown) this.shiftTo(this.gear - 1);
      return;
    }

    const v = this.forwardSpeed;
    const g = this.gear;

    // Reverse handling: hold brake at a standstill to engage R, throttle to go back to 1st.
    const stopped = Math.abs(v) < 0.7;
    if (g >= GEAR_FIRST && stopped && input.brake > 0.1 && input.throttle < 0.05) {
      this.stopTimer += dt;
      if (this.stopTimer > 0.25) { this.shiftTo(GEAR_R); this.stopTimer = 0; }
      return;
    }
    if (g === GEAR_R && stopped && input.throttle > 0.1 && input.brake < 0.05) {
      this.stopTimer += dt;
      if (this.stopTimer > 0.1) { this.shiftTo(GEAR_FIRST); this.stopTimer = 0; }
      return;
    }
    this.stopTimer = 0;
    if (g === GEAR_N) { this.shiftTo(GEAR_FIRST); return; }
    if (g < GEAR_FIRST) return;

    // Don't hunt gears while airborne or wildly spinning the wheels.
    if (this.wheelsInContact < 2) return;
    const rpm = this.wheelRpm(g);
    if (rpm > gb.upshiftRpm && g < top && input.throttle > 0.15) {
      this.shiftTo(g + 1);
    } else if (g > GEAR_FIRST) {
      const lowerRpm = this.wheelRpm(g - 1);
      const threshold = input.brake > 0.2 ? gb.downshiftRpm + 1200 : gb.downshiftRpm;
      if (rpm < threshold && lowerRpm < gb.upshiftRpm - 700) this.shiftTo(g - 1);
    }
  }

  /** Engine rpm implied by the driven wheels in a given gear. */
  wheelRpm(gear) {
    const ratio = this.cfg.gearbox.ratios[gear] * this.cfg.gearbox.finalDrive;
    return this.drivenOmega() * ratio * RPM_PER_RADS;
  }

  /** Front-wheel-drive cars have no driveshaft to the rear: the AWD toggle doesn't apply. */
  get fwd() { return this.cfg.drivetrain.layout === 'fwd'; }

  /** Share of drive torque sent to the front axle. */
  get frontShare() { return this.fwd ? 1 : this.awd ? this.cfg.drivetrain.awdFrontShare : 0; }

  get layoutLabel() { return this.fwd ? 'FWD' : this.awd ? 'AWD' : 'RWD'; }

  drivenOmega() {
    const [fl, fr, rl, rr] = this.wheels;
    const fs = this.frontShare;
    return fs * (fl.omega + fr.omega) / 2 + (1 - fs) * (rl.omega + rr.omega) / 2;
  }

  mapPedals(input) {
    // In automatic reverse the pedals swap so "down" keeps meaning "go backwards".
    const swap = this.automatic && this.gear === GEAR_R;
    this.throttle = swap ? input.brake : input.throttle;
    this.brake = swap ? input.throttle : input.brake;
  }

  // ---------- Steering ----------

  updateSteering(dt, input) {
    const st = this.cfg.steering;
    const v = Math.max(1, Math.abs(this.forwardSpeed));
    const geometric = (this.cfg.wheelbase * st.limitGrip * G) / (v * v);
    let limit = Math.min(st.maxAngle, geometric + st.limitSlip);

    // Positive steer angle = left. Input +1 = right.
    const target = -input.steer;
    const beta = this.slipAngle;
    this.steerIntent = target * limit; // what the driver asks for (ESC's yaw reference)
    if (this.assists) {
      // Self-aligning steering: once the body slides beyond normal cornering
      // slip, the fronts follow the direction of travel the way a real wheel
      // lets go through its caster. Steering input is then measured from where
      // the car is going, so a held key can never pile on counter-lock and
      // whip the car into the opposite slide (the keyboard tank-slapper).
      const excess = Math.sign(beta) * Math.max(0, Math.abs(beta) - this.A.alignDeadband) * this.A.alignGain;
      const driver = target * limit;
      // A driver counter-steering on top of the self-aligned wheel would double the
      // counter-lock and fire the car into the opposite slide: the larger of the two wins.
      const counter = excess !== 0 && Math.sign(driver) === Math.sign(excess);
      const angle = counter ? Math.sign(excess) * Math.max(Math.abs(driver), Math.abs(excess)) : driver + excess;
      this.steerAngle = clamp(angle, -st.maxAngle, st.maxAngle);
      // Front grip limiter: a held key would wind on more lock than the tyres can use, so the
      // fronts scrub past their peak and the car washes wide. Keep the front slip angle at the
      // tyre's peak (measured from where the front axle is actually travelling).
      if (v > 3) {
        const b = this.body;
        const fl = this.wheels[0], fr = this.wheels[1];
        _p.copy(fl.anchor).add(fr.anchor).multiplyScalar(0.5);
        b.localToWorld(_p, _q2);
        b.pointVelocity(_q2, _v);
        const flow = Math.atan2(_v.dot(_left), Math.max(1, _v.dot(_fwd))); // + = travelling left of the nose
        const pk = fl.tire.peakSlipAngle * this.A.frontSlipCap;
        this.steerAngle = clamp(this.steerAngle, flow - pk, flow + pk);
      }
    } else {
      // Raw: extra lock when counter-steering so drifts are catchable by hand.
      if (Math.sign(target) === Math.sign(beta)) limit = Math.min(st.maxAngle, limit + Math.abs(beta) * 0.9);
      this.steerAngle = target * limit;
    }

    const L = this.cfg.wheelbase;
    const halfTrack = Math.abs(this.wheels[0].anchor.x);
    const a = this.steerAngle;
    for (const w of this.wheels) {
      if (!w.isFront) { w.steer = 0; continue; }
      if (Math.abs(a) < 1e-4) { w.steer = 0; continue; }
      const turnRadius = L / Math.tan(Math.abs(a));
      const inside = (a > 0) === w.isLeft;
      const ideal = Math.atan(L / (turnRadius + (inside ? -halfTrack : halfTrack)));
      w.steer = Math.sign(a) * lerp(Math.abs(a), ideal, st.ackermann);
    }
  }

  // ---------- Suspension ----------

  updateSuspension(dt) {
    const b = this.body;
    const s = this.cfg.suspension;
    const dirY = -_up.y; // ray direction = -up (world y component)

    for (const w of this.wheels) {
      w.prevCompression = w.compression;
      w.inContact = false;
      w.springForce = 0;
      w.load = 0;

      const anchor = b.localToWorld(w.anchor, _p);
      const maxLen = w.restLength + w.radius;
      let t = Infinity;
      if (dirY < -0.25) {
        // Ray vs. height field: estimate at the anchor, refine at the hit point.
        let h = this.ground.heightAt(anchor.x, anchor.z);
        if (h !== null) {
          t = (anchor.y - h) / -dirY;
          const hx = anchor.x - _up.x * t;
          const hz = anchor.z - _up.z * t;
          h = this.ground.heightAt(hx, hz);
          t = h === null ? Infinity : (anchor.y - h) / -dirY;
        }
      }

      // An anchor below the surface (a steep slope or a hard landing) is full compression, not air.
      if (t < 0 && t > -0.6) t = 0;
      if (t >= 0 && t <= maxLen) {
        w.inContact = true;
        w.compression = Math.min(maxLen - t, w.restLength);
        w.contactPoint.copy(anchor).addScaledVector(_up, -t);
      } else {
        w.compression = 0;
      }
      w.suspensionLength = w.restLength - w.compression;
      w.compressionVelocity = (w.compression - w.prevCompression) / dt;

      if (w.inContact) {
        const cv = w.compressionVelocity;
        let f = w.susp.spring * w.compression + (cv > 0 ? w.susp.damperBump : w.susp.damperRebound) * cv;
        const over = w.compression - w.maxCompression;
        if (over > 0) f += s.bumpStopRate * over + 4000 * Math.max(cv, 0);
        w.springForce = f;
      }
    }

    // Anti-roll bars move load from the more-compressed side to the other.
    for (let i = 0; i < 4; i += 2) {
      const l = this.wheels[i];
      const r = this.wheels[i + 1];
      const arb = l.susp.antiRoll * (l.compression - r.compression);
      if (l.inContact) l.springForce += arb;
      if (r.inContact) r.springForce -= arb;
    }

    for (const w of this.wheels) {
      if (!w.inContact) continue;
      // Only the component along the ground normal holds the car up.
      w.load = Math.max(0, w.springForce) * Math.max(0, _up.y);
      b.applyForceAtPoint(_f.copy(UP).multiplyScalar(w.load), w.contactPoint);
    }
  }

  // ---------- Drivetrain & wheel spin ----------

  updateWheelsAndDrivetrain(dt, input) {
    const b = this.body;
    const cfg = this.cfg;
    const eng = cfg.engine;
    const gb = cfg.gearbox;
    const dtc = cfg.drivetrain;
    const h = dt / WHEEL_SUBSTEPS;

    // Per-wheel contact kinematics (body velocity is frozen across sub-steps).
    for (const w of this.wheels) {
      w.fxSum = 0;
      w.fySum = 0;
      if (!w.inContact) continue;
      const c = Math.cos(w.steer);
      const s = Math.sin(w.steer);
      _wf.copy(_fwd).multiplyScalar(c).addScaledVector(_left, s);
      _wf.y = 0;
      _wf.normalize();
      _wl.crossVectors(UP, _wf);
      w.forward.copy(_wf);
      w.lateral.copy(_wl);
      b.pointVelocity(w.contactPoint, _v);
      w.vLong = _v.dot(_wf);
      w.vLat = _v.dot(_wl);
      w.groundSpeed = Math.hypot(w.vLong, w.vLat);
      // Surface (asphalt, kerb, grass, gravel) and weather scale what the tyre can hold.
      const surf = this.ground.surfaceAt ? this.ground.surfaceAt(w.contactPoint.x, w.contactPoint.z) : null;
      // Off-road tyres (cfg.tires.offroad 0..1) lose less of their grip and drag less on grass and gravel.
      const off = this.cfg.tires.offroad ?? 0;
      w.surfaceGrip = surf ? 1 - (1 - surf.grip) * (1 - off) : 1;
      w.surfaceDrag = surf ? surf.drag * (1 - off) : 0;
      w.surface = surf ? surf.kind : 'asphalt';
      w.grip = w.load * loadFactor(w.load, this.nominalLoad, cfg.tires.loadSensitivity) * w.surfaceGrip * this.weatherGrip(w);
    }

    // Pedals -> brake torque (with ABS) per wheel.
    this.absActive = false;
    for (const w of this.wheels) {
      const bias = w.isFront ? cfg.brakes.frontBias : 1 - cfg.brakes.frontBias;
      let tb = this.brake * cfg.brakes.maxTorque * 2 * bias;
      // EBD: each rear brake follows that wheel's actual load, so braking can't
      // overwhelm a rear that has gone light under deceleration or in a corner.
      if (this.assists && !w.isFront) tb *= clamp(w.load / this.staticRearLoad, 0.2, 1);
      if (this.assists && tb > 0 && w.inContact && w.groundSpeed > 3) {
        // Never ask a tyre for more torque than it can transmit, minus the share
        // it is using to corner: the wheel can't lock, and braking can't steal
        // the grip the steering needs (the friction-circle budget, applied up front).
        const sy = Math.min(0.95, Math.abs(w.slipAngle) / w.tire.peakSlipAngle);
        const cap = w.grip * w.tire.muLong * w.radius * Math.sqrt(1 - sy * sy) * this.A.absCapMargin;
        tb = Math.min(tb, Math.max(0, cap));
        // Cornering brake control: a turning car sheds rear brake so the light rear keeps its side grip.
        if (!w.isFront) tb *= 1 - 0.5 * Math.min(1, Math.abs(this.steerIntent) / 0.12);
        // Fine trim on top of the cap: a fast ABS loop on the measured slip.
        const target = (w.isFront ? this.A.absSlip : this.A.absSlipRear) * (1 - 0.4 * sy);
        if (w.slipRatio < -target) w.absFactor = Math.max(0.3, w.absFactor - 40 * dt);
        else w.absFactor = Math.min(1, w.absFactor + 8 * dt);
        if (w.absFactor < 0.97) this.absActive = true;
        tb *= w.absFactor;
      } else {
        w.absFactor = 1;
      }
      // With assists the handbrake is a drift starter, not a spin button.
      if (!w.isFront) tb += input.handbrake * cfg.brakes.handbrakeTorque * (this.assists ? this.A.handbrakeScale : 1);
      w.brakeTorque = tb;
    }

    // Stability control (assists on): if the car yaws faster than the steering
    // asks for, brake the outside front wheel and trim power - like real ESC.
    // The intervention is low-passed so it eases in and out instead of chattering.
    let escTarget = 0;
    const vf = b.velocity.dot(_fwd);
    const yaw = b.angularVelocity.dot(_up);
    const caught = Math.abs(this.slipAngle) > this.A.handbrakeSlideCap; // ESC still catches a handbrake slide that goes too far
    if (this.assists && vf > 8 && this.wheelsInContact >= 3 && (input.handbrake < 0.1 || caught)) {
      const maxYaw = (this.escGripAt(vf) * G) / vf;
      const ref = clamp((vf * Math.tan(this.steerIntent)) / cfg.wheelbase, -maxYaw, maxYaw);
      const over = Math.abs(yaw) - Math.abs(ref) - this.A.escDeadband;
      if (over > 0 && (Math.sign(yaw) === Math.sign(ref) || Math.abs(ref) < 0.02)) escTarget = over * Math.sign(yaw);
      // Sideslip: a sliding car can rotate at a 'normal' rate while its tail walks out.
      const beta = this.slipAngle;
      if (Math.sign(beta) === -Math.sign(yaw) && Math.abs(beta) > this.A.escSlipAngle) {
        const slide = (Math.abs(beta) - this.A.escSlipAngle) * this.A.escSlipGain * Math.sign(yaw);
        if (Math.abs(slide) > Math.abs(escTarget)) escTarget = slide;
      }
    }
    this.escLevel += (escTarget - this.escLevel) * Math.min(1, dt * 15);
    this.escActive = Math.abs(this.escLevel) > 0.01;
    let escCut = 0;
    if (this.escActive) {
      const outsideFront = this.escLevel > 0 ? this.wheels[1] : this.wheels[0];
      outsideFront.brakeTorque += Math.min(this.A.escMaxTorque, Math.abs(this.escLevel) * this.A.escGain);
      // Oversteering under braking: ease the rear brakes so the rear tires get their side grip back.
      const release = 1 - Math.min(0.85, Math.abs(this.escLevel) * 5);
      this.wheels[2].brakeTorque *= release;
      this.wheels[3].brakeTorque *= release;
      escCut = Math.min(0.85, Math.abs(this.escLevel) * 3);
    }

    // Traction control trims throttle when driven wheels exceed the target slip.
    const driven = this.fwd ? this.wheels.slice(0, 2) : this.awd ? this.wheels : this.wheels.slice(2);
    // Also watches combined slip so power can't break the rear loose mid-corner.
    const dir = this.gear === GEAR_R ? -1 : 1;
    let excess = -1;
    for (const w of driven) {
      // A nearly unloaded tire (front lifting under launch) can't be helped by cutting power.
      if (!w.inContact || w.load < this.nominalLoad * 0.3) continue;
      excess = Math.max(excess, w.slipRatio * dir - this.A.tractionSlip);
      // Only the rear can be powered into a spin; a working front tire is not a reason to cut throttle.
      if (!w.isFront && w.groundSpeed > 4) excess = Math.max(excess, (w.slip - this.A.stabilitySlip) * 0.25);
    }
    if (this.assists && this.throttle > 0.05) {
      this.tcFactor = excess > 0 ? Math.max(0.02, this.tcFactor - excess * 45 * dt) : Math.min(1, this.tcFactor + 2.5 * dt);
      this.tcFactor = Math.min(this.tcFactor, 1 - escCut);
    } else {
      this.tcFactor = 1;
    }
    this.tcActive = this.tcFactor < 0.95 || this.escActive;

    // Engine / clutch state for this step.
    this.limiterTimer = Math.max(0, this.limiterTimer - dt);
    const ratio = gb.ratios[this.gear] * gb.finalDrive;
    const inGear = this.gear !== GEAR_N && !this.isShifting;
    // A badly damaged car loses power (a smoking engine, a broken intercooler).
    const sick = 1 - 0.45 * Math.max(0, this.damage - 0.45) / 0.55;
    const throttle = this.limiterTimer > 0 ? 0 : this.throttle * this.tcFactor * sick;
    const wheelRpm = inGear ? this.drivenOmega() * ratio * RPM_PER_RADS : 0;

    let transmitted = 0; // torque at the crank delivered into the gearbox
    let reflected = 0;   // engine inertia seen by the wheels when locked
    if (!inGear) {
      // Free revving.
      const target = eng.idleRpm + (eng.limiterRpm - eng.idleRpm) * this.throttle;
      this.rpm += (target - this.rpm) * Math.min(1, dt * (this.throttle > 0 ? 7 : 3.5));
      this.clutchLocked = false;
    }
    // The clutch slips while launching until the wheels catch up with the engine.
    const launchTarget = this.throttle > 0.02 ? lerp(eng.idleRpm * 1.3, eng.launchRpm, this.throttle) : eng.idleRpm;
    const lock = this.clutchLocked
      ? wheelRpm >= eng.idleRpm * 0.9
      : wheelRpm >= Math.max(eng.idleRpm * 1.05, Math.min(launchTarget, this.rpm) * 0.97);
    if (!inGear) {
      // handled above
    } else if (lock) {
      // Clutch locked: engine speed is tied to the wheels.
      this.clutchLocked = true;
      this.rpm = wheelRpm;
      const drive = sampleCurve(eng.torqueCurve, this.rpm) * throttle;
      const drag = eng.engineBrake * this.rpm * (1 - this.throttle);
      transmitted = drive - drag;
      reflected = eng.inertia * ratio * ratio;
    } else {
      // Slipping clutch (launch / crawling): engine held near launch rpm.
      this.clutchLocked = false;
      this.rpm += (Math.max(launchTarget, wheelRpm) - this.rpm) * Math.min(1, dt * 9);
      transmitted = this.throttle > 0.02 ? sampleCurve(eng.torqueCurve, this.rpm) * throttle : 0;
    }
    if (this.rpm >= eng.limiterRpm) {
      this.limiterTimer = 0.07;
      this.rpm = Math.min(this.rpm, eng.limiterRpm + 150);
    }
    this.rpm = Math.max(this.rpm, eng.idleRpm * 0.9);
    this.engineTorque = transmitted;

    const carrierTorque = transmitted * ratio * gb.efficiency;
    const frontShare = this.frontShare;
    const fourByFour = this.awd && !this.fwd;
    const [fl, fr, rl, rr] = this.wheels;
    for (const w of this.wheels) {
      const share = w.isFront ? frontShare : 1 - frontShare;
      w.inertia = cfg.wheelInertia + reflected * share * 0.5;
    }

    // Sub-stepped wheel spin: tire force integrated implicitly so stiff tires stay stable.
    for (let i = 0; i < WHEEL_SUBSTEPS; i++) {
      const tf = carrierTorque * frontShare * 0.5;
      const tr = carrierTorque * (1 - frontShare) * 0.5;
      const lockF = frontShare > 0 ? dtc.lsdFront * (fl.omega - fr.omega) : 0;
      const lockR = frontShare < 1 ? dtc.lsdRear * (rl.omega - rr.omega) : 0;
      const center = fourByFour ? dtc.centerCoupling * ((fl.omega + fr.omega) - (rl.omega + rr.omega)) * 0.5 : 0;
      fl.driveTorque = frontShare > 0 ? tf - lockF - center * 0.5 : 0;
      fr.driveTorque = frontShare > 0 ? tf + lockF - center * 0.5 : 0;
      rl.driveTorque = frontShare < 1 ? tr - lockR + center * 0.5 : 0;
      rr.driveTorque = frontShare < 1 ? tr + lockR + center * 0.5 : 0;

      for (const w of this.wheels) this.stepWheel(w, h);
    }

    for (const w of this.wheels) {
      w.fx = w.fxSum / WHEEL_SUBSTEPS;
      w.fy = w.fySum / WHEEL_SUBSTEPS;
    }
  }

  stepWheel(w, h) {
    const R = w.radius;
    let denom = w.inertia / h;
    let net = w.driveTorque - Math.sign(w.omega) * 1.5; // bearing drag

    if (w.inContact) {
      const refSpeed = Math.max(Math.abs(w.vLong), 2.0);
      w.slipRatio = (w.omega * R - w.vLong) / refSpeed;
      w.slipAngle = Math.atan2(w.vLat, Math.max(Math.abs(w.vLong), 1.5));
      tireForce(w.tire, w.grip, w.slipRatio, w.slipAngle, _tire);

      // At low speed, never push harder sideways than needed to stop the slide this step.
      const fyStop = (Math.abs(w.vLat) * (w.load / G)) / (h * WHEEL_SUBSTEPS);
      if (Math.abs(_tire.fy) > fyStop) _tire.fy = Math.sign(_tire.fy) * fyStop;

      w.slip = _tire.slip;
      w.fxSum += _tire.fx;
      w.fySum += _tire.fy;
      net -= _tire.fx * R;
      denom += R * longitudinalStiffness(w.tire, w.grip) * R / refSpeed;
    } else {
      w.slipRatio = 0;
      w.slipAngle = 0;
      w.slip = 0;
    }

    let omega = w.omega + net / denom;
    // Brakes are friction: they slow the wheel towards zero but never reverse it.
    const brakeDelta = w.brakeTorque / denom;
    if (omega > 0) omega = Math.max(0, omega - brakeDelta);
    else omega = Math.min(0, omega + brakeDelta);
    w.omega = omega;
  }

  applyTireForces(dt) {
    const b = this.body;
    const rollCentre = this.cfg.rollCentre ?? 0.45;
    const crr = this.cfg.tires.rollingResistance;
    for (const w of this.wheels) {
      if (!w.inContact) continue;
      let fx = w.fx;
      const roll = Math.min((crr + (w.surfaceDrag || 0)) * w.load, (Math.abs(w.vLong) * w.load) / G / dt);
      fx -= Math.sign(w.vLong) * roll;
      _f.copy(w.forward).multiplyScalar(fx).addScaledVector(w.lateral, w.fy);
      // Suspension geometry (roll centre, anti-dive/squat) reacts part of the tyre force
      // straight into the chassis: apply it partway up from the contact patch towards the
      // centre of mass, so cornering, braking and kerbs roll and pitch the body less.
      _p.copy(w.contactPoint);
      const h = _q2.subVectors(b.position, w.contactPoint).dot(_up);
      _p.addScaledVector(_up, h * rollCentre);
      b.applyForceAtPoint(_f, _p);
    }
  }

  // ---------- Handling assist (assists on) ----------

  /**
   * Arcade-style help layered on the tyre physics: a yaw torque that rotates
   * the car towards the turn the driver is asking for (capped by what the grip
   * could sustain), and damping of sideways sliding so the car stays on its
   * line. Keyboard steering is all-or-nothing; this makes it feel intended.
   */
  applyHandlingAssist(input) {
    const b = this.body;
    if (this.wheelsInContact < 3 || input.handbrake > 0.1) return;
    const v = b.velocity.dot(_fwd);
    if (v < 2) return;
    const cfg = this.cfg;
    const yaw = b.angularVelocity.dot(_up);
    // Braking uses up grip, so ask for less rotation while the brakes are on: the car turns in
    // progressively instead of pivoting and sliding, and stays catchable on the correction.
    const brake = input.brake ?? 0;
    const maxYaw = (this.escGripAt(v) * G * this.A.assistGrip * (1 - this.A.brakeYawCut * brake)) / v;
    let target = clamp((v * Math.tan(this.steerIntent)) / cfg.wheelbase, -maxYaw, maxYaw);
    // Counter-steering out of a slide (steer and slip share a sign): on a keyboard that is
    // always full lock, so read it as "straighten up", not "rotate the other way".
    const beta = this.slipAngle;
    if (Math.sign(this.steerIntent) === Math.sign(beta)) {
      target *= clamp(1 - (Math.abs(beta) - this.A.counterBeta) / this.A.counterRange, this.A.counterFloor, 1);
    }
    const limit = this.A.yawTorque * cfg.mass * G * cfg.wheelbase;
    const torque = clamp((target - yaw) * this.A.yawGain * cfg.inertia.y, -limit, limit);
    b.applyTorque(_f.copy(_up).multiplyScalar(torque));
    // Sideways slide damping at the centre of mass.
    const vLat = b.velocity.dot(_left);
    const damp = this.A.slideDamp * (1 + brake), dmax = this.A.slideMax * (1 + 0.5 * brake);
    const fLat = clamp(-vLat * damp * cfg.mass, -dmax * cfg.mass * G, dmax * cfg.mass * G);
    b.applyForce(_f.copy(_left).multiplyScalar(fLat));
    // Brake boost: extra deceleration at the centre of mass (no yaw), scaled by the
    // grip of what the tyres are on, so braking bites hard on tarmac but still punishes gravel and rain.
    if (input.brake > 0.02 && this.gear !== GEAR_R) {
      let grip = 0;
      for (const w of this.wheels) if (w.inContact) grip += w.surfaceGrip * this.weatherGrip(w);
      const fade = Math.min(1, (v - 2) / 4);
      const decel = input.brake * this.A.brakeBoost * G * (grip / 4) * fade;
      // Along the car's nose rather than the velocity: when the car is slipping, this also pulls
      // the direction of travel back towards where it points, so hard braking settles the car.
      _f.copy(_fwd);
      _f.y = 0;
      const len = _f.length();
      if (len > 0.1) b.applyForce(_f.multiplyScalar(-decel * cfg.mass / len));
    }
  }

  // ---------- Aero & hull ----------

  applyAero(dt = 1 / 240) {
    const b = this.body;
    const a = this.cfg.aero;
    const v = b.velocity;
    const speed = v.length();
    // Active aero (2026 rules): on a straight at full throttle the wing flaps flatten (X-mode: less
    // drag, less downforce); they snap back (Z-mode) the moment the driver brakes or turns in.
    if (a.active) {
      const straight = this.throttle > 0.92 && this.brake < 0.05 && Math.abs(this.steerAngle) < 0.045 && speed > (a.active.minSpeed ?? 28);
      const target = straight ? 1 : 0;
      this.aeroMode += (target - this.aeroMode) * Math.min(1, dt * (target > this.aeroMode ? 2.5 : 14));
    }
    if (speed < 0.1) return;
    const x = a.active ? this.aeroMode : 0;
    const dragArea = a.dragArea * (1 - x * (1 - (a.active?.drag ?? 1))), liftArea = a.liftArea * (1 - x * (1 - (a.active?.lift ?? 1)));
    b.applyForce(_f.copy(v).multiplyScalar(-0.5 * a.airDensity * dragArea * speed));

    const vf = Math.max(0, v.dot(_fwd));
    const down = 0.5 * a.airDensity * liftArea * vf * vf;
    const wf = this.wheels[0].anchor.z;
    const wr = this.wheels[2].anchor.z;
    _f.copy(_up).multiplyScalar(-down * a.frontBalance);
    b.applyForceAtPoint(_f, b.localToWorld(_p.set(0, 0, wf), _p));
    _f.copy(_up).multiplyScalar(-down * (1 - a.frontBalance));
    b.applyForceAtPoint(_f, b.localToWorld(_p.set(0, 0, wr), _p));
  }

  applyHullContacts(dt) {
    const b = this.body;
    const hc = this.cfg.hull;
    const share = b.mass / 4;
    this.hullContact = false;
    this.hullHit = 0; // fastest bodywork-into-ground speed this step (rollovers, hard landings)
    for (const lp of this.hullPoints) {
      const p = b.localToWorld(lp, _p);
      const hgt = this.ground.heightAt(p.x, p.z);
      if (hgt === null) continue;
      const depth = hgt - p.y;
      if (depth <= 0 || depth > 1.2) continue;
      this.hullContact = true;
      b.pointVelocity(p, _v);
      if (-_v.y > this.hullHit) { this.hullHit = -_v.y; this.hitPoint.copy(p); this.hitNormal.set(0, 1, 0); }
      const fn = Math.max(0, hc.stiffness * depth - hc.damping * _v.y);
      _f.set(0, fn, 0);
      const vt = Math.hypot(_v.x, _v.z);
      if (vt > 1e-4) {
        const ft = Math.min(hc.friction * fn, (vt * share) / dt);
        _f.x -= (_v.x / vt) * ft;
        _f.z -= (_v.z / vt) * ft;
      }
      b.applyForceAtPoint(_f, p);
    }
    this.applyWallContacts(dt);
  }

  /** Barriers (street circuits): stiff, slightly slippery penalty contacts on the hull points. */
  applyWallContacts(dt) {
    this.wallHit = 0;
    this.wallSlide = 0;
    if (!this.ground.wallContact) return;
    const b = this.body;
    const share = b.mass / 4;
    for (const lp of this.hullPoints) {
      const p = b.localToWorld(lp, _p);
      const c = this.ground.wallContact(p.x, p.z);
      if (!c) continue;
      b.pointVelocity(p, _v);
      const vn = _v.x * c.nx + _v.z * c.nz; // < 0 when moving into the wall
      const fn = Math.max(0, WALL.stiffness * c.depth - WALL.damping * vn);
      _f.set(c.nx * fn, 0, c.nz * fn);
      const tx = _v.x - c.nx * vn;
      const tz = _v.z - c.nz * vn;
      const vt = Math.hypot(tx, tz);
      if (vt > 1e-4) {
        const ft = Math.min(WALL.friction * fn, (vt * share) / dt);
        _f.x -= (tx / vt) * ft;
        _f.z -= (tz / vt) * ft;
      }
      // Barriers push at bumper height: apply at CG level so a hit yaws the car
      // (realistic) without levering it onto its roof or tipping it onto two wheels.
      p.y = b.position.y;
      b.applyForceAtPoint(_f, p);
      if (-vn > this.wallHit) {
        this.wallHit = -vn;
        this.wallSlide = vt; // speed along the barrier (scraping)
        this.hitPoint.set(p.x, p.y, p.z);
        this.hitNormal.set(c.nx, 0, c.nz);
      }
    }
  }
}
return { Vehicle };
})();
