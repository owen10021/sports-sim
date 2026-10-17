import {
  GENESIS_HASH,
  chainEvents,
  type CommandEnvelope,
  type CommandPayloadBase,
  type DecisionTrace,
  type EventEnvelope,
  type TraceStep,
} from './audit';
import {
  isRoutableCommandType,
  routeCommand,
  type RouteContext,
  type RouteOutcome,
} from './commandRouter';
import { isHash } from './hash';
import {
  eventId,
  isActorRef,
  isValidId,
  isValidRevision,
  worldRevision,
} from './ids';
import {
  rulesetRefOf,
  validateRulesetManifest,
  type LeagueRulesetManifest,
} from './ruleset';
import { deepFreeze, type FootballWorld } from './world';
import {
  assertCurrentWorld,
  requireCurrentWorld,
  type StoredWorld,
} from './worldModel';

export type RejectionCode =
  | 'SCHEMA_INVALID'
  | 'STALE_REVISION'
  | 'DUPLICATE_COMMAND'
  | 'INVALID_PAYLOAD'
  | 'UNAUTHORIZED_ACTOR'
  | 'INSUFFICIENT_AUTHORITY'
  | 'PROTECTED_CONSTRAINT'
  | 'INTERNAL_ERROR';

export interface Rejection {
  readonly code: RejectionCode;
  readonly message: string;
}

export type ExecuteResult =
  | {
      readonly ok: true;
      readonly world: FootballWorld;
      readonly events: readonly EventEnvelope[];
      readonly trace: DecisionTrace;
    }
  | {
      readonly ok: false;
      readonly rejection: Rejection;
      readonly trace: DecisionTrace;
    };

export interface KernelOptions {
  /** Fault-injection seam: runs after resolution, before anything is committed. */
  readonly beforeCommit?: () => void;
  /**
   * TEST-ONLY seam: replaces the static 
outeCommand so tests can exercise the commit
   * path with multi-event or malformed resolutions. Production code never sets this;
   * authoritative dispatch is always the static, exhaustive 
outeCommand.
   */
  readonly testRouter?: (ctx: RouteContext) => RouteOutcome;
}

export interface KernelResumeState {
  /** Current world, or a Package A world that is migrated here (the one load boundary). */
  readonly world: StoredWorld;
  readonly ruleset: LeagueRulesetManifest;
  readonly chainHead: string;
  readonly eventCount: number;
  readonly knownCommandIds: readonly string[];
}

const eventIdFor = (ordinal: number) =>
  eventId(`evt-${String(ordinal).padStart(6, '0')}`);

/**
 * The only component allowed to change the world.
 * Pipeline: Intent -> Validation -> Authorization -> Resolution -> Commit -> Event.
 * Any rejection or fault leaves world, RNG, known command ids and audit chain untouched.
 */
export class WorldKernel {
  #world: FootballWorld;
  readonly #ruleset: LeagueRulesetManifest;
  #chainHead: string;
  #eventCount: number;
  readonly #events: EventEnvelope[] = [];
  readonly #known: Set<string>;
  readonly #beforeCommit: (() => void) | undefined;
  readonly #route: (ctx: RouteContext) => RouteOutcome;

  private constructor(
    world: FootballWorld,
    ruleset: LeagueRulesetManifest,
    chainHead: string,
    eventCount: number,
    known: Iterable<string>,
    options: KernelOptions,
  ) {
    const validated = validateRulesetManifest(ruleset);
    const ref = rulesetRefOf(validated);
    if (
      ref.rulesetId !== world.ruleset.rulesetId ||
      ref.rulesetVersion !== world.ruleset.rulesetVersion ||
      ref.contentHash !== world.ruleset.contentHash
    ) {
      throw new Error('ruleset does not match the world ruleset reference');
    }
    if (!isHash(chainHead))
      throw new Error('chainHead must be a 64-char lowercase hex hash');
    if (!Number.isSafeInteger(eventCount) || eventCount < 0)
      throw new Error('invalid eventCount');
    this.#world = world;
    this.#ruleset = validated;
    this.#chainHead = chainHead;
    this.#eventCount = eventCount;
    this.#known = new Set(known);
    this.#beforeCommit = options.beforeCommit;
    this.#route = options.testRouter ?? routeCommand;
  }

  static fromGenesis(
    world: FootballWorld,
    ruleset: LeagueRulesetManifest,
    options: KernelOptions = {},
  ): WorldKernel {
    assertCurrentWorld(world);
    if (world.revision !== 0 || world.nextIds.event !== 1) {
      throw new Error('fromGenesis requires an untouched genesis world');
    }
    return new WorldKernel(world, ruleset, GENESIS_HASH, 0, [], options);
  }

