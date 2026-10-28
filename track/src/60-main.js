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
// Adaptive resolution: drop render scale when frames run long, raise it again when there is headroom.
const MAX_PR = Math.min(devicePixelRatio, 1.5);
let pixelRatio = Math.min(MAX_PR, 1.25), frameAvg = 16, prCooldown = 0;
function adaptResolution(ms) {
  frameAvg += (ms - frameAvg) * 0.05;
  if ((prCooldown -= ms) > 0) return;
  let next = pixelRatio;
  if (frameAvg > 21 && pixelRatio > 0.6) next = Math.max(0.6, pixelRatio - 0.15);
  else if (frameAvg < 13 && pixelRatio < MAX_PR) next = Math.min(MAX_PR, pixelRatio + 0.1);
  if (next !== pixelRatio) { pixelRatio = next; renderer.setPixelRatio(pixelRatio); resize(); prCooldown = 1500; }
}
function frame(now) {
  requestAnimationFrame(frame);
  const ms = now - last;
  const dt = Math.min(0.05, ms / 1000);
  last = now;
  if (ms < 200) adaptResolution(ms);
  if (mode === 'drive') {
    readInput(dt, Math.abs(car.vF));
    startStep(dt);
    acc += dt;
    while (acc >= PHYS_DT) {
      physicsStep(PHYS_DT);
      acc -= PHYS_DT;
    }
    lapStep(dt);
    poseCar();
    updateCamera(dt);
    updateHUD(dt);
    _focus.set(car.x, car.y, car.z);
  } else {
    flyCamera(dt);
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
// Arrow keys pan the editor camera over the ground (Shift = faster); speed scales with zoom.
const _fwdv = new THREE.Vector3(), _rgt = new THREE.Vector3();
function flyCamera(dt) {
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT')) return;
  const f = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
  const r = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
  if (!f && !r) return;
  camera.getWorldDirection(_fwdv);
  _fwdv.y = 0;
  if (_fwdv.lengthSq() < 1e-12) _fwdv.set(0, 0, -1);   // straight down: screen-up is north (-z)
  _fwdv.normalize();
  _rgt.crossVectors(_fwdv, THREE.Object3D.DEFAULT_UP).normalize();
  const dist = camera.position.distanceTo(controls.target);
  const speed = Math.max(20, dist * 0.9) * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.5 : 1) * dt;
  const mx = (_fwdv.x * f + _rgt.x * r) * speed, mz = (_fwdv.z * f + _rgt.z * r) * speed;
  camera.position.x += mx; camera.position.z += mz;
  controls.target.x += mx; controls.target.z += mz;
}

// The visual follows the physics body exactly (CG frame); wheels sit on their suspension.
function poseCar() {
  const m = carModel, b = vehicle.body;
  m.root.position.copy(b.position);
  m.root.quaternion.copy(b.quaternion);
  for (let i = 0; i < 4; i++) {
    const w = vehicle.wheels[i], vis = m.wheels[i];
    vis.root.position.set(w.anchor.x, w.anchor.y - w.suspensionLength, w.anchor.z);
    vis.root.rotation.y = w.steer;
    vis.spin.rotation.x = w.spinAngle;
  }
  if (m.steering) m.steering.rotation.z = -vehicle.steerAngle * 6;
  m.mats.tail.emissiveIntensity = vehicle.brake > 0.05 ? 9 : 3;
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
  car, vehicle, lap, input, start, state, project, physicsStep, camera, controls, ensureCarModel, get carModel() { return carModel; }, get S() { return S; }, get racingLine() { return racingLine; },
  step(sec, keyboard = false) {
    for (let t = 0; t < sec; t += PHYS_DT) {
      if (keyboard) readInput(PHYS_DT, Math.abs(car.vF));
      startStep(PHYS_DT);
      physicsStep(PHYS_DT);
      lapStep(PHYS_DT);
    }
  },
};
window.__tbProps = () => PROP_DEFS.map((d) => ({ id: d.id, cat: d.cat, sp: !!d.sp }));
window.__tbRebuild = () => rebuildProps();
window.__tbProto = (id) => propProto(id, 's1');
window.__tbFull = () => { buildSamples(); fullRebuild(); };
try { boot(); }
catch (err) {
  console.error(err);
  $('err').classList.remove('hidden');
  $('err').textContent = 'Something went wrong starting the track builder: ' + err.message;
}
