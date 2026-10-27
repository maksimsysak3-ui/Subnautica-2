// =====================================================================
//  Editor: camera, tools, handles, panels
// =====================================================================
let mode = 'edit';
let tool = 'draw';
let selected = -1, hovered = -1;

const controls = new OrbitControls(camera, canvas);
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_PAN };
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 8;
controls.maxDistance = 3200;
controls.zoomToCursor = true;
let topView = false;

function frameTrack() {
  let minX = -200, maxX = 200, minZ = -200, maxZ = 200;
  if (state.points.length > 1) {
    minX = Math.min(...state.points.map((p) => p.x)); maxX = Math.max(...state.points.map((p) => p.x));
    minZ = Math.min(...state.points.map((p) => p.z)); maxZ = Math.max(...state.points.map((p) => p.z));
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, size = Math.max(maxX - minX, maxZ - minZ, 200);
  controls.target.set(cx, 0, cz);
  const d = size * 1.05;
  if (topView) camera.position.set(cx, d * 1.1, cz + 0.01);
  else camera.position.set(cx + d * 0.25, d * 0.62, cz + d * 0.72);
  controls.update();
}
function setTopView(on) {
  topView = on;
  $('bView').textContent = on ? '3D view' : 'Top view';
  const t = controls.target, dist = camera.position.distanceTo(t);
  controls.maxPolarAngle = on ? 0.001 : Math.PI * 0.47;
  controls.minPolarAngle = 0;
  if (on) camera.position.set(t.x, t.y + dist, t.z + 0.01);
  else camera.position.set(t.x + dist * 0.3, t.y + dist * 0.62, t.z + dist * 0.72);
  controls.update();
}

// --- handles --------------------------------------------------------
const handleGroup = new THREE.Group();
scene.add(handleGroup);
const handleGeo = new THREE.SphereGeometry(1, 20, 14);
const stemGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6).translate(0, 0.5, 0);
const HCOL = { idle: 0xffffff, start: 0x2fd06a, sel: 0xe10600, hover: 0xffb800 };
const handleMats = Object.fromEntries(Object.entries(HCOL).map(([k, c]) => [k, new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.95 })]));
const stemMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthTest: false });
let handles = [];
const startArrow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.2, 12).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: HCOL.start, depthTest: false, transparent: true }));
startArrow.renderOrder = 10;
handleGroup.add(startArrow);
const ghostLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 3, gapSize: 2, depthTest: false, transparent: true, opacity: 0.8 }));
ghostLine.renderOrder = 9;
handleGroup.add(ghostLine);
const snapRing = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: HCOL.start, depthTest: false, transparent: true }));
snapRing.renderOrder = 11;
handleGroup.add(snapRing);
const cursorRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.8 }));
cursorRing.renderOrder = 11;
handleGroup.add(cursorRing);

function rebuildHandles() {
  for (const h of handles) handleGroup.remove(h.ball, h.stem);
  handles = state.points.map(() => {
    const ball = new THREE.Mesh(handleGeo, handleMats.idle);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    ball.renderOrder = 12; stem.renderOrder = 8;
    handleGroup.add(ball, stem);
    return { ball, stem };
  });
}
function updateHandles() {
  if (handles.length !== state.points.length) rebuildHandles();
  const camDist = camera.position.distanceTo(controls.target);
  state.points.forEach((p, i) => {
    const h = handles[i];
    const lift = 2.2;
    const ground = Math.min(p.y, terrainHeight(p.x, p.z));
    h.ball.position.set(p.x, p.y + lift, p.z);
    const s = clamp(camera.position.distanceTo(h.ball.position) * 0.011, 0.6, 22) * (i === selected ? 1.25 : 1);
    h.ball.scale.setScalar(s);
    h.ball.material = i === selected ? handleMats.sel : i === hovered ? handleMats.hover : i === 0 ? handleMats.start : handleMats.idle;
    h.stem.position.set(p.x, ground, p.z);
    h.stem.scale.set(Math.max(1, s * 0.5), p.y + lift - ground, Math.max(1, s * 0.5));
    h.ball.visible = h.stem.visible = mode === 'edit';
  });
  startArrow.visible = mode === 'edit' && !!S && state.points.length > 1;
  if (startArrow.visible) {
    startArrow.position.set(S.px[0], S.py[0] + 2.2, S.pz[0]);
    startArrow.lookAt(S.px[0] + S.tx[0], S.py[0] + 2.2, S.pz[0] + S.tz[0]);
    startArrow.translateZ(clamp(camDist * 0.02, 3, 30));
    startArrow.scale.setScalar(clamp(camDist * 0.006, 0.8, 10));
  }
}

