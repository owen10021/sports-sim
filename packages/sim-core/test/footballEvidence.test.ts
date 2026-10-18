import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  createFootballObservationClaims,
  entityId,
  resolveScheduledGameChange,
} from '../src/index';
import { E_FIXTURE_1, NF, NF_COACH, SP_COACH } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

const finalWorld = () =>
  resolveScheduledGameChange(
    selectionWorld(),
    SYNTHETIC_PACKAGE_E_RULESET,
    E_FIXTURE_1,
  ).nextWorld;

describe('legitimate football observation claims', () => {
  it('rejects a synthetic/nonexistent source and a person outside the organization role path', () => {
    expect(typeof createFootballObservationClaims).toBe('function');
    const world = finalWorld();
    const play = world.football.plays[0]!;
    const before = JSON.stringify(world);
    for (const sourcePersonId of [entityId('engine'), SP_COACH]) {
      expect(() =>
        createFootballObservationClaims(world, [
          {
            sourcePersonId,
            organizationId: NF.org,
            fixtureId: play.fixtureId,
            gameId: play.gameId,
            playId: play.id,
            observationType: 'execution_result',
            subjectPlayerId: play.participation[0]!.playerId,
          },
        ]),
      ).toThrow();
      expect(JSON.stringify(world)).toBe(before);
    }
  });

  it('creates an immutable Package B claim from observable play facts only', () => {
    const world = finalWorld();
    const play = world.football.plays[0]!;
    const out = createFootballObservationClaims(world, [
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
    ]);
    expect(out.nextWorld.information.claims).toHaveLength(
      world.information.claims.length + 1,
    );
    const claim = out.nextWorld.information.claims.at(-1)!;
    expect(claim.sourcePersonId).toBe(NF_COACH);
    expect(claim.holderOrganizationIds).toEqual([NF.org]);
    expect(claim.visibility).toBe('organization');
    expect(claim.propositionType).toBe('football_execution_observation');
    expect(JSON.stringify(claim)).toContain(play.id);
    expect(out.eventSpecs).toHaveLength(1);
  });
});
