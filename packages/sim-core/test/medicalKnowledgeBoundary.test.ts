import { describe, expect, it } from 'vitest';
import { buildOrganizationKnowledgeView, canonicalString } from '../src/index';
import { dRunner, D_TODAY, NF, SP } from './support/packageDHarness';
import { okResult } from './support/orgHarness';

const createAndReassess = () => {
  const r = dRunner();
  okResult(
    r.run({
      type: 'CreateMedicalEpisode',
      playerId: 'player-nf-01',
      conditionKey: 'synthetic_knee',
      onsetAt: D_TODAY,
      sourceKind: 'synthetic_test',
      affectedActionKeys: ['burst', 'agility'],
      initialStructuralSeverityBp: 6500,
      recoveryResponsivenessBp: 8500,
      baselineReinjuryRiskBp: 8000,
    }),
  );
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
  return { r, episodeId };
};

const collectNumbers = (value: unknown, into: number[] = []): number[] => {
  if (typeof value === 'number') into.push(value);
  else if (Array.isArray(value)) value.forEach((x) => collectNumbers(x, into));
  else if (value && typeof value === 'object')
    Object.values(value).forEach((x) => collectNumbers(x, into));
  return into;
};

describe('medical knowledge boundary', () => {
  it('publishes categorical uncertain evidence, never exact hidden healing/risk or a return date', () => {
    const { r } = createAndReassess();
    const report = r.kernel.world.medical.reports[0]!;
    const claim = r.kernel.world.information.claims.find(
      (x) => x.id === report.evidenceClaimIds[0],
    )!;
    const belief = r.kernel.world.information.beliefs.find(
      (x) => x.id === report.beliefId,
    )!;
    const privateProgress = r.kernel.world.medical.progress[0]!;

    expect(Object.keys(report).sort()).toEqual([
      'beliefId',
      'episodeId',
      'evaluatorPersonId',
      'evidenceClaimIds',
      'formedAt',
      'id',
      'organizationId',
    ]);
    expect(report.evidenceClaimIds).toEqual([claim.id]);
    expect(claim.holderOrganizationIds).toEqual([NF.org]);
    expect(collectNumbers(claim.proposition)).toEqual([]);
    expect(collectNumbers(belief.assessment)).toEqual([]);

    const publicBytes = JSON.stringify({ claim, belief, report });
    expect(publicBytes).not.toContain('structuralHealingBp');
    expect(publicBytes).not.toContain('reinjuryRiskBp');
    expect(publicBytes).not.toMatch(/returnDate|estimatedReturn|daysToReturn/i);
    expect(privateProgress.structuralHealingBp).toEqual(expect.any(Number));
    expect(privateProgress.reinjuryRiskBp).toEqual(expect.any(Number));
  });

  it('narrows later evidence by appending linked history instead of rewriting earlier medical knowledge', () => {
    const { r, episodeId } = createAndReassess();
    const firstReport = r.kernel.world.medical.reports[0]!;
    const firstClaim = r.kernel.world.information.claims.find(
      (x) => x.id === firstReport.evidenceClaimIds[0],
    )!;
    const firstBelief = r.kernel.world.information.beliefs.find(
      (x) => x.id === firstReport.beliefId,
    )!;
    const frozen = {
      report: canonicalString(firstReport),
      claim: canonicalString(firstClaim),
      belief: canonicalString(firstBelief),
    };

    expect(
      (firstClaim.proposition as { uncertainty: string }).uncertainty,
    ).toBe('broad');
    okResult(r.run({ type: 'AdvanceDays', days: 7 }));
    okResult(
      r.run({
        type: 'ReassessMedicalEpisode',
        episodeId,
        organizationId: NF.org,
        evaluatorPersonId: NF.owner,
      }),
    );

    expect(r.kernel.world.medical.reports).toHaveLength(2);
    expect(r.kernel.world.medical.progress).toHaveLength(2);
    expect(canonicalString(r.kernel.world.medical.reports[0])).toBe(
      frozen.report,
    );
    expect(canonicalString(r.kernel.world.information.claims[0])).toBe(
      frozen.claim,
    );
    expect(canonicalString(r.kernel.world.information.beliefs[0])).toBe(
      frozen.belief,
    );

    const secondReport = r.kernel.world.medical.reports[1]!;
    const secondClaim = r.kernel.world.information.claims.find(
      (x) => x.id === secondReport.evidenceClaimIds[0],
    )!;
    const secondBelief = r.kernel.world.information.beliefs.find(
      (x) => x.id === secondReport.beliefId,
    )!;
    expect(
      (secondClaim.proposition as { uncertainty: string }).uncertainty,
    ).toBe('moderate');
    expect(secondBelief.supersedesBeliefId).toBe(firstBelief.id);
    expect(secondReport.evidenceClaimIds).not.toEqual(
      firstReport.evidenceClaimIds,
    );
  });

  it('does not make a private medical recheck visible to a rival organization', () => {
    const { r } = createAndReassess();
    const report = r.kernel.world.medical.reports[0]!;
    const rival = buildOrganizationKnowledgeView(
      r.kernel.world,
      SP.org,
      SP.owner,
    );
    expect(rival.claims.map((x) => x.id)).not.toContain(
      report.evidenceClaimIds[0],
    );
    expect(rival.beliefs.map((x) => x.id)).not.toContain(report.beliefId);
  });
});
