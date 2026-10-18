import { describe, expect, it } from 'vitest';
import {
  activeRightsFor,
  buildOrganizationKnowledgeView,
  canonicalString,
  currentRosterMembership,
  entityId,
  recordId,
  personOwnedRoleKnowledge,
  type AcquisitionAssetRef,
  type TradePackageV1,
} from '../src/index';
import { submitTradeProposal } from './support/packageCHarness';
import { COACH, dRunner, D_TODAY, NF } from './support/packageDHarness';
import { okResult, type Runner } from './support/orgHarness';

const EB = {
  org: entityId('org-eastbrook'),
  gm: entityId('person-eb-gm'),
};

const rights = (r: Runner, playerId: string): AcquisitionAssetRef => {
  const right = activeRightsFor(
    r.kernel.world.roster,
    entityId(playerId),
    r.kernel.world.simDate,
  )[0]!;
  return {
    kind: 'player_rights',
    playerId: right.playerId,
    rightsId: right.id,
  };
};

const pick = (id: string): AcquisitionAssetRef => ({
  kind: 'draft_pick',
  pickId: recordId(id),
});

const packageFor = (r: Runner): TradePackageV1 => ({
  organizationAId: entityId(NF.org),
  organizationBId: EB.org,
  assetsFromA: [rights(r, 'player-nf-01'), pick('pick-2027-r1-s4')],
  assetsFromB: [rights(r, 'player-eb-04'), pick('pick-2027-r2-s2')],
  validity: { expiresAt: null },
  contingencies: {},
});

const side = (actingPersonId: string) => ({
  actingPersonId,
  expectedRevision: 1,
  beliefIds: [],
  evidenceClaimIds: [],
  rationale: { note: 'movement continuity test' },
});

const tradePlayer = (r: Runner) => {
  const pkg = packageFor(r);
  const proposerProposal = submitTradeProposal(r, NF.org, NF.gm, EB.org, pkg);
  okResult(
    r.run({
      type: 'PostTradeOffer',
      actingPersonId: NF.gm,
      proposalId: proposerProposal,
      expectedRevision: 1,
    }),
  );
  const offerId = r.kernel.world.market.tradeOffers.at(-1)!.id;
  const counterpartyProposal = submitTradeProposal(
    r,
    EB.org,
    EB.gm,
    NF.org,
    pkg,
  );
  okResult(
    r.run({
      type: 'AnswerTradeOffer',
      actingPersonId: EB.gm,
      offerId,
      offerRevision: 1,
      answer: 'accept',
    }),
  );
  okResult(
    r.run({
      type: 'CommitTradeAgreement',
      actingPersonId: NF.gm,
      offerId,
      offerRevision: 1,
      counterpartyProposalId: counterpartyProposal,
      proposerSide: side(NF.gm),
      counterpartySide: side(EB.gm),
    }),
  );
};

const playerCapabilities = (r: Runner) =>
  canonicalString(
    r.kernel.world.roster.players.find((p) => p.personId === 'player-nf-01')!
      .capabilities,
  );

const playerProfile = (r: Runner) =>
  canonicalString(
    r.kernel.world.development.playerProfiles.find(
      (p) => p.personId === 'player-nf-01',
    )!,
  );

const playerKnowledge = (r: Runner) =>
  canonicalString(
    personOwnedRoleKnowledge(
      r.kernel.world.development,
      entityId('player-nf-01'),
    ),
  );

describe('player movement continuity', () => {
  it('moves team rights without moving person-owned capability, medical history, learned knowledge or old-org private beliefs', () => {
    const r = dRunner();
    okResult(
      r.run({
        type: 'CreateMedicalEpisode',
        playerId: 'player-nf-01',
        conditionKey: 'synthetic_shoulder',
        onsetAt: D_TODAY,
        sourceKind: 'synthetic_test',
        affectedActionKeys: ['hands'],
        initialStructuralSeverityBp: 3000,
        recoveryResponsivenessBp: 8000,
        baselineReinjuryRiskBp: 4500,
      }),
    );
    okResult(
      r.run({
        type: 'RecordClaim',
        organizationId: NF.org,
        actingPersonId: NF.scout,
        subject: { kind: 'entity', id: 'player-nf-01' },
        propositionType: 'development_note',
        proposition: { note: 'Northfield private player read' },
        sourceFamilyId: 'nf-private-player-read',
        observedAt: D_TODAY,
        visibility: 'organization',
        confidence: 'medium',
        possibleBias: null,
        corroboratesClaimIds: [],
        contradictsClaimIds: [],
      }),
    );
    const claimId = r.kernel.world.information.claims.at(-1)!.id;
    okResult(
      r.run({
        type: 'FormBelief',
        organizationId: NF.org,
        actingPersonId: NF.scout,
        subject: { kind: 'entity', id: 'player-nf-01' },
        assessmentType: 'development_outlook',
        assessment: { note: 'private Northfield interpretation' },
        confidence: 'medium',
        evidenceClaimIds: [claimId],
        supersedesBeliefId: null,
      }),
    );
    const beliefId = r.kernel.world.information.beliefs.at(-1)!.id;
    okResult(
      r.run({
        type: 'RecordRelationshipEffect',
        partyA: { kind: 'person', entityId: 'player-nf-01' },
        partyB: { kind: 'person', entityId: COACH },
        causeType: 'synthetic_coaching_history',
        causeId: 'coach-player-nf-01',
        changes: [{ dimension: 'trust', to: 'high' }],
      }),
    );

    const before = {
      capabilities: playerCapabilities(r),
      profile: playerProfile(r),
      knowledge: playerKnowledge(r),
      medical: canonicalString(r.kernel.world.medical),
      relationships: canonicalString(r.kernel.world.relationships),
    };
    expect(
      buildOrganizationKnowledgeView(
        r.kernel.world,
        NF.org,
        NF.scout,
      ).beliefs.map((b) => b.id),
    ).toContain(beliefId);

    tradePlayer(r);

    expect(
      currentRosterMembership(
        r.kernel.world.roster,
        entityId('player-nf-01'),
        r.kernel.world.simDate,
      )?.organizationId,
    ).toBe(EB.org);
    expect(playerCapabilities(r)).toBe(before.capabilities);
    expect(playerProfile(r)).toBe(before.profile);
    expect(playerKnowledge(r)).toBe(before.knowledge);
    expect(canonicalString(r.kernel.world.medical)).toBe(before.medical);
    expect(canonicalString(r.kernel.world.relationships)).toBe(
      before.relationships,
    );

    const eastbrook = buildOrganizationKnowledgeView(
      r.kernel.world,
      EB.org,
      EB.gm,
    );
    expect(eastbrook.claims.map((c) => c.id)).not.toContain(claimId);
    expect(eastbrook.beliefs.map((b) => b.id)).not.toContain(beliefId);
    expect(
      buildOrganizationKnowledgeView(
        r.kernel.world,
        NF.org,
        NF.scout,
      ).beliefs.map((b) => b.id),
    ).toContain(beliefId);
  });

  it('changing organization alone creates no revenge capability or development-profile boost', () => {
    const r = dRunner();
    const beforeCapabilities = playerCapabilities(r);
    const beforeProfile = playerProfile(r);
    const beforeKnowledge = playerKnowledge(r);

    tradePlayer(r);

    expect(playerCapabilities(r)).toBe(beforeCapabilities);
    expect(playerProfile(r)).toBe(beforeProfile);
    expect(playerKnowledge(r)).toBe(beforeKnowledge);
  });
});
