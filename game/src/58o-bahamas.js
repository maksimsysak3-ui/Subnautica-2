// =====================================================================
//  CASE 04 — PARADISE: an island in the Bahamas
// =====================================================================
// One main island (a pastel village and its harbour on the north shore, a resort on the long white
// beach to the south, open white villas along both coasts, palm forest between), a guarded private
// island to the north-east, and a small cay to the south-west where a seaplane is moored. Shallow
// turquoise shelves round every shore, a reef further out, deep blue beyond. Jetskis to get between them.
const WY = -0.45;   // sea level (the land plateau sits at 0)
const ISLANDS = [
  { x: 0, z: 0, rx: 262, rz: 142, n: 2.6, rot: 0 },        // the main island
  { x: 380, z: -250, rx: 88, rz: 62, n: 2.2, rot: 0.3 },   // the private island
  { x: -360, z: 262, rx: 34, rz: 24, n: 2, rot: -0.4 },    // the cay
];
const BAHAMAS = {
  bounds: [-480, 480, -360, 340],
  jets: [[-47, 162.6, Math.PI / 2, 0xe8e8e8], [-43, 162.6, Math.PI / 2, 0x2ab0d0], [-37, 157.4, -Math.PI / 2, 0xf0d020], [-33, 157.4, -Math.PI / 2, 0xe83a5a], [282, -276, -Math.PI / 2, 0x1a1a1a], [282, -224, -Math.PI / 2, 0x1a1a1a], [-80, -162, 0, 0xe8e8e8]],
};
const PASTEL = [0xf4b0b8, 0xf6e08a, 0xa8e0c8, 0x9ad0ec, 0xc8b0e0, 0xf8c8a0, 0xf4f0e8, 0xb8e8a8, 0xf09a8a];
const ACCENT = [0x2ab0b0, 0xf0f0ec, 0x3a8ac8, 0xe8604a, 0x5ab05a, 0xf0c040];
// signed distance to the nearest shore (negative inland), with a little noise in the coastline
function islandSD(x, z) {
  let best = 1e9;
  for (const I of ISLANDS) {
    const c = Math.cos(I.rot), s = Math.sin(I.rot), lx = (x - I.x) * c + (z - I.z) * s, lz = -(x - I.x) * s + (z - I.z) * c;
    const q = Math.pow(Math.pow(Math.abs(lx / I.rx), I.n) + Math.pow(Math.abs(lz / I.rz), I.n), 1 / I.n);
    best = Math.min(best, (q - 1) * Math.min(I.rx, I.rz));
  }
  return best + (fbm(x * 0.018 + 7, z * 0.018) - 0.5) * 12;
}
function islandH(x, z) {
  const sd = islandSD(x, z);
  if (sd < -26) return 0;
  if (sd < 0) { const t = (sd + 26) / 26; return WY * t * t; }   // the beach
  let h = WY - 2.8 * smooth(Math.min(1, sd / 45)) - 12 * smooth(clamp((sd - 70) / 180, 0, 1));
  h += (vnoise(x * 0.08, z * 0.08) - 0.5) * 0.35 * Math.min(1, sd / 20);              // ripples in the sand
  const reef = Math.exp(-(((sd - 120) / 14) ** 2)); h = Math.max(h, WY - 1.0 - (1 - reef) * 20);   // the reef line
  // the sandbar out to the cay: walkable at low water, barely awash
  const ax = -230, az = 130, bx = -340, bz = 248, ux = bx - ax, uz = bz - az, L2 = ux * ux + uz * uz, t2 = clamp(((x - ax) * ux + (z - az) * uz) / L2, 0, 1), dd = Math.hypot(x - ax - ux * t2, z - az - uz * t2);
  if (dd < 30) h = Math.max(h, WY - 0.15 - dd * 0.05);
  return h;
}
function islandColor(c, x, z, h, n, n2) {
  const sd = islandSD(x, z);
  if (h < WY - 0.05) { c.setRGB(0.93, 0.88, 0.76).lerp(new THREE.Color(0.55, 0.62, 0.55), clamp((WY - h) / 12, 0, 1) * 0.7); if (h > WY - 2.5) c.lerp(new THREE.Color(0.98, 0.95, 0.86), 0.3 * n2); return; }
  if (sd > -26) { c.setRGB(0.97, 0.94, 0.86).lerp(new THREE.Color(0.9, 0.84, 0.7), n * 0.35); return; }   // white sand
  c.setRGB(0.36, 0.56, 0.22).lerp(new THREE.Color(0.52, 0.6, 0.3), n * 0.6).lerp(new THREE.Color(0.86, 0.8, 0.62), clamp((sd + 40) / 14, 0, 1) * 0.6);
}

