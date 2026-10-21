// 2.5D broadcast camera: a low-resolution pixel scene (upscaled crisp) with a side-on oblique
// view that follows the ball, animated pixel players, nets, stands, crowd, dust and celebrations.
import type { Action, LP, Match } from '../core/engine';
import { drawPlayer, lookFor, type Look, type Pose } from './pixel';
import { luminance } from './art';

export const LW = 768, LH = 432;
const PPM = 15.5;          // pixels per metre along the pitch
const DEPTH = 0.5;         // vertical squash of the pitch plane
const ZK = 0.95;           // pixels per metre of height, relative to PPM

interface Anim { x: number; y: number; px: number; py: number; facing: 1 | -1; phase: number; pose: Pose; t0: number; dur: number; z: number; speed: number }
interface Puff { x: number; y: number; t: number; s: number }

export class Broadcast {
  cam = { x: 52.5, y: 34 };
  anim = new Map<number, Anim>();
  looks = new Map<number, Look>();
  puffs: Puff[] = [];
  celeb: { side: 0 | 1; scorer: number; t0: number; cx: number; cy: number } | null = null;
  netShake = { side: -1, t: 0 };
  crowd: HTMLCanvasElement;
  grass: CanvasPattern | null = null;
  grassTex: HTMLCanvasElement | null = null;
  time = 0;

  constructor(private m: Match, kits: { c1: string; c2: string; gk: string; away?: boolean }[]) {
    for (const l of m.lps) {
      const club = m.clubs[l.side];
      this.looks.set(l.id, lookFor(l.p, club, { away: !!kits[l.side].away, gk: l.p.pos === 'GK', gkColor: kits[l.side].gk }));
    }
    // pre-rendered crowd texture
    this.crowd = document.createElement('canvas');
    this.crowd.width = 256; this.crowd.height = 48;
    const c = this.crowd.getContext('2d')!;
    const cols = [m.clubs[0].c1, m.clubs[0].c2, m.clubs[1].c1, '#d9cfc1', '#8a6b52', '#3b2717', '#e8bf9f', '#1d2433', '#f5f5f5'];
    c.fillStyle = '#141a28'; c.fillRect(0, 0, 256, 48);
    for (let yy = 0; yy < 48; yy += 3) for (let xx = (yy / 3) % 2; xx < 256; xx += 3) {
      c.fillStyle = cols[(xx * 7 + yy * 13 + ((xx * yy) % 11)) % cols.length];
      c.fillRect(xx, yy, 2, 2);
      if ((xx + yy) % 5 === 0) { c.fillStyle = '#e8bf9f'; c.fillRect(xx, yy - 1, 2, 1); }
    }
  }

  /** Called when the engine hands the renderer a new action. */
  onAction(a: Action) {
    const set = (id: number | undefined, pose: Pose, dur: number, z = 0) => {
      if (id === undefined) return;
      const an = this.anim.get(id);
      if (!an) return;
      an.pose = pose; an.t0 = this.time; an.dur = dur; an.z = z;
    };
    switch (a.type) {
      case 'pass': case 'long': case 'through': case 'cross': case 'clear': set(a.pid, 'kick', 0.42); break;
      case 'goal': case 'save': case 'miss': case 'post': case 'block':
        set(a.pid, a.text?.includes('header') ? 'header' : 'kick', 0.5);
        if (a.type === 'save') set(a.pid2, 'dive', 0.9);
        if (a.type === 'block') set(a.pid2, 'slide', 0.6);
        break;
      case 'tackle': set(a.pid, 'slide', 0.65); break;
      case 'foul': set(a.pid, 'slide', 0.6); break;
    }
  }
  startCelebration(a: Action) {
    const x = a.side === 0 ? 103 : 2;
    const sc = this.anim.get(a.pid);
    const cy = sc && sc.y > 34 ? 66 : 2;
    this.celeb = { side: a.side, scorer: a.pid, t0: this.time, cx: x, cy };
    this.netShake = { side: a.side === 0 ? 1 : 0, t: this.time };
  }
  get celebrating() { return !!this.celeb && this.time - this.celeb.t0 < 3.4; }

