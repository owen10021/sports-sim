import { describe, expect, it } from 'vitest';
import {
  allocationTerms,
  commitAllocation,
  dRunner,
  D_TODAY,
  NF,
  openWindow,
  submitAllocation,
} from './support/packageDHarness';
import { codeOf, okResult, snapshotOf } from './support/orgHarness';

const createEpisode = (
  r: ReturnType<typeof dRunner>,
  conditionKey = 'synthetic_ankle',
) => {
  okResult(
    r.run({
      type: 'CreateMedicalEpisode',
      playerId: 'player-nf-01',
      conditionKey,
      onsetAt: D_TODAY,
      sourceKind: 'synthetic_test',
      affectedActionKeys: ['burst'],
      initialStructuralSeverityBp: 6000,
      recoveryResponsivenessBp: 8500,
      baselineReinjuryRiskBp: 7500,
    }),
  );
  return r.kernel.world.medical.episodes.at(-1)!.id;
};

const commitClearance = (
  r: ReturnType<typeof dRunner>,
  episodeId: string,
  participation: 'out' | 'limited' | 'full',
  maxLoadUnits: number | null,
) => {
  okResult(
    r.run({
      type: 'SubmitProposal',
      organizationId: NF.org,
      actingPersonId: NF.owner,
      category: 'medical_clearance',
      subjects: [{ kind: 'entity', id: 'player-nf-01' }],
      termsType: 'medical_clearance_v1',
      terms: {
        episodeId,
        playerId: 'player-nf-01',
        participation,
        maxLoadUnits,
      },
      requiredApproverPersonIds: [],
      expiresAt: null,
      contingencies: {},
    }),
  );
  const proposalId = r.kernel.world.decisions.proposals.at(-1)!.id;
  okResult(
    r.run({
      type: 'CommitMedicalClearanceProposal',
      proposalId,
      actingPersonId: NF.owner,
      expectedRevision: 1,
      beliefIds: [],
      evidenceClaimIds: [],
      rationale: { note: 'medical authority decision' },
    }),
  );
  return r.kernel.world.medical.clearances.at(-1)!;
};

describe('medical disagreement is preserved as distinct state', () => {
  it('keeps player preference, medical recommendation, legal clearance and coach usage separate', () => {
    const r = dRunner();
    const episodeId = createEpisode(r);
    okResult(
      r.run({
        type: 'RecordParticipationPreference',
        playerId: 'player-nf-01',
        episodeId,
        preference: 'unwilling',
        sourceClaimIds: [],
      }),
    );

    okResult(r.run({ type: 'AdvanceDays', days: 7 }));
    okResult(
      r.run({
        type: 'ReassessMedicalEpisode',
        episodeId,
        organizationId: NF.org,
        evaluatorPersonId: NF.owner,
      }),
    );
    const report = r.kernel.world.medical.reports.at(-1)!;
    okResult(
      r.run({
        type: 'GrantAuthority',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        personId: NF.scout,
        category: 'medical_clearance',
        rights: ['advise', 'communicate'],
        transferable: false,
      }),
    );
    okResult(
      r.run({
        type: 'RecordMedicalRecommendation',
        organizationId: NF.org,
        actingPersonId: NF.scout,
        episodeId,
        participation: 'limited',
        maxLoadUnits: 40,
        basisClaimIds: [...report.evidenceClaimIds],
        basisBeliefIds: [report.beliefId],
      }),
    );

    commitClearance(r, episodeId, 'full', null);
    okResult(
      r.run({
        type: 'OpenOpportunityWindow',
        organizationId: NF.org,
        phaseKey: 'medical_disagreement',
        fromDate: '2027-02-22',
        toDate: '2027-03-01',
      }),
    );
    const windowId = r.kernel.world.development.opportunityWindows.at(-1)!.id;
    const workloadProposal = submitAllocation(r, windowId, [
      allocationTerms('player-nf-01', 60),
    ]);
    okResult(r.run(commitAllocation(workloadProposal)));

    expect(r.kernel.world.medical.preferences.at(-1)!.preference).toBe(
      'unwilling',
    );
    expect(r.kernel.world.medical.recommendations.at(-1)!).toMatchObject({
      participation: 'limited',
      maxLoadUnits: 40,
    });
    expect(r.kernel.world.medical.clearances.at(-1)!).toMatchObject({
      participation: 'full',
      maxLoadUnits: null,
    });
    expect(
      r.kernel.world.development.opportunityAllocations
        .filter((a) => a.playerId === 'player-nf-01')
        .reduce((sum, a) => sum + a.units, 0),
    ).toBe(60);
  });

  it('recording preference never mutates private healing, risk or readiness', () => {
    const r = dRunner();
    const episodeId = createEpisode(r);
    const beforeMedicalTruth = JSON.stringify({
      progress: r.kernel.world.medical.progress,
      readiness: r.kernel.world.development.readiness,
    });
    okResult(
      r.run({
        type: 'RecordParticipationPreference',
        playerId: 'player-nf-01',
        episodeId,
        preference: 'prefer_limit',
        sourceClaimIds: [],
      }),
    );
    expect(
      JSON.stringify({
        progress: r.kernel.world.medical.progress,
        readiness: r.kernel.world.development.readiness,
      }),
    ).toBe(beforeMedicalTruth);
  });
});

