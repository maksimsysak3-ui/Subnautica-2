/**
 * The studio ident, played over a black screen before the game's own title.
 *
 * Keystone: the stone at the crown of an arch that locks every other stone in
 * place. The ident builds one -- nine stones hanging in the dark swing into
 * place and the keystone lowers and locks -- and the arch becomes the mark with
 * the wordmark under it. The scene is `introProgram`; this file mounts it,
 * gives it a Worker where the browser allows so it plays smoothly while the
 * city is built behind it, draws the wordmark, scores it where audio is
 * allowed, and takes it down.
 *
 * Any key, click or tap skips it. Automation never sees it.
 */

import { introProgram } from './intro-program';

/** The ident's beats, in seconds from the black. Shared with the scene. */
const TIMELINE = {
  /** When each pair of stones, from the springing up, starts to swing in. */
  settle: [2.1, 2.72, 3.34, 3.96],
  keyStart: 4.85,
  lock: 6.4,
  logo: 7.3,
  end: 11.2,
};

export interface IntroOptions {
  /** Hold one moment instead of playing: for screenshots. */
  freeze?: number;
  /** Run on the main thread even where a Worker could take it. */
  mainThread?: boolean;
}

/** Plays the ident. Resolves when it has finished or been skipped. */
export function playIntro(opts: IntroOptions = {}): Promise<void> {
  const query = new URLSearchParams(location.search);
  if (navigator.webdriver && opts.freeze === undefined) return Promise.resolve();
  if (query.has('nointro')) return Promise.resolve();

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shell = document.createElement('div');
  shell.setAttribute('role', 'img');
  shell.setAttribute('aria-label', 'Keystone');
  shell.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#000;'
    + 'transition:opacity .7s ease;cursor:pointer';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  const hint = document.createElement('div');
  hint.textContent = 'Press any key to skip';
  hint.style.cssText = 'position:absolute;right:28px;bottom:22px;font:600 11px/1 system-ui,sans-serif;'
    + 'letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.34);opacity:0;white-space:nowrap;'
    + 'transition:opacity 1.2s ease;pointer-events:none';
  shell.append(canvas, hint);
  document.body.appendChild(shell);
  setTimeout(() => { hint.style.opacity = '1'; }, 1800);

  const size = (): [number, number] => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    return [Math.round(innerWidth * dpr), Math.round(innerHeight * dpr)];
  };

  return new Promise<void>((resolve) => {
    let done = false;
    let post: (m: unknown, t?: Transferable[]) => void = () => {};
    let worker: Worker | null = null;
    let url = '';

    const finish = (): void => {
      if (done) return;
      done = true;
      removeEventListener('keydown', skip, true);
      removeEventListener('resize', onResize);
      shell.style.opacity = '0';
      setTimeout(() => {
        shell.remove();
        worker?.terminate();
        if (url) URL.revokeObjectURL(url);
      }, 750);
      resolve();
    };
    const skip = (e?: Event): void => {
      if (opts.freeze !== undefined) return;
      if (e instanceof KeyboardEvent) { e.preventDefault(); e.stopPropagation(); }
      post({ type: 'skip' });
      stopScore();
      // Belt and braces: if the scene cannot answer, go anyway.
      setTimeout(finish, 900);
    };
    const onResize = (): void => { const [w, h] = size(); post({ type: 'resize', width: w, height: h }); };
    const onMessage = (m: { type: string; error?: string }): void => {
      if (m.type === 'done') {
        if (m.error) console.warn('[intro]', m.error);
        finish();
      }
    };

    const [w, h] = size();
    const init = { type: 'init', width: w, height: h, timeline: { ...TIMELINE, reduced }, freeze: opts.freeze };
    const offscreen = !opts.mainThread && typeof canvas.transferControlToOffscreen === 'function'
      && typeof Worker !== 'undefined';
    let started = false;
    if (offscreen) {
      try {
        const src = `(${introProgram.toString()})(self);`;
        url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        worker = new Worker(url);
        worker.onmessage = (e) => onMessage(e.data);
        worker.onerror = () => finish();
        const off = canvas.transferControlToOffscreen();
        post = (m, t = []) => worker?.postMessage(m, t);
        post({ ...init, canvas: off }, [off]);
        started = true;
      } catch {
        worker?.terminate();
        worker = null;
      }
    }
    if (!started) {
      // The same program, on this thread. It stutters while the city builds,
      // but it plays.
      const scope: { onmessage: ((e: { data: unknown }) => void) | null; postMessage: (m: never) => void; requestAnimationFrame: typeof requestAnimationFrame } = {
        onmessage: null,
        postMessage: (m) => onMessage(m),
        requestAnimationFrame: (f) => requestAnimationFrame(f),
      };
      introProgram(scope);
      post = (m) => scope.onmessage?.({ data: m });
      post({ ...init, canvas });
    }

    addEventListener('keydown', skip, true);
    addEventListener('resize', onResize);
    shell.addEventListener('pointerdown', () => skip());

    void wordmark().then((bitmap) => { if (bitmap && !done) post({ type: 'text', bitmap }, [bitmap]); });
    if (opts.freeze === undefined && !reduced) score();
    // Whatever happens, the game is never held behind the ident.
    if (opts.freeze === undefined) setTimeout(finish, (TIMELINE.end + 4) * 1000);
  });
}

