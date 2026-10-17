/**
 * Versioned deterministic RNG: xoshiro128** (Blackman & Vigna) with explicit 32-bit math.
 *
 * Algorithm id `xoshiro128ss-v1` fixes BOTH the generator and the seeding contract:
 *   seed32 -> four state words via splitmix32 (a += 0x9e3779b9; avalanche), in order s0..s3.
 *   An all-zero expansion (practically impossible) is repaired by setting s0 = 1.
 * Changing either requires a new algorithm id and a save-schema migration; never edit in place.
 *
 * No Math.random(), no clock, no platform entropy. Identical on Node and Hermes because every
 * operation is a 32-bit integer op (`Math.imul`, shifts, xor) normalized to unsigned.
 */
export const RNG_ALGORITHM = 'xoshiro128ss-v1' as const;

export interface RngState {
  readonly algorithm: typeof RNG_ALGORITHM;
  readonly s0: number;
  readonly s1: number;
  readonly s2: number;
  readonly s3: number;
  /** Number of 32-bit words drawn since seeding (monotonic audit counter). */
  readonly draws: number;
}

const TWO_32 = 0x100000000;

const isU32 = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 0xffffffff && !Object.is(n, -0);

const rotl = (x: number, k: number): number => (x << k) | (x >>> (32 - k));

const splitmix32Next = (state: number): { state: number; value: number } => {
  const a = (state + 0x9e3779b9) >>> 0;
  let t = a ^ (a >>> 16);
  t = Math.imul(t, 0x21f0aaad);
  t = t ^ (t >>> 15);
  t = Math.imul(t, 0x735a2d97);
  return { state: a, value: (t ^ (t >>> 15)) >>> 0 };
};

const validateState = (state: RngState): void => {
  if (typeof state !== 'object' || state === null || state.algorithm !== RNG_ALGORITHM) {
    throw new RangeError(`Unsupported RNG algorithm; expected ${RNG_ALGORITHM}`);
  }
  if (!isU32(state.s0) || !isU32(state.s1) || !isU32(state.s2) || !isU32(state.s3)) {
    throw new RangeError('RNG state words must be uint32 integers');
  }
  if (state.s0 === 0 && state.s1 === 0 && state.s2 === 0 && state.s3 === 0) {
    throw new RangeError('RNG state must not be all zero');
  }
  if (!Number.isSafeInteger(state.draws) || state.draws < 0) {
    throw new RangeError('RNG draw counter must be a non-negative safe integer');
  }
};

export class DeterministicRng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;
  private draws: number;

  private constructor(state: RngState) {
    this.s0 = state.s0;
    this.s1 = state.s1;
    this.s2 = state.s2;
    this.s3 = state.s3;
    this.draws = state.draws;
  }

  static fromSeed(seed32: number): DeterministicRng {
    if (!isU32(seed32)) throw new RangeError('RNG seed must be a uint32 integer');
    let cursor = seed32;
    const words: number[] = [];
    for (let i = 0; i < 4; i++) {
      const step = splitmix32Next(cursor);
      cursor = step.state;
      words.push(step.value);
    }
    if (!words.some((w) => w !== 0)) words[0] = 1;
    return new DeterministicRng({
      algorithm: RNG_ALGORITHM,
      s0: words[0] as number,
      s1: words[1] as number,
      s2: words[2] as number,
      s3: words[3] as number,
      draws: 0,
    });
  }

  static fromState(state: RngState): DeterministicRng {
    validateState(state);
    return new DeterministicRng(state);
  }

  /** Next uint32 (0 .. 2^32-1). */
  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0;
    const t = this.s1 << 9;
    let s0 = this.s0;
    let s1 = this.s1;
    let s2 = this.s2;
    let s3 = this.s3;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    this.s0 = s0 >>> 0;
    this.s1 = s1 >>> 0;
    this.s2 = s2 >>> 0;
    this.s3 = s3 >>> 0;
    this.draws += 1;
    return result;
  }

  /**
   * Unbiased integer in [0, maxExclusive) via rejection sampling. Bounds are validated
   * BEFORE any draw, so invalid input consumes no RNG state. 1 <= maxExclusive <= 2^32.
   */
  nextInt(maxExclusive: number): number {
    if (
      typeof maxExclusive !== 'number' ||
      !Number.isInteger(maxExclusive) ||
      maxExclusive < 1 ||
      maxExclusive > TWO_32
    ) {
      throw new RangeError('nextInt bound must be an integer in [1, 2^32]');
    }
    const limit = Math.floor(TWO_32 / maxExclusive) * maxExclusive;
    for (;;) {
      const x = this.nextU32();
      if (x < limit) return x % maxExclusive;
    }
  }

  snapshot(): RngState {
    return {
      algorithm: RNG_ALGORITHM,
      s0: this.s0,
      s1: this.s1,
      s2: this.s2,
      s3: this.s3,
      draws: this.draws,
    };
  }

  /** Replace internal state. Validates first; on failure the generator is unchanged. */
  restore(state: RngState): void {
    validateState(state);
    this.s0 = state.s0;
    this.s1 = state.s1;
    this.s2 = state.s2;
    this.s3 = state.s3;
    this.draws = state.draws;
  }
}
