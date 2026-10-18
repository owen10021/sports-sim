import type { CanonicalValue } from './audit';
import {
  FootballUsageError,
  footballWorkloadUnits,
} from './developmentFootballUsage';
import type { FootballState, GameState } from './football';
import {
  FootballActionError,
  deriveFootballActionInputFromRules,
  type FootballActionInput,
} from './footballActions';
import {
  MissingFootballRulesError,
  requireFootballRules,
  type FootballConceptRule,
  type FootballRulesV1,
} from './footballRules';
import {
  FootballSelectionError,
  buildDefensiveSelectionView,
  buildOffensiveSelectionView,
  selectDefensiveCall,
  selectOffensiveCall,
  type CommittedDefensiveCall,
  type CommittedOffensiveCall,
  type LineupSlot,
} from './footballSelection';
import { hashCanonical } from './hash';
import type { EntityId, RecordId } from './ids';
import type { DeterministicRng } from './rng';
import type { LeagueRulesetManifest } from './ruleset';
import type { FootballWorld } from './world';

/**
 * THE one authoritative football play resolver (design basis sections 8, 9 and 14).
 *
 * `resolvePlay` is pure: it reads a validated input, consumes the supplied deterministic
 * RNG in one canonical, named order, and returns facts plus the next bookkeeping state. It
 * never mutates the world, never draws from `Math.random` or the clock, and consumes zero
 * randomness for anything but football resolution. Everything is integer / basis-point math.
 *
 * Both sides select their calls from separate selection views first. Only AFTER both calls
 * are committed does the resolver read latent player truth (capabilities, learned
 * familiarity, functional readiness), for the 22 lineup participants and only through
 * `deriveFootballActionInputFromRules`. Derived margins are ephemeral: they live in the
 * private trace and are never written to a persistent player, team or world field.
 *
 * Scope of Task 7: scrimmage (run and pass) plays. Penalty ENFORCEMENT, down / distance /
 * possession / score transitions, kicks and game end belong to Task 8; this resolver reports
 * the penalty it drew and the raw play result, and advances only its own bookkeeping
 * (sequence, clock, public call history).
 */

/** Every draw family, in the only order a play may consume them. */
export const PLAY_DRAW_SCHEDULE = [
  'offense_selection',
  'defense_selection',
  'recognition',
  'execution',
  'interaction',
  'sack',
  'sack_loss',
  'target',
  'defender',
  'interception',
  'completion',
  'fumble',
  'result',
  'tackler',
  'penalty',
  'penalty_kind',
  'clock',
] as const;
export type PlayDrawFamily = (typeof PLAY_DRAW_SCHEDULE)[number];

/**
 * Football injury / exposure evaluation draws one roll per participant, in canonical
 * participant order, AFTER `resolvePlay` returns. The complete-game composition (Task 10)
 * owns those draws; they are named here so the contract is complete.
 */
export const FOOTBALL_INJURY_DRAW_FAMILY = 'injury_exposure' as const;

export type PlayResultKind =
  | 'rush'
  | 'completion'
  | 'incompletion'
  | 'sack'
  | 'interception'
  | 'fumble_lost';

export interface PlayStateInput {
  readonly ruleset: Pick<LeagueRulesetManifest, 'rulesetId' | 'rules'>;
  /** The Package E collections: fixtures, committed designations and frozen game plans. */
  readonly football: FootballState;
  /** Read only AFTER both calls are committed; never reaches either selection view. */
  readonly latent: Pick<FootballWorld, 'roster' | 'development' | 'medical'>;
  readonly gameState: GameState;
}

export interface PlayParticipationFact {
  readonly organizationId: EntityId;
  readonly side: 'offense' | 'defense';
  readonly slotKey: string;
  readonly playerId: EntityId;
  readonly contactClass: string;
  readonly workloadUnits: number;
  readonly actionExposures: readonly {
    readonly actionKey: string;
    readonly attempts: number;
  }[];
  readonly responsibilityExposures: readonly {
    readonly schemeKey: string;
    readonly responsibilityKey: string;
    readonly meaningfulReps: number;
  }[];
}

