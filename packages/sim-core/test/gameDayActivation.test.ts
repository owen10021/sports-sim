import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  WorldKernel,
  fingerprintWorld,
  gameDayProblems,
  parseGameDayTerms,
  type FootballWorld,
} from '../src/index';
import {
  E_FIXTURE_1,
  E_PREGAME,
  NF,
  NF_COACH,
  SP,
  active,
  activationTerms,
  commitActivation,
  eRunner,
  eWorld,
  inactive,
  newPackageEKernel,
  nf,
  sp,
  submitActivation,
} from './support/packageEHarness';
import {
  codeOf,
  messageOf,
  okResult,
  runnerFor,
  snapshotOf,
  type Runner,
} from './support/orgHarness';

const rules = SYNTHETIC_PACKAGE_E_RULESET.rules.football!;

/** A small valid Northfield lineup: a quarterback, a back, two receivers and a benched QB. */
const lineup = () => [
  active(nf(1), 'offense', 'quarterback'),
  active(nf(3), 'offense', 'running_back'),
  active(nf(5), 'offense', 'wide_receiver', 1),
  active(nf(6), 'offense', 'wide_receiver', 2),
  inactive(nf(2)),
];

const commit = (r: Runner, designations = lineup()) => {
  const id = submitActivation(r, activationTerms(designations));
  return { id, res: r.run(commitActivation(id)) };
};

/** A runner whose world is mutated before genesis (only for state no command can create). */
const mutated = (mutate: (w: FootballWorld) => FootballWorld): Runner =>
  runnerFor(
    WorldKernel.fromGenesis(mutate(eWorld()), SYNTHETIC_PACKAGE_E_RULESET),
  );

describe('game-day activation: roster-truth separation', () => {
  it('commits active and inactive designations without touching Package C truth', () => {
    const r = eRunner();
    const before = r.kernel.world;
    const { res } = commit(r);
    const ok = okResult(res);
    const after = r.kernel.world;

    expect(after.roster).toEqual(before.roster);
    expect(after.contracts).toEqual(before.contracts);
    expect(after.medical).toEqual(before.medical);
    expect(after.development).toEqual(before.development);
    expect(after.rng).toEqual(before.rng);

    expect(after.football.designations).toHaveLength(5);
    const byPlayer = new Map(
      after.football.designations.map((d) => [d.playerId, d]),
    );
    expect(byPlayer.get(nf(1) as never)).toMatchObject({
      fixtureId: E_FIXTURE_1,
      organizationId: NF.org,
      status: 'active',
      unitKey: 'offense',
      roleKey: 'quarterback',
      depthOrder: 1,
      committedAt: E_PREGAME,
    });
    expect(byPlayer.get(nf(2) as never)).toMatchObject({
      status: 'inactive',
      unitKey: null,
      roleKey: null,
      depthOrder: null,
    });
    const proposalId = after.decisions.proposals.at(-1)!.id;
    for (const d of after.football.designations)
      expect(d.sourceProposalId).toBe(proposalId);
    expect(ok.events.map((e) => e.type)).toContain(
      'GameDayActivationCommitted',
    );
    expect(after.decisions.receipts.at(-1)!.proposalId).toBe(proposalId);
  });

  it('is deterministic: the same commands give the same world fingerprint', () => {
    const a = eRunner();
    const b = eRunner();
    okResult(commit(a).res);
    okResult(commit(b).res);
    expect(fingerprintWorld(a.kernel.world)).toBe(
      fingerprintWorld(b.kernel.world),
    );
  });

  it('allows one player in more than one unit (defense and returning)', () => {
    const r = eRunner();
    okResult(
      commit(r, [
        active(nf(27), 'defense', 'cornerback'),
        active(nf(27), 'returning', 'cornerback'),
      ]).res,
    );
    expect(r.kernel.world.football.designations).toHaveLength(2);
  });
});

