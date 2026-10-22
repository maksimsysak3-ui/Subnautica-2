// =====================================================================
//  WORLD MAP — "Outpost Kestrel": layout
//  Base (x −70..70, z 0..130) with the night range running north (−z) from the firing line,
//  access road + highway, village to the south-east, gas station west, wadi + bridge,
//  helicopter crash site, radio-tower hill.
// =====================================================================

// ---------------- flat building pads (terrain blends into these) ----------------
flat(-80, -170, 80, 138, 0, 22);      // base + range
flat(95, 185, 215, 262, 0, 16);       // village
flat(-160, 176, -105, 205, 0, 12);    // gas station
flat(-170, 40, -135, 75, 0, 14);      // crash site
flat(-20, 138, 20, 166, 0, 10);       // checkpoint / access road

// ---------------- the night range (targets live in the environment module) ----------------
function buildRangeArea() {
  buildRange();
  // HESCO lanes either side of the range, a dirt berm behind the gong
  hescoLine(-15, -2, -15, -162, 2); hescoLine(15, -2, 15, -162, 2);
  for (let i = 0; i < 18; i++) W.sphere(36, 7, 6, mr(-14, 14), 0, -168 + mr(-1, 1), mpick([0x8a7656, 0x7e6c4c]), { seg: 6, hseg: 4, ry: mr(0, 3) });
  W.solid(32, 3, 8, 0, 1.5, -168, 'sand');
  // firing points: covered benches with sandbag rests, spent brass, ammo cans, scopes
  for (const bx of [-11, -7, 7, 11]) {
    W.push(bx, 0, 1.6);
    W.box(1.6, 0.06, 0.9, 0, 0.82, 0, PC.plywood); for (const s of [-1, 1]) for (const t of [-1, 1]) W.box(0.08, 0.8, 0.08, s * 0.7, 0.4, t * 0.35, PC.woodDk);
    sandbag(0, 0.85, -0.25, 0.1); sandbag(0.05, 0.98, -0.25, -0.05);
    ammoCan(-0.55, 0.85, 0.15, 0.3); magazine(0.45, 0.85, 0.25, 0.4); magazine(0.55, 0.85, 0.1, 0.2);
    for (let i = 0; i < 25; i++) W.cyl(0.005, 0.005, 0.045, mr(-1.5, 1.5), 0.006, mr(-1.2, 1.4), PC.brass, { rz: Math.PI / 2, ry: mr(0, 6), layer: 'metal', seg: 5, ao: false });
    // spotting scope on tripod
    for (let i = 0; i < 3; i++) W.rod([0.65, 0.85, -0.2], [0.65 + Math.sin(i * 2.1) * 0.15, 0.85 + 0.0, -0.2 + Math.cos(i * 2.1) * 0.15], 0.006, PC.black);
    W.cyl(0.03, 0.035, 0.3, 0.65, 0.95, -0.2, PC.olive, { rx: Math.PI / 2 - 0.1, seg: 8, layer: 'metal' });
    stool(0, 0, 0.75);
    W.pop();
    W.solid(1.6, 0.9, 0.9, bx, 0.45, 1.6, 'wood');
  }
  // range shade + control shack behind the line
  camoNet(0, 0, 6, 26, 6, 3.2);
  building(0, 14, 6, 4, { H: 2.6, wall: PC.plywood, inner: PC.plywood, floorFinish: PC.plywoodDk, roof: 'gable', rise: 0.8, roofCol: 0x80868c, gableCol: PC.plywood, frame: PC.woodDk, mat: 'wood',
    open: { s: [{ at: 1.5, w: 0.9, type: 'door', door: 'open', style: 'plank', doorCol: PC.plywoodDk }], n: [{ at: -0.8, w: 2.4, type: 'window', h: 0.9, sill: 1.0 }] },
    interior: () => {
      desk(-1.6, 0, -1.4, 0, 1.6, 0.6, PC.woodLt); chairOffice(-1.6, 0, -0.8, Math.PI);
      radioSet(-2.1, 0.78, -1.5, 0); laptop(-1.3, 0.78, -1.45, -0.2); mug(-0.9, 0.78, -1.3, PC.olive); clipboard(-1.7, 0.78, -1.2, 0.3);
      shelf(2.3, 0, -1.4, 0, 1.0, 4, 'supply'); firstAid(2.8, 1.4, 1.8, Math.PI); fireExtinguisher(-2.75, 0, 1.6, Math.PI / 2, true);
      W.box(1.0, 0.6, 0.03, 0.6, 1.5, 1.83, PC.white); for (let i = 0; i < 6; i++) W.box(0.8, 0.02, 0.002, 0.6, 1.72 - i * 0.08, 1.81, PC.black, { ao: false }); // range rules
      bulb(0, 2.55, 0, 0.2, GLOW.warm, 3, 6);
      for (let i = 0; i < 4; i++) W.box(0.25, 0.2, 0.004, -2.2 + i * 0.35, 1.0, 1.83, mpick([PC.redLt, PC.yellow, PC.green, PC.blueLt]), { ao: false });
      ammoCan(1.5, 0, 1.3, 0.2); ammoCan(1.5, 0.19, 1.3, 0.25, true); ammoCan(1.9, 0, 1.4, -0.1);
    } });
  signPost(-4, 0, 9, 0, 1.6, 0.9, PC.redLt, PC.white, 1.4);
  signPost(4, 0, 9, 0, 1.6, 0.9, PC.yellow, PC.black, 1.4);
  // red range flag on a pole
  W.cyl(0.04, 0.05, 6, 16.5, 3, 1.5, PC.alu, { seg: 6, layer: 'metal' }); for (let i = 0; i < 6; i++) W.box(0.2, 0.9, 0.02, 16.65 + i * 0.2, 5.4, Math.sin(i) * 0.1, PC.redLt, { layer: 'cloth', ry: Math.cos(i) * 0.4 });
  W.lamp(0, 3, 4, 0xffe0b0, 10, 16, { halo: 0 });
}

// ---------------- base perimeter ----------------
function buildPerimeter() {
  const X = 70, Z0 = 0, Z1 = 130;
  hescoLine(-X, Z0, -15, Z0, 2); hescoLine(15, Z0, X, Z0, 2);
  hescoLine(X, Z0, X, Z1, 2, [[58, 64]]);                    // east wall with a collapsed breach
  hescoLine(X, Z1, 4, Z1, 2); hescoLine(-4, Z1, -X, Z1, 2);   // south wall with the main gate
  hescoLine(-X, Z1, -X, Z0, 2);
  for (const [a, b, c, d] of [[-X - 2.5, Z0 - 2.5, -15, Z0 - 2.5], [15, Z0 - 2.5, X + 2.5, Z0 - 2.5], [X + 2.5, Z0, X + 2.5, Z1], [X + 2.5, Z1 + 2.5, 6, Z1 + 2.5], [-6, Z1 + 2.5, -X - 2.5, Z1 + 2.5], [-X - 2.5, Z1, -X - 2.5, Z0]]) concertina(a, b, c, d);
  // breach rubble: tumbled HESCO cells, spilled earth
  for (let i = 0; i < 6; i++) hesco(X + mr(-2, 2.5), 0, 60 + mr(-3, 3), mr(0, 3), 1.07, mr(0.4, 0.9), 0x8f8058);
  for (let i = 0; i < 10; i++) W.sphere(mr(1, 2.5), mr(0.4, 0.9), mr(1, 2.5), X + mr(-3, 3), 0, 61 + mr(-4, 4), PC.sand, { seg: 6, hseg: 4 });
  for (const [x, z, ry] of [[-66, 4, 0], [66, 4, Math.PI / 2], [-66, 126, -Math.PI / 2], [66, 126, Math.PI]]) guardTower(x, z, ry);
  // main gate: two towers, chicane of barriers, sign, drop arm
  guardTower(-9, 127, -Math.PI / 2); guardTower(9, 127, Math.PI / 2);
  for (let i = 0; i < 2; i++) concreteBarrier((i % 2 ? 2 : -2), 0, 135 + i * 4, 0, PC.concreteLt, true);
  W.push(0, 0, 131.5); W.box(0.3, 1.2, 0.3, -4.2, 0.6, 0, PC.offwhite); for (let i = 0; i < 8; i++) W.box(1.0, 0.12, 0.12, -3.6 + i * 1.0, 1.05, 0, i % 2 ? PC.redLt : PC.white, { layer: 'metal' }); W.box(0.4, 0.4, 0.4, -4.2, 1.25, 0, PC.metalDk, { layer: 'metal' }); W.pop();
  signPost(7, 0, 133, Math.PI, 2.4, 1.2, 0x2a3a2a, PC.yellow, 1.2);
  signPost(-7, 0, 140, Math.PI, 1.4, 1.0, PC.white, PC.redLt, 1.2);
  // floodlights along the inside of the walls
  for (let z = 15; z < 125; z += 27) { floodPole(-66, 0, z, Math.PI / 2, 8, 2, 0xfff0d8, 26); floodPole(66, 0, z, -Math.PI / 2, 8, 2, 0xfff0d8, 26); }
  for (let x = -45; x <= 45; x += 30) { if (Math.abs(x) < 10) continue; floodPole(x, 0, 126, Math.PI, 8, 2, 0xfff0d8, 26); }
}

