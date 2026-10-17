import type { CanonicalValue, CommandPayloadBase } from './audit';
import type { ActorRef, CommandId } from './ids';
import type { LeagueRulesetManifest } from './ruleset';
import { DeterministicRng } from './rng';
import { SimDate } from './simDate';
import type { FootballWorld } from './world';

/** One event a command wants recorded. The kernel assigns id, revision, date and hash. */
export interface EventSpec {
  readonly type: string;
  readonly payload: CanonicalValue;
}

/**
 * The pure result of resolving one command. `nextWorld` carries domain changes
 * only: the kernel alone advances `revision` and `nextIds.event`, and commits.
 */
export interface CommandResolution {
  readonly nextWorld: FootballWorld;
  /** Events in deterministic order; all are committed at the same revision. */
  readonly eventSpecs: readonly EventSpec[];
  readonly detail: string;
}

export interface RouteContext {
  readonly world: FootballWorld;
  readonly ruleset: LeagueRulesetManifest;
  readonly actor: ActorRef;
  readonly commandId: CommandId;
  readonly command: CommandPayloadBase;
}

export type RouterRejectionCode = 'INVALID_PAYLOAD' | 'UNAUTHORIZED_ACTOR';

export type RouteOutcome =
  | {
      readonly ok: true;
      readonly authorizationDetail: string;
      readonly resolution: CommandResolution;
    }
  | {
      readonly ok: false;
      readonly stage: 'validation' | 'authorization';
      readonly code: RouterRejectionCode;
      readonly message: string;
    };

interface AdvanceDaysCommand extends CommandPayloadBase {
  readonly type: 'AdvanceDays';
  readonly days: unknown;
}

/** Every command the kernel can route. Add a member here and the switch below must handle it. */
type RoutableCommand = AdvanceDaysCommand;

const ROUTABLE_TYPES: Readonly<Record<RoutableCommand['type'], true>> = {
  AdvanceDays: true,
};

export const isRoutableCommandType = (type: string): boolean =>
  Object.prototype.hasOwnProperty.call(ROUTABLE_TYPES, type);

/** Actors that may advance the calendar. CPU orgs and delegates may not. */
const CALENDAR_AUTHORITY: ReadonlySet<string> = new Set([
  'human_gm',
  'commissioner',
  'system',
  'test_harness',
]);

const routeAdvanceDays = (
  ctx: RouteContext,
  command: AdvanceDaysCommand,
): RouteOutcome => {
  const max = ctx.ruleset.rules.maxAdvanceDaysPerCommand;
  const days = command.days;
  if (
    typeof days !== 'number' ||
    !Number.isSafeInteger(days) ||
    days < 1 ||
    days > max
  ) {
    return {
      ok: false,
      stage: 'validation',
      code: 'INVALID_PAYLOAD',
      message: `days must be an integer in 1..${max}`,
    };
  }
  if (!CALENDAR_AUTHORITY.has(ctx.actor.kind)) {
    return {
      ok: false,
      stage: 'authorization',
      code: 'UNAUTHORIZED_ACTOR',
      message: `${ctx.actor.kind} cannot advance the calendar`,
    };
  }

  const world = ctx.world;
  const rng = DeterministicRng.fromState(world.rng);
  const start = SimDate.parse(world.simDate);
  const dayRolls: { date: string; roll: number }[] = [];
  for (let i = 1; i <= days; i++) {
    dayRolls.push({ date: start.addDays(i).toISO(), roll: rng.nextU32() });
  }
  const toDate = start.addDays(days).toISO();
  return {
    ok: true,
    authorizationDetail: `${ctx.actor.kind} may advance the calendar`,
    resolution: {
      nextWorld: { ...world, simDate: toDate, rng: rng.snapshot() },
      eventSpecs: [
        {
          type: 'DaysAdvanced',
          payload: { fromDate: world.simDate, toDate, days, dayRolls },
        },
      ],
      detail: `advanced ${days} day(s) to ${toDate}`,
    },
  };
};

/**
 * Static, exhaustive dispatch from a command to its pure resolution:
 * payload validation, command-specific authorization, then resolution.
 * Never mutates the world it is given. The caller must already have checked
 * `isRoutableCommandType`, the envelope, duplicate ids and revision freshness.
 */
export const routeCommand = (ctx: RouteContext): RouteOutcome => {
  const command = ctx.command as RoutableCommand;
  switch (command.type) {
    case 'AdvanceDays':
      return routeAdvanceDays(ctx, command);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable command type: ${String(unreachable)}`);
    }
  }
};
