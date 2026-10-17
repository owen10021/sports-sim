import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MemoryCareerStore,
  careerStoreContractCases,
  verifySnapshot,
  type CareerSnapshot,
  type CommitRecord,
} from '../src/index';

describe('MemoryCareerStore satisfies the CareerStore contract', () => {
  const cases = careerStoreContractCases(async () => {
    const store = new MemoryCareerStore();
    return { store, failNextCommit: () => store.failNextCommit() };
  });

  it('exposes the full contract (guards against silently dropping cases)', () => {
    expect(cases.length).toBeGreaterThanOrEqual(12);
    expect(new Set(cases.map((c) => c.name)).size).toBe(cases.length);
  });

  for (const c of cases) {
    it(c.name, async () => {
      await c.run();
    });
  }
});

describe('legacy Package C (world model 3) snapshots in a store', () => {
  const fixture = JSON.parse(
    readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        'fixtures',
        'legacy',
        'package-c-world-v3-snapshot.json',
      ),
      'utf8',
    ),
  ) as { genesis: CareerSnapshot; commits: readonly CommitRecord[] };

  it('saves, verifies and reloads a model-3 snapshot under its own fingerprint', async () => {
    const store = new MemoryCareerStore();
    await store.initialize();
    await store.saveCommit({
      snapshot: fixture.genesis,
      commands: [],
      events: [],
    });
    const first = fixture.commits[0]!;
    await store.saveCommit(first);
    expect(verifySnapshot(first.snapshot)).toEqual({ ok: true });
    const latest = await store.loadLatest();
    expect(latest).not.toBeNull();
    expect(latest!.worldFingerprint).toBe(first.snapshot.worldFingerprint);
    expect(
      (latest!.world as { worldModelVersion?: number }).worldModelVersion,
    ).toBe(3);
  });

  it('refuses a model-3 snapshot whose recorded fingerprint is not the model-3 one', () => {
    const snap = fixture.commits[0]!.snapshot;
    const tampered = { ...snap, worldFingerprint: 'f'.repeat(64) };
    const verdict = verifySnapshot(tampered);
    expect(verdict.ok).toBe(false);
  });
});
