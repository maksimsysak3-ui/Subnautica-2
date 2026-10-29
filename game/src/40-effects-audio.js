// =====================================================================
//  Effects: particles, smoke sprites, muzzle flash, tracers, casings
// =====================================================================
const SPARK_N = 500;
const sparkGeo = new THREE.BufferGeometry();
const sparkPos = new Float32Array(SPARK_N * 3), sparkCol = new Float32Array(SPARK_N * 3);
const sparkVel = new Float32Array(SPARK_N * 3), sparkLife = new Float32Array(SPARK_N), sparkMax = new Float32Array(SPARK_N), sparkBase = new Float32Array(SPARK_N * 3);
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
sparks.frustumCulled = false; scene.add(sparks);
let sparkIdx = 0;
function emitSparks(p, n, normal, color = [1, 0.62, 0.25], speed = 5) {
  for (let i = 0; i < n; i++) {
    const k = sparkIdx = (sparkIdx + 1) % SPARK_N;
    sparkPos.set([p.x, p.y, p.z], k * 3);
    const v = _v4.set(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().addScaledVector(normal, 1.2).normalize().multiplyScalar(speed * rand(0.3, 1));
    sparkVel.set([v.x, v.y, v.z], k * 3);
    sparkMax[k] = sparkLife[k] = rand(0.15, 0.45);
    sparkBase.set(color, k * 3);
  }
}
function updateSparks(dt) {
  for (let k = 0; k < SPARK_N; k++) {
    if (sparkLife[k] <= 0) { sparkCol[k * 3] = sparkCol[k * 3 + 1] = sparkCol[k * 3 + 2] = 0; continue; }
    sparkLife[k] -= dt;
    sparkVel[k * 3 + 1] -= 9.81 * dt;
    for (let j = 0; j < 3; j++) sparkPos[k * 3 + j] += sparkVel[k * 3 + j] * dt;
    if (sparkPos[k * 3 + 1] < 0) { sparkPos[k * 3 + 1] = 0; sparkVel[k * 3 + 1] *= -0.3; }
    const f = Math.max(0, sparkLife[k] / sparkMax[k]);
    for (let j = 0; j < 3; j++) sparkCol[k * 3 + j] = sparkBase[k * 3 + j] * f * 2;
  }
  sparkGeo.attributes.position.needsUpdate = true;
  sparkGeo.attributes.color.needsUpdate = true;
}

const puffTex = canvasTex(64, 64, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});
const puffs = [];
for (let i = 0; i < 70; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 }));
  s.visible = false; scene.add(s);
  puffs.push({ s, life: 0, max: 1, vel: new V3(), grow: 1, op: 0.3 });
}
let puffIdx = 0;
function emitPuff(p, color, size, life, vel, op = 0.3, grow = 1.5) {
  const P = puffs[puffIdx = (puffIdx + 1) % puffs.length];
  P.s.position.copy(p); P.s.material.color.set(color); P.s.scale.setScalar(size); P.s.visible = true;
  P.s.material.rotation = rand(0, 6.28);
  P.life = P.max = life; P.vel.copy(vel); P.op = op; P.grow = grow;
}
function updatePuffs(dt) {
  for (const P of puffs) {
    if (P.life <= 0) continue;
    P.life -= dt;
    if (P.life <= 0) { P.s.visible = false; continue; }
    const f = P.life / P.max;
    P.s.position.addScaledVector(P.vel, dt); P.vel.multiplyScalar(Math.exp(-2 * dt)); P.vel.y += 0.15 * dt;
    P.s.scale.multiplyScalar(1 + P.grow * dt);
    P.s.material.opacity = P.op * f * f;
  }
}

const flashTex = canvasTex(128, 128, (g, w) => {
  const c = w / 2;
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand(-0.2, 0.2), len = rand(30, 62);
    const gr = g.createLinearGradient(c, c, c + Math.cos(a) * len, c + Math.sin(a) * len);
    gr.addColorStop(0, 'rgba(255,230,170,1)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
    g.strokeStyle = gr; g.lineWidth = rand(4, 9); g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * len, c + Math.sin(a) * len); g.stroke();
  }
  const gr = g.createRadialGradient(c, c, 0, c, c, 34);
  gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.4, 'rgba(255,190,90,.8)'); gr.addColorStop(1, 'rgba(255,100,20,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});
const flashMat = new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
const flash = new THREE.Group();
{
  const a = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.26), flashMat); a.rotation.x = Math.PI / 2; a.position.z = 0.1; flash.add(a);
  const b = a.clone(); b.rotation.set(Math.PI / 2, 0, Math.PI / 2); flash.add(b);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), flashMat); f.position.z = 0.015; flash.add(f);
}
flash.visible = false;
const flashLight = new THREE.PointLight(0xffa04a, 0, 12, 2);
scene.add(flashLight);

