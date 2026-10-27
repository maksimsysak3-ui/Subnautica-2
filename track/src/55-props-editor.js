// =====================================================================
//  Editor: props palette + placement, sponsor designer, wall settings
// =====================================================================
let propBrush = null;          // catalog id being placed
let propRot = 0;               // rotation for the next placed prop
let selProp = -1;              // index into state.props
let propDrag = null;
const PROP_CATS = ['All', ...new Set(PROP_DEFS.map((d) => d.cat))];
let propCat = 'All';

// --- contextual panels ------------------------------------------------------
function onToolChanged(t) {
  $('palette').classList.toggle('hidden', t !== 'props');
  $('cPoint').classList.toggle('hidden', !(t === 'draw' || t === 'move'));
  $('cPaint').classList.toggle('hidden', !(t === 'kerb' || t === 'runoff' || t === 'erase'));
  $('cWall').classList.toggle('hidden', t !== 'wall');
  $('cProp').classList.toggle('hidden', t !== 'props');
  if (t !== 'props') { propBrush = null; selectProp(-1); ghost.visible = false; }
  else buildPalette();
  refreshPropPanel();
}

// --- sponsor thumbnails (small canvases) -------------------------------------
function sponsorThumb(sp) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  drawSponsor(c.getContext('2d'), sp, 256, 64);
  return c;
}
// A grid of sponsor buttons; `withPlain` adds a "plain" choice (value '').
function fillSponsorGrid(el, current, onPick, withPlain = false) {
  el.textContent = '';
  if (withPlain) {
    const b = document.createElement('button');
    b.className = 'plain' + (current === '' ? ' on' : '');
    b.textContent = 'Plain concrete';
    b.onclick = () => onPick('');
    el.appendChild(b);
  }
  for (const sp of state.sponsors) {
    const b = document.createElement('button');
    b.title = sp.name;
    if (sp.id === current) b.classList.add('on');
    b.appendChild(sponsorThumb(sp));
    b.onclick = () => onPick(sp.id);
    el.appendChild(b);
  }
}
function refreshSponsorUI() {
  fillSponsorGrid($('spList'), null, (id) => openSponsorDialog(id));
  fillSponsorGrid($('wallSp'), state.settings.wallSp, (id) => { state.settings.wallSp = id; refreshSponsorUI(); commit(); }, true);
  $('rWallH').value = state.settings.wallH;
  $('vWallH').textContent = state.settings.wallH.toFixed(1) + ' m';
  refreshPropPanel();
}
$('rWallH').addEventListener('input', () => { state.settings.wallH = +$('rWallH').value; $('vWallH').textContent = state.settings.wallH.toFixed(1) + ' m'; });
$('rWallH').addEventListener('change', () => commit());

