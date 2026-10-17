import {
  transactionSeasonRules,
  type TransactionRulesV1,
  type TransactionSeasonRules,
} from './economy';
import { entityId, recordId, type EntityId, type RecordId } from './ids';
import type { PackageCSubstrateSeed } from './packageCSeedParse';

/**
 * Roster & Player domain state (Package C). Authoritative: player football-capability
 * truth, roster rights, roster membership and the waiver process. Derived views (rosters,
 * capacity counts) are rebuildable and never stored here.
 *
 * LATENT TRUTH: `PlayerCapability` values are the simulation's private truth about a
 * player. No organization, human or CPU decision path may read them; ordinary actors only
 * see Package B claims and beliefs. There is deliberately no summary rating, ceiling,
 * grade or value field on a player.
 */

/** One specific latent dimension, fixed-point basis points `0..10000`. */
export type PlayerCapability = {
  readonly key: string;
  readonly valueBp: number;
};

export type PlayerRecord = {
  /** A Package B person entity. */
  readonly personId: EntityId;
  readonly birthDate: string;
  readonly primaryRole: string;
  readonly roleTags: readonly string[];
  readonly capabilities: readonly PlayerCapability[];
};

export const RIGHTS_KINDS = ['contract', 'draft', 'exclusive'] as const;
export type RightsKind = (typeof RIGHTS_KINDS)[number];

/**
 * An organization's right to a player over an interval. An unrestricted free agent has no
 * active right. `sourceRecordId` names the record the right derives from (a contract
 * agreement, a draft selection, or a seed origin record).
 */
export type PlayerRightsRecord = {
  readonly id: RecordId;
  readonly playerId: EntityId;
  readonly holderOrganizationId: EntityId;
  readonly kind: RightsKind;
  readonly sourceRecordId: RecordId;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
};

export const ROSTER_STATUSES = ['active', 'reserve', 'practice_squad'] as const;
export type RosterStatus = (typeof ROSTER_STATUSES)[number];

export type RosterMembership = {
  readonly id: RecordId;
  readonly playerId: EntityId;
  readonly organizationId: EntityId;
  readonly status: RosterStatus;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly sourceRecordId: RecordId;
};

export type RosterState = {
  readonly players: readonly PlayerRecord[];
  readonly rights: readonly PlayerRightsRecord[];
  readonly memberships: readonly RosterMembership[];
  /** Refined by Task 7 (waivers). */
  readonly waivers: readonly unknown[];
  readonly waiverClaims: readonly unknown[];
  /** One complete, unique organization order (empty until seeded). */
  readonly waiverPriority: readonly EntityId[];
};

export const emptyRosterState = (): RosterState => ({
  players: [],
  rights: [],
  memberships: [],
  waivers: [],
  waiverClaims: [],
  waiverPriority: [],
});

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Initial roster state from the seed's Package C block, in canonical (stable id) order. */
export const seededRosterState = (
  sub: PackageCSubstrateSeed | undefined,
): RosterState => {
  if (sub === undefined) return emptyRosterState();
  return {
    players: sub.players
      .map((p): PlayerRecord => ({
        personId: entityId(p.personId),
        birthDate: p.birthDate,
        primaryRole: p.primaryRole,
        roleTags: [...p.roleTags].sort(byText),
        capabilities: p.capabilities
          .map((c) => ({ key: c.key, valueBp: c.valueBp }))
          .sort((a, b) => byText(a.key, b.key)),
      }))
      .sort((a, b) => byText(a.personId, b.personId)),
    rights: sub.rights
      .map((r): PlayerRightsRecord => ({
        id: recordId(r.id),
        playerId: entityId(r.playerId),
        holderOrganizationId: entityId(r.holderOrganizationId),
        kind: r.kind,
        sourceRecordId: recordId(r.sourceRecordId),
        effectiveFrom: r.effectiveFrom,
        effectiveUntil: r.effectiveUntil,
      }))
      .sort((a, b) => byText(a.id, b.id)),
    memberships: sub.memberships
      .map((m): RosterMembership => ({
        id: recordId(m.id),
        playerId: entityId(m.playerId),
        organizationId: entityId(m.organizationId),
        status: m.status,
        effectiveFrom: m.effectiveFrom,
        effectiveUntil: m.effectiveUntil,
        sourceRecordId: recordId(m.sourceRecordId),
      }))
      .sort((a, b) => byText(a.id, b.id)),
    waivers: [],
    waiverClaims: [],
    waiverPriority: sub.waiverPriority.map((o) => entityId(o)),
  };
};

