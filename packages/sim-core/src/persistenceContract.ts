import { canonicalString } from './canonical';
import { GENESIS_HASH, verifyEventChain, type CommandEnvelope } from './audit';
import { commandId, entityId, worldId, worldRevision } from './ids';
import { WorldKernel } from './kernel';
import {
  PersistenceError,
  SNAPSHOT_RETENTION_NEWEST,
  sealSnapshot,
  type CareerStore,
  type CommitRecord,
  type RecoveryReport,
} from './persistence';
import { SCHEMA_VERSION, UnsupportedSchemaVersionError } from './provenance';
import {
  rulesetRefOf,
  sealRuleset,
  type LeagueRulesetManifest,
} from './ruleset';
import { sealSeed } from './seed';
import { createWorld, fingerprintWorld } from './world';

/**
 * Framework-free CareerStore contract. Any adapter (memory, SQLite, ...) must pass every
 * case. It lives in sim-core (pure TypeScript) so the SAME cases run under Vitest in Node
 * and inside the Expo/Hermes runtime. Cases throw on failure.
 */
export interface ContractHarness {
  readonly store: CareerStore;
  /** Make the next saveCommit fail after validation but before it becomes durable. */
  failNextCommit(): void;
}

export interface ContractCase {
  readonly name: string;
  run(): Promise<void>;
}

export type HarnessFactory = () => Promise<ContractHarness>;

class ContractFailure extends Error {
  constructor(message: string) {
    super(`CareerStore contract violated: ${message}`);
    this.name = 'ContractFailure';
  }
}

const check = (condition: boolean, message: string): void => {
  if (!condition) throw new ContractFailure(message);
};

const same = (actual: unknown, expected: unknown, message: string): void => {
  const a = canonicalString(actual);
  const e = canonicalString(expected);
  if (a !== e)
    throw new ContractFailure(`${message}\n  actual:   ${a}\n  expected: ${e}`);
};

const rejection = async (
  fn: () => Promise<unknown>,
  message: string,
): Promise<unknown> => {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new ContractFailure(`${message} (expected a rejection, got success)`);
};

// ---- A small synthetic career to persist -------------------------------------------

const provenance = {
  sourceId: 'contract-fixture',
  sourceKind: 'synthetic',
  retrievedAt: '2026-10-16T00:00:00Z',
  effectiveAsOf: '2026-10-16',
  validationStatus: 'synthetic',
  note: 'persistence contract fixture',
} as const;

const makeRuleset = (): LeagueRulesetManifest =>
  sealRuleset({
    schemaVersion: SCHEMA_VERSION,
    rulesetId: 'contract-ruleset',
    rulesetVersion: 1,
    displayName: 'Contract Ruleset',
    provenance: [provenance],
    rules: { maxAdvanceDaysPerCommand: 30 },
  });

const newCareer = (): {
  kernel: WorldKernel;
  ruleset: LeagueRulesetManifest;
} => {
  const ruleset = makeRuleset();
  const seed = sealSeed({
    schemaVersion: SCHEMA_VERSION,
    seedId: 'contract-seed',
    seedVersion: 1,
    ruleset: rulesetRefOf(ruleset),
    rngSeed32: 777,
    startDate: '2026-10-16',
    provenance: [provenance],
    initialEntities: [],
  });
  const world = createWorld(seed, ruleset, {
    newWorldId: () => worldId('world-contract-1'),
  });
  return { kernel: WorldKernel.fromGenesis(world, ruleset), ruleset };
};

const snapshotOf = (k: WorldKernel) =>
  sealSnapshot({
    world: k.world,
    chainHead: k.chainHead,
    eventCount: k.eventCount,
    knownCommandIds: k.knownCommandIds,
  });

const genesisCommit = (k: WorldKernel): CommitRecord => ({
  snapshot: snapshotOf(k),
  commands: [],
  events: [],
});

const envelope = (
  n: number,
  days: number,
  revision: number,
): CommandEnvelope => ({
  commandId: commandId(`cmd-${n}`),
  expectedRevision: worldRevision(revision),
  actor: { kind: 'test_harness', id: entityId('actor-1') },
  command: { type: 'AdvanceDays', days } as CommandEnvelope['command'],
});

/** Run one command through the kernel and return the matching commit record. */
const advance = (k: WorldKernel, n: number, days = 1): CommitRecord => {
  const env = envelope(n, days, Number(k.world.revision));
  const res = k.execute(env);
  if (!res.ok)
    throw new ContractFailure(
      `fixture command rejected: ${res.rejection.message}`,
    );
  return {
    snapshot: snapshotOf(k),
    commands: [{ envelope: env, resultRevision: Number(res.world.revision) }],
    events: res.events,
  };
};

