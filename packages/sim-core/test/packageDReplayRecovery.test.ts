import { describe, expect, it, vi } from 'vitest';
import {
  MemoryCareerStore,
  SYNTHETIC_PACKAGE_D_RULESET,
  canonicalString,
  fingerprintWorld,
  loadCareer,
  repairLatestFromHistory,
  verifyCareerReplay,
} from '../src/index';
import { PACKAGE_D_SCENARIO_SEED } from '../src/packageDScenario';
import { runPackageDThroughStore } from '../src/packageDScenarioRun';

vi.setConfig({ testTimeout: 180_000 });

describe('Package D persistence / replay / recovery RED gate', () => {
  it('persists, reloads and replays to the identical world, chain and RNG state', async () => {
    const run = await runPackageDThroughStore(new MemoryCareerStore());
    expect(run.loadStatus).toBe('loaded');
    expect(run.replayOk).toBe(true);
    expect(run.reloadedFingerprint).toBe(run.result.fingerprint);
    expect(run.reloadedChainHead).toBe(run.result.eventChainHead);
    expect(run.reloadedRngState).toEqual(run.result.rngState);
  });

  it('repairs a corrupt latest snapshot without rewriting D history, old claims or medical reports', async () => {
    const store = new MemoryCareerStore();
    const run = await runPackageDThroughStore(store);
    const healthy = await loadCareer(store, {
      ruleset: SYNTHETIC_PACKAGE_D_RULESET,
      seed: PACKAGE_D_SCENARIO_SEED,
    });
    expect(healthy.status).toBe('loaded');
    if (healthy.status !== 'loaded') return;
    const frozen = {
      commands: canonicalString(store.exportState().commands),
      events: canonicalString(store.exportState().events),
      claims: canonicalString(healthy.kernel.world.information.claims),
      beliefs: canonicalString(healthy.kernel.world.information.beliefs),
      medicalReports: canonicalString(healthy.kernel.world.medical.reports),
      medicalProgress: canonicalString(healthy.kernel.world.medical.progress),
    };

    store.tamperWithSnapshotForTest(run.result.revision, (plain) => ({
      ...plain,
      worldFingerprint: 'corrupt-package-d-latest',
    }));
    const options = {
      ruleset: SYNTHETIC_PACKAGE_D_RULESET,
      seed: PACKAGE_D_SCENARIO_SEED,
    };
    const broken = await loadCareer(store, options);
    expect(broken.status).not.toBe('loaded');
    const check = await verifyCareerReplay(store, SYNTHETIC_PACKAGE_D_RULESET);
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
    expect(healed.kernel.world.rng).toEqual(run.result.rngState);

    const after = store.exportState();
    expect(canonicalString(after.commands)).toBe(frozen.commands);
    expect(canonicalString(after.events)).toBe(frozen.events);
    expect(canonicalString(healed.kernel.world.information.claims)).toBe(
      frozen.claims,
    );
    expect(canonicalString(healed.kernel.world.information.beliefs)).toBe(
      frozen.beliefs,
    );
    expect(canonicalString(healed.kernel.world.medical.reports)).toBe(
      frozen.medicalReports,
    );
    expect(canonicalString(healed.kernel.world.medical.progress)).toBe(
      frozen.medicalProgress,
    );
  });
});