// --- sponsor designer --------------------------------------------------------
let spEditing = null;          // working copy
let spEditId = null;           // null = new
$('spLayout').innerHTML = SPONSOR_LAYOUTS.map((l) => `<button data-v="${l}">${l}</button>`).join('');
$('spIcon').innerHTML = SPONSOR_ICONS.map((l) => `<button data-v="${l}">${l}</button>`).join('');
function openSponsorDialog(id) {
  const sp = id ? sponsorById(id) : null;
  spEditId = sp ? sp.id : null;
  spEditing = sp ? { ...sp } : { id: '', name: 'New sponsor', text: 'SPONSOR', tag: 'YOUR TAGLINE', bg: '#14161a', fg: '#ffffff', accent: '#e10600', layout: 'block', icon: 'star' };
  $('spName').value = spEditing.name; $('spText').value = spEditing.text; $('spTag').value = spEditing.tag;
  $('spBg').value = spEditing.bg; $('spFg').value = spEditing.fg; $('spAccent').value = spEditing.accent;
  $('spDelete').disabled = !spEditId || state.sponsors.length <= 1;
  $('spDialog').classList.remove('hidden');
  drawSpPreview();
}
function drawSpPreview() {
  segPick('spLayout', spEditing.layout); segPick('spIcon', spEditing.icon);
  drawSponsor($('spPreview').getContext('2d'), spEditing, 512, 128);
}
for (const [id, key] of [['spName', 'name'], ['spText', 'text'], ['spTag', 'tag'], ['spBg', 'bg'], ['spFg', 'fg'], ['spAccent', 'accent']]) {
  $(id).addEventListener('input', () => { spEditing[key] = $(id).value; drawSpPreview(); });
  $(id).addEventListener('keydown', (e) => e.stopPropagation());
}
$('spLayout').addEventListener('click', (e) => { const v = e.target.dataset?.v; if (v) { spEditing.layout = v; drawSpPreview(); } });
$('spIcon').addEventListener('click', (e) => { const v = e.target.dataset?.v; if (v) { spEditing.icon = v; drawSpPreview(); } });
$('spRandom').addEventListener('click', () => {
  const h = Math.random() * 360, hsl = (hh, s, l) => '#' + new THREE.Color().setHSL(((hh % 360) + 360) % 360 / 360, s, l).getHexString();
  const dark = Math.random() < 0.5;
  spEditing.bg = hsl(h, 0.7, dark ? 0.14 : 0.52); spEditing.fg = dark ? hsl(h + 40, 0.9, 0.62) : '#ffffff'; spEditing.accent = hsl(h + 180, 0.85, 0.55);
  $('spBg').value = spEditing.bg; $('spFg').value = spEditing.fg; $('spAccent').value = spEditing.accent;
  drawSpPreview();
});
$('spCancel').addEventListener('click', () => $('spDialog').classList.add('hidden'));
$('spSave').addEventListener('click', () => {
  const clean = (v, n) => String(v).replace(/[\u0000-\u001f]/g, '').slice(0, n);
  spEditing.name = clean(spEditing.name, 24) || 'Sponsor'; spEditing.text = clean(spEditing.text, 18); spEditing.tag = clean(spEditing.tag, 28);
  if (spEditId) Object.assign(sponsorById(spEditId), spEditing, { id: spEditId });
  else {
    let n = state.sponsors.length + 1;
    while (state.sponsors.some((s) => s.id === 's' + n)) n++;
    if (state.sponsors.length >= 40) { alert('You can have up to 40 sponsors.'); return; }
    spEditing.id = 's' + n;
    state.sponsors.push(spEditing);
  }
  const id = spEditId || spEditing.id;
  sponsorEntry(id);                       // redraw the shared texture: walls/props update in place
  $('spDialog').classList.add('hidden');
  _thumbs.clear();
  refreshSponsorUI();
  buildTrackMeshes(); rebuildProps(); buildScenery();
  commit();
});
$('spDelete').addEventListener('click', () => {
  if (!spEditId || state.sponsors.length <= 1) return;
  state.sponsors = state.sponsors.filter((s) => s.id !== spEditId);
  sponsorCache.delete(spEditId); forgetSponsorProtos(spEditId);
  if (state.settings.wallSp === spEditId) state.settings.wallSp = '';
  $('spDialog').classList.add('hidden');
  refreshSponsorUI(); buildTrackMeshes(); rebuildProps(); buildScenery(); commit();
});
$('bSpNew').addEventListener('click', () => openSponsorDialog(null));