// ---------------- tactical operations centre (TOC) ----------------
function buildTOC() {
  const cx = -38, cz = 26, w = 28, d = 16, T = 0.3;
  const corrN = -1, corrS = 1;
  building(cx, cz, w, d, {
    H: 3.2, T, wall: 0xa49c8a, inner: 0xd8d2c2, floorFinish: 0x6e7072, tiles: true, frame: PC.metalDk, doorCol: 0x5a6068, sillCol: PC.concreteLt,
    open: {
      s: [{ at: 0.5, w: 1.4, type: 'door', door: 'open', style: 'metal', doorCol: 0x5a6068 }, { at: -10, w: 1.4, type: 'window', blind: 0.5 }, { at: -6, w: 1.4, type: 'window', blind: 0.7 }, { at: 5.5, w: 1.2, type: 'window', blind: 0.3 }, { at: 11, w: 1.4, type: 'window', blind: 0.5 }],
      n: [{ at: -11, w: 1.4, type: 'window', blind: 0.8 }, { at: -7, w: 1.4, type: 'window', blind: 0.8 }, { at: 5, w: 1.2, type: 'window', grille: true }, { at: 11, w: 1.4, type: 'window', curtain: 0x3a4a3a }, { at: 9, w: 1.0, type: 'door', door: 'closed', style: 'metal', doorCol: 0x5a6068 }],
      e: [{ at: 0, w: 1.0, type: 'door', door: 'ajar', style: 'metal' }], w: [{ at: -4.5, w: 1.2, type: 'window' }],
    },
    rooms: [
      { x0: -w / 2 + T, z0: corrN, x1: w / 2 - T, z1: corrN, ops: [{ at: -9 + w / 2 - T, w: 1.2, type: 'door', door: 'open' }, { at: -1 + w / 2 - T, w: 1.0, type: 'door', door: 'ajar' }, { at: 5 + w / 2 - T, w: 1.0, type: 'door', door: 'closed', style: 'metal', doorCol: 0x4a5058 }, { at: 11 + w / 2 - T, w: 1.0, type: 'door', door: 'open' }] },
      { x0: -w / 2 + T, z0: corrS, x1: w / 2 - T, z1: corrS, ops: [{ at: -10 + w / 2 - T, w: 1.2, type: 'door', door: 'open' }, { at: -3.5 + w / 2 - T, w: 1.0, type: 'door', door: 'open' }, { at: 0.5 + w / 2 - T, w: 2.6, type: 'door', door: 'none', h: 2.4 }, { at: 5.5 + w / 2 - T, w: 1.0, type: 'door', door: 'ajar' }, { at: 11 + w / 2 - T, w: 1.0, type: 'door', door: 'ajar' }] },
      { x0: -4, z0: -d / 2 + T, x1: -4, z1: corrN }, { x0: 2, z0: -d / 2 + T, x1: 2, z1: corrN }, { x0: 8, z0: -d / 2 + T, x1: 8, z1: corrN },
      { x0: -6, z0: corrS, x1: -6, z1: d / 2 - T }, { x0: -1, z0: corrS, x1: -1, z1: d / 2 - T }, { x0: 2.6, z0: corrS, x1: 2.6, z1: d / 2 - T }, { x0: 8, z0: corrS, x1: 8, z1: d / 2 - T },
    ],
    interior: () => {
      // corridor: ceiling lights, notice boards, extinguishers, water cooler
      for (let x = -12; x <= 12; x += 4) ceilingLight(x, 3.2, 0, Math.PI / 2 * 0, 1.2, true);
      corkboard(-6, 1.5, corrN - 0.07, Math.PI); corkboard(4.5, 1.5, corrS + 0.07, 0); fireExtinguisher(13.4, 0, 0, -Math.PI / 2, true); waterCooler(-13.2, 0, 0.3, Math.PI / 2);
      wallClock(-2.5, 2.4, corrN - 0.07, Math.PI); poster(8.5, 1.5, corrS + 0.07, 0, 0.6, 0.85, [PC.offwhite, PC.redLt, PC.black, PC.yellow]); trashCan(12.6, 0, 0.6);
      // OPS CENTRE (x −14..−4, north): desks in rows facing a wall of screens and the big map
      W.box(9.2, 0.008, 6.2, -9, 0.012, -4.5, 0x4a5058, { ao: false });
      for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) {
        const px = -12 + i * 2.6, pz = -5.4 + r * 2.1;
        desk(px, 0, pz, Math.PI, 1.6, 0.7, 0x8a8a84); chairOffice(px, 0, pz + 0.7, mr(-0.3, 0.3));
        monitor(px - 0.35, 0.78, pz - 0.1, Math.PI + 0.15, mpick([GLOW.screen, 0x4a8a5a, 0x8a6a3a])); monitor(px + 0.35, 0.78, pz - 0.1, Math.PI - 0.15, mpick([GLOW.screen, 0x3a5a8a]));
        keyboard(px, 0.78, pz + 0.15, Math.PI); mug(px + 0.65, 0.78, pz + 0.1, mpick([PC.white, PC.olive, PC.blueLt, PC.redLt, PC.charcoal]));
        if (mrand() < 0.6) paperStack(px - 0.65, 0.78, pz, 5, mr(-0.3, 0.3)); if (mrand() < 0.5) phone(px + 0.4, 0.78, pz + 0.25, 0.4); if (mrand() < 0.4) can(px - 0.6, 0.78, pz + 0.25, mpick([PC.redLt, PC.green, PC.blueLt]));
        if (mrand() < 0.3) helmetProp(px + 0.6, 0.78, pz - 0.15, mr(0, 6));
      }
      for (let i = 0; i < 4; i++) { W.box(1.4, 0.82, 0.06, -12.4 + i * 1.5, 2.05, -7.6, PC.black); W.box(1.32, 0.74, 0.004, -12.4 + i * 1.5, 2.05, -7.565, mpick([0x2a4a6a, 0x3a5a3a, 0x5a4a2a, 0x2a3a5a]), { layer: 'glow' }); for (let k = 0; k < 4; k++) W.box(mr(0.2, 0.9), 0.03, 0.002, -12.4 + i * 1.5 + mr(-0.2, 0.2), 1.8 + k * 0.12, -7.56, mpick([GLOW.green, GLOW.amber, GLOW.cool]), { layer: 'glow' }); }
      mapBoard(-5.0, 1.6, -7.67, 0, 1.6, 1.1);
      W.lamp(-9, 2.2, -6.5, 0x7aa0d0, 3, 7, { halo: 0 });
      for (let i = 0; i < 2; i++) ceilingLight(-11 + i * 4, 3.2, -4.5, 0, 1.2, true);
      tableFolding(-6.0, 0, -2.0, Math.PI / 2, 1.8, 0.7); for (let i = 0; i < 2; i++) radioSet(-6.0, 0.76, -2.5 + i * 0.8, -Math.PI / 2);
      trashCan(-4.6, 0, -1.6); fileCabinet(-4.5, 0, -6.4, -Math.PI / 2);
      // COMMS / SERVER (x −4..2): racks with blinking lights, cable trays, AC
      for (let i = 0; i < 3; i++) { W.push(-2.8 + i * 1.2, 0, -6.4); W.box(0.7, 2.0, 1.0, 0, 1.0, 0, PC.charcoal, { layer: 'metal', solid: true }); W.box(0.62, 1.86, 0.01, 0, 1.0, 0.505, 0x18191c, { layer: 'glass' }); for (let k = 0; k < 14; k++) { W.box(0.58, 0.1, 0.02, 0, 0.18 + k * 0.125, 0.49, PC.black); for (let j = 0; j < 4; j++) W.box(0.015, 0.012, 0.004, -0.22 + j * 0.03, 0.18 + k * 0.125, 0.5, mpick([GLOW.green, GLOW.green, GLOW.amber, GLOW.cool]), { layer: 'glow' }); } W.pop(); }
      W.box(5.4, 0.06, 0.3, -1, 2.85, -5.5, PC.metal, { layer: 'metal' }); for (let i = 0; i < 6; i++) W.cable([-3.2 + i * 0.25, 2.85, -5.5], [-3.2 + i * 0.25, 2.0, -6.0], 0.15, 0.012, mpick([PC.blueLt, PC.yellow, PC.black, PC.redLt]), 4);
      desk(0.5, 0, -2.1, Math.PI, 1.4, 0.7, 0x8a8a84); laptop(0.4, 0.78, -2.2, Math.PI + 0.2); chairOffice(0.5, 0, -1.6, 0.3); coffeeMaker(1.1, 0.78, -2.25, Math.PI); mug(-0.1, 0.78, -2.0, PC.charcoal);
      ceilingLight(-1, 3.2, -4.5, 0, 1.2, true); acUnit(-3.6, 1.8, -7.55, 0);
      // ARMORY (x 2..8): racks, ammo shelves, cleaning bench
      weaponRack(5, 0, -7.4, 0, 8); weaponRack(7.55, 0, -4.5, -Math.PI / 2, 5);
      shelf(2.9, 0, -4.2, Math.PI / 2, 1.6, 4, 'supply'); shelf(2.9, 0, -6.0, Math.PI / 2, 1.6, 4, 'supply');
      tableFolding(5.2, 0, -2.3, 0, 2.2, 0.7); for (let i = 0; i < 4; i++) magazine(4.5 + i * 0.25, 0.76, -2.3, mr(-0.4, 0.4)); flashlight(5.8, 0.76, -2.2, 0.5); W.box(0.6, 0.02, 0.4, 5.3, 0.77, -2.35, PC.olive, { layer: 'cloth' });
      for (let i = 0; i < 6; i++) ammoCan(3.4 + (i % 3) * 0.32, Math.floor(i / 3) * 0.2, -1.6, 0); ceilingLight(5, 3.2, -4.5, 0, 1.2, true);
      W.box(1.0, 0.25, 0.004, 5, 2.4, -7.62, PC.redLt, { ao: false });
      // COMMANDER (x 8..14): big desk, flag, map, sofa, coffee table with a mug
      desk(11, 0, -6.3, 0, 1.9, 0.85, PC.wood); chairOffice(11, 0, -7.0, 0.1, PC.black); for (const s of [-1, 1]) chairFolding(11 + s * 0.6, 0, -5.3, Math.PI + s * 0.2, PC.charcoal);
      laptop(10.9, 0.78, -6.35, 0.1); deskLamp(11.75, 0.78, -6.5, -0.6); mug(10.3, 0.78, -6.1, PC.white); paperStack(11.6, 0.78, -6.1, 8, 0.2); book(10.2, 0.78, -6.55, PC.redLt, 0.3); pen(11.3, 0.78, -6.0, 1.0);
      sofa(12.8, 0, -2.4, -Math.PI / 2, 0x4a3a2e, 2.2); lowTable(11.6, 0, -2.4, Math.PI / 2, 1.0, 0.55); mug(11.5, 0.32, -2.2, PC.olive); mug(11.7, 0.32, -2.6, PC.white); book(11.6, 0.32, -2.5, PC.black, 0.5);
      W.cyl(0.03, 0.04, 2.2, 13.4, 1.1, -7.3, PC.woodDk, { seg: 6 }); for (let i = 0; i < 5; i++) W.box(0.18, 0.9, 0.02, 13.5 + i * 0.16, 1.7, -7.3 + Math.sin(i) * 0.06, i < 2 ? 0x2a3a6a : PC.redLt, { layer: 'cloth' });
      mapBoard(9.6, 1.6, -7.67, 0, 1.2, 0.9); rug(11, 0, -4.2, 3.2, 2.2, 0, [0x5a2a2a, 0x2a2a3a, PC.tan, PC.offwhite]); ceilingLight(11, 3.2, -4.5, 0, 1.2, true); wallClock(13.66, 2.3, -5, -Math.PI / 2); fileCabinet(8.6, 0, -2.0, Math.PI / 2);
      // BRIEFING (south x −14..−6): rows of chairs, screen, projector, lectern
      for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) chairFolding(-12.4 + i * 1.05, 0, 3.4 + r * 1.0, Math.PI + mr(-0.15, 0.15), mpick([PC.charcoal, PC.charcoal, PC.metalDk]));
      W.box(3.0, 1.8, 0.04, -10, 1.7, 1.38, PC.white); W.box(2.8, 1.6, 0.004, -10, 1.7, 1.405, 0x2a3a5a, { layer: 'glow' }); for (let k = 0; k < 5; k++) W.box(mr(0.6, 2.2), 0.08, 0.002, -10, 2.2 - k * 0.22, 1.41, mpick([PC.offwhite, GLOW.amber]), { layer: 'glow' });
      W.box(0.6, 1.1, 0.45, -7.3, 0.55, 2.2, PC.wood, { solid: true }); W.box(0.65, 0.04, 0.5, -7.3, 1.12, 2.2, PC.woodDk, { rx: 0.25 });
      tableFolding(-10, 0, 6.9, 0, 1.4, 0.6); laptop(-10, 0.76, 6.9, Math.PI); W.box(0.3, 0.12, 0.25, -10, 2.6, 5.5, PC.black); W.lamp(-10, 1.8, 3, 0x6a8ac0, 1.6, 5, { halo: 0 });
      for (let i = 0; i < 2; i++) ceilingLight(-12 + i * 4, 3.2, 4.5, 0, 1.2, i === 1);
      // BREAK ROOM (x −6..−1): THE coffee corner
      W.box(4.6, 0.9, 0.6, -3.5, 0.45, 7.25, PC.offwhite, { solid: true }); W.box(4.7, 0.04, 0.64, -3.5, 0.92, 7.23, 0x4a4a48);
      coffeeMaker(-5.2, 0.94, 7.25, Math.PI); microwave(-4.3, 0.94, 7.3, Math.PI); kettle(-3.4, 0.94, 7.25, 2.0);
      for (let i = 0; i < 6; i++) mug(-2.8 + i * 0.13, 0.94, 7.3 - (i % 2) * 0.12, mpick([PC.white, PC.redLt, PC.olive, PC.blueLt, PC.yellow, PC.charcoal]), mr(0, 6));
      W.box(0.6, 0.18, 0.4, -1.7, 1.03, 7.3, PC.yellow); W.box(0.6, 0.02, 0.4, -1.7, 1.13, 7.3, PC.yellow);  // donut box
      fridge(-1.6, 0, 3.0, -Math.PI / 2); W.box(0.8, 0.5, 0.04, -3.5, 1.7, 7.58, PC.woodLt); for (let i = 0; i < 5; i++) mug(-3.85 + i * 0.18, 1.7, 7.48, mpick([PC.white, PC.redLt, PC.olive]), Math.PI / 2);
      tableFolding(-3.5, 0, 4.4, Math.PI / 2, 1.6, 0.8); for (const [px, pz, r] of [[-4.2, 3.9, Math.PI / 2], [-4.2, 4.9, Math.PI / 2], [-2.8, 3.9, -Math.PI / 2], [-2.8, 4.9, -Math.PI / 2]]) chairFolding(px, 0, pz, r + mr(-0.3, 0.3));
      mug(-3.6, 0.76, 4.0, PC.white); mug(-3.3, 0.76, 4.8, PC.redLt); cards(-3.5, 0.76, 4.4); mre(-3.7, 0.76, 4.5, 0.6); can(-3.25, 0.76, 4.2, PC.green); ashtray(-3.45, 0.76, 4.7);
      tv(-5.6, 0.9, 2.3, Math.PI / 2 + 0.6); W.box(0.5, 0.9, 0.4, -5.6, 0.45, 2.3, PC.woodDk); trashCan(-1.5, 0, 6.6, PC.charcoal); ceilingLight(-3.5, 3.2, 4.5, 0, 1.2, true);
      poster(-5.94, 1.6, 4.8, Math.PI / 2, 0.55, 0.75, [PC.yellow, PC.black, PC.redLt, PC.white]);
      // LOBBY (x −1..2.6): sign-in desk, flags, benches
      desk(2.0, 0, 4.4, -Math.PI / 2, 1.4, 0.6, PC.woodLt); clipboard(2.0, 0.78, 4.2, 0.2); pen(2.1, 0.78, 4.7, 0.5); phone(2.0, 0.78, 3.9, -0.3); chairOffice(1.4, 0, 4.4, Math.PI / 2);
      W.box(0.4, 0.45, 1.6, -0.7, 0.225, 4.6, PC.wood, { solid: true }); boots(-0.3, 0, 5.6, 0.4);
      // SUPPLY (x 2.6..8): shelving maze
      for (let i = 0; i < 3; i++) shelf(4.0 + i * 1.5, 0, 4.3, Math.PI / 2, 2.4, 4, mpick(['supply', 'supply', 'pantry'])); crate(7.2, 0, 7.0, 0.9, 0.6, 0.7, 0.2); crate(7.2, 0.6, 7.0, 0.8, 0.5, 0.6, 0.5, PC.woodLt, false); ceilingLight(5.3, 3.2, 4.5, Math.PI / 2, 1.2, false);
      // INTEL (x 8..14): photo wall, desks, shredder
      desk(10, 0, 6.9, Math.PI, 1.6, 0.7, 0x8a8a84); desk(12.5, 0, 6.9, Math.PI, 1.6, 0.7, 0x8a8a84); monitor(10, 0.78, 7.0, Math.PI); monitor(12.5, 0.78, 7.0, Math.PI, 0x5a8a5a); chairOffice(10, 0, 6.2, 0.2); chairOffice(12.5, 0, 6.2, -0.4);
      corkboard(13.66, 1.6, 4.5, -Math.PI / 2); corkboard(13.66, 1.6, 3.0, -Math.PI / 2); for (let i = 0; i < 6; i++) W.rod([13.62, mr(1.3, 1.9), mr(2.6, 4.9)], [13.62, mr(1.3, 1.9), mr(2.6, 4.9)], 0.003, PC.redLt);
      mug(11.2, 0.78, 6.7, PC.charcoal); mug(13.1, 0.78, 6.8, PC.white); paperStack(9.4, 0.78, 6.7, 9, 0.2); W.box(0.4, 0.6, 0.3, 8.6, 0.3, 2.0, PC.black, { solid: true }); ceilingLight(11, 3.2, 4.5, 0, 1.2, true);
    },
    roofProps: () => {
      for (let i = 0; i < 4; i++) acUnit(-10 + i * 6.5, 0, -4 + (i % 2) * 6, mr(-0.1, 0.1));
      W.cyl(0.05, 0.05, 6, 11, 3, -5, PC.steel, { seg: 6, layer: 'metal' }); W.cyl(0.03, 0.03, 4, 12, 2, -6, PC.steel, { seg: 6, layer: 'metal' });
      W.push(6, 0, 4, 0.7); W.box(0.2, 0.9, 0.2, 0, 0.45, 0, PC.metalDk); W.hemi(1.6, 0.5, 1.6, 0, 1.2, 0.2, PC.offwhite, { rx: -1.0, seg: 12 }); W.pop();
      for (let i = 0; i < 10; i++) sandbag(mr(-13, 13), 0, mr(-7, 7), mr(0, 6));
      W.cable([11, 5.5, -5], [14.3, 0.5, -7.8], 0.3, 0.01, PC.black);
    },
  });
  // blast walls around the TOC + a sandbagged entry
  for (let i = 0; i < 9; i++) tWall(cx - 13 + i * 1.55, 0, cz + 10.5, 0);
  for (let i = 0; i < 6; i++) tWall(cx + 16.5, 0, cz - 6 + i * 1.55, Math.PI / 2);
  sandbagWall(cx - 2, cz + 9.5, cx + 3, cz + 9.5, 3);
  generator(cx - 18.5, 0, cz - 5, Math.PI / 2); W.cable([cx - 18, 1, cz - 3.8], [cx - 14.3, 2.5, cz - 3], 0.3, 0.02, PC.black);
  for (let i = 0; i < 3; i++) acUnit(cx - 8 + i * 9, 0.2, cz - 8.6, Math.PI);
  floodPole(cx - 16, 0, cz + 12, -0.6, 7, 2, 0xfff0d8, 22);
  signPost(cx + 4, 0, cz + 12.5, 0, 1.6, 0.7, 0x2a3a2a, PC.offwhite, 1.0);
  for (let i = 0; i < 5; i++) drum(cx - 17.5 + (i % 3) * 0.65, 0, cz + 2 + Math.floor(i / 3) * 0.65, mpick([PC.blue, PC.olive, PC.redLt]));
}

