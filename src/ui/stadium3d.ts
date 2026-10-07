// The title screen's stadium, in WebGL. Night, a full bowl, four light towers.
// Intro (about 5.6s): the stadium sits dark under an aerial camera, the towers bang
// on one by one, flashbulbs ripple round the bowl, then a football is launched
// in a tight spiral and the camera chases it downfield until it fills the lens.
// Afterwards the camera settles into a slow orbit that stays behind the menu.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const INTRO_SECONDS = 5.6;
const W = 120, H = 53.3; // field in yards; 1 unit = 1 yard

export interface Stadium { dispose(): void; skip(): void }

export function mountStadium(host: HTMLElement, opts: { intro: boolean; color: string; onIntroEnd?: () => void }): Stadium | null {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch { return null; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#03050b');
  scene.fog = new THREE.FogExp2('#04070f', 0.0042);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2000);

  // ---- light: moonlight until the towers come on ----
  const hemi = new THREE.HemisphereLight('#6d86c9', '#05080a', 0.18);
  scene.add(hemi);
  // The bank of stadium lights as one soft key from above; it rises as towers come on.
  const key = new THREE.DirectionalLight('#fff6e8', 0);
  key.position.set(-30, 90, 40);
  scene.add(key);

  // ---- field ----
  const fieldTex = new THREE.CanvasTexture(fieldCanvas(opts.color));
  fieldTex.colorSpace = THREE.SRGBColorSpace;
  fieldTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const fieldMat = new THREE.MeshStandardMaterial({ map: fieldTex, roughness: 0.92, metalness: 0, emissive: '#ffffff', emissiveMap: fieldTex, emissiveIntensity: 0 });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(W + 12, H + 12), fieldMat);
  field.rotation.x = -Math.PI / 2;
  scene.add(field);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(240, 170), new THREE.MeshStandardMaterial({ color: '#0f2a16', roughness: 1 }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02;
  scene.add(apron);

  // ---- the bowl: two tiers of seats with a crowd texture, a roof ring ----
  const crowdTex = new THREE.CanvasTexture(crowdCanvas());
  crowdTex.colorSpace = THREE.SRGBColorSpace;
  crowdTex.wrapS = crowdTex.wrapT = THREE.RepeatWrapping;
  crowdTex.repeat.set(14, 2);
  const bowlMat = new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 0.95, side: THREE.BackSide, emissive: '#ffffff', emissiveMap: crowdTex, emissiveIntensity: 0.05 });
  const tier = (rBot: number, rTop: number, h: number, y: number) => {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, 96, 1, true);
    const m = new THREE.Mesh(g, bowlMat);
    m.scale.set(1, 1, 0.66); m.position.y = y;
    scene.add(m);
  };
  tier(78, 104, 26, 13);
  tier(108, 128, 22, 40);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(130, 1.6, 8, 120), new THREE.MeshStandardMaterial({ color: '#1a2233', metalness: 0.6, roughness: 0.5 }));
  rim.rotation.x = Math.PI / 2; rim.scale.set(1, 0.66, 1); rim.position.y = 52;
  scene.add(rim);
  // Ribbon board between the tiers, in the home colour.
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(104.5, 104.5, 2.2, 96, 1, true), new THREE.MeshBasicMaterial({ color: opts.color, side: THREE.BackSide }));
  ribbon.scale.set(1, 1, 0.66); ribbon.position.y = 27;
  scene.add(ribbon);

  // ---- flashbulbs around the bowl ----
  const N = 700;
  const fpos = new Float32Array(N * 3), fcol = new Float32Array(N * 3), life = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, up = Math.random();
    const r = 80 + up * 44, y = 2 + up * 48;
    fpos.set([Math.cos(a) * r * 0.985, y, Math.sin(a) * r * 0.66 * 0.985], i * 3);
  }
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  fgeo.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
  const flashes = new THREE.Points(fgeo, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(flashes);

  // ---- light towers ----
  const glowTex = glowTexture();
  const towers = [[-74, 62, -50], [74, 62, -50], [-74, 62, 50], [74, 62, 50]].map(([x, y, z]) => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, y, 8), new THREE.MeshStandardMaterial({ color: '#202734', metalness: 0.7, roughness: 0.4 }));
    pole.position.set(x * 1.06, y / 2, z * 1.06);
    const panelMat = new THREE.MeshBasicMaterial({ color: '#222831' });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 1), panelMat);
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff6dc', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(60, 40, 1); glow.position.set(x, y, z);
    g.add(pole, panel, glow);
    scene.add(g);
    return { panelMat, glow, on: 0 };
  });

  // ---- the football ----
  const ball = makeFootball();
  ball.visible = false;
  scene.add(ball);

  // ---- timeline ----
  const clock = new THREE.Clock();
  let t = opts.intro ? 0 : INTRO_SECONDS;
  // Test hook: ?introAt=3.2 holds the intro at that moment (for frame checks).
  const hold = Number(new URLSearchParams(location.search).get('introAt') || NaN);
  let ended = !opts.intro;
  let orbit = 0.9;
  const towerOnAt = [0.7, 1.05, 1.4, 1.75];
  const launch = 2.3, land = 5.2;
  const from = new THREE.Vector3(-38, 1.8, 6), to = new THREE.Vector3(30, 2, -4);
  const ballAt = (k: number) => new THREE.Vector3().lerpVectors(from, to, k).setY(1.8 + Math.sin(Math.PI * k) * 17);
  const tmp = new THREE.Vector3(), look = new THREE.Vector3();

  // Bloom makes the lights, flashbulbs and glows bleed like a broadcast lens.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.55, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  // Later visits start on the orbit (no swoop in from the origin).
  if (!opts.intro || (Number.isFinite(hold) && hold >= INTRO_SECONDS)) { camera.position.set(Math.cos(orbit) * 84, 40, Math.sin(orbit) * 56); camera.lookAt(0, -2, 0); }
  const resize = () => {
    const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(host);

  let raf = 0, alive = true;
  const frame = () => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) { clock.getDelta(); return; }
    const dt = Math.min(0.05, clock.getDelta());
    t = Number.isFinite(hold) ? hold : t + dt;
    // Lights: each tower bangs on with a flicker, then holds.
    towers.forEach((tw, i) => {
      const k = opts.intro && t < INTRO_SECONDS ? t - towerOnAt[i] : 9;
      const target = k < 0 ? 0 : k < 0.18 ? (Math.sin(k * 90) > 0 ? 1 : 0.2) : 1;
      tw.on += (target - tw.on) * Math.min(1, dt * 30);
      tw.glow.material.opacity = tw.on * 0.95;
      tw.panelMat.color.setRGB(0.13 + tw.on * 1.6, 0.15 + tw.on * 1.55, 0.18 + tw.on * 1.4);
    });
    const lit = towers.reduce((a, x) => a + x.on, 0) / 4;
    hemi.intensity = 0.18 + lit * 0.55;
    key.intensity = lit * 2.4;
    fieldMat.emissiveIntensity = lit * 0.14;
    bowlMat.emissiveIntensity = 0.02 + lit * 0.08;
    // Flashbulbs: a surge once the lights are on, then a steady sparkle.
    const rate = !opts.intro || t > INTRO_SECONDS ? 0.004 : t > 1.9 && t < 3.4 ? 0.05 : t > 1.6 ? 0.012 : 0;
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0 && Math.random() < rate) life[i] = 1;
      life[i] = Math.max(0, life[i] - dt * 6);
      const v = life[i];
      fcol[i * 3] = v; fcol[i * 3 + 1] = v; fcol[i * 3 + 2] = v * 0.95;
    }
    fgeo.attributes.color.needsUpdate = true;

    if (!ended && t < INTRO_SECONDS) {
      if (t < launch) {
        // Aerial establishing shot, sinking toward the field as the lights come up.
        // Inside the rim the whole way down, ending behind the quarterback.
        const k = t / launch, e = 1 - Math.pow(1 - k, 2.2);
        camera.position.set(-10 - e * 36, 150 - e * 140, 70 - e * 58);
        look.set(-e * 22, 0, 0);
        camera.lookAt(look);
        ball.visible = t > launch - 0.4;
        ball.position.copy(from);
      } else {
        // Chase cam: behind and beside the spiral, looking downfield past it.
        const k = Math.min(1, (t - launch) / (land - launch));
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const p = ballAt(e);
        const ahead = ballAt(Math.min(1, e + 0.04));
        ball.visible = true;
        ball.position.copy(p);
        ball.lookAt(ahead);           // nose along the flight path
        ball.rotateY(Math.PI / 2);
        ball.children[0].rotation.x += dt * 26; // the spiral
        // Camera trails the ball, then lets it come back at the lens for the finish.
        const lag = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
        tmp.set(p.x - 4.5 * lag - (1 - lag) * -2.2, p.y + 1.2, p.z + 2.6 * lag + (1 - lag) * 0.4);
        camera.position.lerp(tmp, k < 0.05 ? 1 : Math.min(1, dt * 7));
        look.copy(ahead).lerp(to, 0.15);
        camera.lookAt(look);
      }
    } else {
      if (!ended) { ended = true; opts.onIntroEnd?.(); }
      ball.visible = false;
      // Menu: a slow orbit of the bowl.
      orbit += dt * 0.03;
      tmp.set(Math.cos(orbit) * 84, 40 + Math.sin(orbit * 0.7) * 4, Math.sin(orbit) * 56);
      camera.position.lerp(tmp, Math.min(1, dt * 1.2));
      camera.lookAt(0, -2, 0);
    }
    composer.render(dt);
  };
  frame();

  return {
    skip() { if (!ended) { t = INTRO_SECONDS; towers.forEach(x => (x.on = 1)); } },
    dispose() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse(o => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach(x => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); });
      });
      composer.dispose(); renderer.dispose();
      canvas.remove();
    },
  };
}

