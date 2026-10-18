import { describe, expect, it, vi } from 'vitest';
import {
  MemoryCareerStore,
  PACKAGE_E_SCENARIO_RULESET,
  PACKAGE_E_SCENARIO_SEED,
  canonicalString,
  fingerprintWorld,
  loadCareer,
  repairLatestFromHistory,
  verifyCareerReplay,
} from '../src/index';
import { runPackageEThroughStore } from '../src/packageEScenarioRun';

vi.setConfig({ testTimeout: 120_000 });

describe('Package E persistence / replay / recovery RED gate', () => {
  it('persists, reloads and replays the identical football world, chain and RNG state', async () => {
    const run = await runPackageEThroughStore(new MemoryCareerStore());
    expect(run.loadStatus).toBe('loaded');
    expect(run.replayOk).toBe(true);
    expect(run.reloadedFingerprint).toBe(run.result.fingerprint);
    expect(run.reloadedChainHead).toBe(run.result.eventChainHead);
    expect(run.reloadedRngState).toEqual(run.result.rngState);
    expect(run.reloadedGameIdentity).toEqual(run.result.game);
  });

  it('repairs a corrupt latest snapshot without rewriting accepted football facts, claims or receipts', async () => {
    const store = new MemoryCareerStore();
    const run = await runPackageEThroughStore(store);
    const options = {
      ruleset: PACKAGE_E_SCENARIO_RULESET,
      seed: PACKAGE_E_SCENARIO_SEED,
    };
    const healthy = await loadCareer(store, options);
    expect(healthy.status).toBe('loaded');
    if (healthy.status !== 'loaded') return;
    const frozen = {
      commands: canonicalString(store.exportState().commands),
      events: canonicalString(store.exportState().events),
      plays: canonicalString(healthy.kernel.world.football.plays),
      games: canonicalString(healthy.kernel.world.football.games),
      causalLinks: canonicalString(healthy.kernel.world.football.causalLinks),
      claims: canonicalString(healthy.kernel.world.information.claims),
      receipts: canonicalString(healthy.kernel.world.decisions.receipts),
    };

    store.tamperWithSnapshotForTest(run.result.revision, (plain) => ({
      ...plain,
      worldFingerprint: 'corrupt-package-e-latest',
    }));
    const broken = await loadCareer(store, options);
    expect(broken.status).not.toBe('loaded');
    const check = await verifyCareerReplay(store, PACKAGE_E_SCENARIO_RULESET);
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
    expect(canonicalString(healed.kernel.world.football.plays)).toBe(
      frozen.plays,
    );
    expect(canonicalString(healed.kernel.world.football.games)).toBe(
      frozen.games,
    );
    expect(canonicalString(healed.kernel.world.football.causalLinks)).toBe(
      frozen.causalLinks,
    );
    expect(canonicalString(healed.kernel.world.information.claims)).toBe(
      frozen.claims,
    );
    expect(canonicalString(healed.kernel.world.decisions.receipts)).toBe(
      frozen.receipts,
    );
    const after = store.exportState();
    expect(canonicalString(after.commands)).toBe(frozen.commands);
    expect(canonicalString(after.events)).toBe(frozen.events);
  });
});
