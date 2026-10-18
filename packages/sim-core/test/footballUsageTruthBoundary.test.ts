import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PACKAGE_E_SEED,
  SYNTHETIC_PACKAGE_E_RULESET,
  applyFootballUsageEvidence,
  createWorld,
  entityId,
  footballWorkloadUnits,
  recordId,
  worldId,
  type FootballUsageEvidence,
  type FootballWorld,
} from '../src/index';

const rules = SYNTHETIC_PACKAGE_E_RULESET.rules.football!;
const GAME_DAY = '2027-09-12';

const world = (): FootballWorld => ({
  ...createWorld(PACKAGE_E_SEED, SYNTHETIC_PACKAGE_E_RULESET, {
    newWorldId: () => worldId('world-usage-boundary'),
  }),
  simDate: GAME_DAY,
});

const heavy = (): FootballUsageEvidence => {
  const actionExposures = [{ actionKey: 'throw_pass', attempts: 100 }];
  return {
    fixtureId: recordId('fixture-2027-w01-southport-at-northfield'),
    playId: recordId('play-heavy'),
    organizationId: entityId('org-northfield'),
    playerId: entityId('player-nf-e01'),
    occurredAt: GAME_DAY,
    workloadUnits: footballWorkloadUnits(rules, actionExposures),
    contactClass: 'none',
    responsibilityExposures: [
      {
        schemeKey: 'base_offense',
        responsibilityKey: 'progression_reads',
        meaningfulReps: 100,
      },
    ],
    actionExposures,
  };
};

describe('football usage is private development truth, never XP or a rating', () => {
  it('touches only readiness, role knowledge and the D checkpoint/event ledgers', () => {
    const before = world();
    const { nextWorld } = applyFootballUsageEvidence(
      before,
      SYNTHETIC_PACKAGE_E_RULESET,
      [heavy()],
    );
    const changed = Object.keys(nextWorld).filter(
      (k) =>
        (nextWorld as unknown as Record<string, unknown>)[k] !==
        (before as unknown as Record<string, unknown>)[k],
    );
    expect(changed.sort()).toEqual(['development', 'nextIds']);
    const dev = nextWorld.development;
    const prev = before.development;
    expect(dev.playerProfiles).toBe(prev.playerProfiles);
    expect(dev.teachingProfiles).toBe(prev.teachingProfiles);
    expect(dev.opportunityWindows).toBe(prev.opportunityWindows);
    expect(dev.opportunityAllocations).toBe(prev.opportunityAllocations);
  });

  it('creates no claims, beliefs, football history or medical episodes', () => {
    const before = world();
    const { nextWorld } = applyFootballUsageEvidence(
      before,
      SYNTHETIC_PACKAGE_E_RULESET,
      [heavy()],
    );
    expect(nextWorld.information).toBe(before.information);
    expect(nextWorld.football).toBe(before.football);
    expect(nextWorld.medical).toBe(before.medical);
    expect(nextWorld.roster).toBe(before.roster);
  });

  it('writes no capability, rating, ceiling, XP or tier field into any record', () => {
    const before = world();
    const { nextWorld } = applyFootballUsageEvidence(
      before,
      SYNTHETIC_PACKAGE_E_RULESET,
      [heavy()],
    );
    const fresh = nextWorld.development.events.filter(
      (e) => !before.development.events.some((o) => o.id === e.id),
    );
    expect(fresh.length).toBeGreaterThan(0);
    for (const event of fresh) {
      expect(event.capabilityKeys).toEqual([]);
      expect(event.kind.startsWith('football_usage')).toBe(true);
      expect(Object.keys(event).sort()).toEqual(
        Object.keys(before.development.events[0] ?? event).sort(),
      );
    }
    const text = JSON.stringify(fresh).toLowerCase();
    for (const banned of [
      'overall',
      'ovr',
      'potential',
      'ceiling',
      'xp',
      'tier',
    ])
      expect(text).not.toContain(`"${banned}`);
  });

  it('does not decide medical legality, adaptation or randomness (source guard)', () => {
    const source = readFileSync(
      join(__dirname, '..', 'src', 'developmentFootballUsage.ts'),
      'utf8',
    );
    for (const forbidden of [
      'resolveCapabilityAdaptation',
      'applyCapabilityDeltas',
      'medicalWorkloadCap',
      'functionalReadiness',
      'createMedicalEpisodeChange',
      'nextU32',
      'DeterministicRng',
    ])
      expect(source, forbidden).not.toContain(forbidden);
  });
});
