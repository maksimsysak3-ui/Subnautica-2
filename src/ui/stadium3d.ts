// A real-time WebGL stadium (three.js) for the prime-time opens: a lit field with
// yard lines and team-coloured end zones, a tiered bowl full of crowd with camera
// flashes, four light towers throwing volumetric beams through the haze, sparks over
// midfield, and a camera that flies in low over the field. Everything is built from
// code and canvas textures: no models or images to download.
import * as THREE from 'three';

export interface StadiumOpts { tint: string; glow: string; home: string; away: string; dur: number }

function fieldTexture(home: string, away: string) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
  const g = c.getContext('2d')!;
  const X = (yd: number) => (yd / 120) * c.width;
  for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#2a7d37' : '#2f8a3e'; g.fillRect(X(i * 5), 0, X(5) + 1, c.height); }
  g.fillStyle = away; g.fillRect(0, 0, X(10), c.height); g.fillStyle = home; g.fillRect(X(110), 0, X(10), c.height);
  g.fillStyle = 'rgba(255,255,255,.85)';
  for (let yd = 10; yd <= 110; yd += 5) g.fillRect(X(yd) - 2, 0, yd === 10 || yd === 110 ? 6 : 4, c.height);
  for (let yd = 11; yd < 110; yd++) for (const y of [0.04, 0.44, 0.56, 0.96]) g.fillRect(X(yd) - 1, y * c.height, 3, 16);
  g.font = 'bold 90px Arial Narrow, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let yd = 20; yd <= 100; yd += 10) { const n = String(yd <= 60 ? yd - 10 : 110 - yd); g.fillText(n, X(yd), c.height * 0.85); g.save(); g.translate(X(yd), c.height * 0.15); g.rotate(Math.PI); g.fillText(n, 0, 0); g.restore(); }
  // Mow pattern and wear.
  for (let k = 0; k < 9000; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.035)'; g.fillRect(Math.random() * c.width, Math.random() * c.height, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function crowdTexture(cols: string[]) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b0e16'; g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < c.height; y += 4) {
    g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, y, c.width, 1);   // rows of seats
    for (let x = 0; x < c.width; x += 3) if (Math.random() < 0.8) { g.fillStyle = cols[Math.floor(Math.random() * cols.length)]; g.globalAlpha = 0.45 + Math.random() * 0.4; g.fillRect(x, y + 1, 2, 3); }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** A soft radial sprite for glows and flashes. */
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!; const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
/** A vertical fade for the light beams (bright at the lamp, gone at the turf). */
function beamTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d')!; const l = g.createLinearGradient(0, 0, 0, 256);
  l.addColorStop(0, 'rgba(255,250,230,.0)'); l.addColorStop(0.05, 'rgba(255,250,230,.55)'); l.addColorStop(1, 'rgba(255,250,230,0)');
  g.fillStyle = l; g.fillRect(0, 0, 4, 256); return new THREE.CanvasTexture(c);
}