// ---------------- the water: depth from the real sea bed, so the shallows glow turquoise ----------------
const BSEA = (() => {
  const R = 900, N = 384;
  let mesh = null;
  const mat = new THREE.ShaderMaterial({
    transparent: true, fog: true, depthWrite: false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 }, depth: { value: null }, sunDir: { value: new V3() }, sky: { value: new THREE.Color(0.6, 0.8, 0.95) } }]),
    vertexShader: `#include <common>
      varying vec3 vW;
      #include <fog_pars_vertex>
      #include <logdepthbuf_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <logdepthbuf_vertex>
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float t; uniform sampler2D depth; uniform vec3 sunDir, sky; varying vec3 vW;
      #include <fog_pars_fragment>
      #include <logdepthbuf_pars_fragment>
      vec2 h2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return -1. + 2.*fract(sin(p)*43758.5453); }
      float gn(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.-2.*f); return mix(mix(dot(h2(i),f), dot(h2(i+vec2(1,0)),f-vec2(1,0)),u.x), mix(dot(h2(i+vec2(0,1)),f-vec2(0,1)), dot(h2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y); }
      float hgt(vec2 p){ return gn(p*.18 + vec2(t*.06, t*.04))*.7 + gn(p*.55 - vec2(t*.13, -t*.09))*.3 + gn(p*1.6 + vec2(t*.35, t*.22))*.1; }
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p = vW.xz; float e = .2;
        vec2 uv = p / ${(2 * R).toFixed(1)} + .5;
        float d = texture2D(depth, uv).r * 30.;                      // metres of water here
        vec3 n = normalize(vec3(hgt(p-vec2(e,0.)) - hgt(p+vec2(e,0.)), 2.*e*3.0, hgt(p-vec2(0.,e)) - hgt(p+vec2(0.,e))));
        vec3 v = normalize(cameraPosition - vW);
        float fr = .02 + .98 * pow(1. - max(dot(n, v), 0.), 5.);
        vec3 r = reflect(-v, n);
        // colour by depth: glassy white-turquoise over sand, bright turquoise, cobalt, deep navy
        vec3 c0 = vec3(.4,.92,.86), c1 = vec3(.0,.76,.8), c2 = vec3(.0,.44,.7), c3 = vec3(.01,.13,.34);
        vec3 water = mix(c0, c1, smoothstep(.0, 1.4, d)); water = mix(water, c2, smoothstep(1.6, 7., d)); water = mix(water, c3, smoothstep(7., 20., d));
        // caustics dancing on the bottom of the shallows
        float ca = pow(abs(sin(gn(p*.9 + t*.4)*6. + gn(p*1.7 - t*.3)*4.)), 8.);
        water += vec3(.35,.4,.35) * ca * (1. - smoothstep(.3, 4., d));
        vec3 col = mix(water, sky, clamp(fr * (.4 + .6 * smoothstep(1., 8., d)), 0., .7));
        col += vec3(1.5,1.4,1.2) * pow(max(dot(r, sunDir), 0.), 260.) * 4.;
        // foam: the surf line where the water runs out, and white caps far out
        float foam = smoothstep(.45, .05, d) * (.55 + .45 * sin(t * 1.6 + d * 18. + gn(p*.6) * 6.));
        foam = max(foam, smoothstep(.62, .8, hgt(p*1.4)) * .25 * smoothstep(10., 25., d));
        col = mix(col, vec3(.98,.99,1.), clamp(foam, 0., 1.) * .8);
        float a = mix(.62, .98, smoothstep(.0, 3.5, d));             // you see the sand through the shallows
        gl_FragColor = vec4(col, max(a, foam));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  function build() {
    const data = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = -R + (i + 0.5) * 2 * R / N, z = R - (j + 0.5) * 2 * R / N; data[j * N + i] = Math.round(clamp((WY - terrainH(x, z)) / 30, 0, 1) * 255); }
    const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.UnsignedByteType); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.flipY = false; tex.needsUpdate = true;
    // rows run from +z down: v = 0 at z = −R in the shader's uv, so flip the rows to match
    const flipped = new Uint8Array(N * N); for (let j = 0; j < N; j++) flipped.set(data.subarray((N - 1 - j) * N, (N - j) * N), j * N);
    tex.image.data = flipped;
    mat.uniforms.depth.value = tex; mat.uniforms.sunDir.value.copy(SKY.sunDir);
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R, 1, 1).rotateX(-Math.PI / 2), mat);
    mesh.position.y = WY; mesh.renderOrder = 1; scene.add(mesh);
    // beyond the depth map, the open ocean
    const far = new THREE.Mesh(new THREE.RingGeometry(R * 0.99, 6000, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a3a6a, fog: true }));
    far.position.y = WY - 0.02; scene.add(far);
  }
  return { build, update(t) { if (mesh) mat.uniforms.t.value = t; } };
})();
const waveH = (x, z, t) => Math.sin(x * 0.17 + t * 1.3) * 0.07 + Math.sin(z * 0.23 - t * 1.05) * 0.06;

function bahamasPlan() {
  SKY.tropical();
  Object.assign(CITY, { x0: -480, x1: 480, z0: -360, z1: 340 });
  Object.assign(SPAWN, { x: -20, z: 98, yaw: Math.PI });
  Object.assign(SQ, { x0: 1e4, z0: 1e4, x1: 1e4 + 1, z1: 1e4 + 1 });
  MAP.waterY = WY; MAP.bounds = 900;
  TOWN.factionAt = () => 'red';
  return [
    ['Laying out the island', bahamasLayout],
    ['The village and the harbour', bahamasVillage],
    ['The resort, the pier, the bungalows on the water', bahamasResort],
    ['Open white houses along the coast', bahamasVillas],
    ['The private island', bahamasPrivate],
    ['Palm forests, the cay and the seaplane', bahamasNature],
    ['The sea', () => { BSEA.build(); bahamasSecurity(); bahamasInteriors(); }],
  ];
}

// ---------------- roads and lanes ----------------
function bahamasLayout() {
  const sandRoad = { tx: TX.gravel, col: 0xe8dcc0 }, tar = { tx: TX.asphalt, col: 0x4a4a48 };
  // the coast road, round the island inside the beach
  lane('spine', [[0, -98], [0, 48]], 8, 'avenue', tar);
  lane('eastRoad', [[205, -70], [205, 70]], 7, 'avenue', tar); lane('westRoad', [[-205, -70], [-205, 70]], 7, 'avenue', tar);
  lane('crossW', [[-205, 0], [-8, 0]], 6, 'alley', tar); lane('crossE', [[8, 0], [205, 0]], 6, 'alley', tar);
  // the village: sandy lanes off the harbour
  for (const [n, pts] of [['vMain', [[-150, -96], [-20, -96]]], ['vA', [[-130, -96], [-130, -40]]], ['vB', [[-100, -120], [-100, -40]]], ['vC', [[-70, -96], [-70, -40]]], ['vD', [[-40, -120], [-40, -40]]], ['vE', [[-150, -60], [-20, -60]]]])
    lane(n, pts, 5.5, 'alley', sandRoad);
  // beach paths down to the water
  for (const x of [-120, -60, 60, 120]) lane(`beach${x}`, [[x, 92], [x, 128]], 3, 'alley', sandRoad);
  plaza('Harbour front', { x0: -150, z0: -136, x1: -20, z1: -104 }, 0xd8ccb0, TX.paving);
  plaza('Resort beach', { x0: -110, z0: 108, x1: 110, z1: 134 }, 0xf2ead8, TX.gravel);
  plaza('Pool deck', { x0: -60, z0: 88, x1: 60, z1: 106 }, 0xf0ece4, TX.ceramic);
  plaza('Straw market', { x0: -20, z0: -128, x1: 14, z1: -104 }, 0xd8ccb0, TX.paving);
}

// ---------------- buildings ----------------
// a door on a +z-facing wall at local (lx, y0, lz): white casing, a panelled leaf, brass knob, a lit fanlight and
// a porch lamp; registered with DOORS when it leads to a room (oy: the floor height you step back out onto)
function bDoor(lx, y0, lz, room, col, o = {}) {
  const w = o.w ?? 1.0, h = o.h ?? 2.1, trim = o.trim ?? 0xf8f8f4;
  W.box(w + 0.32, h + 0.16, 0.08, lx, y0 + (h + 0.16) / 2, lz + 0.03, trim);
  W.box(w, h, 0.06, lx, y0 + h / 2, lz + 0.08, col, { t: TX.wood });
  W.scope({ lod: 1 }, () => {
    for (const [sy, sh] of [[0.27, 0.34], [0.7, 0.4]]) for (const sx of [-1, 1]) W.box(w * 0.34, h * sh, 0.02, lx + sx * w * 0.22, y0 + h * sy, lz + 0.12, shade(col, 0.8));
    W.sphere(0.05, 0.05, 0.05, lx + w * 0.38, y0 + 1.0, lz + 0.14, 0xc8a050, { layer: 'metal' });
    W.box(w * 0.9, 0.03, 0.5, lx, y0 + 0.015, lz + 0.4, 0x8a6a4a, { t: TX.fabric });
  });
  if (o.fan !== false) { W.box(w, 0.34, 0.04, lx, y0 + h + 0.32, lz + 0.07, 0xffe0a0, { layer: 'glow' }); W.box(w + 0.32, 0.08, 0.12, lx, y0 + h + 0.52, lz + 0.05, trim); }
  if (o.lamp !== false) { W.box(0.14, 0.24, 0.14, lx + w / 2 + 0.38, y0 + 2.05, lz + 0.12, 0xfff0c0, { layer: 'glow' }); W.lamp(lx + w / 2 + 0.38, y0 + 2.0, lz + 0.7, 0xffd8a0, 1.0, 5, { halo: 0.4 }); }
  if (room && W.mode !== 'geom') { const a = W.worldPos(lx, 0, lz + 0.45), b = W.worldPos(lx, 0, lz + (o.out ?? 1.6)); TOWN.doors.push({ x: a.x, z: a.z, ox: b.x, oz: b.z, oy: o.oy, room, name: o.name ?? '' }); }
}
// a Bahamian clapboard cottage: pastel siding with corner boards, louvred shutters on every wall, flower boxes,
// a hip roof, a veranda with fretwork (a balcony over it on two floors), steps, the cistern, a picket fence
function cottageB(x, z, ry, w, d, F = 1, col = mpick(PASTEL), o = {}) {
  const H = F === 2 ? 6.2 : 3.3, acc = mpick(ACCENT), roof = mpick([0xf0f0ec, 0xc84a3a, 0x3a8a8a, 0xf0f0ec, 0x5a8ac8]), trim = 0xf8f8f4;
  const bz = -1.1, bd = d - 2.2, fz = d / 2 - 2.2;   // the body: centre, depth, front face
  W.push(x, 0, z, ry);
  W.box(w, 0.6, d, 0, 0.3, 0, 0xe8e0d0, { t: TX.stone }); W.solid(w, 0.6, d, 0, 0.3, 0, 'stone', { walk: true });
  W.box(w - 0.4, H, bd, 0, 0.6 + H / 2, bz, col, { t: TX.wood, wear: 2 }); W.solid(w - 0.4, H, bd, 0, 0.6 + H / 2, bz, 'wood');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.box(0.2, H, 0.2, sx * (w / 2 - 0.2), 0.6 + H / 2, bz + sz * bd / 2, trim);
  W.box(w - 0.24, 0.16, bd + 0.16, 0, 0.7, bz, trim); W.box(w - 0.24, 0.24, bd + 0.16, 0, 0.6 + H - 0.12, bz, trim);
  if (F === 2) W.box(w - 0.3, 0.12, bd + 0.1, 0, 3.7, bz, trim);
  W.scope({ lod: 1 }, () => { const sc = shade(col, 0.86); for (let y = 1.05; y < 0.5 + H; y += 0.34) { W.box(w - 0.44, 0.03, 0.02, 0, y, fz + 0.01, sc); for (const sx of [-1, 1]) W.box(0.02, 0.03, bd - 0.08, sx * (w / 2 - 0.19), y, bz, sc); } });
  // windows on all four walls
  const win = (k, y) => {
    const lit = mchance(0.3); W.box(0.9, 1.3, 0.05, k, y + 1.6, 0.02, lit ? 0xfff0c8 : 0x2a3a44, { layer: lit ? 'glow' : 'pane' });
    W.box(1.12, 0.12, 0.12, k, y + 2.32, 0.05, trim); W.box(1.12, 0.1, 0.2, k, y + 0.9, 0.08, trim);
    W.scope({ lod: 1 }, () => {
      for (const s2 of [-1, 1]) W.box(0.5, 1.4, 0.06, k + s2 * 0.76, y + 1.6, 0.06, acc, { t: TX.louver });
      W.box(0.05, 1.3, 0.03, k, y + 1.6, 0.05, trim); W.box(0.9, 0.05, 0.03, k, y + 1.65, 0.05, trim);
      if (mchance(0.4)) { W.box(1.0, 0.22, 0.26, k, y + 0.72, 0.22, shade(acc, 0.8), { t: TX.wood }); for (let i = 0; i < 4; i++) W.sphere(0.13, 0.11, 0.13, k - 0.36 + i * 0.24, y + 0.9, 0.22, mpick([0xe83a6a, 0xf0c040, 0xe8604a, 0x3a8a2a, 0xd84ab0]), { seg: 6 }); }
    });
  };
  const face = (px, pz, r, len, door) => { W.push(px, 0, pz, r); for (let f = 0; f < F; f++) for (let k = -len / 2 + 1.3; k < len / 2 - 0.8; k += 2.2) { if (door && f === 0 && Math.abs(k) < 1.0) continue; win(k, 0.6 + f * 3.1); } W.pop(); };
  face(0, fz, 0, w, true); for (const sx of [-1, 1]) face(sx * (w / 2 - 0.2), bz, sx * Math.PI / 2, bd, false); face(0, bz - bd / 2, Math.PI, w, false);
  bDoor(0, 0.68, fz, o.room ?? (F === 2 ? 'homestead' : 'cottage'), mpick([acc, trim, 0x2ab0b0]), { oy: 0.7, out: 1.3 });
  // veranda: deck, posts with brackets, railing, fretwork, steps down to the lane
  W.box(w, 0.08, 2.2, 0, 0.64, d / 2 - 1.1, 0xc8a878, { t: TX.wood });
  const posts = []; for (let k = -w / 2 + 0.2; k <= w / 2 - 0.1; k += (w - 0.4) / Math.max(1, Math.round(w / 2.4))) posts.push(k);
  for (const k of posts) W.box(0.12, 2.6, 0.12, k, 1.9, d / 2 - 0.1, trim);
  W.box(w, 0.22, 0.03, 0, 3.08, d / 2 - 0.08, trim, { t: TX.louver });
  W.scope({ lod: 1 }, () => {
    for (const k of posts) W.box(0.06, 0.5, 0.06, k, 2.9, d / 2 - 0.35, trim, { rx: 0.7 });
    for (const s2 of [-1, 1]) W.box(w / 2 - 0.8, 0.06, 0.06, s2 * (w / 4 + 0.4), 1.5, d / 2 - 0.1, trim);
    for (let k = -w / 2 + 0.3; k < w / 2; k += 0.25) if (Math.abs(k) > 0.8) W.box(0.04, 0.8, 0.04, k, 1.05, d / 2 - 0.1, trim);
    plasticChair(-w / 4, 0.68, d / 2 - 1.1, Math.PI, trim); plantPot(w / 2 - 0.6, 0.68, d / 2 - 0.6, 'geranium', 1.3);
    if (mchance(0.5)) plasticChair(-w / 4 - 0.8, 0.68, d / 2 - 1.1, Math.PI + 0.3, trim);
  });
  W.box(1.6, 0.4, 0.4, 0, 0.2, d / 2 + 0.2, 0xe8e0d0, { t: TX.stone }); W.box(1.6, 0.2, 0.4, 0, 0.1, d / 2 + 0.6, 0xe8e0d0, { t: TX.stone });
  W.solid(1.6, 0.4, 0.4, 0, 0.2, d / 2 + 0.2, 'stone', { walk: true }); W.solid(1.6, 0.2, 0.4, 0, 0.1, d / 2 + 0.6, 'stone', { walk: true });
  if (F === 2) {
    // the upper balcony over the veranda: a deck, a rail, posts to the eaves
    W.box(w, 0.14, 2.3, 0, 3.72, d / 2 - 1.1, 0xc8a878, { t: TX.wood });
    for (const k of posts) W.box(0.1, 2.9, 0.1, k, 5.2, d / 2 - 0.1, trim);
    W.box(w, 0.06, 0.06, 0, 4.7, d / 2 - 0.1, trim); W.scope({ lod: 1 }, () => { for (let k = -w / 2 + 0.3; k < w / 2; k += 0.25) W.box(0.04, 0.9, 0.04, k, 4.25, d / 2 - 0.1, trim); plasticChair(w / 4, 3.79, d / 2 - 1.0, Math.PI, trim); });
    W.box(w, 0.2, 0.03, 0, 6.45, d / 2 - 0.08, trim, { t: TX.louver }); W.box(w + 0.3, 0.12, 2.6, 0, 6.75, d / 2 - 1.0, roof, { layer: 'metal', rx: -0.16 });
  } else W.box(w + 0.3, 0.12, 2.6, 0, 3.4, d / 2 - 1.0, roof, { layer: 'metal', rx: -0.18 });
  W.pyramid(w + 0.8, F === 2 ? 2.4 : 2.0, d - 1.4, 0, 0.6 + H + (F === 2 ? 1.2 : 1.0), -1.1, roof, { t: TX.metal, layer: 'metal' });
  W.box(w + 0.6, 0.14, d - 1.6, 0, 0.6 + H + 0.07, -1.1, trim);
  // round the side: the rain cistern, the AC, a bicycle; a picket fence and gate on the lane
  W.scope({ lod: 2 }, () => {
    const sx = mchance(0.5) ? 1 : -1;
    W.cyl(0.65, 0.65, 1.6, sx * (w / 2 + 0.7), 0.8, bz - bd / 2 + 1.0, mpick([0x2a2c30, 0xd8d4c8]), { seg: 12 }); W.rod([sx * (w / 2 + 0.7), 1.6, bz - bd / 2 + 1.0], [sx * (w / 2 - 0.2), 0.6 + H, bz - bd / 2 + 1.0], 0.04, 0xd8d8d0);
    if (mchance(0.6)) acUnit(-sx * (w / 2 + 0.05), 2.2, bz, -sx * Math.PI / 2);
    if (mchance(0.35)) bicycle(sx * (w / 2 + 0.5), 0, d / 2 - 1.5, Math.PI / 2, mpick([0xe8604a, 0x2ab0d0, 0xf0c040]));
    if (o.fence !== false && mchance(0.55)) {
      for (const s2 of [-1, 1]) { W.box(w / 2 - 0.9, 0.06, 0.05, s2 * (w / 4 + 0.45), 0.85, d / 2 + 1.1, trim); W.box(w / 2 - 0.9, 0.06, 0.05, s2 * (w / 4 + 0.45), 0.45, d / 2 + 1.1, trim); }
      for (let k = -w / 2; k <= w / 2; k += 0.3) if (Math.abs(k) > 0.9) W.box(0.07, 1.0, 0.03, k, 0.5, d / 2 + 1.12, trim);
      W.box(0.08, 0.8, 0.08, 1.2, 0.7, d / 2 + 1.3, 0x8a6a4a); W.box(0.4, 0.26, 0.22, 1.2, 1.2, d / 2 + 1.3, mpick(ACCENT));   // the mailbox
    }
  });
  W.pop();
}
// an open white house: two stacked white planes, glass, a deck, an infinity pool, the living room open to the breeze
function whiteVilla(x, z, ry, big = false) {
  const w = big ? 26 : 18, d = big ? 16 : 12, H = 3.6;
  W.push(x, 0, z, ry);
  W.box(w + 6, 0.5, d + 8, 0, 0.25, 1, 0xf4f2ec, { t: TX.ceramic }); W.solid(w + 6, 0.5, d + 8, 0, 0.25, 1, 'stone', { walk: true });
  // ground floor: open on the sea side — columns, a back wall, sliding glass half open
  W.box(w, H, 0.4, 0, 0.5 + H / 2, -d / 2, 0xf8f8f4, { t: TX.plaster }); W.solid(w, H, 0.4, 0, 0.5 + H / 2, -d / 2, 'concrete');
  for (const s of [-1, 1]) { W.box(0.4, H, d * 0.5, s * w / 2, 0.5 + H / 2, -d / 4, 0xf8f8f4, { t: TX.plaster }); W.solid(0.4, H, d * 0.5, s * w / 2, 0.5 + H / 2, -d / 4, 'concrete'); }
  for (let k = -w / 2 + 2; k < w / 2; k += 4) { W.box(0.3, H, 0.3, k, 0.5 + H / 2, d / 2 - 0.2, 0xf8f8f4); W.solid(0.3, H, 0.3, k, 0.5 + H / 2, d / 2 - 0.2, 'concrete'); }
  W.box(w * 0.4, H - 0.4, 0.04, -w / 4, 0.5 + (H - 0.4) / 2, d / 2 - 0.5, 0xb8d8e0, { layer: 'glass' });
  // the entrance side: a tall pivot door, slot windows, wall lights, planters, the house name
  W.push(0, 0, -d / 2 - 0.2, Math.PI);
  bDoor(0, 0.5, 0, 'villa', 0x6a4a32, { w: 1.6, h: 2.8, oy: 0.55, fan: false, lamp: false });
  for (const k of [-w / 2 + 2.2, -w / 4, w / 4, w / 2 - 2.2]) { W.box(2.6, 0.5, 0.04, k, 3.0, 0.02, 0x9ac8d8, { layer: 'glass' }); W.box(0.12, 0.3, 0.1, k, 1.9, 0.06, 0xfff0c8, { layer: 'glow' }); }
  W.lamp(-1.4, 2.4, 0.8, 0xffd8a0, 1.2, 6, { halo: 0.4 }); W.lamp(1.4, 2.4, 0.8, 0xffd8a0, 1.2, 6, { halo: 0.4 });
  W.box(1.4, 0.3, 0.04, 2.4, 2.6, 0.03, 0x2a2a2a, { layer: 'metal' });
  W.scope({ lod: 1 }, () => { for (const s of [-1, 1]) { plantPot(s * 1.6, 0.5, 0.7, 'palm', 1.8); W.box(3.2, 0.6, 0.8, s * (w / 2 - 3), 0.8, 0.5, 0xf4f2ec, { t: TX.plaster }); bush(s * (w / 2 - 3), 1.2, 0.5, 0.9, 0x3a7a2a); for (let i = 0; i < 4; i++) W.sphere(0.25, 0.2, 0.25, s * (w / 2 - 3) + mr(-1.2, 1.2), 1.5, 0.5 + mr(-0.2, 0.2), mpick([0xe83a8a, 0xd84ab0, 0xf06aa0]), { seg: 6 }); } });
  W.pop();
  W.box(w + 2, 0.4, d + 2, 0, 0.5 + H + 0.2, 0, 0xf8f8f4, { t: TX.plaster }); W.solid(w + 2, 0.4, d + 2, 0, 0.5 + H + 0.2, 0, 'concrete', { walk: true });
  // upper box, pushed back and turned glassy to the sea
  const y2 = 0.5 + H + 0.4;
  W.box(w * 0.65, 3.2, d * 0.7, -w * 0.12, y2 + 1.6, -d * 0.12, 0xf8f8f4, { t: TX.plaster }); W.solid(w * 0.65, 3.2, d * 0.7, -w * 0.12, y2 + 1.6, -d * 0.12, 'concrete');
  W.box(w * 0.65 - 0.4, 2.6, 0.04, -w * 0.12, y2 + 1.5, -d * 0.12 + d * 0.35 + 0.02, 0x9ac8d8, { layer: 'glass' });
  W.box(w * 0.65 + 2.4, 0.3, d * 0.7 + 2.4, -w * 0.12, y2 + 3.35, -d * 0.12, 0xf8f8f4, { t: TX.plaster });
  W.box(w * 0.3, 1.0, 0.03, w * 0.32, y2 + 0.5, d / 2 + 0.9, 0xc8e0e8, { layer: 'glass' });   // glass balustrade on the roof terrace
  W.scope({ lod: 1 }, () => {   // a pergola and day beds on the roof terrace
    const px = w * 0.3, pz = d * 0.2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.box(0.18, 2.6, 0.18, px + sx * 2.4, y2 + 1.3, pz + sz * 2.0, 0xf8f8f4);
    for (let k = -2.4; k <= 2.4; k += 0.4) W.box(0.08, 0.14, 4.4, px + k, y2 + 2.65, pz, 0x8a6a4a, { t: TX.wood });
    for (const s of [-1, 1]) lounger(px + s * 1.0, y2, pz, 0);
  });
  // living room: sofas, rug, a long table, pendant lights; the deck, loungers, the pool lapping at its edge
  W.scope({ lod: 1 }, () => {
    for (const s of [-1, 1]) sofa(w / 6 + s * 2.2, 0.5, -d / 6, s * Math.PI / 2, 0xe8e4dc, 2.4); lowTable(w / 6, 0.5, -d / 6, 0, 1.4, 0.8); floorRug(w / 6, 0.52, -d / 6, 5, 4, 0, 0xd8d0c0);
    W.box(4, 0.08, 1.2, -w / 4, 1.25, -d / 4, 0x8a6a4a, { t: TX.wood }); for (let k = 0; k < 3; k++) { W.rod([-w / 4 - 1.2 + k * 1.2, 0.5 + H, -d / 4], [-w / 4 - 1.2 + k * 1.2, 2.8, -d / 4], 0.006, 0x1a1a1a); W.sphere(0.2, 0.2, 0.2, -w / 4 - 1.2 + k * 1.2, 2.7, -d / 4, 0xfff0d0, { layer: 'glow' }); }
    for (let k = 0; k < 4; k++) lounger(-w / 2 + 3 + k * 2.4, 0.5, d / 2 + 2.6, Math.PI);
    plantPot(w / 2 - 1, 0.5, d / 2 + 1, 'palm', 2.2); plantPot(-w / 2 + 1, 0.5, d / 2 + 1, 'palm', 2.2);
  });
  W.box(w * 0.7, 0.05, 3.4, w * 0.12, 0.47, d / 2 + 4.6, 0x3ac8e0, { layer: 'glass' }); W.box(w * 0.7 + 0.4, 0.5, 3.8, w * 0.12, 0.2, d / 2 + 4.6, 0xe8e4dc, { t: TX.ceramic });
  W.lamp(0, 3.2, 0, 0xfff0d8, 1.6, 12, { halo: 0 });
  W.pop();
}
function lounger(x, y, z, ry) { W.push(x, y, z, ry); W.box(0.7, 0.08, 1.9, 0, 0.32, 0, 0xf8f8f4); W.box(0.66, 0.08, 0.7, 0, 0.55, -0.75, 0xf8f8f4, { rx: 0.6 }); W.box(0.6, 0.05, 1.6, 0, 0.38, 0.1, mpick([0x2ab0d0, 0xf0f0ec, 0xe8604a, 0xf0c040]), { t: TX.fabric }); for (const sx of [-1, 1]) for (const sz of [-0.8, 0.8]) W.box(0.05, 0.3, 0.05, sx * 0.3, 0.15, sz, 0xd8d8d0); W.pop(); }
function umbrella(x, y, z, col = mpick([0xf0f0ec, 0x2ab0d0, 0xe8604a, 0xf0c040])) { W.rod([x, y, z], [x, y + 2.5, z], 0.03, 0xd8d8d0, { layer: 'metal' }); W.cone(1.5, 0.5, x, y + 2.5, z, col, { seg: 10, layer: 'cloth', t: TX.fabric }); }
function thatch(x, y, z, r, h) { W.cone(r, h, x, y + h / 2, z, 0xc8a868, { seg: 12, t: TX.fabric, wear: 6 }); W.cone(r * 1.02, 0.3, x, y + 0.1, z, 0xb89858, { seg: 12, t: TX.fabric }); }
function speedboat(x, z, ry, col = 0xf8f8f4) {
  W.push(x, WY + 0.05, z, ry);
  W.box(2.4, 0.9, 7, 0, 0.3, 0, col, { layer: 'metal' }); W.cone(1.25, 2.2, 0, 0.3, 4.4, col, { seg: 4, rx: Math.PI / 2, layer: 'metal' }); W.box(2.42, 0.12, 7, 0, 0.0, 0, 0x2a5aa0, { layer: 'metal' });
  W.box(1.8, 0.7, 1.2, 0, 1.0, 0.8, 0x9ac8d8, { layer: 'glass', rx: -0.4 }); W.box(1.6, 0.4, 2.2, 0, 0.9, -1.2, 0xe8e0d0, { t: TX.fabric }); W.box(0.4, 0.6, 0.4, 0, 0.6, -3.6, 0x1a1a1a);
  W.pop(); W.solid(2.4, 1.4, 8, x, WY + 0.5, z, 'metal', { ry });
}
function jetty(x0, z0, x1, z1, w = 3, y = 0.55) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
  W.push((x0 + x1) / 2, 0, (z0 + z1) / 2, ry);
  W.box(L, 0.18, w, 0, y, 0, 0xb89a72, { t: TX.wood, wear: 4 }); W.solid(L, 0.4, w, 0, y - 0.11, 0, 'wood', { walk: true });
  W.scope({ lod: 1 }, () => { for (let k = -L / 2; k <= L / 2; k += 3) for (const s of [-1, 1]) W.cyl(0.13, 0.13, 3, k, y - 1.5, s * (w / 2 - 0.1), 0x8a6a4a, { seg: 6 }); for (let k = -L / 2; k <= L / 2; k += 0.4) W.box(0.06, 0.02, w, k, y + 0.1, 0, 0x8a7050, { ao: false }); });
  W.pop();
}

// ---------------- the village and the harbour ----------------
function bahamasVillage() {
  const T = TOWN.lanes;
  for (const n of ['vA', 'vB', 'vC', 'vD']) for (const side of [-1, 1]) {
    const st = T[n];
    for (let s = 8; s < st.len - 6; s += mr(10, 14)) {
      const p = pathAt(st.pts, s), nx = -p.tz * side, nz = p.tx * side, w = mr(7, 10), d = mr(9, 12), cx = p.x + nx * (st.w / 2 + 1 + d / 2), cz = p.z + nz * (st.w / 2 + 1 + d / 2), ry = Math.atan2(-nx, -nz);
      if (!GR.free(cx, cz, w, d, ry, 0.5)) continue; GR.rect(cx, cz, w + 0.6, d + 0.6, ry, GR.BUILT);
      cottageB(cx, cz, ry, w, d, mchance(0.3) ? 2 : 1);
      W.scope({ lod: 1 }, () => { if (mchance(0.6)) palm(cx + nx * (d / 2 + 2) + mr(-3, 3), 0, cz + nz * (d / 2 + 2) + mr(-3, 3), mr(6, 9)); });
    }
  }
  // the church: white, a square tower, the bell
  W.box(10, 7, 18, -60, 3.5, -72, 0xf8f8f4, { t: TX.plaster }); W.solid(10, 7, 18, -60, 3.5, -72, 'concrete'); W.pyramid(11, 4, 19, -60, 9, -72, 0xc84a3a, { layer: 'metal' });
  W.box(4, 13, 4, -60, 6.5, -61.5, 0xf8f8f4, { t: TX.plaster }); W.pyramid(4.6, 4, 4.6, -60, 15, -61.5, 0xc84a3a, { layer: 'metal' }); W.push(-60, 0, -59.5, 0); bDoor(0, 0, 0, 'chapel', 0x5ab0b0, { w: 1.8, h: 2.5, fan: false }); W.pop();
  for (let k = 0; k < 3; k++) W.box(1.0, 2.6, 0.05, -64.97, 3.6, -76 + k * 4, 0xd8e8f0, { layer: 'glow', ry: Math.PI / 2 }); GR.rect(-60, -70, 12, 24, 0, GR.BUILT);
  // harbour: a stone quay, jetties, fishing boats, conch shacks, the straw market
  W.box(130, 1.2, 6, -85, -0.1, -138, 0xd8ccb0, { t: TX.stone }); W.solid(130, 1.2, 6, -85, -0.1, -138, 'stone', { walk: true });
  for (const x of [-140, -100, -60]) jetty(x, -140, x, -170, 2.6);
  W.scope({ lod: 1 }, () => { for (const [x, z, r] of [[-134, -156, 0], [-106, -160, 0], [-94, -150, 0.2], [-66, -162, -0.1], [-54, -152, 0.1], [-120, -175, 1.4]]) fishingBoat(x, z, r, 6.5, { y: WY - 0.4 }); });
  const SHACKS = ['CONCH SALAD', 'FRY FISH', 'MISS LOU’S', 'CRACK CONCH', 'GOOMBAY', 'ERROL’S CATCH'];
  for (let k = 0; k < 6; k++) {
    const x = -146 + k * 16, z = -118, c = mpick(PASTEL), a = mpick(ACCENT);
    W.box(5, 2.8, 4, x, 1.4, z, c, { t: TX.wood }); W.solid(5, 2.8, 4, x, 1.4, z, 'wood');
    W.box(4.2, 1.1, 0.04, x, 1.75, z + 2.01, 0x2a2420);   // the serving hatch
    W.box(5.8, 0.1, 5.0, x, 2.9, z + 0.5, a, { layer: 'metal', rx: -0.1 }); W.box(4.4, 0.9, 0.6, x, 0.6, z + 2.3, 0xc8a878, { t: TX.wood }); W.solid(4.4, 1.0, 0.6, x, 0.5, z + 2.3, 'wood');
    for (let i = 0; i < 7; i++) W.sphere(0.18, 0.1, 0.12, x - 1.5 + i * 0.5, 1.12, z + 2.3, mpick([0xf0b0a0, 0xf8d0c0, 0xe89a8a]), { seg: 6 });
    NEONish(SHACKS[k], x, 2.55, z + 2.06, 3.6, 0.5);
    W.push(x - 2.5, 0, z, -Math.PI / 2); bDoor(0, 0, 0, 'shack', a, { w: 0.9, h: 2.1, fan: false }); W.pop();
    W.scope({ lod: 1 }, () => { for (const dx of [-1.4, 1.4]) { plasticTable(x + dx, 0, z + 4.2, 0, mpick([0xf8f8f4, 0x2ab0d0])); for (const q of [-0.7, 0.7]) plasticChair(x + dx + q, 0, z + 4.2, q > 0 ? -Math.PI / 2 : Math.PI / 2, 0xf8f8f4); } cooler(x + 2.0, 0, z + 2.9, 0, 0x2ab0d0); });
  }
  for (let i = 0; i < 8; i++) marketStall(-14 + (i % 4) * 8, -122 + Math.floor(i / 4) * 10, 0, mpick(['fabric', 'produce', 'fabric']));
  // the lighthouse on the east point
  const LX = 240, LZ = -10;
  for (let k = 0; k < 6; k++) W.cyl(2.4 - k * 0.16, 2.4 - (k + 1) * 0.16, 3, LX, 1.5 + k * 3, LZ, k % 2 ? 0xd83a2a : 0xf8f8f4, { seg: 16 });
  W.cyl(1.7, 1.7, 2.2, LX, 19.1, LZ, 0x9ac8d8, { layer: 'glass', seg: 12 }); W.cone(2.0, 1.8, LX, 21.1, LZ, 0x2a2a2a, { seg: 12, layer: 'metal' }); W.sphere(0.8, 0.8, 0.8, LX, 19.1, LZ, 0xfff8d0, { layer: 'glow' });
  W.solid(4.8, 22, 4.8, LX, 11, LZ, 'stone'); cottageB(LX - 9, LZ + 6, Math.PI / 2, 7, 8, 1, 0xf8f8f4, { fence: false });
  TOWN.spots.harbour = { x: -100, z: -128 }; TOWN.spots.harbourJetty = { x: -100, y: 0.55, z: -164 }; TOWN.spots.shacks = { x: -114, z: -112 };
  TOWN.spots.market = { x: -2, z: -110 }; TOWN.spots.lighthouse = { x: 240, z: -10 }; TOWN.spots.pierEnd = { x: 0, y: 0.85, z: 266 };
}

// ---------------- the resort ----------------
function bahamasResort() {
  // the hotel: a long white block of four floors, every room with a glass balcony to the sea
  const HX = 0, HZ = 66, HW = 130, HD = 16, FLR = 3.4, NF = 4, HH = FLR * NF;
  W.box(HW, HH, HD, HX, HH / 2, HZ, 0xf8f8f4, { t: TX.plaster }); W.solid(HW, HH, HD, HX, HH / 2, HZ, 'concrete'); GR.rect(HX, HZ, HW + 2, HD + 2, 0, GR.BUILT);
  for (let f = 0; f < NF; f++) for (let x = -HW / 2 + 2.5; x < HW / 2; x += 5) {
    if (f === 0 && Math.abs(x) < 10) continue;
    if (f === 0 && [17.5, 37.5, 57.5].includes(Math.abs(x))) { bDoor(HX + x, 0, HZ + HD / 2, 'suite', 0x2ab0b0, { w: 1.1, h: 2.3, name: `ROOM ${101 + Math.round((x + 62.5) / 5)}` }); W.box(2.2, 0.08, 1.2, HX + x, 2.95, HZ + HD / 2 + 0.6, 0x2ab0b0, { layer: 'cloth' }); continue; }
    const y = f * FLR, lit = mchance(0.3);
    W.box(4.2, 2.6, 0.05, HX + x, y + 1.6, HZ + HD / 2 + 0.02, lit ? 0xf0dcb0 : 0x6a9ab0, { layer: lit ? 'glow' : 'glass' });
    W.scope({ lod: 1 }, () => { for (const k of [-2.1, 0, 2.1]) W.box(0.1, 2.6, 0.08, HX + x + k, y + 1.6, HZ + HD / 2 + 0.06, 0xe8e8e4, { layer: 'metal' }); W.box(4.3, 0.1, 0.08, HX + x, y + 2.92, HZ + HD / 2 + 0.06, 0xe8e8e4, { layer: 'metal' }); for (const s of [-1, 1]) W.box(0.7, 2.4, 0.03, HX + x + s * 1.6, y + 1.6, HZ + HD / 2 + 0.0, mpick([0xf0e8d8, 0x2ab0b0, 0xe8e0d0]), { layer: 'cloth' }); });
    if (f > 0) { W.box(4.6, 0.18, 1.6, HX + x, y + 0.1, HZ + HD / 2 + 0.8, 0xf8f8f4); W.box(4.6, 1.0, 0.03, HX + x, y + 0.7, HZ + HD / 2 + 1.6, 0xc8e0e8, { layer: 'glass' }); W.scope({ lod: 2 }, () => { lounger(HX + x - 1, y + 0.18, HZ + HD / 2 + 0.9, -Math.PI / 2); }); }
  }
  for (let k = 0; k <= NF; k++) W.box(HW + 0.6, 0.25, 0.4, HX, k * FLR, HZ + HD / 2 + 0.1, 0x2ab0b0);
  W.box(HW + 2, 0.6, HD + 2, HX, HH + 0.3, HZ, 0xf8f8f4); NEONish('THE CORAL BAY RESORT', HX, HH + 1.7, HZ + HD / 2 + 0.4, 22, 1.8);
  // the lobby: an open pavilion under a great thatch, the reception, a fountain
  W.box(22, 0.4, 14, HX, 0.2, HZ + HD / 2 + 7, 0xf0ece4, { t: TX.ceramic }); W.solid(22, 0.4, 14, HX, 0.2, HZ + HD / 2 + 7, 'stone', { walk: true });
  for (const [x, z] of [[-10, 2], [10, 2], [-10, 12], [10, 12]]) { W.cyl(0.3, 0.35, 6, HX + x, 3.4, HZ + HD / 2 + z, 0x8a6a4a, { seg: 8 }); W.solid(0.7, 6, 0.7, HX + x, 3, HZ + HD / 2 + z, 'wood'); }
  W.pyramid(26, 6, 17, HX, 9.2, HZ + HD / 2 + 7, 0xc8a868, { t: TX.fabric, wear: 6 });
  counter(HX, 0.4, HZ + HD / 2 + 2.5, 0, 5, 0x8a6a4a, 0xe8e4dc); fountain(HX, 0.4, HZ + HD / 2 + 9, 1.6, 2);
  TOWN.staff.push({ x: HX - 1, z: HZ + HD / 2 + 1.7, y: 0.4, yaw: Math.PI, role: 'shop' }, { x: HX + 1.2, z: HZ + HD / 2 + 1.7, y: 0.4, yaw: Math.PI, role: 'shop' });
  // the pool deck: three pools in a row, a swim-up bar, loungers in lines, umbrellas
  for (const [x, w, d] of [[-38, 26, 10], [0, 30, 12], [38, 26, 10]]) { W.box(w, 0.06, d, x, 0.05, 97, 0x3acce0, { layer: 'glass' }); W.box(w + 0.6, 0.2, d + 0.6, x, -0.02, 97, 0xe8e4dc, { t: TX.ceramic }); W.lamp(x, 0.3, 97, 0x6ad8ff, 1.4, 10, { halo: 0 }); }
  thatch(0, 0, 97, 3.4, 2.8); W.cyl(2.2, 2.2, 1.1, 0, 0.55, 97, 0x8a6a4a, { seg: 12, t: TX.wood }); W.solid(4.4, 1.1, 4.4, 0, 0.55, 97, 'wood');
  W.scope({ lod: 1 }, () => { for (let x = -56; x <= 56; x += 2.6) if (Math.abs(x) > 4) { lounger(x, 0, 90.5, 0); lounger(x, 0, 104, Math.PI); if (Math.round(x / 2.6) % 3 === 0) { umbrella(x + 1.3, 0, 90.5); umbrella(x + 1.3, 0, 104); } } });
  // the beach: umbrellas and loungers in rows, cabanas, the beach bar, a lifeguard tower, volleyball
  W.scope({ lod: 1 }, () => {
    for (let x = -100; x <= 100; x += 7) for (const z of [116, 124]) { if (Math.abs(x - 55) < 10 || Math.abs(x + 40) < 6) continue; umbrella(x, islandH(x, z), z); lounger(x - 1, islandH(x, z), z + 1.2, 0); lounger(x + 1, islandH(x, z), z + 1.2, 0); }
    for (const x of [-90, -70, 80, 96]) { const y = islandH(x, 112); for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.rod([x + sx * 1.4, y, 112 + sz * 1.4], [x + sx * 1.4, y + 2.6, 112 + sz * 1.4], 0.05, 0xf8f8f4); W.box(3.2, 0.1, 3.2, x, y + 2.65, 112, 0xf8f8f4, { layer: 'cloth', t: TX.fabric }); for (const sx of [-1, 1]) W.box(0.03, 2.4, 2.8, x + sx * 1.42, y + 1.3, 112, 0xfaf8f0, { layer: 'cloth', t: TX.fabric }); W.box(2.2, 0.4, 2.2, x, y + 0.3, 112, 0xf0ece4, { t: TX.fabric }); }
    const ly = islandH(20, 128); for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.rod([20 + sx * 0.8, ly, 128 + sz * 0.8], [20 + sx * 0.6, ly + 2.4, 128 + sz * 0.6], 0.06, 0xf8f8f4); W.box(1.8, 1.2, 1.8, 20, ly + 3.0, 128, 0xe83a3a); W.box(2.2, 0.1, 2.2, 20, ly + 3.7, 128, 0xf8f8f4);
    W.rod([-20, islandH(-20, 120), 120], [-20, 2.4, 120], 0.05, 0xf8f8f4); W.rod([-20, islandH(-20, 130), 130], [-20, 2.4, 130], 0.05, 0xf8f8f4); W.box(0.02, 0.8, 10, -20, 2.0, 125, 0xf8f8f4, { layer: 'cloth' });
  });
  const bx = 55, bz = 118, by = islandH(bx, bz);
  W.box(10, 0.4, 7, bx, by + 0.2, bz, 0xb89a72, { t: TX.wood }); W.solid(10, 0.4, 7, bx, by + 0.2, bz, 'wood', { walk: true });
  W.box(6, 1.1, 1.0, bx, by + 0.95, bz - 1.5, 0x8a6a4a, { t: TX.wood }); W.solid(6, 1.1, 1.0, bx, by + 0.95, bz - 1.5, 'wood');
  for (let k = 0; k < 14; k++) W.cyl(0.04, 0.04, 0.26, bx - 2.6 + k * 0.4, by + 1.62, bz - 1.5, mpick([0xf0c040, 0x2ab0d0, 0xe8604a, 0x8ad86a]), { seg: 6, layer: 'glass' });
  for (const [x, z] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) W.rod([bx + x, by + 0.4, bz + z], [bx + x, by + 3.2, bz + z], 0.12, 0x8a6a4a);
  W.pyramid(11, 2.6, 8.5, bx, by + 4.4, bz, 0xc8a868, { t: TX.fabric, wear: 6 });
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) stool(bx - 2 + k * 2, by + 0.4, bz - 0.5, 0x2ab0d0);
  NEONish('CONCH BAR', bx, by + 3.4, bz + 3.6, 5, 0.7);
  TOWN.staff.push({ x: bx, z: bz - 2.3, y: by + 0.4, yaw: 0, role: 'bar' });
  TOWN.spots.beachBar = { x: bx, y: by + 0.4, z: bz + 0.2 };
  // the overwater bungalows: a long boardwalk out into the lagoon, thatched huts on stilts either side
  jetty(0, 132, 0, 262, 3.2, 0.75);
  for (let k = 0; k < 10; k++) for (const s of [-1, 1]) {
    const z = 150 + k * 11, x = s * 9;
    jetty(s * 1.6, z, s * 4.5, z, 1.6, 0.75);
    W.box(8, 0.3, 8, x, 0.7, z, 0xb89a72, { t: TX.wood }); W.solid(8, 0.5, 8, x, 0.6, z, 'wood', { walk: true });
    W.scope({ lod: 1 }, () => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.cyl(0.18, 0.18, 3.6, x + sx * 3.6, -1.1, z + sz * 3.6, 0x6a5040, { seg: 6 }); });
    W.box(6, 3, 5, x, 2.35, z - 0.5, 0xf8f4e8, { t: TX.wood }); W.solid(6, 3, 5, x, 2.35, z - 0.5, 'wood');
    W.box(4, 2.2, 0.04, x - s * 0, 2.0, z + 2.02, 0x9ac8d8, { layer: 'glass' }); W.pyramid(8.4, 3.2, 7.4, x, 5.4, z - 0.5, 0xc8a868, { t: TX.fabric, wear: 6 });
    W.push(x - s * 3, 0, z - 0.5, -s * Math.PI / 2); bDoor(0, 0.85, 0, 'bungalow', 0xc8a878, { w: 0.9, h: 2.0, oy: 0.9, fan: false, name: `BUNGALOW ${k * 2 + (s > 0 ? 2 : 1)}` }); W.pop();
    W.scope({ lod: 1 }, () => { W.box(6.1, 0.12, 0.1, x, 1.0, z + 2.0, 0xf8f4e8); W.box(6.1, 0.18, 0.1, x, 3.8, z + 2.0, 0xf8f4e8); for (const sx of [-1, 1]) W.box(0.5, 2.0, 0.05, x + sx * 2.4, 2.0, z + 2.04, 0xc8a878, { t: TX.louver }); });
    W.scope({ lod: 2 }, () => { lounger(x + s * 2.6, 0.85, z + 2.4, s * Math.PI / 2); W.rod([x + s * 3.9, 0.85, z + 2], [x + s * 4.3, -1.2, z + 2], 0.03, 0xd8d8d0, { layer: 'metal' }); });
  }
  W.box(14, 0.3, 10, 0, 0.7, 268, 0xb89a72, { t: TX.wood }); W.solid(14, 0.5, 10, 0, 0.6, 268, 'wood', { walk: true }); thatch(0, 0.85, 268, 5, 3.4);
  for (let k = 0; k < 4; k++) { W.cyl(0.35, 0.35, 0.04, -4 + k * 2.6, 1.6, 268, 0xf0ece4, { seg: 10 }); W.cyl(0.04, 0.04, 0.8, -4 + k * 2.6, 1.2, 268, 0x8a6a4a); }
  // the jetski rental dock
  jetty(-40, 132, -40, 172, 3, 0.55); jetty(-50, 160, -30, 160, 2.4, 0.55);
  W.box(3, 2.4, 2.4, -40, 1.75, 136, 0xf0c040, { t: TX.wood }); W.solid(3, 2.4, 2.4, -40, 1.75, 136, 'wood'); NEONish('JETSKI RENTAL', -40, 3.4, 137.3, 3.2, 0.5);
  TOWN.staff.push({ x: -38.5, z: 138.4, y: 0.55, yaw: 0, role: 'shop' });
  TOWN.spots.rental = { x: -40, y: 0.6, z: 160 };
}
// painted signboards (lit at the edges by the sun, not neon)
function NEONish(text, x, y, z, w, h) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.max(32, Math.round(512 * h / w)); const g = cv.getContext('2d');
  g.fillStyle = '#f8f6ee'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#1a7a8a'; g.font = `700 ${Math.round(cv.height * 0.62)}px Rajdhani, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; const tw = g.measureText(text).width; if (tw > cv.width * 0.92) g.font = `700 ${Math.floor(cv.height * 0.62 * cv.width * 0.92 / tw)}px Rajdhani, system-ui, sans-serif`; g.fillText(text, cv.width / 2, cv.height / 2 + 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  m.position.copy(W.worldPos(x, y, z)); m.rotation.y = W.worldRotY(); scene.add(m);
}

