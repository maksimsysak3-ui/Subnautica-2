// Gridiron GM 3D: a playable football game. You run the offense with real NFL
// starters; the computer plays defense (man coverage, deep safeties, a pass rush
// fought by blockers, pursuit angles and tackling) and its own offense is resolved
// as drive results. Units are yards: x runs down the field (your goal line at -50,
// theirs at +50), z across it, y up.
import * as THREE from 'three';
import DATA from './data.json';

// ---------- tuning -------------------------------------------------------------------
const HW = 26.65;                 // half field width
const QUARTER = 300;              // seconds of game clock per quarter
const SPEED = { QB: 8.2, RB: 9.4, WR: 9.7, TE: 8.6, OT: 7.0, G: 6.9, C: 6.9, EDGE: 8.6, DT: 7.6, LB: 8.8, CB: 9.6, S: 9.3, K: 7, P: 7 };
const ACCEL = 13;                 // yd/s^2
const BALL_SPEED = 23;            // yd/s on a pass
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.5;

// ---------- DOM ------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const view = $('view');
const teams = DATA.teams;
const fillSelect = (sel, def) => { sel.innerHTML = teams.map(t => `<option value="${t.abbr}">${t.name}</option>`).join(''); sel.value = def; };
fillSelect($('teamA'), 'DET'); fillSelect($('teamB'), 'GB');
const showTeam = (side, sel) => { const t = teams.find(x => x.abbr === sel.value); side.style.setProperty('--c', t.c[0]); side.querySelector('.lg').innerHTML = `<img src="${t.logo}" alt="" onerror="this.style.display='none'"><b>${t.nick}</b>`; };
for (const [s, k] of [['sideA', 'teamA'], ['sideB', 'teamB']]) { showTeam($(s), $(k)); $(k).onchange = () => showTeam($(s), $(k)); }

// ---------- renderer, scene, lights ---------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a1222');
scene.fog = new THREE.Fog('#0a1222', 120, 260);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
scene.add(new THREE.HemisphereLight('#c8d8ff', '#22351f', 1.1));
const sun = new THREE.DirectionalLight('#fff4e2', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

// ---------- stadium ----------------------------------------------------------------------
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; }
let fieldMesh;
function buildField(home, away) {
  if (fieldMesh) { scene.remove(fieldMesh); fieldMesh.material.map.dispose(); }
  const PX = 16;
  const tex = canvasTex(132 * PX, Math.round(65.3 * PX), (g, w, h) => {
    const X = yd => (yd + 66) * PX, Y = yd => (yd + HW + 6) * PX;
    g.fillStyle = '#1d5a2a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#2e7f3b' : '#287134'; g.fillRect(X(-60 + i * 5), Y(-HW), 5 * PX, 53.3 * PX); }
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 16; img.data[i] += n * 0.4; img.data[i + 1] += n; img.data[i + 2] += n * 0.4; }
    g.putImageData(img, 0, 0);
    for (const [x0, t, rot] of [[-60, home, -1], [50, away, 1]]) {
      g.fillStyle = t.c[0]; g.fillRect(X(x0), Y(-HW), 10 * PX, 53.3 * PX);
      g.save(); g.translate(X(x0 + 5), Y(0)); g.rotate(rot * Math.PI / 2);
      g.font = `900 italic ${6.4 * PX}px "Barlow Condensed", Arial Narrow, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,.4)'; g.strokeText(t.nick.toUpperCase(), 0, 0); g.fillStyle = '#fff'; g.fillText(t.nick.toUpperCase(), 0, 0); g.restore();
    }
    g.strokeStyle = '#f4f4ef';
    for (let x = -50; x <= 50; x += 5) { g.lineWidth = Math.abs(x) === 50 ? 8 : 4; g.beginPath(); g.moveTo(X(x), Y(-HW)); g.lineTo(X(x), Y(HW)); g.stroke(); }
    g.lineWidth = 3;
    for (let x = -49; x < 50; x++) for (const z of [-HW + 0.6, -3.08, 3.08, HW - 0.6]) { g.beginPath(); g.moveTo(X(x), Y(z) - 6); g.lineTo(X(x), Y(z) + 6); g.stroke(); }
    g.lineWidth = 10; g.strokeRect(X(-60), Y(-HW), 120 * PX, 53.3 * PX);
    g.fillStyle = '#f4f4ef'; g.font = `700 ${3 * PX}px "Barlow Condensed", Arial Narrow, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let x = -40; x <= 40; x += 10) { const n = String(50 - Math.abs(x)); g.fillText(n, X(x), Y(HW - 9)); g.save(); g.translate(X(x), Y(-HW + 9)); g.rotate(Math.PI); g.fillText(n, 0, 0); g.restore(); }
    g.save(); g.translate(X(0), Y(0)); g.globalAlpha = 0.85; g.font = `900 italic ${5 * PX}px "Barlow Condensed", Arial Narrow, sans-serif`; g.fillText('GM', 0, 0); g.restore();
  });
  fieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(132, 65.3), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  fieldMesh.rotation.x = -Math.PI / 2; fieldMesh.receiveShadow = true;
  scene.add(fieldMesh);
}
(function buildStadium() {
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(260, 180), new THREE.MeshStandardMaterial({ color: '#16331d', roughness: 1 }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; apron.receiveShadow = true; scene.add(apron);
  const crowd = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#0c0f16'; g.fillRect(0, 0, w, h);
    const cols = ['#8a8f99', '#2b4a8c', '#7d2730', '#a68a3c', '#3a6b49', '#b9bcc4', '#4a3a6a', '#25272e', '#5a6170'];
    for (let r = 0; r < 16; r++) { g.fillStyle = '#151a24'; g.fillRect(0, r * 16 + 12, w, 4); for (let x = 2; x < w; x += 8) { if (Math.random() < 0.08) continue; g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.fillRect(x, r * 16 + 5, 6, 7); g.fillStyle = ['#e0b896', '#8d5a3b', '#c58c64', '#5b3a26'][(Math.random() * 4) | 0]; g.beginPath(); g.arc(x + 3, r * 16 + 3.5, 2.4, 0, 7); g.fill(); } }
  });
  crowd.wrapS = crowd.wrapT = THREE.RepeatWrapping;
  const stand = (len, x, z, ry) => {
    const t = crowd.clone(); t.needsUpdate = true; t.repeat.set(len / 12, 4);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 46), new THREE.MeshStandardMaterial({ map: t, roughness: 1, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.12 }));
    m.position.set(x, 17, z); m.rotation.set(0, ry, 0); m.rotateX(-0.62); scene.add(m);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 3, 1), new THREE.MeshStandardMaterial({ color: '#141a26' }));
    wall.position.set(x - Math.sin(ry) * 0, 1.5, z); wall.rotation.y = ry; scene.add(wall);
  };
  stand(170, 0, -50, 0); stand(170, 0, 50, Math.PI); stand(110, -84, 0, Math.PI / 2); stand(110, 84, 0, -Math.PI / 2);
  const glowTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,248,225,.6)'); r.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
  for (const [x, z] of [[-70, -58], [70, -58], [-70, 58], [70, 58]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1, 62, 8), new THREE.MeshStandardMaterial({ color: '#222a36', metalness: 0.6 }));
    pole.position.set(x, 31, z); scene.add(pole);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff7e0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(40, 28, 1); glow.position.set(x, 62, z); scene.add(glow);
  }
  // Goalposts.
  const gold = new THREE.MeshStandardMaterial({ color: '#f2c818', metalness: 0.3, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.3), gold); post.position.y = 1.65;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.2), gold); bar.rotation.x = Math.PI / 2; bar.position.y = 3.3;
    const up1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 10), gold); up1.position.set(0, 8.3, -3.08);
    const up2 = up1.clone(); up2.position.z = 3.08;
    g.add(post, bar, up1, up2); g.position.x = s * 60; g.children.forEach(m => (m.castShadow = true));
    scene.add(g);
  }
})();
// Lines of scrimmage and to gain.
const losLine = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 53.3), new THREE.MeshBasicMaterial({ color: '#3d8bff', transparent: true, opacity: 0.85 }));
const fdLine = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 53.3), new THREE.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0.9 }));
for (const l of [losLine, fdLine]) { l.rotation.x = -Math.PI / 2; l.position.y = 0.03; scene.add(l); }

