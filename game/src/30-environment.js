// =====================================================================
//  Environment: void, floor, lights
// =====================================================================
scene.add(new THREE.HemisphereLight(0x8a9ac0, 0x2a2418, 0.55));
const keyLight = new THREE.SpotLight(0xffe9d2, 230, 0, 0.5, 0.7, 2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 2; keyLight.shadow.camera.far = 20;
keyLight.shadow.bias = -0.0004; keyLight.shadow.normalBias = 0.02;
scene.add(keyLight, keyLight.target);
const rimLight = new THREE.SpotLight(0xa8b4e0, 55, 0, 0.32, 0.6, 2);
scene.add(rimLight, rimLight.target);
const fillLight = new THREE.PointLight(0xc8b49a, 6, 9, 2);
scene.add(fillLight);

const fireLine = new THREE.Mesh(new THREE.PlaneGeometry(24, 0.08), new THREE.MeshBasicMaterial({ color: 0x8a6f2a }));
fireLine.rotation.x = -Math.PI / 2; fireLine.position.set(0, 0.004, 0); scene.add(fireLine);

const coneMat = (color) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { color: { value: new THREE.Color(color) }, op: { value: 0.045 } },
  vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY=uv.y; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
  fragmentShader: 'uniform vec3 color; uniform float op; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float e=pow(abs(dot(vN,vV)),1.6); gl_FragColor=vec4(color, op*pow(vY,1.4)*e); }',
});
// Range floodlight: a pooled lamp (see LAMPS) + a fake volumetric cone + a batched fixture on a mast.
function rangeLight(x, z, h = 10, power = 420, angle = 0.42, color = 0xdfe6ff) {
  W.lamp(x, h - 0.6, z + 2, color, power * 0.55, Math.max(26, h * 3), { halo: 1.4 });
  W.cyl(0.08, 0.1, h, x + 1.2, h / 2, z + 2.6, PC.metal, { seg: 8, layer: 'metal' });
  W.box(1.4, 0.08, 0.1, x + 0.5, h + 0.05, z + 2.4, PC.metalDk, { layer: 'metal' });
  W.box(0.36, 0.06, 0.24, x, h - 0.08, z + 2, GLOW.cool, { layer: 'glow' });
  const r = Math.tan(angle) * h * 0.8;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 24, 1, true), coneMat(color));
  cone.position.set(x, h / 2, z + 1); cone.rotation.x = -Math.atan2(2, h) * 0.5;
  scene.add(cone);
  M(box(0.5, 0.18, 0.3), std(0x22252b, 0.6, 0.5), scene, x, h + 0.05, z + 2);
}
function floorLabel(text, x, z) {
  const t = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, w, h);
    g.font = '700 72px Rajdhani, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#c9a45c'; g.fillText(text, w / 2, h / 2);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.55, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.006, z); scene.add(m);
}

// =====================================================================
//  Targets
// =====================================================================
const targets = [];
const hitList = [];
const steelPaint = () => std(0xe6e2d8, 0.55, 0.15);
const frameMat = std(0x30343b, 0.6, 0.5);
const chainMat = std(0x55575c, 0.4, 0.8);
const splashGeo = new THREE.CircleGeometry(0.014, 7);
const splashMat = new THREE.MeshStandardMaterial({ color: 0x7c7d80, roughness: 0.6, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });

