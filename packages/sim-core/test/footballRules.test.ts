import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FOOTBALL_SIDES,
  ManifestFormatError,
  MissingFootballRulesError,
  RESOLUTION_PHASES,
  SCHEMA_VERSION,
  SYNTHETIC_FOOTBALL_RULES,
  SYNTHETIC_PACKAGE_C_RULESET,
  SYNTHETIC_PACKAGE_D_RULESET,
  SYNTHETIC_PACKAGE_E_RULESET,
  SYNTHETIC_RULESET,
  footballAction,
  footballCapabilityKeys,
  footballConcept,
  footballFormation,
  parseFootballRulesV1,
  requireFootballRules,
  sealRuleset,
  validateRulesetManifest,
  type FootballRulesV1,
  type LeagueRulesetManifest,
} from '../src/index';

const root = join(__dirname, '..', '..', '..');
const readRuleset = (name: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(join(root, 'fixtures', 'rulesets', name), 'utf8'),
  ) as Record<string, unknown>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

type Mutable = Record<string, unknown> & {
  actions: Record<string, unknown>[];
  concepts: Record<string, unknown>[];
  formations: { slots: unknown[] }[] & Record<string, unknown>[];
  exposureConversion: unknown[];
  ordering: { phaseOrder: string[] };
  injury: { conditions: Record<string, unknown>[] };
  penalties: unknown[];
};

/** Seal a ruleset whose football block was edited; throws if the parser rejects it. */
const sealWith = (edit: (f: Mutable) => void): LeagueRulesetManifest => {
  const football = clone(SYNTHETIC_FOOTBALL_RULES) as unknown as Mutable;
  edit(football);
  return sealRuleset({
    schemaVersion: SCHEMA_VERSION,
    rulesetId: 'synthetic-package-e-rules',
    rulesetVersion: 1,
    displayName: 'edited',
    provenance: [...SYNTHETIC_PACKAGE_E_RULESET.provenance],
    rules: {
      maxAdvanceDaysPerCommand: 30,
      football: football as unknown as FootballRulesV1,
    },
  });
};

