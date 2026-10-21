import { useEffect, useRef } from 'react';
import type { Club, Player } from '../core/types';
import { drawPlayer, drawTrophy, lookFor, type Pose } from './pixel';

export interface Actor { p: Player; club?: Club; pose: Pose; x: number; facing?: 1 | -1; trophy?: boolean; ball?: boolean; dx?: number; delay?: number; y?: number; scale?: number }

/**
 * A small animated pixel scene (rendered at low resolution, upscaled crisp) for cutscenes:
 * pitch-side at night, a lit stage, or a podium. Actors animate their pose in a loop.
 */
export function PixelStage({ actors, bg = 'night', w = 200, h = 96, className, confetti, podium, accent = '#22e3a1' }: { actors: Actor[]; bg?: 'night' | 'stage' | 'tunnel'; w?: number; h?: number; className?: string; confetti?: string[]; podium?: boolean; accent?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const ctx = cv.getContext('2d')!;
    cv.width = w; cv.height = h; ctx.imageSmoothingEnabled = false;
    const looks = actors.map(a => lookFor(a.p, a.club));
    const bits = (confetti ?? []).length ? Array.from({ length: 70 }, () => ({ x: Math.random() * w, y: -Math.random() * h, v: 10 + Math.random() * 18, c: confetti![Math.floor(Math.random() * confetti!.length)], s: Math.random() < 0.5 ? 1 : 2 })) : [];
    const t0 = performance.now();
    let raf = 0, last = t0;
    const loop = (now: number) => {
      const T = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
      // backdrop
      if (bg === 'night') {
        const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#060914'); g.addColorStop(0.55, '#101a30'); g.addColorStop(0.56, '#2c8437'); g.addColorStop(1, '#246d2e');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        // crowd
        for (let x = 0; x < w; x += 3) for (let y = Math.round(h * 0.3); y < h * 0.52; y += 3) { ctx.fillStyle = ['#c8102e', '#e8bf9f', '#1d2433', '#f5f5f5', accent, '#3b2717'][(x * 7 + y * 3) % 6]; ctx.fillRect(x, y + (Math.sin(T * 8 + x) > 0.6 ? -1 : 0), 2, 2); }
        ctx.fillStyle = 'rgba(6,9,20,0.45)'; ctx.fillRect(0, h * 0.3, w, h * 0.22);
        ctx.fillStyle = accent; ctx.fillRect(0, Math.round(h * 0.52), w, 3);
        // floodlight flare
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (const fx of [w * 0.12, w * 0.88]) { ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx - 26, h * 0.56); ctx.lineTo(fx + 26, h * 0.56); ctx.fill(); }
        for (let i = 0; i < w; i += 8) { ctx.fillStyle = (Math.floor(i / 8) % 2) ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'; ctx.fillRect(i, h * 0.56, 8, h); }
      } else {
        const g = ctx.createRadialGradient(w / 2, h * 0.4, 4, w / 2, h * 0.5, w * 0.7); g.addColorStop(0, '#2a2f45'); g.addColorStop(1, '#05060c');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i < 5; i++) { const x = w * (0.1 + i * 0.2) + Math.sin(T * 0.6 + i) * 8; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 18, h); ctx.lineTo(x + 18, h); ctx.fill(); }
        ctx.fillStyle = '#0c0f1a'; ctx.fillRect(0, h - 12, w, 12);
        ctx.fillStyle = accent; ctx.fillRect(0, h - 12, w, 1);
      }
      if (podium) {
        const blocks: [number, number, string][] = [[w / 2, 18, '#f5c542'], [w / 2 - 44, 11, '#cbd5e1'], [w / 2 + 44, 7, '#c98f5b']];
        for (const [cx, ph, c] of blocks) { ctx.fillStyle = '#0b0d14'; ctx.fillRect(Math.round(cx - 19), h - 12 - ph - 1, 38, ph + 1); ctx.fillStyle = c; ctx.fillRect(Math.round(cx - 18), h - 12 - ph, 36, ph); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(Math.round(cx - 18), h - 12 - ph, 36, 1); }
      }
      // actors
      actors.forEach((a, i) => {
        const start = a.delay ?? 0;
        const k = Math.min(1, Math.max(0, (T - start) / 0.9));
        const x = a.x + (a.dx ?? 0) * (1 - k);
        const fy = a.y ?? (bg === 'night' ? h - 8 : h - 12);
        const sc = a.scale ?? 1;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(Math.round(x - 6 * sc), Math.round(fy - 1), Math.round(13 * sc), 2);
        const moving = (a.dx ?? 0) !== 0 && k < 1;
        drawPlayer(ctx, x, fy, looks[i], moving ? 'run' : a.pose, T * 3.2 + i, ((T * 0.8) % 1), a.facing ?? 1, sc);
        if (a.trophy && !moving) { const lift = a.pose === 'lift' ? 26 + Math.abs(Math.sin(T * 3.2 + i)) * 1.5 : 10; drawTrophy(ctx, x + (a.facing ?? 1) * 2, fy - lift * sc, sc); }
        if (a.ball) { ctx.fillStyle = '#0b0d14'; ctx.fillRect(Math.round(x + 7), Math.round(fy - 5), 6, 6); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x + 8), Math.round(fy - 4), 4, 4); }
      });
      for (const b of bits) { b.y += b.v * dt; b.x += Math.sin(T * 3 + b.v) * 0.3; if (b.y > h) { b.y = -4; b.x = Math.random() * w; } ctx.fillStyle = b.c; ctx.fillRect(Math.round(b.x), Math.round(b.y), b.s, b.s + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [actors, bg, w, h, confetti, podium, accent]);
  return <canvas ref={ref} className={`pixel-stage ${className ?? ''}`} />;
}