// ---------------- villas along both coasts ----------------
function bahamasVillas() {
  const spots = [[220, -60, Math.PI / 2], [222, 40, Math.PI / 2], [190, 92, 0.6], [-222, -50, -Math.PI / 2], [-224, 30, -Math.PI / 2], [-180, 96, -0.5], [150, -104, Math.PI], [150, 108, 0], [-150, 106, 0]];
  for (const [x, z, ry] of spots) { if (!GR.free(x, z, 22, 18, ry, 0)) continue; GR.rect(x, z, 26, 22, ry, GR.BUILT); whiteVilla(x, z, ry); W.scope({ lod: 1 }, () => { for (let k = 0; k < 5; k++) palm(x + mr(-14, 14), 0, z + mr(-12, 12), mr(7, 11)); }); }
}

// ---------------- the private island: the money man's house, his dock, his men ----------------
function bahamasPrivate() {
  const X = 380, Z = -250;
  whiteVilla(X, Z, -Math.PI / 2 + 0.3, true); GR.rect(X, Z, 36, 30, -Math.PI / 2 + 0.3, GR.BUILT);
  // the office inside: a desk, the laptop that matters, a safe, the view
  W.push(X, 0, Z, -Math.PI / 2 + 0.3);
  desk(-6, 0.5, -3, 0, 2.2, 1.0, 0x3a2a1a); laptop(-6, 1.28, -3, Math.PI); chairOffice(-6, 0.5, -4.2, 0); safe(-10, 0.5, -6.6, 0);
  const lp = W.worldPos(-6, 1.3, -3); TOWN.spots.laptop = { x: lp.x, y: 0.5, z: lp.z };
  const kt = W.worldPos(4, 0.5, 13); TOWN.spots.kaneTerrace = { x: kt.x, y: 0.5, z: kt.z };   // the terrace by the pool, where Kane takes his calls
  W.pop();
  W.cyl(9, 9, 0.12, X + 30, 0.07, Z + 26, 0x4a4a4c, { seg: 24, t: TX.concrete }); W.box(1.2, 0.02, 7, X + 27, 0.14, Z + 26, 0xf0f0e8, { ao: false }); W.box(1.2, 0.02, 7, X + 33, 0.14, Z + 26, 0xf0f0e8, { ao: false }); W.box(4.8, 0.02, 1.2, X + 30, 0.14, Z + 26, 0xf0f0e8, { ao: false });
  helicopter(X + 30, Z + 26, 0.4);
  // the dock facing the main island, with the boats
  jetty(X - 92, Z, X - 70, Z, 4, 0.55); jetty(X - 92, Z - 18, X - 92, Z + 18, 3, 0.55);
  speedboat(X - 100, Z - 9, Math.PI / 2, 0x1a1a1a); speedboat(X - 100, Z + 10, Math.PI / 2, 0xf8f8f4);
  W.box(3, 2.6, 3, X - 74, 1.85, Z - 4, 0xf8f8f4, { t: TX.plaster }); W.solid(3, 2.6, 3, X - 74, 1.85, Z - 4, 'concrete');
  // a low white wall round the house, gate on the dock path
  for (const [a, b] of [[[X - 30, Z - 26], [X + 40, Z - 26]], [[X + 40, Z - 26], [X + 40, Z + 40]], [[X - 30, Z + 40], [X + 40, Z + 40]], [[X - 30, Z - 26], [X - 30, Z - 4]], [[X - 30, Z + 4], [X - 30, Z + 40]]]) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    W.push((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, ry); W.box(L, 2.2, 0.4, 0, 1.1, 0, 0xf8f8f4, { t: TX.plaster }); W.solid(L, 2.2, 0.4, 0, 1.1, 0, 'concrete'); W.pop();
  }
  lane('privPath', [[X - 70, Z], [X - 22, Z]], 4, 'alley', { tx: TX.gravel, col: 0xe8dcc0 });
  W.scope({ lod: 1 }, () => { for (let k = 0; k < 40; k++) { const a = mr(0, 6.28), r = mr(42, 70), x = X + Math.cos(a) * r, z = Z + Math.sin(a) * r * 0.7; if (islandSD(x, z) < -6) palm(x, 0, z, mr(7, 11)); } });
  TOWN.spots.privateDock = { x: X - 80, y: 0.6, z: Z };
  TOWN.restricted.push({ x0: X - 100, z0: Z - 70, x1: X + 90, z1: Z + 60 });
}

