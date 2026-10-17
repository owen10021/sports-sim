import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_C_RULESET,
  bandsOf,
  buildAcquisitionDecisionView,
  buildPlayerMarketDecisionView,
  entityId,
  evaluatePlayerOfferSet,
  rankAcceptableOffers,
  requireTransactionRules,
} from '../src/index';
import {
  EB,
  FLAT,
  FRONT,
  NF,
  SECURE,
  SP,
  openMarket,
  resolveMarket,
  sendOffer,
  terms,
} from './support/freeAgencyHarness';
import { newPackageCKernel } from './support/packageCHarness';
import { okResult, runnerFor } from './support/orgHarness';

const TX = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
const fresh = () => {
  const r = runnerFor(newPackageCKernel());
  openMarket(r);
  return r;
};
const view = (r: ReturnType<typeof fresh>, playerId: string) =>
  buildPlayerMarketDecisionView(r.kernel.world, entityId(playerId));

describe('describing an offer in bands', () => {
  it('reads security, cash timing and role from the terms alone', () => {
    expect(bandsOf(terms(FLAT), 'starter')).toEqual({
      security: 'low',
      earlyCash: 'medium',
      roleOpportunity: 'high',
    });
    expect(bandsOf(terms(SECURE), 'rotation')).toEqual({
      security: 'high',
      earlyCash: 'medium',
      roleOpportunity: 'medium',
    });
    expect(bandsOf(terms(FRONT), 'depth')).toEqual({
      security: 'medium',
      earlyCash: 'high',
      roleOpportunity: 'low',
    });
  });
});

describe('the player-side decision view', () => {
  it('shows the player his own offers and profile, never a club’s private structure', () => {
    const r = fresh();
    okResult(
      sendOffer(r, NF.org, NF.gm, 'player-fa-01', {
        terms: FLAT,
        priority: 7,
        group: 'fallback-a',
      }).res,
    );
    okResult(sendOffer(r, SP.org, SP.gm, 'player-fa-01', { terms: FRONT }).res);
    const v = view(r, 'player-fa-01');
    expect(v.agentPersonId).toBe('person-agent-ashby');
    expect(v.preferences?.roleOpportunity).toBe('high');
    expect(v.offers.map((o) => o.organizationId)).toEqual([NF.org, SP.org]);
    const text = JSON.stringify(v);
    for (const secret of [
      'priority',
      'contingencyGroupId',
      'fallback-a',
      'reservation',
      'organizationProposalId',
      'submittedBy',
    ])
      expect(text).not.toContain(secret);
    expect(v.uncertainties.join(' ')).toContain(
      'contender_preference_not_applied',
    );
  });

  it('ignores offers that did not come through his agent or have lapsed', () => {
    const r = fresh();
    okResult(sendOffer(r, NF.org, NF.gm, 'player-fa-01').res);
    expect(view(r, 'player-fa-01').offers).toHaveLength(1);
    okResult(r.run({ type: 'AdvanceDays', days: 8 }));
    expect(view(r, 'player-fa-01').offers).toHaveLength(0);
  });
});

describe('evaluating an offer set', () => {
  // fa-03: needs high security, any cash timing, medium role; inflexible.
  const threeOffers = () => {
    const r = fresh();
    okResult(
      sendOffer(r, NF.org, NF.gm, 'player-fa-03', {
        terms: SECURE,
        role: 'rotation',
      }).res,
    );
    okResult(
      sendOffer(r, SP.org, SP.gm, 'player-fa-03', {
        terms: FLAT,
        role: 'rotation',
      }).res,
    );
    okResult(
      sendOffer(r, EB.org, EB.gm, 'player-fa-03', {
        terms: FLAT,
        role: 'depth',
      }).res,
    );
    return r;
  };

  it('accepts what meets every requirement, counters a single shortfall, rejects the rest', () => {
    const r = threeOffers();
    const byOrg = new Map(
      evaluatePlayerOfferSet(view(r, 'player-fa-03')).map((e) => [
        e.organizationId,
        e,
      ]),
    );
    expect(byOrg.get(NF.org)).toMatchObject({
      disposition: 'accept',
      communicated: ['interested'],
    });
    expect(byOrg.get(SP.org)).toMatchObject({
      disposition: 'counter',
      communicated: ['wants_more_security'],
      unmet: ['security'],
    });
    expect(byOrg.get(EB.org)).toMatchObject({
      disposition: 'reject',
      communicated: ['not_a_fit'],
    });
    // The private reasons name his requirements; the communicated codes never do.
    expect(byOrg.get(SP.org)!.reasons.join(' ')).toContain('needs high');
    expect(byOrg.get(SP.org)!.communicated.join(' ')).not.toContain('needs');
  });

  it('flexibility eases a requirement by one step', () => {
    const r = fresh();
    // fa-02: security medium, flexibility high -> security requirement eased to low.
    okResult(
      sendOffer(r, NF.org, NF.gm, 'player-fa-02', {
        terms: FLAT,
        role: 'depth',
      }).res,
    );
    const [e] = evaluatePlayerOfferSet(view(r, 'player-fa-02'));
    expect(e!.disposition).toBe('accept');
  });

  it('defers acceptable offers that rank below the best one', () => {
    const r = fresh();
    // fa-01: role high first, then cash medium. Both starters; front-loaded beats flat.
    okResult(sendOffer(r, NF.org, NF.gm, 'player-fa-01', { terms: FLAT }).res);
    okResult(sendOffer(r, SP.org, SP.gm, 'player-fa-01', { terms: FRONT }).res);
    const byOrg = new Map(
      evaluatePlayerOfferSet(view(r, 'player-fa-01')).map((e) => [
        e.organizationId,
        e.disposition,
      ]),
    );
    expect(byOrg.get(SP.org)).toBe('accept');
    expect(byOrg.get(NF.org)).toBe('defer');
  });
});

