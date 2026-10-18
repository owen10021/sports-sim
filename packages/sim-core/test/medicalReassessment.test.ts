import { describe, expect, it } from 'vitest';
import { canonicalString } from '../src/index';
import { dRunner, D_TODAY, NF } from './support/packageDHarness';
import { codeOf, okResult, snapshotOf } from './support/orgHarness';

const createEpisode = (r: ReturnType<typeof dRunner>) => {
  okResult(
    r.run({
      type: 'CreateMedicalEpisode',
      playerId: 'player-nf-01',
      conditionKey: 'synthetic_ankle',
      onsetAt: D_TODAY,
      sourceKind: 'synthetic_test',
      affectedActionKeys: ['burst', 'agility'],
      initialStructuralSeverityBp: 6000,
      recoveryResponsivenessBp: 9000,
      baselineReinjuryRiskBp: 7000,
    }),
  );
  return r.kernel.world.medical.episodes.at(-1)!.id;
};

const reassess = (r: ReturnType<typeof dRunner>, episodeId: string) =>
  r.run({
    type: 'ReassessMedicalEpisode',
    episodeId,
    organizationId: NF.org,
    evaluatorPersonId: NF.owner,
  });

describe('medical reassessment checkpoints', () => {
  it('is deterministic, append-only and records the exact RNG slice used by private truth', () => {
    const run = () => {
      const r = dRunner();
      const episodeId = createEpisode(r);
      okResult(r.run({ type: 'AdvanceDays', days: 7 }));
      const drawStart = r.kernel.world.rng.draws;
      okResult(reassess(r, episodeId));
      const progress = r.kernel.world.medical.progress[0]!;
      expect(progress.rngDrawStart).toBe(drawStart);
      expect(progress.rngDrawCount).toBe(2);
      expect(r.kernel.world.rng.draws).toBe(drawStart + 2);
      return r.kernel.world;
    };

    const a = run();
    const b = run();
    expect(canonicalString(a.medical)).toBe(canonicalString(b.medical));
    expect(canonicalString(a.information)).toBe(canonicalString(b.information));
    expect(a.rng).toEqual(b.rng);
  });

  it('cannot reroll the same logical medical checkpoint', () => {
    const r = dRunner();
    const episodeId = createEpisode(r);
    okResult(r.run({ type: 'AdvanceDays', days: 7 }));
    okResult(reassess(r, episodeId));
    const before = snapshotOf(r.kernel);

    expect(codeOf(reassess(r, episodeId))).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('restricts temporary episode creation and rejects invalid input atomically', () => {
    const r = dRunner();
    const before = snapshotOf(r.kernel);
    const command = {
      type: 'CreateMedicalEpisode',
      playerId: 'player-nf-01',
      conditionKey: 'synthetic_ankle',
      onsetAt: D_TODAY,
      sourceKind: 'synthetic_test',
      affectedActionKeys: ['burst'],
      initialStructuralSeverityBp: 5000,
      recoveryResponsivenessBp: 8000,
      baselineReinjuryRiskBp: 6000,
    };

    expect(codeOf(r.run(command, 'cpu_org'))).toBe('UNAUTHORIZED_ACTOR');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(
      codeOf(r.run({ ...command, playerId: 'player-does-not-exist' })),
    ).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('requires the attributed evaluator to possess medical advice authority', () => {
    const r = dRunner();
    const episodeId = createEpisode(r);
    okResult(r.run({ type: 'AdvanceDays', days: 7 }));
    const before = snapshotOf(r.kernel);

    expect(
      codeOf(
        r.run({
          type: 'ReassessMedicalEpisode',
          episodeId,
          organizationId: NF.org,
          evaluatorPersonId: 'person-nf-coach-d',
        }),
      ),
    ).toBe('INSUFFICIENT_AUTHORITY');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
});
