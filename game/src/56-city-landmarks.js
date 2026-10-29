// =====================================================================
//  CITY — landmarks: the civic palace + clock tower, ramparts & gates, minaret, mosque, station
// =====================================================================

// ---------------- DAR AL-MAKHZEN: civic palace around an Andalusian garden ----------------
// local frame: front (+Z) is the ceremonial facade. W × D footprint on a raised stone plinth.
function civicPalace(cx, cz, ry) {
  const Wd = 104, D = 84, depth = 14, gal = 3.6, T = 0.6, P = 1.5;          // footprint, wing depth, gallery, walls, plinth
  const H = [6.0, 5.0, 4.5], Y = [P + G0]; for (let i = 0; i < 3; i++) Y.push(Y[i] + H[i]);
  const col = 0xd59d78, stone = 0xcdb28a, zelW = 0;
  const cx0 = -Wd / 2 + depth, cx1 = Wd / 2 - depth, cz0 = -D / 2 + depth, cz1 = D / 2 - depth;
  W.push(cx, 0, cz, ry);
  // plinth with a grand stair to the front and side stairs
  W.box(Wd + 14, P, D + 14, 0, P / 2, 0, stone, { t: TX.stone, wear: 3 }); W.solid(Wd + 14, P, D + 14, 0, P / 2, 0, 'stone', { walk: true });
  W.box(Wd + 14.4, 0.12, D + 14.4, 0, P + 0.02, 0, MC.stone, { t: TX.paving, wear: 2, ao: false });
  flight(0, D / 2 + 7 + 8 * ST_RUN + 0.2, [0, -1], 24, 0, P, { col: stone, tx: TX.stone, run: ST_RUN, soffit: false, thick: 9 });
  for (const s of [-1, 1]) { flight(s * (Wd / 2 + 7 + 8 * ST_RUN + 0.2), 0, [-s, 0], 8, 0, P, { col: stone, tx: TX.stone, soffit: false, thick: 9 }); }
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { lampPostOld(s * (14 + i * 9), P, D / 2 + 5.5, 4.6); }
  // wings → rooms per floor
  const wings = [
    { name: 's', r: [-Wd / 2, cz1, Wd / 2, D / 2], galSide: 'n' },
    { name: 'n', r: [-Wd / 2, -D / 2, Wd / 2, cz0], galSide: 's' },
    { name: 'w', r: [-Wd / 2, cz0, cx0, cz1], galSide: 'e' },
    { name: 'e', r: [cx1, cz0, Wd / 2, cz1], galSide: 'w' },
  ];
  // stair cores (U-stairs) in the south-west and north-east wings, ground → roof
  const cores = [{ x0: -Wd / 2 + 16, zf: D / 2 - T, zb: D / 2 - T - 6.4, w: 3.0 }, { x0: Wd / 2 - 20, zf: -D / 2 + T, zb: -D / 2 + T + 6.4, w: 3.0 }];
  const coreRect = (c) => [c.x0, Math.min(c.zf, c.zb), c.x0 + c.w, Math.max(c.zf, c.zb)];
  for (let f = 0; f < 3; f++) {
    const y = Y[f], h = H[f], rooms = [], doors = [];
    for (const wg of wings) {
      const [x0, z0, x1, z1] = wg.r;
      // gallery strip on the courtyard side
      let g, band;
      if (wg.galSide === 'n') { g = [x0, z0, x1, z0 + gal]; band = [x0, z0 + gal, x1, z1]; }
      else if (wg.galSide === 's') { g = [x0, z1 - gal, x1, z1]; band = [x0, z0, x1, z1 - gal]; }
      else if (wg.galSide === 'e') { g = [x1 - gal, z0, x1, z1]; band = [x0, z0, x1 - gal, z1]; }
      else { g = [x0, z0, x0 + gal, z1]; band = [x0 + gal, z0, x1, z1]; }
      // the east/west galleries join the north/south ones (they are corridors: keep them as rooms)
      rooms.push(mkRoom(g, y, h, 'hall', { paint: 0xe8dcc4, wallTx: TX.tadelakt, gallery: wg.name, light: false }));
      // split the outer band along its length into rooms of 8–13 m
      const along = wg.name === 's' || wg.name === 'n';
      const a0 = along ? band[0] : band[1], a1 = along ? band[2] : band[3];
      let a = a0; const cuts = [];
      while (a1 - a > 15) { a += mr(8, 13); if (wg.name === 's' && a > -6.5 && a < 6.5) a = 6.5; cuts.push(a); }
      const edges = [a0, ...cuts, a1];
      for (let i = 0; i < edges.length - 1; i++) {
        const rr = along ? [edges[i], band[1], edges[i + 1], band[3]] : [band[0], edges[i], band[2], edges[i + 1]];
        const rm = mkRoom(rr, y, h, 'office', { paint: mpick([0xe8e0cc, 0xe4dcd0, 0xf0e6d4, 0xdcd8cc]), style: 'modern' });
        rooms.push(rm);
        // door from the gallery into each room
        const mid = (edges[i] + edges[i + 1]) / 2;
        if (along) doors.push({ ax: 'x', c: wg.galSide === 'n' ? band[1] : band[3], at: mid, w: 1.2, style: 'carved', leaf: 'open', h: 2.8 });
        else doors.push({ ax: 'z', c: wg.galSide === 'e' ? band[2] : band[0], at: mid, w: 1.2, style: 'carved', leaf: 'open', h: 2.8 });
        // doors between neighbouring rooms in a wing (enfilade) on upper floors
        if (i > 0 && f > 0 && mchance(0.6)) { if (along) doors.push({ ax: 'z', c: edges[i], at: (band[1] + band[3]) / 2 + mr(-2, 2), w: 0.95, style: 'carved' }); else doors.push({ ax: 'x', c: edges[i], at: (band[0] + band[2]) / 2 + mr(-2, 2), w: 0.95, style: 'carved' }); }
      }
    }
    // gallery ↔ gallery connections at the courtyard corners
    for (const [c, at] of [[cz0, cx0 - gal / 2], [cz0, cx1 + gal / 2], [cz1, cx0 - gal / 2], [cz1, cx1 + gal / 2]]) doors.push({ ax: 'x', c, at, w: gal - 0.9, arch: 'round', h: 3.2 });
    // assign special rooms
    const bands = rooms.filter((r) => r.type === 'office');
    const pick = (fn) => bands.filter(fn).sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0];
    if (f === 0) {
      const ent = pick((r) => r.z1 === D / 2 && r.x0 < 0 && r.x1 > 0); if (ent) { ent.type = 'hall'; ent.paint = 0xf0e6d4; ent.entrance = true; ent.light = false; }
      const sec = pick((r) => r.z1 === D / 2 && r.x1 <= -6); if (sec) sec.type = 'security';
      const sal = pick((r) => r.z0 === -D / 2); if (sal) { sal.type = 'salon'; sal.style = 'trad'; }
      for (const r of bands.filter((q) => q.type === 'office' && mchance(0.35))) r.type = mpick(['storage', 'meeting']);
    } else if (f === 1) {
      const council = pick((r) => r.z0 === -D / 2); if (council) { council.type = 'meeting'; council.council = true; }
      for (const r of bands.filter((q) => q.type === 'office' && mchance(0.3))) r.type = mpick(['meeting', 'salon']);
    } else for (const r of bands.filter((q) => q.type === 'office' && mchance(0.3))) r.type = mpick(['storage', 'meeting', 'living']);
    // stair cores take over part of their rooms
    for (const c of cores) { const [a, b, cc, dd] = coreRect(c); const host = rooms.find((r) => r.x0 <= a + 0.01 && r.x1 >= cc - 0.01 && r.z0 <= b + 0.01 && r.z1 >= dd - 0.01); if (host) { host.type = 'hall'; host.coreHost = true; host.light = true; } }
    for (const q of rooms) { q.extN = Math.abs(q.z0 + D / 2) < 0.05; q.extS = Math.abs(q.z1 - D / 2) < 0.05; q.extW = Math.abs(q.x0 + Wd / 2) < 0.05; q.extE = Math.abs(q.x1 - Wd / 2) < 0.05; q.extIn = T; q.floor = f; }
    // exterior openings: ceremonial portal on the front, arched windows elsewhere
    const ops = { s: [], n: [], e: [], w: [] };
    if (f === 0) { ops.s.push({ at: 0, w: 4.4, h: 5.6, kind: 'archdoor', arch: 'horse', style: 'carved', leaf: 'open', double: true, zellige: zelW, rimCol: 0xf0e4c8 }); const ent = rooms.find((r) => r.entrance); if (ent) ent.doors.push({ side: 's', at: 0, w: 4.4 }); ops.n.push({ at: 6, w: 1.4, h: 2.6, kind: 'door', style: 'carved', leaf: 'open' }); }
    for (const q of rooms) {
      if (q.type === 'hall' && q.gallery) continue;
      for (const side of STREET_SIDE) {
        const on = (side === 's' && q.extS) || (side === 'n' && q.extN) || (side === 'e' && q.extE) || (side === 'w' && q.extW);
        if (!on) continue;
        const a0 = side === 's' || side === 'n' ? q.x0 : q.z0, a1 = side === 's' || side === 'n' ? q.x1 : q.z1, n = Math.max(1, Math.floor((a1 - a0) / 4.2));
        for (let i = 0; i < n; i++) {
          const at = a0 + (i + 0.5) * (a1 - a0) / n;
          if (ops[side].some((p) => Math.abs(p.at - at) < p.w / 2 + 1.2)) continue;
          if (cores.some((c) => { const [a, b, cc, dd] = coreRect(c); return (side === 's' || side === 'n') ? at > a - 1 && at < cc + 1 && ((side === 's' && dd > D / 2 - 1) || (side === 'n' && b < -D / 2 + 1)) : false; })) continue;
          const bal = f === 1 && side === 's' && Math.abs(at) > 8 && mchance(0.5);
          ops[side].push(bal ? { at, w: 1.4, h: 3.0, kind: 'door', style: 'glass', leaf: 'open', balcony: true } : { at, w: f === 0 ? 1.3 : 1.4, h: f === 0 ? 2.4 : 2.6, sill: f === 0 ? 1.6 : 0.9, kind: 'archwin', arch: f === 2 ? 'round' : 'horse', win: f === 0 ? 'grille' : mpick(['mash', 'grille', 'shut']), shutCol: MC.green, rimCol: 0xf0e4c8, zellige: f === 1 ? (zelW + 2) & 7 : undefined });
          q.wins.push({ side, at, w: 1.4 }); if (bal) q.doors.push({ side, at, w: 1.4 });
        }
      }
    }
    linkDoors(rooms, doors);
    // courtyard-facing arcade walls (gallery → garden): many arches, with balustrades upstairs
    const arcade = (ax, a0, a1, c, side) => {
      const n = Math.floor((a1 - a0) / 3.4), ops2 = [];
      for (let i = 0; i < n; i++) ops2.push({ at: a0 + (i + 0.5) * (a1 - a0) / n, w: 2.5, h: f === 0 ? 4.6 : 3.6, sill: 0, kind: 'arch', arch: f === 2 ? 'round' : 'horse', rimCol: 0xf2e8d4, rimTx: TX.gebs });
      wall(ax, a0, a1, c, y, h, 0.7, { col, tx: TX.plaster, inCol: 0xe8dcc4, inTx: TX.tadelakt, side, ops: ops2, dimIn: 0.75, wear: 2, plinth: f === 0 ? 0.9 : 0, plinthCol: 0xffffff, plinthTx: TX.zellige });
      if (f > 0) for (const p of ops2) { if (ax === 'x') railing(p.at - 1.25, c + side * 0.0, p.at + 1.25, c + side * 0.0, y, 'mash', MC.cedar); else railing(c, p.at - 1.25, c, p.at + 1.25, y, 'mash', MC.cedar); }
    };
    arcade('x', cx0, cx1, cz0 - 0.35, 1);       // north gallery faces +z (garden)
    arcade('x', cx0, cx1, cz1 + 0.35, -1);
    arcade('z', cz0 + 0.0, cz1, cx0 - 0.35, 1);
    arcade('z', cz0, cz1, cx1 + 0.35, -1);
    // slab: holes for the courtyard and stair openings
    const holes = [[cx0, cz0, cx1, cz1]];
    if (f > 0) for (const c of cores) { const [a, b, cc, dd] = coreRect(c); holes.push(c.zb < c.zf ? [a, b, cc, dd - 1.4] : [a, b + 1.4, cc, dd]); }
    slab(-Wd / 2 + T, -D / 2 + T, Wd / 2 - T, D / 2 - T, y, { holes, top: f === 0 ? 0xffffff : 0xd8c8a8, topTx: f === 0 ? TX.zellige : TX.terrazzo, topWear: f === 0 ? 4 : 2, thk: f === 0 ? 0.3 : 0.4, bot: f === 0 ? false : MC.cedar, botTx: TX.carved, dimTop: f === 0 ? 0.7 : DIM_IN, dimBot: 0.6 });
    extWalls(Wd, D, T, y, h, rooms.filter((r) => !r.gallery), { col, ops, plinth: f === 0 ? 1.2 : 0, plinthCol: stone, plinthTx: TX.stone, wear: 3 });
    partitions(rooms.filter((r) => !(r.gallery && false)), doors, y, h, { T: 0.2 });
    opsWithBalconies(ops, Wd, D, y, 'mash');
    for (const c of cores) uStair(c.x0, c.zf, c.zb, c.w, y, Y[f + 1], { col: 0xd8c8a8, tx: TX.terrazzo, wallCol: 0xe8dcc4, riser: zelW, lf: 1.4 });
    // gallery dressing + lanterns, then room furniture
    W.scope({ lod: 2, dim: 0.75 }, () => { for (const r of rooms.filter((q) => q.gallery)) { const along = r.gallery === 's' || r.gallery === 'n'; const L = along ? r.x1 - r.x0 : r.z1 - r.z0; for (let i = 0; i < Math.floor(L / 7); i++) { const t = (i + 0.5) / Math.floor(L / 7); const x = along ? lerp(r.x0, r.x1, t) : (r.x0 + r.x1) / 2, z = along ? (r.z0 + r.z1) / 2 : lerp(r.z0, r.z1, t); hangLantern(x, y + h, z, 0xffc070, 1.0, i % 2 === 0); if (f === 0 && i % 3 === 1) plantPot(x, y, z + (along ? 0.9 : 0), 'palm', 1.3); } } });
    for (const r of rooms) {
      if (r.gallery) continue;
      if (r.entrance) {
        W.scope({ lod: 2, dim: 0.7 }, () => { floorRug((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2, 4, 7, 0, 0x8a2a24); for (const s of [-1, 1]) { plantPot((r.x0 + r.x1) / 2 + s * 3, y, r.z1 - 2, 'palm', 1.5); waitingChairs((r.x0 + r.x1) / 2 + s * 4.2, y, (r.z0 + r.z1) / 2, s * -Math.PI / 2, 4); } hangLantern((r.x0 + r.x1) / 2, y + h, (r.z0 + r.z1) / 2, 0xffc070, 1.6, true); });
        continue;
      }
      if (r.council) {
        W.scope({ lod: 2, dim: DIM_IN }, () => { meetingTable((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2, 0, Math.min(9, r.x1 - r.x0 - 3)); floorRug((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2, r.x1 - r.x0 - 2, r.z1 - r.z0 - 3, 0, 0x2a3a6a); for (let i = 0; i < 3; i++) hangLantern(lerp(r.x0, r.x1, (i + 1) / 4), y + h, (r.z0 + r.z1) / 2, 0xffc070, 1.2, true); W.box(r.x1 - r.x0 - 1, 1.2, 0.02, (r.x0 + r.x1) / 2, y + 0.6, r.z0 + T + 0.02, 0xffffff, { t: TX.zellige, wear: 6 }); });
        continue;
      }
      if (r.coreHost) { roomLight(r, 'trad'); continue; }
      furnish(r);
    }
  }
  // roof terrace: slab ring, merlon parapets, a low wall round the courtyard, stair houses, corner towers
  const yR = Y[3];
  const roofHoles = [[cx0, cz0, cx1, cz1], ...cores.map((c) => { const [a, b, cc, dd] = coreRect(c); return c.zb < c.zf ? [a, b, cc, dd - 1.4] : [a, b + 1.4, cc, dd]; })];
  slab(-Wd / 2, -D / 2, Wd / 2, D / 2, yR, { holes: roofHoles, top: 0xc8b090, topTx: TX.ceramic, topWear: 6, bot: MC.cedar, botTx: TX.carved, thk: 0.45, dimBot: 0.6 });
  parapet(-Wd / 2, -D / 2, Wd / 2, D / 2, yR, { h: 1.2, T: 0.5, col, style: 'merlon' });
  for (const [a, b, c, d] of [[cx0, cz0, cx1, cz0], [cx0, cz1, cx1, cz1], [cx0, cz0, cx0, cz1], [cx1, cz0, cx1, cz1]]) railing(a, b, c, d, yR, 'concrete', col);
  for (const c of cores) { const [a, b, cc, dd] = coreRect(c); stairHouse(a - 0.25, b - 0.25, cc + 0.25, dd + 0.25, yR, c.x0 < 0 ? 'e' : 'w', { col, at: c.zb < c.zf ? dd - 0.75 : b + 0.75 }); }
  // tiled eaves along the outer roofline (the palace's green ribbon)
  W.scope({ lod: 1 }, () => {
    for (const [w_, d_, x, z] of [[Wd + 0.8, 0.9, 0, D / 2 + 0.3], [Wd + 0.8, 0.9, 0, -D / 2 - 0.3]]) W.box(w_, 0.1, d_, x, yR - 0.5, z, MC.tile, { rx: z > 0 ? 0.35 : -0.35, t: TX.rooftile });
    for (const [w_, d_, x, z] of [[0.9, D + 0.8, Wd / 2 + 0.3, 0], [0.9, D + 0.8, -Wd / 2 - 0.3, 0]]) W.box(w_, 0.1, d_, x, yR - 0.5, z, MC.tile, { rz: x > 0 ? -0.35 : 0.35, t: TX.rooftile });
    for (const [w_, d_, x, z] of [[Wd, 0.3, 0, D / 2 + 0.05], [Wd, 0.3, 0, -D / 2 - 0.05], [0.3, D, Wd / 2 + 0.05, 0], [0.3, D, -Wd / 2 - 0.05, 0]]) W.box(w_, 0.6, d_, x, yR - 1.0, z, 0xffffff, { t: TX.zellige, wear: zelW });
  });
  // corner towers (solid, crenellated, green pyramid roofs)
  for (const [sx, sz] of [[-1, -1], [1, 1], [-1, 1]]) {
    const tx_ = sx * (Wd / 2 - 5), tz = sz * (D / 2 - 5);
    W.box(10, 7, 10, tx_, yR + 3.5, tz, col, { t: TX.plaster, wear: 3 }); W.solid(10, 7, 10, tx_, yR + 3.5, tz, 'plaster');
    for (const s of ['s', 'n', 'e', 'w']) { const ax = s === 's' || s === 'n' ? [0, s === 's' ? 5 : -5] : [s === 'e' ? 5 : -5, 0]; W.push(tx_ + ax[0], yR + 2.0, tz + ax[1], s === 's' ? 0 : s === 'n' ? Math.PI : s === 'e' ? Math.PI / 2 : -Math.PI / 2); for (const k of [-1.4, 1.4]) { W.box(1.0, 2.2, 0.06, k, 1.1, 0.03, MC.glassDk, { layer: 'pane' }); ironGrille(1.0, 0, 2.2, 0.03); archRim(1.0, 2.2 - 0.6, 0.6, 'horse', 0.03, 0xf0e4c8, TX.gebs); } W.box(8, 0.8, 0.06, 0, 4.4, 0.03, 0xffffff, { t: TX.zellige, wear: zelW, lod: 1 }); W.pop(); }
    W.scope({ lod: 1 }, () => parapet(tx_ - 5, tz - 5, tx_ + 5, tz + 5, yR + 7, { h: 1.0, T: 0.4, col, style: 'merlon' }));
    tileRoof(tx_, tz, 6, 6, yR + 7.4, 3.6);
  }
  // the ceremonial frontispiece over the portal
  W.box(16, 9, 1.4, 0, Y[2] + 4.5 - 1, D / 2 + 0.5, col, { t: TX.plaster, wear: 2 }); W.solid(16, 9, 1.4, 0, Y[2] + 3.5, D / 2 + 0.5, 'plaster');
  W.scope({ lod: 1 }, () => {
    W.push(0, Y[2] - 1, D / 2 + 1.2, 0);
    W.box(12, 6, 0.06, 0, 4.0, 0.03, 0xffffff, { t: TX.zellige, wear: zelW });
    W.box(13, 0.7, 0.2, 0, 7.4, 0.1, 0xf0e4c8, { t: TX.gebs });
    for (let i = 0; i < 9; i++) W.box(0.55, 1.0, 0.5, -5.5 + i * 1.375, 8.9 + 0.2, -0.4, col, { t: TX.plaster });
    W.pop();
  });
  tileRoof(0, D / 2 + 0.5, 15, 2, Y[2] + 8.2, 1.4);
  // CLOCK TOWER at the north-east corner: 62 m, the city's compass needle
  clockTower(Wd / 2 - 4, -D / 2 + 4, yR);
  // the Andalusian garden in the courtyard
  palaceGarden(cx0, cz0, cx1, cz1, Y[0]);
  W.pop();
}
function clockTower(x, z, y0) {
  const s = 11, H = 44, col = 0xd8a07c;
  W.box(s, H, s, x, y0 + H / 2, z, col, { t: TX.plaster, wear: 2 }); W.solid(s, H, s, x, y0 + H / 2, z, 'plaster');
  W.box(s + 0.6, 2.0, s + 0.6, x, y0 + 1, z, 0xcdb28a, { t: TX.stone });
  W.scope({ lod: 1 }, () => {
    for (const side of ['s', 'n', 'e', 'w']) {
      const off = side === 's' ? [0, s / 2] : side === 'n' ? [0, -s / 2] : side === 'e' ? [s / 2, 0] : [-s / 2, 0];
      const ry = side === 's' ? 0 : side === 'n' ? Math.PI : side === 'e' ? Math.PI / 2 : -Math.PI / 2;
      W.push(x + off[0], y0, z + off[1], ry);
      // blind arcades with darj-w-ktaf carved panels, zellige bands, paired windows, the clock
      for (let k = 0; k < 3; k++) { const yy = 6 + k * 10; W.box(7.5, 7.5, 0.08, 0, yy + 3.75, 0.04, shade(col, 0.95), { t: TX.gebs }); archRim(7.0, yy + 5.0, 2.5, 'point', 0.05, 0xf0e4c8, TX.gebs); for (const sx of [-1.4, 1.4]) { W.box(1.1, 3.2, 0.03, sx, yy + 2.6, 0.1, MC.glassDk, { layer: 'pane' }); ironGrille(1.1, yy + 1.0, 3.2, 0.08); } }
      W.box(s - 0.8, 1.0, 0.08, 0, 36, 0.04, 0xffffff, { t: TX.zellige, wear: 2 });
      W.cyl(2.6, 2.6, 0.2, 0, 40, 0.15, 0xf2ece0, { rx: Math.PI / 2, seg: 24 });
      W.torus(2.6, 0.18, 0, 40, 0.2, MC.brass, { seg: 24, layer: 'metal' });
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; W.box(0.12, 0.45, 0.04, Math.sin(a) * 2.2, 40 + Math.cos(a) * 2.2, 0.28, 0x1a1a1a, { rz: -a }); }
      const hr = 2.1, mn = 0.9; // hands at ten past four
      W.box(0.16, 1.3, 0.04, Math.sin(hr) * 0.6, 40 + Math.cos(hr) * 0.6, 0.32, 0x1a1a1a, { rz: -hr });
      W.box(0.1, 2.0, 0.04, Math.sin(mn) * 0.95, 40 + Math.cos(mn) * 0.95, 0.34, 0x1a1a1a, { rz: -mn });
      W.pop();
    }
  });
  // gallery + crenellations, then the lantern stage, a green tiled pyramid and the brass jamour
  W.box(s + 1.4, 0.5, s + 1.4, x, y0 + H + 0.25, z, 0xcdb28a, { t: TX.stone }); W.solid(s + 1.4, 0.5, s + 1.4, x, y0 + H + 0.25, z, 'stone', { walk: true });
  W.scope({ lod: 1 }, () => parapet(x - s / 2 - 0.7, z - s / 2 - 0.7, x + s / 2 + 0.7, z + s / 2 + 0.7, y0 + H + 0.5, { h: 1.0, T: 0.4, col, style: 'merlon' }));
  const ls = 6.0, LH = 8;
  W.box(ls, LH, ls, x, y0 + H + 0.5 + LH / 2, z, col, { t: TX.plaster, wear: 2 }); W.solid(ls, LH, ls, x, y0 + H + 0.5 + LH / 2, z, 'plaster');
  W.scope({ lod: 1 }, () => { for (const side of ['s', 'n', 'e', 'w']) { const off = side === 's' ? [0, ls / 2] : side === 'n' ? [0, -ls / 2] : side === 'e' ? [ls / 2, 0] : [-ls / 2, 0]; W.push(x + off[0], y0 + H + 0.5, z + off[1], side === 's' ? 0 : side === 'n' ? Math.PI : side === 'e' ? Math.PI / 2 : -Math.PI / 2); W.box(2.0, 4.0, 0.04, 0, 3.0, 0.03, MC.glassDk, { layer: 'pane' }); archRim(2.0, 4.0, 1.0, 'horse', 0.03, 0xf0e4c8, TX.gebs, 2); W.box(ls, 0.7, 0.06, 0, LH - 0.6, 0.03, 0xffffff, { t: TX.zellige, wear: 1 }); W.pop(); } });
  tileRoof(x, z, ls, ls, y0 + H + 0.5 + LH, 5.0);
  for (let i = 0; i < 3; i++) W.sphere(0.7 - i * 0.17, 0.7 - i * 0.17, 0.7 - i * 0.17, x, y0 + H + LH + 6.4 + i * 0.95, z, MC.brass, { layer: 'metal', seg: 10, hseg: 8 });
  W.rod([x, y0 + H + LH + 5.5, z], [x, y0 + H + LH + 9.5, z], 0.06, MC.brass, { layer: 'metal' });
  W.lamp(x, y0 + H + LH + 6, z, 0xffd8a0, 2, 10, { halo: 0.8 });
}
function palaceGarden(x0, z0, x1, z1, y) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  // cross-axial paths of zellige with a long reflecting pool, four sunken orange-tree parterres
  W.box(w - 0.2, 0.04, d - 0.2, cx, y + 0.02, cz, 0xd8c8a8, { t: TX.paving, wear: 2, ao: false });
  W.box(w - 8, 0.06, 3.2, cx, y + 0.04, cz, 0xffffff, { t: TX.zellige, wear: 0, ao: false });
  W.box(3.2, 0.06, d - 8, cx, y + 0.04, cz, 0xffffff, { t: TX.zellige, wear: 0, ao: false });
  W.box(w * 0.5, 0.45, 2.0, cx, y + 0.22, cz - d * 0.18, 0xffffff, { t: TX.zellige, wear: 5 }); W.box(w * 0.5 - 0.3, 0.02, 1.7, cx, y + 0.42, cz - d * 0.18, 0x2a5a6a, { layer: 'glass' }); W.solid(w * 0.5, 0.45, 2.0, cx, y + 0.22, cz - d * 0.18, 'stone');
  fountain(cx, y, cz, 3.0, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = cx + sx * w / 4, pz = cz + sz * d / 4, pw = w / 2 - 6, pd = d / 2 - 6;
    W.box(pw, 0.5, pd, px, y + 0.25, pz, MC.stone, { t: TX.stone }); W.box(pw - 0.6, 0.02, pd - 0.6, px, y + 0.5, pz, 0x4a3a28, { t: TX.earth });
    W.solid(pw, 0.5, pd, px, y + 0.25, pz, 'stone', { walk: true });
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) tree(px - pw / 3 + i * pw / 3, y + 0.5, pz - pd / 4 + j * pd / 2, i === 1 && j === 0 ? 'palm' : 'orange', 0.9);
    W.scope({ lod: 2 }, () => { for (let i = 0; i < 18; i++) W.sphere(0.6, 0.45, 0.6, px + mr(-pw / 2 + 0.6, pw / 2 - 0.6), y + 0.6, pz + mr(-pd / 2 + 0.6, pd / 2 - 0.6), mpick([0x3e5a2a, 0x4a6a2e, 0x5a2a4a]), { seg: 6, hseg: 4, t: TX.leaf }); });
    bench(px, y, pz + sz * -(pd / 2 + 1.2), sz > 0 ? 0 : Math.PI);
    lampPostOld(px + sx * (pw / 2 + 1.5), y, pz + sz * (pd / 2 + 1.5), 3.8);
  }
}