function addSteel(dist, x, shape, size, opts = {}) {
  const frame = new THREE.Group(); scene.add(frame);
  if (opts.at) { frame.position.set(opts.at.x, terrainH(opts.at.x, opts.at.z), opts.at.z); frame.rotation.y = opts.at.ry || 0; x = opts.at.x; } else frame.position.set(x, 0, -dist);
  const H = opts.H ?? 1.9, half = size * 0.6 + 0.25, chain = 0.45;
  for (const sx of [1, -1]) {
    const post = M(box(0.07, H, 0.07), frameMat, frame, sx * half, H / 2, 0);
    post.userData.target = { type: 'frame' }; hitList.push(post);
    M(box(0.5, 0.05, 0.12), frameMat, frame, sx * half, 0.025, 0);
  }
  const bar = M(box(half * 2 + 0.07, 0.07, 0.07), frameMat, frame, 0, H, 0);
  bar.userData.target = { type: 'frame' }; hitList.push(bar);
  const pivot = new THREE.Group(); pivot.position.set(0, H - 0.04, 0); frame.add(pivot);
  for (const sx of [1, -1]) M(box(0.012, chain, 0.012), chainMat, pivot, sx * size * 0.22, -chain / 2, 0);
  const geo = shape === 'circle' ? new THREE.CylinderGeometry(size / 2, size / 2, 0.012, 24).rotateX(Math.PI / 2) : box(size * 0.68, size, 0.012);
  const plate = M(geo, steelPaint(), pivot, 0, -chain - size / 2, 0);
  const t = { type: 'steel', dist, size, frame, pivot, plate, ang: 0, vel: 0, tw: 0, tvel: 0, marks: [], mover: opts.mover || null, baseX: x, l: chain + size / 2, label: opts.label || 'STEEL' };
  plate.userData.target = t; hitList.push(plate);
  targets.push(t);
  return t;
}

// Pop-up paper silhouette with scoring zones. Holes are drawn into the canvas.
const PW = 240, PH = 400;
function silhouettePath(g) {
  g.beginPath();
  g.moveTo(85, 6); g.lineTo(155, 6); g.lineTo(155, 74); g.lineTo(205, 74); g.lineTo(238, 116); g.lineTo(238, 330); g.lineTo(205, 396);
  g.lineTo(35, 396); g.lineTo(2, 330); g.lineTo(2, 116); g.lineTo(35, 74); g.lineTo(85, 74); g.closePath();
}
const PAPER_ZONES = { A: [[80, 128, 160, 260], [95, 22, 145, 60]], C: [[45, 100, 195, 330], [88, 14, 152, 70]] };
function paperBase(g) {
  g.clearRect(0, 0, PW, PH);
  silhouettePath(g); g.fillStyle = '#c4a06a'; g.fill();
  g.strokeStyle = 'rgba(70,45,20,.55)'; g.lineWidth = 2;
  for (const [x0, y0, x1, y1] of [...PAPER_ZONES.A, ...PAPER_ZONES.C]) g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  g.fillStyle = 'rgba(70,45,20,.6)'; g.font = '700 18px sans-serif'; g.textAlign = 'center';
  g.fillText('A', 120, 200); g.fillText('C', 120, 300); g.fillText('D', 20, 230);
}
const alphaCanvas = document.createElement('canvas'); alphaCanvas.width = PW; alphaCanvas.height = PH;
{ const g = alphaCanvas.getContext('2d'); silhouettePath(g); g.fillStyle = '#fff'; g.fill(); }
const alphaData = alphaCanvas.getContext('2d').getImageData(0, 0, PW, PH).data;
function paperZone(px, py) {
  const inR = ([x0, y0, x1, y1]) => px >= x0 && px <= x1 && py >= y0 && py <= y1;
  if (PAPER_ZONES.A.some(inR)) return 'A';
  if (PAPER_ZONES.C.some(inR)) return 'C';
  return 'D';
}
function addPaper(dist, x, opts = {}) {
  const base = new THREE.Group(); scene.add(base);
  if (opts.at) { base.position.set(opts.at.x, terrainH(opts.at.x, opts.at.z), opts.at.z); base.rotation.y = opts.at.ry || 0; } else base.position.set(x, 0, -dist);
  M(box(0.5, 0.22, 0.32), frameMat, base, 0, 0.11, 0);
  const hinge = new THREE.Group(); hinge.position.set(0, 0.2, 0); base.add(hinge);
  M(box(0.03, 0.75, 0.03), std(0x5b4630, 0.9), hinge, 0, 0.375, -0.02);
  const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH;
  const g = cv.getContext('2d'); paperBase(g);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(0.46, 0.767); geo.translate(0, 0.767 / 2, 0);
  const paper = M(geo, new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), hinge, 0, 0.72, 0);
  paper.castShadow = false;
  const t = { type: 'paper', dist, hinge, paper, g, tex, ang: 0, vel: 0, down: false, downT: 0, label: 'PAPER' };
  paper.userData.target = t; hitList.push(paper);
  targets.push(t);
  return t;
}

