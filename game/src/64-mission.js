// =====================================================================
//  The campaign: five missions through Dar Essalam
// =====================================================================
// 1 Dead Drop — 2 The Captain (sniper) — 3 Wolf in Wolf's Clothing (disguise) — 4 Market Tail — 5 Exfil.
// Each mission is a list of steps: what to do, where (a waypoint), when it's done, and what E does.
// Progress is kept between sessions; J restarts the current mission.
const MISSION = (() => {
  const host = document.getElementById('hud');
  const el = (css) => { const d = document.createElement('div'); d.style.cssText = css; host.appendChild(d); return d; };
  const obj = el('position:absolute;right:24px;top:24px;text-align:right;font-size:13px;letter-spacing:.12em;color:#e8dcc4;text-shadow:0 0 6px #000;line-height:1.55;max-width:420px'); obj.id = 'objPanel';
  const way = el('position:absolute;left:0;top:0;transform:translate(-50%,-50%);font-size:12px;letter-spacing:.12em;color:#ffd27a;text-shadow:0 0 5px #000;text-align:center;white-space:nowrap;display:none');
  const prompt = el('position:absolute;left:50%;top:56%;transform:translateX(-50%);font-size:16px;letter-spacing:.25em;color:#ffd27a;text-shadow:0 0 8px #000;display:none');
  const banner = el('position:absolute;left:50%;top:16%;transform:translateX(-50%);width:min(640px,90vw);text-align:center;color:#f0e2c4;text-shadow:0 0 12px #000;opacity:0;transition:opacity .5s;font:600 22px Rajdhani,sans-serif;letter-spacing:.22em');
  let banT = 0;
  function show(title, sub, t = 5) { banner.innerHTML = `${title}<div style="font-size:13px;letter-spacing:.1em;color:#d9c49a;margin-top:8px;line-height:1.5">${sub}</div>`; banner.style.opacity = '1'; banT = t; }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 40, 6, 1, true).translate(0, 20, 0), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  beam.visible = false; scene.add(beam);
  const S = () => TOWN.spots, near = (p, r, dy = 1.6) => !!p && Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < r && Math.abs((p.y ?? 0) - P.pos.y) < dy;
  const live = (f, name) => () => f && f.alive ? { x: f.x, y: f.y + 2.1, z: f.z, name } : null;
  let figs = [], flags = {};
  const fig = (o) => { const f = NPCS.spawnFigure(o); figs.push(f); return f; };
  const clearFigs = () => { for (const f of figs) NPCS.removeFigure(f); figs = []; };
  const kit = (o) => NPCS.outfit(o);
  const intelCase = (() => {
    const g = new THREE.Group();
    M(new THREE.BoxGeometry(0.46, 0.13, 0.33), new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.5, metalness: 0.4 }), g, 0, 0.065, 0);
    M(new THREE.BoxGeometry(0.16, 0.04, 0.03), new THREE.MeshStandardMaterial({ color: 0x111111 }), g, 0, 0.15, 0);
    M(new THREE.BoxGeometry(0.06, 0.008, 0.09), new THREE.MeshStandardMaterial({ color: 0xc0302a, emissive: 0x601010 }), g, 0.12, 0.134, 0.06);
    g.visible = false; scene.add(g); return g;
  })();
  function nearestIdx(pts, p) { let b = 0, bd = Infinity; pts.forEach((q, i) => { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < bd) { bd = d; b = i; } }); return b; }
  const lanePart = (st, a, b) => { const P0 = st.pts, ia = nearestIdx(P0, a), ib = nearestIdx(P0, b), out = [], s = ia <= ib ? 1 : -1; for (let i = ia; s > 0 ? i <= ib : i >= ib; i += s) out.push([P0[i][0], P0[i][1]]); return out; };

  // ---------------- the missions ----------------
  const DAR = [
    {
      title: 'DEAD DROP', reward: 300,
      brief: 'A courier left a case of intel upstairs in Dar Lamia, a riad at the far end of Derb Lamia in the medina. Get it to your handler on the roof of Café de la Place.',
      setup() { const p = S().intel; intelCase.position.set(p.x, p.y + 0.77, p.z); intelCase.visible = true; flags.handler = fig({ kit: kit({ top: 'longsleeve', topColor: '#e8e0d0', headwear: 'boonie', hatColor: '#c8b890' }), route: [[11.6, -24.8]], y: 7.2, speed: 0 }); flags.handler.fig.lookAt = P.pos; },
      steps: [
        { text: 'Recover the intel — Dar Lamia, the study upstairs', where: () => ({ ...S().intel, y: S().intel.y + 0.8, name: 'INTEL' }),
          act: () => { if (!near(S().intel, 2.4)) return false; intelCase.visible = false; audio.pouch(); feed('<span class="s">INTEL RECOVERED</span>'); return true; }, prompt: () => near(S().intel, 2.4) ? '[E]  TAKE THE CASE' : '' },
        { text: 'Deliver it to your handler on the roof of Café de la Place', where: () => ({ x: 11.6, y: 9.4, z: -24.8, name: 'HANDLER' }), done: () => near({ x: 11.6, y: 7.2, z: -24.8 }, 2.5) },
      ],
    },
    {
      title: 'THE CAPTAIN', reward: 400,
      brief: 'Captain Haddad runs the militia from the kasbah, and inspects his men from the roof of the headquarters. The minaret of the Great Mosque looks straight over the kasbah wall — take the sniper rifle (4).',
      setup() {
        const r = [[140, -70, 3], [146, -64], [146, -54, 4], [140, -51], [137, -61, 2]];
        flags.vip = fig({ kit: kit({ top: 'jacket', topColor: '#3a3f2a', pantsColor: '#3a3f2a', headwear: 'cap', hatColor: '#9a1a1a', facialHair: 'beard', shoes: 'boots', shoeColor: '#1a1a1a' }), route: r, loop: true, y: 7.2, speed: 0.9,
          onDeath: (v, part) => { flags.vipDead = true; feed(`<span class="s">CAPTAIN HADDAD DOWN${part === 'head' ? ' — HEADSHOT' : ''}</span>`); } });
        for (const off of [[-1.6, 1.4], [1.6, 1.6]]) fig({ kit: kit({ ...PRESETS['Urban Black'], pack: 'none' }), route: r.map(([x, z, w]) => [x + off[0], z + off[1], w]), loop: true, y: 7.2, speed: 0.92, onDeath: () => feed('<span class="m">BODYGUARD DOWN</span>') });
      },
      steps: [
        { text: 'Climb the minaret of the Great Mosque', where: () => ({ ...S().minaretTop, y: S().minaretTop.y + 1, name: 'MINARET' }), done: () => P.pos.y > 20 && near(S().minaretTop, 4, 3) },
        { text: 'Captain Haddad (red cap) is on the HQ roof in the kasbah. Take the shot — hold SHIFT to steady the scope', where: () => live(flags.vip, 'TARGET')(), done: () => flags.vipDead },
        { text: 'Get down and away from the minaret before they work out where it came from', where: () => ({ ...S().minaretDoor, y: 1.5, name: 'EXIT' }), done: () => P.pos.y < 1 && Math.hypot(P.pos.x - S().minaretDoor.x, P.pos.z - S().minaretDoor.z) > 25 },
      ],
    },
    {
      title: 'WOLF IN WOLF’S CLOTHING', reward: 400,
      brief: 'The captain’s papers are still in the safe in his office. Get a militia uniform — come up behind one of them (F), then take his uniform (E). Hide your weapons (H), walk into the kasbah like you belong, and photograph what’s in the safe.',
      setup() { flags.clean = true; },
      tick() { if (DISGUISE.blown) flags.clean = false; },
      bonus: () => (flags.clean ? 200 : 0),
      steps: [
        { text: 'Get a militia uniform: take a militiaman down from behind (F), then take his uniform (E)', where: () => ({ x: S().kasbahGate.x - 12, y: 2, z: S().kasbahGate.z, name: 'KASBAH' }), done: () => P.disguise === 'militia' },
        { text: 'Weapons hidden (H), walk into the kasbah HQ. The safe is upstairs behind the commander’s desk', where: () => ({ ...S().hqSafe, y: S().hqSafe.y + 1, name: 'SAFE' }),
          act: () => { if (!near(S().hqSafe, 2.2, 1.3)) return false; audio.switchMode(); feed('<span class="s">DOCUMENTS PHOTOGRAPHED</span>'); return true; }, prompt: () => near(S().hqSafe, 2.2, 1.3) ? '[E]  OPEN THE SAFE — PHOTOGRAPH THE PAPERS' : '' },
        { text: 'Walk out through the kasbah gate', where: () => ({ x: 47, y: 2, z: -52, name: 'OUT' }), done: () => P.pos.x < 60 && near({ x: 47, y: 0, z: -52 }, 12) },
      ],
    },
    {
      title: 'MARKET TAIL', reward: 400,
      brief: 'The papers name a courier who carries the militia’s messages through the souk. He waits at the mouth of the Souk el Kebir in a green cap. Follow him to whoever he meets — not too close, don’t lose him — then take the package off his contact.',
      setup() {
        const T = TOWN.lanes;
        const route = [...lanePart(T.soukKebir, [0, -24], [-2, -70]), ...lanePart(T.derbChouari, [-2, -70], [-36, -73]), [-40, -82], [-50, -88], ...lanePart(T.derbDebbagh, [-62, -92], [-100, -103]), [-101.5, -101]];
        flags.route = route;
        flags.courier = fig({ kit: kit({ top: 'jacket', topColor: '#6a5a3a', headwear: 'cap', hatColor: '#2a8a3a', pantsColor: '#2d3550' }), route, speed: 1.2 });
        flags.courier.fig.paused = true;
        flags.contact = fig({ kit: kit({ top: 'jacket', topColor: '#22252a', pantsColor: '#22252a', eyewear: 'sunglasses', headwear: 'none', facialHair: 'stubble' }), route: [[-103.6, -99.5]], speed: 0, onDeath: () => { flags.contactDead = true; feed('<span class="s">CONTACT DOWN</span>'); } });
        flags.lostT = 0; flags.closeT = 0;
      },
      steps: [
        { text: 'Find the courier at the mouth of the Souk el Kebir (green cap)', where: () => live(flags.courier, 'COURIER')(), done: () => near(flags.courier, 20, 3) },
        { text: 'Tail him: keep him within 40 m, never closer than 5 m, weapons hidden', where: () => live(flags.courier, 'COURIER')(), enter: () => { flags.courier.fig.paused = false; flags.lostT = flags.closeT = 0; },
          done: () => flags.courier.arrived,
          tick: (dt) => {
            const d = Math.hypot(flags.courier.x - P.pos.x, flags.courier.z - P.pos.z);
            flags.lostT = d > 42 ? flags.lostT + dt : 0; flags.closeT = d < 5 || (!P.holstered && d < 12) ? flags.closeT + dt : 0;
            if (flags.lostT > 8) return 'You lost him — he went back to where he started.';
            if (flags.closeT > 2.5) return 'He made you — he went back to where he started. Keep your distance, weapons hidden (H).';
            return null;
          } },
        { text: 'That’s his contact by the tannery steps. Take him down', where: () => live(flags.contact, 'CONTACT')(), done: () => flags.contactDead, enter: () => { flags.contact.fig.lookAt = flags.courier; } },
        { text: 'Take the package off the body (E)', where: () => ({ x: flags.contact.x, y: flags.contact.y + 1, z: flags.contact.z, name: 'PACKAGE' }),
          act: () => { if (!near(flags.contact, 2.4)) return false; audio.pouch(); feed('<span class="s">PACKAGE TAKEN</span>'); return true; }, prompt: () => near(flags.contact, 2.4) ? '[E]  TAKE THE PACKAGE' : '' },
      ],
      reset(step) { if (step === 1) { const c = flags.courier; c.x = flags.route[0][0]; c.z = flags.route[0][1]; c.ri = 0; c.arrived = false; c.idle = 0; c.fig.paused = true; return 0; } return step; },
    },
    {
      title: 'EXFIL', reward: 600,
      brief: 'They know who you are now, and every militiaman in town is coming. A boat is waiting at the end of the jetty in the harbour — get to it.',
      setup() { BOTS.setPressure(3); fig({ kit: kit({ top: 'tshirt', topColor: '#2a5aa0', headwear: 'beanie', hatColor: '#c0302a' }), route: [[64, 163.5]], speed: 0 }); },
      teardown() { BOTS.setPressure(0); },
      steps: [{ text: 'Get to the boat at the end of the jetty', where: () => ({ x: 64, y: 2, z: 160, name: 'BOAT' }), done: () => near({ x: 64, y: 0, z: 161 }, 5, 3) }],
    },
  ];

  // ---------------- state ----------------
  const MISSIONS = MAP.id === 'seoul' ? seoulMissions({ fig, live, near, kit, S, flags: () => flags, show }) : DAR;
  const KEY = `${MAP.id}.campaign`;
  let mi = (() => { try { return +(localStorage.getItem(KEY) || 0); } catch { return 0; } })(), si = 0, state = 'init', wait = 0;
  const cur = () => MISSIONS[mi];
  function start(i) {
    if (state === 'run' && cur()?.teardown) cur().teardown();
    clearFigs(); flags = {}; intelCase.visible = false;
    mi = i; si = 0;
    try { localStorage.setItem(KEY, String(mi)); } catch { }
    if (!cur()) { state = 'free'; return; }
    state = 'run'; cur().setup?.(); cur().steps[0].enter?.();
    show(`MISSION ${mi + 1} — ${cur().title}`, cur().brief, 10);
  }
  function complete() {
    const m = cur(), bonus = m.bonus ? m.bonus() : 0;
    P.stats.score += m.reward + bonus;
    feed(`<span class="s">MISSION COMPLETE +${m.reward}${bonus ? ` · CLEAN +${bonus}` : ''}</span>`);
    show(`MISSION ${mi + 1} COMPLETE`, mi + 1 < MISSIONS.length ? `+${m.reward + bonus} · next: ${MISSIONS[mi + 1].title}` : `+${m.reward + bonus} · You made it out. The town is yours to roam.`, 6);
    audio.switchMode();
    m.teardown?.();
    state = 'between'; wait = 7;
  }
  function advance() { si++; if (si >= cur().steps.length) { complete(); return; } cur().steps[si].enter?.(); audio.pouch(); }
  const SCOPED = () => WD().scope && P.adsT > 0.8 && P.fpT > 0.8;
  const _p = new V3();
  function update(dt) {
    if (!MAP.ready) return;
    if (state === 'init') start(Math.min(mi, MISSIONS.length));
    if (banT > 0 && (banT -= dt) <= 0) banner.style.opacity = '0';
    if (state === 'between') { wait -= dt; if (wait <= 0) start(mi + 1); }
    const m = cur();
    if (state !== 'run' || !m) {
      obj.innerHTML = state === 'free' ? 'CAMPAIGN COMPLETE<br><span style="opacity:.6">Free roam · J replays the last mission</span>' : '';
      way.style.display = prompt.style.display = 'none'; beam.visible = false; return;
    }
    m.tick?.(dt);
    const st = m.steps[si];
    const fail = st.tick ? st.tick(dt) : null;
    if (fail) { show('NOT LIKE THAT', fail, 4); si = m.reset ? m.reset(si) : si; m.steps[si].enter?.(); }
    else if (st.done && st.done()) { advance(); return; }
    obj.innerHTML = `MISSION ${mi + 1} · ${m.title}<br>` + m.steps.map((q, k) => (k < si ? `<span style="opacity:.45">✓ ${q.text}</span>` : k === si ? `<b style="color:#ffd27a">▸ ${q.text}</b>` : '')).filter(Boolean).join('<br>');
    const pr = st.prompt ? st.prompt() : '';
    setPrompt(prompt, pr);
    const t = st.where ? st.where() : null;
    if (!t) { way.style.display = 'none'; beam.visible = false; return; }
    beam.visible = true; beam.position.set(t.x, (t.y ?? 1) - 2, t.z); beam.material.opacity = 0.16 + 0.12 * Math.sin(performance.now() / 300) ** 2;
    const dist = Math.hypot(t.x - P.pos.x, t.z - P.pos.z);
    _p.set(t.x, t.y ?? 1.5, t.z).project(camera);
    let x = _p.x, y = _p.y; const behind = _p.z > 1;
    if (behind) { x = -x; y = -y; }
    if (behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.88) { const k = 1 / Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.88, 1e-3); x *= k; y *= k; }
    way.style.display = SCOPED() ? 'none' : 'block';
    way.style.left = `${(x * 0.5 + 0.5) * innerWidth}px`; way.style.top = `${(-y * 0.5 + 0.5) * innerHeight}px`;
    way.innerHTML = `◆<br>${t.name} ${Math.round(dist)} m`;
  }
  function interact() {
    if (state !== 'run' || P.dead) return false;
    const st = cur().steps[si];
    if (st.act && st.act()) { advance(); return true; }
    return false;
  }
  function restart() { start(state === 'free' ? MISSIONS.length - 1 : mi); feed('<span class="m">MISSION RESTARTED</span>'); }
  return {
    update, interact, restart, start, get stage() { return state === 'run' ? `${mi}:${si}` : state; }, get index() { return mi; }, get count() { return MISSIONS.length; },
    get target() { if (state !== 'run') return null; const st = cur().steps[si]; return st.where ? st.where() : null; },
  };
})();

