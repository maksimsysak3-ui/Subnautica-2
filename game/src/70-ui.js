// =====================================================================
//  Input
// =====================================================================
addEventListener('keydown', (e) => {
  if (mode !== 'range' || paused) return;
  keys[e.code] = true;
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyR': startReload(); break;
    case 'KeyB': { const I = inv(); if (WD().modes.length > 1) { I.mode = (I.mode + 1) % WD().modes.length; P.burst = 0; audio.switchMode(); } break; }
    case 'KeyQ': aimKey.down = true; aimKey.t = performance.now(); break;
    case 'KeyZ': P.lean = -1; break;
    case 'KeyX': P.lean = 1; break;
    case 'Digit1': switchTo('rifle'); break;
    case 'Digit2': switchTo('shotgun'); break;
    case 'Digit3': switchTo('pistol'); break;
    case 'KeyV': P.fp = !P.fp; break;
    case 'KeyC': case 'ControlLeft': P.crouch = !P.crouch; break;
    case 'KeyT': resetRange(); break;
    case 'Escape': if (lockFallback) setPaused(true); break;
  }
  if (['Space', 'Tab', 'ControlLeft'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyQ' && aimKey.down) {
    aimKey.down = false;
    // a quick tap toggles aim, a long press is hold-to-aim
    if (performance.now() - aimKey.t < 220) aimKey.toggled = !aimKey.toggled; else aimKey.toggled = false;
  }
  if ((e.code === 'KeyZ' && P.lean < 0) || (e.code === 'KeyX' && P.lean > 0)) P.lean = 0;
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; P.trigger = false; aimKey.down = aimKey.toggled = false; P.lean = 0; });

let drag = null;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  audio.init();
  if (mode === 'range') {
    if (!locked && !lockFallback) { requestLock(); return; }
    if (e.button === 0) { P.trigger = true; P.edge = true; }
  } else drag = { x: e.clientX, y: e.clientY };
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) P.trigger = false;
  drag = null;
});
addEventListener('mousemove', (e) => {
  if (mode === 'range' && !paused && (locked || lockFallback)) {
    const k = 0.0021 * P.sens * (camera.fov / 68);
    P.yaw -= e.movementX * k; P.pitch = clamp(P.pitch - e.movementY * k, -1.35, 1.35);
    // weapon inertia: the gun lags behind fast camera turns
    P.sway.vx += clamp(e.movementX, -80, 80) * 0.018; P.sway.vy += clamp(e.movementY, -80, 80) * 0.014;
  } else if (mode === 'custom' && drag) {
    orbit.tyaw -= (e.clientX - drag.x) * 0.008;
    orbit.tpitch = clamp(orbit.tpitch + (e.clientY - drag.y) * 0.005, -0.3, 0.9);
    drag.x = e.clientX; drag.y = e.clientY;
  }
});
canvas.addEventListener('wheel', (e) => {
  if (mode === 'range') { const i = ORDER.indexOf(P.swap ? P.swap.to : P.w); switchTo(ORDER[(i + (e.deltaY > 0 ? 1 : ORDER.length - 1)) % ORDER.length]); return; }
  if (mode !== 'custom') return;
  e.preventDefault();
  orbit.tdist = clamp(orbit.tdist * (1 + Math.sign(e.deltaY) * 0.1), 1.1, 7);
}, { passive: false });
// touch orbit for the customizer
canvas.addEventListener('touchstart', (e) => { if (mode === 'custom' && e.touches[0]) drag = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (mode !== 'custom' || !drag || !e.touches[0]) return;
  const t = e.touches[0];
  orbit.tyaw -= (t.clientX - drag.x) * 0.008; orbit.tpitch = clamp(orbit.tpitch + (t.clientY - drag.y) * 0.005, -0.3, 0.9);
  drag.x = t.clientX; drag.y = t.clientY;
}, { passive: true });
canvas.addEventListener('touchend', () => { drag = null; });

function requestLock() {
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => { lockFallback = true; setPaused(false); });
  } catch (e) { lockFallback = true; setPaused(false); }
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (mode === 'range') setPaused(!locked);
});
document.addEventListener('pointerlockerror', () => { lockFallback = true; if (mode === 'range') setPaused(false); });

function setPaused(v) {
  paused = v;
  $('pause').classList.toggle('hidden', !v);
  if (v) { P.trigger = false; aimKey.down = aimKey.toggled = false; P.lean = 0; P.burst = 0; for (const k in keys) keys[k] = false; }
}