// --- palette -----------------------------------------------------------------
let thumbQueue = [];
function buildPalette() {
  const cats = $('propCats');
  if (!cats.childElementCount) {
    for (const c of PROP_CATS) {
      const b = document.createElement('button');
      b.textContent = c; b.dataset.c = c;
      b.onclick = () => { propCat = c; buildPalette(); };
      cats.appendChild(b);
    }
  }
  [...cats.children].forEach((b) => b.classList.toggle('on', b.dataset.c === propCat));
  const q = $('propSearch').value.trim().toLowerCase();
  const grid = $('propGrid');
  grid.textContent = '';
  thumbQueue = [];
  for (const d of PROP_DEFS) {
    if (propCat !== 'All' && d.cat !== propCat) continue;
    if (q && !d.name.toLowerCase().includes(q) && !d.cat.toLowerCase().includes(q)) continue;
    const b = document.createElement('button');
    b.dataset.id = d.id;
    b.title = d.name + (d.sp ? ' (takes a sponsor)' : '');
    if (d.id === propBrush) b.classList.add('on');
    const img = document.createElement(_thumbs.has(d.id) ? 'img' : 'div');
    if (_thumbs.has(d.id)) img.src = _thumbs.get(d.id); else { img.className = 'ph'; thumbQueue.push([d.id, img]); }
    const label = document.createElement('span');
    label.textContent = d.name;
    b.append(img, label);
    b.onclick = () => { setBrush(propBrush === d.id ? null : d.id); };
    grid.appendChild(b);
  }
  pumpThumbs();
}
// Render thumbnails a few per frame so opening the palette never stalls.
let thumbPumping = false;
function pumpThumbs() {
  if (thumbPumping) return;
  thumbPumping = true;
  const step = () => {
    const t0 = performance.now();
    while (thumbQueue.length && performance.now() - t0 < 12) {
      const [id, el] = thumbQueue.shift();
      if (!el.isConnected) continue;
      const img = document.createElement('img');
      img.src = propThumb(id);
      el.replaceWith(img);
    }
    if (thumbQueue.length) requestAnimationFrame(step); else thumbPumping = false;
  };
  requestAnimationFrame(step);
}
$('propSearch').addEventListener('input', () => buildPalette());
$('propSearch').addEventListener('keydown', (e) => e.stopPropagation());
function setBrush(id) {
  propBrush = id;
  if (id) selectProp(-1);
  document.querySelectorAll('#propGrid button').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
  buildGhost();
  $('hint').innerHTML = HINTS.props();
}

// --- ghost preview -----------------------------------------------------------
const ghost = new THREE.Group();
ghost.visible = false;
scene.add(ghost);
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x7fd3ff, transparent: true, opacity: 0.45, depthWrite: false });
function buildGhost() {
  ghost.clear();
  if (!propBrush) { ghost.visible = false; return; }
  const proto = propProto(propBrush, state.settings.wallSp);
  for (const p of proto.parts) ghost.add(new THREE.Mesh(p.geo, ghostMat));
}
const selRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffb800, transparent: true, depthTest: false }));
selRing.renderOrder = 12; selRing.visible = false;
scene.add(selRing);
function placeSelRing() {
  const p = state.props[selProp];
  if (!p) { selRing.visible = false; return; }
  const proto = propProto(p.t, p.sp || '');
  selRing.position.set(p.x, propGroundY(p.x, p.z) + 0.15, p.z);
  selRing.scale.setScalar(Math.max(1.2, proto.radius * p.s * 1.1));
  selRing.visible = true;
}

