import { effectiveRightsAt } from './authority';
import type { EntityId, RecordId } from './ids';
import type { BeliefRecord, ClaimRecord } from './information';
import { holdsRoleAt } from './people';
import type { FootballWorld } from './world';

/**
 * The single knowledge filter. Human-facing reads, command validation and CPU reasoning
 * inputs all go through these functions, so no path can see more than another.
 */

/** A claim as one viewer may see it: links and holders are limited to what they can see. */
export type ClaimView = ClaimRecord;

export interface BeliefView extends BeliefRecord {
  /** Distinct independent source families behind the visible evidence, sorted. */
  readonly evidenceSourceFamilyIds: readonly string[];
  /** Derived from the newer belief that supersedes this one; never stored on this belief. */
  readonly supersededByBeliefId: RecordId | null;
}

export interface OrganizationKnowledgeView {
  readonly organizationId: EntityId;
  readonly actorPersonId: EntityId;
  readonly asOf: string;
  readonly claims: readonly ClaimView[];
  readonly beliefs: readonly BeliefView[];
}

/**
 * Whether `actorPersonId`, acting for `organizationId`, may legitimately see `claim`.
 * Public claims are visible to any active member of any organization. Organization claims
 * need the organization to be a holder. Restricted claims additionally need to be the
 * source or to hold `execute` on organizational authority.
 */
export const isClaimVisibleTo = (
  world: FootballWorld,
  organizationId: EntityId,
  actorPersonId: EntityId,
  claim: ClaimRecord,
): boolean => {
  const today = world.simDate;
  if (!holdsRoleAt(world.people, organizationId, actorPersonId, today))
    return false;
  if (claim.visibility === 'public') return true;
  if (!claim.holderOrganizationIds.includes(organizationId)) return false;
  if (claim.visibility === 'organization') return true;
  return (
    claim.sourcePersonId === actorPersonId ||
    effectiveRightsAt(
      world,
      organizationId,
      actorPersonId,
      'organizational_authority',
      today,
    ).rights.includes('execute')
  );
};

/** The claim with this id if the viewer may see it; a hidden claim looks like a missing one. */
export const findVisibleClaim = (
  world: FootballWorld,
  organizationId: EntityId,
  actorPersonId: EntityId,
  claimId: string,
): ClaimRecord | undefined => {
  const claim = world.information.claims.find((c) => c.id === claimId);
  return claim !== undefined &&
    isClaimVisibleTo(world, organizationId, actorPersonId, claim)
    ? claim
    : undefined;
};

/** Only an organization's own members may see its beliefs, and no one else's. */
export const isBeliefVisibleTo = (
  world: FootballWorld,
  organizationId: EntityId,
  actorPersonId: EntityId,
  belief: BeliefRecord,
): boolean =>
  belief.organizationId === organizationId &&
  holdsRoleAt(world.people, organizationId, actorPersonId, world.simDate);

export const buildOrganizationKnowledgeView = (
  world: FootballWorld,
  organizationId: EntityId,
  actorPersonId: EntityId,
): OrganizationKnowledgeView => {
  const visible = world.information.claims.filter((c) =>
    isClaimVisibleTo(world, organizationId, actorPersonId, c),
  );
  const visibleIds = new Set<string>(visible.map((c) => c.id));
  const familyById = new Map(visible.map((c) => [c.id, c.sourceFamilyId]));

  const claims = visible.map((c): ClaimView => ({
    ...c,
    holderOrganizationIds: c.holderOrganizationIds.filter(
      (h) => h === organizationId,
    ),
    corroboratesClaimIds: c.corroboratesClaimIds.filter((id) =>
      visibleIds.has(id),
    ),
    contradictsClaimIds: c.contradictsClaimIds.filter((id) =>
      visibleIds.has(id),
    ),
    sharedFromClaimId:
      c.sharedFromClaimId !== null && visibleIds.has(c.sharedFromClaimId)
        ? c.sharedFromClaimId
        : null,
  }));

  const beliefs = world.information.beliefs
    .filter((b) => isBeliefVisibleTo(world, organizationId, actorPersonId, b))
    .map((b): BeliefView => {
      const evidenceClaimIds = b.evidenceClaimIds.filter((id) =>
        visibleIds.has(id),
      );
      const families = new Set<string>();
      for (const id of evidenceClaimIds) families.add(familyById.get(id)!);
      const newer = world.information.beliefs.find(
        (x) =>
          x.organizationId === organizationId && x.supersedesBeliefId === b.id,
      );
      return {
        ...b,
        evidenceClaimIds,
        evidenceSourceFamilyIds: [...families].sort(),
        supersededByBeliefId: newer === undefined ? null : newer.id,
      };
    });

  return {
    organizationId,
    actorPersonId,
    asOf: world.simDate,
    claims,
    beliefs,
  };
};