export interface PlayPenaltyFact {
  readonly penaltyKey: string;
  readonly against: 'offense' | 'defense';
  readonly againstOrganizationId: EntityId;
  readonly yards: number;
  readonly automaticFirstDown: boolean;
  readonly lossOfDown: boolean;
  readonly enforcement: string;
}

export interface PlayCallFact {
  readonly conceptKey: string;
  readonly formationKey: string;
  readonly personnelKey: string;
  readonly lineup: readonly LineupSlot[];
}

export interface PlayPrincipals {
  readonly passerPlayerId: EntityId | null;
  readonly ballCarrierPlayerId: EntityId | null;
  readonly targetPlayerId: EntityId | null;
  readonly defenderPlayerId: EntityId | null;
  readonly tacklerPlayerId: EntityId | null;
  readonly pressurePlayerId: EntityId | null;
}

export interface ResolvedPlayDraft {
  readonly fixtureId: RecordId;
  /** 1-based position of this play in its game. */
  readonly sequence: number;
  readonly offenseOrganizationId: EntityId;
  readonly defenseOrganizationId: EntityId;
  readonly pre: {
    readonly period: number;
    readonly clockSecondsRemaining: number;
    readonly down: number;
    readonly yardsToGo: number;
    readonly yardLine: number;
    readonly homeScore: number;
    readonly awayScore: number;
  };
  readonly offense: PlayCallFact;
  readonly defense: PlayCallFact;
  readonly playCategory: 'run' | 'pass';
  readonly resultKind: PlayResultKind;
  /** Signed raw gain, bounded by field geometry; first downs and spotting are Task 8. */
  readonly yardsGained: number;
  readonly turnover: 'interception' | 'fumble' | null;
  readonly touchdown: boolean;
  readonly safety: boolean;
  readonly penalty: PlayPenaltyFact | null;
  readonly clockSecondsUsed: number;
  readonly principals: PlayPrincipals;
  readonly participation: readonly PlayParticipationFact[];
  readonly rngDrawStart: number;
  readonly rngDrawCount: number;
  /** SHA-256 over the private trace: proof the trace existed without exposing it. */
  readonly traceHash: string;
}

export interface PlayDrawRecord {
  readonly family: PlayDrawFamily;
  /** Exclusive upper bound; `2^32` marks a raw `nextU32` selection roll. */
  readonly bound: number;
  readonly value: number;
  /** 32-bit words consumed (more than 1 only when rejection sampling retried). */
  readonly words: number;
}

/** Debug / test only. Never persisted, never organization-facing. */
export interface PlayPrivateTrace {
  readonly draws: readonly PlayDrawRecord[];
  readonly margins: { readonly [key: string]: number };
  readonly executions: readonly {
    readonly side: 'offense' | 'defense';
    readonly slotKey: string;
    readonly playerId: EntityId;
    readonly actionKey: string;
    readonly responsibilityKey: string;
    readonly executionBp: number;
    readonly functionalReadinessBp: number;
    readonly familiarityBp: number;
    readonly attempted: boolean;
  }[];
}

export class FootballPlayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FootballPlayError';
  }
}

const fail = (message: string): never => {
  throw new FootballPlayError(message);
};

// ---------------------------------------------------------------------------
// Input validation (everything here finishes before the first draw)
// ---------------------------------------------------------------------------

const INPUT_KEYS = ['football', 'gameState', 'latent', 'ruleset'] as const;
const LATENT_KEYS = ['development', 'medical', 'roster'] as const;
const GAME_STATE_KEYS = [
  'awayScore',
  'awayTimeoutsRemaining',
  'clockSecondsRemaining',
  'down',
  'fixtureId',
  'homeScore',
  'homeTimeoutsRemaining',
  'nextSnap',
  'period',
  'playsResolved',
  'possessionOrganizationId',
  'resolvedCalls',
  'yardLine',
  'yardsToGo',
] as const;

const exactKeys = (
  value: unknown,
  keys: readonly string[],
  path: string,
): void => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return fail(`${path} must be an object`);
  const actual = Object.keys(value).sort();
  const extra = actual.filter((k) => !keys.includes(k));
  if (extra.length > 0)
    fail(
      `${path} has fields the resolver does not accept: ${extra.join(', ')}`,
    );
  const missing = keys.filter((k) => !actual.includes(k));
  if (missing.length > 0) fail(`${path} is missing: ${missing.join(', ')}`);
};

