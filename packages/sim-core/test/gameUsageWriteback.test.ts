import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  resolveScheduledGameChange,
} from '../src/index';
import { E_FIXTURE_1 } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

const capabilities = (world: ReturnType<typeof selectionWorld>) =>
  JSON.stringify(
    world.roster.players.map((p) => ({
      personId: p.personId,
      capabilities: p.capabilities,
    })),
  );

describe('complete-game Package D usage write-back', () => {
  it('records every participant exposure exactly once through D and never grants snap XP', () => {
    const before = selectionWorld();
    const beforeCapabilities = capabilities(before);
    const out = resolveScheduledGameChange(
      before,
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );
    const plays = out.gameDraft
      .plays as readonly ((typeof out.gameDraft.plays)[number] & {
      readonly id: string;
    })[];

    expect(plays.every((p) => typeof p.id === 'string')).toBe(true);
    const expected = plays.reduce((sum, p) => sum + p.participation.length, 0);
    const usage = out.nextWorld.development.events.filter(
      (e) => e.kind === 'football_usage',
    );
    expect(usage).toHaveLength(expected);

    for (const play of plays) {
      for (const participant of play.participation) {
        const hits = usage.filter(
          (e) =>
            e.playerId === participant.playerId &&
            e.causalRecordIds.includes(play.id as never),
        );
        expect(hits).toHaveLength(1);
      }
    }

    expect(
      capabilities(out.nextWorld as ReturnType<typeof selectionWorld>),
    ).toBe(beforeCapabilities);
  });

  it('leaves players with actual game work more fatigued and loaded in D', () => {
    const before = selectionWorld();
    const out = resolveScheduledGameChange(
      before,
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );
    const used = out.gameDraft.gameRecord.participationSummary.find(
      (p) => p.workloadUnits > 0,
    );
    expect(used).toBeDefined();
    const prior = before.development.readiness.find(
      (r) => r.playerId === used!.playerId,
    )!;
    const after = out.nextWorld.development.readiness.find(
      (r) => r.playerId === used!.playerId,
    )!;
    expect(after.accumulatedLoadUnits).toBe(
      prior.accumulatedLoadUnits + used!.workloadUnits,
    );
    expect(after.acuteFatigueBp).toBeGreaterThan(prior.acuteFatigueBp);
    expect(after.updatedAt).toBe(before.simDate);
  });
});