describe('no hidden discounts or oracles', () => {
  it('identical terms from different clubs are judged identically; only the club id breaks a tie', () => {
    const r = fresh();
    okResult(sendOffer(r, SP.org, SP.gm, 'player-fa-01', { terms: FLAT }).res);
    okResult(sendOffer(r, NF.org, NF.gm, 'player-fa-01', { terms: FLAT }).res);
    const v = view(r, 'player-fa-01');
    const [a, b] = v.offers;
    expect(a!.bands).toEqual(b!.bands);
    expect(a!.totalCash).toBe(b!.totalCash);
    const ranked = rankAcceptableOffers(v.preferences, v.playerId, v.offers);
    expect(ranked.map((o) => o.organizationId)).toEqual([NF.org, SP.org]);
    // The order the offers were made in does not matter.
    const reversed = rankAcceptableOffers(
      v.preferences,
      v.playerId,
      [...v.offers].reverse(),
    );
    expect(reversed.map((o) => o.organizationId)).toEqual([NF.org, SP.org]);
  });

  it('more total money does not beat a better fit on what the player cares about most', () => {
    const r = fresh();
    okResult(
      sendOffer(r, NF.org, NF.gm, 'player-fa-01', { terms: { base: 150_000 } })
        .res,
    );
    okResult(sendOffer(r, SP.org, SP.gm, 'player-fa-01', { terms: FRONT }).res);
    const v = view(r, 'player-fa-01');
    const nf = v.offers.find((o) => o.organizationId === NF.org)!;
    const sp = v.offers.find((o) => o.organizationId === SP.org)!;
    expect(nf.totalCash).toBeGreaterThan(sp.totalCash);
    const ranked = rankAcceptableOffers(v.preferences, v.playerId, v.offers);
    expect(ranked[0]!.organizationId).toBe(SP.org);
  });

  it('the view and the evaluation carry no relationship, rating or club-specific adjustment', () => {
    const r = fresh();
    okResult(sendOffer(r, NF.org, NF.gm, 'player-fa-01').res);
    const text = JSON.stringify(view(r, 'player-fa-01'));
    for (const word of [
      'relationship',
      'trust',
      'rating',
      'overall',
      'potential',
      'capabilit',
    ])
      expect(text.toLowerCase()).not.toContain(word);
  });
});

describe('private preferences never reach an organization', () => {
  it('club-facing records and views carry coarse codes only', () => {
    const r = fresh();
    okResult(
      sendOffer(r, NF.org, NF.gm, 'player-fa-03', {
        terms: FLAT,
        role: 'rotation',
      }).res,
    );
    okResult(resolveMarket(r));
    const w = r.kernel.world;
    const offer = w.market.contractOffers[0]!;
    expect(offer.communicated).toEqual(['wants_more_security']);
    const clubFacing = JSON.stringify(offer);
    for (const secret of [
      'requirement',
      'needs high',
      'flexibility',
      'earlyCash',
      'roleOpportunity',
    ])
      expect(clubFacing).not.toContain(secret);
    for (const who of [NF, SP]) {
      const acq = buildAcquisitionDecisionView(w, who.org, who.gm, TX);
      const text = JSON.stringify(acq);
      for (const secret of [
        'requirement_',
        'contract_response',
        'flexibility',
        'contenderPreference',
        'earlyCash',
      ])
        expect(text).not.toContain(secret);
    }
  });
});