// ---------- players ------------------------------------------------------------------------
function numberTex(num, fg, bg) {
  return canvasTex(128, 128, (g) => { g.fillStyle = bg; g.fillRect(0, 0, 128, 128); g.fillStyle = fg; g.font = '800 92px "Barlow Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), 64, 70); });
}
const lum = h => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
function makeBody(kit, num) {
  const g = new THREE.Group();
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 });
  const jersey = mat(kit.jersey), pants = mat(kit.pants), helm = new THREE.MeshStandardMaterial({ color: kit.helmet, roughness: 0.25, metalness: 0.35 }), skin = mat(kit.skin), sock = mat(kit.sock);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0, 1.0, s * 0.17);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.42, 4, 8), pants); thigh.position.y = -0.3;
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.4, 4, 8), sock); shin.position.y = -0.75;
    hip.add(thigh, shin); g.add(hip); legs.push(hip);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.42, 4, 10), jersey); torso.position.y = 1.42; torso.scale.z = 1.15;
  const pads = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 1.0), jersey); pads.position.y = 1.78;
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0, 1.74, s * 0.55);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.42, 4, 8), jersey); arm.position.y = -0.28;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), skin); hand.position.y = -0.58;
    sh.add(arm, hand); g.add(sh); arms.push(sh);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), helm); head.position.y = 2.12; head.scale.set(1.05, 1, 0.95);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 24, Math.PI), new THREE.MeshStandardMaterial({ color: kit.stripe })); stripe.position.y = 2.12; stripe.rotation.y = Math.PI / 2;
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.36), new THREE.MeshStandardMaterial({ color: '#cfd3da', metalness: 0.6, roughness: 0.3 })); mask.position.set(0.3, 2.04, 0);
  const nt = numberTex(num, kit.number, kit.jersey);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshStandardMaterial({ map: nt, roughness: 0.6 })); back.position.set(-0.37, 1.45, 0); back.rotation.y = -Math.PI / 2;
  const front = back.clone(); front.position.x = 0.37; front.rotation.y = Math.PI / 2;
  g.add(torso, pads, head, stripe, mask, back, front);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { g, legs, arms };
}
function kitFor(team, home) {
  const c0 = team.c[0], c1 = team.c[1] || '#ffffff';
  if (home) return { jersey: c0, pants: lum(c1) > 150 ? c1 : '#e8e8e8', helmet: c0, stripe: c1, number: lum(c0) > 160 ? '#111' : '#fff', sock: c0, skin: '#8d5a3b' };
  return { jersey: '#f2f2f2', pants: c0, helmet: c0, stripe: c1, number: lum(c0) > 200 ? c1 : c0, sock: c0, skin: '#c58c64' };
}

