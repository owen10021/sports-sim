import { describe, expect, it } from 'vitest';
import { canonicalString, projectTransferFamiliarity } from '../src/index';
import { dRunner, NF } from './support/packageDHarness';
import { codeOf, okResult, snapshotOf } from './support/orgHarness';

const ROLE_TERMS = 'role_transition_v1';
const SCHEME_TERMS = 'role_scheme_transition_v1';

const submitRole = (
  r: ReturnType<typeof dRunner>,
  schemeProposalId: string | null = null,
) => {
  okResult(
    r.run({
      type: 'SubmitProposal',
      organizationId: NF.org,
      actingPersonId: NF.owner,
      category: 'roster',
      subjects: [{ kind: 'entity', id: 'player-nf-01' }],
      termsType: ROLE_TERMS,
      terms: {
        playerId: 'player-nf-01',
        primaryRole: 'wide_receiver',
        roleTags: ['starter_profile', 'wide_receiver'],
        schemeProposalId,
      },
      requiredApproverPersonIds: [],
      expiresAt: null,
      contingencies: {},
    }),
  );
  return r.kernel.world.decisions.proposals.at(-1)!.id;
};

const submitScheme = (r: ReturnType<typeof dRunner>) => {
  okResult(
    r.run({
      type: 'SubmitProposal',
      organizationId: NF.org,
      actingPersonId: NF.owner,
      category: 'scheme',
      subjects: [{ kind: 'entity', id: 'player-nf-01' }],
      termsType: SCHEME_TERMS,
      terms: {
        playerId: 'player-nf-01',
        schemeKey: 'base_offense',
        responsibilityKeys: ['route_reads'],
      },
      requiredApproverPersonIds: [],
      expiresAt: null,
      contingencies: {},
    }),
  );
  return r.kernel.world.decisions.proposals.at(-1)!.id;
};

const rosterSide = (proposalId: string) => ({
  type: 'CommitRoleTransitionProposal',
  proposalId,
  actingPersonId: NF.owner,
  expectedRevision: 1,
  beliefIds: [],
  evidenceClaimIds: [],
  rationale: { note: 'cross-train label only' },
  schemeSide: null,
});

describe('CommitRoleTransitionProposal', () => {
  it('changes role labels without creating capability, development, readiness, medical or role-knowledge gains', () => {
    const r = dRunner();
    const beforePlayer = r.kernel.world.roster.players.find(
      (p) => p.personId === 'player-nf-01',
    )!;
    const before = {
      capabilities: canonicalString(beforePlayer.capabilities),
      profile: canonicalString(
        r.kernel.world.development.playerProfiles.find(
          (p) => p.personId === 'player-nf-01',
        )!,
      ),
      knowledge: canonicalString(
        r.kernel.world.development.roleKnowledge.filter(
          (k) => k.playerId === 'player-nf-01',
        ),
      ),
      readiness: canonicalString(
        r.kernel.world.development.readiness.find(
          (x) => x.playerId === 'player-nf-01',
        )!,
      ),
      medical: canonicalString(r.kernel.world.medical),
    };
    const existing = r.kernel.world.development.roleKnowledge.filter(
      (k) => k.playerId === 'player-nf-01',
    );
    expect(
      projectTransferFamiliarity(
        existing,
        'base_offense',
        'route_reads',
        'ball_carrier',
      ),
    ).toBeGreaterThan(0);
    expect(
      existing.some(
        (k) =>
          k.schemeKey === 'base_offense' &&
          k.responsibilityKey === 'route_reads',
      ),
    ).toBe(false);

    const proposalId = submitRole(r);
    okResult(r.run(rosterSide(proposalId)));

    const player = r.kernel.world.roster.players.find(
      (p) => p.personId === 'player-nf-01',
    )!;
    expect(player.primaryRole).toBe('wide_receiver');
    expect(player.roleTags).toEqual(['starter_profile', 'wide_receiver']);
    expect(canonicalString(player.capabilities)).toBe(before.capabilities);
    expect(
      canonicalString(
        r.kernel.world.development.playerProfiles.find(
          (p) => p.personId === 'player-nf-01',
        )!,
      ),
    ).toBe(before.profile);
    expect(
      canonicalString(
        r.kernel.world.development.roleKnowledge.filter(
          (k) => k.playerId === 'player-nf-01',
        ),
      ),
    ).toBe(before.knowledge);
    expect(
      r.kernel.world.development.roleKnowledge.some(
        (k) =>
          k.playerId === 'player-nf-01' &&
          k.responsibilityKey === 'route_reads',
      ),
    ).toBe(false);
    expect(
      canonicalString(
        r.kernel.world.development.readiness.find(
          (x) => x.playerId === 'player-nf-01',
        )!,
      ),
    ).toBe(before.readiness);
    expect(canonicalString(r.kernel.world.medical)).toBe(before.medical);
  });

  it('requires a current authorized scheme proposal when the role transition cites scheme-responsibility change', () => {
    const r = dRunner();
    const schemeProposalId = submitScheme(r);
    const roleProposalId = submitRole(r, schemeProposalId);
    const before = snapshotOf(r.kernel);

    expect(codeOf(r.run(rosterSide(roleProposalId)))).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);

    const result = okResult(
      r.run({
        ...rosterSide(roleProposalId),
        schemeSide: {
          proposalId: schemeProposalId,
          actingPersonId: NF.owner,
          expectedRevision: 1,
          beliefIds: [],
          evidenceClaimIds: [],
          rationale: { note: 'authorize responsibility transition intent' },
        },
      }),
    );
    expect(
      result.world.decisions.receipts.slice(-2).map((x) => x.proposalId),
    ).toEqual([schemeProposalId, roleProposalId].sort());
    expect(
      result.world.development.roleKnowledge.some(
        (k) =>
          k.playerId === 'player-nf-01' &&
          k.responsibilityKey === 'route_reads',
      ),
    ).toBe(false);
  });
});
