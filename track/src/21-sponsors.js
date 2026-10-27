// =====================================================================
//  Sponsor artwork: each design is drawn to a 1024x256 canvas (4:1) and
//  shared as one texture by walls, billboards, boards and banners.
// =====================================================================
const SPONSOR_W = 1024, SPONSOR_H = 256;
const sponsorCache = new Map();   // id -> {key, canvas, tex, mats: Map}

function sponsorById(id) { return state.sponsors.find((s) => s.id === id) || null; }

function drawSponsorIcon(g, icon, x, y, s, color, accent) {
  g.save();
  g.translate(x, y);
  g.fillStyle = color; g.strokeStyle = color; g.lineWidth = s * 0.12; g.lineJoin = 'round';
  const P = (pts) => { g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a * s, b * s) : g.moveTo(a * s, b * s))); g.closePath(); g.fill(); };
  switch (icon) {
    case 'bolt': P([[0.1, -0.5], [-0.3, 0.08], [-0.02, 0.08], [-0.12, 0.5], [0.3, -0.1], [0.03, -0.1], [0.16, -0.5]]); break;
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.22 : 0.5, a = -Math.PI / 2 + (i * Math.PI) / 5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      P(pts); break;
    }
    case 'wing':
      for (let i = 0; i < 4; i++) P([[-0.5, -0.3 + i * 0.17], [0.5, -0.42 + i * 0.17], [0.42, -0.32 + i * 0.17], [-0.5, -0.2 + i * 0.17]]);
      break;
    case 'ring':
      g.lineWidth = s * 0.14; g.beginPath(); g.arc(0, 0, s * 0.38, 0, 7); g.stroke();
      g.fillStyle = accent; g.beginPath(); g.arc(0, 0, s * 0.16, 0, 7); g.fill(); break;
    case 'chevron':
      P([[-0.45, -0.4], [-0.1, -0.4], [0.3, 0], [-0.1, 0.4], [-0.45, 0.4], [-0.05, 0]]);
      g.fillStyle = accent; P([[0.0, -0.4], [0.2, -0.4], [0.6, 0], [0.2, 0.4], [0.0, 0.4], [0.4, 0]]); break;
    case 'flag':
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
        g.fillStyle = (r + c) % 2 ? color : accent;
        g.fillRect((-0.5 + c * 0.2) * s, (-0.4 + r * 0.2) * s + Math.sin(c * 0.9) * s * 0.04, s * 0.2, s * 0.2);
      }
      break;
    case 'drop': g.beginPath(); g.moveTo(0, -0.5 * s); g.bezierCurveTo(0.45 * s, 0, 0.35 * s, 0.45 * s, 0, 0.45 * s); g.bezierCurveTo(-0.35 * s, 0.45 * s, -0.45 * s, 0, 0, -0.5 * s); g.fill(); break;
    default: break;
  }
  g.restore();
}

// Largest font size (px) at which `text` fits `maxW`.
// `style` is the CSS font style/weight part (e.g. 'italic 800'), `family` the font family list.
function fitFont(g, text, style, family, maxW, maxPx) {
  let px = maxPx;
  g.font = `${style} ${px}px ${family}`;
  const w = g.measureText(text).width;
  if (w > maxW) px = Math.max(20, Math.floor((px * maxW) / w));
  g.font = `${style} ${px}px ${family}`;
  return px;
}

