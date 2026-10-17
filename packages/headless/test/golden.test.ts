import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  GOLDEN_EXPECTED,
  MemoryCareerStore,
  careerStoreContractCases,
  diffGolden,
  runGoldenScenario,
  runGoldenThroughStore,
} from '@sport-sim/sim-core';
import { JsonFileCareerStore } from '../src/jsonFileCareerStore';

const root = join(__dirname, '..', '..', '..');

describe('golden scenario (Node)', () => {
  it('is deterministic: two fresh runs are identical', () => {
    expect(runGoldenScenario()).toEqual(runGoldenScenario());
  });

  it('reproduces the recorded expectation byte for byte', () => {
    expect(diffGolden(runGoldenScenario(), GOLDEN_EXPECTED)).toEqual([]);
  });

  it('matches the committed fixture file', () => {
    const fixture = JSON.parse(
      readFileSync(
        join(root, 'fixtures/golden/package-a-golden-v1.json'),
        'utf8',
      ),
    );
    expect(fixture).toEqual(JSON.parse(JSON.stringify(GOLDEN_EXPECTED)));
  });

  it('has the intended shape: three commands on days 1, 6 and 7, four rejections that change nothing', () => {
    const r = runGoldenScenario();
    expect(r.commandDays).toEqual([1, 6, 7]);
    expect(r.finalSimDate).toBe('2026-10-30');
    expect(r.revision).toBe(3);
    expect(r.eventCount).toBe(3);
    expect(r.rngDraws).toBe(14);
    const rejected = r.steps.filter((s) => s.outcome !== 'committed');
    expect(rejected.map((s) => s.outcome)).toEqual([
      'DUPLICATE_COMMAND',
      'STALE_REVISION',
      'INVALID_PAYLOAD',
      'UNAUTHORIZED_ACTOR',
    ]);
    for (const step of rejected) {
      const i = r.steps.indexOf(step);
      const prev = r.steps[i - 1]!;
      expect(step.fingerprint).toBe(prev.fingerprint);
      expect(step.rngDraws).toBe(prev.rngDraws);
      expect(step.chainHead).toBe(prev.chainHead);
    }
  });

  it('stored, reloaded and replayed through the memory store gives the same outcome', async () => {
    const run = await runGoldenThroughStore(new MemoryCareerStore());
    expect(diffGolden(run.result, GOLDEN_EXPECTED)).toEqual([]);
    expect(run.loadStatus).toBe('loaded');
    expect(run.replayOk).toBe(true);
    expect(run.reloadedFingerprint).toBe(GOLDEN_EXPECTED.fingerprint);
    expect(run.reloadedChainHead).toBe(GOLDEN_EXPECTED.eventChainHead);
  });
});

describe('golden scenario through the file-backed store (process-restart safe)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('survives closing and reopening the file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sport-sim-golden-'));
    dirs.push(dir);
    const file = join(dir, 'career.json');
    const run = await runGoldenThroughStore(new JsonFileCareerStore(file));
    expect(run.loadStatus).toBe('loaded');
    expect(run.reloadedFingerprint).toBe(GOLDEN_EXPECTED.fingerprint);

    const reopened = new JsonFileCareerStore(file);
    await reopened.initialize();
    const latest = await reopened.loadLatest();
    expect(latest?.worldFingerprint).toBe(GOLDEN_EXPECTED.fingerprint);
    expect(latest?.chainHead).toBe(GOLDEN_EXPECTED.eventChainHead);
  });

  it('satisfies the shared CareerStore contract', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sport-sim-contract-'));
    dirs.push(dir);
    let n = 0;
    for (const c of careerStoreContractCases(async () => {
      const store = new JsonFileCareerStore(join(dir, `contract-${n++}.json`));
      return { store, failNextCommit: () => store.failNextCommit() };
    })) {
      await c.run();
    }
  });
});