const rejects = (edit: (f: Mutable) => void, fragment: string): void => {
  let error: unknown;
  try {
    sealWith(edit);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(ManifestFormatError);
  expect((error as Error).message).toContain(fragment);
};

describe('football rules are an optional, fail-closed ruleset block', () => {
  it('re-seals the accepted Package A-D rulesets byte-identically', () => {
    for (const [name, manifest] of [
      ['synthetic-minimal-v1.json', SYNTHETIC_RULESET],
      ['synthetic-package-c-rules-v1.json', SYNTHETIC_PACKAGE_C_RULESET],
      ['synthetic-package-d-rules-v1.json', SYNTHETIC_PACKAGE_D_RULESET],
    ] as const) {
      const file = readRuleset(name);
      const { contentHash, ...body } = file;
      expect(sealRuleset(body as never).contentHash).toBe(contentHash);
      expect(manifest.contentHash).toBe(contentHash);
      expect(manifest.rules.football).toBeUndefined();
    }
  });

  it('fails closed for rulesets without football rules and returns them when present', () => {
    for (const older of [
      SYNTHETIC_RULESET,
      SYNTHETIC_PACKAGE_C_RULESET,
      SYNTHETIC_PACKAGE_D_RULESET,
    ])
      expect(() => requireFootballRules(older)).toThrow(
        MissingFootballRulesError,
      );
    expect(requireFootballRules(SYNTHETIC_PACKAGE_E_RULESET)).toBe(
      SYNTHETIC_PACKAGE_E_RULESET.rules.football,
    );
  });

  it('rejects an unknown or future football model version', () => {
    rejects(
      (f) => (f.modelVersion = 2),
      'unsupported football rules model version',
    );
    rejects(
      (f) => (f.modelVersion = 0),
      'unsupported football rules model version',
    );
  });

  it('rejects unsupported fields at every level (exact keys)', () => {
    rejects((f) => (f.futureField = 1), 'futureField');
    rejects((f) => (f.actions[0]!.extra = 1), 'extra');
    rejects((f) => (f.concepts[0]!.extra = 1), 'extra');
    rejects((f) => (f.formations[0]!.extra = 1), 'extra');
    rejects((f) => ((f.field as Record<string, unknown>).extra = 1), 'extra');
  });

  it('rejects summary-rating, ceiling or tier vocabulary keys', () => {
    rejects(
      (f) => (f.actions[0]!.actionKey = 'overall_blocking'),
      'summary rating',
    );
    rejects((f) => (f.profileKey = 'team_rating_v1'), 'summary rating');
    rejects(
      (f) => (f.concepts[0]!.conceptKey = 'elite_tier_run'),
      'summary rating',
    );
  });

  it('rejects duplicate definitions', () => {
    rejects((f) => f.actions.push(clone(f.actions[0]!)), 'duplicate actionKey');
    rejects(
      (f) => f.concepts.push(clone(f.concepts[0]!)),
      'duplicate conceptKey',
    );
    rejects(
      (f) => f.formations.push(clone(f.formations[0]!)),
      'duplicate formationKey',
    );
    rejects(
      (f) => f.penalties.push(clone(f.penalties[0]!)),
      'duplicate penaltyKey',
    );
    rejects(
      (f) => f.exposureConversion.push(clone(f.exposureConversion[0]!)),
      'duplicate actionKey',
    );
  });

  it('rejects invalid capability bindings', () => {
    const bindings = (f: Mutable): Record<string, unknown>[] =>
      f.actions[0]!.capabilityBindings as Record<string, unknown>[];
    rejects((f) => (bindings(f)[0]!.weightBp = 1), 'sum to exactly 10000');
    rejects((f) => (bindings(f)[0]!.weightBp = -1), 'weightBp');
    rejects((f) => (bindings(f)[0]!.weightBp = 4000.5), 'weightBp');
    rejects(
      (f) => (bindings(f)[1]!.capabilityKey = bindings(f)[0]!.capabilityKey),
      'duplicate capability',
    );
    rejects(
      (f) => (f.actions[0]!.capabilityBindings = []),
      'must not be empty',
    );
    rejects(
      (f) => (bindings(f)[0]!.capabilityKey = 'overall_strength'),
      'summary rating',
    );
  });

  it('rejects references that do not resolve inside the block', () => {
    rejects(
      (f) => (f.actions[0]!.responsibilityKeys = ['no_such_responsibility']),
      'unknown responsibility',
    );
    rejects(
      (f) => (f.concepts[0]!.schemeKey = 'no_such_scheme'),
      'unknown scheme',
    );
    rejects(
      (f) => (f.concepts[0]!.formationKeys = ['no_such_formation']),
      'unknown formation',
    );
    rejects(
      (f) =>
        ((
          f.concepts[0]!.assignments as Record<string, unknown>[]
        )[0]!.actionKey = 'no_such_action'),
      'unknown action',
    );
    rejects(
      (f) =>
        ((
          f.concepts[0]!.assignments as Record<string, unknown>[]
        )[0]!.slotKeys = ['no_such_slot']),
      'no slot',
    );
    rejects(
      (f) =>
        ((
          f.concepts[0]!.assignments as Record<string, unknown>[]
        )[0]!.actionKey = 'run_route'),
      'does not carry responsibility',
    );
    rejects(
      (f) => (f.injury.conditions[0]!.affectedActionKeys = ['no_such_action']),
      'unknown action',
    );
  });

  it('requires a workload conversion for every action and nothing else', () => {
    rejects((f) => f.exposureConversion.pop(), 'no workload conversion');
    rejects(
      (f) =>
        f.exposureConversion.push({
          actionKey: 'no_such_action',
          loadUnitsPerExposure: 1,
        }),
      'unknown action',
    );
  });

  it('requires full sides, a canonical phase order and a conforming matchup edge', () => {
    rejects(
      (f) => f.formations[0]!.slots.pop(),
      'slots, but the ruleset fields 11',
    );
    rejects((f) => f.ordering.phaseOrder.reverse(), 'must be exactly');
    rejects((f) => f.ordering.phaseOrder.pop(), 'must be exactly');
    rejects(
      (f) =>
        ((f.matchupEdges as Record<string, unknown>[])[0]!.defenseConceptKey =
          'inside_run'),
      'not a defensive concept',
    );
    rejects(
      (f) => ((f.field as Record<string, unknown>).downsPerSeries = 0),
      'downsPerSeries',
    );
  });

  it('provides a complete synthetic profile and honest provenance', () => {
    const rules = requireFootballRules(SYNTHETIC_PACKAGE_E_RULESET);
    expect(rules.modelVersion).toBe(1);
    expect(rules.ordering.phaseOrder).toEqual([...RESOLUTION_PHASES]);
    expect(rules.substitution.playersPerSide).toBe(11);
    for (const f of rules.formations) expect(f.slots).toHaveLength(11);
    for (const a of rules.actions)
      expect(a.capabilityBindings.reduce((s, b) => s + b.weightBp, 0)).toBe(
        10000,
      );
    for (const side of ['offense', 'defense', 'kicking', 'returning'] as const)
      expect(rules.concepts.some((c) => c.side === side)).toBe(true);
    expect(FOOTBALL_SIDES).toHaveLength(4);
    for (const entry of SYNTHETIC_PACKAGE_E_RULESET.provenance) {
      expect(entry.sourceKind).toBe('synthetic');
      expect(entry.validationStatus).toBe('synthetic');
      const note = (entry.note ?? '').toLowerCase();
      expect(note).toContain('synthetic');
      expect(note).toContain('not empirically validated nfl');
    }
  });

  it('exposes plain accessors and the capability keys the rules read', () => {
    const rules = requireFootballRules(SYNTHETIC_PACKAGE_E_RULESET);
    expect(footballAction(rules, 'carry_ball')?.responsibilityKeys).toEqual([
      'run_reads',
    ]);
    expect(footballAction(rules, 'nope')).toBeUndefined();
    expect(footballConcept(rules, 'inside_run')?.playCategory).toBe('run');
    expect(footballFormation(rules, 'nickel_425')?.slots).toHaveLength(11);
    expect(footballCapabilityKeys(rules)).toContain('block_technique');
    expect(footballCapabilityKeys(rules)).toEqual(
      [...footballCapabilityKeys(rules)].sort(),
    );
  });

  it('parses the same block that was sealed, independent of key order', () => {
    const reparsed = parseFootballRulesV1(
      clone(SYNTHETIC_FOOTBALL_RULES),
      'football',
    );
    expect(reparsed).toEqual(SYNTHETIC_FOOTBALL_RULES);
  });
});

describe('the synthetic Package E ruleset', () => {
  it('matches the committed fixture file exactly and pins its content hash', () => {
    const file = readRuleset('synthetic-package-e-rules-v1.json');
    expect(file).toEqual(
      JSON.parse(JSON.stringify(SYNTHETIC_PACKAGE_E_RULESET)),
    );
    expect(SYNTHETIC_PACKAGE_E_RULESET.contentHash).toBe(
      '6e3e878da3159402e337c6dde51b6d674258c00d38d90e94a9e4c2ec2da7fa4c',
    );
    expect(validateRulesetManifest(file).contentHash).toBe(file.contentHash);
  });

  it('keeps Package D development structure and enlarges only limits and scopes', () => {
    const d = SYNTHETIC_PACKAGE_D_RULESET.rules.development!;
    const e = SYNTHETIC_PACKAGE_E_RULESET.rules.development!;
    expect({ ...e, opportunityPools: [] }).toEqual({
      ...d,
      opportunityPools: [],
    });
    expect(e.opportunityPools.length).toBe(44);
    const tx = SYNTHETIC_PACKAGE_E_RULESET.rules.transactions!;
    expect(tx.contracts).toEqual(
      SYNTHETIC_PACKAGE_C_RULESET.rules.transactions!.contracts,
    );
    for (const s of tx.seasonRules) expect(s.activeRosterLimit).toBe(40);
  });
});
