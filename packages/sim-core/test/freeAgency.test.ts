import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_C_RULESET,
  activeRightsFor,
  capPosition,
  entityId,
  fingerprintWorld,
  requireTransactionRules,
  reservedCap,
  rosterCapacity,
  rosterInvariantFindings,
  type ContractOfferRecord,
} from '../src/index';
import {
  FLAT,
  FRONT,
  NF,
  SECURE,
  SP,
  commitSigning,
  latestOfferOf,
  offersOf,
  openMarket,
  resolveMarket,
  sendOffer,
} from './support/freeAgencyHarness';
import { newCapKernel, newPackageCKernel } from './support/packageCHarness';
import {
  codeOf,
  messageOf,
  okResult,
  runnerFor,
  snapshotOf,
} from './support/orgHarness';

const TX = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
const fresh = () => {
  const r = runnerFor(newPackageCKernel());
  openMarket(r);
  return r;
};
const NF_ASHBY_PLAYER = 'player-fa-01';

/** A player who will accept: Northfield offers fa-01 a flat starter deal. */
const accepted = () => {
  const r = fresh();
  okResult(
    sendOffer(r, NF.org, NF.gm, NF_ASHBY_PLAYER, {
      terms: FLAT,
      role: 'starter',
    }).res,
  );
  okResult(resolveMarket(r));
  return r;
};

describe('submitting an offer', () => {
  it('records the offer and reserves the cap and roster room it needs', () => {
    const r = fresh();
    const { res } = sendOffer(r, NF.org, NF.gm, NF_ASHBY_PLAYER, {
      terms: FLAT,
    });
    expect(okResult(res).events.map((e) => e.type)).toEqual([
      'ContractOfferSubmitted',
    ]);
    const offer = latestOfferOf(r, NF.org, NF_ASHBY_PLAYER);
    expect(offer).toMatchObject({
      status: 'communicated',
      revision: 1,
      extension: false,
      targetRosterStatus: 'active',
    });
    const reservation = r.kernel.world.market.reservations[0]!;
    expect(reservation).toMatchObject({
      sourceKind: 'contract_offer',
      status: 'active',
      rosterSlotStatus: 'active',
      contingencyGroupId: null,
    });
    expect(reservedCap(r.kernel.world.market, NF.org, 2027)).toBe(100_000);
    // Nothing is signed yet: no roster change, no contract.
    expect(
      activeRightsFor(
        r.kernel.world.roster,
        entityId(NF_ASHBY_PLAYER),
        r.kernel.world.simDate,
      ),
    ).toHaveLength(0);
  });

  it('refuses illegal terms and a proposal that does not authorize them', () => {
    const r = fresh();
    const tooShort = sendOffer(r, NF.org, NF.gm, NF_ASHBY_PLAYER, {
      terms: { base: 5_000 },
    });
    expect(messageOf(tooShort.res)).toContain('minimum');
    const mismatch = sendOffer(
      r,
      NF.org,
      NF.gm,
      NF_ASHBY_PLAYER,
      {
        terms: FLAT,
      },
      { roleCommitment: 'depth' },
    );
    expect(messageOf(mismatch.res)).toContain('does not authorize');
    expect(r.kernel.world.market.contractOffers).toHaveLength(0);
    expect(r.kernel.world.market.reservations).toHaveLength(0);
  });

  it('allows one live offer per club and player; a revision supersedes the old one', () => {
    const r = fresh();
    okResult(sendOffer(r, NF.org, NF.gm, NF_ASHBY_PLAYER, { terms: FLAT }).res);
    const dup = sendOffer(r, NF.org, NF.gm, NF_ASHBY_PLAYER, { terms: FRONT });
    expect(messageOf(dup.res)).toContain('revise it instead');
    const first = latestOfferOf(r, NF.org, NF_ASHBY_PLAYER);
    okResult(
      sendOffer(r, NF.org, NF.gm, NF_ASHBY_PLAYER, {
        terms: FRONT,
        supersedes: first.id,
      }).res,
    );
    const all = offersOf(r, NF.org, NF_ASHBY_PLAYER);
    expect(all.map((o) => [o.revision, o.status])).toEqual([
      [1, 'superseded'],
      [2, 'communicated'],
    ]);
    // The old reservation is released; only the new one holds room.
    expect(
      r.kernel.world.market.reservations.map((x) => x.status).sort(),
    ).toEqual(['active', 'released']);
  });

  it('can withdraw a live offer, releasing its room', () => {
    const r = fresh();
    okResult(sendOffer(r, NF.org, NF.gm, NF_ASHBY_PLAYER).res);
    const offer = latestOfferOf(r, NF.org, NF_ASHBY_PLAYER);
    expect(
      codeOf(
        r.run({
          type: 'WithdrawContractOffer',
          actingPersonId: SP.gm,
          offerId: offer.id,
          offerRevision: 1,
        }),
      ),
    ).toBe('INSUFFICIENT_AUTHORITY');
    okResult(
      r.run({
        type: 'WithdrawContractOffer',
        actingPersonId: NF.gm,
        offerId: offer.id,
        offerRevision: 1,
      }),
    );
    expect(latestOfferOf(r, NF.org, NF_ASHBY_PLAYER).status).toBe('withdrawn');
    expect(reservedCap(r.kernel.world.market, NF.org, 2027)).toBe(0);
    expect(messageOf(resolveMarket(r))).toContain('no live contract offer');
  });
});

