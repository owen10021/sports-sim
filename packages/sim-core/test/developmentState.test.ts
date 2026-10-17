import { describe, expect, it } from 'vitest';
import {
  PACKAGE_D_SEED,
  SYNTHETIC_PACKAGE_D_RULESET,
  createWorld,
  worldId,
  emptyDevelopmentState,
  entityId,
  developmentProfileFor,
  readinessFor,
} from '../src/index';

const world = () =>
  createWorld(PACKAGE_D_SEED, SYNTHETIC_PACKAGE_D_RULESET, {
    newWorldId: () => worldId('world-development-state'),
  });

describe('development state boundary', () => {
  it('keeps only causal profiles, knowledge, readiness, opportunity and history', () => {
    const w = world();
    expect(Object.keys(w.development).sort()).toEqual([
      'checkpoints',
      'events',
      'opportunityAllocations',
      'opportunityWindows',
      'playerProfiles',
      'readiness',
      'roleKnowledge',
      'teachingProfiles',
    ]);
    for (const p of w.development.playerProfiles) {
      expect(Object.keys(p).sort()).toEqual([
        'adaptabilityBp',
        'capabilityResponses',
        'durabilityBp',
        'personId',
        'processingBp',
        'recoveryBp',
      ]);
      for (const r of p.capabilityResponses)
        expect(Object.keys(r).sort()).toEqual([
          'capabilityKey',
          'malleabilityBp',
        ]);
    }
  });

  it('queries a person profile and readiness without a capability or default oracle', () => {
    const w = world();
    const p = w.development.playerProfiles[0]!;
    expect(developmentProfileFor(w.development, p.personId)).toBe(p);
    const r = w.development.readiness[0]!;
    expect(readinessFor(w.development, r.playerId)).toBe(r);
    expect(
      developmentProfileFor(w.development, entityId('missing-player')),
    ).toBeUndefined();
    expect(
      readinessFor(w.development, entityId('missing-player')),
    ).toBeUndefined();
    expect(
      developmentProfileFor(emptyDevelopmentState(), p.personId),
    ).toBeUndefined();
  });

  it('changing responsiveness and readiness alone leaves football truth and beliefs intact', () => {
    const w = world();
    const before = JSON.stringify({
      roster: w.roster,
      information: w.information,
    });
    const changed = {
      ...w,
      development: {
        ...w.development,
        playerProfiles: w.development.playerProfiles.map((p) => ({
          ...p,
          processingBp: 0,
          adaptabilityBp: 10000,
          capabilityResponses: p.capabilityResponses.map((r) => ({
            ...r,
            malleabilityBp: 10000,
          })),
        })),
        readiness: w.development.readiness.map((r) => ({
          ...r,
          conditioningBp: 0,
          acuteFatigueBp: 10000,
        })),
      },
    };
    expect(
      JSON.stringify({
        roster: changed.roster,
        information: changed.information,
      }),
    ).toBe(before);
    expect(changed.development).not.toEqual(w.development);
  });
});