function buildRange() {
  rangeLight(0, -11, 9, 360, 0.55);
  addPaper(7, -2.4); addPaper(10, 1.6); addPaper(15, -0.6); addPaper(15, 3.2);
  floorLabel('7 M', -2.4, -5.6); floorLabel('10 M', 1.6, -8.6); floorLabel('15 M', 1.3, -13.6);
  rangeLight(0, -25, 10, 460, 0.42);
  addSteel(25, -2.6, 'circle', 0.3); addSteel(25, 2.6, 'rect', 0.45, { label: 'IPSC' });
  floorLabel('25 M', 0, -23);
  // mover on a rail
  rangeLight(0, -35, 11, 520, 0.6);
  M(box(16, 0.06, 0.12), frameMat, scene, 0, 0.03, -35);
  addSteel(35, 0, 'rect', 0.4, { mover: { amp: 6, speed: 0.15 }, H: 1.7, label: 'MOVER' });
  floorLabel('35 M', 0, -32.5);
  rangeLight(0, -50, 11, 620, 0.35);
  addSteel(50, 0, 'circle', 0.35); addSteel(50, 3.5, 'circle', 0.22, { label: 'SMALL' });
  floorLabel('50 M', 0, -47.5);
  rangeLight(-3, -75, 12, 800, 0.32);
  addSteel(75, -3, 'rect', 0.5, { label: 'IPSC' });
  floorLabel('75 M', -3, -72.5);
  rangeLight(2.5, -100, 13, 1000, 0.3);
  addSteel(100, 2.5, 'circle', 0.45);
  floorLabel('100 M', 2.5, -97);
  rangeLight(0, -150, 15, 1600, 0.28, 0xffe2c0);
  addSteel(150, 0, 'circle', 0.7, { H: 2.3, label: 'GONG' });
  floorLabel('150 M', 0, -146);
}

function resetTargets() {
  for (const t of targets) {
    if (t.type === 'steel') {
      t.ang = t.vel = t.tw = t.tvel = 0;
      for (const m of t.marks) t.plate.remove(m);
      t.marks.length = 0;
    } else {
      paperBase(t.g); t.tex.needsUpdate = true; t.down = false; t.ang = 0; t.vel = 0; t.hinge.rotation.x = 0;
    }
  }
}

function updateTargets(dt, time) {
  for (const t of targets) {
    if (t.type === 'steel') {
      if (t.mover) t.frame.position.x = t.baseX + Math.sin(time * t.mover.speed * Math.PI) * t.mover.amp;
      const acc = -(9.81 / t.l) * Math.sin(t.ang) - 0.9 * t.vel;
      t.vel += acc * dt; t.ang += t.vel * dt;
      t.tvel += (-14 * t.tw - 1.2 * t.tvel) * dt; t.tw += t.tvel * dt;
      t.pivot.rotation.set(t.ang, t.tw, 0);
    } else {
      if (t.down) {
        t.downT -= dt;
        if (t.ang > -1.5) { t.vel -= 14 * dt; t.ang = Math.max(-1.52, t.ang + t.vel * dt); }
        if (t.downT <= 0) { t.down = false; t.vel = 0; }
      } else if (t.ang < 0) { t.ang = Math.min(0, t.ang + dt * 3.2); }
      t.hinge.rotation.x = t.ang;
    }
  }
}