// ---- textures, drawn once on canvases ---------------------------------------------------
function fieldCanvas(endColor: string) {
  const c = document.createElement('canvas');
  const PX = 16; // px per yard
  c.width = (W + 12) * PX; c.height = Math.round((H + 12) * PX);
  const g = c.getContext('2d')!;
  const X = (yd: number) => (yd + 6) * PX, Y = (yd: number) => (yd + 6) * PX;
  g.fillStyle = '#1d5a2a'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#2d7d3a' : '#286f34'; g.fillRect(X(i * 5), Y(0), 5 * PX, H * PX); }
  // Grain.
  const img = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 14; img.data[i] += n * 0.4; img.data[i + 1] += n; img.data[i + 2] += n * 0.4; }
  g.putImageData(img, 0, 0);
  // End zones.
  for (const [x0, rot] of [[0, -1], [110, 1]] as const) {
    g.fillStyle = endColor; g.fillRect(X(x0), Y(0), 10 * PX, H * PX);
    g.save(); g.translate(X(x0 + 5), Y(H / 2)); g.rotate((rot * Math.PI) / 2);
    g.font = `900 italic ${7 * PX}px "Barlow Condensed", Arial Narrow, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText('GRIDIRON', 0, 0); g.fillStyle = '#fff'; g.fillText('GRIDIRON', 0, 0);
    g.restore();
  }
  // Lines, hashes, numbers.
  g.strokeStyle = '#f4f4ef';
  for (let y = 10; y <= 110; y += 5) { g.lineWidth = y === 10 || y === 110 ? 7 : 4; g.beginPath(); g.moveTo(X(y), Y(0)); g.lineTo(X(y), Y(H)); g.stroke(); }
  g.lineWidth = 3;
  for (let y = 11; y < 110; y++) for (const hy of [1, 23.6, 29.7, 52.3]) { g.beginPath(); g.moveTo(X(y), Y(hy) - 6); g.lineTo(X(y), Y(hy) + 6); g.stroke(); }
  g.lineWidth = 8; g.strokeRect(X(0), Y(0), W * PX, H * PX);
  g.fillStyle = '#f4f4ef'; g.font = `700 ${3.2 * PX}px "Barlow Condensed", Arial Narrow, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let y = 20; y <= 100; y += 10) {
    const n = String(y <= 60 ? y - 10 : 110 - y);
    g.fillText(n, X(y), Y(H - 9)); g.save(); g.translate(X(y), Y(9)); g.rotate(Math.PI); g.fillText(n, 0, 0); g.restore();
  }
  // Midfield mark.
  g.save(); g.translate(X(60), Y(H / 2));
  g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `900 italic ${6 * PX}px "Barlow Condensed", Arial Narrow, sans-serif`;
  g.fillText('GM', 0, 0); g.restore();
  return c;
}

