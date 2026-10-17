import { verifyEventChain } from './audit';
import { fingerprintWorld } from './world';
import { createContractCareer, type ContractCase, type ContractCareer } from './persistenceContract';
import { SCHEMA_VERSION, UnsupportedSchemaVersionError } from './provenance';
import { verifySnapshot, type CareerStore } from './persistence';
import { CareerLoadError, loadCareer } from './recovery';
import { sealRuleset, type LeagueRulesetManifest } from './ruleset';

/**
 * Framework-free contract for loading, corruption detection and recovery. Every adapter
 * supplies the three corruption seams; the cases are identical for memory and SQLite and
 * run unchanged in the Expo/Hermes runtime.
 */
export type SnapshotTamper = 'hash' | 'junk' | 'future';

export interface RecoveryHarness {
  readonly store: CareerStore;
  /** Damage one stored snapshot in place, bypassing every integrity check. */
  tamperSnapshot(revision: number, kind: SnapshotTamper): Promise<void>;
  /** Delete the newest `count` events (and their commands) from stored history. */
  truncateHistory(count: number): Promise<void>;
  /** Alter one stored event (0-based index) without re-hashing it. */
  tamperEvent(index: number): Promise<void>;
}

export type RecoveryHarnessFactory = () => Promise<RecoveryHarness>;

class RecoveryContractFailure extends Error {
  constructor(message: string) {
    super(`Recovery contract violated: ${message}`);
    this.name = 'RecoveryContractFailure';
  }
}

export const recoveryCheck = (condition: boolean, message: string): void => {
  if (!condition) throw new RecoveryContractFailure(message);
};

export const expectRejection = async (fn: () => Promise<unknown>, message: string): Promise<unknown> => {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new RecoveryContractFailure(`${message} (expected a rejection, got success)`);
};

/** Store with a genesis save plus four committed days (revisions 0..4). */
export const seedCareer = async (
  h: RecoveryHarness,
  commits = 4,
): Promise<ContractCareer> => {
  await h.store.initialize();
  const career = createContractCareer();
  await h.store.saveCommit(career.genesis());
  for (let i = 1; i <= commits; i++) await h.store.saveCommit(career.step(i));
  return career;
};

