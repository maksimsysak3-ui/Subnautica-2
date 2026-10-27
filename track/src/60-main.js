// =====================================================================
//  Main loop + boot
// =====================================================================
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

const PHYS_DT = 1 / 240;
let acc = 0, last = performance.now();
const _focus = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'drive') {
    readInput(dt, Math.abs(car.vF));
    startStep(dt);
    acc += dt;
    while (acc >= PHYS_DT) {
      physicsStep(PHYS_DT);
      if (heldOnGrid()) { car.vF = car.vL = car.yaw = 0; placeHeld(); }
      groundStep(PHYS_DT);
      acc -= PHYS_DT;
    }
    lapStep(dt);
    poseCar(dt);
    updateCamera(dt);
    updateHUD();
    _focus.set(car.x, car.y, car.z);
  } else {
    controls.update();
    updateHandles();
    _focus.copy(controls.target);
  }
  audio.update(dt);
  // Shadow frustum follows whatever we're looking at.
  const span = mode === 'drive' ? 90 : clamp(camera.position.distanceTo(controls.target) * 0.6, 90, 420);
  const cam = sun.shadow.camera;
  if (cam.right !== span) { cam.left = cam.bottom = -span; cam.right = cam.top = span; cam.updateProjectionMatrix(); }
  sun.target.position.copy(_focus);
  sun.position.copy(_focus).addScaledVector(sunDir, 450);
  renderer.render(scene, camera);
}
let heldPos = null;
function placeHeld() {
  if (!heldPos) heldPos = { x: car.x, z: car.z, h: car.heading };
  car.x = heldPos.x; car.z = heldPos.z; car.heading = heldPos.h;
}
function poseCar(dt) {
  if (!heldOnGrid()) heldPos = null;
  const m = carModel, c = car;
  m.root.position.set(c.x, c.y, c.z);
  m.root.rotation.set(-c.pitch, c.heading, c.roll, 'YXZ');
  // Body squat/dive and roll from accelerations; kerb chatter.
  c.bodyPitch = lerp(c.bodyPitch, clamp(-c.ax * 0.0003, -0.02, 0.02), Math.min(1, dt * 10));
  c.bodyRoll = lerp(c.bodyRoll, clamp(c.ay * 0.00035, -0.025, 0.025), Math.min(1, dt * 10));
  const chatter = c.onKerb ? (Math.random() - 0.5) * 0.012 * clamp(Math.abs(c.vF) / 30, 0, 1) : 0;
  m.body.rotation.set(c.bodyPitch, 0, c.bodyRoll + chatter);
  m.body.position.y = chatter * 2;
  c.wheelSpin += (c.vF / 0.36) * dt;
  for (const w of m.wheels) {
    w.wheel.rotation.x = c.wheelSpin;
    if (w.front) w.pivot.rotation.y = c.steer;
  }
  m.mats.rain.emissiveIntensity = input.brake > 0.3 ? 2 : 0;
}

function boot() {
  resize();
  let loaded = false;
  try {
    const raw = localStorage.getItem('tb.autosave');
    if (raw) { loadInto(deserialise(raw)); loaded = state.points.length > 0; }
  } catch { loaded = false; }
  if (!loaded) { state.settings = defaultSettings(); loadSample(); }
  else fullRebuild();
  applyTimeOfDay(state.settings.tod);
  refreshSettings();
  refreshLoadList();
  commit();
  refreshPanel();
  setTool(state.closed ? 'move' : 'draw');
  frameTrack();
  requestAnimationFrame(frame);
  window.__ready = true;
}
// Test hook: lets automated checks step the simulation faster than real time.
window.__tb = {
  car, lap, input, start, state, project, physicsStep, camera, controls, get S() { return S; }, get racingLine() { return racingLine; },
  step(sec) {
    for (let t = 0; t < sec; t += PHYS_DT) {
      startStep(PHYS_DT);
      physicsStep(PHYS_DT);
      if (heldOnGrid()) { car.vF = car.vL = car.yaw = 0; placeHeld(); }
      groundStep(PHYS_DT);
      lapStep(PHYS_DT);
    }
  },
};
try { boot(); }
catch (err) {
  console.error(err);
  $('err').classList.remove('hidden');
  $('err').textContent = 'Something went wrong starting the track builder: ' + err.message;
}