class Player {
  constructor(side, pos, info, kit) {
    this.side = side; this.pos = pos; this.name = info?.n ?? pos; this.num = info?.num ?? 0; this.ovr = info?.ovr ?? 70;
    this.maxSpeed = (SPEED[pos] ?? 8) + (this.ovr - 78) * 0.035;
    const b = makeBody(kit, this.num); this.mesh = b.g; this.legs = b.legs; this.arms = b.arms;
    scene.add(this.mesh);
    this.p = new THREE.Vector2(); this.v = new THREE.Vector2(); this.facing = 0;
    this.phase = Math.random() * 6; this.stun = 0; this.down = 0;
  }
  place(x, z) { this.p.set(x, z); this.v.set(0, 0); this.stun = 0; this.down = 0; this.blocked = null; this.engaged = null; this.route = null; this.mesh.rotation.set(0, 0, 0); this.facing = this.side === 'O' ? 0 : Math.PI; }
  steer(tx, tz, dt, speedMul = 1) {
    if (this.stun > 0 || this.down > 0) { this.v.multiplyScalar(0.85); return; }
    const dx = tx - this.p.x, dz = tz - this.p.y, d = Math.hypot(dx, dz);
    const top = this.maxSpeed * speedMul;
    const want = d < 0.05 ? new THREE.Vector2() : new THREE.Vector2(dx / d, dz / d).multiplyScalar(Math.min(top, d * 4));
    const dv = want.sub(this.v); const lim = ACCEL * dt;
    if (dv.length() > lim) dv.setLength(lim);
    this.v.add(dv);
  }
  push(vx, vz, dt, speedMul = 1) {
    // Direct control for the user: velocity follows the stick with acceleration.
    if (this.stun > 0 || this.down > 0) return;
    const want = new THREE.Vector2(vx, vz); if (want.length() > 1) want.normalize();
    want.multiplyScalar(this.maxSpeed * speedMul);
    const dv = want.sub(this.v); const lim = ACCEL * 1.25 * dt; if (dv.length() > lim) dv.setLength(lim);
    this.v.add(dv);
  }
  update(dt) {
    this.stun = Math.max(0, this.stun - dt);
    this.p.addScaledVector(this.v, dt);
    const sp = this.v.length();
    if (sp > 0.3) this.facing = Math.atan2(this.v.y, this.v.x);
    this.phase += dt * (4 + sp * 1.2);
    const swing = Math.min(1, sp / 7) * 0.9;
    this.legs[0].rotation.z = Math.sin(this.phase) * swing; this.legs[1].rotation.z = -Math.sin(this.phase) * swing;
    this.arms[0].rotation.z = -Math.sin(this.phase) * swing * 0.8; this.arms[1].rotation.z = Math.sin(this.phase) * swing * 0.8;
    this.mesh.position.set(this.p.x, Math.abs(Math.sin(this.phase)) * 0.05 * swing, this.p.y);
    this.mesh.rotation.y = -this.facing;
    // Lean into the run; topple when tackled.
    const lean = Math.min(0.25, sp * 0.025);
    if (this.down > 0) { this.down = Math.min(1, this.down + dt * 2.6); this.mesh.rotation.z = -this.down * 1.45; this.mesh.position.y = 0.15; }
    else this.mesh.rotation.z = -lean;
  }
  remove() { scene.remove(this.mesh); }
}

// Ball.
const ball = (() => {
  const pts = []; for (let i = 0; i <= 24; i++) { const y = -0.28 + (0.56 * i) / 24; pts.push(new THREE.Vector2(0.17 * Math.pow(Math.max(0, 1 - (y / 0.28) ** 2), 0.7), y)); }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), new THREE.MeshStandardMaterial({ color: '#7b3a14', roughness: 0.5 }));
  m.rotation.z = Math.PI / 2; const g = new THREE.Group(); g.add(m); m.castShadow = true; scene.add(g); return g;
})();
// Ring under the player you control, and receiver icons.
const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32), new THREE.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; scene.add(ring);
const ICON_COL = ['#ffd23f', '#3d8bff', '#ff4d5e', '#2fd17b', '#c77dff'];
const icons = [1, 2, 3, 4, 5].map((n, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = ICON_COL[i]; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#000'; g.font = '900 38px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 32, 34); }), depthTest: false })); s.scale.set(1.1, 1.1, 1); s.visible = false; scene.add(s); return s; });

// ---------- plays ----------------------------------------------------------------------------
// Routes: points relative to the receiver's start (x downfield, z across, + toward his sideline).
const PLAYS = [
  { k: 'inside', name: 'Inside Zone', desc: 'Run between the tackles', run: 'inside' },
  { k: 'outside', name: 'Outside Zone', desc: 'Stretch it to the edge', run: 'outside' },
  { k: 'slants', name: 'Quick Slants', desc: 'Beat the blitz, get it out fast', routes: { X: [[5, 0], [11, -5]], Z: [[5, 0], [11, -5]], SL: [[4, 0], [6, 4]], TE: [[3, 0], [4, 6]], RB: [[1, 3], [3, 6]] } },
  { k: 'curl', name: 'Curl Flat', desc: 'Curls at 12, backs to the flat', routes: { X: [[12, 0], [10.5, -1]], Z: [[12, 0], [10.5, -1]], SL: [[2, 0], [3, 7]], TE: [[6, 0], [14, 0]], RB: [[1, -3], [3, -6]] } },
  { k: 'verts', name: 'Four Verticals', desc: 'Everyone goes deep', routes: { X: [[40, 0]], Z: [[40, 0]], SL: [[8, 0], [40, -2]], TE: [[8, 0], [40, 1]], RB: [[1, 3], [4, 5]] } },
  { k: 'cross', name: 'Mesh Cross', desc: 'Shallow crossers rub man coverage', routes: { X: [[3, 0], [6, -16]], Z: [[16, 0], [18, -12]], SL: [[4, 0], [5, -14]], TE: [[9, 0], [12, 6]], RB: [[1, 2], [5, 2]] } },
  { k: 'screen', name: 'RB Screen', desc: 'Let them rush, dump it off', screen: true, routes: { X: [[14, 0]], Z: [[14, 0]], SL: [[10, 0]], TE: [[2, 0]], RB: [[-1, -3], [0, -6]] } },
];
const KICKS = [{ k: 'punt', name: 'Punt', desc: 'Flip the field', kick: 'punt' }, { k: 'fg', name: 'Field Goal', desc: '', kick: 'fg' }];

// ---------- game state ---------------------------------------------------------------------
const G = { me: null, op: null, score: [0, 0], q: 1, clock: QUARTER, down: 1, togo: 10, los: -25, phase: 'start', cam: 0, playT: 0 };
let O = {}, D = {}, all = [], carrier = null, play = null, flight = null, result = null, stamina = 1, juke = 0, stiff = 0;
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; onKey(e); });
addEventListener('keyup', e => { keys[e.code] = false; });