function crowdCanvas() {
  // Rows of fans: muted shirts with a lean toward the home colours, seat rows between.
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b0e15'; g.fillRect(0, 0, 512, 256);
  const cols = ['#8a8f99', '#2b4a8c', '#7d2730', '#a68a3c', '#3a6b49', '#b9bcc4', '#4a3a6a', '#25272e', '#5a6170'];
  for (let row = 0; row < 16; row++) {
    const y = row * 16;
    g.fillStyle = '#151a24'; g.fillRect(0, y + 12, 512, 4);
    for (let x = 2; x < 512; x += 8) {
      if (Math.random() < 0.08) continue;
      const jitter = Math.random() * 2;
      g.fillStyle = cols[(Math.random() * cols.length) | 0];
      g.fillRect(x + jitter, y + 5, 6, 7);                 // torso
      g.fillStyle = ['#e0b896', '#8d5a3b', '#c58c64', '#5b3a26'][(Math.random() * 4) | 0];
      g.beginPath(); g.arc(x + 3 + jitter, y + 3.5, 2.4, 0, Math.PI * 2); g.fill(); // head
    }
  }
  return c;
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,250,230,.75)'); r.addColorStop(0.5, 'rgba(255,240,200,.15)'); r.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
/** A regulation-shaped football (scaled up for the camera): leather, laces, stripes. */
function makeFootball() {
  const outer = new THREE.Group();
  const spin = new THREE.Group();
  outer.add(spin);
  const L = 0.55, R = 0.33;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) { const y = -L + (2 * L * i) / 40; const k = 1 - (y / L) ** 2; pts.push(new THREE.Vector2(R * Math.pow(Math.max(0, k), 0.72), y)); }
  const leather = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), new THREE.MeshStandardMaterial({ color: '#7b3a14', roughness: 0.55, metalness: 0.05 }));
  leather.rotation.z = Math.PI / 2; // long axis along X
  spin.add(leather);
  const white = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.6 });
  // Stripes near each tip.
  for (const s of [-1, 1]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(R * 0.78, 0.018, 6, 40), white);
    band.rotation.y = Math.PI / 2; band.position.x = s * L * 0.62;
    spin.add(band);
  }
  // Laces along the top.
  const seam = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, 0.012, 0.02), white);
  seam.position.y = R * 0.995; spin.add(seam);
  for (let i = 0; i < 8; i++) { const lace = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.11), white); lace.position.set(-L * 0.38 + i * L * 0.108, R * 0.99, 0); spin.add(lace); }
  outer.scale.setScalar(1.6);
  return outer;
}
