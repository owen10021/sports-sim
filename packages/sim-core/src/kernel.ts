import {
  GENESIS_HASH,
  chainEvent,
  type CommandEnvelope,
  type DecisionTrace,
  type EventEnvelope,
  type TraceStep,
} from './audit';
import { isHash } from './hash';
import { eventId, isActorRef, isValidId, isValidRevision, worldRevision } from './ids';
import { DeterministicRng } from './rng';
import { rulesetRefOf, validateRulesetManifest, type LeagueRulesetManifest } from './ruleset';
import { SimDate } from './simDate';
import { deepFreeze, type FootballWorld } from './world';

export type RejectionCode =
  | 'SCHEMA_INVALID'
  | 'STALE_REVISION'
  | 'DUPLICATE_COMMAND'
  | 'INVALID_PAYLOAD'
  | 'UNAUTHORIZED_ACTOR'
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
  | { readonly ok: false; readonly rejection: Rejection; readonly trace: DecisionTrace };

export interface KernelOptions {
  /** Fault-injection seam: runs after resolution, before anything is committed. */
  readonly beforeCommit?: () => void;
}

export interface KernelResumeState {
  readonly world: FootballWorld;
  readonly ruleset: LeagueRulesetManifest;
  readonly chainHead: string;
  readonly eventCount: number;
  readonly knownCommandIds: readonly string[];
}

/** Actors that may advance the calendar. CPU orgs and delegates may not. */
const CALENDAR_AUTHORITY: ReadonlySet<string> = new Set([
  'human_gm',
  'commissioner',
  'system',
  'test_harness',
]);

const KNOWN_COMMANDS: ReadonlySet<string> = new Set(['AdvanceDays']);

const eventIdFor = (ordinal: number) => eventId(`evt-${String(ordinal).padStart(6, '0')}`);

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
    if (!isHash(chainHead)) throw new Error('chainHead must be a 64-char lowercase hex hash');
    if (!Number.isSafeInteger(eventCount) || eventCount < 0) throw new Error('invalid eventCount');
    this.#world = world;
    this.#ruleset = validated;
    this.#chainHead = chainHead;
    this.#eventCount = eventCount;
    this.#known = new Set(known);
    this.#beforeCommit = options.beforeCommit;
  }

  static fromGenesis(
    world: FootballWorld,
    ruleset: LeagueRulesetManifest,
    options: KernelOptions = {},
  ): WorldKernel {
    if (world.revision !== 0 || world.nextIds.event !== 1) {
      throw new Error('fromGenesis requires an untouched genesis world');
    }
    return new WorldKernel(world, ruleset, GENESIS_HASH, 0, [], options);
  }

  static resume(state: KernelResumeState, options: KernelOptions = {}): WorldKernel {
    if (state.eventCount + 1 !== state.world.nextIds.event) {
      throw new Error('eventCount does not agree with world.nextIds.event');
    }
    return new WorldKernel(
      state.world,
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
      return { ok: false, rejection: { code, message }, trace: deepFreeze({ commandId, steps }) };
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
      return reject('validation', 'SCHEMA_INVALID', 'malformed command envelope', null);
    }
    const cid = env.commandId as string;
    const command = env.command as { type?: unknown; days?: unknown };
    if (typeof command.type !== 'string' || !KNOWN_COMMANDS.has(command.type)) {
      return reject('validation', 'SCHEMA_INVALID', 'unknown command type', cid);
    }
    if (this.#known.has(cid)) {
      return reject('validation', 'DUPLICATE_COMMAND', `command ${cid} was already committed`, cid);
    }
    if (env.expectedRevision !== this.#world.revision) {
      return reject(
        'validation',
        'STALE_REVISION',
        `expected revision ${String(env.expectedRevision)} but world is at ${this.#world.revision}`,
        cid,
      );
    }
    const max = this.#ruleset.rules.maxAdvanceDaysPerCommand;
    const days = command.days;
    if (typeof days !== 'number' || !Number.isSafeInteger(days) || days < 1 || days > max) {
      return reject('validation', 'INVALID_PAYLOAD', `days must be an integer in 1..${max}`, cid);
    }
    steps.push({ stage: 'validation', outcome: 'pass', detail: 'envelope, revision and payload valid' });

    // --- Authorization ---
    const actor = env.actor as CommandEnvelope['actor'];
    if (!CALENDAR_AUTHORITY.has(actor.kind)) {
      return reject('authorization', 'UNAUTHORIZED_ACTOR', `${actor.kind} cannot advance the calendar`, cid);
    }
    steps.push({ stage: 'authorization', outcome: 'pass', detail: `${actor.kind} may advance the calendar` });

    try {
      // --- Resolution (pure; works on copies only) ---
      const world = this.#world;
      const rng = DeterministicRng.fromState(world.rng);
      const start = SimDate.parse(world.simDate);
      const dayRolls: { date: string; roll: number }[] = [];
      for (let i = 1; i <= days; i++) {
        dayRolls.push({ date: start.addDays(i).toISO(), roll: rng.nextU32() });
      }
      const toDate = start.addDays(days).toISO();
      steps.push({ stage: 'resolution', outcome: 'pass', detail: `advanced ${days} day(s) to ${toDate}` });

      const revision = worldRevision(Number(world.revision) + 1);
      const event = chainEvent(this.#chainHead, {
        eventId: eventIdFor(world.nextIds.event),
        revision,
        simDate: toDate,
        actor,
        commandId: env.commandId as CommandEnvelope['commandId'],
        type: 'DaysAdvanced',
        payload: { fromDate: world.simDate, toDate, days, dayRolls },
      });
      const nextWorld = deepFreeze({
        ...world,
        simDate: toDate,
        revision,
        rng: rng.snapshot(),
        nextIds: { event: world.nextIds.event + 1 },
      });

      this.#beforeCommit?.();

      // --- Commit (all-or-nothing: nothing above has touched kernel state) ---
      steps.push({ stage: 'commit', outcome: 'pass', detail: `committed revision ${revision}` });
      this.#world = nextWorld;
      this.#chainHead = event.hash;
      this.#eventCount += 1;
      this.#events.push(event);
      this.#known.add(cid);
      return { ok: true, world: nextWorld, events: [event], trace: deepFreeze({ commandId: cid, steps }) };
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
