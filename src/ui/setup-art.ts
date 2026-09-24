/**
 * The difficulty cards' pictures: three scenes drawn from code, one per mood.
 *
 * Relaxed is a small green town on a clear morning, Standard a mid-size city
 * at golden hour, Hard a dense skyline in a night storm. Drawn rather than
 * shipped because the game is a single file, and each is a few hundred bytes
 * of shapes chosen from a fixed seed -- so they are the same every time.
 */

import type { DifficultyId } from '../sim/difficulty';

const W = 600, H = 240;

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A row of buildings standing on `base`, with some windows lit. */
function skyline(r: () => number, base: number, minH: number, maxH: number, minW: number, maxW: number,
  body: string, lit: string, litShare: number, x0 = -10, x1 = W + 10): string {
  let out = '';
  let x = x0;
  while (x < x1) {
    const w = minW + r() * (maxW - minW);
    const h = minH + r() ** 1.6 * (maxH - minH);
    const y = base - h;
    out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${body}"/>`;
    if (r() < 0.25 && h > maxH * 0.6) {
      out += `<rect x="${(x + w / 2 - 1).toFixed(1)}" y="${(y - 14).toFixed(1)}" width="2" height="14" fill="${body}"/>`;
    }
    if (litShare > 0) {
      for (let wy = y + 5; wy < base - 5; wy += 7) {
        for (let wx = x + 3; wx < x + w - 4; wx += 6) {
          if (r() < litShare) out += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="2.6" height="3.4" fill="${lit}"/>`;
        }
      }
    }
    x += w + r() * 3;
  }
  return out;
}

function relaxed(): string {
  const r = rand(11);
  let houses = '';
  for (let i = 0; i < 16; i++) {
    const x = 40 + i * 34 + r() * 10;
    const y = 176 + Math.sin(i * 0.7) * 6 + r() * 4;
    const w = 18 + r() * 8;
    const roof = ['#c8553d', '#b8452f', '#d9763f', '#8f4a3a'][Math.floor(r() * 4)];
    houses += `<rect x="${x}" y="${y}" width="${w}" height="14" fill="#f3ead8"/>`
      + `<path d="M${x - 2} ${y}L${x + w / 2} ${y - 9}L${x + w + 2} ${y}Z" fill="${roof}"/>`
      + `<rect x="${x + w / 2 - 2}" y="${y + 6}" width="4" height="8" fill="#6b4a33"/>`;
  }
  let trees = '';
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = 186 + r() * 30, s = 5 + r() * 6;
    trees += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(1)}" fill="${r() < 0.5 ? '#3f8a3c' : '#4f9e45'}"/>`;
  }
  return '<defs><linearGradient id="rs" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#6fb6ee"/><stop offset="1" stop-color="#d8eefa"/></linearGradient>'
    + '<radialGradient id="rsun"><stop offset="0" stop-color="#fff8d6"/><stop offset=".35" stop-color="#ffe89a" stop-opacity=".9"/>'
    + '<stop offset="1" stop-color="#ffe89a" stop-opacity="0"/></radialGradient></defs>'
    + `<rect width="${W}" height="${H}" fill="url(#rs)"/>`
    + '<circle cx="110" cy="60" r="70" fill="url(#rsun)"/>'
    + '<g fill="#fff" opacity=".85"><ellipse cx="330" cy="52" rx="46" ry="12"/><ellipse cx="360" cy="44" rx="30" ry="12"/>'
    + '<ellipse cx="500" cy="82" rx="38" ry="9"/><ellipse cx="520" cy="76" rx="22" ry="9"/></g>'
    + '<path d="M0 150Q120 110 250 140T600 128V240H0Z" fill="#8cc47a"/>'
    + '<path d="M0 172Q150 150 300 168T600 160V240H0Z" fill="#6eae5a"/>'
    + '<path d="M0 214Q160 196 330 214T600 206V240H0Z" fill="#5da9d6"/>'
    + houses + trees;
}

function standard(): string {
  const r = rand(23);
  return '<defs><linearGradient id="ss" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#3a3f7a"/><stop offset=".55" stop-color="#e0785a"/>'
    + '<stop offset="1" stop-color="#ffc56e"/></linearGradient>'
    + '<linearGradient id="sw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6905f"/>'
    + '<stop offset="1" stop-color="#3b3350"/></linearGradient></defs>'
    + `<rect width="${W}" height="${H}" fill="url(#ss)"/>`
    + '<circle cx="420" cy="118" r="44" fill="#ffd27a" opacity=".35"/><circle cx="420" cy="118" r="26" fill="#ffe2a0"/>'
    + skyline(r, 176, 20, 60, 16, 30, '#6a4a6e', '#ffd08a', 0)
    + skyline(r, 180, 24, 110, 14, 26, '#2e2340', '#ffcf7a', 0.12)
    + '<rect y="180" width="600" height="60" fill="url(#sw)"/>'
    + '<rect x="380" y="186" width="80" height="2" fill="#ffe2a0" opacity=".7"/>'
    + '<rect x="395" y="194" width="50" height="2" fill="#ffe2a0" opacity=".5"/>'
    + '<rect x="405" y="202" width="30" height="2" fill="#ffe2a0" opacity=".35"/>';
}

function hard(): string {
  const r = rand(37);
  let rain = '';
  for (let i = 0; i < 140; i++) {
    const x = r() * (W + 60), y = r() * H;
    rain += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l-7 16" />`;
  }
  return '<defs><linearGradient id="hs" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#05070d"/><stop offset="1" stop-color="#1a2233"/></linearGradient>'
    + '<linearGradient id="hf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c8aa6" stop-opacity="0"/>'
    + '<stop offset="1" stop-color="#7c8aa6" stop-opacity=".35"/></linearGradient></defs>'
    + `<rect width="${W}" height="${H}" fill="url(#hs)"/>`
    + '<g fill="#232b3b" opacity=".9"><ellipse cx="120" cy="40" rx="140" ry="34"/><ellipse cx="420" cy="30" rx="200" ry="40"/></g>'
    + '<path d="M352 20l-18 40h14l-12 36 34-50h-15l14-26z" fill="#e8f1ff"/>'
    + '<path d="M352 20l-18 40h14l-12 36 34-50h-15l14-26z" fill="#9fc2ff" opacity=".4" transform="scale(1.02)"/>'
    + skyline(r, 200, 50, 120, 14, 24, '#121827', '#f4b54a', 0.18)
    + skyline(r, 214, 70, 175, 16, 30, '#0a0e17', '#ffd27a', 0.3)
    + `<rect y="150" width="${W}" height="90" fill="url(#hf)"/>`
    + `<g stroke="#9fb4d6" stroke-opacity=".35" stroke-width="1">${rain}</g>`;
}

/** The scene for a difficulty, as SVG markup that fills its box. */
export function difficultyArt(id: DifficultyId): string {
  const body = id === 'relaxed' ? relaxed() : id === 'hard' ? hard() : standard();
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"`
    + ` aria-hidden="true" style="display:block">${body}</svg>`;
}
