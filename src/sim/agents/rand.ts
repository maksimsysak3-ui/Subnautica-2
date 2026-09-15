/**
 * The simulation's random numbers.
 *
 * Its own generator rather than Math.random, for one reason that matters: a
 * saved city has to reload into the same city. Math.random cannot be seeded, so
 * a save that stored every citizen perfectly would still diverge the moment it
 * resumed -- different people would fall ill, different shops would fail -- and
 * the bug that reports as is "my city changed after I loaded it", which is
 * impossible to investigate without this.
 *
 * xorshift128, because it is four integer operations, has a period far beyond
 * anything a city will consume, and passes the only tests that matter here:
 * no visible structure in the low bits, and no short cycles when several streams
 * are seeded from nearby numbers.
 */
export class Rng {
  private a = 0; private b = 0; private c = 0; private d = 0;

  constructor(seed = 0x2f6e2b1) { this.seed(seed); }

  seed(seed: number): void {
    // Spread one number over four words. A generator seeded with three zeros
    // takes thousands of draws to look random at all, which is exactly the
    // interval a city spends being founded.
    let h = (seed | 0) || 1;
    const mix = (): number => {
      h ^= h << 13; h >>>= 0;
      h ^= h >>> 17;
      h ^= h << 5; h >>>= 0;
      return h;
    };
    this.a = mix(); this.b = mix(); this.c = mix(); this.d = mix();
  }

  /** The next 32 bits, unsigned. */
  bits(): number {
    let t = this.d;
    const s = this.a;
    this.d = this.c; this.c = this.b; this.b = s;
    t ^= t << 11; t >>>= 0;
    t ^= t >>> 8;
    this.a = (t ^ s ^ (s >>> 19)) >>> 0;
    return this.a;
  }

  /** In [0, 1). */
  next(): number { return this.bits() * 2.3283064365386963e-10; }

  /** In [0, n), an integer. */
  int(n: number): number { return (this.next() * n) | 0; }

  /** In [lo, hi). */
  range(lo: number, hi: number): number { return lo + this.next() * (hi - lo); }

  /** True with probability `p`. */
  chance(p: number): boolean { return p > 0 && this.next() < p; }

  /**
   * A draw from a bell-ish distribution on [0, 1), centred on a half.
   *
   * The average of three draws, which is close enough to a normal for ages,
   * incomes and departure times and costs three multiplications rather than a
   * logarithm and a cosine. Real populations are not uniform and a city built
   * out of uniform draws looks wrong in a way that is hard to place: every
   * street has the same mix of everything.
   */
  bell(): number { return (this.next() + this.next() + this.next()) / 3; }

  /** The generator's state, for a save. */
  save(): [number, number, number, number] { return [this.a, this.b, this.c, this.d]; }
  load(s: readonly [number, number, number, number]): void {
    this.a = s[0]; this.b = s[1]; this.c = s[2]; this.d = s[3];
  }
}
