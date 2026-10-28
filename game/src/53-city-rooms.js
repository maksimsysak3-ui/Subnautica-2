// =====================================================================
//  CITY — rooms: plans (BSP), partitions with doors, furnishing by room type
// =====================================================================
// A room is a rectangle on wall centre-lines {x0,z0,x1,z1} at floor height y with clear height H.
// Plans are generated per floor; partitions are derived from shared edges so each wall face gets
// the paint of the room it faces, and every door is placed where it connects two real rooms.

// ---------------- binary space partition with door-safe splits ----------------
// returns {rooms:[[x0,z0,x1,z1]], doors:[{ax,c,at,w}]}; ax 'x' = partition runs along x at z=c
function bspPlan(x0, z0, x1, z1, o = {}) {
  const minW = o.minW ?? 2.6, maxA = o.maxA ?? 16, doors = [...(o.doors || [])], rooms = [];
  const blocked = (ax, c, a0, a1, at) => doors.some((d) => d.ax === ax && Math.abs(d.c - c) < 0.05 && Math.abs(d.at - at) < d.w / 2 + 0.3 && d.at > a0 - 1 && d.at < a1 + 1);
  (function rec(x0, z0, x1, z1, depth) {
    const w = x1 - x0, d = z1 - z0;
    const can = (w >= 2 * minW) || (d >= 2 * minW);
    if (!can || depth > 6 || (w * d <= maxA * mr(0.75, 1.3) && depth > 0)) { rooms.push([x0, z0, x1, z1]); return; }
    const vertical = w >= 2 * minW && (d < 2 * minW || w > d * mr(0.85, 1.15)); // vertical line x=c splits along x
    for (let t = 0; t < 12; t++) {
      if (vertical) {
        const c = Math.round(lerp(x0 + minW, x1 - minW, mr(0.2, 0.8)) * 10) / 10;
        if (blocked('x', z0, x0, x1, c) || blocked('x', z1, x0, x1, c)) continue;
        doors.push({ ax: 'z', c, at: Math.round(mr(z0 + 0.7, z1 - 0.7) * 10) / 10, w: 0.9 });
        rec(x0, z0, c, z1, depth + 1); rec(c, z0, x1, z1, depth + 1); return;
      } else {
        const c = Math.round(lerp(z0 + minW, z1 - minW, mr(0.2, 0.8)) * 10) / 10;
        if (blocked('z', x0, z0, z1, c) || blocked('z', x1, z0, z1, c)) continue;
        doors.push({ ax: 'x', c, at: Math.round(mr(x0 + 0.7, x1 - 0.7) * 10) / 10, w: 0.9 });
        rec(x0, z0, x1, c, depth + 1); rec(x0, c, x1, z1, depth + 1); return;
      }
    }
    rooms.push([x0, z0, x1, z1]);
  })(x0, z0, x1, z1, 0);
  return { rooms, doors: doors.slice((o.doors || []).length) };
}

