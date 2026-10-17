import { describe, expect, it } from 'vitest';
import {
  entityId,
  fingerprintWorld,
  recordId,
  reservedCap,
  type ContractOfferRecord,
  type FootballWorld,
  type Reservation,
} from '../src/index';
import {
  FLAT,
  FRONT,
  NF,
  SECURE,
  SP,
  agentOf,
  commitSigning,
  latestOfferOf,
  openMarket,
  resolveMarket,
  sendOffer,
  terms,
} from './support/freeAgencyHarness';
import {
  newCapKernel,
  newKernelWith,
  newPackageCKernel,
} from './support/packageCHarness';
import { messageOf, okResult, runnerFor } from './support/orgHarness';

const fresh = () => {
  const r = runnerFor(newPackageCKernel());
  openMarket(r);
  return r;
};

describe('rival clubs bidding for one player', () => {
  it('the player takes the offer that fits him; the others are told only that they were not selected', () => {
    const r = fresh();
    // fa-01 cares first about role, then cash timing. Northfield pays more in total.
    okResult(
      sendOffer(r, NF.org, NF.gm, 'player-fa-01', { terms: { base: 150_000 } })
        .res,
    );
    okResult(sendOffer(r, SP.org, SP.gm, 'player-fa-01', { terms: FRONT }).res);
    okResult(resolveMarket(r));
    expect(latestOfferOf(r, SP.org, 'player-fa-01')).toMatchObject({
      status: 'accepted_pending_commit',
      communicated: ['interested'],
    });
    expect(latestOfferOf(r, NF.org, 'player-fa-01')).toMatchObject({
      status: 'rejected',
      communicated: ['not_selected'],
    });
    // The loser's room is free again; the winner's stays held until the club commits.
    expect(reservedCap(r.kernel.world.market, NF.org, 2027)).toBe(0);
    expect(reservedCap(r.kernel.world.market, SP.org, 2027)).toBeGreaterThan(0);
    okResult(commitSigning(r, SP.gm, latestOfferOf(r, SP.org, 'player-fa-01')));
    expect(
      messageOf(
        commitSigning(r, NF.gm, latestOfferOf(r, NF.org, 'player-fa-01')),
      ),
    ).toContain('not accepted');
  });
});

describe('contingency groups: fallback chains', () => {
  it('a club’s fallback is used only when the first choice goes elsewhere', () => {
    const r = fresh();
    okResult(
      sendOffer(r, NF.org, NF.gm, 'player-fa-01', {
        terms: { base: 150_000 },
        priority: 0,
        group: 'plan-a',
      }).res,
    );
    okResult(
      sendOffer(r, NF.org, NF.gm, 'player-fa-02', {
        terms: FLAT,
        priority: 1,
        group: 'plan-a',
      }).res,
    );
    // fa-01 has a better-fitting offer from Southport.
    okResult(sendOffer(r, SP.org, SP.gm, 'player-fa-01', { terms: FRONT }).res);
    okResult(resolveMarket(r));
    expect(latestOfferOf(r, NF.org, 'player-fa-01').status).toBe('rejected');
    expect(latestOfferOf(r, NF.org, 'player-fa-02').status).toBe(
      'accepted_pending_commit',
    );
    expect(latestOfferOf(r, SP.org, 'player-fa-01').status).toBe(
      'accepted_pending_commit',
    );
  });

  it('a filled group withdraws the club’s other alternatives', () => {
    const r = fresh();
    okResult(
      sendOffer(r, NF.org, NF.gm, 'player-fa-01', {
        terms: FLAT,
        priority: 0,
        group: 'plan-a',
      }).res,
    );
    okResult(
      sendOffer(r, NF.org, NF.gm, 'player-fa-02', {
        terms: FLAT,
        priority: 1,
        group: 'plan-a',
      }).res,
    );
    okResult(resolveMarket(r));
    expect(latestOfferOf(r, NF.org, 'player-fa-01').status).toBe(
      'accepted_pending_commit',
    );
    expect(latestOfferOf(r, NF.org, 'player-fa-02')).toMatchObject({
      status: 'withdrawn',
      communicated: ['club_withdrew'],
    });
    okResult(commitSigning(r, NF.gm, latestOfferOf(r, NF.org, 'player-fa-01')));
    expect(
      r.kernel.world.contracts.agreements.filter(
        (a) => a.sourceOfferId !== null,
      ),
    ).toHaveLength(1);
  });

  it('alternatives hold only the largest of their reservations; unrelated offers hold their sum', () => {
    const r = runnerFor(
      newCapKernel((season, cap) =>
        season === 2027 ? 1_085_000 + 150_000 : cap,
      ),
    );
    openMarket(r);
    okResult(
      sendOffer(r, NF.org, NF.gm, 'player-fa-01', {
        terms: { base: 100_000 },
        group: 'g',
      }).res,
    );
    okResult(
      sendOffer(r, NF.org, NF.gm, 'player-fa-02', {
        terms: { base: 120_000 },
        group: 'g',
      }).res,
    );
    expect(reservedCap(r.kernel.world.market, NF.org, 2027)).toBe(120_000);
    // A third, independent offer would overcommit the 150,000 of room.
    const third = sendOffer(r, NF.org, NF.gm, 'player-fa-03', {
      terms: { base: 100_000, guaranteed: 100_000 },
      role: 'rotation',
    });
    expect(messageOf(third.res)).toContain('cap');
    expect(reservedCap(r.kernel.world.market, NF.org, 2027)).toBe(120_000);
  });
});