// ---------------- nature: palm forests, sea grape, the cay and its seaplane, the reef ----------------
function bahamasNature() {
  // palms: dense forest over the free interior, a line leaning over every beach
  let n = 0;
  for (let i = 0; i < 2600 && n < 1100; i++) {
    const x = mr(-250, 250), z = mr(-135, 135), sd = islandSD(x, z), g = GR.get(x, z);
    if (sd > -4 || g !== GR.FREE) continue;
    const forest = fbm(x * 0.02, z * 0.02 + 5) > 0.45 || sd > -34;
    if (!forest && mchance(0.75)) continue;
    n++; W.scope({ lod: sd > -34 ? 0 : 1 }, () => palm(x, 0, z, mr(6, 12)));
    if (mchance(0.25)) W.scope({ lod: 2 }, () => bush(x + mr(-2, 2), 0, z + mr(-2, 2), mr(0.8, 1.4), mpick([0x3a6a2a, 0x4a7a3a, 0x5a8a3a])));
  }
  // the cay: a sandbank, a dozen palms, a hammock, the seaplane riding at anchor off its west side
  for (let k = 0; k < 12; k++) { const a = mr(0, 6.28), r = mr(2, 18); palm(-360 + Math.cos(a) * r, 0, 262 + Math.sin(a) * r * 0.7, mr(6, 10)); }
  W.cable([-364, 1.6, 258], [-356, 1.6, 264], 0.6, 0.15, 0xf0e0c0, 8);
  const PX = -405, PZ = 270;
  W.push(PX, WY, PZ, 0.4);
  for (const s of [-1, 1]) { W.box(0.6, 0.6, 6.5, s * 1.6, 0.25, 0, 0xf8f8f4, { layer: 'metal' }); W.rod([s * 1.6, 0.5, 1.4], [s * 0.4, 1.6, 1.0], 0.05, 0x8a8e94); W.rod([s * 1.6, 0.5, -1.2], [s * 0.4, 1.6, -0.8], 0.05, 0x8a8e94); }
  W.box(1.4, 1.5, 7, 0, 2.2, 0, 0xf8f8f4, { layer: 'metal' }); W.box(1.2, 0.6, 1.4, 0, 2.8, 2.4, 0x6a9ab0, { layer: 'glass' }); W.box(12, 0.12, 1.6, 0, 3.1, 0.6, 0xf8f8f4, { layer: 'metal' });
  W.box(0.1, 1.6, 1.2, 0, 3.2, -3.4, 0x2ab0d0, { layer: 'metal' }); W.box(3.6, 0.1, 1.0, 0, 2.6, -3.4, 0xf8f8f4, { layer: 'metal' }); W.cyl(0.25, 0.25, 0.6, 0, 2.2, 3.7, 0x2a2a2a, { rx: Math.PI / 2, seg: 8 }); W.box(0.1, 2.0, 0.16, 0, 2.2, 4.05, 0x2a2a2a);
  W.box(1.42, 0.2, 7.02, 0, 1.9, 0, 0x2ab0d0, { layer: 'metal' });
  W.pop(); W.solid(4, 3, 7, PX, WY + 1.5, PZ, 'metal');
  TOWN.spots.seaplane = { x: PX + 4, z: PZ };
  // buoys marking the channel, some moored yachts
  W.scope({ lod: 1 }, () => {
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, x = Math.cos(a) * 330, z = Math.sin(a) * 195; W.cyl(0.3, 0.4, 1.0, x, WY + 0.3, z, k % 2 ? 0xd83a2a : 0x2a8a3a, { seg: 8, layer: 'metal' }); }
    for (const [x, z, r] of [[120, 190, 0.3], [-150, 205, -0.4], [240, 150, 1.2]]) { speedboat(x, z, r, 0xf8f8f4); W.rod([x, WY + 1.2, z], [x, WY + 12, z], 0.06, 0xd8d8d0, { layer: 'metal' }); }
  });
}

