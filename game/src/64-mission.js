// =====================================================================
//  Mission 1 — "Dead Drop": recover the intel from a riad near the souk, extract to the civic plaza
// =====================================================================
const MISSION = (() => {
  const EXTRACT = { x: 64, z: 160, r: 6 }, REWARD = 500, PICK_R = 2.2;
  let stage = 'init', intel = null, beam = null, banT = 0;
  const host = document.getElementById('hud');
  const el = (css, parent = host) => { const d = document.createElement('div'); d.style.cssText = css; parent.appendChild(d); return d; };
  const obj = el('position:absolute;right:24px;top:24px;text-align:right;font-size:13px;letter-spacing:.14em;color:#e8dcc4;text-shadow:0 0 6px #000;line-height:1.5');
  const way = el('position:absolute;left:0;top:0;transform:translate(-50%,-50%);font-size:12px;letter-spacing:.12em;color:#ffd27a;text-shadow:0 0 5px #000;text-align:center;white-space:nowrap;display:none');
  const prompt = el('position:absolute;left:50%;top:56%;transform:translateX(-50%);font-size:16px;letter-spacing:.25em;color:#ffd27a;text-shadow:0 0 8px #000;display:none');
  const banner = el('position:absolute;left:50%;top:16%;transform:translateX(-50%);width:min(620px,90vw);text-align:center;color:#f0e2c4;text-shadow:0 0 12px #000;opacity:0;transition:opacity .5s;font:600 22px Rajdhani,sans-serif;letter-spacing:.22em');

  function show(title, sub, t = 5) { banner.innerHTML = `${title}<div style="font-size:13px;letter-spacing:.12em;color:#d9c49a;margin-top:8px;line-height:1.5">${sub}</div>`; banner.style.opacity = '1'; banT = t; }
  // a riad courtyard a short walk from the spawn square
  function init() {
    const sp = TOWN.spots.intel; if (!sp) { stage = 'none'; obj.textContent = ''; return; }
    const best = { x: sp.x, y: sp.y + 0.77, z: sp.z };   // on the study desk, upstairs in Dar Lamia
    if (TOWN.spots.jettyEnd) { EXTRACT.x = TOWN.spots.jettyEnd.x; EXTRACT.z = TOWN.spots.jettyEnd.z - 6; EXTRACT.r = 6; }
    // the intel: a hard case with a red tag, under a tall marker beam
    const g = new THREE.Group();
    M(new THREE.BoxGeometry(0.46, 0.13, 0.33), new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.5, metalness: 0.4 }), g, 0, 0.065, 0);
    M(new THREE.BoxGeometry(0.16, 0.04, 0.03), new THREE.MeshStandardMaterial({ color: 0x111111 }), g, 0, 0.15, 0);
    M(new THREE.BoxGeometry(0.06, 0.008, 0.09), new THREE.MeshStandardMaterial({ color: 0xc0302a, emissive: 0x601010 }), g, 0.12, 0.134, 0.06);
    g.position.set(best.x, best.y, best.z); g.rotation.y = Math.random() * 6.28;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 40, 6, 1, true).translate(0, 20, 0), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    beam.position.copy(g.position); scene.add(beam);
    intel = { ...best, g };
    stage = 'intel';
    show('MISSION 1 — DEAD DROP', 'A courier left intel upstairs in Dar Lamia, a riad at the end of Derb Lamia in the medina. Recover it and get it to the boat at the end of the jetty.', 7);
  }
  const target = () => stage === 'intel' ? { x: intel.x, y: intel.y + 0.4, z: intel.z, name: 'INTEL' } : stage === 'extract' ? { x: EXTRACT.x, y: 1.5, z: EXTRACT.z, name: 'EXTRACT' } : null;
  const _p = new V3();
  function update(dt) {
    if (!MAP.ready) return;
    if (stage === 'init') init();
    if (banT > 0 && (banT -= dt) <= 0) banner.style.opacity = '0';
    const t = target();
    obj.innerHTML = stage === 'intel' ? 'OBJECTIVE<br><b style="color:#ffd27a">▸ RECOVER THE INTEL</b> (Dar Lamia, upstairs study)'
      : stage === 'extract' ? 'OBJECTIVE<br><span style="opacity:.55">✓ Intel recovered</span><br><b style="color:#ffd27a">▸ EXTRACT — BOAT AT THE END OF THE JETTY</b>'
      : stage === 'done' ? 'MISSION 1 COMPLETE<br><span style="opacity:.6">Free roam — hostiles remain active</span>' : '';
    if (!t) { way.style.display = prompt.style.display = 'none'; return; }
    const dist = Math.hypot(t.x - P.pos.x, t.z - P.pos.z);
    if (stage === 'intel') {
      const near = dist < PICK_R && Math.abs(P.pos.y - intel.y) < 1.5 && !P.dead;
      prompt.style.display = near ? 'block' : 'none'; prompt.textContent = '[E]  TAKE INTEL';
    } else prompt.style.display = 'none';
    beam.position.set(t.x, stage === 'extract' ? 0 : intel.y, t.z);
    beam.material.opacity = 0.18 + 0.12 * Math.sin(performance.now() / 300) ** 2;
    if (stage === 'extract' && dist < EXTRACT.r && !P.dead) {
      stage = 'done'; P.stats.score += REWARD; scene.remove(beam);
      feed(`<span class="s">MISSION COMPLETE +${REWARD}</span>`); show('MISSION COMPLETE', `Intel delivered · +${REWARD}`, 6); audio.switchMode();
      return;
    }
    // waypoint: on screen over the target, or pinned to the screen edge pointing at it
    _p.set(t.x, t.y, t.z).project(camera);
    let x = _p.x, y = _p.y; const behind = _p.z > 1;
    if (behind) { x = -x; y = -y; }
    const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.88;
    if (off) { const k = 1 / Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.88, 1e-3); x *= k; y *= k; }
    way.style.display = 'block';
    way.style.left = `${(x * 0.5 + 0.5) * innerWidth}px`; way.style.top = `${(-y * 0.5 + 0.5) * innerHeight}px`;
    way.innerHTML = `◆<br>${t.name} ${Math.round(dist)} m`;
  }
  function interact() {
    if (stage !== 'intel' || P.dead) return false;
    if (Math.hypot(intel.x - P.pos.x, intel.z - P.pos.z) > PICK_R || Math.abs(P.pos.y - intel.y) > 1.5) return false;
    scene.remove(intel.g); stage = 'extract'; audio.switchMode();
    beam.material.color.set(0x7ae0a0);
    feed('<span class="s">INTEL RECOVERED</span>'); show('INTEL RECOVERED', 'Get to the boat at the end of the jetty (green marker)', 4);
    return true;
  }
  return { update, interact, get stage() { return stage; }, get intel() { return intel; } };
})();
