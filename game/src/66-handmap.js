// =====================================================================
//  The handheld map: a little wooden relief model of Dar Essalam (M)
// =====================================================================
// Built once from the real town: every 2 m column takes its height from the collision world and its
// colour from a top-down photograph of the rendered town, so roofs, awnings, gardens and the boats
// all read. Held in both hands, north up, with a red pin (and arrow) for you and a gold one for the
// current objective. Aim (Q) brings it closer.
const HANDMAP = (() => {
  const [X0, X1, Z0, Z1] = MAP.id === 'seoul' ? SEOUL.bounds : [-160, 160, -450, 120], CELL = 2, K = 0.3 / Math.max(X1 - X0, Z1 - Z0), VEX = 2.4;   // world → model scale, vertical exaggeration
  const group = new THREE.Group(); group.visible = false;
  const tray = new THREE.Group(); group.add(tray);
  let built = false, open = false, t = 0;
  let pinMe = null, pinGoal = null, hands = [];

  function photograph() {
    const W = 640, H = Math.round(640 * (Z1 - Z0) / (X1 - X0));
    const rt = new THREE.WebGLRenderTarget(W, H);
    const cam = new THREE.OrthographicCamera(X0, X1, -Z0, -Z1, 1, 800);   // looking straight down, north up
    cam.position.set(0, 400, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
    cam.left = X0; cam.right = X1; cam.top = -Z0; cam.bottom = -Z1; cam.updateProjectionMatrix();
    const fog = scene.fog, vis = MAP.meshes.map((m) => m.visible), wasOpen = group.visible;
    scene.fog = null; for (const m of MAP.meshes) m.visible = m.userData.lod <= 1; group.visible = false;
    const tm = renderer.toneMapping;
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
    renderer.toneMapping = tm; scene.fog = fog; MAP.meshes.forEach((m, i) => { m.visible = vis[i]; }); group.visible = wasOpen;
    const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); rt.dispose();
    // pixel (u, v) of a world point; row 0 is the south edge
    return (x, z) => { const u = clamp(Math.floor((x - X0) / (X1 - X0) * W), 0, W - 1), v = clamp(Math.floor((Z1 - z) / (Z1 - Z0) * H), 0, H - 1), i = (v * W + u) * 4; return [px[i] / 255, px[i + 1] / 255, px[i + 2] / 255]; };
  }
  function build() {
    built = true;
    const colAt = photograph();
    const nx = Math.round((X1 - X0) / CELL), nz = Math.round((Z1 - Z0) / CELL);
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }), nx * nz);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    let n = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = X0 + (i + 0.5) * CELL, z = Z0 + (j + 0.5) * CELL, th = terrainH(x, z);
      let h = Math.max(COL.ground(x, z, 200, 0), th);
      const water = th < -0.6 && h < 0.2;
      if (water) h = -0.6;
      const hh = Math.max(0.05, (h + 1.2) * K * VEX);
      m4.makeScale(CELL * K * 1.002, hh, CELL * K * 1.002); m4.setPosition((x) * K, 0, (z) * K);
      mesh.setMatrixAt(n, m4);
      const [r, g, b] = colAt(x, z), gr = GR.get(x, z);
      // the photograph, steered toward a legible palette: dark lanes, pale squares, warm roofs, deep water
      const base = water ? 0x1a5a78 : gr === GR.STREET ? 0x7a6a56 : gr === GR.PAVE ? 0xcab896 : h > 2 ? (h > 9 ? 0xe8d6b4 : 0xd2b48c) : 0xa89070;
      c.setRGB(r, g, b).lerp(new THREE.Color(base), water ? 0.6 : 0.5);
      mesh.setColorAt(n, c); n++;
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    mesh.position.y = 0.012;
    tray.add(mesh);
    // the board: cedar tray with a raised lip, a brass compass rose in the corner
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.7 }), brass = new THREE.MeshStandardMaterial({ color: 0xc0973f, roughness: 0.35, metalness: 0.8 });
    const w = (X1 - X0) * K + 0.03, d = (Z1 - Z0) * K + 0.03, cx = (X0 + X1) / 2 * K, cz = (Z0 + Z1) / 2 * K;
    // drawn after the world with a fresh depth buffer, so the map never sinks into a wall you're standing against
    const board = M(new THREE.BoxGeometry(w, 0.012, d), wood, tray, cx, 0.006, cz); board.onBeforeRender = (r) => r.clearDepth();
    for (const [sx, sz, lw, ld] of [[0, -1, w, 0.012], [0, 1, w, 0.012], [-1, 0, 0.012, d], [1, 0, 0.012, d]]) M(new THREE.BoxGeometry(lw, 0.018, ld), wood, tray, cx + sx * (w / 2 - 0.006), 0.021, cz + sz * (d / 2 - 0.006));
    const rose = new THREE.Group(); rose.position.set(X1 * K - 0.03, 0.03, Z0 * K + 0.03); tray.add(rose);
    M(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 16), brass, rose, 0, 0, 0);
    M(new THREE.ConeGeometry(0.006, 0.026, 4), new THREE.MeshStandardMaterial({ color: 0xa02a20, roughness: 0.5 }), rose, 0, 0.004, -0.012, -Math.PI / 2);
    // pins
    pinMe = new THREE.Group(); M(new THREE.ConeGeometry(0.004, 0.024, 8), new THREE.MeshStandardMaterial({ color: 0xd8301e, emissive: 0x501008 }), pinMe, 0, 0.012, 0, Math.PI); M(new THREE.SphereGeometry(0.0055, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff4030, emissive: 0x802010 }), pinMe, 0, 0.026, 0);
    M(new THREE.ConeGeometry(0.004, 0.014, 6), new THREE.MeshStandardMaterial({ color: 0xff4030, emissive: 0x802010 }), pinMe, 0, 0.003, -0.012, -Math.PI / 2); tray.add(pinMe);   // arrow: the way you face
    pinGoal = new THREE.Group(); M(new THREE.ConeGeometry(0.004, 0.03, 8), new THREE.MeshStandardMaterial({ color: 0xe8b830, emissive: 0x604008 }), pinGoal, 0, 0.015, 0, Math.PI); M(new THREE.SphereGeometry(0.007, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffd040, emissive: 0x806010 }), pinGoal, 0, 0.032, 0); tray.add(pinGoal);
    pinMe.scale.setScalar(1.9); pinGoal.scale.setScalar(1.7);
    tray.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.renderOrder = o === board ? 999 : 1000; } });
    // two hands gripping the near corners
    const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.skin || '#c98e62'), roughness: 0.7 });
    for (const s of [-1, 1]) { const h = M(new THREE.BoxGeometry(0.05, 0.022, 0.085), skin, group, s * (w / 2 - 0.012), 0.004, d / 2 - 0.02); h.frustumCulled = false; h.renderOrder = 1000; hands.push(h); const th = M(new THREE.BoxGeometry(0.04, 0.012, 0.02), skin, h, -s * 0.004, 0.015, -0.045); th.renderOrder = 1000; th.frustumCulled = false; }
    tray.position.set(-cx, 0, -cz);
    camera.add(group);
    if (!camera.parent) scene.add(camera);
  }
  function toggle(force) {
    const want = force ?? !open;
    if (want === open) return;
    if (want && !built) build();
    open = want; group.visible = open;
    if (open) { P.trigger = false; aimKey.down = aimKey.toggled = false; audio.pouch(); } else audio.holster();
    for (const h of hands) h.material.color.set(cfg.skin || '#c98e62');
  }
  const _q = new THREE.Quaternion(), _e = new THREE.Euler();
  function update(dt) {
    t += dt;
    if (!open) return;
    if (mode !== 'range' || P.dead) { toggle(false); return; }
    // held low in both hands, tilted up toward the eyes; aim brings it close
    const close = aimKey.down || aimKey.toggled ? 1 : 0;
    P.mapClose = damp(P.mapClose || 0, close, 8, dt);
    const bob = Math.sin(P.phase * 2) * 0.004 * P.gaitW;
    group.position.set(0, lerp(-0.13, -0.05, P.mapClose) + bob, lerp(-0.37, -0.27, P.mapClose));
    group.rotation.set(lerp(0.85, 1.2, P.mapClose) + P.pitch * 0.2, 0, Math.sin(t * 0.9) * 0.01);
    // north is up the board; the red pin's arrow shows the way you face
    const gy = (x, z) => Math.max(COL.ground(x, z, P.pos.y + 1, 0.5), terrainH(x, z)) + 1.2;
    pinMe.position.set(P.pos.x * K, 0.012 + gy(P.pos.x, P.pos.z) * K * VEX, P.pos.z * K);
    pinMe.rotation.y = P.yaw;
    const g = MISSION.target;
    pinGoal.visible = !!g;
    if (g) pinGoal.position.set(clamp(g.x, X0, X1) * K, 0.012 + ((g.y ?? 1) + 1.2) * K * VEX + Math.abs(Math.sin(t * 3)) * 0.008, clamp(g.z, Z0, Z1) * K);
  }
  return { toggle, update, get open() { return open; } };
})();
