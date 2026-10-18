import { describe, expect, it } from 'vitest';
import {
  createMedicalEpisodeChange,
  functionalReadiness,
  type MedicalEpisode,
} from '../src/index';
import { dRunner, dWorld, D_TODAY, NF } from './support/packageDHarness';
import { okResult } from './support/orgHarness';

const episodeInput = (over: Record<string, unknown> = {}) => ({
  playerId: 'player-nf-01',
  conditionKey: 'synthetic_lower_leg',
  onsetAt: D_TODAY,
  sourceKind: 'synthetic_test',
  affectedActionKeys: ['burst'],
  initialStructuralSeverityBp: 1000,
  recoveryResponsivenessBp: 9000,
  baselineReinjuryRiskBp: 7500,
  ...over,
});

describe('medical episode truth and functional readiness', () => {
  it('offers Package E a pure episode-change helper without committing or inventing a return date', () => {
    const world = dWorld();
    const before = JSON.stringify(world);
    const change = createMedicalEpisodeChange(world, {
      ...episodeInput(),
      sourceKind: 'football',
    });

    expect(JSON.stringify(world)).toBe(before);
    expect(world.medical.episodes).toEqual([]);
    expect(change.nextWorld.medical.episodes).toHaveLength(1);
    const episode: MedicalEpisode = change.nextWorld.medical.episodes[0]!;
    expect(episode).toMatchObject({
      playerId: 'player-nf-01',
      sourceKind: 'football',
      status: 'open',
      affectedActionKeys: ['burst'],
    });
    expect(Object.keys(episode)).not.toContain('returnDate');
    expect(Object.keys(episode)).not.toContain('estimatedReturnDate');
    expect(change.eventSpecs.map((e) => e.type)).toEqual([
      'MedicalEpisodeCreated',
    ]);
  });

  it('keeps structural healing, reinjury risk, conditioning and functional readiness distinct', () => {
    const r = dRunner();
    okResult(r.run({ type: 'CreateMedicalEpisode', ...episodeInput() }));
    const episodeId = r.kernel.world.medical.episodes[0]!.id;

    okResult(r.run({ type: 'AdvanceDays', days: 7 }));
    okResult(
      r.run({
        type: 'ReassessMedicalEpisode',
        episodeId,
        organizationId: NF.org,
        evaluatorPersonId: NF.owner,
      }),
    );

    const progress = r.kernel.world.medical.progress.at(-1)!;
    const readiness = functionalReadiness(
      r.kernel.world,
      'player-nf-01',
      'burst',
    );
    const conditioning = r.kernel.world.development.readiness.find(
      (x) => x.playerId === 'player-nf-01',
    )!.conditioningBp;

    expect(progress.structuralHealingBp).toBeGreaterThanOrEqual(9000);
    expect(progress.reinjuryRiskBp).toBeGreaterThan(3000);
    expect(conditioning).toBeLessThan(7000);
    expect(readiness).toBeLessThan(7000);
    expect(readiness).not.toBe(progress.structuralHealingBp);
  });
});