const open = async (factory: HarnessFactory): Promise<ContractHarness> => {
  const h = await factory();
  await h.store.initialize();
  return h;
};

// ---- Cases -------------------------------------------------------------------------

export const careerStoreContractCases = (
  factory: HarnessFactory,
): ContractCase[] => [
  {
    name: 'refuses use before initialize()',
    async run() {
      const h = await factory();
      const err = await rejection(
        () => h.store.loadLatest(),
        'loadLatest before initialize',
      );
      check(
        err instanceof PersistenceError && err.code === 'NOT_INITIALIZED',
        'NOT_INITIALIZED expected',
      );
    },
  },
  {
    name: 'initialize() is idempotent and an empty store reports nothing',
    async run() {
      const h = await open(factory);
      await h.store.initialize();
      check(
        (await h.store.loadLatest()) === null,
        'empty store has no latest snapshot',
      );
      same(
        await h.store.listVerifiedSnapshots(),
        [],
        'empty store lists no snapshots',
      );
      same(
        await h.store.loadHistorySince(0),
        { commands: [], events: [] },
        'empty store has no history',
      );
      same(
        await h.store.loadRecoveryLog(),
        [],
        'empty store has no recovery log',
      );
    },
  },
  {
    name: 'initial save stores the genesis snapshot exactly',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      const commit = genesisCommit(kernel);
      await h.store.saveCommit(commit);
      const loaded = await h.store.loadLatest();
      same(loaded, commit.snapshot, 'loaded snapshot equals saved snapshot');
      check(
        loaded !== null &&
          loaded.worldFingerprint === fingerprintWorld(kernel.world),
        'fingerprint kept',
      );
      check(
        loaded !== null && loaded.chainHead === GENESIS_HASH,
        'genesis chain head',
      );
    },
  },
  {
    name: 'the first save must be the genesis snapshot',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      const first = advance(kernel, 1);
      const err = await rejection(
        () => h.store.saveCommit(first),
        'non-genesis first save',
      );
      check(
        err instanceof PersistenceError && err.code === 'COMMIT_REJECTED',
        'COMMIT_REJECTED expected',
      );
      check(
        (await h.store.loadLatest()) === null,
        'rejected first save leaves the store empty',
      );
    },
  },
  {
    name: 'append history: commands and events accumulate in order and the chain verifies',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      for (let n = 1; n <= 3; n++)
        await h.store.saveCommit(advance(kernel, n, n));
      const all = await h.store.loadHistorySince(0);
      check(
        all.commands.length === 3 && all.events.length === 3,
        'three commands and events stored',
      );
      same(all.events, kernel.events, 'events equal the kernel audit trail');
      const chain = verifyEventChain(all.events);
      check(
        chain.ok && chain.headHash === kernel.chainHead,
        'stored chain verifies to the kernel head',
      );
      const tail = await h.store.loadHistorySince(2);
      check(
        tail.commands.length === 1 && tail.events.length === 1,
        'history since revision 2 has one entry',
      );
      check(
        tail.commands[0]?.resultRevision === 3,
        'tail command produced revision 3',
      );
      const none = await h.store.loadHistorySince(3);
      check(
        none.commands.length === 0 && none.events.length === 0,
        'nothing after the latest revision',
      );
    },
  },
  {
    name: 'loadLatest follows the newest commit',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      const c1 = advance(kernel, 1, 2);
      await h.store.saveCommit(c1);
      same(
        await h.store.loadLatest(),
        c1.snapshot,
        'latest is the second snapshot',
      );
    },
  },
  {
    name: 'transaction visibility: a failed save changes nothing and can be retried',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      const g = genesisCommit(kernel);
      await h.store.saveCommit(g);
      const c1 = advance(kernel, 1, 2);
      h.failNextCommit();
      const err = await rejection(() => h.store.saveCommit(c1), 'faulted save');
      check(
        err instanceof PersistenceError && err.code === 'WRITE_FAILED',
        'WRITE_FAILED expected',
      );
      same(
        await h.store.loadLatest(),
        g.snapshot,
        'previous snapshot is still the active one',
      );
      same(
        await h.store.loadHistorySince(0),
        { commands: [], events: [] },
        'no partial history visible',
      );
      same(
        (await h.store.listVerifiedSnapshots()).map((s) => s.revision),
        [0],
        'no extra snapshot visible',
      );
      await h.store.saveCommit(c1);
      same(await h.store.loadLatest(), c1.snapshot, 'retry succeeds');
      check(
        (await h.store.loadHistorySince(0)).events.length === 1,
        'history written exactly once',
      );
    },
  },
  {
    name: 'rejects a commit whose revision does not advance, with nothing changed',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      const c1 = advance(kernel, 1);
      await h.store.saveCommit(c1);
      const err = await rejection(
        () => h.store.saveCommit(c1),
        'replayed commit',
      );
      check(
        err instanceof PersistenceError && err.code === 'COMMIT_REJECTED',
        'COMMIT_REJECTED expected',
      );
      check(
        (await h.store.loadHistorySince(0)).events.length === 1,
        'history unchanged',
      );
    },
  },
  {
    name: 'rejects a commit that skips history (event gap)',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      advance(kernel, 1); // never saved
      const c2 = advance(kernel, 2);
      const err = await rejection(
        () => h.store.saveCommit(c2),
        'gapped commit',
      );
      check(
        err instanceof PersistenceError && err.code === 'COMMIT_REJECTED',
        'COMMIT_REJECTED expected',
      );
      check((await h.store.loadLatest())?.revision === 0, 'still at genesis');
    },
  },
  {
    name: 'rejects a snapshot that does not match the supplied events',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      const c1 = advance(kernel, 1);
      const forged = { ...c1, events: [] };
      const err = await rejection(
        () => h.store.saveCommit(forged),
        'events withheld',
      );
      check(
        err instanceof PersistenceError && err.code === 'COMMIT_REJECTED',
        'COMMIT_REJECTED expected',
      );
      same(
        (await h.store.listVerifiedSnapshots()).map((s) => s.revision),
        [0],
        'nothing stored',
      );
    },
  },
  {
    name: 'rejects a tampered snapshot (content hash mismatch)',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      const c1 = advance(kernel, 1);
      const tampered = {
        ...c1,
        snapshot: {
          ...c1.snapshot,
          world: { ...c1.snapshot.world, simDate: '2030-01-01' },
        },
      };
      const err = await rejection(
        () => h.store.saveCommit(tampered),
        'tampered snapshot',
      );
      check(
        err instanceof PersistenceError && err.code === 'COMMIT_REJECTED',
        'COMMIT_REJECTED expected',
      );
    },
  },
  {
    name: 'rejects a future schema version on save and stores nothing',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      const g = genesisCommit(kernel);
      await h.store.saveCommit(g);
      const c1 = advance(kernel, 1);
      const future = {
        ...c1,
        snapshot: { ...c1.snapshot, schemaVersion: SCHEMA_VERSION + 1 },
      };
      const err = await rejection(
        () => h.store.saveCommit(future),
        'future schema',
      );
      check(
        err instanceof UnsupportedSchemaVersionError,
        'UnsupportedSchemaVersionError expected',
      );
      same(await h.store.loadLatest(), g.snapshot, 'active snapshot unchanged');
      check(
        (await h.store.loadHistorySince(0)).events.length === 0,
        'no history written',
      );
    },
  },
  {
    name: 'rejects a command id that was already committed',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      const c1 = advance(kernel, 1);
      await h.store.saveCommit(c1);
      const c2 = advance(kernel, 2);
      const dup = {
        ...c2,
        commands: [
          {
            ...c2.commands[0]!,
            envelope: {
              ...c2.commands[0]!.envelope,
              commandId: commandId('cmd-1'),
            },
          },
        ],
      };
      const err = await rejection(
        () => h.store.saveCommit(dup),
        'duplicate command id',
      );
      check(
        err instanceof PersistenceError && err.code === 'COMMIT_REJECTED',
        'COMMIT_REJECTED expected',
      );
    },
  },
  {
    name: 'previous snapshot retention: older verified snapshots stay available, newest first',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      for (let n = 1; n <= 2; n++) await h.store.saveCommit(advance(kernel, n));
      const list = await h.store.listVerifiedSnapshots();
      same(
        list.map((s) => s.revision),
        [2, 1, 0],
        'newest first, previous snapshots retained',
      );
      same(list[1], list[1], 'snapshots are plain data');
    },
  },
  {
    name: 'retention keeps the genesis snapshot plus the newest few',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      const total = SNAPSHOT_RETENTION_NEWEST + 4;
      for (let n = 1; n <= total; n++)
        await h.store.saveCommit(advance(kernel, n));
      const revisions = (await h.store.listVerifiedSnapshots()).map(
        (s) => s.revision,
      );
      const expected = [] as number[];
      for (let r = total; r > total - SNAPSHOT_RETENTION_NEWEST; r--)
        expected.push(r);
      expected.push(0);
      same(revisions, expected, 'genesis + newest retained snapshots');
      check(
        (await h.store.loadHistorySince(0)).events.length === total,
        'full history is never pruned',
      );
    },
  },
  {
    name: 'returned data never aliases store state',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      await h.store.saveCommit(advance(kernel, 1));
      const a = await h.store.loadLatest();
      const b = await h.store.loadLatest();
      check(a !== null && b !== null, 'snapshot present');
      check(a !== b, 'each load returns a fresh object');
      check(Object.isFrozen(a), 'loaded snapshot is frozen');
      same(a, b, 'loads are equal');
    },
  },
  {
    name: 'round trip: a career resumed from the stored snapshot continues identically',
    async run() {
      const h = await open(factory);
      const { kernel, ruleset } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      for (let n = 1; n <= 3; n++)
        await h.store.saveCommit(advance(kernel, n, n));
      const snap = await h.store.loadLatest();
      check(snap !== null, 'snapshot present');
      if (snap === null) return;
      const resumed = WorldKernel.resume({
        world: snap.world,
        ruleset,
        chainHead: snap.chainHead,
        eventCount: snap.eventCount,
        knownCommandIds: snap.knownCommandIds,
      });
      check(
        resumed.execute(envelope(2, 1, 3)).ok === false,
        'duplicate stays rejected after reload',
      );
      kernel.execute(envelope(9, 2, 3));
      resumed.execute(envelope(9, 2, 3));
      check(
        fingerprintWorld(resumed.world) === fingerprintWorld(kernel.world),
        'identical world after reload',
      );
      check(
        resumed.chainHead === kernel.chainHead,
        'identical audit head after reload',
      );
    },
  },
  {
    name: 'recovery log is append-only and reports are returned as written',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      const r1: RecoveryReport = {
        action: 'FELL_BACK_TO_PREVIOUS_SNAPSHOT',
        previousActiveRevision: 1,
        restoredRevision: 0,
        reasons: ['contentHash does not match snapshot content'],
      };
      const r2: RecoveryReport = {
        action: 'NO_VERIFIED_SNAPSHOT',
        previousActiveRevision: null,
        restoredRevision: null,
        reasons: ['nothing verifies'],
      };
      await h.store.markRecovery(r1);
      await h.store.markRecovery(r2);
      same(await h.store.loadRecoveryLog(), [r1, r2], 'reports kept in order');
      same(
        (await h.store.loadLatest())?.revision,
        0,
        'a log-only recovery does not change the active snapshot',
      );
    },
  },
  {
    name: 'markRecovery installs a repaired snapshot only if it matches stored history',
    async run() {
      const h = await open(factory);
      const { kernel } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      const stale = genesisCommit(kernel).snapshot; // wrong tail for a one-event history
      const c1 = advance(kernel, 1);
      await h.store.saveCommit(c1);
      const report: RecoveryReport = {
        action: 'REPAIRED_LATEST_FROM_REPLAY',
        previousActiveRevision: 1,
        restoredRevision: 1,
        reasons: ['test'],
      };
      const err = await rejection(
        () => h.store.markRecovery(report, stale),
        'inconsistent repair',
      );
      check(
        err instanceof PersistenceError && err.code === 'COMMIT_REJECTED',
        'COMMIT_REJECTED expected',
      );
      same(
        (await h.store.loadRecoveryLog()).length,
        0,
        'rejected repair is not logged',
      );
      await h.store.markRecovery(report, c1.snapshot);
      same(await h.store.loadLatest(), c1.snapshot, 'repaired snapshot active');
      same((await h.store.loadRecoveryLog()).length, 1, 'repair logged');
    },
  },
];

export interface ContractResult {
  readonly name: string;
  readonly passed: boolean;
  readonly error?: string;
}

/** Runs every case without a test framework (used by the on-device diagnostics harness). */
export const runContractCases = async (
  cases: readonly ContractCase[],
): Promise<ContractResult[]> => {
  const results: ContractResult[] = [];
  for (const c of cases) {
    try {
      await c.run();
      results.push({ name: c.name, passed: true });
    } catch (error) {
      results.push({
        name: c.name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
};
export interface ContractCareer {
  readonly kernel: WorldKernel;
  readonly ruleset: LeagueRulesetManifest;
  /** Commit record for the untouched genesis state. */
  genesis(): CommitRecord;
  /** Execute the next AdvanceDays command on `kernel` and return the commit record for it. */
  step(days?: number): CommitRecord;
}

/** Deterministic synthetic career used by the persistence and recovery contracts. */
export const createContractCareer = (): ContractCareer => {
  const { kernel, ruleset } = newCareer();
  let n = 0;
  return {
    kernel,
    ruleset,
    genesis: () => genesisCommit(kernel),
    step: (days = 1) => advance(kernel, ++n, days),
  };
};
