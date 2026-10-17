import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_C_RULESET,
  buildAcquisitionDecisionView,
  entityId,
  recordId,
  requireTransactionRules,
  type FootballWorld,
  type TradeOfferRecord,
  type TradeOfferResponse,
} from '../src/index';
import {
  NF,
  compose,
  newKernelWith,
  newPackageCKernel,
  postureOnlyPlan,
  tierBelief,
  withBeliefs,
  withPlans,
} from './support/packageCHarness';

const TX = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
const EB = { org: 'org-eastbrook', gm: 'person-eb-gm' };
const SP = { org: 'org-southport', gm: 'person-sp-gm' };
const WL = { org: 'org-westlake', gm: 'person-wl-gm' };

const viewOf = (w: FootballWorld, org: string, person: string) => {
  const r = buildAcquisitionDecisionView(
    w,
    entityId(org),
    entityId(person),
    TX,
  );
  if (!r.ok) throw new Error(r.reason);
  return r.view;
};

const offer = (
  id: string,
  proposer: string,
  counterparty: string,
  pick: string,
): TradeOfferRecord => ({
  id: recordId(id),
  revision: 1,
  proposerOrganizationId: entityId(proposer),
  counterpartyOrganizationId: entityId(counterparty),
  package: {
    organizationAId: entityId(proposer),
    organizationBId: entityId(counterparty),
    assetsFromA: [{ kind: 'draft_pick', pickId: recordId(pick) }],
    assetsFromB: [],
    validity: { expiresAt: null },
    contingencies: {},
  },
  proposerProposalId: recordId('rec-proposal-x'),
  counterpartyProposalId: null,
  termsHash: 'a'.repeat(64),
  status: 'open',
  createdAt: '2027-02-15',
  expiresAt: null,
  supersedesRevision: null,
});

describe('AcquisitionDecisionView: own state', () => {
  const w = newPackageCKernel().world;

  it('states the clubâ€™s own roster, cap, picks and authority', () => {
    const v = viewOf(w, NF.org, NF.gm);
    expect(v.own.roster.map((p) => [p.playerId, p.rosterStatus])).toEqual([
      ['player-nf-01', 'active'],
      ['player-nf-02', 'active'],
      ['player-nf-03', 'active'],
      ['player-nf-04', 'reserve'],
      ['player-nf-05', 'practice_squad'],
    ]);
    expect(v.own.capBySeason[0]).toMatchObject({
      season: 2027,
      committed: 1_085_000,
    });
    expect(v.own.picks.map((p) => p.pickId)).toContain('pick-2027-r2-s1');
    expect(v.own.picks.every((p) => p.ownerOrganizationId === NF.org)).toBe(
      true,
    );
    expect(v.authority.acquisition).toEqual(
      expect.arrayContaining(['propose', 'communicate', 'execute']),
    );
  });

  it('gives a scout less authority than the GM and refuses a non-member', () => {
    const scout = viewOf(w, NF.org, 'person-nf-scout');
    expect(scout.authority.acquisition).not.toContain('execute');
    expect(
      buildAcquisitionDecisionView(w, entityId(NF.org), entityId(EB.gm), TX).ok,
    ).toBe(false);
  });

  it('lists other clubsâ€™ players and picks as candidates, never its own', () => {
    const v = viewOf(w, NF.org, NF.gm);
    expect(v.candidateIds.playerIds).toContain('player-eb-01');
    expect(v.candidateIds.playerIds).not.toContain('player-nf-01');
    expect(v.candidateIds.pickIds).toContain('pick-2027-r1-s3');
    expect(v.candidateIds.pickIds).not.toContain('pick-2027-r1-s4');
  });

  it('carries public contract terms and positions, which are league record', () => {
    const v = viewOf(w, NF.org, NF.gm);
    const c = v.publicContext.contracts.find(
      (x) => x.playerId === 'player-eb-01',
    )!;
    expect(c.organizationId).toBe(EB.org);
    expect(c.capChargeBySeason[0]!.season).toBe(2027);
    expect(
      v.publicContext.players.find((p) => p.playerId === 'player-eb-01'),
    ).toMatchObject({
      holderOrganizationId: EB.org,
      rosterStatus: 'active',
    });
  });
});

