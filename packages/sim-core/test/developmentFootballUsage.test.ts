import { describe, expect, it } from 'vitest';
import {
  FootballUsageError,
  PACKAGE_E_SEED,
  SYNTHETIC_PACKAGE_E_RULESET,
  applyFootballUsageEvidence,
  canonicalString,
  createWorld,
  entityId,
  footballWorkloadUnits,
  recordId,
  worldId,
  type FootballUsageEvidence,
  type FootballWorld,
} from '../src/index';

const FIXTURE = 'fixture-2027-w01-southport-at-northfield';
const GAME_DAY = '2027-09-12';
const NF = 'org-northfield';
const SP = 'org-southport';

/** The Package E world on game day: simDate is the fixture date, nothing resolved yet. */
const gameDayWorld = (): FootballWorld => {
  const w = createWorld(PACKAGE_E_SEED, SYNTHETIC_PACKAGE_E_RULESET, {
    newWorldId: () => worldId('world-usage-test'),
  });
  return { ...w, simDate: GAME_DAY };
};

const rules = SYNTHETIC_PACKAGE_E_RULESET.rules.football!;

const evidence = (
  over: Partial<
    Omit<FootballUsageEvidence, 'playerId' | 'playId' | 'organizationId'>
  > & { playerId: string; playId: string; organizationId?: string },
): FootballUsageEvidence => {
  const actionExposures = over.actionExposures ?? [
    { actionKey: 'throw_pass', attempts: 10 },
    { actionKey: 'read_progression', attempts: 10 },
  ];
  return {
    fixtureId: recordId(FIXTURE),
    occurredAt: GAME_DAY,
    workloadUnits: footballWorkloadUnits(rules, actionExposures),
    contactClass: 'none',
    responsibilityExposures: [
      {
        schemeKey: 'base_offense',
        responsibilityKey: 'progression_reads',
        meaningfulReps: 20,
      },
    ],
    actionExposures,
    ...over,
    playerId: entityId(over.playerId),
    playId: recordId(over.playId),
    organizationId: entityId(over.organizationId ?? NF),
  };
};

const qb = (playId = 'play-001') =>
  evidence({ playerId: 'player-nf-e01', playId });
const rb = (playId = 'play-001') =>
  evidence({
    playerId: 'player-nf-e03',
    playId,
    actionExposures: [{ actionKey: 'carry_ball', attempts: 6 }],
    responsibilityExposures: [
      {
        schemeKey: 'base_offense',
        responsibilityKey: 'run_reads',
        meaningfulReps: 6,
      },
    ],
  });
const southportCb = (playId = 'play-001') =>
  evidence({
    playerId: 'player-sp-e27',
    playId,
    organizationId: SP,
    actionExposures: [{ actionKey: 'cover_receiver', attempts: 12 }],
    responsibilityExposures: [
      {
        schemeKey: 'base_defense',
        responsibilityKey: 'coverage_rules',
        meaningfulReps: 12,
      },
    ],
  });

const readinessOf = (w: FootballWorld, id: string) =>
  w.development.readiness.find((r) => r.playerId === id)!;
const knowledgeOf = (w: FootballWorld, id: string, key: string) =>
  w.development.roleKnowledge.find(
    (k) => k.playerId === id && k.responsibilityKey === key,
  );

