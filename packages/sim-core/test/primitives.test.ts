import { describe, expect, it } from 'vitest';
import {
  Hash32,
  SimDate,
  canonicalBytes,
  commandId,
  entityId,
  eventId,
  worldId,
  worldRevision,
} from '../src/index';

const utf8 = (s: string): Uint8Array => {
  const out: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      );
  }
  return Uint8Array.from(out);
};
const text = (b: Uint8Array): string => Array.from(b, (x) => String.fromCharCode(x)).join('');

describe('branded ids', () => {
  it('round-trips ids and revisions as plain values', () => {
    expect(String(worldId('world-1'))).toBe('world-1');
    expect(String(entityId('person:42'))).toBe('person:42');
    expect(String(commandId('cmd.0001'))).toBe('cmd.0001');
    expect(String(eventId('evt_1'))).toBe('evt_1');
    expect(Number(worldRevision(7))).toBe(7);
  });

  it('rejects malformed ids and revisions', () => {
    expect(() => worldId('')).toThrow();
    expect(() => entityId('has space')).toThrow();
    expect(() => commandId('x'.repeat(129))).toThrow();
    expect(() => worldRevision(-1)).toThrow();
    expect(() => worldRevision(1.5)).toThrow();
    expect(() => worldRevision(Number.NaN)).toThrow();
  });
});

describe('SimDate', () => {
  it('adds days across a month boundary: 2026-10-16 + 1 = 2026-10-17', () => {
    expect(SimDate.parse('2026-10-16').addDays(1).toISO()).toBe('2026-10-17');
    expect(SimDate.parse('2026-10-31').addDays(1).toISO()).toBe('2026-11-01');
    expect(SimDate.parse('2026-12-31').addDays(1).toISO()).toBe('2027-01-01');
  });

  it('handles leap days', () => {
    expect(SimDate.parse('2028-02-28').addDays(1).toISO()).toBe('2028-02-29');
    expect(SimDate.parse('2028-02-29').addDays(1).toISO()).toBe('2028-03-01');
    expect(SimDate.parse('2027-02-28').addDays(1).toISO()).toBe('2027-03-01');
    expect(SimDate.parse('2100-02-28').addDays(1).toISO()).toBe('2100-03-01');
    expect(SimDate.parse('2000-02-28').addDays(1).toISO()).toBe('2000-02-29');
  });

  it('supports negative and large day offsets round-trip', () => {
    expect(SimDate.parse('2026-03-01').addDays(-1).toISO()).toBe('2026-02-28');
    const d = SimDate.parse('2026-10-16');
    expect(d.addDays(1000).addDays(-1000).toISO()).toBe('2026-10-16');
    expect(d.addDays(365).toISO()).toBe('2027-10-16');
  });

  it('rejects invalid ISO dates and non-integer offsets', () => {
    expect(() => SimDate.parse('2026-02-30')).toThrow();
    expect(() => SimDate.parse('2026-13-01')).toThrow();
    expect(() => SimDate.parse('2026-1-1')).toThrow();
    expect(() => SimDate.parse('2026-10-16T00:00:00Z')).toThrow();
    expect(() => SimDate.parse('2026-10-16').addDays(1.5)).toThrow();
  });

  it('orders and compares by calendar day', () => {
    const a = SimDate.parse('2026-10-16');
    const b = SimDate.parse('2026-10-17');
    expect(a.compare(b)).toBeLessThan(0);
    expect(b.compare(a)).toBeGreaterThan(0);
    expect(a.equals(SimDate.parse('2026-10-16'))).toBe(true);
    expect(b.daysSince(a)).toBe(1);
  });
});

describe('canonicalBytes', () => {
  it('orders object keys deterministically regardless of insertion order', () => {
    const a = canonicalBytes({ b: 1, a: [true, null, 'x'], c: { z: 2, y: 3 } });
    const b = canonicalBytes({ c: { y: 3, z: 2 }, a: [true, null, 'x'], b: 1 });
    expect(text(a)).toBe('{"a":[true,null,"x"],"b":1,"c":{"y":3,"z":2}}');
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('encodes non-ASCII strings as UTF-8 bytes', () => {
    expect(Array.from(canonicalBytes('é'))).toEqual(Array.from(utf8('"é"')));
    expect(Array.from(canonicalBytes('😀'))).toEqual(Array.from(utf8('"😀"')));
  });

  it('rejects values that are not exactly representable across runtimes', () => {
    expect(() => canonicalBytes({ a: undefined })).toThrow();
    expect(() => canonicalBytes(1.5)).toThrow();
    expect(() => canonicalBytes(Number.NaN)).toThrow();
    expect(() => canonicalBytes(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => canonicalBytes(-0)).toThrow();
    expect(() => canonicalBytes(2 ** 53)).toThrow();
    expect(() => canonicalBytes(() => 1)).toThrow();
    expect(() => canonicalBytes(new Date(0))).toThrow();
    expect(() => canonicalBytes(BigInt(1))).toThrow();
  });

  it('rejects cycles and sparse arrays', () => {
    const cyc: Record<string, unknown> = {};
    cyc.self = cyc;
    expect(() => canonicalBytes(cyc)).toThrow();
    // eslint-disable-next-line no-sparse-arrays
    expect(() => canonicalBytes([1, , 3])).toThrow();
  });
});

describe('Hash32.sha256', () => {
  it('matches the NIST vector for "abc"', () => {
    expect(Hash32.sha256(utf8('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches the empty-input vector and returns 64 lowercase hex chars', () => {
    const h = Hash32.sha256(new Uint8Array(0));
    expect(h).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches the two-block NIST vector', () => {
    expect(
      Hash32.sha256(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')),
    ).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });
});