// --- order independence --------------------------------------------------------

type Spec = {
  org: typeof NF.org;
  orgDigit: number;
  gm: string;
  player: string;
  playerDigit: number;
  priority: number;
  group: string | null;
  terms: Parameters<typeof terms>[0];
  role: 'starter' | 'rotation';
};

const SPECS: Spec[] = [
  {
    org: NF.org,
    orgDigit: 1,
    gm: NF.gm,
    player: 'player-fa-01',
    playerDigit: 1,
    priority: 2,
    group: null,
    terms: FLAT,
    role: 'starter',
  },
  {
    org: NF.org,
    orgDigit: 1,
    gm: NF.gm,
    player: 'player-fa-02',
    playerDigit: 2,
    priority: 0,
    group: null,
    terms: FLAT,
    role: 'starter',
  },
  {
    org: NF.org,
    orgDigit: 1,
    gm: NF.gm,
    player: 'player-fa-03',
    playerDigit: 3,
    priority: 1,
    group: null,
    terms: SECURE,
    role: 'rotation',
  },
  {
    org: SP.org,
    orgDigit: 2,
    gm: SP.gm,
    player: 'player-fa-01',
    playerDigit: 1,
    priority: 0,
    group: null,
    terms: FLAT,
    role: 'starter',
  },
  {
    org: SP.org,
    orgDigit: 2,
    gm: SP.gm,
    player: 'player-fa-03',
    playerDigit: 3,
    priority: 1,
    group: 'g',
    terms: SECURE,
    role: 'rotation',
  },
  {
    org: SP.org,
    orgDigit: 2,
    gm: SP.gm,
    player: 'player-fa-02',
    playerDigit: 2,
    priority: 2,
    group: 'g',
    terms: FLAT,
    role: 'starter',
  },
];

