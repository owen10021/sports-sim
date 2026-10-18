import { describe, expect, it } from 'vitest';
import {
  DeterministicRng,
  PLAY_DRAW_SCHEDULE,
  resolvePlay,
  type PlayDrawFamily,
} from '../src/index';
import {
  fixtureOrgs,
  gameStateFor,
  planFor,
  playInput,
  selectionWorld,
} from './support/footballSelectionHarness';

const world = selectionWorld();
const { home } = fixtureOrgs(world);
const input = playInput(world, gameStateFor(home));
const seeded = (seed: number) => DeterministicRng.fromSeed(seed);
const U32 = 2 ** 32;

const plays = Array.from({ length: 400 }, (_, i) => {
  const rng = seeded(i + 1);
  const start = rng.snapshot();
  return { start, ...resolvePlay(input, rng) };
});

const familiesOf = (p: (typeof plays)[number]): PlayDrawFamily[] =>
  p.privateTrace.draws.map((d) => d.family);

describe('canonical play draw contract', () => {
  it('names every draw family once, in the only order they may be consumed', () => {
    expect(PLAY_DRAW_SCHEDULE).toEqual([
      'offense_selection',
      'defense_selection',
      'recognition',
      'execution',
      'interaction',
      'sack',
      'sack_loss',
      'target',
      'defender',
      'interception',
      'completion',
      'fumble',
      'result',
      'tackler',
      'kick_distance',
      'kick_result',
      'return_yards',
      'penalty',
      'penalty_kind',
      'clock',
    ]);
  });

  it('consumes families in schedule order on every branch', () => {
    plays.forEach((p) => {
      const indexes = familiesOf(p).map((f) => PLAY_DRAW_SCHEDULE.indexOf(f));
      expect(indexes.every((i) => i >= 0)).toBe(true);
      indexes.reduce((prev, i) => {
        expect(i).toBeGreaterThanOrEqual(prev);
        return i;
      }, 0);
    });
  });

  it('always opens with the two selection draws per side and ends with the clock', () => {
    plays.forEach((p) => {
      const fams = familiesOf(p);
      expect(fams.slice(0, 4)).toEqual([
        'offense_selection',
        'offense_selection',
        'defense_selection',
        'defense_selection',
      ]);
      expect(fams.slice(4, 8)).toEqual([
        'recognition',
        'execution',
        'execution',
        'interaction',
      ]);
      expect(fams.at(-1)).toBe('clock');
    });
  });

  it('uses a fixed, deterministic branch per result kind', () => {
    const count = (p: (typeof plays)[number], f: PlayDrawFamily) =>
      familiesOf(p).filter((x) => x === f).length;
    plays.forEach((p) => {
      const r = p.resolved;
      const pass = r.playCategory === 'pass';
      expect(count(p, 'sack')).toBe(pass ? 1 : 0);
      expect(count(p, 'sack_loss')).toBe(r.resultKind === 'sack' ? 1 : 0);
      expect(count(p, 'target')).toBe(pass && r.resultKind !== 'sack' ? 1 : 0);
      expect(count(p, 'interception')).toBe(
        pass && r.resultKind !== 'sack' ? 1 : 0,
      );
      expect(count(p, 'completion')).toBe(
        pass && !['sack', 'interception'].includes(r.resultKind) ? 1 : 0,
      );
      const tackled = ['rush', 'completion', 'sack'].includes(r.resultKind);
      expect(count(p, 'tackler')).toBe(
        tackled && r.resultKind !== 'sack' ? 1 : 0,
      );
      expect(count(p, 'penalty')).toBe(1);
      expect(count(p, 'penalty_kind')).toBe(r.penalty === null ? 0 : 1);
      expect(count(p, 'clock')).toBe(1);
    });
  });

  it('records the draw window and matches an independent replay of the stream', () => {
    plays.forEach((p) => {
      expect(p.resolved.rngDrawStart).toBe(p.start.draws);
      expect(p.rng.snapshot().draws).toBe(
        p.start.draws + p.resolved.rngDrawCount,
      );
      const replay = DeterministicRng.fromState(p.start);
      p.privateTrace.draws.forEach((d) => {
        const value =
          d.bound === U32 ? replay.nextU32() : replay.nextInt(d.bound);
        expect(value).toBe(d.value);
      });
      expect(replay.snapshot()).toEqual(p.rng.snapshot());
    });
  });

  it('never draws when validation fails and never draws outside the schedule', () => {
    const rng = seeded(9);
    const before = rng.snapshot();
    const empty = {
      ...input,
      football: {
        ...world.football,
        gamePlans: world.football.gamePlans.map((x) =>
          x.organizationId === home ? planFor(home, { conceptKeys: [] }) : x,
        ),
      },
    };
    expect(() => resolvePlay(empty, rng)).toThrow();
    expect(rng.snapshot()).toEqual(before);
    plays.forEach((p) =>
      expect(p.resolved.rngDrawCount).toBeGreaterThanOrEqual(
        p.privateTrace.draws.length,
      ),
    );
  });

  it('is the only consumer: returns the same generator it was given', () => {
    const rng = seeded(4);
    const out = resolvePlay(input, rng);
    expect(out.rng).toBe(rng);
  });
});