describe('resolving and committing a signing', () => {
  it('a player who finds his requirements met accepts; the club then commits', () => {
    const r = accepted();
    const offer = latestOfferOf(r, NF.org, NF_ASHBY_PLAYER);
    expect(offer.status).toBe('accepted_pending_commit');
    expect(offer.communicated).toEqual(['interested']);
    // The club has told the agent nothing of the player's reasons.
    expect(JSON.stringify(offer)).not.toContain('requirement');
    const before = r.kernel.world.contracts.agreements.length;
    const res = okResult(commitSigning(r, NF.gm, offer));
    expect(res.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['ContractSigned']),
    );
    const w = r.kernel.world;
    expect(w.contracts.agreements).toHaveLength(before + 1);
    const agreement = w.contracts.agreements.find(
      (a) => a.sourceOfferId === offer.id,
    )!;
    expect(agreement).toMatchObject({
      organizationId: NF.org,
      status: 'active',
      supersedesAgreementId: null,
    });
    expect(
      activeRightsFor(w.roster, entityId(NF_ASHBY_PLAYER), w.simDate)[0],
    ).toMatchObject({ holderOrganizationId: NF.org, kind: 'contract' });
    expect(rosterCapacity(w.roster, TX, NF.org, w.simDate).active.count).toBe(
      4,
    );
    expect(capPosition(TX, w.contracts, NF.org, 2027).committed).toBe(
      1_085_000 + 100_000,
    );
    expect(latestOfferOf(r, NF.org, NF_ASHBY_PLAYER).status).toBe('committed');
    expect(w.market.reservations[0]!.status).toBe('consumed');
    expect(rosterInvariantFindings(w.roster, TX, w.simDate)).toEqual([]);
    // A second commit of the same offer is refused.
    expect(
      messageOf(
        commitSigning(r, NF.gm, latestOfferOf(r, NF.org, NF_ASHBY_PLAYER)),
      ),
    ).toContain('already been committed');
  });

  it('a short offer draws a counter that names only the unmet side, and nothing is signed', () => {
    const r = fresh();
    // fa-01 wants role opportunity: a depth role fails exactly that requirement.
    okResult(
      sendOffer(r, NF.org, NF.gm, NF_ASHBY_PLAYER, {
        terms: FLAT,
        role: 'depth',
      }).res,
    );
    okResult(resolveMarket(r));
    const offer = latestOfferOf(r, NF.org, NF_ASHBY_PLAYER);
    expect(offer.status).toBe('countered');
    expect(offer.communicated).toEqual(['wants_more_role']);
    expect(reservedCap(r.kernel.world.market, NF.org, 2027)).toBe(0);
    expect(messageOf(commitSigning(r, NF.gm, offer))).toContain('not accepted');
    // No-deal: resolving again with nothing live changes nothing.
    const before = snapshotOf(r.kernel);
    expect(codeOf(resolveMarket(r))).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('a club can answer a counter with a better revision, which is then accepted', () => {
    const r = fresh();
    okResult(
      sendOffer(r, NF.org, NF.gm, NF_ASHBY_PLAYER, {
        terms: FLAT,
        role: 'depth',
      }).res,
    );
    okResult(resolveMarket(r));
    const countered = latestOfferOf(r, NF.org, NF_ASHBY_PLAYER);
    okResult(
      sendOffer(r, NF.org, NF.gm, NF_ASHBY_PLAYER, {
        terms: FLAT,
        role: 'starter',
        supersedes: countered.id,
      }).res,
    );
    okResult(resolveMarket(r));
    expect(latestOfferOf(r, NF.org, NF_ASHBY_PLAYER).status).toBe(
      'accepted_pending_commit',
    );
    expect(offersOf(r, NF.org, NF_ASHBY_PLAYER)[0]!.status).toBe('superseded');
  });

  it('an unapproved proposal blocks the signing atomically', () => {
    const r = fresh();
    okResult(
      sendOffer(r, NF.org, NF.gm, NF_ASHBY_PLAYER, {
        terms: FLAT,
        approvers: [NF.owner],
      }).res,
    );
    okResult(resolveMarket(r));
    const offer = latestOfferOf(r, NF.org, NF_ASHBY_PLAYER);
    const before = snapshotOf(r.kernel);
    expect(commitSigning(r, NF.gm, offer).ok).toBe(false);
    expect(snapshotOf(r.kernel)).toEqual(before);
    okResult(
      r.run({
        type: 'ApproveProposal',
        actingPersonId: NF.owner,
        proposalId: offer.organizationProposalId,
        expectedRevision: 1,
      }),
    );
    okResult(commitSigning(r, NF.gm, offer));
  });

  it('a crash before commit leaves the world untouched', () => {
    let armed = false;
    const r = runnerFor(
      newPackageCKernel({
        beforeCommit: () => {
          if (armed) throw new Error('boom');
        },
      }),
    );
    openMarket(r);
    okResult(sendOffer(r, NF.org, NF.gm, NF_ASHBY_PLAYER, { terms: FLAT }).res);
    okResult(resolveMarket(r));
    const offer = latestOfferOf(r, NF.org, NF_ASHBY_PLAYER);
    const before = snapshotOf(r.kernel);
    armed = true;
    expect(codeOf(commitSigning(r, NF.gm, offer))).toBe('INTERNAL_ERROR');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('revoked authority stops the signing', () => {
    const r = accepted();
    const grant = r.kernel.world.authority.grants.find(
      (g) =>
        g.personId === NF.gm &&
        g.category === 'contract' &&
        g.rights.includes('execute'),
    );
    if (grant === undefined) throw new Error('no GM contract grant in seed');
    okResult(
      r.run({
        type: 'RevokeAuthority',
        actingPersonId: NF.owner,
        grantId: grant.id,
      }),
    );
    const offer = latestOfferOf(r, NF.org, NF_ASHBY_PLAYER);
    const before = snapshotOf(r.kernel);
    expect(commitSigning(r, NF.gm, offer).ok).toBe(false);
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('an offer that lapses can no longer be committed or resolved', () => {
    const r = accepted();
    okResult(r.run({ type: 'AdvanceDays', days: 8 }));
    const offer = latestOfferOf(r, NF.org, NF_ASHBY_PLAYER);
    expect(messageOf(commitSigning(r, NF.gm, offer))).toContain('expired');
    okResult(resolveMarket(r));
    expect(latestOfferOf(r, NF.org, NF_ASHBY_PLAYER).status).toBe('expired');
    expect(reservedCap(r.kernel.world.market, NF.org, 2027)).toBe(0);
  });

  it('reservations stop a second offer from spending room already held', () => {
    // Cap leaves room for exactly one 100,000 charge in 2027.
    const r = runnerFor(
      newCapKernel((season, cap) =>
        season === 2027 ? 1_085_000 + 150_000 : cap,
      ),
    );
    openMarket(r);
    okResult(sendOffer(r, NF.org, NF.gm, NF_ASHBY_PLAYER, { terms: FLAT }).res);
    okResult(resolveMarket(r));
    // A second, independent commitment (a waiver claim) spends the room first.
    const second = sendOffer(r, NF.org, NF.gm, 'player-fa-03', {
      terms: SECURE,
      role: 'rotation',
    });
    expect(messageOf(second.res)).toContain('cap');
  });

  it('a signing can target the practice squad and honours its limit', () => {
    const r = fresh();
    const players = [
      'player-fa-01',
      'player-fa-02',
      'player-fa-03',
      'player-fa-04',
    ];
    const results = players.map((p) =>
      sendOffer(r, NF.org, NF.gm, p, {
        target: 'practice_squad',
        role: 'developmental',
        terms: { base: 40_000, years: 1 },
      }),
    );
    // Practice squad: 1 of 4 used, so three more fit and the fourth does not.
    expect(results.slice(0, 3).every((x) => x.res.ok)).toBe(true);
    expect(messageOf(results[3]!.res)).toContain('roster capacity');
    expect(
      r.kernel.world.market.reservations.every(
        (x) => x.rosterSlotStatus === 'practice_squad',
      ),
    ).toBe(true);
  });
});

describe('extensions reuse the same path', () => {
  it('extends a rostered player, superseding his contract without a roster change', () => {
    const r = fresh();
    const w0 = r.kernel.world;
    const oldAgreement = w0.contracts.agreements.find(
      (a) => a.playerId === 'player-nf-01' && a.status === 'active',
    )!;
    const members = rosterCapacity(w0.roster, TX, NF.org, w0.simDate).active
      .count;
    okResult(
      sendOffer(r, NF.org, NF.gm, 'player-nf-01', {
        terms: SECURE,
        role: 'rotation',
        target: 'active',
      }).res,
    );
    const offer = latestOfferOf(r, NF.org, 'player-nf-01');
    expect(offer.extension).toBe(true);
    // An extension holds cap for the increase only and needs no new roster slot.
    expect(r.kernel.world.market.reservations[0]!.rosterSlotStatus).toBeNull();
    okResult(resolveMarket(r));
    expect(latestOfferOf(r, NF.org, 'player-nf-01').status).toBe(
      'accepted_pending_commit',
    );
    okResult(commitSigning(r, NF.gm, latestOfferOf(r, NF.org, 'player-nf-01')));
    const w = r.kernel.world;
    expect(
      w.contracts.agreements.find((a) => a.id === oldAgreement.id)!.status,
    ).toBe('superseded');
    expect(
      w.contracts.agreements.find(
        (a) => a.supersedesAgreementId === oldAgreement.id,
      ),
    ).toBeDefined();
    expect(rosterCapacity(w.roster, TX, NF.org, w.simDate).active.count).toBe(
      members,
    );
    expect(rosterInvariantFindings(w.roster, TX, w.simDate)).toEqual([]);
  });

  it('refuses to extend a player who is not on the club’s roster', () => {
    const r = fresh();
    const res = sendOffer(r, SP.org, SP.gm, 'player-nf-01');
    expect(codeOf(res.res)).toBe('INVALID_PAYLOAD');
  });
});

describe('persistence', () => {
  it('survives a save and reload with offers, reservations and responses intact', () => {
    const r = accepted();
    const copy = JSON.parse(JSON.stringify(r.kernel.world));
    expect(fingerprintWorld(copy)).toBe(fingerprintWorld(r.kernel.world));
    const offer: ContractOfferRecord = copy.market.contractOffers[0];
    expect(offer.status).toBe('accepted_pending_commit');
    expect(
      copy.market.responses.some(
        (x: { kind: string }) => x.kind === 'contract_response',
      ),
    ).toBe(true);
  });
});
