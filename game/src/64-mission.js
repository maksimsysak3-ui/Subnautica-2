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
  // a conversation as a cutscene: over one shoulder, then the other, a line each
  const behind = (f) => { const fx = -Math.sin(f.yaw), fz = -Math.cos(f.yaw), dx = P.pos.x - f.x, dz = P.pos.z - f.z, L = Math.hypot(dx, dz) || 1; return (fx * dx + fz * dz) / L < -0.15; };
  // the other person acts it out: turns to you, talks with their hands, listens and nods while you speak, and a
  // stage direction in the line ('MOTH[give]: …') puts them in that act (give, point, aim, surrender, call, drink…)
  function talkShots(a, b, lines) {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, sx = -uz, sz = ux, ya = (a.y ?? P.pos.y) + 1.62, yb = (b.y ?? 0) + 1.62;
    const actor = b && b.m && b.m.ch ? b : null, face = () => Math.atan2(-(P.pos.x - b.x), -(P.pos.z - b.z));
    return lines.map((raw, k) => {
      const dir = raw.match(/^([^:\[]+)\[(\w+)\]: /), ln = dir ? dir[1] + ': ' + raw.slice(dir[0].length) : raw, mine = ln.startsWith('YOU');
      // over the listener's shoulder, wide enough that the speaker's face and hands are clear of them
      const [cx, cz, lx, lz, cy, ly] = mine ? [b.x + ux * 1.7 + sx * 1.15, b.z + uz * 1.7 + sz * 1.15, a.x, a.z, yb + 0.12, ya - 0.2] : [a.x - ux * 1.7 + sx * 1.15, a.z - uz * 1.7 + sz * 1.15, b.x, b.z, ya + 0.12, yb - 0.2];
      const words = ln.split(' ').length, act = dir ? dir[2] : mine ? 'listen' : 'chat';
      return { from: [cx, cy, cz], to: [cx + sx * 0.25, cy, cz + sz * 0.25], look: [lx, ly - 0.05, lz], dur: Math.max(2.6, words * 0.33), say: ln, fov: 46,
        do: actor && actor.alive ? () => NPCS.actOn(actor, act, 999, face()) : null, end: k === lines.length - 1 && actor ? () => NPCS.actOff(actor) : null };
    });
  }
  // a shot with something happening in it: do() as it starts
  const shot = (from, to, look, say, dur, o = {}) => ({ from, to, look, look2: o.look2, say, dur: dur ?? Math.max(3, (say || '').split(' ').length * 0.34), fov: o.fov ?? 48, do: o.do, end: o.end });
  const act = (f, a, T, face) => f && f.alive && NPCS.actOn(f, a, T, face), unact = (f) => f && NPCS.actOff(f);
  // send someone somewhere (a route of [x, z, wait]), or have them stay at your side
  function walkTo(f, pts, speed = 1.3) { if (!f) return; unact(f); f.route = pts; f.ri = 0; f.arrived = false; f.idle = 0; f.speed = speed; f.fig.paused = false; f.fig.loop = false; }
  // following you: along the path you actually walked (a trail of crumbs), so they come round corners the way you did
  function follow(f, dt) {
    if (!f || !f.alive) return;
    const tr = f._trail || (f._trail = [[f.x, f.z]]), last = tr[tr.length - 1];
    if (Math.hypot(P.pos.x - last[0], P.pos.z - last[1]) > 1.5) { tr.push([P.pos.x, P.pos.z]); if (tr.length > 80) tr.shift(); }
    const d = Math.hypot(P.pos.x - f.x, P.pos.z - f.z);
    if (d > 2.6) {
      let k = 0, bd = 1e9; tr.forEach((c, i) => { const q = Math.hypot(c[0] - f.x, c[1] - f.z); if (q < bd) { bd = q; k = i; } });
      f.route = [...tr.slice(k + 1), [P.pos.x, P.pos.z]]; f.ri = 0; f.arrived = false; f.idle = 0; f.speed = d > 9 ? 3.4 : d > 5 ? 2.4 : 1.4;
    } else { f.idle = 0.5; }
  }
  // armed men at posts for this mission (they're cleared when it ends); how many are still standing
  const squad = (pts, o) => BOTS.squad(pts, o), standing = (gs) => gs.filter((g) => !g.killed).length;
  // a slow aerial: from a point high over the map down toward a target, with the handler's lines spread across it
  function flyover(path, lines, dur = 4.2) { return path.map((p, k) => ({ from: p.from, to: p.to, look: p.look, look2: p.look2, dur: p.dur ?? dur, say: lines[k] || '', fov: p.fov || 55 })); }
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

  // the handler's opening for each Dar mission: where it happens, from the air
  const HV = (t) => `HANDLER: ${t}`;
  DAR[0].intro = () => flyover([
    { from: [70, 80, 280], to: [30, 60, 170], look: [0, 0, -40] },
    { from: [40, 28, 40], to: [18, 16, 4], look: [9.5, 8, -27] },
    { from: [-2, 4, 26], to: [-5, 2.6, 18], look: [S().intel.x, S().intel.y + 2, S().intel.z], dur: 5 },
  ], [HV('Dar Essalam. The militia took the kasbah three weeks ago — and the town with it.'), HV('I’m on the roof of Café de la Place. Our courier never made it out of the medina.'), HV('He left the case upstairs in Dar Lamia, at the end of Derb Lamia. Bring it to me. Keep your head down.')]);
  DAR[1].intro = () => flyover([
    { from: [40, 50, 10], to: [80, 42, -30], look: [108, 10, -85] },
    { from: [S().minaretTop.x + 14, S().minaretTop.y + 6, S().minaretTop.z + 14], to: [S().minaretTop.x + 6, S().minaretTop.y + 3, S().minaretTop.z + 6], look: [S().minaretTop.x, S().minaretTop.y, S().minaretTop.z] },
  ], [HV('Captain Haddad. He walks the roof of the kasbah HQ every evening to look at his men.'), HV('The minaret of the Great Mosque sees over the kasbah wall. One shot — then get down before they work out where it came from.')], 5);
  DAR[2].intro = () => flyover([
    { from: [S().kasbahGate.x - 40, 20, S().kasbahGate.z + 30], to: [S().kasbahGate.x - 18, 6, S().kasbahGate.z + 8], look: [S().kasbahGate.x, 4, S().kasbahGate.z] },
    { from: [S().kasbahGate.x - 8, 2.2, S().kasbahGate.z + 14], to: [S().kasbahGate.x - 4, 2.0, S().kasbahGate.z + 9], look: [S().kasbahGate.x, 2.5, S().kasbahGate.z] },
  ], [HV('The papers we want are in the kasbah HQ. Nobody walks in there — unless he’s one of them.'), HV('Take a militiaman quietly. Wear his uniform. Walk, don’t run, and keep your rifle down.')], 5);
  DAR[3].intro = () => flyover([{ from: [10, 30, 30], to: [0, 14, -10], look: [0, 2, -60] }, { from: [-6, 3, -40], to: [-3, 2.4, -48], look: [0, 1.8, -62] }],
    [HV('The papers name a courier — green cap — who carries the militia’s messages through the souk.'), HV('He’ll meet someone. Follow him. Not too close, and don’t let him see your face twice.')], 5);
  DAR[4].intro = () => flyover([{ from: [0, 30, 60], to: [30, 18, 110], look: [64, 2, 160] }, { from: [50, 4, 140], to: [58, 3, 150], look: [64, 2, 163] }],
    [HV('They know your face now. Every militiaman in town is coming for you.'), HV('There’s a boat at the end of the jetty. Run.')], 4.5);

  // ---------------- state ----------------
  const CTX = { fig, live, near, kit, S, flags: () => flags, show, talkShots, flyover, behind, shot, act, unact, walkTo, follow, squad, standing, lanePart, HV };
  const MISSIONS = expandCampaign(MAP.id, MAP.id === 'seoul' ? seoulMissions(CTX) : MAP.id === 'manor' ? manorMissions(CTX) : MAP.id === 'bahamas' ? bahamasMissions(CTX) : DAR, CTX);
  const KEY = `${MAP.id}.campaign`;
  let mi = (() => { try { return +(localStorage.getItem(KEY) || 0); } catch { return 0; } })(), si = 0, state = 'init', wait = 0;
  const cur = () => MISSIONS[mi];
  function start(i, quiet = false) {
    if (state === 'run' && cur()?.teardown) cur().teardown();
    clearFigs(); BOTS.clearSquads(); flags = {}; intelCase.visible = false;
    mi = i; si = 0;
    try { localStorage.setItem(KEY, String(mi)); } catch { }
    if (!cur()) { state = 'free'; return; }
    state = 'run'; cur().setup?.(); enterStep();
    const banner = () => show(`MISSION ${mi + 1} — ${cur().title}`, cur().brief, 10);
    if (cur().intro && !quiet) CINEMA.play(cur().intro(), banner); else banner();
  }
  function complete() {
    const m = cur(), bonus = m.bonus ? m.bonus() : 0;
    P.stats.score += m.reward + bonus;
    feed(`<span class="s">MISSION COMPLETE +${m.reward}${bonus ? ` · CLEAN +${bonus}` : ''}</span>`);
    show(`MISSION ${mi + 1} COMPLETE`, mi + 1 < MISSIONS.length ? `+${m.reward + bonus} · next: ${MISSIONS[mi + 1].title}` : `+${m.reward + bonus} · You made it out. The town is yours to roam.`, 6);
    audio.switchMode();
    m.teardown?.(); BOTS.clearSquads();
    state = 'between'; wait = 7;
    if (m.outro) { state = 'outro'; CINEMA.play(m.outro(), () => { state = 'between'; wait = 4; }); }
  }
  // per-step state: a clock running down, being seen, holding E, a choice waiting
  let timeLeft = 0, seenT = 0, held = 0;
  function enterStep() {
    const m = cur(); while (si < m.steps.length && m.steps[si].skip && m.steps[si].skip()) si++;
    if (si >= m.steps.length) { complete(); return; }
    const st = m.steps[si]; timeLeft = st.time || 0; seenT = 0; held = 0; st.enter?.();
  }
  function advance() { const prev = cur().steps[si]; si++; const go = () => { enterStep(); if (state === 'run') audio.pouch(); }; if (prev.cut) CINEMA.play(prev.cut(), go); else go(); }
  // a step's checkpoint: back to the latest step marked cp (where you're put back) — or this one
  function checkpoint() { const m = cur(); let k = si; while (k > 0 && !m.steps[k].cp) k--; return m.steps[k].cp ? k : si; }
  function fail(msg) {
    const m = cur(); show('NOT LIKE THAT', msg, 4);
    if (m.reset) si = m.reset(si); else { si = checkpoint(); const cp = m.steps[si].cp; if (cp) { const q = typeof cp === 'function' ? cp() : cp; P.pos.set(q.x, q.y ?? COL.ground(q.x, q.z, 3), q.z); P.vel.set(0, 0, 0); STREAM.prime(P.pos); } }
    enterStep();
  }
  const SCOPED = () => WD().scope && P.adsT > 0.8 && P.fpT > 0.8;
  const _p = new V3();
  function update(dt) {
    if (!MAP.ready) return;
    if (state === 'init') start(Math.min(mi, MISSIONS.length));
    if (banT > 0 && (banT -= dt) <= 0) banner.style.opacity = '0';
    if (state === 'between') { wait -= dt; if (wait <= 0) start(mi + 1); }
    const m = cur();
    if (CINEMA.active) { way.style.display = 'none'; setPrompt(prompt, ''); beam.visible = false; return; }
    if (state !== 'run' || !m) {
      obj.innerHTML = state === 'free' ? 'CAMPAIGN COMPLETE<br><span style="opacity:.6">Free roam · J replays the last mission</span>' : '';
      way.style.display = prompt.style.display = 'none'; beam.visible = false; return;
    }
    m.tick?.(dt);
    const st = m.steps[si];
    let why = st.tick ? st.tick(dt) : null;
    if (!why && st.time && (timeLeft -= dt) <= 0) why = st.late || 'Out of time.';
    if (!why && st.stealth) { seenT = BOTS.spotted ? seenT + dt : Math.max(0, seenT - dt); if (seenT > 1.3) why = st.seen || 'They saw you. Stay out of sight — watch the triangles over their heads.'; }
    let holdPr = '';
    if (!why && st.hold) {
      const H = st.hold, at = H.at(), close = near(at, H.r ?? 2.2, 2);
      held = keys.KeyE && close ? held + dt : Math.max(0, held - dt * 0.5);
      if (held >= H.secs) { advance(); return; }
      holdPr = close ? `[HOLD E]  ${H.label}  ${Math.round(held / H.secs * 100)}%` : '';
    }
    if (why) { fail(why); return; }
    else if (st.done && st.done()) { advance(); return; }
    const clock = st.time ? ` <span style="color:${timeLeft < 15 ? '#ff7a5a' : '#e8dcc4'}">⏱ ${Math.floor(timeLeft / 60)}:${String(Math.floor(timeLeft % 60)).padStart(2, '0')}</span>` : '';
    obj.innerHTML = `MISSION ${mi + 1} · ${m.title}<br>` + m.steps.map((q, k) => (k < si ? (q.skip && q.skip() ? '' : `<span style="opacity:.45">✓ ${tx(q)}</span>`) : k === si ? `<b style="color:#ffd27a">▸ ${tx(q)}</b>${clock}${st.stealth ? ' <span style="color:#9ad0ff">· UNSEEN</span>' : ''}` : '')).filter(Boolean).join('<br>');
    const pr = st.choice ? (st.choice.when ? st.choice.when() : true) ? `[Y]  ${st.choice.a}      [K]  ${st.choice.b}` : '' : holdPr || (st.prompt ? st.prompt() : '');
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
  const tx = (q) => (typeof q.text === 'function' ? q.text() : q.text);
  function choose(k) {
    if (state !== 'run' || CINEMA.active) return false;
    const st = cur().steps[si]; if (!st.choice || (st.choice.when && !st.choice.when())) return false;
    flags.choice = k; st.choice.pick?.(k); advance(); return true;
  }
  function restart() { start(state === 'free' ? MISSIONS.length - 1 : mi); feed('<span class="m">MISSION RESTARTED</span>'); }
  return {
    get missions() { return MISSIONS; }, get flags() { return flags; },
    get ctx() { return CTX; }, _skip: () => advance(),   // test harness only get busy() { return state === 'run' && !!cur(); },
    update, interact, restart, start, choose,
    // killed: back to the last checkpoint of this mission if it has one, else from the top
    retry: () => { if (state === 'run' && si > 0 && cur().steps.slice(0, si + 1).some((q) => q.cp)) { const k = checkpoint(); const m = cur(); si = k; const cp = m.steps[k].cp; if (cp) { const q = typeof cp === 'function' ? cp() : cp; P.pos.set(q.x, q.y ?? COL.ground(q.x, q.z, 3), q.z); } enterStep(); feed('<span class="m">BACK TO THE LAST CHECKPOINT</span>'); return; } start(Math.min(mi, MISSIONS.length - 1), true); feed('<span class="m">MISSION RESTARTED</span>'); }, get stage() { return state === 'run' ? `${mi}:${si}` : state; }, get index() { return mi; }, get count() { return MISSIONS.length; },
    get target() { if (state !== 'run') return null; const st = cur().steps[si]; return st.where ? st.where() : null; },
  };
})();