// --- picking --------------------------------------------------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function setNdc(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  // The camera may have moved (view toggle, framing) since the last rendered frame.
  camera.updateMatrixWorld();
  ray.setFromCamera(ndc, camera);
}
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function hitPlane(y) {
  plane.constant = -y;
  const v = new THREE.Vector3();
  return ray.ray.intersectPlane(plane, v) ? v : null;
}
// Ground hit: track ribbons and terrain first, flat plane as fallback.
function hitGround() {
  const hits = ray.intersectObjects([...trackGroup.children, ...terrainGroup.children.filter((o) => o.name === 'terrain')], false);
  if (hits.length) return hits[0].point;
  return hitPlane(0);
}
function pickHandle(e) {
  const r = canvas.getBoundingClientRect();
  camera.updateMatrixWorld();
  let best = -1, bd = 22 * 22;
  const v = new THREE.Vector3();
  handles.forEach((h, i) => {
    v.copy(h.ball.position).project(camera);
    if (v.z > 1) return;
    const sx = ((v.x + 1) / 2) * r.width + r.left, sy = ((1 - v.y) / 2) * r.height + r.top;
    const d = (sx - e.clientX) ** 2 + (sy - e.clientY) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
function trackParamAt(p) {
  const pr = project(p.x, p.z);
  if (!pr) return null;
  const segs = segCount();
  let u0 = S.u[pr.ia], u1 = S.u[pr.ib];
  if (S.closed && pr.ib === 0) u1 = segs;
  return { ...pr, u: lerp(u0, u1, pr.t) };
}

// --- pointer interaction -------------------------------------------
let drag = null;   // {kind:'point', i, startY, y0} | {kind:'paint', ...}
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'edit' || e.button !== 0) return;
  canvas.focus();
  setNdc(e);
  const h = pickHandle(e);
  if (tool === 'draw' || tool === 'move') {
    if (h >= 0) {
      if (tool === 'draw' && !state.closed && h === 0 && state.points.length >= 3) { state.closed = true; afterEdit(true); return; }
      select(h);
      const p = state.points[h];
      drag = { kind: 'point', i: h, sy: e.clientY, y0: p.y, moved: false };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    const g = hitGround();
    if (!g) return;
    if (tool === 'draw' && !state.closed) {
      const last = state.points[state.points.length - 1];
      state.points.push({ x: g.x, z: g.z, y: last ? last.y : 0, w: last ? last.w : 13, bank: 0 });
      select(state.points.length - 1);
      afterEdit(true);
      drag = { kind: 'point', i: selected, sy: e.clientY, y0: state.points[selected].y, moved: false, fresh: true };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    // Clicking the road inserts a point (draw tool on a closed loop, or edit tool).
    if (S) {
      const tp = trackParamAt(g);
      if (tp && Math.abs(tp.d) < S.w[tp.i] / 2 + 4) {
        const segs = segCount();
        const u = tp.u >= segs ? segs - 1e-4 : tp.u;
        const i = Math.floor(u), t = clamp(u - i, 0.02, 0.98);
        insertPoint(i, t, { x: S.px[tp.i], z: S.pz[tp.i], y: pointScalar('y', u), w: pointScalar('w', u), bank: pointScalar('bank', u) });
        select(i + 1);
        afterEdit(false);
        drag = { kind: 'point', i: i + 1, sy: e.clientY, y0: state.points[i + 1].y, moved: true };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }
    select(-1);
    return;
  }
  if ((tool === 'kerb' || tool === 'runoff' || tool === 'erase') && S) {
    const g = hitGround();
    if (!g) return;
    const tp = trackParamAt(g);
    if (!tp || Math.abs(tp.d) > S.bar[tp.d > 0 ? 0 : 1][tp.i] + 6) return;
    const side = tp.d > 0 ? 1 : -1;
    drag = { kind: 'paint', side, u0: tp.u, u: tp.u, acc: tp.u, base: state.features.slice(), moved: false, zone: zoneAt(tp) };
    canvas.setPointerCapture(e.pointerId);
    paintPreview();
  }
});
function zoneAt(tp) {
  const half = S.w[tp.i] / 2, ad = Math.abs(tp.d);
  return ad <= half + KERB_W + 0.6 ? 'kerb' : 'runoff';
}
canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'edit') return;
  setNdc(e);
  if (!drag) {
    const h = (tool === 'draw' || tool === 'move') ? pickHandle(e) : -1;
    if (h !== hovered) { hovered = h; canvas.style.cursor = h >= 0 ? 'grab' : ''; }
    updateCursor();
    return;
  }
  if (drag.kind === 'point') {
    const p = state.points[drag.i];
    if (e.shiftKey) {
      // Shift-drag: raise / lower the point.
      const camDist = camera.position.distanceTo(controls.target);
      p.y = clamp(Math.round((drag.y0 + (drag.sy - e.clientY) * camDist * 0.0016) * 2) / 2, -20, 40);
    } else {
      const g = hitPlane(p.y);
      if (!g) return;
      p.x = g.x; p.z = g.z;
      drag.sy = e.clientY; drag.y0 = p.y;
    }
    drag.moved = true;
    snapRing.visible = canCloseByDrag(drag.i);
    if (snapRing.visible) { const t = state.points[drag.i === 0 ? state.points.length - 1 : 0]; snapRing.position.set(t.x, t.y + 0.3, t.z); snapRing.scale.setScalar(clamp(camera.position.distanceTo(controls.target) * 0.01, 1, 20)); }
    afterEdit(false);
    return;
  }
  if (drag.kind === 'paint') {
    const g = hitGround();
    if (!g) return;
    const tp = trackParamAt(g);
    if (!tp) return;
    let delta = tp.u - drag.u;
    const segs = segCount();
    if (S.closed) { if (delta > segs / 2) delta -= segs; else if (delta < -segs / 2) delta += segs; }
    drag.u = tp.u; drag.acc += delta;
    if (Math.abs(drag.acc - drag.u0) > 0.01) drag.moved = true;
    paintPreview();
  }
});
function canCloseByDrag(i) {
  if (state.closed || state.points.length < 4) return false;
  const last = state.points.length - 1;
  if (i !== last && i !== 0) return false;
  const a = state.points[i], b = state.points[i === 0 ? last : 0];
  const tol = clamp(camera.position.distanceTo(controls.target) * 0.02, 6, 60);
  return Math.hypot(a.x - b.x, a.z - b.z) < tol;
}
canvas.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  snapRing.visible = false;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  if (d.kind === 'point') {
    if (canCloseByDrag(d.i)) {
      // Drag-to-close: the dragged end merges into the other end.
      deletePoint(d.i);
      state.closed = true;
      select(d.i === 0 ? 0 : -1);
    }
    afterEdit(true);
  } else if (d.kind === 'paint') {
    state.features = d.base;
    paintCommit(d);
    afterEdit(true);
  }
});
function paintRange(d) {
  const segs = segCount();
  let a = Math.min(d.u0, d.acc), b = Math.max(d.u0, d.acc);
  if (!d.moved) {
    // Single click: a sensible default length around the cursor (~40 m).
    const du = (40 / S.L) * segs;
    a = d.u0 - du / 2; b = d.u0 + du / 2;
  }
  if (!S.closed) { a = clamp(a, 0, segs); b = clamp(b, 0, segs); }
  else if (a < 0) { a += segs; b += segs; }
  return [a, b];
}
function paintFeature(d) {
  const [u0, u1] = paintRange(d);
  const st = state.settings;
  return tool === 'kerb' ? { kind: 'kerb', side: d.side, style: st.kerbStyle, u0, u1 } : { kind: 'runoff', side: d.side, surf: st.runSurf, width: st.runW, u0, u1 };
}
function paintPreview() {
  const d = drag;
  if (tool === 'erase') state.features = eraseRange(d.base, d);
  else { state.features = d.base.slice(); state.features.push(paintFeature(d)); }
  applyFeatures(S);
  buildTrackMeshes();
}
function paintCommit(d) {
  if (tool === 'erase') state.features = eraseRange(d.base, d);
  else addFeature(paintFeature(d));
}
// Remove [a,b] on one side from features; a plain click deletes the whole feature under the cursor.
function eraseRange(list, d) {
  const segs = segCount();
  const kinds = d.zone === 'kerb' ? ['kerb'] : ['runoff'];
  if (!d.moved) {
    return list.filter((f) => !(f.side === d.side && kinds.includes(f.kind) && featureCovers(f, d.u0 % segs, segs)));
  }
  const [a, b] = paintRange(d);
  const out = [];
  for (const f of list) {
    if (f.side !== d.side || !kinds.includes(f.kind)) { out.push(f); continue; }
    let pieces = [[f.u0, f.u1]];
    for (const sh of S.closed ? [-segs, 0, segs] : [0]) {
      const A = a + sh, B = b + sh;
      pieces = pieces.flatMap(([c, e]) => (B <= c || A >= e ? [[c, e]] : [[c, A], [B, e]].filter(([x, y]) => y - x > 0.02)));
    }
    for (const [c, e] of pieces) out.push({ ...f, u0: c, u1: e });
  }
  return out;
}
function updateCursor() {
  const paint = (tool === 'kerb' || tool === 'runoff' || tool === 'erase') && S;
  cursorRing.visible = false;
  ghostLine.visible = false;
  if (paint) {
    const g = hitGround();
    if (!g) return;
    const tp = trackParamAt(g);
    if (!tp || Math.abs(tp.d) > S.bar[tp.d > 0 ? 0 : 1][tp.i] + 6) return;
    const side = tp.d > 0 ? 1 : -1, i = tp.i;
    const off = tool === 'kerb' ? S.w[i] / 2 + KERB_W / 2 : tool === 'runoff' ? S.w[i] / 2 + (S.kerb[side > 0 ? 0 : 1][i] ? KERB_W : 0) + state.settings.runW / 2 : Math.abs(tp.d);
    const d = side * off;
    cursorRing.position.set(S.px[i] + leftX(i) * d, crossY(i, d) + 0.2, S.pz[i] + leftZ(i) * d);
    cursorRing.scale.setScalar(tool === 'runoff' ? state.settings.runW / 2 : tool === 'kerb' ? 1.4 : 2.5);
    cursorRing.material.color.setHex(tool === 'erase' ? 0xff4d4d : tool === 'kerb' ? 0xff3030 : 0xc9b58a);
    cursorRing.visible = true;
  } else if (tool === 'draw' && !state.closed && state.points.length) {
    const last = state.points[state.points.length - 1];
    const g = hitPlane(last.y);
    if (!g) return;
    ghostLine.geometry.setFromPoints([new THREE.Vector3(last.x, last.y + 2.2, last.z), new THREE.Vector3(g.x, last.y + 2.2, g.z)]);
    ghostLine.computeLineDistances();
    ghostLine.visible = true;
  }
}