// ---------------------------------------------------------------------------
// Pure queries and invariants (derived, never stored)
// ---------------------------------------------------------------------------

/**
 * The ruleset season a logical date belongs to. Interpretation: the calendar year of the
 * date, because the ruleset keys every season's cap, limits, windows and draft date by one
 * year number. A date in a year the ruleset does not cover has no rules and is refused by
 * `transactionSeasonRules`.
 */
export const seasonOfDate = (date: string): number => Number(date.slice(0, 4));

type Interval = {
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
};
const isEffectiveOn = (r: Interval, date: string): boolean =>
  r.effectiveFrom <= date &&
  (r.effectiveUntil === null || date <= r.effectiveUntil);

/** Every right in force for a player on `date`, in stable id order. */
export const activeRightsFor = (
  roster: Pick<RosterState, 'rights'>,
  playerId: EntityId,
  date: string,
): readonly PlayerRightsRecord[] =>
  roster.rights
    .filter((r) => r.playerId === playerId && isEffectiveOn(r, date))
    .sort((a, b) => byText(a.id, b.id));

/** The organization holding rights to a player on `date`; `undefined` for a free agent. */
export const currentRightsHolder = (
  roster: Pick<RosterState, 'rights'>,
  playerId: EntityId,
  date: string,
): PlayerRightsRecord | undefined => activeRightsFor(roster, playerId, date)[0];

const activeMembershipsFor = (
  roster: Pick<RosterState, 'memberships'>,
  playerId: EntityId,
  date: string,
): readonly RosterMembership[] =>
  roster.memberships
    .filter((m) => m.playerId === playerId && isEffectiveOn(m, date))
    .sort((a, b) => byText(a.id, b.id));

export const currentRosterMembership = (
  roster: Pick<RosterState, 'memberships'>,
  playerId: EntityId,
  date: string,
): RosterMembership | undefined =>
  activeMembershipsFor(roster, playerId, date)[0];

export type GroupedRoster = {
  readonly [S in RosterStatus]: readonly RosterMembership[];
};

/** An organization's roster on `date`, grouped by status, in stable player order. */
export const organizationRoster = (
  roster: Pick<RosterState, 'memberships'>,
  organizationId: EntityId,
  date: string,
): GroupedRoster => {
  const mine = roster.memberships
    .filter(
      (m) => m.organizationId === organizationId && isEffectiveOn(m, date),
    )
    .sort((a, b) => byText(a.playerId, b.playerId) || byText(a.id, b.id));
  return {
    active: mine.filter((m) => m.status === 'active'),
    reserve: mine.filter((m) => m.status === 'reserve'),
    practice_squad: mine.filter((m) => m.status === 'practice_squad'),
  };
};

export type StatusCapacity = {
  readonly count: number;
  readonly limit: number;
  /** Open slots; never negative (an over-limit state is reported by the invariant audit). */
  readonly room: number;
};
export type RosterCapacity = { readonly [S in RosterStatus]: StatusCapacity };

const limitFor = (
  seasonRules: TransactionSeasonRules,
  status: RosterStatus,
): number =>
  status === 'active'
    ? seasonRules.activeRosterLimit
    : status === 'reserve'
      ? seasonRules.reserveRosterLimit
      : seasonRules.practiceSquadLimit;

/** Roster counts against the ruleset limits for the date's season. Throws on an uncovered season. */
export const rosterCapacity = (
  roster: Pick<RosterState, 'memberships'>,
  tx: TransactionRulesV1,
  organizationId: EntityId,
  date: string,
): RosterCapacity => {
  const rules = transactionSeasonRules(tx, seasonOfDate(date));
  const grouped = organizationRoster(roster, organizationId, date);
  const one = (status: RosterStatus): StatusCapacity => {
    const count = grouped[status].length;
    const limit = limitFor(rules, status);
    return { count, limit, room: Math.max(0, limit - count) };
  };
  return {
    active: one('active'),
    reserve: one('reserve'),
    practice_squad: one('practice_squad'),
  };
};