/** The wordmark, drawn once into a bitmap for the scene to reveal. */
async function wordmark(): Promise<ImageBitmap | null> {
  try {
    const face = '"Big Shoulders Display", "Helvetica Neue", Arial, sans-serif';
    await Promise.race([
      document.fonts?.load(`800 200px ${face}`),
      new Promise((r) => setTimeout(r, 900)),
    ]);
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 512;
    const g = c.getContext('2d');
    if (!g) return null;
    g.fillStyle = '#fff';
    g.textBaseline = 'alphabetic';
    const spaced = (text: string, px: number, weight: number, track: number, y: number): void => {
      g.font = `${weight} ${px}px ${face}`;
      const widths = [...text].map((ch) => g.measureText(ch).width);
      const total = widths.reduce((a, b) => a + b, 0) + track * (text.length - 1);
      let x = (c.width - total) / 2;
      [...text].forEach((ch, i) => { g.fillText(ch, x, y); x += widths[i] + track; });
    };
    spaced('KEYSTONE', 250, 800, 46, 300);
    g.globalAlpha = 0.75;
    g.fillRect(784, 356, 480, 3);
    spaced('STUDIO', 64, 600, 40, 452);
    return await createImageBitmap(c);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ score

let audio: AudioContext | null = null;

/**
 * The sound, scheduled all at once on the audio clock so a busy main thread
 * cannot knock it out of time: a low swell out of the silence, a stone's weight
 * as each pair lands, the lock -- a deep hit and a ring over it -- and a warm
 * chord under the wordmark. A browser keeps audio silent until the player has
 * interacted with the page, so on a cold load this is usually skipped.
 */
function score(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const a = new Ctx();
    audio = a;
    const began = performance.now();
    if (a.state === 'running') { scoreOn(a, 0); return; }
    // Allowed only if the browser lets it start almost at once; a score that
    // arrives late would be out of step with the pictures.
    a.resume().then(() => {
      const late = (performance.now() - began) / 1000;
      if (late < 0.4 && audio === a) scoreOn(a, late);
      else void a.close().catch(() => {});
    }, () => { void a.close().catch(() => {}); });
  } catch {
    audio = null;
  }
}

function scoreOn(a: AudioContext, late: number): void {
  try {
    const t0 = a.currentTime + 0.05 - late;
    const out = a.createGain();
    out.gain.value = 0.55;
    out.connect(a.destination);
    const noise = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const ch = noise.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;

    const tone = (freq: number, at: number, dur: number, peak: number, type: OscillatorType = 'sine', drop = 1): void => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0 + at);
      if (drop !== 1) o.frequency.exponentialRampToValueAtTime(freq * drop, t0 + at + dur);
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(peak, t0 + at + Math.min(0.04, dur / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g).connect(out);
      o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
    };
    const hiss = (at: number, dur: number, peak: number, freq: number): void => {
      const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      s.buffer = noise;
      f.type = 'lowpass'; f.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(peak, t0 + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      s.connect(f).connect(g).connect(out);
      s.start(t0 + at); s.stop(t0 + at + dur + 0.05);
    };
    // The swell.
    const drone = a.createOscillator(), dg = a.createGain();
    drone.type = 'sawtooth'; drone.frequency.value = 55;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    dg.gain.setValueAtTime(0.0001, t0 + 0.8);
    dg.gain.exponentialRampToValueAtTime(0.18, t0 + TIMELINE.lock - 0.1);
    dg.gain.exponentialRampToValueAtTime(0.0001, t0 + TIMELINE.lock + 0.4);
    drone.connect(lp).connect(dg).connect(out);
    drone.start(t0 + 0.8); drone.stop(t0 + TIMELINE.lock + 0.5);
    // Each pair landing.
    for (const s of TIMELINE.settle) {
      tone(90, s + 1.0, 0.5, 0.35, 'sine', 0.5);
      hiss(s + 1.0, 0.35, 0.12, 900);
    }
    // The lock.
    tone(60, TIMELINE.lock, 2.4, 0.9, 'sine', 0.45);
    hiss(TIMELINE.lock, 1.6, 0.35, 2400);
    for (const f of [880, 1318.5, 1760]) tone(f, TIMELINE.lock + 0.02, 3.2, 0.05, 'triangle');
    // The chord under the name.
    for (const f of [110, 164.8, 220, 277.2, 329.6]) tone(f, TIMELINE.logo, 3.6, 0.08, 'triangle');
  } catch {
    audio = null;
  }
}

function stopScore(): void {
  if (audio) { void audio.close().catch(() => {}); audio = null; }
}