// ---------------- barracks, DFAC, medical, latrines ----------------
function buildLiving() {
  let k = 0;
  for (const bx of [-57, -42]) for (const bz of [50, 60, 70, 80]) { bHut(bx, bz, 0, 9.8, k === 3 ? 'gym' : k === 6 ? 'office' : 'bunks'); k++; }
  for (const bx of [-57, -42]) for (let z = 46; z <= 84; z += 10) { streetLight(bx + 7, 0, z + 5, -Math.PI / 2, 5.5); }
  // DFAC: big tent with serving line, tables, drinks fridge
  tent(-46, 104, 0, 22, 11, 0x6e6a4c, (L, Wd) => {
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
      const px = -7 + i * 3.6, pz = -2.8 + r * 2.3;
      tableFolding(px, 0.05, pz, 0, 2.2, 0.76);
      for (const s of [-1, 1]) for (let c = 0; c < 3; c++) if (mrand() < 0.8) chairFolding(px - 0.7 + c * 0.7, 0.05, pz + s * 0.65, s > 0 ? Math.PI : 0 + mr(-0.3, 0.3));
      for (let c = 0; c < 3; c++) if (mrand() < 0.5) { const tx = px - 0.7 + c * 0.7, tz = pz + (mrand() < 0.5 ? -0.2 : 0.2); W.box(0.42, 0.015, 0.32, tx, 0.82, tz, PC.alu, { layer: 'metal' }); plate(tx, 0.83, tz); if (mrand() < 0.6) can(tx + 0.15, 0.82, tz, mpick([PC.redLt, PC.blueLt])); if (mrand() < 0.5) mug(tx - 0.15, 0.82, tz + 0.08, PC.white); }
    }
    W.box(6, 0.9, 0.8, 7, 0.5, 4.2, PC.steel, { layer: 'metal', solid: true }); for (let i = 0; i < 6; i++) W.box(0.8, 0.12, 0.5, 4.5 + i * 1.0, 0.98, 4.2, PC.alu, { layer: 'metal' }); W.box(6.2, 0.04, 0.3, 7, 1.4, 4.0, PC.glass, { layer: 'glass' });
    fridge(10.3, 0.05, -4.6, 0, 0xb8c0c8); fridge(9.5, 0.05, -4.6, 0, 0xb8c0c8); waterCooler(8.6, 0.05, -4.7, 0); trashCan(-10, 0.05, 4.5, PC.olive); trashCan(-10, 0.05, -4.5, PC.olive);
    for (let i = 0; i < 4; i++) bulb(-8 + i * 5.3, 3.0, 0, 0.3, GLOW.warm, 4, 9);
    crate(-10, 0.05, 0, 1.0, 0.7, 0.8, 0.2); crate(-10, 0.75, 0, 0.8, 0.5, 0.7, -0.2, PC.woodLt, false);
  });
  // medical tent with cots, IV stand, med cabinet, stretcher
  tent(-14, 30, Math.PI / 2, 9, 5, 0x5d5f46, () => {
    for (let i = 0; i < 3; i++) cot(-2.8 + i * 2.2, 0.05, -1.5, 0, PC.offwhite);
    for (let i = 0; i < 2; i++) { W.cyl(0.015, 0.015, 1.8, -2.3 + i * 2.2, 0.95, -0.5, PC.alu, { seg: 6, layer: 'metal' }); W.box(0.12, 0.2, 0.05, -2.3 + i * 2.2, 1.75, -0.5, 0xd0e0f0, { layer: 'glass' }); }
    shelf(3.3, 0.05, 1.6, Math.PI, 1.2, 4, 'supply'); firstAid(2.0, 0.85, 2.1, Math.PI); tableFolding(0, 0.05, 1.7, 0, 1.6, 0.6); for (let i = 0; i < 4; i++) bottle(-0.5 + i * 0.3, 0.81, 1.7, 0xd8e8f0, 0.18);
    W.box(0.6, 0.06, 2.0, -3.3, 0.5, 1.4, PC.olive); for (const s of [-1, 1]) W.box(0.04, 0.04, 2.3, -3.3 + s * 0.3, 0.5, 1.4, PC.alu, { layer: 'metal' });
    W.box(0.3, 0.3, 0.004, 0, 1.5, -2.45, PC.redLt); bulb(0, 2.9, 0, 0.3, GLOW.cool, 4, 8);
    medCabinet(-1.8, 0.05, 2.15, Math.PI); ivStand(3.4, 0.05, -0.6); sharpsBin(1.2, 0.81, 1.85); glovesBox(0.5, 0.81, 1.6);
  });
  W.push(-14, 0, 30); W.box(1.2, 1.2, 0.02, 0, 3.3, 0, PC.white, { ry: 0 }); W.pop();
  // latrines + showers (CHU style) by the south wall
  for (let i = 0; i < 4; i++) chu(-30 + i * 7, 120, 0, 1, () => {
    if (i < 2) { for (let k = 0; k < 3; k++) { toilet(-2.2 + k * 1.4, 0, -0.85, 0); W.box(0.04, 2.0, 1.0, -1.5 + k * 1.4, 1.0, -0.6, PC.offwhite); } sink(2.2, 0, -0.9, 0); mirror(2.2, 1.5, -1.19, 0); towel(1.4, 1.5, -1.19, 0); }
    else { for (let k = 0; k < 3; k++) { W.box(0.9, 0.05, 0.9, -2.2 + k * 1.2, 0.02, -0.65, PC.white); W.rod([-2.2 + k * 1.2, 2.2, -1.15], [-2.2 + k * 1.2, 2.0, -0.95], 0.02, PC.alu); W.box(0.02, 1.9, 1.0, -1.6 + k * 1.2, 1.0, -0.6, 0x4a6a8a, { layer: 'cloth' }); } towel(2.2, 1.5, -1.19, 0, PC.blueLt); boots(2.0, 0, 0.4, 0.5); }
    ceilingLight(0, 2.4, 0, 0, 1.0, true);
  });
  // mortar pit
  W.push(-25, 0, 104);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; for (let r = 0; r < 4; r++) sandbag(Math.sin(a) * 2.8, r * 0.14, Math.cos(a) * 2.8, -a + Math.PI / 2); }
  W.box(0.5, 0.06, 0.5, 0, 0.03, 0, PC.metalDk, { layer: 'metal' }); W.cyl(0.06, 0.06, 1.5, 0, 0.7, -0.2, PC.olive, { rx: 0.8, seg: 8, layer: 'metal' }); for (const s of [-1, 1]) W.rod([0, 0.6, 0.2], [s * 0.35, 0, 0.5], 0.02, PC.olive);
  for (let i = 0; i < 4; i++) ammoCan(-1.5 + i * 0.35, 0, 1.4, 0.1);
  W.pop(); W.solid(6, 0.6, 6, -25, 0.3, 104, 'sand');
  // parade ground: flagpole, memorial, benches, smoke pit
  flagpole(-8, 60);
  W.push(-8, 0, 52); W.box(2.2, 0.5, 1.2, 0, 0.25, 0, PC.concreteLt, { solid: true }); W.box(0.4, 0.5, 0.4, 0, 0.75, 0, PC.concreteLt); boots(0, 1.0, 0.1, 0); W.cyl(0.02, 0.02, 0.9, 0, 1.45, 0, PC.black, { seg: 5, rx: 0.1 }); helmetProp(0, 1.9, 0.1, 0); for (let i = 0; i < 5; i++) W.cyl(0.02, 0.02, 0.15, mr(-0.9, 0.9), 0.55, mr(-0.4, 0.5), PC.offwhite, { seg: 6 }); W.pop();
  for (const [x, z, r] of [[-15, 55, 0.3], [0, 55, -0.3]]) { W.push(x, 0, z, r); W.box(1.8, 0.06, 0.4, 0, 0.45, 0, PC.woodLt); for (const s of [-1, 1]) W.box(0.08, 0.45, 0.35, s * 0.8, 0.22, 0, PC.woodDk); W.pop(); W.solid(1.8, 0.5, 0.4, x, 0.25, z, 'wood', { ry: r }); }
  W.push(-25, 0, 95.5); camoNet(0, 0, 0, 5, 5, 2.6); for (let i = 0; i < 6; i++) { const a = i * 1.05; chairFolding(Math.sin(a) * 1.4, 0, Math.cos(a) * 1.4, a + Math.PI, mpick([PC.charcoal, PC.olive])); } drum(0, 0, 0, PC.rust); ashtray(0, 0.88, 0); can(0.15, 0.88, 0.1, PC.redLt); W.pop();
}