// ---------------- security: marine guards on the docks, the beach, the private island; patrol boats ----------------
function bahamasSecurity() {
  const post = (x, z, yaw) => TOWN.guards.push({ x, z, yaw, team: 'red' });
  for (const [x, z, y] of [[-24, 74 + 18, Math.PI], [24, 92, Math.PI], [-60, 110, 0], [60, 110, 0], [0, 140, 0], [-100, -132, 0], [-30, -132, 0], [235, 0, Math.PI / 2], [-40, 132, Math.PI]]) post(x, z, y);
  const X = 380, Z = -250;
  for (const [dx, dz, y] of [[-78, -3, -Math.PI / 2], [-78, 3, -Math.PI / 2], [-32, -2, -Math.PI / 2], [-32, 6, -Math.PI / 2], [0, -20, 0], [20, 34, Math.PI], [30, 26, 0.6], [-10, 30, Math.PI], [36, -20, Math.PI / 2], [12, 8, 0]]) post(X + dx, Z + dz, y);
}
// patrol boats circling the private island and the lagoon; they spot you on the water
const PATROL = (() => {
  if (MAP.id !== 'bahamas') return { update() { } };
  const boats = []; let built = false, warned = 0;
  function build() {
    built = true;
    for (const [cx, cz, r, rz, sp, ph] of [[380, -250, 125, 95, 0.05, 0], [380, -250, 140, 110, -0.04, 2], [0, 210, 150, 40, 0.035, 1]]) {
      const g = new THREE.Group(), m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3 });
      M(new THREE.BoxGeometry(2.4, 1.0, 7), m(0x2a3a4a), g, 0, 0.4, 0); M(new THREE.ConeGeometry(1.25, 2.2, 4).rotateX(Math.PI / 2), m(0x2a3a4a), g, 0, 0.4, 4.4); M(new THREE.BoxGeometry(1.8, 1.2, 2), m(0xe8e8e0), g, 0, 1.4, 0.4);
      M(new THREE.BoxGeometry(0.15, 0.8, 0.15), m(0x1a1a1a), g, 0, 2.4, 0.4); M(new THREE.BoxGeometry(0.5, 0.25, 0.25), new THREE.MeshBasicMaterial({ color: 0x3a8aff }), g, 0, 2.9, 0.4);
      M(new THREE.BoxGeometry(2.6, 0.2, 0.4), m(0xd8a020), g, 0, 0.9, -1.2);
      scene.add(g); boats.push({ g, cx, cz, r, rz, sp, a: ph });
    }
  }
  return {
    update(dt, t) {
      if (!MAP.ready) return; if (!built) build();
      for (const b of boats) {
        b.a += b.sp * dt; const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.rz, tx = -Math.sin(b.a) * b.r * Math.sign(b.sp), tz = Math.cos(b.a) * b.rz * Math.sign(b.sp);
        b.g.position.set(x, WY + waveH(x, z, t) * 0.8, z); b.g.rotation.set(0, Math.atan2(tx, tz), Math.sin(t * 1.3 + b.a) * 0.04);
        // close enough on the water, out of disguise: they radio it in
        if (P.vehicle && Math.hypot(P.pos.x - x, P.pos.z - z) < 30 && DISGUISE.level() < 0.5 && t - warned > 20) { warned = t; feed('<span class="m">PATROL BOAT — THEY’VE SEEN YOU</span>'); BOTS.setPressure(2); audio.horn(); }
      }
    },
  };
})();

