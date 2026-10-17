import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The Package A world-model v1 fixture is immutable historical evidence. It was generated
 * from the Package A code at commit 078ad505 BEFORE the Package B world-model change and
 * must never be regenerated with newer code. Any edit changes this hash and fails here.
 */
export const LEGACY_V1_FIXTURE_SHA256 =
  'da67913b6d2cbeea39424120129930cbb2fa4e9a673a3df7e45b6e8f51d44683';
export const LEGACY_V1_FIXTURE_BYTES = 13052;

const root = join(__dirname, '..', '..', '..');
const fixturePath = join(
  root,
  'fixtures',
  'legacy',
  'package-a-world-v1-snapshot.json',
);

describe('frozen Package A v1 fixture', () => {
  it('matches its recorded SHA-256 and size', () => {
    const bytes = readFileSync(fixturePath);
    expect(bytes.length).toBe(LEGACY_V1_FIXTURE_BYTES);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      LEGACY_V1_FIXTURE_SHA256,
    );
  });

  it('agrees with the checked-in SHA256SUMS manifest', () => {
    const sums = readFileSync(
      join(root, 'fixtures', 'legacy', 'SHA256SUMS.txt'),
      'utf8',
    );
    expect(sums).toContain(
      `${LEGACY_V1_FIXTURE_SHA256}  package-a-world-v1-snapshot.json`,
    );
  });

  it('records the Package A golden values it was frozen with', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      generatedFromCommit: string;
      goldenExpected: { fingerprint: string; eventChainHead: string };
      genesis: { world: Record<string, unknown> };
    };
    expect(fixture.generatedFromCommit).toBe(
      '078ad505f7f31826b8d453121ebe46b3863fc148',
    );
    expect(fixture.goldenExpected.fingerprint).toBe(
      'fd3baa44a20b08e5e6f4948adc6f123da62c7239ad04062f185f8cec96a53bda',
    );
    expect(fixture.goldenExpected.eventChainHead).toBe(
      'd9c18cb91bcfe9f09afe2cbd58f154ceaea9cb65f7c0606c3c5a8e9729ff897a',
    );
    expect('worldModelVersion' in fixture.genesis.world).toBe(false);
  });
});

describe('frozen Package C v3 fixture', () => {
  it('matches its recorded SHA-256 and size and the checked-in manifest', () => {
    const p = join(
      root,
      'fixtures',
      'legacy',
      'package-c-world-v3-snapshot.json',
    );
    const bytes = readFileSync(p);
    expect(bytes.length).toBe(10233474);
    const sha = createHash('sha256').update(bytes).digest('hex');
    expect(sha).toBe(
      '1cd132df373ccabdf5093079fed48d35ed1854807729edf1c505dffcad44aafe',
    );
    const sums = readFileSync(
      join(root, 'fixtures', 'legacy', 'SHA256SUMS.txt'),
      'utf8',
    );
    expect(sums).toContain(`${sha}  package-c-world-v3-snapshot.json`);
  });
});