// ---------------- CHU housing, container yard, motor pool, fuel point ----------------
function buildEastSide() {
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) chu(26 + i * 8, 22 + r * 12, r ? Math.PI : 0);
  for (let i = 0; i < 4; i++) streetLight(26 + i * 8, 0, 28, 0, 5.5);
  sandbagWall(20, 16, 56, 16, 3);
  // container yard: stacks forming lanes, some open with cargo
  const cols = [PC.redLt, 0x2a5a8a, 0x3a6a3a, PC.orange, 0x6a6a6a, PC.rust, 0x8a7a3a, 0x2a4a5a];
  const stacks = [[28, 54, 0, 2], [28, 60, 0, 1], [36, 54, 0, 1], [36, 66, 0, 2], [44, 54, 0, 3], [44, 66, 0, 1], [52, 58, Math.PI / 2, 2], [58, 58, Math.PI / 2, 1], [52, 72, 0, 2], [28, 76, 0, 1], [62, 72, Math.PI / 2, 2]];
  for (const [x, z, ry, n] of stacks) for (let k = 0; k < n; k++) container(x + (k ? mr(-0.15, 0.15) : 0), k * 2.6, z, ry + (k ? mr(-0.03, 0.03) : 0), mpick(cols));
  // an open container with cargo inside
  W.push(36, 0, 60); for (let i = 0; i < 4; i++) crate(-1.8 + i * 1.1, 0, 0.3, 0.9, 0.7, 0.8, mr(-0.1, 0.1)); pallet(1.8, 0, -0.4, 0.2); for (let i = 0; i < 6; i++) drum(-2 + i * 0.7, 0, -0.6, PC.olive); W.pop();
  for (let i = 0; i < 6; i++) pallet(46 + mr(-2, 2), i * 0.155, 62 + mr(-0.2, 0.2), mr(-0.1, 0.1));
  W.push(32, 0, 70); W.box(1.2, 2.0, 2.0, 0, 1.0, 0, PC.yellow, { layer: 'metal', solid: true }); W.box(1.5, 0.08, 1.2, 1.3, 0.25, 0, PC.metalDk, { layer: 'metal' }); for (const s of [-1, 1]) W.box(0.06, 2.6, 0.06, 0.65, 1.3, s * 0.5, PC.metalDk); for (const s of [-1, 1]) for (const t of [-1, 1]) W.cyl(0.25, 0.25, 0.2, s * 0.5, 0.25, t * 0.9, PC.rubber, { rx: Math.PI / 2, seg: 10 }); W.box(0.9, 1.0, 1.4, -0.2, 2.5, 0, PC.glass, { layer: 'glass' }); W.pop(); // forklift
  floodPole(40, 0, 61, 0.5, 9, 3, 0xffe8c8, 30); floodPole(56, 0, 66, -2.4, 9, 2, 0xffe8c8, 26);
  // motor pool: vehicles under a long camo shelter, maintenance tent, tool chests, tire stacks, oil
  camoNet(42, 0, 100, 28, 10, 3.4);
  for (let i = 0; i < 5; i++) { if (i === 2) cargoTruck(30 + i * 5.5, 100, Math.PI / 2, PC.olive); else humvee(30 + i * 5.5, 100, Math.PI / 2, mpick([PC.coyote, PC.olive, PC.tan])); }
  pickup(30, 116, 0.3, PC.white); pickup(40, 117, -0.2, 0x3a4a6a);
  tent(58, 92, Math.PI / 2, 10, 6, 0x6a6a4a, () => {
    tableFolding(0, 0.05, 2.2, 0, 3.0, 0.8); for (let i = 0; i < 6; i++) W.box(mr(0.1, 0.3), 0.05, 0.04, -1.2 + i * 0.4, 0.84, 2.2, mpick([PC.redLt, PC.steel, PC.black]), { ry: mr(-0.4, 0.4) });
    W.box(0.9, 1.0, 0.5, 3.6, 0.55, 2.3, PC.redLt, { layer: 'metal', solid: true }); for (let i = 0; i < 5; i++) W.box(0.84, 0.15, 0.02, 3.6, 0.2 + i * 0.18, 2.06, PC.redLt, { layer: 'metal' }), W.box(0.3, 0.02, 0.03, 3.6, 0.26 + i * 0.18, 2.04, PC.alu, { layer: 'metal' });
    for (let i = 0; i < 4; i++) tire(-3.5, 0.05 + i * 0.4, -1.8, 0); jerrycan(-2.5, 0.05, -2.2, 0.3, PC.olive); jerrycan(-2.1, 0.05, -2.2, 0.1, PC.redLt); drum(-1.4, 0.05, -2.2, PC.blue);
    W.box(2.0, 0.02, 1.2, 0.5, 0.06, -0.5, 0x1a1a18, { ao: false }); bulb(0, 3.0, 0, 0.3, GLOW.cool, 4, 9); bulb(2.5, 3.0, 0, 0.3, GLOW.cool, 3, 7);
    W.box(0.6, 1.5, 0.6, 4.2, 0.8, -1.8, PC.metalDk, { layer: 'metal' }); W.cable([4.2, 1.2, -1.5], [2.0, 0.05, -0.8], 0.2, 0.02, PC.black, 6);  // air compressor
    weldingCart(2.4, 0.05, 1.0, -0.4); toolChest(-4.2, 0.05, 2.3, Math.PI, PC.blue); wheelbarrow(-0.5, 0.05, -2.0, 0.3);
  });
  for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) tire(52 + i * 0.95, k * 0.4, 112, 0);
  for (let i = 0; i < 8; i++) W.box(mr(0.5, 1.6), 0.004, mr(0.4, 1.2), 30 + mr(0, 25), 0.07, 100 + mr(-3, 3), 0x16150f, { ao: false }); // oil stains
  // fuel point: bladders, pumps, berms, warning signs
  W.push(58, 0, 10);
  for (const s of [-1, 1]) { W.sphere(6, 1.2, 3.4, s * 4, 0.3, 0, 0x2a2e26, { seg: 12, hseg: 6 }); W.solid(6, 1.0, 3.4, s * 4, 0.5, 0, 'cloth'); }
  for (let i = 0; i < 12; i++) sandbag(-7 + i * 1.2, 0, 2.6, 0); W.box(0.8, 1.2, 0.6, 0, 0.6, 3.6, PC.yellow, { layer: 'metal', solid: true }); W.cable([0, 0.6, 3.3], [3.5, 0.2, 0.8], 0.1, 0.04, PC.black, 6);
  signPost(-3, 0, 4.5, 0, 1.2, 0.8, PC.redLt, PC.white, 0.8); for (let i = 0; i < 4; i++) drum(6 + i * 0.66, 0, 3.6, PC.redLt);
  W.pop();
  generator(48, 0, 8, 0); generator(48, 0, 4, 0);
  for (let i = 0; i < 3; i++) W.cable([47 + i * 0.4, 0.4, 6], [40, 0.05, 12 + i], 0.05, 0.025, PC.black, 6);
}