// ---------------- RAMPARTS: rammed-earth walls with bastions, a walkway and gates ----------------
// path: closed or open polyline; gates: [{i (segment index), t (0..1 along segment), name}]
function ramparts(path, gates = [], o = {}) {
  const H = o.H ?? 8.5, T = o.T ?? 2.8, col = o.col ?? MC.pise;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1], L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(-(bz - az), bx - ax);
    const gs = gates.filter((g) => g.i === i).map((g) => g.t * L).sort((p, q) => p - q);
    let cur = 0;
    const seg = (a, b) => {
      if (b - a < 0.5) return;
      const m = (a + b) / 2, x = ax + (bx - ax) * m / L, z = az + (bz - az) * m / L;
      W.push(x, 0, z, ry);
      W.box(b - a + 0.02, H, T, 0, H / 2, 0, col, { t: TX.pise, wear: 5 }); W.solid(b - a, H, T, 0, H / 2, 0, 'stone', { walk: true });
      // outer crenellations (+z side is outside), low inner parapet; walkway on top
      W.scope({ lod: 1 }, () => {
        const n = Math.floor((b - a) / 1.3);
        for (let k = 0; k < n; k++) { const u = -(b - a) / 2 + (k + 0.5) * (b - a) / n; W.box(0.8, 1.5, 0.6, u, H + 0.75, T / 2 - 0.3, col, { t: TX.pise, wear: 6 }); W.box(0.4, 0.4, 0.6, u, H + 1.7, T / 2 - 0.3, col, { t: TX.pise, wear: 6 }); }
        W.box(b - a, 0.3, 0.4, 0, H + 0.15, -T / 2 + 0.2, col, { t: TX.pise, wear: 6 });
        W.box(b - a, 0.04, T - 1.0, 0, H + 0.02, 0, 0xa88a6a, { t: TX.earth, ao: false });
      });
      W.solid(b - a, 1.5, 0.6, 0, H + 0.75, T / 2 - 0.3, 'stone');
      W.pop();
    };
    for (const g of gs) { seg(cur, g - 9); cur = g + 9; }
    seg(cur, L);
    // bastions every ~45 m (skipping gates)
    for (let s = 22; s < L - 10; s += 45) {
      if (gs.some((g) => Math.abs(g - s) < 18)) continue;
      const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L;
      W.push(x, 0, z, ry);
      W.box(6.5, H + 1.6, 4.5, 0, (H + 1.6) / 2, T / 2 + 2.25, col, { t: TX.pise, wear: 5 }); W.solid(6.5, H + 1.6, 4.5, 0, (H + 1.6) / 2, T / 2 + 2.25, 'stone');
      W.scope({ lod: 1 }, () => { for (let k = 0; k < 4; k++) W.box(0.9, 1.4, 0.6, -2.45 + k * 1.63, H + 2.3, T / 2 + 4.2, col, { t: TX.pise, wear: 6 }); for (const sx of [-1, 1]) W.box(0.6, 1.4, 0.9, sx * 2.95, H + 2.3, T / 2 + 2.6, col, { t: TX.pise, wear: 6 }); });
      W.pop();
    }
  }
  for (const g of gates) {
    const [ax, az] = path[g.i], [bx, bz] = path[g.i + 1], L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(-(bz - az), bx - ax);
    const x = ax + (bx - ax) * g.t, z = az + (bz - az) * g.t;
    babGate(x, z, ry, H, T, col, g);
    void L;
  }
}
// monumental gate (bab): horseshoe arch through a deep gatehouse, carved stone, zellige, flanking towers, stairs to the walk
function babGate(x, z, ry, H, T, col, g) {
  const GW = 18, GD = 12, GH = H + 3.5, aw = 5.0, ah = 8.0;
  W.push(x, 0, z, ry);
  // two piers and the lintel block above the arch (gatehouse depth along local z)
  for (const s of [-1, 1]) { W.box((GW - aw) / 2, GH, GD, s * (aw / 2 + (GW - aw) / 4), GH / 2, 0, col, { t: TX.pise, wear: 4 }); W.solid((GW - aw) / 2, GH, GD, s * (aw / 2 + (GW - aw) / 4), GH / 2, 0, 'stone', { walk: true }); }
  const rise = archRise('horse', aw), spring = ah - rise, n = 12;
  for (let i = 0; i < n; i++) { const u0 = -aw / 2 + (i / n) * aw, u1 = u0 + aw / n, top = spring + archY('horse', (u0 + u1) / 2, aw); W.box(aw / n + 0.01, GH - top, GD, (u0 + u1) / 2, (top + GH) / 2, 0, col, { t: TX.pise, wear: 4 }); W.solid(aw / n, GH - top, GD, (u0 + u1) / 2, (top + GH) / 2, 0, 'stone', { walk: true }); }
  // carved stone facing + zellige alfiz on both faces
  W.scope({ lod: 1 }, () => {
    for (const face of [1, -1]) {
      W.push(0, 0, face * GD / 2, face > 0 ? 0 : Math.PI);
      W.box(aw + 4.6, ah + 2.4, 0.12, 0, (ah + 2.4) / 2, 0.06, 0xcdb28a, { t: TX.stone, wear: 3 });
      archRim(aw, spring, rise, 'horse', 0.12, 0xe8d8b8, TX.gebs, g.zel ?? 2);
      W.box(aw + 3.2, 1.0, 0.14, 0, ah + 1.3, 0.1, 0xf0e4c8, { t: TX.gebs });
      for (let k = 0; k < 7; k++) W.box(0.9, 1.4, 0.8, -GW / 2 + 1.2 + k * (GW - 2.4) / 6, GH + 0.7, 0, col, { t: TX.pise, wear: 5 });
      W.pop();
    }
    // massive studded doors folded back against the passage walls
    for (const s of [-1, 1]) { W.box(0.18, spring + 0.8, 2.4, s * (aw / 2 - 0.12), (spring + 0.8) / 2, -GD / 2 + 1.6, MC.cedarDk, { t: TX.carved }); for (let r = 0; r < 6; r++) for (let k = 0; k < 3; k++) W.box(0.04, 0.06, 0.06, s * (aw / 2 - 0.22), 0.6 + r * spring / 6, -GD / 2 + 0.8 + k * 0.8, 0x1a1a1a, { lod: 2 }); }
    W.box(aw - 0.1, 0.04, GD, 0, 0.02, 0, MC.cobble, { t: TX.cobble, ao: false });
  });
  for (const s of [-1, 1]) wallLantern(s * (aw / 2 + 1.0), 4.2, GD / 2 + 0.06, true);
  // flanking towers
  for (const s of [-1, 1]) { const tx = s * (GW / 2 + 2.5); W.box(5.5, GH + 3, GD + 2, tx, (GH + 3) / 2, 0, col, { t: TX.pise, wear: 4 }); W.solid(5.5, GH + 3, GD + 2, tx, (GH + 3) / 2, 0, 'stone'); W.scope({ lod: 1 }, () => { for (let k = 0; k < 4; k++) W.box(0.9, 1.4, 0.7, tx - 1.9 + k * 1.27, GH + 3.7, GD / 2 + 0.65, col, { t: TX.pise, wear: 5 }); for (let k = 0; k < 4; k++) W.box(0.9, 1.4, 0.7, tx - 1.9 + k * 1.27, GH + 3.7, -GD / 2 - 0.65, col, { t: TX.pise, wear: 5 }); }); }
  // stair up to the rampart walk on the inside face (−z), along the wall
  const sN = Math.round(H / ST_RISE), sL = sN * 0.3;
  flight(GW / 2 + 5.6, -T / 2 - 0.8, [1, 0], 1.6, 0, H, { col: 0xb08a66, tx: TX.stone, run: 0.3, soffit: false, thick: 20 });
  void sL;
  W.pop();
}