/** Contact classes the resolver tags exposure with; the ruleset must declare all of them. */
const CONTACT_ORDER = ['none', 'incidental', 'engaged', 'tackle'] as const;

const ACTION_CONTACT: { readonly [actionKey: string]: string } = {
  run_block: 'engaged',
  pass_protect: 'engaged',
  rush_passer: 'engaged',
  defend_run: 'engaged',
  tackle_ball_carrier: 'engaged',
  carry_ball: 'incidental',
  cover_receiver: 'incidental',
  run_route: 'incidental',
  catch_ball: 'incidental',
};

const contactRank = (c: string): number =>
  CONTACT_ORDER.indexOf(c as (typeof CONTACT_ORDER)[number]);

const validateInput = (input: PlayStateInput): FootballRulesV1 => {
  exactKeys(input, INPUT_KEYS, 'play input');
  exactKeys(input.latent, LATENT_KEYS, 'play input latent');
  exactKeys(input.gameState, GAME_STATE_KEYS, 'play input gameState');
  const rules = requireFootballRules(input.ruleset);
  const g = input.gameState;
  if (g.nextSnap !== 'scrimmage')
    fail(
      `the play resolver runs scrimmage plays only, not "${String(g.nextSnap)}"`,
    );
  if (!Number.isSafeInteger(g.playsResolved) || g.playsResolved < 0)
    fail('gameState.playsResolved must be a non-negative integer');
  if (!Number.isSafeInteger(g.period) || g.period < 1)
    fail('gameState.period must be a positive integer');
  if (
    rules.ordering.selectionOrder[0] !== 'offense' ||
    rules.ordering.selectionOrder[1] !== 'defense'
  )
    fail('the play resolver requires offense-then-defense selection order');
  CONTACT_ORDER.forEach((c) => {
    if (!rules.injury.contactClasses.includes(c))
      fail(`the ruleset must declare contact class "${c}"`);
  });
  const eligible = rules.penalties.filter(
    (p) => p.against === 'offense' || p.against === 'defense',
  );
  if (rules.outcome.penaltyChanceBp > 0 && eligible.length === 0)
    fail('the ruleset has no scrimmage penalty to draw');
  return rules;
};

const hasAction = (concept: FootballConceptRule, actionKey: string): boolean =>
  concept.assignments.some((a) => a.actionKey === actionKey);

const validateConcept = (concept: FootballConceptRule): void => {
  if (concept.side === 'offense') {
    if (concept.playCategory === 'run') {
      if (!hasAction(concept, 'carry_ball'))
        fail(`run concept "${concept.conceptKey}" has no ball carrier`);
    } else if (concept.playCategory === 'pass') {
      if (!hasAction(concept, 'throw_pass'))
        fail(`pass concept "${concept.conceptKey}" has no passer`);
      if (!hasAction(concept, 'catch_ball') && !hasAction(concept, 'run_route'))
        fail(`pass concept "${concept.conceptKey}" has no receiver`);
    } else
      fail(
        `offensive concept "${concept.conceptKey}" is not a scrimmage play category`,
      );
  }
};

// ---------------------------------------------------------------------------
// Integer helpers
// ---------------------------------------------------------------------------

const clamp = (n: number, lo: number, hi: number): number =>
  n < lo ? lo : n > hi ? hi : n;

/**
 * A baseline probability moved by a margin. A margin equal to `marginScaleBp` moves the
 * probability by the room the baseline has on its thinner side, so the shift is always
 * proportional to the baseline and the result always stays inside `0..10000`.
 */
const scaledProbabilityBp = (
  baselineBp: number,
  marginBp: number,
  marginScaleBp: number,
): number => {
  const room = Math.min(baselineBp, 10000 - baselineBp);
  return clamp(
    baselineBp + Math.floor((marginBp * room) / marginScaleBp),
    0,
    10000,
  );
};

const meanOf = (values: readonly number[]): number | null =>
  values.length === 0
    ? null
    : Math.floor(values.reduce((a, b) => a + b, 0) / values.length);

const blend = (parts: readonly (number | null)[]): number | null =>
  meanOf(parts.filter((p): p is number => p !== null));