// ---------------- helipad, internal roads ----------------
function buildBaseCore() {
  helipad(-20, 78, 18);
  road(0, 132, 0, 90, 6, { dirt: true }); road(0, 90, -40, 90, 5, { dirt: true }); road(0, 90, 45, 90, 5, { dirt: true }); road(0, 90, 0, 20, 5, { dirt: true });
  for (let z = 30; z < 128; z += 16) streetLight(3.5, 0, z, Math.PI / 2, 6);
  // scattered life: pallets of water, MRE boxes, trash, a bike, cable reels
  for (let i = 0; i < 4; i++) { pallet(14 + i * 1.4, 0, 46, 0); for (let k = 0; k < 3; k++) W.box(1.0, 0.3, 1.0, 14 + i * 1.4, 0.15 + 0.15 + k * 0.3, 46, mpick([0x6a8ab0, 0x8aa0b8]), { layer: 'glass' }); }
  W.solid(5.6, 1.1, 1.2, 16.1, 0.55, 46, 'cloth');
  for (let i = 0; i < 6; i++) crate(12 + (i % 3) * 1.1, Math.floor(i / 3) * 0.7, 50, 1.0, 0.7, 0.8, mr(-0.05, 0.05), PC.tan, i < 3);
  W.push(-22, 0, 40, 0.4); W.cyl(0.6, 0.6, 0.12, 0, 0.6, 0, PC.woodLt, { rx: Math.PI / 2, seg: 14 }); W.cyl(0.6, 0.6, 0.12, 0, 0.6, 0.9, PC.woodLt, { rx: Math.PI / 2, seg: 14 }); W.cyl(0.4, 0.4, 0.8, 0, 0.6, 0.45, PC.black, { rx: Math.PI / 2, seg: 14 }); W.pop();
  trashPile(-26, 0, 112, 14); trashPile(14, 0, 18, 8);
  for (let i = 0; i < 40; i++) { const x = mr(-60, 60), z = mr(8, 124); W.box(mr(0.6, 2), 0.004, mr(0.4, 1.5), x, 0.008, z, mpick([0x7a6a4c, 0x857356, 0x6e5f44]), { ry: mr(0, 3), ao: false }); }
}

// ---------------- outside the wire ----------------
function buildOutside() {
  // highway E–W + access road + power line
  road(0, 132, 0, 170, 7);
  road(-290, 170, -239, 170, 9); road(-215, 170, 290, 170, 9); // the gap is the wadi bridge
  // power line along the highway: wires only run between poles that exist (none in the gas station lot or the wadi)
  const poles = [];
  for (let x = -280; x <= 280; x += 40) if (Math.abs(x + 132) > 26 && Math.abs(x + 227) > 14) { const y = terrainH(x, 177); powerPole(x, y, 177, 0, 9); poles.push([x, y]); }
  for (let i = 0; i < poles.length - 1; i++) { const [xa, ya] = poles[i], [xb, yb] = poles[i + 1]; if (xb - xa > 40) continue; for (const k of [-1, -0.35, 0.35, 1]) W.cable([xa + k, ya + 8.55, 177], [xb + k, yb + 8.55, 177], 0.6, 0.012, PC.black, 8); }
  for (let x = -260; x <= 260; x += 60) streetLight(x, 0, 165, Math.PI, 7);
  // checkpoint on the access road
  W.push(0, 0, 152);
  building(-5.5, 0, 2.4, 2.4, { H: 2.4, T: 0.12, wall: PC.offwhite, inner: PC.offwhite, parapet: 0, roofCol: PC.redLt, frame: PC.metalDk, open: { e: [{ at: 0, w: 1.2, type: 'window', h: 0.9, sill: 1.0 }], n: [{ at: 0, w: 0.8, type: 'door', door: 'open', style: 'metal' }], s: [{ at: 0, w: 1.2, type: 'window', h: 0.9, sill: 1.0 }] },
    interior: () => { chairOffice(-0.2, 0, 0.2, Math.PI / 2); W.box(0.8, 0.05, 1.6, 0.6, 0.95, 0, PC.woodLt); radioSet(0.6, 0.97, -0.4, -Math.PI / 2); mug(0.6, 0.97, 0.3, PC.white); clipboard(0.5, 0.97, 0.6, 0.4); bulb(0, 2.4, 0, 0.1, GLOW.warm, 2, 5); } });
  for (let i = 0; i < 4; i++) concreteBarrier(i % 2 ? 2.2 : -2.2, 0, -2 + i * 3, 0, PC.concreteLt, i % 2 === 0);
  W.box(0.3, 1.1, 0.3, 4.2, 0.55, 0, PC.offwhite); for (let i = 0; i < 8; i++) W.box(1.0, 0.12, 0.12, 3.6 - i * 1.0, 1.0, 0, i % 2 ? PC.redLt : PC.white, { layer: 'metal' });
  for (let i = 0; i < 10; i++) W.box(0.3, 0.06, 0.12, -3 + i * 0.6, 0.03, 4, PC.metalDk, { layer: 'metal' }); // spike strip
  signPost(5, 0, -4, Math.PI, 1.6, 1.0, PC.redLt, PC.white, 1.2); signPost(-6, 0, 6, 0, 1.2, 1.2, PC.yellow, PC.black, 1.0);
  sandbagWall(-8, -2, -8, 3, 4); floodPole(7, 0, 2, -2.2, 7, 2, 0xfff0d8, 22);
  W.pop();
  // gas station on the highway (west)
  buildGasStation(-132, 186);
  // wrecks and debris along the highway
  pickup(-60, 174, 0.4, 0, true); humvee(85, 163, 2.8, PC.tan, true); cargoTruck(-205, 180, 1.2, PC.rust);
  for (let i = 0; i < 25; i++) { const x = mr(-280, 280), z = 170 + (mrand() < 0.5 ? -1 : 1) * mr(6, 14); if (Math.abs(x + 132) < 30) continue; mpick([() => tire(x, 0, z, mr(0, 6)), () => trashPile(x, 0, z, 6), () => rock(x, terrainH(x, z), z, mr(0.4, 1.2)), () => drum(x, terrainH(x, z), z, PC.rust, mr(0, 6), true)])(); }
  // wadi bridge on the highway
  const bx = -228 + Math.sin(170 * 0.018) * 14;
  W.push(bx, 0, 170);
  W.box(24, 0.6, 10, 0, -0.3, 0, PC.concrete, { solid: true, walk: true }); W.box(24, 0.07, 9, 0, 0.035, 0, 0x2e2f31, { ao: false });
  for (const s of [-1, 1]) { W.box(24, 0.9, 0.3, 0, 0.45, s * 4.9, PC.concreteLt, { solid: true }); for (let i = 0; i < 12; i++) W.box(0.25, 0.25, 0.32, -11 + i * 2, 0.95, s * 4.9, PC.concreteDk); }
  for (const s of [-7, 0, 7]) for (const t of [-3, 3]) W.box(1.2, 6, 1.2, s, -3.6, t, PC.concreteDk, { solid: true });
  for (let i = 0; i < 6; i++) W.box(0.01, mr(0.5, 1.5), 0.01, mr(-10, 10), mr(-3, -1), 5.06, 0x4a4a46, { ao: false });
  W.pop();
  for (let i = 0; i < 30; i++) { const z = mr(-200, 280), x = -228 + Math.sin(z * 0.018) * 14 + mr(-6, 6); rock(x, terrainH(x, z) - 0.2, z, mr(0.3, 1.0), mpick([0x6b6050, 0x7a6a56, 0x5a5044])); }
  for (let i = 0; i < 26; i++) { const z = mr(-200, 280), x = -228 + Math.sin(z * 0.018) * 14 + mr(-10, 10); bush(x, terrainH(x, z), z, mr(0.5, 1.3), PC.leaf); }
  // bus stop on the highway shoulder
  busShelter(24, terrainH(24, 179), 179, Math.PI); bench(30, terrainH(30, 178.5), 178.5, Math.PI);
  for (let i = 0; i < 4; i++) trafficCone(-112 + i * 3, terrainH(-112 + i * 3, 172), 172);
  buildCrashSite(-152, 56);
  buildRadioHill(190, -70);
  buildVillage(150, 222);
  // scattered desert detail everywhere
  for (let i = 0; i < 260; i++) {
    const x = mr(-290, 290), z = mr(-290, 290);
    if (x > -82 && x < 82 && z > -172 && z < 140) continue;
    if (x > 92 && x < 218 && z > 182 && z < 265) continue;
    if (Math.abs(z - 170) < 8) continue;
    const y = terrainH(x, z), k = mrand();
    if (k < 0.45) rock(x, y - 0.1, z, mr(0.3, 1.8), mpick([0x6b6050, 0x7a6a56, 0x5a5044, 0x847058]));
    else if (k < 0.85) bush(x, y, z, mr(0.4, 1.1), mpick([PC.leaf, PC.dry, 0x6a6a3a]));
    else if (k < 0.92) tire(x, y, z, mr(0, 6));
    else drum(x, y, z, PC.rust, mr(0, 6), true);
  }
}

