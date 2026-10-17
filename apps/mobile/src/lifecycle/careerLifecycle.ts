import {
  WorldKernel,
  commandId,
  createWorld,
  currentModelFingerprintOf,
  loadCareer,
  sealSnapshot,
  type ActorRef,
  type CareerSnapshot,
  type CareerStore,
  type CommandEnvelope,
  type CommitRecord,
  type IdSource,
  type LeagueRulesetManifest,
  type LoadOutcome,
  type Rejection,
  type RecoveryReport,
  type WorldSeedManifest,
} from '@sport-sim/sim-core';

/** Subset of React Native's AppState values. */
export type LifecycleEvent = 'active' | 'inactive' | 'background';

export interface CareerLifecycleDeps {
  readonly store: CareerStore;
  readonly ruleset: LeagueRulesetManifest;
  readonly seed: WorldSeedManifest;
  readonly idSource: IdSource;
  /** Who the UI acts as when it submits commands. */
  readonly actor: ActorRef;
}

export type CareerStatus = 'closed' | 'empty' | 'ready' | 'degraded' | 'failed';

export interface CareerView {
  readonly status: CareerStatus;
  readonly worldId: string | null;
  readonly simDate: string | null;
  readonly revision: number | null;
  readonly eventCount: number | null;
  readonly fingerprint: string | null;
  readonly chainHead: string | null;
  /** Committed by the kernel but not yet durably saved. */
  readonly pendingCommits: number;
  readonly savedRevision: number | null;
  /** Set when the last load had to recover stored data. */
  readonly recovery: RecoveryReport | null;
  readonly lastSaveError: string | null;
}

export type AdvanceResult =
  | { readonly ok: true; readonly saved: boolean; readonly saveError?: string }
  | { readonly ok: false; readonly rejection: Rejection };

/**
 * Coordinates the WorldKernel with durable storage for an app that can be backgrounded or
 * killed at any moment. Rules it enforces:
 *  - the kernel is the only thing that changes the career; this class never fabricates a
 *    command, and lifecycle events only FLUSH results the kernel already committed;
 *  - saves are single-flight and in order, and retrying one never re-simulates it;
 *  - repeated or out-of-order lifecycle events are harmless.
 */
export class CareerLifecycle {
  readonly #deps: CareerLifecycleDeps;
  #status: CareerStatus = 'closed';
  #kernel: WorldKernel | null = null;
  #readOnlySnapshot: CareerSnapshot | null = null;
  #recovery: RecoveryReport | null = null;
  #savedRevision: number | null = null;
  #lastSaveError: string | null = null;
  readonly #pending: CommitRecord[] = [];
  #draining: Promise<void> | null = null;

  constructor(deps: CareerLifecycleDeps) {
    this.#deps = deps;
  }

  get kernel(): WorldKernel | null {
    return this.#kernel;
  }

  get store(): CareerStore {
    return this.#deps.store;
  }

