import { describe, expect, it } from 'vitest';
import {
  GENESIS_HASH,
  chainEvent,
  commandId,
  entityId,
  eventId,
  verifyEventChain,
  worldRevision,
  type EventBody,
  type EventEnvelope,
} from '../src/index';

const body = (n: number): EventBody => ({
  eventId: eventId(`evt-${n}`),
  revision: worldRevision(n),
  simDate: '2026-10-16',
  actor: { kind: 'test_harness', id: entityId('actor-1') },
  commandId: commandId(`cmd-${n}`),
  type: 'Test',
  payload: { n },
});

// Independent reference hashes (Python: sha256 over canonical JSON of {previousHash, body}).
const H1 = '7a668fe963c12dfba59b200063d62664249346128b1ec0727361138a5096c382';
const H2 = '40052db28f8c73413ed2e4f57ee7d1be1cd2f84e7b39fdc52c1fc578f9f8625f';
const H3 = '8ab36c0cb0def96c78d6408ee1680c00200b6b475ba8dcb0bff26122b501c46d';

const chain = (count = 3): EventEnvelope[] => {
  const out: EventEnvelope[] = [];
  let prev: string = GENESIS_HASH;
  for (let n = 1; n <= count; n++) {
    const e = chainEvent(prev, body(n));
    out.push(e);
    prev = e.hash;
  }
  return out;
};

describe('tamper-evident audit chain', () => {
  it('uses an all-zero genesis hash and produces the reference hashes', () => {
    expect(GENESIS_HASH).toBe('0'.repeat(64));
    const events = chain();
    expect(events[0]!.previousHash).toBe(GENESIS_HASH);
    expect(events.map((e) => e.hash)).toEqual([H1, H2, H3]);
    expect(events[1]!.previousHash).toBe(H1);
    expect(events[2]!.previousHash).toBe(H2);
  });

  it('is deterministic: same body + previous hash gives the same envelope', () => {
    expect(chainEvent(GENESIS_HASH, body(1))).toEqual(
      chainEvent(GENESIS_HASH, body(1)),
    );
    expect(chainEvent(GENESIS_HASH, body(1)).hash).not.toBe(
      chainEvent(H1, body(1)).hash,
    );
  });

  it('verifies an intact chain and reports its head (empty chain head is genesis)', () => {
    const res = verifyEventChain(chain());
    expect(res).toEqual({ ok: true, headHash: H3, count: 3 });
    expect(verifyEventChain([])).toEqual({
      ok: true,
      headHash: GENESIS_HASH,
      count: 0,
    });
  });

  it('can verify a tail segment given the previous hash it must link to', () => {
    const tail = chain().slice(1);
    expect(verifyEventChain(tail, H1)).toEqual({
      ok: true,
      headHash: H3,
      count: 2,
    });
    const bad = verifyEventChain(tail, GENESIS_HASH);
    expect(bad.ok).toBe(false);
  });

  it('detects payload tampering at the exact event', () => {
    const events = chain();
    const tampered: EventEnvelope[] = [
      events[0]!,
      { ...events[1]!, payload: { n: 999 } },
      events[2]!,
    ];
    const res = verifyEventChain(tampered);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.index).toBe(1);
      expect(res.reason).toBe('HASH_MISMATCH');
    }
  });

  it('detects broken previous-hash links, removed events and reordering', () => {
    const events = chain();
    const relinked = [
      events[0]!,
      { ...events[1]!, previousHash: 'f'.repeat(64) },
      events[2]!,
    ];
    const r1 = verifyEventChain(relinked);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toBe('BROKEN_LINK');

    const removed = [events[0]!, events[2]!];
    const r2 = verifyEventChain(removed);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe('BROKEN_LINK');

    const reordered = [events[1]!, events[0]!, events[2]!];
    expect(verifyEventChain(reordered).ok).toBe(false);
  });

  it('truncating the tail leaves a valid chain but a different head (callers compare heads)', () => {
    const events = chain();
    const res = verifyEventChain(events.slice(0, 2));
    expect(res).toEqual({ ok: true, headHash: H2, count: 2 });
    expect(res.ok && res.headHash).not.toBe(H3);
  });

  it('enforces append-only ordering: non-decreasing revisions and unique event ids', () => {
    const a = chainEvent(GENESIS_HASH, body(2));
    const backwards = chainEvent(a.hash, {
      ...body(1),
      eventId: eventId('evt-other'),
    });
    const r1 = verifyEventChain([a, backwards]);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toBe('REVISION_ORDER');

    const first = chainEvent(GENESIS_HASH, body(1));
    const dup = chainEvent(first.hash, {
      ...body(2),
      eventId: eventId('evt-1'),
    });
    const r2 = verifyEventChain([first, dup]);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe('DUPLICATE_EVENT_ID');

    const sameRevision = chainEvent(first.hash, {
      ...body(1),
      eventId: eventId('evt-1b'),
    });
    expect(verifyEventChain([first, sameRevision]).ok).toBe(true);
  });

  it('rejects malformed hashes in a chain', () => {
    const e = chain(1)[0]!;
    expect(verifyEventChain([{ ...e, hash: 'xyz' }]).ok).toBe(false);
    expect(() => chainEvent('not-a-hash', body(1))).toThrow();
  });
});