// ---------------- Case 02: Neon Seoul ----------------
function seoulMissions({ fig, live, near, kit, S, flags, talkShots, flyover, behind }) {
  const F = flags, HV = (t) => `HANDLER: ${t}`;
  const nearestDoor = (room) => { let b = null, bd = 1e9; for (const d of TOWN.doors) if (d.room === room) { const q = Math.hypot(d.x - P.pos.x, d.z - P.pos.z); if (q < bd) { bd = q; b = d; } } return b; };
  return [{
    intro: () => flyover([{ from: [-140, 70, 80], to: [-20, 34, 40], look: [60, 4, 0] }, { from: [30, 9, 22], to: [44, 5, 14], look: [10, 3, -14] }, { from: [8, 2.4, -6], to: [9, 2.2, -9], look: [11.5, 1.7, -13.2] }],
      [HV('Seoul. Mapo-gu, a wet Tuesday night.'), HV('A list of our people is on a USB drive — and a broker is selling it to the Black Dragons tonight.'), HV('Our informant is in the 24-hour store on the corner. Start there.')]),
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
        act: () => { if (!near(F().informant, 2.4)) return false; audio.pouch(); return true; },
        cut: () => talkShots(P.pos, F().informant, ['INFORMANT: You’re late. The broker already sold it.', 'YOU: To who?', 'INFORMANT: A Dragon lieutenant. Sunglasses. He’s eating at the third tent down the food alley — two of his men with him.', 'INFORMANT: The drive’s in his jacket. Don’t do it in front of the whole street.']), prompt: () => near(F().informant, 2.4) ? '[E]  TALK TO THE INFORMANT' : '' },
      { text: 'The gang’s lieutenant (sunglasses) is eating at the third pojangmacha tent in the food alley. Take him down', where: () => live(F().lt, 'LIEUTENANT')(), done: () => F().ltDead },
      { text: 'Take the drive off his body (E)', where: () => ({ x: F().lt.x, y: F().lt.y + 1, z: F().lt.z, name: 'DRIVE' }),
        act: () => { if (!near(F().lt, 2.4)) return false; audio.pouch(); feed('<span class="s">DRIVE TAKEN</span>'); BOTS.setPressure(3); return true; }, prompt: () => near(F().lt, 2.4) ? '[E]  TAKE THE DRIVE' : '' },
      { text: 'The whole gang is out looking for you. Get to the subway entrance at the station plaza', where: () => ({ ...S().subway, y: 2, name: 'SUBWAY' }), done: () => SUBWAY.under || near({ ...S().subway, y: 0 }, 3, 3) },
    ],
    teardown() { BOTS.setPressure(0); },
  }, {
    title: 'NORAEBANG', reward: 600,
    brief: 'The drive is encrypted. A hacker who calls himself Moth can open it — but he doesn’t do meetings. He does karaoke. Walk into any 노래방 and he’ll find you.',
    intro: () => flyover([{ from: [70, 16, -10], to: [70, 9, -30], look: [70, 5, -80] }, { from: [62, 3, -46], to: [66, 2.6, -52], look: [74, 4, -60] }],
      [HV('The drive’s locked. There’s a hacker who calls himself Moth.'), HV('He doesn’t take meetings. Walk into any karaoke bar — he’ll find you.')], 4.5),
    setup() { const R2 = ROOMS.karaoke; F().moth = fig({ kit: kit({ top: 'hoodie', topColor: '#5a5a62', headwear: 'beanie', hatColor: '#1a1a1a', eyewear: 'none', pantsColor: '#2a2a30' }), route: [[R2.x + 1.2, R2.z - 3.6]], speed: 0, yaw: Math.PI }); F().moth.fig.lookAt = P.pos; },
    steps: [
      { text: 'Go into any karaoke bar (노래방) — Moth will find you', where: () => { const d = nearestDoor('karaoke'); return d && !DOORS.inside ? { x: d.x, y: 3, z: d.z, name: '노래방' } : null; }, done: () => DOORS.room === 'karaoke' },
      { text: 'Talk to Moth in the open room (E)', where: () => live(F().moth, 'MOTH')(), act: () => near(F().moth, 2.6), prompt: () => near(F().moth, 2.6) ? '[E]  TALK TO MOTH' : '',
        cut: () => talkShots(P.pos, F().moth, ['MOTH: You sing?', 'YOU: Not tonight.', 'MOTH: Shame. Give it here... huh. Two keys. One I can break in an hour. The other is on a phone.', 'MOTH: The Blue Snakes’ captain in Gangnam carries it everywhere. Bring me that phone — any PC bang. I’ll be online.']) },
    ],
  }, {
    title: 'SNAKE’S PHONE', reward: 800,
    brief: 'Gangnam belongs to the Blue Snakes. Their captain holds court by the big screens at the crossing, the phone with the second key in his pocket. Lift it — or take it. Then upload it from any PC bang.',
    intro: () => flyover([{ from: [140, 45, -60], to: [175, 26, -20], look: [205, 18, 25] }, { from: [196, 3, 44], to: [200, 2.6, 40], look: [205, 1.8, 26] }],
      [HV('Gangnam is Blue Snake ground. Their captain holds court under the big screens.'), HV('Pick his pocket from behind if you can. If it goes loud, the whole crew comes for you.')], 4.5),
    setup() {
      const cx = 205, cz = 26;
      F().cap = fig({ kit: kit({ top: 'hoodie', topColor: '#1e3a6a', headwear: 'cap', hatColor: '#e8e8e8', pantsColor: '#1a1f2e', shoes: 'sneakers', shoeColor: '#e8e8e8' }), route: [[cx, cz], [cx + 6, cz + 2, 6], [cx + 2, cz + 6, 5], [cx - 4, cz + 2, 6]], loop: true, speed: 0.6, onDeath: () => { F().capDead = true; NPCS.alarm(cx, cz); BOTS.setPressure(2); feed('<span class="m">THE CAPTAIN IS DOWN — THE SNAKES ARE COMING</span>'); } });
      for (const [dx, dz] of [[2, -2], [-2, 3]]) fig({ kit: kit({ top: 'jacket', topColor: '#2a5a9a', headwear: 'beanie', hatColor: '#141a2a', pantsColor: '#2a5a9a' }), route: [[cx + dx, cz + dz], [cx + dx + 4, cz + dz, 4], [cx + dx, cz + dz + 4, 4]], loop: true, speed: 0.6 });
    },
    steps: [
      { text: 'Find the Blue Snake captain (white cap) at the Gangnam crossing', where: () => live(F().cap, 'CAPTAIN')(), done: () => near(F().cap, 22, 3) },
      { text: 'Take his phone: pick his pocket from behind (E) — or take it off him', where: () => ({ x: F().cap.x, y: F().cap.y + 2.1, z: F().cap.z, name: 'PHONE' }),
        act: () => { const c = F().cap; if (c.alive && near(c, 1.9) && behind(c)) { feed('<span class="s">PHONE LIFTED — HE DIDN’T FEEL A THING</span>'); audio.pouch(); return true; } if (!c.alive && near(c, 2.4)) { feed('<span class="s">PHONE TAKEN</span>'); audio.pouch(); return true; } return false; },
        prompt: () => { const c = F().cap; return c.alive && near(c, 1.9) ? (behind(c) ? '[E]  LIFT THE PHONE' : 'GET BEHIND HIM') : !c.alive && near(c, 2.4) ? '[E]  TAKE THE PHONE' : ''; } },
      { text: 'Upload it from any PC bang (PC방): sit at a free PC (E)', where: () => { const d = nearestDoor('pc'); return d && !DOORS.inside ? { x: d.x, y: 3, z: d.z, name: 'PC방' } : null; },
        act: () => DOORS.room === 'pc', prompt: () => DOORS.room === 'pc' ? '[E]  UPLOAD THE PHONE' : '',
        cut: () => { const R2 = ROOMS.pc; return [
          { from: [R2.x - 4.6, 1.5, R2.z - 3.2], to: [R2.x - 4.4, 1.35, R2.z - 3.6], look: [R2.x - 4.8, 1.1, R2.z - 4.9], dur: 4, say: 'MOTH: Got it. Both keys. Opening it now…', fov: 40 },
          { from: [R2.x + 3, 2.4, R2.z + 3], to: [R2.x + 2, 2.2, R2.z + 1], look: [R2.x - 3, 1, R2.z - 4], dur: 5, say: 'MOTH: …oh. The list wasn’t sold to the Dragons. Their boss wrote it. He’s selling your people to both crews.', fov: 48 },
          { from: [R2.x - 1, 1.7, R2.z + 4.5], to: [R2.x - 1.2, 1.7, R2.z + 4.2], look: [R2.x - 1, 1.5, R2.z], dur: 4, say: 'HANDLER: Then the night just got longer.', fov: 46 } ]; } },
    ],
    teardown() { BOTS.setPressure(0); },
  }, {
    title: 'LAST TRAIN', reward: 1000,
    brief: 'Both crews know your face. The Dragons hold Yanghwa-ro, the Snakes are coming over from Gangnam. Get underground, ride Line 2 to Yeouinaru, and meet the boat on the river.',
    intro: () => flyover([{ from: [30, 12, 30], to: [60, 6, 20], look: [100, 3, 0] }, { from: [60, 30, 120], to: [60, 16, 160], look: [60, 2, 230] }],
      [HV('Both crews know your face. The Dragons are on Yanghwa-ro. The Snakes are coming over from Gangnam.'), HV('Line 2 to Yeouinaru. There’s a boat on the river. Don’t miss it.')], 5),
    setup() { BOTS.setPressure(3); },
    teardown() { BOTS.setPressure(0); },
    steps: [
      { text: 'Get underground: any Line 2 entrance', where: () => { let b = null, bd = 1e9; for (const s2 of LINE2) { const d = Math.hypot(s2.x - P.pos.x, s2.z - P.pos.z); if (d < bd) { bd = d; b = s2; } } return b && !SUBWAY.under ? { x: b.x, y: 4, z: b.z, name: 'LINE 2' } : null; }, done: () => SUBWAY.under },
      { text: 'Ride Line 2 to Yeouinaru (여의나루), then up to the street', where: () => (!SUBWAY.under ? { x: LINE2[4].x, y: 4, z: LINE2[4].z, name: '여의나루' } : null), done: () => !SUBWAY.under && Math.hypot(P.pos.x - LINE2[4].x, P.pos.z - LINE2[4].z) < 16 },
      { text: 'Meet the boat at the river, below the riverside store', where: () => ({ x: 110, y: 2, z: 228, name: 'BOAT' }), done: () => Math.hypot(P.pos.x - 110, P.pos.z - 228) < 7 },
    ],
    outro: () => [
      { from: [110, 3, 222], to: [112, 2.2, 236], look: [110, 0, 260], dur: 4, say: 'HANDLER: I see you. Get in.', fov: 50 },
      { from: [90, 1.2, 270], to: [60, 1.4, 300], look: [0, 30, 0], look2: [-40, 25, -20], dur: 6, say: 'HANDLER: The list is safe. The broker’s done, and both crews will be looking at each other for a week.', fov: 55 },
      { from: [60, 1.4, 300], to: [40, 2, 330], look: [-40, 25, -20], dur: 5, say: 'HANDLER: Seoul can keep its neon. Come home.', fov: 55 },
    ],
  }];
}

