import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  createFootballObservationClaims,
  resolveScheduledGameChange,
} from '../src/index';
import { E_FIXTURE_1, NF, NF_COACH } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

const resolved = () =>
  resolveScheduledGameChange(
    selectionWorld(),
    SYNTHETIC_PACKAGE_E_RULESET,
    E_FIXTURE_1,
  ).nextWorld;

const claimFor = (world: ReturnType<typeof resolved>) => {
  const play = world.football.plays[0]!;
  return createFootballObservationClaims(world, [
    {
      sourcePersonId: NF_COACH,
      organizationId: NF.org,
      fixtureId: play.fixtureId,
      gameId: play.gameId,
      playId: play.id,
      observationType: 'execution_result',
      subjectPlayerId: play.participation.find(
        (p) => p.organizationId === NF.org,
      )!.playerId,
    },
  ]).nextWorld.information.claims.at(-1)!;
};

describe('football knowledge boundary', () => {
  it('is byte-identical when only latent capability/readiness truth changes', () => {
    const a = resolved();
    const b = {
      ...a,
      roster: {
        ...a.roster,
        players: a.roster.players.map((p, i) =>
          i === 0
            ? {
                ...p,
                capabilities: p.capabilities.map((c) => ({
                  ...c,
                  valueBp: Math.max(0, Math.min(10000, c.valueBp + 777)),
                })),
              }
            : p,
        ),
      },
      development: {
        ...a.development,
        readiness: a.development.readiness.map((r, i) =>
          i === 0
            ? { ...r, acuteFatigueBp: (r.acuteFatigueBp + 1234) % 10001 }
            : r,
        ),
      },
    };
    expect(JSON.stringify(claimFor(a))).toBe(JSON.stringify(claimFor(b)));
  });
});