function buildGasStation(x, z) {
  W.push(x, 0, z);
  W.box(46, 0.1, 26, 0, 0.05, 0, 0x3a3a3c, { solid: true, walk: true, ao: false });
  for (let i = 0; i < 10; i++) W.box(mr(0.6, 2), 0.004, mr(0.6, 1.5), mr(-12, 12), 0.102, mr(-8, 2), 0x1a1a1a, { ao: false });
  // canopy
  for (const s of [-1, 1]) for (const t of [-1, 1]) W.box(0.5, 5, 0.5, s * 7, 2.5, -4 + t * 3, PC.offwhite, { solid: true });
  W.box(18, 0.5, 9, 0, 5.25, -4, PC.offwhite); W.box(18.2, 0.6, 9.2, 0, 5.3, -4, PC.redLt, { ao: false }); W.box(17.6, 0.55, 8.6, 0, 5.3, -4, PC.offwhite);
  for (let i = 0; i < 6; i++) { W.box(1.2, 0.04, 0.4, -6 + i * 2.4, 4.98, -4, GLOW.cool, { layer: 'glow' }); }
  W.lamp(-4, 4.5, -4, 0xe8f0ff, 16, 18, { halo: 0.3 }); W.lamp(4, 4.5, -4, 0xe8f0ff, 16, 18, { halo: 0.3 });
  // pump islands
  for (const px of [-3.5, 3.5]) {
    W.box(1.4, 0.25, 4.2, px, 0.225, -4, PC.concreteLt, { solid: true });
    for (const t of [-1, 1]) {
      W.push(px, 0.35, -4 + t * 1.2);
      W.box(0.9, 1.7, 0.6, 0, 0.85, 0, PC.offwhite, { layer: 'metal' }); W.box(0.92, 0.3, 0.62, 0, 1.6, 0, PC.redLt, { layer: 'metal' });
      for (const f of [-1, 1]) { W.box(0.5, 0.3, 0.004, 0, 1.1, f * 0.302, 0x2a4a2a, { layer: 'glow' }); for (let k = 0; k < 3; k++) W.box(0.12, 0.08, 0.02, -0.25 + k * 0.25, 0.7, f * 0.31, [PC.green, PC.yellow, PC.redLt][k]); }
      W.cable([0.45, 1.3, 0], [0.7, 0.3, 0.2], 0.3, 0.02, PC.black, 6); W.box(0.06, 0.25, 0.1, 0.48, 1.1, 0.0, PC.black);
      W.pop();
    }
    trashCan(px, 0.35, -6.4, 0x2a4a7a, false);
  }
  // shop
  building(0, 6, 16, 8, { H: 3.4, T: 0.25, wall: PC.offwhite, inner: 0xe8e4da, floorFinish: 0xd0ccc0, tiles: true, frame: PC.alu, parapet: 0.8, parapetCol: PC.redLt, coping: PC.white,
    open: { n: [{ at: -5.5, w: 2.6, type: 'window', sill: 0.5, h: 2.1 }, { at: -2, w: 2.6, type: 'window', sill: 0.5, h: 2.1 }, { at: 1.5, w: 1.8, type: 'door', h: 2.3, door: 'ajar', style: 'metal', doorCol: PC.alu, doorCol2: PC.glass }, { at: 5, w: 2.6, type: 'window', sill: 0.5, h: 2.1 }], s: [{ at: 5, w: 0.9, type: 'door', door: 'closed', style: 'metal' }] },
    rooms: [{ x0: 4, z0: -4 + 0.25, x1: 4, z1: 4 - 0.25, ops: [{ at: 5.5, w: 0.9, type: 'door', door: 'ajar' }] }],
    interior: () => {
      for (let i = 0; i < 3; i++) shelf(-4.5 + i * 2.6, 0, 0.5, Math.PI / 2, 3.6, 5, 'shop');
      for (let i = 0; i < 3; i++) { W.push(-6.6 + i * 1.0, 0, 3.4); W.box(0.95, 2.0, 0.7, 0, 1.0, 0, PC.white, { layer: 'metal', solid: true }); W.box(0.85, 1.8, 0.02, 0, 1.0, -0.36, PC.glass, { layer: 'glass' }); for (let k = 0; k < 4; k++) { W.box(0.85, 0.02, 0.6, 0, 0.3 + k * 0.42, 0, PC.alu); for (let j = 0; j < 6; j++) bottle(-0.35 + j * 0.14, 0.31 + k * 0.42, -0.15, mpick([0x8a2a2a, 0x2a6a2a, 0x2a4a8a, 0xc88a2a]), 0.22); } W.box(0.85, 0.05, 0.02, 0, 1.92, -0.36, GLOW.cool, { layer: 'glow' }); W.pop(); }
      W.box(2.8, 1.0, 0.7, 2.2, 0.5, -2.6, PC.woodLt, { solid: true }); W.box(2.9, 0.05, 0.8, 2.2, 1.02, -2.6, 0x4a4a48);
      W.box(0.4, 0.15, 0.35, 1.6, 1.12, -2.6, PC.black); W.box(0.3, 0.22, 0.04, 1.6, 1.3, -2.5, 0x2a3a2a, { layer: 'glow', rx: -0.4 }); // register
      W.box(1.2, 1.4, 0.3, 2.2, 1.2, -3.55, PC.redLt); for (let i = 0; i < 18; i++) W.box(0.1, 0.12, 0.08, 1.7 + (i % 6) * 0.18, 1.0 + Math.floor(i / 6) * 0.3, -3.4, mpick([PC.yellow, PC.redLt, PC.blueLt, PC.white])); // cigarette rack
      mug(2.8, 1.04, -2.5, PC.white); phone(2.5, 1.04, -2.4, 0.3); chairOffice(2.2, 0, -3.2, 0.2);
      for (let i = 0; i < 4; i++) ceilingLight(-5 + i * 2.6, 3.4, 0, Math.PI / 2, 1.2, true);
      shelf(6.0, 0, 3.0, 0, 1.2, 4, 'pantry'); crate(6.2, 0, 0, 0.9, 0.6, 0.7, 0.3); W.box(0.8, 1.6, 0.6, 6.4, 0.8, -3.2, PC.metal, { layer: 'metal', solid: true }); mop(5.0, 0, -3.3);
      bulb(6.0, 3.4, 0, 0.2, GLOW.warm, 2.5, 6);
      W.box(1.4, 0.004, 0.9, 1.5, 0.01, -1.0, 0x2a2a3a, { ao: false });
    } });
  // sign tower with prices
  W.push(10, 0, -12); W.box(0.4, 7, 0.4, 0, 3.5, 0, PC.metal, { layer: 'metal', solid: true }); W.box(2.4, 2.0, 0.4, 0, 7.5, 0, PC.redLt); W.box(2.2, 1.0, 0.42, 0, 7.9, 0, PC.white); for (let i = 0; i < 3; i++) W.box(1.8, 0.25, 0.44, 0, 6.9 - i * 0.0 - 0.35 * i * 0, -0, PC.black); W.box(2.0, 0.5, 0.43, 0, 6.85, 0, 0x2a2a2a); W.box(1.6, 0.25, 0.44, 0, 6.85, 0, GLOW.red, { layer: 'glow' }); W.lamp(0, 7.5, 1, 0xff6040, 3, 8, { halo: 0.6 }); W.pop();
  // air pump, ice chest, propane cage, dumpster
  W.box(0.5, 1.2, 0.4, -9, 0.7, 4, PC.blueLt, { layer: 'metal', solid: true });
  W.box(1.4, 1.1, 0.7, 9.4, 0.6, 2.5, PC.white, { layer: 'metal', solid: true }); W.box(1.2, 0.3, 0.02, 9.4, 0.8, 2.15, PC.blueLt);
  W.push(-9.5, 0.1, 9); for (let i = 0; i < 6; i++) W.cyl(0.16, 0.16, 0.8, -0.6 + (i % 3) * 0.4, 0.42, -0.2 + Math.floor(i / 3) * 0.4, PC.white, { seg: 10, layer: 'metal' }); for (let i = 0; i < 6; i++) W.box(0.01, 1.2, 1.0, -0.8 + i * 0.32, 0.6, 0, PC.alu, { layer: 'metal' }); W.pop(); W.solid(1.8, 1.2, 1.0, -9.5, 0.6, 9, 'metal');
  W.box(2.0, 1.4, 1.2, 10, 0.8, 10.5, 0x2a5a3a, { layer: 'metal', solid: true }); W.box(2.1, 0.08, 1.3, 10, 1.55, 10.4, 0x234a30, { layer: 'metal', rx: -0.1 }); trashPile(11.5, 0.1, 10, 8);
  pickup(-8, -10, 1.9, 0x8a2a2a); streetLight(-14, 0, -8, 0, 6.5);
  W.pop();
}
function mop(x, y, z) { W.cyl(0.18, 0.15, 0.3, x, y + 0.15, z, PC.yellow, { seg: 10 }); W.rod([x, y + 0.25, z], [x + 0.15, y + 1.4, z + 0.1], 0.015, PC.woodLt); W.box(0.06, 0.12, 0.2, x, y + 0.3, z, 0xc8c0b0); }

function buildCrashSite(x, z) {
  W.push(x, 0, z, 0.6);
  W.box(14, 0.01, 10, 0, 0.03, 0, 0x2a2420, { ao: false }); for (let i = 0; i < 20; i++) W.box(mr(0.5, 2.5), 0.012, mr(0.5, 2.5), mr(-8, 8), 0.035, mr(-6, 6), mpick([0x1e1a16, 0x3a3026]), { ry: mr(0, 3), ao: false });
  W.push(0, 0.9, 0, 0, 0.08, 0.35);
  W.box(5.2, 1.8, 2.4, 0, 0.9, 0, 0x3a3e34, { layer: 'metal' }); W.hemi(2.4, 2.0, 2.4, 2.6, 0.9, 0, 0x3a3e34, { rz: -Math.PI / 2, seg: 10, layer: 'metal' });
  W.box(1.4, 1.0, 2.2, 2.9, 1.4, 0, PC.black, { layer: 'glass' }); W.box(4.0, 0.6, 1.4, -0.6, 2.1, 0, 0x34382e, { layer: 'metal' });
  for (const s of [-1, 1]) W.box(1.4, 1.2, 0.04, -0.6, 0.9, s * 1.22, PC.black);    // open cargo doors
  for (let i = 0; i < 6; i++) W.box(mr(0.4, 1.2), mr(0.3, 0.8), 0.02, mr(-2, 2), mr(0.3, 1.6), (mrand() < 0.5 ? 1 : -1) * 1.21, mpick([PC.black, PC.rust, 0x2a2a26]), { ao: false });
  for (const s of [-1, 1]) { W.box(3.4, 0.08, 0.1, 0, -0.1, s * 1.1, PC.metalDk, { layer: 'metal' }); for (const t of [-1, 1]) W.rod([t * 1.0, -0.1, s * 1.1], [t * 0.9, 0.3, s * 0.9], 0.04, PC.metalDk); }
  W.pop();
  W.push(-6, 0.6, 2.5, 0.9, 0, 0.2); W.cyl(0.35, 0.6, 5, 0, 0, 0, 0x3a3e34, { rz: Math.PI / 2, seg: 8, layer: 'metal' }); W.box(0.08, 1.4, 1.0, -2.6, 0.7, 0, 0x3a3e34, { layer: 'metal' }); for (let i = 0; i < 3; i++) W.box(0.06, 0.9, 0.12, -2.65, 1.3, -0.3 + i * 0.3, PC.black, { rx: i * 1.0 }); W.pop();
  for (let i = 0; i < 4; i++) { const a = i * 1.57 + mr(-0.3, 0.3); W.push(mr(-3, 3), 0.1, mr(-3, 3), a, 0, mr(-0.1, 0.1)); for (let k = 0; k < 4; k++) W.box(1.6, 0.04, 0.5, k * 1.5, k * 0.05, 0, 0x2a2c28, { layer: 'metal', ry: k * 0.12, rz: -k * 0.04 }); W.pop(); }
  for (let i = 0; i < 30; i++) W.box(mr(0.1, 0.6), mr(0.02, 0.2), mr(0.1, 0.5), mr(-7, 7), 0.05, mr(-5, 5), mpick([0x3a3e34, PC.black, PC.metalDk, PC.rust]), { ry: mr(0, 6), rx: mr(-0.5, 0.5), layer: 'metal' });
  for (let i = 0; i < 4; i++) ammoCan(mr(-4, 4), 0, mr(-3, 3), mr(0, 6)); helmetProp(1.5, 0.02, 3.2, 1.4, PC.olive); backpack(-2, 0, 3.6, 0.8);
  W.lamp(1.5, 1.0, 0, 0xff8040, 4, 10, { flicker: 0.6, halo: 0.6 }); // smouldering
  W.pop();
  W.solid(7, 3, 4, x, 1.5, z, 'metal', { ry: 0.6 });
  sandbagWall(x + 10, z - 6, x + 14, z - 2, 3);
}

