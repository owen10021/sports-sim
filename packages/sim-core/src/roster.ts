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