// ---------------- rooms behind the doors ----------------
// Same machinery as the other maps (roomShell, ROOMS, DOORS): every kind of door has its own furnished room out
// past the edge of the sea, with people in it and a stash (E).
const RATTAN = 0xc8a060;
function sunWindow(x, z, ry, w = 1.4, h = 1.2, y = 1.6, cur = 0x2ab0d0) {   // a bright window with curtains, on a wall facing +z in its frame
  W.push(x, 0, z, ry); W.box(w, h, 0.04, 0, y, 0, 0xc8ecf8, { layer: 'glow' }); W.box(w + 0.2, 0.1, 0.1, 0, y + h / 2 + 0.05, 0.04, 0xf8f8f4); W.box(w + 0.2, 0.1, 0.16, 0, y - h / 2 - 0.05, 0.06, 0xf8f8f4);
  W.box(0.05, h, 0.03, 0, y, 0.03, 0xf8f8f4); for (const s of [-1, 1]) W.box(0.34, h + 0.5, 0.04, s * (w / 2 + 0.2), y - 0.1, 0.1, cur, { layer: 'cloth' }); W.rod([-w / 2 - 0.45, y + h / 2 + 0.2, 0.12], [w / 2 + 0.45, y + h / 2 + 0.2, 0.12], 0.015, 0x8a6a4a); W.pop();
}
function pew(x, z, len) { W.box(len, 0.07, 0.42, x, 0.45, z, 0x6a4a2a, { t: TX.wood }); W.box(len, 0.5, 0.06, x, 0.78, z + 0.22, 0x6a4a2a, { t: TX.wood }); for (const s of [-1, 1]) W.box(0.06, 0.95, 0.5, x + s * len / 2, 0.47, z + 0.04, 0x5a3a20, { t: TX.wood }); W.solid(len, 0.95, 0.6, x, 0.47, z + 0.04, 'wood'); }
function diningTable(x, z, len, col = 0x8a6a4a, chair = (cx, cz, r) => plasticChair(cx, 0, cz, r, 0xf8f8f4)) {
  W.box(len, 0.06, 1.0, x, 0.76, z, col, { t: TX.wood }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.box(0.07, 0.74, 0.07, x + sx * (len / 2 - 0.1), 0.37, z + sz * 0.42, shade(col, 0.8)); W.solid(len, 0.8, 1.0, x, 0.4, z, 'wood');
  for (let k = -len / 2 + 0.5; k < len / 2; k += 0.8) for (const s of [-1, 1]) chair(x + k, z + s * 0.8, s > 0 ? Math.PI : 0);
}
function bahamasInteriors() {
  Object.assign(ROOM_ROW, { z: 640, x: { cottage: -300, homestead: -200, villa: -100, suite: 0, bungalow: 100, shack: 200, chapel: 300 } });
  // ---- an island cottage: the front room, the kitchen corner, the bed under the window ----
  {
    const Wd = 10, D = 8, H = 3.0;
    roomShell('cottage', Wd, D, H, { name: '', en: 'an island cottage', floor: 0xc8a878, wall: 0xf4ecd8, ceil: 0xf0ece4, door: 0x2ab0b0 });
    W.box(Wd, 0.9, 0.03, 0, 0.45, -3.98, 0x7ac8c8, { t: TX.wood }); for (const s of [-1, 1]) W.box(0.03, 0.9, D, s * 4.98, 0.45, 0, 0x7ac8c8, { t: TX.wood });   // painted wainscot
    for (let k = -4; k <= 4; k += 1.6) W.box(0.14, 0.14, D, k, H - 0.08, 0, 0xd8c8a8, { t: TX.wood });   // ceiling beams
    sofa(-2.6, 0, -2.6, 0, 0x2ab0d0, 2.2); lowTable(-2.6, 0, -1.4, 0, 1.2, 0.6); fruitBowl(-2.6, 0.32, -1.4); ceilingFan(-2.6, H - 0.1, -1.4);
    kitchenRun(3.8, 0, -3.5, 0, 2.4, 0xf0f0ec); fridge(4.6, 0, 0.4, -Math.PI / 2); bistroTable(2.4, 0, 1.6, 2, 0x2ab0b0); kettle(3.2, 0.92, -3.6); wallPlates(3.8, 1.9, -3.95, 0, 4);
    bed(-3.4, 0, 2.2, Math.PI / 2, 0xf0c040); nightstand(-4.6, 0, 3.4, Math.PI / 2); transistorRadio(-4.6, 0.56, 3.4, Math.PI / 2); wardrobe(-1.9, 0, 3.6, Math.PI);
    sunWindow(0, -3.96, 0, 1.4, 1.0); sunWindow(-4.96, -0.4, Math.PI / 2, 1.2, 1.1, 1.6, 0xf0c040); sunWindow(4.96, -1.6, -Math.PI / 2, 1.2, 1.1, 1.6, 0xe8604a);
    framedPhoto(-3.4, 1.8, -3.94, 0, 0.4, 0.3); framedPhoto(-2.2, 1.95, -3.94, 0, 0.3, 0.4); wallClock(1.6, 2.3, -3.94, 0); guitar(1.0, 0, -3.7, 0);
    floorRug(-1, 0.03, -0.6, 3.6, 2.4, 0, 0x2a8ab0); plantPot(4.4, 0, 3.4, 'palm', 1.8); W.lamp(0, 2.4, 0, 0xfff0d8, 1.6, 9, { halo: 0 });
    LOOT.spot('cottage', 3.6, 0.92, -3.5, 'cash');
    staffAt(-1.2, -2.6, Math.PI, 'home');
    W.pop();
  }
  // ---- a family house: the big table, the TV, grandmother's sewing, the stairs going up ----
  {
    const Wd = 12, D = 9, H = 3.1;
    roomShell('homestead', Wd, D, H, { name: '', en: 'a family house', floor: 0xb89a6a, wall: 0xf0e4c8, ceil: 0xf0ece4, door: 0xe8604a });
    W.box(Wd, 0.9, 0.03, 0, 0.45, -4.48, 0xe8b860, { t: TX.wood });
    diningTable(2.6, -2.2, 2.4, 0x8a5a3a, (cx, cz, r) => bistroChair(cx, 0, cz, r, 0x6a4a2a)); fruitBowl(2.6, 0.79, -2.2); ceilingFan(2.6, H - 0.1, -2.2);
    sofa(-3.4, 0, -3.6, 0, 0xe8604a, 2.4); sofa(-5.4, 0, -1.4, Math.PI / 2, 0xe8604a, 1.8); lowTable(-3.4, 0, -2.2, 0, 1.2, 0.6); tvStand(-3.4, 0, 0.4, Math.PI); tv(-3.4, 0.5, 0.4, Math.PI);
    shelfUnit(5.6, 0, 1.6, -Math.PI / 2, 1.4, 1.9, 0.4, 0x8a5a3a, 'home'); wallPlates(2.6, 1.9, -4.45, 0, 5); framedPhoto(-4.2, 1.9, -4.45, 0, 0.5, 0.4); framedPhoto(-2.8, 2.0, -4.45, 0, 0.4, 0.5); wallClock(0.4, 2.3, -4.45, 0);
    sewingMachine(4.8, 0.76, 3.4, Math.PI); W.box(1.2, 0.05, 0.6, 4.8, 0.74, 3.4, 0x8a6a4a, { t: TX.wood }); W.solid(1.2, 0.76, 0.6, 4.8, 0.38, 3.4, 'wood'); plasticChair(4.8, 0, 2.7, 0, RATTAN);
    washingMachine(5.6, 0, -1.0, -Math.PI / 2); laundryBag(5.2, 0, -0.1); playBall(-1.0, 0.12, 1.6);
    for (let k = 0; k < 9; k++) { W.box(1.0, 0.18, 0.32, -5.4, 0.09 + k * 0.33, 4.2 - k * 0.32, 0x8a6a4a, { t: TX.wood }); W.solid(1.0, 0.18 + k * 0.33, 0.32, -5.4, (0.18 + k * 0.33) / 2, 4.2 - k * 0.32, 'wood'); }
    W.rod([-4.88, 1.0, 4.2], [-4.88, 3.7, 1.6], 0.025, 0xf8f8f4);
    sunWindow(-1.2, -4.46, 0, 1.4, 1.1); sunWindow(5.96, -3.0, -Math.PI / 2, 1.2, 1.1, 1.6, 0xf0c040); sunWindow(-5.96, 1.0, Math.PI / 2, 1.0, 1.0, 1.7, 0x2ab0d0);
    floorRug(-3.4, 0.03, -1.6, 3.4, 2.6, 0, 0xc84a3a); plantPot(1.0, 0, 3.8, 'aloe', 1.4); W.lamp(0, 2.5, 0, 0xfff0d8, 1.8, 10, { halo: 0 });
    LOOT.spot('homestead', 5.6, 1.92, 1.6, 'medkit');
    staffAt(-3.4, -3.3, Math.PI, 'home'); staffAt(2.0, -1.4, Math.PI, 'guest'); staffAt(4.8, 2.7, 0, 'home');
    W.pop();
  }
  // ---- a white villa: marble, white sofas, a long glass wall onto the sea, the kitchen island, the art ----
  {
    const Wd = 18, D = 12, H = 3.6;
    roomShell('villa', Wd, D, H, { name: '', en: 'a villa', floor: 0xf0ece4, wall: 0xf8f8f4, ceil: 0xf8f8f4, floorTx: TX.terrazzo, door: 0x6a4a32 });
    W.box(Wd - 1, H - 0.6, 0.04, 0, (H - 0.6) / 2 + 0.1, -5.96, 0x9ad8f0, { layer: 'glow' }); for (let k = -8; k <= 8; k += 2.8) W.box(0.08, H, 0.08, k, H / 2, -5.9, 0x2a2a2a, { layer: 'metal' });
    sofa(-3.6, 0, -2.6, 0, 0xf4f2ec, 3.0); sofa(-6.2, 0, -0.4, Math.PI / 2, 0xf4f2ec, 2.4); lowTable(-3.6, 0, -1.0, 0, 1.6, 0.9); floorRug(-3.6, 0.03, -1.0, 5.2, 4.0, 0, 0xd8d0c0); for (const x of [-4.4, -3.0]) cushion(x, 0.45, -2.75, 0, 0x2ab0d0);
    counter(4.0, 0, -0.6, 0, 3.6, 0xf4f2ec, 0x2a2a2a); for (let k = 0; k < 3; k++) stool(2.8 + k * 1.2, 0, 0.2, 0x2a2a2a); kitchenRun(5.6, 0, -5.4, 0, 4.4, 0xf4f2ec); fridge(8.3, 0, -3.4, -Math.PI / 2); espressoMachine(4.6, 0.92, -5.5, 0); fruitBowl(4.0, 1.0, -0.6);
    for (let k = 0; k < 3; k++) { W.rod([2.8 + k * 1.2, H, -0.6], [2.8 + k * 1.2, 2.3, -0.6], 0.006, 0x1a1a1a); W.sphere(0.18, 0.18, 0.18, 2.8 + k * 1.2, 2.2, -0.6, 0xfff0d0, { layer: 'glow' }); }
    diningTable(4.4, 3.4, 3.2, 0xe8e4dc, (cx, cz, r) => bistroChair(cx, 0, cz, r, 0x2a2a2a));
    for (const [x, c] of [[-6.6, 0xe8604a], [-2.6, 0x2ab0d0]]) { W.box(2.4, 1.6, 0.06, x, 2.0, 5.92, 0xf8f8f4); W.box(2.2, 1.4, 0.04, x, 2.0, 5.88, c); W.box(1.0, 0.6, 0.03, x + 0.3, 2.2, 5.85, 0xf0c040); }
    W.box(0.5, 1.0, 0.5, -8.2, 0.5, 2.6, 0xf4f2ec); W.sphere(0.4, 0.6, 0.4, -8.2, 1.5, 2.6, 0x2a2a2a, { layer: 'metal' }); W.solid(0.5, 1.0, 0.5, -8.2, 0.5, 2.6, 'stone');
    plantPot(-8.2, 0, -5.2, 'palm', 2.4); plantPot(8.2, 0, 5.2, 'ficus', 2.2); W.box(1.2, 0.8, 0.5, -0.4, 0, 5.6, 0x2a2a2a, { layer: 'metal' }); for (let k = 0; k < 4; k++) W.cyl(0.04, 0.04, 0.3, -0.8 + k * 0.25, 0.95, 5.6, mpick([0x6a2a1a, 0xc8a050, 0x2a6a3a]), { seg: 6, layer: 'glass' });
    W.lamp(-3, 3.0, -1, 0xfff0d8, 1.6, 10, { halo: 0 }); W.lamp(4, 3.0, 1.6, 0xfff0d8, 1.6, 10, { halo: 0 });
    LOOT.spot('villa', 4.0, 1.0, -0.2, 'cash');
    staffAt(5.4, -4.6, Math.PI, 'home'); staffAt(-3.6, -2.3, Math.PI, 'guest'); staffAt(-5.9, -0.4, -Math.PI / 2, 'guest');
    W.pop();
  }
  // ---- a hotel room: the king bed, the balcony doors, the desk, the minibar, the bathroom in the corner ----
  {
    const Wd = 10, D = 9, H = 3.0;
    roomShell('suite', Wd, D, H, { name: '', en: 'a resort room', floor: 0xe8dcc4, wall: 0xf4f0e8, ceil: 0xf8f8f4, floorTx: TX.ceramic, door: 0x2ab0b0 });
    W.box(5.6, 2.5, 0.04, -1.0, 1.3, -4.46, 0x9ad8f0, { layer: 'glow' }); for (const k of [-3.8, -1.0, 1.8]) W.box(0.08, 2.6, 0.08, k, 1.3, -4.42, 0xd8d8d0, { layer: 'metal' }); for (const s of [-1, 1]) W.box(0.5, 2.7, 0.05, -1.0 + s * 3.1, 1.35, -4.36, 0xf0e8d8, { layer: 'cloth' });
    for (const dx of [-0.7, 0.7]) bed(-1.8 + dx, 0, 0.4, 0, 0xf8f8f4); W.box(2.9, 1.3, 0.08, -1.8, 1.1, -0.65, 0x2ab0b0, { t: TX.fabric }); W.box(2.6, 0.06, 0.7, -1.8, 0.54, 1.1, 0x2ab0b0, { t: TX.fabric });
    for (const s of [-1, 1]) { nightstand(-1.8 + s * 1.85, 0, -0.4, 0); W.cyl(0.12, 0.16, 0.3, -1.8 + s * 1.85, 0.72, -0.4, 0xf0e8d0, { seg: 10, layer: 'glow' }); }
    desk(3.4, 0, -3.6, 0, 1.6, 0.6, 0xe8e4dc); chairOffice(3.4, 0, -2.9, Math.PI); laptop(3.4, 0.76, -3.7, 0); deskLamp(4.0, 0.76, -3.8, 0);
    dresser(3.2, 0, 1.0, -Math.PI / 2, 0xe8e4dc); tv(4.6, 0.9, 1.0, -Math.PI / 2);
    W.box(0.6, 0.85, 0.5, 4.6, 0.42, -1.2, 0x2a2420); W.box(0.5, 0.6, 0.02, 4.34, 0.45, -1.2, 0x3a3430, { ry: Math.PI / 2 }); W.solid(0.6, 0.85, 0.5, 4.6, 0.42, -1.2, 'wood');   // the minibar
    W.box(0.05, H, 3.0, -3.0, H / 2, 3.0, 0xe8e4dc); W.solid(0.05, H, 3.0, -3.0, H / 2, 3.0, 'concrete'); showerCorner(-4.3, 0, 3.7, 0); sink(-3.4, 0, 2.0, -Math.PI / 2); mirror(-3.03, 1.5, 2.0, Math.PI / 2); towel(-4.9, 1.6, 2.4, Math.PI / 2, 0xf8f8f4);
    duffel(1.8, 0, 3.4, 0.4); backpack(2.6, 0, 3.6, 0); floorRug(-1.8, 0.03, 1.6, 3.4, 1.4, 0, 0xd8c8a8); plantPot(4.4, 0, -4.0, 'palm', 1.6);
    W.lamp(-1, 2.5, 0, 0xfff0d8, 1.4, 9, { halo: 0 });
    LOOT.spot('suite', 4.6, 0.9, -1.2, 'medkit');
    staffAt(1.0, 1.2, Math.PI / 2, 'home');
    W.pop();
  }
  // ---- an overwater bungalow: the glass floor over the lagoon, the canopy bed, the deck doors, rattan, the tub ----
  {
    const Wd = 10, D = 8, H = 3.4;
    roomShell('bungalow', Wd, D, H, { name: '', en: 'an overwater bungalow', floor: 0xc8a878, wall: 0xf4ecd8, ceil: 0xc8a868, wallTx: TX.wood, door: 0xc8a878 });
    for (let k = -4.5; k <= 4.5; k += 1.5) W.box(0.16, 0.18, D, k, H - 0.12, 0, 0x8a6a4a, { t: TX.wood }); W.box(Wd, 0.04, D, 0, H - 0.03, 0, 0xc8a868, { t: TX.fabric });
    W.box(2.4, 0.07, 1.6, 0.6, 0.04, 0.4, 0x3acce0, { layer: 'glow' }); W.box(2.6, 0.08, 0.1, 0.6, 0.06, -0.45, 0x8a6a4a); W.box(2.6, 0.08, 0.1, 0.6, 0.06, 1.25, 0x8a6a4a);
    for (const [x, z] of [[0.2, 0.2], [1.1, 0.7], [0.4, 0.9]]) W.box(0.25, 0.02, 0.08, x, 0.085, z, 0xf0c040, { layer: 'glow' });   // fish under the glass
    W.box(Wd - 1, 2.6, 0.04, 0, 1.4, -3.96, 0x9ad8f0, { layer: 'glow' }); for (const k of [-3, 0, 3]) W.box(0.1, 2.8, 0.1, k, 1.4, -3.9, 0xf8f4e8);
    bed(-3.0, 0, 1.4, Math.PI / 2, 0xf8f8f4); bed(-3.0, 0, 2.8, Math.PI / 2, 0xf8f8f4); for (const sx of [-4.1, -1.9]) for (const sz of [0.6, 3.6]) W.rod([sx, 0, sz], [sx, 2.4, sz], 0.03, 0x8a6a4a); W.box(2.3, 0.04, 3.1, -3.0, 2.4, 2.1, 0xf8f8f4, { layer: 'cloth' }); for (const sz of [0.6, 3.6]) W.box(2.3, 1.6, 0.02, -3.0, 1.6, sz, 0xfaf8f0, { layer: 'cloth' });
    W.box(1.8, 0.55, 0.85, 3.4, 0.28, 2.6, 0xf8f8f4); W.box(1.6, 0.04, 0.65, 3.4, 0.5, 2.6, 0x7ad8f0, { layer: 'glass' }); W.solid(1.8, 0.55, 0.85, 3.4, 0.28, 2.6, 'stone');   // the tub
    for (const x of [1.8, 3.4]) { plasticChair(x, 0, -2.8, 0, RATTAN); cushion(x, 0.43, -2.8, 0, 0xf8f8f4); } lowTable(2.6, 0, -2.2, 0, 0.8, 0.6); W.cyl(0.05, 0.05, 0.28, 2.5, 0.44, -2.2, 0x2a6a3a, { seg: 6, layer: 'glass' });
    ceilingFan(0, H - 0.2, 0); plantPot(4.4, 0, -3.4, 'palm', 2.0); plantPot(-4.4, 0, -3.4, 'aloe', 1.4); towel(4.95, 1.4, 2.6, -Math.PI / 2, 0x2ab0d0);
    W.lamp(0, 2.6, 0, 0xfff0d8, 1.4, 9, { halo: 0 }); W.lamp(0.6, 0.2, 0.4, 0x6ad8ff, 0.8, 4, { halo: 0 });
    LOOT.spot('bungalow', 2.6, 0.34, -2.2, 'cash');
    staffAt(2.6, -2.8, 0, 'guest'); staffAt(-1.4, 3.2, Math.PI, 'home');
    W.pop();
  }
  // ---- a conch shack: the counter, the fryer, the conch in buckets, the cooler, the menu, the regulars ----
  {
    const Wd = 9, D = 7, H = 2.8;
    roomShell('shack', Wd, D, H, { name: '', en: 'a conch shack', floor: 0x8a7a5a, wall: 0x7ac8c8, ceil: 0xc8a878, wallTx: TX.wood, floorTx: TX.wood, door: 0xe8604a });
    counter(0, 0, -1.8, 0, 5.0, 0x8a6a4a, 0xe8e4dc); cashRegister(-1.8, 1.02, -1.8, 0);
    for (let i = 0; i < 9; i++) W.sphere(0.16, 0.1, 0.12, -0.6 + (i % 5) * 0.32, 1.05 + Math.floor(i / 5) * 0.1, -1.7, mpick([0xf0b0a0, 0xf8d0c0, 0xe89a8a]), { seg: 6 });
    gasHob(2.6, 0, -3.1, 0); W.box(0.8, 0.9, 0.6, 1.2, 0.45, -3.1, 0x8a8e94, { layer: 'metal' }); W.box(0.6, 0.05, 0.4, 1.2, 0.92, -3.1, 0xc89a3a, { layer: 'glow' }); W.solid(0.8, 0.9, 0.6, 1.2, 0.45, -3.1, 'metal');
    displayFridge(-3.6, 0, -3.0, 0); cooler(3.8, 0, -1.0, -Math.PI / 2, 0x2ab0d0); for (const x of [-0.4, 0.4]) { W.cyl(0.25, 0.2, 0.4, x - 3.4, 0.2, -1.2, 0xf0f0ec, { seg: 10 }); for (let i = 0; i < 4; i++) W.sphere(0.12, 0.08, 0.1, x - 3.4 + mr(-0.1, 0.1), 0.42, -1.2 + mr(-0.1, 0.1), 0xf0b0a0, { seg: 6 }); }
    NEONish('CONCH SALAD 12 · FRITTERS 8 · KALIK 5', 0, 2.1, -3.44, 4.4, 0.5);
    W.cable([-4.2, 2.5, 3.4], [4.2, 2.5, 3.4], 0.4, 0.02, 0xd8c8a0, 8); for (let k = -4; k <= 4; k += 1.2) W.box(0.3, 0.2, 0.02, k, 2.3 - Math.abs(k) * 0.03, 3.4, mpick([0xe8604a, 0xf0c040, 0x2ab0d0, 0x8ad86a]), { layer: 'cloth' });   // bunting
    for (const [x, z] of [[-2.4, 1.2], [2.4, 1.2]]) { plasticTable(x, 0, z, 0, 0xf8f8f4); for (const s of [-1, 1]) plasticChair(x + s * 0.75, 0, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0xf8f8f4); W.cyl(0.04, 0.04, 0.24, x, 0.84, z, 0x2a6a3a, { seg: 6, layer: 'glass' }); }
    W.box(1.2, 0.8, 0.03, 4.47, 1.6, 0.6, 0x2a2a2a, { ry: Math.PI / 2 }); sunWindow(-4.46, 0.6, Math.PI / 2, 1.2, 0.9, 1.6, 0xf0c040); ceilingFan(0, H - 0.1, 1.2);
    W.lamp(0, 2.3, -1, 0xfff0d8, 1.4, 8, { halo: 0 });
    LOOT.spot('shack', -1.8, 1.05, -2.1, 'cash');
    staffAt(0, -2.8, 0, 'shop'); staffAt(2.2, 1.2, -Math.PI / 2, 'guest'); staffAt(-1.65, 1.2, Math.PI / 2, 'guest');
    W.pop();
  }
  // ---- the church: pews either side of the aisle, the altar, stained glass, candles ----
  {
    const Wd = 12, D = 18, H = 7;
    roomShell('chapel', Wd, D, H, { name: '', en: 'St Christopher’s church', floor: 0xb89a6a, wall: 0xf8f6f0, ceil: 0x8a6a4a, door: 0x5ab0b0 });
    for (let z = -6; z <= 8; z += 2) W.box(Wd, 0.3, 0.3, 0, H - 0.4, z, 0x6a4a2a, { t: TX.wood });
    for (let r = 0; r < 6; r++) for (const s of [-1, 1]) pew(s * 3.1, -4.5 + r * 1.6, 3.8);
    floorRug(0, 0.03, -0.5, 1.6, 12, 0, 0x8a2a24);
    W.box(Wd, 0.3, 4, 0, 0.15, -7, 0xb89a6a, { t: TX.wood }); W.solid(Wd, 0.3, 4, 0, 0.15, -7, 'wood', { walk: true });
    W.box(2.6, 1.0, 1.0, 0, 0.8, -7.4, 0xf8f8f4); W.box(2.7, 0.04, 1.1, 0, 1.31, -7.4, 0xf8f8f4, { layer: 'cloth' }); W.box(0.6, 0.9, 1.12, 0, 0.9, -7.4, 0xc8a050, { layer: 'cloth' }); W.solid(2.6, 1.3, 1.0, 0, 0.65, -7.4, 'stone');
    W.box(0.18, 2.4, 0.1, 0, 4.0, -8.9, 0xc8a050, { layer: 'metal' }); W.box(1.2, 0.18, 0.1, 0, 4.5, -8.9, 0xc8a050, { layer: 'metal' });
    for (const x of [-1.0, 1.0]) { W.cyl(0.04, 0.04, 0.3, x, 1.5, -7.4, 0xf8f4e8, { seg: 6 }); W.sphere(0.04, 0.07, 0.04, x, 1.7, -7.4, 0xffc060, { layer: 'glow' }); }
    W.box(0.5, 1.2, 0.4, 3.0, 0.9, -6.0, 0x6a4a2a, { t: TX.wood }); W.box(0.6, 0.06, 0.5, 3.0, 1.52, -6.0, 0x6a4a2a, { rx: -0.3 });
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const z = -5 + k * 3.6, c = [0x3a6ad8, 0xd83a3a, 0xf0c040, 0x3aa86a][(k + (s > 0 ? 2 : 0)) % 4]; W.box(0.04, 2.6, 1.0, s * 5.96, 3.6, z, c, { layer: 'glow' }); W.box(0.06, 0.06, 1.0, s * 5.94, 3.6, z, 0x1a1a1a); W.box(0.06, 2.6, 0.06, s * 5.94, 3.6, z, 0x1a1a1a); }
    W.box(1.6, 1.6, 0.04, 0, 5.2, -8.96, 0xf0c040, { layer: 'glow' });
    W.lamp(0, 5, -4, 0xfff0d8, 2.0, 16, { halo: 0 }); W.lamp(0, 5, 4, 0xfff0d8, 1.6, 14, { halo: 0 }); W.lamp(0, 2, -7.4, 0xffc060, 1.0, 5, { halo: 0 });
    LOOT.spot('chapel', 3.0, 1.55, -6.0, 'medkit');
    staffAt(0, -6.2, 0, 'home'); staffAt(-2.4, -1.3, Math.PI, 'guest'); staffAt(3.4, 0.3, Math.PI, 'guest');
    W.pop();
  }
}