// ---------------- partitions ----------------
// rooms: [{x0,z0,x1,z1,paint,...}], doors: [{ax,c,at,w,arch?,leaf?,style?}], y floor, H wall height
function partitions(rooms, doors, y, H, sp = {}) {
  const T = sp.T ?? 0.12, eps = 0.02;
  for (let i = 0; i < rooms.length; i++) for (let j = 0; j < rooms.length; j++) {
    if (i === j) continue;
    const A = rooms[i], B = rooms[j];
    // B directly south of A (shared line z = A.z1 = B.z0)
    if (Math.abs(A.z1 - B.z0) < eps) {
      const a0 = Math.max(A.x0, B.x0), a1 = Math.min(A.x1, B.x1);
      if (a1 - a0 > 0.1) {
        const ops = doors.filter((d) => d.ax === 'x' && Math.abs(d.c - A.z1) < eps && d.at > a0 && d.at < a1).map((d) => doorOp(d, A));
        const tA = A.x0 === a0 ? T / 2 : 0, tB = A.x1 === a1 ? T / 2 : 0;
        wall('x', a0 - tA * 0, a1, A.z1, y, H, T, { col: B.paint, inCol: A.paint, side: 1, ops, dimOut: B.dim ?? DIM_IN, dimIn: A.dim ?? DIM_IN, tx: B.wallTx ?? TX.plaster, inTx: A.wallTx ?? TX.plaster, wear: 1, inWear: 1, mat: 'plaster', ground: y });
        void tB;
      }
    }
    // B directly east of A (shared line x = A.x1 = B.x0)
    if (Math.abs(A.x1 - B.x0) < eps) {
      const a0 = Math.max(A.z0, B.z0), a1 = Math.min(A.z1, B.z1);
      if (a1 - a0 > 0.1) {
        const ops = doors.filter((d) => d.ax === 'z' && Math.abs(d.c - A.x1) < eps && d.at > a0 && d.at < a1).map((d) => doorOp(d, A));
        wall('z', a0 + T / 2, a1 - T / 2, A.x1, y, H, T, { col: B.paint, inCol: A.paint, side: 1, ops, dimOut: B.dim ?? DIM_IN, dimIn: A.dim ?? DIM_IN, tx: B.wallTx ?? TX.plaster, inTx: A.wallTx ?? TX.plaster, wear: 1, inWear: 1, mat: 'plaster', ground: y });
      }
    }
  }
}
const CIRC = new Set(['stairhall', 'hall', 'courtyard']);
// leaves swing into the room on the inner (A) side; flip when that side is circulation space
function doorOp(d, A) { return { at: d.at, w: d.w ?? 0.9, h: d.h ?? 2.1, kind: d.arch ? 'arch' : 'door', arch: d.arch, leaf: d.leaf ?? mpick(['open', 'open', 'ajar', 'none']), style: d.style ?? 'plank', doorCol: d.doorCol, rimCol: d.rimCol, flip: !!(A && (CIRC.has(A.type) || A.gallery)) }; }
// attach each door to the two rooms it connects (for furniture clearance)
function linkDoors(rooms, doors) {
  for (const d of doors) for (const r of rooms) {
    if (d.ax === 'x' && d.at > r.x0 && d.at < r.x1) { if (Math.abs(r.z0 - d.c) < 0.03) r.doors.push({ side: 'n', at: d.at, w: d.w ?? 0.9 }); if (Math.abs(r.z1 - d.c) < 0.03) r.doors.push({ side: 's', at: d.at, w: d.w ?? 0.9 }); }
    if (d.ax === 'z' && d.at > r.z0 && d.at < r.z1) { if (Math.abs(r.x0 - d.c) < 0.03) r.doors.push({ side: 'w', at: d.at, w: d.w ?? 0.9 }); if (Math.abs(r.x1 - d.c) < 0.03) r.doors.push({ side: 'e', at: d.at, w: d.w ?? 0.9 }); }
  }
}
function mkRoom(r, y, H, type, o = {}) { return { x0: r[0], z0: r[1], x1: r[2], z1: r[3], y, H, type, doors: [], wins: [], paint: o.paint ?? mpick(MC.paint), style: o.style ?? 'trad', ...o }; }

