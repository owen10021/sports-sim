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

export type DraftState = {
  readonly classes: readonly DraftClass[];
  readonly picks: readonly DraftPickAsset[];
  readonly boards: readonly unknown[];
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
