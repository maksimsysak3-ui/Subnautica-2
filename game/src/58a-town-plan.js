// =====================================================================
//  DAR ESSALAM — the street plan (every lane drawn by hand)
// =====================================================================
//              N (−z)
//   tannery · souk lanes · mosque+minaret · KASBAH (enemy HQ)
//   medina (riads, blue quarter) · PLACE (main square) · Rue des Orangers
//   skala sea wall · avenue to the sea gate · Mellah · garden
//   ~~~~~~~~~~~~~~~~~~~~~ harbour quay · jetty · fishing boats ~~~~~~~~~~~~~~~~~~~~~
// x east, z south. The square is centred on the origin.
const SQ = { x0: -30, z0: -22, x1: 30, z1: 22 };                // Place Lalla Yeto — the main square
const RAHBA = { x0: -62, z0: -97, x1: -41, z1: -78 };           // spice square in the souk
const KSQ = { x0: 34, z0: -66, x1: 61, z1: -37 };               // square before the kasbah gate
const JARDIN = { x0: 78, z0: 28, x1: 112, z1: 55 };             // Mellah garden
const QUAY = { x0: -22, z0: 92, x1: 152, z1: 113.5 };           // harbour quay
const KASBAH = { x0: 64, z0: -134, x1: 152, z1: -36 };
const MOSQUE = { x0: -72, z0: -62, x1: -34, z1: -30 };
const TANNERY = { x0: -146, z0: -130, x1: -106, z1: -96 };
const SPAWN = { x: -5, z: 13, yaw: 0.35 };

