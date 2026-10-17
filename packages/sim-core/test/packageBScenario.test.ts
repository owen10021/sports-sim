import { describe, expect, it } from 'vitest';
import {
  MemoryCareerStore,
  ORG_SUBSTRATE_SEED,
  ORG_SUBSTRATE_SEED_JSON,
  PACKAGE_B_EXPECTED,
  PACKAGE_B_STEPS,
  SYNTHETIC_RULESET,
  WorldKernel,
  auditOrganizationCoherence,
  canonicalString,
  diffPackageB,
  entityId,
  fingerprintWorld,
  loadCareer,
  repairLatestFromHistory,
  runPackageBScenario,
  runPackageBThroughStore,
  verifyCareerReplay,
} from '../src/index';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const reload = (_i: number, k: WorldKernel): WorldKernel =>
  WorldKernel.resume({
    world: JSON.parse(JSON.stringify(k.world)),
    ruleset: SYNTHETIC_RULESET,
    chainHead: k.chainHead,
    eventCount: k.eventCount,
    knownCommandIds: [...k.knownCommandIds],
  });

describe('Package B golden scenario', () => {
  it('embeds the frozen fixture exactly', () => {
    const file = JSON.parse(
      readFileSync(
        join(
          __dirname,
          '..',
          '..',
          '..',
          'fixtures',
          'seeds',
          'synthetic-org-substrate-v1.json',
        ),
        'utf8',
      ),
    ) as unknown;
    expect(canonicalString(ORG_SUBSTRATE_SEED_JSON)).toBe(
      canonicalString(file),
    );
  });

  it('keeps the accepted model-2 golden file as history beside the current-model one', () => {
    const read = (name: string) =>
      JSON.parse(
        readFileSync(
          join(__dirname, '..', '..', '..', 'fixtures', 'golden', name),
          'utf8',
        ),
      ) as { scenario: string; fingerprint: string; eventChainHead: string };
    const accepted = read('package-b-golden-v1.json');
    const current = read('package-b-golden-v3.json');
    expect(accepted.scenario).toBe('package-b-golden-v1');
    expect(current.scenario).toBe('package-b-golden-v3');
    expect(current).toEqual(JSON.parse(JSON.stringify(PACKAGE_B_EXPECTED)));
    expect(current.fingerprint).not.toBe(accepted.fingerprint);
    expect(current.eventChainHead).toBe(accepted.eventChainHead);
  });

  it('is deterministic and matches the recorded expectation', () => {
    const a = runPackageBScenario();
    const b = runPackageBScenario();
    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(diffPackageB(a, PACKAGE_B_EXPECTED)).toEqual([]);
    // Only day advancement draws randomness; no organizational command ever does.
    const drawsAtStep = a.steps.map((s, i) =>
      i === 0 ? s.rngDraws : s.rngDraws - a.steps[i - 1]!.rngDraws,
    );
    a.steps.forEach((s, i) => {
      if (s.label !== 'advance-3') expect(drawsAtStep[i]).toBe(0);
    });
    expect(a.rngDraws).toBe(3);
    expect(a.steps.map((s) => s.outcome)).toEqual(
      PACKAGE_B_STEPS.map((s) => s.expect),
    );
  });

  it('shows two organizations diverging from legitimate differences only', () => {
    let final: WorldKernel | null = null;
    runPackageBScenario({
      beforeStep: (i, k) => {
        if (i === PACKAGE_B_STEPS.length - 1) final = k;
      },
    });
    const w = final!.world;
    const plans = w.plans.plans;
    const nf = plans.find((p) => p.organizationId === 'org-northfield')!;
    const sp = plans.find((p) => p.organizationId === 'org-southport')!;
    expect(nf.revisions[0]!.objectives[0]!.target).toEqual({ prefer: 'opt-a' });
    expect(sp.revisions[0]!.objectives[0]!.target).toEqual({ prefer: 'opt-b' });
    // Southport revised on new evidence; Northfield's plan is untouched.
    expect(sp.currentRevision).toBe(2);
    expect(nf.currentRevision).toBe(1);
    // Every receipt is intact and every decision record references real records.
    for (const org of ['org-northfield', 'org-southport'])
      expect(auditOrganizationCoherence(w, entityId(org))).toEqual([]);
  });

  it('save/reload at every command boundary yields the same final result', () => {
    const uninterrupted = runPackageBScenario();
    const reloaded = runPackageBScenario({ beforeStep: reload });
    expect(canonicalString(reloaded)).toBe(canonicalString(uninterrupted));
    // And at a single mid-scenario boundary.
    for (const at of [3, 8, 14, 20]) {
      const once = runPackageBScenario({
        beforeStep: (i, k) => (i === at ? reload(i, k) : undefined),
      });
      expect(once.fingerprint).toBe(uninterrupted.fingerprint);
      expect(once.eventChainHead).toBe(uninterrupted.eventChainHead);
    }
  });

  it('persists, reloads and replays to the identical fingerprint and chain head', async () => {
    const run = await runPackageBThroughStore(new MemoryCareerStore());
    expect(run.loadStatus).toBe('loaded');
    expect(run.replayOk).toBe(true);
    expect(run.reloadedFingerprint).toBe(run.result.fingerprint);
    expect(run.reloadedChainHead).toBe(run.result.eventChainHead);
    expect(run.result.fingerprint).toBe(PACKAGE_B_EXPECTED.fingerprint);
  });

  it('recovers from a corrupt latest snapshot without rewriting knowledge or decision history', async () => {
    const store = new MemoryCareerStore();
    const run = await runPackageBThroughStore(store);
    const before = store.exportState();
    store.tamperWithSnapshotForTest(run.result.revision, (plain) => ({
      ...plain,
      worldFingerprint: 'corrupt',
    }));
    const options = { ruleset: SYNTHETIC_RULESET, seed: ORG_SUBSTRATE_SEED };
    const broken = await loadCareer(store, options);
    expect(broken.status).not.toBe('loaded');
    const check = await verifyCareerReplay(store, SYNTHETIC_RULESET);
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
    // Stored history (every claim, belief and decision event) is untouched.
    const after = store.exportState();
    expect(canonicalString(after.events)).toBe(canonicalString(before.events));
    expect(canonicalString(after.commands)).toBe(
      canonicalString(before.commands),
    );
  });
});