describe('football usage ingress changes readiness and role familiarity only', () => {
  it('records a large valid workload without any immediate capability change', () => {
    const world = gameDayWorld();
    const big = evidence({
      playerId: 'player-nf-e01',
      playId: 'play-big',
      actionExposures: [{ actionKey: 'throw_pass', attempts: 50 }],
    });
    const { nextWorld, eventSpecs } = applyFootballUsageEvidence(
      world,
      SYNTHETIC_PACKAGE_E_RULESET,
      [big],
    );
    const before = readinessOf(world, 'player-nf-e01');
    const after = readinessOf(nextWorld, 'player-nf-e01');
    expect(after.acuteFatigueBp).toBeGreaterThan(before.acuteFatigueBp);
    expect(after.accumulatedLoadUnits).toBe(
      before.accumulatedLoadUnits + big.workloadUnits,
    );
    expect(after.updatedAt).toBe(GAME_DAY);
    const k0 = knowledgeOf(world, 'player-nf-e01', 'progression_reads')!;
    const k1 = knowledgeOf(nextWorld, 'player-nf-e01', 'progression_reads')!;
    expect(k1.familiarityBp).toBeGreaterThanOrEqual(k0.familiarityBp);
    expect(k1.lastMeaningfulRepAt).toBe(GAME_DAY);
    // EXACTLY zero immediate capability-value change: the roster ledger is untouched.
    expect(nextWorld.roster).toBe(world.roster);
    expect(nextWorld.roster.players).toEqual(world.roster.players);
    expect(eventSpecs.length).toBeGreaterThan(0);
  });

  it('uses one D-owned checkpoint, mints ids, and consumes no randomness', () => {
    const world = gameDayWorld();
    const { nextWorld } = applyFootballUsageEvidence(
      world,
      SYNTHETIC_PACKAGE_E_RULESET,
      [qb(), rb()],
    );
    expect(nextWorld.rng).toEqual(world.rng);
    expect(nextWorld.development.checkpoints).toHaveLength(
      world.development.checkpoints.length + 1,
    );
    const checkpoint = nextWorld.development.checkpoints.at(-1)!;
    expect(checkpoint.kind).toBe('football_usage');
    expect(checkpoint.rngDrawCount).toBe(0);
    expect(checkpoint.allocationIds).toEqual([]);
    expect(nextWorld.nextIds.record).toBeGreaterThan(world.nextIds.record);
    const newEvents = nextWorld.development.events.filter(
      (e) => e.checkpointId === checkpoint.id,
    );
    expect(newEvents.map((e) => e.id).sort()).toEqual(
      [...checkpoint.eventIds].sort(),
    );
    expect(newEvents.every((e) => e.kind.startsWith('football_usage'))).toBe(
      true,
    );
  });

  it('creates familiarity for a newly learned responsibility only when reps were meaningful', () => {
    const world = gameDayWorld();
    expect(
      knowledgeOf(world, 'player-nf-e01', 'protection_calls'),
    ).toBeDefined();
    const fresh = evidence({
      playerId: 'player-nf-e03',
      playId: 'play-new',
      actionExposures: [{ actionKey: 'run_route', attempts: 4 }],
      responsibilityExposures: [
        {
          schemeKey: 'base_offense',
          responsibilityKey: 'route_tree',
          meaningfulReps: 4,
        },
      ],
    });
    expect(knowledgeOf(world, 'player-nf-e03', 'route_tree')).toBeUndefined();
    const { nextWorld } = applyFootballUsageEvidence(
      world,
      SYNTHETIC_PACKAGE_E_RULESET,
      [fresh],
    );
    const made = knowledgeOf(nextWorld, 'player-nf-e03', 'route_tree')!;
    expect(made.transferFamilyKey).toBe('route_running');
    expect(made.lastMeaningfulRepAt).toBe(GAME_DAY);
    const zero = evidence({
      playerId: 'player-nf-e03',
      playId: 'play-zero',
      actionExposures: [{ actionKey: 'run_route', attempts: 4 }],
      responsibilityExposures: [
        {
          schemeKey: 'base_offense',
          responsibilityKey: 'route_tree',
          meaningfulReps: 0,
        },
      ],
    });
    const none = applyFootballUsageEvidence(
      world,
      SYNTHETIC_PACKAGE_E_RULESET,
      [zero],
    ).nextWorld;
    expect(knowledgeOf(none, 'player-nf-e03', 'route_tree')).toBeUndefined();
  });

  it('returns the same world and no events for empty evidence', () => {
    const world = gameDayWorld();
    const result = applyFootballUsageEvidence(
      world,
      SYNTHETIC_PACKAGE_E_RULESET,
      [],
    );
    expect(result.nextWorld).toBe(world);
    expect(result.eventSpecs).toEqual([]);
  });
});

describe('football usage ingress is canonical and never double-counts', () => {
  it('yields identical state, record ids and event specs for any evidence order', () => {
    const world = gameDayWorld();
    const items = [
      qb('play-001'),
      rb('play-001'),
      southportCb('play-002'),
      qb('play-002'),
    ];
    const forward = applyFootballUsageEvidence(
      world,
      SYNTHETIC_PACKAGE_E_RULESET,
      items,
    );
    for (const order of [
      [...items].reverse(),
      [items[2]!, items[0]!, items[3]!, items[1]!],
    ]) {
      const other = applyFootballUsageEvidence(
        world,
        SYNTHETIC_PACKAGE_E_RULESET,
        order,
      );
      expect(canonicalString(other.nextWorld)).toBe(
        canonicalString(forward.nextWorld),
      );
      expect(canonicalString(other.eventSpecs)).toBe(
        canonicalString(forward.eventSpecs),
      );
    }
  });

  it('applies several plays for one player cumulatively in canonical play order', () => {
    const world = gameDayWorld();
    const { nextWorld } = applyFootballUsageEvidence(
      world,
      SYNTHETIC_PACKAGE_E_RULESET,
      [qb('play-001'), qb('play-002')],
    );
    const single = applyFootballUsageEvidence(
      world,
      SYNTHETIC_PACKAGE_E_RULESET,
      [qb('play-001')],
    ).nextWorld;
    expect(
      readinessOf(nextWorld, 'player-nf-e01').accumulatedLoadUnits,
    ).toBeGreaterThan(
      readinessOf(single, 'player-nf-e01').accumulatedLoadUnits,
    );
  });

  it('rejects duplicate fixture+play+player evidence in one input', () => {
    const world = gameDayWorld();
    expect(() =>
      applyFootballUsageEvidence(world, SYNTHETIC_PACKAGE_E_RULESET, [
        qb('play-001'),
        qb('play-001'),
      ]),
    ).toThrow(FootballUsageError);
  });

  it('rejects evidence already represented by a D football_usage event', () => {
    const world = gameDayWorld();
    const once = applyFootballUsageEvidence(
      world,
      SYNTHETIC_PACKAGE_E_RULESET,
      [qb('play-001')],
    ).nextWorld;
    expect(() =>
      applyFootballUsageEvidence(once, SYNTHETIC_PACKAGE_E_RULESET, [
        qb('play-001'),
      ]),
    ).toThrow(FootballUsageError);
    // A different play for the same player is fine.
    expect(() =>
      applyFootballUsageEvidence(once, SYNTHETIC_PACKAGE_E_RULESET, [
        qb('play-002'),
      ]),
    ).not.toThrow();
  });
});

