// =====================================================================
//  Jetskis: the hull, how it rides the water, the spray and the wake
// =====================================================================
// SCOOTER owns mounting and the rider; this owns the machine. It comes up onto the plane through a hump (the
// nose rises, then levels as it gets on top of the water), banks into its turns, steers by the jet so it needs
// throttle to turn, slides wide unless you carve (SPACE), hops off the chop at speed and lands in a splash.
// The spray is its own droplet system (bow sheets, the rooster tail, turning spray, landing splashes) and the
// wake is foam laid on the water behind the stern, spreading into a V.
const JET = (() => {
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.35, metalness: o.m ?? 0.2, ...o.x });
  // top-view outline of the hull: square stern, widest just aft of the middle, a long pointed bow (x across, f forward)
  const OUT = [[0.5, -1.38], [0.58, -1.1], [0.62, -0.35], [0.6, 0.25], [0.52, 0.75], [0.36, 1.18], [0.16, 1.48], [0, 1.58]];
  const outline = (inset = 0, f0 = -9, f1 = 9) => {
    const sh = new THREE.Shape(), pts = OUT.filter(([, f]) => f >= f0 && f <= f1).map(([x, f]) => [Math.max(0.02, x - inset), f]);
    const all = [...pts.map(([x, f]) => [x, f]), ...pts.slice().reverse().map(([x, f]) => [-x, f])];
    // shape y is −forward, so after rotateX(−π/2) forward is +z and the extrusion depth is up
    let v2 = all.map(([x, f]) => new THREE.Vector2(x, -f)); if (THREE.ShapeUtils.isClockWise(v2)) v2 = v2.reverse();   // counter-clockwise, or the faces turn inside out
    sh.moveTo(v2[0].x, v2[0].y); for (const q of v2.slice(1)) sh.lineTo(q.x, q.y); sh.closePath(); return sh;
  };
  const slab = (shape, depth, bevel, y) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };
  function model(col) {
    const g = new THREE.Group(), hullM = mat(0xf6f6f2, { r: 0.28, m: 0.15 }), paint = mat(col, { r: 0.22, m: 0.35 }), dark = mat(0x1a1c1e, { r: 0.7, m: 0.1 }), rub = mat(0x2a2c2e, { r: 0.8, m: 0 }), chrome = mat(0xd8dade, { r: 0.15, m: 0.9 }), seatM = mat(0x16181a, { r: 0.9, m: 0 });
    const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, p = g) => { const o = M(geo, m, p, x, y, z, rx, ry, rz); o.castShadow = true; return o; };
    // the hull: extruded outline, then squeezed to a V keel underneath and the bottom swept up toward the bow
    const hull = slab(outline(), 0.42, 0.06, -0.24), P2 = hull.attributes.position;
    for (let i = 0; i < P2.count; i++) {
      const x = P2.getX(i), y = P2.getY(i), z = P2.getZ(i), lo = clamp((0.02 - y) / 0.3, 0, 1);   // 0 at the chine, 1 at the keel
      P2.setX(i, x * (1 - 0.72 * lo)); P2.setY(i, y + Math.max(0, z - 0.55) * 0.22 * (0.4 + lo * 0.6));
    }
    hull.computeVertexNormals(); add(hull, hullM);
    add(slab(outline(0.03), 0.05, 0.02, 0.2), rub);                               // the rubbing strake round the gunwale
    add(slab(outline(0.08, 0.2, 9), 0.16, 0.06, 0.24), paint);                    // the hood over the bow
    add(slab(outline(0.06, -9, 0.3), 0.05, 0.02, 0.22), hullM);                     // the white deck aft of the hood
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.2, 0.03, 1.05), dark, sx * 0.37, 0.31, -0.55);   // the footwell mats
    // the stripe down each side
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.07, 1.7), paint, sx * 0.6, 0.06, -0.25, 0, sx * -0.03, 0);
    // the seat: a long padded saddle, stepped at the passenger's end, the grab strap
    const seat = new THREE.Shape(); seat.moveTo(-0.21, 0.35); seat.quadraticCurveTo(0, 0.42, 0.21, 0.35); seat.lineTo(0.2, -0.75); seat.lineTo(-0.2, -0.75); seat.closePath();
    if (THREE.ShapeUtils.isClockWise(seat.getPoints())) { const q = seat.getPoints().reverse(); seat.curves = []; seat.moveTo(q[0].x, q[0].y); for (const v of q.slice(1)) seat.lineTo(v.x, v.y); seat.closePath(); }
    add(slab(seat, 0.14, 0.06, 0.32), seatM, 0, 0, -0.42);
    add(new THREE.BoxGeometry(0.44, 0.03, 0.05), dark, 0, 0.6, -0.55);
    // the console: a cowl with a small windscreen, the column, bars with black grips, mirrors
    add(new THREE.BoxGeometry(0.62, 0.18, 0.5), paint, 0, 0.5, 0.42, -0.25);
    add(new THREE.BoxGeometry(0.44, 0.2, 0.02), mat(0x1a2430, { r: 0.05, m: 0.4, x: { transparent: true, opacity: 0.7 } }), 0, 0.68, 0.55, -0.55);
    const steer = new THREE.Group(); steer.position.set(0, 0.72, 0.3); steer.rotation.x = -0.3; g.add(steer);
    add(new THREE.CylinderGeometry(0.05, 0.065, 0.24, 8), dark, 0, -0.08, 0, 0, 0, 0, steer);
    add(new THREE.CylinderGeometry(0.016, 0.016, 0.7, 8), chrome, 0, 0.06, 0, 0, 0, Math.PI / 2, steer);
    for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(0.025, 0.025, 0.13, 8), dark, sx * 0.3, 0.06, 0, 0, 0, Math.PI / 2, steer); add(new THREE.BoxGeometry(0.1, 0.05, 0.01), chrome, sx * 0.3, 0.2, 0.06, 0, 0, 0, steer); add(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 4), chrome, sx * 0.3, 0.13, 0.05, 0, 0, 0, steer); }
    add(new THREE.BoxGeometry(0.16, 0.08, 0.06), mat(0x0a0e12, { r: 0.1, m: 0.3, x: { emissive: 0x1a4a5a, emissiveIntensity: 0.6 } }), 0, 0.12, 0.04, -0.3, 0, 0, steer);
    // the stern: the boarding platform, the jet nozzle, the tow eye; the intake grate underneath
    add(new THREE.BoxGeometry(1.0, 0.05, 0.3), dark, 0, 0.18, -1.33);
    add(new THREE.CylinderGeometry(0.09, 0.11, 0.22, 10), dark, 0, -0.08, -1.42, Math.PI / 2);
    add(new THREE.TorusGeometry(0.035, 0.01, 4, 8), chrome, 0, 0.12, 1.55, Math.PI / 2);
    const nop = new THREE.Group(); g.add(nop);
    return { g, steer, fw: nop, rw: nop, stand: nop, grip: [0.3, 0.06, 0] };
  }

  // ---------------- spray: droplets thrown off the hull ----------------
  const SN = 1400; let spray = null, sp0 = 0;
  const S = { x: new Float32Array(SN), y: new Float32Array(SN), z: new Float32Array(SN), vx: new Float32Array(SN), vy: new Float32Array(SN), vz: new Float32Array(SN), life: new Float32Array(SN), max: new Float32Array(SN), size: new Float32Array(SN) };
  function buildSpray() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(SN), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(SN), 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { scale: { value: 400 } },
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float aA; attribute float aS; uniform float scale; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = aS * scale / max(.1, -mv.z); vA = aA;
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        varying float vA;
        void main(){
        #include <logdepthbuf_fragment>
        vec2 c = gl_PointCoord - .5; float r = dot(c, c) * 4.; if (r > 1. || vA < .003) discard;
        gl_FragColor = vec4(mix(vec3(.82,.93,.98), vec3(1.), 1. - r), vA * (1. - r * r)); }`,
    });
    spray = new THREE.Points(geo, m); spray.frustumCulled = false; spray.renderOrder = 3; scene.add(spray);
  }
  function drop(x, y, z, vx, vy, vz, size, life) {
    const i = sp0 = (sp0 + 1) % SN;
    S.x[i] = x; S.y[i] = y; S.z[i] = z; S.vx[i] = vx; S.vy[i] = vy; S.vz[i] = vz; S.size[i] = size; S.life[i] = S.max[i] = life;
  }
  // ---------------- wake: foam patches laid on the water ----------------
  const WN = 420; let wake = null, w0 = 0;
  const F = { x: new Float32Array(WN), z: new Float32Array(WN), vx: new Float32Array(WN), vz: new Float32Array(WN), s: new Float32Array(WN), gr: new Float32Array(WN), life: new Float32Array(WN), max: new Float32Array(WN), k: new Float32Array(WN), r: new Float32Array(WN) };
  function buildWake() {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    geo.setAttribute('aF', new THREE.InstancedBufferAttribute(new Float32Array(WN), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aR', new THREE.InstancedBufferAttribute(new Float32Array(WN).map(() => Math.random() * 50), 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, uniforms: { t: { value: 0 } },
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float aF; attribute float aR; varying float vF; varying float vR; varying vec2 vUv;
        void main(){ vUv = uv; vF = aF; vR = aR; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.);
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float t; varying float vF; varying float vR; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
        void main(){
        #include <logdepthbuf_fragment>
        if (vF < .004) discard;
        vec2 p = vUv - .5; float d = length(p) * 2.;
        float foam = n(vUv * 7. + vR) * .6 + n(vUv * 17. - vR + t * .3) * .4;
        float a = smoothstep(1., .35, d) * smoothstep(.5 - vF * .35, .75 - vF * .2, foam + (1. - d) * .35) * vF;
        gl_FragColor = vec4(vec3(.97, .99, 1.), a * .9); }`,
    });
    wake = new THREE.InstancedMesh(geo, m, WN); wake.frustumCulled = false; wake.renderOrder = 2; scene.add(wake);
    const z0 = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < WN; i++) wake.setMatrixAt(i, z0);
  }
  function foam(x, z, vx, vz, size, grow, life, k) {
    const i = w0 = (w0 + 1) % WN;
    F.x[i] = x; F.z[i] = z; F.vx[i] = vx; F.vz[i] = vz; F.s[i] = size; F.gr[i] = grow; F.life[i] = F.max[i] = life; F.k[i] = k; F.r[i] = Math.random() * 6.28;
  }

  // ---------------- riding ----------------
  const VMAX = 24;
  const surf = (x, z, t) => MAP.waterY + waveH(x, z, t) + Math.sin(x * 0.41 + t * 2.1) * Math.sin(z * 0.37 - t * 1.7) * 0.035;   // swell plus a little chop
  // a point on the hull (lateral, forward) in the world
  const at = (s, lx, lf, o) => { const c = Math.cos(s.yaw), sn = Math.sin(s.yaw); o.x = s.x + c * lx - sn * lf; o.z = s.z - sn * lx - c * lf; return o; };
  const _p = { x: 0, z: 0 };
  function drive(s, dt, keys) {
    const thr = keys.KeyW ? 1 : 0, rev = keys.KeyS ? 1 : 0, carve = keys.Space ? 1 : 0, tt = performance.now() / 1000;
    s.steerIn = damp(s.steerIn, (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0), 6, dt);
    if (s.vy === undefined) { s.vy = 0; s.air = false; s.hopT = 2; s.fT = 0; }
    const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    let v = s.vx * fx + s.vz * fz;
    const hump = Math.exp(-(((Math.abs(v) - 6.5) / 3) ** 2)), shallow = clamp((terrainH(s.x, s.z) - (MAP.waterY - 1.2)) / 0.8, 0, 1);
    if (!s.air) {
      if (thr) v += (9 - 4 * hump) * (1 - Math.max(0, v) / VMAX) * dt;
      if (rev) v = v > 1 ? v - 6 * dt : Math.max(-3, v - 3 * dt);
      v -= (0.011 * v * Math.abs(v) + (thr ? 0.06 : 0.45) * v + (0.5 * hump + 3 * shallow) * Math.sign(v) * Math.min(1, Math.abs(v))) * dt;
      if (!thr && !rev && Math.abs(v) < 0.08) v = 0;
    }
    // the jet steers: little bite without throttle, more with; carving tightens it and costs speed
    const auth = clamp(Math.abs(v) / 2.5, 0, 1) * (thr ? 1 : 0.45) * (s.air ? 0.15 : 1);
    s.yaw += s.steerIn * (1.35 - 0.45 * clamp(Math.abs(v) / VMAX, 0, 1)) * auth * (carve ? 1.55 : 1) * Math.sign(v || 1) * dt;
    const nfx = -Math.sin(s.yaw), nfz = -Math.cos(s.yaw), along = s.vx * nfx + s.vz * nfz, latX = s.vx - along * nfx, latZ = s.vz - along * nfz;
    // the hull turns the slide into forward way (most of it): you keep your speed through a turn, carving bleeds a little
    const keep = Math.exp(-(s.air ? 0.2 : carve ? 5.5 : 1.9 + Math.abs(s.lean) * 3) * dt), latL = Math.hypot(latX, latZ);
    const a0 = v + (along - (s.vx * fx + s.vz * fz)), tot = Math.hypot(a0, latL) - latL * (1 - keep) * 0.3 - (carve && !s.air ? Math.abs(s.steerIn) * 1.1 * dt : 0);
    const vNew = Math.sign(a0 || 1) * Math.sqrt(Math.max(0, tot * tot - (latL * keep) ** 2));
    s.vx = nfx * vNew + latX * keep; s.vz = nfz * vNew + latZ * keep;
    // move: run aground on the beach and stop; bump the jetties and boats
    const nx = s.x + s.vx * dt, nz = s.z + s.vz * dt;
    if (terrainH(nx, nz) > MAP.waterY - 0.25) { const sp = Math.hypot(s.vx, s.vz); if (sp > 6) { P.shake = Math.min(1.5, P.shake + 0.6); audio.crash(sp / 25); splash(s, sp * 0.4); } s.vx *= -0.2; s.vz *= -0.2; }
    else {
      const p = { x: nx, y: s.y, z: nz }; COL.resolve(p, 0.62, 1.2);
      if (Math.hypot(p.x - nx, p.z - nz) > 1e-3) { const sp = Math.hypot(s.vx, s.vz); if (sp > 6) { P.shake = Math.min(1.5, P.shake + 0.5); audio.crash(sp / 25); } s.vx *= 0.4; s.vz *= 0.4; }
      s.x = p.x; s.z = p.z;
    }
    const sp = Math.hypot(s.vx, s.vz);
    // heave: a stiff spring to the surface, riding a little higher once it's planing; at speed the chop throws it
    const water = surf(s.x, s.z, tt), ride = water + clamp((sp - 5) / 10, 0, 1) * 0.07;
    if (!s.air) {
      s.vy += ((ride - s.y) * 70 - s.vy * 11) * dt;
      if (sp > 13 && !s.air && (s.hopT -= dt * sp / 16) <= 0) { s.hopT = 1.2 + Math.random() * 3; s.vy = 1.3 + Math.random() * 1.6 * (sp / VMAX); s.air = true; }
    } else { s.vy -= 9.8 * dt; }
    s.y += s.vy * dt;
    if (s.air && s.y <= water && s.vy < 0) { const hit = -s.vy; s.air = false; s.vy *= 0.15; s.y = water; splash(s, hit * 2.4); P.shake = Math.min(1.2, P.shake + hit * 0.18); if (P.feel) P.feel.vland -= hit * 3; audio.step(false, 1); }
    // attitude: the nose rises through the hump and levels on the plane; waves pitch and roll it; it banks into turns
    const a = at(s, 0, 1.2, { x: 0, z: 0 }), b = at(s, 0, -1.2, { x: 0, z: 0 }), l = at(s, -0.6, 0, { x: 0, z: 0 }), r = at(s, 0.6, 0, { x: 0, z: 0 });
    const wp = (surf(a.x, a.z, tt) - surf(b.x, b.z, tt)) / 2.4, wr = (surf(l.x, l.z, tt) - surf(r.x, r.z, tt)) / 1.2;
    const pitchT = s.air ? s.pitch - 0.25 * dt : hump * 0.16 * (thr ? 1 : 0.35) + clamp(sp / VMAX, 0, 1) * 0.035 + wp * 1.5 - (rev ? 0.04 : 0);
    s.pitch = damp(s.pitch, pitchT, s.air ? 0.8 : 5, dt);
    s.lean = damp(s.lean, s.steerIn * clamp(sp / 8, 0, 1) * (carve ? 0.62 : 0.42) + wr * 1.2, 4.5, dt);
    s.steer = damp(s.steer, s.steerIn * 0.45, 10, dt);
    // spray and wake
    if (!s.air) emit(s, dt, sp, thr, carve, tt);
    s.v = vNew;
    return { sp, VMAX };
  }
  function emit(s, dt, sp, thr, carve, tt) {
    const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw), wy = MAP.waterY + 0.05;
    const k = clamp(sp / VMAX, 0, 1);
    // bow sheets: thrown out and up either side where the hull meets the water
    const nBow = Math.floor(sp * dt * 9 + Math.random());
    for (let i = 0; i < nBow && sp > 3; i++) for (const side of [-1, 1]) {
      const lf = 0.2 + Math.random() * 0.5; at(s, side * 0.58, lf, _p);
      const out = (1.2 + Math.random() * 2.2) * (0.4 + k), up = (0.8 + Math.random() * 1.6) * (0.3 + k * 1.1) * (1 + (side * s.steerIn < 0 ? Math.abs(s.steerIn) * 0.8 : 0));
      drop(_p.x, wy, _p.z, rx * side * out + s.vx * 0.55, up, rz * side * out + s.vz * 0.55, 0.12 + Math.random() * 0.14, 0.5 + Math.random() * 0.5);
    }
    // the rooster tail out of the nozzle under throttle
    if (thr && sp > 5) { const n = Math.floor(dt * 120 * k + Math.random()); for (let i = 0; i < n; i++) { at(s, (Math.random() - 0.5) * 0.2, -1.45, _p); const back = 2 + Math.random() * 3; drop(_p.x, wy, _p.z, -fx * back + s.vx * 0.4 + (Math.random() - 0.5) * 1.2, (3 + Math.random() * 3.5) * k + 0.8, -fz * back + s.vz * 0.4 + (Math.random() - 0.5) * 1.2, 0.2 + Math.random() * 0.28, 0.8 + Math.random() * 0.5); } }
    else if (thr) { if (Math.random() < dt * 30) { at(s, 0, -1.45, _p); drop(_p.x, wy, _p.z, -fx + (Math.random() - 0.5) * 0.6, 0.6 + Math.random(), -fz + (Math.random() - 0.5) * 0.6, 0.14, 0.4); } }
    // carving: a sheet off the outside of the turn
    if (sp > 6 && Math.abs(s.steerIn) > 0.35) { const side = -Math.sign(s.steerIn), n = Math.floor(dt * (carve ? 90 : 40) * k + Math.random()); for (let i = 0; i < n; i++) { at(s, side * 0.6, -0.4 + Math.random() * 0.8, _p); drop(_p.x, wy, _p.z, rx * side * (3 + Math.random() * 3) * k + s.vx * 0.4, 1.5 + Math.random() * 2.5 * k, rz * side * (3 + Math.random() * 3) * k + s.vz * 0.4, 0.15 + Math.random() * 0.2, 0.6 + Math.random() * 0.5); } }
    // the wake: foam from each corner of the stern spreading into a V, the churned water behind the nozzle, a bow wave
    if (sp > 1.5 && (s.fT -= dt) <= 0) {
      s.fT = clamp(0.5 / sp, 0.03, 0.14);
      const st = clamp(sp / 10, 0.35, 1);
      for (const side of [-1, 1]) { at(s, side * 0.48, -1.3, _p); const o = 0.4 + sp * 0.06; foam(_p.x, _p.z, rx * side * o + s.vx * 0.1, rz * side * o + s.vz * 0.1, 0.7 + sp * 0.03, 0.35 + sp * 0.03, 4 + sp * 0.12, st); }
      at(s, 0, -1.6, _p); foam(_p.x, _p.z, s.vx * 0.15, s.vz * 0.15, 0.9 + sp * 0.05, 0.6 + sp * 0.04, 2.4, Math.min(1, st * 1.2));
      if (sp > 4) for (const side of [-1, 1]) { at(s, side * 0.5, 0.6, _p); foam(_p.x, _p.z, rx * side * 1.2 + s.vx * 0.05, rz * side * 1.2 + s.vz * 0.05, 0.5, 0.5, 1.4, st * 0.7); }
    }
  }
  // landing or beaching: a burst of droplets and a ring of foam
  function splash(s, strength) {
    if (!spray) return;
    const n = Math.min(90, Math.floor(strength * 14)), wy = MAP.waterY + 0.05;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, o = (1 + Math.random() * 3) * Math.min(1.6, strength / 3); drop(s.x + Math.cos(a) * 0.7, wy, s.z + Math.sin(a) * 1.2, Math.cos(a) * o + s.vx * 0.4, (1.5 + Math.random() * 3) * Math.min(1.5, strength / 3), Math.sin(a) * o + s.vz * 0.4, 0.15 + Math.random() * 0.25, 0.6 + Math.random() * 0.6); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; foam(s.x + Math.cos(a) * 0.8, s.z + Math.sin(a) * 0.8, Math.cos(a) * 1.4, Math.sin(a) * 1.4, 1.0, 0.8, 2.5, 1); }
  }
  // ---------------- per frame: the droplets fly and fall back, the foam drifts, spreads and fades ----------------
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new V3(), _s = new V3(), _z = new THREE.Matrix4().makeScale(0, 0, 0), UPV = new V3(0, 1, 0);
  let anyAlive = false;
  function update(dt) {
    if (MAP.id !== 'bahamas' || !MAP.ready) return;
    if (!spray) { buildSpray(); buildWake(); }
    spray.material.uniforms.scale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    const pos = spray.geometry.attributes.position.array, aA = spray.geometry.attributes.aA.array, aS = spray.geometry.attributes.aS.array, wy = MAP.waterY, dr = Math.exp(-0.7 * dt);
    let alive = false;
    for (let i = 0; i < SN; i++) {
      if (S.life[i] <= 0) { if (aA[i] !== 0) aA[i] = 0; continue; }
      alive = true; S.life[i] -= dt; S.vy[i] -= 9.8 * dt; S.vx[i] *= dr; S.vz[i] *= dr;
      S.x[i] += S.vx[i] * dt; S.y[i] += S.vy[i] * dt; S.z[i] += S.vz[i] * dt;
      if (S.y[i] < wy && S.vy[i] < 0) S.life[i] = 0;
      const f = Math.max(0, S.life[i] / S.max[i]);
      pos[i * 3] = S.x[i]; pos[i * 3 + 1] = S.y[i]; pos[i * 3 + 2] = S.z[i]; aA[i] = S.life[i] > 0 ? 0.75 * Math.pow(f, 0.6) : 0; aS[i] = S.size[i] * (1 + (1 - f) * 1.3);
    }
    if (alive || anyAlive) { spray.geometry.attributes.position.needsUpdate = spray.geometry.attributes.aA.needsUpdate = spray.geometry.attributes.aS.needsUpdate = true; }
    const aF = wake.geometry.attributes.aF.array, fd = Math.exp(-0.9 * dt), tt = performance.now() / 1000; let wAlive = false;
    for (let i = 0; i < WN; i++) {
      if (F.life[i] <= 0) { if (aF[i] !== 0) { aF[i] = 0; wake.setMatrixAt(i, _z); wAlive = true; } continue; }
      wAlive = true; F.life[i] -= dt; F.x[i] += F.vx[i] * dt; F.z[i] += F.vz[i] * dt; F.vx[i] *= fd; F.vz[i] *= fd; F.s[i] += F.gr[i] * dt;
      const f = Math.max(0, F.life[i] / F.max[i]); aF[i] = F.k[i] * Math.pow(f, 1.4);
      _q.setFromAxisAngle(UPV, F.r[i]); _m.compose(_v.set(F.x[i], wy + waveH(F.x[i], F.z[i], tt) + 0.03, F.z[i]), _q, _s.set(F.s[i], 1, F.s[i] * 1.3)); wake.setMatrixAt(i, _m);
    }
    if (wAlive) { wake.instanceMatrix.needsUpdate = true; wake.geometry.attributes.aF.needsUpdate = true; }
    wake.material.uniforms.t.value = tt; anyAlive = alive;
  }
  return { model, drive, update, splash };
})();
