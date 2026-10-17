import { describe, expect, it } from 'vitest';
import {
  PACKAGE_C_SEED,
  SYNTHETIC_PACKAGE_C_RULESET,
  UnknownTransactionSeasonError,
  createWorld,
  currentRightsHolder,
  currentRosterMembership,
  entityId,
  organizationRoster,
  recordId,
  requireTransactionRules,
  rosterCapacity,
  rosterInvariantFindings,
  seasonOfDate,
  worldId,
  type RosterState,
} from '../src/index';

const TX = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
const TODAY = '2027-02-15';
const NF = entityId('org-northfield');
const world = () =>
  createWorld(PACKAGE_C_SEED, SYNTHETIC_PACKAGE_C_RULESET, {
    newWorldId: () => worldId('world-roster-1'),
  });
const roster = (): RosterState => world().roster;

const pid = entityId('player-nf-01');

describe('roster queries', () => {
  it('derives the season from the logical calendar year', () => {
    expect(seasonOfDate('2027-02-15')).toBe(2027);
    expect(seasonOfDate('2028-12-31')).toBe(2028);
  });

  it('finds the current rights holder and treats a free agent as holderless', () => {
    const r = roster();
    expect(currentRightsHolder(r, pid, TODAY)?.holderOrganizationId).toBe(NF);
    expect(currentRightsHolder(r, entityId('player-fa-01'), TODAY)).toBe(
      undefined,
    );
    // Rights are as-of records: nothing is held before the interval starts.
    expect(currentRightsHolder(r, pid, '2025-01-01')).toBe(undefined);
  });

  it('draft and exclusive rights are rights but carry no roster membership', () => {
    const r = roster();
    expect(
      currentRightsHolder(r, entityId('player-eb-draftee'), TODAY)?.kind,
    ).toBe('draft');
    expect(
      currentRightsHolder(r, entityId('player-wl-exclusive'), TODAY)?.kind,
    ).toBe('exclusive');
    expect(
      currentRosterMembership(r, entityId('player-eb-draftee'), TODAY),
    ).toBe(undefined);
  });

  it('returns each organization roster grouped by status in stable player order', () => {
    const grouped = organizationRoster(roster(), NF, TODAY);
    expect(grouped.active.map((m) => m.playerId)).toEqual([
      'player-nf-01',
      'player-nf-02',
      'player-nf-03',
    ]);
    expect(grouped.reserve.map((m) => m.playerId)).toEqual(['player-nf-04']);
    expect(grouped.practice_squad.map((m) => m.playerId)).toEqual([
      'player-nf-05',
    ]);
  });

  it('reports capacity against the ruleset limits for the date', () => {
    const cap = rosterCapacity(roster(), TX, NF, TODAY);
    expect(cap.active).toEqual({ count: 3, limit: 10, room: 7 });
    expect(cap.reserve).toEqual({ count: 1, limit: 4, room: 3 });
    expect(cap.practice_squad).toEqual({ count: 1, limit: 4, room: 3 });
  });

  it('rejects a season the ruleset does not cover', () => {
    expect(() => rosterCapacity(roster(), TX, NF, '2040-01-01')).toThrow(
      UnknownTransactionSeasonError,
    );
  });

  it('is a pure read: it never changes the state it is given', () => {
    const r = roster();
    const before = JSON.stringify(r);
    organizationRoster(r, NF, TODAY);
    rosterCapacity(r, TX, NF, TODAY);
    rosterInvariantFindings(r, TX, TODAY);
    expect(JSON.stringify(r)).toBe(before);
  });
});

describe('roster invariants', () => {
  it('finds nothing wrong in the seeded world', () => {
    expect(rosterInvariantFindings(roster(), TX, TODAY)).toEqual([]);
  });

  const withExtras = (extra: Partial<RosterState>): RosterState => ({
    ...roster(),
    ...extra,
  });
  const base = roster();
  const codes = (r: RosterState) =>
    rosterInvariantFindings(r, TX, TODAY).map((f) => f.code);

  it('flags duplicate active rights for one player', () => {
    const dup = {
      ...base.rights[0]!,
      id: recordId('right-dup'),
      holderOrganizationId: entityId('org-southport'),
    };
    expect(codes(withExtras({ rights: [...base.rights, dup] }))).toContain(
      'DUPLICATE_ACTIVE_RIGHTS',
    );
  });

  it('flags duplicate active memberships for one player', () => {
    const dup = {
      ...base.memberships[0]!,
      id: recordId('mem-dup'),
      status: 'reserve' as const,
    };
    expect(
      codes(withExtras({ memberships: [...base.memberships, dup] })),
    ).toContain('DUPLICATE_ACTIVE_MEMBERSHIP');
  });

  it('flags a membership without a compatible contract right of the same organization', () => {
    const noRights = base.rights.filter((r) => r.playerId !== pid);
    expect(codes(withExtras({ rights: noRights }))).toContain(
      'MEMBERSHIP_WITHOUT_RIGHTS',
    );
    const wrongHolder = base.rights.map((r) =>
      r.playerId === pid
        ? { ...r, holderOrganizationId: entityId('org-southport') }
        : r,
    );
    expect(codes(withExtras({ rights: wrongHolder }))).toContain(
      'MEMBERSHIP_WITHOUT_RIGHTS',
    );
    const draftOnly = base.rights.map((r) =>
      r.playerId === pid ? { ...r, kind: 'draft' as const } : r,
    );
    expect(codes(withExtras({ rights: draftOnly }))).toContain(
      'MEMBERSHIP_WITHOUT_RIGHTS',
    );
  });

  it('flags each status over its ruleset limit', () => {
    const extra = (
      status: 'active' | 'reserve' | 'practice_squad',
      n: number,
    ) =>
      Array.from({ length: n }, (_, i) => ({
        ...base.memberships[0]!,
        id: recordId(`mem-extra-${status}-${i}`),
        playerId: entityId(`player-fa-0${(i % 5) + 1}`),
        status,
      }));
    const over = (
      status: 'active' | 'reserve' | 'practice_squad',
      n: number,
    ) => {
      const r = withExtras({
        memberships: [...base.memberships, ...extra(status, n)],
      });
      return codes(r);
    };
    expect(over('reserve', 4)).toContain('RESERVE_OVER_LIMIT');
    expect(over('practice_squad', 5)).toContain('PRACTICE_SQUAD_OVER_LIMIT');
    const manyActive = Array.from({ length: 11 }, (_, i) => ({
      ...base.memberships[0]!,
      id: recordId(`mem-act-${i}`),
      playerId: entityId(`player-pr-${String(i + 1).padStart(2, '0')}`),
      status: 'active' as const,
    }));
    expect(
      codes(withExtras({ memberships: [...base.memberships, ...manyActive] })),
    ).toContain('ACTIVE_OVER_LIMIT');
  });

  it('returns findings in a stable, sorted order', () => {
    const dup = {
      ...base.memberships[0]!,
      id: recordId('mem-dup'),
      status: 'reserve' as const,
    };
    const r = withExtras({
      memberships: [...base.memberships, dup],
      rights: base.rights.filter(
        (x) => x.playerId !== entityId('player-nf-02'),
      ),
    });
    const a = rosterInvariantFindings(r, TX, TODAY);
    const b = rosterInvariantFindings(r, TX, TODAY);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(1);
  });
});
