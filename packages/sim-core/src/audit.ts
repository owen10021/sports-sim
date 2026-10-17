import { hashCanonical, isHash } from './hash';
import { deepFreeze } from './world';
import {
  isActorRef,
  isValidId,
  isValidRevision,
  type ActorRef,
  type CommandId,
  type EventId,
  type WorldRevision,
} from './ids';
import { SimDate } from './simDate';
/** JSON-like authoritative data: integers, strings, booleans, null, arrays, plain objects. */
export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

/** Hash that the first event of a career chain links to. */
export const GENESIS_HASH = '0'.repeat(64);

export interface CommandPayloadBase {
  readonly type: string;
}

/** An intent submitted by an actor. Only the World Kernel can turn this into reality. */
export interface CommandEnvelope<C extends CommandPayloadBase = CommandPayloadBase> {
  readonly commandId: CommandId;
  /** The world revision the submitter believes is current (optimistic concurrency). */
  readonly expectedRevision: WorldRevision;
  readonly actor: ActorRef;
  readonly command: C;
}

export type TraceStage = 'validation' | 'authorization' | 'resolution' | 'commit';
export interface TraceStep {
  readonly stage: TraceStage;
  readonly outcome: 'pass' | 'fail';
  readonly detail: string;
}

/** Inspectable record of how the kernel handled one command (for QA and "why" views). */
export interface DecisionTrace {
  readonly commandId: string | null;
  readonly steps: readonly TraceStep[];
}

export interface EventBody {
  readonly eventId: EventId;
  /** World revision AFTER the command that produced this event committed. */
  readonly revision: WorldRevision;
  readonly simDate: string;
  readonly actor: ActorRef;
  readonly commandId: CommandId;
  readonly type: string;
  readonly payload: CanonicalValue;
}

export interface EventEnvelope extends EventBody {
  readonly previousHash: string;
  readonly hash: string;
}

const bodyOf = (e: EventBody): EventBody => ({
  eventId: e.eventId,
  revision: e.revision,
  simDate: e.simDate,
  actor: e.actor,
  commandId: e.commandId,
  type: e.type,
  payload: e.payload,
});

const hashEvent = (previousHash: string, body: EventBody): string =>
  hashCanonical({ previousHash, body: bodyOf(body) });

const isBodyShaped = (e: unknown): e is EventBody => {
  if (typeof e !== 'object' || e === null) return false;
  const v = e as Record<string, unknown>;
  return (
    isValidId(v.eventId) &&
    isValidRevision(v.revision) &&
    SimDate.isValidISO(v.simDate) &&
    isActorRef(v.actor) &&
    isValidId(v.commandId) &&
    typeof v.type === 'string' &&
    v.type.length > 0 &&
    v.payload !== undefined
  );
};

/** Wrap an event body into the next link of the chain. Throws on malformed input. */
export const chainEvent = (previousHash: string, body: EventBody): EventEnvelope => {
  if (!isHash(previousHash)) throw new TypeError('previousHash must be 64 lowercase hex chars');
  if (!isBodyShaped(body)) throw new TypeError('malformed event body');
  return deepFreeze({ ...bodyOf(body), previousHash, hash: hashEvent(previousHash, body) });
};

export type ChainFailureReason =
  | 'MALFORMED'
  | 'BROKEN_LINK'
  | 'HASH_MISMATCH'
  | 'REVISION_ORDER'
  | 'DUPLICATE_EVENT_ID';

export type ChainVerification =
  | { readonly ok: true; readonly headHash: string; readonly count: number }
  | {
      readonly ok: false;
      readonly index: number;
      readonly reason: ChainFailureReason;
      readonly message: string;
    };

/**
 * Verify a chain (or a tail segment) of events. `startPreviousHash` is what the first
 * event must link to: GENESIS_HASH for a full chain, or the prior head for a tail.
 * Note that truncating the END of a chain still verifies; callers must compare the head
 * hash against the head they expect (snapshot / ledger).
 */
export const verifyEventChain = (
  events: readonly EventEnvelope[],
  startPreviousHash: string = GENESIS_HASH,
): ChainVerification => {
  let expectedPrevious = startPreviousHash;
  let lastRevision = -1;
  const seenIds = new Set<string>();
  for (let index = 0; index < events.length; index++) {
    const e = events[index] as EventEnvelope;
    const fail = (reason: ChainFailureReason, message: string): ChainVerification => ({
      ok: false,
      index,
      reason,
      message,
    });
    if (!isBodyShaped(e) || !isHash((e as EventEnvelope).previousHash) || !isHash((e as EventEnvelope).hash)) {
      return fail('MALFORMED', `event ${index} is malformed`);
    }
    if (e.previousHash !== expectedPrevious) {
      return fail('BROKEN_LINK', `event ${index} does not link to the preceding hash`);
    }
    if (hashEvent(e.previousHash, e) !== e.hash) {
      return fail('HASH_MISMATCH', `event ${index} content does not match its hash`);
    }
    if (e.revision < lastRevision) {
      return fail('REVISION_ORDER', `event ${index} revision ${e.revision} precedes ${lastRevision}`);
    }
    if (seenIds.has(e.eventId)) {
      return fail('DUPLICATE_EVENT_ID', `event ${index} reuses id ${e.eventId}`);
    }
    seenIds.add(e.eventId);
    lastRevision = e.revision;
    expectedPrevious = e.hash;
  }
  return { ok: true, headHash: expectedPrevious, count: events.length };
};
