import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  buildFootballDecisionView,
  recordId,
  resolveScheduledGameChange,
} from '../src/index';
import { E_FIXTURE_1, NF, SP, SP_COACH } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

const finalWorld = () =>
  resolveScheduledGameChange(
    selectionWorld(),
    SYNTHETIC_PACKAGE_E_RULESET,
    E_FIXTURE_1,
  ).nextWorld;

describe('knowledge-safe football decision/history view', () => {
  it('shows own private football context plus public resolved facts, but never rival private state', () => {
    const base = finalWorld();
    const game = base.football.games[0]!;
    const ownPlan = base.football.gamePlans.find(
      (p) => p.organizationId === NF.org,
    )!;
    const rivalPlan = base.football.gamePlans.find(
      (p) => p.organizationId === SP.org,
    )!;
    const world = {
      ...base,
      information: {
        ...base.information,
        claims: [
          ...base.information.claims,
          {
            id: recordId('rec-sp-private-football-view'),
            subject: { kind: 'world' as const, id: 'world' },
            propositionType: 'football_private_note',
            proposition: { marker: 'SP_PRIVATE_MARKER' },
            sourcePersonId: SP_COACH,
            sourceFamilyId: 'sp-private-football',
            observedAt: base.simDate,
            acquiredAt: base.simDate,
            visibility: 'organization' as const,
            holderOrganizationIds: [SP.org],
            confidence: 'high' as const,
            possibleBias: null,
            corroboratesClaimIds: [],
            contradictsClaimIds: [],
            sharedFromClaimId: null,
          },
        ],
      },
    };

    const view = buildFootballDecisionView(world, NF.org, NF.gm, game.id);
    const encoded = JSON.stringify(view);

    expect(view.ownGamePlan?.id).toBe(ownPlan.id);
    expect(view.plays).toHaveLength(game.playIds.length);
    expect(view.observedOpponentConceptKeys.length).toBeGreaterThan(0);
    expect(encoded).not.toContain(rivalPlan.id);
    expect(encoded).not.toContain('SP_PRIVATE_MARKER');
    expect(view.plays[0]).not.toHaveProperty('rngDrawStart');
    expect(view.plays[0]).not.toHaveProperty('rngDrawCount');
    expect(view.plays[0]).not.toHaveProperty('traceHash');
  });

  it('refuses a person who is not an active member of the requested organization', () => {
    const world = finalWorld();
    const game = world.football.games[0]!;
    expect(() =>
      buildFootballDecisionView(world, NF.org, SP.gm, game.id),
    ).toThrow();
  });
});
