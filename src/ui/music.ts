/**
 * The score: generative, slow, and steered by the city.
 *
 * A city builder is played for hours, and a looped track is heard for the
 * tenth time within one of them. So nothing here is a track. A chord
 * progression is chosen a phrase at a time from a small set, voiced as a warm
 * pad with a soft bass under it, and a sparse melody is improvised over it from
 * the chord's own tones -- all of it synthesised, because the game ships as a
 * single file and a few kilobytes of code is not a few megabytes of audio.
 *
 * What the city is doing moves it: by day the pad is open and the melody
 * moves; after dark the filter closes, the melody thins out and the
 * progressions lean minor; a city in debt or in a bad mood gets the darker
 * progressions whatever the hour. None of it is abrupt -- the changes land on
 * the next chord.
 */

import { bus } from './sound';

export interface MusicMood {
  /** 0 by day, 1 at night. */
  night: number;
  /** 0 to 1: how the city feels. */
  happiness: number;
  /** Whether the treasury is in the red. */
  debt: boolean;
  /** Whether time is running. Paused, the score keeps going, quieter. */
  running: boolean;
}

/** Semitones above the key's root. */
type Chord = readonly number[];

const KEY = 50; // D3, as a MIDI note

/** Progressions, as chords of scale degrees in D major; four bars each. */
const BRIGHT: Chord[][] = [
  [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]],   // Imaj7 vi IV V
  [[5, 9, 12, 16], [0, 4, 7, 14], [7, 11, 14, 21], [9, 12, 16, 19]],   // IV I(add9) V vi
  [[0, 7, 11, 16], [4, 7, 11, 14], [5, 9, 12, 16], [5, 7, 12, 14]],   // I iii IV IVsus
];
const DARK: Chord[][] = [
  [[9, 12, 16, 19], [5, 9, 12, 16], [0, 4, 7, 11], [7, 11, 14, 17]],   // vi IV I V
  [[9, 12, 16, 21], [4, 7, 11, 14], [5, 9, 12, 16], [2, 5, 9, 12]],    // vi iii IV ii
  [[2, 5, 9, 12], [9, 12, 16, 19], [4, 7, 11, 14], [9, 12, 16, 19]],   // ii vi iii vi
];

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** Seconds a chord lasts. Slow: this is a score to build to, not to dance to. */
const BAR = 7.5;