// --- rebuild orchestration -----------------------------------------
let fullTimer = 0;
// light = spline + track ribbons (interactive); full also re-shapes terrain and scenery.
function afterEdit(full) {
  buildSamples();
  buildTrackMeshes();
  updateHandles();
  refreshPanel();
  if (full) {
    clearTimeout(fullTimer);
    fullTimer = setTimeout(() => { buildTerrain(); buildScenery(); updateHandles(); }, 0);
    commit();
  }
}
function fullRebuild() {
  buildSamples(); buildTrackMeshes(); buildTerrain(); buildScenery(); updateHandles(); refreshPanel();
}

// --- panels ---------------------------------------------------------
const HINTS = {
  draw: () => (state.closed
    ? '<b>Track closed.</b> Click the road to add a point · drag points to reshape · <b>Shift</b>+drag raises/lowers'
    : state.points.length === 0 ? '<b>Click the ground</b> to place your first point · right-drag to orbit · scroll to zoom'
      : 'Click to add points · <b>click the green start point</b> or <b>drag the last point onto it</b> to close the loop'),
  move: () => 'Drag points to move · <b>Shift</b>+drag = elevation · click the road to insert · <b>Del</b> removes the selected point',
  kerb: () => 'Click or drag along a track edge to lay kerbs on that side',
  runoff: () => 'Drag along a side to paint run-off · pick surface + width on the right',
  erase: () => 'Click a kerb or run-off to remove it · drag to cut part of it away',
};
function setTool(t) {
  tool = t;
  document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  $('hint').innerHTML = HINTS[t]();
  canvas.style.cursor = t === 'draw' ? 'crosshair' : t === 'move' ? '' : 'cell';
  updateCursor();
}
function select(i) {
  selected = i;
  refreshPoint();
}
function refreshPoint() {
  const p = state.points[selected];
  $('pNone').classList.toggle('hidden', !!p);
  $('pEdit').classList.toggle('hidden', !p);
  $('pIdx').textContent = p ? `#${selected + 1}${selected === 0 ? ' · START' : ''}` : '';
  if (!p) return;
  $('rElev').value = p.y; $('vElev').textContent = p.y.toFixed(1) + ' m';
  $('rWidth').value = p.w; $('vWidth').textContent = p.w.toFixed(1) + ' m';
  $('rBank').value = p.bank; $('vBank').textContent = (p.bank > 0 ? '+' : '') + p.bank.toFixed(1) + '°';
  $('bStart').disabled = !state.closed || selected === 0;
}
let lastAnalysis = null;
function refreshPanel() {
  const a = (lastAnalysis = analyse());
  $('sLen').textContent = (a.length / 1000).toFixed(2) + ' km';
  $('sCorners').textContent = a.corners;
  $('sRadius').textContent = Number.isFinite(a.minR) && S ? a.minR.toFixed(0) + ' m' : '–';
  $('sClimb').textContent = a.climb.toFixed(0) + ' m';
  $('issues').innerHTML = a.issues.map((i) => `<li class="${i.lvl}">${i.text}</li>`).join('');
  $('bDrive').disabled = !(S && state.closed && state.points.length >= 3);
  $('bUndo').disabled = history.pos <= 0;
  $('bRedo').disabled = history.pos >= history.stack.length - 1;
  if ($('tName') !== document.activeElement) $('tName').value = state.name;
  $('hint').innerHTML = HINTS[tool]();
  refreshPoint();
}
function refreshSettings() {
  const st = state.settings;
  $('cBarriers').checked = st.barriers; $('cScenery').checked = st.scenery;
  $('rTod').value = st.tod; $('vTod').textContent = `${Math.floor(st.tod)}:${String(Math.round((st.tod % 1) * 60)).padStart(2, '0')}`;
  $('rRunW').value = st.runW; $('vRunW').textContent = st.runW + ' m';
  segPick('segKerb', st.kerbStyle); segPick('segSurf', st.runSurf); segPick('segLivery', String(st.livery));
}
function segPick(id, v) { $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === v)); }

