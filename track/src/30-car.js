// =====================================================================
//  The F1 car: the F4 racer's F1 (body + physics) at full size.
//  Design space is real-size already (3.5 m wheelbase), so the proportions
//  are the identity map. Physics retuned for a full-size ~800 kg car.
// =====================================================================
const LIVERIES = [
  { name: 'Rosso Corsa', body: 0xd4141c, second: 0xffd23f },
  { name: 'Silver Arrow', body: 0xc8ccd2, second: 0x14c3b0 },
  { name: 'Papaya', body: 0xff7a12, second: 0x1f6fd9 },
  { name: 'Midnight Racing Blue', body: 0x1b2a6a, second: 0xe0003a },
  { name: 'British Racing Green', body: 0x0f4a2c, second: 0xd8ff3a },
  { name: 'Black & Gold', body: 0x111114, second: 0xc9a64a },
  { name: 'Liquid White', body: 0xf2f2ee, second: 0x3b7bff },
];

const F1_PROPORTIONS = { scale: 1, squashZ: (z) => z, squashSlope: () => 1, designToModel: ([x, y, z]) => [x, y, z] };
const WHEELBASE = 3.5;

const F1_SPEC = {
  proportions: F1_PROPORTIONS,
  // The F1 assist tune from the F4 racer (ESC torques scaled for the heavier car).
  assistTune: {
    sport: { tractionSlip: 0.11, stabilitySlip: 1.08, slideDamp: 1.7, slideMax: 0.34, yawTorque: 0.18, escSlipAngle: 0.11, escDeadband: 0.08, escGain: 9000, escMaxTorque: 3500 },
    full: { tractionSlip: 0.1, escGain: 9000, escMaxTorque: 3800 },
  },
  escGrip: 1.75,
  escGripAero: 0.00065,
  escGripMax: 3.2,

  mass: 800,
  inertia: { x: 1050, y: 1250, z: 330 },
  wheelbase: WHEELBASE,
  cgHeight: 0.29,
  cgToFront: WHEELBASE * 0.55,     // 45 % front / 55 % rear

  wheels: [
    { id: 'FL', x: 0.95, axle: 'front' },
    { id: 'FR', x: -0.95, axle: 'front' },
    { id: 'RL', x: 0.93, axle: 'rear' },
    { id: 'RR', x: -0.93, axle: 'rear' },
  ],
  wheelRadius: 0.36,
  wheelInertia: 1.2,
  tireWidth: { front: 0.3, rear: 0.4 },

  suspension: {
    anchorHeight: 0.18,
    restLength: 0.3,
    maxTravel: 0.08,
    front: { spring: 72000, damperBump: 5200, damperRebound: 6800, antiRoll: 21000 },
    rear:  { spring: 78000, damperBump: 5500, damperRebound: 7400, antiRoll: 10500 },
    bumpStopRate: 450000,
  },

  tires: {
    // A touch more forgiving past the peak than the mini car: easier to catch on a keyboard.
    front: { muLat: 1.98, muLong: 1.95, peakSlipAngle: 0.1, peakSlipRatio: 0.1, slide: 0.86, falloff: 1.3 },
    rear:  { muLat: 2.24, muLong: 2.1, peakSlipAngle: 0.11, peakSlipRatio: 0.1, slide: 0.88, falloff: 1.25 },
    loadSensitivity: 0.11,
    rollingResistance: 0.014,
  },

  steering: { maxAngle: 0.38, limitGrip: 1.55, limitSlip: 0.055, rate: 3.6, returnRate: 5, ackermann: 0.35 },
  brakes: { maxTorque: 4200, frontBias: 0.6, handbrakeTorque: 1800 },

  engine: {
    idleRpm: 3800, redlineRpm: 12000, limiterRpm: 12300, launchRpm: 7500, inertia: 0.12,
    // ~950 hp hybrid V6.
    torqueCurve: [[3800, 420], [6000, 520], [8000, 560], [9500, 585], [10500, 590], [11300, 575], [12000, 545], [12300, 520]],
    engineBrake: 0.02,
  },
  gearbox: {
    ratios: [-3.0, 0, 3.25, 2.5, 2.02, 1.7, 1.46, 1.28, 1.13, 1.0],
    finalDrive: 4.1, efficiency: 0.94, shiftTime: 0.04, upshiftRpm: 11800, downshiftRpm: 8200,
  },
  drivetrain: { awdFrontShare: 0, lsdFront: 0, lsdRear: 22, centerCoupling: 0 },
  aero: { dragArea: 1.2, liftArea: 4.0, frontBalance: 0.43, airDensity: 1.225 },

  hullPoints: [
    [1.08, 0.17, 2.8], [-1.08, 0.17, 2.8], [0.85, 0.14, -2.1], [-0.85, 0.14, -2.1],
    [0.78, 0.5, 0.4], [-0.78, 0.5, 0.4], [0.56, 1.05, -2.4], [-0.56, 1.05, -2.4],
    [0, 0.94, -0.4], [0.28, 0.88, 0.2], [-0.28, 0.88, 0.2], [0, 0.66, 1.0],
  ],
  hull: { stiffness: 190000, damping: 10000, friction: 0.5 },
};

// Visual: same structure as the racer's CarVisual. root follows the physics body (CG frame);
// the body shell sits in `model`, offset by the vehicle's modelOffset; wheels live in root.
function buildCar(liveryIdx, vehicle) {
  const L = LIVERIES[liveryIdx] || LIVERIES[0];
  const mats = F4.materials.createCarMaterials(L.body, { caliper: 0x1b1b1f });
  mats.stripe.color.setHex(L.second);
  // This scene's sky lighting is brighter than the racer's: tone the reflections down so the paint keeps its colour.
  for (const k of ['paint', 'stripe', 'carbon']) { mats[k].envMapIntensity = 0.5; mats[k].clearcoatRoughness = 0.3; }
  const root = new THREE.Group();
  const model = new THREE.Group();
  model.position.copy(vehicle.modelOffset);
  root.add(model);
  const mb = new F4.meshBuilder.MeshBuilder();
  F4.f1body.buildShell(mb);
  F4.f1body.buildDetails(mb);
  model.add(mb.build(mats, F1_PROPORTIONS.squashZ, F1_PROPORTIONS.squashSlope));
  const anim = F4.f1body.buildAnimatedParts(mats);
  model.add(anim.group);
  anim.head.position.set(0, 0.92, -0.02);           // full-size helmet, no bobblehead
  for (const f of anim.flames) f.visible = false;
  const wheels = F1_SPEC.wheels.map((w) => {
    const front = w.axle === 'front';
    const wheel = F4.wheel.buildWheel(mats, { radius: F1_SPEC.wheelRadius, width: front ? F1_SPEC.tireWidth.front : F1_SPEC.tireWidth.rear, left: w.x > 0, style: 'ySpoke' });
    root.add(wheel.root);
    return wheel;
  });
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, body: root, model, wheels, mats, steering: anim.steering };
}
