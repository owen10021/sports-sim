import { describe, expect, it } from 'vitest';
import {
  canonicalString,
  commandId,
  entityId,
  eventId,
  recordId,
} from '../src/index';
import { buildDevelopmentDecisionView } from '../src/developmentView';
import { dRunner, dWorld, D_TODAY, NF, SP } from './support/packageDHarness';
import { okResult } from './support/orgHarness';

const viewOf = (
  world: ReturnType<typeof dWorld>,
  organizationId = NF.org,
  actorPersonId = NF.gm,
) => {
  const result = buildDevelopmentDecisionView(
    world,
    organizationId,
    actorPersonId,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  return result.view;
};

describe('DevelopmentDecisionView knowledge boundary', () => {
  it('is byte-equivalent when only hidden capability, malleability, role familiarity, healing/risk and future RNG truth change', () => {
    const r = dRunner();
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
    const episodeId = r.kernel.world.medical.episodes.at(-1)!.id;
    okResult(r.run({ type: 'AdvanceDays', days: 7 }));
    okResult(
      r.run({
        type: 'ReassessMedicalEpisode',
        episodeId,
        organizationId: NF.org,
        evaluatorPersonId: NF.owner,
      }),
    );
    const base = r.kernel.world;
    const altered = {
      ...base,
      rng: {
        ...base.rng,
        state: 'ffffffffffffffff',
        draws: base.rng.draws + 999,
      },
      roster: {
        ...base.roster,
        players: base.roster.players.map((player) =>
          player.personId === 'player-nf-01'
            ? {
                ...player,
                capabilities: player.capabilities.map((capability, index) => ({
                  ...capability,
                  valueBp: index % 2 === 0 ? 1 : 9999,
                })),
              }
            : player,
        ),
      },
      development: {
        ...base.development,
        playerProfiles: base.development.playerProfiles.map((profile) =>
          profile.personId === 'player-nf-01'
            ? {
                ...profile,
                adaptabilityBp: 1,
                processingBp: 9999,
                recoveryBp: 1,
                durabilityBp: 9999,
                capabilityResponses: profile.capabilityResponses.map(
                  (response, index) => ({
                    ...response,
                    malleabilityBp: index % 2 === 0 ? 9999 : 1,
                  }),
                ),
              }
            : profile,
        ),
        roleKnowledge: base.development.roleKnowledge.map((knowledge) =>
          knowledge.playerId === 'player-nf-01'
            ? { ...knowledge, familiarityBp: 9999 }
            : knowledge,
        ),
      },
      medical: {
        ...base.medical,
        progress: base.medical.progress.map((progress) =>
          progress.episodeId === episodeId
            ? {
                ...progress,
                structuralHealingBp: 9999,
                reinjuryRiskBp: 1,
                limitations: progress.limitations.map((limitation) => ({
                  ...limitation,
                  severityBp: 1,
                })),
              }
            : progress,
        ),
      },
    };

    const a = viewOf(base);
    const b = viewOf(altered);
    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(canonicalString(a)).not.toMatch(
      /capabilit|malleab|familiarityBp|structuralHealing|reinjuryRisk|severityBp|rng|trajectory/i,
    );
  });

  it('cannot contain a rival private plan, medical belief, allocation rationale or synthesized benching claim', () => {
    const base = dWorld();
    const rivalClaim = {
      id: recordId('rival-medical-claim'),
      subject: { kind: 'entity' as const, id: entityId('player-sp-02') },
      propositionType: 'medical_recheck_observation',
      proposition: { privateMarker: 'RIVAL_MEDICAL_PRIVATE' },
      sourcePersonId: SP.scout,
      sourceFamilyId: 'rival-medical-family',
      observedAt: D_TODAY,
      acquiredAt: D_TODAY,
      visibility: 'organization' as const,
      holderOrganizationIds: [SP.org],
      confidence: 'medium' as const,
      possibleBias: null,
      corroboratesClaimIds: [],
      contradictsClaimIds: [],
      sharedFromClaimId: null,
    };
    const rivalBelief = {
      id: recordId('rival-medical-belief'),
      organizationId: SP.org,
      authorPersonId: SP.scout,
      subject: { kind: 'entity' as const, id: entityId('player-sp-02') },
      assessmentType: 'medical_status',
      assessment: { privateMarker: 'RIVAL_MEDICAL_BELIEF_PRIVATE' },
      confidence: 'medium' as const,
      evidenceClaimIds: [rivalClaim.id],
      formedAt: D_TODAY,
      supersedesBeliefId: null,
    };
    const rivalPlan = {
      id: recordId('rival-development-plan'),
      organizationId: SP.org,
      kind: 'development' as const,
      scopeKey: 'quarterback',
      status: 'active' as const,
      currentRevision: 1,
      revisions: [
        {
          revision: 1,
          ownerPersonId: SP.gm,
          effectiveAt: D_TODAY,
          horizon: { days: 14 },
          objectives: [
            {
              key: 'RIVAL_PLAN_PRIVATE',
              priority: 'high' as const,
              target: { playerId: 'player-sp-02' },
            },
          ],
          constraints: [],
          triggerRefs: [],
          fallbackPlanIds: [],
          basisBeliefIds: [rivalBelief.id],
          changeReasonRefs: [],
        },
      ],
    };
    const rivalWindow = {
      id: recordId('rival-window'),
      organizationId: SP.org,
      phaseKey: 'rival_private_window',
      fromDate: D_TODAY,
      toDate: '2027-02-22',
      pools: [
        {
          resourceKey: 'first_team_reps' as const,
          scopeKey: 'quarterback',
          capacityUnits: 100,
        },
      ],
      status: 'open' as const,
    };
    const rivalAllocation = {
      id: recordId('rival-allocation'),
      windowId: rivalWindow.id,
      organizationId: SP.org,
      playerId: entityId('player-sp-02'),
      resourceKey: 'first_team_reps' as const,
      scopeKey: 'quarterback',
      units: 100,
      teacherPersonId: null,
      responsibilityKeys: [],
      basisPlanIds: [rivalPlan.id],
      basisPlanRevisions: [{ planId: rivalPlan.id, revision: 1 }],
      sourceProposalId: recordId('rival-workload-proposal'),
      committedAt: D_TODAY,
    };
    const world = {
      ...base,
      decisions: {
        ...base.decisions,
        receipts: [
          ...base.decisions.receipts,
          {
            id: recordId('rival-workload-receipt'),
            proposalId: rivalAllocation.sourceProposalId,
            proposalRevision: 1,
            commandId: commandId('rival-workload-command'),
            actorPersonId: SP.gm,
            authorityGrantIds: [],
            evidenceClaimIds: [],
            beliefIds: [],
            approvalIds: [],
            mandateId: null,
            executedTermsHash: 'rival-workload-hash',
            committedAt: D_TODAY,
            outcomeEventIds: [eventId('rival-workload-event')],
            originalRationale: {
              privateMarker: 'RIVAL_ALLOCATION_RATIONALE_PRIVATE',
            },
          },
        ],
      },
      information: {
        ...base.information,
        claims: [...base.information.claims, rivalClaim],
        beliefs: [...base.information.beliefs, rivalBelief],
      },
      plans: { plans: [...base.plans.plans, rivalPlan] },
      development: {
        ...base.development,
        opportunityWindows: [
          ...base.development.opportunityWindows,
          rivalWindow,
        ],
        opportunityAllocations: [
          ...base.development.opportunityAllocations,
          rivalAllocation,
        ],
      },
    };

    const beforeClaims = world.information.claims.length;
    const view = viewOf(world);
    const bytes = canonicalString(view);
    expect(bytes).not.toContain('RIVAL_PLAN_PRIVATE');
    expect(bytes).not.toContain('RIVAL_MEDICAL_PRIVATE');
    expect(bytes).not.toContain('RIVAL_MEDICAL_BELIEF_PRIVATE');
    expect(bytes).not.toContain('rival-allocation');
    expect(bytes).not.toContain('rival-workload-proposal');
    expect(bytes).not.toContain('RIVAL_ALLOCATION_RATIONALE_PRIVATE');
    expect(world.information.claims).toHaveLength(beforeClaims);
    expect(view.knowledge.claims).toHaveLength(0);
  });

  it('rejects a viewer who holds no current role in the organization', () => {
    const result = buildDevelopmentDecisionView(dWorld(), NF.org, SP.gm);
    expect(result).toEqual({
      ok: false,
      reason: `${SP.gm} holds no role in ${NF.org}`,
    });
  });
});