describe('football usage ingress validates everything before changing anything', () => {
  const reject = (items: FootballUsageEvidence[], fragment: string): void => {
    const world = gameDayWorld();
    let error: unknown;
    try {
      applyFootballUsageEvidence(world, SYNTHETIC_PACKAGE_E_RULESET, items);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(FootballUsageError);
    expect((error as Error).message).toContain(fragment);
  };

  it('rejects unknown fixtures, organizations, players and membership mismatches', () => {
    reject([{ ...qb(), fixtureId: recordId('fixture-nope') }], 'fixture');
    reject(
      [{ ...qb(), organizationId: entityId('org-eastbrook') }],
      'participant',
    );
    reject([{ ...qb(), playerId: entityId('player-zz-99') }], 'player');
    reject([{ ...qb(), organizationId: entityId(SP) }], 'roster');
  });

  it('rejects dates that are not the fixture game day', () => {
    reject([{ ...qb(), occurredAt: '2027-09-13' }], 'game day');
    reject([{ ...qb(), occurredAt: '2027-02-30' }], 'occurredAt');
  });

  it('rejects invalid or inconsistent workload', () => {
    reject([{ ...qb(), workloadUnits: -1 }], 'workloadUnits');
    reject([{ ...qb(), workloadUnits: 1.5 }], 'workloadUnits');
    reject([{ ...qb(), workloadUnits: qb().workloadUnits + 1 }], 'conversion');
    reject(
      [{ ...qb(), workloadUnits: Number.MAX_SAFE_INTEGER + 2 }],
      'workloadUnits',
    );
  });

  it('rejects vocabulary the football rules do not define', () => {
    reject([{ ...qb(), contactClass: 'invented' }], 'contactClass');
    reject(
      [{ ...qb(), actionExposures: [{ actionKey: 'warp', attempts: 1 }] }],
      'action',
    );
    reject(
      [
        {
          ...qb(),
          responsibilityExposures: [
            {
              schemeKey: 'no_scheme',
              responsibilityKey: 'progression_reads',
              meaningfulReps: 1,
            },
          ],
        },
      ],
      'scheme',
    );
    reject(
      [
        {
          ...qb(),
          responsibilityExposures: [
            {
              schemeKey: 'base_offense',
              responsibilityKey: 'no_duty',
              meaningfulReps: 1,
            },
          ],
        },
      ],
      'responsibility',
    );
  });

  it('rejects duplicated exposures, negative counts and unsupported fields', () => {
    reject(
      [
        {
          ...qb(),
          actionExposures: [
            { actionKey: 'throw_pass', attempts: 1 },
            { actionKey: 'throw_pass', attempts: 1 },
          ],
          workloadUnits: 4,
        },
      ],
      'duplicate',
    );
    reject(
      [
        {
          ...qb(),
          responsibilityExposures: [
            {
              schemeKey: 'base_offense',
              responsibilityKey: 'progression_reads',
              meaningfulReps: -1,
            },
          ],
        },
      ],
      'meaningfulReps',
    );
    reject([{ ...qb(), overallRating: 99 } as never], 'overallRating');
  });

  it('changes nothing when any one item is invalid', () => {
    const world = gameDayWorld();
    const before = canonicalString(world);
    expect(() =>
      applyFootballUsageEvidence(world, SYNTHETIC_PACKAGE_E_RULESET, [
        qb(),
        { ...rb(), fixtureId: recordId('fixture-nope') },
      ]),
    ).toThrow(FootballUsageError);
    expect(canonicalString(world)).toBe(before);
  });

  it('fails closed without football rules or without development rules', () => {
    const world = gameDayWorld();
    expect(() =>
      applyFootballUsageEvidence(
        world,
        {
          ...SYNTHETIC_PACKAGE_E_RULESET,
          rules: { maxAdvanceDaysPerCommand: 30 },
        },
        [qb()],
      ),
    ).toThrow();
  });

  it('rejects a player with no readiness record rather than inventing one', () => {
    const world = gameDayWorld();
    const stripped: FootballWorld = {
      ...world,
      development: {
        ...world.development,
        readiness: world.development.readiness.filter(
          (r) => r.playerId !== 'player-nf-e01',
        ),
      },
    };
    expect(() =>
      applyFootballUsageEvidence(stripped, SYNTHETIC_PACKAGE_E_RULESET, [qb()]),
    ).toThrow(FootballUsageError);
  });
});
