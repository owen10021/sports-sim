import { describe, expect, it } from 'vitest';
import {
  applyCapabilityDeltas,
  emptyRosterState,
  entityId,
  recordId,
  type RosterState,
} from '../src/index';

const playerId = entityId('player-a');
const roster = (): RosterState => ({
  ...emptyRosterState(),
  players: [
    {
      personId: playerId,
      birthDate: '2001-01-01',
      primaryRole: 'QB',
      roleTags: ['QB'],
      capabilities: [
        { key: 'arm_strength', valueBp: 5000 },
        { key: 'recognition', valueBp: 6000 },
      ],
    },
    {
      personId: entityId('player-b'),
      birthDate: '2002-01-01',
      primaryRole: 'WR',
      roleTags: ['WR'],
      capabilities: [{ key: 'speed', valueBp: 7000 }],
    },
  ],
  rights: [
    {
      id: recordId('right-a'),
      playerId,
      holderOrganizationId: entityId('org-a'),
      kind: 'contract',
      sourceRecordId: recordId('contract-a'),
      effectiveFrom: '2027-01-01',
      effectiveUntil: null,
    },
  ],
});
const delta = (capabilityKey: string, deltaBp: number) => ({
  playerId,
  capabilityKey,
  deltaBp,
});

describe('capability mutation boundary', () => {
  it('changes only specified dimensions and preserves all identity, role and rights', () => {
    const r = roster();
    const before = JSON.stringify(r);
    const updated = applyCapabilityDeltas(r, [
      delta('arm_strength', 25),
      delta('recognition', -40),
    ]);
    expect(updated.players[0]!.capabilities).toEqual([
      { key: 'arm_strength', valueBp: 5025 },
      { key: 'recognition', valueBp: 5960 },
    ]);
    expect({ ...updated.players[0], capabilities: [] }).toEqual({
      ...r.players[0],
      capabilities: [],
    });
    expect(updated.players[1]).toBe(r.players[1]);
    for (const key of [
      'rights',
      'memberships',
      'waivers',
      'waiverClaims',
      'waiverPriority',
    ] as const)
      expect(updated[key]).toBe(r[key]);
    expect(JSON.stringify(r)).toBe(before);
    expect(
      applyCapabilityDeltas(r, [
        delta('recognition', -40),
        delta('arm_strength', 25),
      ]),
    ).toEqual(updated);
  });

  it('allows empty, zero and exact endpoint changes', () => {
    const r = roster();
    expect(applyCapabilityDeltas(r, [])).toEqual(r);
    expect(applyCapabilityDeltas(r, [delta('arm_strength', 0)])).toEqual(r);
    const updated = applyCapabilityDeltas(r, [
      delta('arm_strength', -5000),
      delta('recognition', 4000),
    ]);
    expect(updated.players[0]!.capabilities.map((c) => c.valueBp)).toEqual([
      0, 10000,
    ]);
  });

  it.each(['overall', 'potential', 'speed', 'undeclared'])(
    'cannot create capability %s',
    (key) => {
      expect(() => applyCapabilityDeltas(roster(), [delta(key, 1)])).toThrow(
        /capability/,
      );
    },
  );

  it.each([-5001, 5001, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid or out-of-range delta %s atomically',
    (amount) => {
      const r = roster();
      const before = JSON.stringify(r);
      expect(() =>
        applyCapabilityDeltas(r, [
          delta('recognition', 1),
          delta('arm_strength', amount),
        ]),
      ).toThrow(/delta|range/);
      expect(JSON.stringify(r)).toBe(before);
    },
  );

  it('rejects unknown players and duplicate dimensions rather than applying order-dependent updates', () => {
    const r = roster();
    expect(() =>
      applyCapabilityDeltas(r, [
        { ...delta('arm_strength', 1), playerId: entityId('missing') },
      ]),
    ).toThrow(/player/);
    expect(() =>
      applyCapabilityDeltas(r, [
        delta('arm_strength', 1),
        delta('arm_strength', -1),
      ]),
    ).toThrow(/duplicate/);
  });
});
