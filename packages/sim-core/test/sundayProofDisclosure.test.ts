import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  entityId,
  recordId,
  resolveScheduledGameChange,
  sundayProofForOrganization,
  type FootballCausalLink,
} from '../src/index';
import { E_FIXTURE_1, NF, SP } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

describe('Sunday Proof organization disclosure', () => {
  it('keeps factual own-chain segments while omitting rival/debug links and unexpected hidden payloads', () => {
    const resolved = resolveScheduledGameChange(
      selectionWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    ).nextWorld;
    const game = resolved.football.games[0]!;
    const firstPlay = resolved.football.plays.find(
      (p) => p.id === game.playIds[0],
    )!;
    const own = resolved.football.causalLinks.find(
      (link) => link.playId === firstPlay.id && link.organizationId === NF.org,
    )!;
    expect(own).toBeDefined();

    const rival: FootballCausalLink = {
      ...own,
      id: recordId('rec-rival-sunday-proof'),
      organizationId: SP.org,
      visibility: 'organization',
    };
    const debug = {
      ...own,
      id: recordId('rec-debug-sunday-proof'),
      organizationId: NF.org,
      visibility: 'debug',
      hiddenCapabilityBp: 9999,
      hiddenReadinessBp: 8888,
      privateMarginBp: 7777,
      randomRoll: 123456,
      marker: 'DEBUG_PRIVATE_MARKER',
    } as unknown as FootballCausalLink;
    const malformedOwn = {
      ...own,
      id: recordId('rec-malformed-own-proof'),
      visibility: 'organization',
      hiddenCapabilityBp: 9999,
      marker: 'SHOULD_NOT_PROJECT',
    } as unknown as FootballCausalLink;
    const world = {
      ...resolved,
      football: {
        ...resolved.football,
        causalLinks: [
          ...resolved.football.causalLinks,
          rival,
          debug,
          malformedOwn,
        ],
      },
    };

    const view = sundayProofForOrganization(world, NF.org, game.id);
    const encoded = JSON.stringify(view);
    expect(view.links.some((link) => link.id === own.id)).toBe(true);
    expect(view.links.some((link) => link.id === rival.id)).toBe(false);
    expect(view.links.some((link) => link.id === debug.id)).toBe(false);
    expect(view.links.some((link) => link.id === malformedOwn.id)).toBe(true);
    expect(encoded).not.toContain('DEBUG_PRIVATE_MARKER');
    expect(encoded).not.toContain('SHOULD_NOT_PROJECT');
    expect(encoded).not.toContain('hiddenCapabilityBp');
    expect(encoded).not.toContain('hiddenReadinessBp');
    expect(encoded).not.toContain('privateMarginBp');
    expect(encoded).not.toContain('randomRoll');
  });

  it('refuses an organization that did not participate in the game', () => {
    expect(typeof sundayProofForOrganization).toBe('function');
    const world = resolveScheduledGameChange(
      selectionWorld(),
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    ).nextWorld;
    expect(() =>
      sundayProofForOrganization(
        world,
        entityId('org-outsider-football'),
        world.football.games[0]!.id,
      ),
    ).toThrow();
  });
});