$('kick').onclick = () => startGame($('teamA').value, $('teamB').value);
$('again').onclick = () => { $('final').classList.add('hidden'); $('start').classList.remove('hidden'); };

function startGame(a, b) {
  G.me = teams.find(t => t.abbr === a); G.op = teams.find(t => t.abbr === b) ?? teams.find(t => t.abbr !== a);
  document.documentElement.style.setProperty('--a', G.me.c[0]); document.documentElement.style.setProperty('--b', G.op.c[0]);
  buildField(G.me, G.op);
  for (const p of all) p.remove();
  const ok = G.me.roster, dk = G.op.roster, mk = kitFor(G.me, true), ak = kitFor(G.op, false);
  O = {
    QB: new Player('O', 'QB', ok.QB[0], mk), RB: new Player('O', 'RB', ok.RB[0], mk),
    X: new Player('O', 'WR', ok.WR[0], mk), Z: new Player('O', 'WR', ok.WR[1], mk), SL: new Player('O', 'WR', ok.WR[2], mk), TE: new Player('O', 'TE', ok.TE[0], mk),
    LT: new Player('O', 'OT', ok.OT[0], mk), LG: new Player('O', 'G', ok.G[0], mk), C: new Player('O', 'C', ok.C[0], mk), RG: new Player('O', 'G', ok.G[1], mk), RT: new Player('O', 'OT', ok.OT[1], mk),
  };
  D = {
    LE: new Player('D', 'EDGE', dk.EDGE[0], ak), RE: new Player('D', 'EDGE', dk.EDGE[1], ak), DT1: new Player('D', 'DT', dk.DT[0], ak), DT2: new Player('D', 'DT', dk.DT[1], ak),
    MLB: new Player('D', 'LB', dk.LB[0], ak), WLB: new Player('D', 'LB', dk.LB[1], ak),
    CB1: new Player('D', 'CB', dk.CB[0], ak), CB2: new Player('D', 'CB', dk.CB[1], ak), NCB: new Player('D', 'CB', dk.CB[2], ak), FS: new Player('D', 'S', dk.S[0], ak), SS: new Player('D', 'S', dk.S[1], ak),
  };
  all = [...Object.values(O), ...Object.values(D)];
  Object.assign(G, { score: [0, 0], q: 1, clock: QUARTER, down: 1, togo: 10, los: -25 });
  $('start').classList.add('hidden'); $('bug').classList.remove('hidden');
  feed(`Kickoff: ${G.me.name} vs ${G.op.name}. Touchback, ball at your 25.`);
  toCall();
}

function lineup() {
  const L = G.los, bz = 0;
  O.C.place(L - 0.6, bz); O.LG.place(L - 0.7, bz - 1.5); O.RG.place(L - 0.7, bz + 1.5); O.LT.place(L - 0.8, bz - 3); O.RT.place(L - 0.8, bz + 3);
  O.TE.place(L - 0.8, bz + 4.6); O.X.place(L - 0.5, -20); O.Z.place(L - 1.3, 19); O.SL.place(L - 1.2, -11);
  O.QB.place(L - 5, bz); O.RB.place(L - 5.2, bz + 1.6);
  D.LE.place(L + 1, bz - 4.2); D.DT1.place(L + 1, bz - 1.2); D.DT2.place(L + 1, bz + 1.4); D.RE.place(L + 1, bz + 5.2);
  D.MLB.place(L + 5, bz - 1.5); D.WLB.place(L + 5, bz + 2.5);
  D.CB1.place(L + 6.5, -20); D.CB2.place(L + 6.5, 19); D.NCB.place(L + 5, -11);
  D.FS.place(L + 13, -7); D.SS.place(L + 12, 8);
  for (const p of all) p.update(0);
  losLine.position.x = L; fdLine.position.x = Math.min(50, L + G.togo); fdLine.visible = L + G.togo < 50;
  carrier = null; flight = null; ball.position.set(L, 0.3, 0); ball.rotation.set(0, 0, 0);
}