// --- wiring ---------------------------------------------------------
document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
const bindPoint = (id, key, fmt) => {
  $(id).addEventListener('input', () => {
    const p = state.points[selected];
    if (!p) return;
    p[key] = +$(id).value;
    afterEdit(false);
  });
  $(id).addEventListener('change', () => afterEdit(true));
};
bindPoint('rElev', 'y'); bindPoint('rWidth', 'w'); bindPoint('rBank', 'bank');
$('bDel').addEventListener('click', () => deleteSelected());
$('bStart').addEventListener('click', () => { if (selected > 0) { setStart(selected); select(0); afterEdit(true); } });
function deleteSelected() {
  if (selected < 0) return;
  deletePoint(selected);
  select(Math.min(selected, state.points.length - 1));
  afterEdit(true);
}
$('tName').addEventListener('input', () => { state.name = $('tName').value.trim().slice(0, 40) || 'Untitled'; });
$('tName').addEventListener('change', () => commit());
$('tName').addEventListener('keydown', (e) => e.stopPropagation());
$('segKerb').addEventListener('click', (e) => { const v = e.target.dataset?.v; if (v) { state.settings.kerbStyle = v; refreshSettings(); commit(); } });
$('segSurf').addEventListener('click', (e) => { const v = e.target.dataset?.v; if (v) { state.settings.runSurf = v; refreshSettings(); commit(); } });
$('rRunW').addEventListener('input', () => { state.settings.runW = +$('rRunW').value; refreshSettings(); });
$('rRunW').addEventListener('change', () => commit());
$('segLivery').innerHTML = LIVERIES.map((l, i) => `<button data-v="${i}" title="${l.name}"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:-2px;background:#${l.body.toString(16).padStart(6, '0')};box-shadow:inset -5px 0 0 #${l.second.toString(16).padStart(6, '0')}"></span></button>`).join('');
$('segLivery').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { state.settings.livery = +b.dataset.v; refreshSettings(); commit(); } });
$('bAutoKerb').addEventListener('click', () => { autoKerbs(); afterEdit(true); });
$('bAutoRun').addEventListener('click', () => { autoRunoff(); afterEdit(true); });
$('bClearFx').addEventListener('click', () => { state.features = []; afterEdit(true); });
$('cBarriers').addEventListener('change', () => { state.settings.barriers = $('cBarriers').checked; buildTrackMeshes(); commit(); });
$('cScenery').addEventListener('change', () => { state.settings.scenery = $('cScenery').checked; buildScenery(); commit(); });
$('rTod').addEventListener('input', () => { state.settings.tod = +$('rTod').value; refreshSettings(); applyTimeOfDay(state.settings.tod); });
$('rTod').addEventListener('change', () => commit());

