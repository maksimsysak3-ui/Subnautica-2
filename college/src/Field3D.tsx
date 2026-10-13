// Game day in 3D. The same plays the engine decides and the 2D field draws (every route, block,
// pursuit angle, catch and tackle comes from the shared scene builder), rendered as a stadium:
// a to-scale college field, articulated players in team kits, a spinning ball, officials, the
// crowd, lights and weather, with broadcast, behind-the-play, all-22 and end-zone cameras.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import type { PlayEvent, Weather } from '../../src/sim/game';
import type { Team } from '../../src/core/types';
import { buildScene, lineupFor, type Scene } from '../../src/ui/field/scene';
import { app } from '../../src/ui/store';
import { Athlete, type Kit, type Build, type Act, type Drive } from './athlete3d';

// ---- dimensions (yards; 1 unit = 1 yard) ------------------------------------------------------
const FL = 120, FW = 53.33, MIDY = FW / 2;
const HASH = 20;                       // college hashes: 60 ft in from each sideline
const X = (x: number) => x - FL / 2, Z = (y: number) => y - MIDY;
const SKIN = ['#e8c4a8', '#c99a76', '#a46e4c', '#7b4b31', '#5a3522'];
const lum = (h: string) => { const n = parseInt(h.replace('#', '').slice(0, 6).padEnd(6, '0'), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const hashStr = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };

type Cam = 'Broadcast' | 'Behind' | 'All-22' | 'End zone';
function kitFor(t: Team, home: boolean): Kit {
  const c1 = t.colors[0], c2 = t.colors[1] ?? '#ffffff';
  // College: dark jerseys at home, white on the road.
  return home
    ? { jersey: c1, num: lum(c1) > 150 ? '#111111' : '#ffffff', trim: c2, pants: lum(c2) > 200 ? c2 : '#e9e9e9', helmet: c1, mask: lum(c1) > 150 ? '#222222' : '#d8d8d8', socks: c1 }
    : { jersey: '#f4f4f4', num: lum(c1) > 200 ? '#222222' : c1, trim: c1, pants: c1, helmet: c1, mask: '#d8d8d8', socks: '#f4f4f4' };
}

// ---- textures ------------------------------------------------------------------------------------
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, r?: THREE.WebGLRenderer) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (r) t.anisotropy = r.capabilities.getMaxAnisotropy(); return t;
}
/** The field: alternating mowed stripes, every line and hash to scale, numbers, end zones, midfield logo. */
function fieldTexture(r: THREE.WebGLRenderer, home: Team, away: Team, logo?: HTMLImageElement | null) {
  const PX = 18, PAD = 8;               // pixels per yard; sideline apron around the field
  return canvasTex((FL + PAD * 2) * PX, Math.round((FW + PAD * 2) * PX), (g, w, h) => {
    const x = (yd: number) => (yd + PAD) * PX, y = (yd: number) => (yd + PAD) * PX;
    g.fillStyle = '#245b2c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 20; i++) { g.fillStyle = i % 2 ? '#2f7a39' : '#2a6f34'; g.fillRect(x(10 + i * 5), y(0), 5 * PX, FW * PX); }
    // Grain: a little noise so the turf doesn't look flat.
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n * 0.6; d[i + 1] += n; d[i + 2] += n * 0.5; }
    g.putImageData(img, 0, 0);
    // End zones in the home colour with the school names.
    const ez = (x0: number, t: Team) => {
      g.fillStyle = t.colors[0]; g.globalAlpha = 0.92; g.fillRect(x(x0), y(0), 10 * PX, FW * PX); g.globalAlpha = 1;
      g.save(); g.translate(x(x0 + 5), y(MIDY)); g.rotate(x0 === 0 ? -Math.PI / 2 : Math.PI / 2);
      const name = t.name.toUpperCase(); let fs = 7.2 * PX; g.font = `900 ${fs}px "Barlow Condensed", Impact, sans-serif`;
      while (g.measureText(name).width > (FW - 8) * PX && fs > 2 * PX) { fs -= PX * 0.3; g.font = `900 ${fs}px "Barlow Condensed", Impact, sans-serif`; }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = PX * 0.5; g.strokeStyle = t.colors[1] ?? '#fff'; g.strokeText(name, 0, 0); g.fillStyle = '#ffffff'; g.fillText(name, 0, 0); g.restore();
    };
    ez(0, home); ez(110, home);
    void away;
    g.fillStyle = '#ffffff';
    // Sidelines, end lines and every five-yard line; goal lines wider.
    g.fillRect(x(0) - PX * 0.66, y(0) - PX * 0.66, (FL + 1.33) * PX, PX * 0.66); g.fillRect(x(0) - PX * 0.66, y(FW), (FL + 1.33) * PX, PX * 0.66);
    g.fillRect(x(0) - PX * 0.66, y(0), PX * 0.66, FW * PX); g.fillRect(x(FL), y(0), PX * 0.66, FW * PX);
    for (let yd = 10; yd <= 110; yd += 5) g.fillRect(x(yd) - PX * (yd === 10 || yd === 110 ? 0.17 : 0.07), y(0), PX * (yd === 10 || yd === 110 ? 0.33 : 0.13), FW * PX);
    // Hash marks every yard: at the sidelines and on the college hashes, plus the 2-yard (3-yard) try line.
    for (let yd = 11; yd < 110; yd++) {
      if (yd % 5 === 0) continue;
      for (const hy of [0.4, HASH, FW - HASH, FW - 0.4]) g.fillRect(x(yd) - PX * 0.05, y(hy) - PX * 0.33, PX * 0.1, PX * 0.66);
    }
    for (const t of [13, 107]) g.fillRect(x(t) - PX * 0.05, y(MIDY) - PX * 0.5, PX * 0.1, PX);
    // Numbers: 6 feet tall, tops nine yards from the sideline, with the direction arrows.
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${2 * PX}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    for (let yd = 20; yd <= 100; yd += 10) {
      const n = String(yd <= 60 ? yd - 10 : 110 - yd);
      for (const [ny, rot] of [[FW - 8, 0], [8, Math.PI]] as const) {
        g.save(); g.translate(x(yd), y(ny)); g.rotate(rot); g.fillStyle = 'rgba(255,255,255,.92)'; g.fillText(n.split('').join(' '), 0, 0);
        if (yd !== 60) { const dir = (yd < 60 ? -1 : 1) * (rot ? -1 : 1); g.beginPath(); g.moveTo(dir * 2.1 * PX, -0.35 * PX); g.lineTo(dir * 2.1 * PX, 0.35 * PX); g.lineTo(dir * 2.55 * PX, 0); g.fill(); }
        g.restore();
      }
    }
    // Midfield logo.
    if (logo) { const s = 13 * PX; try { g.globalAlpha = 0.95; g.drawImage(logo, x(60) - s / 2, y(MIDY) - s / 2, s, s); g.globalAlpha = 1; } catch { /* tainted: skip */ } }
    else { g.save(); g.translate(x(60), y(MIDY)); g.fillStyle = home.colors[0]; g.beginPath(); g.arc(0, 0, 5 * PX, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `900 ${3 * PX}px "Barlow Condensed", Impact, sans-serif`; g.fillText(home.abbr, 0, 0); g.restore(); }
  }, r);
}
// ---- the component ------------------------------------------------------------------------------
export function Field3D({ ev: evIn, home, away, logo, playing: playIn, onDone, weather, night }: { ev: PlayEvent | null; home: Team; away: Team; logo?: string; playing: boolean; onDone?: () => void; weather?: Weather; night?: boolean }) {
  const lastEv = useRef<PlayEvent | null>(null);
  if (evIn) lastEv.current = evIn;
  const ev = evIn ?? lastEv.current;
  const playing = playIn && !!evIn;
  useEffect(() => { if (playIn && !evIn) onDone?.(); }, [playIn, evIn]);
  const wrap = useRef<HTMLDivElement>(null);
  const tags = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Cam>(() => { try { return (localStorage.getItem('ggm3d-cam') as Cam) || 'Broadcast'; } catch { return 'Broadcast'; } });
  const camRef = useRef(cam); camRef.current = cam;
  const [slow, setSlow] = useState(false);
  const slowRef = useRef(slow); slowRef.current = slow;
  const lineups = useMemo(() => [lineupFor(away), lineupFor(home)] as [ReturnType<typeof lineupFor>, ReturnType<typeof lineupFor>], [home.abbr, away.abbr, ev?.n]);
  const kits = useMemo(() => [kitFor(away, false), kitFor(home, true)] as const, [home.abbr, away.abbr]);
  const W = useRef<ReturnType<typeof makeWorld> | null>(null);

  // The world is built once per game.
  useEffect(() => {
    const w = makeWorld(wrap.current!, home, away, weather, night);
    W.current = w;
    if (logo) { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => w.setLogo(i); i.src = logo; }
    return () => { w.dispose(); W.current = null; };
  }, [home.abbr, away.abbr]);

  // Each play: build the scene from the engine's event and run it.
  useEffect(() => {
    const w = W.current; if (!w) return;
    const sc = ev ? buildScene(ev, lineups) : null;
    w.play(sc, kits, playing, () => onDone?.(), camRef, slowRef, tags.current!);
  }, [ev?.n, playing]);

  const pick = (c: Cam) => { setCam(c); try { localStorage.setItem('ggm3d-cam', c); } catch { /* ignore */ } };
  return (
    <div className="g3d" ref={wrap}>
      <div className="g3d-tags" ref={tags} />
      <div className="g3d-cams">{(['Broadcast', 'Behind', 'All-22', 'End zone'] as Cam[]).map(c => <button key={c} className={cam === c ? 'on' : ''} onClick={() => pick(c)}>{c}</button>)}<button className={slow ? 'on' : ''} onClick={() => setSlow(!slow)}>Slow-mo</button></div>
      {weather && <div className="g3d-wx">{weather.dome ? 'Dome' : `${weather.precip === 'none' ? (night ? 'Night' : 'Clear') : weather.precip === 'rain' ? 'Rain' : 'Snow'} · ${weather.temp}°${weather.wind >= 8 ? ` · Wind ${weather.wind} mph` : ''}`}</div>}
      {ev && <div className="g3d-dd" style={{ '--c': (ev.poss === 1 ? home : away).colors[0] } as CSSProperties}><b>{ev.type === 'kickoff' ? 'Kickoff' : ev.type === 'punt' ? 'Punt' : ev.type === 'fg' ? 'Field goal' : ev.type === 'xp' ? 'Extra point' : `${['1st', '2nd', '3rd', '4th'][ev.down - 1] ?? ''} & ${ev.yl + ev.togo >= 100 ? 'Goal' : ev.togo}`}</b>{ev.call && <span>{ev.call}</span>}{ev.dcall && <em>vs {ev.dcall}</em>}</div>}
    </div>
  );
}