// ---------- phases ----------------------------------------------------------------------------
function toCall() {
  if (checkClock()) return;
  G.phase = 'call'; lineup();
  const fgDist = 50 - G.los + 17;
  const kicks = G.down === 4 ? KICKS.filter(k => k.kick === 'punt' || fgDist <= 60).map(k => (k.kick === 'fg' ? { ...k, desc: `${Math.round(fgDist)}-yard attempt` } : k)) : [];
  const list = [...PLAYS, ...kicks];
  $('plays').innerHTML = list.map((p, i) => `<button class="pc${p.kick ? ' kick' : ''}" data-i="${i}"><i>${i + 1}</i><b>${p.name}</b><span>${p.desc}</span></button>`).join('');
  $('plays').querySelectorAll('.pc').forEach(b => (b.onclick = () => choose(list[+b.dataset.i])));
  G.choices = list;
  $('sit').textContent = `${ord(G.down)} & ${G.los + G.togo >= 50 ? 'Goal' : G.togo} · ${spotText(G.los)}`;
  $('call').classList.remove('hidden'); $('hint').classList.add('hidden');
  bug();
}
function choose(p) {
  $('call').classList.add('hidden');
  if (p.kick) return kick(p.kick);
  play = p; G.phase = 'presnap';
  hint(`<kbd>Space</kbd> snap · ${p.run ? 'run it with <kbd>WASD</kbd>' : 'throw with <kbd>1</kbd>–<kbd>5</kbd>'}`);
  showIcons(!p.run);
}
function snap() {
  G.phase = 'live'; G.playT = 0; result = null; stamina = Math.min(1, stamina + 0.35);
  carrier = O.QB; // the QB holds it after the snap
  // Defensive assignments: man on the receivers, rush with four, safeties deep.
  D.CB1.man = O.X; D.CB2.man = O.Z; D.NCB.man = O.SL; D.MLB.man = O.TE; D.WLB.man = O.RB;
  // Blocks: each lineman takes the man in front; the rushers shed on their own clock.
  const pairs = [[O.LT, D.LE], [O.LG, D.DT1], [O.RG, D.DT2], [O.RT, D.RE]];
  for (const [ol, dl] of pairs) { ol.engaged = dl; dl.blocked = ol; dl.shedAt = rand(2.2, 4.2) + (ol.ovr - dl.ovr) * 0.05 + (play.screen ? 1.2 : 0); }
  O.C.engaged = null;
  if (play.routes) for (const k of ['X', 'Z', 'SL', 'TE', 'RB']) {
    const r = play.routes[k]; const p = O[k]; const side = p.p.y >= 0 ? 1 : -1;
    p.route = r.map(([dx, dz]) => [p.p.x + dx, p.p.y + dz * side]); p.ri = 0;
  }
  hint(play.run ? '<kbd>WASD</kbd> run · <kbd>Shift</kbd> sprint · <kbd>Space</kbd> juke · <kbd>E</kbd> stiff arm' : '<kbd>1</kbd>–<kbd>5</kbd> throw · <kbd>WASD</kbd> move the QB');
}
function kick(kind) {
  if (kind === 'fg') {
    const dist = 50 - G.los + 17;
    const p = clamp(1.02 - Math.max(0, dist - 25) * 0.016, 0.3, 0.98);
    const good = Math.random() < p;
    G.clock = Math.max(0, G.clock - 6);
    if (good) { G.score[0] += 3; banner(`It's Good!`, `${Math.round(dist)}-yard field goal`, G.me.c[0]); feed(`${G.me.nick} ${Math.round(dist)}-yard field goal is good.`); }
    else { banner('No Good', `${Math.round(dist)}-yard try`, '#7a1f2b'); feed(`${Math.round(dist)}-yard field goal is no good.`); }
    return setTimeout(() => opponentDrive(good ? 35 : Math.max(20, 100 - (G.los + 50) - 7)), 1800);
  }
  const net = Math.round(rand(36, 46));
  const land = G.los + net;
  const oppStart = land >= 50 ? 20 : 50 - land;
  G.clock = Math.max(0, G.clock - 8);
  banner('Punt', `${net} yards · fair catch`, '#20283a'); feed(`${G.me.nick} punt, ${net} yards.`);
  setTimeout(() => opponentDrive(oppStart), 1800);
}

// The computer's possession, resolved as a drive: better offenses against weaker
// defenses score more often.
function opponentDrive(start) {
  if (checkClock()) return;
  const avg = (r, ks) => { const v = ks.flatMap(k => r[k]).map(p => p.ovr); return v.reduce((a, b) => a + b, 0) / v.length; };
  const off = avg(G.op.roster, ['QB', 'QB', 'WR', 'RB', 'TE', 'OT', 'G', 'C']), def = avg(G.me.roster, ['EDGE', 'DT', 'LB', 'CB', 'S']);
  const field = (100 - start) / 75;
  const pTD = clamp(0.24 + (off - def) * 0.012 - (field - 1) * 0.12, 0.08, 0.5), pFG = 0.18;
  const r = Math.random(), plays = Math.round(rand(5, 11)), used = Math.round(rand(120, 210));
  G.clock -= used;
  let txt, sub, next;
  if (r < pTD) { G.score[1] += 7; txt = 'Touchdown'; sub = `${G.op.nick}: ${plays} plays, ${100 - start} yards`; next = -15; }
  else if (r < pTD + pFG) { G.score[1] += 3; txt = 'Field Goal'; sub = `${G.op.nick} drive stalls in range`; next = -15; }
  else if (r < pTD + pFG + 0.1) { txt = 'Interception!'; sub = `Your defense takes it away`; next = -50 + Math.round(rand(20, 45)); }
  else { txt = 'Punt'; sub = `${G.op.nick} go ${plays} plays and punt`; next = -50 + Math.round(rand(12, 30)); }
  while (G.clock <= 0 && G.q < 4) { G.q++; G.clock += QUARTER; }
  feed(`${G.op.nick} drive: ${txt.toLowerCase()}${txt === 'Touchdown' || txt === 'Field Goal' ? ` (${G.score[1]})` : ''}.`);
  banner(txt, sub, txt === 'Touchdown' || txt === 'Field Goal' ? G.op.c[0] : '#1d2b4a');
  G.los = next; G.down = 1; G.togo = 10;
  bug();
  setTimeout(toCall, 2200);
}

function endPlay(kind, spotX, text, sub, color) {
  if (G.phase !== 'live') return;
  G.phase = 'dead';
  showIcons(false);
  const gained = Math.round(spotX - G.los);
  const running = ['tackle'].includes(kind);
  G.clock = Math.max(0, G.clock - Math.round(G.playT) - (running ? 24 : 4));
  let next = () => toCall();
  if (kind === 'td') {
    G.score[0] += 6; const xp = Math.random() < 0.95; if (xp) G.score[0] += 1;
    banner('Touchdown!', `${carrier?.name ?? ''} · extra point ${xp ? 'good' : 'no good'}`, G.me.c[0]);
    feed(`TOUCHDOWN ${G.me.nick}! ${carrier?.name} scores. (${G.score[0]}-${G.score[1]})`);
    next = () => opponentDrive(35);
  } else if (kind === 'int') {
    banner('Intercepted', sub, G.op.c[0]); feed(`Intercepted by ${sub}.`);
    next = () => opponentDrive(clamp(50 - Math.round(spotX), 1, 99));
  } else {
    G.los = clamp(Math.round(spotX * 2) / 2, -49, 49);
    if (kind === 'safety') { G.score[1] += 2; banner('Safety', '', G.op.c[0]); next = () => opponentDrive(40); }
    else if (G.los >= G.los - gained + G.togo) { G.down = 1; G.togo = Math.min(10, 50 - G.los); banner(text ?? 'First Down', sub ?? `Gain of ${gained}`, '#1f6f3a'); }
    else if (G.down >= 4) { banner('Turnover on Downs', '', G.op.c[0]); feed('Turnover on downs.'); next = () => opponentDrive(clamp(50 - Math.round(G.los), 1, 99)); }
    else { G.down++; G.togo = Math.max(1, G.togo - gained); banner(text ?? (gained > 0 ? `Gain of ${gained}` : gained < 0 ? `Loss of ${-gained}` : 'No Gain'), sub, color ?? '#20283a'); }
  }
  bug();
  setTimeout(() => { if (!checkClock()) next(); }, 1700);
}
function checkClock() {
  if (G.clock > 0) return false;
  if (G.q < 4) { G.q++; G.clock = QUARTER; feed(`End of the ${ord(G.q - 1)} quarter.`); if (G.q === 3) { G.los = -25; G.down = 1; G.togo = 10; } return false; }
  G.phase = 'over';
  $('call').classList.add('hidden'); $('hint').classList.add('hidden');
  $('finalSc').innerHTML = `<span style="color:${G.me.c[0]}">${G.me.abbr} ${G.score[0]}</span><span style="color:${G.op.c[0]}">${G.op.abbr} ${G.score[1]}</span>`;
  $('final').classList.remove('hidden');
  return true;
}