function drawSponsor(g, sp, W = SPONSOR_W, H = SPONSOR_H) {
  const F = "Rajdhani, 'Arial Narrow', Arial, sans-serif";
  g.save();
  g.scale(W / SPONSOR_W, H / SPONSOR_H);
  const w = SPONSOR_W, h = SPONSOR_H;
  g.fillStyle = sp.bg; g.fillRect(0, 0, w, h);
  g.textBaseline = 'middle';
  const hasIcon = sp.icon !== 'none';
  const tag = (x, y, align = 'center', col = sp.fg) => {
    if (!sp.tag) return;
    g.fillStyle = col; g.textAlign = align;
    g.font = `600 30px ${F}`;
    if ('letterSpacing' in g) g.letterSpacing = '6px';
    g.fillText(sp.tag, x, y);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  };
  switch (sp.layout) {
    case 'stripe': {
      g.fillStyle = sp.accent;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(w - 300 + i * 70, h); g.lineTo(w - 200 + i * 70, 0); g.lineTo(w - 165 + i * 70, 0); g.lineTo(w - 265 + i * 70, h); g.fill(); }
      const x0 = hasIcon ? 190 : 60;
      if (hasIcon) drawSponsorIcon(g, sp.icon, 100, h / 2, 130, sp.fg, sp.accent);
      g.fillStyle = sp.fg; g.textAlign = 'left';
      fitFont(g, sp.text, 'italic 800', F, w - x0 - 330, 150);
      g.fillText(sp.text, x0, sp.tag ? h * 0.44 : h / 2);
      tag(x0 + 6, h * 0.8, 'left');
      break;
    }
    case 'split': {
      g.fillStyle = sp.accent; g.fillRect(0, 0, w * 0.28, h);
      g.beginPath(); g.moveTo(w * 0.28, 0); g.lineTo(w * 0.33, 0); g.lineTo(w * 0.28, h); g.fill();
      if (hasIcon) drawSponsorIcon(g, sp.icon, w * 0.14, h / 2, 150, sp.bg, sp.fg);
      g.fillStyle = sp.fg; g.textAlign = 'center';
      fitFont(g, sp.text, '800', F, w * 0.6, 150);
      g.fillText(sp.text, w * 0.655, sp.tag ? h * 0.42 : h / 2);
      tag(w * 0.655, h * 0.8);
      break;
    }
    case 'badge': {
      g.fillStyle = sp.accent;
      g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.42, h * 0.42, 0, 0, 7); g.fill();
      g.lineWidth = 10; g.strokeStyle = sp.fg; g.stroke();
      g.fillStyle = sp.fg; g.textAlign = 'center';
      fitFont(g, sp.text, '800', F, w * 0.62, 130);
      g.fillText(sp.text, w / 2 + (hasIcon ? 40 : 0), sp.tag ? h * 0.44 : h / 2);
      if (hasIcon) drawSponsorIcon(g, sp.icon, w * 0.2, h / 2, 100, sp.fg, sp.bg);
      tag(w / 2 + (hasIcon ? 40 : 0), h * 0.74);
      break;
    }
    case 'outline': {
      g.textAlign = 'center';
      fitFont(g, sp.text, '800', F, w * (hasIcon ? 0.7 : 0.86), 170);
      const x = w / 2 + (hasIcon ? 70 : 0), y = sp.tag ? h * 0.43 : h / 2;
      g.lineWidth = 9; g.strokeStyle = sp.accent; g.strokeText(sp.text, x + 7, y + 7);
      g.strokeStyle = sp.fg; g.strokeText(sp.text, x, y);
      if (hasIcon) drawSponsorIcon(g, sp.icon, 120, h / 2, 140, sp.accent, sp.fg);
      tag(x, h * 0.82, 'center', sp.accent);
      break;
    }
    case 'script': {
      g.textAlign = 'center';
      fitFont(g, sp.text, 'italic 700', "Georgia, 'Times New Roman', serif", w * 0.8, 170);
      g.fillStyle = sp.fg;
      const y = sp.tag ? h * 0.42 : h / 2;
      g.fillText(sp.text, w / 2 + (hasIcon ? 60 : 0), y);
      g.strokeStyle = sp.accent; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.moveTo(w * 0.18, h * 0.66); g.quadraticCurveTo(w * 0.5, h * 0.82, w * 0.86, h * 0.6); g.stroke();
      if (hasIcon) drawSponsorIcon(g, sp.icon, 110, h * 0.42, 120, sp.accent, sp.fg);
      tag(w / 2, h * 0.86);
      break;
    }
    default: {   // block
      g.fillStyle = sp.accent; g.fillRect(0, h - 26, w, 26); g.fillRect(0, 0, w, 10);
      g.fillStyle = sp.fg; g.textAlign = 'center';
      fitFont(g, sp.text, '800', F, w * (hasIcon ? 0.66 : 0.86), 160);
      const x = w / 2 + (hasIcon ? 80 : 0);
      g.fillText(sp.text, x, sp.tag ? h * 0.42 : h * 0.48);
      if (hasIcon) drawSponsorIcon(g, sp.icon, 140, h * 0.46, 150, sp.accent, sp.fg);
      tag(x, h * 0.76);
    }
  }
  g.restore();
}

function sponsorEntry(id) {
  const sp = sponsorById(id);
  if (!sp) return null;
  const key = JSON.stringify(sp);
  let e = sponsorCache.get(id);
  if (!e) {
    const canvas = document.createElement('canvas');
    canvas.width = SPONSOR_W; canvas.height = SPONSOR_H;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = MAX_ANISO;
    tex.wrapS = THREE.RepeatWrapping;
    e = { key: '', canvas, tex, mats: new Map() };
    sponsorCache.set(id, e);
  }
  if (e.key !== key) {
    drawSponsor(e.canvas.getContext('2d'), sp);
    e.tex.needsUpdate = true;
    e.key = key;
  }
  return e;
}
// Material for a sponsor; `kind` picks finish: 'wall' (matte, double-sided), 'screen' (glowing LED), 'banner'.
function sponsorMat(id, kind = 'wall') {
  const e = sponsorEntry(id);
  if (!e) return null;
  let m = e.mats.get(kind);
  if (!m) {
    m = kind === 'screen'
      ? new THREE.MeshStandardMaterial({ map: e.tex, emissiveMap: e.tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.35 })
      : new THREE.MeshStandardMaterial({ map: e.tex, roughness: kind === 'banner' ? 0.85 : 0.6, side: kind === 'wall' || kind === 'banner' ? THREE.DoubleSide : THREE.FrontSide });
    e.mats.set(kind, m);
  }
  return m;
}
// Sponsor art drawn after the web font arrives looks right; redraw once it has.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const e of sponsorCache.values()) e.key = ''; for (const id of sponsorCache.keys()) sponsorEntry(id); });