export class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private wet: GainNode | null = null;
  private echo: DelayNode | null = null;
  private timer = 0;
  /** Audio-clock time the next bar starts. */
  private nextBar = 0;
  private bar = 0;
  private phrase: Chord[] = BRIGHT[0];
  private mood: MusicMood = { night: 0, happiness: 0.6, debt: false, running: true };
  private level = 0.45;
  private seed = 7;

  /** Music volume, 0 to 1, on top of the master volume. */
  setLevel(v: number): void {
    this.level = Math.max(0, Math.min(1, v));
    if (this.out !== null && this.ctx !== null) {
      this.out.gain.setTargetAtTime(this.level * 0.5, this.ctx.currentTime, 0.4);
    }
  }

  /** Starts the score. Must follow a user gesture. */
  start(): void {
    if (this.ctx !== null) return;
    const b = bus();
    if (b === null) return;
    const ctx = b.ctx;
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.setTargetAtTime(this.level * 0.5, ctx.currentTime, 3);
    this.out.connect(b.out);

    // The room: a reverb from a decaying noise impulse, and a soft echo that
    // only the melody feeds.
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(ctx, 3.2);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.55;
    this.wet.connect(verb);
    verb.connect(this.out);
    this.echo = ctx.createDelay(2);
    this.echo.delayTime.value = BAR / 8 * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 2200;
    this.echo.connect(echoTone);
    echoTone.connect(feedback);
    feedback.connect(this.echo);
    echoTone.connect(this.wet);

    // The pad's filter, which the time of day opens and closes.
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 1400;
    this.filter.Q.value = 0.4;
    this.filter.connect(this.out);
    this.filter.connect(this.wet);

    this.nextBar = ctx.currentTime + 0.5;
    // A lookahead scheduler: every quarter second, anything due in the next
    // two seconds is put on the audio clock, which is what keeps the timing
    // steady whatever the frame rate is doing.
    this.timer = window.setInterval(() => this.schedule(), 250);
  }

  stop(): void {
    clearInterval(this.timer);
    if (this.out !== null && this.ctx !== null) {
      this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 1);
    }
  }

  /** What the city is doing; read at the next bar. */
  update(mood: MusicMood): void {
    this.mood = mood;
    if (this.filter !== null && this.ctx !== null) {
      const open = 700 + 1500 * (1 - mood.night) * (0.6 + 0.4 * mood.happiness);
      this.filter.frequency.setTargetAtTime(open, this.ctx.currentTime, 4);
    }
    if (this.out !== null && this.ctx !== null) {
      const want = this.level * 0.5 * (mood.running ? 1 : 0.6);
      this.out.gain.setTargetAtTime(want, this.ctx.currentTime, 1.5);
    }
  }

  private rand(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    while (this.nextBar < ctx.currentTime + 2) {
      if (this.bar % 4 === 0) this.choosePhrase();
      const chord = this.phrase[this.bar % 4];
      this.playBar(chord, this.nextBar);
      this.nextBar += BAR;
      this.bar++;
    }
  }

  /** A new progression every four bars, darker at night or when things are bad. */
  private choosePhrase(): void {
    const m = this.mood;
    const gloom = Math.min(1, m.night * 0.6 + (1 - m.happiness) * 0.6 + (m.debt ? 0.5 : 0));
    const pool = this.rand() < gloom ? DARK : BRIGHT;
    this.phrase = pool[Math.floor(this.rand() * pool.length)];
  }

  private playBar(chord: Chord, at: number): void {
    const ctx = this.ctx;
    if (ctx === null || this.filter === null) return;
    // ---- the pad: every chord tone, two detuned voices each ----------------
    for (const step of chord) {
      for (const detune of [-6, 5]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = hz(KEY + 12 + step);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.018, at + 2.2);
        g.gain.setValueAtTime(0.018, at + BAR - 1.2);
        g.gain.exponentialRampToValueAtTime(0.0001, at + BAR + 1.8);
        osc.connect(g);
        g.connect(this.filter);
        osc.start(at);
        osc.stop(at + BAR + 2);
      }
    }
    // ---- the bass: the root, soft, on the bar and halfway ------------------
    for (const t of [0, BAR / 2]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = hz(KEY - 12 + chord[0]);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at + t);
      g.gain.exponentialRampToValueAtTime(0.09, at + t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, at + t + BAR / 2);
      osc.connect(g);
      g.connect(this.out as GainNode);
      osc.start(at + t);
      osc.stop(at + t + BAR / 2 + 0.1);
    }
    // ---- the melody: a few notes from the chord, fewer at night ------------
    const busy = 0.55 * (1 - this.mood.night * 0.6);
    const tones = [...chord.map((s) => s + 24), chord[0] + 36, chord[1] + 36];
    for (let beat = 0; beat < 8; beat++) {
      if (this.rand() > busy * (beat % 2 === 0 ? 1 : 0.5)) continue;
      const note = tones[Math.floor(this.rand() * tones.length)];
      this.pluck(hz(KEY + note), at + beat * (BAR / 8) + this.rand() * 0.04);
    }
  }

  /** A soft struck note: a triangle with a quick decay, and its octave, faintly. */
  private pluck(f: number, at: number): void {
    const ctx = this.ctx;
    if (ctx === null || this.out === null || this.echo === null || this.wet === null) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.07, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 2.4);
    for (const [mult, amp] of [[1, 1], [2, 0.18]] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f * mult;
      const og = ctx.createGain();
      og.gain.value = amp;
      osc.connect(og);
      og.connect(g);
      osc.start(at);
      osc.stop(at + 2.5);
    }
    g.connect(this.out);
    g.connect(this.echo);
    g.connect(this.wet);
  }

  /** A reverb impulse: stereo noise, decaying. */
  private impulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2.6;
    }
    return buf;
  }
}

/** The one score the game plays. */
export const music = new Music();
