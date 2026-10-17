import {
  SCHEMA_VERSION,
  entityId,
  rulesetRefOf,
  sealRuleset,
  sealSeed,
  worldId,
  type ActorRef,
  type IdSource,
  type LeagueRulesetBody,
  type LeagueRulesetManifest,
  type SourceProvenance,
  type WorldSeedBody,
  type WorldSeedManifest,
} from '../src/index';

export const syntheticProvenance = (): SourceProvenance => ({
  sourceId: 'synthetic-fixture',
  sourceKind: 'synthetic',
  retrievedAt: '2026-10-16T00:00:00Z',
  effectiveAsOf: '2026-10-16',
  validationStatus: 'synthetic',
  note: 'test fixture',
});

export const makeRuleset = (over: Partial<LeagueRulesetBody> = {}): LeagueRulesetManifest =>
  sealRuleset({
    schemaVersion: SCHEMA_VERSION,
    rulesetId: 'synthetic-minimal',
    rulesetVersion: 1,
    displayName: 'Synthetic Minimal',
    provenance: [syntheticProvenance()],
    rules: { maxAdvanceDaysPerCommand: 30 },
    ...over,
  });

export const makeSeed = (
  ruleset: LeagueRulesetManifest,
  over: Partial<WorldSeedBody> = {},
): WorldSeedManifest =>
  sealSeed({
    schemaVersion: SCHEMA_VERSION,
    seedId: 'synthetic-empty',
    seedVersion: 1,
    ruleset: rulesetRefOf(ruleset),
    rngSeed32: 12345,
    startDate: '2026-10-16',
    provenance: [syntheticProvenance()],
    initialEntities: [],
    ...over,
  });

export const fixedIdSource = (id = 'world-test-1'): IdSource => ({
  newWorldId: () => worldId(id),
});

export const harnessActor = (id = 'actor-1'): ActorRef => ({
  kind: 'test_harness',
  id: entityId(id),
});
