// =====================================================================
//  CITY — world assembly: terrain, environment lighting, build orchestration
// =====================================================================
function buildEnvironment() {
  // image-based light from a soft sky/ground gradient: gives glass, glaze and metal something to reflect
  const envScene = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 32, 16), c = [], p = g.attributes.position;
  const N = MAP.night, Dk = MAP.dusk, top = N ? new THREE.Color().setRGB(0.02, 0.02, 0.06) : Dk ? new THREE.Color().setRGB(0.12, 0.14, 0.32) : new THREE.Color().setRGB(0.32, 0.46, 0.75), hor = N ? new THREE.Color().setRGB(0.12, 0.05, 0.1) : SKY.horizon.clone(), gnd = N ? new THREE.Color().setRGB(0.05, 0.08, 0.12) : new THREE.Color().setRGB(0.42, 0.33, 0.24), sunC = N ? new THREE.Color().setRGB(0.1, 0.25, 0.3) : new THREE.Color().setRGB(4, 3.2, 2.2);
  for (let i = 0; i < p.count; i++) {
    const v = new V3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const col = v.y > 0 ? hor.clone().lerp(top, Math.pow(v.y, 0.6)) : hor.clone().lerp(gnd, Math.min(1, -v.y * 3));
    col.add(sunC.clone().multiplyScalar(Math.pow(Math.max(0, v.dot(SKY.sunDir)), 24)));
    c.push(col.r, col.g, col.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  envScene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.02).texture;
  pm.dispose();
}

// terrain mesh: 1600 m square; flat city plateau (finished by the district ground plates), foothills beyond
function buildTerrain() {
  const S = 2600, N = 180;
  const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const ng = g.toNonIndexed(); g.dispose();
  const p = ng.attributes.position, col = new Uint8Array(p.count * 3), srf = new Uint8Array(p.count * 3), c = new THREE.Color();
  const sand = new THREE.Color(0xa88d68), dry = new THREE.Color(0x8c7a58), red = new THREE.Color(0x9c6e4c), scrub = new THREE.Color(0x6c6a44);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = terrainH(x, z);
    p.setY(i, h);
    const n = fbm(x * 0.012, z * 0.012), n2 = vnoise(x * 0.09, z * 0.09);
    c.copy(sand).lerp(dry, n * 0.8).lerp(red, clamp((h - 10) / 50, 0, 0.6) * n2).lerp(scrub, clamp((n2 - 0.6) * 2, 0, 0.5) * clamp(h / 8, 0, 1));
    col.set([Math.sqrt(c.r) * 255, Math.sqrt(c.g) * 255, Math.sqrt(c.b) * 255], i * 3);
    srf.set([TX.earth, 3, 0], i * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  ng.setAttribute('surf', new THREE.BufferAttribute(srf, 3));
  ng.computeVertexNormals();
  const m = new THREE.Mesh(ng, W.layers.solid);
  m.receiveShadow = true;
  scene.add(m);
  MAP.terrain = m;
}

function setLoading(msg, t) {
  const el = document.getElementById('loading'); if (!el) return;
  el.innerHTML = `<div><div style="margin-bottom:14px">${msg.toUpperCase()}…</div><div style="width:min(420px,70vw);height:3px;background:#2a2a2a;margin:0 auto"><div style="width:${Math.round(t * 100)}%;height:100%;background:#c9a45c;transition:width .2s"></div></div></div>`;
}
const nextFrame = () => new Promise((r) => setTimeout(r, 0));
// ?profile in the URL: per-generator triangle accounting (inclusive)
const PROF = {};
function profileGenerators() {
  const names = ['medinaShell', 'riad', 'shopHouse', 'faceWindow', 'faceDoor', 'parapet', 'roofClutter', 'laneOverhead', 'dressLanes', 'sabat', 'ramparts', 'tree', 'palm', 'sedan', 'aptShell', 'apartment', 'cafe', 'office', 'modernShell', 'warehouse', 'workshop', 'railing', 'ironGrille', 'shutters', 'satDish', 'waterTank', 'antenna', 'laundryLine', 'acWall', 'acCondenser', 'wallLantern', 'hangLantern', 'lampPostOld', 'streetLampModern', 'dressRoad', 'laneTraffic', 'soukRoof', 'foodStall', 'groundPlate', 'roadway', 'cornices', 'mashrabiya', 'doorHood', 'archRim', 'flight', 'uStair', 'stairHouse', 'extWalls', 'partitions', 'wall', 'slab', 'marketStall', 'yard', 'container', 'civicPalace', 'plantPot', 'crate', 'scooter', 'bicycle', 'van', 'bus', 'cargoTruck', 'kiosk', 'handCart', 'umbrellaTable', 'bistroTable', 'fountain', 'opening', 'doorLeaf', 'archTympanum', 'awning', 'shopSign', 'flowerBox', 'meterBox', 'hostedCables'];
  for (const n of names) {
    let f; try { f = eval(n); } catch { continue; }
    const wrapped = function (...a) { const s0 = W.stats().tris; const r = f.apply(this, a); const e = PROF[n] || (PROF[n] = { tris: 0, calls: 0 }); e.tris += W.stats().tris - s0; e.calls++; return r; };
    try { eval(`${n} = wrapped`); } catch { }
  }
}
async function buildWorld() {
  const t0 = performance.now();
  if (location.search.includes('profile')) profileGenerators();
  const steps = cityPlan();
  buildEnvironment();
  for (let i = 0; i < steps.length; i++) {
    setLoading(steps[i][0], i / (steps.length + 2));
    await nextFrame();
    const t = performance.now(), s0 = W.stats();
    steps[i][1]();
    const s1 = W.stats();
    console.log(`[t] ${steps[i][0]}: ${Math.round(performance.now() - t)} ms, +${((s1.tris - s0.tris) / 1e6).toFixed(2)}M tris, lod ${s1.lod.map((v, k) => ((v - s0.lod[k]) / 1e6).toFixed(2)).join('/')}, +${s1.objects - s0.objects} obj, lots ${MAP.lotCount || 0}`); MAP.lotCount = 0;
  }
  setLoading('Batching geometry and lights', steps.length / (steps.length + 2));
  await nextFrame();
  MAP.batches = W.finish();
  placeWorldTargets();
  LAMPS.init();
  buildTerrain();
  P.pos.set(SPAWN.x, 0, SPAWN.z); P.yaw = SPAWN.yaw;
  STREAM.index(); STREAM.prime(P.pos);
  MAP.buildMs = Math.round(performance.now() - t0);
  MAP.ready = true;
  if (Object.keys(PROF).length) console.log('[t] PROF ' + Object.entries(PROF).sort((a, b) => b[1].tris - a[1].tris).slice(0, 40).map(([k, v]) => `${k}:${(v.tris / 1e6).toFixed(2)}M/${v.calls}`).join(' '));
  console.log(`[map] built in ${MAP.buildMs} ms`, W.stats(), `${COL.list.length} colliders, ${MAP.lamps.length} lamps, ${MAP.meshes.length} meshes`);
}