/** Whether `organizationId` holds a contract right to the player on `date`. */
export const holdsContractRight = (
  roster: Pick<RosterState, 'rights'>,
  playerId: EntityId,
  organizationId: EntityId,
  date: string,
): boolean =>
  activeRightsFor(roster, playerId, date).some(
    (r) => r.holderOrganizationId === organizationId && r.kind === 'contract',
  );

export const ROSTER_INVARIANT_CODES = [
  'ACTIVE_OVER_LIMIT',
  'DUPLICATE_ACTIVE_MEMBERSHIP',
  'DUPLICATE_ACTIVE_RIGHTS',
  'MEMBERSHIP_WITHOUT_RIGHTS',
  'PRACTICE_SQUAD_OVER_LIMIT',
  'RESERVE_OVER_LIMIT',
] as const;
export type RosterInvariantCode = (typeof ROSTER_INVARIANT_CODES)[number];

export type RosterInvariantFinding = {
  readonly code: RosterInvariantCode;
  readonly organizationId: EntityId | null;
  readonly playerId: EntityId | null;
  readonly detail: string;
};

const bySubject = (
  a: RosterInvariantFinding,
  b: RosterInvariantFinding,
): number =>
  byText(a.code, b.code) ||
  byText(a.organizationId ?? '', b.organizationId ?? '') ||
  byText(a.playerId ?? '', b.playerId ?? '');

/**
 * Audits roster conservation on `date`: one holder and one membership per player, every
 * membership backed by a contract right of the same organization, and every status within
 * the ruleset limit. Findings are sorted; a clean roster returns `[]`.
 */
export const rosterInvariantFindings = (
  roster: Pick<RosterState, 'rights' | 'memberships'>,
  tx: TransactionRulesV1,
  date: string,
): readonly RosterInvariantFinding[] => {
  const findings: RosterInvariantFinding[] = [];
  const rightsBy = new Map<EntityId, number>();
  for (const r of roster.rights)
    if (isEffectiveOn(r, date))
      rightsBy.set(r.playerId, (rightsBy.get(r.playerId) ?? 0) + 1);
  for (const [playerId, n] of rightsBy)
    if (n > 1)
      findings.push({
        code: 'DUPLICATE_ACTIVE_RIGHTS',
        organizationId: null,
        playerId,
        detail: `${playerId} has ${n} active rights records`,
      });
  const membershipsBy = new Map<EntityId, number>();
  const orgs = new Set<EntityId>();
  for (const m of roster.memberships) {
    if (!isEffectiveOn(m, date)) continue;
    orgs.add(m.organizationId);
    membershipsBy.set(m.playerId, (membershipsBy.get(m.playerId) ?? 0) + 1);
    if (!holdsContractRight(roster, m.playerId, m.organizationId, date))
      findings.push({
        code: 'MEMBERSHIP_WITHOUT_RIGHTS',
        organizationId: m.organizationId,
        playerId: m.playerId,
        detail: `${m.playerId} is on ${m.organizationId} without a contract right held by it`,
      });
  }
  for (const [playerId, n] of membershipsBy)
    if (n > 1)
      findings.push({
        code: 'DUPLICATE_ACTIVE_MEMBERSHIP',
        organizationId: null,
        playerId,
        detail: `${playerId} has ${n} active memberships`,
      });
  const overCode = {
    active: 'ACTIVE_OVER_LIMIT',
    reserve: 'RESERVE_OVER_LIMIT',
    practice_squad: 'PRACTICE_SQUAD_OVER_LIMIT',
  } as const;
  for (const organizationId of orgs) {
    const cap = rosterCapacity(roster, tx, organizationId, date);
    for (const status of ROSTER_STATUSES)
      if (cap[status].count > cap[status].limit)
        findings.push({
          code: overCode[status],
          organizationId,
          playerId: null,
          detail: `${organizationId} has ${cap[status].count} ${status} players, limit ${cap[status].limit}`,
        });
  }
  return findings.sort(bySubject);
};