function buildRadioHill(x, z) {
  latticeTower(x, z, 34);
  const y = terrainH(x + 6, z + 2);
  W.push(x + 6, y, z + 2);
  building(0, 0, 4, 3, { H: 2.5, T: 0.15, wall: 0x9a9a8e, inner: 0xc8c8be, parapet: 0, frame: PC.metalDk, open: { s: [{ at: 0.8, w: 0.9, type: 'door', door: 'ajar', style: 'metal' }] },
    interior: () => { for (let i = 0; i < 2; i++) { W.box(0.6, 1.8, 0.6, -1.2 + i * 0.7, 0.9, -1.0, PC.charcoal, { layer: 'metal', solid: true }); for (let k = 0; k < 8; k++) W.box(0.02, 0.02, 0.005, -1.35 + i * 0.7 + (k % 4) * 0.08, 1.2 + Math.floor(k / 4) * 0.2, -0.69, mpick([GLOW.green, GLOW.amber]), { layer: 'glow' }); } chairFolding(0.8, 0, 0.3, 2.5); mug(1.2, 0, -0.9, PC.white); bulb(0, 2.5, 0, 0.1, GLOW.cool, 2, 5); } });
  generator(-4, 0, 3, 0.4);
  W.pop();
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, r = 11; const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r; W.cyl(0.04, 0.04, 2.2, px, terrainH(px, pz) + 1.1, pz, PC.metal, { seg: 5, layer: 'metal' }); const qa = ((i + 1) / 28) * Math.PI * 2, qx = x + Math.sin(qa) * r, qz = z + Math.cos(qa) * r; if (i % 7 !== 0) for (const h of [0.6, 1.3, 2.0]) W.rod([px, terrainH(px, pz) + h, pz], [qx, terrainH(qx, qz) + h, qz], 0.008, PC.steel, { ao: false }); }
}

// ---------------- the village ----------------
function villageInterior(w, d, kind) {
  return () => {
    const iw = w - 0.8, id = d - 0.8;
    if (kind === 'living') {
      rug(0, 0, 0, iw * 0.7, id * 0.6, 0, mpick([[PC.red, 0x2a3a6a, PC.yellow, PC.offwhite], [0x6a2a3a, 0x2a4a3a, 0xc8a050, PC.offwhite], [0x3a2a5a, PC.red, PC.tan, PC.offwhite]]));
      floorCushionSet(0, 0, -id / 2 + 0.4, 0, iw * 0.8); floorCushionSet(-iw / 2 + 0.4, 0, 0, Math.PI / 2, id * 0.6);
      lowTable(0.2, 0, 0.1, 0, 1.0, 0.6); teapot(0.1, 0.32, 0.1, mr(0, 6)); for (let i = 0; i < 4; i++) glassCup(-0.25 + i * 0.18, 0.32, 0.25); bowl(0.45, 0.32, -0.05, PC.offwhite, PC.orange);
      lantern(iw / 2 - 0.6, 2.1, -id / 2 + 0.6, true); claypot(iw / 2 - 0.4, 0, id / 2 - 0.4, 1.2); claypot(iw / 2 - 0.9, 0, id / 2 - 0.35, 0.8);
      W.box(iw * 0.5, 0.04, 0.3, 0, 1.7, -id / 2 + 0.05, PC.woodDk); for (let i = 0; i < 5; i++) mpick([() => teapot(-iw * 0.2 + i * iw * 0.1, 1.72, -id / 2 + 0.08, 0), () => bowl(-iw * 0.2 + i * iw * 0.1, 1.72, -id / 2 + 0.08), () => claypot(-iw * 0.2 + i * iw * 0.1, 1.72, -id / 2 + 0.08, 0.35)])();
      if (mrand() < 0.5) tv(-iw / 2 + 0.4, 0.4, id / 2 - 0.5, Math.PI * 0.75);
    } else if (kind === 'bed') {
      bed(-iw / 2 + 1.0, 0, -id / 2 + 1.1, 0, mpick([0x8a3a3a, 0x3a5a7a, 0x6a5a2a])); wardrobe(iw / 2 - 0.6, 0, -id / 2 + 0.35, 0); rug(0, 0, 0.5, iw * 0.5, id * 0.4, 0.2);
      basket(iw / 2 - 0.5, 0, id / 2 - 0.5); lantern(0, 2.0, 0, true); for (let i = 0; i < 3; i++) cushion(mr(-iw / 3, iw / 3), 0, id / 2 - 0.4, mr(0, 1), mpick([PC.redLt, PC.blueLt, PC.yellow]));
    } else if (kind === 'kitchen') {
      W.box(1.2, 0.8, 0.9, -iw / 2 + 0.7, 0.4, -id / 2 + 0.5, PC.mudLt, { solid: true }); W.box(0.6, 0.1, 0.6, -iw / 2 + 0.7, 0.85, -id / 2 + 0.5, PC.black); kettle(-iw / 2 + 0.6, 0.9, -id / 2 + 0.5, 0.3);
      for (let i = 0; i < 4; i++) claypot(iw / 2 - 0.4, 0, -id / 2 + 0.5 + i * 0.6, mr(0.6, 1.0)); shelf(0.5, 0, -id / 2 + 0.25, 0, 1.4, 3, 'pantry');
      lowTable(0, 0, 0.6, 0, 1.0, 0.7); for (let i = 0; i < 3; i++) bowl(-0.3 + i * 0.3, 0.32, 0.6, mpick([PC.offwhite, 0xb88a50]), mpick([null, PC.redLt, PC.green])); basket(-iw / 2 + 0.5, 0, id / 2 - 0.5, PC.orange); lantern(0, 2.0, 0, true);
      W.box(0.5, 0.06, 0.5, 0.0, 2.2, 0.2, PC.black); for (let i = 0; i < 4; i++) W.rod([mr(-0.5, 0.5), 2.3, mr(-0.5, 0.5)], [mr(-0.5, 0.5), 2.0, mr(-0.5, 0.5)], 0.01, 0x8a6a3a); // drying herbs
    } else if (kind === 'store') {
      for (let i = 0; i < 4; i++) crate(-iw / 2 + 0.6 + i * 0.95, 0, -id / 2 + 0.5, 0.8, 0.6, 0.7, mr(-0.2, 0.2)); for (let i = 0; i < 6; i++) W.sphere(0.7, 0.5, 0.5, mr(-iw / 3, iw / 3), 0.2, mr(0, id / 3), mpick([PC.tan, 0xc8b88a, PC.offwhite]), { seg: 6, hseg: 4 }); // grain sacks
      jerrycan(iw / 2 - 0.4, 0, id / 2 - 0.4, 0.3); W.cyl(0.03, 0.03, 1.4, iw / 2 - 0.6, 0.7, 0, PC.woodLt, { rx: 0.3, seg: 5 }); W.box(0.5, 0.04, 0.3, iw / 2 - 0.6, 0.06, 0.4, PC.metalDk, { layer: 'metal' }); // shovel
      lantern(0, 2.0, 0, mrand() < 0.5);
    }
  };
}
function buildVillage(cx, cz) {
  // main street (dirt) running E–W through the village with a market
  road(cx - 70, cz - 6, cx + 70, cz - 6, 7, { dirt: true });
  road(cx - 20, cz - 6, cx - 20, cz + 40, 4, { dirt: true }); road(cx + 25, cz - 6, cx + 25, cz + 40, 4, { dirt: true }); road(cx - 20, 170, cx - 20, cz - 6, 5, { dirt: true });
  W.push(cx, 0, cz);
  for (let i = 0; i < 8; i++) marketStall(-30 + i * 6.5, -12, 0, mpick([[PC.redLt, PC.offwhite], [0x2a5a8a, PC.offwhite], [PC.yellow, PC.green], [PC.orange, PC.offwhite]]));
  for (let i = 0; i < 10; i++) lantern(-32 + i * 6.8, 2.8, -9.5, true), W.cable([-32 + i * 6.8, 3.3, -9.5], [-25.2 + i * 6.8, 3.3, -9.5], 0.3, 0.005, PC.black);
  // a well with a bucket in the square
  W.push(-5, 0, 3); W.cyl(1.1, 1.2, 0.8, 0, 0.4, 0, PC.mud, { seg: 12, solid: true }); W.cyl(0.9, 0.9, 0.02, 0, 0.81, 0, 0x0a0a0a, { seg: 12 }); for (const s of [-1, 1]) W.box(0.12, 2.0, 0.12, s * 1.0, 1.0, 0, PC.woodDk); W.box(2.3, 0.12, 0.12, 0, 2.0, 0, PC.woodDk); W.cyl(0.12, 0.12, 0.6, 0, 1.85, 0, PC.wood, { rz: Math.PI / 2, seg: 8 }); W.rod([0, 1.75, 0], [0, 1.1, 0], 0.008, 0xb8a070); W.cyl(0.15, 0.12, 0.25, 0, 1.0, 0, PC.metal, { seg: 10, layer: 'metal' }); W.pop();
  W.solid(2.4, 0.8, 2.4, -5, 0.4, 3, 'concrete');
  // village square life: livestock, a tea table, bikes against the compound walls
  goat(6, 0, 2, 0.6); goat(8, 0, 4.2, 2.2); goat(7.2, 0, 0.6, -1.0); donkey(15.5, 0, 3, 1.4);
  for (let i = 0; i < 6; i++) chicken(-9 + mr(-2, 2), 0, 4.5 + mr(-1.5, 1.5), mr(0, 6));
  dog(1, 0, 5.5, 2.5); playBall(3, 0, 6, PC.blueLt);
  plasticTable(-1, 0, -0.5); for (let i = 0; i < 4; i++) plasticChair(-1 + Math.sin(i * 1.57) * 0.85, 0, -0.5 + Math.cos(i * 1.57) * 0.85, i * 1.57 + Math.PI, mpick([PC.white, PC.blueLt, PC.green]));
  samovar(-1.2, 0.72, -0.4); hookah(0.6, 0, 0.6);
  bicycle(-14, 0, 8.2, 0, PC.blueLt); bicycle(-12.2, 0, 8.2, 0.05, PC.redLt); bicycle(10, 0, 8.3, 0, PC.green);
  // compounds: courtyard walls + houses with interiors; one is the shoot house
  const comps = [
    { x: -38, z: 14, w: 16, d: 14, houses: [[-3, -2, 8, 6, 'living'], [5, 3, 4, 5, 'kitchen']] },
    { x: -18, z: 16, w: 14, d: 14, houses: [[0, -2, 9, 6, 'bed'], [-3, 4, 5, 4, 'store']] },
    { x: 2, z: 18, w: 14, d: 16, houses: [[0, -3, 10, 6, 'living'], [3, 4, 5, 5, 'bed']] },
    { x: 22, z: 16, w: 16, d: 14, houses: [[-2, -1, 8, 7, 'kitchen'], [5, 3, 4, 4, 'store']] },
    { x: 42, z: 15, w: 14, d: 14, houses: [[0, -1, 9, 7, 'shoot']] },
    { x: -34, z: -30, w: 14, d: 12, houses: [[0, 0, 8, 6, 'living']] },
    { x: -12, z: -30, w: 12, d: 12, houses: [[0, 1, 7, 6, 'bed']] },
    { x: 14, z: -32, w: 16, d: 12, houses: [[-2, 0, 9, 6, 'kitchen']] },
    { x: 38, z: -30, w: 14, d: 12, houses: [[0, 0, 8, 6, 'store']] },
  ];
  for (const c of comps) {
    const s = c.z > 0 ? -1 : 1; // gate faces the street
    W.push(c.x, 0, c.z);
    const hw = c.w / 2, hd = c.d / 2;
    compoundWall(-hw, -hd, hw, -hd, s < 0 ? c.w / 2 : -1); compoundWall(hw, -hd, hw, hd); compoundWall(hw, hd, -hw, hd, s > 0 ? c.w / 2 : -1); compoundWall(-hw, hd, -hw, -hd);
    for (const [hx, hz, w, d, kind] of c.houses) {
      if (kind === 'shoot') {
        mudHouse(hx, hz, w, d, { open: { n: [{ at: 0, w: 1.0, type: 'door', door: 'open', style: 'plank' }], s: [{ at: 2.5, w: 1.0, type: 'door', door: 'open', style: 'plank' }], e: [{ at: 0, w: 0.8, type: 'window', shutters: PC.woodDk }], w: [{ at: 1, w: 0.8, type: 'window', shutters: PC.woodDk }] },
          rooms: [{ x0: -0.5, z0: -d / 2 + 0.4, x1: -0.5, z1: d / 2 - 0.4, ops: [{ at: d / 2 - 0.4 - 1.0, w: 1.0, type: 'door', door: 'none' }] }, { x0: -0.5, z0: 0.5, x1: w / 2 - 0.4, z1: 0.5, ops: [{ at: 2.2, w: 1.0, type: 'door', door: 'none' }] }],
          interior: () => { lantern(-2.5, 2.2, 0, true); lantern(2, 2.2, -1.5, true); lantern(2, 2.2, 2, true); crate(-3, 0, -2, 0.8, 0.6, 0.7, 0.4); crate(3, 0, 2.5, 0.8, 0.6, 0.7, -0.3); rug(-2.4, 0, 1, 2.0, 1.6, 0.3); } });
        // shoot-house targets are added after the batch is built (they're dynamic)
        SHOOT_HOUSE.push({ x: cx + c.x + hx, z: cz + c.z + hz, w, d });
        continue;
      }
      const ops = { [s < 0 ? 'n' : 's']: [{ at: mr(-w / 4, w / 4), w: 1.0, type: 'door', door: mpick(['open', 'ajar', 'closed']), style: 'plank', doorCol: mpick([PC.wood, 0x2f5a6a, 0x5a3a2a]) }, { at: w / 2 - 1.2, w: 0.7, type: 'window', h: 0.8, sill: 1.1, shutters: mpick([PC.woodDk, 0x2f5a6a]), grille: true }],
        [s < 0 ? 's' : 'n']: [{ at: mr(-w / 4, w / 4), w: 0.6, type: 'window', h: 0.6, sill: 1.4, grille: true }], e: [{ at: 0, w: 0.7, type: 'window', h: 0.8, sill: 1.1, shutters: PC.woodDk }] };
      mudHouse(hx, hz, w, d, { open: ops, interior: villageInterior(w, d, kind) });
    }
    // courtyard life: tree, clay oven, firewood, laundry, goat pen, motorbike, water jugs
    if (mrand() < 0.7) palm(mr(-hw + 1.5, hw - 1.5), 0, (hd - 1.5) * -s * 0.6, mr(5, 8));
    W.push(mr(-hw + 2, hw - 2), 0, s * (hd - 1.6)); W.hemi(1.2, 1.0, 1.2, 0, 0, 0, PC.mudDk, { seg: 10 }); W.cyl(0.25, 0.25, 0.02, 0, 0.5, 0.5, PC.black, { rx: 1.2 }); W.lamp(0, 0.4, 0.6, 0xff7a30, 1.5, 4, { flicker: 0.5, halo: 0.4 }); W.pop();
    for (let i = 0; i < 8; i++) W.cyl(0.05, 0.05, 0.8, hw - 1.2 + mr(-0.2, 0.2), 0.06 + Math.floor(i / 4) * 0.1, -hd + 1.0 + (i % 4) * 0.11, PC.wood, { rx: Math.PI / 2, seg: 5 });
    for (let i = 0; i < 3; i++) claypot(-hw + 0.6 + i * 0.55, 0, hd * s * -0.2 + 1, mr(0.7, 1.1));
    if (mrand() < 0.4) { W.push(mr(-2, 2), 0, mr(-2, 2), mr(0, 6)); for (const t of [-1, 1]) W.torus(0.3, 0.07, t * 0.65, 0.33, 0, PC.rubber, { seg: 10 }); W.box(1.2, 0.18, 0.2, 0, 0.6, 0, mpick([PC.redLt, PC.blueLt, PC.black]), { layer: 'metal' }); W.box(0.5, 0.12, 0.25, -0.1, 0.78, 0, PC.black); W.rod([0.5, 0.6, 0], [0.55, 1.0, 0], 0.02, PC.steel); W.box(0.06, 0.04, 0.6, 0.55, 1.0, 0, PC.black); W.pop(); }
    W.pop();
  }
  // village edge details: wrecked car, generator, satellite dishes, power drops, garbage, donkey cart
  pickup(-55, -5, 1.2, PC.offwhite, true);
  generator(55, -16, 0.2);
  W.push(-48, 0, -16, 0.4); for (const s of [-1, 1]) W.cyl(0.55, 0.55, 0.08, 0, 0.55, s * 0.8, PC.wood, { rx: Math.PI / 2, seg: 10 }); W.box(2.0, 0.1, 1.4, 0, 0.75, 0, PC.woodLt); for (const s of [-1, 1]) W.box(2.0, 0.3, 0.06, 0, 0.95, s * 0.7, PC.wood); W.rod([1.0, 0.75, -0.3], [2.6, 0.4, -0.3], 0.03, PC.wood); W.rod([1.0, 0.75, 0.3], [2.6, 0.4, 0.3], 0.03, PC.wood); for (let i = 0; i < 6; i++) W.sphere(0.6, 0.4, 0.4, mr(-0.6, 0.6), 1.0, mr(-0.4, 0.4), PC.tan, { seg: 6, hseg: 4 }); W.pop();
  for (let i = 0; i < 12; i++) trashPile(mr(-60, 60), 0, mpick([-20, -2, 30]) + mr(-2, 2), 4);
  for (let i = 0; i < 9; i++) powerPole(-45 + i * 11, 0, -1.5, Math.PI / 2, 7.5);
  for (let i = 0; i < 8; i++) W.cable([-45 + i * 11, 6.9, -0.5], [-34 + i * 11, 6.9, -0.5], 0.4, 0.01, PC.black);
  for (let i = 0; i < 10; i++) streetLight(-42 + i * 9.5, 0, -2.6, Math.PI, 5);
  for (let i = 0; i < 20; i++) palm(mr(-65, 65), 0, mpick([-45, 38]) + mr(-6, 6), mr(5, 9));
  W.pop();
}

