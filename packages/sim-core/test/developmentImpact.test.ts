import { describe, expect, it } from 'vitest';
import {
  canonicalString,
  previewOpportunityImpactForRosterChange,
} from '../src/index';
import {
  allocationTerms,
  commitAllocation,
  dRunner,
  NF,
  adoptDevelopmentPlan,
  openWindow,
  submitAllocation,
} from './support/packageDHarness';
import { okResult } from './support/orgHarness';

const moveNorthfieldPlayerToQuarterback = (r: ReturnType<typeof dRunner>) => {
  okResult(
    r.run({
      type: 'SubmitProposal',
      organizationId: NF.org,
      actingPersonId: NF.owner,
      category: 'roster',
      subjects: [{ kind: 'entity', id: 'player-nf-01' }],
      termsType: 'role_transition_v1',
      terms: {
        playerId: 'player-nf-01',
        primaryRole: 'quarterback',
        roleTags: ['starter_profile'],
        schemeProposalId: null,
      },
      requiredApproverPersonIds: [],
      expiresAt: null,
      contingencies: {},
    }),
  );
  const proposalId = r.kernel.world.decisions.proposals.at(-1)!.id;
  okResult(
    r.run({
      type: 'CommitRoleTransitionProposal',
      proposalId,
      actingPersonId: NF.owner,
      expectedRevision: 1,
      beliefIds: [],
      evidenceClaimIds: [],
      rationale: { note: 'Task 11 structural setup' },
      schemeSide: null,
    }),
  );
};

const fullyAllocateQbFirstTeamReps = (r: ReturnType<typeof dRunner>) => {
  moveNorthfieldPlayerToQuarterback(r);
  const windowId = openWindow(r);
  const proposalId = submitAllocation(r, windowId, [
    {
      ...allocationTerms('player-nf-01', 100),
      resourceKey: 'first_team_reps',
      scopeKey: 'quarterback',
    },
  ]);
  okResult(r.run(commitAllocation(proposalId)));
  return windowId;
};

const qbPool = (
  preview: ReturnType<typeof previewOpportunityImpactForRosterChange>,
) =>
  preview.pools.find(
    (pool) =>
      pool.resourceKey === 'first_team_reps' && pool.scopeKey === 'quarterback',
  )!;

describe('development opportunity-impact preview', () => {
  it('shows a squeeze when an incoming QB enters a fully allocated QB scope but no crowding in an unused WR scope', () => {
    const r = dRunner();
    fullyAllocateQbFirstTeamReps(r);

    const qb = previewOpportunityImpactForRosterChange(
      r.kernel.world,
      NF.org,
      ['player-fa-04'],
      [],
    );
    const qbImpact = qbPool(qb);
    expect(qbImpact).toMatchObject({
      capacityUnits: 100,
      allocatedUnits: 100,
      openUnits: 0,
      incomingCompetitionPlayerIds: ['player-fa-04'],
      outgoingCompetitionPlayerIds: [],
      crowdingBand: 'severe',
      reliefBand: 'none',
    });

    const receiver = previewOpportunityImpactForRosterChange(
      r.kernel.world,
      NF.org,
      ['player-fa-02'],
      [],
    );
    const wrFirstTeam = receiver.pools.find(
      (pool) =>
        pool.resourceKey === 'first_team_reps' &&
        pool.scopeKey === 'wide_receiver',
    )!;
    expect(wrFirstTeam.allocatedUnits).toBe(0);
    expect(wrFirstTeam.openUnits).toBe(wrFirstTeam.capacityUnits);
    expect(wrFirstTeam.crowdingBand).toBe('none');
  });

  it('is byte-identical when only hidden capability and development-profile truth changes', () => {
    const r = dRunner();
    fullyAllocateQbFirstTeamReps(r);
    const base = r.kernel.world;
    const altered = {
      ...base,
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
      },
    };

    const a = previewOpportunityImpactForRosterChange(
      base,
      NF.org,
      ['player-fa-04'],
      [],
    );
    const b = previewOpportunityImpactForRosterChange(
      altered,
      NF.org,
      ['player-fa-04'],
      [],
    );
    expect(canonicalString(a)).toBe(canonicalString(b));
    const bytes = canonicalString(a);
    expect(bytes).not.toMatch(
      /capabilit|malleab|adaptability|processing|recoveryBp|durability|healing|reinjury/i,
    );
  });

  it('reports relief structurally when an outgoing competitor leaves a saturated scope', () => {
    const r = dRunner();
    fullyAllocateQbFirstTeamReps(r);
    const impact = previewOpportunityImpactForRosterChange(
      r.kernel.world,
      NF.org,
      [],
      ['player-nf-01'],
    );
    expect(qbPool(impact)).toMatchObject({
      incomingCompetitionPlayerIds: [],
      outgoingCompetitionPlayerIds: ['player-nf-01'],
      crowdingBand: 'none',
      reliefBand: 'severe',
    });
  });
  it('surfaces linked organization-owned development plans by ID without turning them into a value score', () => {
    const r = dRunner();
    const planId = adoptDevelopmentPlan(r);
    openWindow(r);
    const impact = previewOpportunityImpactForRosterChange(
      r.kernel.world,
      NF.org,
      ['player-eb-04'],
      [],
    );
    const runningBackPools = impact.pools.filter(
      (pool) => pool.scopeKey === 'running_back',
    );
    expect(runningBackPools.length).toBeGreaterThan(0);
    expect(
      runningBackPools.every((pool) => pool.linkedPlanIds.includes(planId)),
    ).toBe(true);
  });
});