/** Index into `weights` that a draw in `[0, sum)` lands on. */
const weightedIndex = (weights: readonly number[], roll: number): number => {
  let target = roll;
  for (let i = 0; i < weights.length; i++) {
    if (target < weights[i]!) return i;
    target -= weights[i]!;
  }
  return weights.length - 1;
};

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// The resolver
// ---------------------------------------------------------------------------

interface SlotExecution {
  readonly side: 'offense' | 'defense';
  readonly slotKey: string;
  readonly playerId: EntityId;
  readonly actionKey: string;
  readonly responsibilityKey: string;
  readonly schemeKey: string;
  readonly input: FootballActionInput;
  readonly executionBp: number;
  readonly attempted: boolean;
}

const slotPlayer = (lineup: readonly LineupSlot[], slotKey: string): EntityId =>
  lineup.find((s) => s.slotKey === slotKey)!.playerId;

const deriveSide = (
  side: 'offense' | 'defense',
  concept: FootballConceptRule,
  lineup: readonly LineupSlot[],
  rules: FootballRulesV1,
  latent: PlayStateInput['latent'],
): SlotExecution[] => {
  const out: SlotExecution[] = [];
  concept.assignments.forEach((assignment) => {
    assignment.slotKeys.forEach((slotKey) => {
      const playerId = slotPlayer(lineup, slotKey);
      const derived = deriveFootballActionInputFromRules(
        latent,
        rules,
        playerId,
        assignment.actionKey,
        concept.schemeKey,
        assignment.responsibilityKey,
      );
      out.push({
        side,
        slotKey,
        playerId,
        actionKey: assignment.actionKey,
        responsibilityKey: assignment.responsibilityKey,
        schemeKey: concept.schemeKey,
        input: derived,
        executionBp: derived.canAttempt ? derived.executionBp : 0,
        attempted: derived.canAttempt,
      });
    });
  });
  return out;
};

const ofAction = (
  execs: readonly SlotExecution[],
  ...actionKeys: string[]
): SlotExecution[] => execs.filter((e) => actionKeys.includes(e.actionKey));

const groupMean = (execs: readonly SlotExecution[], ...keys: string[]) =>
  meanOf(ofAction(execs, ...keys).map((e) => e.executionBp));

const allMean = (execs: readonly SlotExecution[]): number =>
  meanOf(execs.map((e) => e.executionBp)) ?? 0;

/** One slot per player, keeping the best execution among that slot's actions. */
const bestPerSlot = (execs: readonly SlotExecution[]): SlotExecution[] => {
  const best = new Map<string, SlotExecution>();
  execs.forEach((e) => {
    const held = best.get(e.slotKey);
    if (held === undefined || e.executionBp > held.executionBp)
      best.set(e.slotKey, e);
  });
  return [...best.values()];
};

export const resolvePlay = (
  input: PlayStateInput,
  rng: DeterministicRng,
): {
  readonly resolved: ResolvedPlayDraft;
  readonly nextGameState: GameState;
  readonly rng: DeterministicRng;
  readonly privateTrace: PlayPrivateTrace;
} => {
  const start = rng.snapshot();
  try {
    return resolveInternal(input, rng, start.draws);
  } catch (error) {
    // Whatever failed, the supplied generator is exactly as it was handed in.
    rng.restore(start);
    if (
      error instanceof FootballPlayError ||
      !(
        error instanceof FootballSelectionError ||
        error instanceof FootballActionError ||
        error instanceof FootballUsageError ||
        error instanceof MissingFootballRulesError
      )
    )
      throw error;
    throw new FootballPlayError(error.message);
  }
};