// =====================================================================
//  Mode switching + customization UI
// =====================================================================
function enterRange() {
  mode = 'range';
  keyLight.visible = rimLight.visible = fillLight.visible = false; // the world is lit by the moon + lamps
  camera.clearViewOffset();
  ['panel', 'topbar', 'poses'].forEach((id) => $(id).classList.add('hidden'));
  $('hud').classList.remove('hidden');
  P.yaw = 0; P.pitch = 0; P.camY = ch.d.hipY + 0.7;
  if (P.pos.z < 0.5) P.pos.set(0, 0, 3);
  audio.init();
  requestLock();
  if (lockFallback) setPaused(false);
}
function enterCustom() {
  mode = 'custom'; setPaused(false);
  keyLight.visible = rimLight.visible = fillLight.visible = true;
  if (document.pointerLockElement) document.exitPointerLock();
  ['panel', 'topbar', 'poses'].forEach((id) => $(id).classList.remove('hidden'));
  $('hud').classList.add('hidden');
  P.reload = null; P.swap = null; P.pump = null; if (gun) { if (gun.mag) gun.mag.visible = true; gun.handItem.visible = false; }
  aimKey.down = aimKey.toggled = false; P.lean = 0;
  P.fp = false; P.crouch = false;
}
$('bEnter').onclick = enterRange;
$('bResume').onclick = () => { if (lockFallback) setPaused(false); else requestLock(); };
$('bCustom').onclick = enterCustom;
$('bReset').onclick = () => { resetRange(); };
$('sens').oninput = (e) => { P.sens = +e.target.value; };
$('infAmmo').onchange = (e) => { P.infinite = e.target.checked; if (!P.infinite) for (const id of ORDER) P.inv[id].reserve = WEAPONS[id].reserve; };
$('vol').oninput = (e) => audio.setVolume(+e.target.value);

