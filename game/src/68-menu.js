// =====================================================================
//  Case files: the main menu is a detective's office at night
// =====================================================================
// A desk under a green banker's lamp, rain on the window and the city's neon bleeding through the
// blinds. The folders on the desk are the menu: point at one and it lifts, click it and it comes up
// to you and opens on the dossier. DEPLOY loads that case's map; the personnel file is the operator.
const MENU = (() => {
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x05060a);
  const cam = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.02, 60);
  const base = { pos: new V3(0, 1.3, 0.62), look: new V3(0, 0.95, -1.2) };
  let active = false, built = false, hover = null, opened = null, openT = 0, t = 0, fan = null, rain = null, mouse = { x: 0, y: 0 }, smoke = [];
  const ray = new THREE.Raycaster(), files = [];
  const readLight = new THREE.PointLight(0xfff0d8, 0, 2.5, 1.5); sc.add(readLight);   // a soft reading light when a file is up
  const std = (c, r = 0.7, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });
  const box = (w, h, d, mat, x, y, z, p = sc, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; p.add(m); return m; };
  const cyl = (rt, rb, h, mat, x, y, z, p = sc, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; p.add(m); return m; };
  const tex = (w, h, draw) => { const t2 = canvasTex(w, h, draw); t2.anisotropy = 4; return t2; };

  // ---------------- the cases ----------------
  const CASES = [
    { id: 'dar', no: '01', intel: 'The militia holds the kasbah and the palace on the hill. A uniform opens their doors — walk, don’t run, keep your weapon down. Bottles and stones thrown into a lane will pull a sentry off his post.', title: 'DAR ESSALAM', place: 'Morocco · walled harbour town · day', tab: '#c9a45c',
      lines: ['A militia has taken the old kasbah of a coastal', 'town. Our people are still inside the medina.', '', 'OBJECTIVES', '· Recover the dead drop in the riad Dar Lamia', '· Remove Captain Haddad (minaret overwatch)', '· Infiltrate the kasbah HQ in their uniform', '· Tail the courier through the souk', '· The palace of Dar el Makhzen is heavily guarded', '· Exfil by boat from the harbour'],
      photo: (g, w, h) => { const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#8fb4dc'); sky.addColorStop(1, '#f0d8b0'); g.fillStyle = sky; g.fillRect(0, 0, w, h); g.fillStyle = '#2a6a8a'; g.fillRect(0, h * 0.78, w, h); g.fillStyle = '#c8986a'; for (let i = 0; i < 14; i++) { const bw = 18 + (i * 37) % 30, bh = 30 + (i * 53) % 60; g.fillRect(i * 22 - 10, h * 0.78 - bh, bw, bh); } g.fillStyle = '#d8b88a'; g.fillRect(w * 0.62, h * 0.18, 26, h * 0.6); g.fillStyle = '#2a6a4a'; g.fillRect(w * 0.62 - 3, h * 0.15, 32, 10); } },
    { id: 'seoul', no: '02', intel: 'Two crews split the district: the Black Dragons hold Mapo’s bar streets, the Blue Snakes Gangnam. Their own men’s clothes fool only them. Line 2 runs under all of it — five stations, trains every few minutes.', title: 'NEON SEOUL', place: 'South Korea · back streets of Mapo-gu · night', tab: '#e0408a',
      lines: ['A broker is selling the papers we took from the', 'kasbah to a gang that runs the night markets.', '', 'OBJECTIVES', '· Meet the informant at the 24-hour store', '· Find the gang’s lieutenant in the food alley', '· Get the drive off him — however you have to', '· Lose the gang in the alleys, reach the subway'],
      photo: (g, w, h) => { g.fillStyle = '#0a0a18'; g.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) { const x = i * 24, bh = 60 + (i * 41) % 90; g.fillStyle = '#14142a'; g.fillRect(x, h - bh, 22, bh); for (let k = 0; k < 10; k++) { g.fillStyle = ['#ff2a8a', '#2af0ff', '#ffd040', '#8a5aff'][(i + k) % 4]; if ((i * 7 + k * 3) % 5 === 0) g.fillRect(x + 4, h - bh + 8 + k * 12, 14, 5); } } g.fillStyle = 'rgba(255,40,140,0.25)'; g.fillRect(0, h * 0.85, w, h); } },
    { id: 'manor', no: '03', title: 'RAVENSCROFT', place: 'England · a walled country estate · the night of a gala', tab: '#6a8ac0',
      intel: 'Private security in dark suits and earpieces, posts at every gate and door; the upper floor is off limits to guests. The service gate is guarded. Winter brought down a stretch of the west wall. Guests are fair game for their clothes — out of sight.',
      lines: ['Lord Ashdown keeps a ledger of every bribe he', 'has ever paid. Tonight he throws a gala.', '', 'OBJECTIVES', '· Get inside the walls and dress for the party', '· Meet the sommelier; lift the safe code', '· Take the ledger from the study upstairs', '· Get out across the lake'],
      photo: (g, w, h) => { const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#2a3460'); sky.addColorStop(1, '#e8905a'); g.fillStyle = sky; g.fillRect(0, 0, w, h); g.fillStyle = '#1e2a1e'; g.fillRect(0, h * 0.72, w, h); g.fillStyle = '#d8cdb8'; g.fillRect(w * 0.22, h * 0.42, w * 0.56, h * 0.32); g.fillStyle = '#4a5058'; g.beginPath(); g.moveTo(w * 0.2, h * 0.43); g.lineTo(w * 0.5, h * 0.28); g.lineTo(w * 0.8, h * 0.43); g.fill(); g.fillStyle = '#ffd890'; for (let r = 0; r < 2; r++) for (let k = 0; k < 9; k++) g.fillRect(w * 0.26 + k * w * 0.055, h * 0.5 + r * h * 0.11, w * 0.025, h * 0.06); } },
    { id: 'bahamas', no: '04', title: 'PARADISE', place: 'The Bahamas · Eleuthera · a resort, a private island · day', tab: '#2ab0b0',
      intel: 'Kane’s marine security wear white polos or black wetsuits; grey patrol boats circle his island and see you from thirty metres. Tourists ride the resort jetskis all day. You can wade the shallows but not swim the channels.',
      lines: ['Victor Kane washes money for half the files on', 'this desk, from a private island off Eleuthera.', '', 'OBJECTIVES', '· Meet the bartender at the Conch Bar', '· Take a jetski from the rental dock', '· Steal Kane’s laptop from his island house', '· Reach the seaplane off Sandy Cay'], photo: null },
    { id: 'op', no: 'P', title: 'PERSONNEL', place: 'Operator file · loadout & appearance', tab: '#7a8a6a',
      lines: ['Your own file. Change your face, your clothes,', 'your kit and your weapons before you go in.'], photo: null },
  ];
  function coverTex(c) {
    return tex(512, 384, (g, w, h) => {
      g.fillStyle = '#c8a86a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${70 + Math.random() * 40},30,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 1 + Math.random() * 2); }
      g.strokeStyle = 'rgba(80,60,30,0.35)'; g.lineWidth = 3; g.strokeRect(14, 14, w - 28, h - 28);
      g.fillStyle = '#2a2018'; g.font = '700 30px "Courier New",monospace'; g.fillText(c.id === 'op' ? 'PERSONNEL FILE' : `CASE FILE ${c.no}`, 36, 70);
      g.font = '700 46px "Courier New",monospace'; g.fillText(c.title, 36, 140);
      g.font = '22px "Courier New",monospace'; g.fillStyle = '#4a3a28'; g.fillText(c.place, 36, 180);
      g.save(); g.translate(w - 150, h - 90); g.rotate(-0.18); g.strokeStyle = 'rgba(170,30,25,0.85)'; g.lineWidth = 5; g.strokeRect(-110, -32, 220, 64); g.fillStyle = 'rgba(170,30,25,0.85)'; g.font = '700 30px "Courier New",monospace'; g.textAlign = 'center'; g.fillText(c.id === 'op' ? 'EYES ONLY' : 'TOP SECRET', 0, 11); g.restore();
    });
  }
  // a print of a real photo of the place: white border, a strip of tape, slightly faded
  function print(g, img, x, y, w, h, rot) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-8, -6, w + 28, h + 52);
    g.fillStyle = '#fbfaf6'; g.fillRect(-12, -12, w + 24, h + 46);
    if (img && img.complete && img.naturalWidth) { g.filter = 'saturate(0.82) contrast(1.06) sepia(0.12)'; const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * s, ih = img.naturalHeight * s; g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip(); g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih); g.restore(); g.filter = 'none'; }
    else { g.fillStyle = '#2a2622'; g.fillRect(0, 0, w, h); }
    g.fillStyle = 'rgba(220,210,180,0.75)'; g.fillRect(w / 2 - 40, -22, 80, 26);
    g.restore();
  }
  // redraw a texture once its photos have decoded
  function whenPhotos(id, t, w, h, draw) { for (const img of CASE_IMG[id] || []) if (!img.complete) img.addEventListener('load', () => { draw(t.image.getContext('2d'), w, h); t.needsUpdate = true; }); }
  function pageTex(c) {
    const draw = (g, w, h) => {
      g.fillStyle = '#f2ead6'; g.fillRect(0, 0, w, h);
      for (let y = 120; y < h; y += 34) { g.fillStyle = 'rgba(80,110,160,0.10)'; g.fillRect(0, y, w, 1); }
      g.fillStyle = '#1a1612'; g.font = '700 40px "Courier New",monospace'; g.fillText(c.id === 'op' ? 'OPERATOR' : `CASE ${c.no} — ${c.title}`, 50, 76);
      g.font = '24px "Courier New",monospace'; g.fillStyle = '#5a4a38'; g.fillText(c.place, 50, 112);
      g.font = '25px "Courier New",monospace'; g.fillStyle = '#1e1a16';
      c.lines.forEach((l, i) => { g.font = (l === 'OBJECTIVES' ? '700 ' : '') + '20px "Courier New",monospace'; g.fillText(l, 50, 180 + i * 34, c.photo ? 600 : 900); });
      const P2 = CASE_IMG[c.id];
      if (P2 && P2.length) { print(g, P2[1] || P2[0], w - 330, 330, 260, 170, -0.06); print(g, P2[0], w - 360, 150, 290, 190, 0.05); }
      g.save(); g.translate(w - 240, h - 110); g.rotate(-0.12); g.strokeStyle = 'rgba(170,30,25,0.8)'; g.lineWidth = 5; g.strokeRect(-150, -40, 300, 80); g.fillStyle = 'rgba(170,30,25,0.8)'; g.font = '700 38px "Courier New",monospace'; g.textAlign = 'center'; g.fillText(c.id === 'op' ? 'CLEARED' : 'AUTHORISED', 0, 13); g.restore();
    };
    const t = tex(1024, 768, draw); whenPhotos(c.id, t, 1024, 768, draw); return t;
  }

  // ---------------- the office ----------------
  function build() {
    built = true;
    const wood = std(0x3a2416, 0.55), woodLt = std(0x5a3a22, 0.6), wall = std(0x1e2a24, 0.9), floor = std(0x2a1a10, 0.75), brass = std(0xc0973f, 0.3, 0.9), black = std(0x141414, 0.5, 0.3);
    // room 5 × 3 × 4.2
    box(5, 0.05, 4.2, floor, 0, -0.02, -0.4); box(5, 0.05, 4.2, std(0x141614, 0.9), 0, 3, -0.4);
    for (const [w, h, x, z, ry] of [[5, 3, 0, -2.5, 0], [4.2, 3, -2.5, -0.4, Math.PI / 2], [4.2, 3, 2.5, -0.4, -Math.PI / 2], [5, 3, 0, 1.7, Math.PI]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; sc.add(g);
      if (!(x === 0 && z === -2.5)) box(w, h, 0.05, wall, 0, h / 2, 0, g);
      box(w, 1.0, 0.07, wood, 0, 0.5, 0.02, g); box(w, 0.06, 0.1, woodLt, 0, 1.02, 0.04, g);
    }
    // back wall with the window: frame, blinds, the city behind
    box(1.3, 3, 0.05, wall, -1.85, 1.5, -2.5); box(1.3, 3, 0.05, wall, 1.85, 1.5, -2.5); box(2.4, 0.9, 0.05, wall, 0, 0.45, -2.5); box(2.4, 0.5, 0.05, wall, 0, 2.75, -2.5);
    box(5, 1.0, 0.07, wood, 0, 0.5, -2.48); box(5, 0.06, 0.1, woodLt, 0, 1.02, -2.46);
    for (const [w, h, x, y] of [[2.5, 0.08, 0, 0.9], [2.5, 0.08, 0, 2.5], [0.08, 1.7, -1.22, 1.7], [0.08, 1.7, 1.22, 1.7], [0.05, 1.6, 0, 1.7]]) box(w, h, 0.1, woodLt, x, y, -2.47);
    const city = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshBasicMaterial({ map: tex(1024, 576, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#05030c'); sky.addColorStop(0.6, '#1a0a26'); sky.addColorStop(1, '#3a1030'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { const bw = 20 + Math.random() * 50, bh = 80 + Math.random() * 360, x = Math.random() * w; g.fillStyle = `rgb(${10 + Math.random() * 12},${8 + Math.random() * 10},${20 + Math.random() * 16})`; g.fillRect(x, h - bh, bw, bh); for (let k = 0; k < bh / 9; k++) for (let j = 0; j < bw / 8; j++) if (Math.random() < 0.25) { g.fillStyle = Math.random() < 0.85 ? 'rgba(255,220,150,0.7)' : 'rgba(120,220,255,0.8)'; g.fillRect(x + 2 + j * 8, h - bh + 4 + k * 9, 4, 4); } }
      g.font = '700 46px sans-serif'; for (const [s, x, y, c] of [['편의점', 120, 330, '#2af0ff'], ['노래방', 520, 270, '#ff2a8a'], ['치킨', 780, 380, '#ffd040'], ['24', 300, 420, '#ff4a4a'], ['PC방', 640, 450, '#8a5aff']]) { g.shadowColor = c; g.shadowBlur = 24; g.fillStyle = c; g.fillText(s, x, y); }
    }), toneMapped: false }));
    city.position.set(0, 1.5, -4.2); sc.add(city);
    const slats = new THREE.Group(); sc.add(slats);
    for (let y = 2.42; y > 0.98; y -= 0.075) box(2.36, 0.012, 0.06, std(0xc8c0b0, 0.5), 0, y, -2.42, slats, 0.5);
    // rain on the glass: streaks drifting down
    const rc = document.createElement('canvas'); rc.width = 256; rc.height = 256; const rg = rc.getContext('2d'); rg.strokeStyle = 'rgba(200,220,255,0.35)';
    for (let i = 0; i < 160; i++) { const x = Math.random() * 256, y = Math.random() * 256, L = 6 + Math.random() * 18; rg.lineWidth = Math.random() < 0.2 ? 1.6 : 0.8; rg.beginPath(); rg.moveTo(x, y); rg.lineTo(x + 1, y + L); rg.stroke(); }
    const rt = new THREE.CanvasTexture(rc); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(3, 2);
    rain = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshBasicMaterial({ map: rt, transparent: true, depthWrite: false, toneMapped: false })); rain.position.set(0, 1.7, -2.49); sc.add(rain);
    // desk
    box(1.9, 0.06, 0.95, wood, 0, 0.76, -0.3); box(1.88, 0.02, 0.9, std(0x1e3a2a, 0.9), 0, 0.795, -0.3);   // green leather top
    for (const sx of [-1, 1]) { box(0.5, 0.72, 0.85, woodLt, sx * 0.68, 0.37, -0.3); for (let k = 0; k < 3; k++) { box(0.44, 0.18, 0.02, wood, sx * 0.68, 0.13 + k * 0.22, 0.13); box(0.08, 0.02, 0.03, brass, sx * 0.68, 0.17 + k * 0.22, 0.15); } }
    box(0.86, 0.6, 0.04, wood, 0, 0.4, -0.72);
    // banker's lamp
    const lampG = new THREE.Group(); lampG.position.set(-0.62, 0.8, -0.52); sc.add(lampG);
    cyl(0.09, 0.11, 0.03, brass, 0, 0.015, 0, lampG); cyl(0.012, 0.012, 0.32, brass, 0, 0.17, 0, lampG);
    const shade2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.42, 16, 1, true, 0, Math.PI), std(0x1a6a3a, 0.25, 0.1)); shade2.rotation.set(0, 0, Math.PI / 2); shade2.rotation.order = 'ZXY'; shade2.position.set(0.1, 0.34, 0); lampG.add(shade2);
    const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c8, toneMapped: false })); bulb.rotation.z = Math.PI / 2; bulb.position.set(0.1, 0.31, 0); lampG.add(bulb);
    const lamp = new THREE.PointLight(0xffd9a0, 2.6, 4, 1.6); lamp.position.set(-0.52, 1.08, -0.5); lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -0.002; sc.add(lamp);
    const neonA = new THREE.PointLight(0xff2a8a, 1.6, 6, 1.4); neonA.position.set(-0.8, 1.8, -2.2); sc.add(neonA);
    const neonB = new THREE.PointLight(0x2ad0ff, 1.1, 6, 1.4); neonB.position.set(0.9, 1.4, -2.2); sc.add(neonB);
    sc.add(new THREE.HemisphereLight(0x1a2030, 0x0a0806, 0.35));
    // things on the desk
    const paper = std(0xeee6d2, 0.9);
    const typewriter = new THREE.Group(); typewriter.position.set(0.55, 0.81, -0.5); typewriter.rotation.y = -0.25; sc.add(typewriter);
    box(0.36, 0.1, 0.3, black, 0, 0.05, 0, typewriter); box(0.32, 0.06, 0.14, black, 0, 0.12, -0.06, typewriter, -0.4); cyl(0.025, 0.025, 0.42, std(0x222222, 0.4), 0, 0.17, -0.1, typewriter).rotation.z = Math.PI / 2;
    box(0.22, 0.002, 0.24, paper, 0, 0.22, -0.18, typewriter, -1.2);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) cyl(0.011, 0.011, 0.01, std(0xd8d0c0, 0.5), -0.12 + k * 0.03 + r * 0.008, 0.11 + r * 0.012, 0.05 + r * 0.03, typewriter, 8);
    const mug = cyl(0.045, 0.04, 0.1, std(0xe8e0d0, 0.4), 0.78, 0.85, -0.12); cyl(0.04, 0.04, 0.002, std(0x2a1408, 0.2), 0.78, 0.895, -0.12);
    const ash = cyl(0.07, 0.06, 0.03, std(0x6a7a8a, 0.15, 0.6), -0.4, 0.815, -0.08); void mug; void ash;
    const cig = box(0.06, 0.008, 0.008, std(0xf0f0e8), -0.36, 0.835, -0.08); void cig;
    for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: 0xa0a0a8, transparent: true, opacity: 0.12, depthWrite: false })); s.userData.p = i / 18; sc.add(s); smoke.push(s); }
    // a stack of old case binders
    for (let k = 0; k < 4; k++) box(0.24, 0.045, 0.32, std([0x5a1a1a, 0x1a2a4a, 0x2a3a2a, 0x4a3a2a][k], 0.7), -0.72, 0.825 + k * 0.046, -0.22 + (k % 2) * 0.01, sc, 0, 0.15 + k * 0.08);
    for (let i = 0; i < 5; i++) box(0.21, 0.002, 0.29, paper, -0.15 + Math.random() * 0.25, 0.8 + i * 0.002, -0.62 + Math.random() * 0.06, sc, 0, Math.random() - 0.5);
    const pistolG = new THREE.Group(); pistolG.position.set(0.35, 0.805, -0.05); pistolG.rotation.set(0, 1.9, Math.PI / 2); sc.add(pistolG); box(0.03, 0.18, 0.03, black, 0, 0.06, 0, pistolG); box(0.032, 0.03, 0.11, black, 0, 0.14, 0.03, pistolG);
    // corkboard with photos and red string, a wall clock, filing cabinet, coat on a stand
    const cork = new THREE.Group(); cork.position.set(-2.46, 1.75, -0.6); cork.rotation.y = Math.PI / 2; sc.add(cork);
    box(1.6, 1.0, 0.03, std(0x8a6a44, 0.95), 0, 0, 0, cork); const pins = [];
    for (let i = 0; i < 7; i++) { const x = -0.6 + (i % 4) * 0.4 + Math.random() * 0.06, y = 0.25 - Math.floor(i / 4) * 0.45; box(0.18, 0.13, 0.004, std(i % 3 ? 0xe8e0d0 : 0xd8c8a0, 0.8), x, y, 0.02, cork, 0, 0, Math.random() * 0.3 - 0.15); pins.push([x, y + 0.05]); box(0.012, 0.012, 0.012, std(0xc0201a), x, y + 0.055, 0.025, cork); }
    for (let i = 0; i < pins.length - 1; i += 1) { const [ax, ay] = pins[i], [bx, by] = pins[(i * 3 + 2) % pins.length], L = Math.hypot(bx - ax, by - ay); box(L, 0.004, 0.003, std(0xc0201a, 0.6), (ax + bx) / 2, (ay + by) / 2, 0.03, cork, 0, 0, Math.atan2(by - ay, bx - ax)); }
    const clock = new THREE.Group(); clock.position.set(2.46, 2.1, -1.0); clock.rotation.y = -Math.PI / 2; sc.add(clock);
    cyl(0.18, 0.18, 0.04, wood, 0, 0, 0, clock, 24).rotation.x = Math.PI / 2; const face = cyl(0.16, 0.16, 0.01, std(0xf0e8d8, 0.6), 0, 0, 0.022, clock, 24); face.rotation.x = Math.PI / 2;
    const hHand = box(0.008, 0.09, 0.004, black, 0, 0.04, 0.03, clock), mHand = box(0.006, 0.13, 0.004, black, 0, 0.06, 0.032, clock);
    clock.userData = { hHand, mHand };
    const cab = new THREE.Group(); cab.position.set(2.0, 0, -2.1); sc.add(cab); box(0.5, 1.3, 0.6, std(0x5a6a5a, 0.5, 0.4), 0, 0.65, 0, cab); for (let k = 0; k < 4; k++) { box(0.46, 0.28, 0.02, std(0x6a7a6a, 0.45, 0.4), 0, 0.2 + k * 0.3, 0.31, cab); box(0.1, 0.02, 0.03, brass, 0, 0.27 + k * 0.3, 0.33, cab); }
    const coat = new THREE.Group(); coat.position.set(-2.0, 0, -2.0); sc.add(coat); cyl(0.02, 0.02, 1.8, wood, 0, 0.9, 0, coat); cyl(0.2, 0.22, 0.03, wood, 0, 0.015, 0, coat); box(0.42, 0.95, 0.18, std(0x6a5a3a, 0.9), 0, 1.25, 0.08, coat); const hat = cyl(0.18, 0.18, 0.02, std(0x2a2420, 0.8), 0.05, 1.85, 0.05, coat, 20); cyl(0.1, 0.11, 0.11, std(0x2a2420, 0.8), 0.05, 1.91, 0.05, coat, 20); void hat;
    fan = new THREE.Group(); fan.position.set(0, 2.82, -0.4); sc.add(fan); cyl(0.07, 0.07, 0.12, brass, 0, 0, 0, fan); for (let k = 0; k < 4; k++) { const bl = box(0.6, 0.008, 0.11, wood, 0, -0.05, 0, fan); bl.geometry.translate(0.32, 0, 0); bl.rotation.y = k * Math.PI / 2; }
    // the files, fanned across the desk
    CASES.forEach((c, i) => {
      const n = CASES.length, g = new THREE.Group(); g.position.set(-0.46 + i * 0.92 / (n - 1), 0.806 + i * 0.012, -0.22 + (i % 2) * 0.05); g.rotation.y = (i - (n - 1) / 2) * 0.13; sc.add(g);
      const coverM = new THREE.MeshStandardMaterial({ map: coverTex(c), roughness: 0.85 }), back = std(0xb89858, 0.85);
      const backBoard = box(0.3, 0.004, 0.225, back, 0, 0.002, 0, g);
      const page = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.002, 0.215), [paper, paper, new THREE.MeshStandardMaterial({ map: pageTex(c), roughness: 0.9 }), paper, paper, paper]); page.position.set(0, 0.006, 0); g.add(page);
      const hinge = new THREE.Group(); hinge.position.set(-0.15, 0.008, 0); g.add(hinge);
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.003, 0.225), [back, back, coverM, back, back, back]); cover.position.set(0.15, 0, 0); cover.rotation.y = 0; hinge.add(cover); cover.castShadow = true;
      const tabM = std(new THREE.Color(c.tab), 0.8); box(0.08, 0.003, 0.03, tabM, 0.1, 0.008, -0.125, g);
      cover.userData.file = g; backBoard.userData.file = g; page.userData.file = g;
      g.userData = { c, hinge, home: g.position.clone(), homeRot: g.rotation.clone(), lift: 0, open: 0 };
      files.push(g);
    });
  }
  // ---------------- HTML layer: title, hint, the dossier's buttons ----------------
  const ui = document.createElement('div'); ui.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:20;display:none;font-family:Rajdhani,sans-serif;color:#e8dcc4';
  ui.innerHTML = `<div style="position:absolute;left:36px;top:30px;letter-spacing:.35em;font-weight:600;font-size:26px;text-shadow:0 0 12px #000">NIGHT RANGE</div>
    <div style="position:absolute;left:38px;top:66px;letter-spacing:.25em;font-size:13px;opacity:.6">CASE FILES</div>
    <div id="mHint" style="position:absolute;left:50%;bottom:36px;transform:translateX(-50%);letter-spacing:.25em;font-size:14px;opacity:.75;text-shadow:0 0 8px #000">CHOOSE A FILE ON THE DESK</div>
    <div id="mBtns" style="position:absolute;left:50%;bottom:34px;transform:translateX(-50%);display:none;gap:14px;pointer-events:auto">
      <button class="btn primary" id="mGo" style="min-width:200px">DEPLOY</button><button class="btn" id="mBack" style="min-width:140px">CLOSE FILE</button></div>`;
  document.body.appendChild(ui);
  const $m = (id) => ui.querySelector('#' + id);
  $m('mBack').onclick = () => close();
  $m('mGo').onclick = () => go();
  function go() {
    if (!opened) return;
    const c = opened.userData.c;
    audio.init(); audio.pouch();
    if (c.id === 'op') { active = false; ui.style.display = 'none'; document.getElementById('topbar').classList.remove('hidden'); document.getElementById('panel').classList.remove('hidden'); document.getElementById('poses').classList.remove('hidden'); return; }
    $m('mBtns').style.display = 'none'; showLoadout(c);
  }
  // ---------------- the loadout: briefing, four weapon slots, the operator ----------------
  const lo = document.createElement('div');
  lo.style.cssText = 'position:fixed;inset:0;z-index:25;display:none;place-items:center;background:radial-gradient(ellipse at center,rgba(8,8,10,.55),rgba(4,4,6,.9));font-family:Rajdhani,sans-serif;color:#e8dcc4';
  document.body.appendChild(lo);
  const SLOTNAME = { primary: 'PRIMARY', secondary: 'SECONDARY', sidearm: 'SIDEARM', long: 'LONG RANGE' };
  const stat = (id) => { const W2 = WEAPONS[id], dmg = W2.dmg ?? W2.mass * (W2.pellets > 1 ? 2.2 : 1); return { DAMAGE: Math.min(1, dmg / 3.2), 'FIRE RATE': Math.min(1, W2.rpm / 850), RANGE: Math.min(1, (W2.v / 900) * (1 / (W2.drag + 0.3)) * 1.2), STEALTH: id === 'mp5' ? 0.95 : id === 'pistol' ? 0.35 : id === 'dmr' || id === 'sniper' ? 0.25 : 0.15, CONTROL: Math.max(0.05, 1 - W2.recoil.rx / 8) }; };
  function showLoadout(c) {
    const L = { ...LOADOUT };
    const render = () => {
      lo.innerHTML = `<div style="width:min(1100px,94vw);max-height:92vh;overflow:auto;padding:26px 30px;border-radius:12px;background:rgba(16,15,13,.94);border:1px solid rgba(201,164,92,.35);box-shadow:0 20px 60px rgba(0,0,0,.6)">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:20px"><div style="font-size:13px;letter-spacing:.35em;color:#c9a45c">CASE ${c.no} · MISSION BRIEFING</div><div style="font-size:12px;letter-spacing:.25em;opacity:.6">${c.place.toUpperCase()}</div></div>
        <div style="font-size:34px;font-weight:700;letter-spacing:.12em;margin:4px 0 10px">${c.title}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px">
          <div style="font-size:15px;line-height:1.55;letter-spacing:.03em;color:#d8ccb4">${c.lines.map((l) => l === '' ? '<div style="height:8px"></div>' : l === 'OBJECTIVES' ? '<div style="margin-top:6px;font-size:12px;letter-spacing:.3em;color:#c9a45c">OBJECTIVES</div>' : `<div>${l}</div>`).join('')}
            <div style="margin-top:16px;font-size:12px;letter-spacing:.3em;color:#c9a45c">INTEL</div><div style="opacity:.8">${c.intel || ''}</div></div>
          <div>${Object.keys(SLOTNAME).map((k) => `<div style="margin-bottom:12px"><div style="font-size:11px;letter-spacing:.32em;opacity:.65;margin-bottom:5px">${SLOTNAME[k]}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${SLOTS[k].map((id) => `<button data-s="${k}" data-w="${id}" class="btn${L[k] === id ? ' primary' : ''}" style="padding:7px 12px;font-size:13px;letter-spacing:.12em;opacity:${(k === 'secondary' && id === L.primary) ? 0.35 : 1}">${WEAPONS[id].name}</button>`).join('')}</div>
              <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:6px">${Object.entries(stat(L[k])).map(([n, v]) => `<div><div style="font-size:9px;letter-spacing:.2em;opacity:.55">${n}</div><div style="height:4px;background:rgba(255,255,255,.1);border-radius:2px"><i style="display:block;height:100%;width:${Math.round(v * 100)}%;background:#c9a45c;border-radius:2px"></i></div></div>`).join('')}</div></div>`).join('')}</div>
        </div>
        <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:18px"><button class="btn" id="loBack">BACK</button><button class="btn" id="loOp">CUSTOMIZE OPERATOR</button><button class="btn primary" id="loGo" style="min-width:200px">DEPLOY</button></div></div>`;
      lo.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { const k = b.dataset.s, w = b.dataset.w; if (k === 'secondary' && w === L.primary) return; L[k] = w; if (k === 'primary' && L.secondary === w) L.secondary = SLOTS.secondary.find((x) => x !== w); audio.pouch(); render(); });
      lo.querySelector('#loBack').onclick = () => { lo.style.display = 'none'; $m('mBtns').style.display = 'flex'; };
      lo.querySelector('#loOp').onclick = () => { save(); try { sessionStorage.setItem('nightrange.pendingCase', c.id); } catch (e) { /* ignore */ } lo.style.display = 'none'; const op = files.find((g) => g.userData.c.id === 'op'); opened = op; go(); };
      lo.querySelector('#loGo').onclick = () => { save(); try { sessionStorage.removeItem('nightrange.pendingCase'); } catch (e) { /* ignore */ } lo.innerHTML = '<div style="letter-spacing:.35em;font-size:14px;opacity:.75">LOADING CASE…</div>'; location.search = `?map=${c.id}`; };
    };
    const save = () => { Object.assign(LOADOUT, L); try { localStorage.setItem('nightrange.loadout', JSON.stringify(L)); } catch (e) { /* ignore */ } };
    lo.style.display = 'grid'; render();
  }
  function open(g) { opened = g; audio.init(); audio.pouch(); $m('mBtns').style.display = 'flex'; $m('mHint').style.display = 'none'; $m('mGo').textContent = g.userData.c.id === 'op' ? 'OPEN FILE' : 'DEPLOY'; }
  function close() { if (!opened) return; opened = null; audio.holster(); $m('mBtns').style.display = 'none'; $m('mHint').style.display = 'block'; }
  const ndc = new THREE.Vector2();
  addEventListener('mousemove', (e) => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = -(e.clientY / innerHeight) * 2 + 1; });
  addEventListener('mousedown', (e) => {
    if (!active || e.button !== 0) return;
    if (e.target.closest && e.target.closest('button')) return;
    if (opened) { close(); return; }
    if (hover) open(hover);
  });
  addEventListener('keydown', (e) => { if (!active) return; if (e.code === 'Escape') close(); if (e.code === 'Enter' && opened) go(); });
  addEventListener('resize', () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });

  const _v = new V3(), _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
  function frame(dt, now) {
    t += dt;
    // camera: seated at the desk, drifting a little with the mouse and your breathing
    const tgt = _v.copy(base.look).add(new V3(mouse.x * 0.18, mouse.y * 0.1, 0));
    cam.position.copy(base.pos).add(new V3(mouse.x * 0.05, Math.sin(t * 0.8) * 0.006, 0));
    cam.lookAt(tgt);
    if (fan) fan.rotation.y += dt * 1.6;
    if (rain) rain.material.map.offset.y += dt * 0.25;
    for (const s of smoke) { s.userData.p = (s.userData.p + dt * 0.12) % 1; const p = s.userData.p; s.position.set(-0.33 + Math.sin(p * 9 + t) * 0.03 * p, 0.84 + p * 0.55, -0.08 + Math.cos(p * 7) * 0.02 * p); s.scale.setScalar(1 + p * 3); s.material.opacity = 0.14 * (1 - p); }
    const d = new Date(), clk = sc.children.find((o) => o.userData && o.userData.hHand); if (clk) { clk.userData.hHand.rotation.z = -((d.getHours() % 12) / 12) * Math.PI * 2; clk.userData.mHand.rotation.z = -(d.getMinutes() / 60) * Math.PI * 2; }
    // hover
    hover = null;
    if (!opened) {
      ndc.set(mouse.x, mouse.y); ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObjects(files, true)[0];
      if (hit) { let o = hit.object; while (o && !files.includes(o)) o = o.parent; hover = o; }
      document.body.style.cursor = hover ? 'pointer' : 'default';
      $m('mHint').textContent = hover ? `${hover.userData.c.id === 'op' ? 'PERSONNEL FILE' : 'CASE ' + hover.userData.c.no + ' — ' + hover.userData.c.title}  ·  CLICK TO OPEN` : 'CHOOSE A FILE ON THE DESK';
    }
    // files: lift on hover; the opened one comes up to the camera and opens
    for (const g of files) {
      const u = g.userData;
      u.lift = damp(u.lift, g === hover ? 1 : 0, 12, dt);
      u.open = damp(u.open, g === opened ? 1 : 0, 6, dt);
      const k = smooth(clamp(u.open, 0, 1));
      // reading position: in front of the camera, tilted to face it
      const read = _v.copy(cam.position).add(new V3(0.16, -0.04, -0.56).applyQuaternion(cam.quaternion));
      g.position.lerpVectors(u.home, read, k); g.position.y += u.lift * 0.03 * (1 - k);
      // face the camera: folder up (+y) toward the eye, its top edge (−z) toward the top of the screen
      const y = new V3().subVectors(cam.position, read).normalize(), up = new V3(0, 1, 0).applyQuaternion(cam.quaternion), z = up.sub(y.clone().multiplyScalar(up.dot(y))).normalize().negate(), x = new V3().crossVectors(y, z);
      const rq = new THREE.Quaternion().setFromRotationMatrix(_m4.makeBasis(x, y, z));
      _q.setFromEuler(u.homeRot); g.quaternion.copy(_q).slerp(rq, k);
      u.hinge.rotation.z = smooth(clamp(u.open * 1.4 - 0.3, 0, 1)) * Math.PI * 0.97;
    }
    const ko = files.reduce((m, g) => Math.max(m, g.userData.open), 0);
    readLight.intensity = ko * 1.4; readLight.position.copy(cam.position).add(new V3(0.1, 0.25, 0.1));
    renderer.toneMappingExposure = 1.1;
    renderer.render(sc, cam);
  }
  return {
    get active() { return active; },
    open() {
      if (!built) build();
      active = true; ui.style.display = 'block';
      for (const id of ['panel', 'topbar', 'poses', 'loading']) { const e = document.getElementById(id); if (e) e.classList.add('hidden'); }
      // back from the operator file mid-briefing: straight back to that case's loadout
      let pend = null; try { pend = sessionStorage.getItem('nightrange.pendingCase'); } catch (e) { /* ignore */ }
      if (pend) { const c = CASES.find((q) => q.id === pend); if (c) { opened = files.find((g) => g.userData.c.id === pend); showLoadout(c); } }
    },
    frame,
    _dbg: { files, cam, screen: (i) => { const p = files[i].getWorldPosition(new V3()).project(cam); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; } },
  };
})();