const tracerGeo = new THREE.BoxGeometry(0.012, 0.012, 1); tracerGeo.translate(0, 0, -0.5);
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xff7a3a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

const caseGeo = new THREE.CylinderGeometry(0.0048, 0.0048, 0.045, 7);
const pistolCaseGeo = new THREE.CylinderGeometry(0.0049, 0.0049, 0.019, 7);
const props = [];
function spawnProp(obj, vel, angVel, opts) {
  scene.add(obj);
  props.push({ obj, vel, angVel, r: opts.r, rest: opts.rest, life: opts.life, kind: opts.kind, sleeping: false, bounced: 0 });
  if (opts.kind === 'case' || opts.kind === 'hull') {
    let n = 0;
    for (let i = props.length - 1; i >= 0; i--) if ((props[i].kind === 'case' || props[i].kind === 'hull') && ++n > 140) { scene.remove(props[i].obj); props.splice(i, 1); }
  }
}
function updateProps(dt) {
  for (let i = props.length - 1; i >= 0; i--) {
    const p = props[i];
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.obj); props.splice(i, 1); continue; }
    if (p.sleeping) continue;
    p.vel.y -= 9.81 * dt;
    p.obj.position.addScaledVector(p.vel, dt);
    _e1.set(p.angVel.x * dt, p.angVel.y * dt, p.angVel.z * dt);
    p.obj.quaternion.premultiply(_q1.setFromEuler(_e1));
    if (p.obj.position.y < p.r) {
      p.obj.position.y = p.r;
      if (p.vel.y < -0.5) { audio.impact(p.kind, Math.min(1, -p.vel.y / 4), p.obj.position); p.bounced++; }
      p.vel.y = -p.vel.y * p.rest;
      p.vel.x *= 0.55; p.vel.z *= 0.55; p.angVel.multiplyScalar(0.5);
      if (Math.abs(p.vel.y) < 0.35) {
        p.vel.y = 0;
        p.vel.x *= Math.exp(-8 * dt); p.vel.z *= Math.exp(-8 * dt); p.angVel.multiplyScalar(Math.exp(-8 * dt));
        // settle onto its side: local X axis toward vertical
        const ax = _v4.set(1, 0, 0).applyQuaternion(p.obj.quaternion);
        _q2.setFromUnitVectors(ax, ax.y >= 0 ? UP : _v5.set(0, -1, 0));
        _q1.identity().slerp(_q2, Math.min(1, 10 * dt));
        p.obj.quaternion.premultiply(_q1);
        if (p.vel.lengthSq() < 0.0004 && p.angVel.lengthSq() < 0.01) p.sleeping = true;
      }
    }
  }
}

// bullet holes on steel = lead splash marks
function markSteel(t, worldPoint) {
  const lp = t.plate.worldToLocal(worldPoint.clone());
  const m = new THREE.Mesh(splashGeo, splashMat);
  m.position.set(lp.x, lp.y, 0.0075); m.rotation.z = rand(0, 6);
  m.scale.setScalar(rand(0.8, 1.4));
  t.plate.add(m); t.marks.push(m);
  if (t.marks.length > 60) t.plate.remove(t.marks.shift());
}
function holePaper(t, uv) {
  const x = uv.x * PW, y = (1 - uv.y) * PH, g = t.g;
  g.fillStyle = 'rgba(235,215,170,.9)'; g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0b0a09'; g.beginPath(); g.arc(x, y, 2.1, 0, Math.PI * 2); g.fill();
  t.tex.needsUpdate = true;
}