// ---------------- Case 03: Ravenscroft ----------------
function manorMissions({ fig, live, near, kit, S, flags, talkShots, flyover, behind }) {
  const F = flags, HV = (t) => `HANDLER: ${t}`;
  const insideWalls = () => Math.abs(P.pos.x) < 199 && P.pos.z < 199 && P.pos.z > -199;
  return [{
    title: 'THE GUEST LIST', reward: 600,
    brief: 'Lord Ashdown keeps a ledger of every bribe he has paid, and tonight he throws a gala. Get inside the walls, dress for the party, and meet our contact — the sommelier at the marquee bar.',
    intro: () => flyover([
      { from: [-260, 90, 280], to: [-80, 55, 170], look: [0, 8, -45], dur: 5 },
      { from: [0, 32, 240], to: [0, 12, 120], look: [0, 6, -30], dur: 5 },
      { from: [52, 16, 96], to: [62, 4.5, 66], look: [64, 2, 48], dur: 5 },
    ], [HV('Ravenscroft. Lord Ashdown’s estate — and tonight, his gala.'), HV('Three hundred guests, forty men in suits with earpieces. Ashdown keeps a ledger of every bribe he has ever paid.'), HV('Our contact pours the wine at the marquee. Get in, dress for the party, and find him.')]),
    setup() {
      F().contact = fig({ kit: kit({ top: 'jacket', topColor: '#e8e4dc', pantsColor: '#141416', headwear: 'none', hair: 'short', facialHair: 'none' }), route: [[67.5, 47.6]], speed: 0, yaw: Math.PI });
      F().contact.fig.lookAt = P.pos;
      F().sec = fig({ kit: kit({ top: 'longsleeve', topColor: '#a01a2a', hair: 'long', hairColor: '#2e2018', pantsColor: '#a01a2a', facialHair: 'none' }), route: [[-36, -40, 4], [-24, -43, 5], [-18, -36, 4], [-40, -35, 5]], loop: true, speed: 0.55 });
    },
    steps: [
      { text: 'Get inside the walls — the gate checks guests, the service gate is guarded, and the west wall has fallen in', where: () => ({ x: 0, y: 3, z: 196, name: 'GATE' }), done: insideWalls },
      { text: 'Dress for the party: knock a guest out where nobody sees (F), take his clothes (E), keep your weapons hidden (H)', where: () => null, done: () => P.disguise === 'civilian' },
      { text: 'Meet the sommelier at the marquee bar (E)', where: () => live(F().contact, 'SOMMELIER')(), act: () => near(F().contact, 2.8), prompt: () => near(F().contact, 2.8) ? '[E]  ASK FOR THE WINE LIST' : '',
        cut: () => talkShots(P.pos, F().contact, ['SOMMELIER: Red or white, sir?', 'YOU: Whatever Ashdown is hiding.', 'SOMMELIER: Upstairs. The study, east side of the landing. A safe behind the portrait of his father.', 'SOMMELIER: The code changes every night. His secretary keeps it in her diary — red dress, in the ballroom. Don’t let her see you.']) },
      { text: 'Lift the diary from Ashdown’s secretary (red dress) in the ballroom — from behind (E)', where: () => live(F().sec, 'SECRETARY')(),
        act: () => { const s2 = F().sec; if (s2.alive && near(s2, 1.9) && behind(s2)) { feed('<span class="s">DIARY TAKEN — TONIGHT’S CODE: 4-1-7-9</span>'); audio.pouch(); return true; } return false; },
        prompt: () => { const s2 = F().sec; return s2.alive && near(s2, 1.9) ? (behind(s2) ? '[E]  LIFT THE DIARY' : 'GET BEHIND HER') : ''; } },
    ],
  }, {
    title: 'THE LEDGER', reward: 800,
    brief: 'The study is upstairs on the east side of the landing. Guests don’t go upstairs — your cover thins the moment you do. The safe is behind the portrait. Tonight’s code: 4-1-7-9.',
    intro: () => [
      { from: [0, 1.9, -18], to: [0, 2.4, -30], look: [0, 4.5, -44], dur: 4.5, say: HV('The study is up the grand stairs, then east along the corridor — the north side.'), fov: 55 },
      { from: [0, 6.8, -40], to: [8, 7.0, -48], look: [17, 6.2, -58], dur: 5, say: HV('Guests don’t go upstairs. If they see you there, your cover goes fast — throw something to pull them off the landing.'), fov: 55 },
    ],
    steps: [
      { text: 'Get upstairs to the study (east side of the first floor)', where: () => ({ ...S().study, y: S().study.y + 2, name: 'STUDY' }), done: () => near(S().study, 7.5, 1.6) },
      { text: 'Open the safe behind the portrait (E): 4-1-7-9', where: () => ({ ...S().safe, y: S().safe.y + 1, name: 'SAFE' }), act: () => near(S().safe, 2.4, 2.2), prompt: () => near(S().safe, 2.4, 2.2) ? '[E]  4 · 1 · 7 · 9' : '',
        cut: () => [
          { from: [S().safe.x - 1.6, S().safe.y + 0.7, S().safe.z + 0.8], to: [S().safe.x - 1.1, S().safe.y + 0.4, S().safe.z + 0.4], look: [S().safe.x, S().safe.y - 0.2, S().safe.z], dur: 3.6, say: 'YOU: Four. One. Seven. Nine.', fov: 38 },
          { from: [S().safe.x - 2.4, S().safe.y + 1.2, S().safe.z - 1.5], to: [S().safe.x - 2.2, S().safe.y + 1.1, S().safe.z - 1.2], look: [S().safe.x - 0.4, S().safe.y, S().safe.z], dur: 4.4, say: HV('That’s it — every name, every payment. Now get out of that house.'), fov: 44 },
        ] },
    ],
  }, {
    title: 'OUT BY WATER', reward: 900,
    brief: 'They’ve found the guest you left in the bushes and they’re locking the gates. Don’t try them. Get to the boathouse on the lake and take a boat across.',
    intro: () => flyover([{ from: [40, 26, -40], to: [70, 18, -70], look: [100, 2, -98] }, { from: [104, 3, -82], to: [108, 2.4, -88], look: [112, 0.5, -100] }],
      [HV('They’ve found the guest you left in the bushes. The gates are locked and every earpiece in the place is talking about you.'), HV('The boathouse, on the lake. Take a boat across — I’ll be on the far shore.')], 5),
    setup() { BOTS.setPressure(3); },
    teardown() { BOTS.setPressure(0); },
    steps: [
      { text: 'Get to the boathouse on the lake', where: () => ({ ...S().boathouse, y: 3, name: 'BOATHOUSE' }), done: () => near({ ...S().boathouse, y: 0 }, 9, 3) },
      { text: 'Take a boat from the jetty (E)', where: () => ({ x: 112, y: 2, z: -100, name: 'BOAT' }), act: () => near({ x: 112, y: 0.3, z: -100 }, 4, 2.5), prompt: () => near({ x: 112, y: 0.3, z: -100 }, 4, 2.5) ? '[E]  TAKE THE BOAT' : '' },
    ],
    outro: () => [
      { from: [112, 1.4, -96], to: [130, 1.0, -120], look: [170, 0.8, -150], dur: 5, say: HV('I see your lamp. Keep rowing.'), fov: 50 },
      { from: [150, 6, -150], to: [120, 14, -170], look: [0, 10, -45], dur: 6, say: HV('Haddad’s kasbah. The Dragons’ list. Ashdown’s ledger. They all point the same way.'), fov: 52 },
      { from: [120, 14, -170], to: [60, 40, -230], look: [0, 10, -45], dur: 5, say: HV('Get some sleep. The next file is already on my desk.'), fov: 52 },
    ],
  }];
}