// ---- the world: renderer, stadium, players, the play loop ---------------------------------------
function makeWorld(el: HTMLElement, home: Team, away: Team, weather?: Weather, nightIn?: boolean) {
  const night = !!nightIn || (!weather?.dome && (hashStr(home.abbr + away.abbr) % 3 === 0));
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = night ? 1.05 : 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const sky = night ? '#05070f' : weather?.precip !== 'none' && weather ? '#6c7686' : '#8fb8e8';
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 140, 340);
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 800);

  // Light: sun (or the stadium banks at night) with soft shadows, sky fill.
  scene.add(new THREE.HemisphereLight(night ? '#9fb4ff' : '#dbe8ff', night ? '#1a2a1a' : '#3a5a2a', night ? 0.75 : 1.05));
  const key = new THREE.DirectionalLight(night ? '#f4f6ff' : '#fff1dc', night ? 2.3 : 2.8);
  key.position.set(-30, 70, 40); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 10, far: 200 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  if (night) for (const [x, z] of [[-45, -48], [45, -48], [-45, 48], [45, 48]]) { const l = new THREE.PointLight('#ffffff', 900, 160, 1.6); l.position.set(x, 45, z); scene.add(l); }

  // Field.
  const fieldMat = new THREE.MeshStandardMaterial({ map: fieldTexture(renderer, home, away), roughness: 0.92 });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(FL + 16, FW + 16), fieldMat);
  field.rotation.x = -Math.PI / 2; field.receiveShadow = true; scene.add(field);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(FL + 60, FW + 56), new THREE.MeshStandardMaterial({ color: '#1d4a24', roughness: 1 }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; apron.receiveShadow = true; scene.add(apron);
  // Benches and team areas on both sidelines, between the 25s.
  for (const [t, zz] of [[home, FW / 2 + 9], [away, -FW / 2 - 9]] as const) {
    const area = new THREE.Mesh(new THREE.PlaneGeometry(50, 6), new THREE.MeshStandardMaterial({ color: t.colors[0], roughness: 0.9, transparent: true, opacity: 0.55 }));
    area.rotation.x = -Math.PI / 2; area.position.set(0, 0.01, zz); scene.add(area);
    for (let i = -20; i <= 20; i += 4) { const b = new THREE.Mesh(box(3.4, 0.45, 0.6), new THREE.MeshStandardMaterial({ color: '#2b2f38' })); b.position.set(i, 0.23, zz + Math.sign(zz) * 2); b.castShadow = true; scene.add(b); }
  }
  // Goalposts: college dimensions, 18.5 ft wide, crossbar 10 ft, uprights 30 ft above it, on the end lines.
  const postMat = new THREE.MeshStandardMaterial({ color: '#ffd21a', roughness: 0.35, metalness: 0.2 });
  for (const gx of [X(0), X(FL)]) {
    const g = new THREE.Group(); g.position.x = gx;
    const back = Math.sign(gx) * 2;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.33, 12), postMat); base.position.set(back, 1.66, 0); g.add(base);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, Math.abs(back), 10), postMat); neck.rotation.z = Math.PI / 2; neck.position.set(back / 2, 3.33, 0); g.add(neck);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6.17, 10), postMat); bar.rotation.x = Math.PI / 2; bar.position.y = 3.33; g.add(bar);
    for (const zz of [-3.08, 3.08]) { const up = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 10, 8), postMat); up.position.set(0, 3.33 + 5, zz); g.add(up); }
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 2, 12), new THREE.MeshStandardMaterial({ color: home.colors[0] })); pad.position.set(back, 1, 0); g.add(pad);
    g.traverse(o => { (o as THREE.Mesh).castShadow = true; }); scene.add(g);
  }
  // Pylons at the corners of each end zone.
  for (const x of [0, 10, 110, 120]) for (const y of [0, FW]) { const p = new THREE.Mesh(box(0.13, 0.6, 0.13), new THREE.MeshStandardMaterial({ color: '#ff6a00', emissive: '#331100' })); p.position.set(X(x), 0.3, Z(y)); scene.add(p); }

  // Stands: a bowl of tiers around the field, filled with fans in the home colours.
  const standMat = new THREE.MeshStandardMaterial({ color: '#2b2f3a', roughness: 0.9 });
  const wallMat = new THREE.MeshStandardMaterial({ color: home.colors[0], roughness: 0.6 });
  const crowd: { mesh: THREE.InstancedMesh; base: Float32Array } = (() => {
    const N = 9000;
    const geo = box(0.55, 0.9, 0.45);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    const base = new Float32Array(N * 3);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    const palette = [home.colors[0], home.colors[0], home.colors[0], home.colors[1] ?? '#ffffff', '#f2f2f2', '#2a2a2a', away.colors[0]];
    let i = 0;
    const place = (x: number, y: number, z: number) => { if (i >= N) return; base.set([x, y, z], i * 3); m.makeTranslation(x, y, z); mesh.setMatrixAt(i, m); col.set(palette[hashStr(`${i}`) % palette.length]).multiplyScalar(0.75 + Math.random() * 0.35); mesh.setColorAt(i, col); i++; };
    // Side stands (long sides) and end stands; tiers rise away from the field.
    for (let tier = 0; tier < 22; tier++) {
      const dz = FW / 2 + 16 + tier * 1.6, h = 2.2 + tier * 1.05;
      for (let x = -64; x <= 64; x += 1.05) { place(x + (Math.random() - 0.5) * 0.2, h + 0.45, dz); place(x + (Math.random() - 0.5) * 0.2, h + 0.45, -dz); }
      if (tier < 16) { const dx = FL / 2 + 16 + tier * 1.6; for (let z = -36; z <= 36; z += 1.1) { place(dx, h + 0.45, z); place(-dx, h + 0.45, z); } }
    }
    mesh.count = i; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    return { mesh, base };
  })();
  for (const s of [1, -1]) {
    const len = 140, depth = 22 * 1.6, rise = 22 * 1.05;
    const st = new THREE.Mesh(box(len, 1, Math.hypot(depth, rise) + 2), standMat); st.position.set(0, 2 + rise / 2, s * (FW / 2 + 16 + depth / 2)); st.rotation.x = -s * Math.atan2(rise, depth); st.receiveShadow = true; scene.add(st);
    const wall = new THREE.Mesh(box(len, 2.2, 0.6), wallMat); wall.position.set(0, 1.1, s * (FW / 2 + 14.5)); scene.add(wall);
    const end = new THREE.Mesh(box(16 * 1.6 + 2, 1, 80), standMat); end.position.set(s * (FL / 2 + 16 + 12), 2 + 8, 0); end.rotation.z = s * Math.atan2(16 * 1.05, 16 * 1.6); scene.add(end);
    const ew = new THREE.Mesh(box(0.6, 2.2, 74), wallMat); ew.position.set(s * (FL / 2 + 14.5), 1.1, 0); scene.add(ew);
  }
  // Light towers and a scoreboard over one end zone.
  for (const [x, z] of [[-55, -62], [55, -62], [-55, 62], [55, 62]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 50, 10), new THREE.MeshStandardMaterial({ color: '#59606e' })); pole.position.set(x, 25, z); scene.add(pole);
    const bank = new THREE.Mesh(box(8, 4, 0.8), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: night ? '#ffffff' : '#555555', emissiveIntensity: night ? 2.2 : 0.4 })); bank.position.set(x, 50, z); bank.lookAt(0, 0, 0); scene.add(bank);
  }
  const board = new THREE.Mesh(box(30, 12, 1), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#111' }));
  board.position.set(FL / 2 + 46, 24, 0); board.rotation.y = -Math.PI / 2; scene.add(board);
  const boardFace = new THREE.Mesh(new THREE.PlaneGeometry(28, 10), new THREE.MeshBasicMaterial({ map: canvasTex(560, 200, (g, w, h) => {
    g.fillStyle = '#0b0d12'; g.fillRect(0, 0, w, h); g.fillStyle = home.colors[0]; g.fillRect(0, 0, w, 50);
    g.font = '900 40px "Barlow Condensed", Impact, sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(home.name.toUpperCase(), w / 2, 40);
    g.font = '800 64px "Barlow Condensed", Impact, sans-serif'; g.fillText(`${away.abbr}  vs  ${home.abbr}`, w / 2, 140);
  }) }));
  boardFace.position.set(FL / 2 + 45.4, 24, 0); boardFace.rotation.y = -Math.PI / 2; scene.add(boardFace);

  // Lines on the field for the current play: line of scrimmage and the line to gain.
  const lineMat = (c: string) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false });
  const los = new THREE.Mesh(new THREE.PlaneGeometry(0.28, FW), lineMat('#3d8bff')), fd = new THREE.Mesh(new THREE.PlaneGeometry(0.28, FW), lineMat('#ffd400'));
  for (const l of [los, fd]) { l.rotation.x = -Math.PI / 2; l.position.y = 0.015; l.visible = false; scene.add(l); }

  // The ball: a prolate spheroid in leather brown with white stripes.
  const ball = new THREE.Group();
  const leather = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), new THREE.MeshStandardMaterial({ color: '#6b3a1e', roughness: 0.55 }));
  leather.scale.set(1.6, 1, 1); leather.castShadow = true; ball.add(leather);
  for (const sx of [-0.15, 0.15]) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.012, 4, 16), new THREE.MeshBasicMaterial({ color: '#fff' })); st.position.x = sx; st.rotation.y = Math.PI / 2; ball.add(st); }
  scene.add(ball);

  // Players and officials.
  const rigs: Athlete[] = [];
  const rigFor = (i: number) => { while (rigs.length <= i) { const r = new Athlete(); scene.add(r.b.root); rigs.push(r); } return rigs[i]; };
  const refs = [new Athlete(), new Athlete()];
  const refKit: Kit = { jersey: '#ffffff', num: '#111111', trim: '#111111', pants: '#f2f2f2', helmet: '#111111', mask: '#111111', socks: '#111111', glove: '#f2f2f2' };
  refs.forEach((r, i) => { r.dress(refKit, 0, SKIN[1 + i], 'ref', 72, 200, i); scene.add(r.b.root); });

  // Turf and dust kicked up by cuts and tackles: a small pool of soft sprites.
  const puffTex = canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const puffs = Array.from({ length: 90 }, () => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: '#7d8a5a', transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; scene.add(sp); return { sp, v: new THREE.Vector3(), life: 0, max: 1 }; });
  let puffI = 0;
  const kick = (p: THREE.Vector3, n: number, power: number, col = '#7d8a5a') => {
    for (let k = 0; k < n; k++) {
      const q = puffs[puffI++ % puffs.length]; q.sp.visible = true; q.sp.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.1, (Math.random() - 0.5) * 0.5));
      q.v.set((Math.random() - 0.5) * power, Math.random() * power * 0.8, (Math.random() - 0.5) * power); q.life = q.max = 0.6 + Math.random() * 0.6;
      (q.sp.material as THREE.SpriteMaterial).color.set(col); q.sp.scale.setScalar(0.3);
    }
  };

  // Weather: rain or snow as particles around the camera.
  let precip: THREE.Points | null = null;
  if (weather && !weather.dome && weather.precip !== 'none') {
    const n = weather.precip === 'rain' ? 6000 : 3500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 160, Math.random() * 60, (Math.random() - 0.5) * 120], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    precip = new THREE.Points(g, new THREE.PointsMaterial({ color: weather.precip === 'rain' ? '#aab8cc' : '#ffffff', size: weather.precip === 'rain' ? 0.12 : 0.28, transparent: true, opacity: 0.7, depthWrite: false }));
    scene.add(precip);
  }

  // Camera rig.
  const camPos = new THREE.Vector3(0, 30, 70), camAt = new THREE.Vector3(), tmp = new THREE.Vector3();
  const fit = () => { const w = el.clientWidth, h = Math.round(Math.min(w * 0.5, window.innerHeight * 0.5)); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  fit(); const ro = new ResizeObserver(fit); ro.observe(el);

  // Play state.
  let sc: Scene | null = null, kitsNow: readonly [Kit, Kit] | null = null, t = 1, playingNow = false, done: (() => void) | null = null, ended = true, tagEl: HTMLDivElement | null = null;
  let camMode: { current: Cam } = { current: 'Broadcast' }, slowMo: { current: boolean } = { current: false };
  let party = 0;
  const clock = new THREE.Clock();
  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta()), now = performance.now();
    if (sc && playingNow && t < 1) t = Math.min(1, t + (dt * (slowMo.current ? 0.35 : 1)) / sc.dur);
    if (sc && playingNow && t >= 1 && !ended) { ended = true; done?.(); }
    if (sc && kitsNow) drawPlay(dt, now);
    // Crowd: rises and bounces after a touchdown.
    if (party > 0) {
      party = Math.max(0, party - dt);
      const m = new THREE.Matrix4(), b = crowd.base;
      for (let i = 0; i < crowd.mesh.count; i++) { const j = Math.sin(now / 90 + i * 1.7) * 0.35 * Math.min(1, party); m.makeTranslation(b[i * 3], b[i * 3 + 1] + Math.max(0, j), b[i * 3 + 2]); crowd.mesh.setMatrixAt(i, m); }
      crowd.mesh.instanceMatrix.needsUpdate = true;
    }
    if (precip) { const p = precip.geometry.attributes.position as THREE.BufferAttribute; const fall = weather!.precip === 'rain' ? 38 : 6; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - fall * dt; if (y < 0) y += 60; p.setY(i, y); if (weather!.precip === 'snow') p.setX(i, p.getX(i) + Math.sin(now / 900 + i) * 0.01); } p.needsUpdate = true; precip.position.set(camAt.x, 0, camAt.z); }
    for (const q of puffs) { if (q.life <= 0) continue; q.life -= dt; q.v.y -= 3 * dt; q.sp.position.addScaledVector(q.v, dt); if (q.sp.position.y < 0.05) { q.sp.position.y = 0.05; q.v.multiplyScalar(0.5); } const k = Math.max(0, q.life / q.max); (q.sp.material as THREE.SpriteMaterial).opacity = k * 0.55; q.sp.scale.setScalar(0.3 + (1 - k) * 0.9); if (q.life <= 0) q.sp.visible = false; }
    renderer.render(scene, camera);
  };

  // Per-play memory: who was tackled and how, so falls carry real momentum.
  let tackleInfo: { carrier: number; tackler: number; dir: THREE.Vector2; speed: number; landed: boolean } | null = null;
  let cutCool = new Map<number, number>();
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

  /** Who an actor is: build from the slot and his real size from the roster. */
  function who(a: Scene['actors'][number]): { build: Build; ht: number; wt: number } {
    const p = a.id ? app.league?.players[a.id] : undefined;
    const pos = p?.pos ?? '';
    const build: Build = /^(OL|DL|FG)/.test(a.slot) || ['OT', 'G', 'C', 'DT'].includes(pos) ? 'line' : ['EDGE', 'TE', 'FB'].includes(pos) || a.slot === 'TE' ? 'big' : a.slot === 'QB' || pos === 'QB' ? 'qb' : ['K', 'P'].includes(pos) || a.slot === 'K' || a.slot === 'P' ? 'kicker' : 'skill';
    return { build, ht: p?.ht ?? (build === 'line' ? 77 : 73), wt: p?.wt ?? (build === 'line' ? 305 : build === 'big' ? 245 : 200) };
  }

  function drawPlay(dt: number, now: number) {
    const s = sc!, kits = kitsNow!;
    const dir = s.dirSign;
    los.visible = !s.kick; los.position.x = X(s.los); fd.position.x = X(s.first);
    fd.visible = !s.kick && s.first > 10 && s.first < 110;
    const D = s.dur;
    const at = (i: number, tt: number) => s.actors[i].path(Math.max(0, Math.min(1, tt)));
    const pos = s.actors.map((_, i) => at(i, t));
    // Velocity and acceleration from the play's own paths (central differences in seconds), so
    // motion reads the same at any frame rate and in slow motion.
    const e1 = 0.06 / D, e2 = 0.12 / D;
    const vel = s.actors.map((_, i) => { const a1 = at(i, t - e1), b1 = at(i, t + e1); return new THREE.Vector2((b1[0] - a1[0]) / (2 * e1 * D), (b1[1] - a1[1]) / (2 * e1 * D)); });
    const acc = s.actors.map((_, i) => { const a1 = at(i, t - e2), m = pos[i], b1 = at(i, t + e2), h = e2 * D; const v = new THREE.Vector2((b1[0] - 2 * m[0] + a1[0]) / (h * h), (b1[1] - 2 * m[1] + a1[1]) / (h * h)); return v.clampLength(0, 14); });
    const holder = s.hold ? s.hold(t) : -1;
    // Tackle: who has the ball when he is brought down, and the defender who gets there first.
    let carrier = holder, tackler = -1, downT = -1;
    if (s.tackle !== undefined && t >= s.tackle - 0.08 && s.hold) {
      let c0 = s.hold(s.tackle - 0.005); if (c0 < 0) c0 = s.hold(Math.min(0.999, s.tackle + 0.005));
      if (c0 >= 0) {
        carrier = c0; downT = (t - s.tackle) * D;
        if (s.tackler !== undefined && s.tackler >= 0) tackler = s.tackler;
        else { const cp = at(c0, s.tackle); let best = 1e9; s.actors.forEach((a, i) => { if (a.team !== s.actors[c0].team) { const q = at(i, s.tackle!); const d = Math.hypot(q[0] - cp[0], q[1] - cp[1]); if (d < best) { best = d; tackler = i; } } }); }
        if (!tackleInfo || tackleInfo.carrier !== c0) {
          const v0 = (() => { const a1 = at(c0, s.tackle! - 0.25 / D), b1 = at(c0, s.tackle!); return new THREE.Vector2((b1[0] - a1[0]) / 0.25, (b1[1] - a1[1]) / 0.25); })();
          const tv = tackler >= 0 ? (() => { const a1 = at(tackler, s.tackle! - 0.25 / D), b1 = at(tackler, s.tackle!); return new THREE.Vector2((b1[0] - a1[0]) / 0.25, (b1[1] - a1[1]) / 0.25); })() : new THREE.Vector2();
          // The pile goes the way the combined momentum goes (carrier ~ 215 lb, tackler ~ 225 lb).
          const m = v0.clone().multiplyScalar(0.48).add(tv.multiplyScalar(0.52));
          tackleInfo = { carrier: c0, tackler, dir: m.lengthSq() > 0.2 ? m.clone().normalize() : new THREE.Vector2(dir, 0), speed: m.length(), landed: false };
        }
        // The tackler closes the last yard and wraps up from the side he arrived.
        if (tackler >= 0 && downT > -0.15) { const k = Math.min(1, (downT + 0.15) / 0.25); const tp = pos[c0]; const side = new THREE.Vector2(pos[tackler][0] - tp[0], pos[tackler][1] - tp[1]); if (side.lengthSq() < 1e-4) side.set(-dir, 0); side.normalize().multiplyScalar(0.45); pos[tackler] = [pos[tackler][0] + (tp[0] + side.x - pos[tackler][0]) * k, pos[tackler][1] + (tp[1] + side.y - pos[tackler][1]) * k]; }
      }
    }
    const after = s.endAt !== undefined && t > s.endAt + 0.01;
    const scorer = s.td && s.hold && s.endAt !== undefined ? s.hold(s.endAt - 0.005) : -1;
    if (s.td && after && party === 0) party = 3.5;
    const pre = !s.kick && t < s.pre + 0.01;
    // Engagements: linemen within arm's length of an opponent after the snap.
    const engaged = new Map<number, number>();
    if (!pre && !after && !s.kick) s.actors.forEach((a, i) => {
      if (!/^(OL|DL|TE)/.test(a.slot) && a.slot !== 'TE' && a.slot !== 'RB') return;
      let best = 1.25, bj = -1;
      s.actors.forEach((o, j) => { if (o.team !== a.team && j !== holder) { const d = Math.hypot(pos[j][0] - pos[i][0], pos[j][1] - pos[i][1]); if (d < best) { best = d; bj = j; } } });
      if (bj >= 0 && (a.slot.startsWith('OL') || a.slot.startsWith('DL') || vel[i].length() < 3.5)) { engaged.set(i, bj); if (!engaged.has(bj) && /^(DL|LB)/.test(s.actors[bj].slot)) engaged.set(bj, i); }
    });
    // Bodies don't overlap: push apart anyone not engaged, tackling or celebrating together.
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
      if (engaged.get(i) === j || engaged.get(j) === i || (tackleInfo && downT > -0.15 && [i, j].includes(tackleInfo.carrier) && [i, j].includes(tackleInfo.tackler))) continue;
      const dx = pos[j][0] - pos[i][0], dy = pos[j][1] - pos[i][1], d = Math.hypot(dx, dy), min = 0.62;
      if (d < min && d > 1e-4) { const k = (min - d) / 2 / d; pos[i] = [pos[i][0] - dx * k, pos[i][1] - dy * k]; pos[j] = [pos[j][0] + dx * k, pos[j][1] + dy * k]; }
    }
    const [bx0, by0] = s.ball(t), bh0 = s.ballH(t);
    const ballW = new THREE.Vector3(X(bx0), Math.max(0.15, bh0), Z(by0));
    const qbW = (() => { const q = s.actors.findIndex(a => a.team === s.off && a.slot === 'QB'); return q >= 0 ? new THREE.Vector3(X(pos[q][0]), 1.6, Z(pos[q][1])) : ballW; })();

    s.actors.forEach((a, i) => {
      const r = rigFor(i); r.b.root.visible = true;
      const w = who(a);
      r.dress(kits[a.team], a.num, a.skin ?? SKIN[(a.id ? hashStr(a.id) : a.num) % SKIN.length], w.build, w.ht, w.wt, a.id ? hashStr(a.id) : a.num);
      const [x, y] = pos[i];
      const isOff = a.team === s.off;
      const v = vel[i], speed = v.length();
      // Facing: where he is going when moving; at the line toward the other goal; blockers square up.
      let yaw = r.yaw;
      if (pre && speed < 0.8) yaw = Math.atan2(isOff ? dir : -dir, 0);
      else if (speed > 0.6) yaw = Math.atan2(v.x, v.y);
      let act: Act = speed > 0.35 ? 'move' : 'idle';
      const d: Drive = { act, vel: v, acc: acc[i], beat: 0, look: ballW };
      const opp = engaged.get(i);
      if (pre && speed < 0.8) {
        d.act = a.slot.startsWith('OL') || a.slot.startsWith('DL') ? 'stance3' : a.slot === 'QB' ? 'stanceQB' : a.slot === 'RB' ? 'stanceRB' : ['X', 'Z', 'S', 'TE'].includes(a.slot) ? (a.slot === 'TE' && hashStr(a.slot + a.num) % 2 ? 'stance3' : 'stance2') : 'stanceD';
      } else if (tackleInfo && i === tackleInfo.carrier && downT >= 0) {
        d.act = 'down'; d.fallDir = tackleInfo.dir; d.fallSpeed = tackleInfo.speed;
      } else if (tackleInfo && i === tackleInfo.tackler && downT > -0.18) {
        d.act = downT < 0.05 ? 'tackle' : 'down'; d.fallDir = tackleInfo.dir; d.fallSpeed = tackleInfo.speed * 0.9;
        d.reach = new THREE.Vector3(X(pos[tackleInfo.carrier][0]), 1.0, Z(pos[tackleInfo.carrier][1]));
        yaw = Math.atan2(pos[tackleInfo.carrier][0] - x, pos[tackleInfo.carrier][1] - y);
      } else if (s.kicker === i && s.kickAt !== undefined && Math.abs(t - s.kickAt) * D < 0.4) { d.act = 'kick'; d.beat = (t - s.kickAt) * D; yaw = Math.atan2(dir, 0); }
      else if (s.qb === i && s.throwAt !== undefined && (t - s.throwAt) * D > -0.5 && (t - s.throwAt) * D < 0.35) {
        d.act = 'throw'; d.beat = (t - s.throwAt) * D;
        const tg = s.target !== undefined && s.target >= 0 ? pos[s.target] : [x + dir * 10, y];
        yaw = Math.atan2(tg[0] - x, tg[1] - y) - 0.35 * Math.sign(dir || 1) * 0;   // shoulders open to the target
        d.look = new THREE.Vector3(X(tg[0]), 1.5, Z(tg[1]));
      } else if ((i === s.target || (s.int && i === holder)) && s.catchAt !== undefined && (t - s.catchAt) * D > -0.4 && (t - s.catchAt) * D < 0.2) {
        d.act = 'catch'; d.beat = (t - s.catchAt) * D; d.reach = ballW.clone();
        if (d.beat < 0) yaw = Math.atan2(ballW.x - X(x), ballW.z - Z(y)) * 0.5 + yaw * 0.5;
      } else if (s.td && after && (i === scorer || (isOff && scorer >= 0 && Math.hypot(x - pos[scorer][0], y - pos[scorer][1]) < 8))) d.act = 'party';
      else if (i === holder && !(s.qb === i && pre)) {
        d.act = speed > 0.5 ? 'carry' : 'idle';
        // Ball in the arm away from the nearest defender (or toward the sideline).
        let nd = 1e9, nx = 0, ny = 0; s.actors.forEach((o, j) => { if (o.team !== a.team) { const q = pos[j]; const dd = Math.hypot(q[0] - x, q[1] - y); if (dd < nd) { nd = dd; nx = q[0] - x; ny = q[1] - y; } } });
        const rightV = new THREE.Vector2(Math.cos(r.yaw), -Math.sin(r.yaw));
        d.ballHand = rightV.dot(new THREE.Vector2(nx, ny)) > 0 ? 'L' : 'R';
        d.look = new THREE.Vector3(X(x + v.x), 1.6, Z(y + v.y));
      } else if (opp !== undefined) {
        d.act = isOff ? 'block' : 'rush';
        yaw = Math.atan2(pos[opp][0] - x, pos[opp][1] - y);
      } else if (!isOff && !s.kick && !after && speed > 0.6 && (s.throwAt === undefined || t < s.throwAt) && Math.sign(v.x) === dir && !/^(DL)/.test(a.slot)) {
        // Defenders backpedal facing the quarterback while the ball is still in his hands.
        yaw = Math.atan2(-dir, 0); d.look = qbW;
      }
      if (!isOff && !pre) d.look = holder >= 0 ? new THREE.Vector3(X(pos[holder][0]), 1.4, Z(pos[holder][1])) : ballW;
      // Smooth turning: a running body can only rotate so fast.
      let dy = yaw - r.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      r.yaw += dy * (1 - Math.exp(-dt * (speed > 6 ? 7 : 12)));
      r.b.root.position.set(X(x), 0, Z(y));
      r.update(d, dt, now);
      // Hard cuts throw up turf.
      const lat = acc[i].length();
      if (playingNow && t < 1 && lat > 9 && speed > 4 && (cutCool.get(i) ?? 0) < now) { cutCool.set(i, now + 400); kick(new THREE.Vector3(X(x), 0.05, Z(y)), 3, 2.2); }
    });
    if (tackleInfo && downT > 0.32 && !tackleInfo.landed) { tackleInfo.landed = true; const c = pos[tackleInfo.carrier]; kick(new THREE.Vector3(X(c[0]) + tackleInfo.dir.x * 1.2, 0.05, Z(c[1]) + tackleInfo.dir.y * 1.2), 10, 3.2); }
    for (let i = s.actors.length; i < rigs.length; i++) rigs[i].b.root.visible = false;
    // Officials: referee behind the offense, line judge on the sideline; both run to the spot.
    {
      const spot = carrier >= 0 ? pos[carrier] : s.ball(t);
      const whistle = s.endAt ?? s.tackle ?? 1;
      const k = t > whistle ? Math.min(1, ((t - whistle) * D) / 1.1) : 0;
      const ra: [number, number] = [s.los - dir * 12 + (spot[0] - dir * 3 - (s.los - dir * 12)) * k, MIDY + 3 + (spot[1] + 3 - (MIDY + 3)) * k];
      const rb: [number, number] = [s.los + dir + (spot[0] - (s.los + dir)) * k * 0.8, FW + 1];
      [ra, rb].forEach(([x, y], i) => {
        const r = refs[i]; const moving = k > 0 && k < 1;
        r.b.root.position.set(X(x), 0, Z(y));
        r.yaw = moving ? Math.atan2(spot[0] - x, spot[1] - y) : Math.atan2(-dir, 0) + (i ? Math.PI / 2 : 0);
        r.update({ act: s.td && after && i === 0 ? 'signal' : moving ? 'move' : 'idle', vel: new THREE.Vector2(moving ? 4 : 0, 0), acc: new THREE.Vector2(), beat: 0, look: ballW }, dt, now);
      });
    }
    // The ball: in the carrier's arm, in the quarterback's hands, or in flight (a tight spiral on
    // passes, end over end on kicks) along the engine's path.
    const qbI = s.qb ?? -1;
    const throwing = qbI >= 0 && holder === qbI && s.throwAt !== undefined && (t - s.throwAt) * D > -0.5 && t < s.throwAt;
    if (holder >= 0 && bh0 < 2.2 && !pre) {
      const r = rigs[holder];
      const tuck = r === rigs[carrier] && downT >= 0 ? 'R' : undefined;
      if (throwing) { r.handWorld('R', tmpV); ball.position.copy(tmpV); r.forearmQuat('R', tmpQ); ball.quaternion.copy(tmpQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)); }
      else {
        const hand: 'L' | 'R' = tuck ?? (rigs[holder] && (s.actors[holder].slot === 'QB' && vel[holder].length() < 2) ? 'R' : 'R');
        r.handWorld(hand, tmpV); ball.position.copy(tmpV).add(new THREE.Vector3(0, 0.04, 0));
        r.forearmQuat(hand, tmpQ); ball.quaternion.copy(tmpQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
      }
    } else {
      ball.position.copy(ballW);
      const [nx, ny] = s.ball(Math.min(1, t + 0.01)), nh = s.ballH(Math.min(1, t + 0.01));
      const vdir = new THREE.Vector3(X(nx) - ballW.x, Math.max(0.15, nh) - ballW.y, Z(ny) - ballW.z);
      if (vdir.lengthSq() > 1e-6) {
        vdir.normalize();
        const base = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), vdir);
        if (s.kick && bh0 > 0.8) { const side = new THREE.Vector3().crossVectors(vdir, new THREE.Vector3(0, 1, 0)).normalize(); ball.quaternion.setFromAxisAngle(side, now / 70).multiply(base); }
        else ball.quaternion.copy(base).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), now / 16));
      }
    }
    // Shadow frustum follows the action.
    key.target.position.set(ball.position.x, 0, ball.position.z); key.position.set(ball.position.x - 30, 70, ball.position.z + 40);
    updateCamera(dt, s, carrier);
    updateTags(s, pos, carrier);
  }

  function updateCamera(dt: number, s: Scene, carrier: number) {
    const dir = s.dirSign;
    const target = tmp.set(ball.position.x, 0, ball.position.z);
    if (!s.kick && t < s.pre) target.set(X(s.los + dir * 6), 0, Z(MIDY));
    let want: THREE.Vector3, look: THREE.Vector3;
    const lead = (() => { const [a] = s.ball(Math.min(1, t)), [b] = s.ball(Math.min(1, t + 0.06)); return Math.max(-8, Math.min(8, (b - a) * 3)); })();
    switch (camMode.current) {
      case 'Behind': want = new THREE.Vector3(target.x - dir * 15, 7.5, target.z * 0.6); look = new THREE.Vector3(target.x + dir * 10, 0, target.z * 0.8); break;
      case 'All-22': want = new THREE.Vector3(target.x - dir * 30, 46, 0); look = new THREE.Vector3(target.x + dir * 6, 0, 0); break;
      case 'End zone': want = new THREE.Vector3(X(dir > 0 ? 128 : -8), 22, target.z * 0.3); look = new THREE.Vector3(target.x, 0, target.z * 0.5); break;
      default: want = new THREE.Vector3(target.x + lead * 0.6, 19, FW / 2 + 20); look = new THREE.Vector3(target.x + lead, 0, target.z * 0.35 + 2);
    }
    // Tighter shot on the ball carrier late in a play.
    if (camMode.current === 'Broadcast' && carrier >= 0 && t > 0.6) want.lerp(new THREE.Vector3(look.x, 13, FW / 2 + 13), 0.35);
    const k = 1 - Math.exp(-dt * 3.2);
    camPos.lerp(want, k); camAt.lerp(look, k * 1.3);
    camera.position.copy(camPos); camera.lookAt(camAt);
  }

  /** Name tags over the ball carrier and the target, projected onto the screen. */
  function updateTags(s: Scene, pos: [number, number][], carrier: number) {
    if (!tagEl) return;
    const who = new Set<number>(); if (carrier >= 0) who.add(carrier); if (s.target !== undefined && s.target >= 0 && s.throwAt !== undefined && t > s.throwAt && t < (s.catchAt ?? 1) + 0.02) who.add(s.target);
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    const html: string[] = [];
    for (const i of who) {
      const a = s.actors[i]; if (!a?.ln) continue;
      const v = new THREE.Vector3(X(pos[i][0]), 2.6, Z(pos[i][1])).project(camera);
      if (v.z > 1) continue;
      html.push(`<span style="left:${((v.x + 1) / 2) * w}px;top:${((1 - v.y) / 2) * h}px;--tc:${kitsNow![a.team].jersey === '#f4f4f4' ? kitsNow![a.team].trim : kitsNow![a.team].jersey}">${a.num} ${a.ln.toUpperCase()}</span>`);
    }
    tagEl.innerHTML = html.join('');
  }

  frame();
  return {
    setLogo(img: HTMLImageElement) { const old = fieldMat.map; fieldMat.map = fieldTexture(renderer, home, away, img); fieldMat.needsUpdate = true; old?.dispose(); },
    play(next: Scene | null, kits: readonly [Kit, Kit], isPlaying: boolean, onEnd: () => void, cm: { current: Cam }, slow: { current: boolean }, tags: HTMLDivElement) {
      tagEl = tags; camMode = cm; slowMo = slow;
      if (!next) return;
      sc = next; kitsNow = kits; playingNow = isPlaying; done = onEnd; ended = !isPlaying; t = isPlaying ? 0 : 1; tackleInfo = null; cutCool = new Map();
    },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); }); },
  };
}