// ---------------- Case 02: Neon Seoul ----------------
function seoulMissions({ fig, live, near, kit, S, flags }) {
  const F = flags;
  return [{
    title: 'THE BROKER’S DRIVE', reward: 700,
    brief: 'A list of our people in the city is on a USB drive, and a broker is selling it tonight to the gang that runs these streets. Our informant is waiting in the 24-hour store on Yanghwa-ro. Find out who has the drive, take it off him, and get underground.',
    setup() {
      const f = F();
      f.informant = fig({ kit: kit({ top: 'hoodie', topColor: '#2a2a32', headwear: 'cap', hatColor: '#1a1a1a', pantsColor: '#2d3550' }), route: [[11.5, -13.2]], speed: 0 });
      f.informant.fig.lookAt = P.pos;
      // the lieutenant eats at the third tent down the food alley with two of his men
      const lx = -0.6, lz = -48.5;
      f.lt = fig({ kit: kit({ top: 'jacket', topColor: '#141414', pantsColor: '#141414', eyewear: 'sunglasses', hair: 'short', facialHair: 'none', shoes: 'boots', shoeColor: '#0a0a0a' }), route: [[lx, lz]], speed: 0, onDeath: () => { F().ltDead = true; feed('<span class="s">LIEUTENANT DOWN</span>'); NPCS.alarm(lx, lz); BOTS.setPressure(2); } });
      for (const [dx, dz] of [[1.6, -1.2], [1.6, 1.4]]) fig({ kit: kit({ ...PRESETS['Urban Black'], pack: 'none', vest: 'none', headwear: 'none' }), route: [[lx + dx, lz + dz], [lx + dx + 3, lz + dz], [lx + dx, lz + dz]], loop: true, speed: 0.7, onDeath: () => feed('<span class="m">BODYGUARD DOWN</span>') });
    },
    steps: [
      { text: 'Meet the informant in the 24-hour store (빛24) on the corner of Yanghwa-ro and the food alley', where: () => live(F().informant, 'INFORMANT')(),
        act: () => { if (!near(F().informant, 2.4)) return false; audio.pouch(); feed('<span class="s">"The lieutenant. Third tent down the food alley. Two men with him."</span>'); return true; }, prompt: () => near(F().informant, 2.4) ? '[E]  TALK TO THE INFORMANT' : '' },
      { text: 'The gang’s lieutenant (sunglasses) is eating at the third pojangmacha tent in the food alley. Take him down', where: () => live(F().lt, 'LIEUTENANT')(), done: () => F().ltDead },
      { text: 'Take the drive off his body (E)', where: () => ({ x: F().lt.x, y: F().lt.y + 1, z: F().lt.z, name: 'DRIVE' }),
        act: () => { if (!near(F().lt, 2.4)) return false; audio.pouch(); feed('<span class="s">DRIVE TAKEN</span>'); BOTS.setPressure(3); return true; }, prompt: () => near(F().lt, 2.4) ? '[E]  TAKE THE DRIVE' : '' },
      { text: 'The whole gang is out looking for you. Get to the subway entrance at the station plaza', where: () => ({ ...S().subway, y: 2, name: 'SUBWAY' }), done: () => SUBWAY.under || near({ ...S().subway, y: 0 }, 3, 3) },
    ],
    teardown() { BOTS.setPressure(0); },
  }];
}
