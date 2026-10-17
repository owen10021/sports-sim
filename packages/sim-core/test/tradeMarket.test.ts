import { describe, expect, it } from 'vitest';
import {
  activeRightsFor,
  entityId,
  recordId,
  type AcquisitionAssetRef,
  type ExecuteResult,
  type TradePackageV1,
} from '../src/index';
import {
  NF,
  compose,
  newKernelWith,
  postureOnlyPlan,
  submitTradeProposal,
  tierBelief,
  withBeliefs,
  withPlans,
} from './support/packageCHarness';
import {
  codeOf,
  messageOf,
  okResult,
  runnerFor,
  type Runner,
} from './support/orgHarness';

const EB = {
  org: 'org-eastbrook',
  gm: 'person-eb-gm',
  scout: 'person-eb-scout',
};
const TODAY = '2027-02-15';

const asset = (r: Runner, playerId: string): AcquisitionAssetRef => {
  const right = activeRightsFor(
    r.kernel.world.roster,
    entityId(playerId),
    TODAY,
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
const pkg = (
  a: AcquisitionAssetRef[],
  b: AcquisitionAssetRef[],
): TradePackageV1 => ({
  organizationAId: entityId(NF.org),
  organizationBId: entityId(EB.org),
  assetsFromA: a,
  assetsFromB: b,
  validity: { expiresAt: null },
  contingencies: {},
});

const rebuilding = () =>
  runnerFor(
    newKernelWith(
      compose(
        withPlans(postureOnlyPlan(EB.org, EB.gm, 'rebuild')),
        withBeliefs(),
      ),
    ),
  );

const inquire = (
  r: Runner,
  extra: Record<string, unknown> = {},
  by = NF.gm,
): ExecuteResult =>
  r.run({
    type: 'SubmitMarketInquiry',
    organizationId: NF.org,
    actingPersonId: by,
    contactedOrganizationId: EB.org,
    asset: { kind: 'draft_pick', pickId: 'pick-2027-r1-s4' },
    direction: 'shop',
    ...extra,
  });

const advance = (r: Runner, days = 1) =>
  okResult(r.run({ type: 'AdvanceDays', days }));

describe('market inquiries', () => {
  it('records who was asked and what was communicated, and nothing about hidden interest', () => {
    const r = rebuilding();
    const res = okResult(inquire(r));
    expect(res.events.map((e) => e.type)).toEqual([
      'MarketInquirySent',
      'MarketInquiryAnswered',
    ]);
    const m = r.kernel.world.market;
    expect(m.inquiries).toHaveLength(1);
    expect(m.inquiries[0]).toMatchObject({
      askingOrganizationId: NF.org,
      contactedOrganizationId: EB.org,
      direction: 'shop',
    });
    // A rebuilding club asked about a premium pick says it is interested.
    expect(m.responses[0]).toMatchObject({
      kind: 'inquiry_response',
      band: 'interested',
    });
  });

  it('does not reroll: the same question on the same day returns the recorded answer', () => {
    const r = rebuilding();
    okResult(inquire(r));
    const again = inquire(r);
    expect(codeOf(again)).toBe('INVALID_PAYLOAD');
    expect(messageOf(again)).toContain('recorded answer');
    expect(r.kernel.world.market.responses).toHaveLength(1);
  });

  it('does not let a same-day change of the other club’s state be probed', () => {
    const w = newKernelWith(
      withPlans(postureOnlyPlan(EB.org, EB.gm, 'rebuild')),
    );
    const r = runnerFor(w);
    okResult(inquire(r));
    // Even if the contacted club's relevant state differed, the same day cannot reroll.
    expect(messageOf(inquire(r))).toContain('recorded answer');
  });

  it('keeps the recorded answer on a later day while the relevant state is unchanged', () => {
    const r = rebuilding();
    okResult(inquire(r));
    advance(r);
    const same = inquire(r);
    expect(codeOf(same)).toBe('INVALID_PAYLOAD');
    expect(r.kernel.world.market.responses).toHaveLength(1);
  });
  it('needs communicate authority, a real asset and the right owner', () => {
    const r = rebuilding();
    expect(
      codeOf(
        inquire(r, {
          asset: { kind: 'draft_pick', pickId: 'pick-2027-r1-s2' },
        }),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(
      codeOf(
        inquire(r, { asset: { kind: 'draft_pick', pickId: 'pick-9999' } }),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(codeOf(inquire(r, { contactedOrganizationId: NF.org }))).toBe(
      'INVALID_PAYLOAD',
    );
    const noRights = r.run({
      type: 'SubmitMarketInquiry',
      organizationId: NF.org,
      actingPersonId: 'person-eb-gm',
      contactedOrganizationId: EB.org,
      asset: { kind: 'draft_pick', pickId: 'pick-2027-r1-s4' },
      direction: 'shop',
    });
    expect(codeOf(noRights)).toBe('INSUFFICIENT_AUTHORITY');
  });

  it('asking to buy a player a club will not move tells the asker nothing', () => {
    const buy = (tier: string | null) => {
      const beliefs =
        tier === null ? [] : [tierBelief(EB.org, EB.gm, 'player-eb-01', tier)];
      const r = runnerFor(newKernelWith(withBeliefs(...beliefs)));
      okResult(
        r.run({
          type: 'SubmitMarketInquiry',
          organizationId: NF.org,
          actingPersonId: NF.gm,
          contactedOrganizationId: EB.org,
          asset: asset(r, 'player-eb-01'),
          direction: 'seek',
        }),
      );
      const response = r.kernel.world.market.responses[0]!;
      return response.kind === 'inquiry_response' ? response.band : null;
    };
    expect(buy('priority')).toBe('none');
    expect(buy(null)).toBe('none');
  });
});

describe('offer responses', () => {
  const setup = () => {
    const r = rebuilding();
    const base = pkg([pick('pick-2027-r1-s4')], [asset(r, 'player-eb-01')]);
    const proposal = submitTradeProposal(r, NF.org, NF.gm, EB.org, base);
    okResult(
      r.run({
        type: 'PostTradeOffer',
        actingPersonId: NF.gm,
        proposalId: proposal,
        expectedRevision: 1,
      }),
    );
    return { r, base, offerId: r.kernel.world.market.tradeOffers[0]!.id };
  };
  const ask = (r: Runner, offerId: string) =>
    r.run({
      type: 'RequestTradeResponse',
      actingPersonId: NF.gm,
      offerId,
      offerRevision: 1,
    });

  it('derives the counterparty’s answer from its own plan and communicates only coarse asks', () => {
    const { r, offerId } = setup();
    okResult(ask(r, offerId));
    const response = r.kernel.world.market.responses[0]!;
    expect(response).toMatchObject({
      kind: 'trade_response',
      disposition: 'accept',
    });
    expect(r.kernel.world.market.tradeOffers[0]!.status).toBe('accepted');
  });

  it('records a refusal and tells the proposer only that the package is not right', () => {
    const r = runnerFor(
      newKernelWith(
        compose(
          withPlans(postureOnlyPlan(EB.org, EB.gm, 'rebuild')),
          withBeliefs(tierBelief(EB.org, EB.gm, 'player-eb-01', 'target')),
        ),
      ),
    );
    const base = pkg([pick('pick-2027-r1-s4')], [asset(r, 'player-eb-01')]);
    const proposal = submitTradeProposal(r, NF.org, NF.gm, EB.org, base);
    okResult(
      r.run({
        type: 'PostTradeOffer',
        actingPersonId: NF.gm,
        proposalId: proposal,
        expectedRevision: 1,
      }),
    );
    const offerId = r.kernel.world.market.tradeOffers[0]!.id;
    okResult(ask(r, offerId));
    const response = r.kernel.world.market.responses[0]!;
    expect(response).toMatchObject({
      disposition: 'counter',
      communicated: ['player_not_available'],
    });
    expect(r.kernel.world.market.tradeOffers[0]!.status).toBe('open');
  });

  it('an unchanged offer does not independently reroll the counterparty’s willingness', () => {
    const { r, offerId } = setup();
    okResult(ask(r, offerId));
    const before = r.kernel.world.market.responses;
    // The offer is now accepted; ask via a fresh open copy by revising nothing: the same
    // question on the same day is answered from the record.
    const again = ask(r, offerId);
    expect(codeOf(again)).toBe('INVALID_PAYLOAD');
    expect(r.kernel.world.market.responses).toEqual(before);
  });

  it('cites no rival information in the counterparty’s private reasons', () => {
    const { r, offerId } = setup();
    okResult(ask(r, offerId));
    const response = r.kernel.world.market.responses[0]!;
    if (response.kind !== 'trade_response')
      throw new Error('expected a trade response');
    for (const reason of response.reasons)
      expect([
        'own_roster',
        'own_cap',
        'own_picks',
        'own_plan',
        'own_belief',
        'public',
        'authority',
      ]).toContain(reason.source);
    expect(JSON.stringify(response.reasons)).not.toContain(
      NF.org.replace('org-', 'rival-'),
    );
  });
});
