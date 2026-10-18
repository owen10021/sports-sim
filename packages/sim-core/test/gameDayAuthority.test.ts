import { describe, expect, it } from 'vitest';
import {
  E_FIXTURE_1,
  NF,
  NF_COACH,
  SP,
  SP_COACH,
  active,
  activationTerms,
  commitActivation,
  eRunner,
  inactive,
  nf,
  sp,
  submitActivation,
} from './support/packageEHarness';
import { codeOf, messageOf, okResult, snapshotOf } from './support/orgHarness';

const lineup = () => [
  active(nf(1), 'offense', 'quarterback'),
  active(nf(3), 'offense', 'running_back'),
  inactive(nf(2)),
];

describe('game-day activation authority', () => {
  it('gives the GM identity no implicit activation authority', () => {
    for (const kind of [
      'human_gm',
      'commissioner',
      'system',
      'test_harness',
    ] as const) {
      const r = eRunner();
      const id = submitActivation(r, activationTerms(lineup()));
      const before = snapshotOf(r.kernel);
      const res = r.run(commitActivation(id, NF.gm), kind);
      expect(codeOf(res)).toBe('INSUFFICIENT_AUTHORITY');
      expect(messageOf(res)).toContain('execute');
      expect(snapshotOf(r.kernel)).toEqual(before);
      expect(r.kernel.world.football.designations).toHaveLength(0);
    }
  });

  it('lets a person with execute commit regardless of the actor kind', () => {
    const results = (
      ['human_gm', 'commissioner', 'system', 'test_harness'] as const
    ).map((kind) => {
      const r = eRunner();
      const id = submitActivation(r, activationTerms(lineup()));
      okResult(r.run(commitActivation(id, NF_COACH), kind));
      return r.kernel.world.football.designations.map((d) => d.playerId);
    });
    for (const ids of results) expect(ids).toEqual(results[0]);
  });

  it('does not let the other club coach commit this club designation', () => {
    const r = eRunner();
    const id = submitActivation(r, activationTerms(lineup()));
    const before = snapshotOf(r.kernel);
    const res = r.run(commitActivation(id, SP_COACH));
    expect(codeOf(res)).toBe('INSUFFICIENT_AUTHORITY');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('does not let a scout (no game-day rights) propose', () => {
    const r = eRunner();
    const before = snapshotOf(r.kernel);
    const res = r.run({
      type: 'SubmitProposal',
      organizationId: NF.org,
      actingPersonId: NF.scout,
      category: 'game_day_activation',
      subjects: [{ kind: 'entity', id: NF.org }],
      termsType: 'game_day_activation_v1',
      terms: activationTerms(lineup()),
      requiredApproverPersonIds: [],
      expiresAt: null,
      contingencies: {},
    });
    expect(codeOf(res)).toBe('INSUFFICIENT_AUTHORITY');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects a stale revision atomically', () => {
    const r = eRunner();
    const id = submitActivation(r, activationTerms(lineup()));
    okResult(
      r.run({
        type: 'ReviseProposal',
        actingPersonId: NF.gm,
        proposalId: id,
        expectedRevision: 1,
        terms: activationTerms([active(nf(1), 'offense', 'quarterback')]),
      }),
    );
    const before = snapshotOf(r.kernel);
    const res = r.run(commitActivation(id, NF_COACH));
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('stale');
    expect(snapshotOf(r.kernel)).toEqual(before);

    okResult(r.run(commitActivation(id, NF_COACH, { expectedRevision: 2 })));
    expect(r.kernel.world.football.designations).toHaveLength(1);
  });

  it('binds the receipt to the exact fixture and designation terms', () => {
    const r = eRunner();
    const id = submitActivation(r, activationTerms(lineup()));
    const proposal = r.kernel.world.decisions.proposals.at(-1)!;
    okResult(r.run(commitActivation(id, NF_COACH)));
    const receipt = r.kernel.world.decisions.receipts.at(-1)!;
    expect(receipt.proposalId).toBe(id);
    expect(receipt.executedTermsHash).toBe(proposal.termsHash);
    expect(receipt.actorPersonId).toBe(NF_COACH);
    expect(proposal.terms).toMatchObject({
      fixtureId: E_FIXTURE_1,
      organizationId: NF.org,
    });
  });

  it('hashes designations independent of the order they were listed in', () => {
    const a = eRunner();
    const b = eRunner();
    submitActivation(a, activationTerms(lineup()));
    submitActivation(b, activationTerms([...lineup()].reverse()));
    expect(a.kernel.world.decisions.proposals.at(-1)!.termsHash).toBe(
      b.kernel.world.decisions.proposals.at(-1)!.termsHash,
    );
  });

  it('refuses a proposal of another category or terms type', () => {
    const r = eRunner();
    okResult(
      r.run({
        type: 'SubmitProposal',
        organizationId: NF.org,
        actingPersonId: NF.gm,
        category: 'game_day_activation',
        subjects: [{ kind: 'entity', id: NF.org }],
        termsType: 'something_else_v1',
        terms: activationTerms(lineup()),
        requiredApproverPersonIds: [],
        expiresAt: null,
        contingencies: {},
      }),
    );
    const id = r.kernel.world.decisions.proposals.at(-1)!.id;
    const before = snapshotOf(r.kernel);
    const res = r.run(commitActivation(id, NF_COACH));
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('refuses a proposal naming another organization players (cross-club designation)', () => {
    const r = eRunner();
    const id = submitActivation(
      r,
      activationTerms([active(sp(1), 'offense', 'quarterback')]),
    );
    const before = snapshotOf(r.kernel);
    const res = r.run(commitActivation(id, NF_COACH));
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(SP.org).toBe('org-southport');
  });

  it('honors a protected constraint on game-day activation', () => {
    const r = eRunner();
    okResult(
      r.run({
        type: 'CreateProtectedConstraint',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        subject: { kind: 'entity', id: NF.org },
        prohibitedChange: {
          kind: 'game_day_activation',
          fixtureId: E_FIXTURE_1,
        },
        amendableByPersonIds: [NF.owner],
      }),
    );
    const id = submitActivation(r, activationTerms(lineup()));
    const before = snapshotOf(r.kernel);
    const res = r.run(commitActivation(id, NF_COACH));
    expect(codeOf(res)).toBe('PROTECTED_CONSTRAINT');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('lets each club designate its own players for the same fixture independently', () => {
    const r = eRunner();
    const nfId = submitActivation(r, activationTerms(lineup()));
    okResult(r.run(commitActivation(nfId, NF_COACH)));
    const spId = submitActivation(
      r,
      activationTerms(
        [active(sp(1), 'offense', 'quarterback'), inactive(sp(2))],
        E_FIXTURE_1,
        SP.org,
      ),
      SP.gm,
      SP.org,
    );
    okResult(r.run(commitActivation(spId, SP_COACH)));
    expect(
      r.kernel.world.football.designations.filter(
        (d) => d.organizationId === SP.org,
      ),
    ).toHaveLength(2);
    expect(r.kernel.world.football.designations).toHaveLength(5);
  });
});