/** Build the scene into `canvas`; returns a disposer. */
export function mountStadium(canvas: HTMLCanvasElement, o: StadiumOpts): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#03040a');
  scene.fog = new THREE.FogExp2('#05070f', 0.0065);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 900);

  // Lights: a cool fill, four warm towers, a coloured rim from the show's tint.
  scene.add(new THREE.HemisphereLight('#8aa0c8', '#0b1a10', 0.35));
  const towers: [number, number][] = [[-62, -44], [62, -44], [-62, 44], [62, 44]];
  for (const [x, z] of towers) { const l = new THREE.SpotLight('#fff3d6', 900, 260, 0.55, 0.6, 1.4); l.position.set(x, 48, z); l.target.position.set(x * 0.2, 0, z * 0.2); scene.add(l, l.target); }
  const rim = new THREE.PointLight(o.tint, 600, 120, 1.6); rim.position.set(0, 18, -10); scene.add(rim);

  // The field and the surround.
  const field = new THREE.Mesh(new THREE.PlaneGeometry(120, 53.3), new THREE.MeshStandardMaterial({ map: fieldTexture(o.home, o.away), roughness: 0.85 }));
  field.rotation.x = -Math.PI / 2; scene.add(field);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(170, 110), new THREE.MeshStandardMaterial({ color: '#173d22', roughness: 1 }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; scene.add(apron);

  // The bowl: a lathe profile of rising tiers, squashed into an oval, crowd textured inside.
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) { const r = 74 + i * 4.2, h = i * 3.1; prof.push(new THREE.Vector2(r, h), new THREE.Vector2(r + 3.2, h)); }
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), new THREE.MeshStandardMaterial({ map: crowdTexture([o.home, o.home, o.away, '#d8cfc0', '#2a2f3a', '#ffffff']), side: THREE.BackSide, roughness: 1, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.05 }));
  bowl.scale.set(1, 1, 0.62); scene.add(bowl);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(126, 0.6, 6, 120), new THREE.MeshBasicMaterial({ color: o.tint }));
  ring.rotation.x = Math.PI / 2; ring.scale.set(1, 0.62, 1); ring.position.y = 38; scene.add(ring);

  // Light towers: masts, lamp banks (glowing sprites) and haze beams.
  const glow = glowTexture(), beamTex = beamTexture();
  for (const [x, z] of towers) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 50, 8), new THREE.MeshStandardMaterial({ color: '#5a6170', metalness: 0.6, roughness: 0.4 }));
    mast.position.set(x * 1.25, 25, z * 1.25); scene.add(mast);
    for (let k = 0; k < 6; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#fff6dc', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.scale.setScalar(7); s.position.set(x * 1.25 + (k % 3 - 1) * 2.6, 50 + Math.floor(k / 3) * 2.4, z * 1.25); scene.add(s);
    }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(18, 70, 32, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.set(x * 0.85, 22, z * 0.85);
    cone.lookAt(x * 0.2, -40, z * 0.2); cone.rotateX(Math.PI / 2);
    scene.add(cone);
  }

  // Camera flashes in the stands: points that pop on and off.
  const N = 900, fp = new Float32Array(N * 3), fc = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, r = 78 + Math.random() * 46; fp.set([Math.cos(a) * r, 3 + (r - 74) * 0.74, Math.sin(a) * r * 0.62], i * 3); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  const flashes = new THREE.Points(fg, new THREE.PointsMaterial({ size: 1.6, map: glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(flashes);

  // Sparks rising over midfield when the mark lands.
  const S = 260, sp = new Float32Array(S * 3), sv: THREE.Vector3[] = [];
  for (let i = 0; i < S; i++) sv.push(new THREE.Vector3((Math.random() - 0.5) * 30, 10 + Math.random() * 22, (Math.random() - 0.5) * 30));
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.7, map: glow, color: o.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  scene.add(sparks);

  const size = () => { const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size(); window.addEventListener('resize', size);
  const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
  const t0 = performance.now();
  let raf = 0;
  const frame = () => {
    const t = (performance.now() - t0) / 1000, k = ease(t / (o.dur * 0.75));
    // Fly in from behind the end zone, low over the field, settling on midfield.
    const from = new THREE.Vector3(-150, 16, 30), to = new THREE.Vector3(-50, 11, 12);
    camera.position.lerpVectors(from, to, k);
    camera.position.z += Math.sin(t * 0.4) * 2 * k;
    camera.lookAt(0, 9 + (1 - k) * 4, 0);
    // Flashes.
    for (let i = 0; i < 24; i++) { const j = Math.floor(Math.random() * N) * 3; const v = Math.random() < 0.5 ? 1 : 0; fc[j] = fc[j + 1] = fc[j + 2] = v; }
    for (let i = 0; i < N * 3; i++) fc[i] *= 0.9;
    fg.attributes.color.needsUpdate = true;
    // Sparks burst around 1.6s and drift up.
    const sb = t - 1.6;
    (sparks.material as THREE.PointsMaterial).opacity = sb < 0 ? 0 : Math.max(0, 1 - sb / 2.4);
    if (sb >= 0) for (let i = 0; i < S; i++) { const v = sv[i]; const a = i * 2.39996; sp.set([Math.cos(a) * v.x * Math.min(1, sb * 1.4), v.y + sb * (2 + (i % 5)), Math.sin(a) * v.z * Math.min(1, sb * 1.4)], i * 3); }
    sg.attributes.position.needsUpdate = true;
    rim.intensity = 500 + Math.sin(t * 3) * 120;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf); window.removeEventListener('resize', size);
    scene.traverse((obj: THREE.Object3D) => { const m = obj as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach(x => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); }); });
    renderer.dispose();
  };
}
