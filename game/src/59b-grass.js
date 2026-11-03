// =====================================================================
//  Grass and wild flowers: the manor's lawns and the island's open ground
// =====================================================================
// Clumps of blades (one geometry, instanced) swaying in the wind in the vertex shader, with flowers among them.
// Laid in 48 m patches over open ground only (not roads, paving, buildings or the lake); patches beyond ~110 m
// aren't drawn, so the cost stays with what's around you.
const LAWN = (() => {
  const ON = MAP.id === 'manor' || MAP.id === 'bahamas';
  let built = false; const patches = [], uT = { value: 0 };
  function clumpGeo(base, tip) {
    const pos = [], col = [], c0 = new THREE.Color(base), c1 = new THREE.Color(tip);
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.16, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.22 + Math.random() * 0.3, w = 0.035, lean = 0.08 + Math.random() * 0.1, lx = Math.cos(a) * lean, lz = Math.sin(a) * lean, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
      pos.push(x - px, 0, z - pz, x + px, 0, z + pz, x + lx, h, z + lz);
      col.push(c0.r, c0.g, c0.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    // blades light like the ground under them, not like paper held to the sun
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    return g;
  }
  function windy(m) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uT = uT;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float k = transformed.y * 2.2, w = sin(uT * 1.6 + ip.x * 0.21 + ip.z * 0.17) * 0.6 + sin(uT * 3.1 + ip.x * 0.7) * 0.25;
        transformed.x += w * 0.06 * k; transformed.z += w * 0.035 * k;`);
    };
    return m;
  }
  function build() {
    built = true;
    const isl = MAP.id === 'bahamas';
    const geo = clumpGeo(isl ? 0x4e7a32 : 0x38602a, isl ? 0xb4c46a : 0x86b04e);
    const mat = windy(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    const fgeo = new THREE.IcosahedronGeometry(0.045, 0), fmat = windy(new THREE.MeshLambertMaterial({ emissive: 0x111111 }));
    const FLOW = isl ? [0xf04a8a, 0xffd040, 0xff7a3a, 0xf8f8f0] : [0xf0f0f8, 0xffd84a, 0xb07ae8, 0xe84a5a];
    const R = isl ? { x0: -250, x1: 250, z0: -140, z1: 140 } : { x0: -255, x1: 255, z0: -255, z1: 255 }, S = 48, dens = isl ? 0.22 : 0.42;
    const ok = (x, z) => {
      const g = GR.get(x, z); if (g !== GR.FREE && !(g === GR.PAVE && !isl && !GR.roadAt(x, z) && (TOWN.plazas || []).some((r) => /lawn/i.test(r.name) && x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1))) return false;
      const h = terrainH(x, z); if (isl ? h < -0.05 || islandSD(x, z) > -14 : Math.abs(h) > 0.35) return false;
      return COL.ground(x, z, h + 1.0) < h + 0.12;   // nothing standing here (a deck, a bench, a wall)
    };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new V3(), s = new V3(), col = new THREE.Color();
    for (let x0 = R.x0; x0 < R.x1; x0 += S) for (let z0 = R.z0; z0 < R.z1; z0 += S) {
      const pts = [];
      for (let i = 0, n = Math.round(S * S * dens); i < n; i++) { const x = x0 + Math.random() * S, z = z0 + Math.random() * S; if (ok(x, z)) pts.push([x, z]); }
      if (pts.length < 20) continue;
      const im = new THREE.InstancedMesh(geo, mat, pts.length), nf = Math.floor(pts.length * 0.06), fm = new THREE.InstancedMesh(fgeo, fmat, Math.max(1, nf));
      pts.forEach(([x, z], i) => { const sc = 0.7 + Math.random() * 0.7; q.setFromAxisAngle(UP, Math.random() * 6.28); m4.compose(p.set(x, terrainH(x, z) + 0.05, z), q, s.set(sc, sc * (0.8 + Math.random() * 0.5), sc)); im.setMatrixAt(i, m4); });
      for (let i = 0; i < nf; i++) { const [x, z] = pts[(Math.random() * pts.length) | 0]; m4.compose(p.set(x + 0.05, terrainH(x, z) + 0.33 + Math.random() * 0.12, z), q.identity(), s.set(1, 0.7, 1)); fm.setMatrixAt(i, m4); fm.setColorAt(i, col.set(FLOW[(Math.random() * FLOW.length) | 0])); }
      fm.count = nf;
      for (const m of [im, fm]) { m.receiveShadow = true; m.castShadow = false; m.computeBoundingSphere(); scene.add(m); }
      patches.push({ x: x0 + S / 2, z: z0 + S / 2, ms: [im, fm] });
    }
  }
  return {
    update(dt) {
      if (!ON || !MAP.ready) return;
      if (!built) build();
      uT.value += dt;
      const c = camera.position, far = (Math.min(MAP.drawDist || 140, 140) - 24) ** 2;
      for (const P2 of patches) { const v = (P2.x - c.x) ** 2 + (P2.z - c.z) ** 2 < far && !DOORS.inside; for (const m of P2.ms) m.visible = v; }
    },
  };
})();