describe('game-day activation: eligibility fails before any change', () => {
  const rejected = (
    designations: ReturnType<typeof lineup>,
    contains: string,
    runner: Runner = eRunner(),
  ) => {
    const id = submitActivation(runner, activationTerms(designations));
    const before = snapshotOf(runner.kernel);
    const res = runner.run(commitActivation(id));
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain(contains);
    expect(snapshotOf(runner.kernel)).toEqual(before);
  };

  it('rejects a player from the wrong organization', () => {
    rejected([active(sp(1), 'offense', 'quarterback')], 'not rostered');
  });

  it('rejects a person who is not a rostered player', () => {
    rejected(
      [active('person-nf-owner', 'offense', 'quarterback')],
      'not rostered',
    );
  });

  it('rejects the same player twice in one unit, and active plus inactive', () => {
    rejected(
      [
        active(nf(1), 'offense', 'quarterback', 1),
        active(nf(1), 'offense', 'quarterback', 2),
      ],
      'designated twice',
    );
    rejected(
      [active(nf(1), 'offense', 'quarterback'), inactive(nf(1))],
      'already designated',
    );
  });

  it('rejects two players at the same unit, role and depth', () => {
    rejected(
      [
        active(nf(5), 'offense', 'wide_receiver', 1),
        active(nf(6), 'offense', 'wide_receiver', 1),
      ],
      'more than once',
    );
  });

  it('rejects a player who already has a designation for the fixture', () => {
    const r = eRunner();
    okResult(commit(r).res);
    rejected([inactive(nf(1))], 'already designated', r);
    const again = submitActivation(
      r,
      activationTerms([active(nf(1), 'offense', 'quarterback', 3)]),
    );
    const before = snapshotOf(r.kernel);
    const res = r.run(commitActivation(again));
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects an unknown unit and a role that unit does not field', () => {
    rejected(
      [active(nf(1), 'nonsense_unit', 'quarterback')],
      'not a football unit',
    );
    rejected([active(nf(33), 'offense', 'kicker')], 'not fielded by unit');
  });

  it('rejects a fixture that is already final, or unknown', () => {
    const final = mutated((w) => ({
      ...w,
      football: {
        ...w.football,
        fixtures: w.football.fixtures.map((f) =>
          f.id === E_FIXTURE_1 ? { ...f, status: 'final' as const } : f,
        ),
      },
    }));
    rejected(lineup(), 'already final', final);

    const r = eRunner();
    const id = submitActivation(
      r,
      activationTerms(lineup(), 'fixture-does-not-exist'),
    );
    const before = snapshotOf(r.kernel);
    const res = r.run(commitActivation(id));
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('fixture');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('rejects an active designation for a non-active roster status, allows inactive', () => {
    const reserve = () =>
      mutated((w) => ({
        ...w,
        roster: {
          ...w.roster,
          memberships: w.roster.memberships.map((m) =>
            m.playerId === nf(2) ? { ...m, status: 'reserve' as const } : m,
          ),
        },
      }));
    rejected(
      [active(nf(2), 'offense', 'quarterback', 2)],
      'not on the active roster',
      reserve(),
    );
    okResult(commit(reserve(), [inactive(nf(2))]).res);
  });

  it('rejects malformed terms (extra key, bad depth, inactive with a unit)', () => {
    const r = eRunner();
    const bads: Record<string, unknown>[] = [
      { ...activationTerms(lineup()), extra: 1 },
      activationTerms([]),
      activationTerms([active(nf(1), 'offense', 'quarterback', 0)]),
      activationTerms([{ ...inactive(nf(1)), unitKey: 'offense' } as never]),
      activationTerms([
        { ...active(nf(1), 'offense', 'quarterback'), x: 1 } as never,
      ]),
    ];
    for (const terms of bads) {
      const id = submitActivation(r, terms);
      const before = snapshotOf(r.kernel);
      const res = r.run(commitActivation(id));
      expect(codeOf(res)).toBe('INVALID_PAYLOAD');
      expect(snapshotOf(r.kernel)).toEqual(before);
    }
  });
});

describe('game-day activation: medical cap', () => {
  const sideline = (r: Runner, playerId: string) => {
    okResult(
      r.run({
        type: 'CreateMedicalEpisode',
        playerId,
        conditionKey: 'synthetic_knee',
        onsetAt: E_PREGAME,
        sourceKind: 'synthetic_test',
        affectedActionKeys: ['burst'],
        initialStructuralSeverityBp: 6500,
        recoveryResponsivenessBp: 8500,
        baselineReinjuryRiskBp: 8000,
      }),
    );
    const episodeId = r.kernel.world.medical.episodes.at(-1)!.id;
    okResult(
      r.run({
        type: 'SubmitProposal',
        organizationId: NF.org,
        actingPersonId: NF.owner,
        category: 'medical_clearance',
        subjects: [{ kind: 'entity', id: playerId }],
        termsType: 'medical_clearance_v1',
        terms: {
          episodeId,
          playerId,
          participation: 'out',
          maxLoadUnits: 0,
        },
        requiredApproverPersonIds: [],
        expiresAt: null,
        contingencies: {},
      }),
    );
    okResult(
      r.run({
        type: 'CommitMedicalClearanceProposal',
        proposalId: r.kernel.world.decisions.proposals.at(-1)!.id,
        actingPersonId: NF.owner,
        expectedRevision: 1,
        beliefIds: [],
        evidenceClaimIds: [],
        rationale: { note: 'out for the game' },
      }),
    );
  };

  it('does not let a player with a hard medical cap of 0 be designated active', () => {
    const r = eRunner();
    sideline(r, nf(1));
    const id = submitActivation(
      r,
      activationTerms([active(nf(1), 'offense', 'quarterback')]),
    );
    const before = snapshotOf(r.kernel);
    const res = r.run(commitActivation(id));
    expect(codeOf(res)).toBe('INVALID_PAYLOAD');
    expect(messageOf(res)).toContain('hard medical cap of 0');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('lets the same player be designated inactive, and never edits the medical record', () => {
    const r = eRunner();
    sideline(r, nf(1));
    const medicalBefore = r.kernel.world.medical;
    okResult(
      commit(r, [inactive(nf(1)), active(nf(2), 'offense', 'quarterback')]).res,
    );
    expect(r.kernel.world.medical).toEqual(medicalBefore);
  });
});

describe('gameDayProblems: pure checks', () => {
  it('rejects more active players than the ruleset game-day limit', () => {
    const w = eWorld();
    const fixture = w.football.fixtures[0]!;
    const tight = {
      ...rules,
      substitution: { ...rules.substitution, maxActiveGameDayPlayers: 2 },
    };
    const parsed = parseGameDayTerms(
      activationTerms([
        active(nf(5), 'offense', 'wide_receiver', 1),
        active(nf(6), 'offense', 'wide_receiver', 2),
        active(nf(7), 'offense', 'wide_receiver', 3),
      ]),
    );
    if (typeof parsed === 'string') throw new Error(parsed);
    const problems = gameDayProblems(
      w,
      tight,
      fixture,
      NF.org,
      parsed.designations,
    );
    expect(problems.join(';')).toContain('exceed the game-day limit of 2');
    expect(
      gameDayProblems(w, rules, fixture, NF.org, parsed.designations),
    ).toEqual([]);
  });

  it('reads the world without changing it', () => {
    const w = eWorld();
    const fp = fingerprintWorld(w);
    const parsed = parseGameDayTerms(activationTerms(lineup()));
    if (typeof parsed === 'string') throw new Error(parsed);
    gameDayProblems(
      w,
      rules,
      w.football.fixtures[0]!,
      NF.org,
      parsed.designations,
    );
    expect(fingerprintWorld(w)).toBe(fp);
  });

  it('keeps the harness coach as the executing identity', () => {
    expect(NF_COACH).toBe('person-nf-coach-e');
    expect(newPackageEKernel().world.football.fixtures).toHaveLength(2);
    expect(SP.org).toBe('org-southport');
  });
});