function plaza(name, r, col, tx) {
  GR.rect((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, r.x1 - r.x0, r.z1 - r.z0, 0, GR.PAVE, true);
  groundPlate(r.x0, r.z0, r.x1, r.z1, col, tx, 3, 0.035);
  TOWN.plazas.push({ name, ...r });
}
const reserve = (r, pad = 0) => GR.rect((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, r.x1 - r.x0 + pad * 2, r.z1 - r.z0 + pad * 2, 0, GR.RESERVED, true);
// a straight frontage line along the edge of a square (not a street: no paving, no NPC route)
const edge = (a, b) => ({ pts: [a, b], w: 0, len: Math.hypot(b[0] - a[0], b[1] - a[1]) });

// district fill palettes (used once a hand-written frontage list runs out)
const FILL = {
  medina: '6/3/o 5/2/r+pots 7/3/c+boug 4/2/o 6/3/r+mash 5/2/c 8/3/o+rug 5/3/r 6/2/c+terr 4/3/o 7/2/r+boug+cat 5/3/c+mash',
  blue: '5/2/b+pots 6/3/b 4/2/b+boug 7/3/b+pots 5/2/b+cat 6/2/b+terr 4/3/b+pots',
  souk: '4x6/2/s:spice 3.6x6/2/s:leather 4.2x6/2/s:rugs 3.4x6/1/s:lamps 4x6/2/s:pottery 3.8x6/2/s:fabric 4.4x6/2/s:copper 3.6x6/1/s:grocery',
  mellah: '6/3/m 5/3/m+boug 7/4/m 5/2/m+pots 6/3/m+rug 8/3/m+terr 5/3/m+cat',
  avenue: '8/3/h:grocery 7/4/h 9/3/s:fabric+bal 7/3/h:pottery 8/4/h+bal 6/3/s:spice+bal',
  quay: '10x10/2/w 8x10/2/w 7/2/s:grocery+terr 12x12/2/w 6/2/c+boug',
};
const PAL = { medina: [MC.ochre, MC.rose, MC.plaster, MC.ochreDk, MC.cream, MC.roseDk], blue: [0xe9eef3, 0xdfe7f0, 0xc6d8ea], mellah: [MC.plasterLt, 0xd8c8b0, MC.cream, 0xe8d8a8, 0xd8e0e0, 0xe4c8b8], kasbah: [MC.pise, 0xa97e58] };

function buildTownPlan() {
  // ---- open spaces and big footprints first, so frontages wrap around them ----
  plaza('Place Lalla Yeto', SQ, 0xcdb894, TX.paving);
  plaza('Rahba Kedima', RAHBA, 0xb8a080, TX.cobble);
  plaza('Place de la Kasbah', KSQ, 0xc0aa88, TX.paving);
  plaza('Jardin du Mellah', JARDIN, 0xc8b898, TX.paving);
  plaza('Quai des Pêcheurs', QUAY, 0xa89c88, TX.paving);
  for (const r of [KASBAH, MOSQUE, TANNERY]) reserve(r, 0.5);
  TOWN.restricted.push(KASBAH, PALACE);   // no civilian business inside the militia's walls
  plaza('Mosque forecourt', { x0: -44, z0: -29, x1: -30, z1: -14 }, 0xd0c0a0, TX.paving);
  plaza('Minaret steps', { x0: -34, z0: -36.5, x1: -27.5, z1: -30 }, 0xc8b898, TX.paving);
  plaza('Tannery steps', { x0: -106, z0: -112, x1: -102, z1: -96 }, 0xb8a888, TX.cobble);
  plaza('Skala steps', { x0: -24.5, z0: 86, x1: -21.5, z1: 99 }, 0xb8a888, TX.stone);
  // town walls: a strip all round
  for (const r of [{ x0: -160, z0: -140, x1: 64, z1: -132 }, { x0: -160, z0: -140, x1: -152, z1: 100 }, { x0: 150, z0: -36, x1: 160, z1: 92 }, { x0: -160, z0: 89, x1: -22, z1: 101 }]) GR.rect((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, r.x1 - r.x0, r.z1 - r.z0, 0, GR.WALL, true);

  // ---- streets ----
  const L = (n, pts, w, kind, o) => lane(n, pts, w, kind, o);
  // the avenue to the sea gate and the quay
  L('avenue', [[0, 22], [0, 92]], 9, 'avenue', { raw: true });
  L('quay', [[-20, 102], [150, 102]], 12, 'quay', { raw: true });
  // souk
  L('soukKebir', [[0, -22], [2, -46], [-2, -70], [0, -96], [-3, -128]], 4.4, 'souk');
  L('soukZarbia', [[-24, -22], [-29, -48], [-36, -73], [-40, -100], [-44, -128]], 3.6, 'souk');
  L('soukSemmarine', [[24, -22], [28, -44], [34, -60]], 3.6, 'souk');
  L('derbChouari', [[-36, -73], [-18, -71], [-2, -70], [16, -66], [34, -62]], 3.2, 'souk');
  L('derbRahba', [[-82, -60], [-70, -72], [-62, -84]], 3, 'alley');
  L('derbDebbagh', [[-62, -92], [-84, -99], [-106, -104]], 2.8, 'alley');
  // medina
  L('derbLalla', [[-30, 4], [-48, 8], [-68, 2], [-92, 6], [-118, 0], [-148, 3]], 3.6, 'alley');
  L('derbJamaa', [[-30, -14], [-44, -21]], 4, 'alley', { raw: true });
  L('derbSidi', [[-68, 2], [-71, -18], [-79, -38], [-82, -60]], 3, 'alley');
  L('derbKhemis', [[-92, 6], [-90, -20], [-100, -42], [-104, -64], [-82, -60]], 2.6, 'alley');
  L('derbLamia', [[-92, 6], [-96, 24], [-104, 36], [-108, 42]], 2.8, 'alley');
  L('derbSaida', [[-48, 8], [-47, 30], [-54, 54], [-50, 76], [-44, 86]], 3, 'alley');
  L('derbZerka', [[-118, 0], [-124, 30], [-120, 58], [-104, 80], [-84, 86]], 2.8, 'alley');
  L('derbTala', [[-118, 0], [-128, -28], [-126, -56], [-114, -84], [-106, -98]], 2.8, 'alley');
  L('derbZitoun', [[-47, 30], [-30, 33], [-4.5, 31]], 3, 'alley');
  L('derbFrane', [[-120, 58], [-92, 63], [-54, 54]], 2.6, 'alley');
  L('derbBab', [[-54, 54], [-30, 58], [-4.5, 60]], 3, 'alley');
  L('skalaLane', [[-148, 86], [-84, 86], [-44, 86], [-4.5, 86]], 4, 'alley', { raw: true });
  // east town
  L('orangers', [[30, 0], [62, 3], [100, -1], [148, 1]], 7, 'avenue');
  L('derbKasbah', [[44, -37], [42, -18], [44, -3.5]], 3.4, 'alley');
  L('derbMellah', [[42, 3.5], [46, 28], [41, 52], [44, 80], [44, 92]], 3.2, 'alley');
  L('derbHebrew', [[98, 3.5], [96, 28]], 3.2, 'alley');
  L('derbSouiri', [[95, 55], [97, 80], [97, 92]], 3.2, 'alley');
  L('derbNajjar', [[46, 28], [78, 34]], 3, 'alley');
  L('derbTijani', [[112, 40], [148, 38]], 3, 'alley');
  L('derbMoulay', [[41, 52], [78, 50]], 3, 'alley');
  L('derbBahri', [[112, 52], [132, 62], [148, 64]], 3, 'alley');
  L('derbSoussi', [[4.5, 46], [41, 46]], 3, 'alley', { raw: true });
  L('derbFassi', [[4.5, 72], [43, 70]], 3, 'alley', { raw: true });
}

// ---------------- frontages: written house by house ----------------
function buildTownFronts() {
  const T = TOWN.lanes, F = (n, side, spec, o = {}) => front(T[n], side, spec, o);
  // ===== the square: four hand-composed sides =====
  // north: between the three souk mouths (café at the centre-right is an authored building)
  front(edge([-30, -22], [-26.5, -22]), -1, '3.5/3/r');
  front(edge([-21.8, -22], [-2.4, -22]), -1, '6x9/3/h:pottery+bal 7x9/4/h+bal+sign 6x9/3/s:spice+bal');
  front(edge([16, -22], [22, -22]), -1, '6x8/3/h:lamps+bal');
  front(edge([26, -22], [30, -22]), -1, '4/3/h');
  // west: mosque passage, then houses along the medina mouth
  front(edge([-30, -1.6], [-30, -11.5]), -1, '9.9x10/3/h:leather+bal+sign');
  front(edge([-30, 22], [-30, 6]), -1, '8x10/4/h+bal+terr 8x10/3/h:rugs+bal');
  // south: either side of the avenue
  front(edge([-4.5, 22], [-30, 22]), -1, '8x10/3/h:spice+bal 9x10/4/h+bal+zel 8.5x10/3/h:fabric+bal');
  front(edge([30, 22], [4.5, 22]), -1, '8x10/3/h:grocery+bal 9x10/3/h+bal 8.3x10/4/h+bal+terr');
  // east: either side of the Rue des Orangers
  front(edge([30, -22], [30, -3.5]), -1, '9x10/3/h:copper+bal 9.5x10/4/h+bal');
  front(edge([30, 3.5], [30, 22]), -1, '9x10/3/h:pottery+bal 9.5x10/3/h+bal+terr');

  // ===== souk lanes: stall after stall =====
  F('soukKebir', 1, '4x6/2/s:spice 3.6x6/2/s:spice 4.2x6/2/s:pottery 3.4x6/1/s:lamps 4x6/2/s:lamps 4x6/2/s:leather 3.8x6/2/s:leather 4.4x6/2/s:rugs 3.6x6/2/s:copper -2 4x6/2/s:fabric 3.6x6/2/s:grocery 4x6/1/s:spice 4.2x6/2/s:rugs', { fill: FILL.souk, d: 6, start: 0.5 });
  F('soukKebir', -1, '4.2x6/2/s:rugs 4x6/2/s:rugs 3.6x6/2/s:fabric 4x6/1/s:lamps 3.8x6/2/s:pottery 4.4x6/2/s:copper 3.6x6/2/s:spice 4x6/2/s:leather -3 3.8x6/2/s:grocery 4x6/2/s:spice', { fill: FILL.souk, d: 6, start: 0.5 });
  F('soukZarbia', 1, '4x6/2/s:rugs 4.4x6/2/s:rugs 3.6x6/1/s:rugs 4x6/2/s:fabric 4.2x6/2/s:rugs', { fill: FILL.souk, d: 6 });
  F('soukZarbia', -1, '4x6/2/s:rugs 3.8x6/2/s:leather 4.2x6/2/s:rugs 3.6x6/2/s:fabric', { fill: FILL.souk, d: 6 });
  F('soukSemmarine', 1, '4x6/2/s:copper 4x6/2/s:copper 3.6x6/2/s:lamps 4.2x6/2/s:pottery', { fill: FILL.souk, d: 6 });
  F('soukSemmarine', -1, '4x6/2/s:leather 4x6/1/s:leather 3.6x6/2/s:spice', { fill: FILL.souk, d: 6 });
  F('derbChouari', 1, '4x6/2/s:copper 4x6/2/s:copper 4/2/o+pots 5/3/r', { fill: FILL.souk, d: 6 });
  F('derbChouari', -1, '4x6/2/s:leather 4x6/2/s:spice 5/3/o', { fill: FILL.souk, d: 6 });
  // ===== medina: residential, every few houses something particular =====
  F('derbLalla', 1, '5/3/r+pots 6/3/o+boug 4/2/c 7/3/r+mash+lamp 5/2/o+cat 6/3/c+rug 5/3/r+boug', { fill: FILL.medina });
  F('derbLalla', -1, '6/3/c+lamp 5/2/r+pots 4x6/2/s:grocery 6/3/o+boug 5/3/r+mash 7/2/c+terr', { fill: FILL.medina });
  F('derbSidi', 1, '5/3/r 6/2/o+pots 5/3/c+boug', { fill: FILL.medina });
  F('derbSidi', -1, '6/3/o+rug 5/2/r+cat', { fill: FILL.medina });
  F('derbKhemis', 1, '', { fill: FILL.medina }); F('derbKhemis', -1, '', { fill: FILL.medina });
  F('derbLamia', 1, '5/3/o+boug 6/2/c+pots', { fill: FILL.medina, end: 9 }); F('derbLamia', -1, '6/3/r+mash 5/2/o', { fill: FILL.medina, end: 9 });
  F('derbSaida', 1, '6/3/c+boug 5/2/o', { fill: FILL.medina }); F('derbSaida', -1, '5/3/r+lamp', { fill: FILL.medina });
  F('derbZerka', 1, '', { fill: FILL.blue }); F('derbZerka', -1, '', { fill: FILL.blue });
  F('derbTala', 1, '', { fill: FILL.blue }); F('derbTala', -1, '', { fill: FILL.blue });
  F('derbZitoun', 1, '', { fill: FILL.medina }); F('derbZitoun', -1, '', { fill: FILL.medina });
  F('derbFrane', 1, '', { fill: FILL.blue }); F('derbFrane', -1, '', { fill: FILL.medina });
  F('derbBab', 1, '', { fill: FILL.medina }); F('derbBab', -1, '', { fill: FILL.medina });
  F('derbRahba', 1, '', { fill: FILL.souk, d: 6 }); F('derbRahba', -1, '', { fill: FILL.medina });
  F('derbDebbagh', 1, '4x6/2/s:leather 4x6/2/s:leather', { fill: FILL.medina }); F('derbDebbagh', -1, '4x6/2/s:leather', { fill: FILL.medina });
  F('skalaLane', -1, '', { fill: FILL.medina });
  // ===== the avenue: arcaded grand houses and shops =====
  F('avenue', 1, '8x12/4/h:fabric+bal 9x12/3/h+bal+terr 8x12/4/s:spice+bal -0.5 7x12/3/h+bal 8x12/4/h:pottery+bal 9x12/3/h+bal', { fill: FILL.avenue, start: 0.5 });
  F('avenue', -1, '8x12/3/h:grocery+bal 8x12/4/h+bal+terr 7x12/3/s:lamps+bal 9x12/4/h+bal', { fill: FILL.avenue, start: 0.5 });
  // ===== east town and Mellah =====
  F('orangers', 1, '9x10/3/m+bal 8x10/4/m+boug 8x10/3/s:grocery 7x10/3/m 9x10/4/m+terr 8x10/3/m+rug', { fill: FILL.mellah });
  F('orangers', -1, '8x12/3/m+boug 9x12/3/m 7x12/4/m+bal', { fill: FILL.mellah });
  for (const n of ['derbKasbah', 'derbMellah', 'derbHebrew', 'derbSouiri', 'derbNajjar', 'derbTijani', 'derbMoulay', 'derbBahri', 'derbSoussi', 'derbFassi']) { F(n, 1, '', { fill: FILL.mellah }); F(n, -1, '', { fill: FILL.mellah }); }
  // garden and kasbah squares
  front(edge([78, 28], [112, 28]), -1, '7/3/m+bal 8/3/m+boug 6/4/m 7/3/m+terr');
  front(edge([78, 55], [112, 55]), 1, '8/3/m+bal 7/3/m 9/4/m+boug');
  front(edge([34, -37], [34, -66]), -1, '7/2/k 8/3/k 6/2/k');
  // ===== the quay: warehouses and fish restaurants facing the boats =====
  front(edge([4.5, 92], [150, 92]), -1, '7x10/2/s:grocery+terr 8x10/2/c+boug 12x14/2/w 10x14/2/w -1 8x10/2/s:fabric 12x14/2/w 10x12/2/w+sign 7x10/2/c+terr', { fill: FILL.quay });
}

// ---------------- the leftovers inside every block become roofscape ----------------
function buildTownBlocks() {
  fillBlocks(-152, -132, -4, 90, null, PAL.medina);
  fillBlocks(4, -40, 150, 92, null, PAL.mellah);
  fillBlocks(-4, -132, 64, -38, null, PAL.medina);
}
