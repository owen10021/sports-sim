import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_E_RULESET,
  commandId,
  currentRosterMembership,
  eventId,
  recordId,
  resolveScheduledGameChange,
  type DecisionReceipt,
  type FootballCausalLink,
} from '../src/index';
import { E_FIXTURE_1, NF, NF_COACH } from './support/packageEHarness';
import { selectionWorld } from './support/footballSelectionHarness';

const receipt = (id: string, proposalId: string): DecisionReceipt => ({
  id: recordId(id),
  proposalId: recordId(proposalId),
  proposalRevision: 1,
  commandId: commandId(`cmd-${id}`),
  actorPersonId: NF_COACH,
  authorityGrantIds: [],
  evidenceClaimIds: [],
  beliefIds: [],
  approvalIds: [],
  mandateId: null,
  executedTermsHash: `hash-${id}`,
  committedAt: '2027-09-12',
  outcomeEventIds: [eventId(`evt-${id}`)],
  originalRationale: { note: id },
});

const recordIds = (link: FootballCausalLink): string[] =>
  link.inputRefs
    .filter((ref) => ref.kind === 'record')
    .map((ref) => (ref.kind === 'record' ? ref.id : ''));

const rulesetKeys = (link: FootballCausalLink): string[] =>
  link.inputRefs
    .filter((ref) => ref.kind === 'ruleset_key')
    .map((ref) => (ref.kind === 'ruleset_key' ? ref.key : ''));

describe('Sunday Proof resolution-time causal ledger', () => {
  it('links only receipts that actually backed the designation/game-plan path, never post-hoc same-team records', () => {
    const base = selectionWorld();
    const matching = receipt('rec-used-football-receipt', `proposal-${NF.org}`);
    const unrelated = receipt(
      'rec-unrelated-football-receipt',
      'proposal-unrelated-nf',
    );
    const world = {
      ...base,
      decisions: {
        ...base.decisions,
        receipts: [...base.decisions.receipts, matching, unrelated],
      },
    };

    const out = resolveScheduledGameChange(
      world,
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );
    const game = out.nextWorld.football.games[0]!;
    const firstPlay = out.nextWorld.football.plays.find(
      (play) => play.id === game.playIds[0],
    )!;
    const link = out.nextWorld.football.causalLinks.find(
      (entry) =>
        entry.playId === firstPlay.id && entry.organizationId === NF.org,
    )!;

    expect(link).toBeDefined();
    expect(recordIds(link)).toContain(matching.id);
    expect(recordIds(link)).not.toContain(unrelated.id);
  });

  it('records a mechanically traceable roster/designation/game-plan/rules chain for an actual play path', () => {
    const base = selectionWorld();
    const matching = receipt('rec-nf-football-path', `proposal-${NF.org}`);
    const world = {
      ...base,
      decisions: {
        ...base.decisions,
        receipts: [...base.decisions.receipts, matching],
      },
    };
    const out = resolveScheduledGameChange(
      world,
      SYNTHETIC_PACKAGE_E_RULESET,
      E_FIXTURE_1,
    );
    const game = out.nextWorld.football.games[0]!;
    const firstPlay = out.nextWorld.football.plays.find(
      (play) => play.id === game.playIds[0],
    )!;
    const link = out.nextWorld.football.causalLinks.find(
      (entry) =>
        entry.playId === firstPlay.id && entry.organizationId === NF.org,
    )!;
    const participant = firstPlay.participation.find(
      (p) => p.organizationId === NF.org,
    )!;
    const membership = currentRosterMembership(
      world.roster,
      participant.playerId,
      world.simDate,
    )!;
    const designation = world.football.designations.find(
      (d) =>
        d.fixtureId === firstPlay.fixtureId &&
        d.organizationId === NF.org &&
        d.playerId === participant.playerId &&
        d.status === 'active',
    )!;
    const plan = world.football.gamePlans.find(
      (p) => p.fixtureId === firstPlay.fixtureId && p.organizationId === NF.org,
    )!;
    const conceptKey =
      firstPlay.offenseOrganizationId === NF.org
        ? firstPlay.offense.conceptKey
        : firstPlay.defense.conceptKey;

    expect(recordIds(link)).toEqual(
      expect.arrayContaining([
        membership.id,
        designation.id,
        plan.id,
        matching.id,
      ]),
    );
    expect(rulesetKeys(link)).toContain(conceptKey);
    for (const action of participant.actionExposures)
      expect(rulesetKeys(link)).toContain(action.actionKey);
    expect(link.consequenceRef).toEqual({
      kind: 'play_fact',
      playId: firstPlay.id,
      resultKind: firstPlay.resultKind,
    });
  });
});
