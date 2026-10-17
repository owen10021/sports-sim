import { describe, expect, it } from 'vitest';
import {
  MemoryCareerStore,
  PACKAGE_C_EXPECTED,
  PACKAGE_C_SEED,
  PACKAGE_C_STEPS,
  SYNTHETIC_PACKAGE_C_RULESET,
  WorldKernel,
  canonicalString,
  diffPackageC,
  fingerprintWorld,
  loadCareer,
  repairLatestFromHistory,
  runPackageCScenario,
  runPackageCThroughStore,
  verifyCareerReplay,
} from '../src/index';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const reload = (_i: number, k: WorldKernel): WorldKernel =>
  WorldKernel.resume({
    world: JSON.parse(JSON.stringify(k.world)),
    ruleset: SYNTHETIC_PACKAGE_C_RULESET,
    chainHead: k.chainHead,
    eventCount: k.eventCount,
    knownCommandIds: [...k.knownCommandIds],
  });

describe('Package C golden scenario', () => {
  it('matches the frozen fixture file and the recorded expectation', () => {
    const file = JSON.parse(
      readFileSync(
        join(
          __dirname,
          '..',
          '..',
          '..',
          'fixtures',
          'golden',
          'package-c-golden-v1.json',
        ),
        'utf8',
      ),
    ) as unknown;
    expect(file).toEqual(JSON.parse(JSON.stringify(PACKAGE_C_EXPECTED)));
  });

  it('is deterministic and matches the recorded expectation', () => {
    const a = runPackageCScenario();
    const b = runPackageCScenario();
    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(diffPackageC(a, PACKAGE_C_EXPECTED)).toEqual([]);
    expect(a.steps.map((s) => s.outcome)).toEqual(
      PACKAGE_C_STEPS.map((s) => s.expect),
    );
    expect(a.steps.length).toBe(PACKAGE_C_STEPS.length);
  });

  it('draws randomness only when days advance, and rejected steps change nothing', () => {
    const a = runPackageCScenario();
    a.steps.forEach((s, i) => {
      const prev = i === 0 ? null : a.steps[i - 1]!;
      const drew = s.rngDraws - (prev?.rngDraws ?? 0);
      if (!s.label.startsWith('advance')) expect(drew).toBe(0);
      if (s.outcome !== 'committed' && prev !== null) {
        expect(s.fingerprint).toBe(prev.fingerprint);
        expect(s.chainHead).toBe(prev.chainHead);
        expect(s.revision).toBe(prev.revision);
      }
    });
  });

  it('ends with a clean acquisition audit and conserved assets', () => {
    const a = runPackageCScenario();
    expect(a.auditErrorFindings).toBe(0);
    // Every 2027 pick and each draft-class right has exactly one recorded holder.
    const holders = Object.values(a.assetOwnership);
    expect(holders.length).toBeGreaterThan(0);
    expect(holders.every((h) => h.length > 0)).toBe(true);
    expect(
      a.organizations.map((o) => o.picksOwned).reduce((x, y) => x + y),
    ).toBe(24);
  });

  it('shows previews agreeing with committed trades', () => {
    const a = runPackageCScenario();
    const p = (key: string) =>
      JSON.parse(a.keyRecordIds[key]!) as {
        preview: { capDeltaBySeason: { season: number; delta: number }[] };
      };
    for (const [x, y] of [
      ['swapPreviewA', 'swapPreviewB'],
      ['picktradePreviewA', 'picktradePreviewB'],
    ] as const) {
      const ax = p(x).preview.capDeltaBySeason;
      const by = p(y).preview.capDeltaBySeason;
      expect(ax.map((d) => ({ ...d, delta: -d.delta }))).toEqual(by);
    }
  });

  it('records a competitive, deterministic free-agency outcome', () => {
    const a = runPackageCScenario();
    expect(a.keyRecordIds['status:eb-fa01']).toBe('rejected');
    expect(a.keyRecordIds['status:eb-fa02']).toBe('accepted_pending_commit');
    expect(a.keyRecordIds['status:wl-fa01']).toBe('accepted_pending_commit');
    expect(a.keyRecordIds.waiverWinner).toBe('org-westlake');
    expect(a.keyRecordIds.dumpDisposition).toBe('reject');
  });

  it('diverges from the same seed when the variant changes, with a clean audit', () => {
    const primary = runPackageCScenario();
    const alternate = runPackageCScenario({ variant: 'alternate' });
    expect(alternate.fingerprint).not.toBe(primary.fingerprint);
    expect(alternate.auditErrorFindings).toBe(0);
    expect(alternate.rngDraws).toBe(primary.rngDraws);
  });

  it('save/reload at every command boundary yields the same final result', () => {
    const uninterrupted = runPackageCScenario();
    const reloaded = runPackageCScenario({ beforeStep: reload });
    expect(canonicalString(reloaded)).toBe(canonicalString(uninterrupted));
    for (const at of [5, 30, 60, 90, 100]) {
      const once = runPackageCScenario({
        beforeStep: (i, k) => (i === at ? reload(i, k) : undefined),
      });
      expect(once.fingerprint).toBe(uninterrupted.fingerprint);
      expect(once.eventChainHead).toBe(uninterrupted.eventChainHead);
    }
  }, 180_000);

  it('persists, reloads and replays to the identical fingerprint and chain head', async () => {
    const run = await runPackageCThroughStore(new MemoryCareerStore());
    expect(run.loadStatus).toBe('loaded');
    expect(run.replayOk).toBe(true);
    expect(run.reloadedFingerprint).toBe(run.result.fingerprint);
    expect(run.reloadedChainHead).toBe(run.result.eventChainHead);
    expect(run.result.fingerprint).toBe(PACKAGE_C_EXPECTED.fingerprint);
  }, 120_000);

  it('recovers from a corrupt latest snapshot without rewriting history', async () => {
    const store = new MemoryCareerStore();
    const run = await runPackageCThroughStore(store);
    const before = store.exportState();
    store.tamperWithSnapshotForTest(run.result.revision, (plain) => ({
      ...plain,
      worldFingerprint: 'corrupt',
    }));
    const options = {
      ruleset: SYNTHETIC_PACKAGE_C_RULESET,
      seed: PACKAGE_C_SEED,
    };
    const broken = await loadCareer(store, options);
    expect(broken.status).not.toBe('loaded');
    const check = await verifyCareerReplay(store, SYNTHETIC_PACKAGE_C_RULESET);
    const repair = await repairLatestFromHistory(store, {
      ...options,
      reasons: check.reasons,
    });
    expect(repair.status).toBe('repaired');
    const healed = await loadCareer(store, options);
    expect(healed.status).toBe('loaded');
    if (healed.status !== 'loaded') return;
    expect(fingerprintWorld(healed.kernel.world)).toBe(run.result.fingerprint);
    expect(healed.kernel.chainHead).toBe(run.result.eventChainHead);
    const after = store.exportState();
    expect(canonicalString(after.events)).toBe(canonicalString(before.events));
    expect(canonicalString(after.commands)).toBe(
      canonicalString(before.commands),
    );
  }, 120_000);
});