describe('AcquisitionDecisionView: no oracle, no leak', () => {
  const MARK = 'RIVAL-MARKER-7731';
  const world = (): FootballWorld =>
    newKernelWith(
      compose(
        withBeliefs(
          tierBelief(EB.org, EB.gm, 'player-nf-01', 'priority', { note: MARK }),
        ),
        withPlans(postureOnlyPlan(EB.org, EB.gm, 'rebuild', 'plan-eb-private')),
        (w) => ({
          ...w,
          market: {
            ...w.market,
            tradeOffers: [
              offer('rec-offer-sp-wl', SP.org, WL.org, 'pick-2028-r1-sp'),
            ],
            inquiries: [
              {
                id: recordId('rec-inq-sp-wl'),
                askingOrganizationId: entityId(SP.org),
                askedBy: entityId(SP.gm),
                contactedOrganizationId: entityId(WL.org),
                asset: {
                  kind: 'draft_pick',
                  pickId: recordId('pick-2028-r1-wl'),
                },
                direction: 'seek',
                createdAt: '2027-02-15',
              },
            ],
          },
        }),
      ),
    ).world;

  it('excludes rival beliefs, plans, offers and inquiries between other clubs', () => {
    const text = JSON.stringify(viewOf(world(), NF.org, NF.gm));
    for (const secret of [
      MARK,
      'plan-eb-private',
      'rec-offer-sp-wl',
      'rec-inq-sp-wl',
      'competitive_window',
    ])
      expect(text).not.toContain(secret);
  });

  it('shows a club its own beliefs and plans', () => {
    const text = JSON.stringify(viewOf(world(), EB.org, EB.gm));
    expect(text).toContain(MARK);
    expect(text).toContain('plan-eb-private');
  });

  it('omits latent capabilities and private player preferences', () => {
    const w = world();
    const secrets = [
      ...new Set(
        w.roster.players.flatMap((p) => p.capabilities.map((c) => c.key)),
      ),
      'capabilities',
      'valueBp',
      'playerPreferences',
      'roleOpportunity',
      'earlyCash',
      'contenderPreference',
    ];
    let viewed = 0;
    for (const e of w.people.roleEpisodes) {
      const text = JSON.stringify(viewOf(w, e.organizationId, e.personId));
      for (const s of secrets) expect(text).not.toContain(`\"${s}\"`);
      viewed += 1;
    }
    expect(viewed).toBeGreaterThan(0);
  });

  it('hides the responderâ€™s private reasons and state fingerprint from the other club', () => {
    const response: TradeOfferResponse = {
      kind: 'trade_response',
      id: recordId('rec-resp-1'),
      offerId: recordId('rec-offer-nf-eb'),
      offerRevision: 1,
      respondingOrganizationId: entityId(EB.org),
      disposition: 'counter',
      reasons: [
        { code: 'KEEP_CORE_PLAYER', source: 'own_belief', detail: MARK },
      ],
      uncertainties: ['NO_EVALUATION:player-nf-01'],
      communicated: ['player_not_available'],
      basisHash: 'b'.repeat(64),
      createdAt: '2027-02-15',
    };
    const w = newKernelWith((x) => ({
      ...x,
      market: {
        ...x.market,
        tradeOffers: [
          offer('rec-offer-nf-eb', NF.org, EB.org, 'pick-2027-r1-s4'),
        ],
        responses: [response],
      },
    })).world;
    const mine = viewOf(w, NF.org, NF.gm).market.offerResponses[0]!;
    expect(mine.disposition).toBe('counter');
    expect(mine.communicated).toEqual(['player_not_available']);
    expect(mine.reasons).toEqual([]);
    expect(mine.uncertainties).toEqual([]);
    expect(mine.basisHash).toBe('');
    const theirs = viewOf(w, EB.org, EB.gm).market.offerResponses[0]!;
    expect(theirs.reasons).toHaveLength(1);
  });
});