// ---------- input -------------------------------------------------------------------------------
function onKey(e) {
  if (G.phase === 'call') { const n = +e.key; if (n >= 1 && n <= G.choices.length) choose(G.choices[n - 1]); return; }
  if (e.code === 'KeyC') G.cam = (G.cam + 1) % 3;
  if (G.phase === 'presnap' && e.code === 'Space') { e.preventDefault(); snap(); return; }
  if (G.phase !== 'live') return;
  if (e.code === 'Space') { e.preventDefault(); if (carrier && carrier !== O.QB && juke <= -0.6) juke = 0.35; }
  if (e.code === 'KeyE' && stiff <= -0.8) stiff = 0.5;
  const n = +e.key;
  if (n >= 1 && n <= 5 && carrier === O.QB && play.routes && O.QB.p.x < G.los + 0.5 && !flight) throwTo(['X', 'SL', 'TE', 'Z', 'RB'][n - 1]);
}
function throwTo(k) {
  const qb = O.QB, r = O[k];
  const d0 = qb.p.distanceTo(r.p), t = d0 / BALL_SPEED + 0.12;
  const lead = r.p.clone().addScaledVector(r.v, t);
  // Accuracy: the QB's rating, pressure in his face, and throwing on the move.
  const press = Math.min(...[D.LE, D.RE, D.DT1, D.DT2].map(x => x.p.distanceTo(qb.p)));
  const sd = 0.45 + (90 - qb.ovr) * 0.03 + (press < 2.5 ? 1.1 : 0) + qb.v.length() * 0.08 + d0 * 0.012;
  lead.x += gauss() * sd; lead.y += gauss() * sd;
  flight = { from: new THREE.Vector3(qb.p.x, 2.1, qb.p.y), to: lead, t: 0, T: Math.hypot(lead.x - qb.p.x, lead.y - qb.p.y) / BALL_SPEED + 0.12, target: r, arc: 1.2 + d0 * 0.07 };
  carrier = null; showIcons(false);
}

