import type { EntityId } from './ids';
import { functionalReadiness } from './medical';
import {
  personOwnedRoleKnowledge,
  projectTransferFamiliarity,
} from './roleLearning';
import {
  footballAction,
  requireFootballRules,
  type FootballRulesV1,
} from './footballRules';
import type { LeagueRulesetManifest } from './ruleset';
import type { FootballWorld } from './world';

/**
 * Ephemeral, per-action execution inputs derived from EXISTING truth: the player's Package
 * C capability ledger, Package D learned role familiarity and Package D/medical functional
 * readiness. Nothing here is stored, nothing is a rating, and nothing is mutated.
 *
 * This is reality-resolver territory. Organizational selection (`footballSelection.ts`)
 * must never import or call it: a selector that could read these values would be reading
 * latent truth. `footballSelectionPrivacy.test.ts` pins that boundary.
 */
export interface FootballActionComponent {
  readonly capabilityKey: string;
  /** The player's current value for this capability (`0` when the ledger has no entry). */
  readonly valueBp: number;
  readonly weightBp: number;
}

export interface FootballActionInput {
  readonly playerId: EntityId;
  readonly actionKey: string;
  readonly schemeKey: string;
  readonly responsibilityKey: string;
  readonly components: readonly FootballActionComponent[];
  /** Weighted capability blend, `0..10000`. */
  readonly capabilityBp: number;
  /** Exact learned familiarity with this scheme + responsibility, `0..10000`. */
  readonly familiarityBp: number;
  /** Medical/conditioning functional readiness for this action, `0..10000`. */
  readonly functionalReadinessBp: number;
  /** `false` below the action's minimum readiness: the player cannot attempt it. */
  readonly canAttempt: boolean;
  /** `10000`, or the ruleset's reduced scale when familiarity is under its floor. */
  readonly familiarityScaleBp: number;
  /** Final blended execution value, `0..10000`: capability x readiness x familiarity scale. */
  readonly executionBp: number;
}

export class FootballActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FootballActionError';
  }
}

const fail = (message: string): never => {
  throw new FootballActionError(message);
};

/**
 * Derives one participant's execution inputs for one action. Pure, integer-only and
 * consumes no randomness. Fails closed, before any caller draws a roll, on an unknown
 * action, scheme, responsibility or player, a responsibility the action does not carry, or
 * a player with no readiness record. A capability the player's ledger lacks contributes `0`:
 * a latent dimension that is not held is not held.
 */
export const deriveFootballActionInput = (
  world: Pick<FootballWorld, 'roster' | 'development' | 'medical'>,
  ruleset: Pick<LeagueRulesetManifest, 'rulesetId' | 'rules'>,
  playerId: EntityId,
  actionKey: string,
  schemeKey: string,
  responsibilityKey: string,
): FootballActionInput =>
  deriveFootballActionInputFromRules(
    world,
    requireFootballRules(ruleset),
    playerId,
    actionKey,
    schemeKey,
    responsibilityKey,
  );

/** Same derivation for a caller that already holds the validated football rules. */
export const deriveFootballActionInputFromRules = (
  world: Pick<FootballWorld, 'roster' | 'development' | 'medical'>,
  rules: FootballRulesV1,
  playerId: EntityId,
  actionKey: string,
  schemeKey: string,
  responsibilityKey: string,
): FootballActionInput => {
  const action = footballAction(rules, actionKey);
  if (action === undefined)
    return fail(`unknown football action "${actionKey}"`);
  if (!rules.schemes.some((s) => s.schemeKey === schemeKey))
    return fail(`unknown football scheme "${schemeKey}"`);
  const responsibility = rules.responsibilities.find(
    (r) => r.responsibilityKey === responsibilityKey,
  );
  if (responsibility === undefined)
    return fail(`unknown football responsibility "${responsibilityKey}"`);
  if (!action.responsibilityKeys.includes(responsibilityKey))
    return fail(
      `action "${actionKey}" does not carry responsibility "${responsibilityKey}"`,
    );
  const player = world.roster.players.find((p) => p.personId === playerId);
  if (player === undefined) return fail(`unknown player "${playerId}"`);

  const components = action.capabilityBindings.map((b) => ({
    capabilityKey: b.capabilityKey,
    valueBp:
      player.capabilities.find((c) => c.key === b.capabilityKey)?.valueBp ?? 0,
    weightBp: b.weightBp,
  }));
  const weighted = components.reduce((n, c) => n + c.valueBp * c.weightBp, 0);
  const capabilityBp = Math.floor(weighted / 10000);

  const readiness = functionalReadiness(
    world as FootballWorld,
    playerId,
    actionKey,
  );
  if (readiness === undefined)
    return fail(`player "${playerId}" has no readiness record`);

  const familiarityBp = projectTransferFamiliarity(
    personOwnedRoleKnowledge(world.development, playerId),
    schemeKey,
    responsibilityKey,
    responsibility.transferFamilyKey,
  );
  const policy = action.participation;
  const familiarityScaleBp =
    familiarityBp < policy.familiarityFloorBp
      ? policy.belowFloorExecutionScaleBp
      : 10000;

  return {
    playerId,
    actionKey,
    schemeKey,
    responsibilityKey,
    components,
    capabilityBp,
    familiarityBp,
    functionalReadinessBp: readiness,
    canAttempt: readiness >= policy.minFunctionalReadinessBp,
    familiarityScaleBp,
    executionBp: Math.floor(
      (capabilityBp * readiness * familiarityScaleBp) / 100000000,
    ),
  };
};
