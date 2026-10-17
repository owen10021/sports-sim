import { describe, expect, it } from 'vitest';
import {
  NF,
  SP,
  agentOf,
  latestOfferOf,
  openMarket,
  sendOffer,
} from './support/freeAgencyHarness';
import { newKernelWith, newPackageCKernel } from './support/packageCHarness';
import {
  codeOf,
  messageOf,
  okResult,
  runnerFor,
  snapshotOf,
} from './support/orgHarness';

const fresh = () => {
  const r = runnerFor(newPackageCKernel());
  openMarket(r);
  return r;
};

describe('agents and who may be offered a contract', () => {
  it('routes every offer through the player’s own persistent agent', () => {
    const r = fresh();
    expect(agentOf(r, 'player-fa-01')).toBe('person-agent-ashby');
    expect(agentOf(r, 'player-fa-02')).toBe('person-agent-brandt');
    const a = sendOffer(r, NF.org, NF.gm, 'player-fa-01');
    const b = sendOffer(r, SP.org, SP.gm, 'player-fa-01');
    okResult(a.res);
    okResult(b.res);
    // The same agent represents the player to every club, and across days.
    expect(latestOfferOf(r, NF.org, 'player-fa-01').agentPersonId).toBe(
      'person-agent-ashby',
    );
    expect(latestOfferOf(r, SP.org, 'player-fa-01').agentPersonId).toBe(
      'person-agent-ashby',
    );
    okResult(r.run({ type: 'AdvanceDays', days: 3 }));
    expect(agentOf(r, 'player-fa-01')).toBe('person-agent-ashby');
  });

  it('rejects an offer made through the wrong agent, or none, without changing anything', () => {
    const r = fresh();
    const before = snapshotOf(r.kernel);
    const wrong = sendOffer(r, NF.org, NF.gm, 'player-fa-01', {
      agent: 'person-agent-brandt',
    });
    expect(codeOf(wrong.res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(wrong.res)).toContain('person-agent-ashby');
    const none = sendOffer(r, NF.org, NF.gm, 'player-fa-01', { agent: null });
    expect(codeOf(none.res)).toBe('INVALID_PAYLOAD');
    expect(r.kernel.world.market.contractOffers).toHaveLength(0);
    expect(r.kernel.world.market.reservations).toHaveLength(0);
    expect(snapshotOf(r.kernel).draws).toBe(before.draws);
  });

  it('refuses to name an agent for an unrepresented player', () => {
    const kernel = newKernelWith((w) => ({
      ...w,
      simDate: '2027-03-10' as typeof w.simDate,
      market: {
        ...w.market,
        agentClients: w.market.agentClients.filter(
          (a) => a.playerPersonId !== 'player-fa-05',
        ),
      },
    }));
    const r = runnerFor(kernel);
    expect(agentOf(r, 'player-fa-05')).toBeNull();
    const named = sendOffer(r, NF.org, NF.gm, 'player-fa-05', {
      agent: 'person-agent-ashby',
    });
    expect(messageOf(named.res)).toContain('not represented');
    okResult(sendOffer(r, NF.org, NF.gm, 'player-fa-05', { agent: null }).res);
    expect(latestOfferOf(r, NF.org, 'player-fa-05').agentPersonId).toBeNull();
  });

  it('only the holder of a player’s rights may deal with him', () => {
    const r = fresh();
    // Under contract with Northfield.
    expect(
      messageOf(sendOffer(r, SP.org, SP.gm, 'player-nf-01').res),
    ).toContain('rights');
    // Exclusive right held by Westlake.
    expect(
      messageOf(sendOffer(r, NF.org, NF.gm, 'player-wl-exclusive').res),
    ).toContain('rights');
    // Drafted players are signed through the draft, not free agency.
    expect(
      messageOf(sendOffer(r, SP.org, SP.gm, 'player-eb-draftee').res),
    ).toContain('rights');
    expect(r.kernel.world.market.contractOffers).toHaveLength(0);
  });

  it('opens and closes with the ruleset’s free-agency window', () => {
    const early = runnerFor(newPackageCKernel());
    expect(
      messageOf(sendOffer(early, NF.org, NF.gm, 'player-fa-01').res),
    ).toContain('opens on 2027-03-10');
    const late = fresh();
    okResult(late.run({ type: 'AdvanceDays', days: 30 }));
    okResult(late.run({ type: 'AdvanceDays', days: 30 }));
    okResult(late.run({ type: 'AdvanceDays', days: 30 }));
    okResult(late.run({ type: 'AdvanceDays', days: 30 }));
    okResult(late.run({ type: 'AdvanceDays', days: 30 }));
    okResult(late.run({ type: 'AdvanceDays', days: 30 }));
    expect(
      messageOf(sendOffer(late, NF.org, NF.gm, 'player-fa-01').res),
    ).toContain('closed on');
  });

  it('needs communicate authority on contracts in the offering club', () => {
    const r = fresh();
    const res = sendOffer(
      r,
      NF.org,
      NF.gm,
      'player-fa-01',
      {},
      { actingPersonId: SP.gm },
    );
    expect(codeOf(res.res)).toBe('INSUFFICIENT_AUTHORITY');
  });
});
