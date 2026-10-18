import { describe, expect, it } from 'vitest';
import { dRunner, D_TODAY, NF, COACH } from './support/packageDHarness';
import { codeOf, okResult, snapshotOf } from './support/orgHarness';

const createEpisode = (r: ReturnType<typeof dRunner>) => {
  okResult(
    r.run({
      type: 'CreateMedicalEpisode',
      playerId: 'player-nf-01',
      conditionKey: 'synthetic_knee',
      onsetAt: D_TODAY,
      sourceKind: 'synthetic_test',
      affectedActionKeys: ['burst'],
      initialStructuralSeverityBp: 6500,
      recoveryResponsivenessBp: 8500,
      baselineReinjuryRiskBp: 8000,
    }),
  );
  return r.kernel.world.medical.episodes.at(-1)!.id;
};

const grantMedicalAdvice = (r: ReturnType<typeof dRunner>) =>
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

const submitClearance = (
  r: ReturnType<typeof dRunner>,
  episodeId: string,
  participation: 'out' | 'limited' | 'full' = 'limited',
  maxLoadUnits: number | null = 40,
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
  return r.kernel.world.decisions.proposals.at(-1)!.id;
};

const commitClearance = (proposalId: string, actingPersonId: string) => ({
  type: 'CommitMedicalClearanceProposal',
  proposalId,
  actingPersonId,
  expectedRevision: 1,
  beliefIds: [],
  evidenceClaimIds: [],
  rationale: { note: 'clearance decision' },
});

describe('medical recommendation and clearance authority matrix', () => {
  it('lets an adviser recommend from legitimate evidence without granting clearance authority', () => {
    const r = dRunner();
    const episodeId = createEpisode(r);
    okResult(r.run({ type: 'AdvanceDays', days: 7 }));
    okResult(
      r.run({
        type: 'ReassessMedicalEpisode',
        episodeId,
        organizationId: NF.org,
        evaluatorPersonId: NF.owner,
      }),
    );
    grantMedicalAdvice(r);
    const report = r.kernel.world.medical.reports.at(-1)!;

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
    const rec = r.kernel.world.medical.recommendations.at(-1)!;
    expect(rec).toMatchObject({
      episodeId,
      medicalPersonId: NF.scout,
      participation: 'limited',
      maxLoadUnits: 40,
    });

    const proposalId = submitClearance(r, episodeId);
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(commitClearance(proposalId, NF.scout)))).toBe(
      'INSUFFICIENT_AUTHORITY',
    );
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('does not let coach workload authority or GM proposal authority manufacture medical clearance', () => {
    for (const actor of [COACH, NF.gm]) {
      const r = dRunner();
      const episodeId = createEpisode(r);
      const proposalId = submitClearance(r, episodeId);
      const before = snapshotOf(r.kernel);
      expect(codeOf(r.run(commitClearance(proposalId, actor)))).toBe(
        'INSUFFICIENT_AUTHORITY',
      );
      expect(snapshotOf(r.kernel)).toEqual(before);
    }
  });

  it('commits clearance only through the shared proposal/receipt gate', () => {
    const r = dRunner();
    const episodeId = createEpisode(r);
    const proposalId = submitClearance(r, episodeId);
    const res = okResult(r.run(commitClearance(proposalId, NF.owner)));

    const clearance = r.kernel.world.medical.clearances.at(-1)!;
    expect(clearance).toMatchObject({
      episodeId,
      organizationId: NF.org,
      playerId: 'player-nf-01',
      participation: 'limited',
      maxLoadUnits: 40,
      sourceProposalId: proposalId,
      supersedesClearanceId: null,
    });
    expect(r.kernel.world.decisions.receipts.at(-1)!.proposalId).toBe(
      proposalId,
    );
    expect(
      r.kernel.world.decisions.proposals.find((p) => p.id === proposalId)!
        .state,
    ).toBe('committed');
    expect(res.events.map((e) => e.type)).toContain(
      'MedicalClearanceCommitted',
    );
  });

  it('rejects a recommendation with no legitimate evidence without changing state', () => {
    const r = dRunner();
    const episodeId = createEpisode(r);
    grantMedicalAdvice(r);
    const before = snapshotOf(r.kernel);
    expect(
      codeOf(
        r.run({
          type: 'RecordMedicalRecommendation',
          organizationId: NF.org,
          actingPersonId: NF.scout,
          episodeId,
          participation: 'limited',
          maxLoadUnits: 40,
          basisClaimIds: ['rec-does-not-exist'],
          basisBeliefIds: [],
        }),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
});

describe('medical recommendation right separation', () => {
  it('requires communicate as well as advise', () => {
    const r = dRunner();
    const episodeId = createEpisode(r);
    okResult(r.run({ type: 'AdvanceDays', days: 7 }));
    okResult(
      r.run({
        type: 'ReassessMedicalEpisode',
        episodeId,
        organizationId: NF.org,
        evaluatorPersonId: NF.owner,
      }),
    );
    okResult(
      r.run({
        type: 'GrantAuthority',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        personId: NF.scout,
        category: 'medical_clearance',
        rights: ['advise'],
        transferable: false,
      }),
    );
    const report = r.kernel.world.medical.reports.at(-1)!;
    const before = snapshotOf(r.kernel);
    expect(
      codeOf(
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
      ),
    ).toBe('INSUFFICIENT_AUTHORITY');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });
});
