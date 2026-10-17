import type { EntityId } from './ids';
import type { Entity } from './world';

/** A persistent organization. Identity and name live in the generic entity registry. */
export interface OrganizationRecord {
  readonly entityId: EntityId;
  readonly active: boolean;
}

export interface OrganizationsState {
  readonly organizations: readonly OrganizationRecord[];
}

export const emptyOrganizationsState = (): OrganizationsState => ({
  organizations: [],
});

/** Initial organizations: one record per `organization` entity, in stable id order. */
export const seededOrganizationsState = (
  entities: readonly Entity[],
): OrganizationsState => ({
  organizations: entities
    .filter((e) => e.kind === 'organization')
    .map((e) => ({ entityId: e.id, active: true }))
    .sort((a, b) =>
      a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0,
    ),
});