// ---------------- Case 04: Paradise ----------------
// Victor Kane banks for every file on the desk. His accountant, Delia Ross, wants out — and she knows where
// he keeps the keys. Five missions: the bartender and the accountant; the fisherman who knows the patrols;
// Kane's island and Kane's phone; the lighthouse, where they take the bartender; the seaplane, and a name.
function bahamasMissions({ fig, live, near, kit, S, flags, talkShots, flyover, behind }) {
  const F = flags, HV = (t) => `HANDLER: ${t}`, onJet = () => SCOOTER.riding && SCOOTER.riding.kind === 'jet';
  const deliaKit = () => kit({ top: 'longsleeve', topColor: '#f0e8d8', bottom: 'pants', pantsColor: '#2a3a5a', hair: 'long', hairColor: '#1c1612', headwear: 'boonie', hatColor: '#e8d8b0', eyewear: 'sunglasses', facialHair: 'none' });
  const marisolKit = () => kit({ top: 'tshirt', topColor: '#f0c040', bottom: 'shorts', pantsColor: '#2ab0b0', hair: 'long', hairColor: '#2e2018', headwear: 'none', facialHair: 'none', eyewear: 'none' });
  const goon = (o = {}) => kit({ top: 'tshirt', topColor: '#f0f0ec', bottom: 'shorts', pantsColor: '#1a2a4a', headwear: 'cap', hatColor: '#1a2a4a', eyewear: 'sunglasses', ...o });
  const doorNear = (x, z) => { let b = null, bd = 1e9; for (const d of TOWN.doors) if (d.room === 'cottage') { const q = Math.hypot(d.x - x, d.z - z); if (q < bd) { bd = q; b = d; } } return b; };
  const bedSpot = () => ({ x: ROOMS.cottage.x - 3.4, y: 0, z: ROOMS.cottage.z + 2.2 });
  const alive = (k) => k.filter((f) => f && f.alive).length;
  return [{
    title: 'ISLAND TIME', reward: 600,
    brief: 'Ashdown’s ledger names one banker for every bribe on the desk: Victor Kane, who lives on a private island off Eleuthera. His accountant, Delia Ross, wants out. Our bartender at the Conch Bar can put you in touch.',
    intro: () => flyover([
      { from: [-300, 70, 330], to: [-120, 40, 240], look: [0, 4, 80], dur: 5 },
      { from: [60, 18, 230], to: [30, 9, 170], look: [0, 3, 110], dur: 5 },
      { from: [290, 30, -120], to: [330, 22, -170], look: [380, 4, -250], dur: 5 },
    ], [HV('Eleuthera. White sand, warm water — and a banker who washes money for half the files on my desk.'), HV('Haddad’s papers, the Dragons’ list, Ashdown’s ledger: every payment went through Victor Kane.'), HV('That’s his island, out to the north-east. Start with our bartender at the Conch Bar. Walk in like a tourist.')]),
    setup() {
      F().marisol = fig({ kit: marisolKit(), route: [[S().beachBar.x + 1.6, S().beachBar.z - 2.4]], y: S().beachBar.y, speed: 0, yaw: 0 }); F().marisol.fig.lookAt = P.pos;
      F().delia = fig({ kit: deliaKit(), route: [[S().market.x - 6, S().market.z, 4], [S().market.x + 6, S().market.z - 4, 5], [S().market.x + 2, S().market.z + 6, 4]], loop: true, speed: 0.5 });
      F().door = doorNear(-100, -78);
    },
    steps: [
      { text: 'Meet Marisol, the bartender at the Conch Bar on the resort beach (E)', where: () => live(F().marisol, 'CONCH BAR')(), act: () => near(F().marisol, 3, 2), prompt: () => near(F().marisol, 3, 2) ? '[E]  ORDER A RUM PUNCH' : '',
        cut: () => talkShots(P.pos, F().marisol, ['MARISOL: Rum punch? You look like you came a long way for one.', 'YOU: I’m looking for Delia Ross.', 'MARISOL: Keep your voice down. Kane’s men drink here on their days off.', 'MARISOL: She buys straw hats at the market in the harbour every afternoon — it’s the only time they let her out alone. White hat, long sleeves.']) },
      { text: 'Find Delia Ross at the straw market by the harbour (white hat, long sleeves)', where: () => live(F().delia, 'DELIA')(), act: () => near(F().delia, 2.6, 2), prompt: () => near(F().delia, 2.6, 2) ? '[E]  “NICE HAT.”' : '',
        cut: () => talkShots(P.pos, F().delia, ['DELIA: Don’t look at me. Look at the hats.', 'DELIA: I keep Victor’s books. All of them. I can give you the accounts — but not without my passport.', 'YOU: Where is it?', 'DELIA: In my cottage in the village, under the bed. His men watch the house from the lane. Bring it to me here.']) },
      { text: 'Get into Delia’s cottage in the village (E at the door)', where: () => (F().door && !DOORS.inside ? { x: F().door.x, y: 3, z: F().door.z, name: 'DELIA’S COTTAGE' } : null), done: () => DOORS.inside && DOORS.current === F().door },
      { text: 'Find the passport under the bed (E)', where: () => ({ ...bedSpot(), y: 1.5, name: 'PASSPORT' }), act: () => DOORS.inside && near(bedSpot(), 2.4, 2), prompt: () => DOORS.inside && near(bedSpot(), 2.4, 2) ? '[E]  LOOK UNDER THE BED' : '' },
      { text: 'Take the passport back to Delia at the straw market', where: () => (DOORS.inside ? null : live(F().delia, 'DELIA')()), act: () => !DOORS.inside && near(F().delia, 2.6, 2), prompt: () => !DOORS.inside && near(F().delia, 2.6, 2) ? '[E]  GIVE HER THE PASSPORT' : '',
        cut: () => talkShots(P.pos, F().delia, ['DELIA: You actually did it.', 'DELIA: The accounts are on his laptop, on the island. It won’t open without the key on his phone — he never puts it down.', 'DELIA: Ask for Errol, down on the harbour jetty. He’s fished these waters forty years. He knows when the boats go round.']) },
    ],
  }, {
    title: 'THE FISHERMAN', reward: 700,
    brief: 'Kane’s patrol boats circle his island on a pattern. Errol, an old fisherman on the harbour jetty, knows it — but Kane’s collector is squeezing the fishermen today, and nobody talks while he’s on the quay.',
    intro: () => flyover([{ from: [-160, 26, -200], to: [-120, 12, -170], look: [-100, 1, -140] }, { from: [-130, 4, -100], to: [-120, 3, -104], look: [-114, 1.6, -114] }],
      [HV('Governor’s Harbour. Errol keeps his boat on the middle jetty.'), HV('Kane’s collector works the conch shacks on Fridays. Today is Friday.')], 5),
    setup() {
      F().errol = fig({ kit: kit({ top: 'longsleeve', topColor: '#6a8ab0', bottom: 'pants', pantsColor: '#5a4a3a', headwear: 'boonie', hatColor: '#c8b890', facialHair: 'beard', hairColor: '#d8d8d0' }), route: [[S().harbourJetty.x + 0.6, S().harbourJetty.z]], y: 0.55, speed: 0, yaw: Math.PI / 2 });
      const sx = S().shacks.x, sz = S().shacks.z;
      F().collector = fig({ kit: goon({ top: 'longsleeve', topColor: '#1a1a1a', headwear: 'none', hair: 'short' }), route: [[sx, sz + 3, 4], [sx + 16, sz + 3, 4], [sx + 32, sz + 3, 5]], loop: true, speed: 0.6, onDeath: () => { F().colDead = true; NPCS.alarm(sx, sz); feed('<span class="s">THE COLLECTOR IS DOWN</span>'); } });
      F().heavies = [[-1.4, 1.2], [1.4, 1.4]].map(([dx, dz]) => fig({ kit: goon(), route: [[sx + dx, sz + 3 + dz, 4], [sx + 16 + dx, sz + 3 + dz, 4], [sx + 32 + dx, sz + 3 + dz, 5]], loop: true, speed: 0.6 }));
    },
    steps: [
      { text: 'Find Errol on the middle jetty of the harbour', where: () => live(F().errol, 'ERROL')(), act: () => near(F().errol, 2.8, 2), prompt: () => near(F().errol, 2.8, 2) ? '[E]  TALK TO ERROL' : '',
        cut: () => talkShots(P.pos, F().errol, ['ERROL: Not today, son. Not with him walking the quay.', 'YOU: Who?', 'ERROL: Kane’s collector. Black shirt. Takes a cut of every catch, breaks a hand if you’re short. Two big lads with him.', 'ERROL: Get him off this harbour and I’ll tell you anything you like about those boats.']) },
      { text: 'Deal with Kane’s collector (black shirt) at the conch shacks — quietly, if you can', where: () => live(F().collector, 'COLLECTOR')(), done: () => F().colDead },
      { text: 'Go back to Errol on the jetty (E)', where: () => live(F().errol, 'ERROL')(), act: () => near(F().errol, 2.8, 2), prompt: () => near(F().errol, 2.8, 2) ? '[E]  “HE’S GONE.”' : '',
        cut: () => talkShots(P.pos, F().errol, ['ERROL: Forty years I been waiting for somebody to do that.', 'ERROL: Two grey boats. They go round the island the long way, slow, and pass the dock every four minutes. Wait till one goes by, then go straight in behind it.', 'ERROL: Take the jetski at the end of my jetty. Tell the hotel you found it.']) },
      { text: 'Take the jetski at the end of the harbour jetty (E)', where: () => ({ x: -97.5, y: 2, z: -166, name: 'JETSKI' }), done: onJet },
    ],
  }, {
    title: 'KANE’S ISLAND', reward: 1000,
    brief: 'Cross to Kane’s island behind a patrol boat. Kane takes his calls on the pool terrace — lift his phone, or take it. Then open the laptop in his office with it.',
    intro: () => flyover([{ from: [200, 26, -150], to: [270, 14, -210], look: [380, 4, -250] }, { from: [S().kaneTerrace.x + 10, 4, S().kaneTerrace.z + 6], to: [S().kaneTerrace.x + 6, 3, S().kaneTerrace.z + 4], look: [S().kaneTerrace.x, 1.6, S().kaneTerrace.z] }],
      [HV('Follow a patrol boat in. Thirty metres and they’ll see you.'), HV('That’s Kane. The phone never leaves his hand — except when he’s talking with it.')], 5),
    setup() {
      const t = S().kaneTerrace;
      F().kane = fig({ kit: kit({ top: 'longsleeve', topColor: '#f0f0ec', bottom: 'pants', pantsColor: '#e8e0d0', headwear: 'none', hair: 'short', hairColor: '#6a6058', facialHair: 'stubble', eyewear: 'sunglasses' }), route: [[t.x, t.z, 6], [t.x + 3, t.z + 2, 5], [t.x - 3, t.z + 2, 6]], loop: true, speed: 0.45, y: 0.5, onDeath: () => { F().kaneDead = true; BOTS.setPressure(2); feed('<span class="m">KANE IS DOWN — HIS MEN WILL HAVE HEARD</span>'); } });
      for (const [dx, dz] of [[2.4, -1.6], [-2.6, -1.4]]) fig({ kit: goon({ top: 'longsleeve', topColor: '#111316', bottom: 'pants', pantsColor: '#111316', headwear: 'none' }), route: [[t.x + dx, t.z + dz]], y: 0.5, speed: 0, yaw: Math.PI });
    },
    steps: [
      { text: 'Ride to Kane’s dock on the private island — go in behind a patrol boat', where: () => ({ ...S().privateDock, y: 3, name: 'DOCK' }), done: () => near({ ...S().privateDock, y: P.pos.y }, 28, 3) },
      { text: 'Get Kane’s phone: pick his pocket from behind on the pool terrace (E) — or take it off him', where: () => ({ x: F().kane.x, y: (F().kane.y || 0) + 2.2, z: F().kane.z, name: 'KANE' }),
        act: () => { const k = F().kane; if (k.alive && near(k, 1.9, 2) && behind(k)) { feed('<span class="s">PHONE LIFTED</span>'); audio.pouch(); return true; } if (!k.alive && near(k, 2.4, 2)) { feed('<span class="s">PHONE TAKEN</span>'); audio.pouch(); return true; } return false; },
        prompt: () => { const k = F().kane; return k.alive && near(k, 1.9, 2) ? (behind(k) ? '[E]  LIFT THE PHONE' : 'GET BEHIND HIM') : !k.alive && near(k, 2.4, 2) ? '[E]  TAKE THE PHONE' : ''; } },
      { text: 'Open the laptop on the office desk with his phone (E)', where: () => ({ ...S().laptop, y: 2.4, name: 'LAPTOP' }), act: () => near(S().laptop, 2.6, 2), prompt: () => near(S().laptop, 2.6, 2) ? '[E]  UNLOCK THE LAPTOP' : '',
        cut: () => [
          { from: [S().laptop.x + 1.6, 2.2, S().laptop.z + 1.6], to: [S().laptop.x + 1.0, 1.9, S().laptop.z + 1.0], look: [S().laptop.x, 1.3, S().laptop.z], dur: 4.5, say: HV('It’s opening. Every account. Every payment — the kasbah, the Dragons, Ashdown…'), fov: 40 },
          { from: [S().laptop.x - 1.2, 1.8, S().laptop.z + 2.2], to: [S().laptop.x - 1.0, 1.8, S().laptop.z + 1.8], look: [S().laptop.x, 1.4, S().laptop.z], dur: 4.5, say: 'PHONE (KANE’S, RINGING): “Victor. It’s Cassius. Someone’s been asking questions in Seoul. Clean house.”', fov: 40 },
          { from: [S().laptop.x + 2.6, 2.4, S().laptop.z - 1.0], to: [S().laptop.x + 2.2, 2.2, S().laptop.z - 0.6], look: [S().laptop.x, 1.4, S().laptop.z], dur: 4, say: HV('…Cassius. I know that voice. Get off that island. Now.'), fov: 44 },
        ] },
      { text: 'Get back to the main island — the Conch Bar', where: () => ({ ...S().beachBar, y: 3, name: 'CONCH BAR' }), done: () => near(S().beachBar, 10, 3) },
    ],
  }, {
    title: 'THE LIGHTHOUSE', reward: 1100,
    brief: 'Cassius told Kane to clean house. The Conch Bar is empty. Find out where they took Marisol — and get her back.',
    intro: () => [{ from: [S().beachBar.x + 6, 2.6, S().beachBar.z + 6], to: [S().beachBar.x + 3, 2.2, S().beachBar.z + 3], look: [S().beachBar.x, 1.2, S().beachBar.z - 2], dur: 4.5, say: 'BARBACK: They took her. Grey boat, an hour ago. Went east, round the point — toward the lighthouse.', fov: 46 },
      { from: [200, 30, 40], to: [225, 18, 10], look: [240, 6, -10], dur: 5, say: HV('Three of Kane’s men at the lighthouse. She’s alive or they wouldn’t still be there.'), fov: 50 }],
    setup() {
      const lx = S().lighthouse.x, lz = S().lighthouse.z;
      F().hostage = fig({ kit: marisolKit(), route: [[lx - 4, lz + 3]], speed: 0, yaw: Math.PI / 2 });
      F().captors = [[-6, -2, 0], [-2, 6, 2], [-9, 7, 3]].map(([dx, dz, w]) => fig({ kit: goon({ top: 'longsleeve', topColor: '#111316', bottom: 'pants', pantsColor: '#111316' }), route: [[lx + dx, lz + dz, w], [lx + dx - 3, lz + dz + 2, w + 1]], loop: true, speed: 0.5 }));
    },
    steps: [
      { text: 'Get to the lighthouse on the east point', where: () => ({ ...S().lighthouse, y: 6, name: 'LIGHTHOUSE' }), done: () => near({ ...S().lighthouse, y: P.pos.y }, 40, 4) },
      { text: 'Take out Kane’s men holding Marisol', where: () => { const c = F().captors.find((f) => f.alive); return c ? { x: c.x, y: c.y + 2.1, z: c.z, name: 'KANE’S MEN' } : null; }, done: () => alive(F().captors) === 0 },
      { text: 'Free Marisol (E)', where: () => live(F().hostage, 'MARISOL')(), act: () => near(F().hostage, 2.6, 2), prompt: () => near(F().hostage, 2.6, 2) ? '[E]  CUT HER LOOSE' : '',
        cut: () => talkShots(P.pos, F().hostage, ['MARISOL: Took you long enough.', 'MARISOL: They were waiting for a call. Someone called Cassius was going to tell them what to do with me.', 'MARISOL: Delia’s waiting at the end of the hotel pier. She says the seaplane leaves with or without you.']) },
    ],
  }, {
    title: 'THE SEAPLANE', reward: 1400,
    brief: 'Every boat Kane has is out now. Pick up Delia at the end of the resort pier, get her on a jetski, and get her to the seaplane off Sandy Cay.',
    intro: () => flyover([{ from: [0, 30, 330], to: [0, 10, 290], look: [0, 1, 266] }, { from: [-260, 40, 200], to: [-340, 18, 250], look: [-405, 2, 270] }],
      [HV('Delia’s at the restaurant at the end of the bungalow pier.'), HV('Sandy Cay, south-west. The seaplane is riding at anchor off its west side. Don’t stop for anything.')], 5),
    setup() { BOTS.setPressure(3); F().delia = fig({ kit: deliaKit(), route: [[S().pierEnd.x + 2, S().pierEnd.z + 1]], y: S().pierEnd.y, speed: 0, yaw: Math.PI }); F().delia.fig.lookAt = P.pos; },
    teardown() { BOTS.setPressure(0); },
    steps: [
      { text: 'Meet Delia at the restaurant at the end of the bungalow pier (E)', where: () => live(F().delia, 'DELIA')(), act: () => near(F().delia, 2.8, 2), prompt: () => near(F().delia, 2.8, 2) ? '[E]  “TIME TO GO.”' : '',
        cut: () => talkShots(P.pos, F().delia, ['DELIA: I heard about the lighthouse. Thank you.', 'DELIA: There’s something I didn’t put in the accounts. Cassius isn’t a client. He’s the one who sends the clients — from inside your own service.', 'YOU: Then we’re taking you somewhere he can’t find you. Can you ride pillion on a jetski?', 'DELIA: Can you drive one?']) },
      { text: 'Get on a jetski (the rental dock is just west of the pier)', where: () => ({ ...S().rental, y: 2, name: 'JETSKIS' }), done: onJet },
      { text: 'Reach the seaplane off Sandy Cay', where: () => ({ ...S().seaplane, y: 3, name: 'SEAPLANE' }), done: () => near({ ...S().seaplane, y: P.pos.y }, 8, 3) },
    ],
    outro: () => [
      { from: [-398, 1.4, 276], to: [-394, 2.4, 280], look: [-405, 2.4, 270], dur: 4, say: 'PILOT: Two of you? Fine. Climb aboard — we’re late.', fov: 48 },
      { from: [-430, 10, 300], to: [-520, 60, 360], look: [0, 0, 0], dur: 6, say: HV('Haddad’s papers. The Dragons’ list. Ashdown’s ledger. Kane’s accounts. Every one of them paid by the same man.'), fov: 55 },
      { from: [-520, 60, 360], to: [-600, 120, 420], look: [0, 0, 0], dur: 6, say: HV('Cassius signs my orders. Don’t come back to the office. I’ll find you.'), fov: 55 },
    ],
  }];
}
