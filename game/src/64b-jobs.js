// =====================================================================
//  Side jobs: optional work on every map, offered by people with a ! over their heads
// =====================================================================
// Five per map, built from five kinds of work — a time trial (on a scooter, a golf cart, a jetski or on foot,
// through gates against the clock), a bounty (a marked man with armed company), a search (things hidden round
// the map, found by searching the areas you're given), surveillance (photograph a meeting from cover, bring the
// photos back) and a delivery (against the clock, with company waiting at the other end). Where it all happens
// is drawn from the map itself — its streets, squares, vehicles and water — the same way every time.
// A job runs alongside the campaign. Walk up to someone with a ! and press E; fail and you can ask again.
const JOBS = (() => {
  const SPEC = {
    dar: [
      { kind: 'race', ride: 'scooter', title: 'COURIER’S RUN', who: 'YOUSSEF', kit: { top: 'tshirt', topColor: '#c0302a', headwear: 'cap', hatColor: '#1a1a1a' },
        offer: ['YOUSSEF: You ride? I race the medina every Friday. Nobody’s beaten my time.', 'YOUSSEF: Seven gates, start to finish. Beat the clock and the pot is yours.'] },
      { kind: 'bounty', title: 'THE CLINIC THIEF', who: 'DR FATIMA', kit: { top: 'longsleeve', topColor: '#e8e8e4', headwear: 'none', hair: 'long' }, target: 'the militia sergeant selling the clinic’s medicine',
        offer: ['DR FATIMA: A militia sergeant empties our clinic every week and sells the medicine in the souk.', 'DR FATIMA: He keeps three men with him. Make him stop. Bring me his ledger.'] },
      { kind: 'collect', title: 'LOST TAPES', who: 'OLD BRAHIM', item: 'cassette', label: 'TAPES', n: 5, kit: { top: 'longsleeve', topColor: '#6a5a3a', facialHair: 'beard', hairColor: '#d8d8d0' },
        offer: ['OLD BRAHIM: When the militia came they threw my recordings into the street. Forty years of music.', 'OLD BRAHIM: Five tapes I can’t replace. I know roughly where they fell. Find them for an old man.'] },
      { kind: 'photo', title: 'WHO MEETS WHOM', who: 'LEILA', kit: { top: 'jacket', topColor: '#2a3a5a', eyewear: 'sunglasses' },
        offer: ['LEILA: I write for a paper that isn’t allowed to exist any more.', 'LEILA: Two of Haddad’s officers are meeting someone in the open today. Photograph them — aim, hold still. Bring me the pictures.'] },
      { kind: 'deliver', title: 'INSULIN', who: 'NADIA', kit: { top: 'longsleeve', topColor: '#3a6a5a', headwear: 'none', hair: 'long' }, recipient: 'KARIM', package: 'the insulin',
        offer: ['NADIA: My father needs this before evening, and the checkpoints are closed to me.', 'NADIA: Take it to my brother Karim across the medina. Quickly — and he says there are men watching his door.'] },
    ],
    seoul: [
      { kind: 'race', ride: 'scooter', title: 'BAEDAL', who: 'JIHO', kit: { top: 'jacket', topColor: '#2a8ad0', headwear: 'cap', hatColor: '#f0f0f0' },
        offer: ['JIHO: I deliver chicken. Thirty minutes or it’s free — and I’ve never been late.', 'JIHO: My bike, my route, eight drops. Beat my time and you can have tonight’s tips.'] },
      { kind: 'bounty', title: 'LOAN SHARK', who: 'MRS PARK', kit: { top: 'longsleeve', topColor: '#7a3a4a', hair: 'long' }, target: 'the debt collector who broke her son’s hands',
        offer: ['MRS PARK: My son borrowed money from the wrong people. Their collector broke both his hands.', 'MRS PARK: He walks with two men. I can’t pay you much. Bring me his book of names.'] },
      { kind: 'collect', title: 'PHOTOCARDS', who: 'YUNA', item: 'card', label: 'CARDS', n: 6, kit: { top: 'hoodie', topColor: '#f4b0c8', hair: 'long' },
        offer: ['YUNA: My bag split on the way home. My signed photocards are all over Mapo.', 'YUNA: Six of them. I know which streets. Please — one of them is signed to me.'] },
      { kind: 'photo', title: 'THE SNAKE DEAL', who: 'REPORTER KANG', kit: { top: 'jacket', topColor: '#3a3a3a', eyewear: 'sunglasses' },
        offer: ['KANG: The Dragons and the Snakes say they hate each other. Tonight two of them are meeting quietly.', 'KANG: I need their faces in the same frame. Aim, hold it steady, and bring me the camera.'] },
      { kind: 'deliver', title: 'GRANDMA’S SOUP', who: 'GRANDMA CHOI', kit: { top: 'longsleeve', topColor: '#8a6a4a', hair: 'short', hairColor: '#d8d8d0' }, recipient: 'MINSU', package: 'the soup',
        offer: ['GRANDMA CHOI: My grandson works all night and eats nothing. Take him this while it’s hot.', 'GRANDMA CHOI: He says some men have been waiting outside his work. Be careful, and be quick.'] },
    ],
    manor: [
      { kind: 'race', ride: null, title: 'THE BEATER’S ROUTE', who: 'TOM THE GAMEKEEPER', kit: { top: 'jacket', topColor: '#4a5a3a', headwear: 'cap', hatColor: '#4a3a2a' },
        offer: ['TOM: Every year the lads run the beater’s route before the shoot. Course record’s mine.', 'TOM: Through the markers, start to finish, on your own two feet. Beat it and I’ll owe you.'] },
      { kind: 'bounty', title: 'THE FIXER', who: 'MRS HALE', kit: { top: 'longsleeve', topColor: '#2a2a2a', hair: 'long' }, target: 'Ashdown’s fixer',
        offer: ['MRS HALE: I keep this house. I’ve seen what Ashdown’s fixer does to staff who talk.', 'MRS HALE: He’s on the grounds tonight with his men. Bring me the notebook he carries.'] },
      { kind: 'collect', title: 'THE CELLAR LIST', who: 'THE SOMMELIER', item: 'bottle', label: 'BOTTLES', n: 5, kit: { top: 'longsleeve', topColor: '#1a1a1a', facialHair: 'stubble' },
        offer: ['SOMMELIER: Someone has hidden five of His Lordship’s best bottles around the grounds to sell later.', 'SOMMELIER: Find them before he notices they’re gone, and I won’t notice you.'] },
      { kind: 'photo', title: 'SOCIETY PAGES', who: 'MISS FAIRFAX', kit: { top: 'longsleeve', topColor: '#c0a0d0', hair: 'long' },
        offer: ['MISS FAIRFAX: I write the society column. Two of tonight’s guests are pretending they’ve never met.', 'MISS FAIRFAX: A photograph of them together would make my career. Aim and hold steady.'] },
      { kind: 'deliver', title: 'THE LETTER', who: 'ELSIE THE MAID', kit: { top: 'longsleeve', topColor: '#2a2a3a', hair: 'long' }, recipient: 'JAMES', package: 'the letter',
        offer: ['ELSIE: Please — take this to James before his shift ends. They watch me every minute.', 'ELSIE: If the head of security finds it we’re both out. Hurry.'] },
    ],
    bahamas: [
      { kind: 'race', ride: 'jet', title: 'LAGOON RUN', who: 'DESMOND', kit: { top: 'tshirt', topColor: '#f0c040', headwear: 'cap', hatColor: '#2ab0d0' },
        offer: ['DESMOND: I rent the jetskis. Every tourist thinks they’re fast.', 'DESMOND: Round the buoys, all the gates, beat my time and the ski’s free all week.'] },
      { kind: 'race', ride: 'cart', title: 'GOLF CART GRAND PRIX', who: 'MISS IVY', kit: { top: 'tshirt', topColor: '#f4b0b8', hair: 'long', headwear: 'boonie', hatColor: '#f0f0ec' },
        offer: ['MISS IVY: Every Sunday the settlement races golf carts round the island. I’ve won nine years running.', 'MISS IVY: Grab a cart. Through every gate. Don’t you dare scratch the paint.'] },
      { kind: 'bounty', title: 'THE COLLECTOR’S COUSIN', who: 'PASTOR GREENE', kit: { top: 'longsleeve', topColor: '#1a1a1a' }, target: 'the collector’s cousin, who took over his round',
        offer: ['PASTOR GREENE: You dealt with Kane’s collector. His cousin took his round the very next day.', 'PASTOR GREENE: Three men with him now. Bring me his book and the harbour can breathe.'] },
      { kind: 'collect', title: 'CONCH PEARLS', who: 'GRANNY ROLLE', item: 'pearl', label: 'PEARLS', n: 6, kit: { top: 'longsleeve', topColor: '#f6e08a', hair: 'short', hairColor: '#d8d8d0' },
        offer: ['GRANNY ROLLE: My string of conch pearls broke on my walk. Pink ones, very rare.', 'GRANNY ROLLE: Six of them, all over. My eyes aren’t what they were.'] },
      { kind: 'deliver', title: 'ICE RUN', who: 'MARISOL’S BARBACK', kit: { top: 'tshirt', topColor: '#2ab0b0' }, recipient: 'CHEF ROY', package: 'the ice',
        offer: ['BARBACK: The ice machine’s dead and Chef Roy has a wedding tonight.', 'BARBACK: Take him this before it melts. Somebody keeps sending men to lean on him.'] },
    ],
  }[MAP.id];
  if (!SPEC) return { update() { }, interact: () => false, fail() { } };
  const KEY = `${MAP.id}.jobs`, doneSet = new Set((() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } })());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...doneSet])); } catch { } };
  // ---- ui: the job's own panel, a cyan waypoint, a prompt line, the ! over each giver ----
  const host = document.getElementById('hud'), el = (css) => { const d = document.createElement('div'); d.style.cssText = css; host.appendChild(d); return d; };
  const panel = el('position:absolute;right:24px;top:140px;text-align:right;font-size:12px;letter-spacing:.12em;color:#bfeaf0;text-shadow:0 0 6px #000;line-height:1.55;max-width:420px');
  const way = el('position:absolute;left:0;top:0;transform:translate(-50%,-50%);font-size:12px;letter-spacing:.12em;color:#6ae0ff;text-shadow:0 0 5px #000;text-align:center;white-space:nowrap;display:none');
  const prm = el('position:absolute;left:50%;top:61%;transform:translateX(-50%);font-size:15px;letter-spacing:.22em;color:#6ae0ff;text-shadow:0 0 8px #000;display:none');
  const bangs = [];
  // ---- the map's own places, chosen the same way every time ----
  let seed = 0; for (const ch of MAP.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const dryOK = (x, z) => { const h = terrainH(x, z), g = GR.get(x, z); return h > (MAP.waterY ?? -9) + 0.2 && h < 0.6 && g !== GR.BUILT && g !== GR.WALL && Math.abs(x) < 480 && Math.abs(z) < 480 && !(TOWN.restricted || []).some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1); };
  let CAND = null;
  function cands() {
    if (CAND) return CAND;
    CAND = [];
    for (const k in TOWN.lanes) { const st = TOWN.lanes[k]; if (!st || st.len < 20) continue; for (const p of st.pts) if (dryOK(p[0], p[1])) CAND.push([p[0], p[1]]); }
    for (const r of TOWN.plazas || []) { const x = (r.x0 + r.x1) / 2, z = (r.z0 + r.z1) / 2; if (dryOK(x, z)) CAND.push([x, z]); }
    return CAND;
  }
  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const pickFar = (from, lo, hi, avoid = []) => { const C = cands(); for (let t = 0; t < 400; t++) { const c = C[(rnd() * C.length) | 0], d = d2(c, from); if (d >= lo && d <= hi && avoid.every((a) => d2(a, c) > 30)) return c; } return C[(rnd() * C.length) | 0]; };
  // ---- the people who offer the work ----
  let givers = null, waitV = 0;
  function placeGivers() {
    givers = [];
    const C = cands(), spawn = [SPAWN.x, SPAWN.z], vehicles = SCOOTER.list || [];
    SPEC.forEach((J, i) => {
      let at = null;
      if (J.ride === 'jet' && TOWN.spots.rental) at = [TOWN.spots.rental.x + 1.2, TOWN.spots.rental.z - 6];   // on the rental jetty, by the skis
      if (J.kind === 'race' && J.ride) { const v = vehicles.filter((s) => (J.ride === 'scooter' ? !s.kind || s.kind === 'scooter' : s.kind === J.ride)); if (v.length) { const s = v[(rnd() * v.length) | 0]; for (let t = 0; t < 30 && !at; t++) { const a = rnd() * 6.28, x = s.x + Math.cos(a) * 3, z = s.z + Math.sin(a) * 3; if (dryOK(x, z) || (J.ride === 'jet' && COL.ground(x, z, 2) > (MAP.waterY ?? -9) + 0.2)) at = [x, z]; } } }
      if (!at) at = pickFar(spawn, 30 + i * 25, 160 + i * 40, givers.map((g) => [g.x, g.z]));
      const y = COL.ground(at[0], at[1], 3);
      const f = NPCS.spawnFigure({ kit: NPCS.outfit(J.kit), route: [[at[0], at[1]]], speed: 0, yaw: rnd() * 6.28, y });
      f.fig.lookAt = P.pos;
      givers.push({ J, f, x: at[0], z: at[1], id: `${MAP.id}:${i}` });
    });
  }
  // ---- the job being done ----
  let job = null;   // { g, J, steps, si, t, timeLeft, objs: [], figs: [], squad: tag }
  const meshes = [];
  const glow = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.4 });
  function ring(x, y, z, yaw) { const m = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 8, 28), new THREE.MeshBasicMaterial({ color: 0x6ae0ff, transparent: true, opacity: 0.75, depthWrite: false })); m.position.set(x, y, z); m.rotation.y = yaw; scene.add(m); meshes.push(m); return m; }
  function trinket(kind, x, y, z) {
    const g = new THREE.Group();
    if (kind === 'cassette') { M(new THREE.BoxGeometry(0.12, 0.02, 0.08), glow(0x3a3a3a), g, 0, 0.01, 0); M(new THREE.BoxGeometry(0.08, 0.021, 0.03), glow(0xe8c040), g, 0, 0.012, 0); }
    else if (kind === 'card') M(new THREE.BoxGeometry(0.06, 0.004, 0.09), glow(0xf4b0c8), g, 0, 0.004, 0);
    else if (kind === 'bottle') { M(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 8), glow(0x2a4a2a), g, 0, 0.12, 0); M(new THREE.CylinderGeometry(0.015, 0.02, 0.08, 6), glow(0x2a4a2a), g, 0, 0.27, 0); }
    else M(new THREE.SphereGeometry(0.035, 10, 8), glow(0xf8b0a8), g, 0, 0.035, 0);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.18, depthWrite: false })); halo.position.y = 0.15; g.add(halo);
    g.position.set(x, y, z); scene.add(g); meshes.push(g); return g;
  }
  const C = () => MISSION.ctx;
  const near = (p, r, dy = 2) => !!p && Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < r && Math.abs((p.y ?? P.pos.y) - P.pos.y) < dy;
  const rideOK = (want) => { const r = SCOOTER.riding; if (!want) return !r; return !!r && (want === 'scooter' ? !r.kind || r.kind === 'scooter' : r.kind === want); };
  const RIDE = { scooter: ['a scooter', 10], cart: ['a golf cart', 6.5], jet: ['a jetski', 16], null: ['', 4.6] };
  // ---- the five kinds of work, as steps (same shape as the campaign's) ----
  function build(g) {
    const J = g.J, home = [g.x, g.z], tag = `job${g.id}`, st = { tag };
    if (J.kind === 'race') {
      // gates: on the water round the island for a jetski, else a chain through the streets
      const gates = [];
      if (J.ride === 'jet') { for (let k = 0; k < 9; k++) { const a = -Math.PI * 0.15 + k / 9 * Math.PI * 1.25; let best = null; for (let r = 120; r < 420 && !best; r += 6) { const x = Math.cos(a) * r * 1.05, z = 40 + Math.sin(a) * r * 0.75; if (terrainH(x, z) < MAP.waterY - 1.4 && islandSD(x, z) > 18) best = [x, z]; } if (best) gates.push(best); } }
      else { let p = home; for (let k = 0; k < (J.ride ? 8 : 7); k++) { const q = pickFar(p, J.ride ? 45 : 30, J.ride ? 90 : 55, gates); gates.push(q); p = q; } }
      const [what, sp] = RIDE[J.ride]; let len = d2(home, gates[0]); for (let k = 1; k < gates.length; k++) len += d2(gates[k - 1], gates[k]);
      st.gates = gates; st.gi = 0; st.limit = Math.round(len / sp * 1.45 + 12);
      return [
        ...(J.ride ? [{ text: `Get on ${what}`, done: () => rideOK(J.ride), where: () => { const v = (SCOOTER.list || []).filter((s) => s !== SCOOTER.riding && (J.ride === 'scooter' ? !s.kind || s.kind === 'scooter' : s.kind === J.ride)).sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z))[0]; return v ? { x: v.x, y: v.y + 2, z: v.z, name: what.toUpperCase().replace(/^A /, '') } : null; } }] : []),
        { text: `Through all ${gates.length} gates before the clock runs out`, time: st.limit, late: 'Too slow — the clock beat you.',
          enter: () => { st.gi = 0; for (const m of meshes.splice(0)) scene.remove(m); st.rings = gates.map(([x, z], k) => { const n = gates[k + 1] || gates[k - 1], y = J.ride === 'jet' ? MAP.waterY + 1.6 : COL.ground(x, z, 3) + 2.2; return ring(x, y, z, Math.atan2(n[0] - x, n[1] - z) + Math.PI / 2); }); },
          tick: (dt) => { if (J.ride && !rideOK(J.ride)) { st.off = (st.off || 0) + dt; if (st.off > 6) return `You left ${what} behind.`; } else st.off = 0; const q = gates[st.gi]; if (q && Math.hypot(P.pos.x - q[0], P.pos.z - q[1]) < (J.ride === 'jet' ? 6 : 4.5)) { st.rings[st.gi].visible = false; st.gi++; audio.pouch(); feed(`<span class="s">GATE ${st.gi}/${gates.length}</span>`); } for (const [k, m] of st.rings.entries()) { m.material.opacity = k === st.gi ? 0.9 : 0.25; m.rotation.z += dt * (k === st.gi ? 1.5 : 0.3); } return null; },
          done: () => st.gi >= gates.length, where: () => { const q = gates[st.gi]; return q ? { x: q[0], y: 3, z: q[1], name: `GATE ${st.gi + 1}` } : null; } },
      ];
    }
    if (J.kind === 'bounty') {
      const at = pickFar(home, 140, 320), team = TOWN.factionAt ? TOWN.factionAt(at[0], at[1]) : 'red';
      return [
        { text: `Find ${J.target}`, enter: () => {
            st.t = NPCS.spawnFigure({ kit: NPCS.outfit({ top: 'jacket', topColor: '#2a2a2a', pantsColor: '#1a1a1a', eyewear: 'sunglasses', headwear: 'cap', hatColor: '#8a1a1a' }), route: [[at[0], at[1], 6], [at[0] + 5, at[1] + 3, 5], [at[0] - 3, at[1] + 5, 6]], loop: true, speed: 0.9, onDeath: () => { st.dead = true; feed('<span class="s">TARGET DOWN</span>'); } });
            job.figs.push(st.t); st.g = BOTS.squad([[at[0] + 3, at[1] - 2, 0], [at[0] - 3, at[1] + 1, 2], [at[0] + 1, at[1] + 6, 4]], { tag, team, profile: 'veteran' }); },
          done: () => st.t && near(st.t, 35, 6), where: () => ({ x: at[0], y: 3, z: at[1], name: 'TARGET' }) },
        { text: 'Take him down (red cap) — his men will fight for him', done: () => st.dead, where: () => st.t && st.t.alive ? { x: st.t.x, y: st.t.y + 2.2, z: st.t.z, name: 'TARGET' } : null },
        { text: 'Take his book off the body (E)', act: () => near(st.t, 2.4), prompt: () => (near(st.t, 2.4) ? '[E]  TAKE THE BOOK' : ''), where: () => ({ x: st.t.x, y: st.t.y + 1, z: st.t.z, name: 'BOOK' }) },
        { text: `Bring it to ${J.who.toLowerCase()} (E)`, act: () => near(g.f, 2.6), prompt: () => (near(g.f, 2.6) ? '[E]  HAND IT OVER' : ''), where: () => ({ x: g.f.x, y: g.f.y + 2.2, z: g.f.z, name: J.who }) },
      ];
    }
    if (J.kind === 'collect') {
      const spots = []; for (let k = 0; k < J.n; k++) { const c = pickFar(home, 40, 330, spots); const a = rnd() * 6.28, x = c[0] + Math.cos(a) * 2.2, z = c[1] + Math.sin(a) * 2.2; spots.push(dryOK(x, z) ? [x, z] : c); }
      st.spots = spots; st.got = new Set(); st.off = spots.map(() => [(rnd() - 0.5) * 30, (rnd() - 0.5) * 30]);
      const nearestLeft = () => { let b = -1, bd = 1e9; spots.forEach((s, k) => { if (st.got.has(k)) return; const d = Math.hypot(s[0] - P.pos.x, s[1] - P.pos.z); if (d < bd) { bd = d; b = k; } }); return b; };
      return [
        { text: `Find ${J.n} ${J.label.toLowerCase()} — search the marked areas, they glow faintly`, enter: () => { st.items = spots.map(([x, z]) => trinket(J.item, x, COL.ground(x, z, 2) + 0.02, z)); },
          tick: (dt) => { for (const m of st.items) m.rotation.y += dt; return null; },
          act: () => { const k = nearestLeft(); if (k < 0 || !near({ x: spots[k][0], z: spots[k][1] }, 1.8, 3)) return false; st.got.add(k); st.items[k].visible = false; audio.pouch(); feed(`<span class="s">${J.label} ${st.got.size}/${J.n}</span>`); return st.got.size >= J.n; },
          prompt: () => { const k = nearestLeft(); return k >= 0 && near({ x: spots[k][0], z: spots[k][1] }, 1.8, 3) ? '[E]  PICK IT UP' : `${J.label} ${st.got.size}/${J.n}`; },
          where: () => { const k = nearestLeft(); if (k < 0) return null; const s = spots[k], close = Math.hypot(s[0] - P.pos.x, s[1] - P.pos.z) < 22; return close ? { x: s[0], y: 1.2, z: s[1], name: J.label.slice(0, -1) } : { x: s[0] + st.off[k][0], y: 2, z: s[1] + st.off[k][1], name: 'SEARCH AREA' }; } },
        { text: `Bring them back to ${J.who.toLowerCase()} (E)`, act: () => near(g.f, 2.6), prompt: () => (near(g.f, 2.6) ? '[E]  GIVE THEM BACK' : ''), where: () => ({ x: g.f.x, y: g.f.y + 2.2, z: g.f.z, name: J.who }) },
      ];
    }
    if (J.kind === 'photo') {
      const at = pickFar(home, 120, 280), team = TOWN.factionAt ? TOWN.factionAt(at[0], at[1]) : 'red';
      return [
        { text: 'Find the meeting', enter: () => {
            st.pair = [[0, 0], [1.4, 0.2]].map(([dx, dz], k) => NPCS.spawnFigure({ kit: NPCS.outfit({ top: 'jacket', topColor: k ? '#1e3a6a' : '#3a2a1a', eyewear: 'sunglasses', headwear: 'none' }), route: [[at[0] + dx, at[1] + dz]], speed: 0, yaw: k ? Math.PI / 2 : -Math.PI / 2 }));
            for (const f of st.pair) { job.figs.push(f); NPCS.actOn(f, 'chat', 1e9); } st.g = BOTS.squad([[at[0] + 4, at[1] + 3, 1], [at[0] - 4, at[1] - 2, 4]], { tag, team }); st.p = 0; },
          done: () => near({ x: at[0], z: at[1] }, 60, 10), where: () => ({ x: at[0], y: 3, z: at[1], name: 'MEETING' }) },
        { text: 'Photograph them together: aim at them (Q / right mouse) from cover and hold steady. Don’t get seen', stealth: true, seen: 'Their guard saw you — they broke it up. Try again.',
          tick: (dt) => { const a = st.pair[0]; if (!a.alive || !st.pair[1].alive) return 'You were supposed to photograph them, not shoot them.'; const fw = camera.getWorldDirection(new V3()), dx = a.x - camera.position.x, dy = a.y + 1.6 - camera.position.y, dz = a.z - camera.position.z, L = Math.hypot(dx, dy, dz);
            const on = P.adsT > 0.7 && L < 70 && (fw.x * dx + fw.y * dy + fw.z * dz) / L > 0.994 && !COL.ray(camera.position, new V3(dx / L, dy / L, dz / L), L - 1);
            st.p = on ? st.p + dt : Math.max(0, st.p - dt * 0.6); return null; },
          done: () => st.p > 1.8, prompt: () => (st.p > 0 ? `HOLD STEADY  ${Math.round(st.p / 1.8 * 100)}%` : 'AIM AT THEM AND HOLD STILL'), where: () => ({ x: at[0], y: 2.6, z: at[1], name: 'MEETING' }) },
        { text: `Bring the photos to ${J.who.toLowerCase()} (E)`, act: () => near(g.f, 2.6), prompt: () => (near(g.f, 2.6) ? '[E]  HAND THEM OVER' : ''), where: () => ({ x: g.f.x, y: g.f.y + 2.2, z: g.f.z, name: J.who }) },
      ];
    }
    // delivery: against the clock, and company waiting at the other end
    const to = pickFar(home, 180, 360), mid = [(to[0] * 2 + home[0]) / 3, (to[1] * 2 + home[1]) / 3], team = TOWN.factionAt ? TOWN.factionAt(to[0], to[1]) : 'red';
    const limit = Math.round(d2(home, to) / 3.4 + 25);
    return [
      { text: `Take ${J.package} to ${J.recipient.toLowerCase()} before the clock runs out`, time: limit, late: 'Too late.',
        enter: () => { st.r = NPCS.spawnFigure({ kit: NPCS.outfit({ top: 'hoodie', topColor: '#5a6a7a' }), route: [[to[0], to[1]]], speed: 0 }); st.r.fig.lookAt = P.pos; job.figs.push(st.r); st.g = BOTS.squad([[to[0] + 5, to[1] + 4, 3], [to[0] - 6, to[1] + 2, 1], [mid[0], mid[1], 2]], { tag, team }); },
        act: () => near(st.r, 2.6), prompt: () => (near(st.r, 2.6) ? `[E]  HAND OVER ${J.package.replace('the ', '').toUpperCase()}` : ''), where: () => ({ x: to[0], y: 3, z: to[1], name: J.recipient }),
        tick: () => (st.r && !st.r.alive ? `${J.recipient} is dead.` : null),
        cut: () => C().talkShots(P.pos, st.r, [`${J.recipient}[give]: You came. They’ve been out there all day.`, `${J.recipient}: Tell them thank you. Here — for your trouble.`]) },
    ];
  }
  function start(g) {
    const steps = build(g);
    job = { g, J: g.J, steps, si: 0, timeLeft: 0, figs: [], tag: `job${g.id}` };
    enter();
    MISSION.ctx && feed(`<span class="s">SIDE JOB — ${g.J.title}</span>`);
  }
  function enter() { const s = job.steps[job.si]; job.timeLeft = s.time || 0; job.seen = 0; s.enter?.(); }
  function end() {
    if (!job) return;
    for (const f of job.figs) if (f) NPCS.removeFigure(f);
    for (const m of meshes.splice(0)) scene.remove(m);
    BOTS.clearSquads(job.tag); job = null; way.style.display = 'none'; setPrompt(prm, ''); panel.innerHTML = '';
  }
  function fail(msg) { if (!job) return; const who = job.J.who; end(); MISSION.ctx && feed(`<span class="m">JOB FAILED — ${msg}</span>`); panel.innerHTML = `<span style="opacity:.7">JOB FAILED · talk to ${who.toLowerCase()} to try again</span>`; setTimeout(() => { if (!job) panel.innerHTML = ''; }, 6000); }
  function finish() {
    const J = job.J, reward = { race: 500, bounty: 700, collect: 450, photo: 600, deliver: 500 }[J.kind];
    P.stats.score += reward; doneSet.add(job.g.id); save();
    feed(`<span class="s">JOB DONE — ${J.title} +${reward}</span>`); audio.switchMode();
    end(); panel.innerHTML = `<b style="color:#6ae0ff">✓ ${J.title}</b> +${reward}`; setTimeout(() => { if (!job) panel.innerHTML = ''; }, 6000);
  }
  function advance() { const s = job.steps[job.si]; job.si++; const go = () => { if (!job) return; if (job.si >= job.steps.length) finish(); else { enter(); audio.pouch(); } }; if (s.cut) CINEMA.play(s.cut(), go); else go(); }
  // ---- per frame ----
  const _p = new V3();
  function update(dt) {
    if (!MAP.ready || CINEMA.active) { way.style.display = 'none'; setPrompt(prm, ''); for (const b of bangs) b.style.display = 'none'; return; }
    if (!givers) { if (!(SCOOTER.list || []).length && (waitV = (waitV || 0) + 1) < 120) return; placeGivers(); }   // after the vehicles are out (races start beside one)
    const op = document.getElementById('objPanel'); if (op) panel.style.top = `${op.offsetTop + op.offsetHeight + 14}px`;
    // the ! over everyone with work going
    givers.forEach((g, i) => {
      const b = bangs[i] || (bangs[i] = el('position:absolute;transform:translate(-50%,-100%);font:700 26px Rajdhani,sans-serif;color:#6ae0ff;text-shadow:0 0 8px #000;display:none'));
      const show = !doneSet.has(g.id) && (!job || job.g !== g) && g.f.alive && Math.hypot(g.f.x - P.pos.x, g.f.z - P.pos.z) < 70;
      if (!show) { b.style.display = 'none'; return; }
      _p.set(g.f.x, g.f.y + 2.4, g.f.z).project(camera); if (_p.z > 1) { b.style.display = 'none'; return; }
      b.style.display = 'block'; b.style.left = `${(_p.x * 0.5 + 0.5) * innerWidth}px`; b.style.top = `${(-_p.y * 0.5 + 0.5) * innerHeight}px`; b.textContent = '!';
    });
    if (!job) {
      const g = offerNear(); setPrompt(prm, g ? `[E]  TALK TO ${g.J.who} — ${g.J.title}` : ''); way.style.display = 'none'; return;
    }
    if (P.dead) { fail('you went down.'); return; }
    const s = job.steps[job.si];
    let why = s.tick ? s.tick(dt) : null;
    if (!why && s.time && (job.timeLeft -= dt) <= 0) why = s.late || 'Out of time.';
    if (!why && s.stealth) { job.seen = BOTS.spotted ? job.seen + dt : Math.max(0, job.seen - dt); if (job.seen > 1.3) why = s.seen || 'They saw you.'; }
    if (why) { fail(why); return; }
    if (s.done && s.done()) { advance(); return; }
    const clock = s.time ? ` ⏱ ${Math.floor(job.timeLeft / 60)}:${String(Math.floor(job.timeLeft % 60)).padStart(2, '0')}` : '';
    panel.innerHTML = `SIDE JOB · ${job.J.title}<br><b style="color:#6ae0ff">▸ ${s.text}</b>${clock}`;
    setPrompt(prm, s.prompt ? s.prompt() : '');
    const t = s.where ? s.where() : null;
    if (!t) { way.style.display = 'none'; return; }
    _p.set(t.x, t.y ?? 1.5, t.z).project(camera);
    let x = _p.x, y = _p.y; const behind = _p.z > 1; if (behind) { x = -x; y = -y; }
    if (behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.88) { const k = 1 / Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.88, 1e-3); x *= k; y *= k; }
    way.style.display = 'block'; way.style.left = `${(x * 0.5 + 0.5) * innerWidth}px`; way.style.top = `${(-y * 0.5 + 0.5) * innerHeight}px`;
    way.innerHTML = `◇<br>${t.name} ${Math.round(Math.hypot(t.x - P.pos.x, t.z - P.pos.z))} m`;
  }
  const offerNear = () => (givers || []).find((g) => !doneSet.has(g.id) && g.f.alive && near(g.f, 2.6));
  function interact() {
    if (!MAP.ready || P.dead) return false;
    if (job) { const s = job.steps[job.si]; if (s.act && s.act()) { advance(); return true; } return false; }
    const g = offerNear(); if (!g) return false;
    CINEMA.play(C().talkShots(P.pos, g.f, [...g.J.offer, 'YOU: I’ll do it.']), () => start(g));
    return true;
  }
  return { get _job() { return job; }, update, interact, fail, get active() { return job ? job.J.title : null; }, get givers() { return givers; }, get done() { return [...doneSet]; } };
})();
