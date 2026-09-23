/**
 * The soundscape: what the city sounds like from where the camera is.
 *
 * All of it is synthesised -- one buffer of noise shaped by filters into
 * wind, the low hum of a town, the swish of traffic and the hiss of rain, and
 * oscillator sweeps for birds by day and crickets by night -- because the game
 * ships as a single file and a few seconds of noise is a few kilobytes of
 * code rather than megabytes of recordings.
 *
 * Every layer is driven by something the player can see: the camera's height
 * (open air is windy, a street is not), how much city and traffic there is,
 * the weather and the hour. Nothing loops audibly because nothing is a loop of
 * anything recognisable -- noise, filtered, with its levels always moving.
 */

import { bus } from './sound';

export interface Scene {
  /** Camera distance from its focus, metres. */
  distance: number;
  /** 0 on empty land, 1 in a busy town. */
  city: number;
  /** 0 with no vehicles about, 1 in heavy traffic. */
  traffic: number;
  /** 0 to 1. */
  rain: number;
  /** 0 at noon, 1 after dark. */
  night: number;
  /** Whether time is running; paused, the living layers fall quiet. */
  running: boolean;
}

interface Layer { gain: GainNode; }

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Ambience {
  private ctx: AudioContext | null = null;
  private mix: GainNode | null = null;
  private wind: Layer | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private hum: Layer | null = null;
  private swish: Layer | null = null;
  private rain: Layer | null = null;
  private clock = 0;
  private nextBird = 2;
  private nextCricket = 1;

  /** Starts the layers. Must follow a user gesture, or the browser keeps it silent. */
  start(): void {
    if (this.ctx !== null) return;
    const b = bus();
    if (b === null) return;
    const ctx = b.ctx;
    if (ctx.state === 'suspended') void ctx.resume();
    this.ctx = ctx;
    this.mix = ctx.createGain();
    this.mix.gain.value = 0;
    this.mix.gain.setTargetAtTime(1, ctx.currentTime, 1.5);
    this.mix.connect(b.out);

    const noise = this.noise(ctx, 6);
    const layer = (filters: BiquadFilterNode[]): Layer => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      // Each layer starts at its own point in the buffer, so the same six
      // seconds of noise never lines up with itself across layers.
      src.start(0, Math.random() * noise.duration);
      let node: AudioNode = src;
      for (const f of filters) { node.connect(f); node = f; }
      const gain = ctx.createGain();
      gain.gain.value = 0;
      node.connect(gain);
      gain.connect(this.mix as GainNode);
      return { gain };
    };
    const filter = (type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode => {
      const n = ctx.createBiquadFilter();
      n.type = type;
      n.frequency.value = f;
      n.Q.value = q;
      return n;
    };
    this.windFilter = filter('bandpass', 380, 0.9);
    this.wind = layer([this.windFilter, filter('lowpass', 1400)]);
    this.hum = layer([filter('lowpass', 220), filter('lowpass', 320)]);
    this.swish = layer([filter('bandpass', 900, 0.8), filter('highpass', 300)]);
    this.rain = layer([filter('highpass', 1800), filter('lowpass', 9000)]);
  }

  /** Pink-ish noise: white noise run through a leaky integrator. */
  private noise(ctx: AudioContext, seconds: number): AudioBuffer {
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
    }
    // Cross-fade the seam so the loop point is not a click.
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      d[i] = d[i] * t + d[n - fade + i] * (1 - t);
    }
    return buf;
  }

  update(s: Scene, dt: number): void {
    const ctx = this.ctx;
    if (ctx === null || this.wind === null || this.hum === null
      || this.swish === null || this.rain === null || this.windFilter === null) return;
    this.clock += dt;
    const t = ctx.currentTime;
    // How far up the camera is: 0 at street level, 1 over the whole map.
    const high = smooth(120, 2400, s.distance);
    const near = 1 - smooth(250, 2200, s.distance);
    const live = s.running ? 1 : 0.35;

    // Wind: always there, stronger with height, gustier in the open.
    const gust = 0.75 + 0.25 * Math.sin(this.clock * 0.37) * Math.sin(this.clock * 0.13 + 1.7);
    const wind = (0.018 + 0.075 * high) * gust * (1 - s.city * near * 0.6) + s.rain * 0.03;
    this.wind.gain.gain.setTargetAtTime(wind, t, 0.6);
    this.windFilter.frequency.setTargetAtTime(300 + 260 * gust + 200 * high, t, 0.8);

    // The town: a low hum, and traffic you can hear once you are close to it.
    this.hum.gain.gain.setTargetAtTime(0.10 * s.city * (0.35 + 0.65 * near) * live, t, 0.8);
    const surge = 0.7 + 0.3 * Math.sin(this.clock * 0.9) * Math.sin(this.clock * 0.31);
    this.swish.gain.gain.setTargetAtTime(0.07 * s.traffic * near * near * surge * live, t, 0.5);
    this.rain.gain.gain.setTargetAtTime(0.16 * s.rain, t, 1.2);

    // Birds by day, over open ground or quiet streets, close to the ground.
    const birdy = (1 - s.night) * near * (1 - s.city * 0.7) * (1 - s.rain) * live;
    this.nextBird -= dt;
    if (this.nextBird <= 0) {
      this.nextBird = 1.2 + Math.random() * 5;
      if (Math.random() < birdy) this.bird(ctx, 0.05 * birdy);
    }
    const crickets = s.night * near * (1 - s.city * 0.8) * (1 - s.rain) * live;
    this.nextCricket -= dt;
    if (this.nextCricket <= 0) {
      this.nextCricket = 0.5 + Math.random() * 1.4;
      if (Math.random() < crickets) this.cricket(ctx, 0.022 * crickets);
    }
  }

  /** A short phrase of three to six chirps, somewhere to one side. */
  private bird(ctx: AudioContext, level: number): void {
    const out = this.pan(ctx, Math.random() * 1.6 - 0.8);
    const base = 2400 + Math.random() * 2400;
    const notes = 3 + Math.floor(Math.random() * 4);
    let at = ctx.currentTime + 0.02;
    for (let i = 0; i < notes; i++) {
      const len = 0.05 + Math.random() * 0.08;
      const f0 = base * (0.9 + Math.random() * 0.25);
      this.tone(ctx, out, f0, f0 * (1.1 + Math.random() * 0.5), at, len, level);
      at += len + 0.03 + Math.random() * 0.08;
    }
  }

  private cricket(ctx: AudioContext, level: number): void {
    const out = this.pan(ctx, Math.random() * 1.8 - 0.9);
    const f = 4200 + Math.random() * 600;
    let at = ctx.currentTime + 0.01;
    for (let i = 0; i < 3; i++) {
      this.tone(ctx, out, f, f, at, 0.035, level);
      at += 0.06;
    }
  }

  private pan(ctx: AudioContext, x: number): AudioNode {
    if (typeof ctx.createStereoPanner !== 'function') return this.mix as GainNode;
    const p = ctx.createStereoPanner();
    p.pan.value = x;
    p.connect(this.mix as GainNode);
    // Disconnected once its notes are done, so panners do not accumulate.
    setTimeout(() => p.disconnect(), 3000);
    return p;
  }

  private tone(ctx: AudioContext, out: AudioNode, f0: number, f1: number,
    at: number, len: number, level: number): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, at);
    osc.frequency.exponentialRampToValueAtTime(f1, at + len);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + len * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    osc.connect(g);
    g.connect(out);
    osc.start(at);
    osc.stop(at + len + 0.02);
  }
}