// ---------- the play itself ---------------------------------------------------------------------------
function simulate(dt) {
  G.playT += dt; juke -= dt; stiff -= dt;
  const run = !!play.run;
  // Hand-off on runs.
  if (run && carrier === O.QB && G.playT > 0.55) carrier = O.RB;
  const user = carrier && (carrier !== O.QB || !run) ? carrier : null;
  // Offense.
  for (const [k, p] of Object.entries(O)) {
    if (p === user) continue;
    if (p.engaged) { // pass pro or run block: stay between the man and the ball
      const m = p.engaged; const goal = carrier ? carrier.p : O.QB.p;
      const tx = m.p.x - (m.p.x - goal.x) * 0.15 - 0.9 * Math.sign(m.p.x - goal.x || 1), tz = m.p.y + (goal.y - m.p.y) * 0.2;
      p.steer(run ? m.p.x - 0.7 : tx, tz, dt, 0.8);
      if (m.shedAt !== undefined && G.playT > m.shedAt) p.engaged = null;
      continue;
    }
    if (k === 'C') { p.steer(G.los - (run ? -1 : 1.5), 0, dt, 0.5); continue; }
    if (run) {
      if (k === 'RB' && carrier === O.QB) { p.steer(G.los - 4.2, play.run === 'outside' ? 2.5 : 0.6, dt); continue; }
      if (k === 'QB') { p.steer(G.los - 6, -2, dt, 0.5); continue; }
      // Receivers and TE block downfield: find the nearest free defender.
      const def = nearest(Object.values(D).filter(d => !d.blocked && d.down === 0), p.p);
      if (def && def.p.distanceTo(p.p) < 1.4) { def.blocked = p; def.shedAt = G.playT + rand(1, 2.4); p.engaged = def; }
      if (def) p.steer(def.p.x, def.p.y, dt, 0.85);
      continue;
    }
    if (k === 'QB' && carrier === O.QB) continue;
    if (p.route && p.ri < p.route.length) {
      const [tx, tz] = p.route[p.ri]; p.steer(tx, tz, dt);
      if (Math.hypot(tx - p.p.x, tz - p.p.y) < 0.8) p.ri++;
    } else if (p.route) {
      // Route done: keep going, or settle in the hole on curls.
      const last = p.route[p.route.length - 1];
      if (play.k === 'curl' || play.k === 'screen') p.steer(last[0], last[1], dt); else p.steer(p.p.x + 5, p.p.y, dt);
    }
    if (carrier && carrier !== p && carrier !== O.QB) { const def = nearest(Object.values(D).filter(d => !d.blocked && d.down === 0), carrier.p); if (def) p.steer(def.p.x, def.p.y, dt, 0.8); }
  }
  // QB drop and pocket.
  if (carrier === O.QB && !run) {
    const ix = (keys.KeyD || keys.ArrowRight ? 0 : 0) + (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const iz = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    if (ix || iz) O.QB.push(ix, iz, dt, 0.8); else O.QB.steer(G.los - 7.5, O.QB.p.y, dt, 0.6);
    if (O.QB.p.x > G.los + 0.3) { showIcons(false); }
  }
  // The user runs the ball carrier.
  if (user && !(user === O.QB && !run && O.QB.p.x <= G.los + 0.3)) {
    const ix = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const iz = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const sprint = (keys.ShiftLeft || keys.ShiftRight) && stamina > 0.05;
    stamina = clamp(stamina + (sprint ? -0.28 : 0.12) * dt, 0, 1);
    const mul = (sprint ? 1 : 0.86) * (juke > 0 ? 1.15 : 1);
    if (ix || iz) user.push(ix || 0.15, iz, dt, mul); else user.push(1, 0, dt, mul * 0.9);
    if (juke > 0) user.v.y += (iz || (Math.random() < 0.5 ? 1 : -1)) * 26 * dt;
  }
  // Defense.
  const ballPos = carrier ? carrier.p : flight ? new THREE.Vector2(flight.to.x, flight.to.y) : O.QB.p;
  for (const [k, d] of Object.entries(D)) {
    if (d.down > 0) continue;
    if (d.blocked && d.blocked.engaged === d) {
      // Fighting the block: push toward the ball slowly.
      const goal = carrier ?? O.QB; d.steer(goal.p.x, goal.p.y, dt, 0.18 + (d.ovr - d.blocked.ovr) * 0.01);
      if (G.playT > d.shedAt) d.blocked = null;
      continue;
    }
    d.blocked = null;
    if (carrier && carrier !== O.QB) { pursue(d, carrier, dt); continue; }
    if (flight) { d.steer(flight.to.x, flight.to.y, dt); continue; }
    if (['LE', 'RE', 'DT1', 'DT2'].includes(k)) { pursue(d, carrier ?? O.QB, dt); continue; }
    if (d.man) {
      // Man coverage: trail his receiver a step behind, reacting a beat late.
      const r = d.man, lag = 0.22 + (r.ovr - d.ovr) * 0.008;
      const tx = r.p.x + r.v.x * 0.25 + (r.p.x > G.los + 2 ? 1.2 : 2.0), tz = r.p.y - r.v.y * lag;
      d.steer(tx, tz, dt, run ? 0.9 : 1);
      if (run && G.playT > 0.8) pursue(d, carrier ?? O.RB, dt);
      continue;
    }
    // Safeties: deep thirds, then rally to anything coming deep.
    const deep = Object.values(O).filter(o => o.route && o.p.x > G.los + 10 && Math.sign(o.p.y || 1) === Math.sign(d.p.y || 1)).sort((a, b) => b.p.x - a.p.x)[0];
    if (deep) d.steer(Math.max(deep.p.x + 3, G.los + 12), deep.p.y, dt); else d.steer(G.los + 13, d.p.y * 0.98, dt, 0.5);
    if (run && G.playT > 1) pursue(d, carrier ?? O.RB, dt);
  }
  for (const p of all) p.update(dt);
  // Ball flight.
  if (flight) {
    flight.t += dt; const k = Math.min(1, flight.t / flight.T);
    ball.position.set(flight.from.x + (flight.to.x - flight.from.x) * k, 2.1 + Math.sin(Math.PI * k) * flight.arc - k * 0.8, flight.from.z + (flight.to.y - flight.from.z) * k);
    ball.rotation.y = -Math.atan2(flight.to.y - flight.from.z, flight.to.x - flight.from.x); ball.children[0].rotation.x += dt * 30;
    if (k >= 1) resolveCatch();
    return;
  }
  // Ball in hand.
  const h = carrier ?? O.QB;
  ball.position.set(h.p.x + Math.cos(h.facing) * 0.35, 1.35, h.p.y + Math.sin(h.facing) * 0.35);
  ball.rotation.set(0, -h.facing, 0.3);
  if (!carrier) return;
  // Tackles and the sideline.
  if (Math.abs(carrier.p.y) > HW) return endPlay('oob', carrier.p.x, 'Out of Bounds', `${carrier.name}`);
  if (carrier.p.x > 50) return endPlay('td', 50);
  if (carrier.p.x < -50) return endPlay('safety', -50);
  const qbSack = carrier === O.QB && !run;
  for (const d of Object.values(D)) {
    if (d.down > 0 || d.stun > 0 || (d.blocked && d.blocked.engaged === d)) continue;
    if (d.p.distanceTo(carrier.p) < 1.0) {
      const near = Object.values(D).filter(x => x !== d && x.p.distanceTo(carrier.p) < 2).length;
      let p = 0.62 + (d.ovr - carrier.ovr) * 0.012 + near * 0.12 + (qbSack ? 0.2 : 0) - (juke > 0 ? 0.4 : 0) - (stiff > 0 ? 0.3 : 0) - (carrier.v.length() > 8 ? 0.08 : 0);
      if (Math.random() < clamp(p, 0.15, 0.97)) {
        carrier.down = 0.01; d.down = 0.01; carrier.v.multiplyScalar(0.2);
        const spot = carrier.p.x + Math.max(0, Math.cos(carrier.facing)) * 0.6; // forward progress
        if (qbSack && carrier.p.x < G.los) return endPlay('tackle', spot, 'Sack', `${d.name}`, G.op.c[0]);
        return endPlay('tackle', spot, undefined, `${carrier.name} · tackle ${d.name}`);
      }
      d.stun = 0.7; d.v.multiplyScalar(-0.3); // missed: stumbles
      if (juke > 0 || stiff > 0) feed(`${carrier.name} ${juke > 0 ? 'jukes' : 'stiff-arms'} ${d.name}!`);
    }
  }
}
function pursue(d, target, dt) {
  // Take an angle: aim where the runner will be.
  const dist = d.p.distanceTo(target.p), t = Math.min(1.2, dist / Math.max(1, d.maxSpeed));
  d.steer(target.p.x + target.v.x * t, target.p.y + target.v.y * t, dt);
}
function nearest(list, p) { let b = null, bd = 1e9; for (const x of list) { const dd = x.p.distanceTo(p); if (dd < bd) { bd = dd; b = x; } } return b; }
function resolveCatch() {
  const spot = new THREE.Vector2(flight.to.x, flight.to.y);
  const r = nearest(Object.values(O).filter(o => o.pos !== 'OT' && o.pos !== 'G' && o.pos !== 'C' && o !== O.QB), spot);
  const d = nearest(Object.values(D), spot);
  const rd = r.p.distanceTo(spot), dd = d.p.distanceTo(spot);
  flight = null;
  if (dd < 1.3 && dd < rd && Math.random() < 0.3 + (d.ovr - 80) * 0.01) {
    carrier = null; ball.position.set(d.p.x, 1.3, d.p.y);
    return endPlay('int', d.p.x, null, `${d.name}`);
  }
  const pCatch = rd > 2.3 ? 0 : clamp(0.95 - rd * 0.12 - Math.max(0, 1.6 - dd) * 0.38 + (r.ovr - 80) * 0.006, 0.05, 0.97);
  if (Math.random() < pCatch) {
    carrier = r; r.v.multiplyScalar(0.9);
    feed(`${O.QB.name} to ${r.name}${dd < 1.6 ? ', contested catch!' : ''}`);
    if (r.p.x > 50) endPlay('td', 50);
    return;
  }
  ball.position.set(spot.x, 0.2, spot.y);
  endPlay('inc', G.los, 'Incomplete', dd < 1.6 ? `Broken up by ${d.name}` : `Intended for ${r.name}`, '#2a2f3a');
}

// ---------- HUD -------------------------------------------------------------------------------------
const ord = n => ['', '1st', '2nd', '3rd', '4th'][n] ?? `${n}th`;
const spotText = x => (x === 0 ? 'Midfield' : x < 0 ? `Own ${50 + x}` : `Opp ${50 - x}`);
const clockText = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, Math.round(s)) % 60).padStart(2, '0')}`;
function bug() {
  $('bug').innerHTML = `<div class="tm me"><b>${G.me.abbr}</b><span>${G.score[0]}</span></div>
    <div class="mid"><b>${ord(G.q)} · ${clockText(G.clock)}</b><em><i class="pos"></i>${ord(G.down)} & ${G.los + G.togo >= 50 ? 'Goal' : G.togo} · ${spotText(G.los)}</em></div>
    <div class="tm op"><b>${G.op.abbr}</b><span>${G.score[1]}</span></div>`;
}
let banTimer;
function banner(t, sub, color) { const b = $('banner'); b.innerHTML = `<span style="--bc:${color ?? '#0b0e14'}">${t}</span>${sub ? `<small>${sub}</small>` : ''}`; clearTimeout(banTimer); banTimer = setTimeout(() => (b.innerHTML = ''), 1700); }
function hint(html) { const h = $('hint'); h.innerHTML = html; h.classList.remove('hidden'); }
function feed(t) { const f = $('feed'); const d = document.createElement('div'); d.textContent = t; f.prepend(d); while (f.children.length > 5) f.lastChild.remove(); }
function showIcons(on) {
  icons.forEach((s, i) => { s.visible = on; s.userData.k = ['X', 'SL', 'TE', 'Z', 'RB'][i]; });
}

// ---------- camera & loop ---------------------------------------------------------------------------
const camPos = new THREE.Vector3(-40, 12, 0), camLook = new THREE.Vector3();
function updateCamera(dt) {
  const f = flight ? new THREE.Vector3(ball.position.x, 0, ball.position.z) : carrier ? new THREE.Vector3(carrier.p.x, 0, carrier.p.y) : new THREE.Vector3(G.los, 0, 0);
  if (G.phase === 'call' || G.phase === 'presnap') f.set(G.los + 4, 0, 0);
  const off = [new THREE.Vector3(-13, 8.5, 0), new THREE.Vector3(-4, 30, 0.1), new THREE.Vector3(2, 15, 30)][G.cam];
  const want = f.clone().add(off);
  camPos.lerp(want, Math.min(1, dt * 3.2));
  camLook.lerp(f.clone().add(new THREE.Vector3(G.cam === 2 ? 0 : 7, 0, 0)), Math.min(1, dt * 4));
  camera.position.copy(camPos); camera.lookAt(camLook);
  sun.position.set(f.x - 20, 45, f.z + 18); sun.target.position.copy(f);
}
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  if (G.phase === 'live') { const steps = Math.ceil(dt / 0.016); for (let i = 0; i < steps; i++) if (G.phase === 'live') simulate(dt / steps); }
  else for (const p of all) p.update(dt);
  // Icons over the receivers before the throw; ring under whoever you control.
  icons.forEach(s => { if (s.visible && O[s.userData.k]) { const p = O[s.userData.k].p; s.position.set(p.x, 3.1, p.y); } });
  const ctl = G.phase === 'live' ? (carrier ?? null) : null;
  ring.visible = !!ctl; if (ctl) ring.position.set(ctl.p.x, 0.05, ctl.p.y);
  $('stam').classList.toggle('hidden', G.phase !== 'live'); $('stam').querySelector('i').style.width = `${stamina * 100}%`;
  if (G.phase === 'live' && G.playT > 14) endPlay('tackle', (carrier ?? O.QB).p.x); // safety valve
  updateCamera(dt);
  renderer.render(scene, camera);
}
buildField(teams[0], teams[1]);
camera.position.set(-30, 30, 50); camera.lookAt(0, 0, 0);
frame();
// Test hook: ?auto=1 starts a game straight away.
if (new URLSearchParams(location.search).has('auto')) startGame('DET', 'GB');
window.__G = G;