describe('medical clearance hard limits on workload usage', () => {
  it('rejects workload above a limited clearance atomically, then accepts the exact cap', () => {
    const r = dRunner();
    const episodeId = createEpisode(r, 'synthetic_hamstring');
    commitClearance(r, episodeId, 'limited', 40);
    const windowId = openWindow(r);

    const tooMuch = submitAllocation(r, windowId, [
      allocationTerms('player-nf-01', 60),
    ]);
    const before = snapshotOf(r.kernel);
    const beforeDraws = r.kernel.world.rng.draws;
    expect(codeOf(r.run(commitAllocation(tooMuch)))).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(r.kernel.world.rng.draws).toBe(beforeDraws);

    const exact = submitAllocation(r, windowId, [
      allocationTerms('player-nf-01', 40),
    ]);
    okResult(r.run(commitAllocation(exact)));
    expect(
      r.kernel.world.development.opportunityAllocations
        .filter((a) => a.playerId === 'player-nf-01')
        .reduce((sum, a) => sum + a.units, 0),
    ).toBe(40);
  });

  it('treats an out clearance as a zero-load hard limit', () => {
    const r = dRunner();
    const episodeId = createEpisode(r, 'synthetic_hamstring');
    commitClearance(r, episodeId, 'out', 0);
    const windowId = openWindow(r);
    const proposalId = submitAllocation(r, windowId, [
      allocationTerms('player-nf-01', 1),
    ]);
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(commitAllocation(proposalId)))).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('uses the newest clearance and keeps prior clearances immutable', () => {
    const r = dRunner();
    const episodeId = createEpisode(r, 'synthetic_hamstring');
    const first = commitClearance(r, episodeId, 'limited', 20);
    const frozen = JSON.stringify(first);
    const second = commitClearance(r, episodeId, 'limited', 50);

    expect(JSON.stringify(r.kernel.world.medical.clearances[0])).toBe(frozen);
    expect(second.supersedesClearanceId).toBe(first.id);
    const windowId = openWindow(r);
    const proposalId = submitAllocation(r, windowId, [
      allocationTerms('player-nf-01', 50),
    ]);
    okResult(r.run(commitAllocation(proposalId)));
  });
});

describe('participation preference ingress', () => {
  it('rejects preference input from non-system/test actors atomically', () => {
    const r = dRunner();
    const episodeId = createEpisode(r);
    const before = snapshotOf(r.kernel);
    expect(
      codeOf(
        r.run(
          {
            type: 'RecordParticipationPreference',
            playerId: 'player-nf-01',
            episodeId,
            preference: 'prefer_limit',
            sourceClaimIds: [],
          },
          'commissioner',
        ),
      ),
    ).toBe('UNAUTHORIZED_ACTOR');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
});