// ---------------- furnishing ----------------
// clear interior rectangle (inset from wall centre-lines)
function clearRect(r) { const i = r.inset ?? 0.07; return { x0: r.x0 + (r.extW ? r.extIn : i), z0: r.z0 + (r.extN ? r.extIn : i), x1: r.x1 - (r.extE ? r.extIn : i), z1: r.z1 - (r.extS ? r.extIn : i) }; }
// free intervals along each wall, excluding doors (+ swing clearance) and optionally windows
function freeSpans(r, cr, avoidWins) {
  const spans = {};
  for (const side of ['n', 's', 'w', 'e']) {
    const along = side === 'n' || side === 's';
    let list = [[along ? cr.x0 : cr.z0, along ? cr.x1 : cr.z1]];
    const cut = (a, b) => { const out = []; for (const [p, q] of list) { if (b <= p || a >= q) out.push([p, q]); else { if (a > p) out.push([p, a]); if (b < q) out.push([b, q]); } } list = out; };
    for (const d of r.doors) if (d.side === side) cut(d.at - d.w / 2 - 0.45, d.at + d.w / 2 + 0.45);
    if (avoidWins) for (const d of r.wins) if (d.side === side) cut(d.at - d.w / 2 - 0.1, d.at + d.w / 2 + 0.1);
    spans[side] = list.filter(([p, q]) => q - p > 0.3);
  }
  return spans;
}
// place an item of length len and depth dep against a wall; fn(x, z, ry, len)
function wallPlace(r, cr, len, dep, fn, o = {}) {
  const spans = freeSpans(r, cr, o.tall);
  const sides = o.sides ?? ['n', 's', 'w', 'e'].sort(() => mrand() - 0.5);
  for (const side of sides) {
    const list = spans[side] || [];
    for (const [p, q] of list) {
      if (q - p < len) continue;
      const a = o.center ? (p + q) / 2 : (mchance(0.5) ? p + len / 2 + 0.02 : q - len / 2 - 0.02);
      let x, z, ry;
      if (side === 'n') { x = a; z = cr.z0 + dep / 2; ry = 0; }
      else if (side === 's') { x = a; z = cr.z1 - dep / 2; ry = Math.PI; }
      else if (side === 'w') { x = cr.x0 + dep / 2; z = a; ry = Math.PI / 2; }
      else { x = cr.x1 - dep / 2; z = a; ry = -Math.PI / 2; }
      r.doors.push({ side, at: a, w: len - 0.9 + 0.02 }); // reserve (acts like an obstacle on that wall)
      fn(x, z, ry, len, side);
      return true;
    }
  }
  return false;
}
function roomLight(r, kind = r.style) {
  const cr = clearRect(r), cx = (cr.x0 + cr.x1) / 2, cz = (cr.z0 + cr.z1) / 2, top = r.y + r.H;
  if (kind === 'trad') hangLantern(cx, top, cz, 0xffc27a, 0.5, true);
  else if (kind === 'bare') { bulb(cx, top, cz, 0.35, GLOW.warm, 3.2, 8); }
  else if (kind === 'office' || kind === 'tube') {
    const n = Math.max(1, Math.round((cr.x1 - cr.x0) / 3.5));
    for (let i = 0; i < n; i++) { const x = cr.x0 + (i + 0.5) * (cr.x1 - cr.x0) / n; W.box(1.2, 0.05, 0.3, x, top - 0.05, cz, 0xf4f8ff, { layer: 'glow' }); }
    W.lamp(cx, top - 0.3, cz, 0xf0f4ff, 4.5, Math.max(8, (cr.x1 - cr.x0)), { halo: 0 });
  } else { W.cyl(0.22, 0.18, 0.08, cx, top - 0.04, cz, 0xf8f0e0, { layer: 'glow', seg: 12 }); W.lamp(cx, top - 0.3, cz, 0xffe6c0, 3.6, 8, { halo: 0 }); }
}
// furnish one room by type, all furniture in detail level 2 (small things drop to 3 inside the props)
function furnish(r) {
  // furniture is deferred detail: colliders now, geometry streamed in when the player is near
  const snap = JSON.stringify(r);
  W.defer(() => furnishNow(JSON.parse(snap)));
}
function furnishNow(r) {
  W.scope({ lod: 2, dim: DIM_IN, t: 0 }, () => {
    const cr = clearRect(r), w = cr.x1 - cr.x0, d = cr.z1 - cr.z0, cx = (cr.x0 + cr.x1) / 2, cz = (cr.z0 + cr.z1) / 2, y = r.y;
    const F = FURN[r.type];
    if (F) F(r, cr, w, d, cx, cz, y);
    if (r.light !== false) roomLight(r, r.lightKind);
  });
}
const FURN = {
  // traditional salon: sedari banquettes along the walls, tea table, rug, lantern, mirror, plates
  salon(r, cr, w, d, cx, cz, y) {
    floorRug(cx, y, cz, Math.max(1, w - 1.8), Math.max(1, d - 1.8));
    let n = 0;
    for (const side of ['n', 'w', 'e', 's']) { if (wallPlace(r, cr, Math.min(side === 'n' || side === 's' ? w - 0.2 : d - 0.2, 4.0), 0.78, (x, z, ry, len) => sedari(x, y, z, ry, len), { sides: [side] })) n++; if (n >= 3) break; }
    teaTable(cx, y, cz, 0.45);
    for (let i = 0; i < 2; i++) pouf(cx + mr(-0.9, 0.9), y, cz + (i ? 1 : -1) * mr(0.7, 1.0));
    wallPlace(r, cr, 1.0, 0.1, (x, z, ry) => { W.push(x, y + 1.7, z, ry); ornateMirror(0, 0, 0, 0, 0.7, 0.9); W.pop(); }, { tall: true });
    wallPlace(r, cr, 1.2, 0.05, (x, z, ry) => { W.push(x, y + 2.1, z, ry); wallPlates(0, 0, 0, 0, 3); W.pop(); });
    if (w > 3.4 && d > 3.4) wallPlace(r, cr, 1.4, 0.42, (x, z, ry) => tvStand(x, y, z, ry), { tall: true });
    if (mchance(0.5)) plantPot(cr.x1 - 0.35, y, cr.z1 - 0.35, 'palm');
  },
  // modern living room: sofa, armchair, coffee table, TV, shelves
  living(r, cr, w, d, cx, cz, y) {
    floorRug(cx, y, cz, Math.max(1, w * 0.55), Math.max(1, d * 0.5));
    wallPlace(r, cr, 2.1, 0.9, (x, z, ry) => sofa(x, y, z, ry, mpick([0x6a5a48, 0x3a4a5a, 0x8a3a2a, 0x5a5a5a]), 2.0));
    wallPlace(r, cr, 1.5, 0.45, (x, z, ry) => tvStand(x, y, z, ry), { tall: true });
    lowTable(cx, y, cz, 0, 1.0, 0.55);
    W.scope({ lod: 3 }, () => { teapot(cx + 0.1, y + 0.42, cz, 0); glassCup(cx - 0.2, y + 0.42, cz + 0.1); if (mchance(0.5)) magazinePile(cx + 0.3, y + 0.42, cz - 0.1); });
    wallPlace(r, cr, 1.0, 0.4, (x, z, ry) => shelfUnit(x, y, z, ry, 1.0, 1.9, 0.38, MC.cedarDk, 'books'), { tall: true });
    if (mchance(0.6)) wallPlace(r, cr, 0.6, 0.6, (x, z, ry) => plantPot(x, y, z, 'ficus'));
    wallPlace(r, cr, 1.0, 0.1, (x, z, ry) => { W.push(x, y + 1.6, z, ry); framedPhoto(0, 0, 0, 0, 0.6, 0.45); W.pop(); });
    if (mchance(0.5)) ceilingFan(cx, y + r.H, cz + 0.6);
  },
  bedroom(r, cr, w, d, cx, cz, y) {
    floorRug(cx, y, cz, Math.max(1, w * 0.5), Math.max(1, d * 0.45));
    const dbl = w > 2.9 && d > 2.9;
    wallPlace(r, cr, dbl ? 1.7 : 1.05, 2.1, (x, z, ry) => { bed(x, y, z, ry, mpick([0x8a3a3a, 0x3a5a8a, 0xd8c8a8, 0x5a7a5a, 0x7a3a6a])); W.push(x, y, z, ry); nightstand(dbl ? 1.15 : 0.8, 0, -0.8, 0); W.pop(); }, { sides: ['n', 'w', 'e', 's'] });
    wallPlace(r, cr, 1.3, 0.62, (x, z, ry) => wardrobe(x, y, z, ry, mpick([MC.cedar, MC.cedarDk, 0xe0dcd0])), { tall: true });
    wallPlace(r, cr, 1.15, 0.5, (x, z, ry) => dresser(x, y, z, ry));
    W.scope({ lod: 3 }, () => { if (mchance(0.6)) slippers(cx + mr(-0.4, 0.4), y, cz + mr(-0.4, 0.4), mr(0, 6)); if (mchance(0.4)) laundryBag(cr.x0 + 0.4, y, cr.z1 - 0.4); if (mchance(0.4)) duffel(cx + mr(-0.6, 0.6), y, cr.z0 + 0.5, mr(0, 1)); });
    wallPlace(r, cr, 0.9, 0.05, (x, z, ry) => { W.push(x, y + 1.7, z, ry); framedPhoto(0, 0, 0, 0, 0.5, 0.4); W.pop(); });
  },
  kitchen(r, cr, w, d, cx, cz, y) {
    const len = Math.min(3.2, Math.max(1.4, Math.max(w, d) - 1.4));
    let placed = wallPlace(r, cr, len, 0.6, (x, z, ry, L) => { kitchenRun(x, y, z, ry, L); W.push(x, y, z, ry); gasHob(-L / 2 + 0.45, 0.89, 0, 0); W.scope({ lod: 3 }, () => { tagine(-L / 2 + 0.45, 0.95, 0.0); kettle(-L / 2 + 1.1, 0.89, -0.1); dishRack(L / 2 - 1.0, 0.89, -0.1); cuttingBoard(0.1, 0.89, 0.05, 0.3); breadLoaf(0.1, 0.91, 0.05); spiceRack(0, 1.45, -0.27); }); W.pop(); }, { tall: true });
    if (!placed) kitchenRun(cx, y, cz, 0, 1.4);
    wallPlace(r, cr, 0.8, 0.7, (x, z, ry) => fridge(x, y, z, ry, mpick([0xe8e6e0, 0xc8c8c0, 0x3a3a3a])), { tall: true });
    wallPlace(r, cr, 0.4, 0.4, (x, z) => butane(x, y, z));
    if (w > 2.6 && d > 2.6) { tableFolding(cx, y, cz, 0, 1.2, 0.75); W.scope({ lod: 3 }, () => { plate(cx - 0.3, y + 0.76, cz); plate(cx + 0.3, y + 0.76, cz); bowl(cx, y + 0.76, cz, 0x3a6aa0, 0xc89a40); glassCup(cx + 0.1, y + 0.76, cz + 0.2); }); stool(cx - 0.8, y, cz, PC.woodLt); stool(cx + 0.8, y, cz, PC.woodLt); }
    W.scope({ lod: 3 }, () => { if (mchance(0.6)) basket(cr.x0 + 0.35, y, cr.z0 + 0.35, 'bread'); });
  },
  bath(r, cr, w, d, cx, cz, y) {
    W.box(w, 1.3, 0.02, cx, y + 0.65, cr.z0 + 0.01, 0xffffff, { t: TX.zellige, wear: mpick([0, 1, 4, 5]) });
    wallPlace(r, cr, 0.95, 0.95, (x, z, ry) => showerCorner(x, y, z, ry), { sides: ['n', 'e', 'w', 's'] });
    wallPlace(r, cr, 0.5, 0.7, (x, z, ry) => toilet(x, y, z, ry));
    wallPlace(r, cr, 0.6, 0.5, (x, z, ry) => { sink(x, y, z, ry); W.push(x, y, z, ry); mirror(0, 1.45, -0.2, 0); W.pop(); });
    if (w * d > 5) wallPlace(r, cr, 0.65, 0.6, (x, z, ry) => washingMachine(x, y, z, ry));
    W.scope({ lod: 3 }, () => towel(cx, y + 1.2, cr.z0 + 0.06, 0, mpick([0xe8e0d0, 0x3a6ab0, 0xd04a4a])));
  },
  storage(r, cr, w, d, cx, cz, y) {
    for (let i = 0; i < 3; i++) wallPlace(r, cr, 1.2, 0.45, (x, z, ry) => shelfUnit(x, y, z, ry, 1.2, Math.min(2.2, r.H - 0.4), 0.42, PC.metal, 'boxes'), { tall: true });
    W.scope({ lod: 3 }, () => { for (let i = 0; i < 5; i++) cardboard(cx + mr(-w / 3, w / 3), y, cz + mr(-d / 3, d / 3), mr(0, 3), mr(0.8, 1.4)); for (let i = 0; i < 3; i++) sack(cx + mr(-w / 3, w / 3), y, cz + mr(-d / 3, d / 3), mpick([0xc8b088, 0xa89068])); });
  },
  hall(r, cr, w, d, cx, cz, y) {
    if (w > 1.6 && d > 1.6) floorRug(cx, y, cz, Math.min(w - 0.6, 2.4), Math.min(d - 0.6, 1.4));
    wallPlace(r, cr, 0.6, 0.35, (x, z, ry) => { W.push(x, y, z, ry); W.box(0.6, 0.85, 0.32, 0, 0.42, 0, MC.cedar, { t: TX.carved }); W.pop(); W.scope({ lod: 3 }, () => { slippers(x, y, z + 0.0, ry); }); });
    wallPlace(r, cr, 0.6, 0.05, (x, z, ry) => { W.push(x, y + 1.5, z, ry); ornateMirror(0, 0, 0, 0, 0.45, 0.7); W.pop(); }, { tall: true });
  },
  // shop interior: shelves, counter, trade goods
  shop(r, cr, w, d, cx, cz, y) { shopFit(cr.x0, cr.z0, cr.x1, cr.z1, y, r.front ?? 1, r.trade ?? 'grocery', r.H); r.light = false; },
  cafe(r, cr, w, d, cx, cz, y) {
    const f = r.front ?? 1, back = f > 0 ? cr.z0 : cr.z1;
    counter(cx + w * 0.18, y, back + f * 1.1, f > 0 ? Math.PI : 0, Math.min(3, w * 0.55), 0x5a3a24, 0x2a2a2a);
    W.scope({ lod: 3 }, () => { espressoMachine(cx + w * 0.18 - 0.6, y + 1.05, back + f * 1.1, f > 0 ? 0 : Math.PI); for (let i = 0; i < 6; i++) W.cyl(0.03, 0.025, 0.09, cx + w * 0.18 + 0.2 + i * 0.12, y + 1.1, back + f * 1.1, 0x7a9a3a, { seg: 6, layer: 'glass' }); });
    shelfUnit(cx + w * 0.18, y, back + f * 0.22, f > 0 ? 0 : Math.PI, Math.min(2.4, w * 0.5), 2.0, 0.35, 0x5a3a24, 'grocery');
    const tz0 = back + f * 2.3, tz1 = (f > 0 ? cr.z1 : cr.z0) - f * 0.9;
    for (let zz = tz0; f > 0 ? zz < tz1 : zz > tz1; zz += f * 1.7) for (let xx = cr.x0 + 0.9; xx < cr.x1 - 0.7; xx += 1.75) bistroTable(xx, y, zz, mpick([2, 3, 4]));
    W.push(cr.x0 + 0.06, y + 2.2, cz, Math.PI / 2); tv(0, -0.45, 0, 0); W.pop();
    roomLight(r, 'warm'); hangLantern(cx - w * 0.25, y + r.H, cz, 0xffc070, 0.5, true);
  },
  office(r, cr, w, d, cx, cz, y) {
    const cols = Math.max(1, Math.floor((w - 0.6) / 2.4)), rows = Math.max(1, Math.floor((d - 0.8) / 2.6));
    const ox = cr.x0 + (w - (cols - 1) * 2.4) / 2;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) officeDesk(ox + i * 2.4, y, cr.z0 + 1.0 + j * 2.6, 0, 1.5);
    wallPlace(r, cr, 0.5, 0.65, (x, z, ry) => fileCabinet(x, y, z, ry, mpick([PC.metal, 0x8a8e92, 0x3a4a3a])), { tall: true });
    wallPlace(r, cr, 0.5, 0.65, (x, z, ry) => fileCabinet(x, y, z, ry, PC.metal), { tall: true });
    wallPlace(r, cr, 0.6, 0.6, (x, z) => plantPot(x, y, z, 'ficus'));
    wallPlace(r, cr, 0.5, 0.5, (x, z, ry) => waterCooler(x, y, z, ry));
    wallPlace(r, cr, 1.4, 0.05, (x, z, ry) => { W.push(x, y + 1.5, z, ry); whiteboard(0, 0, 0, 0, 1.4, 0.9); W.pop(); }, { tall: true });
    r.lightKind = 'office';
  },
  meeting(r, cr, w, d, cx, cz, y) {
    meetingTable(cx, y, cz, w > d ? 0 : Math.PI / 2, Math.max(1.6, Math.min(4, Math.max(w, d) - 2)));
    wallPlace(r, cr, 1.6, 0.05, (x, z, ry) => { W.push(x, y + 1.5, z, ry); whiteboard(0, 0, 0, 0, 1.6, 1.0); W.pop(); }, { tall: true });
    wallPlace(r, cr, 0.6, 0.6, (x, z) => plantPot(x, y, z, 'palm'));
    r.lightKind = 'office';
  },
  security(r, cr, w, d, cx, cz, y) {
    wallPlace(r, cr, Math.min(2.6, w - 0.4), 0.15, (x, z, ry) => { W.push(x, y + 1.75, z, ry); cctvWall(0, 0, 0.06, 0, 4, 3); W.pop(); W.push(x, y, z, ry); desk(0, 0, 0.75, 0, 2.0, 0.8, 0x6a6a6a); W.scope({ lod: 3 }, () => { monitor(-0.5, 0.76, 0.6, 0); monitor(0.5, 0.76, 0.6, 0); keyboard(0, 0.76, 0.95, 0); radioSet(0.8, 0.76, 0.95, 0); mug(-0.8, 0.76, 0.95); }); chairOffice(0, 0, 1.6, Math.PI); W.pop(); }, { tall: true });
    wallPlace(r, cr, 1.2, 0.5, (x, z, ry) => { locker(x - 0.3, y, z, ry, PC.metal); locker(x + 0.3, y, z, ry, PC.metal); }, { tall: true });
    wallPlace(r, cr, 0.4, 0.1, (x, z, ry) => { W.push(x, y + 1.4, z, ry); keyBox(0, 0, 0, 0); W.pop(); });
    wallPlace(r, cr, 0.5, 0.3, (x, z, ry) => { W.push(x, y, z, ry); W.box(0.5, 0.9, 0.3, 0, 0.45, 0, PC.metal, { layer: 'metal' }); chargerRack(0, 0.9, 0, 0, 6); W.pop(); });
    r.lightKind = 'tube';
  },
  workshop(r, cr, w, d, cx, cz, y) {
    wallPlace(r, cr, 2.0, 0.8, (x, z, ry) => workbench(x, y, z, ry, 2.0), { tall: true });
    wallPlace(r, cr, 0.7, 0.45, (x, z, ry) => toolChest(x, y, z, ry, mpick([PC.redLt, PC.blue, 0x3a3a3a])), { tall: true });
    wallPlace(r, cr, 1.2, 0.45, (x, z, ry) => shelfUnit(x, y, z, ry, 1.2, 2.0, 0.42, PC.metal, 'tools'), { tall: true });
    W.scope({ lod: 3 }, () => { oilCans(cx + mr(-1, 1), y, cz + mr(-1, 1)); tire(cr.x0 + 0.5, y, cr.z1 - 0.5, 0); if (mchance(0.5)) weldingCart(cx + 1, y, cz - 0.5, 0.4); });
    r.lightKind = 'tube';
  },
  courtyard(r, cr, w, d, cx, cz, y) { r.light = false; },
  stairhall(r, cr, w, d, cx, cz, y) { r.lightKind = 'bare'; },
  empty() {},
};