$('bNew').addEventListener('click', () => {
  if (state.points.length && !confirm('Start a new empty track? Unsaved changes stay in Undo.')) return;
  loadInto({ name: 'New circuit', points: [], closed: false, features: [], settings: state.settings });
  select(-1); setTool('draw'); fullRebuild(); commit(); frameTrack();
});
$('bSample').addEventListener('click', () => { loadSample(); commit(); frameTrack(); });
function loadSample() {
  loadInto(sampleTrack());
  buildSamples(); autoKerbs(); buildSamples(); autoRunoff();
  select(-1); fullRebuild(); refreshSettings();
}
$('bUndo').addEventListener('click', () => doUndo());
$('bRedo').addEventListener('click', () => doRedo());
function doUndo() { if (undo()) { select(-1); fullRebuild(); refreshSettings(); applyTimeOfDay(state.settings.tod); } }
function doRedo() { if (redo()) { select(-1); fullRebuild(); refreshSettings(); applyTimeOfDay(state.settings.tod); } }
$('bView').addEventListener('click', () => setTopView(!topView));

// Saved tracks live in this browser's localStorage only.
function savedTracks() { try { return JSON.parse(localStorage.getItem('tb.tracks') || '{}') || {}; } catch { return {}; } }
function refreshLoadList() {
  const t = savedTracks();
  $('selLoad').innerHTML = '<option value="">Load…</option>' + Object.keys(t).sort().map((n) => `<option></option>`).join('');
  [...$('selLoad').options].slice(1).forEach((o, i) => { o.value = o.textContent = Object.keys(t).sort()[i]; });
}
$('bSave').addEventListener('click', () => {
  const t = savedTracks();
  t[state.name] = serialise();
  try { localStorage.setItem('tb.tracks', JSON.stringify(t)); flash('bSave', 'Saved ✓'); } catch { flash('bSave', 'Storage full'); }
  refreshLoadList();
});
$('selLoad').addEventListener('change', () => {
  const name = $('selLoad').value;
  $('selLoad').value = '';
  const raw = savedTracks()[name];
  if (!raw) return;
  try { loadInto(deserialise(raw)); select(-1); fullRebuild(); refreshSettings(); applyTimeOfDay(state.settings.tod); commit(); frameTrack(); }
  catch (err) { alert('Could not load that track: ' + err.message); }
});
$('bExport').addEventListener('click', () => {
  const blob = new Blob([serialise()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (state.name.replace(/[^\w\- ]+/g, '').trim() || 'track') + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('bImport').addEventListener('click', () => $('fileIn').click());
$('fileIn').addEventListener('change', async () => {
  const f = $('fileIn').files[0];
  $('fileIn').value = '';
  if (!f) return;
  if (f.size > 2e6) { alert('That file is too large to be a track.'); return; }
  try { loadInto(deserialise(await f.text())); select(-1); fullRebuild(); refreshSettings(); applyTimeOfDay(state.settings.tod); commit(); frameTrack(); }
  catch (err) { alert('Could not import: ' + err.message); }
});
function flash(id, text) { const b = $(id), old = b.textContent; b.textContent = text; setTimeout(() => (b.textContent = old), 1200); }

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
  if (mode === 'drive') {
    if (e.code === 'Escape') exitDrive();
    else if (e.code === 'KeyC') cycleCamera();
    else if (e.code === 'KeyR') resetCar();
    else if (e.code === 'KeyM') { audio.on = !audio.on; showToast(audio.on ? 'SOUND ON' : 'SOUND OFF'); }
    else if (e.code === 'KeyT') { car.tc = !car.tc; $('tcState').textContent = car.tc ? 'ON' : 'OFF'; showToast('ASSISTS ' + (car.tc ? 'ON' : 'OFF')); }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    return;
  }
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
  if (ctrl && e.code === 'KeyY') { e.preventDefault(); doRedo(); return; }
  if (ctrl) return;
  const toolKeys = { Digit1: 'draw', Digit2: 'move', Digit3: 'kerb', Digit4: 'runoff', Digit5: 'erase' };
  if (toolKeys[e.code]) setTool(toolKeys[e.code]);
  else if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); deleteSelected(); }
  else if (e.code === 'KeyT') setTopView(!topView);
  else if (e.code === 'KeyF') frameTrack();
  else if (e.code === 'Enter' && !$('bDrive').disabled) enterDrive();
  else if (e.code === 'Escape') select(-1);
});