const GUN_KEYS = new Set(['optic', 'muzzle', 'grip', 'sgOptic', 'pistolLight']);
let tab = 'Presets';
function setCfg(k, v, kind) {
  cfg[k] = v;
  if (kind === 'color') applyColors(cfg);
  else if (GUN_KEYS.has(k)) { rebuildGuns(); applyColors(cfg); }
  else rebuild();
  saveCfg();
}
function renderTabs() {
  const names = ['Presets', ...SCHEMA.map((s) => s.tab)];
  $('tabs').innerHTML = names.map((n) => `<button class="tab${n === tab ? ' on' : ''}" data-t="${n}">${n}</button>`).join('');
  $('tabs').querySelectorAll('.tab').forEach((b) => b.onclick = () => { tab = b.dataset.t; renderTabs(); renderControls(); });
}
function renderControls() {
  const box = $('controls');
  if (tab === 'Presets') {
    box.innerHTML = `<div class="ctl"><label>Loadout presets</label><div class="chips">${Object.keys(PRESETS).map((n) => `<button class="chip" data-p="${n}">${n}</button>`).join('')}</div></div>
      <div class="ctl"><label>Tip</label><div style="color:var(--dim);font-size:14px;line-height:1.5">“Reference” reproduces the operator from your concept sheet. Every part is editable in the other tabs; your loadout is saved in this browser.</div></div>`;
    box.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { cfg = { ...PRESETS[b.dataset.p] }; rebuild(); saveCfg(); });
    return;
  }
  const sec = SCHEMA.find((s) => s.tab === tab);
  box.innerHTML = sec.items.map((it) => {
    if (it.t === 'range') return `<div class="ctl"><label>${it.l}<b data-v="${it.k}">${Math.round(cfg[it.k] * 100)}</b></label><input type="range" data-k="${it.k}" min="${it.min}" max="${it.max}" step="0.01" value="${cfg[it.k]}"></div>`;
    if (it.t === 'opt') return `<div class="ctl"><label>${it.l}</label><div class="chips">${OPTS[it.k].map(([v, n]) => `<button class="chip${cfg[it.k] === v ? ' on' : ''}" data-k="${it.k}" data-v="${v}">${n}</button>`).join('')}</div></div>`;
    return `<div class="ctl"><label>${it.l}</label><div class="sw">${SW[it.sw].map((c) => `<button style="background:${c}" class="${cfg[it.k].toLowerCase() === c ? 'on' : ''}" data-k="${it.k}" data-c="${c}" title="${c}"></button>`).join('')}<input type="color" data-k="${it.k}" value="${cfg[it.k]}"></div></div>`;
  }).join('');
  box.querySelectorAll('input[type=range]').forEach((el) => el.oninput = () => {
    setCfg(el.dataset.k, +el.value, 'range');
    box.querySelector(`[data-v="${el.dataset.k}"]`).textContent = Math.round(el.value * 100);
  });
  box.querySelectorAll('.chip').forEach((el) => el.onclick = () => {
    const opt = OPTS[el.dataset.k].find(([v]) => String(v) === el.dataset.v);
    setCfg(el.dataset.k, opt[0], 'opt'); renderControls();
  });
  box.querySelectorAll('.sw button').forEach((el) => el.onclick = () => { setCfg(el.dataset.k, el.dataset.c, 'color'); renderControls(); });
  box.querySelectorAll('input[type=color]').forEach((el) => {
    el.oninput = () => setCfg(el.dataset.k, el.value, 'color');
    el.onchange = () => renderControls();
  });
}
function renderPoses() {
  const items = [['ready', 'Low Ready'], ['aim', 'Aim'], ['relaxed', 'Relaxed']];
  const wl = { rifle: 'Rifle', shotgun: 'Shotgun', pistol: 'Pistol' };
  $('poses').innerHTML = ORDER.map((id) => `<button class="chip${P.w === id ? ' on' : ''}" data-w="${id}">${wl[id]}</button>`).join('') +
    items.map(([v, n]) => `<button class="chip${pose === v ? ' on' : ''}" data-pose="${v}">${n}</button>`).join('') +
    `<button class="chip${turntable ? ' on' : ''}" data-tt>Turntable</button><button class="chip" data-face>Face</button><button class="chip" data-full>Full Body</button>`;
  $('poses').querySelectorAll('[data-pose]').forEach((b) => b.onclick = () => { pose = b.dataset.pose; renderPoses(); });
  $('poses').querySelectorAll('[data-w]').forEach((b) => b.onclick = () => { equip(b.dataset.w); renderPoses(); });
  $('poses').querySelector('[data-tt]').onclick = () => { turntable = !turntable; renderPoses(); };
  $('poses').querySelector('[data-face]').onclick = () => { orbit.tdist = 1.3; orbit.tpitch = 0.05; };
  $('poses').querySelector('[data-full]').onclick = () => { orbit.tdist = 3.6; orbit.tpitch = 0.1; };
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
$('bRandom').onclick = () => {
  for (const s of SCHEMA) for (const it of s.items) {
    if (it.t === 'opt') cfg[it.k] = pick(OPTS[it.k])[0];
    else if (it.t === 'color') cfg[it.k] = pick(SW[it.sw]);
    else cfg[it.k] = lerp(it.min, it.max, 0.2 + Math.random() * 0.6);
  }
  if (cfg.top === 'none' && Math.random() < 0.7) cfg.top = 'hoodie';
  rebuild(); saveCfg(); renderControls();
};
$('bRef').onclick = () => { cfg = { ...REFERENCE }; rebuild(); saveCfg(); renderControls(); };

// =====================================================================
//  Main loop
// =====================================================================
buildWorld();
rebuild();
renderTabs(); renderControls(); renderPoses();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let last = performance.now(), time = 0, first = true;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused) {
    time += dt;
    if (mode === 'range') updateRange(dt, time); else updateCustom(dt, time);
    updateTargets(dt, time);
    updateBullets(dt);
    updateSparks(dt);
    updatePuffs(dt);
    updateProps(dt);
    if (P.flashT > 0) { P.flashT -= dt; if (P.flashT <= 0) { flash.visible = false; flashLight.intensity = 0; } }
  }
  const py = P.pos.y;
  keyLight.position.set(P.pos.x + 2.4, py + 7, P.pos.z + 4); keyLight.target.position.set(P.pos.x, py + 0.9, P.pos.z);
  rimLight.position.set(P.pos.x - 2.5, py + 4.5, P.pos.z - 5); rimLight.target.position.set(P.pos.x, py + 1.2, P.pos.z);
  fillLight.position.set(P.pos.x - 1.6, py + 1.7, P.pos.z + 2.6);
  LAMPS.update(dt, P.pos, time);
  SKY.update(camera, P.pos);
  renderer.render(scene, camera);
  if (first) { first = false; $('loading').classList.add('hidden'); }
}
requestAnimationFrame(frame);
window.__dbg = { P, get ch() { return ch; }, get gun() { return gun; }, enterRange, enterCustom, setPose: (p) => { pose = p; }, orbit, fire, startReload, setCfg, keys, aimKey, switchTo, equip, inv, setLockFallback: (v) => { lockFallback = v; } };
window.__OPTS = OPTS;
window.__dbg.step = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) { time += dt; updateRange(dt, time); updateBullets(dt); } return [P.pos.x, P.pos.y, P.pos.z].map((v) => +v.toFixed(2)); };
window.__dbg.COL = COL; window.__dbg.MAP = MAP;