  static resume(
    state: KernelResumeState,
    options: KernelOptions = {},
  ): WorldKernel {
    const world = requireCurrentWorld(state.world);
    if (state.eventCount + 1 !== world.nextIds.event) {
      throw new Error('eventCount does not agree with world.nextIds.event');
    }
    return new WorldKernel(
      world,
      state.ruleset,
      state.chainHead,
      state.eventCount,
      state.knownCommandIds,
      options,
    );
  }

  get world(): FootballWorld {
    return this.#world;
  }
  get chainHead(): string {
    return this.#chainHead;
  }
  /** Total events ever committed for this career (not just those since resume). */
  get eventCount(): number {
    return this.#eventCount;
  }
  /** Events committed by this kernel instance, in order. */
  get events(): readonly EventEnvelope[] {
    return this.#events;
  }
  get knownCommandIds(): readonly string[] {
    return [...this.#known].sort();
  }

  execute(input: CommandEnvelope): ExecuteResult {
    const steps: TraceStep[] = [];
    const reject = (
      stage: TraceStep['stage'],
      code: RejectionCode,
      message: string,
      commandId: string | null,
    ): ExecuteResult => {
      steps.push({ stage, outcome: 'fail', detail: `${code}: ${message}` });
      return {
        ok: false,
        rejection: { code, message },
        trace: deepFreeze({ commandId, steps }),
      };
    };

    // --- Validation: envelope shape ---
    const env = input as unknown as Record<string, unknown> | null;
    if (
      typeof env !== 'object' ||
      env === null ||
      !isValidId(env.commandId) ||
      !isValidRevision(env.expectedRevision) ||
      !isActorRef(env.actor) ||
      typeof env.command !== 'object' ||
      env.command === null
    ) {
      return reject(
        'validation',
        'SCHEMA_INVALID',
        'malformed command envelope',
        null,
      );
    }
    const cid = env.commandId as string;
    const command = env.command as CommandPayloadBase;
    if (
      typeof command.type !== 'string' ||
      !isRoutableCommandType(command.type)
    ) {
      return reject(
        'validation',
        'SCHEMA_INVALID',
        'unknown command type',
        cid,
      );
    }
    if (this.#known.has(cid)) {
      return reject(
        'validation',
        'DUPLICATE_COMMAND',
        `command ${cid} was already committed`,
        cid,
      );
    }
    if (env.expectedRevision !== this.#world.revision) {
      return reject(
        'validation',
        'STALE_REVISION',
        `expected revision ${String(env.expectedRevision)} but world is at ${this.#world.revision}`,
        cid,
      );
    }
    const routed = this.#route({
      world: this.#world,
      ruleset: this.#ruleset,
      actor: env.actor as CommandEnvelope['actor'],
      commandId: env.commandId as CommandEnvelope['commandId'],
      command,
    });
    if (!routed.ok) {
      if (routed.stage === 'authorization') {
        steps.push({
          stage: 'validation',
          outcome: 'pass',
          detail: 'envelope, revision and payload valid',
        });
      }
      return reject(routed.stage, routed.code, routed.message, cid);
    }
    steps.push({
      stage: 'validation',
      outcome: 'pass',
      detail: 'envelope, revision and payload valid',
    });
    steps.push({
      stage: 'authorization',
      outcome: 'pass',
      detail: routed.authorizationDetail,
    });

    try {
      // --- Resolution (pure; the router worked on copies only) ---
      const { nextWorld: resolved, eventSpecs, detail } = routed.resolution;
      if (eventSpecs.length < 1) {
        throw new Error('an accepted command must emit at least one event');
      }
      steps.push({ stage: 'resolution', outcome: 'pass', detail });

      // One accepted command = exactly one revision, however many events it emits.
      const world = this.#world;
      const revision = worldRevision(Number(world.revision) + 1);
      const events = chainEvents(
        this.#chainHead,
        eventSpecs.map((spec, index) => ({
          eventId: eventIdFor(world.nextIds.event + index),
          revision,
          simDate: resolved.simDate,
          actor: env.actor as CommandEnvelope['actor'],
          commandId: env.commandId as CommandEnvelope['commandId'],
          type: spec.type,
          payload: spec.payload,
        })),
      );
      const nextWorld = deepFreeze({
        ...resolved,
        revision,
        nextIds: {
          ...resolved.nextIds,
          event: world.nextIds.event + events.length,
        },
      });

      this.#beforeCommit?.();

      // --- Commit (all-or-nothing: nothing above has touched kernel state) ---
      steps.push({
        stage: 'commit',
        outcome: 'pass',
        detail: `committed revision ${revision}`,
      });
      this.#world = nextWorld;
      this.#chainHead = (events[events.length - 1] as EventEnvelope).hash;
      this.#eventCount += events.length;
      this.#events.push(...events);
      this.#known.add(cid);
      return {
        ok: true,
        world: nextWorld,
        events,
        trace: deepFreeze({ commandId: cid, steps }),
      };
    } catch (error) {
      steps.length = 2;
      return reject(
        'commit',
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'unexpected failure',
        cid,
      );
    }
  }
}