const resolveInternal = (
  input: PlayStateInput,
  rng: DeterministicRng,
  drawStart: number,
) => {
  const rules = validateInput(input);
  const state = input.gameState;
  const outcome = rules.outcome;
  const view = { football: input.football };

  // Separate legitimate information snapshots; either one throws on anything illegal.
  const offenseView = buildOffensiveSelectionView(
    view,
    input.ruleset,
    state.fixtureId,
    state,
  );
  const defenseView = buildDefensiveSelectionView(
    view,
    input.ruleset,
    state.fixtureId,
    state,
  );
  if (offenseView.concepts.length === 0)
    fail('no offensive concept in the game plan can be fielded');
  if (defenseView.concepts.length === 0)
    fail('no defensive concept in the game plan can be fielded');
  const conceptOf = (key: string): FootballConceptRule =>
    rules.concepts.find((c) => c.conceptKey === key)!;
  offenseView.concepts.forEach((c) => validateConcept(conceptOf(c.conceptKey)));
  defenseView.concepts.forEach((c) => validateConcept(conceptOf(c.conceptKey)));

  // ----- Draw bookkeeping -----
  const draws: PlayDrawRecord[] = [];
  const drawInt = (family: PlayDrawFamily, bound: number): number => {
    const before = rng.snapshot().draws;
    const value = rng.nextInt(bound);
    draws.push({ family, bound, value, words: rng.snapshot().draws - before });
    return value;
  };
  const drawSelectionRoll = (family: PlayDrawFamily): number => {
    const before = rng.snapshot().draws;
    const value = rng.nextU32();
    draws.push({
      family,
      bound: 4294967296,
      value,
      words: rng.snapshot().draws - before,
    });
    return value;
  };
  const noiseBound = 2 * outcome.executionNoiseBp + 1;
  const drawNoise = (family: PlayDrawFamily): number =>
    drawInt(family, noiseBound) - outcome.executionNoiseBp;

  // ----- Selection (offense, then defense) -----
  const offenseCall: CommittedOffensiveCall = selectOffensiveCall(offenseView, {
    conceptRoll: drawSelectionRoll('offense_selection'),
    formationRoll: drawSelectionRoll('offense_selection'),
  });
  const defenseCall: CommittedDefensiveCall = selectDefensiveCall(defenseView, {
    conceptRoll: drawSelectionRoll('defense_selection'),
    formationRoll: drawSelectionRoll('defense_selection'),
  });
  const offenseConcept = conceptOf(offenseCall.conceptKey);
  const defenseConcept = conceptOf(defenseCall.conceptKey);
  const pass = offenseConcept.playCategory === 'pass';

  // ----- Latent truth, read only now that both calls are committed -----
  const offExecs = deriveSide(
    'offense',
    offenseConcept,
    offenseCall.lineup,
    rules,
    input.latent,
  );
  const defExecs = deriveSide(
    'defense',
    defenseConcept,
    defenseCall.lineup,
    rules,
    input.latent,
  );

  // ----- Phase 1: pre-snap recognition -----
  const edgeBp =
    rules.matchupEdges.find(
      (e) =>
        e.offenseConceptKey === offenseCall.conceptKey &&
        e.defenseConceptKey === defenseCall.conceptKey,
    )?.edgeBp ?? 0;
  const recognitionNoise = drawNoise('recognition');
  const tacticalBp = clamp(
    edgeBp + Math.floor(recognitionNoise / 3),
    -3000,
    3000,
  );

  // ----- Phase 2: assignment execution -----
  const offenseNoise = drawNoise('execution');
  const defenseNoise = drawNoise('execution');
  const noiseDiff = offenseNoise - defenseNoise;

  // ----- Phase 3: protection / run fit and pressure -----
  const interactionNoise = drawNoise('interaction');
  const offenseAll = allMean(offExecs);
  const defenseAll = allMean(defExecs);

  const runOffense =
    blend([
      groupMean(offExecs, 'carry_ball'),
      groupMean(offExecs, 'run_block'),
      groupMean(offExecs, 'run_route'),
    ]) ?? offenseAll;
  const runDefense =
    blend([
      groupMean(defExecs, 'defend_run'),
      groupMean(defExecs, 'tackle_ball_carrier'),
    ]) ?? defenseAll;
  const passOffense =
    blend([
      groupMean(offExecs, 'throw_pass'),
      groupMean(offExecs, 'read_progression'),
      groupMean(offExecs, 'run_route'),
      groupMean(offExecs, 'catch_ball'),
    ]) ?? offenseAll;
  const protectMean = groupMean(offExecs, 'pass_protect') ?? offenseAll;
  const rushMean = groupMean(defExecs, 'rush_passer') ?? defenseAll;
  const coverMean = groupMean(defExecs, 'cover_receiver') ?? defenseAll;
  const tackleMean =
    blend([
      groupMean(defExecs, 'tackle_ball_carrier'),
      groupMean(defExecs, 'defend_run'),
    ]) ?? defenseAll;

  const pressureMargin = rushMean - protectMean + interactionNoise;
  const runMargin =
    runOffense -
    runDefense +
    tacticalBp +
    noiseDiff +
    Math.floor(interactionNoise / 2);

  let resultKind: PlayResultKind;
  let turnover: 'interception' | 'fumble' | null = null;
  let yardsGained = 0;
  let targetSlot: SlotExecution | null = null;
  let coverSlot: SlotExecution | null = null;
  let tacklerSlot: SlotExecution | null = null;
  let pressureSlot: SlotExecution | null = null;
  let passMargin = 0;
  const lo = -state.yardLine;
  const hi = Math.min(
    outcome.maxPlayYards,
    rules.field.fieldLengthYards - state.yardLine,
  );
  const yardsFromTenths = (tenths: number, min: number): number =>
    clamp(Math.floor(tenths / 10), Math.max(lo, min), hi);

  const rushers = bestPerSlot(ofAction(defExecs, 'rush_passer'));
  const coverers = bestPerSlot(ofAction(defExecs, 'cover_receiver'));
  const receivers = bestPerSlot(
    ofAction(offExecs, 'catch_ball').length > 0
      ? ofAction(offExecs, 'catch_ball')
      : ofAction(offExecs, 'run_route'),
  );

  if (pass) {
    const pSack = scaledProbabilityBp(
      outcome.baselineSackBp,
      pressureMargin,
      outcome.marginScaleBp,
    );
    const sackRoll = drawInt('sack', 10000);
    if (sackRoll < pSack) {
      // ----- Sack -----
      resultKind = 'sack';
      yardsGained = clamp(-(2 + drawInt('sack_loss', 7)), lo, 0);
      const pool = rushers.length > 0 ? rushers : bestPerSlot(defExecs);
      const weights = pool.map((e) => 1000 + e.executionBp);
      pressureSlot =
        pool[weightedIndex(weights, drawInt('defender', sum(weights)))]!;
    } else {
      // ----- Phase 4: progression and target -----
      const targetWeights = receivers.map((e) => 1000 + e.executionBp);
      targetSlot =
        receivers[
          weightedIndex(targetWeights, drawInt('target', sum(targetWeights)))
        ]!;
      const coverPool = coverers;
      const coverIndex = drawInt('defender', Math.max(1, coverPool.length));
      coverSlot = coverPool.length > 0 ? coverPool[coverIndex]! : null;

      // ----- Phase 5: coverage and contest / ball security -----
      const contest =
        targetSlot.executionBp - (coverSlot?.executionBp ?? coverMean);
      passMargin =
        passOffense -
        coverMean +
        tacticalBp +
        noiseDiff -
        Math.floor(Math.max(0, pressureMargin) / 2) +
        Math.floor(contest / 2);
      const pInterception = scaledProbabilityBp(
        outcome.baselineInterceptionBp,
        -passMargin,
        outcome.marginScaleBp,
      );
      if (drawInt('interception', 10000) < pInterception) {
        resultKind = 'interception';
        turnover = 'interception';
      } else {
        const pCompletion = scaledProbabilityBp(
          outcome.baselineCompletionBp,
          passMargin,
          outcome.marginScaleBp,
        );
        if (drawInt('completion', 10000) < pCompletion) {
          resultKind = 'completion';
          const pFumble = scaledProbabilityBp(
            outcome.baselineFumbleBp,
            tackleMean - targetSlot.executionBp,
            outcome.marginScaleBp,
          );
          const fumbled = drawInt('fumble', 10000) < pFumble;
          // ----- Phase 6: ball progression and result -----
          const resultNoise = drawNoise('result');
          yardsGained = yardsFromTenths(
            outcome.baselineCompletionYardsTenths +
              Math.floor(
                ((passMargin + resultNoise) * outcome.yardsPerMarginTenths) /
                  outcome.marginScaleBp,
              ),
            0,
          );
          if (fumbled) {
            resultKind = 'fumble_lost';
            turnover = 'fumble';
          }
        } else resultKind = 'incompletion';
      }
    }
  } else {
    // ----- Run -----
    const carrier = bestPerSlot(ofAction(offExecs, 'carry_ball'))[0]!;
    targetSlot = null;
    const pFumble = scaledProbabilityBp(
      outcome.baselineFumbleBp,
      tackleMean - carrier.executionBp,
      outcome.marginScaleBp,
    );
    const fumbled = drawInt('fumble', 10000) < pFumble;
    const resultNoise = drawNoise('result');
    yardsGained = yardsFromTenths(
      outcome.baselineRushYardsTenths +
        Math.floor(
          ((runMargin + resultNoise) * outcome.yardsPerMarginTenths) /
            outcome.marginScaleBp,
        ),
      lo,
    );
    resultKind = fumbled ? 'fumble_lost' : 'rush';
    if (fumbled) turnover = 'fumble';
  }

  // ----- Phase 7: contact and exposure (who made the tackle) -----
  if (resultKind === 'rush' || resultKind === 'completion') {
    const pool = (() => {
      const direct = bestPerSlot(
        ofAction(defExecs, 'tackle_ball_carrier', 'defend_run'),
      );
      if (direct.length > 0) return direct;
      const cover = bestPerSlot(ofAction(defExecs, 'cover_receiver'));
      if (cover.length > 0) return cover;
      return bestPerSlot(defExecs);
    })();
    const weights = pool.map((e) => 1000 + e.executionBp);
    tacklerSlot =
      pool[weightedIndex(weights, drawInt('tackler', sum(weights)))]!;
  }

  // ----- Phase 8: flags and administration -----
  let penalty: PlayPenaltyFact | null = null;
  const penaltyRoll = drawInt('penalty', 10000);
  if (penaltyRoll < outcome.penaltyChanceBp) {
    const eligible = rules.penalties.filter(
      (p) => p.against === 'offense' || p.against === 'defense',
    );
    const weights = eligible.map((p) => p.weightBp);
    const picked =
      eligible[weightedIndex(weights, drawInt('penalty_kind', sum(weights)))]!;
    const against = picked.against as 'offense' | 'defense';
    penalty = {
      penaltyKey: picked.penaltyKey,
      against,
      againstOrganizationId:
        against === 'offense'
          ? offenseView.organizationId
          : defenseView.organizationId,
      yards: picked.yards,
      automaticFirstDown: picked.automaticFirstDown,
      lossOfDown: picked.lossOfDown,
      enforcement: picked.enforcement,
    };
  }

  // ----- Phase 9: clock, possession, score (bookkeeping only here) -----
  const category = offenseConcept.playCategory;
  const duration = rules.clock.playDurations.find(
    (d) => d.playCategory === category,
  )!;
  const clockSecondsUsed =
    duration.minSeconds +
    drawInt('clock', duration.maxSeconds - duration.minSeconds + 1);

  // ----- Facts -----
  const passerExec = ofAction(offExecs, 'throw_pass')[0];
  const carrierExec = pass
    ? null
    : bestPerSlot(ofAction(offExecs, 'carry_ball'))[0]!;
  const ballCarrier =
    carrierExec ??
    (resultKind === 'completion' || resultKind === 'fumble_lost'
      ? targetSlot
      : null);
  const principals: PlayPrincipals = {
    passerPlayerId: passerExec?.playerId ?? null,
    ballCarrierPlayerId: ballCarrier?.playerId ?? null,
    targetPlayerId: pass ? (targetSlot?.playerId ?? null) : null,
    defenderPlayerId: coverSlot?.playerId ?? null,
    tacklerPlayerId: tacklerSlot?.playerId ?? null,
    pressurePlayerId: pressureSlot?.playerId ?? null,
  };

  const tackled = new Set<string>();
  if (principals.ballCarrierPlayerId !== null)
    tackled.add(principals.ballCarrierPlayerId);
  if (principals.tacklerPlayerId !== null)
    tackled.add(principals.tacklerPlayerId);
  if (resultKind === 'sack') {
    if (principals.passerPlayerId !== null)
      tackled.add(principals.passerPlayerId);
    if (principals.pressurePlayerId !== null)
      tackled.add(principals.pressurePlayerId);
  }

  const participation: PlayParticipationFact[] = [];
  const sides = [
    { side: 'offense' as const, call: offenseCall, execs: offExecs },
    { side: 'defense' as const, call: defenseCall, execs: defExecs },
  ];
  sides.forEach(({ side, call, execs }) => {
    call.lineup.forEach((slot) => {
      const mine = execs.filter(
        (e) => e.slotKey === slot.slotKey && e.attempted,
      );
      const actionKeys = [...new Set(mine.map((e) => e.actionKey))];
      const actionExposures = actionKeys.map((actionKey) => ({
        actionKey,
        attempts: 1,
      }));
      const responsibilityExposures: {
        schemeKey: string;
        responsibilityKey: string;
        meaningfulReps: number;
      }[] = [];
      mine.forEach((e) => {
        if (
          !responsibilityExposures.some(
            (r) =>
              r.schemeKey === e.schemeKey &&
              r.responsibilityKey === e.responsibilityKey,
          )
        )
          responsibilityExposures.push({
            schemeKey: e.schemeKey,
            responsibilityKey: e.responsibilityKey,
            meaningfulReps: 1,
          });
      });
      let contactClass = 'none';
      actionKeys.forEach((a) => {
        const c = ACTION_CONTACT[a] ?? 'none';
        if (contactRank(c) > contactRank(contactClass)) contactClass = c;
      });
      if (tackled.has(slot.playerId)) contactClass = 'tackle';
      participation.push({
        organizationId: call.organizationId,
        side,
        slotKey: slot.slotKey,
        playerId: slot.playerId,
        contactClass,
        workloadUnits: footballWorkloadUnits(rules, actionExposures),
        actionExposures,
        responsibilityExposures,
      });
    });
  });

  const endYard = state.yardLine + yardsGained;
  const sequence = state.playsResolved + 1;
  const privateTrace: PlayPrivateTrace = {
    draws,
    margins: {
      edgeBp,
      tacticalBp,
      runMargin,
      pressureMargin,
      passMargin,
      offenseNoise,
      defenseNoise,
    },
    executions: [...offExecs, ...defExecs].map((e) => ({
      side: e.side,
      slotKey: e.slotKey,
      playerId: e.playerId,
      actionKey: e.actionKey,
      responsibilityKey: e.responsibilityKey,
      executionBp: e.executionBp,
      functionalReadinessBp: e.input.functionalReadinessBp,
      familiarityBp: e.input.familiarityBp,
      attempted: e.attempted,
    })),
  };

  const resolved: ResolvedPlayDraft = {
    fixtureId: state.fixtureId,
    sequence,
    offenseOrganizationId: offenseView.organizationId,
    defenseOrganizationId: defenseView.organizationId,
    pre: {
      period: state.period,
      clockSecondsRemaining: state.clockSecondsRemaining,
      down: state.down,
      yardsToGo: state.yardsToGo,
      yardLine: state.yardLine,
      homeScore: state.homeScore,
      awayScore: state.awayScore,
    },
    offense: {
      conceptKey: offenseCall.conceptKey,
      formationKey: offenseCall.formationKey,
      personnelKey: offenseCall.personnelKey,
      lineup: offenseCall.lineup,
    },
    defense: {
      conceptKey: defenseCall.conceptKey,
      formationKey: defenseCall.formationKey,
      personnelKey: defenseCall.personnelKey,
      lineup: defenseCall.lineup,
    },
    playCategory: category as 'run' | 'pass',
    resultKind,
    yardsGained,
    turnover,
    touchdown: turnover === null && endYard >= rules.field.fieldLengthYards,
    safety: endYard <= 0,
    penalty,
    clockSecondsUsed,
    principals,
    participation,
    rngDrawStart: drawStart,
    rngDrawCount: rng.snapshot().draws - drawStart,
    traceHash: hashCanonical(privateTrace as unknown as CanonicalValue),
  };

  const nextGameState: GameState = {
    ...state,
    playsResolved: sequence,
    clockSecondsRemaining: Math.max(
      0,
      state.clockSecondsRemaining - clockSecondsUsed,
    ),
    resolvedCalls: [
      ...state.resolvedCalls,
      {
        offenseConceptKey: offenseCall.conceptKey,
        defenseConceptKey: defenseCall.conceptKey,
      },
    ],
  };

  return { resolved, nextGameState, rng, privateTrace };
};