// targets placed around the map (dynamic objects, created after the static batch)
const SHOOT_HOUSE = [];
function placeWorldTargets() {
  // container yard steel
  addSteel(0, 0, 'rect', 0.45, { at: { x: 40, z: 75, ry: Math.PI }, label: 'YARD' });
  addSteel(0, 0, 'circle', 0.3, { at: { x: 33, z: 79, ry: Math.PI * 0.85 }, label: 'YARD' });
  addSteel(0, 0, 'circle', 0.4, { at: { x: 60, z: 82, ry: Math.PI * 1.2 }, label: 'YARD', H: 2.2 });
  // shoot house paper targets
  for (const h of SHOOT_HOUSE) {
    addPaper(0, 0, { at: { x: h.x - 2.6, z: h.z - 1.6, ry: Math.PI } });
    addPaper(0, 0, { at: { x: h.x + 2.4, z: h.z - 2.0, ry: Math.PI * 0.75 } });
    addPaper(0, 0, { at: { x: h.x + 2.6, z: h.z + 2.4, ry: -Math.PI / 2 } });
    addPaper(0, 0, { at: { x: h.x - 3.0, z: h.z + 2.0, ry: Math.PI / 2 } });
  }
  // desert lane west of the base: pop-ups at 30–120 m from a sandbag firing point
  for (const [dx, dz] of [[-30, -10], [-55, 5], [-80, -20], [-110, 10], [-135, -15]]) { const tx = -95 + dx, tz = 100 + dz; addPaper(0, 0, { at: { x: tx, z: tz, ry: Math.atan2(-95 - tx, 100 - tz) + Math.PI } }); }
  // long-range steel on the radio hill slope, visible from the north-east tower
  addSteel(0, 0, 'circle', 0.6, { at: { x: 160, z: -40, ry: Math.atan2(66 - 160, 4 + 40) }, H: 2.3, label: 'HILL' });
  addSteel(0, 0, 'rect', 0.8, { at: { x: 175, z: -15, ry: Math.atan2(66 - 175, 4 + 15) }, H: 2.5, label: 'HILL' });
  // crash site
  addSteel(0, 0, 'rect', 0.45, { at: { x: -140, z: 45, ry: 0.8 }, label: 'CRASH' });
}

// ---------------- build everything ----------------
function buildWorld() {
  const t0 = performance.now();
  buildRangeArea();
  buildPerimeter(); buildTOC(); buildLiving(); buildEastSide(); buildBaseCore(); buildOutside();
  // sandbag firing point for the desert lane
  W.push(-95, 0, 100); sandbagWall(-2, 0, 2, 0, 3); W.pop();
  MAP.batches = W.finish();
  placeWorldTargets();
  LAMPS.init();
  buildTerrain();
  MAP.buildMs = Math.round(performance.now() - t0);
  console.log(`[map] built in ${MAP.buildMs} ms`, W.stats(), `${COL.list.length} colliders, ${MAP.lamps.length} lamps`);
}

// terrain mesh: 1400 m square, vertex-coloured sand with tracks, flattened under the base
function buildTerrain() {
  const S = 1400, N = 280;
  const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = terrainH(x, z);
    p.setY(i, h);
    const n = fbm(x * 0.08, z * 0.08), n2 = vnoise(x * 0.6, z * 0.6);
    c.set(0x9a8562).lerp(new THREE.Color(0x7a6a4c), n * 0.8).lerp(new THREE.Color(0xa89270), n2 * 0.25);
    if (h < -1.5) c.lerp(new THREE.Color(0x6e604a), 0.5);                                  // wadi bed
    if (Math.max(Math.abs(x), 0) < 72 && z > 0 && z < 132) c.lerp(new THREE.Color(0x7d6d52), 0.45); // packed base ground
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, flatShading: true }));
  m.receiveShadow = true;
  scene.add(m);
  MAP.terrain = m;
}
