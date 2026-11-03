// =====================================================================
//  The campaigns, built out: every mission of every map, longer, harder and acted
// =====================================================================
// Each map's missions keep their story beats and gain new ones around them: getting in unseen past posted
// guards, firefights with squads that shoot back, escapes against the clock with the town on your heels, foot
// chases, tails, an investigation, searches and hacks (hold E), surveillance photos, escorts, holding a position
// until help comes, and choices (Y / K) that change what happens. Conversations are acted; checkpoints mean a
// failure or a death puts you back a step or two, not at the start.
function expandCampaign(id, M, ctx) {
  const { fig, live, near, kit, S, flags, talkShots, flyover, act, unact, walkTo, follow, squad, standing, lanePart, HV } = ctx;
  const F = flags;
  // ---- step kit ----
  const P3 = (x, z, y) => ({ x, z, y: y ?? 0 });
  const goal = (text, p, r = 6, name = 'HERE', o = {}) => ({ text, where: () => { const q = typeof p === 'function' ? p() : p; return q ? { x: q.x, y: (q.y ?? 0) + 2.5, z: q.z, name } : null; }, done: () => { const q = typeof p === 'function' ? p() : p; return !!q && near(q, r, o.dy ?? 4); }, ...o });
  const meet = (text, who, label, lines, o = {}) => ({ text, where: () => live(who(), o.name || 'CONTACT')(), act: () => near(who(), 2.8, 2.5), prompt: () => (near(who(), 2.8, 2.5) ? `[E]  ${label}` : ''), cut: () => talkShots(P.pos, who(), lines), ...o });
  const clear = (text, gs, name = 'HOSTILES', o = {}) => ({ text, where: () => { const g = (gs() || []).find((q) => !q.killed); return g ? { x: g.x, y: 2.5, z: g.z, name } : null; }, done: () => !!gs() && standing(gs()) === 0, ...o });
  const holdAt = (text, p, secs, label, o = {}) => ({ text, where: () => { const q = typeof p === 'function' ? p() : p; return { x: q.x, y: (q.y ?? 0) + 1.6, z: q.z, name: o.name || 'HERE' }; }, hold: { at: () => (typeof p === 'function' ? p() : p), secs, label, r: o.r ?? 2.4 }, ...o });
  const survive = (text, p, secs, r = 14, o = {}) => ({
    text: () => `${text} — ${Math.max(0, Math.ceil(F().sv ?? secs))} s`, where: () => ({ x: p.x, y: 2.5, z: p.z, name: 'HOLD HERE' }), ...o,
    enter: () => { F().sv = secs; F().out = 0; o.enter?.(); },
    tick: (dt) => { if (Math.hypot(P.pos.x - p.x, P.pos.z - p.z) > r) { F().out += dt; if (F().out > 10) return 'You gave up the position.'; } else { F().out = 0; F().sv -= dt; } return o.tick ? o.tick(dt) : null; },
    done: () => F().sv <= 0 });
  const escort = (text, who, p0, r = 7, name = 'SAFE', o = {}) => { const p = () => (typeof p0 === 'function' ? p0() : p0); return {
    text, where: () => ({ x: p().x, y: 2.5, z: p().z, name }), ...o,
    enter: () => { const f = who(); unact(f); f.fig.lookAt = null; o.enter?.(); },
    tick: (dt) => { const f = who(); if (!f.alive) return `${o.who || 'They'} didn’t make it.`; follow(f, dt); if (Math.hypot(f.x - P.pos.x, f.z - P.pos.z) > 45) return `You left ${o.who ? o.who.toLowerCase() : 'them'} behind.`; return o.tick ? o.tick(dt) : null; },
    done: () => near(p(), r, 4) && Math.hypot(who().x - p().x, who().z - p().z) < r + 5 }; };
  const tail = (text, who, route0, o = {}) => ({
    text, where: () => live(who(), o.name || 'TARGET')(), ...o,
    enter: () => { const f = who(), route = typeof route0 === 'function' ? route0() : route0; f.x = route[0][0]; f.z = route[0][1]; walkTo(f, route, o.speed ?? 1.25); F().lostT = F().closeT = 0; },
    tick: (dt) => { const f = who(), d = Math.hypot(f.x - P.pos.x, f.z - P.pos.z); F().lostT = d > (o.max ?? 40) ? F().lostT + dt : 0; F().closeT = d < (o.min ?? 5) || (!P.holstered && d < 12) ? F().closeT + dt : 0; if (F().lostT > 8) return 'You lost him — try again from where he started.'; if (F().closeT > 2.5) return 'He made you. Keep your distance, weapons hidden (H).'; return null; },
    done: () => who().arrived });
  const chase = (text, who, route, o = {}) => ({
    text, where: () => live(who(), o.name || 'RUNNER')(), ...o,
    enter: () => { const f = who(); walkTo(f, route, o.speed ?? 3.1); o.enter?.(); },
    tick: () => (who().arrived && who().alive ? (o.got || 'He got away.') : null),
    act: () => { const f = who(); if (f.alive && near(f, 2.4)) { walkTo(f, [[f.x, f.z]], 0); act(f, 'surrender', 999); audio.pouch(); return true; } return false; },
    prompt: () => (near(who(), 2.4) ? '[E]  GRAB HIM' : 'CATCH HIM — SHIFT TO SPRINT'), done: () => !who().alive });
  const photo = (text, who, o = {}) => ({
    text, where: () => live(who(), o.name || 'MEETING')(), stealth: o.stealth ?? true, ...o,
    enter: () => { F().ph = 0; o.enter?.(); },
    tick: (dt) => { const a = who(); if (!a.alive) return 'You were meant to photograph him.'; const fw = camera.getWorldDirection(new V3()), dx = a.x - camera.position.x, dy = a.y + 1.6 - camera.position.y, dz = a.z - camera.position.z, L = Math.hypot(dx, dy, dz); const on = P.adsT > 0.7 && L < 75 && (fw.x * dx + fw.y * dy + fw.z * dz) / L > 0.994 && !COL.ray(camera.position, new V3(dx / L, dy / L, dz / L), L - 1); F().ph = on ? F().ph + dt : Math.max(0, F().ph - dt * 0.6); return null; },
    prompt: () => (F().ph > 0 ? `HOLD STEADY  ${Math.round(F().ph / 2 * 100)}%` : 'AIM AT THEM (Q / RIGHT MOUSE) AND HOLD STILL'), done: () => F().ph > 2 });
  const wait = (text, secs, o = {}) => ({ text: () => `${text} — ${Math.max(0, Math.ceil(F().wt ?? secs))} s`, ...o, enter: () => { F().wt = secs; o.enter?.(); }, tick: (dt) => { F().wt -= dt; return o.tick ? o.tick(dt) : null; }, done: () => F().wt <= 0 });
  const choice = (text, a, b, o = {}) => ({ text, choice: { a, b, pick: o.pick, when: o.when }, where: o.where });
  const pressure = (n) => () => BOTS.setPressure(n);
  const nearestDoor = (room) => { let b = null, bd = 1e9; for (const d of TOWN.doors) if (d.room === room) { const q = Math.hypot(d.x - P.pos.x, d.z - P.pos.z); if (q < bd) { bd = q; b = d; } } return b; };
  const wrapSetup = (m, fn) => { const s0 = m.setup; m.setup = () => { s0?.(); fn(); }; };
  const wrapTeardown = (m) => { const t0 = m.teardown; m.teardown = () => { t0?.(); BOTS.setPressure(0); }; };
  const guardKit = { top: 'jacket', topColor: '#141414', pantsColor: '#141414', eyewear: 'sunglasses' };
  // cover blown: fail once (you're put back), then give it the 20 s the alarm takes to die down before it can fail you again
  const blown = () => { const now = performance.now(); if (!DISGUISE.blown || now < (F().bg || 0)) return null; F().bg = now + 22000; return 'They recognised you. Your cover is gone — wait for things to calm down, then try again.'; };

  // ======================= DAR ESSALAM =======================
  if (id === 'dar') {
    // 1 DEAD DROP: Samir at the square, Derb Lamia unseen, a fight at the riad door, the tannery's second copy, the clock to the handler
    { const m = M[0], o = m.steps; m.reward = 900;
      wrapSetup(m, () => { F().samir = fig({ kit: kit({ top: 'longsleeve', topColor: '#6a7a8a', headwear: 'none', facialHair: 'stubble' }), route: [[6, 5]], speed: 0, yaw: Math.PI }); F().samir.fig.lookAt = P.pos; F().watch = squad([[-98, 36, 1.5], [-104, 28, 0], [-116, 34, -1.2]], { profile: 'operator' }); });
      wrapTeardown(m);
      m.steps = [
        meet('Meet Samir, the courier’s friend, in Place Lalla Yeto (E)', () => F().samir, 'TALK TO SAMIR', ['SAMIR: You’re the one they sent? Good. Listen, because I say this once.', 'SAMIR[point]: The courier hid the case in Dar Lamia — the riad at the end of Derb Lamia.', 'SAMIR: The militia are searching that street house by house. If they see you, they’ll shoot first.', 'SAMIR[give]: Take this — the key to the riad’s side door. And watch the triangles over their heads.'], { name: 'SAMIR', cp: P3(4, 8) }),
        goal('Get to Dar Lamia without the militia seeing you', () => S().darLamiaDoor, 3, 'DAR LAMIA', { stealth: true, cp: P3(4, 8) }),
        { ...o[0], cp: () => ({ x: S().darLamiaDoor.x, z: S().darLamiaDoor.z }) },
        clear('They heard you upstairs. Fight your way out of Derb Lamia', () => F().door, 'MILITIA', { enter: () => { F().door = squad([[-102, 38, 0.5], [-112, 37, -0.3], [-100, 47, 2.5]], { profile: 'veteran' }); BOTS.setPressure(1); } }),
        holdAt('The courier kept a second copy. Search the drying vats on the tannery terrace', () => S().tanneryTerrace, 5, 'SEARCHING THE VATS', { name: 'TANNERY', cp: P3(-100, -100) }),
        { ...o[1], time: 200, late: 'Too slow — the handler had to move.', enter: pressure(2), cut: () => talkShots(P.pos, F().handler, ['HANDLER[listen]: Two copies. You went back for the second?', 'YOU: The courier didn’t trust anyone. Not even us.', 'HANDLER: Smart man. Pity about him.', 'HANDLER[point]: These papers name the man who runs the militia: Captain Haddad. He’s next.']) },
      ];
    }
    // 2 THE CAPTAIN: Bilal and a choice, the minaret door, the wait for the call to prayer, the shot, the escape out of the medina
    { const m = M[1], o = m.steps; m.reward = 1100;
      wrapSetup(m, () => { F().bilal = fig({ kit: kit({ top: 'longsleeve', topColor: '#e8e0d0', headwear: 'none' }), route: [[-37, -22]], speed: 0 }); F().bilal.fig.lookAt = P.pos; });
      wrapTeardown(m);
      m.steps = [
        meet('Find Bilal, the muezzin’s son, in the mosque forecourt (E)', () => F().bilal, 'TALK TO BILAL', ['BILAL: My father calls the prayer from that minaret. Haddad’s men took it last week.', 'BILAL: Two of them on the door. I can draw them off — but they’ll know someone helped you.'], { name: 'BILAL' }),
        choice('Bilal can pull the guards off the door — or you go in now', 'LET BILAL DRAW THEM OFF', 'GO IN NOW', { pick: (k) => { if (k === 0) { walkTo(F().bilal, [[-20, -14]], 2.4); feed('<span class="s">BILAL SHOUTS FROM THE SQUARE — THE GUARDS GO TO LOOK</span>'); } } }),
        clear('Take out the two guards on the minaret door', () => F().door, 'GUARDS', { skip: () => F().choice === 0, enter: () => { F().door = squad([[-31, -36, 0], [-35, -37, 0]], { profile: 'operator' }); } }),
        { ...o[0], cp: () => ({ x: S().minaretDoor.x + 2, z: S().minaretDoor.z + 4 }) },
        wait('Watch the HQ roof. Haddad comes out after the call to prayer', 14, { where: () => ({ x: 140, y: 9.5, z: -60, name: 'HQ ROOF' }), tick: () => (P.pos.y < 18 ? 'You came down too soon.' : null) }),
        o[1], o[2],
        goal('The whole medina is looking for the shooter. Get out through Bab Zerka', () => S()['Bab Zerka'], 10, 'BAB ZERKA', { time: 170, late: 'They closed the gate before you got there.', enter: pressure(2), cp: () => ({ x: S().minaretDoor.x + 2, z: S().minaretDoor.z + 4 }) }),
      ];
      m.outro = () => [{ from: [-150, 4, 10], to: [-160, 6, 18], look: [-60, 20, -32], dur: 5, say: HV('Haddad’s dead. His papers are still in the kasbah safe — and someone will want them before we do.'), fov: 50 }];
    }
    // 3 WOLF IN WOLF'S CLOTHING: the gate sergeant, the safe (hold E), the roster on the roof, out, Leila in the garden
    { const m = M[2], o = m.steps; m.reward = 1200;
      wrapSetup(m, () => { const g = S().kasbahGate; F().sgt = fig({ kit: kit({ top: 'jacket', topColor: '#3a3f2a', pantsColor: '#3a3f2a', headwear: 'cap', hatColor: '#3a3f2a', facialHair: 'beard' }), route: [[g.x - 5, g.z + 2]], speed: 0 }); F().sgt.fig.lookAt = P.pos; F().leila = fig({ kit: kit({ top: 'jacket', topColor: '#2a3a5a', eyewear: 'sunglasses', hair: 'long' }), route: [[95, 40]], speed: 0 }); F().leila.fig.lookAt = P.pos; });
      m.steps = [
        { ...o[0], cp: () => ({ x: S().kasbahGate.x - 30, z: S().kasbahGate.z + 6 }) },
        meet('Report to the sergeant at the kasbah gate (E) — act like you belong', () => F().sgt, 'REPORT', ['SERGEANT: You. I don’t know your face.', 'YOU: Transferred from the north post this morning.', 'SERGEANT[point]: Then you’re late. Upstairs in HQ — the captain’s office needs clearing out. Move.'], { name: 'SERGEANT', tick: blown, cp: () => ({ x: S().kasbahGate.x - 12, z: S().kasbahGate.z + 2 }) }),
        holdAt('Crack the safe in the captain’s office upstairs — weapons hidden', () => S().hqSafe, 7, 'CRACKING THE SAFE', { name: 'SAFE', r: 2.2, tick: blown }),
        holdAt('Copy the duty roster pinned up on the HQ roof', () => S().hqRoof, 4, 'COPYING THE ROSTER', { name: 'ROSTER', r: 3, tick: blown }),
        { ...o[2], tick: blown },
        meet('Bring the papers to Leila in the Jardin du Mellah (E)', () => F().leila, 'HAND OVER THE PAPERS', ['LEILA[listen]: You walked into the kasbah in their own uniform. You’re either brave or stupid.', 'LEILA: These say Haddad answered to someone. A courier carries his messages — green cap, through the souk.', 'LEILA[point]: Follow the courier and you’ll find who’s really paying for all this.'], { name: 'LEILA' }),
      ];
    }
    // 4 MARKET TAIL: the tail, then make the contact talk or take him down, the warehouse unseen, the manifest, the run
    { const m = M[3], o = m.steps; m.reward = 1300; const reset0 = m.reset;
      wrapTeardown(m);
      m.steps = [
        o[0], o[1],
        choice('That’s his contact by the tannery steps. Make him talk — or take him down', 'GET THE DROP ON HIM', 'TAKE HIM DOWN', { where: () => live(F().contact, 'CONTACT')() }),
        { text: 'Get behind him and grab him (E)', skip: () => F().choice !== 0, where: () => live(F().contact, 'CONTACT')(), act: () => { const c = F().contact; return c.alive && near(c, 2) && ctx.behind(c); }, prompt: () => (near(F().contact, 2) ? (ctx.behind(F().contact) ? '[E]  GRAB HIM' : 'GET BEHIND HIM') : ''),
          cut: () => talkShots(P.pos, F().contact, ['CONTACT[surrender]: Easy! Easy. I just carry things.', 'YOU: Where to?', 'CONTACT[surrender]: The warehouse on the quay. The office upstairs. Everything goes through there — guns, money, names.', 'CONTACT[surrender]: Please. They’ll kill me for this.']) },
        { ...o[2], skip: () => F().choice === 0 }, { ...o[3], skip: () => F().choice === 0, cut: () => [{ from: [P.pos.x + 2, 2.2, P.pos.z + 2], to: [P.pos.x + 1.5, 1.8, P.pos.z + 1.5], look: [P.pos.x, 0.6, P.pos.z], dur: 4, say: 'YOU: A warehouse address on the quay. And a key.', fov: 45 }] },
        goal('Get into the warehouse office on the quay: sneak in, or put on a docker’s clothes (knock one out, F then E) and walk in — weapons hidden', () => S().warehouseOffice, 3, 'OFFICE', { dy: 2.5, enter: () => { if (!F().wh) F().wh = squad([[106, 97, 1], [122, 99, -1], [121, 84, 3]], { profile: 'operator' }); if (!F().dk) F().dk = fig({ kit: kit({ top: 'tshirt', topColor: '#6a6a5a', headwear: 'beanie', hatColor: '#3a3a3a' }), route: [[98, 90, 4], [102, 84, 5]], loop: true, speed: 0.6 }); }, tick: () => (BOTS.spotted && !P.disguise ? (F().sp = (F().sp || 0) + 1 / 60) > 1.3 ? 'They saw you. Try the docker’s clothes.' : null : null), cp: P3(96, 60) }),
        holdAt('Copy the shipping manifest', () => S().warehouseOffice, 6, 'COPYING THE MANIFEST', { name: 'MANIFEST' }),
        goal('The dockers saw the light. Get back into the medina — Rahba Kedima', P3(-51, -87), 10, 'RAHBA KEDIMA', { time: 210, enter: pressure(2), cut: () => [{ from: [-40, 8, -70], to: [-48, 5, -80], look: [-51, 1.5, -87], dur: 5, say: HV('The manifest. Guns in, people out — and every payment signed off by a broker in Seoul. That’s where this goes next.'), fov: 50 }] }),
      ];
      m.reset = (step) => (reset0 ? reset0(step) : step);
    }
    // 5 EXFIL: the handler with you, an ambush on the quay, hold the jetty until the boat comes
    { const m = M[4], o = m.steps; m.reward = 1500;
      wrapSetup(m, () => { F().h = fig({ kit: kit({ top: 'longsleeve', topColor: '#e8e0d0', headwear: 'boonie', hatColor: '#c8b890' }), route: [[3, -3]], speed: 0 }); F().h.fig.lookAt = P.pos; });
      m.steps = [
        meet('Find your handler in Place Lalla Yeto (E)', () => F().h, 'LET’S GO', ['HANDLER: They’ve got my name now too. I’m coming with you.', 'HANDLER[point]: The harbour. Stay close to me and don’t stop for anything.'], { name: 'HANDLER', cp: P3(5, 6) }),
        escort('Get the handler to the quay — stay together', () => F().h, P3(58, 98), 9, 'QUAY', { who: 'The handler', cp: P3(5, 6) }),
        clear('An ambush on the quay. Clear it', () => F().amb, 'AMBUSH', { enter: () => { F().amb = squad([[44, 104, 0], [54, 108, 0.4], [68, 103, -0.3], [76, 108, 0]], { profile: 'veteran' }); }, tick: (dt) => { follow(F().h, dt); return F().h.alive ? null : 'The handler didn’t make it.'; } }),
        survive('Hold the jetty until the boat comes', P3(64, 150), 40, 14, { tick: (dt) => { follow(F().h, dt); return null; } }),
        o[0],
      ];
      m.outro = () => [{ from: [64, 3, 170], to: [60, 6, 200], look: [0, 10, 0], dur: 6, say: HV('Dar Essalam’s behind us. Haddad, the papers, the warehouse — all of it paid from Seoul.'), fov: 52 }, { from: [60, 6, 200], to: [40, 30, 260], look: [0, 10, 0], dur: 5, say: HV('Get some sleep on the boat. You fly tomorrow.'), fov: 52 }];
    }
  }

  // ======================= NEON SEOUL =======================
  if (id === 'seoul') {
    // 1 THE BROKER'S DRIVE: the informant, tail the bag man, quiet or loud at the tent, the drive, the run underground
    { const m = M[0], o = m.steps; m.reward = 1200;
      const lx = -0.6, lz = -48.5;
      wrapSetup(m, () => { F().bag = fig({ kit: kit({ top: 'hoodie', topColor: '#3a3a42', headwear: 'beanie', hatColor: '#1a1a1a' }), route: [[9, -9]], speed: 0 }); F().bag.fig.paused = true; });
      wrapTeardown(m);
      const T = TOWN.lanes;
      m.steps = [
        { ...o[0], cut: () => talkShots(P.pos, F().informant, ['INFORMANT[listen]: You’re late. The broker already sold it.', 'YOU: To who?', 'INFORMANT[point]: See the man in the beanie outside? He carried the money. Follow him — he’ll walk you straight to the buyer.', 'INFORMANT: Don’t let him see you. He’s jumpy.']), cp: P3(7, -6) },
        tail('Follow the bag man (beanie) — within 40 m, never closer than 5, weapons hidden', () => F().bag, () => [[9, -9], ...(T.foodAlley ? lanePart(T.foodAlley, [0, -12], [lx, lz + 5]) : [[0, -30]]), [lx + 1.5, lz + 4]], { name: 'BAG MAN', cp: P3(7, -6) }),
        choice('He handed the money to a Dragon lieutenant (sunglasses) eating at the tent. Quietly, or loud?', 'WAIT TILL HE’S ALONE', 'GO IN LOUD', { where: () => live(F().lt, 'LIEUTENANT')(), pick: (k) => { if (k === 0) { walkTo(F().lt, T.foodAlley ? lanePart(T.foodAlley, [lx, lz], [lx, lz - 26]) : [[lx, lz - 20]], 1.0); F().quiet = true; } else { F().gang = squad([[lx + 4, lz - 2, 0], [lx - 4, lz + 3, 2], [lx + 3, lz + 6, 3]], { profile: 'veteran' }); BOTS.setPressure(1); } } }),
        { ...o[1], text: () => (F().quiet ? 'He’s walking off alone to make a call. Take him down before he gets back' : 'Take the lieutenant down — his crew will fight'), stealth: false, enter: () => { if (F().quiet) setTimeout(() => act(F().lt, 'call', 999), 9000); } },
        o[2],
        { ...o[3], time: 160, late: 'They cut you off before the subway.' },
      ];
    }
    // 2 NORAEBANG: Moth, a hardware key from a PC bang, hold the karaoke door while he works
    { const m = M[1], o = m.steps; m.reward = 1100;
      wrapTeardown(m);
      m.steps = [
        o[0], { ...o[1], cut: () => talkShots(P.pos, F().moth, ['MOTH[listen]: You sing?', 'YOU: Not tonight.', 'MOTH[give]: Shame. Give it here… huh. Two keys. One I can break — if I had a hardware key. The Dragons keep one behind the counter of their PC bang.', 'MOTH[point]: Get it, bring it here. The other key is on a phone. One thing at a time.']) },
        { text: 'Get the hardware key from behind the counter of any PC bang (PC방)', where: () => { const d = nearestDoor('pc'); return d && !DOORS.inside ? { x: d.x, y: 3, z: d.z, name: 'PC방' } : null; }, hold: { at: () => ROOMS.pc ? { x: ROOMS.pc.x, y: 0, z: ROOMS.pc.z } : P.pos, secs: 5, label: 'PICKING THE COUNTER LOCK', r: 7 }, cp: () => ({ x: P.pos.x, z: P.pos.z }) },
        { text: 'Take it back to Moth in the karaoke bar', where: () => { const d = nearestDoor('karaoke'); return DOORS.room !== 'karaoke' && d ? { x: d.x, y: 3, z: d.z, name: '노래방' } : live(F().moth, 'MOTH')(); }, act: () => near(F().moth, 2.8), prompt: () => (near(F().moth, 2.8) ? '[E]  GIVE MOTH THE KEY' : ''), cut: () => talkShots(P.pos, F().moth, ['MOTH[give]: Perfect. This takes a minute.', 'MOTH[point]: …and you were followed. Dragons, outside. Keep them off me till I’m done.']) },
        { text: 'Get outside', done: () => !DOORS.inside, where: () => null },
        survive('Hold the karaoke door while Moth breaks the first key', P3(0, 0), 45, 16, { enter: () => { const p = { x: P.pos.x, z: P.pos.z }; F().kp = p; m.steps[m.steps.length - 1].where = () => ({ x: p.x, y: 2.5, z: p.z, name: 'HOLD HERE' }); F().dr = squad([[p.x + 16, p.z + 6, 0], [p.x - 15, p.z + 8, 0], [p.x + 10, p.z - 14, 0], [p.x - 12, p.z - 12, 0]], { profile: 'operator' }); BOTS.setPressure(2); } }),
      ];
      // the hold point is wherever you came out of the bar
      const sv = m.steps[m.steps.length - 1], t0 = sv.tick; sv.tick = (dt) => { const p = F().kp; if (p && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) > 16) { F().out += dt; if (F().out > 10) return 'You left Moth on his own.'; } else { F().out = 0; F().sv -= dt; } return null; };
      m.outro = () => [{ from: [P.pos.x + 4, 3, P.pos.z + 4], to: [P.pos.x + 2, 2.4, P.pos.z + 2], look: [P.pos.x, 1.6, P.pos.z], dur: 4.5, say: 'MOTH: First key’s done. The second’s on the Blue Snake captain’s phone, in Gangnam.', fov: 48 }];
    }
    // 3 SNAKE'S PHONE: get close unseen, lift it, upload it (hold), then photograph who the Dragon boss meets by the river
    { const m = M[2], o = m.steps; m.reward = 1400;
      const cx = 205, cz = 26;
      wrapSetup(m, () => { F().look = squad([[cx - 12, cz - 8, 1], [cx + 13, cz + 9, -1], [cx + 9, cz - 12, 3]], { profile: 'operator', team: 'gold' }); F().boss = fig({ kit: kit({ top: 'jacket', topColor: '#0e0e10', pantsColor: '#0e0e10', eyewear: 'sunglasses', hair: 'short', facialHair: 'stubble' }), route: [[120, 196]], speed: 0, yaw: Math.PI / 2 }); F().env = fig({ kit: kit({ top: 'longsleeve', topColor: '#e8e4dc', pantsColor: '#2a2a30', headwear: 'none' }), route: [[121.5, 196.2]], speed: 0, yaw: -Math.PI / 2 }); });
      wrapTeardown(m);
      m.steps = [
        o[0],
        goal('Get within reach of him without his lookouts seeing you', () => F().cap, 6, 'CAPTAIN', { stealth: true, cp: P3(cx - 40, cz + 10) }),
        o[1],
        { ...o[2], act: undefined, prompt: undefined, hold: { at: () => ROOMS.pc ? { x: ROOMS.pc.x, y: 0, z: ROOMS.pc.z } : P.pos, secs: 6, label: 'UPLOADING', r: 7 }, time: 200, late: 'The Snakes found you first.', enter: pressure(2) },
        photo('Moth traced the Dragon boss: he’s meeting someone by the river in Hangang Park. Photograph them together, unseen', () => F().boss, { name: 'MEETING', enter: () => { F().ph = 0; act(F().boss, 'chat', 1e9); act(F().env, 'listen', 1e9); if (!F().rg) F().rg = squad([[112, 190, 1], [130, 202, -1]], { profile: 'operator' }); BOTS.setPressure(0); }, cp: P3(90, 170),
          cut: () => [{ from: [P.pos.x, P.pos.y + 1.6, P.pos.z], to: [P.pos.x + 0.2, P.pos.y + 1.6, P.pos.z + 0.2], look: [120.7, 1.7, 196.1], dur: 4, say: 'HANDLER: The man in the white shirt. I know him. He works for us.', fov: 22 }, { from: [P.pos.x + 3, P.pos.y + 2, P.pos.z + 3], to: [P.pos.x + 2, P.pos.y + 2, P.pos.z + 2], look: [120.7, 1.7, 196.1], dur: 4.5, say: 'HANDLER: Cassius’s errand boy. So the Dragons have a friend inside our own house.', fov: 40 }] }),
      ];
    }
    // 4 LAST TRAIN: underground, the exit fight, the boat against the clock
    { const m = M[3], o = m.steps; m.reward = 1600;
      m.steps = [
        o[0], o[1],
        clear('The Snakes are waiting at the exit. Fight through', () => F().ex, 'SNAKES', { enter: () => { const s = LINE2[4]; F().ex = squad([[s.x + 8, s.z + 4, 0], [s.x - 8, s.z + 6, 0], [s.x + 4, s.z + 12, 0], [s.x - 6, s.z - 8, 0]], { profile: 'veteran', team: 'gold' }); }, cp: () => ({ x: LINE2[4].x + 2, z: LINE2[4].z + 2 }) }),
        { ...o[2], time: 140, late: 'The boat couldn’t wait.' },
      ];
    }
  }

  // ======================= RAVENSCROFT =======================
  if (id === 'manor') {
    // 1 THE GUEST LIST: inside, dressed, the sommelier (and how you treat him), the diary, a bug in security, back to the lawn
    { const m = M[0], o = m.steps; m.reward = 1200;
      m.steps = [
        o[0], o[1],
        { ...o[2], cut: () => talkShots(P.pos, F().contact, ['SOMMELIER[listen]: Red or white, sir?', 'YOU: Whatever Ashdown is hiding.', 'SOMMELIER[point]: Upstairs. The study, east side of the landing. A safe behind the portrait of his father.', 'SOMMELIER: The code changes every night. His secretary keeps it in her diary — red dress, in the ballroom.']), tick: blown, cp: P3(30, 120) },
        { ...o[3], tick: blown },
        holdAt('Plant a bug in the security office upstairs, so we hear them coming', () => S().security, 5, 'PLANTING THE BUG', { name: 'SECURITY', r: 2.6, tick: blown }),
        goal('Back out to the marquee before anyone misses you', P3(64, 50), 8, 'MARQUEE', { time: 90, tick: blown, cut: () => talkShots(P.pos, F().contact, ['SOMMELIER: You’re still alive. Good.', 'SOMMELIER[point]: Ashdown goes up to the study at midnight. Be there before him.']) }),
      ];
    }
    // 2 THE LEDGER: the breakers, upstairs in the dark, the safe (hold), the pages, Ashdown — talk or shoot
    { const m = M[1], o = m.steps; m.reward = 1500;
      wrapSetup(m, () => { F().ash = fig({ kit: kit({ top: 'jacket', topColor: '#1a1a1e', pantsColor: '#1a1a1e', hair: 'short', hairColor: '#b8b0a8', facialHair: 'none' }), route: [[S().study.x - 6, S().study.z + 3]], y: S().study.y, speed: 0 }); F().ash.fig.paused = true; });
      wrapTeardown(m);
      m.steps = [
        { text: 'Kill the lights: pull the breakers in the generator house (E at its door, then hold E)', where: () => { const d = nearestDoor('genhouse'); return d && !DOORS.inside ? { x: d.x, y: 3, z: d.z, name: 'GENERATOR' } : null; }, hold: { at: () => ROOMS.genhouse ? { x: ROOMS.genhouse.x, y: 0, z: ROOMS.genhouse.z } : P.pos, secs: 5, label: 'PULLING THE BREAKERS', r: 7 }, cp: P3(150, -20) },
        { ...o[0], time: 150, late: 'The lights came back on before you got there.', enter: () => feed('<span class="s">THE HOUSE GOES DARK</span>') },
        { ...o[1], act: undefined, prompt: undefined, hold: { at: () => S().safe, secs: 6, label: '4 · 1 · 7 · 9 — OPENING', r: 2.4 }, cp: () => ({ x: S().study.x, y: S().study.y, z: S().study.z }) },
        holdAt('Photograph every page of the ledger', () => S().safe, 4, 'PHOTOGRAPHING', { name: 'LEDGER', r: 2.6 }),
        { text: 'Someone’s at the door', done: () => true, cut: () => { const a = F().ash; a.x = S().study.x - 2.2; a.z = S().study.z + 1.5; return talkShots(P.pos, a, ['ASHDOWN[aim]: Put it down. That book is the only thing keeping a great many people honest.', 'YOU: Honest?', 'ASHDOWN[aim]: Bought. Same thing. Every name in it was sold to me by a man called Kane — and Kane answers to someone even I won’t name.']); } },
        choice('Ashdown has a gun on you', 'TALK HIM DOWN', 'SHOOT FIRST', { pick: (k) => { if (k === 0) act(F().ash, 'surrender', 999); else { F().ash.alive && F().ash.fig && act(F().ash, 'aim', 999); } } }),
        { text: 'Take Ashdown down before he fires', skip: () => F().choice === 0, where: () => live(F().ash, 'ASHDOWN')(), done: () => !F().ash.alive, time: 6, late: 'He fired first.' },
        { text: 'Hear him out (E)', skip: () => F().choice === 1, where: () => live(F().ash, 'ASHDOWN')(), act: () => near(F().ash, 3, 2), prompt: () => (near(F().ash, 3, 2) ? '[E]  “TALK.”' : ''), cut: () => talkShots(P.pos, F().ash, ['ASHDOWN[surrender]: Kane. Victor Kane, in the Bahamas. He banks for everyone — Haddad, the Dragons, me.', 'ASHDOWN[surrender]: And he takes his orders from inside your own service. Ask your handler who signs them.']) },
      ];
    }
    // 3 OUT BY WATER: fight out of the house, the boathouse against the clock, hold the jetty till the boat's ready
    { const m = M[2], o = m.steps; m.reward = 1700;
      m.steps = [
        clear('Security’s locked the house down. Fight your way out onto the terrace', () => F().ter, 'SECURITY', { enter: () => { F().ter = squad([[0, -72, 0], [12, -74, 0], [-12, -73, 0], [24, -78, 0], [-24, -77, 0]], { profile: 'veteran' }); }, cp: P3(0, -40) }),
        { ...o[0], time: 120, late: 'They cut you off from the lake.', cp: P3(30, -80) },
        survive('Hold the jetty while the boat’s made ready', P3(108, -100), 35, 12),
        o[1],
      ];
    }
  }

  // ======================= THE BAHAMAS =======================
  if (id === 'bahamas') {
    // 1 ISLAND TIME: watchers on the cottage lane, the search under the bed (hold), and Kane's men on the way back
    { const m = M[0], o = m.steps; m.reward = 1100;
      wrapSetup(m, () => { const d = F().door; if (d) F().w = squad([[d.ox + 9, d.oz + 6, 0], [d.ox - 10, d.oz + 4, 0]], { profile: 'operator' }); });
      wrapTeardown(m);
      m.steps = [
        o[0], { ...o[1], cp: P3(-2, -100) },
        { ...o[2], text: 'Get into Delia’s cottage without the men watching the lane seeing you', stealth: true },
        { ...o[3], act: undefined, prompt: undefined, hold: { at: () => ({ x: ROOMS.cottage.x - 3.4, y: 0, z: ROOMS.cottage.z + 2.2 }), secs: 4, label: 'FEELING UNDER THE BED', r: 2.4 } },
        clear('The watchers saw you come out. Deal with them', () => F().w, 'KANE’S MEN', { enter: () => BOTS.setPressure(1) }),
        o[4],
      ];
    }
    // 2 THE FISHERMAN: confront the collector — he runs — catch him, spare him or not, his heavies, then Errol and the jetski
    { const m = M[1], o = m.steps; m.reward = 1300;
      wrapTeardown(m);
      m.steps = [
        o[0],
        meet('Confront Kane’s collector at the conch shacks (E)', () => F().collector, '“WE NEED TO TALK.”', ['COLLECTOR[listen]: Who are you supposed to be?', 'YOU: Someone who’s going to make you stop.', 'COLLECTOR[point]: Boys —'], { name: 'COLLECTOR', cp: P3(-100, -112) }),
        chase('He’s running for his boat at the end of the west jetty — catch him', () => F().collector, [[-130, -118], [-140, -135], [-140, -150], [-140, -168]], { name: 'COLLECTOR', enter: () => { walkTo(F().collector, [[-130, -118], [-140, -135], [-140, -150], [-140, -168]], 3.0); F().hv = squad([[-118, -110, 0], [-102, -112, 0], [-88, -110, 0]], { profile: 'operator' }); BOTS.setPressure(1); } }),
        choice('You’ve got him', 'LET HIM GO — HE TELLS KANE NOTHING', 'FINISH IT', { pick: (k) => { const c = F().collector; if (k === 0) { unact(c); walkTo(c, [[-140, -168]], 2.6); feed('<span class="s">HE WON’T BE BACK</span>'); } else { c.alive = false; c.fig.onDeath?.(c, 'torso'); } } }),
        clear('His heavies are still on the quay. Finish it', () => F().hv, 'HEAVIES'),
        { ...o[2], cut: () => talkShots(P.pos, F().errol, ['ERROL[listen]: Forty years I been waiting for somebody to do that.', 'ERROL[point]: Two grey boats go round Kane’s island, slow, and pass his dock every four minutes. Go in behind one.', 'ERROL[give]: Take the jetski at the end of my jetty. Tell the hotel you found it.']) },
        o[3],
      ];
    }
    // 3 KANE'S ISLAND: unseen to the house, the phone, the laptop (hold), and off the island against the clock
    { const m = M[2], o = m.steps; m.reward = 1600;
      wrapTeardown(m);
      m.steps = [
        { ...o[0], cp: P3(-80, -162) },
        goal('Get up to the house without Kane’s guards seeing you', () => S().kaneTerrace, 16, 'TERRACE', { stealth: true, cp: () => ({ x: S().privateDock.x, y: 0.6, z: S().privateDock.z }) }),
        o[1],
        { ...o[2], act: undefined, prompt: undefined, hold: { at: () => S().laptop, secs: 6, label: 'UNLOCKING WITH HIS PHONE', r: 2.6 } },
        goal('They know. Get back to your jetski on the dock', () => S().privateDock, 12, 'DOCK', { time: 100, late: 'They cut you off from the dock.', enter: pressure(3) }),
        { ...o[3], enter: () => BOTS.setPressure(1) },
      ];
    }
    // 4 THE LIGHTHOUSE: three people saw something, the approach unseen, the men holding her, the ropes (hold), get her out
    { const m = M[3], o = m.steps; m.reward = 1700;
      wrapSetup(m, () => {
        const b = S().beachBar, mk = S().market, hj = S().harbourJetty;
        F().barback = fig({ kit: kit({ top: 'tshirt', topColor: '#2ab0b0' }), route: [[b.x - 2, b.z + 1]], y: b.y, speed: 0 });
        F().kid = fig({ kit: kit({ top: 'tshirt', topColor: '#f0c040', headwear: 'cap', hatColor: '#c84a3a' }), route: [[mk.x + 3, mk.z + 2]], speed: 0 });
        F().fisher = fig({ kit: kit({ top: 'longsleeve', topColor: '#6a8ab0', headwear: 'boonie', hatColor: '#c8b890', facialHair: 'beard', hairColor: '#d8d8d0' }), route: [[hj.x + 0.6, hj.z]], y: 0.55, speed: 0 });
        for (const f of [F().barback, F().kid, F().fisher]) f.fig.lookAt = P.pos;
        const lx = S().lighthouse.x, lz = S().lighthouse.z; F().lg = squad([[lx - 14, lz + 10, 0], [lx - 8, lz - 10, 0], [lx - 18, lz - 2, 0], [lx + 2, lz + 12, 0]], { profile: 'veteran' });
      });
      wrapTeardown(m);
      const lx = 240, lz = -10;   // the lighthouse on the east point
      m.steps = [
        meet('Ask the barback what he saw (E)', () => F().barback, 'ASK', ['BARBACK[point]: They took her out the back. Grey boat. Went east.', 'BARBACK: Ask the kid at the straw market — he watches every boat.'], { name: 'BARBACK' }),
        meet('Ask the kid at the straw market (E)', () => F().kid, 'ASK', ['KID: A grey boat? Kane’s. It went round the point, toward the lighthouse.', 'KID[point]: But Errol said it didn’t come back. Ask Errol.'], { name: 'KID' }),
        meet('Ask Errol on the harbour jetty (E)', () => F().fisher, 'ASK', ['ERROL[listen]: The lighthouse. Four of Kane’s men, maybe five. And they’re waiting for somebody.', 'ERROL[point]: Come at it from the palms on the north side. They watch the sea, not the trees.'], { name: 'ERROL', cp: P3(-100, -130) }),
        goal('Get close to the lighthouse through the palms without being seen', P3(lx - 22, lz + 8), 6, 'THE PALMS', { stealth: true, cp: P3(lx - 90, lz + 20) }),
        clear('Take out the men guarding the lighthouse', () => F().lg, 'KANE’S MEN', { cp: P3(lx - 40, lz + 15) }),
        { ...o[1], text: 'And the ones holding Marisol' },
        { ...o[2], act: undefined, prompt: undefined, hold: { at: () => F().hostage, secs: 3, label: 'CUTTING THE ROPES', r: 2.4 } },
        escort('Get Marisol back to the Conch Bar', () => F().hostage, () => S().beachBar, 9, 'CONCH BAR', { who: 'Marisol', enter: pressure(1),
          cut: () => talkShots(P.pos, F().hostage, ['MARISOL: They were waiting for a call. Someone called Cassius.', 'MARISOL[point]: Delia’s waiting at the end of the hotel pier. She says the seaplane leaves with or without you.']) }),
      ];
    }
    // 5 THE SEAPLANE: Delia with you to the jetskis, then across with Kane's boats on you
    { const m = M[4], o = m.steps; m.reward = 2000;
      m.steps = [
        o[0],
        escort('Walk Delia down the pier to the jetski rental — stay with her', () => F().delia, () => S().rental, 6, 'JETSKIS', { who: 'Delia', cp: P3(0, 250) }),
        o[1],
        { ...o[2], time: 190, late: 'The seaplane had to go without you.' },
      ];
    }
  }
  return M;
}
