import type { EntityId } from './ids';

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