// --- picking + placement ----------------------------------------------------
function pickProp() {
  const hits = ray.intersectObjects(propMeshes, false);
  for (const h of hits) if (h.instanceId != null) return h.object.userData.idx[h.instanceId];
  return -1;
}
function propPointerDown(e) {
  const hit = propBrush ? -1 : pickProp();
  if (hit >= 0) {
    selectProp(hit);
    const p = state.props[hit];
    const g = hitPlane(propGroundY(p.x, p.z));
    propDrag = { i: hit, ox: g ? p.x - g.x : 0, oz: g ? p.z - g.z : 0, moved: false };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (propBrush) {
    const g = hitGround();
    if (!g) return;
    if (state.props.length >= 4000) { alert('Prop limit reached (4000).'); return; }
    const def = PROP_INDEX.get(propBrush);
    state.props.push({ t: propBrush, x: g.x, z: g.z, r: propRot, s: 1, ...(def.sp && state.settings.wallSp ? { sp: state.settings.wallSp } : {}) });
    rebuildProps();
    commit();
    return;
  }
  selectProp(-1);
}
function propPointerMove(e) {
  if (propDrag) {
    const p = state.props[propDrag.i];
    const g = hitPlane(propGroundY(p.x, p.z));
    if (!g) return;
    p.x = g.x + propDrag.ox; p.z = g.z + propDrag.oz;
    propDrag.moved = true;
    updatePropInstance(propDrag.i);
    placeSelRing();
    return;
  }
  if (propBrush) {
    const g = hitGround();
    ghost.visible = !!g;
    if (g) { ghost.position.set(g.x, propGroundY(g.x, g.z), g.z); ghost.rotation.y = propRot; }
  } else {
    const h = pickProp();
    canvas.style.cursor = h >= 0 ? 'grab' : '';
  }
}
function propPointerUp(e) {
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  if (propDrag) {
    const moved = propDrag.moved;
    propDrag = null;
    if (moved) { rebuildProps(); commit(); }
  }
}
function selectProp(i) {
  selProp = i;
  placeSelRing();
  refreshPropPanel();
}
function refreshPropPanel() {
  const p = state.props[selProp];
  $('propNone').classList.toggle('hidden', !!p);
  $('propEdit').classList.toggle('hidden', !p);
  $('propName').textContent = p ? PROP_INDEX.get(p.t).name : '';
  if (!p) return;
  const deg = Math.round(((((p.r * 180) / Math.PI) + 540) % 360) - 180);
  $('rPropR').value = deg; $('vPropR').textContent = deg + '°';
  $('rPropS').value = p.s; $('vPropS').textContent = p.s.toFixed(2) + '×';
  const def = PROP_INDEX.get(p.t);
  $('propSpWrap').classList.toggle('hidden', !def.sp);
  if (def.sp) fillSponsorGrid($('propSp'), p.sp || '', (id) => { if (id) p.sp = id; else delete p.sp; rebuildProps(); refreshPropPanel(); commit(); });
}
$('rPropR').addEventListener('input', () => { const p = state.props[selProp]; if (!p) return; p.r = (+$('rPropR').value * Math.PI) / 180; $('vPropR').textContent = $('rPropR').value + '°'; updatePropInstance(selProp); });
$('rPropS').addEventListener('input', () => { const p = state.props[selProp]; if (!p) return; p.s = +$('rPropS').value; $('vPropS').textContent = p.s.toFixed(2) + '×'; updatePropInstance(selProp); placeSelRing(); });
for (const id of ['rPropR', 'rPropS']) $(id).addEventListener('change', () => { rebuildProps(); commit(); });
$('bPropDel').addEventListener('click', () => deleteProp());
$('bPropDup').addEventListener('click', () => duplicateProp());
function deleteProp() {
  if (selProp < 0) return;
  state.props.splice(selProp, 1);
  selectProp(-1);
  rebuildProps(); commit();
}
function duplicateProp() {
  const p = state.props[selProp];
  if (!p) return;
  const proto = propProto(p.t, p.sp || '');
  const off = Math.max(2, proto.radius * p.s * 2.2);
  state.props.push({ ...p, x: p.x + Math.cos(p.r) * off, z: p.z - Math.sin(p.r) * off });
  rebuildProps();
  selectProp(state.props.length - 1);
  commit();
}
// Prop-tool keys; returns true when handled.
function propKey(e) {
  if (tool !== 'props') return false;
  const p = state.props[selProp];
  const rot = (d) => {
    if (p) { p.r += d; updatePropInstance(selProp); refreshPropPanel(); clearTimeout(propKey.t); propKey.t = setTimeout(() => { rebuildProps(); commit(); }, 400); }
    else { propRot += d; ghost.rotation.y = propRot; }
  };
  switch (e.code) {
    case 'KeyQ': rot(Math.PI / 12); return true;
    case 'KeyE': rot(-Math.PI / 12); return true;
    case 'BracketLeft': case 'BracketRight':
      if (p) { p.s = clamp(p.s * (e.code === 'BracketRight' ? 1.1 : 1 / 1.1), 0.25, 4); updatePropInstance(selProp); placeSelRing(); refreshPropPanel(); clearTimeout(propKey.t); propKey.t = setTimeout(() => { rebuildProps(); commit(); }, 400); }
      return true;
    case 'KeyD': if (p) duplicateProp(); return true;
    case 'Delete': case 'Backspace': if (p) { e.preventDefault(); deleteProp(); return true; } return false;
    case 'Escape': if (propBrush) setBrush(null); else selectProp(-1); return true;
    default: return false;
  }
}

// --- racing line toggle -----------------------------------------------------
$('cLine').addEventListener('change', () => { setLineVisible($('cLine').checked); commit(); });
