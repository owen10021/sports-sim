import { entityId, recordId, type EntityId, type RecordId } from './ids';
import type { PackageCSubstrateSeed } from './packageCSeedParse';

/**
 * Draft & Scouting domain: draft state (Package C). Draft classes, pick assets,
 * organizational board revisions, sessions and selections. Board/session/selection
 * element types are refined by Tasks 12 and 13.
 */

export type DraftClass = {
  readonly id: RecordId;
  readonly season: number;
  readonly eligiblePlayerIds: readonly EntityId[];
};

export const DRAFT_PICK_STATUSES = ['available', 'used'] as const;
export type DraftPickStatus = (typeof DRAFT_PICK_STATUSES)[number];

/**
 * A draft-pick asset. `slot` is the pick number within the round once order is known and
 * null for future picks. Ownership is authoritative and conserved; there is no stored value.
 */
export type DraftPickAsset = {
  readonly id: RecordId;
  readonly season: number;
  readonly round: number;
  readonly slot: number | null;
  readonly originalOrganizationId: EntityId;
  readonly ownerOrganizationId: EntityId;
  readonly status: DraftPickStatus;
};

export const NEED_PRIORITIES = [
  'low',
  'normal',
  'high',
  'must_address',
] as const;
export type NeedPriority = (typeof NEED_PRIORITIES)[number];

/** Tiers are ordinal groups (1 is the club's highest) that avoid false precision. */
export const MIN_BOARD_TIER = 1;
export const MAX_BOARD_TIER = 8;

/**
 * One prospect on an organization's board. The tier a prospect sits in is the club's
 * evaluation; `needPriority` is separate and can change without rewriting it. The entry
 * carries references to the club's own knowledge only: never raw player capabilities.
 */
export type DraftBoardEntry = {
  readonly playerId: EntityId;
  readonly beliefIds: readonly RecordId[];
  readonly roleProjection: string | null;
  /** Null for a genuine tie or real uncertainty about the order inside the tier. */
  readonly withinTierOrder: number | null;
  readonly needPriority: NeedPriority;
  readonly planIds: readonly RecordId[];
  readonly noteClaimIds: readonly RecordId[];
};

export type DraftBoardTier = {
  readonly tier: number;
  readonly entries: readonly DraftBoardEntry[];
};

/** An immutable board revision. A new revision links to the one it replaces. */
export type DraftBoardRevision = {
  readonly id: RecordId;
  readonly organizationId: EntityId;
  readonly draftClassId: RecordId;
  readonly revision: number;
  readonly tiers: readonly DraftBoardTier[];
  readonly createdAt: string;
  readonly supersedesBoardRevisionId: RecordId | null;
  readonly organizationProposalId: RecordId;
  readonly createdByPersonId: EntityId;
};

export type DraftState = {
  readonly classes: readonly DraftClass[];
  readonly picks: readonly DraftPickAsset[];
  readonly boards: readonly DraftBoardRevision[];
  readonly sessions: readonly unknown[];
  readonly selections: readonly unknown[];
};

export const emptyDraftState = (): DraftState => ({
  classes: [],
  picks: [],
  boards: [],
  sessions: [],
  selections: [],
});

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Initial draft state from the seed's Package C block, in canonical (stable id) order. */
export const seededDraftState = (
  sub: PackageCSubstrateSeed | undefined,
): DraftState => {
  if (sub === undefined) return emptyDraftState();
  return {
    ...emptyDraftState(),
    classes: sub.draftClasses
      .map((c): DraftClass => ({
        id: recordId(c.id),
        season: c.season,
        eligiblePlayerIds: c.eligiblePlayerIds
          .map((p) => entityId(p))
          .sort(byText),
      }))
      .sort((a, b) => byText(a.id, b.id)),
    picks: sub.draftPicks
      .map((p): DraftPickAsset => ({
        id: recordId(p.id),
        season: p.season,
        round: p.round,
        slot: p.slot,
        originalOrganizationId: entityId(p.originalOrganizationId),
        ownerOrganizationId: entityId(p.ownerOrganizationId),
        status: p.status,
      }))
      .sort((a, b) => byText(a.id, b.id)),
  };
};