// =====================================================================
//  Audio (fully synthesized, WebAudio)
// =====================================================================
const audio = (() => {
  let ctx = null, master, comp, verb, verbIn, noise;
  let volume = 0.8;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.15;
    master = ctx.createGain(); master.gain.value = volume;
    master.connect(comp); comp.connect(ctx.destination);
    // Large dark hall reverb
    const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < 900 ? i / 900 : 1); }
    }
    verb = ctx.createConvolver(); verb.buffer = ir;
    verbIn = ctx.createGain(); verbIn.gain.value = 0.5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    verbIn.connect(lp); lp.connect(verb); verb.connect(master);
    const nl = ctx.sampleRate * 2; noise = ctx.createBuffer(1, nl, ctx.sampleRate);
    const nd = noise.getChannelData(0); for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
  }
  const out = (node, wet = 0) => { node.connect(master); if (wet) { const g = ctx.createGain(); g.gain.value = wet; node.connect(g); g.connect(verbIn); } };
  function nz(t, dur, type, freq, q, gain, decay, wet = 0, freqEnd) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    s.connect(f); f.connect(g); out(g, wet);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function tone(t, type, f0, f1, gain, decay, wet = 0) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + decay);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g); out(g, wet); o.start(t); o.stop(t + decay + 0.05);
  }
  // a little two-stroke: sawtooth + square through a throaty low-pass, pitch follows the revs
  let eng = null, skid = null;
  function engineNodes() {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.Q.value = 4; g.gain.value = 0;
    lfo.frequency.value = 18; lg.gain.value = 6; lfo.connect(lg); lg.connect(o1.frequency);
    o1.connect(f); o2.connect(f); f.connect(g); out(g, 0.05);
    o1.start(); o2.start(); lfo.start();
    return { o1, o2, f, g, lfo };
  }
  return {
    init,
    engine(on, rpm = 0, load = 0) {
      if (!ctx) return;
      if (!eng) eng = engineNodes();
      const t = ctx.currentTime, f0 = 32 + rpm * 120;
      eng.o1.frequency.setTargetAtTime(f0, t, 0.05); eng.o2.frequency.setTargetAtTime(f0 * 2.01, t, 0.05); eng.lfo.frequency.setTargetAtTime(f0 * 0.5, t, 0.05);
      eng.f.frequency.setTargetAtTime(380 + rpm * 900 + load * 600, t, 0.05);
      eng.g.gain.setTargetAtTime(on ? 0.05 + load * 0.06 + rpm * 0.03 : 0, t, on ? 0.08 : 0.3);
    },
    skid(k) {
      if (!ctx) return;
      if (!skid) { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 3; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); out(g, 0.1); s.start(); skid = { g, f }; }
      skid.g.gain.setTargetAtTime(k * 0.16, ctx.currentTime, 0.05); skid.f.frequency.setTargetAtTime(1800 + k * 1200, ctx.currentTime, 0.05);
    },
    horn() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'square', 415, null, 0.07, 0.42, 0.1); tone(t, 'square', 523, null, 0.06, 0.42, 0.1); },
    crash(k = 1) { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.4, 'lowpass', 900, 1, 0.9 * k, 0.4, 0.3); nz(t + 0.02, 0.25, 'bandpass', 3000, 1, 0.4 * k, 0.25, 0.3); tone(t, 'sine', 90, 40, 0.5 * k, 0.3); },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    gunshot(kind, suppressed, brake) {
      if (!ctx) return; const t = ctx.currentTime, p = rand(0.94, 1.06);
      if (suppressed) {
        nz(t, 0.12, 'bandpass', 1400 * p, 0.8, 0.5, 0.1, 0.25, 500);
        tone(t, 'sine', 120, 50, 0.45, 0.12, 0.2);
        nz(t + 0.02, 0.03, 'highpass', 4000, 1, 0.12, 0.03);
        return;
      }
      if (kind === 'shotgun') {
        nz(t, 0.08, 'highpass', 1800 * p, 0.7, 1.0, 0.07, 0.7);
        nz(t, 0.55, 'lowpass', 1500 * p, 0.7, 1.0, 0.5, 1.1, 160);
        tone(t, 'sine', 95 * p, 28, 1.0, 0.38, 0.5);
        tone(t, 'triangle', 55, 24, 0.7, 0.4);
        return;
      }
      if (kind === 'pistol') {
        nz(t, 0.05, 'highpass', 3200 * p, 0.7, 0.9, 0.04, 0.6);
        nz(t, 0.22, 'lowpass', 3000 * p, 0.8, 0.75, 0.18, 0.7, 400);
        tone(t, 'sine', 190 * p, 60, 0.6, 0.12, 0.3);
        nz(t + 0.02, 0.025, 'bandpass', 3600, 3, 0.15, 0.02);
        return;
      }
      const loud = brake ? 1.15 : 1;
      nz(t, 0.06, 'highpass', 2600 * p, 0.7, 1.0 * loud, 0.05, 0.6);
      nz(t, 0.35, 'lowpass', 2400 * p, 0.8, 1.0 * loud, 0.3, 0.9, 260);
      tone(t, 'sine', 130 * p, 38, 1.0, 0.2, 0.4);
      tone(t, 'triangle', 70, 30, 0.6, 0.25);
      nz(t + 0.035, 0.03, 'bandpass', 3200, 3, 0.12, 0.025);
    },
    pump(i) { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.07, 'bandpass', i ? 1500 : 1100, 1.2, 0.5, 0.07, 0.15); nz(t + 0.03, 0.02, 'bandpass', 3000, 4, 0.4, 0.02); tone(t, 'triangle', i ? 520 : 380, null, 0.08, 0.05); },
    shellIn() { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.03, 'bandpass', 2400, 3, 0.35, 0.03); nz(t + 0.02, 0.05, 'lowpass', 600, 1, 0.3, 0.05); },
    holster() { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.18, 'bandpass', 900, 0.7, 0.12, 0.18, 0, 500); },
    draw() { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.12, 'bandpass', 1300, 0.8, 0.12, 0.12, 0, 2200); nz(t + 0.1, 0.02, 'bandpass', 2800, 4, 0.2, 0.02); },
    dry() { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.02, 'bandpass', 3500, 4, 0.25, 0.02); tone(t, 'square', 1800, 900, 0.03, 0.02); },
    switchMode() { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.02, 'bandpass', 2800, 5, 0.25, 0.02); nz(t + 0.05, 0.02, 'bandpass', 2400, 5, 0.18, 0.02); },
    magOut(small) { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.02, 'bandpass', small ? 3400 : 2600, 4, 0.4, 0.025); nz(t + 0.03, 0.12, 'bandpass', 900, 1.5, 0.15, 0.12); },
    magIn(small) { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.05, 'lowpass', 700, 1, 0.6, 0.06, 0.1); nz(t + 0.015, 0.02, 'bandpass', 3000, 4, 0.5, 0.02); tone(t, 'sine', 180, 90, 0.25, 0.06); },
    pouch() { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.15, 'bandpass', 1200, 0.6, 0.12, 0.15, 0, 600); },
    boltRelease(slide) { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.03, 'bandpass', slide ? 3000 : 2200, 2, 0.8, 0.04, 0.2); tone(t, 'triangle', 820, 600, 0.18, 0.08, 0.1); nz(t + 0.012, 0.02, 'highpass', 5000, 1, 0.3, 0.02); },
    // a rifle fired by someone else: delayed by distance, duller and quieter the further it is
    enemyShot(dist) {
      if (!ctx) return; const t = ctx.currentTime + dist / 343, k = 1 / (1 + dist / 25), p = rand(0.92, 1.08);
      nz(t, 0.05, 'highpass', 2000 * p, 0.7, 0.8 * k, 0.04, 0.7);
      nz(t, 0.4, 'lowpass', Math.max(400, 2200 - dist * 8) * p, 0.8, 0.9 * k + 0.05, 0.35, 1.0, 200);
      tone(t, 'sine', 110 * p, 35, 0.7 * k, 0.25, 0.5);
    },
    // supersonic crack of a round passing close by
    crack() { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.012, 'highpass', 4500, 1, 0.55, 0.012, 0.1); nz(t + 0.004, 0.06, 'bandpass', 2400, 2, 0.12, 0.05, 0.3); },
    hurt() { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.09, 'lowpass', 420, 1, 0.9, 0.09, 0.1); tone(t, 'sine', 70, 40, 0.6, 0.15); },
    fleshHit(dist) { if (!ctx) return; const t = ctx.currentTime + dist / 343; nz(t, 0.06, 'lowpass', 700, 1, 0.5 / (1 + dist / 15), 0.06, 0.1); },
    step(crouch, run = 0) { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.07, 'lowpass', crouch ? 300 : 500 + run * 200, 1, crouch ? 0.06 : 0.14 + run * 0.08, 0.07, 0.15); if (run > 0.5) nz(t + 0.02, 0.06, 'bandpass', 1800, 1.5, 0.05, 0.06); },
    ding(dist, size) {
      if (!ctx) return; const t = ctx.currentTime + dist / 343, f = 520 * Math.sqrt(0.35 / size) * rand(0.97, 1.03);
      const g = 0.85 / (1 + dist / 18);
      [[1, 1, 1.1], [2.32, 0.5, 0.7], [4.25, 0.3, 0.45], [6.63, 0.18, 0.25]].forEach(([m, a, d]) => tone(t, 'sine', f * m, null, g * a, d, 0.5));
      nz(t, 0.02, 'highpass', 3000, 1, g * 0.5, 0.02, 0.2);
    },
    paper(dist) { if (!ctx) return; const t = ctx.currentTime + dist / 343; nz(t, 0.04, 'bandpass', 1500, 1, 0.12 / (1 + dist / 10), 0.04, 0.2); },
    impact(kind, v) {
      if (!ctx) return; const t = ctx.currentTime;
      if (kind === 'hull') { nz(t, 0.04, 'bandpass', 900, 1.5, 0.25 * v, 0.05); tone(t, 'sine', rand(1800, 2400), null, 0.03 * v, 0.05); }
      else if (kind === 'case') { const f = rand(3800, 6200); tone(t, 'sine', f, null, 0.07 * v, 0.09); tone(t, 'sine', f * 1.58, null, 0.04 * v, 0.06); }
      else { nz(t, 0.08, 'lowpass', 900, 1, 0.5 * v, 0.08, 0.2); nz(t, 0.03, 'bandpass', 2600, 3, 0.25 * v, 0.03); }
    },
  };
})();