// ---------------- minaret + mosque (exterior only) ----------------
function minaret(x, z, ry = 0, s = 6.5, H = 36) {
  const col = mpick([0xd8b08a, 0xcda07a, 0xe4cfb0]);
  W.push(x, 0, z, ry);
  W.box(s, H, s, 0, H / 2, 0, col, { t: TX.plaster, wear: 3 }); W.solid(s, H, s, 0, H / 2, 0, 'plaster');
  W.scope({ lod: 1 }, () => {
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      W.push(0, 0, 0, r);
      for (let k = 0; k < 3; k++) { const yy = 6 + k * 8.5; W.box(s - 1.6, 6.0, 0.06, 0, yy + 3, s / 2 + 0.03, shade(col, 0.95), { t: TX.gebs }); archRim(1.0, yy + 3.6, 0.9, 'horse', s / 2 + 0.06, 0xf0e4c8, TX.gebs); W.box(1.0, 1.8, 0.03, 0, yy + 2.4, s / 2 + 0.05, 0x2a2a2a, { layer: 'pane' }); }
      W.box(s + 0.02, 1.2, 0.06, 0, H - 2.2, s / 2 + 0.03, 0xffffff, { t: TX.zellige, wear: 0 });
      W.pop();
    }
    parapet(-s / 2 - 0.3, -s / 2 - 0.3, s / 2 + 0.3, s / 2 + 0.3, H, { h: 0.9, T: 0.3, col, style: 'merlon' });
  });
  const ls = s * 0.42, LH = 5;
  W.box(ls, LH, ls, 0, H + LH / 2, 0, col, { t: TX.plaster }); W.solid(ls, LH, ls, 0, H + LH / 2, 0, 'plaster');
  W.box(ls * 0.5, 2.2, 0.03, 0, H + 2, ls / 2 + 0.02, 0xffffff, { t: TX.zellige, wear: 0, lod: 1 });
  tileRoof(0, 0, ls, ls, H + LH, 2.2);
  for (let i = 0; i < 3; i++) W.sphere(0.45 - i * 0.1, 0.45 - i * 0.1, 0.45 - i * 0.1, 0, H + LH + 2.9 + i * 0.65, 0, MC.brass, { layer: 'metal', seg: 8, hseg: 6 });
  W.pop();
}
function mosque(x, z, ry, w = 44, d = 36) {
  const col = mpick([0xe8dcc4, 0xd8c4a4]);
  W.push(x, 0, z, ry);
  W.box(w, 8, d, 0, 4, 0, col, { t: TX.plaster, wear: 2 }); W.solid(w, 8, d, 0, 4, 0, 'plaster');
  // ridged green-tile roofs over the prayer hall naves
  const n = Math.floor(w / 6);
  for (let i = 0; i < n; i++) { const xx = -w / 2 + (i + 0.5) * w / n; W.scope({ lod: 0 }, () => { W.box(w / n * 0.72, 0.15, d * 0.62, xx - w / n * 0.25, 9.2, -d * 0.15, MC.tile, { rz: 0.55, t: TX.rooftile }); W.box(w / n * 0.72, 0.15, d * 0.62, xx + w / n * 0.25, 9.2, -d * 0.15, MC.tile, { rz: -0.55, t: TX.rooftile }); }); }
  W.box(w, 0.6, d * 0.65, 0, 8.3, -d * 0.15, MC.cedarDk, { t: TX.carved });
  for (const sd of ['s', 'e', 'w']) { const L = sd === 's' ? w : d, nn = Math.floor(L / 6); for (let i = 0; i < nn; i++) faceDoor(sd, w, d, -L / 2 + (i + 0.5) * L / nn, 0, 2.2, 3.4, 'carved', { arch: true, zellige: 0, rimCol: 0xf0e4c8 }); }
  W.box(w - 0.4, 0.04, d * 0.3, 0, 8.02, d * 0.33, MC.roofGravel, { t: TX.ceramic, lod: 1 });
  W.pop();
}
// ---------------- railway station ----------------
function station(x, z, ry, w = 70) {
  const d = 16, H = 9, col = 0xe4d2b0;
  W.push(x, 0, z, ry);
  W.box(w, H, d, 0, H / 2, 0, col, { t: TX.plaster, wear: 2 }); W.solid(w, H, d, 0, H / 2, 0, 'plaster');
  W.box(18, 14, d + 1, 0, 7, 0, col, { t: TX.plaster, wear: 2 }); W.solid(18, 14, d + 1, 0, 7, 0, 'plaster');
  W.scope({ lod: 1 }, () => {
    for (const face of [1, -1]) { W.push(0, 0, face * (d / 2 + 0.5), face > 0 ? 0 : Math.PI); for (let i = 0; i < 3; i++) { W.box(3.4, 6.5, 0.04, -5 + i * 5, 3.4, 0.03, MC.glassDk, { layer: 'pane' }); archRim(3.4, 4.8, 1.7, 'round', 0.03, 0xf0e4c8, TX.gebs); } W.cyl(1.6, 1.6, 0.2, 0, 11.4, 0.1, 0xf2ece0, { rx: Math.PI / 2, seg: 20 }); W.box(0.1, 1.2, 0.04, 0.3, 11.6, 0.22, 0x1a1a1a, { rz: -0.5 }); W.box(0.1, 0.9, 0.04, -0.1, 11.2, 0.22, 0x1a1a1a, { rz: 2.0 }); W.pop(); }
    for (const sd of ['s', 'n']) { const n = Math.floor((w - 20) / 2 / 4); for (const side of [-1, 1]) for (let i = 0; i < n; i++) faceWindow(sd, w, d, side * (11 + i * 4 + 2), 1.4, 1.8, 3.6, 'none', { frame: 0xe8dcc4 }); }
    parapet(-w / 2, -d / 2, w / 2, d / 2, H, { h: 0.9, T: 0.3, col, style: 'merlon' });
  });
  tileRoof(0, 0, 16, d - 1, 14, 4.0);
  // platform canopy on the track side (−z)
  W.box(w + 30, 1.0, 8, 0, 0.5, -d / 2 - 4, MC.concrete, { t: TX.paving, wear: 4 }); W.solid(w + 30, 1.0, 8, 0, 0.5, -d / 2 - 4, 'concrete', { walk: true });
  for (let i = 0; i < 12; i++) { W.box(0.3, 4.5, 0.3, -w / 2 - 12 + i * (w + 24) / 11, 3.25, -d / 2 - 6.5, 0x2a5a3a, { layer: 'metal' }); W.solid(0.3, 4.5, 0.3, -w / 2 - 12 + i * (w + 24) / 11, 3.25, -d / 2 - 6.5, 'metal'); }
  W.box(w + 28, 0.2, 7.5, 0, 5.6, -d / 2 - 4.2, 0x2a5a3a, { layer: 'metal', t: TX.corrugated, rx: 0.06 });
  for (let i = 0; i < 6; i++) bench(-w / 2 + 6 + i * (w - 12) / 5, 1.0, -d / 2 - 2, Math.PI);
  W.pop();
}