/** Offers and reservations laid straight into a world, with ids derived from content only. */
const inject =
  (order: readonly number[]) =>
  (w: FootballWorld): FootballWorld => {
    const offers: ContractOfferRecord[] = [];
    const reservations: Reservation[] = [];
    for (const i of order) {
      const s = SPECS[i]!;
      const offerId = recordId(`rec-9${s.orgDigit}${s.playerDigit}100`);
      const reservationId = recordId(`rec-9${s.orgDigit}${s.playerDigit}200`);
      const t = terms(s.terms);
      offers.push({
        id: offerId,
        revision: 1,
        organizationId: s.org,
        playerId: entityId(s.player),
        agentPersonId: entityId(
          w.market.agentClients.find((a) => a.playerPersonId === s.player)!
            .agentPersonId,
        ),
        submittedBy: entityId(s.gm),
        organizationProposalId: recordId('rec-900001'),
        terms: t,
        roleCommitment: s.role,
        targetRosterStatus: 'active',
        extension: false,
        contingencyGroupId: s.group,
        priority: s.priority,
        submittedAt: '2027-03-10',
        expiresAt: '2027-04-01',
        status: 'communicated',
        supersedesRevision: null,
        reservationId,
        communicated: [],
      });
      reservations.push({
        id: reservationId,
        organizationId: s.org,
        sourceKind: 'contract_offer',
        sourceRecordId: offerId,
        capBySeason: t.years.map((y) => ({
          season: y.season,
          amount: y.baseSalary,
        })),
        rosterSlotStatus: 'active',
        contingencyGroupId: s.group,
        createdAt: '2027-03-10',
        status: 'active',
      });
    }
    return {
      ...w,
      simDate: '2027-03-10' as typeof w.simDate,
      // Northfield carries 800,000 of dead cap, so it can afford exactly one more contract.
      contracts: {
        ...w.contracts,
        terminations: [
          ...w.contracts.terminations,
          {
            id: recordId('rec-900009'),
            agreementId: w.contracts.agreements[0]!.id,
            organizationId: NF.org,
            playerId: entityId('player-nf-01'),
            terminatedAt: '2027-01-02',
            reason: 'release',
            deadCapBySeason: [{ season: 2027, amount: 800_000 as never }],
            guaranteedCashDue: 0 as never,
          },
        ],
      },
      market: { ...w.market, contractOffers: offers, reservations },
    };
  };

const resolved = (order: readonly number[]) => {
  const kernel = newKernelWith(inject(order));
  const r = runnerFor(kernel);
  okResult(resolveMarket(r));
  return { r, kernel };
};

describe('concurrent resolution does not depend on the order offers arrived in', () => {
  const identity = [0, 1, 2, 3, 4, 5];
  const base = resolved(identity);

  it('resolves by club priority, player preference and cap, not by arrival', () => {
    const status = (org: string, player: string) =>
      base.kernel.world.market.contractOffers.find(
        (o) => o.organizationId === org && o.playerId === player,
      )!.status;
    // Northfield can afford one contract: its priority-0 choice, fa-02.
    expect(status(NF.org, 'player-fa-02')).toBe('accepted_pending_commit');
    expect(status(NF.org, 'player-fa-01')).toBe('withdrawn');
    expect(status(NF.org, 'player-fa-03')).toBe('withdrawn');
    // The turned-away players move on to Southport.
    expect(status(SP.org, 'player-fa-01')).toBe('accepted_pending_commit');
    expect(agentOf(base.r, 'player-fa-01')).toBe('person-agent-ashby');
  });

  const orders = [
    [5, 4, 3, 2, 1, 0],
    [1, 2, 3, 4, 5, 0],
    [3, 4, 5, 0, 1, 2],
    [2, 5, 0, 3, 1, 4],
    [4, 0, 5, 1, 3, 2],
  ];
  for (const order of orders)
    it(`gives an identical world for submission order ${order.join('')}`, () => {
      const other = resolved(order);
      expect(fingerprintWorld(other.kernel.world)).toBe(
        fingerprintWorld(base.kernel.world),
      );
      expect(other.kernel.chainHead).toBe(base.kernel.chainHead);
      expect(other.kernel.world.rng.draws).toBe(base.kernel.world.rng.draws);
      expect(other.kernel.world.market.responses).toEqual(
        base.kernel.world.market.responses,
      );
    });
});