export const recoveryContractCases = (factory: RecoveryHarnessFactory): ContractCase[] => [
  {
    name: 'an empty store loads as empty',
    async run() {
      const h = await factory();
      await h.store.initialize();
      const ruleset = createContractCareer().ruleset;
      recoveryCheck((await loadCareer(h.store, { ruleset })).status === 'empty', 'empty store -> empty');
    },
  },
  {
    name: 'a healthy career loads, is not reported as recovered, and keeps executing identically',
    async run() {
      const h = await factory();
      const career = await seedCareer(h);
      const out = await loadCareer(h.store, { ruleset: career.ruleset });
      recoveryCheck(out.status === 'loaded', `expected loaded, got ${out.status}`);
      if (out.status !== 'loaded') return;
      recoveryCheck(
        fingerprintWorld(out.kernel.world) === fingerprintWorld(career.kernel.world),
        'loaded world fingerprint equals live world',
      );
      recoveryCheck(out.kernel.chainHead === career.kernel.chainHead, 'loaded audit head equals live head');
      const next = career.step(2);
      const res = out.kernel.execute(next.commands[0]!.envelope);
      recoveryCheck(res.ok, 'loaded kernel accepts the next command');
      recoveryCheck(
        fingerprintWorld(out.kernel.world) === fingerprintWorld(career.kernel.world),
        'loaded kernel stays in lock-step with the live one',
      );
      recoveryCheck((await h.store.loadRecoveryLog()).length === 0, 'a healthy load logs no recovery');
    },
  },
  {
    name: 'a corrupt newest snapshot is detected and the newest older verified snapshot is used, explicitly',
    async run() {
      const h = await factory();
      const career = await seedCareer(h);
      await h.tamperSnapshot(4, 'hash');
      const out = await loadCareer(h.store, { ruleset: career.ruleset });
      recoveryCheck(out.status === 'degraded', `expected degraded, got ${out.status}`);
      if (out.status !== 'degraded') return;
      recoveryCheck(out.snapshot.revision === 3, 'fell back to revision 3');
      recoveryCheck(out.report.action === 'FELL_BACK_TO_PREVIOUS_SNAPSHOT', 'report names the fallback');
      recoveryCheck(out.report.previousActiveRevision === 4, 'report names the damaged revision');
      recoveryCheck(out.report.restoredRevision === 3, 'report names the restored revision');
      recoveryCheck(out.report.reasons.length > 0, 'report explains why');
      const log = await h.store.loadRecoveryLog();
      recoveryCheck(log.length === 1, 'the recovery is recorded durably');
      const stillBad = await h.store.loadLatest();
      recoveryCheck(!verifySnapshot(stillBad).ok, 'corruption is not silently erased');
    },
  },
  {
    name: 'an unreadable newest snapshot also falls back explicitly',
    async run() {
      const h = await factory();
      const career = await seedCareer(h);
      await h.tamperSnapshot(4, 'junk');
      const out = await loadCareer(h.store, { ruleset: career.ruleset });
      recoveryCheck(out.status === 'degraded', `expected degraded, got ${out.status}`);
      if (out.status === 'degraded') recoveryCheck(out.snapshot.revision === 3, 'fell back to revision 3');
    },
  },
  {
    name: 'repeating a degraded load does not flood the recovery log',
    async run() {
      const h = await factory();
      const career = await seedCareer(h);
      await h.tamperSnapshot(4, 'hash');
      await loadCareer(h.store, { ruleset: career.ruleset });
      await loadCareer(h.store, { ruleset: career.ruleset });
      recoveryCheck((await h.store.loadRecoveryLog()).length === 1, 'identical recovery logged once');
    },
  },
  {
    name: 'a future-schema active snapshot fails closed (no fallback to older data)',
    async run() {
      const h = await factory();
      const career = await seedCareer(h);
      await h.tamperSnapshot(4, 'future');
      const err = await expectRejection(() => loadCareer(h.store, { ruleset: career.ruleset }), 'future schema');
      recoveryCheck(err instanceof UnsupportedSchemaVersionError, 'UnsupportedSchemaVersionError expected');
      recoveryCheck((await h.store.loadRecoveryLog()).length === 0, 'nothing is "recovered" from a future build');
    },
  },
  {
    name: 'missing history is detected: the load degrades to a snapshot that history still supports',
    async run() {
      const h = await factory();
      const career = await seedCareer(h);
      await h.truncateHistory(1);
      const out = await loadCareer(h.store, { ruleset: career.ruleset });
      recoveryCheck(out.status === 'degraded', `expected degraded, got ${out.status}`);
      if (out.status !== 'degraded') return;
      recoveryCheck(out.snapshot.revision === 3, 'fell back to the last snapshot the history supports');
      recoveryCheck(
        out.report.reasons.some((r) => r.includes('history')),
        'report mentions the missing history',
      );
    },
  },
  {
    name: 'a tampered event breaks the chain and limits fallback to the verified prefix',
    async run() {
      const h = await factory();
      const career = await seedCareer(h);
      await h.tamperEvent(2);
      const out = await loadCareer(h.store, { ruleset: career.ruleset });
      recoveryCheck(out.status === 'degraded', `expected degraded, got ${out.status}`);
      if (out.status !== 'degraded') return;
      recoveryCheck(out.snapshot.revision === 2, 'fell back to the snapshot inside the verified prefix');
      const events = (await h.store.loadHistorySince(0)).events;
      recoveryCheck(!verifyEventChain(events).ok, 'the tampered chain really fails verification');
    },
  },
  {
    name: 'when no snapshot can be trusted the load fails explicitly',
    async run() {
      const h = await factory();
      const career = await seedCareer(h, 2);
      for (const r of [0, 1, 2]) await h.tamperSnapshot(r, 'hash');
      const out = await loadCareer(h.store, { ruleset: career.ruleset });
      recoveryCheck(out.status === 'failed', `expected failed, got ${out.status}`);
      if (out.status === 'failed') {
        recoveryCheck(out.report.action === 'NO_VERIFIED_SNAPSHOT', 'report says nothing verifies');
      }
    },
  },
  {
    name: 'a ruleset that does not match the career is refused, not "recovered"',
    async run() {
      const h = await factory();
      const career = await seedCareer(h, 1);
      const other: LeagueRulesetManifest = sealRuleset({
        schemaVersion: SCHEMA_VERSION,
        rulesetId: 'some-other-ruleset',
        rulesetVersion: 1,
        displayName: 'Other',
        provenance: career.ruleset.provenance,
        rules: { maxAdvanceDaysPerCommand: 30 },
      });
      const err = await expectRejection(() => loadCareer(h.store, { ruleset: other }), 'ruleset mismatch');
      recoveryCheck(err instanceof CareerLoadError && err.code === 'RULESET_MISMATCH', 'RULESET_MISMATCH expected');
      recoveryCheck((await h.store.loadRecoveryLog()).length === 0, 'no recovery logged');
    },
  },
];