// --- drive mode switch ---------------------------------------------
const editCam = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
$('bDrive').addEventListener('click', () => enterDrive());
$('exitDrive').addEventListener('click', () => exitDrive());
function enterDrive() {
  if (!S || !state.closed) return;
  editCam.pos.copy(camera.position); editCam.target.copy(controls.target);
  mode = 'drive';
  controls.enabled = false;
  select(-1);
  cursorRing.visible = ghostLine.visible = false;
  ensureCarModel();
  carModel.root.visible = true;
  heldPos = null;
  placeOnGrid();
  resetLap();
  for (let s = 0; s < 3; s++) { $('sec' + s).textContent = 'S' + (s + 1); $('sec' + s).className = ''; }
  buildMinimap();
  camState.init = false; camState.tv = null; camState.fov = 60;
  $('camName').textContent = CAMS[camIdx];
  $('editorUI').classList.add('hidden');
  $('hud').classList.remove('hidden');
  audio.init();
  beginStart();
  updateHandles();
  canvas.focus();
}
function exitDrive() {
  mode = 'edit';
  start.phase = 'off';
  if (startLights) startLights.forEach((m) => m.emissive.setHex(0));
  $('lights').classList.add('hidden');
  if (carModel) carModel.root.visible = false;
  $('hud').classList.add('hidden');
  $('editorUI').classList.remove('hidden');
  camera.fov = 55; camera.updateProjectionMatrix();
  camera.position.copy(editCam.pos); controls.target.copy(editCam.target);
  controls.enabled = true; controls.update();
  updateHandles();
}
