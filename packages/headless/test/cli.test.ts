import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli';

let dir = '';
let file = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sport-sim-cli-'));
  file = join(dir, 'career.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const run = async (...argv: string[]) => {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(argv, {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  return {
    code,
    out,
    err,
    json:
      out.length > 0
        ? (JSON.parse(out[out.length - 1]!) as Record<string, unknown>)
        : null,
  };
};

describe('headless CLI', () => {
  it('create -> advance -> inspect -> verify -> replay on a synthetic career', async () => {
    const created = await run(
      'create',
      '--file',
      file,
      '--world-id',
      'world-cli-1',
    );
    expect(created.code).toBe(0);
    expect(created.json).toMatchObject({
      worldId: 'world-cli-1',
      revision: 0,
      simDate: '2026-10-16',
    });

    const advanced = await run('advance', '--file', file, '--days', '3');
    expect(advanced.code).toBe(0);
    expect(advanced.json).toMatchObject({
      revision: 1,
      simDate: '2026-10-19',
      eventCount: 1,
    });

    const inspected = await run('inspect', '--file', file);
    expect(inspected.json).toMatchObject({
      revision: 1,
      simDate: '2026-10-19',
    });
    expect(inspected.json?.fingerprint).toBe(advanced.json?.fingerprint);

    const verified = await run('verify', '--file', file);
    expect(verified.code).toBe(0);
    expect(verified.json).toMatchObject({ ok: true, status: 'loaded' });

    const replayed = await run('replay', '--file', file);
    expect(replayed.code).toBe(0);
    expect(replayed.json).toMatchObject({
      ok: true,
      fingerprint: advanced.json?.fingerprint,
    });
  });

  it('a rejected command exits non-zero and leaves the file byte-identical', async () => {
    await run('create', '--file', file, '--world-id', 'world-cli-2');
    await run('advance', '--file', file, '--days', '2');
    const before = readFileSync(file, 'utf8');
    const bad = await run('advance', '--file', file, '--days', '0');
    expect(bad.code).toBe(1);
    expect(bad.err.join('\n')).toContain('INVALID_PAYLOAD');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('refuses to create over an existing career', async () => {
    await run('create', '--file', file, '--world-id', 'world-cli-3');
    const again = await run(
      'create',
      '--file',
      file,
      '--world-id',
      'world-cli-4',
    );
    expect(again.code).toBe(1);
    expect(again.err.join('\n')).toMatch(/already exists/i);
  });

  it('verify detects tampered history and a corrupt newest snapshot; replay --repair fixes only the latter', async () => {
    await run('create', '--file', file, '--world-id', 'world-cli-5');
    for (const d of ['1', '2', '3'])
      await run('advance', '--file', file, '--days', d);
    const original = readFileSync(file, 'utf8');

    // Corrupt newest snapshot (history intact) -> detected, repairable.
    const corrupt = JSON.parse(original);
    corrupt.state.snapshots[corrupt.state.snapshots.length - 1].contentHash =
      'f'.repeat(64);
    writeFileSync(file, JSON.stringify(corrupt));
    const detected = await run('verify', '--file', file);
    expect(detected.code).toBe(1);
    expect(detected.json).toMatchObject({ ok: false });
    const repaired = await run('replay', '--file', file, '--repair');
    expect(repaired.code).toBe(0);
    expect(repaired.json).toMatchObject({ repaired: true });
    expect((await run('verify', '--file', file)).code).toBe(0);

    // Tampered history -> detected, NOT repairable.
    const forged = JSON.parse(original);
    forged.state.events[1].type = 'Forged';
    writeFileSync(file, JSON.stringify(forged));
    expect((await run('verify', '--file', file)).code).toBe(1);
    const refused = await run('replay', '--file', file, '--repair');
    expect(refused.code).toBe(1);
    expect(refused.json).toMatchObject({ repaired: false });
  });

  it('golden exits 0 when the scenario matches the recorded expectation', async () => {
    const res = await run('golden');
    expect(res.code).toBe(0);
    expect(res.json).toMatchObject({ match: true });
  });

  it('usage errors exit 2', async () => {
    expect((await run('nonsense')).code).toBe(2);
    expect((await run('inspect')).code).toBe(2);
    expect((await run('advance', '--file', file, '--days', 'abc')).code).toBe(
      2,
    );
  });
});
