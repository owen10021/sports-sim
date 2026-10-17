import { describe, expect, it } from 'vitest';
import {
  MemoryCareerStore,
  SYNTHETIC_RULESET,
  SYNTHETIC_SEED,
  entityId,
  worldId,
} from '@sport-sim/sim-core';
import {
  verifySavedCareer,
  verifySavedReplay,
} from '../src/diagnostics/careerDiagnostics';
import { CareerLifecycle } from '../src/lifecycle/careerLifecycle';

const lifecycle = () =>
  new CareerLifecycle({
    store: new MemoryCareerStore(),
    ruleset: SYNTHETIC_RULESET,
    seed: SYNTHETIC_SEED,
    idSource: { newWorldId: () => worldId('world-diagnostics-1') },
    actor: { kind: 'human_gm', id: entityId('gm-1') },
  });

describe('saved-career diagnostics', () => {
  it('reports an empty store as nothing to verify, not as a mismatch', async () => {
    const life = lifecycle();
    await life.open();
    expect(await verifySavedCareer(life)).toEqual({
      ok: true,
      text: 'Nothing saved yet',
    });
    const replay = await verifySavedReplay(life);
    expect(replay.ok).toBe(true);
    expect(replay.text).toBe('Nothing to replay yet');
  });

  it('replays a stored career and matches its fingerprint', async () => {
    const life = lifecycle();
    await life.open();
    await life.createCareer();
    await life.advance(3);
    const replay = await verifySavedReplay(life);
    expect(replay.ok).toBe(true);
    expect(replay.text).toMatch(/^Replay matches stored state/);
  });
});