  // projection
  sx(x: number) { return (x - this.cam.x) * PPM + LW / 2; }
  sy(y: number, z = 0) { return (y - this.cam.y) * PPM * DEPTH + LH * 0.56 - z * PPM * ZK; }

  frame(ctx: CanvasRenderingContext2D, ball: [number, number], bh: number, cur: Action | null, shapePos: (l: LP) => [number, number], dt: number) {
    const m = this.m;
    this.time += dt;
    const T = this.time;
    // --- player motion ---------------------------------------------------------------
    const scorer = this.celeb ? this.anim.get(this.celeb.scorer) : null;
    for (const l of m.lps) {
      if (!l.on || l.off) { this.anim.delete(l.id); continue; }
      let an = this.anim.get(l.id);
      const tgt0 = shapePos(l);
      if (!an) { an = { x: tgt0[0], y: tgt0[1], px: tgt0[0], py: tgt0[1], facing: l.side === 0 ? 1 : -1, phase: Math.random() * 6, pose: 'idle', t0: 0, dur: 0, z: 0, speed: 0 }; this.anim.set(l.id, an); }
      let tgt = tgt0;
      const isCarrier = cur && cur.pid === l.id && (cur.type === 'dribble' || cur.type === 'carry');
      if (cur && cur.pid === l.id && !isCarrier && cur.type !== 'save') tgt = cur.from;
      if (cur && cur.pid2 === l.id && (cur.type === 'pass' || cur.type === 'long' || cur.type === 'through' || cur.type === 'cross')) tgt = cur.to;
      if (cur && cur.pid2 === l.id && cur.type === 'save') tgt = [cur.to[0], cur.to[1]];
      let maxV = 7.5 * (0.6 + l.energy / 250);
      if (this.celeb && this.celebrating) {
        const c = this.celeb;
        if (l.side === c.side) {
          if (l.id === c.scorer) tgt = [c.cx, c.cy];
          else if (scorer && l.pos !== 'GK') tgt = [scorer.x - (c.side === 0 ? 1.4 : -1.4) - (l.slot % 3) * 0.9, scorer.y + ((l.slot % 5) - 2) * 0.9];
          maxV = 8.5;
        } else maxV = 1.2;
      }
      if (isCarrier) {
        // the ball runs half a stride ahead of the dribbler
        const dirx = cur!.to[0] - cur!.from[0];
        const f = dirx >= 0 ? 1 : -1;
        an.x = ball[0] - f * 0.55; an.y = ball[1] - 0.15;
      } else {
        const dx = tgt[0] - an.x, dy = tgt[1] - an.y;
        const d = Math.hypot(dx, dy);
        const k = cur && (cur.pid === l.id || cur.pid2 === l.id) ? 1.6 : 1;
        const step = Math.min(d, maxV * k * dt * 1.6);
        if (d > 0.01) { an.x += dx / d * step; an.y += dy / d * step; }
      }
      const vx = (an.x - an.px) / Math.max(dt, 1e-3), vy = (an.y - an.py) / Math.max(dt, 1e-3);
      an.speed = an.speed * 0.8 + Math.hypot(vx, vy) * 0.2;
      an.px = an.x; an.py = an.y;
      if (Math.abs(vx) > 0.6) an.facing = vx > 0 ? 1 : -1;
      else if (!this.celeb) an.facing = ball[0] >= an.x ? 1 : -1;
      an.phase += dt * (4 + an.speed * 1.9);
      if (an.speed > 5.2 && Math.random() < dt * 6) this.puffs.push({ x: an.x - an.facing * 0.4, y: an.y, t: T, s: 0.6 + Math.random() * 0.6 });
    }
    // --- camera ------------------------------------------------------------------------
    const focus: [number, number] = this.celeb && scorer && this.celebrating ? [scorer.x, scorer.y] : ball;
    const lead = cur && (cur.type === 'pass' || cur.type === 'long' || cur.type === 'through') ? (cur.to[0] - cur.from[0]) * 0.15 : 0;
    const halfW = LW / 2 / PPM;
    const tx = Math.max(halfW - 4, Math.min(105 - halfW + 4, focus[0] + lead));
    const ty = Math.max(17, Math.min(54, focus[1]));
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 2.6);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 2.2);

    ctx.imageSmoothingEnabled = false;
    this.drawGround(ctx);
    this.drawGoal(ctx, 0); this.drawGoal(ctx, 1);
    // shadows
    for (const [, an] of this.anim) {
      const x = Math.round(this.sx(an.x)), y = Math.round(this.sy(an.y));
      ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(x - 13, y - 1, 12, 2); ctx.fillRect(x + 2, y - 1, 12, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 5, y - 1, 11, 3);
    }
    const bz = cur && (cur.type === 'dribble' || cur.type === 'carry') ? Math.abs(Math.sin(T * 9)) * 0.18 : bh;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(Math.round(this.sx(ball[0]) - 2), Math.round(this.sy(ball[1])), 5, 2);
    // puffs behind players
    this.drawPuffs(ctx);
    // players, back to front
    const order = [...this.anim.entries()].sort((a, b) => a[1].y - b[1].y);
    let ballDrawn = false;
    for (const [id, an] of order) {
      if (!ballDrawn && an.y > ball[1]) { this.drawBall(ctx, ball, bz); ballDrawn = true; }
      const l = m.byId.get(id)!;
      const look = this.looks.get(id)!;
      let pose: Pose = an.speed > 1.2 ? 'run' : 'idle';
      let t = 0, z = 0, rot = 0;
      if (an.dur && T - an.t0 < an.dur) {
        pose = an.pose; t = (T - an.t0) / an.dur;
        if (pose === 'dive') { z = Math.sin(t * Math.PI) * 0.9; rot = 0; }
        if (pose === 'header') z = Math.sin(t * Math.PI) * 0.6;
      }
      if (this.celeb && this.celebrating) {
        const e = T - this.celeb.t0;
        if (l.side === this.celeb.side) {
          if (id === this.celeb.scorer) pose = an.speed > 2.5 ? 'run' : e > 1.4 ? 'slideCelebrate' : 'celebrate';
          else if (l.pos !== 'GK') pose = an.speed > 2 ? 'run' : 'jump';
        } else pose = l.pos === 'GK' ? 'idle' : 'dejected';
      }
      drawPlayer(ctx, this.sx(an.x), this.sy(an.y, z), look, pose, an.phase, t, an.facing, 1, rot);
      // tags for the action players
      if (cur && (cur.pid === id || cur.pid2 === id) && !this.celebrating) this.tag(ctx, an, `${l.p.num} ${l.p.name.split(' ').slice(-1)[0].toUpperCase()}`, l.side === 0 ? m.clubs[0].c1 : m.clubs[1].c1);
      if (this.celeb && this.celebrating && id === this.celeb.scorer) this.tag(ctx, an, `${l.p.name.toUpperCase()}`, '#22e3a1');
    }
    if (!ballDrawn) this.drawBall(ctx, ball, bz);
    this.drawGoalFront(ctx, 0); this.drawGoalFront(ctx, 1);
    this.boards(ctx, 70.4, this.time);
    this.drawRadar(ctx, ball);
    if (this.celeb && !this.celebrating) this.celeb = null;
  }

  private drawGround(ctx: CanvasRenderingContext2D) {
    const T = this.time;
    ctx.fillStyle = '#070a12'; ctx.fillRect(0, 0, LW, LH);
    // --- stands: three tiers of crowd, a roof with a light rig ---------------------------
    const topY = this.sy(-3.2);
    if (topY > 0) {
      const shift = Math.round(-this.cam.x * PPM * 0.9);
      const tiers: [number, number, number][] = [[topY - 4, 46, 0.9], [topY - 58, 40, 0.8], [topY - 104, 36, 0.7]];
      for (const [y, h, par] of tiers) {
        if (y < -h) continue;
        const off = ((Math.round(shift * par) % 256) + 256) % 256;
        const bounce = Math.sin(T * 7 + y) > 0.2 ? -1 : 0;
        for (let x = off - 256; x < LW; x += 256) ctx.drawImage(this.crowd, 0, 0, 256, 48, x, y - h + bounce, 256, h);
        ctx.fillStyle = '#0a0e18'; ctx.fillRect(0, y, LW, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, y - h, LW, 1);
      }
      const roof = topY - 140;
      if (roof > -30) {
        ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, LW, Math.max(0, roof + 12));
        ctx.fillStyle = '#1a2032'; ctx.fillRect(0, roof + 10, LW, 2);
        for (let x = ((shift % 24) + 24) % 24; x < LW; x += 24) { ctx.fillStyle = '#fffbe6'; ctx.fillRect(x, roof + 7, 3, 2); ctx.fillStyle = 'rgba(255,250,220,0.12)'; ctx.fillRect(x - 3, roof + 9, 9, 3); }
      }
      // shade on the lower tier from the roof
      const sg = ctx.createLinearGradient(0, topY - 150, 0, topY); sg.addColorStop(0, 'rgba(3,5,10,0.7)'); sg.addColorStop(1, 'rgba(3,5,10,0.15)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, LW, topY);
      // LED boards
      this.boards(ctx, -1.8, T);
    }
    // --- grass -----------------------------------------------------------------------------
    const g0 = Math.max(0, this.sy(-1.2));
    ctx.fillStyle = '#25702f'; ctx.fillRect(0, g0, LW, LH - g0);
    // the playing surface: two-way mowing (vertical bands and lighter cross bands)
    const px0 = this.sx(0), px1 = this.sx(105), py0 = this.sy(0), py1 = this.sy(68);
    for (let i = 0; i < 20; i++) {
      const x0 = this.sx(i * 5.25), x1 = this.sx((i + 1) * 5.25);
      if (x1 < 0 || x0 > LW) continue;
      ctx.fillStyle = i % 2 ? '#37a043' : '#2f9139';
      ctx.fillRect(Math.round(x0), Math.round(py0 - 6), Math.round(x1 - x0) + 1, Math.round(py1 - py0) + 12);
    }
    for (let j = 0; j < 10; j++) {
      if (j % 2) continue;
      const y0 = this.sy(j * 6.8), y1 = this.sy((j + 1) * 6.8);
      ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(Math.round(px0), Math.round(y0), Math.round(px1 - px0), Math.round(y1 - y0));
    }
    // world-anchored texture
    if (!this.grassTex) {
      const c = document.createElement('canvas'); c.width = 96; c.height = 96; const g = c.getContext('2d')!;
      for (let i = 0; i < 900; i++) { const v = Math.random(); g.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.07)' : v < 0.85 ? 'rgba(255,255,255,0.05)' : 'rgba(190,255,150,0.1)'; g.fillRect(Math.floor(Math.random() * 96), Math.floor(Math.random() * 96), 1, v > 0.92 ? 2 : 1); }
      this.grassTex = c; this.grass = ctx.createPattern(c, 'repeat');
    }
    if (this.grass) {
      this.grass.setTransform?.(new DOMMatrix().translate(Math.round(this.sx(0)) % 96, Math.round(this.sy(0)) % 96));
      ctx.fillStyle = this.grass; ctx.fillRect(0, g0, LW, LH - g0);
    }
    // goalmouth wear
    for (const gx of [0, 105]) {
      const cx = this.sx(gx + (gx ? -5 : 5)), cy = this.sy(34);
      const wg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 6 * PPM); wg.addColorStop(0, 'rgba(120,100,60,0.25)'); wg.addColorStop(1, 'rgba(120,100,60,0)');
      ctx.fillStyle = wg; ctx.fillRect(cx - 6 * PPM, cy - 4 * PPM, 12 * PPM, 8 * PPM);
    }
    // floodlight pools
    const lg = ctx.createRadialGradient(LW / 2, LH * 0.45, 20, LW / 2, LH * 0.5, LW * 0.75); lg.addColorStop(0, 'rgba(255,255,230,0.07)'); lg.addColorStop(1, 'rgba(0,0,10,0.28)');
    ctx.fillStyle = lg; ctx.fillRect(0, g0, LW, LH - g0);
    // --- markings -------------------------------------------------------------------------
    ctx.fillStyle = 'rgba(245,250,245,0.88)';
    const line = (x1: number, y1: number, x2: number, y2: number) => this.lineM(ctx, x1, y1, x2, y2);
    line(0, 0, 105, 0); line(0, 68, 105, 68); line(0, 0, 0, 68); line(105, 0, 105, 68); line(52.5, 0, 52.5, 68);
    for (const s of [0, 1]) {
      const gx = s ? 105 : 0, d = s ? -1 : 1;
      line(gx, 13.84, gx + d * 16.5, 13.84); line(gx + d * 16.5, 13.84, gx + d * 16.5, 54.16); line(gx, 54.16, gx + d * 16.5, 54.16);
      line(gx, 24.84, gx + d * 5.5, 24.84); line(gx + d * 5.5, 24.84, gx + d * 5.5, 43.16); line(gx, 43.16, gx + d * 5.5, 43.16);
      this.arcM(ctx, gx + d * 11, 34, 9.15, s ? Math.PI * 0.705 : -Math.PI * 0.295, s ? Math.PI * 1.295 : Math.PI * 0.295);
      ctx.fillRect(Math.round(this.sx(gx + d * 11)) - 1, Math.round(this.sy(34)) - 1, 3, 2);
      this.arcM(ctx, gx, 0, 1, s ? Math.PI / 2 : 0, s ? Math.PI : Math.PI / 2);
      this.arcM(ctx, gx, 68, 1, s ? Math.PI : -Math.PI / 2, s ? Math.PI * 1.5 : 0);
      for (const fy of [0, 68]) {
        const fx = Math.round(this.sx(gx)), fyy = Math.round(this.sy(fy));
        ctx.fillStyle = '#e5e7eb'; ctx.fillRect(fx, fyy - 14, 1, 14);
        ctx.fillStyle = '#f5c542'; const wv = Math.round(Math.sin(T * 5 + fy) * 1);
        ctx.fillRect(fx + 1, fyy - 14, 5, 2); ctx.fillRect(fx + 1, fyy - 12, 4 + wv, 2);
        ctx.fillStyle = 'rgba(245,250,245,0.88)';
      }
    }
    this.arcM(ctx, 52.5, 34, 9.15, 0, Math.PI * 2);
    ctx.fillRect(Math.round(this.sx(52.5)) - 1, Math.round(this.sy(34)) - 1, 3, 2);
  }
  /** LED advertising boards along a touchline at world y. */
  private boards(ctx: CanvasRenderingContext2D, wy: number, T: number) {
    const by = Math.round(this.sy(wy));
    if (by < -10 || by > LH + 14) return;
    ctx.fillStyle = '#05070d'; ctx.fillRect(0, by - 13, LW, 14);
    ctx.font = 'bold 8px monospace'; ctx.textBaseline = 'middle';
    const scroll = Math.floor(T / 6) % 3;
    const startX = this.sx(-20);
    for (let i = 0; i < 24; i++) {
      const x = Math.round(startX + i * 9 * PPM), wpx = Math.round(8.8 * PPM);
      if (x > LW || x + wpx < 0) continue;
      const k = (i + scroll) % 3;
      const bg = k === 0 ? '#22e3a1' : k === 1 ? this.m.clubs[0].c1 : '#0b1c3f';
      ctx.fillStyle = bg; ctx.fillRect(x, by - 12, wpx, 11);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, by - 12, wpx, 1);
      ctx.fillStyle = luminance(bg) > 0.6 ? '#05060a' : '#fff';
      ctx.fillText(k === 0 ? 'PITCH GM' : k === 1 ? `${this.m.clubs[0].short} v ${this.m.clubs[1].short}` : 'MATCHDAY LIVE', x + 8, by - 6);
    }
  }
  private lineM(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    const a = [this.sx(x1), this.sy(y1)], b = [this.sx(x2), this.sy(y2)];
    const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])));
    if (n > 3000) return;
    for (let i = 0; i <= n; i++) { const t = i / Math.max(1, n); const x = Math.round(a[0] + (b[0] - a[0]) * t), y = Math.round(a[1] + (b[1] - a[1]) * t); if (x >= -2 && x <= LW + 2 && y >= -2 && y <= LH + 2) ctx.fillRect(x, y, 2, 1); }
  }
  private arcM(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, a0: number, a1: number) {
    const n = Math.ceil(r * PPM * Math.abs(a1 - a0) * 1.2);
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const x = Math.round(this.sx(cx + Math.cos(a) * r)), y = Math.round(this.sy(cy + Math.sin(a) * r)); ctx.fillRect(x, y, 2, 1); }
  }
  /** Back of the net (drawn before the players). */
  private drawGoal(ctx: CanvasRenderingContext2D, side: number) {
    const gx = side ? 105 : 0, d = side ? 1 : -1, depth = 2;
    const shake = this.netShake.side === side && this.time - this.netShake.t < 1.2 ? Math.sin((this.time - this.netShake.t) * 30) * (1.2 - (this.time - this.netShake.t)) * 0.5 : 0;
    const y0 = 30.34, y1 = 37.66, h = 2.44;
    const P = (x: number, y: number, z: number) => [this.sx(x), this.sy(y, z)];
    if (this.sx(gx + d * depth) < -40 || this.sx(gx + d * depth) > LW + 40) return;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    const bl = P(gx + d * (depth + shake), y0, 0), br = P(gx + d * (depth + shake), y1, 0), tl = P(gx + d * (depth + shake), y0, h * 0.85);
    ctx.fillRect(Math.round(Math.min(bl[0], br[0])) - 1, Math.round(tl[1]), 3, Math.round(br[1] - tl[1]));
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    // net mesh: lines from the goal line back to the rear frame
    for (let k = 0; k <= 10; k++) {
      const yy = y0 + (y1 - y0) * k / 10;
      const a = P(gx, yy, h), b = P(gx + d * (depth + shake), yy, h * 0.85), c2 = P(gx + d * (depth + shake), yy, 0);
      this.rawLine(ctx, a, b); this.rawLine(ctx, b, c2);
    }
    for (let k = 0; k <= 6; k++) {
      const zz = h * 0.85 * k / 6;
      this.rawLine(ctx, P(gx + d * (depth + shake), y0, zz), P(gx + d * (depth + shake), y1, zz));
    }
  }
  private drawGoalFront(ctx: CanvasRenderingContext2D, side: number) {
    const gx = side ? 105 : 0;
    const y0 = 30.34, y1 = 37.66, h = 2.44;
    if (this.sx(gx) < -40 || this.sx(gx) > LW + 40) return;
    ctx.fillStyle = '#f4f6fb';
    const p0 = [this.sx(gx), this.sy(y0)], p1 = [this.sx(gx), this.sy(y1)], t0 = [this.sx(gx), this.sy(y0, h)], t1 = [this.sx(gx), this.sy(y1, h)];
    ctx.fillRect(Math.round(p0[0]) - 1, Math.round(t0[1]), 2, Math.round(p0[1] - t0[1]));
    ctx.fillRect(Math.round(p1[0]) - 1, Math.round(t1[1]), 2, Math.round(p1[1] - t1[1]));
    ctx.fillRect(Math.round(t0[0]) - 1, Math.round(t0[1]), 2, Math.round(t1[1] - t0[1]) + 2);
  }
  private rawLine(ctx: CanvasRenderingContext2D, a: number[], b: number[]) {
    const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])));
    for (let i = 0; i <= n; i++) { const t = i / Math.max(1, n); ctx.fillRect(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), 1, 1); }
  }
  private drawBall(ctx: CanvasRenderingContext2D, ball: [number, number], z: number) {
    const x = Math.round(this.sx(ball[0])), y = Math.round(this.sy(ball[1], z));
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(x - 3, y - 4, 6, 6); ctx.fillRect(x - 2, y - 5, 4, 8);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 4, 4, 6); ctx.fillRect(x - 3, y - 3, 6, 4);
    ctx.fillStyle = '#222'; const sp = Math.floor(this.time * 10) % 2; ctx.fillRect(x - 1 + sp, y - 2, 2, 2);
  }
  private drawPuffs(ctx: CanvasRenderingContext2D) {
    const T = this.time;
    this.puffs = this.puffs.filter(p => T - p.t < 0.6);
    for (const p of this.puffs) {
      const k = (T - p.t) / 0.6;
      const r = Math.round(1 + k * 3 * p.s);
      ctx.globalAlpha = 0.75 * (1 - k);
      ctx.fillStyle = '#f1f5f9';
      const x = Math.round(this.sx(p.x)), y = Math.round(this.sy(p.y) - 2 - k * 3);
      ctx.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2); ctx.fillRect(x - r + 1, y - r, r * 2 - 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }
  private tag(ctx: CanvasRenderingContext2D, an: Anim, text: string, color: string) {
    ctx.font = 'bold 7px monospace'; ctx.textBaseline = 'middle';
    const w = Math.ceil(ctx.measureText(text).width) + 6;
    const x = Math.round(this.sx(an.x) - w / 2), y = Math.round(this.sy(an.y) - 46);
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(x - 1, y - 1, w + 2, 11);
    ctx.fillStyle = color; ctx.fillRect(x, y, w, 9);
    ctx.fillStyle = luminance(color) > 0.6 ? '#05060a' : '#fff'; ctx.fillText(text, x + 3, y + 5);
    ctx.fillStyle = color; ctx.fillRect(x + Math.round(w / 2) - 1, y + 9, 3, 2);
  }
  private drawRadar(ctx: CanvasRenderingContext2D, ball: [number, number]) {
    const W = 126, H = 54, x0 = Math.round(LW / 2 - W / 2), y0 = LH - H - 6;
    ctx.fillStyle = 'rgba(5,8,16,0.72)'; ctx.fillRect(x0 - 2, y0 - 2, W + 4, H + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x0 + W / 2, y0, 1, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.strokeRect(x0 + 0.5, y0 + 0.5, W - 1, H - 1);
    for (const [id, an] of this.anim) {
      const l = this.m.byId.get(id); if (!l) continue;
      ctx.fillStyle = l.side === 0 ? this.looks.get(id)!.shirt : this.looks.get(id)!.shirt;
      ctx.fillRect(Math.round(x0 + an.x / 105 * W) - 1, Math.round(y0 + an.y / 68 * H) - 1, 3, 3);
    }
    ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x0 + ball[0] / 105 * W) - 1, Math.round(y0 + ball[1] / 68 * H) - 1, 2, 2);
    // camera window
    const half = LW / 2 / PPM;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeRect(Math.round(x0 + (this.cam.x - half) / 105 * W) + 0.5, y0 + 0.5, Math.round(half * 2 / 105 * W), H - 1);
  }
}