  /** Initialise storage and load (and if needed repair) the saved career. */
  async open(): Promise<LoadOutcome> {
    await this.#deps.store.initialize();
    const outcome = await loadCareer(this.#deps.store, {
      ruleset: this.#deps.ruleset,
      seed: this.#deps.seed,
      repair: true,
    });
    this.#kernel = null;
    this.#readOnlySnapshot = null;
    this.#recovery = null;
    this.#pending.length = 0;
    switch (outcome.status) {
      case 'empty':
        this.#status = 'empty';
        break;
      case 'loaded':
        this.#status = 'ready';
        this.#kernel = outcome.kernel;
        this.#savedRevision = outcome.snapshot.revision;
        break;
      case 'recovered':
        this.#status = 'ready';
        this.#kernel = outcome.kernel;
        this.#savedRevision = outcome.snapshot.revision;
        this.#recovery = outcome.report;
        break;
      case 'degraded':
        this.#status = 'degraded';
        this.#readOnlySnapshot = outcome.snapshot;
        this.#savedRevision = outcome.snapshot.revision;
        this.#recovery = outcome.report;
        break;
      case 'failed':
        this.#status = 'failed';
        this.#recovery = outcome.report;
        break;
    }
    return outcome;
  }

  /** Create and durably save a brand-new synthetic career. Never overwrites one. */
  async createCareer(): Promise<void> {
    if (this.#status === 'closed')
      throw new Error('Call open() before createCareer()');
    if (this.#status !== 'empty')
      throw new Error('A career already exists; refusing to overwrite it');
    const world = createWorld(
      this.#deps.seed,
      this.#deps.ruleset,
      this.#deps.idSource,
    );
    const kernel = WorldKernel.fromGenesis(world, this.#deps.ruleset);
    const genesis: CommitRecord = {
      snapshot: this.#snapshotOf(kernel),
      commands: [],
      events: [],
    };
    await this.#deps.store.saveCommit(genesis);
    this.#kernel = kernel;
    this.#savedRevision = 0;
    this.#status = 'ready';
  }

  /** Submit an AdvanceDays command to the kernel, then persist its committed result. */
  async advance(days: number): Promise<AdvanceResult> {
    const kernel = this.#kernel;
    if (kernel === null || this.#status !== 'ready')
      throw new Error('No writable career is loaded');
    const envelope = {
      commandId: commandId(
        `cmd-${String(kernel.knownCommandIds.length + 1).padStart(6, '0')}`,
      ),
      expectedRevision: kernel.world.revision,
      actor: this.#deps.actor,
      command: { type: 'AdvanceDays', days },
    } as unknown as CommandEnvelope;
    const result = kernel.execute(envelope);
    if (!result.ok) return { ok: false, rejection: result.rejection };
    this.#pending.push({
      snapshot: this.#snapshotOf(kernel),
      commands: [{ envelope, resultRevision: Number(result.world.revision) }],
      events: result.events,
    });
    try {
      await this.flush();
      return { ok: true, saved: true };
    } catch (error) {
      return {
        ok: true,
        saved: false,
        saveError: this.#lastSaveError ?? String(error),
      };
    }
  }

  /** Persist everything the kernel has committed. Single-flight; safe to call repeatedly. */
  async flush(): Promise<void> {
    for (;;) {
      if (this.#draining === null) {
        if (this.#pending.length === 0) return;
        this.#draining = this.#drain().finally(() => {
          this.#draining = null;
        });
      }
      await this.#draining;
      if (this.#pending.length === 0) return;
    }
  }

  async #drain(): Promise<void> {
    while (this.#pending.length > 0) {
      const next = this.#pending[0] as CommitRecord;
      try {
        await this.#deps.store.saveCommit(next);
      } catch (error) {
        this.#lastSaveError =
          error instanceof Error ? error.message : String(error);
        throw error;
      }
      this.#pending.shift();
      this.#savedRevision = next.snapshot.revision;
      this.#lastSaveError = null;
    }
  }

  /**
   * React to app lifecycle changes. Only flushes already-committed results; it never
   * creates commands. Never throws: a failed flush stays pending for the next event.
   */
  async handleLifecycle(event: LifecycleEvent): Promise<void> {
    if (event === 'active' && this.#pending.length === 0) return;
    try {
      await this.flush();
    } catch {
      /* recorded in lastSaveError; the commit remains pending */
    }
  }

  view(): CareerView {
    const kernel = this.#kernel;
    const snapshot = this.#readOnlySnapshot;
    const world = kernel?.world ?? snapshot?.world ?? null;
    return {
      status: this.#status,
      worldId: world?.worldId ?? null,
      simDate: world?.simDate ?? null,
      revision: world === null ? null : Number(world.revision),
      eventCount: kernel?.eventCount ?? snapshot?.eventCount ?? null,
      // A read-only snapshot may be a Package A world; show its current-model fingerprint.
      fingerprint: world === null ? null : currentModelFingerprintOf(world),
      chainHead: kernel?.chainHead ?? snapshot?.chainHead ?? null,
      pendingCommits: this.#pending.length,
      savedRevision: this.#savedRevision,
      recovery: this.#recovery,
      lastSaveError: this.#lastSaveError,
    };
  }

  #snapshotOf(kernel: WorldKernel): CareerSnapshot {
    return sealSnapshot({
      world: kernel.world,
      chainHead: kernel.chainHead,
      eventCount: kernel.eventCount,
      knownCommandIds: kernel.knownCommandIds,
    });
  }
}
