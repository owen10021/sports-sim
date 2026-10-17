import { describe, expect, it } from 'vitest';
import { DeterministicRng, type RngState } from '../src/index';

// Reference vectors were produced by an independent Python implementation of
// xoshiro128** (Blackman/Vigna) seeded through splitmix32; see rng.ts for the
// exact seeding contract. They must never be regenerated from the TypeScript code.
const REF: Record<number, { state: number[]; first6: number[]; after6: number[] }> = {
  0: {
    state: [1684164658, 3653269916, 2939563536, 2141751570],
    first6: [1789933344, 44971166, 2521387044, 3848737593, 1138324114, 749234105],
    after6: [329295192, 953275645, 2825333633, 1708779182],
  },
  1: {
    state: [1580013426, 350525680, 3524174333, 3011703609],
    first6: [393288148, 2174103013, 3814759091, 2092745082, 1865176206, 2179171167],
    after6: [1139658107, 1388964670, 3725279914, 3999740333],
  },
  12345: {
    state: [3283241497, 613117429, 2940958500, 516375437],
    first6: [1093274547, 203003357, 3741353573, 3803725158, 4178738660, 810247443],
    after6: [295305044, 3974570048, 3662437342, 3047766246],
  },
  4294967295: {
    state: [3950124170, 4293442868, 1302505678, 2762329221],
    first6: [4104197751, 1825856343, 1152209388, 2427537429, 3685145430, 609215610],
    after6: [1492704536, 891779096, 2960609414, 3495962299],
  },
};

const words = (s: RngState): number[] => [s.s0, s.s1, s.s2, s.s3];

describe('DeterministicRng (xoshiro128ss-v1)', () => {
  it('produces the exact reference seed expansion and first outputs', () => {
    for (const [seedStr, ref] of Object.entries(REF)) {
      const rng = DeterministicRng.fromSeed(Number(seedStr));
      const initial = rng.snapshot();
      expect(initial.algorithm).toBe('xoshiro128ss-v1');
      expect(words(initial)).toEqual(ref.state);
      expect(initial.draws).toBe(0);
      const out = Array.from({ length: 6 }, () => rng.nextU32());
      expect(out).toEqual(ref.first6);
      const after = rng.snapshot();
      expect(words(after)).toEqual(ref.after6);
      expect(after.draws).toBe(6);
    }
  });

  it('yields identical vectors from independent instances (run-twice determinism)', () => {
    const run = (): number[] => {
      const rng = DeterministicRng.fromSeed(12345);
      return Array.from({ length: 1000 }, () => rng.nextU32());
    };
    expect(run()).toEqual(run());
  });

  it('always emits unsigned 32-bit integers', () => {
    const rng = DeterministicRng.fromSeed(0xdeadbeef);
    for (let i = 0; i < 5000; i++) {
      const v = rng.nextU32();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('snapshot/restore replays the same sequence and snapshots are detached copies', () => {
    const rng = DeterministicRng.fromSeed(77);
    for (let i = 0; i < 3; i++) rng.nextU32();
    const snap = rng.snapshot();
    const a = Array.from({ length: 5 }, () => rng.nextU32());
    rng.restore(snap);
    const b = Array.from({ length: 5 }, () => rng.nextU32());
    expect(b).toEqual(a);
    expect(snap.draws).toBe(3);

    const resumed = DeterministicRng.fromState(snap);
    expect(Array.from({ length: 5 }, () => resumed.nextU32())).toEqual(a);

    const copy = rng.snapshot() as { s0: number };
    copy.s0 = 123;
    expect(rng.snapshot().s0).not.toBe(123);
  });

  it('draws bounded integers with rejection sampling (reference vector)', () => {
    const rng = DeterministicRng.fromSeed(12345);
    const out = Array.from({ length: 10 }, () => rng.nextInt(6));
    expect(out).toEqual([3, 5, 5, 0, 2, 3, 4, 1, 0, 0]);
    expect(rng.snapshot().draws).toBe(10);
  });

  it('keeps nextInt inside [0, max) for assorted bounds and is not grossly biased', () => {
    const rng = DeterministicRng.fromSeed(9);
    for (const max of [1, 2, 3, 7, 1000, 65536, 0x80000000, 0xffffffff, 0x100000000]) {
      for (let i = 0; i < 200; i++) {
        const v = rng.nextInt(max);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(max);
      }
    }
    const tally = [0, 0, 0];
    const r3 = DeterministicRng.fromSeed(4242);
    for (let i = 0; i < 30000; i++) {
      const k = r3.nextInt(3);
      tally[k] = (tally[k] ?? 0) + 1;
    }
    for (const c of tally) expect(Math.abs(c - 10000)).toBeLessThan(500);
  });

  it('rejects zero/invalid bounds without consuming any state', () => {
    const rng = DeterministicRng.fromSeed(5);
    rng.nextU32();
    const before = rng.snapshot();
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 0x100000001, '3' as unknown as number]) {
      expect(() => rng.nextInt(bad)).toThrow(RangeError);
      expect(rng.snapshot()).toEqual(before);
    }
  });

  it('rejects invalid seeds and invalid restore states without mutating the generator', () => {
    for (const bad of [-1, 1.5, 0x100000000, Number.NaN]) {
      expect(() => DeterministicRng.fromSeed(bad)).toThrow(RangeError);
    }
    const rng = DeterministicRng.fromSeed(5);
    const before = rng.snapshot();
    const good = rng.snapshot();
    const badStates: unknown[] = [
      { ...good, algorithm: 'xoshiro256ss-v1' },
      { ...good, s0: -1 },
      { ...good, s1: 0x100000000 },
      { ...good, s2: 1.5 },
      { ...good, draws: -1 },
      { ...good, s0: 0, s1: 0, s2: 0, s3: 0 },
    ];
    for (const s of badStates) {
      expect(() => rng.restore(s as RngState)).toThrow();
      expect(rng.snapshot()).toEqual(before);
    }
  });
});
